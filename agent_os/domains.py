"""Canonical Agent-OS domains + an EXPLICIT mapping to the live repository IDs.

The live repo does NOT use these canonical names. Verified (read-only) sources:
  * app/domain_router routes queries only to: general, human_config, music_config, philos
    (see voice-gateway/service/control_panel.html selMap + app/domain_router).
  * orientation/domains.py carries ~17 fine-grained ORIENTATION domains, incl.
    studio, music_production, music_course, plugins, merlin_dev, merlin_control_center.

Per the P0 rule "do not silently rewrite existing live domain names", this module
NEVER renames anything at runtime; it is declarative metadata only (no routing
change in P0). It records, per canonical domain, the live routing id (if the
domain is an actual knowledge-routing target) and the live orientation id (if any).
"""

from __future__ import annotations

from enum import Enum


class Domain(str, Enum):
    GENERAL = "GENERAL"
    MUSIC = "MUSIC"
    HUMAN_CONFIG = "HUMAN_CONFIG"
    PHILOS = "PHILOS"
    STUDIO = "STUDIO"
    SYSTEM = "SYSTEM"


# Canonical -> live app/domain_router routing id (None = NOT a live knowledge-routing
# domain today). STUDIO and SYSTEM are None here: STUDIO exists only as an orientation
# domain, and SYSTEM has no live routing/knowledge equivalent at all.
LIVE_ROUTING_ID: dict[Domain, str | None] = {
    Domain.GENERAL: "general",
    Domain.MUSIC: "music_config",
    Domain.HUMAN_CONFIG: "human_config",
    Domain.PHILOS: "philos",
    Domain.STUDIO: None,
    Domain.SYSTEM: None,
}

# Canonical -> live orientation/domains.py id (None = no single orientation domain).
# SYSTEM's nearest live orientation domains are merlin_dev + merlin_control_center
# (two, not one), so it maps to None here and is documented instead.
LIVE_ORIENTATION_ID: dict[Domain, str | None] = {
    Domain.GENERAL: None,
    Domain.MUSIC: "music_config",       # orientation family also: music_production/music_course/plugins
    Domain.HUMAN_CONFIG: "human_config",
    Domain.PHILOS: "philos",
    Domain.STUDIO: "studio",
    Domain.SYSTEM: None,                # ~ merlin_dev / merlin_control_center (design)
}

# Protected domains require agent_class=SYSTEM AND authority in {ELEVATED, SYSTEM}.
PROTECTED_DOMAINS: frozenset[Domain] = frozenset({Domain.SYSTEM})


def parse_domain(value: object) -> Domain:
    """Coerce a manifest value to a Domain, raising if unknown (closed set)."""
    if isinstance(value, Domain):
        return value
    try:
        return Domain(str(value))
    except ValueError as exc:  # unknown domain string
        raise ValueError(f"unknown domain {value!r}; valid: {[d.value for d in Domain]}") from exc


def mapping_report() -> list[dict]:
    """Machine-readable canonical<->live mapping (for the P0 report / control plane)."""
    return [
        {
            "canonical": d.value,
            "live_routing_id": LIVE_ROUTING_ID[d],
            "live_orientation_id": LIVE_ORIENTATION_ID[d],
            "is_live_routing_domain": LIVE_ROUTING_ID[d] is not None,
            "protected": d in PROTECTED_DOMAINS,
        }
        for d in Domain
    ]
