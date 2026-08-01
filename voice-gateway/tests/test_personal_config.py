"""Personal Config loader, projection and collector.

The invariant under test throughout: invalid data is never silently dropped. A
profile that quietly loses three principles is worse than one that refuses to
load — the first is undetectable, the second is obvious. Every malformed case
below asserts that the problem is REPORTED, not just that it is absent.
"""
from __future__ import annotations

import datetime
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from mos.collectors import PersonalConfigCollector  # noqa: E402
from mos.personal_config import (  # noqa: E402
    CONFIG_DOMAINS,
    SCHEMA_VERSION,
    load_file,
    load_personal_config,
    project,
)
from mos.snapshot import SourceStatus  # noqa: E402

# ── fixtures ─────────────────────────────────────────────────────────────────

VALID_PERSON = """\
owner: roei
layer: person
schema_version: 1
entries:
  - id: identity
    type: fact
    statement: "Roei — creator and musician."
    confidence: stated
    valid_from: null
    valid_until: null
    privacy: public
    usage: { merlin: true, founder_principle_candidate: false, philos_core: false }
  - id: old-routine
    type: historical_pattern
    statement: "Used to work nights."
    confidence: observed
    valid_from: 2019
    valid_until: historical
    privacy: private
    usage: { merlin: true, founder_principle_candidate: false, philos_core: false }
"""

VALID_MUSIC = """\
owner: roei
layer: music
schema_version: 1
entries:
  - id: daw
    type: fact
    statement: "Main DAW: Ableton Live."
    confidence: stated
    valid_from: null
    valid_until: null
    privacy: public
    usage: { merlin: true, founder_principle_candidate: false, philos_core: false }
"""

EMPTY_VALID = """\
owner: roei
layer: person
schema_version: 1
entries: []
"""

MALFORMED_YAML = """\
owner: roei
layer: person
  schema_version: 1
   entries: [
"""

WRONG_VERSION = """\
owner: roei
layer: person
schema_version: 99
entries:
  - id: x
    type: fact
    statement: "y"
    confidence: stated
    valid_from: null
    valid_until: null
    privacy: public
    usage: { merlin: true }
"""


def write(tmp: Path, person: str | None = None, music: str | None = None) -> Path:
    tmp.mkdir(parents=True, exist_ok=True)
    d = tmp / "profiles"
    d.mkdir(exist_ok=True)
    if person is not None:
        (d / "person.yaml").write_text(person, encoding="utf-8")
    if music is not None:
        (d / "music.yaml").write_text(music, encoding="utf-8")
    return d


# ── 1. valid person + music ──────────────────────────────────────────────────


class TestValidConfig:
    def test_loads_both_files(self, tmp_path):
        state, _ = load_personal_config(write(tmp_path, VALID_PERSON, VALID_MUSIC))
        assert state.is_valid
        assert set(state.sources) == {"person.yaml", "music.yaml"}

    def test_separates_person_from_music(self, tmp_path):
        state, _ = load_personal_config(write(tmp_path, VALID_PERSON, VALID_MUSIC))
        assert [e.id for e in state.person] == ["identity"]
        assert [e.id for e in state.music] == ["daw"]

    def test_historical_entries_leave_the_current_domains(self, tmp_path):
        state, _ = load_personal_config(write(tmp_path, VALID_PERSON, VALID_MUSIC))
        assert [e.id for e in state.routines_history] == ["old-routine"]
        assert "old-routine" not in [e.id for e in state.person]

    def test_preserves_provenance_on_every_entry(self, tmp_path):
        state, _ = load_personal_config(write(tmp_path, VALID_PERSON, VALID_MUSIC))
        for e in (*state.person, *state.music, *state.routines_history):
            assert e.source_file in {"person.yaml", "music.yaml"}
            assert e.source_index >= 0
            assert e.schema_version == SCHEMA_VERSION
            assert e.layer

    def test_all_domains_exist_even_when_empty(self, tmp_path):
        state, _ = load_personal_config(write(tmp_path, VALID_PERSON, VALID_MUSIC))
        assert set(state.entry_counts()) == set(CONFIG_DOMAINS)
        assert state.entry_counts()["daily_opening"] == 0


# ── 2. missing files ─────────────────────────────────────────────────────────


