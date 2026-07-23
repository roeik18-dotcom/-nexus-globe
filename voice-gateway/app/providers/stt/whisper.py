"""OpenAI Whisper STT provider."""

import logging

from openai import AsyncOpenAI

from app.audio.utils import audio_to_file_like, validate_audio
from app.config import settings
from app.providers.stt.base import STTProvider

logger = logging.getLogger(__name__)


class WhisperSTT(STTProvider):
    def __init__(self) -> None:
        self._client = AsyncOpenAI(api_key=settings.openai_api_key)

    @property
    def name(self) -> str:
        return "whisper"

    async def transcribe(self, audio_bytes: bytes) -> str:
        validate_audio(audio_bytes)

        file_like = audio_to_file_like(audio_bytes, "audio.wav")

        response = await self._client.audio.transcriptions.create(
            model="whisper-1",
            file=file_like,
            response_format="text",
        )

        text = response.strip() if isinstance(response, str) else str(response).strip()
        logger.debug("whisper transcribed %d bytes → %r", len(audio_bytes), text[:80])
        return text
