#!/usr/bin/env python3
"""Merlin background voice service — natural conversation.

Standby:  always listening at minimal CPU (mic closed).
Wake:     "Hi Merlin" (keyword) or 👏👏 (double clap).
Session:  multi-turn conversation; barge-in stops playback instantly;
          8 s of silence after a response returns to standby.

Run via LaunchAgent (no terminal required). See launch/install.sh.
"""

import asyncio
import io
import logging
import os
import subprocess
import sys
import threading
import time
from collections import deque
from pathlib import Path

# ── Startup identity probe (runs before any logging handler) ──────────────────
# Print so the line is visible even if logging later redirects to a different fd.
print(f"[merlin_service] STARTUP  pid={os.getpid()}  __file__={__file__}", flush=True)

import numpy as np
import sounddevice as sd
from scipy.io import wavfile

# ── Add voice-gateway root to path ────────────────────────────────────────────
_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(_ROOT))

from dotenv import load_dotenv
load_dotenv(_ROOT / ".env")

from app.audio.sentence import SentenceBuffer
from app.config import settings
from app.memory import MemoryStore, extract_memories
from app.router import build_orchestrator, build_stt, build_tts
from app.trace_context import new_trace_id, get_trace_id
from service.barge_detector import BargeInWindowDetector
from service.control_state import RuntimeControlState
from service.mic_channel import DEFAULT_MIC_CHANNEL, select_mic_channel
from client import capture_guard
from service.turn_guard import evaluate_transcription_confidence, is_valid_utterance, is_bare_wake_word
from service.turn_state import TurnController, TurnState
from service.wake_trigger import WakeTrigger

_MEMORY_FILE = _ROOT / "memory" / "relationship" / "memories.json"

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s — %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("merlin.service")

# ── Audio constants ───────────────────────────────────────────────────────────
SAMPLE_RATE = 16_000
CHANNELS    = 1
BLOCK_SIZE  = 512

# ── VAD (recording) ───────────────────────────────────────────────────────────
# NOT the wake threshold: record_utterance needs headroom over the noise floor
# that wake detection can afford to sit inside.  See vad_config.COMMAND_RMS_THRESHOLD.
from service.vad_config import COMMAND_RMS_THRESHOLD as SILENCE_RMS
# print() survives before logging handlers are wired up
print(f"[merlin_service] SILENCE_RMS={SILENCE_RMS:.5f} loaded from service.vad_config", flush=True)
SILENCE_S    = 0.8     # 0.8 s trailing silence ends an utterance
MAX_RECORD_S = 30

# Minimum voiced audio an utterance must contain to be worth transcribing.
# Mirrors wake_trigger.SPEECH_MIN_S, which record_utterance never had.
#
# Without it a single block over SILENCE_RMS latches speech_on, and SILENCE_S
# then closes the utterance ~0.84 s later — before the user has begun speaking.
# Observed 2026-08-01 after the threshold split (service.log, PID 41280): six
# consecutive turns triggered at rms 0.0114–0.0138 (well clear of the 0.006 gate,
# so NOT the noise floor) and every one closed at total=0.84s with 0.00 s of
# voiced audio, shipping ~0.9 s of bleed to Whisper as 'はい。' / '。'.
# Real commands in the same log carry 2.19 s+ of voiced audio, so 0.30 s
# separates the two cleanly with wide margin on both sides.
COMMAND_MIN_SPEECH_S = 0.30
# Audio kept from BEFORE the gate opens, so the first phoneme is not clipped.
# The gate needs a block or two of energy to cross SILENCE_RMS, and on this rig a
# block is ~70 ms (3072 frames @ 44.1 kHz) — without a pre-roll the capture starts
# mid-word.  0.30 s covers ~4 blocks: enough for the onset, short enough that it
# cannot be mistaken for a silent prefix.
COMMAND_PREROLL_S = 0.30

# Ignore the acoustic tail immediately after wake detection.
COMMAND_START_GUARD_S = 0.35

# ── Barge-in (interrupt Merlin mid-speech) ────────────────────────────────────
# 2026-07-30: was 0.003 — identical to the ambient noise floor (~0.002–0.003),
# so room noise interrupted Merlin the instant he started speaking (log showed
# repeated "interrupted=True response_len=0").  Raised well above the floor so
# only real speech-over-Merlin barges in.
BARGE_IN_RMS    = 0.0040 # mic energy that counts as user speaking over Merlin.
                          # 2026-08-08 (live evidence): real user speech during playback
                          # measured ~0.003–0.005 (barge_candidate=False at 0.010), so 0.010
                          # rejected genuine barge before duration confirmation. First live
                          # baseline = 0.0040. Floor/correlation/confirm-duration/cancel logic
                          # unchanged — this only lowers the candidate gate.
BARGE_IN_FRAMES = 8      # legacy block-count lever (kept for back-compat / logging);
                          # confirmation is now TIME-based via BARGE_IN_CONFIRM_S below.
BARGE_IN_CONFIRM_S = 0.20 # ~200 ms of sustained real user speech confirms a barge-in.
                          # Duration-based (accumulated frames/samplerate) so it is
                          # INDEPENDENT of the ~69.66 ms duplex block size — the old
                          # "8 × 20 ms" assumption actually needed ~557 ms and never
                          # fired on real ~350 ms utterances (turn_id=22 evidence).
BARGE_IN_GRACE  = 0.5    # ignore first 0.5 s of playback (avoids echo trigger)
# 2026-07-30: BARGE_IN_ENABLED was set False after Merlin's own voice from the
# room speakers fed back into the Babyface mic and tripped barge-in ~0.5 s into
# every reply (log: real reply, then interrupted=True response_len=59). Root
# cause investigation (2026-08-06) found the deeper issue was not "missing echo
# cancellation" alone but DUAL CoreAudio stream ownership: a separate sd.play()
# output stream plus a separately-negotiated sd.InputStream for barge-in,
# opened concurrently, which is also what produced the CoreAudio -10863 device
# conflict on this rig. AudioPlayer.play_with_barge_in() below replaces both
# with ONE sd.Stream (single full-duplex open, one negotiated sample rate) —
# there is no second stream left to conflict with the first. Re-enabled on that
# basis; BARGE_IN_RMS/BARGE_IN_GRACE/BARGE_IN_FRAMES remain the levers to retune
# if live testing on this specific mic/speaker placement still shows
# self-triggering (residual acoustic echo without hardware AEC is still
# possible — this is a software-side mitigation, not true AEC).
BARGE_IN_ENABLED = True

# ── Conversation session ──────────────────────────────────────────────────────
CONVERSATION_TIMEOUT = 8.0   # seconds of post-response silence → standby
# 2026-08-07: run_conversation_session()'s STT-rejection branch did `continue`
# unconditionally, with no cap — a real recurring near-silence noise source in
# the room kept re-triggering VAD/STT faster than CONVERSATION_TIMEOUT's true-
# silence exit could ever fire, trapping the session for 10+ minutes straight.
# While trapped, control never returns to main()'s outer wake loop, so
# WakeTrigger's ClapDetector (only fed audio there) never runs — a physical
# clap during this window is silently lost, not misclassified. This is a
# control-flow bound, NOT a sensitivity retune: VAD/STT/clap thresholds are
# untouched. A conservative, honest number — not tuned against any specific
# noise sample — matching the existing "ask to repeat" intent: a few retries
# are reasonable, indefinite retries are not.
MAX_CONSECUTIVE_STT_REJECTIONS = 3

_CHIME = "/System/Library/Sounds/Tink.aiff"


# ── Interruptible audio player ────────────────────────────────────────────────

_TTS_SR = 24_000   # OpenAI TTS PCM sample rate (signed int16, mono)


