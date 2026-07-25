"""
Voice client with hands-free activation triggers.

State machine:
    MONITORING → ACTIVATED → RECORDING → PROCESSING → SPEAKING → COOLDOWN → MONITORING

Activation modes:
    --activation manual   ENTER to start/stop recording
    --activation clap     Double-clap to activate
    --activation wake     Hebrew wake phrase "ג׳רוויס" (requires openwakeword)
    --activation all      All modes simultaneously (default)

Clap tuning via environment variables:
    CLAP_ENERGY_THRESHOLD   RMS amplitude threshold for a transient  (default 0.05)
    CLAP_RISE_FACTOR        Energy must rise by this factor vs background (default 3.0)
    CLAP_MAX_DURATION_MS    Transients longer than this are rejected as speech (default 180)
    DOUBLE_CLAP_MIN_MS      Minimum gap between two claps (default 250)
    DOUBLE_CLAP_MAX_MS      Maximum gap between two claps (default 1200)
    CLAP_COOLDOWN_S         Seconds before next activation allowed (default 3.0)
    CLAP_SPECTRAL_FLATNESS  Minimum spectral flatness to accept as clap (default 0.35)

Wake word tuning:
    WAKE_OWW_MODEL      openwakeword model name (default hey_jarvis)
    WAKE_OWW_THRESHOLD  Detection confidence threshold (default 0.5)

Audio device:
    AUDIO_DEVICE_PATTERN  Substring to match in sounddevice device names (default "Babyface")
                          Set to "" to use the OS default input device
    AUDIO_DEVICE_CHANNEL  1-indexed channel number on the matched device (default 2)

Usage:
    cd voice-gateway
    python3 client/voice.py [--activation all] [--host 127.0.0.1] [--port 8765]

Install extras:
    pip install sounddevice numpy scipy websockets
    pip install openwakeword   # optional, for wake-word trigger
    python -c "from openwakeword.utils import download_models; download_models()"
"""

import asyncio
import io
import json
import logging
import os
import subprocess
import sys
import tempfile
import threading
import time
from enum import Enum, auto
from pathlib import Path
from typing import Callable

try:
    import numpy as np
    import sounddevice as sd
    import websockets
    from scipy.io import wavfile
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Run: pip install sounddevice numpy scipy websockets")
    sys.exit(1)

log = logging.getLogger("voice")
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)

# Dedicated activation-trace logger.
# Normal mode  : inherits "voice" level (INFO), propagates — quiet.
# --debug-activation : set to DEBUG with its own "[ACT]" handler, propagate=False.
_alog = logging.getLogger("voice.activation")

SAMPLE_RATE       = 16_000
FRAME_MS          = 20
FRAME_SAMPLES     = SAMPLE_RATE * FRAME_MS // 1000  # 320 samples per 20ms frame
MIN_AUDIO_SAMPLES = int(SAMPLE_RATE * 0.15)         # 150ms — STT servers reject clips under ~100ms

# ── Clap detector configuration ───────────────────────────────────────────────
CLAP_ENERGY_THRESHOLD  = float(os.getenv("CLAP_ENERGY_THRESHOLD",  "0.05"))
CLAP_RISE_FACTOR       = float(os.getenv("CLAP_RISE_FACTOR",       "3.0"))
CLAP_MAX_DURATION_MS   = int(os.getenv(  "CLAP_MAX_DURATION_MS",   "180"))
DOUBLE_CLAP_MIN_MS     = int(os.getenv(  "DOUBLE_CLAP_MIN_MS",     "250"))
DOUBLE_CLAP_MAX_MS     = int(os.getenv(  "DOUBLE_CLAP_MAX_MS",     "1200"))
CLAP_COOLDOWN_S        = float(os.getenv("CLAP_COOLDOWN_S",        "3.0"))
CLAP_SPECTRAL_FLATNESS = float(os.getenv("CLAP_SPECTRAL_FLATNESS", "0.35"))
# 80 frames × 20ms = 1.6 s of background learning before transient detection starts
CLAP_WARMUP_FRAMES     = int(os.getenv(  "CLAP_WARMUP_FRAMES",     "80"))

# ── Audio device configuration ────────────────────────────────────────────────
# AUDIO_DEVICE_PATTERN  substring match against sounddevice device names (case-insensitive)
# AUDIO_DEVICE_CHANNEL  1-indexed channel on the matched device (sounddevice mapping convention)
# Set AUDIO_DEVICE_PATTERN="" to skip discovery and use the OS default device.
AUDIO_DEVICE_PATTERN = os.getenv("AUDIO_DEVICE_PATTERN", "Babyface")
AUDIO_DEVICE_CHANNEL = int(os.getenv("AUDIO_DEVICE_CHANNEL", "2"))

