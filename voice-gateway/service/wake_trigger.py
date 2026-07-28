"""Wake trigger — double clap detection.

Monitors the microphone continuously in a low-CPU mode.
Detects two rapid energy bursts (claps) within a configurable window
and signals the asyncio event loop via a thread-safe mechanism.

"Hi Merlin" keyword detection can be layered in later via Porcupine.
"""

import asyncio
import logging
import threading
import time

import numpy as np
import sounddevice as sd

logger = logging.getLogger(__name__)

# ── Tunable parameters (all in seconds unless stated) ─────────────────────────
SAMPLE_RATE    = 16_000
CHUNK_MS       = 20
CHUNK_SIZE     = int(SAMPLE_RATE * CHUNK_MS / 1000)     # 320 samples

CLAP_THRESHOLD = 0.10    # normalized RMS (0-1) to classify as a clap burst
CLAP_MAX_S     = 0.25    # a burst longer than 250ms is speech, not a clap
CLAP_GAP_MIN_S = 0.05    # gap between two claps must be at least 50ms
DOUBLE_CLAP_WINDOW_S = 1.0   # two claps must land within 1 second


class ClapDetector:
    """Stateful per-frame clap detector. Feed RMS values; it emits clap events."""

    def __init__(self, on_double_clap: "threading.Event"):
        self._trigger = on_double_clap
        self._in_burst = False
        self._burst_start = 0.0
        self._last_clap_end = 0.0
        self._clap_times: list[float] = []

    def feed(self, rms: float, now: float) -> None:
        if rms > CLAP_THRESHOLD:
            if not self._in_burst:
                self._in_burst = True
                self._burst_start = now
        else:
            if self._in_burst:
                self._in_burst = False
                burst_duration = now - self._burst_start
                gap_since_last = now - self._last_clap_end

                if burst_duration <= CLAP_MAX_S and gap_since_last >= CLAP_GAP_MIN_S:
                    self._last_clap_end = now
                    self._record_clap(now)

    def _record_clap(self, now: float) -> None:
        window = DOUBLE_CLAP_WINDOW_S
        self._clap_times = [t for t in self._clap_times if now - t <= window]
        self._clap_times.append(now)
        logger.debug("clap detected — total in window: %d", len(self._clap_times))
        if len(self._clap_times) >= 2:
            self._clap_times.clear()
            logger.info("double-clap wake trigger fired")
            self._trigger.set()


class WakeTrigger:
    """
    Async-friendly double-clap detector.

    Usage:
        trigger = WakeTrigger()
        await trigger.wait()   # blocks until double clap

    The microphone stream is closed between calls to save battery.
    """

    async def wait(self) -> None:
        """Block the asyncio event loop until a double clap is detected."""
        loop = asyncio.get_running_loop()
        done = loop.create_future()
        thread_event = threading.Event()

        detector = ClapDetector(on_double_clap=thread_event)

        def _audio_callback(indata: np.ndarray, frames: int, time_info, status) -> None:
            if status:
                pass  # ignore overflow/underflow in low-CPU mode
            pcm = indata[:, 0].astype(np.float32)
            rms = float(np.sqrt(np.mean(pcm ** 2)))
            detector.feed(rms, time.monotonic())

        def _watcher() -> None:
            thread_event.wait()
            loop.call_soon_threadsafe(done.set_result, None)

        watcher = threading.Thread(target=_watcher, daemon=True)
        watcher.start()

        # sounddevice InputStream is opened fresh each call so it's easy to
        # stop (context manager exit) and avoids holding the mic while Merlin speaks.
        with sd.InputStream(
            samplerate=SAMPLE_RATE,
            channels=1,
            dtype=np.float32,
            blocksize=CHUNK_SIZE,
            callback=_audio_callback,
        ):
            await done
