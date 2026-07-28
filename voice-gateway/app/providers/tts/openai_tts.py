"""OpenAI TTS provider."""

import logging

from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)


class OpenAITTS:
    def __init__(self) -> None:
        self._client = AsyncOpenAI(api_key=settings.openai_api_key)

    async def synthesize(self, text: str) -> bytes:
        if not text.strip():
            return b""

        response = await self._client.audio.speech.create(
            model=settings.openai_tts_model,
            voice=settings.openai_tts_voice,
            input=text,
            response_format="mp3",
            speed=settings.openai_tts_speed,
        )

        audio = response.content
        logger.info("openai_tts voice=%s speed=%.2f %d chars → %d bytes",
                    settings.openai_tts_voice, settings.openai_tts_speed, len(text), len(audio))
        return audio