# ── Wake word configuration ───────────────────────────────────────────────────
WAKE_PHRASE_HE     = "ג׳רוויס"
WAKE_OWW_MODEL     = os.getenv("WAKE_OWW_MODEL",     "hey_jarvis")
WAKE_OWW_THRESHOLD = float(os.getenv("WAKE_OWW_THRESHOLD", "0.5"))


# ── State machine ─────────────────────────────────────────────────────────────
class State(Enum):
    MONITORING = auto()
    ACTIVATED  = auto()
    RECORDING  = auto()
    PROCESSING = auto()
    SPEAKING   = auto()
    COOLDOWN   = auto()


# ── Audio helpers ─────────────────────────────────────────────────────────────
def _rms(chunk: np.ndarray) -> float:
    """RMS amplitude normalised to [0, 1] for int16 input."""
    f = chunk.astype(np.float32) / 32768.0
    return float(np.sqrt(np.mean(f ** 2)))


def _spectral_flatness(chunk: np.ndarray) -> float:
    """Wiener entropy: 1.0 = white noise (clap-like), 0.0 = tonal (speech/music)."""
    mag = np.abs(np.fft.rfft(chunk.astype(np.float32)))
    mag = mag[mag > 1e-10]
    if len(mag) < 4:
        return 0.0
    geo   = np.exp(np.mean(np.log(mag)))
    arith = np.mean(mag)
    return float(geo / arith) if arith > 0 else 0.0


def _to_wav(samples: np.ndarray) -> bytes:
    buf = io.BytesIO()
    wavfile.write(buf, SAMPLE_RATE, samples.astype(np.int16))
    return buf.getvalue()


def _say(text: str) -> None:
    """Speak text via macOS `say`; silently ignored on other platforms."""
    try:
        subprocess.run(["say", "-v", "Carmit", text], check=False, capture_output=True)
    except FileNotFoundError:
        log.debug("say not available — skipping: %s", text)


def _play(data: bytes) -> None:
    """Play audio bytes via afplay (macOS). Handles AIFF and MP3."""
    suffix = ".aiff" if data[:4] == b"FORM" else ".mp3"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(data)
        tmp = Path(f.name)
    try:
        subprocess.run(["afplay", str(tmp)], capture_output=True)
    except FileNotFoundError:
        log.debug("afplay not available")
    tmp.unlink(missing_ok=True)


def _find_input_device() -> tuple[int | None, list[int] | None]:
    """Return (device_index, channel_mapping) for the configured audio input device.

    Searches sounddevice's device list for a device whose name contains
    AUDIO_DEVICE_PATTERN (case-insensitive).  Returns (None, None) when the
    pattern is empty or no match is found — callers then use the OS default.
    """
    pattern = AUDIO_DEVICE_PATTERN.strip().lower()
    if not pattern:
        return None, None
    try:
        devices = sd.query_devices()
    except Exception as exc:
        log.warning("audio_device_query_failed  reason=%s", exc)
        return None, None
    for i, dev in enumerate(devices):
        if pattern in dev["name"].lower() and dev["max_input_channels"] > 0:
            log.info(
                "audio_device_found  index=%d  name=%s  channel=%d",
                i, dev["name"], AUDIO_DEVICE_CHANNEL,
            )
            return i, [AUDIO_DEVICE_CHANNEL]
    log.warning(
        "audio_device_not_found  pattern=%r — falling back to system default",
        AUDIO_DEVICE_PATTERN,
    )
    return None, None


