"""Merlin OS · Personal Config loader and projection.

Reads `profiles/*.yaml` into a validated, domain-separated `PersonalConfigState`.

THE RULE THIS MODULE EXISTS TO ENFORCE
--------------------------------------
Invalid data is never silently dropped. A malformed entry becomes a
`ValidationError` carried in the state, not a missing fact — because a profile
that quietly loses three principles is worse than one that refuses to load: the
first is undetectable, the second is obvious.

Same principle as `snapshot.py`: absence of a fact and failure to read it are
different things, and collapsing them is how a system becomes confidently wrong.

SEED-ONLY, BY DESIGN
--------------------
The YAML files are SEED STATE — the starting point, not the history. Today the
projection is `fold(seed)`; later it becomes `fold(seed, *change_events)`.
`project()` already takes an ordered `changes` sequence and folds it in, so
adding a change log means feeding that argument, not rewriting the collector or
the state shape. Nothing downstream reads the YAML directly.
"""
from __future__ import annotations

import datetime
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable, Sequence

SCHEMA_VERSION = 1

#: Entry `type` values the schema defines (profiles/SCHEMA.md).
ENTRY_TYPES = frozenset({"fact", "preference", "personal_principle", "historical_pattern"})
CONFIDENCE_LEVELS = frozenset({"observed", "stated", "personal", "inferred"})
PRIVACY_LEVELS = frozenset({"public", "private", "sensitive"})

#: Fields every entry must carry. `valid_from`/`valid_until` may be null but must
#: be PRESENT — an absent key means the author did not consider currency, which is
#: exactly the ambiguity `historical` exists to remove.
REQUIRED_ENTRY_FIELDS = ("id", "type", "statement", "confidence", "privacy")

#: A profile older than this is reported STALE: still readable, but it has not
#: been revisited in a long time and should not be treated as a current account
#: of how Roei works.
DEFAULT_MAX_AGE_DAYS = 90

#: The domains the projection separates. `person` and `music` come from files;
#: the rest are derived slices or await their own source.
CONFIG_DOMAINS: tuple[str, ...] = (
    "person",
    "music",
    "routines_history",
    "daily_opening",
    "projects",
)


# ── errors ───────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class ValidationError:
    """One thing that was wrong, and exactly where.

    Carried in the state rather than raised, so one bad entry costs one entry and
    the rest of the profile still loads.
    """

    source: str          # file path or logical name
    location: str        # "entries[3]" / "<file>" / "entries[3].usage"
    problem: str
    entry_id: str | None = None

    def __str__(self) -> str:
        where = f"{self.source}:{self.location}"
        return f"{where}: {self.problem}"


# ── entries ──────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class ConfigEntry:
    """One validated statement, with its provenance intact."""

    id: str
    type: str
    statement: str
    confidence: str
    privacy: str
    valid_from: str | None
    valid_until: str | None
    usage: dict[str, bool]
    #: Provenance — which file, which index, which schema version it came from.
    source_file: str
    source_index: int
    schema_version: int
    layer: str

    @property
    def is_historical(self) -> bool:
        """`valid_until: historical` — how Roei USED to operate, never current."""
        return self.type == "historical_pattern" or self.valid_until == "historical"

    @property
    def merlin_may_use(self) -> bool:
        return bool(self.usage.get("merlin", False))


# ── the projected state ──────────────────────────────────────────────────────


@dataclass(frozen=True)
class PersonalConfigState:
    """Domain-separated projection of the profile files.

    `person` and `music` hold only CURRENT entries. Anything historical is routed
    to `routines_history` regardless of which file it came from, so a past way of
    working can never be read as the present one.
    """

    person: tuple[ConfigEntry, ...] = ()
    music: tuple[ConfigEntry, ...] = ()
    routines_history: tuple[ConfigEntry, ...] = ()
    daily_opening: tuple[ConfigEntry, ...] = ()
    projects: tuple[ConfigEntry, ...] = ()

    schema_version: int | None = None
    #: mtime of the newest file that loaded, ISO 8601 with offset.
    last_updated: str | None = None
    #: Files that were read successfully.
    sources: tuple[str, ...] = ()
    errors: tuple[ValidationError, ...] = ()
    #: Reserved for the change log. Empty while the projection is seed-only.
    recent_changes: tuple[dict[str, Any], ...] = ()

    @property
    def is_valid(self) -> bool:
        return not self.errors

    @property
    def is_empty(self) -> bool:
        return self.total_entries == 0

    @property
    def total_entries(self) -> int:
        return sum(len(self.domain(d)) for d in CONFIG_DOMAINS)

    def domain(self, name: str) -> tuple[ConfigEntry, ...]:
        if name not in CONFIG_DOMAINS:
            raise KeyError(f"unknown config domain: {name}")
        return getattr(self, name)

    def domains_present(self) -> tuple[str, ...]:
        return tuple(d for d in CONFIG_DOMAINS if self.domain(d))

    def entry_counts(self) -> dict[str, int]:
        return {d: len(self.domain(d)) for d in CONFIG_DOMAINS}

    def summary(self) -> dict[str, Any]:
        """What the snapshot carries — counts and provenance, never the text.

        Deliberately excludes `statement`: the snapshot is a diagnostic report,
        and copying private profile prose into it would spread the content into
        every downstream layer and log that touches a reading.
        """
        return {
            "schema_version": self.schema_version,
            "domains_present": list(self.domains_present()),
            "entry_counts": self.entry_counts(),
            "total_entries": self.total_entries,
            "last_updated": self.last_updated,
            "sources": list(self.sources),
            "validation": "ok" if self.is_valid else f"{len(self.errors)} error(s)",
            "validation_errors": [str(e) for e in self.errors],
            "recent_changes": list(self.recent_changes),
        }


