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
            model="tts-1",
            voice=settings.openai_tts_voice,
            input=text,
            response_format="mp3",
        )

        audio = response.content
        logger.debug("openai_tts synthesized %d chars → %d bytes", len(text), len(audio))
        return audio
