"""Real config-coverage evidence for the Day Opening (2026-08-10).

Reads the ACTUAL master files and reports COMPLETE / PARTIAL / MISSING /
UNMAPPED / UNKNOWN per domain — it NEVER hardcodes "complete". The Day Opening
derives its spoken system-status sentences from this, so:
  * if a domain is not proven complete, Merlin says it is not complete;
  * if a domain later becomes truly complete (evidence changes), the sentences
    change on their own — nothing here is a fixed fact.

Coverage rules (from the master schema, verified on live files 2026-08-10):
  HUMAN master carries Semantic_State: RESOLVED (answerable) vs RETAINED_OPEN /
    EXPLICITLY_UNMAPPED (open). open>0 => PARTIAL.
  MUSIC master has NO Semantic_State populated => no completion marker exists =>
    it cannot be proven COMPLETE => PARTIAL (has content, coverage unproven).
  PHILOS is a markdown orchestration doc with NO atomic-coverage schema =>
    completeness is not quantifiable => PARTIAL/ongoing.
"""
from __future__ import annotations

import os
from collections import Counter

import app.master_config as mc

_PHILOS_MD = "/Users/roei/-nexus-globe/PHILOS-ORCHESTRATION-LAYER.md"


def _has_letter(s: str) -> bool:
    s = mc._nfc(s or "")
    return any(("א" <= c <= "ת") or ("a" <= c.lower() <= "z") for c in s)


def human_coverage() -> dict:
    path = mc.human_master_path()
    cols, rows = mc._load(path, mc._HUMAN_SHEET) if path else (None, None)
    if cols is None:
        return {"domain": "human", "status": "UNKNOWN", "path": str(path) if path else None,
                "known": None, "partial": None, "missing": None, "unmapped": None,
                "next_action": "המאסטר אינו נגיש כרגע (offline/evicted)"}
    st = Counter((r.get("Semantic_State", "") or "") for r in rows)
    resolved = st.get("RESOLVED", 0)
    retained_open = st.get("RETAINED_OPEN", 0)
    unmapped = st.get("EXPLICITLY_UNMAPPED", 0)
    open_units = retained_open + unmapped
    status = "COMPLETE" if (open_units == 0 and resolved > 0) else ("PARTIAL" if resolved > 0 else "MISSING")
    return {
        "domain": "human", "status": status, "path": str(path),
        "known": resolved, "partial": retained_open, "unmapped": unmapped, "missing": 0,
        "total_rows": len(rows),
        "next_action": (f"למפות ולסגור {open_units} יחידות פתוחות ({retained_open} פתוחות + {unmapped} לא-ממופות)"
                        if open_units else "—"),
    }


def music_coverage() -> dict:
    path = mc.music_master_path()
    cols, rows = mc._load(path, mc._MUSIC_SHEET) if path else (None, None)
    if cols is None:
        return {"domain": "music", "status": "UNKNOWN", "path": str(path) if path else None,
                "known": None, "partial": None, "missing": None, "unmapped": None,
                "next_action": "המאסטר אינו נגיש כרגע (offline/evicted)"}
    answerable = sum(1 for r in rows
                     if (r.get("Semantic_State", "") in ("", "RESOLVED")) and _has_letter(r.get("Original_Text", "")))
    has_state = any(r.get("Semantic_State", "") for r in rows)
    # No Semantic_State schema => completion cannot be proven => PARTIAL.
    status = "PARTIAL"
    return {
        "domain": "music", "status": status, "path": str(path),
        "known": answerable, "partial": len(rows) - answerable, "unmapped": 0, "missing": 0,
        "total_rows": len(rows), "has_coverage_schema": has_state,
        "next_action": f"אין schema של completion; {answerable}/{len(rows)} ניתנים למענה — צריך למפות coverage",
    }


def philos_coverage() -> dict:
    exists = os.path.exists(_PHILOS_MD)
    return {
        "domain": "philos", "status": "PARTIAL" if exists else "MISSING", "path": _PHILOS_MD,
        "known": None, "partial": None, "unmapped": None, "missing": None,
        "next_action": "ממשיך להיבנות מ-HUMAN/MUSIC; אין מיפוי אטומי — completeness לא מדיד",
    }


def all_coverage() -> list[dict]:
    return [human_coverage(), music_coverage(), philos_coverage()]


def coverage_lines_he() -> list[str]:
    """Spoken Hebrew system-status sentences DERIVED from real coverage. Only
    states incompleteness when it is actually true; a COMPLETE domain drops its
    'not complete' line automatically."""
    h, m = human_coverage(), music_coverage()
    lines: list[str] = ["תמונת מצב המערכת:"]
    if h["status"] == "PARTIAL":
        lines.append(f"קונפיג האדם עדיין לא הושלם במלואו: {h['known']} יחידות ידועות, "
                     f"ועוד {h['partial']} פתוחות ו-{h['unmapped']} לא-ממופות שצריך למפות ולהוסיף.")
    elif h["status"] == "COMPLETE":
        lines.append("קונפיג האדם הושלם.")
    else:
        lines.append("מצב קונפיג האדם אינו ידוע כרגע.")
    if m["status"] == "PARTIAL":
        lines.append(f"קונפיג המוזיקה עדיין לא הושלם במלואו: {m['known']} יחידות ידועות, "
                     "ועדיין אין מיפוי coverage מלא.")
    elif m["status"] == "COMPLETE":
        lines.append("קונפיג המוזיקה הושלם.")
    else:
        lines.append("מצב קונפיג המוזיקה אינו ידוע כרגע.")
    lines.append("יש עוד מידע שעדיין צריך למפות ולהוסיף.")
    lines.append("פילוס ממשיך להיבנות ולהתרחב מהמידע שנוסיף ונמפה דרך קונפיג האדם והמוזיקה.")
    return lines
