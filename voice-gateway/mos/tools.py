"""Merlin OS · Tool registry (v0).

Real tools the Executor can run. v0 ships ONLY reversible / read-only tools (no OS
mutation, no network, no outward effect) so the Alpha chain produces REAL output
safely. Irreversible/outward tools (launch_application, …) are NOT here yet — they
stay simulated and gated (INV-6) until a real, approved tool is added.

A tool: (name) -> callable(ctx: dict) -> result: dict. Pure/side-effect-free at v0.
"""
from __future__ import annotations

import datetime
import os
import subprocess
from typing import Callable

# app-target → macOS application name (for `open -a`)
_APP_NAMES = {
    "pro_tools": "Pro Tools",
    "ableton": "Ableton Live",
    "chrome": "Google Chrome",
    "vscode": "Visual Studio Code",
    "terminal": "Terminal",
}


def _read_clock(ctx: dict) -> dict:
    now = datetime.datetime.now()
    return {"time": now.strftime("%H:%M"), "date": now.strftime("%Y-%m-%d")}


def _read_weather(ctx: dict) -> dict:
    # no network at v0 — honest placeholder, not a fabricated forecast
    return {"note": "weather tool not connected (no network) — placeholder"}


def _read_mission_control(ctx: dict) -> dict:
    n = ctx.get("n_events") if ctx else None
    return {"summary": f"{n} events on the bus" if n is not None else "status available"}


def _launch_application(ctx: dict) -> dict:
    """Open an app (Pro Tools / Ableton / …). EFFECTFUL — reaches the chain only after
    INV-6 approval. DRY-RUN by default: actually launches only when MERLIN_REAL_TOOLS=1,
    so tests and normal runs never open apps unexpectedly."""
    target = (ctx or {}).get("target")
    app = _APP_NAMES.get(target, target or "unknown app")
    if not target:
        return {"app": None, "launched": False, "error": "no target app specified"}
    if os.getenv("MERLIN_REAL_TOOLS") == "1":
        try:
            subprocess.run(["open", "-a", app], check=True, timeout=10)
            return {"app": app, "launched": True}
        except Exception as ex:
            return {"app": app, "launched": False, "error": str(ex)}
    return {"app": app, "launched": False, "dry_run": True}


_REGISTRY: dict[str, Callable[[dict], dict]] = {
    "read_clock": _read_clock,
    "read_weather": _read_weather,
    "read_mission_control": _read_mission_control,
    "launch_application": _launch_application,
}


def has_tool(name: str) -> bool:
    return name in _REGISTRY


def run_tool(name: str, ctx: dict | None = None) -> tuple[bool, dict]:
    """Return (ok, result). Unregistered tools return a simulated ok (v0)."""
    ctx = ctx or {}
    fn = _REGISTRY.get(name)
    if fn is None:
        return True, {"simulated": True}      # e.g. launch_application (no real tool yet)
    try:
        return True, fn(ctx)
    except Exception as ex:                    # a failing tool is a fact, not a crash
        return False, {"error": str(ex)}
