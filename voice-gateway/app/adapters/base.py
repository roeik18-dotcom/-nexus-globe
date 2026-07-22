"""
Base adapter interface for voice backends.

Phase 1: Claude adapter (this repo)
Phase 2: JARVIS adapter (~/jarvis)
Phase 3: Philos adapter (~/philos-orchestrator)

Every adapter receives the user's transcribed text and streams back a text
response. The Voice Gateway handles STT and TTS — adapters deal in text only.
"""

from abc import ABC, abstractmethod
from typing import AsyncIterator


class VoiceAdapter(ABC):
    """Contract that every backend (Claude, JARVIS, Philos) must satisfy."""

    @abstractmethod
    async def respond(self, text: str, session_id: str) -> AsyncIterator[str]:
        """
        Stream a text response given the user's transcribed utterance.

        Yields text chunks as they are generated. The gateway concatenates
        them and passes the full text to TTS once streaming is complete.
        """
        ...

    @abstractmethod
    async def reset(self, session_id: str) -> None:
        """Clear conversation history for the given session."""
        ...

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable backend name shown in logs."""
        ...
