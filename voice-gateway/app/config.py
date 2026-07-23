import json
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
_MEMORY_DIR = Path(__file__).parent.parent / "memory" / "persistent"


def _load_prompt_layer(name: str) -> str:
    path = _PROMPTS_DIR / f"{name}.md"
    return path.read_text(encoding="utf-8") if path.exists() else ""


def _load_memory(persona: str) -> str:
    path = _MEMORY_DIR / f"{persona}.json"
    if not path.exists():
        return ""
    data = json.loads(path.read_text(encoding="utf-8"))
    return f"## Persistent memory\n\n```json\n{json.dumps(data, ensure_ascii=False, indent=2)}\n```"


def build_system_prompt(persona: str) -> str:
    layers = [
        _load_prompt_layer("base"),
        _load_prompt_layer(persona),
        _load_memory(persona),
    ]
    return "\n\n---\n\n".join(layer.strip() for layer in layers if layer.strip())


def build_system_prompt_with_task(persona: str, task=None, summary=None) -> str:
    sections = [build_system_prompt(persona)]
    if summary and summary.text:
        sections.append(f"## Session Summary\n\n{summary.text}")
    if task is not None:
        task_block = f"## Current Task\n\nTitle: {task.title}\nStatus: {task.status}"
        if task.description:
            task_block += f"\nContext: {task.description}"
        sections.append(task_block)
    return "\n\n---\n\n".join(sections)


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