# ── loading ──────────────────────────────────────────────────────────────────


def _iso(ts: float) -> str:
    return datetime.datetime.fromtimestamp(ts).astimezone().isoformat(timespec="seconds")


@dataclass(frozen=True)
class LoadedFile:
    """One profile file after reading — parsed, or explained."""

    path: Path
    layer: str | None
    schema_version: int | None
    entries: tuple[ConfigEntry, ...]
    errors: tuple[ValidationError, ...]
    mtime_iso: str | None
    existed: bool
    parsed: bool


def _validate_entry(
    raw: Any,
    index: int,
    *,
    source: str,
    layer: str,
    schema_version: int,
) -> tuple[ConfigEntry | None, list[ValidationError]]:
    loc = f"entries[{index}]"
    errs: list[ValidationError] = []

    if not isinstance(raw, dict):
        return None, [ValidationError(source, loc, f"expected a mapping, got {type(raw).__name__}")]

    entry_id = raw.get("id") if isinstance(raw.get("id"), str) else None

    for key in REQUIRED_ENTRY_FIELDS:
        if key not in raw or raw[key] in (None, ""):
            errs.append(ValidationError(source, f"{loc}.{key}", "required field missing", entry_id))

    # Presence, not value — null is a legitimate answer, absence is not.
    for key in ("valid_from", "valid_until"):
        if key not in raw:
            errs.append(
                ValidationError(source, f"{loc}.{key}", "required field missing (null is allowed)", entry_id)
            )

    etype = raw.get("type")
    if etype is not None and etype not in ENTRY_TYPES:
        errs.append(
            ValidationError(source, f"{loc}.type", f"unknown type {etype!r}", entry_id)
        )
    conf = raw.get("confidence")
    if conf is not None and conf not in CONFIDENCE_LEVELS:
        errs.append(
            ValidationError(source, f"{loc}.confidence", f"unknown confidence {conf!r}", entry_id)
        )
    priv = raw.get("privacy")
    if priv is not None and priv not in PRIVACY_LEVELS:
        errs.append(
            ValidationError(source, f"{loc}.privacy", f"unknown privacy {priv!r}", entry_id)
        )

    usage = raw.get("usage")
    if usage is None:
        errs.append(ValidationError(source, f"{loc}.usage", "required field missing", entry_id))
        usage = {}
    elif not isinstance(usage, dict):
        errs.append(
            ValidationError(source, f"{loc}.usage", f"expected a mapping, got {type(usage).__name__}", entry_id)
        )
        usage = {}
    elif usage.get("philos_core") is True:
        # SCHEMA.md: "philos_core: false — ALWAYS false". A profile may never
        # promote a personal belief straight into Philos Core.
        errs.append(
            ValidationError(
                source, f"{loc}.usage.philos_core",
                "must always be false — a personal statement cannot enter Philos Core directly",
                entry_id,
            )
        )

    if errs:
        return None, errs

    return (
        ConfigEntry(
            id=str(raw["id"]),
            type=str(raw["type"]),
            statement=str(raw["statement"]),
            confidence=str(raw["confidence"]),
            privacy=str(raw["privacy"]),
            valid_from=raw.get("valid_from"),
            valid_until=raw.get("valid_until"),
            usage={k: bool(v) for k, v in usage.items()},
            source_file=source,
            source_index=index,
            schema_version=schema_version,
            layer=layer,
        ),
        [],
    )


