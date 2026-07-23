"""Mock STT provider — returns a fixed transcript instantly. No API calls."""

import asyncio

from app.providers.stt.base import STTProvider


class MockSTT(STTProvider):
    @property
    def name(self) -> str:
        return "mock"

    async def transcribe(self, audio_bytes: bytes) -> str:
        await asyncio.sleep(0)
        return "מה מצב הפרויקט? תסביר בקצרה."
