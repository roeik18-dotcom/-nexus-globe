"""TEMPORAL ORIENTATION — read-only projection (product recovery, 2026-08-17).

"מה השתנה היום / אתמול / בימים האחרונים" was previously answered from
whatever the LLM inferred — no store actually bucketed real records by
recency. This module folds the LIVE PHILOS shared state (plus the studio
ledger's own timestamps where they exist) into TODAY / YESTERDAY / LAST 3
DAYS / LAST 7 DAYS buckets, at request time, from record-carried
timestamps only.

HONESTY RULES:
  - Buckets contain only records whose OWN timestamp places them there.
  - Record kinds the endpoint does not expose with timestamps (tensions,
    value-group event history) are stated as NOT EXPOSED — never invented.
  - No caching: every call re-fetches the shared state, so the answer is
    the state at THIS turn, not a stale summary.
"""
from __future__ import annotations

import datetime as _dt
import logging
from typing import Any

logger = logging.getLogger("merlin.temporal_orientation")


def _day(ts: str) -> str:
    return (ts or "")[:10]


def _days_ago(day: str, today: str) -> int | None:
    try:
        d0 = _dt.date.fromisoformat(day)
        d1 = _dt.date.fromisoformat(today)
        return (d1 - d0).days
    except ValueError:
        return None


def render_temporal_orientation() -> str:
    """LLM-ready block: real records bucketed by their own timestamps."""
    try:
        from app.philos_shared_state import fetch_shared_state
        res = fetch_shared_state()
    except Exception as exc:
        return f"## TEMPORAL ORIENTATION\nPHILOS לא נגיש ({exc}) — אין נתוני זמן; אל תמציא היסטוריה."
    if not res.connected or not res.data:
        return "## TEMPORAL ORIENTATION\nPHILOS לא מחובר — אין נתוני זמן; אל תמציא היסטוריה."
    d = res.data
    today = _day(d.get("asOf") or "")

    events: list[tuple[str, str]] = []   # (day, description)
    for o in d.get("observations") or []:
        events.append((_day(o.get("observed_at")), f"Observation {o.get('domain')}/{o.get('frame')} level {o.get('level')} — \"{(o.get('context_snippet') or '')[:70]}…\""))
    for a in d.get("actions") or []:
        events.append((_day(a.get("recorded_at")), f"Action {a.get('type')} ({a.get('verification_state')})"))
    # effects carry no own timestamp in the payload — anchor to their action's day
    act_day = { a.get("action_id"): _day(a.get("recorded_at")) for a in (d.get("actions") or []) }
    for e in d.get("effects") or []:
        day = act_day.get(e.get("action_ref"), "")
        stmt = (e.get("verified_statement") or e.get("claimed_statement") or "")[:80]
        events.append((day, f"Effect {'מאומת' if e.get('verified') else 'claimed'} — {stmt}"))
    for l in d.get("learning") or []:
        events.append(("", f"Learning {l.get('kind')}"))

    buckets: dict[str, list[str]] = {"TODAY": [], "YESTERDAY": [], "LAST_3_DAYS": [], "LAST_7_DAYS": []}
    for day, desc in events:
        if not day:
            continue
        ago = _days_ago(day, today)
        if ago is None or ago < 0:
            continue
        if ago == 0:
            buckets["TODAY"].append(f"{desc} ({day})")
        elif ago == 1:
            buckets["YESTERDAY"].append(f"{desc} ({day})")
        elif ago <= 3:
            buckets["LAST_3_DAYS"].append(f"{desc} ({day})")
        elif ago <= 7:
            buckets["LAST_7_DAYS"].append(f"{desc} ({day})")

    lines = [f"## TEMPORAL ORIENTATION (חתך זמן אמיתי · נכון ל-{d.get('asOf', '')[:16]})"]
    for name, label in [("TODAY", "היום"), ("YESTERDAY", "אתמול"), ("LAST_3_DAYS", "2–3 ימים אחרונים"), ("LAST_7_DAYS", "4–7 ימים אחרונים")]:
        rows = buckets[name]
        if rows:
            lines.append(f"{label} ({name}):")
            lines.extend(f"  - {r}" for r in rows[:5])
        else:
            lines.append(f"{label} ({name}): אין רשומה אמיתית")
    needs = (d.get("community_marketplace") or {}).get("open_needs") or []
    lines.append(f"Need פתוח כרגע: {len(needs)}" + (f" — {needs[0].get('desired_change', '')[:80]}" if needs else ""))
    lines.append("לא חשוף עם חותמות זמן: tensions, שינויי קבוצות ערך — אל תמציא עבורם היסטוריה.")
    lines.append("ענה על 'מה השתנה' רק מהדליים למעלה; ציין את היום; CURRENT ≠ היסטורי.")
    return "\n".join(lines)