class TestMissingFiles:
    def test_missing_dir_is_not_configured(self, tmp_path):
        r = PersonalConfigCollector(tmp_path / "nope").collect()
        assert r.coverage.status is SourceStatus.NOT_CONFIGURED
        assert r.coverage.note

    def test_not_configured_may_not_claim_meaningful_silence(self, tmp_path):
        r = PersonalConfigCollector(tmp_path / "nope").collect()
        assert r.coverage.absence_is_meaningful is False
        assert r.coverage.is_blind

    def test_one_missing_file_still_loads_the_other(self, tmp_path):
        state, _ = load_personal_config(write(tmp_path, VALID_PERSON, None))
        assert state.is_valid
        assert state.sources == ("person.yaml",)
        assert len(state.person) == 1


# ── 3. malformed YAML ────────────────────────────────────────────────────────


class TestMalformed:
    def test_malformed_yaml_is_error_not_silence(self, tmp_path):
        r = PersonalConfigCollector(write(tmp_path, MALFORMED_YAML, VALID_MUSIC)).collect()
        assert r.coverage.status is SourceStatus.ERROR
        assert "person.yaml" in r.coverage.note

    def test_malformed_file_reports_a_validation_error(self, tmp_path):
        state, _ = load_personal_config(write(tmp_path, MALFORMED_YAML, VALID_MUSIC))
        assert not state.is_valid
        assert any("malformed YAML" in str(e) for e in state.errors)

    def test_error_reading_cannot_claim_meaningful_silence(self, tmp_path):
        r = PersonalConfigCollector(write(tmp_path, MALFORMED_YAML, VALID_MUSIC)).collect()
        assert r.coverage.absence_is_meaningful is False
        assert r.coverage.confidence == 0.0


# ── 4. schema mismatch ───────────────────────────────────────────────────────


class TestSchemaVersion:
    def test_unsupported_version_is_reported(self, tmp_path):
        state, _ = load_personal_config(write(tmp_path, WRONG_VERSION, VALID_MUSIC))
        assert not state.is_valid
        assert any("unsupported version 99" in str(e) for e in state.errors)

    def test_unsupported_version_drops_no_entries_silently(self, tmp_path):
        # entries are refused, but the refusal is stated
        state, _ = load_personal_config(write(tmp_path, WRONG_VERSION, VALID_MUSIC))
        assert [e.id for e in state.person] == []
        assert len(state.errors) >= 1

    def test_missing_schema_version_is_an_error(self, tmp_path):
        state, _ = load_personal_config(write(tmp_path, "owner: roei\nlayer: person\nentries: []\n"))
        assert any("schema_version" in str(e) for e in state.errors)


# ── 5. empty but valid ───────────────────────────────────────────────────────


class TestEmptyValid:
    def test_empty_config_is_available_not_error(self, tmp_path):
        r = PersonalConfigCollector(write(tmp_path, EMPTY_VALID)).collect()
        assert r.coverage.status is SourceStatus.AVAILABLE
        assert r.payload["total_entries"] == 0

    def test_empty_valid_config_absence_is_meaningful(self, tmp_path):
        # nothing declared is a real answer about Roei, unlike a failed read
        r = PersonalConfigCollector(write(tmp_path, EMPTY_VALID)).collect()
        assert r.coverage.absence_is_meaningful is True
        assert r.coverage.can_conclude_from_absence is True


# ── the meaningful-silence contract ──────────────────────────────────────────


