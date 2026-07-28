"""ElevenLabs TTS provider — high-quality natural voice.

Voices (set ELEVENLABS_VOICE_ID in .env):
  JBFqnCBsd6RMkjVDRZzb  George    — deep, British, authoritative (default)
  N2lVS1w4EtoT3dr4eOWO  Callum    — masculine, commanding
  IKne3meq5aSn9XLyUdCD  Charlie   — conversational, warm
  21m00Tcm4TlvDq8ikWAM  Rachel    — warm, clear

Models:
  eleven_turbo_v2_5     — fastest, multilingual, ~80ms latency  (default)
  eleven_multilingual_v2 — highest quality, ~150ms latency
"""

import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_API_BASE = "https://api.elevenlabs.io/v1"


class ElevenLabsTTS:
    def __init__(self) -> None:
        self._api_key = settings.elevenlabs_api_key
        self._voice_id = settings.elevenlabs_voice_id
        self._model = settings.elevenlabs_model

    async def synthesize(self, text: str) -> bytes:
        if not text.strip():
            return b""

        url = f"{_API_BASE}/text-to-speech/{self._voice_id}"
        headers = {
            "xi-api-key": self._api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "text": text,
            "model_id": self._model,
            "voice_settings": {
                "stability": 0.45,
                "similarity_boost": 0.80,
                "style": 0.0,
                "use_speaker_boost": True,
            },
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            audio = resp.content

        logger.debug(
            "elevenlabs_tts synthesized %d chars → %d bytes (voice=%s model=%s)",
            len(text), len(audio), self._voice_id, self._model,
        )
        return audio
