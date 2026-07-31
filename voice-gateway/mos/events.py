"""Merlin OS · Event model + minimal bus/store (v0).

Implements the canonical Event shape from docs/architecture/adr-003-event-model.md
and the constitution's INV-1 (timestamped), INV-5 (state = fold over events),
R-1 (append-only, immutable), R-2 (no authoritative state outside the log).

v0 scope (honest): the bus/store are IN-MEMORY and NOT durable. This is the smallest
substrate that lets the first real module (Cognition) run event-sourced. A durable
Event Store is a later build task (ADR-003 Consequences / RFC-001 LEVEL 1).
"""
from __future__ import annotations

import datetime
import itertools
from dataclasses import dataclass, field, replace
from typing import Any, Callable, Optional

_seq = itertools.count(1)


@dataclass(frozen=True)
class Event:
    """Immutable, append-only, timestamped fact (ADR-003 canonical shape)."""
    id: str
    seq: int                       # monotonic; (timestamp, seq) = total order (R-3)
    type: str                      # dotted, e.g. "intent.classified"
    timestamp: str                 # ISO-8601 (INV-1)
    actor: str                     # who/what caused it (Origin, INV-3)
    subject: str                   # the Entity it is about
    payload: dict                  # type-specific (R-5)
    correlation_id: Optional[str] = None   # groups one turn/session
    causation_id: Optional[str] = None     # the event/command that caused this
    version: int = 1


def new_event(
    type: str,
    actor: str,
    subject: str,
    payload: dict,
    *,
    correlation_id: Optional[str] = None,
    causation_id: Optional[str] = None,
    version: int = 1,
) -> Event:
    seq = next(_seq)
    return Event(
        id=f"evt-{seq:06d}",
        seq=seq,
        type=type,
        timestamp=datetime.datetime.now().isoformat(timespec="milliseconds"),
        actor=actor,
        subject=subject,
        payload=dict(payload),
        correlation_id=correlation_id,
        causation_id=causation_id,
        version=version,
    )


class EventBus:
    """Minimal append-only log + pub/sub (R-1, R-4). v0, in-memory, single-process."""

    def __init__(self, store: "Any | None" = None) -> None:
        self._log: list[Event] = []
        self._subs: list[Callable[[Event], None]] = []
        self._store = store                  # optional durable sink (duck-typed .append)

    def subscribe(self, fn: Callable[[Event], None]) -> None:
        self._subs.append(fn)

    def publish(self, event: Event) -> Event:
        self._log.append(event)              # in-memory append-only (R-1); never mutate
        if self._store is not None:
            self._store.append(event)        # durable append-only (survives restart)
        for fn in list(self._subs):
            fn(event)
        return event

    def load_from(self, events: list[Event]) -> None:
        """Rehydrate the in-memory log from a durable store WITHOUT re-firing
        subscribers (replay-to-restore-state, not re-execute). INV-5 / R-2."""
        self._log.extend(events)

    @property
    def log(self) -> list[Event]:
        return list(self._log)               # copy; the log is not externally mutable

    def fold(self, reduce_fn: Callable[[Any, Event], Any], seed: Any) -> Any:
        """State is a fold over events (INV-5 / R-2), never stored separately."""
        acc = seed
        for e in self._log:
            acc = reduce_fn(acc, e)
        return acc

    def by_correlation(self, correlation_id: str) -> list[Event]:
        return [e for e in self._log if e.correlation_id == correlation_id]
