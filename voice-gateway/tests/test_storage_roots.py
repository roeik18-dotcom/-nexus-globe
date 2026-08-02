"""Storage roots, portable source resolution, and hash verification (I13).

The property under test: a citation stays valid across machines, and every way
that can fail says so out loud.

The failure this prevents is quiet credibility. A source that moved, vanished or
changed since it was cited must not keep counting as evidence — but nor should an
unconfigured laptop make a valid profile look broken. Those are different facts
and they are reported through different channels: `source_issues` for machine
state, `errors` for the profile itself.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from mos.personal_config import load_personal_config, verify_sources  # noqa: E402
from mos.storage_roots import (  # noqa: E402
    ENV_VAR,
    load_storage_roots,
    resolve_source,
    sha256_of,
    verify_hash,
)

# ── fixtures ─────────────────────────────────────────────────────────────────


def archive(tmp: Path, name: str = "vision.rtf", body: str = "artistic vision") -> tuple[Path, Path]:
    """A synthetic 'Dropbox' with one source file in it."""
    root = tmp / "archive"
    (root / "music").mkdir(parents=True, exist_ok=True)
    f = root / "music" / name
    f.write_text(body, encoding="utf-8")
    return root, f


def profile(tmp: Path, *, sha: str | None, rel: str = "music/vision.rtf", root: str = "dropbox") -> Path:
    d = tmp / "profiles"
    d.mkdir(parents=True, exist_ok=True)
    sha_line = f'    content_sha256: "{sha}"' if sha else "    content_sha256: null"
    (d / "music.yaml").write_text(f"""\
owner: roei
layer: music
schema_version: 2
sources:
  s-vision:
    storage_root: {root}
    relative_path: {rel}
    source_kind: rtf
{sha_line}
entries:
  - id: music-core-contrast
    section: core_identity
    type: personal_principle
    status: active
    value: "Contrast carries the emotion."
    canonical_sources: [{{source_id: s-vision, evidence_ref: "vision", evidence_precision: section}}]
    privacy: private
    usage: {{merlin_context: true}}
    order: 20
    verification_status: source_backed
