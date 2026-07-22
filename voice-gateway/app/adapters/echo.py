"""
Echo adapter — reflects the transcript back verbatim.

Use this as the Phase 2 baseline before plugging in any real backend:
  ADAPTER=echo uvicorn app.main:app ...

If echo latency > 1 s, the bottleneck is STT or TTS, not the backend.
If claude latency − echo latency > 1.5 s, the bottleneck is the model.
"""

from typing import AsyncIterator

from app.adapters.base import VoiceAdapter


class EchoAdapter(VoiceAdapter):
    @property
    def name(self) -> str:
        return "echo"

    async def respond(self, text: str, session_id: str) -> AsyncIterator[str]:
        yield text

    async def reset(self, session_id: str) -> None:
        pass