# ── Clap detector ─────────────────────────────────────────────────────────────
class ClapDetector:
    """
    Stateful per-frame clap transient detector.

    Feed 20ms audio frames (320 samples @ 16kHz) via push().
    on_double_clap fires when two qualifying transients land within
    [DOUBLE_CLAP_MIN_MS, DOUBLE_CLAP_MAX_MS].

    Transient rejection:
        - Duration > CLAP_MAX_DURATION_MS  → rejected as speech (held vowel)
        - Spectral flatness < CLAP_SPECTRAL_FLATNESS → rejected as tonal (speech/music)
        - Energy < max(CLAP_ENERGY_THRESHOLD, bg × CLAP_RISE_FACTOR) → ambient, ignored

    Parameters
    ----------
    on_double_clap : callable fired on double-clap (from the monitoring thread)
    _now           : callable returning monotonic time (injectable for tests)
    """

    def __init__(
        self,
        on_double_clap: Callable[[], None],
        _now: Callable[[], float] | None = None,
        warmup_frames: int = CLAP_WARMUP_FRAMES,
    ) -> None:
        self._on_double_clap = on_double_clap
        self._now: Callable[[], float] = _now or time.monotonic
        self._bg_energy: float    = 0.002
        self._in_clap: bool       = False
        self._clap_frame_count: int = 0
        self._last_clap_time: float | None = None
        self._cooldown_until: float = 0.0
        self._warmup: int         = warmup_frames
        self._lock = threading.Lock()

    # ── Public ────────────────────────────────────────────────────────────
    def push(self, frame: np.ndarray) -> None:
        """Process one 20ms frame. Thread-safe."""
        with self._lock:
            self._process(frame)

    def reset_cooldown(self) -> None:
        with self._lock:
            self._cooldown_until = 0.0

    # ── Internal ──────────────────────────────────────────────────────────
    def _process(self, frame: np.ndarray) -> None:
        now = self._now()
        if now < self._cooldown_until:
            return

        energy = _rms(frame)

        # Warmup: converge background quickly without registering transients.
        if self._warmup > 0:
            self._bg_energy = self._bg_energy * 0.85 + energy * 0.15
            self._warmup -= 1
            return

        # Adaptive background: slow rise (clap spike should not inflate bg),
        # faster decay toward quiet ambient.
        if energy < self._bg_energy:
            self._bg_energy = self._bg_energy * 0.95 + energy * 0.05
        else:
            self._bg_energy = self._bg_energy * 0.999 + energy * 0.001

        threshold = max(CLAP_ENERGY_THRESHOLD, self._bg_energy * CLAP_RISE_FACTOR)

        if not self._in_clap:
            if energy > threshold:
                flatness = _spectral_flatness(frame)
                if flatness < CLAP_SPECTRAL_FLATNESS:
                    log.debug(
                        "clap_rejected flatness=%.2f energy=%.4f (too tonal)",
                        flatness, energy,
                    )
                    return
                self._in_clap = True
                self._clap_frame_count = 1
                log.debug("clap onset energy=%.4f flatness=%.2f", energy, flatness)
        else:
            if energy > threshold:
                self._clap_frame_count += 1
                if self._clap_frame_count * FRAME_MS > CLAP_MAX_DURATION_MS:
                    log.debug(
                        "clap_rejected duration=%dms > max=%dms (likely speech)",
                        self._clap_frame_count * FRAME_MS, CLAP_MAX_DURATION_MS,
                    )
                    self._in_clap = False
                    self._clap_frame_count = 0
            else:
                # Transient ended — duration is acceptable
                self._in_clap = False
                self._clap_frame_count = 0
                self._register_clap(now)

    def _register_clap(self, now: float) -> None:
        log.info("clap_detected")
        prev = self._last_clap_time
        self._last_clap_time = now

        if prev is None:
            return

        gap_ms = (now - prev) * 1000

        if DOUBLE_CLAP_MIN_MS <= gap_ms <= DOUBLE_CLAP_MAX_MS:
            log.info("double_clap_detected gap_ms=%.0f", gap_ms)
            self._last_clap_time = None
            self._cooldown_until = now + CLAP_COOLDOWN_S
            self._on_double_clap()
        elif gap_ms > DOUBLE_CLAP_MAX_MS:
            # First clap is stale — treat current clap as new first
            log.debug("clap gap %.0fms > max %dms, resetting", gap_ms, DOUBLE_CLAP_MAX_MS)
            self._last_clap_time = now


