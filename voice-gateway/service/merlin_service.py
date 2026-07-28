#!/usr/bin/env python3
"""Merlin background voice service.

Flow:
  [always listening for double clap]
       │
  double clap detected
       │
  play wake chime
       │
  record until silence (VAD)
       │
  Whisper STT → text
       │
  Claude (Jarvis persona) → streaming text
       │
  ElevenLabs / OpenAI TTS → audio chunks (per sentence)
       │
  play audio (afplay)
       │
  [back to listening]

Run via LaunchAgent (no terminal required). See launch/install.sh.
"""

import asyncio
import io
import logging
import os
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

import numpy as np
import sounddevice as sd
from scipy.io import wavfile

# ── Add voice-gateway root to path so `app.*` imports work ────────────────────
_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(_ROOT))

# Load .env before importing app modules (pydantic-settings reads it at import)
from dotenv import load_dotenv
load_dotenv(_ROOT / ".env")

from app.audio.sentence import SentenceBuffer
from app.router import build_orchestrator, build_stt, build_tts
from service.wake_trigger import WakeTrigger

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s — %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("merlin.service")

# ── Audio constants ───────────────────────────────────────────────────────────
SAMPLE_RATE    = 16_000
CHANNELS       = 1
BLOCK_SIZE     = 512

# ── VAD parameters for recording utterance ───────────────────────────────────
SILENCE_RMS    = 0.018      # normalized RMS below this = silence
SILENCE_S      = 1.4        # seconds of silence to end turn
MAX_RECORD_S   = 30         # hard safety cutoff


# ── Audio playback ────────────────────────────────────────────────────────────

def _play(data: bytes) -> None:
    """Synchronously play audio bytes via afplay (macOS). Blocks until done."""
    if not data:
        return
    suffix = ".aiff" if data[:4] == b"FORM" else ".mp3"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(data)
        tmp = Path(f.name)
    try:
        subprocess.run(["afplay", str(tmp)], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except (FileNotFoundError, subprocess.CalledProcessError) as e:
        logger.warning("afplay failed: %s", e)
    finally:
        tmp.unlink(missing_ok=True)


async def play_async(data: bytes) -> None:
    """Run _play in a thread so it doesn't block the event loop."""
    if data:
        await asyncio.get_running_loop().run_in_executor(None, _play, data)


# ── Recording ─────────────────────────────────────────────────────────────────

async def record_utterance() -> bytes:
    """
    Record from microphone until SILENCE_S seconds of silence.
    Returns raw WAV bytes (16kHz, mono, int16).
    """
    chunks: list[np.ndarray] = []
    silence_blocks = 0
    max_silence_blocks = int(SILENCE_S * SAMPLE_RATE / BLOCK_SIZE)
    max_total_blocks   = int(MAX_RECORD_S * SAMPLE_RATE / BLOCK_SIZE)
    total_blocks = 0
    stop = threading.Event()

    def _callback(indata: np.ndarray, frames: int, time_info, status) -> None:
        nonlocal silence_blocks, total_blocks
        chunks.append(indata.copy())
        rms = float(np.sqrt(np.mean(indata.astype(np.float32) ** 2)))
        silence_blocks = silence_blocks + 1 if rms < SILENCE_RMS else 0
        total_blocks += 1
        if silence_blocks >= max_silence_blocks or total_blocks >= max_total_blocks:
            stop.set()

    loop = asyncio.get_running_loop()
    done = loop.create_future()

    def _watcher():
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

    audio = np.concatenate(chunks, axis=0) if chunks else np.zeros((0, CHANNELS), dtype=np.int16)
    buf = io.BytesIO()
    wavfile.write(buf, SAMPLE_RATE, audio)
    return buf.getvalue()


# ── One full conversation turn ────────────────────────────────────────────────

async def run_turn(
    adapter,
    stt,
    tts,
    session_id: str,
) -> None:
    """STT → LLM → TTS for a single user utterance."""
    logger.info("Recording…")
    audio = await record_utterance()

    transcript = await stt.transcribe(audio)
    if not transcript.strip():
        logger.info("Empty transcript — returning to sleep")
        return
    logger.info("You: %s", transcript)

    buf = SentenceBuffer(first_min_chars=30)
    loop = asyncio.get_running_loop()
    full_response = ""

    async for chunk in adapter.respond(transcript, session_id=session_id):
        full_response += chunk
        sentence = buf.push(chunk)
        if sentence:
            audio_bytes = await tts.synthesize(sentence)
            await play_async(audio_bytes)

    remainder = buf.flush()
    if remainder:
        audio_bytes = await tts.synthesize(remainder)
        await play_async(audio_bytes)

    logger.info("Merlin: %s", full_response[:120] + ("…" if len(full_response) > 120 else ""))


# ── Main service loop ─────────────────────────────────────────────────────────

async def main() -> None:
    logger.info("Merlin service starting…")

    adapter = build_orchestrator()
    stt     = build_stt()
    tts     = build_tts()
    trigger = WakeTrigger()
    session_id = "merlin-bg"

    logger.info(
        "Ready. Adapter=%s STT=%s TTS=%s — waiting for double clap.",
        adapter.__class__.__name__,
        stt.__class__.__name__,
        tts.__class__.__name__,
    )

    while True:
        try:
            # Phase 1: low-power listening for wake trigger
            await trigger.wait()

            # Phase 2: full conversation turn
            await run_turn(adapter, stt, tts, session_id)

        except KeyboardInterrupt:
            logger.info("Interrupted — shutting down")
            break
        except Exception:
            logger.exception("Error in turn — sleeping 2s then returning to listen")
            await asyncio.sleep(2.0)


if __name__ == "__main__":
    asyncio.run(main())