def load_file(path: Path) -> LoadedFile:
    """Read one profile file. Never raises — a failure is a reported fact."""
    source = path.name

    if not path.exists():
        return LoadedFile(path, None, None, (), (), None, existed=False, parsed=False)

    mtime = _iso(path.stat().st_mtime)

    try:
        import yaml  # imported here so a missing PyYAML is an ERROR, not an ImportError at startup
    except Exception as exc:  # pragma: no cover - environment-dependent
        return LoadedFile(
            path, None, None, (),
            (ValidationError(source, "<import>", f"PyYAML unavailable: {exc}"),),
            mtime, existed=True, parsed=False,
        )

    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    except Exception as exc:
        return LoadedFile(
            path, None, None, (),
            (ValidationError(source, "<file>", f"malformed YAML: {exc.__class__.__name__}"),),
            mtime, existed=True, parsed=False,
        )

    if raw is None:
        # An empty file is valid and says "no entries" — not an error.
        return LoadedFile(path, None, None, (), (), mtime, existed=True, parsed=True)

    if not isinstance(raw, dict):
        return LoadedFile(
            path, None, None, (),
            (ValidationError(source, "<file>", f"expected a mapping at the top level, got {type(raw).__name__}"),),
            mtime, existed=True, parsed=False,
        )

    errors: list[ValidationError] = []

    version = raw.get("schema_version")
    if version is None:
        errors.append(ValidationError(source, "schema_version", "required field missing"))
    elif not isinstance(version, int):
        errors.append(
            ValidationError(source, "schema_version", f"expected an integer, got {type(version).__name__}")
        )
        version = None
    elif version != SCHEMA_VERSION:
        errors.append(
            ValidationError(
                source, "schema_version",
                f"unsupported version {version} (this loader understands {SCHEMA_VERSION})",
            )
        )
        # Refuse the entries rather than guess at a shape we do not know.
        return LoadedFile(path, raw.get("layer"), version, (), tuple(errors), mtime, True, parsed=False)

    layer = raw.get("layer")
    if not isinstance(layer, str) or not layer:
        errors.append(ValidationError(source, "layer", "required field missing"))
        layer = "unknown"

    raw_entries = raw.get("entries")
    entries: list[ConfigEntry] = []
    if raw_entries is None:
        pass  # a profile with no entries yet is valid and empty
    elif not isinstance(raw_entries, list):
        errors.append(
            ValidationError(source, "entries", f"expected a list, got {type(raw_entries).__name__}")
        )
    else:
        seen: set[str] = set()
        for i, item in enumerate(raw_entries):
            entry, errs = _validate_entry(
                item, i, source=source, layer=layer, schema_version=version or SCHEMA_VERSION
            )
            errors.extend(errs)
            if entry is None:
                continue
            if entry.id in seen:
                errors.append(
                    ValidationError(source, f"entries[{i}].id", f"duplicate id {entry.id!r}", entry.id)
                )
                continue
            seen.add(entry.id)
            entries.append(entry)

    return LoadedFile(
        path, layer, version, tuple(entries), tuple(errors), mtime, existed=True, parsed=True
    )


# ── projection ───────────────────────────────────────────────────────────────


def _route(entry: ConfigEntry) -> str:
    """Which projected domain an entry belongs to.

    Historical entries leave their source domain entirely: a past routine must
    not sit in `person` where a later layer would read it as current.
    """
    if entry.is_historical:
        return "routines_history"
    if entry.layer == "music":
        return "music"
    if entry.layer in ("daily_opening", "routine"):
        return "daily_opening"
    if entry.layer == "projects":
        return "projects"
    return "person"


def project(
    files: Iterable[LoadedFile],
    changes: Sequence[dict[str, Any]] = (),
) -> PersonalConfigState:
    """Fold loaded files (and, later, ordered change events) into one state.

    `changes` is applied after the seed, oldest first. It is empty today; the
    parameter exists so adding a change log is a caller change, not a rewrite of
    this module or of the collector that consumes it.
    """
    buckets: dict[str, list[ConfigEntry]] = {d: [] for d in CONFIG_DOMAINS}
    errors: list[ValidationError] = []
    sources: list[str] = []
    versions: set[int] = set()
    mtimes: list[str] = []

    for lf in files:
        errors.extend(lf.errors)
        if lf.existed and lf.parsed:
            sources.append(lf.path.name)
            if lf.mtime_iso:
                mtimes.append(lf.mtime_iso)
        if lf.schema_version is not None:
            versions.add(lf.schema_version)
        for entry in lf.entries:
            buckets[_route(entry)].append(entry)

    # Reserved seam: fold(seed, *changes). Recorded verbatim so the summary can
    # show what has moved since the seed once a change log exists.
    applied_changes = tuple(changes)

    return PersonalConfigState(
        person=tuple(buckets["person"]),
        music=tuple(buckets["music"]),
        routines_history=tuple(buckets["routines_history"]),
        daily_opening=tuple(buckets["daily_opening"]),
        projects=tuple(buckets["projects"]),
        schema_version=min(versions) if versions else None,
        last_updated=max(mtimes) if mtimes else None,
        sources=tuple(sources),
        errors=tuple(errors),
        recent_changes=applied_changes,
    )


DEFAULT_PROFILE_FILES = ("person.yaml", "music.yaml")


def load_personal_config(
    profiles_dir: Path,
    filenames: Sequence[str] = DEFAULT_PROFILE_FILES,
    changes: Sequence[dict[str, Any]] = (),
) -> tuple[PersonalConfigState, tuple[LoadedFile, ...]]:
    """Load every profile file and project it. Never raises."""
    loaded = tuple(load_file(profiles_dir / name) for name in filenames)
    return project(loaded, changes), loaded
