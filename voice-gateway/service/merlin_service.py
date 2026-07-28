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
SILENCE_RMS  = 0.018   # normalized RMS below this = silence
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

    max_initial_silence: if set and no speech begins within this many seconds,
    returns b"" so the caller knows nothing was said (conversation timeout).

    Returns WAV bytes (16 kHz mono int16), or b"" on timeout.
    """
    chunks: list[np.ndarray] = []
    silence_blocks = 0
    total_blocks   = 0
    initial_blocks = 0
    speech_started = False

    max_sil_blks  = int(SILENCE_S    * SAMPLE_RATE / BLOCK_SIZE)
    max_tot_blks  = int(MAX_RECORD_S * SAMPLE_RATE / BLOCK_SIZE)
    max_init_blks = (
        int(max_initial_silence * SAMPLE_RATE / BLOCK_SIZE)
        if max_initial_silence is not None else None
    )
    stop = threading.Event()

    def _callback(indata: np.ndarray, frames: int, time_info, status) -> None:
        nonlocal silence_blocks, total_blocks, initial_blocks, speech_started
        chunks.append(indata.copy())
        rms = float(np.sqrt(np.mean(indata.astype(np.float32) ** 2)))

        if rms >= SILENCE_RMS:
            speech_started = True

        if not speech_started:
            initial_blocks += 1
            if max_init_blks and initial_blocks >= max_init_blks:
                stop.set()
                return

        silence_blocks  = silence_blocks + 1 if rms < SILENCE_RMS else 0
        total_blocks   += 1
        if silence_blocks >= max_sil_blks or total_blocks >= max_tot_blks:
            stop.set()

    loop = asyncio.get_running_loop()
    done = loop.create_future()

    def _watcher() -> None:
        stop.wait()
        loop.call_soon_threadsafe(done.set_result, None)

    threading.Thread(target=_watcher, daemon=True).start()

    with sd.InputStream(
        samplerate=SAMPLE_RATE,
        channels=CHANNELS,
        dtype=np.int16,
        blocksize=BLOCK_SIZE,
        callback=_callback,
    ):
        await done

    if not speech_started:
        return b""

    audio = np.concatenate(chunks, axis=0) if chunks else np.zeros((0, CHANNELS), dtype=np.int16)
    buf   = io.BytesIO()
    wavfile.write(buf, SAMPLE_RATE, audio)
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
        rms = float(np.sqrt(np.mean(indata[:, 0].astype(np.float32) ** 2)))
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
        samplerate=SAMPLE_RATE,
        channels=1,
        dtype=np.float32,
        blocksize=320,      # 20 ms chunks for low-latency barge detection
        callback=_barge_callback,
    ):
        async for chunk in adapter.respond(transcript, session_id=session_id):
            if barged_in.is_set():
                break
            full_response += chunk
            sentence = buf.push(chunk)
            if sentence and not barged_in.is_set():
                audio_bytes = await tts.synthesize(sentence)
                if not barged_in.is_set():
                    await player.play(audio_bytes)

        if not barged_in.is_set():
            remainder = buf.flush()
            if remainder:
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
) -> None:
    """
    Multi-turn conversation loop.

    Stays awake after each response. Returns to standby after
    CONVERSATION_TIMEOUT seconds of silence with no new speech.
    After each turn, memory extraction runs as a background task.
    """
    while True:
        logger.info("Listening… (%.0fs timeout)", CONVERSATION_TIMEOUT)
        audio = await record_utterance(max_initial_silence=CONVERSATION_TIMEOUT)

        if not audio:
            logger.info("No speech — returning to standby")
            return

        transcript = await stt.transcribe(audio)
        if not transcript.strip():
            continue

        logger.info("You: %s", transcript)

        # Memory review voice command
        if any(phrase in transcript.lower() for phrase in _MEMORY_REVIEW_PHRASES):
            review_text = _format_memory_review(store)
            audio_bytes = await tts.synthesize(review_text)
            await player.play(audio_bytes)
            continue

        interrupted, response_text = await stream_response(
            adapter, tts, player, transcript, session_id
        )

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
            await player.chime()
            retry_delay = 2.0

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
