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

# ── Barge-in (interrupt Merlin mid-speech) ────────────────────────────────────
# 2026-07-30: was 0.003 — identical to the ambient noise floor (~0.002–0.003),
# so room noise interrupted Merlin the instant he started speaking (log showed
# repeated "interrupted=True response_len=0").  Raised well above the floor so
# only real speech-over-Merlin barges in.
BARGE_IN_RMS    = 0.010  # mic energy that counts as user speaking over Merlin
BARGE_IN_FRAMES = 8      # need ~160 ms of sustained energy (8 × 20 ms blocks)
BARGE_IN_GRACE  = 0.5    # ignore first 0.5 s of playback (avoids echo trigger)
# 2026-07-30: temporarily disabled.  Merlin's own voice from the room speakers
# fed back into the Babyface mic (or the user kept talking) and tripped barge-in
# ~0.5 s into every reply, cutting it off (log: real reply, then interrupted=True
# response_len=59).  Getting a COMPLETE spoken reply matters more than interrupt
# support right now; re-enable once echo cancellation / a headset is in place.
BARGE_IN_ENABLED = False

# ── Conversation session ──────────────────────────────────────────────────────
CONVERSATION_TIMEOUT = 8.0   # seconds of post-response silence → standby

_CHIME = "/System/Library/Sounds/Tink.aiff"


# ── Interruptible audio player ────────────────────────────────────────────────

_TTS_SR = 24_000   # OpenAI TTS PCM sample rate (signed int16, mono)


class AudioPlayer:
    """Plays TTS PCM audio via sounddevice. interrupt() stops it immediately."""

    def __init__(self) -> None:
        self._interrupted = threading.Event()

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
            await asyncio.get_running_loop().run_in_executor(None, self._play_sync, data)

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
            if out is not None:
                try:
                    out.stop()
                    out.close()
                except Exception:
                    pass


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
             elapsed_s: float) -> str:
        """Consume one block. Returns the resulting state.

        'listening'    — silent, nothing buffered beyond the pre-roll ring
        'speech_start' — gate just opened; pre-roll flushed into the capture
        'recording'    — buffering speech
        'false_start'  — capture discarded, still listening
        'done'         — utterance complete, hand the buffer to STT
        """
        n = len(block)
        if not self.speech_on:
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


