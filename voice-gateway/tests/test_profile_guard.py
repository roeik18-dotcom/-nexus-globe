"""The pre-commit guard that keeps real profile data out of git.

.gitignore is a default; `git add -f` overrides it and a rename escapes it. This
guard is the enforced half. The rules are pure functions so they can be tested
without a repository, and none of these tests touch or read Roei's real files.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts" / "hooks"))

from profile_guard import (  # noqa: E402
    blocked_paths,
    format_message,
    in_fixture_zone,
    is_example,
    looks_like_profile,
)

PROFILES = "voice-gateway/profiles/"

# Synthetic, obviously fictional — never a real profile.
FAKE_PROFILE = """owner: nobody
layer: person
schema_version: 1
entries:
  - id: x
    type: fact
    statement: "Fictional."
"""

ORDINARY_YAML = """version: 2
services:
  web:
    image: nginx
"""


def paths(*p: str) -> list[str]:
    return list(p)


# ── blocked ──────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("name", ["person.yaml", "music.yaml", "routine.yaml"])
def test_real_profile_yaml_is_blocked(name):
    blocks = blocked_paths(paths(PROFILES + name))
    assert [b.path for b in blocks] == [PROFILES + name]
    assert blocks[0].rule == "path"


def test_a_future_profile_file_is_blocked_without_a_rule_change():
    """Fail-closed: anything new under profiles/ is blocked by default."""
    for name in ("projects.yaml", "daily_opening.yaml", "whatever.yml"):
        assert blocked_paths(paths(PROFILES + name)), name


def test_every_blocked_path_is_listed_not_just_the_first():
    blocks = blocked_paths(paths(
        PROFILES + "person.yaml", PROFILES + "music.yaml", PROFILES + "routine.yaml",
    ))
    assert len(blocks) == 3
    listed = format_message(blocks)
    for name in ("person.yaml", "music.yaml", "routine.yaml"):
        assert name in listed


def test_a_profile_renamed_out_of_the_directory_is_still_blocked():
    """The rename bypass: path rule misses it, shape rule catches it."""
    moved = "voice-gateway/data/my-profile.yaml"
    blocks = blocked_paths(paths(moved), read_staged=lambda _p: FAKE_PROFILE)
    assert [b.path for b in blocks] == [moved]
    assert blocks[0].rule == "shape"


def test_a_profile_renamed_within_the_directory_is_blocked_by_path():
    blocks = blocked_paths(paths(PROFILES + "person-real.yaml"))
    assert blocks[0].rule == "path"


# ── allowed ──────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("name", ["person.example.yaml", "music.example.yaml"])
def test_example_files_are_allowed(name):
    assert blocked_paths(paths(PROFILES + name)) == []


def test_example_files_are_allowed_even_though_they_are_profile_shaped(self=None):
    """The examples contain owner/layer/entries — the allow-list must win."""
    p = PROFILES + "person.example.yaml"
    assert blocked_paths(paths(p), read_staged=lambda _p: FAKE_PROFILE) == []


def test_schema_md_is_allowed():
    assert blocked_paths(paths(PROFILES + "SCHEMA.md")) == []


def test_unrelated_yaml_outside_profiles_is_allowed():
    assert blocked_paths(
        paths("docker-compose.yaml", ".github/workflows/ci.yml"),
        read_staged=lambda _p: ORDINARY_YAML,
    ) == []


def test_synthetic_fixtures_outside_the_live_directory_are_allowed():
    for p in (
        "voice-gateway/tests/fixtures/person.yaml",
        "app/lib/philos/__tests__/sample.yaml",
    ):
        assert blocked_paths(paths(p), read_staged=lambda _p: FAKE_PROFILE) == [], p


def test_non_yaml_files_are_never_considered():
    assert blocked_paths(paths(
        "voice-gateway/mos/personal_config.py",
        "voice-gateway/profiles/README.md",
    )) == []


# ── rule helpers ─────────────────────────────────────────────────────────────


def test_shape_detection_needs_all_three_markers():
    assert looks_like_profile(FAKE_PROFILE)
    assert not looks_like_profile(ORDINARY_YAML)
    assert not looks_like_profile("owner: nobody\nentries:\n")        # no layer
    assert not looks_like_profile("layer: person\nentries:\n")        # no owner


def test_fixture_zone_recognises_the_usual_test_paths():
    assert in_fixture_zone("voice-gateway/tests/fixtures/x.yaml")
    assert in_fixture_zone("app/__tests__/x.yaml")
    assert not in_fixture_zone("voice-gateway/data/x.yaml")


def test_is_example_matches_both_suffixes():
    assert is_example("a/person.example.yaml")
    assert is_example("a/person.example.yml")
    assert not is_example("a/person.yaml")


def test_an_unreadable_blob_does_not_block():
    """A read failure is not evidence of a violation."""
    def boom(_p):
        raise OSError("gone")
    assert blocked_paths(paths("voice-gateway/data/x.yaml"), read_staged=boom) == []


# ── the message ──────────────────────────────────────────────────────────────


def test_message_explains_the_rule_and_never_prints_content():
    blocks = blocked_paths(paths(PROFILES + "person.yaml"))
    msg = format_message(blocks)
    assert "must stay local" in msg or "LOCAL ONLY" in msg
    assert "git restore --staged" in msg
    assert "no-verify" in msg
    for secret in ("statement:", "entries:", "owner:"):
        assert secret not in msg
