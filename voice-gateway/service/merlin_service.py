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
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

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
from service.vad_config import SPEECH_RMS_THRESHOLD as SILENCE_RMS  # shared with wake_trigger
# print() survives before logging handlers are wired up
print(f"[merlin_service] SILENCE_RMS={SILENCE_RMS:.5f} loaded from service.vad_config", flush=True)
SILENCE_S    = 0.8     # 0.8 s trailing silence ends an utterance
MAX_RECORD_S = 30

# ── Barge-in (interrupt Merlin mid-speech) ────────────────────────────────────
BARGE_IN_RMS    = 0.05  # mic energy that counts as user speaking
BARGE_IN_FRAMES = 8     # need ~160 ms of sustained energy (8 × 20 ms blocks)
BARGE_IN_GRACE  = 0.5   # ignore first 0.5 s of playback (avoids echo trigger)

# ── Conversation session ──────────────────────────────────────────────────────
CONVERSATION_TIMEOUT = 8.0   # seconds of post-response silence → standby

_CHIME = "/System/Library/Sounds/Tink.aiff"


# ── Interruptible audio player ────────────────────────────────────────────────

class AudioPlayer:
    """Plays audio via afplay. interrupt() stops it immediately (barge-in)."""

    def __init__(self) -> None:
        self._proc: subprocess.Popen | None = None
        self._tmp:  Path | None             = None

    # ── internal sync play (runs in executor thread) ──────────────────────────

    def _play_sync(self, data: bytes) -> None:
        suffix = ".aiff" if data[:4] == b"FORM" else ".mp3"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(data)
            self._tmp = Path(f.name)
        try:
            self._proc = subprocess.Popen(
                ["afplay", str(self._tmp)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            self._proc.wait()
        except (FileNotFoundError, OSError) as e:
            logger.warning("afplay error: %s", e)
        finally:
            if self._tmp:
                self._tmp.unlink(missing_ok=True)
            self._tmp  = None
            self._proc = None

    # ── public async interface ────────────────────────────────────────────────

    async def play(self, data: bytes) -> None:
        if data:
            await asyncio.get_running_loop().run_in_executor(None, self._play_sync, data)

    async def chime(self) -> None:
        await asyncio.get_running_loop().run_in_executor(
            None,
            lambda: subprocess.run(
                ["afplay", _CHIME],
                check=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            ),
        )

    def interrupt(self) -> None:
        """Called from the audio callback thread — must be lock-free."""
        proc = self._proc
        if proc and proc.poll() is None:
            proc.terminate()


# ── Recording ─────────────────────────────────────────────────────────────────

async def record_utterance(max_initial_silence: float | None = None) -> bytes:
    """
    Record from the mic until VAD-detected silence.

    Opens at the device's native sample rate and selects the loudest channel,
    then resamples to SAMPLE_RATE (16 kHz) before returning.  This avoids the
    silent-stream bug on multi-channel devices (e.g. RME Babyface) that do not
    support 16 kHz or single-channel input.

    Returns WAV bytes (16 kHz mono int16), or b"" on timeout / no speech.
    """
    from math import gcd as _gcd
    from scipy.signal import resample_poly as _resample_poly

    import service.vad_config as _vad_cfg
    logger.info(
        "record_utterance: SILENCE_RMS=%.5f id=%d"
        "  vad_config.SPEECH_RMS_THRESHOLD=%.5f"
        "  merlin_service.__file__=%s  vad_config.__file__=%s",
        SILENCE_RMS, id(SILENCE_RMS),
        _vad_cfg.SPEECH_RMS_THRESHOLD,
        __file__, _vad_cfg.__file__,
    )

    chunks: list[np.ndarray] = []
    stop = threading.Event()

    t_start      = time.monotonic()
    t_speech_on  = [0.0]
    t_last_voice = [0.0]
    speech_on    = [False]
    _cb_count    = [0]
    _cb_last_hb  = [0.0]   # last heartbeat timestamp

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
                    speech_on[0], now - t_start, ch_rms_str,
                )
            else:
                logger.info(
                    "[rec] cb #%d  shape=%s  indata_max=%.5f"
                    "  rms=%.5f  threshold=%.5f  speech=%s  elapsed=%.1fs",
                    _cb_count[0], indata.shape, indata_max,
                    rms, SILENCE_RMS, speech_on[0], now - t_start,
                )

        if not speech_on[0]:
            if rms >= SILENCE_RMS:
                speech_on[0]    = True
                t_speech_on[0]  = now
                t_last_voice[0] = now
                logger.info("record_utterance: VAD on  rms=%.4f", rms)
            elif max_initial_silence and (now - t_start) >= max_initial_silence:
                logger.info(
                    "record_utterance: initial silence timeout (%.1fs) — no speech",
                    max_initial_silence,
                )
                stop.set()
                return
        else:
            if rms >= SILENCE_RMS:
                t_last_voice[0] = now
            silence_s = now - t_last_voice[0]
            total_s   = now - t_speech_on[0]
            if silence_s >= SILENCE_S or total_s >= MAX_RECORD_S:
                logger.info(
                    "record_utterance: VAD off  silence=%.2fs total=%.2fs",
                    silence_s, total_s,
                )
                stop.set()
                return

        chunks.append(pcm.copy())

    loop = asyncio.get_running_loop()
    done = loop.create_future()

    def _watcher() -> None:
        stop.wait()
        loop.call_soon_threadsafe(done.set_result, None)

    threading.Thread(target=_watcher, daemon=True).start()

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
        native_sr = int(stream.samplerate)
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

    if not speech_on[0]:
        logger.info(
            "record_utterance: no speech in %.1fs — returning to standby",
            max_initial_silence or 0,
        )
        return b""

    if not chunks:
        return b""

    audio = np.concatenate(chunks)
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

    audio_i16 = (np.clip(audio, -1.0, 1.0) * 32767).astype(np.int16)
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
    grace_until = time.monotonic() + BARGE_IN_GRACE

    def _barge_callback(indata: np.ndarray, frames: int, time_info, status) -> None:
        nonlocal barge_count
        if barged_flag.is_set() or time.monotonic() < grace_until:
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

    with sd.InputStream(
        samplerate=None,
        channels=None,
        dtype=np.float32,
        blocksize=320,      # 20 ms chunks for low-latency barge detection
        callback=_barge_callback,
    ):
        logger.info("stream_response: LLM streaming start")
        async for chunk in adapter.respond(transcript, session_id=session_id):
            if barged_in.is_set():
                break
            full_response += chunk
            sentence = buf.push(chunk)
            if sentence and not barged_in.is_set():
                logger.info("stream_response: TTS synthesize (%d chars)", len(sentence))
                audio_bytes = await tts.synthesize(sentence)
                logger.info("stream_response: TTS done (%d bytes)", len(audio_bytes))
                if not barged_in.is_set():
                    logger.info("stream_response: playback start")
                    await player.play(audio_bytes)
                    logger.info("stream_response: playback done")

        if not barged_in.is_set():
            remainder = buf.flush()
            if remainder:
                logger.info("stream_response: TTS remainder (%d chars)", len(remainder))
                audio_bytes = await tts.synthesize(remainder)
                logger.info("stream_response: TTS remainder done (%d bytes)", len(audio_bytes))
                if not barged_in.is_set():
                    logger.info("stream_response: playback remainder start")
                    await player.play(audio_bytes)
                    logger.info("stream_response: playback remainder done")

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
) -> None:
    """
    Multi-turn conversation loop.

    Stays awake after each response. Returns to standby after
    CONVERSATION_TIMEOUT seconds of silence with no new speech.
    After each turn, memory extraction runs as a background task.
    """
    logger.info("PIPELINE_STARTED_SUCCESSFULLY")
    while True:
        logger.info("Listening… (%.0fs timeout)", CONVERSATION_TIMEOUT)
        audio = await record_utterance(max_initial_silence=CONVERSATION_TIMEOUT)
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

        # Memory review voice command
        if any(phrase in transcript.lower() for phrase in _MEMORY_REVIEW_PHRASES):
            review_text = _format_memory_review(store)
            logger.info("memory review: synthesizing response")
            audio_bytes = await tts.synthesize(review_text)
            await player.play(audio_bytes)
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
            await trigger.wait()
            logger.info("WAKE_HANDLER_ENTERED")
            await player.chime()
            retry_delay = 2.0

            logger.info("STARTING_ASSISTANT_PIPELINE")
            await run_conversation_session(adapter, stt, tts, player, store, session_id)

        except KeyboardInterrupt:
            logger.info("Interrupted — shutting down")
            break
        except Exception:
            logger.exception("Error — retrying in %.0fs", retry_delay)
            await asyncio.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, 60.0)


if __name__ == "__main__":
    asyncio.run(main())
