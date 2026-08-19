"""Studio project-state retrieval — read-only adapter over the real
~/Dropbox/-STUDIO-SYSTEM ledger (Music/Studio track, 2026-08-13).

This is a STANDALONE module. It does not import, and is not imported by,
app.domain_router or app.master_config — those are shared/owned by the
routing track and are explicitly off-limits this batch. Wiring this module's
retrieve_studio_project() into domain_router's STUDIO_PROJECT branch is a
one-line follow-up for the routing owner, deferred here on purpose.

SOURCE OF TRUTH (already built by the Studio track, not invented here):
  ~/Dropbox/-STUDIO-SYSTEM/ledger/ledger.json     — scanner output, 157 real
                                                      Ableton projects, one
                                                      record per project
  ~/Dropbox/-STUDIO-SYSTEM/ledger/overrides.json  — manual corrections,
                                                      keyed by project id
  ~/Dropbox/-STUDIO-SYSTEM/ledger/focus.json      — the single "active track"
                                                      claim (bin/focus.py);
                                                      absent until a track is
                                                      ever claimed
This module only ever reads these three files. It never runs
bin/scan_projects.py or bin/focus.py, never writes to the ledger dir, and
never reads anything outside ledger/ (no .als files, no unrelated Dropbox
content).

HONESTY RULES (do not violate):
  - absent data -> UNKNOWN, never a guess
  - stage/arrangement/mix/master state are all derived from the scanner's own
    `inferred_stage` (already an explicit heuristic field with a `stage_basis`
    string — see scan_projects.py) — never re-derived from filenames here
  - no plugin/session identity is fabricated; `evidence` is surfaced verbatim
    (tempo, track counts, device counts) with nothing invented on top
  - a name shared by multiple distinct project ids is reported as ambiguous,
    never silently resolved to "the first one"
"""
from __future__ import annotations

import json
import os
import re
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any

_STUDIO_ROOT = Path(os.path.expanduser("~/Dropbox/-STUDIO-SYSTEM"))
_LEDGER_DIR = _STUDIO_ROOT / "ledger"
_LEDGER_FILE = _LEDGER_DIR / "ledger.json"
_OVERRIDES_FILE = _LEDGER_DIR / "overrides.json"
_FOCUS_FILE = _LEDGER_DIR / "focus.json"

# Canonical 6-stage pipeline and the scanner->pipeline mapping, copied
# verbatim from ~/Dropbox/-STUDIO-SYSTEM/bin/focus.py (STAGES /
# INFERRED_TO_STAGE) so stage-progress derivations here agree with the
# studio system's own semantics rather than inventing a second taxonomy.
STAGES = ["SEED", "SKETCH", "ARRANGEMENT", "MIX", "MASTER", "RELEASED"]
INFERRED_TO_STAGE = {
    "SEED": "SEED",
    "SKETCH": "SKETCH",
    "ARRANGEMENT": "ARRANGEMENT",
    "MIX": "MIX",
    "MIXDOWN": "MASTER",  # already bounced — what remains is the master
    "UNKNOWN": "SKETCH",
}

# A ledger snapshot older than this is flagged stale rather than presented as
# current. bin/scan_projects.py is never run automatically by this module
# (read-only indexing) — a stale flag is the honest signal to re-run it by
# hand.
_STALE_LEDGER_DAYS = 7

_STOP = set("the a an of for with and or to in on is are what how do you know about my me "
            "מה של את זה עם גם או אבל כי אם על אל לא כן יש אין הוא היא אני אתה מי איך כמה למה".split())
_cache: dict[str, tuple[float, Any]] = {}   # path -> (mtime, parsed_json)


def _nfc(s: Any) -> str:
    return unicodedata.normalize("NFC", s) if isinstance(s, str) else ("" if s is None else str(s))


def _tokens(s: str) -> list[str]:
    s = _nfc(s)
    return [t for t in re.split(r"[^\wא-ת]+", s.lower()) if t and t not in _STOP and len(t) > 1]


def _load_json(path: Path) -> Any | None:
    """Read-only, mtime-cached. Returns None on any missing/unreadable file —
    never raises, never writes."""
    try:
        mtime = path.stat().st_mtime
    except OSError:
        return None
    cached = _cache.get(str(path))
    if cached and cached[0] == mtime:
        return cached[1]
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    _cache[str(path)] = (mtime, data)
    return data