# ── Wake word detector ────────────────────────────────────────────────────────
class WakeWordDetector:
    """
    Phonetic wake-word detection using openwakeword.

    The "hey_jarvis" model matches the Hebrew pronunciation "ג׳רוויס" closely
    enough to trigger reliably without a custom model.

    Degrades gracefully if openwakeword is not installed.

    Feed 80ms (1280-sample) chunks via push(). on_wake receives the
    pre-wake rolling buffer so any command immediately following the phrase
    is captured without loss.

    Parameters
    ----------
    on_wake : callable(pre_audio: np.ndarray) → None
    _now    : injectable clock for tests
    """

    OWW_FRAME = 1280  # 80ms at 16kHz — required by openwakeword

    def __init__(
        self,
        on_wake: Callable[[np.ndarray], None],
        _now: Callable[[], float] | None = None,
    ) -> None:
        self._on_wake = on_wake
        self._now: Callable[[], float] = _now or time.monotonic
        self._model = None
        self._available = False
        self._rolling: list[np.ndarray] = []
        self._rolling_max = int(2.0 * SAMPLE_RATE / self.OWW_FRAME)
        self._cooldown_until: float = 0.0
        self._first_inference = True

        try:
            from openwakeword.model import Model as OWWModel  # type: ignore
            self._model = OWWModel(
                wakeword_models=[WAKE_OWW_MODEL],
                inference_framework="onnx",
            )
            self._available = True
            log.info("wake_word openwakeword loaded model=%s", WAKE_OWW_MODEL)
            _alog.info(
                "wake_vad_started  model=%s  threshold=%.2f  frame_ms=%d",
                WAKE_OWW_MODEL, WAKE_OWW_THRESHOLD, self.OWW_FRAME * 1000 // SAMPLE_RATE,
            )
        except Exception as exc:
            log.warning(
                "openwakeword unavailable (%s) — wake-word trigger disabled.\n"
                "  Install: pip install openwakeword\n"
                "  Models:  python -c \"from openwakeword.utils import "
                "download_models; download_models()\"",
                exc,
            )
            _alog.warning("wake_vad_unavailable  reason=%s", exc)

    @property
    def available(self) -> bool:
        return self._available

    def push(self, frame: np.ndarray) -> None:
        if not self._available or self._model is None:
            return
        now = self._now()
        if now < self._cooldown_until:
            _alog.debug("wake_cooldown  remaining_s=%.2f", self._cooldown_until - now)
            return

        self._rolling.append(frame.copy())
        if len(self._rolling) > self._rolling_max:
            self._rolling.pop(0)

        # ── wake audio chunk sent for inference ──────────────────────────
        pred = self._model.predict(frame.flatten().astype(np.int16))

        # Log actual prediction keys on first call — reveals model-name mismatches
        # (e.g. openwakeword may key by "hey_jarvis.onnx" instead of "hey_jarvis").
        if self._first_inference:
            _alog.debug("wake_inference_keys  available=%s  looking_for=%s",
                        list(pred.keys()), WAKE_OWW_MODEL)
            self._first_inference = False

        # ── transcript received / normalized score ────────────────────────
        score = float(pred.get(WAKE_OWW_MODEL, 0.0))
        _alog.debug("wake_score  score=%.4f  threshold=%.4f", score, WAKE_OWW_THRESHOLD)

        # ── wake match ────────────────────────────────────────────────────
        matched = score >= WAKE_OWW_THRESHOLD
        _alog.debug("wake_match  match=%s  score=%.4f  threshold=%.4f",
                    matched, score, WAKE_OWW_THRESHOLD)

        if matched:
            log.info("wake_word_detected model=%s score=%.3f", WAKE_OWW_MODEL, score)
            _alog.info("activation_source=wake  score=%.4f", score)
            self._cooldown_until = now + CLAP_COOLDOWN_S
            pre = (
                np.concatenate(self._rolling).flatten()
                if self._rolling else np.array([], dtype=np.int16)
            )
            self._model.reset()
            self._rolling.clear()
            self._on_wake(pre)

    def reset(self) -> None:
        if self._model:
            try:
                self._model.reset()
            except Exception:
                pass
        self._rolling.clear()
        self._cooldown_until = 0.0
        _alog.info("wake_vad_stopped")


