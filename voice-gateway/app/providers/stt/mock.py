"""Mock STT provider — returns a fixed transcript instantly. No API calls."""

import asyncio


class MockSTT:
    async def transcribe(self, audio_bytes: bytes) -> str:
        await asyncio.sleep(0)
        return "מה מצב הפרויקט? תסביר בקצרה."
