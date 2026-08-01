"""Merlin OS · run_morning_brief — Snapshot + Coverage only.

This is the seam `day_opener → run_morning_brief` already routes to
(intent_bridge → philos_seam → planner → executor → response). It currently
returns RAW STATE and a diagnostic report — nothing spoken, nothing ranked.

What is deliberately NOT here yet: Analysis, trends, priorities, recommendations,
the spoken briefing, voice integration, delegation. Each is its own layer, so the
brief cannot grow into a monologue every time a source is added.
"""
from __future__ import annotations

from pathlib import Path

from .collectors import default_collectors
from .snapshot import (
    BLIND_STATUSES,
    DOMAINS,
    Collector,
    MorningSnapshot,
    SourceStatus,
    run_collectors,
)

_MARK = {
    SourceStatus.AVAILABLE: "✓",
    SourceStatus.STALE: "~",
    SourceStatus.UNAVAILABLE: "!",
    SourceStatus.ERROR: "✕",
    SourceStatus.NOT_CONFIGURED: "·",
}


def collect_morning_snapshot(
    collectors: list[Collector] | None = None,
    *,
    root: Path | None = None,
    since: str = "24 hours ago",
) -> MorningSnapshot:
    """Gather every source. Injectable collectors keep this testable without I/O."""
    return run_collectors(collectors if collectors is not None else default_collectors(root, since))


def coverage_report(snap: MorningSnapshot) -> str:
    """A human-readable statement of what Merlin knows AND does not know.

    The blind-spot section is not an appendix — it is the point. A reader must be
    able to see, without digging, which silences are evidence and which are just
    Merlin not looking.
    """
    lines: list[str] = []
    seeing = [c for c in snap.coverage if not c.is_blind]
    lines.append("MORNING SNAPSHOT — raw state, no analysis")
    lines.append(f"collected_at : {snap.collected_at}")
    lines.append(
        f"coverage     : {len(seeing)}/{len(snap.coverage)} sources reporting "
        f"({snap.coverage_ratio:.0%})"
    )
    lines.append("")

    lines.append("SOURCES")
    for c in snap.coverage:
        age = "—" if c.data_age_seconds is None else f"{c.data_age_seconds:.0f}s"
        lines.append(
            f"  {_MARK[c.status]} {c.source_id:<28} {c.status.value:<16}"
            f" conf={c.confidence:.2f} age={age}"
            f" absence_meaningful={'yes' if c.absence_is_meaningful else 'no'}"
        )
        if c.note:
            lines.append(f"      ↳ {c.note}")
        if c.evidence:
            lines.append(f"      ↳ source: {', '.join(c.evidence)}")

    lines.append("")
    lines.append("WHAT MERLIN CAN CONCLUDE FROM SILENCE")
    concluding = [c for c in snap.coverage if c.can_conclude_from_absence]
    if concluding:
        for c in concluding:
            lines.append(f"  ✓ {c.source_id} — an empty result here means it did not happen")
    else:
        lines.append("  (none — no source may be read as 'nothing happened')")

    lines.append("")
    lines.append("BLIND SPOTS — silence here proves NOTHING")
    for c in snap.blind_spots:
        lines.append(f"  {_MARK[c.status]} {c.source_id:<28} {c.status.value}")
        lines.append(f"      ↳ {c.note}")

    missing = snap.missing_domains
    lines.append("")
    lines.append("DOMAINS WITH NO WORKING SOURCE")
    lines.append("  " + (", ".join(missing) if missing else "(none)"))
    lines.append("")
    lines.append(
        f"domains defined: {len(DOMAINS)} · blind: {len(snap.blind_spots)} · "
        f"statuses treated as blind: {', '.join(sorted(s.value for s in BLIND_STATUSES))}"
    )
    return "\n".join(lines)


def run_morning_brief(ctx: dict | None = None) -> dict:
    """Tool entry point. Returns raw snapshot + coverage — no prose, no ranking.

    Shaped as a tool result (`mos/tools.py` contract) so the existing
    day_opener chain can call it unchanged.
    """
    ctx = ctx or {}
    snap = collect_morning_snapshot(
        root=Path(ctx["root"]) if ctx.get("root") else None,
        since=ctx.get("since", "24 hours ago"),
    )
    return {
        "stage": "snapshot",           # explicitly NOT "briefing"
        "spoken": False,               # nothing here is ready to say out loud
        "collected_at": snap.collected_at,
        "coverage_ratio": round(snap.coverage_ratio, 3),
        "source_count": len(snap.readings),
        "blind_spot_count": len(snap.blind_spots),
        "missing_domains": list(snap.missing_domains),
        "snapshot": snap.to_dict(),
        "report": coverage_report(snap),
    }


if __name__ == "__main__":  # `python -m mos.morning`
    print(coverage_report(collect_morning_snapshot()))
