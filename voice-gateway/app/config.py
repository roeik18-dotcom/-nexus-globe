from typing import Literal

from app.context_builder import ContextBuilder
from pydantic_settings import BaseSettings, SettingsConfigDict


def build_system_prompt(persona: str) -> str:
    return ContextBuilder.for_session(persona).build()


def build_system_prompt_with_task(persona: str, task=None, summary=None, tool_memory=None, recall_result=None, essence_context: str = "") -> str:
    return ContextBuilder.for_session(persona, task, summary, tool_memory, recall_result=recall_result, essence_context=essence_context).build()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    anthropic_api_key: str | None = None
    openai_api_key: str | None = None

    stt_provider: str = "whisper"
    tts_provider: str = "openai"
    openai_tts_voice: str = "onyx"
    openai_tts_model: str = "tts-1-hd"
    openai_tts_speed: float = 1.15
    adapter: str = "claude"

    # ── ElevenLabs TTS ────────────────────────────────────────────────────────
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = "JBFqnCBsd6RMkjVDRZzb"   # George — deep, British
    elevenlabs_model: str = "eleven_turbo_v2_5"           # fast + multilingual

    # ── Fish Audio TTS ────────────────────────────────────────────────────────
    fish_audio_api_key: str = ""
    fish_audio_voice_id: str = ""   # model_id from the voice URL on fish.audio

    claude_model: str = "claude-opus-4-8"
    persona: Literal["jarvis", "philos", "merlin"] = "jarvis"

    @property
    def claude_system_prompt(self) -> str:
        return build_system_prompt(self.persona)

    max_session_duration_seconds: int = 300
    max_audio_size_bytes: int = 26_214_400  # 25 MB

    host: str = "127.0.0.1"
    port: int = 8765

    # ── Essence integration ────────────────────────────────────────────────────
    # Shared secret for the internal Essence API route.
    # Must match INTERNAL_ESSENCE_TOKEN in the Next.js environment.
    # Leave unset to disable Essence context injection (graceful degradation).
    internal_essence_token: str | None = None
    essence_base_url: str = "http://localhost:3000"


settings = Settings()