# ── Shared microphone monitor ─────────────────────────────────────────────────
class MonitorStream:
    """
    Single sounddevice InputStream shared by ClapDetector and WakeWordDetector.

    Accumulates 20ms clap frames and 80ms wake-word frames independently.
    Stopped during RECORDING/SPEAKING to prevent feedback loops.
    """

    def __init__(
        self,
        clap: ClapDetector | None,
        wake: WakeWordDetector | None,
        device: int | None = None,
        mapping: list[int] | None = None,
    ) -> None:
        self._clap = clap
        self._wake = wake
        self._device  = device
        self._mapping = mapping
        self._stream: sd.InputStream | None = None
        self._oww_buf: list[np.ndarray]     = []
        self._lock   = threading.Lock()
        self._active = False
        self._frame_count = 0

    def start(self) -> None:
        with self._lock:
            if self._active:
                return
            self._oww_buf.clear()
            self._frame_count = 0
            stream_kwargs: dict = dict(
                samplerate=SAMPLE_RATE,
                channels=1,
                dtype=np.int16,
                blocksize=FRAME_SAMPLES,
                callback=self._callback,
            )
            if self._device is not None:
                stream_kwargs["device"] = self._device
            if self._mapping is not None:
                stream_kwargs["mapping"] = self._mapping
            self._stream = sd.InputStream(**stream_kwargs)
            self._stream.start()
            self._active = True
            _alog.info(
                "mic_stream_started  samplerate=%d  blocksize=%d  device=%s  mapping=%s  clap=%s  wake=%s",
                SAMPLE_RATE, FRAME_SAMPLES, self._device, self._mapping,
                self._clap is not None, self._wake is not None,
            )

    def stop(self) -> None:
        with self._lock:
            if not self._active:
                return
            if self._stream:
                self._stream.stop()
                self._stream.close()
                self._stream = None
            self._oww_buf.clear()
            self._active = False
            _alog.info("mic_stream_stopped  total_frames=%d", self._frame_count)

    def _callback(self, indata: np.ndarray, frames: int, t, status) -> None:
        if status:
            _alog.debug("mic_callback_status  status=%s", status)

        frame = indata[:, 0].copy()
        self._frame_count += 1

        # Heartbeat every 250 frames (5 s at 20 ms/frame) — confirms mic is live.
        if self._frame_count % 250 == 0:
            _alog.debug(
                "mic_heartbeat  frame=%d  clap_path=%s  wake_path=%s",
                self._frame_count, self._clap is not None, self._wake is not None,
            )

        if self._clap:
            self._clap.push(frame)

        if self._wake:
            self._oww_buf.append(frame)
            accumulated = sum(len(f) for f in self._oww_buf)
            if accumulated >= WakeWordDetector.OWW_FRAME:
                combined   = np.concatenate(self._oww_buf)
                oww_frame  = combined[: WakeWordDetector.OWW_FRAME]
                remainder  = combined[WakeWordDetector.OWW_FRAME :]
                self._oww_buf = [remainder] if len(remainder) > 0 else []
                _alog.debug(
                    "wake_chunk_sent  samples=%d  ms=%d",
                    WakeWordDetector.OWW_FRAME,
                    WakeWordDetector.OWW_FRAME * 1000 // SAMPLE_RATE,
                )
                self._wake.push(oww_frame)


# ── Recording ─────────────────────────────────────────────────────────────────
def record_blocking(
    stop_event: threading.Event,
    device: int | None = None,
    mapping: list[int] | None = None,
    ready_event: threading.Event | None = None,
) -> bytes:
    """Record from microphone until stop_event is set. Returns WAV bytes.

    Sets ready_event on the first audio callback so callers can wait until the
    stream is genuinely open before they accept a stop signal.
    """
    chunks: list[np.ndarray] = []

    def cb(indata, frames, t, status):
        if ready_event is not None and not ready_event.is_set():
            ready_event.set()
        chunks.append(indata.copy())

    stream_kwargs: dict = dict(samplerate=SAMPLE_RATE, channels=1, dtype=np.int16, callback=cb)
    if device is not None:
        stream_kwargs["device"] = device
    if mapping is not None:
        stream_kwargs["mapping"] = mapping
    with sd.InputStream(**stream_kwargs):
        stop_event.wait()

    audio = np.concatenate(chunks) if chunks else np.zeros(0, dtype=np.int16)
    return _to_wav(audio.flatten())


