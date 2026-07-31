"""Event Bus — publish / subscribe (RFC-000 §8: all flow goes through the bus)."""
from __future__ import annotations

from typing import Callable

from kernel.event import Event


class Bus:
    def __init__(self) -> None:
        self._subscribers: list[Callable[[Event], None]] = []

    def subscribe(self, fn: Callable[[Event], None]) -> Callable[[Event], None]:
        self._subscribers.append(fn)
        return fn

    def publish(self, event: Event) -> None:
        for fn in list(self._subscribers):
            fn(event)
