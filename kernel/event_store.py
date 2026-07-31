"""Append-only Event log — the single source of truth (ADR-003 R-1)."""
from __future__ import annotations

from kernel.event import Event


class EventStore:
    def __init__(self) -> None:
        self._log: list[Event] = []

    def append(self, event: Event) -> Event:
        self._log.append(event)          # never edited, never deleted
        return event

    def events(self, upto_seq: int | None = None) -> list[Event]:
        if upto_seq is None:
            return list(self._log)
        return [e for e in self._log if e.seq <= upto_seq]   # time-travel (INV-5)

    def __len__(self) -> int:
        return len(self._log)
