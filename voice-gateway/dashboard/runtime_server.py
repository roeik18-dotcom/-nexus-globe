"""Merlin Control Center — local control API + embedded UI.

Bind: 127.0.0.1 only. Run with:
    python -m dashboard.runtime_server
or:
    uvicorn dashboard.runtime_server:app --host 127.0.0.1 --port 8799

Every control here either (a) really changes what the live Merlin runtime does on
its next turn, or (b) is explicitly labeled NOT_IMPLEMENTED / READ_ONLY in
CAPABILITY_MAP below and in the UI. Nothing is faked as active.
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
from pathlib import Path

_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(_ROOT))

from fastapi import FastAPI, HTTPException  # noqa: E402
from fastapi.responses import HTMLResponse, JSONResponse  # noqa: E402
from pydantic import BaseModel  # noqa: E402

from app.control_events import read_last_events  # noqa: E402
from config.merlin_control_schema import (  # noqa: E402
    DEFAULT_CONFIG_PATH,
    live_barge_in_supported,
    load_with_fallback,
    save,
    validate,
)

LAUNCH_AGENT_LABEL = "com.merlin.voice"  # kept for /api/status display only — not used to control the process

app = FastAPI(title="Merlin Control Center")


# ── capability map — the single honest source for what's wired vs not ────────
# status: ACTIVE | RESTART_REQUIRED | READ_ONLY | NOT_IMPLEMENTED
CAPABILITY_MAP: dict[str, dict] = {
    "language.default": {
        "status": "ACTIVE",
        "evidence": "app/context_builder.py::ControlPolicyLayer, read fresh every turn (no cache)",
    },
    "language.allowed_output_languages": {
        "status": "ACTIVE",
        "evidence": "app/context_builder.py::ControlPolicyLayer + app/language_gate.py, "
                    "wired into app/adapters/claude.py::respond()",
    },
    "language.switch_only_on_explicit_request": {
        "status": "ACTIVE",
        "evidence": "Rendered into the prompt instruction; enforcement of "
                    "'explicit request' detection is the model's own compliance, not a "
                    "separate code check — disclosed, not hidden.",
    },
    "language.technical_terms_may_remain_english": {
        "status": "ACTIVE",
        "evidence": "Rendered into the prompt instruction (ControlPolicyLayer).",
    },
    "conversation.default_length": {"status": "ACTIVE", "evidence": "ControlPolicyLayer"},
    "conversation.answer_first": {"status": "ACTIVE", "evidence": "ControlPolicyLayer"},
    "conversation.avoid_repetition": {"status": "ACTIVE", "evidence": "ControlPolicyLayer"},
    "conversation.avoid_stock_phrases": {"status": "ACTIVE", "evidence": "ControlPolicyLayer"},
    "conversation.ask_followup_only_when_blocked": {"status": "ACTIVE", "evidence": "ControlPolicyLayer"},
    "conversation.offer_unrequested_followups": {"status": "ACTIVE", "evidence": "ControlPolicyLayer"},
    "conversation.response_style": {
        "status": "READ_ONLY",
        "evidence": "Schema only allows one value (direct_natural) — nothing branches on it.",
    },
    "turn_control.listen_timeout_seconds": {
        "status": "NOT_IMPLEMENTED",
        "evidence": "Owned by CONVERSATION_TIMEOUT in service/merlin_service.py:106 — "
                    "not wired to this config in the MVP.",
    },
    # Computed at request time in get_control() below, not fixed here — this
    # tracks the real BARGE_IN_ENABLED flag in service/merlin_service.py
    # rather than a hardcoded snapshot that would go stale again.
    "turn_control.interruptions_enabled": None,
    "turn_control.stop_command_enabled": {
        "status": "NOT_IMPLEMENTED",
        "evidence": "No live 'stop' command handling exists — mos/intent_bridge.py's "
                    "stop intent is shadow-only, disconnected from the live path.",
    },
    "triggers": {
        "status": "NOT_IMPLEMENTED",
        "evidence": "Config validates trigger definitions (schema-level, incl. "
                    "duplicate-phrase rejection) but no live code consumes 'triggers' to "
                    "route a transcript to an action.",
    },
    "tools": {
        "status": "NOT_IMPLEMENTED",
        "evidence": "No live tool-calling exists at all — app/adapters/claude.py passes "
                    "no tools= to the Anthropic API. Enabling/disabling here has no "
                    "runtime effect.",
    },
    "persona.profile": {
        "status": "READ_ONLY",
        "evidence": "The live code path checks persona=='merlin' directly "
                    "(app/context_builder.py), not this config field's value.",
    },
    "persona.natural_hebrew": {"status": "READ_ONLY", "evidence": "Redundant with language.default=='he'; not separately wired."},
    "persona.direct_corrections": {"status": "ACTIVE", "evidence": "ControlPolicyLayer (combined with automatic_agreement)"},
    "persona.automatic_agreement": {"status": "ACTIVE", "evidence": "ControlPolicyLayer (combined with direct_corrections)"},
    "runtime.start": {
        "status": "ACTIVE",
        "evidence": "dashboard/runtime_server.py::runtime_start — discovers any live "
                    "merlin_service.py process first (pgrep + ps command-line check) "
                    "and no-ops if one exists; spawns via subprocess.Popen (no shell=True) "
                    "only when none is found.",
    },
    "runtime.stop": {
        "status": "ACTIVE",
        "evidence": "dashboard/runtime_server.py::runtime_stop — verifies the discovered "
                    "PID's command line matches service/merlin_service.py before sending "
                    "SIGTERM; refuses (HTTP 409) otherwise. No pkill/killall.",
    },
}


# ── /api/control ───────────────────────────────────────────────────────────

def _capabilities_snapshot() -> dict:
    """CAPABILITY_MAP with the one runtime-dependent entry filled in fresh —
    see the `None` placeholder and live_barge_in_supported() above."""
    caps = dict(CAPABILITY_MAP)
    if live_barge_in_supported():
        caps["turn_control.interruptions_enabled"] = {
            "status": "ACTIVE",
            "evidence": "BARGE_IN_ENABLED=True in service/merlin_service.py, wired into "
                        "AudioPlayer.play_with_barge_in() / speak_canonical_text(). "
                        "Schema now accepts interruptions_enabled=true.",
        }
    else:
        caps["turn_control.interruptions_enabled"] = {
            "status": "NOT_IMPLEMENTED",
            "evidence": "BARGE_IN_ENABLED=False in service/merlin_service.py. "
                        "Schema rejects true for this field.",
        }
    return caps


@app.get("/api/control")
def get_control():
    cfg, source = load_with_fallback()
    return {"config": cfg.to_dict(), "source": source, "capabilities": _capabilities_snapshot()}


class ControlPut(BaseModel):
    config: dict


@app.put("/api/control")
def put_control(body: ControlPut):
    ok, errors = save(body.config)
    if not ok:
        raise HTTPException(status_code=422, detail={"errors": errors})
    cfg, _ = load_with_fallback()
    return {"status": "SAVED", "config": cfg.to_dict()}


@app.post("/api/control/reload")
def reload_control():
    """Re-read from disk and re-validate. Does NOT prove a live process used it yet —
    that is only knowable from /api/runtime/events (config_version on a real turn)."""
    cfg, source = load_with_fallback()
    return {"status": "SAVED", "source": source, "config_version": cfg.version}


# ── /api/status ────────────────────────────────────────────────────────────
#
# Runtime owner: THIS dashboard process, exclusively — not launchd. launchd is
# not currently loaded for com.merlin.voice in practice (verified: `launchctl
# list` shows nothing), while a real merlin_service.py can still be running
# unmanaged (started by hand). Trusting launchctl alone as the source of truth
# would let /api/runtime/start spawn a SECOND process alongside an unmanaged
# one. So ownership here means: always discover the real OS process first
# (regardless of who started it), never assume a process-manager's registry
# reflects reality.

_SERVICE_MARKER = "service/merlin_service.py"
_managed_proc: subprocess.Popen | None = None  # set only if THIS dashboard spawned it


def _find_live_merlin_pid() -> int | None:
    """Any currently-running merlin_service.py process, regardless of origin
    (launchd, manual shell, or this dashboard). No shell=True; list-form args
    only; no argument is derived from a request body."""
    try:
        out = subprocess.run(
            ["pgrep", "-f", _SERVICE_MARKER], capture_output=True, text=True, timeout=5,
        ).stdout
    except Exception:
        return None
    for tok in out.split():
        try:
            pid = int(tok)
        except ValueError:
            continue
        if pid == os.getpid():
            continue  # never match this dashboard's own process
        cmd = subprocess.run(
            ["ps", "-p", str(pid), "-o", "command="], capture_output=True, text=True, timeout=5,
        ).stdout
        # exclude pgrep/ps/grep self-matches on the search string itself
        if _SERVICE_MARKER in cmd and "pgrep" not in cmd and " ps " not in f" {cmd} ":
            return pid
    return None


def _git_revision() -> str | None:
    try:
        return subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"], cwd=_ROOT,
            capture_output=True, text=True, timeout=5,
        ).stdout.strip() or None
    except Exception:
        return None


@app.get("/api/status")
def get_status():
    cfg, source = load_with_fallback()
    pid = _find_live_merlin_pid()
    return {
        "label": LAUNCH_AGENT_LABEL,
        "loaded": pid is not None,
        "pid": pid,
        "managed_by_dashboard": bool(_managed_proc and _managed_proc.pid == pid),
        "git_revision": _git_revision(),
        "config_version": cfg.version,
        "config_source": source,
        # never expose key values — names only
        "note": "no API keys are exposed by this endpoint",
    }


# ── /api/runtime/* ─────────────────────────────────────────────────────────

@app.post("/api/runtime/start")
def runtime_start():
    """Idempotent: if ANY merlin_service.py is already running (however it was
    started), this is a no-op that reports it — never a second process."""
    existing = _find_live_merlin_pid()
    if existing:
        return {"ok": True, "already_running": True, "pid": existing}
    global _managed_proc
    service_path = _ROOT / "service" / "merlin_service.py"
    if not service_path.exists():
        raise HTTPException(status_code=404, detail=f"not found: {service_path}")
    _managed_proc = subprocess.Popen(
        [sys.executable, str(service_path)],
        cwd=str(_ROOT), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    return {"ok": True, "already_running": False, "pid": _managed_proc.pid}


@app.post("/api/runtime/stop")
def runtime_stop():
    """Verifies the PID's actual command line matches merlin_service.py before
    signaling anything — never a blind kill(pid), never pkill/killall."""
    pid = _find_live_merlin_pid()
    if not pid:
        return {"ok": True, "was_running": False}
    cmd = subprocess.run(
        ["ps", "-p", str(pid), "-o", "command="], capture_output=True, text=True, timeout=5,
    ).stdout
    if _SERVICE_MARKER not in cmd:
        raise HTTPException(
            status_code=409,
            detail=f"refusing to stop pid {pid}: command does not match {_SERVICE_MARKER}",
        )
    os.kill(pid, signal.SIGTERM)
    global _managed_proc
    _managed_proc = None
    return {"ok": True, "was_running": True, "pid": pid}


@app.post("/api/runtime/interrupt")
def runtime_interrupt():
    if not live_barge_in_supported():
        return JSONResponse(
            status_code=501,
            content={
                "status": "unsupported",
                "reason": "Barge-in is not implemented on the live runtime "
                          "(BARGE_IN_ENABLED=False in service/merlin_service.py).",
            },
        )
    # Real capability confirmed — but this console has no live channel to the
    # running merlin_service.py process (no shared state, no IPC; see
    # _find_live_merlin_pid(), which only discovers the PID, nothing more).
    # Faking an executed interrupt here would be exactly the kind of stub
    # behavior this fix removes. The actual control surface for a live
    # interrupt is service/control_panel.py's /api/stop_speaking or
    # /api/cancel_turn (port 8802) — Surface B, not this one.
    return JSONResponse(
        status_code=200,
        content={
            "status": "capability_confirmed_not_executed",
            "reason": "Barge-in is implemented on the live runtime (BARGE_IN_ENABLED=True "
                      "in service/merlin_service.py), but this console has no live control "
                      "channel to execute an interrupt. Use the operational console's "
                      "/api/stop_speaking or /api/cancel_turn instead.",
        },
    )


@app.get("/api/runtime/events")
def runtime_events():
    return {"events": read_last_events(20)}


# ── UI ──────────────────────────────────────────────────────────────────────

_UI_HTML = (Path(__file__).parent / "control_center.html").read_text(encoding="utf-8")


@app.get("/", response_class=HTMLResponse)
def index():
    return _UI_HTML


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8799)
