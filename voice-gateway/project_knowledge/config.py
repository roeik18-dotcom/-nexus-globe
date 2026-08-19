"""Project Knowledge Layer — configuration.

Self-contained, read-only over the source tree. Never edits source files.
Never scans node_modules/.git/venv/build/cache/binaries.
"""
from __future__ import annotations
import os

# Root of the local projects to index. Overridable via env for tests.
ROOT = os.environ.get("PK_ROOT", "/Users/roei/-nexus-globe")

# Where the index database lives (NOT under source control paths we index-mutate).
DB_PATH = os.environ.get("PK_DB", os.path.join(os.path.dirname(__file__), "index.db"))
STATS_PATH = os.environ.get("PK_STATS", os.path.join(os.path.dirname(__file__), "stats.json"))
LOG_PATH = os.environ.get("PK_LOG", os.path.join(os.path.dirname(__file__), "knowledge_query.log"))

# Directories never descended into.
EXCLUDE_DIRS = {
    "node_modules", ".git", ".venv", "venv", "env", "__pycache__", ".mypy_cache",
    ".pytest_cache", ".next", "dist", "build", "out", ".turbo", ".cache", "caches",
    ".idea", ".vscode", "coverage", ".ruff_cache", "site-packages", ".gradle",
    "target", "bin", "obj", ".terraform", "vendor",
    "-nexus-globe",  # nested duplicate checkout inside voice-gateway
}
# Never index this package's own index/output, and the sibling knowledge-system (owned elsewhere).
EXCLUDE_PATH_SUBSTR = (
    "/project_knowledge/index.db",
    "/project_knowledge/stats.json",
    "/project_knowledge/knowledge_query.log",
    "/knowledge-system/",
)

# Only these extensions are treated as indexable text.
INCLUDE_EXT = {
    ".md": "markdown", ".markdown": "markdown", ".txt": "text",
    ".yaml": "yaml", ".yml": "yaml",
    ".json": "json", ".jsonl": "jsonl",
    ".py": "python", ".ts": "typescript", ".tsx": "typescript",
}

# Skip obviously non-source or generated text files by name.
EXCLUDE_FILENAMES = {"package-lock.json", "pnpm-lock.yaml", "yarn.lock", "tsconfig.tsbuildinfo"}

# Do not read content of files larger than this (still recorded in manifest as skipped).
MAX_BYTES = 2_000_000

# Project seeds: (path-substring matcher, project label). First match wins; order matters.
PROJECT_SEEDS = [
    ("/voice-gateway/service", "Merlin / voice-gateway"),
    ("/voice-gateway/app", "Merlin / voice-gateway"),
    ("/voice-gateway/docs", "architecture / runtime / audits"),
    ("merlin", "Merlin / voice-gateway"),
    ("voice-gateway", "Merlin / voice-gateway"),
    ("/app/lib/philos", "Philos Orientation"),
    ("philos", "Philos Orientation"),
    ("/app/planet", "Nexus Globe"),
    ("/app/hub", "Nexus Globe"),
    ("globe", "Nexus Globe"),
    ("nexus", "Nexus Globe"),
    ("human-config", "Human Configuration"),
    ("קונפינג-אדם", "Human Configuration"),
    ("music", "Music Configuration"),
    ("מוזיקה", "Music Configuration"),
    ("ableton", "Ableton / studio project tracking"),
    ("studio", "Ableton / studio project tracking"),
    ("/state", "current state / unfinished work"),
    ("/audit", "architecture / runtime / audits"),
    ("architecture", "architecture / runtime / audits"),
    ("/docs", "architecture / runtime / audits"),
]
DEFAULT_PROJECT = "Nexus Globe (root)"


def project_for(path: str) -> str:
    low = path.lower()
    for needle, label in PROJECT_SEEDS:
        if needle.lower() in low:
            return label
    return DEFAULT_PROJECT
