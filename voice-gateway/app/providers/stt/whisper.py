"""OpenAI Whisper STT provider."""

import io
import json
import logging
import os
import time
import wave

import numpy as np
from openai import AsyncOpenAI

from app.audio.utils import audio_to_file_like, validate_audio
from app.config import settings
from app.providers.stt.base import STTProvider

logger = logging.getLogger(__name__)

# ── Command-path audio-capture probe (instrumentation; OFF by default) ─────────
# Mirrors the wake-path probe in service/wake_trigger.py.  Saves the EXACT WAV
# bytes sent to Whisper for a COMMAND utterance + metadata — ONLY when
# MERLIN_CAPTURE_WAV=1.  When unset, this path is byte-for-byte the production call
# (response_format="text", no writes, no behaviour change).  Files use a "cmd_"
# prefix to distinguish them from the wake-path "wake_" captures.
_CMD_CAPTURE_DIR = os.path.expanduser(
    os.environ.get("MERLIN_CAPTURE_DIR", "~/Library/Logs/Merlin/capture")
)
_cmd_seq = [0]


def _cmd_capture_enabled() -> bool:
    return os.environ.get("MERLIN_CAPTURE_WAV") == "1"


def _save_cmd_capture(audio_bytes: bytes, result) -> None:
    """Save the exact command WAV sent to Whisper + metadata (capture mode only)."""
    os.makedirs(_CMD_CAPTURE_DIR, exist_ok=True)
    _cmd_seq[0] += 1
    stamp = time.strftime("%Y%m%d-%H%M%S")
    base = f"cmd_{stamp}_{_cmd_seq[0]:03d}"
    with open(os.path.join(_CMD_CAPTURE_DIR, base + ".wav"), "wb") as fh:
        fh.write(audio_bytes)
    sr = rms = peak = dur = None
    try:
        w = wave.open(io.BytesIO(audio_bytes), "rb")
        sr = w.getframerate()
        n = w.getnframes()
        x = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768.0
        if x.size:
            rms = float(np.sqrt(np.mean(x ** 2)))
            peak = float(np.max(np.abs(x)))
        dur = n / sr if sr else None
    except Exception:
        pass
    segs = getattr(result, "segments", None) or []
    no_speech = float(np.mean([s.no_speech_prob for s in segs])) if segs else None
    meta = {
        "timestamp": stamp,
        "path": "command",
        "experiment_id": os.environ.get("MERLIN_EXPERIMENT_ID"),
        "phrase": os.environ.get("MERLIN_EXPERIMENT_PHRASE"),
        "run": _cmd_seq[0],
        "wav": base + ".wav",
        "rms": round(rms, 6) if rms is not None else None,
        "peak": round(peak, 6) if peak is not None else None,
        "duration": round(dur, 3) if dur is not None else None,
        "sample_rate": sr,
        "transcript": getattr(result, "text", ""),
        "no_speech": round(no_speech, 4) if no_speech is not None else None,
        "language": getattr(result, "language", None),
    }
    with open(os.path.join(_CMD_CAPTURE_DIR, base + ".json"), "w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=2)
    logger.info("CAPTURE(cmd) saved %s  rms=%s peak=%s", base, meta["rms"], meta["peak"])


def _response_text(response) -> str:
    """Transcript text from either transcription response shape.

    response_format="text" → a bare `str`; "json"/"verbose_json" → an object with
    `.text`.  Returns "" only when the response genuinely carries no text.
    """
    if isinstance(response, str):
        return response.strip()
    text = getattr(response, "text", None)
    if isinstance(text, str):
        return text.strip()
    return str(response).strip() if response is not None else ""


class WhisperSTT(STTProvider):
    def __init__(self) -> None:
        self._client = AsyncOpenAI(api_key=settings.openai_api_key)

    @property
    def name(self) -> str:
        return "whisper"

    async def transcribe(self, audio_bytes: bytes) -> str:
        validate_audio(audio_bytes)

        file_like = audio_to_file_like(audio_bytes, "audio.wav")

        _cap = _cmd_capture_enabled()
        _kwargs = dict(
            model=settings.stt_model,
            file=file_like,
            # Force Hebrew + deterministic decoding to match the wake path:
            # on low-SNR mic input Whisper otherwise hallucinates foreign-language
            # stock phrases (Thai/Korean) and word repetitions.
            language="he",
            temperature=0,
            # Capture mode asks for a structured body (for language/segment metadata);
            # otherwise the production call is unchanged (response_format="text").
            # NOTE: gpt-4o-transcribe rejects "verbose_json" with HTTP 400 — only
            # "json" and "text" are accepted.  Requesting verbose_json here is what
            # took the wake path down (3 consecutive 400s → keyword inference off).
            response_format="json" if _cap else "text",
        )
        response = await self._client.audio.transcriptions.create(**_kwargs)

        # Extract the transcript defensively: the SDK returns a bare `str` for
        # response_format="text" and an object with `.text` for "json".  Keying this
        # off `_cap` alone silently yields "" whenever the two disagree — which reads
        # downstream as "no speech" rather than as an error.  Handle both shapes.
        text = _response_text(response)

        if _cap:
            try:
                _save_cmd_capture(audio_bytes, response)
            except Exception as _e:  # never let instrumentation break transcription
                logger.warning("command capture probe failed: %s", _e)

        logger.debug("whisper transcribed %d bytes → %r", len(audio_bytes), text[:80])
        return text