# ── WebSocket turn ────────────────────────────────────────────────────────────
async def do_turn(
    ws,
    wav: bytes,
    pre_audio: np.ndarray | None = None,
    task_title: str | None = None,
    task_description: str | None = None,
) -> bytes | None:
    """
    Execute one voice turn:
      1. Optional set_task (clap activation injects day-brief context)
      2. Optional pre-audio prepend (wake-word capture)
      3. Audio + end_of_speech
      4. Collect server responses until "done"

    Returns TTS audio bytes or None.
    """
    # Inject task context so the adapter sees it this turn
    if task_title:
        await ws.send(json.dumps({
            "type": "set_task",
            "title": task_title,
            "description": task_description or "",
        }))
        try:
            ack_raw = await asyncio.wait_for(ws.recv(), timeout=2.0)
            if isinstance(ack_raw, str):
                ack = json.loads(ack_raw)
                if ack.get("type") != "task_ok":
                    log.debug("unexpected set_task response: %s", ack)
        except asyncio.TimeoutError:
            log.debug("set_task ack timed out, continuing")

    # Prepend pre-wake audio so command immediately following wake phrase is captured
    if pre_audio is not None and len(pre_audio) > 0:
        buf = io.BytesIO(wav)
        _, samples = wavfile.read(buf)
        merged = np.concatenate([pre_audio, samples.flatten()])
        wav = _to_wav(merged)

    # Pad with trailing silence if the clip is shorter than the STT server's minimum.
    # This happens when ENTER is pressed immediately after recording starts, or when
    # the pre-wake rolling buffer is empty.
    _buf = io.BytesIO(wav)
    _, _samples = wavfile.read(_buf)
    _flat = _samples.flatten()
    if len(_flat) < MIN_AUDIO_SAMPLES:
        log.debug("audio_padded  samples=%d → %d", len(_flat), MIN_AUDIO_SAMPLES)
        _flat = np.concatenate([_flat, np.zeros(MIN_AUDIO_SAMPLES - len(_flat), dtype=np.int16)])
        wav = _to_wav(_flat)

    await ws.send(wav)
    await ws.send(json.dumps({"type": "end_of_speech"}))

    audio_chunks: list[bytes] = []
    while True:
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=30)
        except asyncio.TimeoutError:
            log.warning("server timeout waiting for response")
            return None

        if isinstance(raw, bytes):
            audio_chunks.append(raw)
            continue

        msg = json.loads(raw)
        t   = msg.get("type")

        if t == "transcript":
            print(f"\nYou:  {msg['text']}")
        elif t == "response_text":
            print(f"AI:   {msg['text']}")
        elif t == "timing":
            s = msg["stages"]
            print(
                f"      ⏱  {s.get('total_ms', '?')}ms total"
                f"  (STT {s.get('stt_ms', '?')}"
                f" · TTFT {s.get('adapter_first_token_ms', '?')}"
                f" · TTFA {s.get('time_to_first_audio_ms', '?')}"
                f" · TTS {s.get('tts_ms', '?')})"
            )
        elif t == "done":
            return b"".join(audio_chunks) if audio_chunks else None
        elif t == "error":
            log.error("server error: %s", msg.get("message"))
            return None
        elif t == "expired":
            log.warning("session expired")
            return None


