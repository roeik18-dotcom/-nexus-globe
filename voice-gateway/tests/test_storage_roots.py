"""Storage roots and portable source resolution.

The property under test: a citation stays valid across machines, and every way
that can fail says so out loud.

The failure this prevents is quiet credibility. A source that moved, vanished or
changed since it was cited must not keep counting as evidence — but nor should an
unconfigured laptop make a valid profile look broken. Those are different facts
and they are reported through different channels: `source_issues` for machine
state, `errors` for the profile itself.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from mos.storage_roots import (  # noqa: E402
    ENV_VAR,
    load_storage_roots,
    resolve_source,
)

# ── fixtures ─────────────────────────────────────────────────────────────────


def archive(tmp: Path, name: str = "vision.rtf", body: str = "artistic vision") -> tuple[Path, Path]:
    """A synthetic 'Dropbox' with one source file in it."""
    root = tmp / "archive"
    (root / "music").mkdir(parents=True, exist_ok=True)
    f = root / "music" / name
    f.write_text(body, encoding="utf-8")
    return root, f


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
