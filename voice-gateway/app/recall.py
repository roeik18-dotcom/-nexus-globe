"""Deterministic recall policy — selects relevant memory items for a turn.

Rules (in priority order, applied only when context exists):
  1. global  — keys in GLOBAL_KEYS are always included
  2. persona — keys prefixed with "{persona}_"
  3. task    — keys/values share words with the current task title+description
  4. keyword — keys/values share words with the user message

When no context (task=None and empty user_message), all items pass through
with reason="all" so that callers without a turn context still see full memory.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Literal

GLOBAL_KEYS: frozenset[str] = frozenset({
    "owner",
    "name",
    "user_name",
    "lang",
    "language",
    "locale",
    "tone",
    "style",
    "timezone",
    "location",
})

RecallReason = Literal["global", "persona", "task", "keyword", "all"]


@dataclass(frozen=True)
class RecallItem:
    key: str
    value: Any
    reason: RecallReason


def _words(text: str) -> frozenset[str]:
    """Lowercase alphabetic tokens of 3+ characters extracted from text."""
    return frozenset(w for w in re.findall(r"[a-z]+", text.lower()) if len(w) >= 3)


class RecallPolicy:
    """Deterministic memory selector — no LLM, no embeddings."""

    def __init__(
        self,
        global_keys: frozenset[str] = GLOBAL_KEYS,
        max_items: int = 20,
    ) -> None:
        self._global_keys = global_keys
        self._max_items = max_items

    def select(
        self,
        memory: dict,
        persona: str,
        current_task=None,
        user_message: str = "",
    ) -> list[RecallItem]:
        if not memory:
            return []

        # No context → pass through everything up to limit
        if current_task is None and not user_message.strip():
            return [
                RecallItem(key=k, value=v, reason="all")
                for k, v in list(memory.items())[: self._max_items]
            ]

        selected: dict[str, RecallItem] = {}

        # Rule 1: Global keys
        for key, value in memory.items():
            if key in self._global_keys:
                selected[key] = RecallItem(key=key, value=value, reason="global")

        # Rule 2: Persona-prefixed keys
        persona_prefix = f"{persona}_"
        for key, value in memory.items():
            if key not in selected and key.startswith(persona_prefix):
                selected[key] = RecallItem(key=key, value=value, reason="persona")

        # Rule 3: Task-matched keys
        if current_task is not None:
            task_text = (
                (getattr(current_task, "title", "") or "")
                + " "
                + (getattr(current_task, "description", "") or "")
            )
            task_words = _words(task_text)
            if task_words:
                for key, value in memory.items():
                    if key not in selected:
                        if task_words & _words(key + " " + str(value)):
                            selected[key] = RecallItem(key=key, value=value, reason="task")

        # Rule 4: Keyword-matched from user message
        if user_message.strip():
            msg_words = _words(user_message)
            if msg_words:
                for key, value in memory.items():
                    if key not in selected:
                        if msg_words & _words(key + " " + str(value)):
                            selected[key] = RecallItem(key=key, value=value, reason="keyword")

        return list(selected.values())[: self._max_items]


default_recall_policy = RecallPolicy()
