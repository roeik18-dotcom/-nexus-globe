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
VAD_THRESHOLD  = 0.008    # RMS above this = speech (tuned for RME Babyface ~0.010 peak)
SPEECH_MIN_S   = 0.3      # minimum speech length before transcribing
SILENCE_END_S  = 0.6      # silence this long ends the utterance
MAX_BUFFER_S   = 4.0      # hard cap: transcribe even if silence never arrives

# ── Telemetry ─────────────────────────────────────────────────────────────────
_LOG_INTERVAL_FRAMES = 250   # heartbeat log every ~5 s (250 × 20 ms blocks)


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
        self._keyword  = keyword.lower()
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

    def feed(self, pcm: np.ndarray, rms: float) -> None:
        now = time.monotonic()

        # heartbeat
        self._frame_count += 1
        if rms > self._peak_rms:
            self._peak_rms = rms
        if self._frame_count % _LOG_INTERVAL_FRAMES == 0:
            # [POINT 4] rms is the value passed in from _callback — log it alongside peak
            logger.info(
                "VAD heartbeat — peak_rms=%.4f  last_rms=%.4f  threshold=%.4f  in_speech=%s  queue=%d",
                self._peak_rms, rms, VAD_THRESHOLD, self._in_speech, self._inq.qsize(),
            )
            self._peak_rms = 0.0

        if rms >= VAD_THRESHOLD:
            if not self._in_speech:
                self._in_speech    = True
                self._speech_start = now
                self._chunks       = []
                logger.info("VAD on  — rms=%.4f", rms)
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
        if self._mic_sr != WHISPER_SR:
            g     = gcd(self._mic_sr, WHISPER_SR)
            audio = resample_poly(audio, WHISPER_SR // g, self._mic_sr // g).astype(np.float32)

        # [POINT 2] max of the audio array immediately before queue.put
        logger.info(
            "[pt2-flush] %.2fs  max_before_put=%.5f  (mic_sr=%d→whisper_sr=%d)  queue_depth=%d",
            duration_s, float(np.max(np.abs(audio))),
            self._mic_sr, WHISPER_SR, self._inq.qsize() + 1,
        )
        self._inq.put(audio)

    # ── inference thread ──────────────────────────────────────────────────────

    def _inference_loop(self) -> None:
        try:
            import openai
            client = openai.OpenAI(api_key=self._api_key)
            logger.info(
                "Keyword inference thread ready (model=whisper-1, keyword=%r, mic_sr=%d→%d)",
                self._keyword, self._mic_sr, WHISPER_SR,
            )
        except Exception:
            logger.error(
                "Keyword inference thread failed to start — keyword detection disabled",
                exc_info=True,
            )
            return

        while True:
            audio = self._inq.get()   # already a single resampled np.ndarray
            try:
                # [POINT 3] max immediately after queue.get
                rms_after = float(np.sqrt(np.mean(audio ** 2)))
                logger.info(
                    "[pt3-infer] max_after_get=%.5f  rms_after_get=%.5f  samples=%d",
                    float(np.max(np.abs(audio))), rms_after, len(audio),
                )

                duration_s = len(audio) / WHISPER_SR
                buf        = io.BytesIO()
                wavfile.write(buf, WHISPER_SR, audio)
                buf.seek(0)
                buf.name = "audio.wav"

                logger.info("Whisper ← %.2fs audio (samples=%d)", duration_s, len(audio))
                result = client.audio.transcriptions.create(model="whisper-1", file=buf)
                text   = result.text.lower()
                logger.info("keyword scan: %r", text)

                if self._keyword in text:
                    logger.info("'%s' detected — waking Merlin", self._keyword)
                    self._trigger.set()
            except Exception:
                logger.warning("keyword inference error", exc_info=True)


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

    def _cb(indata, frames, t, status):
        logger.info("[sanity] max=%.6f", np.max(np.abs(indata)))

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
        self._api_key = openai_api_key
        self._keyword = keyword

    async def wait(self) -> None:
        """Block until a keyword or double clap is detected."""
        loop = asyncio.get_running_loop()
        # Run the blocking mic-listen in a thread-pool thread so the asyncio
        # event loop stays idle (releasing the GIL) and PortAudio's C callback
        # thread can acquire it without contention.
        await loop.run_in_executor(None, self._wait_blocking)

    def _wait_blocking(self) -> None:
        """Open the mic stream and block until a wake event fires."""
        _mic_sanity_check()

        import sys
        _mod = sys.modules.get(__name__)
        logger.info(
            "=== _wait_blocking enter === module=%s  __file__=%s  id(module)=%d",
            __name__,
            getattr(_mod, "__file__", "NOT IN sys.modules"),
            id(_mod) if _mod else -1,
        )

        logger.info("sd.query_devices():\n%s", sd.query_devices())
        logger.info("sd.default.device    = %s", sd.default.device)
        logger.info("sd.default.channels  = %s", sd.default.channels)
        logger.info("sd.default.samplerate= %s", sd.default.samplerate)

        event    = threading.Event()
        clap     = ClapDetector(on_double_clap=event)
        kw_box   = [None]   # filled after stream opens so we have the real sr

        _cb_count    = [0]
        _cb_last_log = [0.0]

        def _callback(indata: np.ndarray, frames: int, time_info, status) -> None:
            try:
                if status:
                    logger.warning("InputStream status: %s", status)

                _cb_count[0] += 1
                now = time.monotonic()

                if _cb_count[0] == 1 or now - _cb_last_log[0] >= 1.0:
                    _cb_last_log[0] = now
                    # [POINT 1] all-channel max vs channel-0 max
                    logger.info(
                        "[pt1-cb] #%d shape=%s  indata_max=%.5f  ch0_max=%.5f",
                        _cb_count[0], indata.shape,
                        float(np.abs(indata).max()),
                        float(np.abs(indata[:, 0]).max()),
                    )

                pcm = indata[:, 0].astype(np.float32)
                rms = float(np.sqrt(np.mean(pcm ** 2)))
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
            actual_sr = int(stream.samplerate)
            logger.info(
                "=== InputStream open === device=%r sr=%d channels=%d blocksize=%d active=%s",
                stream.device, actual_sr, stream.channels, stream.blocksize, stream.active,
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

        logger.info("=== InputStream closed — _wait_blocking returning ===")