def load_ledger() -> dict:
    """{'status': 'LOADED'|'UNKNOWN', 'reason', 'path', 'scanned_at',
    'studio_root', 'project_count', 'projects', 'age_days', 'stale'}."""
    data = _load_json(_LEDGER_FILE)
    if not isinstance(data, dict) or "projects" not in data:
        return {"status": "UNKNOWN", "reason": "ledger.json missing or unreadable",
                "path": str(_LEDGER_FILE), "projects": []}
    scanned_at = data.get("scanned_at", "")
    age_days = None
    stale = None
    try:
        scanned_dt = datetime.strptime(scanned_at, "%Y-%m-%d %H:%M")
        age_days = (datetime.now() - scanned_dt).days
        stale = age_days > _STALE_LEDGER_DAYS
    except (ValueError, TypeError):
        pass  # unparseable timestamp -> age/stale stay UNKNOWN (None), not guessed
    return {
        "status": "LOADED", "reason": "", "path": str(_LEDGER_FILE),
        "scanned_at": scanned_at, "studio_root": data.get("studio_root", ""),
        "project_count": data.get("project_count", len(data.get("projects", []))),
        "projects": data.get("projects", []),
        "age_days": age_days, "stale": stale,
    }


def load_overrides() -> dict[str, dict]:
    """project_id -> override dict. {} (not UNKNOWN) if absent/unreadable —
    overrides are optional by design (see overrides.json's own _readme)."""
    data = _load_json(_OVERRIDES_FILE)
    if not isinstance(data, dict):
        return {}
    return {k: v for k, v in data.items() if k != "_readme" and isinstance(v, dict)}


def load_focus_state() -> dict | None:
    """Raw focus.json content, or None if it has never been created (no
    track has ever been claimed via bin/focus.py — a real, honest state,
    not a load failure)."""
    data = _load_json(_FOCUS_FILE)
    return data if isinstance(data, dict) else None


def active_project() -> dict:
    """{'status': 'LOADED', ...active record...} or
    {'status': 'UNKNOWN', 'reason': ...}. Never fabricates an active track."""
    state = load_focus_state()
    if not state:
        return {"status": "UNKNOWN", "reason": "focus.json does not exist — "
                "no track has been claimed via bin/focus.py",
                "path": str(_FOCUS_FILE)}
    active = state.get("active")
    if not active:
        return {"status": "UNKNOWN", "reason": "focus.json exists but no track is currently active",
                "path": str(_FOCUS_FILE)}
    return {"status": "LOADED", "path": str(_FOCUS_FILE), **active}


def _canonical_stage(inferred_stage: str) -> str | None:
    """Maps a scanner inferred_stage (or a hand-set override stage) onto the
    6-stage pipeline. Returns None for values with no defined mapping (e.g.
    'DROPPED') rather than guessing a position for them."""
    if inferred_stage in STAGES:
        return inferred_stage
    return INFERRED_TO_STAGE.get(inferred_stage)


def _stage_reached(canonical_stage: str | None, target: str) -> bool | None:
    if canonical_stage is None or canonical_stage not in STAGES:
        return None
    return STAGES.index(canonical_stage) >= STAGES.index(target)


def _apply_override(project: dict, overrides: dict[str, dict]) -> tuple[dict, str, str | None]:
    """Returns (effective_project, stage_source, override_note).
    stage_source is 'override' or 'inferred' — always explicit, never silent."""
    ov = overrides.get(project.get("id", ""))
    if not ov:
        return project, "inferred", None
    merged = dict(project)
    if "stage" in ov:
        merged["inferred_stage"] = ov["stage"]
    return merged, "override", ov.get("note")


