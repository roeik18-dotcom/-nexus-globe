"""Merlin Kernel v0 — Event → Bus → Store → Reducer → State.

The smallest *living* system: an action emits an Event; it flows through the Bus into
the append-only Store; the Reducer folds the log into State (incl. the Living World
Graph). Not a full system — but a running one.
"""
from __future__ import annotations

from kernel.event import Event, UserSpoke          # noqa: F401
from kernel.event_store import EventStore
from kernel.state import State
from kernel.reducer import build_state
from kernel.bus import Bus
from kernel.registry import Registry
from kernel.health import Health


class Kernel:
    def __init__(self) -> None:
        self.store = EventStore()
        self.state = State()
        self.bus = Bus()
        self.registry = Registry()
        self.health = Health(self)
        self.bus.subscribe(self._on_event)          # Event → Store → Reducer → State

    def publish(self, event: Event) -> None:
        self.bus.publish(event)

    def _on_event(self, event: Event) -> None:
        self.store.append(event)                     # EVENT STORED
        self.state = build_state(self.store.events())  # STATE + WORLD GRAPH UPDATED
