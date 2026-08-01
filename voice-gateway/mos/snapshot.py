"""Merlin OS · Morning Snapshot + Coverage.

Layer 1 of the day-opener pipeline:

    Sources → Snapshot → Coverage → [Analysis] → [Priorities] → [Brief] → [Voice]
    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   nothing past here is built yet

This module COLLECTS and REPORTS. It does not conclude, rank, recommend, or phrase
anything for speech — those are separate layers precisely so the briefing cannot
grow into a monologue as sources are added.

THE RULE THIS MODULE EXISTS TO ENFORCE
--------------------------------------
"No data" must never silently become "nothing happened".

Zero commits from a healthy git collector is a fact about the world.
Zero messages from an unauthenticated Gmail collector is a fact about the SENSOR.
Collapsing the two is how a system ends up confidently telling you your music
stalled when it simply cannot see your DAW.

So every source reports its own health and, critically, whether its silence
carries meaning (`absence_is_meaningful`). Downstream layers may only draw a
conclusion from an empty payload when that flag is true.
"""
from __future__ import annotations

import dataclasses
import datetime
import json
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Protocol, runtime_checkable

# ── source health ────────────────────────────────────────────────────────────


class SourceStatus(str, Enum):
    """Why a payload looks the way it does."""

    AVAILABLE = "available"           # queried successfully, data is current
    STALE = "stale"                   # answered, but older than the source's freshness budget
    UNAVAILABLE = "unavailable"       # exists and is configured, but could not be reached now
    ERROR = "error"                   # reachable, but failed while collecting
    NOT_CONFIGURED = "not_configured"  # no such source wired up on this machine yet


#: Statuses whose empty payload says nothing about the world.
#: A collector in one of these states must never let a downstream layer infer
#: "nothing happened" — it only establishes "we did not look, or looking failed".
BLIND_STATUSES = frozenset(
    {SourceStatus.UNAVAILABLE, SourceStatus.ERROR, SourceStatus.NOT_CONFIGURED}
)


@dataclass(frozen=True)
class SourceCoverage:
    """What one source could and could not see, and how much to trust it."""

    source_id: str
    domain: str
    status: SourceStatus
    collected_at: str                     # ISO 8601 with offset
    data_age_seconds: float | None        # age of the underlying data, not of the call
    #: True only when an EMPTY payload is itself evidence. Git with no commits
    #: means no commits. Gmail with no messages might mean a dead token.
    absence_is_meaningful: bool
    #: 0..1, about THIS READING — not about any conclusion drawn from it.
    confidence: float
    #: Where the answer came from, so a human can go and check it.
    evidence: list[str] = field(default_factory=list)
    #: Plain-language reason, required whenever the status is not AVAILABLE.
    note: str = ""

    def __post_init__(self) -> None:
        if not 0.0 <= self.confidence <= 1.0:
            raise ValueError(f"{self.source_id}: confidence {self.confidence} outside 0..1")
        if self.status is not SourceStatus.AVAILABLE and not self.note:
            raise ValueError(f"{self.source_id}: status {self.status.value} requires a note")
        if self.status in BLIND_STATUSES and self.absence_is_meaningful:
            # the invariant, enforced rather than documented
            raise ValueError(
                f"{self.source_id}: a {self.status.value} source cannot claim its "
                "silence is meaningful"
            )

    @property
    def is_blind(self) -> bool:
        return self.status in BLIND_STATUSES

    @property
    def can_conclude_from_absence(self) -> bool:
        """May a later layer read an empty payload as 'nothing happened'?"""
        return self.absence_is_meaningful and not self.is_blind


@dataclass(frozen=True)
class SourceReading:
    """One collector's full answer: what it saw, plus how well it could see."""

    coverage: SourceCoverage
    payload: dict[str, Any] = field(default_factory=dict)

    @property
    def source_id(self) -> str:
        return self.coverage.source_id

    @property
    def domain(self) -> str:
        return self.coverage.domain


# ── the snapshot ─────────────────────────────────────────────────────────────

#: The domains the day-opener is meant to know about. Listed explicitly so a
#: domain with no collector shows up as a KNOWN blind spot rather than silently
#: not existing.
DOMAINS: tuple[str, ...] = (
    "awareness",
    "personal_config",
    "projects",
    "music",
    "communications",
    "finance",
    "ideas",
    "blockers",
    "git",
)


