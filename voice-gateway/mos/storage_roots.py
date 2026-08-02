"""Merlin OS · storage roots — machine-local resolution for portable sources.

A profile cites a source as `storage_root` + `relative_path` (SCHEMA-V2 §6, I8).
`storage_root` is a LOGICAL key: `dropbox`, `music_library`. The absolute base it
maps to is a fact about one laptop, so it lives here — never in profile data.

Why the split matters: a citation containing an absolute home path stops being a
citation the moment the archive moves or a second machine appears. Keeping the
map outside means relocating the archive edits one line of local config and no
profile at all.

This module resolves. It never writes, never migrates, and never reads a
source's contents into a diagnostic — a path and a reason are enough to act on,
and the contents are the private part.

CONFIGURATION, in precedence order
----------------------------------
1. an explicit dict passed by the caller (tests, and callers that already know)
2. `MERLIN_STORAGE_ROOTS` — either inline JSON, or a path to a YAML/JSON file
3. `voice-gateway/config/storage_roots.yaml` — git-ignored, machine-local

`storage_roots.example.yaml` is committed with synthetic paths so the shape is
discoverable; it is an example, never a fallback. If no configuration is found,
resolution fails with a stated reason rather than guessing at a home directory.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

#: Env var holding either inline JSON or a path to a config file.
ENV_VAR = "MERLIN_STORAGE_ROOTS"

#: Machine-local config, git-ignored. Sits beside the example, not in profiles/.
DEFAULT_CONFIG = Path(__file__).resolve().parent.parent / "config" / "storage_roots.yaml"

@dataclass(frozen=True)
class SourceIssue:
    """One problem resolving or verifying a source.

    Deliberately carries `where` and `problem` only — never file contents. A
    diagnostic travels into logs and snapshots; the source text does not.
    """

    source_id: str
    kind: str      # unconfigured_root · absolute_path · traversal · missing_file · unreadable
    problem: str

    def __str__(self) -> str:
        return f"{self.source_id}: {self.problem}"


@dataclass(frozen=True)
class ResolvedSource:
    """A source located on this machine."""

    source_id: str
    path: Path
    exists: bool


# ── configuration ────────────────────────────────────────────────────────────


def load_storage_roots(
    explicit: dict[str, str] | None = None,
    *,
    env: dict[str, str] | None = None,
    config_path: Path | None = None,
) -> tuple[dict[str, Path], list[SourceIssue]]:
    """Resolve the logical-root map. Never raises; a broken config is reported.

    Returns `({}, [issue])` rather than an empty map alone, so "no roots
    configured" is distinguishable from "roots configured as empty".
    """
    issues: list[SourceIssue] = []

    if explicit is not None:
        return {k: Path(v) for k, v in explicit.items()}, issues

    environ = os.environ if env is None else env
    raw = environ.get(ENV_VAR)
    if raw:
        stripped = raw.strip()
        if stripped.startswith("{"):
            try:
                return {k: Path(v) for k, v in json.loads(stripped).items()}, issues
            except Exception as exc:
                issues.append(SourceIssue(
                    "<config>", "unreadable",
                    f"{ENV_VAR} holds invalid JSON: {exc.__class__.__name__}"))
                return {}, issues
        candidate = Path(stripped).expanduser()
        if not candidate.exists():
            issues.append(SourceIssue(
                "<config>", "unreadable",
                f"{ENV_VAR} points at {candidate}, which does not exist"))
            return {}, issues
        return _read_config(candidate, issues)

    path = config_path or DEFAULT_CONFIG
    if not path.exists():
        issues.append(SourceIssue(
            "<config>", "unconfigured_root",
            f"no storage roots configured — set {ENV_VAR} or create {path.name} "
            f"beside storage_roots.example.yaml (sources cannot be verified without it)"))
        return {}, issues
    return _read_config(path, issues)


def _read_config(path: Path, issues: list[SourceIssue]) -> tuple[dict[str, Path], list[SourceIssue]]:
    try:
        text = path.read_text(encoding="utf-8")
    except Exception as exc:
        issues.append(SourceIssue("<config>", "unreadable", f"cannot read {path.name}: {exc.__class__.__name__}"))
        return {}, issues

    data: object
    try:
        if path.suffix in (".json",):
            data = json.loads(text)
        else:
            import yaml
            data = yaml.safe_load(text)
    except Exception as exc:
        issues.append(SourceIssue("<config>", "unreadable", f"{path.name} is malformed: {exc.__class__.__name__}"))
        return {}, issues

    if data is None:
        return {}, issues
    if not isinstance(data, dict):
        issues.append(SourceIssue("<config>", "unreadable", f"{path.name}: expected a mapping at the top level"))
        return {}, issues

    roots_raw = data.get("storage_roots", data)
    if not isinstance(roots_raw, dict):
        issues.append(SourceIssue("<config>", "unreadable", f"{path.name}: storage_roots must be a mapping"))
        return {}, issues

    roots: dict[str, Path] = {}
    for key, val in roots_raw.items():
        if not isinstance(val, str) or not val:
            issues.append(SourceIssue("<config>", "unreadable", f"{path.name}: root {key!r} is not a path string"))
            continue
        roots[str(key)] = Path(val).expanduser()
    return roots, issues


# ── resolution ───────────────────────────────────────────────────────────────


def resolve_source(
    source_id: str,
    storage_root: str,
    relative_path: str,
    roots: dict[str, Path],
) -> tuple[ResolvedSource | None, SourceIssue | None]:
    """`storage_root` + `relative_path` → a path on this machine.

    Every failure is explicit. Nothing is guessed: an unconfigured root does not
    fall back to the home directory, and a missing file is not treated as empty.
    """
    if relative_path.startswith("/") or relative_path.startswith("~"):
        # I8 — the whole point of the split is that the profile holds no absolute path
        return None, SourceIssue(
            source_id, "absolute_path",
            f"relative_path is absolute ({relative_path!r}); sources must be relative "
            "to a logical storage_root")

    base = roots.get(storage_root)
    if base is None:
        return None, SourceIssue(
            source_id, "unconfigured_root",
            f"storage_root {storage_root!r} is not configured on this machine")

    candidate = (base / relative_path)
    # Traversal check BEFORE touching the filesystem: `..` must not escape the
    # root even when the target does not exist.
    try:
        base_res = base.resolve()
        target = candidate.resolve()
        target.relative_to(base_res)
    except (ValueError, OSError):
        return None, SourceIssue(
            source_id, "traversal",
            f"resolved path escapes the {storage_root!r} root — refused")

    if not target.exists():
        return ResolvedSource(source_id, target, exists=False), SourceIssue(
            source_id, "missing_file",
            f"{storage_root}/{relative_path} is not present on this machine")

    return ResolvedSource(source_id, target, exists=True), None