class TestMeaningfulSilenceContract:
    """absence_is_meaningful=True in exactly ONE case.

    Source exists · parsed · schema-valid · status AVAILABLE · projection empty.
    Anything else and an empty payload describes the FILE, not Roei. The failure
    this prevents: Merlin announcing "you have no personal config" when it simply
    could not read one.
    """

    def test_valid_empty_profile_is_the_only_true_case(self, tmp_path):
        r = PersonalConfigCollector(write(tmp_path, EMPTY_VALID)).collect()
        assert r.coverage.status is SourceStatus.AVAILABLE
        assert r.coverage.absence_is_meaningful is True

    def test_missing_files_are_not_meaningful(self, tmp_path):
        r = PersonalConfigCollector(tmp_path / "absent").collect()
        assert r.coverage.status is SourceStatus.NOT_CONFIGURED
        assert r.coverage.absence_is_meaningful is False

    def test_malformed_is_not_meaningful(self, tmp_path):
        r = PersonalConfigCollector(write(tmp_path, MALFORMED_YAML)).collect()
        assert r.coverage.status is SourceStatus.ERROR
        assert r.coverage.absence_is_meaningful is False

    def test_schema_mismatch_is_not_meaningful(self, tmp_path):
        r = PersonalConfigCollector(write(tmp_path, WRONG_VERSION)).collect()
        assert r.coverage.status is SourceStatus.ERROR
        assert r.coverage.absence_is_meaningful is False

    def test_stale_is_not_meaningful_even_though_it_parsed(self, tmp_path):
        """The case most easily got wrong: a stale profile IS readable.

        But an empty one describes what was true when it was written, not now, so
        its silence must not be read as a current fact.
        """
        future = datetime.datetime.now().astimezone() + datetime.timedelta(days=400)
        r = PersonalConfigCollector(write(tmp_path, EMPTY_VALID), max_age_days=90, now=future).collect()
        assert r.coverage.status is SourceStatus.STALE
        assert r.coverage.absence_is_meaningful is False
        assert r.coverage.can_conclude_from_absence is False

    def test_valid_non_empty_profile_is_available(self, tmp_path):
        r = PersonalConfigCollector(write(tmp_path, VALID_PERSON, VALID_MUSIC)).collect()
        assert r.coverage.status is SourceStatus.AVAILABLE
        # nothing to conclude from absence when the profile is not absent
        assert r.coverage.absence_is_meaningful is False

    def test_the_rule_holds_across_every_state(self, tmp_path):
        """Exhaustive: True iff AVAILABLE and empty."""
        future = datetime.datetime.now().astimezone() + datetime.timedelta(days=400)
        cases = [
            (PersonalConfigCollector(tmp_path / "absent"), False),
            (PersonalConfigCollector(write(tmp_path / "a", MALFORMED_YAML)), False),
            (PersonalConfigCollector(write(tmp_path / "b", WRONG_VERSION)), False),
            (PersonalConfigCollector(write(tmp_path / "c", EMPTY_VALID), max_age_days=90, now=future), False),
            (PersonalConfigCollector(write(tmp_path / "d", VALID_PERSON)), False),
            (PersonalConfigCollector(write(tmp_path / "e", EMPTY_VALID)), True),
        ]
        for collector, expected in cases:
            cov = collector.collect().coverage
            assert cov.absence_is_meaningful is expected, f"{cov.status.value}"
            if cov.absence_is_meaningful:
                assert cov.status is SourceStatus.AVAILABLE

    def test_entries_absent_entirely_is_still_valid(self, tmp_path):
        state, _ = load_personal_config(write(tmp_path, "owner: roei\nlayer: person\nschema_version: 1\n"))
        assert state.is_valid
        assert state.is_empty


# ── 6. stale ─────────────────────────────────────────────────────────────────


class TestStale:
    def test_old_profile_is_stale(self, tmp_path):
        d = write(tmp_path, VALID_PERSON)
        future = datetime.datetime.now().astimezone() + datetime.timedelta(days=365)
        r = PersonalConfigCollector(d, max_age_days=90, now=future).collect()
        assert r.coverage.status is SourceStatus.STALE
        assert "days ago" in r.coverage.note

    def test_stale_is_readable_but_its_silence_is_not_evidence(self, tmp_path):
        """STALE is not blind — the file WAS read — yet its silence still says
        nothing about now. Both halves matter: a downstream layer may use what a
        stale profile contains, but may not conclude from what it lacks."""
        d = write(tmp_path, VALID_PERSON)
        future = datetime.datetime.now().astimezone() + datetime.timedelta(days=365)
        r = PersonalConfigCollector(d, max_age_days=90, now=future).collect()
        assert r.coverage.is_blind is False
        assert r.coverage.absence_is_meaningful is False
        assert r.coverage.can_conclude_from_absence is False
        assert r.coverage.confidence < 1.0

    def test_fresh_profile_is_available(self, tmp_path):
        r = PersonalConfigCollector(write(tmp_path, VALID_PERSON), max_age_days=90).collect()
        assert r.coverage.status is SourceStatus.AVAILABLE


# ── 7. one valid file, one invalid ───────────────────────────────────────────