@dataclass(frozen=True)
class MorningSnapshot:
    """Everything Merlin knows at wake time — and everything it does not.

    Deliberately has no `summary`, no `highlights` and no ordering: this is the
    raw state, and any judgement about what matters belongs to a later layer.
    """

    collected_at: str
    readings: tuple[SourceReading, ...]

    # ── lookups ──
    def by_domain(self, domain: str) -> tuple[SourceReading, ...]:
        return tuple(r for r in self.readings if r.domain == domain)

    def get(self, source_id: str) -> SourceReading | None:
        return next((r for r in self.readings if r.source_id == source_id), None)

    # ── coverage views ──
    @property
    def coverage(self) -> tuple[SourceCoverage, ...]:
        return tuple(r.coverage for r in self.readings)

    @property
    def blind_spots(self) -> tuple[SourceCoverage, ...]:
        """Sources that answered nothing AND whose silence proves nothing."""
        return tuple(c for c in self.coverage if c.is_blind)

    @property
    def missing_domains(self) -> tuple[str, ...]:
        """Domains with no source that can currently see anything."""
        return tuple(
            d for d in DOMAINS
            if not any(
                r.domain == d and not r.coverage.is_blind for r in self.readings
            )
        )

    @property
    def coverage_ratio(self) -> float:
        """Share of readings that actually saw something. Not a quality score."""
        if not self.readings:
            return 0.0
        seeing = sum(1 for c in self.coverage if not c.is_blind)
        return seeing / len(self.readings)

    def to_dict(self) -> dict[str, Any]:
        return {
            "collected_at": self.collected_at,
            "coverage_ratio": round(self.coverage_ratio, 3),
            "missing_domains": list(self.missing_domains),
            "readings": [
                {
                    **{
                        k: (v.value if isinstance(v, Enum) else v)
                        for k, v in dataclasses.asdict(r.coverage).items()
                    },
                    "payload": r.payload,
                }
                for r in self.readings
            ],
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=2)


# ── collector interface ──────────────────────────────────────────────────────


@runtime_checkable
class Collector(Protocol):
    """One source of truth about Roei's world.

    Implementations must never raise: a broken source is a FACT to report, not a
    crash. `collect` is wrapped by `run_collectors`, which converts an escaped
    exception into an ERROR reading so one bad collector cannot take the morning
    down with it.
    """

    source_id: str
    domain: str

    def collect(self) -> SourceReading: ...


def now_iso() -> str:
    """Local wall clock with offset — the machine's own time, no region pinned."""
    return datetime.datetime.now().astimezone().isoformat(timespec="seconds")


def not_configured(
    source_id: str,
    domain: str,
    note: str,
    *,
    collected_at: str | None = None,
) -> SourceReading:
    """A source that does not exist yet on this machine.

    Used instead of omitting the domain, so the diagnostic report can state the
    blindness out loud. confidence=1.0 because we are certain about the ONLY
    thing being asserted: that nothing is wired up.
    """
    return SourceReading(
        coverage=SourceCoverage(
            source_id=source_id,
            domain=domain,
            status=SourceStatus.NOT_CONFIGURED,
            collected_at=collected_at or now_iso(),
            data_age_seconds=None,
            absence_is_meaningful=False,
            confidence=1.0,
            evidence=[],
            note=note,
        ),
        payload={},
    )


def failed(
    source_id: str,
    domain: str,
    error: str,
    *,
    collected_at: str | None = None,
) -> SourceReading:
    """A source that was configured and reachable but blew up while collecting."""
    return SourceReading(
        coverage=SourceCoverage(
            source_id=source_id,
            domain=domain,
            status=SourceStatus.ERROR,
            collected_at=collected_at or now_iso(),
            data_age_seconds=None,
            absence_is_meaningful=False,
            confidence=0.0,
            evidence=[],
            note=error,
        ),
        payload={},
    )


def run_collectors(collectors: list[Collector]) -> MorningSnapshot:
    """Run every collector, converting escapes into ERROR readings.

    Order is preserved so the snapshot is deterministic for a given collector
    list — the report is diffable between mornings.
    """
    readings: list[SourceReading] = []
    for c in collectors:
        try:
            readings.append(c.collect())
        except Exception as ex:  # a failing source is data, never a crash
            readings.append(failed(c.source_id, c.domain, f"{type(ex).__name__}: {ex}"))
    return MorningSnapshot(collected_at=now_iso(), readings=tuple(readings))
