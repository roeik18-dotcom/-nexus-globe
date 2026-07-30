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
import logging
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
CLAP_THRESHOLD       = 0.10
CLAP_MAX_S           = 0.25
CLAP_GAP_MIN_S       = 0.05
DOUBLE_CLAP_WINDOW_S = 1.0

# ── Keyword parameters ────────────────────────────────────────────────────────
from service.vad_config import SPEECH_RMS_THRESHOLD as VAD_THRESHOLD  # shared with merlin_service
print(f"[wake_trigger] VAD_THRESHOLD={VAD_THRESHOLD:.5f} loaded from service.vad_config", flush=True)
SPEECH_MIN_S   = 0.3      # minimum speech length before transcribing
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
# Max consecutive inference failures before the keyword path disables itself as a
# runtime backstop (validation should catch bad keys first; this guards the case
# where a key passes validation but the API path keeps failing).
_MAX_CONSECUTIVE_INFERENCE_ERRORS = 3


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

    def __init__(self, on_double_clap: threading.Event):
        self._trigger       = on_double_clap
        self._in_burst      = False
        self._burst_start   = 0.0
        self._last_clap_end = 0.0
        self._clap_times: list[float] = []

    def feed(self, rms: float, now: float) -> None:
        if rms > CLAP_THRESHOLD:
            if not self._in_burst:
                self._in_burst    = True
                self._burst_start = now
        else:
            if self._in_burst:
                self._in_burst = False
                burst_dur      = now - self._burst_start
                gap_since_last = now - self._last_clap_end
                if burst_dur <= CLAP_MAX_S and gap_since_last >= CLAP_GAP_MIN_S:
                    self._last_clap_end = now
                    self._record_clap(now)

    def _record_clap(self, now: float) -> None:
        self._clap_times = [t for t in self._clap_times if now - t <= DOUBLE_CLAP_WINDOW_S]
        self._clap_times.append(now)
        logger.debug("clap — total in window: %d", len(self._clap_times))
        if len(self._clap_times) >= 2:
            self._clap_times.clear()
            logger.info("double-clap wake trigger fired")
            self._trigger.set()


