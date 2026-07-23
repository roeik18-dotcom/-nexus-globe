from app.context_builder import ContextBuilder
from pydantic_settings import BaseSettings, SettingsConfigDict


def build_system_prompt(persona: str) -> str:
    return ContextBuilder.for_session(persona).build()


def build_system_prompt_with_task(persona: str, task=None, summary=None, tool_memory=None) -> str:
    return ContextBuilder.for_session(persona, task, summary, tool_memory).build()


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
    openai_tts_voice: str = "nova"
    adapter: str = "claude"

    claude_model: str = "claude-opus-4-8"
    persona: str = "jarvis"

    @property
    def claude_system_prompt(self) -> str:
        return build_system_prompt(self.persona)

    max_session_duration_seconds: int = 300
    max_audio_size_bytes: int = 26_214_400  # 25 MB

    host: str = "127.0.0.1"
    port: int = 8765


settings = Settings()
