"""Deny-first registry of named CONDITION_WATCH predicates.

No real external condition source (a clock event, a file change, a market
threshold) is wired into this registry this pass — same posture as the rest
of this framework build: the mechanism is real and tested, the live signal
source is a deliberate follow-up (see REAL_PROVIDER_STATUS in the phase
report). Only test/example predicates are registered here. A predicate name
that is not registered NEVER resolves to "always fire" — it resolves to
None, and the engine refuses to create or tick a CONDITION_WATCH automation
against an unknown predicate.
"""

from __future__ import annotations

from typing import Callable, Optional

Predicate = Callable[[], bool]

_REGISTRY: dict[str, Predicate] = {}


def register_predicate(name: str, fn: Predicate) -> None:
    if name in _REGISTRY:
        raise ValueError(f"duplicate predicate name: {name}")
    _REGISTRY[name] = fn


def resolve_predicate(name: str) -> Optional[Predicate]:
    return _REGISTRY.get(name)


def predicate_names() -> list[str]:
    return sorted(_REGISTRY)


# ── built-in example/test predicates ────────────────────────────────────────

register_predicate("always_true", lambda: True)
register_predicate("always_false", lambda: False)