class TestMixedValidity:
    def test_valid_entries_still_load(self, tmp_path):
        state, _ = load_personal_config(write(tmp_path, MALFORMED_YAML, VALID_MUSIC))
        assert [e.id for e in state.music] == ["daw"]

    def test_but_the_reading_is_still_an_error(self, tmp_path):
        # partial data is a failed read, not a successful one
        r = PersonalConfigCollector(write(tmp_path, MALFORMED_YAML, VALID_MUSIC)).collect()
        assert r.coverage.status is SourceStatus.ERROR

    def test_one_bad_entry_costs_one_entry(self, tmp_path):
        bad = VALID_PERSON + """\
  - id: broken
    type: nonsense
    statement: "x"
    confidence: stated
    valid_from: null
    valid_until: null
    privacy: public
    usage: { merlin: true }
"""
        state, _ = load_personal_config(write(tmp_path, bad))
        assert "identity" in [e.id for e in state.person]
        assert "broken" not in [e.id for e in state.person]
        assert any("unknown type" in str(e) for e in state.errors)

    def test_duplicate_ids_are_reported(self, tmp_path):
        state, _ = load_personal_config(write(tmp_path, VALID_PERSON + VALID_PERSON.split("entries:")[1]))
        assert any("duplicate id" in str(e) for e in state.errors)

    def test_philos_core_true_is_rejected(self, tmp_path):
        bad = VALID_PERSON.replace("philos_core: false }", "philos_core: true }", 1)
        state, _ = load_personal_config(write(tmp_path, bad))
        assert any("Philos Core" in str(e) for e in state.errors)


# ── 8. isolation ─────────────────────────────────────────────────────────────


class TestCollectorIsolation:
    def test_collector_never_raises(self, tmp_path):
        for content in (MALFORMED_YAML, WRONG_VERSION, EMPTY_VALID, "[]", "just a string"):
            r = PersonalConfigCollector(write(tmp_path, content)).collect()
            assert r.coverage.status in set(SourceStatus)

    def test_a_broken_profile_does_not_break_sibling_collectors(self, tmp_path):
        from mos.snapshot import run_collectors
        from mos.collectors import ClockCollector

        collectors = [ClockCollector(), PersonalConfigCollector(write(tmp_path, MALFORMED_YAML))]
        snapshot = run_collectors(collectors)
        clock = snapshot.get("awareness.clock")
        assert clock is not None and clock.coverage.status is SourceStatus.AVAILABLE
        pc = snapshot.get("personal_config.profile")
        assert pc is not None and pc.coverage.status is SourceStatus.ERROR


# ── 9. the summary contract ──────────────────────────────────────────────────


class TestSummary:
    def test_summary_never_contains_profile_prose(self, tmp_path):
        r = PersonalConfigCollector(write(tmp_path, VALID_PERSON, VALID_MUSIC)).collect()
        blob = repr(r.payload)
        assert "Roei — creator" not in blob
        assert "Ableton" not in blob

    def test_summary_reports_the_required_fields(self, tmp_path):
        r = PersonalConfigCollector(write(tmp_path, VALID_PERSON, VALID_MUSIC)).collect()
        for key in (
            "schema_version", "domains_present", "entry_counts", "last_updated",
            "sources", "validation", "validation_errors", "recent_changes",
        ):
            assert key in r.payload

    def test_recent_changes_is_a_placeholder_not_a_lie(self, tmp_path):
        r = PersonalConfigCollector(write(tmp_path, VALID_PERSON)).collect()
        assert r.payload["recent_changes"] == []


# ── 10. the change-event seam ────────────────────────────────────────────────


class TestChangeSeam:
    def test_project_accepts_ordered_changes_without_a_rewrite(self, tmp_path):
        _, loaded = load_personal_config(write(tmp_path, VALID_PERSON))
        state = project(loaded, changes=[{"at": "2026-08-01", "op": "deprecate", "id": "identity"}])
        assert len(state.recent_changes) == 1
        assert state.recent_changes[0]["op"] == "deprecate"

    def test_seed_only_projection_reports_no_changes(self, tmp_path):
        state, _ = load_personal_config(write(tmp_path, VALID_PERSON))
        assert state.recent_changes == ()


# ── 11. real repo profiles ───────────────────────────────────────────────────


class TestRealProfiles:
    def test_the_checked_in_profiles_load_cleanly(self):
        d = Path(__file__).resolve().parent.parent / "profiles"
        if not (d / "person.yaml").exists():
            pytest.skip("profiles/ not present")
        state, _ = load_personal_config(d)
        assert state.is_valid, [str(e) for e in state.errors]
        assert state.schema_version == SCHEMA_VERSION
        assert len(state.person) > 0
        assert len(state.music) > 0