# ── Main client ───────────────────────────────────────────────────────────────
class VoiceClient:
    """
    State-machine voice client.

    MONITORING  — low-power trigger detection (clap / wake / prompt)
    ACTIVATED   — trigger received; greeting played; monitor paused
    RECORDING   — microphone open, collecting speech
    PROCESSING  — audio sent to server, awaiting response
    SPEAKING    — playing TTS audio response
    COOLDOWN    — brief pause before returning to MONITORING

    Feedback-loop prevention: MonitorStream is stopped during ACTIVATED,
    RECORDING, PROCESSING, SPEAKING and only restarted in MONITORING.
    """

    def __init__(
        self,
        ws,
        loop: asyncio.AbstractEventLoop,
        activation: str,
    ) -> None:
        self._ws         = ws
        self._loop       = loop
        self._activation = activation
        self._state      = State.MONITORING
        self._state_lock = threading.Lock()

        self._clap_det: ClapDetector | None     = None
        self._wake_det: WakeWordDetector | None  = None
        self._monitor:  MonitorStream | None     = None

        self._trigger_event = asyncio.Event()
        self._trigger_type  = "manual"
        self._pre_audio:   np.ndarray | None = None
        self._task_title:  str | None        = None
        self._task_desc:   str | None        = None
        self._stop_rec     = threading.Event()

        self._audio_device:  int | None       = None
        self._audio_mapping: list[int] | None = None

        # Single stdin reader — prevents zombie input() threads from stealing
        # ENTER presses across phases.
        self._stdin_queue: asyncio.Queue[str] = asyncio.Queue()

    # ── Setup ──────────────────────────────────────────────────────────────
    def _start_stdin_reader(self) -> None:
        """Background daemon thread that feeds sys.stdin lines into _stdin_queue."""
        def _reader() -> None:
            while True:
                try:
                    line = sys.stdin.readline()
                except OSError:
                    break
                self._loop.call_soon_threadsafe(
                    self._stdin_queue.put_nowait, line.rstrip("\n") if line else ""
                )
                if not line:  # EOF
                    break
        t = threading.Thread(target=_reader, daemon=True, name="stdin-reader")
        t.start()

    def setup(self) -> None:
        self._start_stdin_reader()
        self._audio_device, self._audio_mapping = _find_input_device()

        use_clap = self._activation in ("clap", "all")
        use_wake = self._activation in ("wake", "all")

        if use_clap:
            self._clap_det = ClapDetector(self._on_double_clap)

        if use_wake:
            self._wake_det = WakeWordDetector(self._on_wake_word)
            if not self._wake_det.available:
                log.warning("wake-word detector unavailable; disabling wake trigger")
                self._wake_det = None

        if use_clap or use_wake:
            self._monitor = MonitorStream(
                self._clap_det, self._wake_det,
                device=self._audio_device, mapping=self._audio_mapping,
            )

    # ── Trigger callbacks (monitor thread → asyncio loop) ─────────────────
    def _on_double_clap(self) -> None:
        with self._state_lock:
            if self._state != State.MONITORING:
                return
            self._state = State.ACTIVATED
        _alog.info("activation_source=clap")
        self._trigger_type = "clap"
        self._pre_audio   = None
        self._task_title  = "פתיח יום"
        self._task_desc   = "הפעל את מסגרת פתיח היום והמשך מנקודת העבודה האחרונה."
        self._loop.call_soon_threadsafe(self._trigger_event.set)

    def _on_wake_word(self, pre_audio: np.ndarray) -> None:
        with self._state_lock:
            if self._state != State.MONITORING:
                return
            self._state = State.ACTIVATED
        _alog.info("activation_source=wake  pre_audio_samples=%d", len(pre_audio))
        self._trigger_type = "wake"
        self._pre_audio   = pre_audio
        self._task_title  = None
        self._task_desc   = None
        self._loop.call_soon_threadsafe(self._trigger_event.set)

    # ── Main loop ──────────────────────────────────────────────────────────
    async def run(self) -> None:
        self.setup()
        try:
            while True:
                await self._phase_monitoring()
                await self._phase_activated()
                await self._phase_recording()
                await self._phase_cooldown()
        except (KeyboardInterrupt, asyncio.CancelledError):
            pass
        finally:
            if self._monitor:
                self._monitor.stop()

    # ── Phase: MONITORING ──────────────────────────────────────────────────
    async def _phase_monitoring(self) -> None:
        with self._state_lock:
            self._state = State.MONITORING
        self._trigger_event.clear()

        # Discard any ENTER presses that accumulated in a previous phase so
        # that only a fresh press triggers recording this cycle.
        while not self._stdin_queue.empty():
            self._stdin_queue.get_nowait()

        _alog.info(
            "monitoring_started  mode=%s  clap=%s  wake=%s",
            self._activation,
            self._clap_det is not None,
            self._wake_det is not None,
        )

        if self._monitor:
            try:
                self._monitor.start()
            except Exception as exc:
                log.warning("monitor_stream start failed (%s) — audio triggers disabled", exc)
                self._monitor = None

        use_manual = self._activation in ("manual", "all")
        if use_manual:
            manual_task = self._loop.create_task(self._await_enter_key())
        else:
            manual_task = None
            print("\n⟳  Monitoring for trigger…  (Ctrl+C to quit)")

        await self._trigger_event.wait()

        if manual_task and not manual_task.done():
            manual_task.cancel()
            try:
                await manual_task
            except (asyncio.CancelledError, EOFError):
                pass

        # Stop monitor before greeting/recording to prevent feedback
        if self._monitor:
            self._monitor.stop()

    async def _await_enter_key(self) -> None:
        print("\n[ ENTER to record ]  ", end="", flush=True)
        await self._stdin_queue.get()
        with self._state_lock:
            if self._state != State.MONITORING:
                return
            self._state = State.ACTIVATED
        _alog.info("manual_enter_detected")
        _alog.info("activation_source=manual")
        self._trigger_type = "manual"
        self._pre_audio   = None
        self._task_title  = None
        self._task_desc   = None
        self._trigger_event.set()

    # ── Phase: ACTIVATED ───────────────────────────────────────────────────
    async def _phase_activated(self) -> None:
        with self._state_lock:
            self._state = State.ACTIVATED

        if self._trigger_type == "clap":
            print("\n● Double-clap — starting day brief")
            await self._loop.run_in_executor(None, _say, "לחיי פתיח יום. מתחילים.")

        elif self._trigger_type == "wake":
            print(f"\n● Wake phrase detected — continue speaking or press ENTER to send")

        else:
            print("\n● Recording…")

    # ── Phase: RECORDING → PROCESSING → SPEAKING ───────────────────────────
    async def _phase_recording(self) -> None:
        with self._state_lock:
            self._state = State.RECORDING

        self._stop_rec.clear()
        _rec_ready = threading.Event()
        rec_task = self._loop.run_in_executor(
            None, record_blocking,
            self._stop_rec, self._audio_device, self._audio_mapping, _rec_ready,
        )

        # Wait until the stream is open and the first callback has fired.
        # Without this gate a queued ENTER (pressed during the greeting phase)
        # would set stop_rec before any samples are captured → empty WAV.
        stream_ready = await self._loop.run_in_executor(None, _rec_ready.wait, 3.0)
        if not stream_ready:
            log.warning("record_stream_not_ready  timeout=3s — aborting recording")
            self._stop_rec.set()
            await rec_task
            return

        # Drain any ENTERs that arrived before the stream was ready.
        while not self._stdin_queue.empty():
            self._stdin_queue.get_nowait()

        if self._trigger_type in ("clap", "wake"):
            print("  Speak now…  (press ENTER to send)")

        await self._stdin_queue.get()
        self._stop_rec.set()
        wav = await rec_task

        # ── Debug: log WAV stats before sending ──────────────────────────
        try:
            _buf = io.BytesIO(wav)
            _, _s = wavfile.read(_buf)
            _flat = _s.flatten()
            _dur  = len(_flat) / SAMPLE_RATE
            _peak = float(np.max(np.abs(_flat))) / 32768.0 if len(_flat) else 0.0
            _rms  = float(np.sqrt(np.mean(_flat.astype(np.float32) ** 2))) / 32768.0 if len(_flat) else 0.0
        except Exception as exc:
            log.warning("wav_read_failed  reason=%s", exc)
            _flat, _dur, _peak, _rms = np.zeros(0, dtype=np.int16), 0.0, 0.0, 0.0

        log.debug(
            "recording_stats  samples=%d  shape=%s  duration_s=%.3f  peak=%.4f  rms=%.4f",
            len(_flat), _flat.shape, _dur, _peak, _rms,
        )

        if len(_flat) == 0:
            print("  [Recording empty — nothing sent]")
            log.warning("recording_empty  skipping_stt")
            return

        with self._state_lock:
            self._state = State.PROCESSING
        print("  Sending…")

        response_audio = await do_turn(
            self._ws,
            wav,
            pre_audio=self._pre_audio,
            task_title=self._task_title,
            task_description=self._task_desc,
        )

        if response_audio:
            with self._state_lock:
                self._state = State.SPEAKING
            await self._loop.run_in_executor(None, _play, response_audio)

    # ── Phase: COOLDOWN ────────────────────────────────────────────────────
    async def _phase_cooldown(self) -> None:
        with self._state_lock:
            self._state = State.COOLDOWN
        await asyncio.sleep(CLAP_COOLDOWN_S)


