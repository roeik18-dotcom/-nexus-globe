"""Wake trigger — 'Hi Merlin' keyword and double-clap detection.

Both detectors share one microphone stream and race to fire.
Keyword detection is active when an OpenAI API key is provided (uses Whisper).
Double clap is always active as a fallback.

The InputStream opens at the device's native sample rate (queried at startup),
then resamples to WHISPER_SR before sending to Whisper.  This avoids the silent-
stream bug that occurs when 16 kHz is requested from a device (e.g. RME Babyface)
that only supports 44.1 / 48 / 96 kHz.
"""

import asyncio
import io
import json
import logging
import os
import queue
import threading
import time
from math import gcd

import numpy as np
import sounddevice as sd
from scipy.io import wavfile
from scipy.signal import resample_poly

logger = logging.getLogger(__name__)

SAMPLE_RATE = 16_000   # kept for merlin_service.py compat; NOT used for InputStream
WHISPER_SR  = 16_000   # target sample rate for Whisper inference
CHUNK_MS    = 20       # InputStream block size in ms
CHUNK_SIZE  = int(SAMPLE_RATE * CHUNK_MS / 1000)   # 320 — kept for compat

# ── Clap parameters ───────────────────────────────────────────────────────────
CLAP_THRESHOLD       = 0.030
CLAP_MAX_S           = 0.25
CLAP_GAP_MIN_S       = 0.05
DOUBLE_CLAP_WINDOW_S = 1.0

# 2026-08-15 — CLAP_THRESHOLD alone missed most live claps. Root cause: it
# gates on RMS averaged over one whole callback block (~70ms at the observed
# 44.1kHz/3072-sample framing), but a hand clap's actual acoustic energy is
# often 5-20ms — well under the block size. A loud, genuine clap straddling a
# block boundary or shorter than the block dilutes to a frame-RMS well below
# 0.10 even though it was clearly audible, while a slightly longer/louder/
# better-aligned clap survives the same averaging. This is duration-dilution,
# not a threshold-value problem — same physical clap, different luck with
# block alignment. Evidence: [wake] wrote logs recorded three separate
# peak=1.000000 (full-scale) events this session (2026-08-14 18:54:26,
# 19:08:36; 2026-08-15 02:02:55) that never registered as an RMS-crossing
# burst at all.
#
# Fix: OR in a peak check alongside the existing RMS gate — peak amplitude
# isn't diluted by silence elsewhere in the block, so it reflects a short
# transient's true loudness regardless of alignment. Purely additive: every
# clap the RMS gate already caught still triggers identically; this only
# catches ones RMS was diluting away.
#
# CLAP_PEAK_THRESHOLD=0.35 is evidence-grounded, not guessed: across 41,673
# two-second-window peak samples logged this session (spanning the full
# multi-hour session, many hours of normal room activity/speech/movement),
# only 5 ever exceeded 0.35 — the 3 known peak=1.0 events, one 0.777, one
# 0.362 — a 0.012% rate. Since window-peak is the max of every ~70ms frame
# peak inside it, a window staying under 0.35 proves every frame inside it
# also stayed under 0.35, so this is a real (not optimistic) false-positive
# bound against everything else that happened in the room this session.
# 2026-08-17 20:39 LIVE REGRESSION recalibration: the user clapped at the
# CURRENT (post-gain-fix) interface level and the strongest measured burst
# reached rms=0.0596 / peak=0.110 — ~60%/31% of the old 0.100/0.350 gates,
# so no clap could ever wake at today's real levels (the 0.35 evidence
# above was collected at a different input gain era, incl. full-scale 1.0
# events that today's chain never produces). New gates sit ON MEASURED
# DATA: claps this session = rms 0.036–0.060 / peak 0.071–0.110; normal
# speech bursts = rms ≤0.024. rms 0.030 / peak 0.065 pass every measured
# clap while staying above every measured speech burst; the DOUBLE-clap
# pattern gate (two bursts + gap) still guards against single transients.
CLAP_PEAK_THRESHOLD  = 0.065

# Diagnostic-only: bounded per-frame clap-detector visibility for live wake
# troubleshooting. Auto-expires so it can never spam steady-state logs forever.
# Does not affect detection behavior — read-only instrumentation.
#
# 2026-08-15 — was 45.0. Measured directly against the 5-attempt reliability
# test: every listening cycle this session ran 181s-424s before any clap
# activity (user hesitation/pacing between attempts), so the 45s window had
# already expired before EVERY SINGLE clap in that test, successful or not —
# zero frame-level diagnostic data survived for any of the 5 attempts.
# Widened to comfortably exceed the largest observed gap (424s) with margin,
# so the next live test actually produces usable per-frame evidence instead
# of another blind spot. Still bounded (not permanent), same as before.
CLAP_DIAG_WINDOW_S = 900.0

# ── Keyword parameters ────────────────────────────────────────────────────────
from service.vad_config import SPEECH_RMS_THRESHOLD as VAD_THRESHOLD  # shared with merlin_service
from service.vad_config import normalize_for_whisper  # peak-normalize quiet utterances
from service.wake_gate import DropOldestQueue, admit  # keeps the Whisper lane fresh
print(f"[wake_trigger] VAD_THRESHOLD={VAD_THRESHOLD:.5f} loaded from service.vad_config", flush=True)
SPEECH_MIN_S   = 0.15     # minimum speech length before transcribing (was 0.3; marginal SM58 signal fragments into short bursts)
SILENCE_END_S  = 0.6      # silence this long ends the utterance
MAX_BUFFER_S   = 4.0      # hard cap: transcribe even if silence never arrives

# ── Telemetry ─────────────────────────────────────────────────────────────────
_LOG_INTERVAL_FRAMES = 250   # heartbeat log every ~5 s (250 × 20 ms blocks)

# ── API-key validation ──────────────────────────────────────────────────────
# Common glyphs that appear when a *masked* key (e.g. from a screenshot or a
# `re.sub` that redacted the value) is accidentally written into .env instead of
# the real secret.  A real OpenAI key is ASCII-only, so any of these means the
# key is corrupted — sending it in an HTTP header raises UnicodeEncodeError on
# every request, which previously flooded the logs once per audio frame.
_MASKING_CHARS = {"•": "bullet", "…": "ellipsis", "*": "asterisk"}
_EXPECTED_KEY_PREFIX = "sk-"
# Max consecutive inference failures before the keyword path backs off as a runtime
# backstop (validation should catch bad keys first; this guards the case where a key
# passes validation but the API path keeps failing).
_MAX_CONSECUTIVE_INFERENCE_ERRORS = 3

