"""Kernel Health — self-report per OBS-001."""
from __future__ import annotations


class Health:
    def __init__(self, kernel) -> None:
        self._k = kernel
        self._errors: list[str] = []

    def error(self, msg: str) -> None:
        self._errors.append(msg)

    def observe(self) -> dict:
        return {
            "subsystem": "kernel",
            "health": "green" if not self._errors else "yellow",
            "version": "0.0.1",
            "event_count": len(self._k.store),
            "last_event": self._k.state.last_event_type,
            "nodes": len(self._k.state.world_graph["nodes"]),
            "edges": len(self._k.state.world_graph["edges"]),
            "errors": list(self._errors),
        }
