"""Turn-scoped trace context — thread-safe via ContextVar.

Each WebSocket handler creates a TurnTrace and calls set_trace(); all layers
in the same asyncio task can then call emit() without passing the trace down
through function signatures.
"""

from contextvars import ContextVar

from app.trace import TraceStep, TurnTrace

_current: ContextVar[TurnTrace | None] = ContextVar("nexus_turn_trace", default=None)


def set_trace(trace: TurnTrace) -> None:
    _current.set(trace)


def get_trace() -> TurnTrace | None:
    return _current.get()


def emit(step: TraceStep) -> None:
    trace = _current.get()
    if trace is not None:
        trace.add_step(step)