# Backoff schedule (seconds) applied after each burst of consecutive failures.  The
# purpose of the backstop is to stop per-frame log flooding, NOT to kill the wake
# word: it used to `return`, so a single bad request shape or a transient API blip
# left keyword wake dead until someone noticed and restarted the service.  Now the
# thread sleeps, drains whatever piled up, and tries again — it self-heals.
_INFERENCE_BACKOFF_S = (30, 60, 300)

# ── Audio-capture probe (instrumentation; OFF by default) ─────────────────────
# Experiment E2: to answer "does the inconsistency already exist in the audio sent
# to Whisper?", we must analyse the EXACT buffer the system sent to STT.  This
# probe saves that buffer + metadata per utterance — but ONLY when the env var
# MERLIN_CAPTURE_WAV=1 is set.  When it is unset, the production path is byte-for-
# byte identical (no extra API fields, no writes, no behaviour change).
_CAPTURE_DIR = os.path.expanduser(
    os.environ.get("MERLIN_CAPTURE_DIR", "~/Library/Logs/Merlin/capture")
)
_capture_seq = [0]


def _capture_enabled() -> bool:
    return os.environ.get("MERLIN_CAPTURE_WAV") == "1"


def _save_capture(audio: np.ndarray, sr: int, wake_match: bool, result) -> None:
    """Save the exact Whisper-bound audio + metadata (capture mode only).

    `result` is a verbose_json transcription result (requested only in capture
    mode), so segment-level no_speech_prob and detected language are available.
    """
    os.makedirs(_CAPTURE_DIR, exist_ok=True)
    _capture_seq[0] += 1
    stamp = time.strftime("%Y%m%d-%H%M%S")
    base = f"wake_{stamp}_{_capture_seq[0]:03d}"
    wavfile.write(
        os.path.join(_CAPTURE_DIR, base + ".wav"),
        sr, (np.clip(audio, -1.0, 1.0) * 32767).astype(np.int16),
    )
    peak = float(np.max(np.abs(audio))) if audio.size else 0.0
    rms  = float(np.sqrt(np.mean(audio ** 2))) if audio.size else 0.0
    segs = getattr(result, "segments", None) or []
    no_speech = float(np.mean([s.no_speech_prob for s in segs])) if segs else None
    meta = {
        "timestamp": stamp,
        "wav": base + ".wav",
        "rms": round(rms, 6),
        "peak": round(peak, 6),
        "duration": round(len(audio) / sr, 3),
        "sample_rate": sr,
        "wake_match": bool(wake_match),
        "transcript": getattr(result, "text", ""),
        "no_speech": round(no_speech, 4) if no_speech is not None else None,
        "language": getattr(result, "language", None),
    }
    with open(os.path.join(_CAPTURE_DIR, base + ".json"), "w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=2)
    logger.info("CAPTURE saved %s  rms=%.5f peak=%.5f match=%s", base, rms, peak, wake_match)


def validate_openai_api_key(api_key: str | None) -> tuple[bool, str]:
    """Validate an OpenAI API key without ever exposing it.

    Returns ``(ok, reason)``.  ``reason`` is a non-sensitive, log-safe
    explanation that NEVER contains the key itself; on success it is ``""``.

    Rejects: missing/empty keys, keys containing masking placeholder glyphs
    (•, …, *), keys with any non-ASCII character, and keys that lack the
    expected OpenAI ``sk-`` prefix.
    """
    if not api_key or not api_key.strip():
        return False, "OPENAI_API_KEY is missing or empty"

    key = api_key.strip()

    present_masks = [name for ch, name in _MASKING_CHARS.items() if ch in key]
    if present_masks:
        return False, (
            "OPENAI_API_KEY contains masking placeholder character(s): "
            + ", ".join(present_masks)
            + " — a masked/redacted value appears to have been written to .env "
            "instead of the real key"
        )

    non_ascii = sum(1 for ch in key if ord(ch) > 127)
    if non_ascii:
        return False, (
            f"OPENAI_API_KEY contains {non_ascii} non-ASCII character(s); a real "
            "key is ASCII-only, so this value is corrupted or masked"
        )

    if not key.startswith(_EXPECTED_KEY_PREFIX):
        return False, (
            f"OPENAI_API_KEY does not start with the expected "
            f"{_EXPECTED_KEY_PREFIX!r} prefix"
        )

    return True, ""


def _query_mic_rate() -> int:
    """Return the default input device's native sample rate."""
    try:
        info = sd.query_devices(kind="input")
        rate = int(info["default_samplerate"])
        logger.info("Mic device %r — native sample rate: %d Hz", info.get("name"), rate)
        return rate
    except Exception as exc:
        logger.warning("Could not query mic sample rate (%s) — falling back to %d", exc, WHISPER_SR)
        return WHISPER_SR


class ClapDetector:
    """Stateful per-frame clap detector. Feed RMS values; fires on double clap."""

    def __init__(self, on_double_clap: threading.Event, source_box: list | None = None):
        self._trigger       = on_double_clap
        self._in_burst      = False
        self._burst_start   = 0.0
        self._last_clap_end = 0.0
        self._clap_times: list[float] = []
        # Day Opening double-clap trigger (Control Panel): lets the caller
        # tell, after event.wait() returns, whether THIS detector fired vs
        # the keyword detector — both share the same `event`. None (default)
        # is byte-identical to pre-Day-Opening behavior.
        self._source_box = source_box
        self._diag_deadline = time.monotonic() + CLAP_DIAG_WINDOW_S

    def feed(self, rms: float, peak: float, now: float) -> None:
        diag = now <= self._diag_deadline
        condition = "below_threshold_idle"
        above = rms > CLAP_THRESHOLD or peak > CLAP_PEAK_THRESHOLD
        if above:
            if not self._in_burst:
                self._in_burst    = True
                self._burst_start = now
                condition = "burst_opened"
            else:
                condition = "burst_continuing"
        else:
            if self._in_burst:
                self._in_burst = False
                burst_dur      = now - self._burst_start
                gap_since_last = now - self._last_clap_end
                if burst_dur <= CLAP_MAX_S and gap_since_last >= CLAP_GAP_MIN_S:
                    self._last_clap_end = now
                    condition = "burst_closed_accepted"
                    self._record_clap(now)
                elif burst_dur > CLAP_MAX_S:
                    condition = f"burst_closed_rejected_too_long({burst_dur:.3f}s>{CLAP_MAX_S}s)"
                else:
                    condition = f"burst_closed_rejected_gap_too_short({gap_since_last:.3f}s<{CLAP_GAP_MIN_S}s)"
        if diag:
            logger.info(
                "[clap-diag] t=%.3f rms=%.6f peak=%.6f rms_thr=%.3f peak_thr=%.3f "
                "in_burst=%s burst_dur=%.3f gap=%.3f condition=%s",
                now, rms, peak, CLAP_THRESHOLD, CLAP_PEAK_THRESHOLD, self._in_burst,
                (now - self._burst_start) if self._in_burst else 0.0,
                now - self._last_clap_end,
                condition,
            )

    def _record_clap(self, now: float) -> None:
        self._clap_times = [t for t in self._clap_times if now - t <= DOUBLE_CLAP_WINDOW_S]
        self._clap_times.append(now)
        logger.debug("clap — total in window: %d", len(self._clap_times))
        if len(self._clap_times) >= 2:
            self._clap_times.clear()
            logger.info("double-clap wake trigger fired")
            if self._source_box is not None:
                self._source_box[0] = "clap"
            self._trigger.set()


# ── On-device wake-word (Porcupine) — the production wake classifier ─────────
# Replaces the cloud-STT wake path ("audio -> OpenAI transcribe -> search merlin").
# Fully local / offline. Config comes from the environment; if it is missing we
# fail CLEARLY (PORCUPINE_CONFIG_MISSING) and never fall back to cloud Whisper.
# AccessKey from the standard Picovoice env name (PICOVOICE_ACCESS_KEY), with
# the legacy PORCUPINE_ACCESS_KEY accepted as a fallback. The secret lives only
# in the gitignored .env (loaded via dotenv), never hard-coded here.
PORCUPINE_ACCESS_KEY   = (os.environ.get("PICOVOICE_ACCESS_KEY")
                          or os.environ.get("PORCUPINE_ACCESS_KEY") or "").strip()
PORCUPINE_KEYWORD_PATH = os.environ.get("PORCUPINE_KEYWORD_PATH", "").strip()

# openWakeWord on-device wake (2026-08-09) — key-free alternative to Porcupine.
# A custom "Merlin" model (.onnx) is trained OFFLINE (see tools/train_merlin_wakeword.md)
# and pointed at here. When MERLIN_OWW_MODEL_PATH is unset/missing the backend is
# simply not selected (double-clap stays active) — identical fail-clear posture as
# Porcupine, never a cloud-Whisper fallback.
MERLIN_OWW_MODEL_PATH = os.environ.get("MERLIN_OWW_MODEL_PATH", "").strip()
MERLIN_OWW_THRESHOLD  = float(os.environ.get("MERLIN_OWW_THRESHOLD", "0.5") or "0.5")


class PorcupineDetector:
    """On-device keyword spotter. Every mic frame (mono float32 @ mic_sr) is
    resampled to Porcupine's 16 kHz int16 and fed in frame_length chunks to
    porcupine.process(); process() returns True the instant the keyword fires.
    Reuses the EXISTING wake InputStream — opens no second microphone stream."""

    def __init__(self, access_key: str, keyword_path: str, mic_sr: int, sensitivity: float = 0.5):
        import pvporcupine
        self._pp = pvporcupine.create(
            access_key=access_key, keyword_paths=[keyword_path], sensitivities=[sensitivity],
        )
        self.target_sr = self._pp.sample_rate      # 16000
        self.frame_len = self._pp.frame_length     # 512
        self._mic_sr   = int(mic_sr)
        self._residual = np.zeros(0, dtype=np.int16)

    def process(self, pcm_native: np.ndarray) -> bool:
        if self._mic_sr != self.target_sr:
            from math import gcd
            g = gcd(self._mic_sr, self.target_sr)
            pcm = resample_poly(pcm_native, self.target_sr // g, self._mic_sr // g)
        else:
            pcm = pcm_native
        i16 = (np.clip(pcm, -1.0, 1.0) * 32767).astype(np.int16)
        self._residual = np.concatenate([self._residual, i16]) if self._residual.size else i16
        fired = False
        while len(self._residual) >= self.frame_len:
            frame = self._residual[:self.frame_len]
            self._residual = self._residual[self.frame_len:]
            if int(self._pp.process(frame)) >= 0:
                fired = True
        return fired

    def close(self) -> None:
        try:
            self._pp.delete()
        except Exception:
            pass


class OpenWakeWordDetector:
    """On-device openWakeWord spotter (NO API key). Duck-type-identical to
    PorcupineDetector — process(mono float32 @ mic_sr) -> bool, close() — so it
    drops into KeywordBuffer's existing detector slot with no callback changes.
    Resamples to 16 kHz and feeds openWakeWord's 1280-sample (80 ms) int16
    frames to a custom 'Merlin' ONNX model; fires when its score crosses
    `threshold`. Reuses the EXISTING wake InputStream — no second mic stream."""
    backend_name = "openwakeword"

    def __init__(self, model_path: str, mic_sr: int, threshold: float = 0.5):
        from openwakeword.model import Model
        # inference_framework='onnx' → onnxruntime (ships a py3.14 wheel); the
        # bundled melspectrogram/embedding feature models are reused automatically.
        self._model = Model(wakeword_models=[model_path], inference_framework="onnx")
        self.target_sr = 16000
        self.frame_len = 1280                 # 80 ms @ 16 kHz — openWakeWord's frame
        self._mic_sr = int(mic_sr)
        self._threshold = float(threshold)
        self._residual = np.zeros(0, dtype=np.int16)

    def process(self, pcm_native: np.ndarray) -> bool:
        if self._mic_sr != self.target_sr:
            from math import gcd
            g = gcd(self._mic_sr, self.target_sr)
            pcm = resample_poly(pcm_native, self.target_sr // g, self._mic_sr // g)
        else:
            pcm = pcm_native
        i16 = (np.clip(pcm, -1.0, 1.0) * 32767).astype(np.int16)
        self._residual = np.concatenate([self._residual, i16]) if self._residual.size else i16
        fired = False
        while len(self._residual) >= self.frame_len:
            frame = self._residual[:self.frame_len]
            self._residual = self._residual[self.frame_len:]
            scores = self._model.predict(frame)
            if scores and max(scores.values()) >= self._threshold:
                fired = True
        return fired

    def close(self) -> None:
        pass


class KeywordBuffer:
    """
    Wake keyword spotter. With an on-device `porcupine` detector it is the
    production path (no cloud). Without one it is the legacy VAD-gated Whisper
    spotter (kept only for non-Porcupine callers/tests).

    Accumulates speech chunks from the microphone stream at ``mic_sr`` Hz.
    When an utterance ends, it resamples to WHISPER_SR and sends it to the
    background Whisper inference thread.  Fires the trigger event when the
    keyword is found in the transcript.
    """

    def __init__(
        self,
        trigger: threading.Event,
        openai_api_key: str,
        keyword: str = "merlin",
        *,
        mic_sr: int = WHISPER_SR,
        source_box: list | None = None,
        porcupine: "PorcupineDetector | None" = None,
    ):
        self._trigger  = trigger
        self._api_key  = openai_api_key
        self._source_box = source_box
        self._porcupine = porcupine   # on-device wake; when set, no cloud STT is used
        # Match both the English keyword and its Hebrew transliteration so
        # Whisper transcribing Hebrew speech ("מרלין") also fires the trigger.
        self._keywords = frozenset({keyword.lower(), "מרלין"})
        self._mic_sr   = mic_sr

        self._chunks: list[np.ndarray] = []
        self._in_speech   = False
        self._speech_start = 0.0
        self._last_speech  = 0.0
        # Retention cap for one continuous speech run.  Without it, input that stays
        # above threshold never leaves the `_in_speech` branch and `_chunks` grows
        # without bound — 2026-08-01 produced a single 795 s "utterance".
        self._retain_max   = int(mic_sr * MAX_BUFFER_S)
        self._buffered     = 0
        # True once this speech run has already been sent for inference, so a long
        # run costs exactly one Whisper call instead of one per audio block.
        self._run_flushed  = False

        # Bounded, drop-oldest: the PortAudio callback must never block, and a deep
        # backlog is stale by the time the serialized network lane reaches it. See
        # service/wake_gate.py for the measurements behind this.
        self._inq = DropOldestQueue()

        # telemetry
        self._frame_count = 0
        self._peak_rms    = 0.0

        # Only the legacy cloud path needs the Whisper inference thread. With an
        # on-device Porcupine detector NO OpenAI transcription runs while waiting
        # for the wake word (requirement 13).
        if self._porcupine is None:
            threading.Thread(target=self._inference_loop, daemon=True).start()

    # ── audio callback path (runs on the PortAudio thread) ───────────────────

    def drain_pending(self) -> list[np.ndarray]:
        """
        Return and clear any chunks buffered since the last Whisper flush.

        Called immediately after the wake event fires (while the stream is still
        open so the last callback frames are included).  Audio accumulated during
        Whisper's network round-trip is the most likely start of the user's
        command and must not be discarded when the wake InputStream closes.
        """
        chunks = self._chunks
        had_speech = self._in_speech
        self._reset_run()
        if had_speech and chunks:
            duration_s = sum(len(c) for c in chunks) / self._mic_sr
            logger.info(
                "drain_pending: returning %d chunks (%.2fs) from post-keyword buffer",
                len(chunks), duration_s,
            )
        else:
            logger.info("drain_pending: no post-keyword speech buffered (%d chunks)", len(chunks))
        return chunks

    def feed(self, pcm: np.ndarray, rms: float) -> None:
        now = time.monotonic()

        # ── On-device wake classification (production path) ──────────────────
        # Replaces "audio -> OpenAI transcribe -> search 'merlin'". Fires the
        # SAME handoff (source_box='keyword' + trigger.set) the Whisper path did.
        # The VAD chunk accumulation below still runs so drain_pending() returns
        # the post-keyword command audio for record_utterance().
        if self._porcupine is not None:
            try:
                if self._porcupine.process(pcm):
                    if self._source_box is not None:
                        self._source_box[0] = "keyword"
                    logger.info("WAKE_KEYWORD_DETECTED backend=%s",
                                getattr(self._porcupine, "backend_name", "porcupine"))
                    self._trigger.set()
            except Exception:
                logger.exception("on-device wake process failed")

        self._frame_count += 1
        if rms > self._peak_rms:
            self._peak_rms = rms

        # heartbeat every 50 frames (≈ 1 s at 20 ms blocks)
        if self._frame_count % 50 == 0:
            logger.info(
                "VAD heartbeat — frame=%d  peak_rms=%.6f  cur_rms=%.6f"
                "  threshold=%.6f  ratio=%.1f%%  in_speech=%s  queue=%d"
                "  pcm_dtype=%s  pcm_max=%.6f",
                self._frame_count, self._peak_rms, rms,
                VAD_THRESHOLD, rms / VAD_THRESHOLD * 100 if VAD_THRESHOLD else 0,
                self._in_speech, self._inq.qsize(),
                pcm.dtype, float(np.abs(pcm).max()),
            )
            self._peak_rms = 0.0

        # per-frame trace when signal is at least 5 % of threshold.
        # DEBUG on purpose: this fires roughly once per audio frame during normal
        # standby listening and ballooned service.log to ~130 MB/day at INFO.
        if rms >= VAD_THRESHOLD * 0.05:
            logger.debug(
                "[vad-near] frame=%d  rms=%.6f  threshold=%.6f  ratio=%.1f%%"
                "  pcm_dtype=%s  pcm_min=%.6f  pcm_max=%.6f  in_speech=%s",
                self._frame_count, rms, VAD_THRESHOLD, rms / VAD_THRESHOLD * 100,
                pcm.dtype, float(pcm.min()), float(np.abs(pcm).max()),
                self._in_speech,
            )

        if rms >= VAD_THRESHOLD:
            if not self._in_speech:
                self._in_speech    = True
                self._speech_start = now
                self._chunks       = []
                self._buffered     = 0
                self._run_flushed  = False
                logger.info(
                    "VAD on  — rms=%.4f  wake_vad_threshold=%.4f  speech_start=%.3f",
                    rms, VAD_THRESHOLD, self._speech_start,
                )
            self._last_speech = now

            if self._buffered < self._retain_max:
                self._chunks.append(pcm.copy())
                self._buffered += len(pcm)
                # Cap reached: send the leading window NOW rather than waiting for a
                # silence that may never come.  This also cuts wake latency — the
                # keyword no longer waits out the rest of the sentence plus
                # SILENCE_END_S before it is transcribed.
                if self._buffered >= self._retain_max and not self._run_flushed:
                    logger.info(
                        "VAD cap — %.2fs of continuous speech buffered, flushing early",
                        self._buffered / self._mic_sr,
                    )
                    self._flush(end_run=False)
                    self._run_flushed = True
        else:
            if self._in_speech:
                if self._buffered < self._retain_max:
                    self._chunks.append(pcm.copy())
                    self._buffered += len(pcm)
                silence_so_far = now - self._last_speech
                total_s        = now - self._speech_start

                if silence_so_far >= SILENCE_END_S:
                    speech_s = self._last_speech - self._speech_start
                    if self._run_flushed:
                        # Already inferred for this run at the cap — just close it.
                        logger.info(
                            "VAD off — run already flushed at cap (%.2fs), closing",
                            speech_s,
                        )
                        self._reset_run()
                    elif speech_s >= SPEECH_MIN_S:
                        self._flush()
                    else:
                        logger.info(
                            "VAD off — too short (%.2fs < %.2fs), discarded",
                            speech_s, SPEECH_MIN_S,
                        )
                        self._reset_run()
                elif total_s >= MAX_BUFFER_S and not self._run_flushed:
                    self._flush()

    def _reset_run(self) -> None:
        """Close the current speech run and release its buffer."""
        self._in_speech   = False
        self._chunks      = []
        self._buffered    = 0
        self._run_flushed = False

    def _flush(self, end_run: bool = True) -> None:
        """Send the buffered utterance for inference.

        `end_run=False` is the early cap-flush: the speaker is still talking, so the
        run stays open (to detect its real end) but its audio is handed off now. The
        buffer is released either way — retention is already at the cap.
        """
        chunks, self._chunks = self._chunks, []
        self._buffered = 0
        if end_run:
            self._in_speech   = False
            self._run_flushed = False
        if not chunks:
            return

        audio      = np.concatenate(chunks)
        duration_s = len(audio) / self._mic_sr

        # resample to Whisper target rate if mic is at a different rate
        rms_before = float(np.sqrt(np.mean(audio ** 2)))
        max_before = float(np.max(np.abs(audio)))
        if self._mic_sr != WHISPER_SR:
            g     = gcd(self._mic_sr, WHISPER_SR)
            audio = resample_poly(audio, WHISPER_SR // g, self._mic_sr // g).astype(np.float32)
        rms_after = float(np.sqrt(np.mean(audio ** 2)))
        max_after = float(np.max(np.abs(audio)))

        # Admission control BEFORE the network: reject utterances too short to hold
        # the keyword, and forward only the leading window of long ones (the wake
        # word is always at the start).  Bounds every request's payload — including
        # the pathological 795 s flush seen on 2026-08-01.
        audio, decision = admit(audio, WHISPER_SR)
        if not decision.admit:
            logger.info(
                "WAKE_GATE reject reason=%s duration=%.2fs — not sent to Whisper",
                decision.reason, decision.duration_s,
            )
            return
        if decision.truncated:
            logger.info(
                "WAKE_GATE truncated %.2fs → %.2fs (leading window; keyword is at the start)",
                decision.duration_s, decision.sent_s,
            )

        # Peak-normalize the (already VAD-gated) utterance so Whisper receives a
        # healthy amplitude.  Low-level mic input otherwise triggers Whisper
        # hallucinations; this does not affect VAD gating (already decided above).
        audio, norm_gain = normalize_for_whisper(audio)

        logger.info(
            "VAD flush — speech_duration=%.2fs"
            "  rms_before_resample=%.5f  max_before=%.5f"
            "  rms_after_resample=%.5f  max_after=%.5f  norm_gain=×%.2f"
            "  (mic_sr=%d→%d)  audio_dtype=%s  samples=%d",
            duration_s,
            rms_before, max_before,
            rms_after, max_after, norm_gain,
            self._mic_sr, WHISPER_SR, audio.dtype, len(audio),
        )
        dropped = self._inq.put(audio)
        logger.info(
            "ENQUEUE — queue_depth=%d  samples=%d  evicted=%d  evicted_total=%d",
            self._inq.qsize(), len(audio), dropped, self._inq.drops,
        )

    # ── inference thread ──────────────────────────────────────────────────────

    def _inference_loop(self) -> None:
        # Validate the key once, up front.  An invalid key (e.g. masked with •)
        # would otherwise raise UnicodeEncodeError on every single frame's
        # request; instead we log one clear error and exit the thread, leaving
        # the double-clap wake path fully operational.
        ok, reason = validate_openai_api_key(self._api_key)
        if not ok:
            logger.error(
                "Keyword inference thread not started — %s. "
                "Keyword wake disabled; double-clap wake remains active.",
                reason,
            )
            return

        try:
            import openai
            from app.config import settings as _settings

            stt_model = _settings.stt_model
            client = openai.OpenAI(api_key=self._api_key)
            logger.info(
                "Keyword inference thread ready (model=%s, keywords=%s, mic_sr=%d→%d)",
                stt_model, self._keywords, self._mic_sr, WHISPER_SR,
            )
        except Exception:
            logger.error(
                "Keyword inference thread failed to start — keyword detection disabled",
                exc_info=True,
            )
            return

        consecutive_errors = 0
        backoff_step = 0
        while True:
            audio = self._inq.get()
            logger.info(
                "DEQUEUE — samples=%d  dtype=%s  min=%.6f  max=%.6f  rms=%.6f  queue_depth=%d",
                len(audio), audio.dtype,
                float(audio.min()), float(np.abs(audio).max()),
                float(np.sqrt(np.mean(audio ** 2))),
                self._inq.qsize(),
            )
            try:
                duration_s = len(audio) / WHISPER_SR
                buf        = io.BytesIO()
                wavfile.write(buf, WHISPER_SR, audio)
                buf.seek(0)
                buf.name = "audio.wav"

                logger.info("Whisper ← %.2fs audio (samples=%d)", duration_s, len(audio))
                # Bias recognition toward the wake word in both languages.  On
                # low-SNR input Whisper otherwise hallucinates unrelated stock
                # phrases ("phew", "you", Korean news); the prompt nudges it to
                # prefer the actual keyword.  (Does not force a language.)
                _cap = _capture_enabled()
                _create_kwargs = dict(
                    model=stt_model,
                    file=buf,
                    prompt="Merlin. מרלין. Hey Merlin.",
                    # Force Hebrew so Whisper stops guessing wrong languages on
                    # low-SNR input (was hallucinating Thai/Korean/English stock
                    # phrases).  temperature=0 makes decoding deterministic and
                    # curbs the repetition hallucination ("פיל פיל פיל…").
                    language="he",
                    temperature=0,
                )
                # Capture mode ONLY: ask for a structured body so the probe can record
                # the detected language.  Off by default → the call is byte-for-byte
                # the production call.
                #
                # This must NOT be "verbose_json": gpt-4o-transcribe rejects it with
                # HTTP 400, and because capture mode was left enabled via `launchctl
                # setenv MERLIN_CAPTURE_WAV 1`, every wake attempt 400'd until the
                # backstop shut the keyword path down.  "json" still yields .text.
                if _cap:
                    _create_kwargs["response_format"] = "json"
                result = client.audio.transcriptions.create(**_create_kwargs)
                text   = (getattr(result, "text", None) or "").lower()
                logger.info("WAKE_TRANSCRIPT=%r  speech_duration=%.2fs", text, duration_s)

                wake_match = any(kw in text for kw in self._keywords)
                logger.info("WAKE_MATCH=%s  keywords=%s", wake_match, self._keywords)

                if wake_match:
                    logger.info("keyword detected — waking Merlin")
                    if self._source_box is not None:
                        self._source_box[0] = "keyword"
                    self._trigger.set()

                # Instrumentation probe (E2) — saves the exact Whisper-bound buffer
                # + metadata.  No-op unless MERLIN_CAPTURE_WAV=1.
                if _cap:
                    try:
                        _save_capture(audio, WHISPER_SR, wake_match, result)
                    except Exception as _cap_err:
                        logger.warning("capture probe failed: %s", _cap_err)
                consecutive_errors = 0
                backoff_step = 0
            except Exception:
                consecutive_errors += 1
                logger.warning(
                    "keyword inference error (%d/%d consecutive)",
                    consecutive_errors, _MAX_CONSECUTIVE_INFERENCE_ERRORS,
                    exc_info=True,
                )
                if consecutive_errors >= _MAX_CONSECUTIVE_INFERENCE_ERRORS:
                    # Back off instead of exiting.  Exiting left keyword wake dead
                    # until a manual restart; sleeping stops the log flooding while
                    # keeping the path recoverable on its own.
                    pause_s = _INFERENCE_BACKOFF_S[
                        min(backoff_step, len(_INFERENCE_BACKOFF_S) - 1)
                    ]
                    logger.error(
                        "Pausing keyword inference for %ds after %d consecutive errors "
                        "(stops per-frame log flooding). Double-clap wake remains active; "
                        "keyword wake retries automatically.",
                        pause_s, consecutive_errors,
                    )
                    time.sleep(pause_s)
                    # Drop the audio that piled up while paused — it is stale, and
                    # replaying it would just reproduce the same burst of failures.
                    dropped = 0
                    while True:
                        try:
                            self._inq.get_nowait()
                            dropped += 1
                        except queue.Empty:
                            break
                    logger.info(
                        "Resuming keyword inference (dropped %d stale utterance(s))",
                        dropped,
                    )
                    consecutive_errors = 0
                    backoff_step += 1


def _mic_sanity_check() -> None:
    """
    Minimal mic test — identical to the standalone script that is known to work.
    No VAD, no queue, no Whisper, no resampling, no threading, no event logic.
    """
    import os
    import sys
    import threading

    logger.info("[sanity] === execution environment ===")
    logger.info("[sanity] pid          = %d", os.getpid())
    logger.info("[sanity] uid          = %d", os.getuid())
    logger.info("[sanity] sys.executable = %s", sys.executable)
    logger.info("[sanity] cwd          = %s", os.getcwd())
    logger.info("[sanity] sounddevice  = %s", sd.__version__)
    logger.info("[sanity] portaudio    = %s", sd.get_portaudio_version())
    logger.info("[sanity] callback thread = %s", threading.current_thread().name)

    # Log a curated subset of env vars relevant to audio / macOS / process context
    audio_keys = {
        "HOME", "USER", "LOGNAME", "SHELL",
        "PATH", "DYLD_LIBRARY_PATH", "DYLD_FALLBACK_LIBRARY_PATH",
        "PA_RECOMMENDED_OUTPUT_DEVICE",          # PortAudio override
        "AUDIODEV", "SDL_AUDIODRIVER",           # SDL / ALSA overrides
        "APPLE_SECURITY_CHECK_POLICY",           # macOS TCC
        "XPC_SERVICE_NAME", "XPC_FLAGS",         # LaunchAgent markers
        "LAUNCHD_SOCKET",                        # set only under launchd
        "TERM", "TERM_PROGRAM",                  # interactive terminal markers
        "SUDO_USER",
    }
    env = os.environ
    for key in sorted(audio_keys):
        logger.info("[sanity] env %-36s = %s", key, env.get(key, "<unset>"))

    logger.info("[sanity] === starting mic sanity check ===")

    _sc_first = [True]

    def _cb(indata, frames, t, status):
        if _sc_first[0]:
            _sc_first[0] = False
            ch_rms = np.sqrt(np.mean(indata ** 2, axis=0))
            active = int(np.argmax(ch_rms))
            logger.info(
                "[sanity] first_frame  active_ch=%d  ch_rms=[%s]",
                active,
                "  ".join(f"{i}:{v:.4f}" for i, v in enumerate(ch_rms)),
            )
        logger.info("[sanity] max=%.6f", float(np.max(np.abs(indata))))

    with sd.InputStream(callback=_cb):
        logger.info("[sanity] stream open — sd.sleep(10 000 ms)")
        sd.sleep(10_000)

    logger.info("[sanity] === mic sanity check done ===")


class WakeTrigger:
    """
    Async wake trigger combining 'Hi Merlin' keyword and double-clap detection.

    Both detectors share one microphone stream. Whichever fires first wakes Merlin.
    The stream is closed between activations to minimise CPU and battery usage.

    The InputStream is opened at the device's native sample rate (not hardcoded to
    16 kHz) so that devices like the RME Babyface — which only support 44.1/48/96 kHz
    — actually deliver audio.  KeywordBuffer resamples to 16 kHz before Whisper.
    """

    def __init__(self, openai_api_key: str = "", keyword: str = "merlin",
                 *, external_trigger: threading.Event | None = None):
        self._keyword = keyword
        self._sanity_done = False   # run _mic_sanity_check only on first wake
        # Control Panel "START LISTENING": if given, THIS event is used as the
        # wake signal instead of a fresh local one, so an external .set() call
        # satisfies the exact same event.wait() a real keyword/clap detection
        # would — the InputStream still closes via the same `with` block, no
        # second stream is ever opened, nothing is left dangling. None (the
        # default) is byte-identical to the pre-Control-Panel behavior.
        self._external_trigger = external_trigger

        # Validate the key ONCE at startup.  If it is missing/corrupted/masked we
        # disable the keyword path entirely (self._api_key = "") so the OpenAI
        # inference thread never starts — this is what prevents the per-frame
        # UnicodeEncodeError flood.  Double-clap wake is unaffected either way.
        ok, reason = validate_openai_api_key(openai_api_key)
        self._key_valid = ok
        self._key_error = reason
        self._api_key = openai_api_key if ok else ""

        if ok:
            logger.info("OPENAI_API_KEY validated — keyword + double-clap wake enabled")
        elif openai_api_key:
            logger.error(
                "OPENAI_API_KEY invalid — keyword wake DISABLED: %s. "
                "Double-clap wake remains active. Fix the key in .env and restart.",
                reason,
            )
        else:
            logger.warning(
                "OPENAI_API_KEY not set — keyword wake disabled, double-clap only.",
            )

        print(
            f"[WakeTrigger] __init__ id={id(self)}  sanity_done=False"
            f"  keyword_wake={'enabled' if ok else 'disabled'}",
            flush=True,
        )

    async def wait(self) -> tuple[list[np.ndarray], str]:
        """Block until a keyword or double clap is detected.

        Returns (pending_chunks, source) where source is "keyword" or "clap"
        — the Day Opening double-clap trigger (Control Panel) needs to know
        which detector fired, since both share the same underlying event.
        pending_chunks: any audio chunks buffered after the keyword utterance
        ended (accumulated during Whisper's network latency). These are the
        most likely start of the user's command and should be passed to
        record_utterance() as a prefill so they are not silently dropped.
        """
        loop = asyncio.get_running_loop()
        # Run the blocking mic-listen in a thread-pool thread so the asyncio
        # event loop stays idle (releasing the GIL) and PortAudio's C callback
        # thread can acquire it without contention.
        return await loop.run_in_executor(None, self._wait_blocking)

    def _wait_blocking(self) -> tuple[list[np.ndarray], str]:
        """Open the mic stream and block until a wake event fires.

        Returns (pending_chunks, source) — see wait()'s docstring.
        """
        import os
        import sys
        _mod = sys.modules.get(__name__)
        logger.info(
            "[wake] IDENTITY  pid=%d  __file__=%s  realpath=%s"
            "  cwd=%s  module_file=%s",
            os.getpid(),
            __file__,
            os.path.realpath(__file__),
            os.getcwd(),
            getattr(_mod, "__file__", "NOT IN sys.modules"),
        )

        _mod2 = sys.modules.get(__name__)
        logger.info(
            "=== _wait_blocking enter === module=%s  __file__=%s  id(module)=%d",
            __name__,
            getattr(_mod2, "__file__", "NOT IN sys.modules"),
            id(_mod2) if _mod2 else -1,
        )

        # 2026-08-17 21:09 CRASH-LOOP FIX: this diagnostic block RAISED while
        # logging the DeviceList repr once the default input became the
        # iPhone Continuity mic (bidi/format chars in the Hebrew device
        # name) — killing the whole wake loop in an endless retry backoff.
        # Diagnostics must never be fatal.
        try:
            logger.info("sd.query_devices():\n%s", str(sd.query_devices()).replace("%", "%%"))
            logger.info("sd.default.device    = %s", str(sd.default.device))
            logger.info("sd.default.channels  = %s", str(sd.default.channels))
            logger.info("sd.default.samplerate= %s", str(sd.default.samplerate))
        except Exception:
            logger.info("device diagnostics unavailable (formatting)")

        event      = self._external_trigger if self._external_trigger is not None else threading.Event()
        event.clear()   # in case a stale .set() from a previous cycle (or a pre-emptive manual trigger) lingers
        # RUNTIME TRUTH (2026-08-17): the default label is the path that
        # never overwrites it — the EXTERNAL/manual trigger (panel Wake /
        # SEND AS USER). It used to default to "keyword", so every manual
        # wake was logged as source=keyword while the keyword detector was
        # UNAVAILABLE — a direct status/timeline contradiction. The real
        # detectors overwrite this explicitly ("keyword" / "clap").
        source_box = ["manual"]
        clap       = ClapDetector(on_double_clap=event, source_box=source_box)
        kw_box     = [None]   # filled after stream opens so we have the real sr

        _WAKE_CH    = 1        # Babyface channel index that carries the mic signal
                               # (clamped below for mono/low-channel devices — 2026-08-17)
        _sr_box     = [0]      # filled once stream opens; needed for WAV save
        _wake_buf   = []       # rolling channel-1 PCM frames (capped at 2 s)
        _wake_total = [0]      # total samples currently in _wake_buf
        _cb_count   = [0]
        _cb_logged  = [False]  # True after one-time startup log

        def _callback(indata: np.ndarray, frames: int, time_info, status) -> None:
            try:
                if status:
                    logger.warning("InputStream status: %s", status)

                _cb_count[0] += 1
                now = time.monotonic()

                # Promote 1-D mono to 2-D so channel indexing is uniform
                indata_2d = indata[:, np.newaxis] if indata.ndim == 1 else indata

                # Extract the designated wake channel (hardcoded; not argmax)
                _ch = min(_WAKE_CH, indata_2d.shape[1] - 1)
                pcm = indata_2d[:, _ch].astype(np.float32)
                rms = float(np.sqrt(np.mean(pcm ** 2)))
                peak = float(np.max(np.abs(pcm))) if pcm.size else 0.0

                # One-time startup log: dtype, shape, raw signal range
                if not _cb_logged[0]:
                    _cb_logged[0] = True
                    logger.info(
                        "[wake] startup: dtype=%s  shape=%s  wake_ch=%d"
                        "  raw_min=%.6f  raw_max=%.6f",
                        indata.dtype, indata.shape, _WAKE_CH,
                        float(indata.min()), float(np.abs(indata).max()),
                    )

                # Rolling 2-second WAV capture written every ~50 frames (≈ 3.5 s)
                sr = _sr_box[0]
                if sr > 0:
                    _wake_buf.append(pcm)
                    _wake_total[0] += len(pcm)
                    target = 2 * sr
                    while _wake_total[0] > target and len(_wake_buf) > 1:
                        _wake_total[0] -= len(_wake_buf[0])
                        _wake_buf.pop(0)
                    if _cb_count[0] % 50 == 0 and _wake_total[0] > 0:
                        try:
                            snap = np.concatenate(_wake_buf)
                            wavfile.write("/tmp/merlin_wake_input.wav", sr, snap)
                            logger.info(
                                "[wake] wrote /tmp/merlin_wake_input.wav"
                                "  samples=%d  sr=%d  duration=%.2fs"
                                "  rms=%.6f  peak=%.6f",
                                len(snap), sr, len(snap) / sr,
                                float(np.sqrt(np.mean(snap ** 2))),
                                float(np.abs(snap).max()),
                            )
                        except Exception as _wav_err:
                            logger.warning("[wake] wavfile.write failed: %s", _wav_err)

                clap.feed(rms, peak, now)
                kw = kw_box[0]
                if kw:
                    kw.feed(pcm, rms)
            except Exception:
                logger.exception("exception inside _callback (frame #%d)", _cb_count[0])

        logger.info(
            "=== opening InputStream (device=None samplerate=None channels=None) === id(callback)=%d",
            id(_callback),
        )
        with sd.InputStream(
            device=None,
            samplerate=None,
            channels=None,
            dtype=np.float32,
            callback=_callback,
        ) as stream:
            actual_sr     = int(stream.samplerate)
            _sr_box[0]    = actual_sr   # unblock WAV capture in callback
            # ── device latency info ──────────────────────────────────────────
            try:
                dev_info = sd.query_devices(stream.device[0], kind="input")
                logger.info(
                    "=== InputStream open === device=%r sr=%d channels=%d blocksize=%d"
                    "  dtype=%s  latency=%.4fs  dev_low_lat=%.4fs  dev_high_lat=%.4fs",
                    stream.device, actual_sr, stream.channels, stream.blocksize,
                    stream.dtype,
                    stream.latency,
                    dev_info.get("default_low_input_latency", float("nan")),
                    dev_info.get("default_high_input_latency", float("nan")),
                )
            except Exception as _e:
                logger.info(
                    "=== InputStream open === device=%r sr=%d channels=%d blocksize=%d (latency query failed: %s)",
                    stream.device, actual_sr, stream.channels, stream.blocksize, _e,
                )

            # Build the wake keyword spotter now that we know the real sample
            # rate. PRODUCTION wake = on-device Porcupine (replaces cloud STT).
            # If its config is missing we fail CLEARLY and never fall back to
            # cloud Whisper — double-clap stays active on its own path.
            # Backend priority: openWakeWord (key-free, chosen 2026-08-09) if a
            # custom model is present, else Porcupine if its key+ppn are present,
            # else double-clap only. Never a cloud-Whisper fallback.
            _oww_ok = bool(MERLIN_OWW_MODEL_PATH) and os.path.exists(MERLIN_OWW_MODEL_PATH)
            _kw_ok = bool(PORCUPINE_ACCESS_KEY) and bool(PORCUPINE_KEYWORD_PATH) and os.path.exists(PORCUPINE_KEYWORD_PATH)
            if _oww_ok:
                try:
                    _det = OpenWakeWordDetector(MERLIN_OWW_MODEL_PATH, mic_sr=actual_sr,
                                                threshold=MERLIN_OWW_THRESHOLD)
                    kw_box[0] = KeywordBuffer(
                        event, "", self._keyword, mic_sr=actual_sr,
                        source_box=source_box, porcupine=_det,
                    )
                    logger.info(
                        "WAKE_BACKEND=openwakeword WAKE_KEYWORD=Merlin WAKE_LOCAL=true "
                        "mic_sr=%d target_sr=%d frame_len=%d threshold=%.2f model=%s",
                        actual_sr, _det.target_sr, _det.frame_len, MERLIN_OWW_THRESHOLD, MERLIN_OWW_MODEL_PATH,
                    )
                    logger.info("Wake modes: keyword(openWakeWord on-device) + double-clap (mic_sr=%d)", actual_sr)
                except Exception as exc:
                    logger.error("OWW_INIT_FAILED %s — keyword wake DISABLED (double-clap only). "
                                 "NOT falling back to cloud Whisper.", exc)
                    kw_box[0] = None
            elif _kw_ok:
                try:
                    _pp = PorcupineDetector(PORCUPINE_ACCESS_KEY, PORCUPINE_KEYWORD_PATH, mic_sr=actual_sr)
                    kw_box[0] = KeywordBuffer(
                        event, "", self._keyword, mic_sr=actual_sr,
                        source_box=source_box, porcupine=_pp,
                    )
                    logger.info(
                        "WAKE_BACKEND=porcupine WAKE_KEYWORD=Merlin WAKE_LOCAL=true "
                        "mic_sr=%d target_sr=%d frame_len=%d keyword_path=%s",
                        actual_sr, _pp.target_sr, _pp.frame_len, PORCUPINE_KEYWORD_PATH,
                    )
                    logger.info("Wake modes: keyword(Porcupine on-device) + double-clap (mic_sr=%d)", actual_sr)
                except Exception as exc:
                    logger.error("PORCUPINE_INIT_FAILED %s — keyword wake DISABLED (double-clap only). "
                                 "NOT falling back to cloud Whisper.", exc)
                    kw_box[0] = None
            else:
                logger.error(
                    "WAKE_KEYWORD_CONFIG_MISSING oww_model=%r porcupine_key_set=%s porcupine_ppn=%r — "
                    "keyword wake DISABLED (double-clap still active). NOT falling back to cloud Whisper.",
                    MERLIN_OWW_MODEL_PATH or "(unset)", bool(PORCUPINE_ACCESS_KEY),
                    PORCUPINE_KEYWORD_PATH or "(unset)",
                )
                kw_box[0] = None

            logger.info("=== calling event.wait() — stream is live ===")
            event.wait()
            logger.info("=== event.wait() returned — wake fired ===")

        # InputStream is now CLOSED — PortAudio has joined the callback thread,
        # so _chunks and _in_speech are stable.  Drain here to avoid any race
        # with the callback that existed when drain was inside the with-block.
        pending: list[np.ndarray] = []
        if kw_box[0] is not None:
            pending = kw_box[0].drain_pending()

        logger.info(
            "=== _wait_blocking RETURN === pending_chunks=%d  total_pending_samples=%d  source=%s",
            len(pending),
            sum(len(c) for c in pending),
            source_box[0],
        )
        return pending, source_box[0]
