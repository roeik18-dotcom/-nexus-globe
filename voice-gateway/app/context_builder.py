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


def load_memory_dict(persona: str) -> dict:
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
    """Renders pre-selected recall items into the system prompt.

    When recall_result is None (no turn context), falls back to rendering
    the full memory file so that callers like build_system_prompt() still work.
    """

    def __init__(self, persona: str = "", *, recall_result=None) -> None:
        self._recall_result = recall_result
        self._persona = persona

    def render(self) -> str:
        if self._recall_result is not None:
            items = self._recall_result.items
        else:
            from app.recall import RecallItem
            memory = load_memory_dict(self._persona)
            items = [RecallItem(key=k, value=v, reason="all") for k, v in memory.items()]

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


class EssenceContextLayer:
    """Renders a pre-fetched Essence context block into the system prompt."""

    def __init__(self, block: str) -> None:
        self._block = block

    def render(self) -> str:
        return self._block  # Already formatted with provenance by essence_context.py


_RELATIONSHIP_MEMORY_FILE = Path(__file__).parent.parent / "memory" / "relationship" / "memories.json"
_IMPORTANCE_RANK = {"critical": 0, "high": 1, "medium": 2, "low": 3}


class RelationshipMemoryLayer:
    """Injects relationship memories into the system prompt.

    Self-loading: reads memory/relationship/memories.json on every render so
    memories written by the background extractor appear in the next turn
    without any change to the ContextBuilder interface.
    """

    _MAX_ITEMS = 20

    def render(self) -> str:
        if not _RELATIONSHIP_MEMORY_FILE.exists():
            return ""
        try:
            data    = json.loads(_RELATIONSHIP_MEMORY_FILE.read_text(encoding="utf-8"))
            raw     = data.get("memories", [])
        except Exception:
            return ""

        if not raw:
            return ""

        ranked = sorted(raw, key=lambda m: (
            _IMPORTANCE_RANK.get(m.get("importance", "medium"), 2),
            m.get("last_used", ""),
        ), reverse=False)

        # Always include critical/high; pad with medium if space allows
        top = [m for m in ranked if m.get("importance") in ("critical", "high")]
        if len(top) < self._MAX_ITEMS:
            medium = [m for m in ranked if m.get("importance") == "medium"]
            top += medium[: self._MAX_ITEMS - len(top)]
        top = top[: self._MAX_ITEMS]

        # Group by tier/category for readability
        groups: dict[str, list[str]] = {}
        for m in top:
            label = f"{m.get('tier','personal')}/{m.get('category','fact')}"
            groups.setdefault(label, []).append(
                f"  - {m['key']}: {m['value']}"
            )

        lines = ["## What I know about you (relationship memory)\n"]
        for label, items in groups.items():
            lines.append(f"**{label}**")
            lines.extend(items)
            lines.append("")

        return "\n".join(lines).strip()


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
        recall_result=None,
        essence_context: str = "",
    ) -> "ContextBuilder":
        layers: list = [
            BaseIdentityLayer(persona),
            PersonaLayer(persona),
            PersistentMemoryLayer(recall_result=recall_result, persona=persona),
            RelationshipMemoryLayer(),
            SessionSummaryLayer(summary),
            CurrentTaskLayer(task),
            ToolMemoryLayer(tool_memory or []),
        ]
        if essence_context:
            layers.append(EssenceContextLayer(essence_context))
        return cls(layers)
