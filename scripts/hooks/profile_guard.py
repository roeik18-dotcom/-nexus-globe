#!/usr/bin/env python3
"""Block Roei's real profile data from ever being staged.

`.gitignore` is a default, not a control: `git add -f` overrides it, a rename
escapes it, and a file ignored today can be force-added tomorrow. Once a commit
lands, the content is in history permanently — a later .gitignore does not undo
it. This guard is the enforced half of that pair.

Two independent rules, because path alone is not enough:

  1. PATH   — any *.yaml under voice-gateway/profiles/ that is not *.example.yaml
  2. SHAPE  — any staged YAML that LOOKS like a profile (owner: + layer: +
              entries:) outside the allowed zones, which catches the case where
              a real profile is renamed out of the profiles directory

The guard reads staged blobs to apply rule 2 but never prints their contents —
only paths and a reason.

Pure core (`blocked_paths`) with a thin git shell (`main`), so the rules are
testable without a repository.
"""
from __future__ import annotations

import subprocess
import sys
from dataclasses import dataclass

PROFILE_DIR = "voice-gateway/profiles/"
YAML_SUFFIXES = (".yaml", ".yml")
EXAMPLE_MARKERS = (".example.yaml", ".example.yml")

#: Paths where a profile-shaped YAML is legitimate: synthetic fixtures used by
#: tests. Real data placed here would defeat the guard, but that is deliberate
#: circumvention rather than an accident, which is the line this tool draws.
FIXTURE_MARKERS = ("/tests/", "/test/", "/fixtures/", "/__tests__/")

#: A file is profile-SHAPED when it declares an owner, a profile layer and
#: entries. Specific enough that ordinary config YAML does not trip it.
SHAPE_KEYS = ("owner:", "entries:")
SHAPE_LAYERS = (
    "layer: person", "layer: music", "layer: routine",
    "layer: routines_history", "layer: daily_opening", "layer: projects",
)


@dataclass(frozen=True)
class Block:
    path: str
    rule: str      # "path" | "shape"
    reason: str


def is_example(path: str) -> bool:
    return path.endswith(EXAMPLE_MARKERS)


def is_yaml(path: str) -> bool:
    return path.endswith(YAML_SUFFIXES)


def in_fixture_zone(path: str) -> bool:
    p = f"/{path}"
    return any(m in p for m in FIXTURE_MARKERS)


def looks_like_profile(text: str) -> bool:
    """True when the content declares a profile layer plus owner and entries."""
    return (
        any(k in text for k in SHAPE_KEYS)
        and text.count("owner:") > 0
        and any(layer in text for layer in SHAPE_LAYERS)
        and "entries:" in text
    )


def blocked_paths(
    staged: list[str],
    read_staged=None,
) -> list[Block]:
    """The whole rule set. `read_staged(path) -> str` supplies staged content.

    Ordering follows `staged` so the message is stable and diffable.
    """
    blocks: list[Block] = []
    for path in staged:
        if not is_yaml(path):
            continue
        if is_example(path):
            continue                                  # synthetic, always allowed

        if path.startswith(PROFILE_DIR):
            blocks.append(Block(
                path, "path",
                "real profile data lives under voice-gateway/profiles/ and must stay local",
            ))
            continue

        # rule 2 — a profile renamed out of the directory
        if read_staged is not None and not in_fixture_zone(path):
            try:
                text = read_staged(path)
            except Exception:
                continue                              # unreadable: not our call to block
            if looks_like_profile(text):
                blocks.append(Block(
                    path, "shape",
                    "content is profile-shaped (owner + layer + entries) — "
                    "looks like real profile data moved outside profiles/",
                ))
    return blocks


def format_message(blocks: list[Block]) -> str:
    lines = [
        "",
        "  COMMIT BLOCKED — private profile data must not enter git",
        "",
    ]
    for b in blocks:
        lines.append(f"    ✕ {b.path}")
        lines.append(f"        [{b.rule}] {b.reason}")
    lines += [
        "",
        "  Real profile YAML stays LOCAL ONLY. A private repository is not the",
        "  same as unexposed: history is permanent, branches get shared, and a",
        "  later .gitignore cannot remove what a commit already recorded.",
        "",
        "  Tracked instead:",
        "    voice-gateway/profiles/SCHEMA.md",
        "    voice-gateway/profiles/*.example.yaml   (synthetic, no personal content)",
        "",
        "  To unstage:",
        "    git restore --staged " + " ".join(b.path for b in blocks),
        "",
        "  This guard is intentional. If you are certain, bypass with",
        "  `git commit --no-verify` — and know that the data becomes permanent.",
        "",
    ]
    return "\n".join(lines)


# ── git shell ────────────────────────────────────────────────────────────────


def staged_files() -> list[str]:
    """Added/Copied/Modified/Renamed staged paths. Renames report the NEW path."""
    out = subprocess.run(
        ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"],
        capture_output=True, text=True, check=True,
    ).stdout
    return [ln for ln in out.splitlines() if ln.strip()]


def read_staged_blob(path: str) -> str:
    """Content as STAGED, not as on disk — the hook must judge what is committed."""
    return subprocess.run(
        ["git", "show", f":{path}"],
        capture_output=True, text=True, check=True,
    ).stdout


def main() -> int:
    blocks = blocked_paths(staged_files(), read_staged=read_staged_blob)
    if not blocks:
        return 0
    sys.stderr.write(format_message(blocks))
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