# ── Entry point ───────────────────────────────────────────────────────────────
async def _run(host: str, port: int, activation: str) -> None:
    uri = f"ws://{host}:{port}/ws/voice"
    print(f"Connecting to {uri}…")

    async with websockets.connect(uri) as ws:
        init = json.loads(await ws.recv())
        print(f"Session: {init.get('session_id', '?')}\n")

        hints = {
            "manual": "Press ENTER to record, ENTER again to send.",
            "clap":   "Double-clap to activate.",
            "wake":   f'Say "{WAKE_PHRASE_HE}" to activate.',
            "all":    f'ENTER  /  double-clap  /  say "{WAKE_PHRASE_HE}"',
        }
        print(f"Activation ({activation}): {hints.get(activation, activation)}\n")

        loop   = asyncio.get_running_loop()
        client = VoiceClient(ws, loop, activation)
        await client.run()


def main() -> None:
    import argparse

    p = argparse.ArgumentParser(
        description="Voice Gateway client with hands-free triggers"
    )
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8765)
    p.add_argument(
        "--activation",
        default="all",
        choices=["manual", "clap", "wake", "all"],
        help="Activation mode (default: all)",
    )
    p.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
    )
    p.add_argument(
        "--debug-activation",
        action="store_true",
        help=(
            "Emit per-frame activation traces (mic heartbeat, wake scores, "
            "clap energy) to stderr. Kept separate from --log-level so "
            "normal output stays clean."
        ),
    )
    args = p.parse_args()

    logging.getLogger().setLevel(args.log_level)
    log.setLevel(args.log_level)

    if args.debug_activation:
        _act_handler = logging.StreamHandler()
        _act_handler.setFormatter(
            logging.Formatter("%(asctime)s [ACT] %(levelname)s  %(message)s")
        )
        _alog.setLevel(logging.DEBUG)
        _alog.addHandler(_act_handler)
        _alog.propagate = False  # prevent duplication on the root handler

    try:
        asyncio.run(_run(args.host, args.port, args.activation))
    except KeyboardInterrupt:
        print("\nGoodbye.")


if __name__ == "__main__":
    main()
