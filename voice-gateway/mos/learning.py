"""Merlin OS · Learning layer (v0) — closes the §4 loop.

The final stage of Perception→Intent→Cognition→Planning→Action→**Learning**. It folds
outcomes back into *priors*: which intents recur, which decisions/tools are used, and
how turns end (executed / gated / abstained). A read-model over the event log (INV-5),
plus a `Learner` subscriber that emits `learning.updated` after each turn so learning
is observable in traces.

v0 accumulates priors only; it does not yet feed them back into confidence/calibration
(that is the next depth — and must respect the locked Philos theory, INV-9).
"""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field

from .events import Event, EventBus, new_event


@dataclass
class Priors:
    intents: Counter = field(default_factory=Counter)
    decisions: Counter = field(default_factory=Counter)
    tools: Counter = field(default_factory=Counter)
    outcomes: Counter = field(default_factory=Counter)   # executed / gated / abstained

    @classmethod
    def from_events(cls, events: list[Event]) -> "Priors":
        p = cls()
        for e in events:
            if e.type == "intent.classified":
                p.intents[e.payload.get("intent", "?")] += 1
            elif e.type == "decision.made":
                d = e.payload.get("decision")
                p.decisions[d] += 1
                if d == "ask_clarify":
                    p.outcomes["abstained"] += 1
            elif e.type == "tool.executed":
                p.tools[e.payload.get("tool", "?")] += 1
                p.outcomes["executed"] += 1
            elif e.type == "permission.required":
                p.outcomes["gated"] += 1
        return p

    def snapshot(self) -> dict:
        return {"n_intents": sum(self.intents.values()),
                "top_intents": dict(self.intents.most_common(3)),
                "top_tools": dict(self.tools.most_common(3)),
                "outcomes": dict(self.outcomes)}


class Learner:
    """Subscriber that folds outcomes into priors and emits learning.updated."""

    def __init__(self, bus: EventBus) -> None:
        self.bus = bus
        bus.subscribe(self._on)

    def priors(self) -> Priors:
        return Priors.from_events(self.bus.log)

    def _on(self, e: Event) -> None:
        if e.type != "response.generated":
            return
        self.bus.publish(new_event(
            "learning.updated", "mos.learning", "priors",
            self.priors().snapshot(),
            correlation_id=e.correlation_id, causation_id=e.id))