async def record_utterance(
    max_initial_silence: float | None = None,
    prefill: list[np.ndarray] | None = None,
) -> bytes:
    """
    Record from the mic until VAD-detected silence.

    Opens at the device's native sample rate and selects the loudest channel,
    then resamples to SAMPLE_RATE (16 kHz) before returning.  This avoids the
    silent-stream bug on multi-channel devices (e.g. RME Babyface) that do not
    support 16 kHz or single-channel input.

    prefill: mono float32 chunks at native sample rate captured during the
             wake→record transition gap (returned by WakeTrigger.wait()).
             Prepended before the InputStream opens so command audio spoken
             while Whisper was processing the keyword is not lost.

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

    stop = threading.Event()

    t_start     = time.monotonic()
    _cb_count   = [0]
    _cb_last_hb = [0.0]   # last heartbeat timestamp
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

        # loudest-channel RMS (handles multi-channel devices like RME Babyface)
        arr = indata.astype(np.float32)
        if arr.ndim == 1:
            pcm = arr
            rms = float(np.sqrt(np.mean(pcm ** 2)))
        else:
            ch_rms    = np.sqrt(np.mean(arr ** 2, axis=0))
            active_ch = int(np.argmax(ch_rms))
            pcm       = arr[:, active_ch]
            rms       = float(ch_rms[active_ch])

        # heartbeat: log on first call and every 2 s while waiting for speech
        if _cb_count[0] == 1 or (now - _cb_last_hb[0]) >= 2.0:
            _cb_last_hb[0] = now
            indata_max = float(np.max(np.abs(indata)))
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
        state = cap.feed(pcm.copy(), rms, now, elapsed_s)

        if state == "listening":
            if max_initial_silence and elapsed_s >= max_initial_silence:
                logger.info(
                    "record_utterance: initial silence timeout (%.1fs) — no speech",
                    max_initial_silence,
                )
                stop.set()
            return

        if state == "speech_start":
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
            stop.set()
            return

    loop = asyncio.get_running_loop()
    done = loop.create_future()

    def _watcher() -> None:
        stop.wait()
        loop.call_soon_threadsafe(done.set_result, None)

    threading.Thread(target=_watcher, daemon=True).start()

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


# ── Streaming response with barge-in ─────────────────────────────────────────

async def stream_response(
    adapter,
    tts,
    player: AudioPlayer,
    transcript: str,
    session_id: str,
) -> tuple[bool, str]:
    """
    Stream LLM → TTS while monitoring the mic for barge-in.

    Returns (interrupted, full_response_text).
    """
    loop        = asyncio.get_running_loop()
    barged_flag = threading.Event()    # set from audio thread
    barged_in   = asyncio.Event()      # set on event loop, watched by async code
    barge_count = 0
    # Barge-in must only interrupt Merlin while he is ACTUALLY speaking.  It used
    # to arm BARGE_IN_GRACE after stream_response *started* — i.e. during the
    # ~1.3s the LLM spends thinking, before any audio plays — so the user still
    # talking (or room noise) counted as "barging in" and killed the reply before
    # a single token was produced (log: interrupted=True response_len=0).  Keep it
    # disarmed (grace_until = inf) until the first audio chunk reaches the player,
    # then apply the grace window.
    playback_started = threading.Event()
    grace_until = [float("inf")]

    def _arm_barge() -> None:
        if not playback_started.is_set():
            playback_started.set()
            grace_until[0] = time.monotonic() + BARGE_IN_GRACE
            logger.info(
                "stream_response: playback started — barge-in arms in %.1fs",
                BARGE_IN_GRACE,
            )

    def _barge_callback(indata: np.ndarray, frames: int, time_info, status) -> None:
        nonlocal barge_count
        if barged_flag.is_set() or time.monotonic() < grace_until[0]:
            return
        arr = indata.astype(np.float32)
        if arr.ndim == 1:
            rms = float(np.sqrt(np.mean(arr ** 2)))
        else:
            ch_rms = np.sqrt(np.mean(arr ** 2, axis=0))
            rms    = float(ch_rms[int(np.argmax(ch_rms))])
        if rms > BARGE_IN_RMS:
            barge_count += 1
            if barge_count >= BARGE_IN_FRAMES:
                barged_flag.set()
                player.interrupt()
                loop.call_soon_threadsafe(barged_in.set)
        else:
            barge_count = max(0, barge_count - 1)

    buf           = SentenceBuffer(first_min_chars=30)
    full_response = ""

    if BARGE_IN_ENABLED:
        try:
            _barge_stream = sd.InputStream(
                samplerate=None,
                channels=None,
                dtype=np.float32,
                blocksize=320,      # 20 ms chunks for low-latency barge detection
                callback=_barge_callback,
            )
        except Exception as _exc:
            logger.error("stream_response: InputStream open failed: %s", _exc, exc_info=True)
            raise
        _ctx = _barge_stream
    else:
        # Barge-in disabled: do NOT open a mic InputStream during playback.  This
        # both lets Merlin finish uninterrupted and avoids the full-duplex
        # rate conflict on the Babyface that produced CoreAudio -10863.
        import contextlib
        logger.info("stream_response: barge-in DISABLED — Merlin will finish uninterrupted")
        _ctx = contextlib.nullcontext()

    with _ctx:
        logger.info("stream_response: LLM streaming start")
        async for chunk in adapter.respond(transcript, session_id=session_id):
            if barged_in.is_set():
                break
            full_response += chunk
            sentence = buf.push(chunk)
            if sentence and not barged_in.is_set():
                _arm_barge()   # Merlin is about to speak — now barge-in may apply
                if hasattr(tts, "stream_synthesize"):
                    await player.play_stream(tts.stream_synthesize(sentence))
                else:
                    audio_bytes = await tts.synthesize(sentence)
                    if not barged_in.is_set():
                        await player.play(audio_bytes)

        if not barged_in.is_set():
            remainder = buf.flush()
            if remainder:
                _arm_barge()
                if hasattr(tts, "stream_synthesize"):
                    await player.play_stream(tts.stream_synthesize(remainder))
                else:
                    audio_bytes = await tts.synthesize(remainder)
                    if not barged_in.is_set():
                        await player.play(audio_bytes)

    logger.info(
        "Merlin: %s",
        full_response[:120] + ("…" if len(full_response) > 120 else ""),
    )
    return barged_in.is_set(), full_response


# ── Conversation session ──────────────────────────────────────────────────────

_MEMORY_REVIEW_PHRASES = {
    "what do you remember",
    "show me your memory",
    "what do you know about me",
    "מה אתה זוכר",       # Hebrew
    "מה אתה יודע עליי",  # Hebrew
}


async def run_conversation_session(
    adapter,
    stt,
    tts,
    player: AudioPlayer,
    store: MemoryStore,
    session_id: str,
    prefill: list[np.ndarray] | None = None,
) -> None:
    """
    Multi-turn conversation loop.

    Stays awake after each response. Returns to standby after
    CONVERSATION_TIMEOUT seconds of silence with no new speech.
    After each turn, memory extraction runs as a background task.

    prefill: post-keyword audio from WakeTrigger; passed only on the first
             turn so command audio spoken during Whisper's latency is not lost.
    """
    logger.info("PIPELINE_STARTED_SUCCESSFULLY")
    first_prefill = prefill
    while True:
        logger.info("Listening… (%.0fs timeout)", CONVERSATION_TIMEOUT)
        audio = await record_utterance(
            max_initial_silence=CONVERSATION_TIMEOUT,
            prefill=first_prefill,
        )
        first_prefill = None   # prefill is consumed on the first turn only
        logger.info("record_utterance: returned %d bytes", len(audio))

        if not audio:
            logger.info("No speech — returning to standby")
            return

        logger.info("STT: transcribing %d bytes", len(audio))
        transcript = await stt.transcribe(audio)
        logger.info("STT: transcript=%r", transcript)
        if not transcript.strip():
            continue

        logger.info("You: %s", transcript)
        _mos_shadow(transcript)   # Voice → Event (shadow, opt-in; never affects the live path)

        # Memory review voice command
        if any(phrase in transcript.lower() for phrase in _MEMORY_REVIEW_PHRASES):
            review_text = _format_memory_review(store)
            await player.play(await tts.synthesize(review_text))
            continue

        logger.info("LLM+TTS: starting stream_response")
        interrupted, response_text = await stream_response(
            adapter, tts, player, transcript, session_id
        )
        logger.info("LLM+TTS: done — interrupted=%s response_len=%d", interrupted, len(response_text))

        # Background memory extraction — runs after response, invisible to user
        if response_text and settings.anthropic_api_key:
            asyncio.create_task(
                _extract_background(transcript, response_text, store, settings.anthropic_api_key)
            )

        if interrupted:
            logger.info("Barge-in detected — listening for next utterance")
            await asyncio.sleep(0.2)


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

    adapter    = build_orchestrator()
    stt        = build_stt()
    tts        = build_tts()
    player     = AudioPlayer()
    store      = MemoryStore(_MEMORY_FILE)
    trigger    = WakeTrigger(openai_api_key=settings.openai_api_key)
    session_id = "merlin-bg"

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

    retry_delay = 2.0

    while True:
        try:
            pending = await trigger.wait()
            logger.info("WAKE_HANDLER_ENTERED  pending_chunks=%d", len(pending))
            player.chime()          # non-blocking — must not delay the recorder
            retry_delay = 2.0

            logger.info("STARTING_ASSISTANT_PIPELINE")
            await run_conversation_session(
                adapter, stt, tts, player, store, session_id, prefill=pending
            )

        except KeyboardInterrupt:
            logger.info("Interrupted — shutting down")
            break
        except Exception:
            logger.exception("Error — retrying in %.0fs", retry_delay)
            await asyncio.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, 60.0)


if __name__ == "__main__":
    asyncio.run(main())
