"""Wake trigger — 'Hi Merlin' keyword and double-clap detection.

Both detectors share one microphone stream and race to fire.
Keyword detection is active when an OpenAI API key is provided (uses Whisper).
Double clap is always active as a fallback.
"""

import asyncio
import io
import logging
import queue
import threading
import time

import numpy as np
import sounddevice as sd
from scipy.io import wavfile

logger = logging.getLogger(__name__)

SAMPLE_RATE = 16_000
CHUNK_MS    = 20
CHUNK_SIZE  = int(SAMPLE_RATE * CHUNK_MS / 1000)   # 320 samples

# ── Clap parameters ───────────────────────────────────────────────────────────
CLAP_THRESHOLD       = 0.10
CLAP_MAX_S           = 0.25
CLAP_GAP_MIN_S       = 0.05
DOUBLE_CLAP_WINDOW_S = 1.0

# ── Keyword parameters ────────────────────────────────────────────────────────
VAD_THRESHOLD  = 0.015    # RMS above this = speech
SPEECH_MIN_S   = 0.3      # minimum speech length before transcribing
SILENCE_END_S  = 0.6      # silence this long ends the utterance
MAX_BUFFER_S   = 4.0      # hard limit: transcribe even if no trailing silence


class ClapDetector:
    """Stateful per-frame clap detector. Feed RMS values; fires on double clap."""

    def __init__(self, on_double_clap: threading.Event):
        self._trigger    = on_double_clap
        self._in_burst   = False
        self._burst_start = 0.0
        self._last_clap_end = 0.0
        self._clap_times: list[float] = []

    def feed(self, rms: float, now: float) -> None:
        if rms > CLAP_THRESHOLD:
            if not self._in_burst:
                self._in_burst    = True
                self._burst_start = now
        else:
            if self._in_burst:
                self._in_burst    = False
                burst_dur         = now - self._burst_start
                gap_since_last    = now - self._last_clap_end

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

    Accumulates speech from the microphone stream into utterance chunks.
    Sends each utterance to Whisper in a background thread; fires the
    trigger event when the keyword is found in the transcript.
    """

    def __init__(self, trigger: threading.Event, openai_api_key: str, keyword: str = "merlin"):
        self._trigger    = trigger
        self._api_key    = openai_api_key
        self._keyword    = keyword.lower()
        self._chunks: list[np.ndarray] = []
        self._in_speech  = False
        self._speech_start = 0.0
        self._last_speech  = 0.0
        self._inq: queue.Queue = queue.Queue()

        threading.Thread(target=self._inference_loop, daemon=True).start()

    def feed(self, pcm: np.ndarray, rms: float) -> None:
        now = time.monotonic()

        if rms >= VAD_THRESHOLD:
            if not self._in_speech:
                self._in_speech    = True
                self._speech_start = now
                self._chunks       = []
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
                        # Too short to be a real utterance; discard.
                        self._in_speech = False
                        self._chunks    = []
                elif total_s >= MAX_BUFFER_S:
                    self._flush()

    def _flush(self) -> None:
        self._in_speech = False
        chunks, self._chunks = self._chunks, []
        if chunks:
            self._inq.put(chunks)

    def _inference_loop(self) -> None:
        import openai
        client = openai.OpenAI(api_key=self._api_key)

        while True:
            chunks = self._inq.get()
            try:
                audio = np.concatenate(chunks, axis=0)
                buf   = io.BytesIO()
                wavfile.write(buf, SAMPLE_RATE, audio)
                buf.seek(0)
                buf.name = "audio.wav"

                result = client.audio.transcriptions.create(model="whisper-1", file=buf)
                text   = result.text.lower()
                logger.debug("keyword scan: %r", text)

                if self._keyword in text:
                    logger.info("'%s' detected — waking Merlin", self._keyword)
                    self._trigger.set()
            except Exception:
                logger.debug("keyword inference error", exc_info=True)


class WakeTrigger:
    """
    Async wake trigger combining 'Hi Merlin' keyword and double-clap detection.

    Both detectors share one microphone stream. Whichever fires first wakes Merlin.
    The stream is closed between activations to minimize CPU and battery usage.

    Args:
        openai_api_key: When non-empty, enables keyword detection via Whisper.
        keyword: Substring to match in Whisper transcripts (default: 'merlin').
    """

    def __init__(self, openai_api_key: str = "", keyword: str = "merlin"):
        self._api_key = openai_api_key
        self._keyword = keyword

    async def wait(self) -> None:
        """Block until a keyword or double clap is detected."""
        loop  = asyncio.get_running_loop()
        done  = loop.create_future()
        event = threading.Event()

        clap = ClapDetector(on_double_clap=event)
        kw   = (
            KeywordBuffer(event, self._api_key, self._keyword)
            if self._api_key
            else None
        )

        if kw:
            logger.debug("Wake modes: keyword('%s') + double-clap", self._keyword)
        else:
            logger.debug("Wake mode: double-clap only (no OpenAI key)")

        def _callback(indata: np.ndarray, frames: int, time_info, status) -> None:
            pcm = indata[:, 0].astype(np.float32)
            rms = float(np.sqrt(np.mean(pcm ** 2)))
            now = time.monotonic()
            clap.feed(rms, now)
            if kw:
                kw.feed(pcm, rms)

        def _watcher() -> None:
            event.wait()
            loop.call_soon_threadsafe(done.set_result, None)

        threading.Thread(target=_watcher, daemon=True).start()

        with sd.InputStream(
            samplerate=SAMPLE_RATE,
            channels=1,
            dtype=np.float32,
            blocksize=CHUNK_SIZE,
            callback=_callback,
        ):
            await done
