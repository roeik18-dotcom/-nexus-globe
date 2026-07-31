"""Merlin OS · Latency projection — per-stage decision time (KPI).

Read-model over the event log: for one turn, the elapsed time between pipeline stages
and the total decision time. Data-driven optimization instead of gut feeling. Uses the
event timestamps (INV-1). In-process stages are sub-millisecond; the big numbers show
up once real work (STT, real tools) sits on a stage.
"""
from __future__ import annotations

import datetime

from .events import Event

# canonical stage order for a turn
_ORDER = ["user.spoke", "intent.classified", "decision.made", "plan.created",
          "permission.required", "tool.executed", "response.generated",
          "learning.updated"]


def _ts(e: Event) -> datetime.datetime:
    return datetime.datetime.fromisoformat(e.timestamp)


def stage_latencies(events: list[Event], correlation_id: str) -> dict:
    evs = sorted((e for e in events if e.correlation_id == correlation_id),
                 key=lambda e: e.seq)
    first_ts: dict[str, datetime.datetime] = {}
    for e in evs:
        if e.type in _ORDER and e.type not in first_ts:
            first_ts[e.type] = _ts(e)
    present = [(k, first_ts[k]) for k in _ORDER if k in first_ts]
    stages: dict[str, float] = {}
    for i in range(1, len(present)):
        ms = (present[i][1] - present[i - 1][1]).total_seconds() * 1000.0
        stages[f"{present[i-1][0]} → {present[i][0]}"] = round(ms, 1)
    total = ((present[-1][1] - present[0][1]).total_seconds() * 1000.0
             if len(present) > 1 else 0.0)
    return {"stages": stages, "total_ms": round(total, 1), "n_stages": len(present)}
