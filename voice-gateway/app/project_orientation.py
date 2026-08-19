"""PROJECT ORIENTATION — read-only adapter (Merlin Product Recovery, 2026-08-17).

Before this module, a spoken "מה הפרויקטים שלי?" answered "PHILOS does not
manage project records — UNKNOWN". That was HALF true: PHILOS canon indeed
has no project entity, but this machine DOES maintain real project state in
two existing stores, and this adapter projects over them WITHOUT creating
any new write store:

  1. STUDIO LEDGER (~/Dropbox/-STUDIO-SYSTEM/ledger/ledger.json, read via
     the existing `app/studio_index.py`) — real music-project records with
     project_identity, inferred stage, per-pipeline states and explicit
     UNKNOWN reasons. Provenance: the ledger's own `source`/`basis` fields.
  2. PHILOS SHARED STATE (`app/philos_shared_state.py`, read-only HTTP) —
     the Philos Orientation work itself: open loops, latest change, next
     action, evidence. Provenance: /api/canon/shared-state.

Normalized contract per project (every field real or explicitly UNKNOWN):
  PROJECT_ID / PROJECT_NAME / STATUS / WHAT_CHANGED / OPEN_LOOPS /
  BLOCKERS / NEXT_ACTION / EVIDENCE / LAST_UPDATE / PROVENANCE

HONESTY RULES:
  - No field is derived from filenames or assumptions; fields the stores do
    not carry (e.g. studio BLOCKERS — no blocker field exists in the
    ledger) are UNKNOWN with the reason.
  - This module never writes anywhere.
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("merlin.project_orientation")


def _u(reason: str) -> dict:
    return {"value": "UNKNOWN", "reason": reason}


def music_project_rows(limit: int = 6) -> list[dict[str, Any]]:
    """Real studio-ledger projects, normalized. [] when the ledger is
    unreachable (stated by the caller, never faked)."""
    try:
        from app.studio_index import retrieve_studio_project
        res = retrieve_studio_project("", limit=limit)
    except Exception as exc:
        logger.warning("project_orientation: studio ledger read failed: %s", exc)
        return []
    if res.get("status") != "LOADED":
        return []
    rows: list[dict[str, Any]] = []
    for m in res.get("matches", []):
        pid = m.get("project_identity") or {}
        stage = m.get("status_stage") or {}
        tasks = m.get("outstanding_tasks") or {}
        prov = m.get("provenance") or {}
        rows.append({
            "PROJECT_ID": pid.get("id", "UNKNOWN"),
            "PROJECT_NAME": pid.get("name", "UNKNOWN"),
            "STATUS": f"{stage.get('value', 'UNKNOWN')} (canonical: {stage.get('canonical_stage', '?')}, {stage.get('source', '?')})",
            "WHAT_CHANGED": stage.get("basis") or _u("הledger לא רושם שינוי אחרון מפורש"),
            "OPEN_LOOPS": tasks.get("status") if tasks.get("status") and tasks.get("status") != "UNKNOWN"
                          else _u(tasks.get("reason", "אין רשומת משימות פתוחות ב-ledger")),
            "BLOCKERS": _u("ל-ledger אין שדה blocker"),
            "NEXT_ACTION": _u("ה-ledger אינו רושם פעולה הבאה"),
            "EVIDENCE": [x for x in [
                (m.get("mix_state") or {}).get("basis"),
                (m.get("master_state") or {}).get("basis"),
            ] if x],
            "LAST_UPDATE": prov.get("generated_at") or _u("אין חותמת עדכון ברשומה"),
            "PROVENANCE": f"studio ledger · {prov.get('source_file', 'ledger.json')}",
        })
    return rows


def philos_project_row() -> dict[str, Any] | None:
    """The Philos Orientation work itself as ONE project row, from live
    shared state. None when PHILOS is not connected (caller states it)."""
    try:
        from app.philos_shared_state import fetch_shared_state
        res = fetch_shared_state()
    except Exception:
        return None
    if not res.connected or not res.data:
        return None
    d = res.data
    ol = d.get("open_loops") or {}
    brain = d.get("brain") or {}
    changes = brain.get("changes") or []
    na = brain.get("next_action") or None
    evidence = brain.get("evidence") or []
    open_total = (ol.get("no_effect_recorded", 0) or 0) + (ol.get("effect_claimed_only", 0) or 0)
    return {
        "PROJECT_ID": "philos_orientation",
        "PROJECT_NAME": "Philos Orientation",
        "STATUS": f"ACTIVE — {ol.get('effect_verified', 0)} verified effects, {open_total} open loops",
        "WHAT_CHANGED": (changes[0] or {}).get("what_changed") if changes else _u("אין שינוי רשום"),
        "OPEN_LOOPS": f"{open_total} (ללא Effect: {ol.get('no_effect_recorded', 0)} · claimed בלבד: {ol.get('effect_claimed_only', 0)})",
        "BLOCKERS": _u("אין סוג רשומת blocker ב-PHILOS"),
        "NEXT_ACTION": (na.get("label") if isinstance(na, dict) else None) or _u("אין פעולה נגזרת כרגע"),
        "EVIDENCE": evidence[:2],
        "LAST_UPDATE": d.get("asOf", "UNKNOWN"),
        "PROVENANCE": "PHILOS /api/canon/shared-state (read-only)",
    }


def _fmt(v: Any) -> str:
    if isinstance(v, dict) and v.get("value") == "UNKNOWN":
        return f"UNKNOWN ({v.get('reason')})"
    if isinstance(v, list):
        return " · ".join(str(x) for x in v) if v else "—"
    return str(v)


def render_project_orientation(limit: int = 4) -> str:
    """LLM-ready block for project questions — concise per project:
    PROJECT / STATUS / CHANGE / BLOCKER / NEXT ACTION, real data only."""
    lines = ["## PROJECT ORIENTATION (read-only, real stores)"]
    ph = philos_project_row()
    if ph:
        lines.append(
            f"- {ph['PROJECT_NAME']}: STATUS {ph['STATUS']} · שינוי: {_fmt(ph['WHAT_CHANGED'])[:110]} · "
            f"חסימות: {_fmt(ph['BLOCKERS'])} · הבא: {_fmt(ph['NEXT_ACTION'])[:80]} · עודכן: {str(ph['LAST_UPDATE'])[:10]}"
        )
    else:
        lines.append("- Philos Orientation: PHILOS לא מחובר כרגע — מצב לא ידוע")
    music = music_project_rows(limit=limit)
    if music:
        for r in music:
            lines.append(
                f"- {r['PROJECT_NAME']} (מוזיקה): STATUS {r['STATUS']} · שינוי: {_fmt(r['WHAT_CHANGED'])[:90]} · "
                f"לולאות: {_fmt(r['OPEN_LOOPS'])[:60]} · חסימות: {_fmt(r['BLOCKERS'])} · הבא: {_fmt(r['NEXT_ACTION'])}"
            )
    else:
        lines.append("- פרויקטי מוזיקה: ledger לא נגיש כרגע — UNKNOWN")
    lines.append("הנחיה: דבר על פרויקטים תמציתית (שם·סטטוס·שינוי·חסימה·צעד הבא); אל תזרוק IDs גולמיים אלא אם נשאלת; שדה חסר = UNKNOWN.")
    return "\n".join(lines)


def project_orientation_payload(limit: int = 8) -> dict[str, Any]:
    """Panel JSON: the normalized rows themselves."""
    ph = philos_project_row()
    return {
        "philos": ph,
        "philos_connected": ph is not None,
        "music_projects": music_project_rows(limit=limit),
    }
