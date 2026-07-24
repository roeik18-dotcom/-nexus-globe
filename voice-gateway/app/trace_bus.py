"""TraceBus — publish-subscribe registry for TurnTrace events.

Architecture:
  Runtime calls trace_bus.publish(trace) once per turn.
  Consumers (JSON log, Benchmark, Visualization SSE) call subscribe() at startup.
  A failing subscriber never crashes the Runtime — errors are logged and skipped.

Usage:
    from app.trace_bus import trace_bus

    # Consumer (called once at startup):
    trace_bus.subscribe(my_handler)

    # Runtime (called once per turn):
    trace_bus.publish(trace)
"""

import logging
from collections.abc import Callable

from app.trace import TurnTrace

logger = logging.getLogger(__name__)

TraceFn = Callable[[TurnTrace], None]


class TraceBus:
    def __init__(self) -> None:
        self._subscribers: list[TraceFn] = []

    def subscribe(self, fn: TraceFn) -> None:
        self._subscribers.append(fn)
        logger.debug("trace_bus: registered %s", getattr(fn, "__name__", repr(fn)))

    def publish(self, trace: TurnTrace) -> None:
        for fn in self._subscribers:
            try:
                fn(trace)
            except Exception as exc:
                logger.error(
                    "trace_bus: subscriber %s raised: %s",
                    getattr(fn, "__name__", repr(fn)),
                    exc,
                )


# Global singleton — import and use directly.
trace_bus = TraceBus()
