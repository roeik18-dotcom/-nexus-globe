"""Merlin OS · Durable Event Store (append log → replay → projection → state).

Makes "Merlin remembers" true: events are appended to a durable JSONL log that
survives restart. State is rebuilt by folding the log (INV-5 / ADR-003 R-2); no
authoritative state is kept outside it.

    Event → append (JSONL) → load/replay → fold → State / projections

v0 scope: single-file JSONL, single-process, no compaction. Adequate as the real
Event Store the platform lacked (ADR-003 named this a build task). Durability =
fsync-on-append is optional (default off for speed; on for crash-safety).
"""
from __future__ import annotations

import json
import os
from dataclasses import asdict
from typing import Iterator

from .events import Event

_FIELDS = ("id", "seq", "type", "timestamp", "actor", "subject", "payload",
           "correlation_id", "causation_id", "version")


def to_dict(e: Event) -> dict:
    return asdict(e)


def from_dict(d: dict) -> Event:
    return Event(**{k: d.get(k) for k in _FIELDS})


class JsonlEventStore:
    """Append-only durable log, one JSON event per line (R-1: never edited/deleted)."""

    def __init__(self, path: str, fsync: bool = False) -> None:
        self.path = os.path.expanduser(path)
        self.fsync = fsync
        os.makedirs(os.path.dirname(self.path) or ".", exist_ok=True)

    def append(self, event: Event) -> None:
        with open(self.path, "a", encoding="utf-8") as f:
            f.write(json.dumps(to_dict(event), ensure_ascii=False) + "\n")
            if self.fsync:
                f.flush()
                os.fsync(f.fileno())

    def load(self) -> list[Event]:
        if not os.path.exists(self.path):
            return []
        out: list[Event] = []
        with open(self.path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    out.append(from_dict(json.loads(line)))   # R-5: unknown types kept
        return out

    def replay(self, reduce_fn, seed):
        """State = fold over the durable log (INV-5)."""
        acc = seed
        for e in self.load():
            acc = reduce_fn(acc, e)
        return acc

    def __iter__(self) -> Iterator[Event]:
        return iter(self.load())

    def count(self) -> int:
        return sum(1 for _ in self)


def _demo() -> None:
    import tempfile
    from .events import new_event, EventBus

    path = os.path.join(tempfile.gettempdir(), "mos_demo_events.jsonl")
    if os.path.exists(path):
        os.remove(path)

    # session 1: publish through a bus backed by the durable store
    store = JsonlEventStore(path)
    bus = EventBus(store=store)
    bus.publish(new_event("intent.classified", "mos.intent", "intent:ask_time",
                          {"intent": "ask_time", "confidence": 0.95}, correlation_id="t1"))
    bus.publish(new_event("decision.made", "mos.cognition", "intent:ask_time",
                          {"decision": "read_clock", "confidence": 0.95}, correlation_id="t1"))
    print(f"session 1 wrote {store.count()} events to {path}")

    # session 2 (simulated restart): a fresh bus rehydrates from the SAME durable log
    bus2 = EventBus(store=JsonlEventStore(path))
    bus2.load_from(JsonlEventStore(path).load())
    decisions = bus2.fold(
        lambda acc, e: acc + [e.payload["decision"]] if e.type == "decision.made" else acc, [])
    print(f"session 2 rebuilt state from disk → decisions = {decisions}  (Merlin remembers)")


if __name__ == "__main__":
    _demo()