def _project_view(project: dict, overrides: dict[str, dict], ledger_meta: dict) -> dict:
    """Builds the Merlin-ready structured record for one project, covering
    every required retrieval category. Absent data is UNKNOWN, never guessed."""
    effective, stage_source, override_note = _apply_override(project, overrides)
    raw_stage = effective.get("inferred_stage", "UNKNOWN")
    canon = _canonical_stage(raw_stage)
    evidence = project.get("evidence", {}) or {}

    def _state_block(target_stage: str) -> dict:
        reached = _stage_reached(canon, target_stage)
        if reached is None:
            return {"status": "UNKNOWN", "reason": f"stage '{raw_stage}' has no defined "
                    f"position in the pipeline {STAGES}"}
        return {"status": "REACHED" if reached else "NOT_YET",
                "basis": f"inferred_stage={raw_stage} ({stage_source}) -> pipeline stage {canon}"}

    studio_root = ledger_meta.get("studio_root", "")
    folder = project.get("folder", "")
    head_set = project.get("head_set")

    return {
        "project_identity": {
            "id": project.get("id"),
            "name": project.get("name", "").strip(),
        },
        "status_stage": {
            "value": raw_stage,
            "canonical_stage": canon,
            "source": stage_source,               # 'override' | 'inferred'
            "basis": project.get("stage_basis", "") if stage_source == "inferred" else
                     f"manually set (overrides.json); scanner inferred {project.get('inferred_stage')} "
                     f"({project.get('stage_basis', '')})",
        },
        "arrangement_state": _state_block("ARRANGEMENT"),
        # The scanner has no recording/take/comping signal at all — never
        # inferred from track counts or filenames.
        "recording_state": {"status": "UNKNOWN",
                             "reason": "ledger has no recording/take-level data source"},
        "mix_state": _state_block("MIX"),
        "master_state": _state_block("MASTER"),
        "outstanding_tasks": {"status": "LOADED", "note": override_note} if override_note else
                             {"status": "UNKNOWN", "reason": "no overrides.json note recorded for this project"},
        "technical_notes": {
            "status": "LOADED" if evidence else "UNKNOWN",
            "tempo_bpm": evidence.get("tempo"),
            "live_version": evidence.get("live_version"),
            "midi_tracks": evidence.get("midi_tracks"),
            "audio_tracks": evidence.get("audio_tracks"),
            "return_tracks": evidence.get("return_tracks"),
            "master_chain_device_count": evidence.get("master_chain_devices"),
            "backup_count": project.get("backup_count"),
            "bounce_count": project.get("bounce_count"),
            "latest_bounce": project.get("latest_bounce"),
            "bounce_after_last_edit": project.get("bounce_after_last_edit"),
            "parse_error": evidence.get("parse_error"),
            "warnings": project.get("warnings", []),
        },
        "referenced_paths": {
            "status": "LOADED" if folder else "UNKNOWN",
            "folder_relative": folder,
            "folder_absolute": str(Path(studio_root) / folder) if studio_root and folder else None,
            "head_set_file": head_set,
        } if folder else {"status": "UNKNOWN", "reason": "no folder recorded for this project"},
        "last_update": {
            "project_last_modified": project.get("last_modified"),
            "days_since_touched_at_scan": project.get("days_since_touched"),
            "ledger_scanned_at": ledger_meta.get("scanned_at"),
            "ledger_age_days": ledger_meta.get("age_days"),
            "stale": ledger_meta.get("stale"),
        },
        "provenance": {
            "source_file": str(_LEDGER_FILE),
            "record_id": project.get("id"),
            "overrides_file": str(_OVERRIDES_FILE) if stage_source == "override" else None,
        },
    }


def retrieve_studio_project(query: str, *, limit: int = 5) -> dict:
    """The single entry point. Returns a Merlin-ready structured dict:
    {status, reason, ledger:{...}, active_project:{...}, ambiguous, representative, matches:[...]}.

    Matching: exact-name collisions are surfaced as `ambiguous=True` with all
    colliding records returned, never silently narrowed to one. Otherwise,
    token-overlap scoring against project names picks the top `limit`
    matches; a query with zero token overlap anywhere returns a
    `representative=True` sample (top `limit` by revival_score) — same
    honesty pattern as master_config's representative-sample fallback, so a
    generic "what's going on in the studio" question doesn't return nothing.
    """
    ledger = load_ledger()
    if ledger["status"] != "LOADED":
        return {"status": "UNKNOWN", "reason": ledger["reason"], "path": ledger["path"],
                "ledger": ledger, "active_project": active_project(),
                "ambiguous": False, "representative": False, "matches": []}

    overrides = load_overrides()
    projects = ledger["projects"]

    qnorm = _nfc(query).strip().lower()
    exact = [p for p in projects if _nfc(p.get("name", "")).strip().lower() == qnorm] if qnorm else []
    if exact:
        matches = exact
        ambiguous = len(exact) > 1
        representative = False
    else:
        qtok = set(_tokens(query))
        scored = []
        for p in projects:
            score = len(qtok & set(_tokens(p.get("name", ""))))
            if score:
                scored.append((score, p))
        scored.sort(key=lambda x: -x[0])
        if scored:
            matches = [p for _, p in scored[:limit]]
            ambiguous = False
            representative = False
        else:
            matches = sorted(projects, key=lambda p: -(p.get("revival_score") or 0))[:limit]
            ambiguous = False
            representative = True

    return {
        "status": "LOADED", "reason": "", "path": ledger["path"],
        "ledger": {k: v for k, v in ledger.items() if k != "projects"},
        "active_project": active_project(),
        "ambiguous": ambiguous,
        "match_count": len(matches),
        "representative": representative,
        "matches": [_project_view(p, overrides, ledger) for p in matches],
    }
