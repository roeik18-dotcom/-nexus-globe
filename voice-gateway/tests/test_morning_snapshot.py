"""Morning Snapshot + Coverage — the "no data ≠ nothing happened" contract.

The failure this layer exists to prevent: Merlin saying "no email today" when the
Gmail token is dead, or "music hasn't moved in four days" when it simply cannot
see the DAW. Both are the system reporting on its own blindness as if it were
reporting on the world.

So the invariant under test is narrow and absolute: an empty payload may only be
read as "nothing happened" when the source was actually able to look.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from mos.collectors import (  # noqa: E402
    GitCollector,
    NotConfiguredCollector,
    ProjectActivityCollector,
    default_collectors,
)
from mos.morning import collect_morning_snapshot, coverage_report, run_morning_brief  # noqa: E402
from mos.snapshot import (  # noqa: E402
    BLIND_STATUSES,
    DOMAINS,
    MorningSnapshot,
    SourceCoverage,
    SourceReading,
    SourceStatus,
    failed,
    not_configured,
    run_collectors,
)

AT = "2026-08-01T07:00:00+03:00"


# ── deterministic fakes ──────────────────────────────────────────────────────


class FakeCollector:
    """A collector with a fixed answer — no clock, no I/O, no network."""

    def __init__(self, source_id: str, domain: str, reading: SourceReading) -> None:
        self.source_id = source_id
        self.domain = domain
        self._reading = reading

    def collect(self) -> SourceReading:
        return self._reading


class ExplodingCollector:
    """A source that raises. One bad source must not take the morning down."""

    source_id = "boom.source"
    domain = "git"

    def collect(self) -> SourceReading:
        raise RuntimeError("upstream on fire")


def reading(
    source_id: str,
    domain: str,
    status: SourceStatus,
    *,
    absence: bool = False,
    confidence: float = 1.0,
    age: float | None = 0.0,
    note: str = "",
    payload: dict | None = None,
) -> SourceReading:
    return SourceReading(
        coverage=SourceCoverage(
            source_id=source_id, domain=domain, status=status, collected_at=AT,
            data_age_seconds=age, absence_is_meaningful=absence,
            confidence=confidence, evidence=["fake"], note=note,
        ),
        payload=payload or {},
    )


def snap(*readings: SourceReading) -> MorningSnapshot:
    return run_collectors([
        FakeCollector(r.source_id, r.domain, r) for r in readings
    ])


# ── the core invariant ───────────────────────────────────────────────────────


class TestAbsenceInvariant:
    def test_a_blind_source_cannot_claim_its_silence_is_meaningful(self):
        for status in BLIND_STATUSES:
            with pytest.raises(ValueError, match="silence is meaningful"):
                SourceCoverage(
                    source_id="x", domain="git", status=status, collected_at=AT,
                    data_age_seconds=None, absence_is_meaningful=True,
                    confidence=0.5, note="blind",
                )

    def test_empty_git_may_be_read_as_nothing_happened(self):
        r = reading("git.repo", "git", SourceStatus.AVAILABLE,
                    absence=True, payload={"commit_count": 0})
        assert r.coverage.can_conclude_from_absence is True

    def test_empty_gmail_may_NOT_be_read_as_no_mail(self):
        r = not_configured("communications.gmail", "communications", "not authenticated")
        assert r.payload == {}
        assert r.coverage.can_conclude_from_absence is False
        assert r.coverage.is_blind is True

    def test_the_two_empties_are_distinguishable(self):
        """Both payloads are {} — only coverage tells them apart."""
        git = reading("git.repo", "git", SourceStatus.AVAILABLE, absence=True)
        gmail = not_configured("communications.gmail", "communications", "no auth")
        assert git.payload == gmail.payload == {}
        assert git.coverage.can_conclude_from_absence
        assert not gmail.coverage.can_conclude_from_absence

    def test_a_non_available_status_must_explain_itself(self):
        with pytest.raises(ValueError, match="requires a note"):
            SourceCoverage(
                source_id="x", domain="git", status=SourceStatus.ERROR, collected_at=AT,
                data_age_seconds=None, absence_is_meaningful=False, confidence=0.0,
            )

    @pytest.mark.parametrize("bad", [-0.1, 1.1, 42])
    def test_confidence_must_be_a_probability(self, bad):
        with pytest.raises(ValueError, match="confidence"):
            SourceCoverage(
                source_id="x", domain="git", status=SourceStatus.AVAILABLE,
                collected_at=AT, data_age_seconds=None,
                absence_is_meaningful=False, confidence=bad,
            )


# ── the four source states ───────────────────────────────────────────────────


class TestSourceStates:
    def test_valid_source(self):
        s = snap(reading("a.ok", "git", SourceStatus.AVAILABLE, absence=True,
                         payload={"commit_count": 6}))
        assert s.blind_spots == ()
        assert s.coverage_ratio == 1.0
        assert s.get("a.ok").payload["commit_count"] == 6

    def test_missing_source(self):
        s = snap(not_configured("music.ableton", "music", "no project path"))
        assert len(s.blind_spots) == 1
        assert s.coverage_ratio == 0.0
        assert "music" in s.missing_domains

    def test_stale_source(self):
        s = snap(reading("cal.x", "communications", SourceStatus.STALE,
                         age=86_400, confidence=0.4, note="last sync 24h ago"))
        c = s.coverage[0]
        assert c.is_blind is False           # it DID see something, just old
        assert c.can_conclude_from_absence is False
        assert c.data_age_seconds == 86_400

    def test_failed_source(self):
        s = snap(failed("fin.ledger", "finance", "connection refused"))
        c = s.coverage[0]
        assert c.status is SourceStatus.ERROR
        assert c.confidence == 0.0
        assert c.is_blind is True

    def test_unavailable_source(self):
        s = snap(reading("gh.api", "git", SourceStatus.UNAVAILABLE,
                         confidence=0.0, note="network unreachable"))
        assert s.blind_spots[0].source_id == "gh.api"

    def test_an_exploding_collector_becomes_an_error_reading(self):
        s = run_collectors([ExplodingCollector()])
        c = s.coverage[0]
        assert c.status is SourceStatus.ERROR
        assert "upstream on fire" in c.note
        assert c.absence_is_meaningful is False

    def test_one_broken_source_does_not_lose_the_others(self):
        s = run_collectors([
            ExplodingCollector(),
            FakeCollector("a.ok", "git",
                          reading("a.ok", "git", SourceStatus.AVAILABLE, absence=True)),
        ])
        assert len(s.readings) == 2
        assert s.coverage_ratio == 0.5


# ── snapshot views ───────────────────────────────────────────────────────────


class TestSnapshotViews:
    def test_missing_domains_lists_every_domain_with_no_seeing_source(self):
        s = snap(reading("git.repo", "git", SourceStatus.AVAILABLE, absence=True))
        assert "git" not in s.missing_domains
        assert "music" in s.missing_domains
        assert set(s.missing_domains) <= set(DOMAINS)

    def test_a_blind_source_does_not_cover_its_domain(self):
        s = snap(not_configured("communications.gmail", "communications", "no auth"))
        assert "communications" in s.missing_domains

    def test_ordering_is_preserved_so_reports_are_diffable(self):
        ids = ["c", "a", "b"]
        s = run_collectors([
            FakeCollector(i, "git", reading(i, "git", SourceStatus.AVAILABLE)) for i in ids
        ])
        assert [c.source_id for c in s.coverage] == ids

    def test_serialisation_round_trips_status_as_a_string(self):
        d = snap(not_configured("m.a", "music", "none")).to_dict()
        assert d["readings"][0]["status"] == "not_configured"
        assert d["readings"][0]["payload"] == {}


# ── the report ───────────────────────────────────────────────────────────────


class TestCoverageReport:
    def test_states_what_can_and_cannot_be_concluded(self):
        s = snap(
            reading("git.repo", "git", SourceStatus.AVAILABLE, absence=True),
            not_configured("communications.gmail", "communications", "not authenticated"),
        )
        out = coverage_report(s)
        assert "git.repo — an empty result here means it did not happen" in out
        assert "BLIND SPOTS — silence here proves NOTHING" in out
        assert "not authenticated" in out

    def test_says_so_explicitly_when_nothing_may_be_concluded(self):
        out = coverage_report(snap(not_configured("m.a", "music", "none")))
        assert "no source may be read as 'nothing happened'" in out


# ── the tool entry point ─────────────────────────────────────────────────────


class TestRunMorningBrief:
    def test_returns_snapshot_not_prose(self):
        out = run_morning_brief({})
        assert out["stage"] == "snapshot"
        assert out["spoken"] is False
        for absent in ("text", "speech", "summary", "recommendation", "priorities"):
            assert absent not in out

    def test_reports_its_own_blindness(self):
        out = run_morning_brief({})
        assert out["blind_spot_count"] > 0
        assert "music" in out["missing_domains"]

    def test_is_registered_as_a_tool(self):
        from mos.tools import has_tool, run_tool
        assert has_tool("run_morning_brief")
        ok, result = run_tool("run_morning_brief", {})
        assert ok and result["stage"] == "snapshot"

    def test_every_declared_domain_has_a_collector(self):
        """A domain with no collector at all would be an invisible blind spot."""
        covered = {c.domain for c in collect_morning_snapshot().coverage}
        assert set(DOMAINS) <= covered


# ── the real collectors ──────────────────────────────────────────────────────


class TestRealCollectors:
    def test_only_available_sources_claim_meaningful_silence(self):
        """An empty payload may only be read as evidence by a source that LOOKED.

        Previously this pinned an exact source-id list (`["git.repo"]`), which
        broke the moment a second real collector landed and would break again on
        the next one. The product contract is not "which sources" — it is "under
        what conditions", so the invariant is asserted instead: STALE, UNAVAILABLE,
        ERROR and NOT_CONFIGURED can never claim their silence means anything.
        """
        for c in collect_morning_snapshot().coverage:
            if c.status is not SourceStatus.AVAILABLE:
                assert c.absence_is_meaningful is False, (
                    f"{c.source_id} is {c.status.value} and must not claim meaningful silence"
                )

    def test_no_blind_source_ever_claims_meaningful_silence(self):
        """The invariant behind the rule above — true no matter which sources exist."""
        for c in collect_morning_snapshot().coverage:
            if c.is_blind:
                assert c.absence_is_meaningful is False, c.source_id

    def test_at_least_one_source_can_conclude_from_absence(self):
        """A capability check, not a roster: the pipeline must be able to observe
        SOMETHING well enough that its silence counts. Fails if every collector
        degrades to blind, without pinning which ones are healthy today."""
        assert any(c.can_conclude_from_absence for c in collect_morning_snapshot().coverage)

    def test_git_outside_a_repo_reports_not_configured(self, tmp_path):
        r = GitCollector(root=tmp_path).collect()
        assert r.coverage.status is SourceStatus.NOT_CONFIGURED
        assert r.coverage.absence_is_meaningful is False

    def test_project_activity_never_claims_absence_is_meaningful(self, tmp_path):
        """Work happens off-repo; zero touched files cannot mean zero work."""
        subprocess.run(["git", "init", "-q", str(tmp_path)], check=True, timeout=30)
        r = ProjectActivityCollector(root=tmp_path).collect()
        assert r.coverage.absence_is_meaningful is False

    def test_unconfigured_domains_carry_a_reason(self):
        for c in collect_morning_snapshot().coverage:
            if c.status is SourceStatus.NOT_CONFIGURED:
                assert len(c.note) > 20, f"{c.source_id} must explain its absence"

    def test_default_set_declares_a_source_for_music_and_finance(self):
        ids = {c.source_id for c in default_collectors()}
        assert "music.ableton" in ids
        assert "finance.ledger" in ids

    def test_not_configured_collector_is_inert(self):
        r = NotConfiguredCollector("x.y", "ideas", "nothing wired").collect()
        assert r.payload == {}
        assert r.coverage.confidence == 1.0   # certain only that nothing is wired
