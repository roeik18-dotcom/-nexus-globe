from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    anthropic_api_key: str
    openai_api_key: str

    stt_provider: str = "whisper"
    tts_provider: str = "openai"
    openai_tts_voice: str = "nova"
    adapter: str = "claude"

    claude_model: str = "claude-opus-4-8"
    claude_system_prompt: str = (
        "You are a helpful voice assistant. Keep responses concise and conversational, "
        "suitable for speech. Avoid markdown, bullet points, and formatting — speak naturally."
    )

    max_session_duration_seconds: int = 300
    max_audio_size_bytes: int = 26_214_400  # 25 MB

    host: str = "127.0.0.1"
    port: int = 8765


settings = Settings()
