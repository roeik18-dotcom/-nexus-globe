"""PHILOS_SHARED_STATE — the Merlin-side client for the ONE real Phase 7
endpoint (`GET /api/canon/shared-state` in the -nexus-globe Next.js app,
`app/api/canon/shared-state/route.ts`). Same contract style as
`app/capabilities/philos_orientation.py` (read this pass, 2026-08-17):

  METHOD   GET
  PATH     /api/canon/shared-state
  AUTH     Authorization: Bearer <CANON_READ_TOKEN>
  QUERY    subject=<subject_id>   (optional — PHILOS defaults to REAL_CURRENT_SUBJECT)
  RESPONSE 200 SharedStateResponse (subject_id, asOf, human, music,
             human_master, music_master, color_master, open_loops, actions,
             effects, learning, brain, community_marketplace, world_relevance)
           401 unauthorized / 500 read_failed

This module NEVER writes to PHILOS. It is a plain, SYNCHRONOUS HTTP GET
client (Day Opening's `collect_all()` is itself synchronous — see
`service/day_opening_collectors.py`'s own header: "no microphone, no TTS...
synchronous, file/subprocess I/O only" — an async client would not fit that
contract without a bigger refactor Phase 7 does not authorize). No canon
loader, no PersonInstance/ValueDomainInstance projection, no BrainDerivation
logic is re-implemented here — every one of those fields arrives already
computed from PHILOS. This is the concrete meaning of "Merlin reads
canonical refs through the existing loaders" (Phase 7 brief): the loaders
run in PHILOS's own process; this file only reads their JSON output.

`app/lib/philos/**`, `app/api/canon/**` are never imported, edited, or
written to from here or anywhere in voice-gateway (same boundary
`philos_orientation.py` already states for itself).
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any, Optional

import httpx

logger = logging.getLogger("merlin.philos_shared_state")

DEFAULT_BASE_URL = "http://127.0.0.1:3000"
USER_AGENT = "Merlin-Philos-SharedState-Client/1.0 (+read-only)"
_FETCH_TIMEOUT_S = 10.0


def _endpoint_base() -> str:
    return os.environ.get("PHILOS_CANON_BASE_URL", DEFAULT_BASE_URL).rstrip("/")


def _token() -> Optional[str]:
    """Merlin's own copy of the shared read secret — same env var
    `philos_orientation.py` already reads, deliberately reused rather than a
    second Phase-7-only variable, since both are the same real credential."""
    return os.environ.get("PHILOS_CANON_READ_TOKEN")


@dataclass(frozen=True)
class SharedStateResult:
    """What every caller in Phase 7 gets back — connected/error state kept
    explicit, same discipline `philos_orientation.py::handler`'s return dict
    already established, so a network/auth failure degrades to an honest
    "not connected" rather than a crash or a fabricated empty success."""
    connected: bool
    http_status: Optional[int]
    error: Optional[str]
    data: Optional[dict[str, Any]]


def fetch_shared_state(subject: Optional[str] = None) -> SharedStateResult:
    """The one entry point every Phase 7 collector uses. Synchronous —
    called from `day_opening_collectors.py`'s own synchronous `_run()`
    closures, same as every other collector in that file. Never raises:
    every failure mode (no token configured, network error, timeout, bad
    status, bad JSON, unexpected shape) returns a `SharedStateResult` with
    `connected=False` instead."""
    token = _token()
    if not token:
        logger.info("PHILOS_SHARED_STATE: PHILOS_CANON_READ_TOKEN not configured — skipping")
        return SharedStateResult(connected=False, http_status=None, error="not_configured", data=None)

    url = f"{_endpoint_base()}/api/canon/shared-state"
    params = {"subject": subject} if subject else {}

    try:
        with httpx.Client(timeout=_FETCH_TIMEOUT_S) as client:
            resp = client.get(
                url, params=params,
                headers={"Authorization": f"Bearer {token}", "User-Agent": USER_AGENT},
            )
    except httpx.TimeoutException:
        return SharedStateResult(connected=False, http_status=None, error="timeout", data=None)
    except httpx.RequestError as exc:
        logger.info("PHILOS_SHARED_STATE: network error: %s", exc)
        return SharedStateResult(connected=False, http_status=None, error="network_error", data=None)

    if resp.status_code == 401:
        return SharedStateResult(connected=False, http_status=401, error="unauthorized", data=None)
    if resp.status_code != 200:
        return SharedStateResult(connected=False, http_status=resp.status_code, error="unexpected_status", data=None)

    try:
        body = resp.json()
    except ValueError:
        return SharedStateResult(connected=False, http_status=200, error="invalid_json", data=None)

    if not isinstance(body, dict):
        return SharedStateResult(connected=False, http_status=200, error="unexpected_shape", data=None)

    return SharedStateResult(connected=True, http_status=200, error=None, data=body)


# ── LIVE CONVERSATION CONTEXT (Merlin Product Recovery, 2026-08-17) ─────────
#
# Before this pass, `fetch_shared_state` had exactly one caller — Day
# Opening's collectors — so a spoken "מה מצב פילוס?" routed to the PHILOS
# domain but was answered from the STATIC project_knowledge index, never
# from live PHILOS state. This renderer is the missing bridge: a compact,
# LLM-ready text block of the live shared state, appended by
# `domain_router.route()`'s PHILOS branch to every PHILOS-domain turn.
#
# Honesty rules carried over verbatim from the PHILOS side:
#   - Merlin CONSUMES state; nothing here manufactures one. Every line is a
#     field from the shared-state response or an explicit UNKNOWN.
#   - PROJECTS: PHILOS has no project record type. The section says so —
#     the model must answer "UNKNOWN" about project state, not invent one.
#   - A failed fetch renders as a explicit not-connected block, so the
#     model says "אין חיבור לפילוס" instead of hallucinating state.

def render_shared_state_context(subject: Optional[str] = None) -> str:
    """Compact live-state block for the LLM context of PHILOS-domain turns."""
    res = fetch_shared_state(subject)
    if not res.connected or not res.data:
        return (
            "## PHILOS LIVE STATE\n"
            f"PHILOS CONNECTION: NOT CONNECTED ({res.error or 'unknown error'}) — "
            "אין גישה למצב חי; ענה שאין חיבור לפילוס כרגע, אל תמציא מצב."
        )
    d = res.data
    lines: list[str] = ["## PHILOS LIVE STATE (read-only, real)"]
    lines.append(f"subject: {d.get('subject_id', 'UNKNOWN')} · asOf: {d.get('asOf', 'UNKNOWN')}")

    # CONFIG COMPLETENESS SEMANTICS (product correction, 2026-08-17): three
    # SEPARATE layers, never merged into an "incomplete" verdict:
    #   MASTER STATUS  canonical records available in the frozen Source Lock
    #   ACTIVE CONFIG  refs PHILOS currently activates (a runtime decision)
    #   LIVE STATE     real observations only — UNKNOWN when none exists
    def _config_lines(name: str, inst: Any, master: Any) -> list[str]:
        out: list[str] = []
        if isinstance(master, dict) and master.get("row_count"):
            by_status = (master.get("summary") or {}).get("by_runtime_status") or {}
            status_words = " · ".join(f"{k}={v}" for k, v in by_status.items())
            out.append(f"{name} MASTER STATUS: {master['row_count']} רשומות קנוניות זמינות (טעון ותקין{f'; לפי סטטוס: {status_words}' if status_words else ''}) — סטטוסי שורה הם מצב review, לא חוסר שלמות")
        else:
            out.append(f"{name} MASTER STATUS: לא נגיש — זו התקלה היחידה שנקראת 'קונפיג לא שלם'")
        if isinstance(inst, dict):
            refs = inst.get("source_refs") or []
            cs = inst.get("current_state") or []
            out.append(f"{name} ACTIVE CONFIG: {len(refs)} refs פעילים כרגע (הפעלה חלקית = החלטת runtime, לא חוסר שלמות)")
            if cs:
                states = " · ".join(f"{s.get('parameter_id')}={s.get('level')}" for s in cs[:4] if isinstance(s, dict))
                out.append(f"{name} LIVE STATE: {states}")
            else:
                out.append(f"{name} LIVE STATE: UNKNOWN — אין תצפית/DomainState אמיתי")
        else:
            out.append(f"{name} ACTIVE CONFIG/LIVE STATE: UNKNOWN")
        return out

    lines.extend(_config_lines("Human", d.get("human"), d.get("human_master")))
    lines.extend(_config_lines("Music", d.get("music"), d.get("music_master")))
    lines.append("אסור לומר 'הקונפיג לא שלם' אלא אם מאסטר נכשל בטעינה. תאר כל שכבה בנפרד.")

    ol = d.get("open_loops") or {}
    lines.append(
        f"Open loops: {ol.get('no_effect_recorded', 0)} Action ללא Effect · "
        f"{ol.get('effect_claimed_only', 0)} Effect claimed בלבד · "
        f"{ol.get('effect_verified', 0)} מאומתים"
    )

    actions = d.get("actions") or []
    if actions:
        a = actions[0]
        lines.append(f"Actions: {len(actions)} (אחרון: {a.get('type')} · {a.get('verification_state')} · {str(a.get('recorded_at'))[:10]})")
    else:
        lines.append("Actions: 0")
    effects = d.get("effects") or []
    verified = [e for e in effects if isinstance(e, dict) and e.get("verified")]
    if effects:
        latest = effects[0]
        stmt = latest.get("verified_statement") or latest.get("claimed_statement") or ""
        lines.append(f"Effects: {len(effects)} ({len(verified)} מאומתים) · אחרון: {str(stmt)[:120]}")
    else:
        lines.append("Effects: 0")
    learning = d.get("learning") or []
    lines.append(f"Learning: {len(learning) if learning else '0 — אין Learning אמיתי'}")

    brain = d.get("brain") or {}
    changes = brain.get("changes") or []
    if changes and isinstance(changes[0], dict):
        lines.append(f"מה השתנה: {str(changes[0].get('what_changed', ''))[:140]}")
    unknowns = brain.get("unknown") or []
    if unknowns:
        lines.append("לא ידוע (אמיתי): " + " · ".join(str(u)[:80] for u in unknowns[:3]))
    evidence = brain.get("evidence") or []
    if evidence:
        lines.append(f"ראיות: {len(evidence)} · אחרונה: {str(evidence[0])[:120]}")
    hypotheses = brain.get("hypotheses") or []
    lines.append(f"השערות ריצה: {len(hypotheses)}")

    cm = d.get("community_marketplace") or {}
    needs = cm.get("open_needs") or []
    offers = cm.get("open_offers") or []
    lines.append(f"קבוצות ערך / שוק: {len(needs)} Need פתוח · {len(offers)} Offer")
    if needs and isinstance(needs[0], dict):
        first_need = needs[0].get("desired_change") or needs[0].get("need_id") or ""
        lines.append(f"Need ראשון: {str(first_need)[:120]}")

    wr = d.get("world_relevance") or {}
    lines.append(f"World relevance: {wr.get('bridge_link_count', 0)} קישורי Action↔Community אמיתיים")

    na = brain.get("next_action") or None
    if isinstance(na, dict) and na.get("label"):
        lines.append(f"הפעולה הבאה (מ-PHILOS): {na.get('label')} — {na.get('reason', '')}")
    else:
        lines.append("הפעולה הבאה: אין פעולה נגזרת כרגע — UNKNOWN")
    lines.append("Tensions/ניגודים: לא חשופים ב-endpoint הזה — UNKNOWN; אל תמציא ניגוד. (ניגודי תצפית מסווגים ב-PHILOS עצמו.)")
    lines.append(
        "## PROJECTS\n"
        "ב-PHILOS עצמו אין ישות פרויקט; מצב הפרויקטים האמיתי מגיע מבלוק "
        "PROJECT ORIENTATION (studio ledger + Philos Orientation) כשהוא מצורף. "
        "אל תמציא סטטוס פרויקט מעבר למה שרשום שם."
    )
    lines.append(
        "הנחיה: ענה רק מהנתונים למעלה; שדה חסר = UNKNOWN. אלה נתונים חיים מ-PHILOS, "
        "נשלפו ברגע השאלה (ראה asOf). אם סיכום קודם בשיחה סותר את הנתונים כאן — "
        "הנתונים כאן גוברים; הבחן במפורש בין CURRENT לבין היסטורי."
    )
    return "\n".join(lines)
