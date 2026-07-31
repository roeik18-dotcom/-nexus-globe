"""STTProvider — base class for all speech-to-text providers.

Canonical Transcription object per ADR-002; SpeechEngine interface per ADR-001.
Additive: `transcribe(audio) -> str` is unchanged; `transcribe_detailed(audio) ->
Transcription` is new, with a default that wraps `transcribe` so existing providers
keep working. Rich providers (Whisper verbose_json) override it.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class Transcription:
    """Canonical result every SpeechEngine adapter returns (ADR-002)."""

    text: str
    language: str | None = None
    confidence: float | None = None          # 0..1, normalized across providers
    segments: list | None = None             # [{text,start_s,end_s,no_speech_prob?}]
    duration_s: float | None = None
    provider: str = ""
    model: str = ""
    latency_ms: int | None = None
    audio_metrics: dict = field(default_factory=dict)   # rms/peak/norm_gain/sha256
    raw_reference: str | None = None


class STTProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio_bytes: bytes) -> str: ...

    async def transcribe_detailed(self, audio_bytes: bytes) -> Transcription:
        """Default: wrap the plain transcript. Rich providers override this."""
        text = await self.transcribe(audio_bytes)
        return Transcription(text=text, provider=self.name)

    @property
    def name(self) -> str:
        return self.__class__.__name__.lower()
