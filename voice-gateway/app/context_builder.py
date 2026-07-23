"""Assembles the per-turn system prompt from ordered context layers."""

import json
import logging
from pathlib import Path
from typing import Protocol

logger = logging.getLogger(__name__)

_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
_MEMORY_DIR = Path(__file__).parent.parent / "memory" / "persistent"


def _load_prompt_layer(name: str) -> str:
    path = _PROMPTS_DIR / f"{name}.md"
    return path.read_text(encoding="utf-8") if path.exists() else ""


def _load_memory_dict(persona: str) -> dict:
    path = _MEMORY_DIR / f"{persona}.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


class ContextLayer(Protocol):
    def render(self) -> str: ...


class BaseIdentityLayer:
    def __init__(self, persona: str) -> None:
        self._persona = persona

    def render(self) -> str:
        return _load_prompt_layer("base")


class PersonaLayer:
    def __init__(self, persona: str) -> None:
        self._persona = persona

    def render(self) -> str:
        return _load_prompt_layer(self._persona)


class PersistentMemoryLayer:
    def __init__(self, persona: str, task=None, user_message: str = "", policy=None) -> None:
        from app.recall import default_recall_policy
        self._persona = persona
        self._task = task
        self._user_message = user_message
        self._policy = policy if policy is not None else default_recall_policy

    def render(self) -> str:
        memory = _load_memory_dict(self._persona)
        if not memory:
            return ""
        items = self._policy.select(memory, self._persona, self._task, self._user_message)
        if not items:
            return ""
        selected = {item.key: item.value for item in items}
        return f"## Persistent memory\n\n```json\n{json.dumps(selected, ensure_ascii=False, indent=2)}\n```"


class SessionSummaryLayer:
    def __init__(self, summary) -> None:
        self._summary = summary

    def render(self) -> str:
        if not self._summary or not self._summary.text:
            return ""
        return f"## Session Summary\n\n{self._summary.text}"


class CurrentTaskLayer:
    def __init__(self, task) -> None:
        self._task = task

    def render(self) -> str:
        if self._task is None:
            return ""
        block = f"## Current Task\n\nTitle: {self._task.title}\nStatus: {self._task.status}"
        if self._task.description:
            block += f"\nContext: {self._task.description}"
        return block


class ToolMemoryLayer:
    def __init__(self, entries: list) -> None:
        self._entries = entries

    def render(self) -> str:
        from app.tool_memory import format_block
        return format_block(self._entries)


class ContextBuilder:
    def __init__(self, layers: list) -> None:
        self._layers = layers

    def build(self) -> str:
        sections = [layer.render() for layer in self._layers]
        return "\n\n---\n\n".join(s.strip() for s in sections if s.strip())

    @classmethod
    def for_session(
        cls,
        persona: str,
        task=None,
        summary=None,
        tool_memory=None,
        user_message: str = "",
    ) -> "ContextBuilder":
        return cls([
            BaseIdentityLayer(persona),
            PersonaLayer(persona),
            PersistentMemoryLayer(persona, task=task, user_message=user_message),
            SessionSummaryLayer(summary),
            CurrentTaskLayer(task),
            ToolMemoryLayer(tool_memory or []),
        ])