class AudioPlayer:
    """Plays TTS PCM audio via sounddevice. interrupt() stops it immediately."""

    def __init__(self) -> None:
        self._interrupted = threading.Event()
        # 2026-08-08: shared TTS-active/cooldown signal with
        # client/capture_guard.py — record_utterance waits out
        # `.cooldown_active()` before opening its own InputStream, so
        # Merlin's own TTS tail cannot be captured as the start of the next
        # command (the "בדוק רשת" self-reingestion risk). Only the state
        # tracker is used here, never its mic-sampling path (that opens its
        # own sd.rec() stream, which is exactly the class of dual-stream
        # CoreAudio conflict that took barge-in down before — see
        # BARGE_IN_ENABLED history above).
        self._tts_guard = capture_guard.default_guard().tts

    def _play_sync(self, data: bytes) -> None:
        arr = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
        duration = len(arr) / _TTS_SR
        peak = float(np.max(np.abs(arr))) if arr.size else 0.0
        rms  = float(np.sqrt(np.mean(arr ** 2))) if arr.size else 0.0
        logger.info(
            "playback: pcm  bytes=%d  samples=%d  sr=%d  duration=%.2fs  peak=%.4f  rms=%.4f",
            len(data), len(arr), _TTS_SR, duration, peak, rms,
        )
        self._interrupted.clear()
        try:
            sd.play(arr, samplerate=_TTS_SR)
            sd.wait()
        except Exception as e:
            logger.warning("playback error: %s", e)

    async def play(self, data: bytes) -> None:
        if data:
            self._tts_guard.mark_started()
            try:
                await asyncio.get_running_loop().run_in_executor(None, self._play_sync, data)
            finally:
                self._tts_guard.mark_ended()

    def _chime_sync(self) -> None:
        try:
            subprocess.run(
                ["afplay", _CHIME],
                check=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        except Exception as e:
            logger.warning("chime error (ignored): %s", e)

    def chime(self) -> None:
        """Play the wake chime WITHOUT blocking the caller.

        `afplay` costs ~1.36 s of wall time for a 0.56 s sound — process spawn plus a
        CoreAudio device open dominate.  Awaiting it held the wake→listen path for
        that entire time, and in that window no audio is captured at all: the wake
        InputStream has already closed and the recorder has not opened yet.  A command
        spoken straight after the wake word fell into that hole and the session timed
        out with "no speech".

        The chime is feedback, not a gate, so it is fired and left to run while the
        recorder opens.  The returned future is intentionally dropped.
        """
        asyncio.get_running_loop().run_in_executor(None, self._chime_sync)

    def interrupt(self) -> None:
        """Called from the audio callback thread — must be lock-free."""
        self._interrupted.set()
        sd.stop()

    async def play_stream(self, stream) -> None:
        """Play float32 PCM chunks from an async generator of (np.ndarray, sample_rate).

        Starts an sd.OutputStream on the first chunk (sample_rate is not known
        until then).  Checks self._interrupted before every write so barge-in
        stops playback immediately without needing a separate sd.stop() call.
        """
        self._interrupted.clear()
        self._tts_guard.mark_started()
        out: sd.OutputStream | None = None
        loop = asyncio.get_running_loop()
        try:
            async for pcm_chunk, sr in stream:
                if self._interrupted.is_set():
                    break
                if out is None:
                    out = sd.OutputStream(
                        samplerate=sr,
                        channels=1,
                        dtype="float32",
                    )
                    out.start()
                    logger.info("play_stream: OutputStream opened sr=%d", sr)
                if not self._interrupted.is_set() and pcm_chunk.size:
                    await loop.run_in_executor(None, out.write, pcm_chunk)
        except Exception as e:
            logger.warning("play_stream error: %s", e)
        finally:
            self._tts_guard.mark_ended()
            if out is not None:
                try:
                    out.stop()
                    out.close()
                except Exception:
                    pass

    async def play_with_barge_in(
        self,
        pcm_i16: "np.ndarray",
        *,
        detector: BargeInWindowDetector | None,
        grace_s: float,
        turn_id: int | None = None,
        control_state: "RuntimeControlState | None" = None,
        turn_ctrl: "TurnController | None" = None,
    ) -> bool:
        """Play mono int16 PCM @ _TTS_SR while simultaneously reading the mic,
        in ONE full-duplex sd.Stream — not a separate output stream plus a
        separately-opened input stream (see BARGE_IN_ENABLED history above for
        why that combination is what produced CoreAudio -10863 on this rig).

        Returns True iff `detector` confirmed a barge-in before playback
        finished (equivalently: `self._interrupted` ends up set). If opening
        the duplex stream fails (device does not support simultaneous
        input+output at the negotiated rate), falls back to output-only
        playback via `self.play()` — Merlin still finishes the reply, just
        without barge-in for that one chunk — and returns False.
        """
        if pcm_i16.size == 0:
            return False
        self._interrupted.clear()

        if detector is None:
            await self.play(pcm_i16.tobytes())
            return False

        loop = asyncio.get_running_loop()
        done = loop.create_future()
        barged = {"flag": False}
        t_start = [None]  # set once the stream is actually running (first callback)

        def _finished() -> None:
            if not done.done():
                loop.call_soon_threadsafe(done.set_result, None)

        def _open_and_run(native_sr: int, in_channels: int, out_channels: int, turn_id) -> bool:
            # Confirmation is time-based (BARGE_IN_CONFIRM_S); give the detector the
            # REAL negotiated rate so frames->seconds is exact (duplex sr, e.g. 44100).
            detector.sample_rate = native_sr
            # REAL AEC (2026-08-10): ONE WebRTC APM per TURN, reused across every
            # chunk of this turn so the adaptive echo-filter state survives the
            # inter-chunk gaps (never re-created per sentence). A new turn_id
            # starts a fresh APM.
            if getattr(self, "_aec", None) is None or getattr(self, "_aec_turn_id", None) != turn_id:
                from service.aec import AecProcessor
                self._aec = AecProcessor(native_sr)
                self._aec_turn_id = turn_id
                logger.info(
                    "AEC_STATE turn_id=%s state=%s sr=%d frame=%d stream_delay_ms=%d err=%s",
                    turn_id, "active" if self._aec.enabled else "disabled",
                    native_sr, self._aec.frame, self._aec.stream_delay_ms, self._aec.init_error,
                )
            _aec = self._aec
            # ALWAYS-ON leakage rejection (barge P0, 2026-08-10). The prior
            # `= not _aec.enabled` DISABLED the correlation gate whenever AEC ran,
            # so the loud-output residual echo AEC could not fully remove (mic
            # 0.004-0.011 while output 0.02-0.12, correlation low at 25 ms) had
            # NOTHING to reject it -> false self-barge. AEC lowers the echo LEVEL;
            # the bounded-lag correlation (now widened past the device delay)
            # rejects whatever residual still correlates with the output history.
            detector.correlation_reject_enabled = True
            out_f32 = (pcm_i16.astype(np.float32) / 32768.0)
            if native_sr != _TTS_SR:
                from math import gcd as _gcd
                from scipy.signal import resample_poly as _resample_poly
                g = _gcd(native_sr, _TTS_SR)
                out_f32 = _resample_poly(out_f32, native_sr // g, _TTS_SR // g).astype(np.float32)
            pos = [0]
            n = len(out_f32)
            cb_count = [0]

            def _cb(indata, outdata, frames, time_info, status) -> None:
                cb_count[0] += 1
                if t_start[0] is None:
                    t_start[0] = time.monotonic()
                    logger.info(
                        "PLAYBACK_ACTIVE turn_id=%s duplex_sr=%d duplex_in_ch=%d duplex_out_ch=%d "
                        "block_frames=%d status=%s",
                        turn_id, native_sr, in_channels, out_channels, frames, status,
                    )

                # AUTHORITATIVE OUTPUT-OWNER GATE (final execution boundary): if
                # this generation no longer owns output (a newer turn was minted
                # or this turn was cancelled by ANY path, not only the detector),
                # emit silence and stop immediately. A stale generation can never
                # keep speaking.
                if turn_ctrl is not None and turn_id is not None and not turn_ctrl.owns_output(turn_id):
                    outdata[:] = 0.0
                    if not barged["flag"]:
                        barged["flag"] = True
                        self._interrupted.set()
                        logger.info("STALE_ASSISTANT_OUTPUT_DROPPED turn_id=%s where=playback_callback", turn_id)
                    raise sd.CallbackStop()

                end = min(pos[0] + frames, n)
                chunk = out_f32[pos[0]:end]
                outdata[: len(chunk), 0] = chunk
                if len(chunk) < frames:
                    outdata[len(chunk):, 0] = 0.0
                pos[0] = end

                # ── CONTINUOUS AEC (2026-08-10): select the mic and run the WebRTC
                # APM on EVERY callback — feeding render+capture continuously keeps
                # the adaptive echo filter converged across chunk boundaries. Doing
                # it only post-grace de-converged the filter at each chunk start,
                # producing a transient clean-RMS spike that self-barged. The barge
                # DECISION below stays grace-gated; only the AEC feed moved out.
                _throttled = (cb_count[0] % 10 == 0)
                ch_rms_all = None
                if indata.ndim > 1:
                    ch_rms_all = np.sqrt(np.mean(indata.astype(np.float32) ** 2, axis=0))
                    forced = control_state.forced_mic_channel if control_state is not None else None
                    mic_ch = select_mic_channel(ch_rms_all, forced=forced)
                    mic_raw = indata[:, mic_ch].astype(np.float32)
                    raw_rms = float(ch_rms_all[mic_ch])
                else:
                    mic_ch = 0
                    mic_raw = indata.astype(np.float32)
                    raw_rms = float(np.sqrt(np.mean(mic_raw ** 2))) if mic_raw.size else 0.0
                out_rms = float(np.sqrt(np.mean(chunk.astype(np.float32) ** 2))) if len(chunk) else 0.0
                # render = the EXACT PCM written to the device this callback
                # (outdata, incl. zero-pad); capture = the selected mic channel.
                render_blk = outdata[: len(mic_raw), 0]
                mic = _aec.clean_block(mic_raw, render_blk)          # AEC-clean mic (same length)
                rms = float(np.sqrt(np.mean(mic ** 2))) if mic.size else 0.0
                if _throttled:
                    logger.info(
                        "AEC_RAW_MIC_RMS turn_id=%s raw=%.5f AEC_CLEAN_MIC_RMS=%.5f AEC_RENDER_RMS=%.5f "
                        "AEC_ERLE_DB=%.1f AEC_STREAM_DELAY_MS=%d AEC_STATE=%s",
                        turn_id, raw_rms, rms, out_rms, _aec.last_erle_db,
                        _aec.stream_delay_ms, "active" if _aec.enabled else "raw",
                    )

                if not barged["flag"] and (time.monotonic() - t_start[0]) >= grace_s:
                    if _throttled:
                        logger.info("BARGE_CALLBACK turn_id=%s callback=%d", turn_id, cb_count[0])
                        if ch_rms_all is not None:
                            for _ch in range(ch_rms_all.shape[0]):
                                logger.info(
                                    "BARGE_CHANNEL_RMS turn_id=%s ch=%d rms=%.5f",
                                    turn_id, _ch, float(ch_rms_all[_ch]),
                                )
                            if control_state is not None:
                                peaks = {int(c): float(np.max(np.abs(indata[:, c]))) for c in range(ch_rms_all.shape[0])}
                                control_state.set_channel_rms(
                                    {int(c): float(ch_rms_all[c]) for c in range(ch_rms_all.shape[0])},
                                    peaks, mic_ch, rms, peaks.get(mic_ch, 0.0),
                                )

                    # Diagnostic telemetry (throttled — not every callback, per the
                    # real-time-callback-safety audit): every ~10th block (~0.7s @
                    # the measured ~70ms block period) log the evidence needed to
                    # tell apart "mic saw nothing" / "mic saw something but below
                    # floor" / "rejected as leakage" / "confirmed but didn't stop"
                    # from real numbers, not guesses. Field names match the trace
                    # contract in docs/MERLIN_LIVE_ACCEPTANCE_PROTOCOL.md
                    # (barge_candidate/accepted/rejected_reason).
                    if _throttled or rms >= detector.threshold:
                        logger.info(
                            "BARGE_SELECTED_RMS turn_id=%s ch=%d rms=%.5f", turn_id, mic_ch, rms,
                        )
                        logger.info(
                            "BARGE_MIC_RMS turn_id=%s rms=%.5f output_rms=%.5f mic_ch=%d run_count=%d "
                            "threshold=%.5f floor_rms=%.5f correlation=%.3f barge_candidate=%s",
                            turn_id, rms, out_rms, mic_ch, detector._run_count, detector.threshold,
                            detector._floor_rms, detector.last_correlation,
                            rms >= detector.threshold and rms >= (detector._floor_rms + detector.floor_margin),
                        )
                    if rms >= detector.threshold:
                        logger.info(
                            "BARGE_ABOVE_THRESHOLD turn_id=%s consecutive=%d rms=%.5f",
                            turn_id, detector._run_count + 1, rms,
                        )

                    if detector.feed(mic.copy(), rms, output_rms=out_rms, output_block=chunk, raw_block=mic_raw.copy()):
                        barged["flag"] = True
                        logger.info(
                            "USER_SPEECH_CONFIRMED turn_id=%s rms=%.5f output_rms=%.5f mic_ch=%d "
                            "max_abs_correlation=%.3f selected_lag_ms=%.1f raw_corr=%.3f floor_rms=%.5f",
                            turn_id, rms, out_rms, mic_ch, abs(detector.last_correlation),
                            detector.last_correlation_lag_ms, detector.last_correlation_raw, detector._floor_rms,
                        )
                        logger.info("PLAYBACK_TERMINATION_REQUESTED turn_id=%s", turn_id)
                        self._interrupted.set()
                        logger.info("USER_SPEECH_DETECTED turn_id=%s rms=%.4f output_rms=%.4f", turn_id, rms, out_rms)
                    elif detector.last_reject_reason and (_throttled or rms >= detector.threshold):
                        logger.info(
                            "BARGE_REJECTED turn_id=%s rejected_reason=%s mic_rms=%.5f output_rms=%.5f "
                            "max_abs_correlation=%.3f selected_lag_ms=%.1f raw_corr=%.3f history_samples=%d floor_rms=%.5f",
                            turn_id, detector.last_reject_reason, rms, out_rms, abs(detector.last_correlation),
                            detector.last_correlation_lag_ms, detector.last_correlation_raw,
                            detector.last_history_samples, detector._floor_rms,
                        )

                if self._interrupted.is_set() or pos[0] >= n:
                    if self._interrupted.is_set():
                        logger.info("PLAYBACK_TERMINATED turn_id=%s", turn_id)
                    raise sd.CallbackStop()

            stream = sd.Stream(
                samplerate=native_sr,
                channels=(in_channels, out_channels),
                dtype="float32",
                callback=_cb,
                finished_callback=_finished,
            )
            stream.start()
            _open_streams.append(stream)
            return True

        def _probe_and_open() -> bool:
            try:
                in_dev = sd.query_devices(kind="input")
                out_dev = sd.query_devices(kind="output")
                in_channels = max(1, int(in_dev.get("max_input_channels", 1)))
                out_channels = 1
                native_sr = int(in_dev.get("default_samplerate") or _TTS_SR)
                logger.info(
                    "DUPLEX_DEVICE input=%r output=%r DUPLEX_SR=%d DUPLEX_INPUT_CHANNELS=%d "
                    "DUPLEX_OUTPUT_CHANNELS=%d",
                    in_dev.get("name"), out_dev.get("name"), native_sr, in_channels, out_channels,
                )
                logger.info(
                    "DUPLEX_STREAM_OPEN turn_id=%s input_device=%r output_device=%r samplerate=%d "
                    "input_channels=%d selected_mic_channel=preferred(ch%d,forced-override-honored)",
                    turn_id, in_dev.get("name"), out_dev.get("name"), native_sr, in_channels,
                    DEFAULT_MIC_CHANNEL,
                )
                return _open_and_run(native_sr, in_channels, out_channels, turn_id)
            except Exception as exc:
                logger.warning(
                    "play_with_barge_in: duplex stream open failed (%s) — "
                    "falling back to output-only playback, no barge-in this turn",
                    exc,
                )
                return False

        _open_streams: list["sd.Stream"] = []
        opened = await loop.run_in_executor(None, _probe_and_open)
        if not opened:
            await self.play(pcm_i16.tobytes())
            return False

        self._tts_guard.mark_started()
        try:
            await done
        finally:
            self._tts_guard.mark_ended()
            for s in _open_streams:
                try:
                    s.stop()
                    s.close()
                except Exception:
                    pass

        return barged["flag"]


# ── Recording ─────────────────────────────────────────────────────────────────

class _CommandCapture:
    """Decides WHICH samples reach STT for one record_utterance call.

    Split out of the PortAudio callback so the buffering rules are testable
    without an audio device.  The callback still owns the device, the heartbeat
    logging and the initial-silence timeout; this owns the speech state machine
    and the buffer.

    The rule it exists to enforce: audio is buffered only while speech is on,
    plus COMMAND_PREROLL_S of lead-in.  Silence before the gate opens rolls
    through a bounded pre-roll ring and is otherwise dropped, so a false start
    followed by six seconds of quiet cannot pad the capture that follows.
    """

    def __init__(self, *, threshold: float, min_speech_s: float,
                 silence_s: float, max_record_s: float,
                 max_initial_silence: float | None,
                 preroll_s: float = COMMAND_PREROLL_S,
                 sample_rate: int = 0) -> None:
        self.threshold           = threshold
        self.min_speech_s        = min_speech_s
        self.silence_s           = silence_s
        self.max_record_s        = max_record_s
        self.max_initial_silence = max_initial_silence
        self.preroll_s           = preroll_s
        # 0 until the stream reports its rate; voiced_s then reads None and every
        # rule that depends on it fails open (unchanged behaviour).
        self.sample_rate         = sample_rate

        self.chunks: list[np.ndarray] = []
        self._preroll: deque[np.ndarray] = deque()
        self._preroll_samples = 0

        self.speech_on     = False
        self.voiced_frames = 0
        self.false_starts  = 0
        self.t_speech_on   = 0.0
        self.t_last_voice  = 0.0

        # Output-provenance audit counters (mirrors barge_detector.py's
        # _preroll_dropped_correlated_samples) — a block Merlin's own TTS was
        # actively producing when it arrived, never buffered anywhere.
        self.output_rejected_samples = 0
        self.user_accepted_samples   = 0

    @property
    def voiced_s(self) -> float | None:
        if self.sample_rate <= 0:
            return None
        return self.voiced_frames / self.sample_rate

    @property
    def preroll_samples(self) -> int:
        return self._preroll_samples

    def _push_preroll(self, block: np.ndarray) -> None:
        # Bounded ring: never more than preroll_s of lead-in is retained, so the
        # buffer cannot grow while we wait out a long silence.
        cap = int(self.preroll_s * (self.sample_rate or 48_000))
        self._preroll.append(block)
        self._preroll_samples += len(block)
        while self._preroll and self._preroll_samples - len(self._preroll[0]) >= cap:
            self._preroll_samples -= len(self._preroll.popleft())

    def _is_false_start(self, total_s: float, elapsed_s: float) -> bool:
        """The gate opened but no real speech followed — and there is budget left.

        Fails open (returns False) when the sample rate is unknown, the hard
        record cap was hit, or the initial-silence budget is absent/spent.
        """
        voiced = self.voiced_s
        return (
            voiced is not None
            and voiced < self.min_speech_s
            and total_s < self.max_record_s
            and bool(self.max_initial_silence)
            and elapsed_s < self.max_initial_silence
        )

    def discard(self) -> None:
        """Drop the capture so far and go back to listening (false start)."""
        self.chunks.clear()
        self._preroll.clear()
        self._preroll_samples = 0
        self.speech_on        = False
        self.voiced_frames    = 0
        self.t_speech_on      = 0.0
        self.t_last_voice     = 0.0

    def feed(self, block: np.ndarray, rms: float, now: float,
             elapsed_s: float, *, tts_active: bool = False) -> str:
        """Consume one block. Returns the resulting state.

        'listening'        — silent, nothing buffered beyond the pre-roll ring
        'speech_start'     — gate just opened; pre-roll flushed into the capture
        'recording'        — buffering speech
        'false_start'      — capture discarded, still listening
        'output_rejected'  — block excluded: Merlin's own TTS was actively
                              producing output when this block arrived (per
                              capture_guard.TtsState — deterministic, we
                              control our own playback, not an RMS/STT guess).
                              Never enters `_preroll` or `chunks`, whether the
                              gate is open or closed, so it cannot later leak
                              into a capture via the preroll-flush-on-speech
                              path — the exact class of bug already closed in
                              service/barge_detector.py's _push_preroll for
                              the barge-confirmation path. No cooldown/delay
                              is added: the very next block, once tts_active
                              is false again, is evaluated normally.
        'done'              — utterance complete, hand the buffer to STT
        """
        n = len(block)
        if tts_active:
            self.output_rejected_samples += n
            return "output_rejected"
        self.user_accepted_samples += n
        if not self.speech_on:
            # Do not let the tail of the wake word or a short transient open
            # the command gate immediately after the recorder starts.
            if elapsed_s < COMMAND_START_GUARD_S:
                self._push_preroll(block)
                return "listening"
            if rms >= self.threshold:
                self.speech_on     = True
                self.t_speech_on   = now
                self.t_last_voice  = now
                self.voiced_frames += n
                # lead-in first, so the first phoneme survives
                self.chunks.extend(self._preroll)
                self._preroll.clear()
                self._preroll_samples = 0
                self.chunks.append(block)
                return "speech_start"
            self._push_preroll(block)
            return "listening"

        if rms >= self.threshold:
            self.t_last_voice  = now
            self.voiced_frames += n
        silence_s = now - self.t_last_voice
        total_s   = now - self.t_speech_on
        if silence_s >= self.silence_s or total_s >= self.max_record_s:
            if self._is_false_start(total_s, elapsed_s):
                self.false_starts += 1
                self.discard()
                return "false_start"
            return "done"
        self.chunks.append(block)
        return "recording"

    def audio(self) -> np.ndarray:
        if not self.chunks:
            return np.zeros(0, dtype=np.float32)
        return np.concatenate(self.chunks)


def _resolve_post_barge_capture(fresh_speech_confirmed: bool, barge_prefill, captured_audio):
    """Structural post-barge rule (pure + device-free, so it is unit-testable).

    A preserved barge prefill may authorize an STT turn ONLY once FRESH
    post-playback user speech has crossed the normal VAD / false-start gate
    (cap.speech_on). The prefill alone can never authorize a turn.

    Returns (final_audio | None, event):
      - fresh_speech_confirmed False -> (None, "DISCARDED_NO_FRESH_SPEECH"):
        the prefill is dropped, the caller returns to standby, and prefill-only
        audio never reaches STT.
      - fresh_speech_confirmed True  -> (prefill ++ fresh_capture, "ATTACHED"):
        the interruption onset preserved in the prefill is prepended to the
        fresh speech so the user's full sentence reaches STT.
    """
    if not fresh_speech_confirmed:
        return None, "DISCARDED_NO_FRESH_SPEECH"
    chunks = [c.astype(np.float32) for c in (barge_prefill or []) if c is not None and len(c)]
    if chunks:
        pre = np.concatenate(chunks)
        return np.concatenate([pre, captured_audio]), "ATTACHED"
    return captured_audio, "ATTACHED"


async def record_utterance(
    max_initial_silence: float | None = None,
    prefill: list[np.ndarray] | None = None,
    turn_ctrl: TurnController | None = None,
    control_state: RuntimeControlState | None = None,
    barge_prefill: list[np.ndarray] | None = None,
) -> bytes:
    """
    Record from the mic until VAD-detected silence.

    Opens at the device's native sample rate and selects the mic channel via
    service.mic_channel.select_mic_channel (preferred/known channel, honoring
    an operator control-panel override; NOT blind loudest-channel — see that
    module's docstring for why), then resamples to SAMPLE_RATE (16 kHz)
    before returning.  This avoids the silent-stream bug on multi-channel
    devices (e.g. RME Babyface) that do not support 16 kHz or single-channel
    input.
    2026-08-08: this docstring previously said "selects the loudest channel"
    while the code hardcoded channel 1 with no way to override it — neither
    was true of the other. Fixed to match reality: fixed source-of-truth
    channel selection, operator-overridable.

    prefill: mono float32 chunks at native sample rate captured during the
             wake→record transition gap (returned by WakeTrigger.wait()), OR
             the barge-in detector's captured onset audio from an interrupted
             previous turn. Prepended before the InputStream opens so speech
             already known to have happened is not lost.

    turn_ctrl: optional — when given, the PHASE 8 state machine is updated to
               USER_SPEAKING the instant the VAD gate opens (state transitions
               beyond that point are owned by the caller).

    Returns WAV bytes (16 kHz mono int16), or b"" on timeout / no speech.
    """
    from math import gcd as _gcd
    from scipy.signal import resample_poly as _resample_poly

    import service.vad_config as _vad_cfg
    logger.info(
        "record_utterance: SILENCE_RMS=%.5f id=%d"
        "  vad_config.COMMAND_RMS_THRESHOLD=%.5f"
        "  merlin_service.__file__=%s  vad_config.__file__=%s",
        SILENCE_RMS, id(SILENCE_RMS),
        _vad_cfg.COMMAND_RMS_THRESHOLD,
        __file__, _vad_cfg.__file__,
    )

    # Post-barge continuation: the barge prefill is buffered here and, per the
    # structural rule, is NEVER fed to `cap` (so it cannot by itself open the
    # speech gate). It is only prepended to the returned audio AFTER fresh live
    # speech crosses cap's VAD/false-start gate — see the completion block below.
    _barge_prefill = barge_prefill
    _barge_frames = sum(len(c) for c in _barge_prefill) if _barge_prefill else 0
    if _barge_prefill is not None:
        logger.info("POST_BARGE_CONTINUATION_START trace_id=%s prefill_frames=%d",
                    get_trace_id(), _barge_frames)

    stop = threading.Event()

    t_start     = time.monotonic()
    _cb_count   = [0]
    _cb_last_hb = [0.0]   # last heartbeat timestamp
    _output_reject_streak = [False]   # transition-only OUTPUT_CONTAMINATION_REJECTED logging
    # Voiced audio is accumulated in FRAMES, not from timestamps: prefill chunks are
    # all stamped with the same instant, so a timestamp delta reads 0 s for a
    # prefill-only utterance and would discard perfectly good command audio.
    cap = _CommandCapture(
        threshold           = SILENCE_RMS,
        min_speech_s        = COMMAND_MIN_SPEECH_S,
        silence_s           = SILENCE_S,
        max_record_s        = MAX_RECORD_S,
        max_initial_silence = max_initial_silence,
    )

    def _callback(indata: np.ndarray, frames: int, time_info, status) -> None:
        now = time.monotonic()
        _cb_count[0] += 1

        # Channel selection via service.mic_channel (single source of truth
        # shared with play_with_barge_in / wake_trigger — see that module's
        # docstring). 2026-08-08: this used to hardcode `active_ch = 1` with
        # no way for the control panel's forced-channel override to reach it
        # at all; now it does.
        arr = indata.astype(np.float32)
        if arr.ndim == 1:
            pcm = arr
            rms = float(np.sqrt(np.mean(pcm ** 2)))
        else:
            ch_rms = np.sqrt(np.mean(arr ** 2, axis=0))
            forced = control_state.forced_mic_channel if control_state is not None else None
            active_ch = select_mic_channel(ch_rms, forced=forced)
            pcm = arr[:, active_ch]
            rms = float(ch_rms[active_ch])
            peak = float(np.max(np.abs(pcm))) if pcm.size else 0.0
            logger.info(
                "REC_DEBUG active_ch=%d rms=%.6f peak=%.6f",
                active_ch,
                rms,
                peak,
            )

        # Output provenance (2026-08-09): is MERLIN'S OWN TTS actively
        # producing audio right now? Deterministic — AudioPlayer calls
        # mark_started()/mark_ended() around every playback, so this is a
        # fact we already know, never an RMS guess or a probabilistic
        # STT-confidence heuristic. Checked for EVERY block, in both a fresh
        # listen and a barge-in continuation — this is the gap that let a
        # different/overlapping turn's TTS reach STT as a phantom utterance
        # (2026-08-09 live incident: trace_id=T0007-barge transcribed
        # Merlin's own Day-Opening sentence 'לא מומצא תוכן כדי...').
        _tts_active = capture_guard.default_guard().tts.is_active()

        # heartbeat: log on first call and every 2 s while waiting for speech
        if _cb_count[0] == 1 or (now - _cb_last_hb[0]) >= 2.0:
            _cb_last_hb[0] = now
            logger.info("POST_PLAYBACK_CAPTURE_GUARD tts_active=%s rms=%.5f speech_on=%s",
                        _tts_active, rms, cap.speech_on)
            indata_max = float(np.max(np.abs(indata)))
            if control_state is not None and arr.ndim > 1:
                peaks = {int(c): float(np.max(np.abs(arr[:, c]))) for c in range(arr.shape[1])}
                control_state.set_channel_rms(
                    {int(c): float(ch_rms[c]) for c in range(ch_rms.shape[0])},
                    peaks, active_ch, rms, peaks.get(active_ch, 0.0),
                )
            if arr.ndim > 1:
                ch_rms_str = "  ".join(f"{i}:{v:.5f}" for i, v in enumerate(ch_rms))
                logger.info(
                    "[rec] cb #%d  shape=%s  indata_max=%.5f"
                    "  active_ch=%d  rms=%.5f  threshold=%.5f"
                    "  speech=%s  elapsed=%.1fs\n        ch_rms=[%s]",
                    _cb_count[0], indata.shape, indata_max,
                    active_ch, rms, SILENCE_RMS,
                    cap.speech_on, now - t_start, ch_rms_str,
                )
            else:
                logger.info(
                    "[rec] cb #%d  shape=%s  indata_max=%.5f"
                    "  rms=%.5f  threshold=%.5f  speech=%s  elapsed=%.1fs",
                    _cb_count[0], indata.shape, indata_max,
                    rms, SILENCE_RMS, cap.speech_on, now - t_start,
                )

        elapsed_s = now - t_start
        # Silence before the gate opens never reaches `chunks` — it rolls through
        # the bounded pre-roll ring inside `cap`.  This is what stops a false start
        # followed by six seconds of quiet from padding the next capture.
        state = cap.feed(pcm.copy(), rms, now, elapsed_s, tts_active=_tts_active)

        if state == "output_rejected":
            # Transition-logged only (not every block — this fires on every
            # callback while Merlin is speaking, same throttling reasoning as
            # the BARGE_* logs) so the rejection is provable without flooding.
            if not _output_reject_streak[0]:
                logger.info(
                    "OUTPUT_CONTAMINATION_REJECTED rms=%.5f speech_on=%s reason=tts_active",
                    rms, cap.speech_on,
                )
            _output_reject_streak[0] = True
            return
        _output_reject_streak[0] = False

        if state == "listening":
            if max_initial_silence and elapsed_s >= max_initial_silence:
                logger.info(
                    "record_utterance: initial silence timeout (%.1fs) — no speech",
                    max_initial_silence,
                )
                stop.set()
            return

        if state == "speech_start":
            if turn_ctrl is not None:
                turn_ctrl.set_state(TurnState.USER_SPEAKING, strict=False)
            if control_state is not None:
                control_state.set_vad(speech=True)
                control_state.set_state("LISTENING")
            logger.info("USER_SPEECH_DETECTED rms=%.4f", rms)
            logger.info("USER_CAPTURE_STARTED")
            logger.info(
                "record_utterance: VAD on  rms=%.4f  (pre-roll %.2fs)",
                rms, cap.preroll_s,
            )
            return

        if state == "false_start":
            # The gate opened on a transient (speaker bleed, a door, the chime
            # tail) and no real speech followed.  Discarded; we keep listening on
            # the ORIGINAL initial-silence budget rather than shipping ~0.9 s of
            # noise to Whisper as a hallucinated transcript.
            if turn_ctrl is not None:
                turn_ctrl.set_state(TurnState.LISTENING, strict=False)
            if control_state is not None:
                control_state.set_vad(speech=False)
            logger.info(
                "record_utterance: FALSE_START #%d — voiced<%.2fs — discarding, "
                "still listening (%.1fs of %.1fs budget left)",
                cap.false_starts, COMMAND_MIN_SPEECH_S,
                (max_initial_silence or 0) - elapsed_s, max_initial_silence or 0,
            )
            return

        if state == "done":
            voiced_s = cap.voiced_s
            logger.info(
                "record_utterance: VAD off  voiced=%s  buffered=%d samples",
                "unknown" if voiced_s is None else f"{voiced_s:.2f}s",
                sum(len(c) for c in cap.chunks),
            )
            logger.info(
                "USER_AUDIO_ACCEPTED accepted_samples=%d output_rejected_samples=%d",
                cap.user_accepted_samples, cap.output_rejected_samples,
            )
            logger.info("USER_CAPTURE_ENDED")
            if control_state is not None:
                control_state.set_vad(speech=False)
            stop.set()
            return

    loop = asyncio.get_running_loop()
    done = loop.create_future()

    def _watcher() -> None:
        stop.wait()
        loop.call_soon_threadsafe(done.set_result, None)

    threading.Thread(target=_watcher, daemon=True).start()

    # STOP LISTENING (control panel): a second watcher races the same `stop`
    # completion against an externally-settable event, so an operator click
    # ends capture exactly like a VAD-detected end-of-utterance would —
    # whatever was buffered so far becomes the returned audio.
    if control_state is not None:
        def _control_watcher() -> None:
            control_state.force_stop_capture.wait()
            control_state.force_stop_capture.clear()
            logger.info("STOP_LISTENING requested via control panel")
            stop.set()

        threading.Thread(target=_control_watcher, daemon=True).start()
        control_state.set_capture_active(True)

    # ── Prefill: replay audio captured during the wake→record gap ─────────────
    # These chunks were buffered by KeywordBuffer while Whisper was processing
    # the keyword.  They are at native sample rate (same as what the InputStream
    # below will open at) and contain the most likely start of the user's command.
    if prefill:
        _t0 = time.monotonic()
        logger.info(
            "record_utterance: processing %d prefill chunks from wake stage",
            len(prefill),
        )
        for _chunk in prefill:
            _rms = float(np.sqrt(np.mean(_chunk ** 2)))
            # Same buffering rule as the live callback: silent prefill only feeds
            # the pre-roll ring.  Every chunk shares _t0, so no end-of-utterance
            # can fire here — prefill can start a capture, never finish one.
            if cap.feed(_chunk.copy(), _rms, _t0, _t0 - t_start) == "speech_start":
                logger.info("record_utterance: VAD on (prefill)  rms=%.4f", _rms)
        if cap.speech_on:
            logger.info(
                "record_utterance: prefill contained speech (%d chunks buffered)",
                len(cap.chunks),
            )
        else:
            logger.info(
                "record_utterance: prefill silent (threshold=%.5f) — "
                "listening for speech from InputStream",
                SILENCE_RMS,
            )
    # ──────────────────────────────────────────────────────────────────────────

    logger.info("[rec] sd.query_devices():\n%s", sd.query_devices())
    logger.info("[rec] sd.default.device     = %s", sd.default.device)
    logger.info("[rec] sd.default.samplerate = %s", sd.default.samplerate)
    logger.info("[rec] sd.default.channels   = %s", sd.default.channels)

    with sd.InputStream(
        samplerate=None,
        channels=None,
        dtype=np.float32,
        callback=_callback,
    ) as stream:
        native_sr        = int(stream.samplerate)
        cap.sample_rate  = native_sr   # arms the false-start guard (mirrors wake_trigger)
        if control_state is not None:
            control_state.set_sample_rate(native_sr)
        logger.info(
            "[rec] stream open — device=%r sr=%d ch=%d blocksize=%d dtype=float32",
            stream.device, native_sr, stream.channels, stream.blocksize,
        )

        # Watchdog: warn if PortAudio hasn't called the callback within 1 s.
        def _warn_no_cb() -> None:
            if _cb_count[0] == 0:
                logger.warning(
                    "record_utterance: WARNING — no callback after 1s "
                    "(blocksize=%d sr=%d ch=%d). "
                    "PortAudio may not be delivering audio on this device.",
                    stream.blocksize, native_sr, stream.channels,
                )

        # Safety net: if the callback never fires the future never resolves.
        # Force a stop after max_initial_silence + 5 s so the coroutine always returns.
        fallback_s = (max_initial_silence or MAX_RECORD_S) + 5.0

        def _fallback_stop() -> None:
            if not stop.is_set():
                logger.warning(
                    "record_utterance: fallback timeout (%.0fs) — "
                    "callback fired=%s. Forcing stop.",
                    fallback_s, _cb_count[0] > 0,
                )
                stop.set()

        warn_h     = loop.call_later(1.0,       _warn_no_cb)
        fallback_h = loop.call_later(fallback_s, _fallback_stop)

        await done

        warn_h.cancel()
        fallback_h.cancel()

    if control_state is not None:
        control_state.set_capture_active(False)

    # ── Post-barge continuation gate (structural rule) ───────────────────────
    # `cap.speech_on` is True ONLY if FRESH live speech crossed the normal VAD /
    # false-start gate — the barge prefill was never fed to `cap`, so it cannot
    # set this. If no fresh speech was confirmed, the preserved prefill is
    # discarded and we return to standby: prefill-only audio never reaches STT.
    if _barge_prefill is not None:
        if not cap.speech_on:
            logger.info(
                "POST_BARGE_PREFILL_DISCARDED_NO_FRESH_SPEECH trace_id=%s prefill_frames=%d "
                "(false_starts=%d)",
                get_trace_id(), _barge_frames, cap.false_starts,
            )
            logger.info("POST_BARGE_STT_BLOCKED trace_id=%s", get_trace_id())
            return b""
        logger.info("POST_BARGE_FRESH_SPEECH_CONFIRMED trace_id=%s voiced=%.2fs",
                    get_trace_id(), cap.voiced_s or 0.0)
        _fresh = cap.audio() if cap.chunks else np.zeros(0, dtype=np.float32)
        audio, _ev = _resolve_post_barge_capture(True, _barge_prefill, _fresh)
        logger.info(
            "POST_BARGE_PREFILL_ATTACHED trace_id=%s prefill_frames=%d fresh_frames=%d total_frames=%d",
            get_trace_id(), _barge_frames, len(_fresh), len(audio),
        )
        logger.info("POST_BARGE_STT_SUBMITTED trace_id=%s frames=%d", get_trace_id(), len(audio))
    else:
        if not cap.speech_on:
            logger.info(
                "record_utterance: no speech in %.1fs — returning to standby "
                "(false_starts=%d)",
                max_initial_silence or 0, cap.false_starts,
            )
            return b""

        if not cap.chunks:
            return b""

        audio = cap.audio()
    logger.info(
        "record_utterance: captured %.2fs (native_sr=%d samples=%d)",
        len(audio) / native_sr, native_sr, len(audio),
    )
    if control_state is not None:
        control_state.set_capture_duration(len(audio) / native_sr)

    if native_sr != SAMPLE_RATE:
        g     = _gcd(native_sr, SAMPLE_RATE)
        audio = _resample_poly(audio, SAMPLE_RATE // g, native_sr // g).astype(np.float32)
        logger.info(
            "record_utterance: resampled %d→%d Hz samples=%d",
            native_sr, SAMPLE_RATE, len(audio),
        )

    # Peak-normalize the captured command so the STT provider gets a healthy
    # amplitude (mirrors the wake path).  Low-level input otherwise transcribes
    # as Whisper hallucinations or empty text.
    import service.vad_config as _vad_cfg
    # Telemetry: capture the TRUE pre-normalization level of the command audio.
    # This is what distinguishes "the user spoke weak" from "the capture path
    # attenuated the signal" — the source of the wake-vs-command RMS gap.
    _pre_norm_rms  = float(np.sqrt(np.mean(audio ** 2))) if audio.size else 0.0
    _pre_norm_peak = float(np.max(np.abs(audio))) if audio.size else 0.0
    audio, _norm_gain = _vad_cfg.normalize_for_whisper(audio)
    _post_norm_rms = float(np.sqrt(np.mean(audio ** 2))) if audio.size else 0.0
    logger.info(
        "record_utterance: CMD_TELEMETRY  dur=%.2fs  pre_norm_rms=%.5f  "
        "pre_norm_peak=%.5f  norm_gain=×%.2f  post_norm_rms=%.5f  "
        "voiced=%.2fs  false_starts=%d",
        len(audio) / SAMPLE_RATE, _pre_norm_rms, _pre_norm_peak,
        _norm_gain, _post_norm_rms,
        cap.voiced_s or 0.0, cap.false_starts,
    )

    audio_i16 = (np.clip(audio, -1.0, 1.0) * 32767).astype(np.int16)

    # Save the EXACT command audio sent to Whisper (gated by MERLIN_CAPTURE_WAV=1;
    # mirrors the wake-path probe).  Lets us compare the command WAV to the wake
    # WAV and see WHY the command-path RMS is lower.  No behaviour change when unset.
    if os.environ.get("MERLIN_CAPTURE_WAV") == "1":
        try:
            import json as _json, hashlib as _hashlib
            _cap_dir = os.path.expanduser("~/Library/Logs/Merlin/capture")
            os.makedirs(_cap_dir, exist_ok=True)
            _base   = "cmd_%s" % time.strftime("%Y%m%d-%H%M%S")
            _cap_fn = os.path.join(_cap_dir, _base + ".wav")
            wavfile.write(_cap_fn, SAMPLE_RATE, audio_i16)
            _sha = _hashlib.sha256(open(_cap_fn, "rb").read()).hexdigest()
            # Self-contained sidecar so a sample is comparable months later, and a
            # WAV hash so a future re-transcription is provably the same audio.
            # transcript/no_speech are filled by tools/e2_summary.py from the log
            # (the command STT provider returns plain text, not verbose_json).
            _meta = {
                "experiment_id": os.environ.get("MERLIN_EXPERIMENT_ID", "E2"),
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "wav_file": _base + ".wav",
                "wav_sha256": _sha,
                "audio": {
                    "duration_s":    round(len(audio) / SAMPLE_RATE, 3),
                    "rms_pre_norm":  round(_pre_norm_rms, 6),
                    "peak_pre_norm": round(_pre_norm_peak, 6),
                    "norm_gain":     round(_norm_gain, 3),
                    "rms_post_norm": round(_post_norm_rms, 6),
                },
                "pipeline": {
                    "vad_threshold":  SILENCE_RMS,
                    "sample_rate":    SAMPLE_RATE,
                    "stt_model":      settings.stt_model,
                    "stt_language":   "he",
                    "stt_temperature": 0,
                },
                "stt": {"transcript": None},  # joined from service.log by e2_summary
            }
            with open(os.path.join(_cap_dir, _base + ".json"), "w") as _jf:
                _json.dump(_meta, _jf, ensure_ascii=False, indent=2)
            logger.info("COMMAND_CAPTURE_SAVED %s sha=%s", _cap_fn, _sha[:12])
        except Exception as _cap_exc:
            logger.warning("command capture save failed: %s", _cap_exc)

    buf = io.BytesIO()
    wavfile.write(buf, SAMPLE_RATE, audio_i16)
    return buf.getvalue()


# ── Canonical text playback (no LLM) ──────────────────────────────────────────

async def speak_canonical_text(
    text: str,
    tts,
    player: AudioPlayer,
    turn_ctrl: TurnController,
    turn_id: int,
    control_state: RuntimeControlState | None = None,
) -> tuple[bool, str]:
    """Speak KNOWN, pre-written text (e.g. the Day Opening briefing) through
    the exact same TTS/playback/barge-in path stream_response() uses —
    WITHOUT ever calling adapter.respond()/the LLM. The whole point: this
    content must never be summarized, rewritten, translated, or regenerated.

    Deliberately NOT a refactor of stream_response() (which stays untouched
    and fully covered by its own tests) — this duplicates only the minimal
    _speak()-shaped subset of that logic (TTS synthesis + play_with_barge_in
    + turn_ctrl.is_current() guards + mute gating), driven by a known text
    string chunked through the same SentenceBuffer sentence-boundary logic
    instead of an LLM token stream.

    Returns (interrupted, spoken_text).
    """
    spoken_text = ""
    interrupted = False
    detector: BargeInWindowDetector | None = None
    if BARGE_IN_ENABLED:
        detector = BargeInWindowDetector(threshold=BARGE_IN_RMS, confirm_frames=BARGE_IN_FRAMES, confirm_seconds=BARGE_IN_CONFIRM_S)

    # ── CONTINUOUS PLAYBACK PIPELINE (2026-08-10) ────────────────────────────
    # Was serial: synthesize(N) -> play(N) -> synthesize(N+1) -> play(N+1), so
    # every sentence boundary carried the next chunk's ~2.3-3.4s TTS round-trip
    # as dead-air. Now a producer synthesizes chunk N+1 WHILE chunk N is playing
    # and hands finished audio to a queue; the consumer plays each chunk the
    # instant the previous one ends. Unchanged: canonical text, sentence order
    # (same SentenceBuffer + flush), ONE turn_id, every chunk still played via
    # play_with_barge_in with the SAME detector, and the barge path.
    #
    # Prefetch is hard-capped at 2 by `_slots`: the producer acquires a slot
    # BEFORE synthesizing and the consumer releases one the moment it takes a
    # chunk to play, so at most 2 chunks are ever synthesized/in-flight ahead of
    # the one playing — never the whole opening up front.
    _PREFETCH_MAX = 2
    _slots = asyncio.Semaphore(_PREFETCH_MAX)
    _queue: asyncio.Queue = asyncio.Queue()
    _DONE = object()

    async def _emit(chunk: str) -> bool:
        """Synthesize one chunk and enqueue it in canonical order. Returns False
        (producer should stop) when the turn is no longer current — checked
        BEFORE synthesis and again immediately AFTER, so a result produced after
        the turn went stale is discarded, never enqueued."""
        if not turn_ctrl.is_current(turn_id):
            logger.info("STALE_TURN_DROPPED turn_id=%d where=canonical_producer", turn_id)
            return False
        await _slots.acquire()                      # hard prefetch cap = 2
        if not turn_ctrl.is_current(turn_id):
            _slots.release()
            logger.info("STALE_TURN_DROPPED turn_id=%d where=canonical_producer", turn_id)
            return False
        if control_state is not None and control_state.muted:
            await _queue.put((chunk, None))         # muted: keep order, no synth/playback
            return True
        if control_state is not None:
            control_state.record_event("tts", "TTS_START", turn_id=turn_id, payload_summary=chunk[:120])
        audio_bytes = await tts.synthesize(chunk)
        if not turn_ctrl.is_current(turn_id):       # re-check AFTER synthesis, BEFORE put
            _slots.release()
            logger.info("STALE_SYNTHESIS_DROPPED turn_id=%d — synthesized chunk discarded, not enqueued", turn_id)
            return False
        await _queue.put((chunk, np.frombuffer(audio_bytes, dtype=np.int16)))
        return True

    async def _producer() -> None:
        try:
            buf = SentenceBuffer(first_min_chars=30)
            chunk = buf.push(text)
            while chunk:
                if not await _emit(chunk):
                    return
                chunk = buf.push("")                # re-splits whatever remains
            tail = buf.flush()
            if tail:
                await _emit(tail)
        finally:
            # Always signal the consumer to stop. Runs on cancellation too
            # (put_nowait on the unbounded queue never blocks).
            _queue.put_nowait(_DONE)

    producer_task = asyncio.create_task(_producer())
    try:
        while True:
            item = await _queue.get()
            if item is _DONE:
                break
            chunk_text, pcm_i16 = item
            _slots.release()                        # this chunk is no longer "prefetched ahead"
            if not turn_ctrl.is_current(turn_id):
                logger.info("STALE_TURN_DROPPED turn_id=%d where=canonical_consumer", turn_id)
                interrupted = True
                break
            if pcm_i16 is None:                      # muted chunk — counts toward spoken_text, no playback
                spoken_text = (spoken_text + " " + chunk_text).strip()
                continue
            turn_ctrl.set_state(TurnState.ASSISTANT_SPEAKING, strict=False)
            if control_state is not None:
                control_state.set_playback_active(True)
                control_state.set_state("SPEAKING")
                control_state.record_event("player", "PLAYBACK_START", turn_id=turn_id)
            try:
                barged = await player.play_with_barge_in(
                    pcm_i16, detector=detector, grace_s=BARGE_IN_GRACE, turn_id=turn_id,
                    control_state=control_state, turn_ctrl=turn_ctrl,
                )
            finally:
                if control_state is not None:
                    control_state.set_playback_active(False)
            if barged:
                if control_state is not None:
                    control_state.record_event("player", "BARGE-IN", turn_id=turn_id, result="playback_stopped")
                interrupted = True
                break
            spoken_text = (spoken_text + " " + chunk_text).strip()
    finally:
        # DETERMINISTIC cancellation (asyncio.CancelledError is a BaseException,
        # never caught by `except Exception`): cancel the producer — including any
        # in-flight tts.synthesize — and await it via gather(return_exceptions=
        # True) so the CancelledError is swallowed and no orphan task/warning
        # remains, THEN drain and DISCARD every prefetched-but-unplayed chunk so
        # none can reach PLAYBACK_START after an interruption.
        producer_task.cancel()
        await asyncio.gather(producer_task, return_exceptions=True)
        while not _queue.empty():
            try:
                _queue.get_nowait()
            except asyncio.QueueEmpty:
                break

    if interrupted:
        turn_ctrl.set_state(TurnState.INTERRUPTING, strict=False)
        turn_ctrl.cancel(turn_id)
        logger.info("CANONICAL_TEXT_INTERRUPTED turn_id=%d spoken=%d of %d chars", turn_id, len(spoken_text), len(text))
    else:
        logger.info("CANONICAL_TEXT_COMPLETED turn_id=%d chars=%d", turn_id, len(text))

    return interrupted, spoken_text


# ── Streaming response with barge-in ─────────────────────────────────────────

async def stream_response(
    adapter,
    tts,
    player: AudioPlayer,
    transcript: str,
    session_id: str,
    turn_ctrl: TurnController,
    turn_id: int,
    control_state: RuntimeControlState | None = None,
) -> tuple[bool, str, list]:
    """
    Stream LLM -> TTS, playing each sentence through
    AudioPlayer.play_with_barge_in — a single full-duplex stream keeps the mic
    live for real barge-in detection throughout ASSISTANT_SPEAKING (see the
    BARGE_IN_ENABLED history comment above for why this replaced the old
    separate-input-stream design).

    PHASE 2 turn ownership: every side effect (TTS synthesis, playback,
    conversation-history write) is guarded by `turn_ctrl.is_current(turn_id)`
    immediately before it happens. If turn_id has been superseded or
    cancelled, the effect is skipped — a stale turn cannot produce output.

    Returns (interrupted, full_response_text, prefill_chunks). prefill_chunks
    is the mic audio the barge-in detector captured while confirming the
    interruption — the onset of the user's new utterance — meant to be passed
    as `prefill` to the next record_utterance() call so it is not lost
    (mirrors the wake-word prefill mechanism already used between WakeTrigger
    and record_utterance).
    """
    full_response = ""
    spoken_text = ""
    interrupted = False
    prefill_chunks: list = []

    buf = SentenceBuffer(first_min_chars=30)

    detector: BargeInWindowDetector | None = None
    if BARGE_IN_ENABLED:
        detector = BargeInWindowDetector(threshold=BARGE_IN_RMS, confirm_frames=BARGE_IN_FRAMES, confirm_seconds=BARGE_IN_CONFIRM_S)

    def _stale(where: str) -> None:
        logger.info(
            "STALE_TURN_DROPPED turn_id=%d active_turn_id=%d where=%s",
            turn_id, turn_ctrl.current_turn_id, where,
        )

    async def _speak(text: str) -> bool:
        """Synthesize + play one chunk. Returns True iff barge-in fired during it."""
        nonlocal spoken_text
        if not turn_ctrl.is_current(turn_id):
            _stale("before_tts")
            return True
        # MUTE MERLIN (control panel): the text was still generated (it stays
        # in history/spoken_text bookkeeping as if spoken — muting silences
        # the speaker, it does not pretend the turn never happened) but never
        # reaches TTS/the speaker while muted.
        if control_state is not None and control_state.muted:
            logger.info("MUTED — skipping TTS/playback turn_id=%d", turn_id)
            spoken_text = (spoken_text + " " + text).strip()
            return False
        logger.info("TTS_START turn_id=%d", turn_id)
        if control_state is not None:
            control_state.record_event("tts", "TTS_START", turn_id=turn_id, payload_summary=text[:120])
        audio_bytes = await tts.synthesize(text)
        if not turn_ctrl.is_current(turn_id):
            _stale("after_tts_before_playback")
            return True
        pcm_i16 = np.frombuffer(audio_bytes, dtype=np.int16)
        logger.info("PLAYBACK_START turn_id=%d", turn_id)
        if control_state is not None:
            control_state.set_playback_active(True)
            control_state.set_state("SPEAKING")
            control_state.record_event("player", "PLAYBACK_START", turn_id=turn_id)
        try:
            barged = await player.play_with_barge_in(
                pcm_i16, detector=detector, grace_s=BARGE_IN_GRACE, turn_id=turn_id,
                control_state=control_state, turn_ctrl=turn_ctrl,
            )
        finally:
            if control_state is not None:
                control_state.set_playback_active(False)
        if barged:
            logger.info("PLAYBACK_STOPPED old_turn_id=%d", turn_id)
            if control_state is not None:
                control_state.record_event("player", "BARGE-IN", turn_id=turn_id, result="playback_stopped")
        else:
            spoken_text = (spoken_text + " " + text).strip()
        return barged

    turn_ctrl.set_state(TurnState.THINKING, strict=False)
    logger.info("LLM_START turn_id=%d", turn_id)
    _t_llm_start = time.monotonic()
    if control_state is not None:
        control_state.record_event("adapter", "LLM_START", turn_id=turn_id)
    async for chunk in adapter.respond(transcript, session_id=session_id):
        if not turn_ctrl.is_current(turn_id):
            _stale("llm_stream")
            interrupted = True
            break
        full_response += chunk
        sentence = buf.push(chunk)
        if sentence:
            turn_ctrl.set_state(TurnState.ASSISTANT_SPEAKING, strict=False)
            if await _speak(sentence):
                interrupted = True
                break

    if not interrupted and turn_ctrl.is_current(turn_id):
        remainder = buf.flush()
        if remainder:
            turn_ctrl.set_state(TurnState.ASSISTANT_SPEAKING, strict=False)
            if await _speak(remainder):
                interrupted = True

    _llm_ms = round((time.monotonic() - _t_llm_start) * 1000, 1)
    if control_state is not None:
        control_state.record_event("adapter", "LLM_END", turn_id=turn_id, duration_ms=_llm_ms,
                                     payload_summary=full_response[:120])

    if interrupted:
        turn_ctrl.set_state(TurnState.INTERRUPTING, strict=False)
        logger.info("ASSISTANT_TURN_INTERRUPTED old_turn_id=%d", turn_id)
        logger.info("OLD_TURN_CANCELLED turn_id=%d", turn_id)
        turn_ctrl.cancel(turn_id)
        # PHASE 2 / requirement D: history must reflect only what was actually
        # spoken, not text that was generated but never reached the speaker.
        adapter.truncate_last_assistant_turn(session_id, spoken_text)
        logger.info("TTS_QUEUE_INVALIDATED old_turn_id=%d", turn_id)
        logger.info("TTS_QUEUE_PURGED trace_id=%s old_turn_id=%d", get_trace_id(), turn_id)
        if detector is not None:
            prefill_chunks = detector.chunks
        _prefill_samples = sum(len(c) for c in prefill_chunks)
        # Native sample rate isn't known here (detector doesn't record it) —
        # duration is reported at the duplex stream's negotiated rate, logged
        # once at DUPLEX_STREAM_OPEN; consumers can cross-reference.
        logger.info("INTERRUPT_PREFILL samples=%d turn_id=%d", _prefill_samples, turn_id)
        logger.info(
            "stream_response: turn %d interrupted — spoken=%d chars of %d generated, "
            "prefill=%d chunks captured",
            turn_id, len(spoken_text), len(full_response), len(prefill_chunks),
        )
        if control_state is not None:
            control_state.record_event("turn_state", "CANCEL", turn_id=turn_id,
                                         payload_summary=f"prefill_samples={_prefill_samples}")
            control_state.record_event("barge_detector", "INTERRUPT_PREFILL", turn_id=turn_id,
                                         payload_summary=f"samples={_prefill_samples}")
            control_state.update_turn_response(turn_id, full_response, "interrupted", tts_text=spoken_text)
    else:
        logger.info("ASSISTANT_TURN_COMPLETED turn_id=%d", turn_id)
        if control_state is not None:
            control_state.update_turn_response(turn_id, full_response, "completed", tts_text=spoken_text)

    logger.info(
        "Merlin: %s",
        full_response[:120] + ("…" if len(full_response) > 120 else ""),
    )
    logger.info(
        "LLM_OUTPUT trace_id=%s turn_id=%d interrupted=%s spoken_chars=%d text=%r",
        get_trace_id(), turn_id, interrupted, len(spoken_text), full_response[:400],
    )
    return interrupted, full_response, prefill_chunks


# ── Conversation session ──────────────────────────────────────────────────────

_MEMORY_REVIEW_PHRASES = {
    "what do you remember",
    "show me your memory",
    "what do you know about me",
    "מה אתה זוכר",       # Hebrew
    "מה אתה יודע עליי",  # Hebrew
}


async def _process_turn(
    transcript: str,
    adapter,
    tts,
    player: AudioPlayer,
    store: MemoryStore,
    session_id: str,
    turn_ctrl: TurnController,
    control_state: RuntimeControlState | None = None,
) -> tuple[bool, list]:
    """Validate a transcript, mint a turn, and run it through the LLM/TTS
    pipeline. Shared by run_conversation_session's normal record_utterance
    loop AND the control panel's SEND AS USER (service/control_panel.py),
    which calls this directly with operator-typed text instead of an STT
    transcript — guaranteeing both paths produce byte-identical
    TURN_INPUT/LLM_INPUT handling; there is exactly one place this logic
    lives.

    Returns (interrupted, prefill_chunks) — (False, []) if the transcript was
    rejected (filler/empty) or was a memory-review command, since there is
    nothing to continue capturing from in either case.
    """
    logger.info("STT_RESULT transcript=%r", transcript)
    if control_state is not None:
        control_state.record_event("STT", "STT_RESULT", payload_summary=transcript[:120])

    # MUTE INPUT (control panel): discard whatever was captured/transcribed —
    # never mints a turn, never reaches the LLM. Distinct from STOP LISTENING
    # (which stops capture at the audio layer); this gates the transcript
    # AFTER capture, so a manual unmute mid-utterance doesn't need to race
    # the recorder.
    if control_state is not None and control_state.input_muted:
        logger.info("INPUT_MUTED — discarding transcript, not sent to LLM: %r", transcript)
        control_state.record_event("control_panel", "INPUT_MUTED_DISCARD", payload_summary=transcript[:120])
        control_state.report_rejection("input_muted", transcript)
        return False, []

    # PHASE 7 / STT SAFETY GATE — garbage/filler input gate. Rejects empty
    # transcripts and transcripts that are ENTIRELY non-lexical filler (e.g.
    # "Ahem") before any turn_id is minted and before the LLM/TTS are ever
    # called. This, plus record_utterance's voiced-duration false-start guard
    # (COMMAND_MIN_SPEECH_S), is the acceptance gate this STT model actually
    # supports — gpt-4o-transcribe does not expose no_speech_prob/avg_logprob/
    # compression_ratio (verbose_json unsupported, see
    # app/providers/stt/whisper.py's module docstring); a probability-based
    # gate is not implementable without switching STT models.
    if not is_valid_utterance(transcript):
        logger.info("transcript rejected as invalid/filler — not sent to LLM: %r", transcript)
        if control_state is not None:
            control_state.record_event("turn_guard", "TRANSCRIPT_REJECTED", payload_summary=transcript[:120])
            control_state.report_rejection("empty_or_filler", transcript)
        return False, []

    # PHANTOM GUARD (2026-08-10) — the wake word's own echo/tail captured as a
    # command must NEVER become a GENERAL turn. Reject a bare wake word before a
    # turn_id is minted: no LLM, no TTS, no memory, no routing, no history — the
    # runtime just returns to standby. A real command containing the wake word
    # ("מרלין מה השעה") has >1 content word and is unaffected.
    if is_bare_wake_word(transcript):
        logger.info("WAKE_ECHO_REJECTED transcript=%r — bare wake word is not a command; return to standby", transcript)
        if control_state is not None:
            control_state.record_event("turn_guard", "WAKE_ECHO_REJECTED", payload_summary=transcript[:80])
            control_state.report_rejection("wake_word_echo", transcript)
        return False, []

    # ── Day Opening VOICE INTENT (command, not knowledge) ────────────────────
    # An exact start command triggers the SAME run_day_opening the double-clap /
    # Control Panel button calls — no duplicated ceremony logic. A question about
    # the day opening is not an exact match and falls through to normal routing
    # (the domain_router DAY_OPENING knowledge route is unchanged).
    from app.voice_intents import is_day_opening_start_command
    if is_day_opening_start_command(transcript):
        logger.info("DAY_OPENING_VOICE_INTENT transcript=%r -> run_day_opening", transcript)
        try:
            from service.day_opening_runner import run_day_opening
            await run_day_opening(adapter, tts, player, turn_ctrl, control_state, session_id)
        except Exception as exc:
            logger.warning("DAY_OPENING_VOICE_INTENT failed (%s)", exc)
        return False, []

    turn_id = turn_ctrl.new_turn()
    # Bridge the pre-turn trace (mic capture / STT, which have no turn_id yet)
    # to the turn_id that every downstream playback/barge log carries.
    logger.info("TRACE_TURN_LINK trace_id=%s turn_id=%d", get_trace_id(), turn_id)
    if control_state is not None:
        control_state.record_event("turn_state", "TURN_CREATED", turn_id=turn_id)

    # PHASE 6 — transcript integrity. There is no transformation point
    # between the STT transcript and the text handed to the LLM: `transcript`
    # is passed to stream_response()/adapter.respond() unmodified (see
    # app/adapters/claude.py::respond, `history.append({"content": text})`
    # where text IS this exact argument). The assert below is the checkpoint
    # that makes that invariant an enforced fact, not just a claim — if a
    # future edit inserts a transformation between these two lines without
    # updating both variables together, this fails loudly instead of
    # silently drifting.
    raw_transcript = transcript
    llm_input = transcript
    assert llm_input == raw_transcript, (
        f"transcript integrity violated turn_id={turn_id}: "
        f"raw_transcript={raw_transcript!r} != llm_input={llm_input!r}"
    )
    logger.info("TURN_INPUT turn_id=%d transcript=%r", turn_id, raw_transcript)
    logger.info("LLM_INPUT turn_id=%d user_message=%r", turn_id, llm_input)
    if control_state is not None:
        control_state.begin_turn(turn_id, transcript, raw_transcript, llm_input)

    logger.info("You: %s", transcript)
    _mos_shadow(transcript)   # Voice → Event (shadow, opt-in; never affects the live path)

    # Memory review voice command
    if any(phrase in transcript.lower() for phrase in _MEMORY_REVIEW_PHRASES):
        review_text = _format_memory_review(store)
        await player.play(await tts.synthesize(review_text))
        if control_state is not None:
            control_state.update_turn_response(turn_id, review_text, "completed")
        return False, []

    logger.info("LLM+TTS: starting stream_response turn_id=%d", turn_id)
    interrupted, response_text, prefill_chunks = await stream_response(
        adapter, tts, player, llm_input, session_id, turn_ctrl, turn_id, control_state=control_state,
    )
    logger.info("LLM+TTS: done — interrupted=%s response_len=%d", interrupted, len(response_text))
    if control_state is not None:
        # content (response text + what was actually spoken) is recorded by
        # stream_response itself, which is the only place that knows
        # spoken_text; this call only settles the coarse runtime state.
        control_state.set_state("INTERRUPTED" if interrupted else "IDLE")

    # Background memory extraction — runs after response, invisible to user
    if response_text and settings.anthropic_api_key:
        asyncio.create_task(
            _extract_background(transcript, response_text, store, settings.anthropic_api_key)
        )

    if interrupted:
        logger.info(
            "Barge-in confirmed — continuing capture with %d prefill chunk(s), no wake required",
            len(prefill_chunks),
        )

    return interrupted, prefill_chunks


async def run_conversation_session(
    adapter,
    stt,
    tts,
    player: AudioPlayer,
    store: MemoryStore,
    session_id: str,
    turn_ctrl: TurnController,
    prefill: list[np.ndarray] | None = None,
    control_state: RuntimeControlState | None = None,
) -> None:
    """
    Multi-turn conversation loop.

    Stays awake after each response. Returns to standby after
    CONVERSATION_TIMEOUT seconds of silence with no new speech.
    After each turn, memory extraction runs as a background task.

    prefill: post-keyword audio from WakeTrigger (first turn) OR the barge-in
             detector's captured onset audio from an interrupted previous turn
             (PHASE 3/PHASE 5) — either way, audio already known to contain
             the start of the user's next utterance, so it must not be
             silently dropped by opening a fresh, empty recorder.

    control_state: optional link to the Merlin Control Panel
    (service/control_panel.py). When given, an operator-typed SEND AS USER
    message is checked for at the top of every loop iteration BEFORE
    record_utterance() is called — so at most one of {real mic capture,
    injected text} is ever being processed at a time, preserving the
    single-mic-owner invariant the whole turn-taking fix depends on.
    """
    logger.info("PIPELINE_STARTED_SUCCESSFULLY")
    next_prefill = prefill
    # Distinguishes a BARGE prefill (must require fresh post-playback speech
    # before it can reach STT) from the WAKE prefill (post-keyword onset, which
    # legitimately opens the gate on its own). The initial prefill is the wake
    # prefill, so this starts False.
    _from_barge = False
    consecutive_rejections = 0
    _consumed_input_ids: set[str] = set()   # BUFFER de-dup: one utterance → one command
    while True:
        turn_ctrl.set_state(TurnState.LISTENING, strict=False)
        if control_state is not None:
            control_state.set_state("LISTENING")
            injected = control_state.try_pop_injection()
            if injected is not None:
                logger.info("SEND_AS_USER injected=%r", injected)
                interrupted, prefill_chunks = await _process_turn(
                    injected, adapter, tts, player, store, session_id, turn_ctrl, control_state,
                )
                next_prefill = prefill_chunks if interrupted else None
                _from_barge = bool(next_prefill)
                continue   # skip record_utterance this cycle — injected text took its place

        logger.info("Listening… (%.0fs timeout)", CONVERSATION_TIMEOUT)
        _prefill_sample_count = sum(len(c) for c in next_prefill) if next_prefill else 0
        # One correlated TRACE_ID per microphone-derived turn. A barge-in
        # continuation is a NEW capture (source=barge_prefill) that must be
        # provably distinct from Merlin's own playback — the whole point of the
        # trace is to show NEXT_STT_FINAL came from the user's mic, not echo.
        _is_barge_cont = _from_barge and next_prefill is not None
        _tid = new_trace_id("barge" if _is_barge_cont else "mic")
        logger.info("MIC_CAPTURE_START trace_id=%s source=%s prefill_frames=%d",
                    _tid, "barge_prefill" if _is_barge_cont else "mic", _prefill_sample_count)
        if _is_barge_cont:
            logger.info("NEXT_CAPTURE_SOURCE trace_id=%s source=barge_prefill", _tid)
            logger.info("PREFILL_FRAMES_RECEIVED trace_id=%s frames=%d", _tid, _prefill_sample_count)
        logger.info("NEW_CAPTURE_STARTED prefill_samples=%d", _prefill_sample_count)
        if control_state is not None:
            control_state.record_event("record_utterance", "LISTEN", payload_summary=f"prefill_samples={_prefill_sample_count}")
            control_state.record_event("record_utterance", "NEW_CAPTURE_STARTED", payload_summary=f"prefill_samples={_prefill_sample_count}")
        if next_prefill is None:
            # Fresh listen only: wait out Merlin's TTS-active + short cooldown
            # window before opening a fresh InputStream, so the tail of Merlin's
            # own voice cannot become the start of the next captured command.
            # A BARGE continuation deliberately does NOT wait here: playback is
            # already TERMINATED (Merlin silent), and the structural post-barge
            # rule requires FRESH speech to cross the VAD/false-start gate before
            # the buffered prefill is honored — so waiting would only drop the
            # user's continued words (mid-sentence gap), not add safety.
            # State-only check — deliberately does NOT call
            # capture_guard.pre_capture_check(), which would open its own
            # sd.rec() probe stream concurrently with record_utterance's
            # InputStream (the exact dual-stream conflict class documented in
            # BARGE_IN_ENABLED's history above). Bounded so a stuck TTS-state
            # flag can never wedge the conversation loop.
            _guard_tts = capture_guard.default_guard().tts
            _cooldown_ms = capture_guard.GuardConfig.from_env().tts_cooldown_ms
            _wait_t0 = time.monotonic()
            _waited = False
            logger.info("TTS_COOLDOWN_START trace_id=%s cooldown_ms=%d", _tid, _cooldown_ms)
            while _guard_tts.is_active() or _guard_tts.cooldown_active(_cooldown_ms):
                if (time.monotonic() - _wait_t0) > 2.0:
                    logger.warning("CAPTURE_GUARD_WAIT_TIMEOUT — proceeding without full cooldown")
                    break
                _waited = True
                await asyncio.sleep(0.05)
            logger.info("TTS_COOLDOWN_END trace_id=%s waited=%.2fs", _tid, time.monotonic() - _wait_t0)
            if _waited and control_state is not None:
                control_state.record_event(
                    "capture_guard", "TTS_COOLDOWN_WAIT",
                    payload_summary=f"waited={time.monotonic() - _wait_t0:.2f}s",
                )
        logger.info("RECORD_UTTERANCE_START trace_id=%s prefill_frames=%d from_barge=%s",
                    _tid, _prefill_sample_count, _from_barge)
        audio = await record_utterance(
            max_initial_silence=CONVERSATION_TIMEOUT,
            # WAKE prefill opens the gate on its own; BARGE prefill must NOT — it
            # is passed via barge_prefill so record_utterance requires fresh
            # post-playback speech before honoring it.
            prefill=None if _from_barge else next_prefill,
            barge_prefill=next_prefill if _from_barge else None,
            turn_ctrl=turn_ctrl,
            control_state=control_state,
        )
        next_prefill = None
        _from_barge = False
        logger.info("MIC_CAPTURE_END trace_id=%s bytes=%d", _tid, len(audio))
        logger.info("record_utterance: returned %d bytes", len(audio))

        if not audio:
            logger.info("No speech — returning to standby")
            turn_ctrl.set_state(TurnState.STANDBY, strict=False)
            if control_state is not None:
                control_state.set_state("IDLE")
            return

        # INPUT-ID DE-DUP (BUFFER ownership/consumption): a finalized captured
        # segment gets a content-hash id. The SAME bytes can never create a second
        # command — a replayed/reused buffer is dropped here, before STT. Distinct
        # real utterances differ at the sample level, so this only catches replay.
        import hashlib as _hl
        _input_id = _hl.sha1(audio).hexdigest()[:12]
        logger.info("INPUT_ID id=%s trace_id=%s bytes=%d", _input_id, _tid, len(audio))
        if _input_id in _consumed_input_ids:
            logger.info("INPUT_ID_DUPLICATE_DROPPED id=%s trace_id=%s — already consumed, no new command",
                        _input_id, _tid)
            continue
        _consumed_input_ids.add(_input_id)

        turn_ctrl.set_state(TurnState.TRANSCRIBING, strict=False)
        if control_state is not None:
            control_state.set_state("THINKING")
        logger.info("STT: transcribing %d bytes", len(audio))
        _t_stt = time.monotonic()
        # transcribe_detailed(), not transcribe(): the STT safety gate
        # (service/turn_guard.py::evaluate_transcription_confidence) needs
        # the real no_speech_prob/compression_ratio metadata whisper-1
        # exposes via verbose_json — see app/config.py's stt_command_model
        # comment for the real-hardware comparison this was decided from.
        transcription = await stt.transcribe_detailed(audio)
        transcript = transcription.text
        if control_state is not None:
            control_state.set_stt_latency(round((time.monotonic() - _t_stt) * 1000, 1))
            control_state.set_transcription_metrics(transcription)
        logger.info(
            "STT: transcript=%r confidence=%s segments=%d model=%s",
            transcript, transcription.confidence, len(transcription.segments or []), transcription.model,
        )
        logger.info("STT_FINAL trace_id=%s text=%r", _tid, transcript)
        logger.info("STT_CONFIDENCE trace_id=%s confidence=%s", _tid, transcription.confidence)
        if _is_barge_cont:
            # The critical proof line: after a barge-in, the transcript that will
            # drive the next answer — it must be the user's words, never Merlin's
            # playback/echo. Correlate back via trace_id / the barge prefill logs.
            logger.info("NEXT_STT_FINAL trace_id=%s text=%r", _tid, transcript)

        accepted, reject_reason = evaluate_transcription_confidence(transcription)
        if not accepted:
            consecutive_rejections += 1
            logger.info(
                "STT_REJECTED reason=%s transcript=%r consecutive=%d/%d",
                reject_reason, transcript, consecutive_rejections, MAX_CONSECUTIVE_STT_REJECTIONS,
            )
            if control_state is not None:
                control_state.report_rejection(reject_reason, transcript)
                control_state.record_event("turn_guard", "STT_REJECTED", payload_summary=f"{reject_reason}: {transcript[:80]}")
            if consecutive_rejections >= MAX_CONSECUTIVE_STT_REJECTIONS:
                # Real 2026-08-07 incident: unconditional `continue` here let a
                # recurring near-silence noise source trap this loop for 10+
                # minutes, during which main()'s wake loop (and ClapDetector)
                # never got control back. Give up and return to standby like a
                # true silence timeout would — control_state.set_state("IDLE")
                # is what actually re-arms clap/keyword detection.
                logger.info(
                    "MAX_CONSECUTIVE_STT_REJECTIONS reached (%d) — returning to standby",
                    consecutive_rejections,
                )
                turn_ctrl.set_state(TurnState.STANDBY, strict=False)
                if control_state is not None:
                    control_state.set_state("IDLE")
                    control_state.record_event(
                        "record_utterance", "SESSION_ABANDONED",
                        payload_summary=f"{consecutive_rejections} consecutive STT rejections",
                    )
                return
            continue   # discard — keep listening, effectively "ask to repeat"
        consecutive_rejections = 0

        interrupted, prefill_chunks = await _process_turn(
            transcript, adapter, tts, player, store, session_id, turn_ctrl, control_state,
        )
        if interrupted:
            # PHASE 3/PHASE 9 test #6: continue capturing the SAME utterance —
            # no new wake word, no arbitrary sleep. The barge-in onset the
            # detector captured is preserved as barge_prefill, but per the
            # structural rule it is only honored once FRESH post-playback speech
            # is confirmed (see record_utterance / _resolve_post_barge_capture).
            next_prefill = prefill_chunks or None
            _from_barge = bool(next_prefill)


_MOS_BRIDGE = None


def _mos_shadow(transcript: str) -> None:
    """Voice → Event, SHADOW MODE (opt-in, best-effort).

    Mirrors the real STT transcript into the Merlin OS platform bus (mos) so the full
    event chain (user.spoke → intent → cognition → decision → plan → tool → response →
    learning) runs on REAL speech and is recorded to the durable log Mission Control
    reads. It does NOT change what the user hears (the live LLM+TTS path is untouched)
    and never raises. Enable with `launchctl setenv MERLIN_MOS_BRIDGE 1` + kickstart.
    """
    import os
    if os.getenv("MERLIN_MOS_BRIDGE") != "1":
        return
    try:
        global _MOS_BRIDGE
        if _MOS_BRIDGE is None:
            from mos.voice_bridge import VoiceBridge
            from mos.runtime import DEFAULT_EVENT_LOG
            _MOS_BRIDGE = VoiceBridge(store_path=DEFAULT_EVENT_LOG)
        _MOS_BRIDGE.on_transcript(transcript)
    except Exception as ex:                       # shadow must never break the live path
        logger.warning("mos shadow bridge error (ignored): %s", ex)


async def _extract_background(
    user_text: str,
    merlin_text: str,
    store: MemoryStore,
    api_key: str,
) -> None:
    """Run memory extraction as a fire-and-forget background task."""
    try:
        new_memories = await extract_memories(user_text, merlin_text, store, api_key)
        if new_memories:
            logger.info("Background extraction: %d memory/memories written", len(new_memories))
    except Exception:
        logger.debug("Background extraction failed silently", exc_info=True)


def _format_memory_review(store: MemoryStore) -> str:
    """Format top memories as a short spoken summary."""
    mems = store.for_context(max_items=10)
    if not mems:
        return "I don't have any stored memories about you yet. Tell me about yourself and I'll remember."

    lines = ["Here's what I remember about you:"]
    for m in mems[:8]:
        lines.append(f"{m.key.replace('_', ' ')}: {m.value}")
    return " ".join(lines)


# ── Main service loop ─────────────────────────────────────────────────────────

async def main() -> None:
    try:
        _git_sha = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=Path(__file__).parent.parent,
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except Exception:
        _git_sha = "unknown"
    logger.info("IDENTITY  pid=%d  __file__=%s  git=%s", os.getpid(), __file__, _git_sha)
    logger.info("Merlin service starting…")

    control_state = RuntimeControlState()   # Merlin Control Panel — live operator state
    from service.control_state import set_global_control_state
    set_global_control_state(control_state)   # app.domain_router reaches this for RUNTIME/DAY_OPENING retrieval
    adapter    = build_orchestrator()
    stt        = build_stt()
    tts        = build_tts()
    player     = AudioPlayer()
    store      = MemoryStore(_MEMORY_FILE)
    trigger    = WakeTrigger(openai_api_key=settings.openai_api_key, external_trigger=control_state.manual_wake)
    session_id = "merlin-bg"
    control_state.session_id = session_id
    control_state.stt_model = settings.stt_command_model
    if os.environ.get("MERLIN_RESTARTED_BY_PANEL"):
        control_state.set_restart_marker(
            float(os.environ.get("MERLIN_RESTARTED_BY_PANEL_TS", time.time())), "control_panel",
        )
    turn_ctrl  = TurnController()   # single source of truth for current_turn_id + state (PHASE 2/8)

    wake_modes = "keyword('merlin') + double-clap" if settings.openai_api_key else "double-clap only"
    mem_count  = len(store.all())
    logger.info(
        "Ready. Adapter=%s STT=%s TTS=%s | wake=%s | memories=%d",
        adapter.__class__.__name__,
        stt.__class__.__name__,
        tts.__class__.__name__,
        wake_modes,
        mem_count,
    )

    # ── Merlin Control Panel — embedded in THIS process's event loop, not a
    # second Merlin process. See service/control_panel.py. 127.0.0.1 only.
    from service.control_panel import ControlPanel
    import uvicorn
    control_panel = ControlPanel(
        turn_ctrl=turn_ctrl, player=player, adapter=adapter, store=store,
        session_id=session_id, control_state=control_state, stt=stt, tts=tts,
    )
    _panel_port = int(os.environ.get("MERLIN_CONTROL_PANEL_PORT", "8802"))
    _uvicorn_config = uvicorn.Config(control_panel.app, host="127.0.0.1", port=_panel_port, log_level="warning")
    _uvicorn_server = uvicorn.Server(_uvicorn_config)
    asyncio.create_task(_uvicorn_server.serve())
    logger.info("CONTROL_PANEL_LISTENING http://127.0.0.1:%d", _panel_port)

    retry_delay = 2.0

    while True:
        try:
            control_state.set_state("IDLE")
            pending, wake_source = await trigger.wait()
            logger.info("WAKE_HANDLER_ENTERED  pending_chunks=%d  source=%s", len(pending), wake_source)
            control_state.record_event(
                "wake_trigger", "WAKE", payload_summary=f"pending_chunks={len(pending)} source={wake_source}",
            )
            retry_delay = 2.0

            # DOUBLE CLAP -> DAY OPENING (Control Panel toggle, off by
            # default): decoupled from the trigger itself — a clap just sets
            # `wake_source`; this is the ONLY place that decides what a clap
            # MEANS, and it calls the exact same run_day_opening() the manual
            # Control Panel button calls (service/day_opening_runner.py).
            if wake_source == "clap" and control_state.day_opening_double_clap_enabled:
                logger.info("DAY_OPENING_TRIGGER_1 source=double_clap")
                player.chime()
                from service.day_opening_runner import run_day_opening
                await run_day_opening(adapter, tts, player, turn_ctrl, control_state, session_id)
                continue

            player.chime()          # non-blocking — must not delay the recorder
            logger.info("STARTING_ASSISTANT_PIPELINE")
            await run_conversation_session(
                adapter, stt, tts, player, store, session_id, turn_ctrl,
                prefill=pending, control_state=control_state,
            )

        except KeyboardInterrupt:
            logger.info("Interrupted — shutting down")
            break
        except Exception as exc:
            control_state.set_error(str(exc))
            control_state.record_event("main", "ERROR", result=str(exc))
            logger.exception("Error — retrying in %.0fs", retry_delay)
            await asyncio.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, 60.0)


if __name__ == "__main__":
    asyncio.run(main())
