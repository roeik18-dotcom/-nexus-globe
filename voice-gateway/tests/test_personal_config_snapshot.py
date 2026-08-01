"""Personal Config as a Morning Snapshot source.

Two things must hold at this seam, and they pull in opposite directions:

  1. The snapshot must know whether Merlin has a profile at all — otherwise the
     day-opener cannot tell "no changes since yesterday" from "no profile".
  2. The snapshot must NOT carry the profile's contents. It is a diagnostic
     passed between layers and printed in reports; statements about a person do
     not belong in it.

So the collector reports SUMMARY ONLY: counts, validity, provenance, age. These
tests pin both halves — presence of the health signal, absence of the content.
No test reads Roei's real profile.
"""
from __future__ import annotations

import shutil
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from mos.collectors import PersonalConfigCollector, default_collectors  # noqa: E402
from mos.morning import collect_morning_snapshot  # noqa: E402
from mos.snapshot import DOMAINS, SourceStatus  # noqa: E402

EXAMPLES = Path(__file__).resolve().parent.parent / "profiles"

SYNTHETIC = """owner: test-user
layer: person
schema_version: 1
entries:
  - id: a
    type: fact
    statement: "A synthetic statement that must never reach the snapshot."
    confidence: stated
    valid_from: null
    valid_until: null
    privacy: public
    usage: { merlin: true, founder_principle_candidate: false, philos_core: false }
"""


def _dir_with(**files: str) -> Path:
    d = Path(tempfile.mkdtemp())
    for name, text in files.items():
        (d / name.replace("__", ".")).write_text(text)
    return d


# ── the collector is wired in ────────────────────────────────────────────────


def test_personal_config_is_a_registered_domain():
    assert "personal_config" in DOMAINS
    domains = {c.domain for c in collect_morning_snapshot().coverage}
    assert "personal_config" in domains


def test_the_default_set_uses_the_real_collector_not_a_stub():
    ids = {type(c).__name__ for c in default_collectors()}
    assert "PersonalConfigCollector" in ids


# ── summary only: health in, content out ─────────────────────────────────────


def test_payload_carries_health_not_statements():
    d = _dir_with(person__yaml=SYNTHETIC)
    r = PersonalConfigCollector(d).collect()
    assert r.coverage.status is SourceStatus.AVAILABLE

    blob = repr(r.payload)
    assert "synthetic statement" not in blob.lower()
    assert "A synthetic statement" not in blob
    # but the health signal IS present
    assert r.payload, "an available profile must report something"


def test_no_entry_statement_appears_anywhere_in_the_snapshot():
    """The whole snapshot is printed in diagnostics — content must not ride along."""
    d = _dir_with(person__yaml=SYNTHETIC)
    snap = collect_morning_snapshot([PersonalConfigCollector(d)])
    assert "must never reach the snapshot" not in snap.to_json()


# ── absence is about the sensor, not the person ──────────────────────────────


def test_a_missing_profile_is_not_configured_and_proves_nothing():
    r = PersonalConfigCollector(Path(tempfile.mkdtemp())).collect()
    assert r.coverage.status is SourceStatus.NOT_CONFIGURED
    assert r.coverage.absence_is_meaningful is False
    assert r.coverage.can_conclude_from_absence is False
    assert r.payload == {}


def test_example_files_alone_are_not_a_profile():
    """The leak case: examples present, real files absent."""
    d = Path(tempfile.mkdtemp())
    for name in ("person.example.yaml", "music.example.yaml"):
        shutil.copy(EXAMPLES / name, d / name)
    r = PersonalConfigCollector(d).collect()
    assert r.coverage.status is SourceStatus.NOT_CONFIGURED
    assert r.payload == {}


def test_a_missing_profile_leaves_the_domain_uncovered():
    snap = collect_morning_snapshot(
        [PersonalConfigCollector(Path(tempfile.mkdtemp()))]
    )
    assert "personal_config" in snap.missing_domains
    assert len(snap.blind_spots) == 1


def test_a_present_profile_covers_the_domain():
    d = _dir_with(person__yaml=SYNTHETIC)
    snap = collect_morning_snapshot([PersonalConfigCollector(d)])
    assert "personal_config" not in snap.missing_domains
    assert snap.blind_spots == ()


# ── malformed input is a fact about the file ─────────────────────────────────


def test_unparseable_yaml_does_not_crash_the_morning():
    d = _dir_with(person__yaml="{{ not yaml at all")
    r = PersonalConfigCollector(d).collect()
    assert r.coverage.status in {SourceStatus.ERROR, SourceStatus.NOT_CONFIGURED}
    assert r.coverage.absence_is_meaningful is False
    assert r.coverage.note, "a non-available status must explain itself"


def test_one_bad_profile_does_not_lose_the_other_sources():
    d = _dir_with(person__yaml="{{ broken")
    snap = collect_morning_snapshot(
        [*default_collectors()[:3], PersonalConfigCollector(d)]
    )
    assert len(snap.readings) == 4
    assert any(not c.is_blind for c in snap.coverage)
