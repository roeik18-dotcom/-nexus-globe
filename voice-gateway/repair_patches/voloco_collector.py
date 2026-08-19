"""PATCH (reference, NOT applied) — Voloco Studio-Logistics open loop for Day Opening.

Gap B3: no Voloco anywhere in the runtime (grep = 0 hits). The product requires a
Studio-Logistics open loop that Merlin MUST NOT report as completed.

TO MERGE into service/day_opening_collectors.py: add `collect_voloco()` below and wire
it into collect_all() as another `_isolated("voloco", "לוגיסטיקת אולפן — Voloco", collect_voloco)`
domain. It follows the same DomainStatus contract (FACT + explicit open_loop/blocker,
never claims completion). The planner will classify it as an open loop automatically
from its blocker_he/next_action_he fields.

This standalone version returns a plain dict mirroring the DomainStatus fields so it is
unit-testable without importing the in-flux day_opening_models. When merged, construct a
real DomainStatus with the same field values.
"""
from __future__ import annotations


def collect_voloco() -> dict:
    """Voloco Producer routing/monitoring setup — an OPEN studio-logistics loop.

    Verified known state (do not exceed it): installed/opened, tested around Ableton;
    routing/monitoring/config access NOT yet proven complete. Desired end state:
    Mic -> Ableton -> Voloco Producer -> monitored output, no unintended dry/direct
    duplicate monitoring. Because completion is unproven, status stays OPEN and the
    summary must never say 'done/complete'.
    """
    return {
        "domain": "voloco",
        "label_he": "לוגיסטיקת אולפן — Voloco",
        "provenance": "FACT",                       # the state below is verified, not inferred
        "status": "OPEN",                            # FINAL_STUDIO_SETUP loop
        "lifecycle": "IN_PROGRESS",                  # never MASTER_FINAL/COMPLETED
        "summary_he": (
            "Voloco Producer הותקן ונפתח, ונבדק סביב אייבלטון. "
            "ניתוב/ניטור/גישת קונפיגורציה עדיין לא הוכחו כמלאים — לכן פתוח, לא הושלם."
        ),
        "blocker_he": "ניתוב וניטור טרם הוכחו: יש לוודא מסלול מלא ללא כפילות ניטור יבש/ישיר",
        "next_action_he": (
            "לאמת שרשרת: מיקרופון → אייבלטון → Voloco Producer → יציאה מנוטרת, "
            "בלי ניטור dry/direct כפול לא מכוון"
        ),
        "desired_end_state": "Mic -> Ableton -> Voloco Producer -> monitored output (no dry duplicate)",
        "completed": False,                          # HARD: Merlin must not report completed
    }
