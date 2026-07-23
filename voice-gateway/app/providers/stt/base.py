"""STTProvider — base class for all speech-to-text providers."""

from abc import ABC, abstractmethod


class STTProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio_bytes: bytes) -> str: ...

    @property
    def name(self) -> str:
        return self.__class__.__name__.lower()
