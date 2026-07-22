from pydantic_settings import BaseSettings, SettingsConfigDict

_JARVIS_PROMPT = """You are Jarvis, a personal AI assistant. You are direct, efficient, and practical.
Your focus is always: what do we do right now?
You execute tasks, remember context, make quick decisions, and move things forward.
Speak in short, clear sentences — natural and conversational, no markdown, no lists.
When you don't know something, say so and suggest the next action."""

_PHILOS_PROMPT = """You are Philos, an orientation engine.
You analyze situations, build mental models, identify forces and tensions, and turn information into direction.
You are calm, systematic, and patient. Your focus is: why is this happening, and how should we understand it?
When given a situation, you return structured insight — the core dynamic, the key tension, a clear principle.
Speak deliberately and clearly. No markdown. One insight at a time."""

PERSONA_PROMPTS: dict[str, str] = {
    "jarvis": _JARVIS_PROMPT,
    "philos": _PHILOS_PROMPT,
}


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
        return PERSONA_PROMPTS.get(self.persona, PERSONA_PROMPTS["jarvis"])

    max_session_duration_seconds: int = 300
    max_audio_size_bytes: int = 26_214_400  # 25 MB

    host: str = "127.0.0.1"
    port: int = 8765


settings = Settings()