""", encoding="utf-8")
    return d


def issues_of(state) -> str:
    return " | ".join(str(i) for i in state.source_issues)


# ── 1. configuration ─────────────────────────────────────────────────────────


class TestConfiguration:
    def test_explicit_map_wins(self, tmp_path):
        roots, issues = load_storage_roots({"dropbox": str(tmp_path)})
        assert roots["dropbox"] == tmp_path
        assert issues == []

    def test_env_var_accepts_inline_json(self, tmp_path):
        roots, issues = load_storage_roots(
            env={ENV_VAR: json.dumps({"dropbox": str(tmp_path)})})
        assert roots["dropbox"] == tmp_path
        assert issues == []

    def test_env_var_accepts_a_config_path(self, tmp_path):
        cfg = tmp_path / "roots.yaml"
        cfg.write_text(f'storage_roots:\n  dropbox: "{tmp_path}"\n', encoding="utf-8")
        roots, issues = load_storage_roots(env={ENV_VAR: str(cfg)})
        assert roots["dropbox"] == tmp_path
        assert issues == []

    def test_missing_configuration_is_explicit_not_a_guess(self, tmp_path):
        """No config must never fall back to a home directory."""
        roots, issues = load_storage_roots(env={}, config_path=tmp_path / "absent.yaml")
        assert roots == {}
        assert any(i.kind == "unconfigured_root" for i in issues)
        assert ENV_VAR in str(issues[0])

    def test_malformed_config_is_reported(self, tmp_path):
        cfg = tmp_path / "roots.yaml"
        cfg.write_text("storage_roots:\n  bad:\n   [\n", encoding="utf-8")
        roots, issues = load_storage_roots(env={}, config_path=cfg)
        assert roots == {}
        assert any(i.kind == "unreadable" for i in issues)

    def test_committed_example_holds_no_real_path(self):
        ex = Path(__file__).resolve().parent.parent / "config" / "storage_roots.example.yaml"
        assert ex.exists(), "the example must be committed so the shape is discoverable"
        text = ex.read_text(encoding="utf-8")
        for leak in ("/Users/", "/home/", "CloudStorage"):
            assert leak not in text, f"example leaks a real path fragment: {leak}"

    def test_the_real_config_is_git_ignored(self):
        gi = (Path(__file__).resolve().parent.parent.parent / ".gitignore").read_text(encoding="utf-8")
        assert "voice-gateway/config/storage_roots.yaml" in gi


# ── 2. resolution ────────────────────────────────────────────────────────────


class TestResolution:
    def test_resolves_root_plus_relative_path(self, tmp_path):
        root, f = archive(tmp_path)
        got, issue = resolve_source("s", "dropbox", "music/vision.rtf", {"dropbox": root})
        assert issue is None
        assert got is not None and got.exists and got.path == f.resolve()

    def test_absolute_relative_path_is_refused(self, tmp_path):
        root, _ = archive(tmp_path)
        got, issue = resolve_source("s", "dropbox", "/etc/passwd", {"dropbox": root})
        assert got is None
        assert issue is not None and issue.kind == "absolute_path"

    def test_home_relative_path_is_refused(self, tmp_path):
        root, _ = archive(tmp_path)
        _, issue = resolve_source("s", "dropbox", "~/secrets.txt", {"dropbox": root})
        assert issue is not None and issue.kind == "absolute_path"

    def test_path_traversal_outside_the_root_is_refused(self, tmp_path):
        root, _ = archive(tmp_path)
        (tmp_path / "outside.txt").write_text("x", encoding="utf-8")
        got, issue = resolve_source("s", "dropbox", "../outside.txt", {"dropbox": root})
        assert got is None
        assert issue is not None and issue.kind == "traversal"

    def test_traversal_is_caught_even_when_the_target_does_not_exist(self, tmp_path):
        root, _ = archive(tmp_path)
        _, issue = resolve_source("s", "dropbox", "../../nope.txt", {"dropbox": root})
        assert issue is not None and issue.kind == "traversal"

    def test_unconfigured_root_is_explicit(self, tmp_path):
        got, issue = resolve_source("s", "dropbox", "music/vision.rtf", {})
        assert got is None
        assert issue is not None and issue.kind == "unconfigured_root"
        assert "dropbox" in issue.problem

    def test_missing_file_is_explicit_and_not_treated_as_empty(self, tmp_path):
        root, _ = archive(tmp_path)
        got, issue = resolve_source("s", "dropbox", "music/gone.rtf", {"dropbox": root})
        assert issue is not None and issue.kind == "missing_file"
        assert got is not None and got.exists is False


# ── 3. hash verification (I13) ───────────────────────────────────────────────


class TestHashVerification:
    def test_null_hash_is_allowed_and_means_unverified(self, tmp_path):
        _, f = archive(tmp_path)
        ok, issue = verify_hash("s", f, None)
        assert ok is None      # not True — absence of a hash is not verification
        assert issue is None

    def test_matching_hash_passes(self, tmp_path):
        _, f = archive(tmp_path)
        ok, issue = verify_hash("s", f, sha256_of(f))
        assert ok is True and issue is None

    def test_mismatching_hash_is_explicit(self, tmp_path):
        _, f = archive(tmp_path)
        ok, issue = verify_hash("s", f, "0" * 64)
        assert ok is False
        assert issue is not None and issue.kind == "hash_mismatch"

    def test_a_mismatch_never_reads_as_verified(self, tmp_path):
        """The whole point: drifted content must lose its credibility."""
        d = profile(tmp_path, sha="0" * 64)
        root, _ = archive(tmp_path)
        state, _ = load_personal_config(
            d, ["music.yaml"], storage_roots={"dropbox": str(root)}, verify=True)
        assert state.summary()["hash_mismatches"] == 1
        assert state.summary()["sources_verified"] == 0

    def test_hash_check_does_not_print_file_contents(self, tmp_path):
        _, f = archive(tmp_path, body="a private artistic statement")
        _, issue = verify_hash("s", f, "0" * 64)
        assert "private artistic statement" not in str(issue)

    def test_verification_mutates_nothing(self, tmp_path):
        d = profile(tmp_path, sha=None)
        root, f = archive(tmp_path)
        before = [(p.read_bytes(), p.stat().st_mtime_ns) for p in (f, d / "music.yaml")]
        load_personal_config(d, ["music.yaml"], storage_roots={"dropbox": str(root)}, verify=True)
        after = [(p.read_bytes(), p.stat().st_mtime_ns) for p in (f, d / "music.yaml")]
        assert before == after


# ── 4. loader integration ────────────────────────────────────────────────────


class TestLoaderIntegration:
    def test_configured_root_resolves_and_verifies(self, tmp_path):
        root, f = archive(tmp_path)
        d = profile(tmp_path, sha=sha256_of(f))
        state, _ = load_personal_config(
            d, ["music.yaml"], storage_roots={"dropbox": str(root)}, verify=True)
        assert state.is_valid
        assert state.summary()["sources_resolved"] == 1
        assert state.summary()["sources_verified"] == 1
        assert state.source_issues == ()

    def test_missing_root_does_not_invalidate_the_profile(self, tmp_path):
        """A profile is not wrong because THIS machine lacks a storage root."""
        d = profile(tmp_path, sha=None)
        state, _ = load_personal_config(d, ["music.yaml"], storage_roots={}, verify=True)
        assert state.is_valid, [str(e) for e in state.errors]
        assert "unconfigured_root" in " ".join(i.kind for i in state.source_issues)
        assert [e.id for e in state.music] == ["music-core-contrast"]

    def test_verification_is_off_by_default(self, tmp_path):
        """The common caller wants profile health, not an archive audit."""
        d = profile(tmp_path, sha=None)
        state, _ = load_personal_config(d, ["music.yaml"])
        assert state.resolved_sources == ()
        assert state.source_issues == ()

    def test_missing_source_file_is_surfaced(self, tmp_path):
        root, _ = archive(tmp_path)
        d = profile(tmp_path, sha=None, rel="music/absent.rtf")
        state, _ = load_personal_config(
            d, ["music.yaml"], storage_roots={"dropbox": str(root)}, verify=True)
        assert "missing_file" in " ".join(i.kind for i in state.source_issues)


# ── 5. collector summary ─────────────────────────────────────────────────────


class TestSummaryDiagnostics:
    def test_summary_reports_the_v2_lifecycle_counts(self, tmp_path):
        root, f = archive(tmp_path)
        d = profile(tmp_path, sha=sha256_of(f))
        state, _ = load_personal_config(
            d, ["music.yaml"], storage_roots={"dropbox": str(root)}, verify=True)
        s = state.summary()
        for key in ("schema_version", "active", "historical", "archived",
                    "review_candidates", "unresolved_cross_links",
                    "sources_resolved", "sources_verified", "hash_mismatches"):
            assert key in s, key
        assert s["schema_version"] == 2

    def test_summary_never_carries_entry_values(self, tmp_path):
        root, f = archive(tmp_path)
        d = profile(tmp_path, sha=sha256_of(f))
        state, _ = load_personal_config(
            d, ["music.yaml"], storage_roots={"dropbox": str(root)}, verify=True)
        blob = repr(state.summary())
        assert "Contrast carries the emotion" not in blob

    def test_summary_never_carries_resolved_absolute_paths(self, tmp_path):
        """A resolved path is machine-specific; the snapshot travels into logs."""
        root, f = archive(tmp_path)
        d = profile(tmp_path, sha=sha256_of(f))
        state, _ = load_personal_config(
            d, ["music.yaml"], storage_roots={"dropbox": str(root)}, verify=True)
        assert str(root) not in repr(state.summary())


# ── 6. v1 is untouched by any of this ────────────────────────────────────────


class TestV1Unaffected:
    def test_v1_profiles_have_no_sources_and_no_issues(self):
        p = Path(__file__).resolve().parent.parent / "profiles"
        state, _ = load_personal_config(
            p, ["person.example.yaml", "music.example.yaml"], verify=True)
        assert state.is_valid
        assert state.resolved_sources == ()
        # a v1 file has no registry, so no root is ever needed to read it
        assert all(i.kind != "missing_file" for i in state.source_issues)

    def test_verify_sources_on_v1_files_finds_nothing_to_do(self):
        p = Path(__file__).resolve().parent.parent / "profiles"
        _, loaded = load_personal_config(p, ["person.example.yaml"])
        resolved, issues = verify_sources(loaded, roots={})
        assert resolved == ()
        assert issues == ()