class KeywordBuffer:
    """
    VAD-gated Whisper keyword spotter.

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
    ):
        self._trigger  = trigger
        self._api_key  = openai_api_key
        # Match both the English keyword and its Hebrew transliteration so
        # Whisper transcribing Hebrew speech ("מרלין") also fires the trigger.
        self._keywords = frozenset({keyword.lower(), "מרלין"})
        self._mic_sr   = mic_sr

        self._chunks: list[np.ndarray] = []
        self._in_speech   = False
        self._speech_start = 0.0
        self._last_speech  = 0.0

        self._inq: queue.Queue = queue.Queue()

        # telemetry
        self._frame_count = 0
        self._peak_rms    = 0.0

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
        chunks, self._chunks = self._chunks, []
        had_speech, self._in_speech = self._in_speech, False
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
                logger.info(
                    "VAD on  — rms=%.4f  wake_vad_threshold=%.4f  speech_start=%.3f",
                    rms, VAD_THRESHOLD, self._speech_start,
                )
            self._chunks.append(pcm.copy())
            self._last_speech = now
        else:
            if self._in_speech:
                self._chunks.append(pcm.copy())
                silence_so_far = now - self._last_speech
                total_s        = now - self._speech_start

                if silence_so_far >= SILENCE_END_S:
                    speech_s = self._last_speech - self._speech_start
                    if speech_s >= SPEECH_MIN_S:
                        self._flush()
                    else:
                        logger.info(
                            "VAD off — too short (%.2fs < %.2fs), discarded",
                            speech_s, SPEECH_MIN_S,
                        )
                        self._in_speech = False
                        self._chunks    = []
                elif total_s >= MAX_BUFFER_S:
                    self._flush()

    def _flush(self) -> None:
        self._in_speech = False
        chunks, self._chunks = self._chunks, []
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

        logger.info(
            "VAD flush — speech_duration=%.2fs"
            "  rms_before_resample=%.5f  max_before=%.5f"
            "  rms_after_resample=%.5f  max_after=%.5f"
            "  (mic_sr=%d→%d)  audio_dtype=%s  samples=%d",
            duration_s,
            rms_before, max_before,
            rms_after, max_after,
            self._mic_sr, WHISPER_SR, audio.dtype, len(audio),
        )
        self._inq.put(audio)
        logger.info("ENQUEUE — queue_depth=%d  samples=%d", self._inq.qsize(), len(audio))

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
            client = openai.OpenAI(api_key=self._api_key)
            logger.info(
                "Keyword inference thread ready (model=whisper-1, keywords=%s, mic_sr=%d→%d)",
                self._keywords, self._mic_sr, WHISPER_SR,
            )
        except Exception:
            logger.error(
                "Keyword inference thread failed to start — keyword detection disabled",
                exc_info=True,
            )
            return

        consecutive_errors = 0
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
                result = client.audio.transcriptions.create(model="whisper-1", file=buf)
                text   = result.text.lower()
                logger.info("WAKE_TRANSCRIPT=%r  speech_duration=%.2fs", text, duration_s)

                wake_match = any(kw in text for kw in self._keywords)
                logger.info("WAKE_MATCH=%s  keywords=%s", wake_match, self._keywords)

                if wake_match:
                    logger.info("keyword detected — waking Merlin")
                    self._trigger.set()
                consecutive_errors = 0
            except Exception:
                consecutive_errors += 1
                logger.warning(
                    "keyword inference error (%d/%d consecutive)",
                    consecutive_errors, _MAX_CONSECUTIVE_INFERENCE_ERRORS,
                    exc_info=True,
                )
                if consecutive_errors >= _MAX_CONSECUTIVE_INFERENCE_ERRORS:
                    logger.error(
                        "Disabling keyword inference after %d consecutive errors "
                        "to stop per-frame log flooding. Double-clap wake remains active.",
                        consecutive_errors,
                    )
                    return


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

    def __init__(self, openai_api_key: str = "", keyword: str = "merlin"):
        self._keyword = keyword
        self._sanity_done = False   # run _mic_sanity_check only on first wake

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

    async def wait(self) -> list[np.ndarray]:
        """Block until a keyword or double clap is detected.

        Returns any audio chunks buffered after the keyword utterance ended
        (accumulated during Whisper's network latency).  These are the most
        likely start of the user's command and should be passed to
        record_utterance() as a prefill so they are not silently dropped.
        """
        loop = asyncio.get_running_loop()
        # Run the blocking mic-listen in a thread-pool thread so the asyncio
        # event loop stays idle (releasing the GIL) and PortAudio's C callback
        # thread can acquire it without contention.
        return await loop.run_in_executor(None, self._wait_blocking)

    def _wait_blocking(self) -> list[np.ndarray]:
        """Open the mic stream and block until a wake event fires.

        Returns any post-keyword audio chunks (see drain_pending).
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

        logger.info("sd.query_devices():\n%s", sd.query_devices())
        logger.info("sd.default.device    = %s", sd.default.device)
        logger.info("sd.default.channels  = %s", sd.default.channels)
        logger.info("sd.default.samplerate= %s", sd.default.samplerate)

        event    = threading.Event()
        clap     = ClapDetector(on_double_clap=event)
        kw_box   = [None]   # filled after stream opens so we have the real sr

        _WAKE_CH    = 1        # Babyface channel index that carries the mic signal
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
                pcm = indata_2d[:, _WAKE_CH].astype(np.float32)
                rms = float(np.sqrt(np.mean(pcm ** 2)))

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

                clap.feed(rms, now)
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

            # Build KeywordBuffer now that we know the real sample rate
            if self._api_key:
                kw_box[0] = KeywordBuffer(
                    event, self._api_key, self._keyword, mic_sr=actual_sr,
                )
                logger.info(
                    "Wake modes: keyword('%s') + double-clap (mic_sr=%d)",
                    self._keyword, actual_sr,
                )
            else:
                logger.info("Wake mode: double-clap only (no OpenAI key, mic_sr=%d)", actual_sr)

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
            "=== _wait_blocking RETURN === pending_chunks=%d  total_pending_samples=%d",
            len(pending),
            sum(len(c) for c in pending),
        )
        return pending
