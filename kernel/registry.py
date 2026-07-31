"""Handler Registry — maps event type → handlers (Capability Registry seed)."""
from __future__ import annotations

from typing import Callable

from kernel.event import Event


class Registry:
    def __init__(self) -> None:
        self._handlers: dict[str, list[Callable[[Event], None]]] = {}

    def register(self, event_type: str, handler: Callable[[Event], None]) -> None:
        self._handlers.setdefault(event_type, []).append(handler)

    def handlers(self, event_type: str) -> list[Callable[[Event], None]]:
        return self._handlers.get(event_type, [])

    def types(self) -> list[str]:
        return sorted(self._handlers)
