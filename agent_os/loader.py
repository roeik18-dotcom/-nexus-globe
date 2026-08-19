"""File-based manifest loading — read-only, zero side effects.

Loading a manifest parses YAML and constructs a frozen AgentManifest. It writes
nothing, opens no sockets, and starts no process. `load_dir` returns manifests in
a DETERMINISTIC order (sorted by filename) so registry ordering is reproducible.
"""

from __future__ import annotations

from pathlib import Path

import yaml

from .errors import ManifestValidationError
from .manifest import AgentManifest

# Default manifest directory: <repo-root>/agents (sibling of agent_os/).
DEFAULT_AGENTS_DIR = Path(__file__).resolve().parent.parent / "agents"


def load_manifest(path: str | Path) -> AgentManifest:
    p = Path(path)
    if not p.is_file():
        raise ManifestValidationError(f"manifest file not found: {p}")
    try:
        raw = yaml.safe_load(p.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        raise ManifestValidationError(f"{p.name}: invalid YAML: {exc}") from exc
    if raw is None:
        raise ManifestValidationError(f"{p.name}: empty manifest")
    try:
        return AgentManifest.from_dict(raw)
    except ManifestValidationError as exc:
        raise ManifestValidationError(f"{p.name}: {exc}") from exc


def load_dir(directory: str | Path | None = None) -> list[AgentManifest]:
    d = Path(directory) if directory is not None else DEFAULT_AGENTS_DIR
    if not d.is_dir():
        raise ManifestValidationError(f"agents directory not found: {d}")
    files = sorted(d.glob("*.yaml")) + sorted(d.glob("*.yml"))
    return [load_manifest(f) for f in files]
