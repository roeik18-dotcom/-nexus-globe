"""DayOpeningRunner — orchestrates collect → plan → render → speak, and
persists what actually ran (section 8). This is the ONLY function that
touches TTS/turn_ctrl for the Day Opening — collection/planning/rendering
(service/day_opening_collectors.py, _planner.py, _renderer.py) are all pure
and independently testable without hardware.
"""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path

from service.day_opening_collectors import collect_all
from service.day_opening_planner import plan
from service.day_opening_renderer import render

logger = logging.getLogger("merlin.day_opening")

_STATE_PATH = Path(__file__).resolve().parent.parent / "state" / "day_opening_state.json"


def _persist(report, interrupted: bool, spoken_text: str) -> None:
    """Records what was PLANNED vs what actually got SPOKEN — never equates
    the two (section 8: 'selected priority' != 'completed')."""
    try:
        _STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
        payload = report.to_dict()
        payload["interrupted"] = interrupted
        payload["spoken_text"] = spoken_text
        payload["fully_spoken"] = (not interrupted) and bool(spoken_text) and spoken_text.strip() == report.full_text_he.strip()
        _STATE_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as exc:
        logger.warning("day_opening: failed to persist state: %s", exc)


def load_last_state() -> dict | None:
    if not _STATE_PATH.exists():
        return None
    try:
        return json.loads(_STATE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return None


async def run_day_opening(
    adapter, tts, player, turn_ctrl, control_state, session_id: str,
) -> dict:
    """The single shared action both the manual Control Panel button and a
    (future/optional) double-clap trigger call — section 6's requirement
    that both paths use ONE backend action, not two implementations.

    Never calls adapter.respond() — the briefing text is fully built before
    any TTS call, and is spoken verbatim via speak_canonical_text().
    """
    import service.merlin_service as svc   # local import avoids a circular import at module load

    control_state.set_day_opening_state("COLLECTING")
    control_state.record_event("day_opening", "DAY_OPENING_COLLECT_START")

    try:
        orientation, domains, candidates = collect_all(control_state, turn_ctrl)
    except Exception as exc:
        logger.exception("day_opening: collection failed entirely")
        control_state.set_day_opening_state("ERROR", error=str(exc))
        control_state.record_event("day_opening", "DAY_OPENING_ERROR", result=str(exc))
        return {"ok": False, "error": str(exc)}

    previous_state = load_last_state()
    previous_domains = previous_state.get("domains") if previous_state else None
    report = plan(domains, candidates, previous_domains=previous_domains)
    text = render(report, orientation_he=orientation)
    # CONFIG-COVERAGE system status (2026-08-10): Merlin must give a truthful
    # picture — if HUMAN/MUSIC config is not proven complete, say so. Derived
    # from REAL coverage of the master files (service/config_coverage.py), never
    # hardcoded; a domain that later becomes COMPLETE drops its "not complete"
    # line on its own. Appended to the verbatim canonical text so it is SPOKEN.
    try:
        from service.config_coverage import coverage_lines_he
        cov = coverage_lines_he()
        if cov:
            # PREPEND (not append): the truthful system-status must be the FIRST
            # thing Merlin speaks, so it is delivered in the opening chunk even if
            # a later self-barge cuts the briefing short. Update report.full_text_he
            # so the persisted transcript IS the full text that was spoken.
            text = " ".join(cov) + " " + text
            report.full_text_he = text
            control_state.record_event("day_opening", "DAY_OPENING_COVERAGE_PREPENDED",
                                       payload_summary=" | ".join(cov)[:200])
    except Exception:
        logger.warning("day_opening: config-coverage summary unavailable", exc_info=True)
    control_state.record_event(
        "day_opening", "DAY_OPENING_BRIEFING_BUILT",
        payload_summary=f"{len(domains)} domains, {len(text)} chars",
    )

    turn_id = turn_ctrl.new_turn()
    control_state.record_event("day_opening", "DAY_OPENING_TRIGGER_1", turn_id=turn_id)
    control_state.set_day_opening_state("PLAYING")

    interrupted, spoken_text = await svc.speak_canonical_text(
        text, tts, player, turn_ctrl, turn_id, control_state=control_state,
    )

    final_state = "INTERRUPTED" if interrupted else "COMPLETED"
    control_state.set_day_opening_state(final_state)
    control_state.record_event("day_opening", f"DAY_OPENING_{final_state}", turn_id=turn_id)

    _persist(report, interrupted, spoken_text)

    return {
        "ok": True, "interrupted": interrupted, "turn_id": turn_id,
        "domains": len(domains), "text_length": len(text),
        "spoken_length": len(spoken_text),
    }
