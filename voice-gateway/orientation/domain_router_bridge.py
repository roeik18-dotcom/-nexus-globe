"""Bridge between the reactive retrieval backend (app.domain_router) and the
orientation policy/selection brain. Maps domain_router's Domain + SourceRef status
onto orientation domain-ids and KnowledgeStatus. No audio, no LLM.
"""
from __future__ import annotations

from .state import KnowledgeStatus

# domain_router.Domain value -> orientation domain id (registry). GENERAL -> None.
DR_TO_ORIENTATION: dict[str, str | None] = {
    "human_config": "human_config",
    "music_config": "music_config",
    "studio_project": "studio",
    "philos": "philos",
    "runtime": "merlin_dev",
    "day_opening": "day_opening",
    "general": None,
}


def route_domain_value(route_result) -> str:
    d = getattr(route_result, "domain", None)
    return getattr(d, "value", str(d)).lower() if d is not None else "general"


def orientation_id_for(route_result) -> str | None:
    return DR_TO_ORIENTATION.get(route_domain_value(route_result), None)


def status_from_sources(sources) -> KnowledgeStatus:
    """Map a RouteResult's SourceRef statuses to a knowledge status, honestly.

    LOADED/FOUND -> FACT ; DRAFT -> DERIVED ; MISSING/ERROR/UNKNOWN/none -> UNKNOWN.
    Never upgrades a draft/missing source to FACT.
    """
    if not sources:
        return KnowledgeStatus.UNKNOWN
    st = {(getattr(s, "status", "") or "").upper() for s in sources}
    if st & {"LOADED", "FOUND"}:
        return KnowledgeStatus.FACT
    if "DRAFT" in st:
        return KnowledgeStatus.DERIVED
    return KnowledgeStatus.UNKNOWN
