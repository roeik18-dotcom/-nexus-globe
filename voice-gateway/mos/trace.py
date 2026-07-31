"""Merlin OS · Trace engine.

Every event already carries `correlation_id` (the turn) and `causation_id` (its
direct cause). A Trace reconstructs the full path of one turn, so when something
fails you see immediately at which stage:

    user.spoke → intent.classified → cognition.seam.* → decision.made
               → action.gated → approval.granted → action.result

Read-only projection over the event log (works on an in-memory bus log OR the
durable JSONL store). Powers a clickable Trace view in Mission Control.
"""
from __future__ import annotations

from dataclasses import dataclass

from .events import Event

# stages we consider "terminal-good" for a turn (reached a real outcome)
_GOOD_TERMINALS = {"action.result", "decision.made"}
_STUCK = {"action.gated"}          # awaiting approval — not failed, but not done
_BAD = ("error", "failed", "timeout", "rejected")


def turn_events(events: list[Event], correlation_id: str) -> list[Event]:
    return sorted((e for e in events if e.correlation_id == correlation_id),
                  key=lambda e: e.seq)


def correlations(events: list[Event]) -> list[str]:
    seen: list[str] = []
    for e in events:
        if e.correlation_id and e.correlation_id not in seen:
            seen.append(e.correlation_id)
    return seen


def causal_chain(events: list[Event], event_id: str) -> list[Event]:
    """Follow causation_id backwards from event_id to the root."""
    by_id = {e.id: e for e in events}
    chain: list[Event] = []
    cur = by_id.get(event_id)
    while cur is not None:
        chain.append(cur)
        cur = by_id.get(cur.causation_id) if cur.causation_id else None
    return list(reversed(chain))


@dataclass
class TraceSummary:
    trace_id: str            # = correlation_id
    n_events: int
    path: list[str]          # event types in order
    outcome: str             # "done" | "awaiting_approval" | "failed" | "open"
    failed_stage: str | None


def summarize(events: list[Event], correlation_id: str) -> TraceSummary:
    evs = turn_events(events, correlation_id)
    path = [e.type for e in evs]
    failed = next((t for t in path if any(b in t for b in _BAD)), None)
    if failed:
        outcome = "failed"
    elif any(t in _STUCK for t in path) and "action.result" not in path:
        outcome = "awaiting_approval"
    elif any(t in _GOOD_TERMINALS for t in path):
        outcome = "done"
    else:
        outcome = "open"
    return TraceSummary(trace_id=correlation_id, n_events=len(evs), path=path,
                        outcome=outcome, failed_stage=failed)


def render(events: list[Event], correlation_id: str) -> str:
    evs = turn_events(events, correlation_id)
    return " → ".join(e.type for e in evs)


def _demo() -> None:
    from .runtime import Runtime
    rt = Runtime()
    rt.handle_intent("ask_time", 0.95)
    rt.handle_intent("open_app", 0.9)         # will gate (awaiting approval)
    log = rt.bus.log
    for cid in correlations(log):
        s = summarize(log, cid)
        print(f"TRACE {s.trace_id:<16} [{s.outcome:<17}] {s.n_events} events")
        print(f"   {render(log, cid)}")


if __name__ == "__main__":
    _demo()
