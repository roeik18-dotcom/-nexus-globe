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
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any, Iterable, Sequence

from .storage_roots import (
    ResolvedSource,
    SourceIssue,
    load_storage_roots,
    resolve_source,
    verify_hash,
)

#: The version a file gets if it declares none, and the one v1 rules apply to.
SCHEMA_VERSION = 1

#: Versions this loader will read. Anything else is refused with a stated reason
#: rather than parsed on a guess — an unknown shape is not a shape.
SUPPORTED_SCHEMA_VERSIONS = frozenset({1, 2})

#: Entry `type` values schema v1 defines (profiles/SCHEMA-V1.md).
ENTRY_TYPES = frozenset({"fact", "preference", "personal_principle", "historical_pattern"})
CONFIDENCE_LEVELS = frozenset({"observed", "stated", "personal", "inferred"})
PRIVACY_LEVELS = frozenset({"public", "private", "sensitive"})

# ── schema v2 vocabulary (profiles/SCHEMA-V2.md §4, frozen) ──────────────────
V2_SECTIONS = frozenset({
    "core_identity", "legacy_expression", "current_expression",
    "branding", "songwriting", "styling", "studio",
})
V2_TYPES = frozenset({
    "personal_principle", "preference", "creative_constraint",
    "identity_trait", "historical_pattern", "fact",
})
V2_STATUS = frozenset({"active", "historical", "archived"})
V2_PRIVACY = frozenset({"private", "sensitive"})
V2_SHAREABILITY = frozenset({"public_candidate", "private_only"})
V2_DATE_CONFIDENCE = frozenset({"unknown", "dated"})
V2_DATE_PRECISION = frozenset({"exact", "month", "year", "approximate", "unknown"})
V2_UNIVERSALITY = frozenset({"personal", "domain", "shared", "universal"})
V2_PHILOS_RELEVANCE = frozenset({
    "none", "related", "bridge_candidate", "founder_candidate", "accepted_core",
})
V2_VERIFICATION = frozenset({
    "unverified", "self_confirmed", "human_confirmed", "source_confirmed",
    "inferred", "disputed", "needs_review",
})
#: SCHEMA-V2 §9.1 / I15 — the ONLY states admitted to the canonical active
#: projection. An allowlist, not a denylist: a state absent here is withheld, so a
#: future enum value cannot be projected as current merely by not being excluded.
V2_CANONICAL_ACTIVE = frozenset({"self_confirmed", "human_confirmed", "source_confirmed"})

#: SCHEMA-V2 §4/§8 — `redaction` is a LIST of these policies (never the old dict).
V2_REDACTION = frozenset({
    "none", "paraphrase", "never_verbatim", "never_aloud", "external_models_blocked",
})
V2_EVIDENCE_PRECISION = frozenset({
    "document", "section", "paragraph", "page", "timestamp", "ocr_pending",
})
V2_RELATION_TYPES = frozenset({
    "succeeds_as_primary_expression", "derived_from", "related_to", "supersedes",
})
V2_CONFIDENCE = frozenset({"high", "medium", "low"})
V2_USAGE_SURFACES = ("merlin_context", "morning_brief", "music_assistant",
                     "philos_core", "public_profile")

#: §11 locked order bands — `order` is presentation order, never importance.
V2_ORDER_BANDS: dict[str, tuple[int, int]] = {
    "core_identity": (10, 50),
    "legacy_expression": (60, 90),
    "current_expression": (100, 190),
    "branding": (200, 10_000),
    "songwriting": (200, 10_000),
    "styling": (200, 10_000),
    "studio": (200, 10_000),
}

#: I10 — an evidence pointer may be omitted only at these precisions.
V2_NULL_REF_OK = frozenset({"document", "ocr_pending"})

#: `philos_relevance` is REQUIRED in v2, not defaulted. `none` is an answer —
#: "checked, no Philos relevance" — while absence is the lack of one, and turning
#: absence into `none` would invent the decision. Same rule the schema applies to
#: dates and to `verification_status`: a field that was never answered must not be
#: made to look answered (§14, I14).
V2_REQUIRED_ENTRY_FIELDS = (
    "id", "section", "type", "status", "value", "privacy", "philos_relevance",
)

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
class SourceRef:
    """One `canonical_sources[]` item — which source, and how precisely (§7)."""

    source_id: str
    evidence_ref: str | None
    evidence_precision: str


@dataclass(frozen=True)
class RegisteredSource:
    """A file-level `sources` entry (§6). Never holds an absolute path (I8).

    `storage_root` is a logical key resolved by an EXTERNAL map, so relocating the
    archive changes one line of machine-local config, not the profile.
    """

    source_id: str
    storage_root: str
    relative_path: str
    source_kind: str | None = None
    content_sha256: str | None = None


@dataclass(frozen=True)
class ConfigEntry:
    """One validated statement, with its provenance intact.

    v1 and v2 entries share this type. **v2-only fields stay `None` on a v1 entry
    rather than being defaulted** (SCHEMA-V2 §14): giving a v1 entry
    `verification_status="inferred"` would make it look as though it answered a
    question it was never asked — the same class of error as inventing a date.
    """

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

    # ── v2 only; None on every v1 entry ──
    section: str | None = None
    status: str | None = None
    source_confidence: str | None = None
    interpretation_confidence: str | None = None
    shareability: str | None = None
    redaction: tuple[str, ...] | None = None
    date_confidence: str | None = None
    date_precision: str | None = None
    domain_scope: str | None = None
    project_refs: tuple[str, ...] | None = None
    universality: str | None = None
    philos_relevance: str | None = None
    canonical_sources: tuple[SourceRef, ...] | None = None
    relations: tuple[dict[str, str], ...] | None = None
    cross_links: tuple[dict[str, str], ...] | None = None
    order: int | None = None
    created_at: str | None = None
    updated_at: str | None = None
    last_verified_at: str | None = None
    verification_status: str | None = None

    @property
    def is_v2(self) -> bool:
        return self.schema_version == 2

    @property
    def is_historical(self) -> bool:
        """How Roei USED to operate — never rendered as current.

        v1 says so with `valid_until: historical`; v2 with `status: historical`
        (I5). `archived` is NOT historical: it is excluded from both the current
        and the historical projection.
        """
        if self.is_v2:
            return self.status == "historical"
        return self.type == "historical_pattern" or self.valid_until == "historical"

    @property
    def is_archived(self) -> bool:
        """I5 — removed from active *and* historical use. v1 has no equivalent."""
        return self.status == "archived"

    @property
    def needs_review(self) -> bool:
        """I15 — a candidate: surfaced for review, out of the canonical projection."""
        return self.verification_status == "needs_review"

    @property
    def is_unverified(self) -> bool:
        """§9 — an unchecked claim; excluded from the canonical active projection."""
        return self.verification_status == "unverified"

    @property
    def is_canonically_admitted(self) -> bool:
        """SCHEMA-V2 §9.1 / I15 — may this entry be projected as current?

        v2 admits only `self_confirmed`, `human_confirmed` and `source_confirmed`.

        **A v1 entry is always admitted.** v1 has no `verification_status`, so
        applying the v2 allowlist to it would withhold every v1 entry on the
        grounds that it never answered a question its schema did not ask — the
        same error as defaulting it to `unverified` (§14).
        """
        if not self.is_v2:
            return True
        return self.verification_status in V2_CANONICAL_ACTIVE

    @property
    def merlin_may_use(self) -> bool:
        """I2 — a surface reads iff its usage flag is true. `privacy` never gates this."""
        if self.is_v2:
            return bool(self.usage.get("merlin_context", False))
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
    #: Non-fatal findings — forward references while authoring. Reported, never fatal.
    warnings: tuple[ValidationError, ...] = ()
    #: v2 `status: archived` — retained and inspectable, projected nowhere (I5).
    archived: tuple[ConfigEntry, ...] = ()
    #: v2 `verification_status: needs_review` — surfaced for review, excluded from
    #: the canonical active projection (I15). Not an error, not yet an answer.
    review_candidates: tuple[ConfigEntry, ...] = ()
    #: v2 `verification_status: unverified` — never checked at all (§9). Kept apart
    #: from `review_candidates` because I18 makes the distinction load-bearing:
    #: "nobody has looked at this yet" and "this was flagged for a human" call for
    #: different action, and one count covering both hides which one you have.
    unverified: tuple[ConfigEntry, ...] = ()
    #: v2 `verification_status: inferred` — the system derived it; no one confirmed
    #: it (§9.1). Withheld from the canonical projection, retained in full.
    inferred: tuple[ConfigEntry, ...] = ()
    #: v2 `verification_status: disputed` — checked and CONTESTED, which is not the
    #: same as unchecked (I18). Withheld, and deliberately its own count: a
    #: contested claim is a signal to resolve, not merely one more unconfirmed row.
    disputed: tuple[ConfigEntry, ...] = ()
    #: Populated only when load_personal_config(verify=True).
    resolved_sources: tuple[ResolvedSource, ...] = ()
    #: Machine-local findings: unconfigured root, missing file, hash mismatch.
    #: Kept apart from `errors` — a profile is not invalid because THIS laptop
    #: has not configured its storage roots.
    source_issues: tuple[SourceIssue, ...] = ()
    #: Reserved for the change log. Empty while the projection is seed-only.
    recent_changes: tuple[dict[str, Any], ...] = ()

    @property
    def is_valid(self) -> bool:
        return not self.errors

    @property
    def is_empty(self) -> bool:
        """No entries AT ALL — not merely none that project.

        An archived, needs_review or unverified entry is data that exists and was
        deliberately withheld. Reporting that as empty would let the collector set
        `absence_is_meaningful` and a later layer conclude "Roei has declared
        nothing", when the truth is "nothing has been confirmed yet".
        """
        return (self.total_entries == 0 and not self.withheld_total)

    @property
    def withheld_total(self) -> int:
        """Entries that exist but are projected nowhere (§9.1, I5)."""
        return (len(self.archived) + len(self.review_candidates)
                + len(self.unverified) + len(self.inferred) + len(self.disputed))

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
            "archived": len(self.archived),
            "review_candidates": len(self.review_candidates),
            "unverified": len(self.unverified),
            "inferred": len(self.inferred),
            "disputed": len(self.disputed),
            "withheld_total": self.withheld_total,
            # v2 lifecycle, as counts. The Morning Snapshot needs to know HOW MUCH
            # is current, retired or unreviewed — never what any of it says.
            "active": sum(len(self.domain(d)) for d in CONFIG_DOMAINS if d != "routines_history"),
            "historical": len(self.routines_history),
            "unresolved_cross_links": len(self.warnings),
            "warnings": [str(w) for w in self.warnings],
            # machine-local source health (I13). Separate from validation: a
            # profile is not invalid because THIS laptop lacks a storage root.
            "sources_resolved": len(self.resolved_sources),
            "sources_verified": sum(1 for r in self.resolved_sources if r.hash_ok is True),
            "hash_mismatches": sum(1 for i in self.source_issues if i.kind == "hash_mismatch"),
            "source_issues": [str(i) for i in self.source_issues],
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
    #: Non-fatal findings. A forward cross-link is the canonical case: it names an
    #: entry that does not exist YET, which is a normal state during authoring —
    #: reporting it is useful, refusing the file is not (req 14).
    warnings: tuple[ValidationError, ...]
    #: v2 file-level `sources` registry, empty for v1. Kept so resolution and
    #: hash verification happen AFTER parsing, against real config (I13).
    registry: dict[str, "RegisteredSource"]
    mtime_iso: str | None
    existed: bool
    parsed: bool


def _enum(
    raw: dict, key: str, allowed: frozenset[str], *, loc: str, source: str,
    entry_id: str | None, required: bool = True,
) -> list[ValidationError]:
    """One enum check, so v2's twelve of them read identically."""
    v = raw.get(key)
    if v is None:
        if required:
            return [ValidationError(source, f"{loc}.{key}", "required field missing", entry_id)]
        return []
    if v not in allowed:
        return [ValidationError(source, f"{loc}.{key}", f"unknown {key} {v!r}", entry_id)]
    return []


def _validate_sources(
    raw: Any, *, source: str,
) -> tuple[dict[str, RegisteredSource], list[ValidationError]]:
    """File-level `sources` registry (§6). I8: no absolute path may appear here."""
    out: dict[str, RegisteredSource] = {}
    errs: list[ValidationError] = []
    if raw is None:
        return out, errs
    if not isinstance(raw, dict):
        return out, [ValidationError(source, "sources", f"expected a mapping, got {type(raw).__name__}")]

    for sid, body in raw.items():
        loc = f"sources.{sid}"
        if not isinstance(body, dict):
            errs.append(ValidationError(source, loc, f"expected a mapping, got {type(body).__name__}"))
            continue
        root = body.get("storage_root")
        rel = body.get("relative_path")
        if not isinstance(root, str) or not root:
            errs.append(ValidationError(source, f"{loc}.storage_root", "required field missing"))
        if not isinstance(rel, str) or not rel:
            errs.append(ValidationError(source, f"{loc}.relative_path", "required field missing"))
        # I8 — an absolute path is a fact about one machine, not a citation.
        for key, val in (("storage_root", root), ("relative_path", rel)):
            if isinstance(val, str) and (val.startswith("/") or val.startswith("~")):
                errs.append(ValidationError(
                    source, f"{loc}.{key},",
                    f"absolute path {val!r} — sources resolve through an external "
                    "storage_roots map so the profile survives moving machines",
                ))
        if isinstance(root, str) and isinstance(rel, str) and root and rel:
            out[str(sid)] = RegisteredSource(
                source_id=str(sid), storage_root=root, relative_path=rel,
                source_kind=body.get("source_kind"),
                content_sha256=body.get("content_sha256"),
            )
    return out, errs


def _validate_entry_v2(
    raw: Any,
    index: int,
    *,
    source: str,
    layer: str,
    sources: dict[str, RegisteredSource],
) -> tuple[ConfigEntry | None, list[ValidationError]]:
    """Schema v2 entry, per the frozen SCHEMA-V2.md §3–§5."""
    loc = f"entries[{index}]"
    errs: list[ValidationError] = []

    if not isinstance(raw, dict):
        return None, [ValidationError(source, loc, f"expected a mapping, got {type(raw).__name__}")]

    entry_id = raw.get("id") if isinstance(raw.get("id"), str) else None

    for key in V2_REQUIRED_ENTRY_FIELDS:
        if key not in raw or raw[key] in (None, ""):
            errs.append(ValidationError(source, f"{loc}.{key}", "required field missing", entry_id))

    errs += _enum(raw, "section", V2_SECTIONS, loc=loc, source=source, entry_id=entry_id)
    errs += _enum(raw, "type", V2_TYPES, loc=loc, source=source, entry_id=entry_id)
    errs += _enum(raw, "status", V2_STATUS, loc=loc, source=source, entry_id=entry_id)
    errs += _enum(raw, "privacy", V2_PRIVACY, loc=loc, source=source, entry_id=entry_id)
    for key, allowed in (
        ("shareability", V2_SHAREABILITY),
        ("date_confidence", V2_DATE_CONFIDENCE),
        ("date_precision", V2_DATE_PRECISION),
        ("universality", V2_UNIVERSALITY),
        ("philos_relevance", V2_PHILOS_RELEVANCE),
        ("verification_status", V2_VERIFICATION),
        ("source_confidence", V2_CONFIDENCE),
        ("interpretation_confidence", V2_CONFIDENCE),
    ):
        errs += _enum(raw, key, allowed, loc=loc, source=source, entry_id=entry_id, required=False)

    # ── redaction: a LIST of policies (SCHEMA-V2 §8, I3), never the old dict shape ──
    redaction_raw = raw.get("redaction")
    redaction: tuple[str, ...] | None = None
    if redaction_raw is not None:
        if not isinstance(redaction_raw, list):
            errs.append(ValidationError(
                source, f"{loc}.redaction",
                f"redaction must be a list of policies, got {type(redaction_raw).__name__} "
                "— the v1/dict shape is rejected", entry_id))
        else:
            ok = True
            unknown = [p for p in redaction_raw if p not in V2_REDACTION]
            if unknown:
                errs.append(ValidationError(
                    source, f"{loc}.redaction", f"unknown redaction policy/ies {unknown}", entry_id))
                ok = False
            if len(redaction_raw) != len(set(redaction_raw)):
                errs.append(ValidationError(
                    source, f"{loc}.redaction", "duplicate redaction policies", entry_id))
                ok = False
            if "none" in redaction_raw and len(redaction_raw) > 1:
                errs.append(ValidationError(
                    source, f"{loc}.redaction",
                    "'none' cannot coexist with another policy", entry_id))
                ok = False
            if ok:
                redaction = tuple(redaction_raw)

    # ── I3 — privacy: sensitive demands the external-model block ──
    # §8 makes `[none]` the value of an absent `redaction`, so omitting the list
    # is not a way around the rule — it IS the rule's worst case. Skipped only
    # when the list was present and already failed its shape check, so a
    # malformed list is reported once rather than twice.
    redaction_shape_failed = redaction_raw is not None and redaction is None
    if raw.get("privacy") == "sensitive" and not redaction_shape_failed:
        effective_redaction = redaction if redaction is not None else ("none",)
        if "external_models_blocked" not in effective_redaction:
            errs.append(ValidationError(
                source, f"{loc}.redaction",
                "privacy: sensitive requires redaction to include "
                "'external_models_blocked' (I3)"
                + ("" if redaction_raw is not None else
                   " — an absent redaction is '[none]' (§8), not an exemption"),
                entry_id))

    # ── usage: the authorisation mechanism (I2) ──
    usage_raw = raw.get("usage")
    usage: dict[str, bool] = {}
    if usage_raw is None:
        errs.append(ValidationError(source, f"{loc}.usage", "required field missing", entry_id))
    elif not isinstance(usage_raw, dict):
        errs.append(ValidationError(
            source, f"{loc}.usage", f"expected a mapping, got {type(usage_raw).__name__}", entry_id))
    else:
        unknown = set(usage_raw) - set(V2_USAGE_SURFACES)
        if unknown:
            errs.append(ValidationError(
                source, f"{loc}.usage",
                f"unknown surface(s) {sorted(unknown)} — usage grants access to a "
                "named surface, so an unrecognised one grants nothing and is a typo",
                entry_id))
        usage = {k: bool(v) for k, v in usage_raw.items()}

    philos_rel = raw.get("philos_relevance")
    if usage.get("philos_core") is True:
        # I4 requires accepted_core; §16 non-goal 5 forbids promotion in v2 at all.
        # Both are reported: the structural rule and the standing prohibition.
        if philos_rel != "accepted_core":
            errs.append(ValidationError(
                source, f"{loc}.philos_relevance",
                "usage.philos_core is true but philos_relevance is not accepted_core (I4)",
                entry_id))
        errs.append(ValidationError(
            source, f"{loc}.usage.philos_core",
            "must be false — Philos Core promotion requires an explicit human step "
            "and v2 adds no route to it (SCHEMA-V2 §16.5)",
            entry_id))

    # ── I3 — the public_profile surface has two extra conditions ──
    # Same shape as the philos_core gate above: `usage` authorises, and a surface
    # that publishes needs the entry to be shareable AND not sensitive. Reported
    # separately because "never meant to leave this machine" and "meant to be
    # public one day, not yet confirmed" are different refusals.
    if usage.get("public_profile") is True:
        if raw.get("shareability") != "public_candidate":
            errs.append(ValidationError(
                source, f"{loc}.shareability",
                f"usage.public_profile is true but shareability is "
                f"{raw.get('shareability')!r}, not 'public_candidate' (I3)",
                entry_id))
        if raw.get("privacy") == "sensitive":
            errs.append(ValidationError(
                source, f"{loc}.privacy",
                "usage.public_profile is true but privacy is 'sensitive' — a "
                "sensitive entry is never published (I3)",
                entry_id))

    # ── I6 — dates are conservative ──
    date_conf = raw.get("date_confidence")
    raw_sources = raw.get("canonical_sources")
    has_source = isinstance(raw_sources, list) and len(raw_sources) > 0
    for key in ("valid_from", "valid_until"):
        if raw.get(key) is not None:
            if date_conf != "dated":
                errs.append(ValidationError(
                    source, f"{loc}.{key}",
                    f"non-null {key} requires date_confidence: dated (I6)", entry_id))
            if not has_source:
                errs.append(ValidationError(
                    source, f"{loc}.{key}",
                    f"non-null {key} requires a supporting canonical_source (I6)", entry_id))

    # ── I17 — date precision is not evidence precision ──
    # An exact precision on a date we do not trust asserts more than we know. The
    # two axes move together in one direction only: no confidence, no precision.
    # An ABSENT date_confidence counts as unknown here: a precision stated with no
    # confidence at all vouches for exactness nobody claimed, which is the same
    # error as stating it against an explicit `unknown`.
    date_prec = raw.get("date_precision")
    if date_conf in (None, "unknown") and date_prec not in (None, "unknown"):
        errs.append(ValidationError(
            source, f"{loc}.date_precision",
            f"date_precision {date_prec!r} requires date_confidence: dated (I17)", entry_id))

    # ── canonical_sources: §7, I8, I10, I11 ──
    refs: list[SourceRef] = []
    ocr_pending = False
    if raw_sources is not None:
        if not isinstance(raw_sources, list):
            errs.append(ValidationError(
                source, f"{loc}.canonical_sources",
                f"expected a list, got {type(raw_sources).__name__}", entry_id))
        else:
            for j, item in enumerate(raw_sources):
                rloc = f"{loc}.canonical_sources[{j}]"
                if not isinstance(item, dict):
                    errs.append(ValidationError(source, rloc, "expected a mapping", entry_id))
                    continue
                sid = item.get("source_id")
                prec = item.get("evidence_precision")
                ref = item.get("evidence_ref")
                if not isinstance(sid, str) or not sid:
                    errs.append(ValidationError(source, f"{rloc}.source_id", "required field missing", entry_id))
                elif sid not in sources:
                    # I8 — a dangling reference is an error, never a warning
                    errs.append(ValidationError(
                        source, f"{rloc}.source_id",
                        f"{sid!r} is not in the file's sources registry (I8)", entry_id))
                if prec not in V2_EVIDENCE_PRECISION:
                    errs.append(ValidationError(
                        source, f"{rloc}.evidence_precision",
                        f"unknown evidence_precision {prec!r}", entry_id))
                elif ref in (None, "") and prec not in V2_NULL_REF_OK:
                    errs.append(ValidationError(
                        source, f"{rloc}.evidence_ref",
                        f"may be null only at precision {sorted(V2_NULL_REF_OK)} (I10)", entry_id))
                if prec == "ocr_pending":
                    ocr_pending = True
                if isinstance(sid, str):
                    refs.append(SourceRef(sid, ref if isinstance(ref, str) else None, str(prec)))

    verification = raw.get("verification_status")
    if ocr_pending and verification != "needs_review":
        errs.append(ValidationError(
            source, f"{loc}.verification_status",
            "an ocr_pending source means the text has not been read yet, so the "
            "entry must be needs_review (I11)", entry_id))

    # ── I9 — order sits inside its section's band (§11) ──
    order = raw.get("order")
    section = raw.get("section")
    if order is not None:
        if not isinstance(order, int):
            errs.append(ValidationError(
                source, f"{loc}.order", f"expected an integer, got {type(order).__name__}", entry_id))
        elif isinstance(section, str) and section in V2_ORDER_BANDS:
            lo, hi = V2_ORDER_BANDS[section]
            if not lo <= order <= hi:
                errs.append(ValidationError(
                    source, f"{loc}.order",
                    f"{order} is outside the {section} band {lo}–{hi} (§11, I9)", entry_id))

    # ── relations / cross_links ──
    def _links(key: str, required_keys: tuple[str, ...]) -> tuple[dict[str, str], ...]:
        val = raw.get(key)
        if val is None:
            return ()
        if not isinstance(val, list):
            errs.append(ValidationError(
                source, f"{loc}.{key}", f"expected a list, got {type(val).__name__}", entry_id))
            return ()
        out: list[dict[str, str]] = []
        for j, item in enumerate(val):
            lloc = f"{loc}.{key}[{j}]"
            if not isinstance(item, dict):
                errs.append(ValidationError(source, lloc, "expected a mapping", entry_id))
                continue
            for rk in required_keys:
                if not item.get(rk):
                    errs.append(ValidationError(source, f"{lloc}.{rk}", "required field missing", entry_id))
            if key == "relations" and item.get("type") not in V2_RELATION_TYPES:
                errs.append(ValidationError(
                    source, f"{lloc}.type", f"unknown relation type {item.get('type')!r}", entry_id))
            out.append({k: str(v) for k, v in item.items()})
        return tuple(out)

    relations = _links("relations", ("type", "target"))
    cross_links = _links("cross_links", ("to", "entry", "relation"))

    if errs:
        return None, errs

    return (
        ConfigEntry(
            id=str(raw["id"]),
            type=str(raw["type"]),
            # v2 renames `statement` to `value`; the projection keeps one field name
            statement=str(raw["value"]),
            # v1's flat `confidence` splits in two — neither maps onto it, so the
            # shared field records which axis is which rather than inventing a blend
            confidence=str(raw.get("interpretation_confidence") or raw.get("source_confidence") or ""),
            privacy=str(raw["privacy"]),
            valid_from=raw.get("valid_from"),
            valid_until=raw.get("valid_until"),
            usage=usage,
            source_file=source,
            source_index=index,
            schema_version=2,
            layer=layer,
            section=str(raw["section"]),
            status=str(raw["status"]),
            source_confidence=raw.get("source_confidence"),
            interpretation_confidence=raw.get("interpretation_confidence"),
            shareability=raw.get("shareability"),
            redaction=redaction,
            date_confidence=raw.get("date_confidence"),
            date_precision=raw.get("date_precision"),
            domain_scope=raw.get("domain_scope"),
            project_refs=tuple(raw.get("project_refs") or ()),
            universality=raw.get("universality"),
            philos_relevance=raw.get("philos_relevance"),
            canonical_sources=tuple(refs),
            relations=relations,
            cross_links=cross_links,
            order=order if isinstance(order, int) else None,
            created_at=raw.get("created_at"),
            updated_at=raw.get("updated_at"),
            last_verified_at=raw.get("last_verified_at"),
            verification_status=verification,
        ),
        [],
    )


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
        return LoadedFile(path, None, None, (), (), (), {}, None, existed=False, parsed=False)

    mtime = _iso(path.stat().st_mtime)

    try:
        import yaml  # imported here so a missing PyYAML is an ERROR, not an ImportError at startup
    except Exception as exc:  # pragma: no cover - environment-dependent
        return LoadedFile(
            path, None, None, (),
            (ValidationError(source, "<import>", f"PyYAML unavailable: {exc}"),), (), {},
            mtime, existed=True, parsed=False,
        )

    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    except Exception as exc:
        return LoadedFile(
            path, None, None, (),
            (ValidationError(source, "<file>", f"malformed YAML: {exc.__class__.__name__}"),), (), {},
            mtime, existed=True, parsed=False,
        )

    if raw is None:
        # An empty file is valid and says "no entries" — not an error.
        return LoadedFile(path, None, None, (), (), (), {}, mtime, existed=True, parsed=True)

    if not isinstance(raw, dict):
        return LoadedFile(
            path, None, None, (),
            (ValidationError(source, "<file>", f"expected a mapping at the top level, got {type(raw).__name__}"),), (), {},
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
    elif version not in SUPPORTED_SCHEMA_VERSIONS:
        errors.append(
            ValidationError(
                source, "schema_version",
                f"unsupported version {version} (this loader understands "
                f"{sorted(SUPPORTED_SCHEMA_VERSIONS)})",
            )
        )
        # Refuse the entries rather than guess at a shape we do not know.
        return LoadedFile(path, raw.get("layer"), version, (), tuple(errors), (), {}, mtime, True, parsed=False)

    layer = raw.get("layer")
    if not isinstance(layer, str) or not layer:
        errors.append(ValidationError(source, "layer", "required field missing"))
        layer = "unknown"

    # §2/I1 — ownership is a file-level fact, and the only place it is recorded.
    # v2 only: v1 files declare `owner` too, but their behaviour is frozen and a
    # new requirement must not reach back and invalidate a file that loaded
    # yesterday.
    if version == 2:
        owner = raw.get("owner")
        if not isinstance(owner, str) or not owner:
            errors.append(ValidationError(
                source, "owner",
                "required field missing — ownership is file-level (§2, I1)"))

    # v2 carries a file-level source registry; v1 has none. Parsed before the
    # entries because every canonical_sources reference is checked against it (I8).
    registry: dict[str, RegisteredSource] = {}
    if version == 2:
        registry, reg_errs = _validate_sources(raw.get("sources"), source=source)
        errors.extend(reg_errs)
    elif raw.get("sources") is not None:
        errors.append(ValidationError(
            source, "sources",
            "a sources registry is a v2 field; this file declares schema_version 1",
        ))

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
            # Version dispatch is explicit: a v1 file is read by v1 rules and
            # gains no v2 field, so its entries look exactly as they did before.
            if version == 2:
                entry, errs = _validate_entry_v2(
                    item, i, source=source, layer=layer, sources=registry
                )
            else:
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

    # Forward cross-links: a link may name an entry authored later. That is a
    # normal state, so it is a warning — refusing the file would make incremental
    # authoring impossible, and silence would hide a genuine typo.
    warnings: list[ValidationError] = []
    known = {e.id for e in entries}
    #: I7 needs the TARGET's status, so the check runs here rather than per-entry:
    #: this is the first point at which every entry in the file is known.
    status_of = {e.id: e.status for e in entries}
    for e in entries:
        for link in (e.cross_links or ()):
            target = link.get("entry")
            if target and target not in known:
                warnings.append(ValidationError(
                    source, f"entries[{e.source_index}].cross_links",
                    f"forward reference to {target!r}, which is not in this file",
                    e.id))
        for rel in (e.relations or ()):
            target = rel.get("target")
            if not target:
                continue
            rloc = f"entries[{e.source_index}].relations"

            # ── I7 — supersession honesty ──
            # `supersedes` asserts TRUE INVALIDATION, so the target must really be
            # archived. Checkable only inside this file; where it is not, the
            # honest outcome is "cannot check" — never "assume archived". The
            # specific warning REPLACES the generic one so one unresolved link
            # produces one finding, not two names for the same fact.
            if rel.get("type") == "supersedes":
                if target in known:
                    target_status = status_of.get(target)
                    if target_status != "archived":
                        errors.append(ValidationError(
                            source, rloc,
                            f"supersedes target {target!r} has status "
                            f"{target_status!r}, not 'archived' — supersedes claims "
                            "true invalidation, while a change of active expression "
                            "uses succeeds_as_primary_expression (I7)",
                            e.id))
                else:
                    # Known limitation, stated rather than hidden: an entry that
                    # failed its own validation was dropped above, so a supersedes
                    # pointing at it arrives here as unresolved and degrades to
                    # this warning instead of the archived-target error.
                    warnings.append(ValidationError(
                        source, rloc,
                        f"unresolved_supersedes_target: {target!r} is not in this "
                        "file, so I7 cannot be checked and the target is never "
                        "assumed archived (a target rejected by its own validation "
                        "also reads as unresolved here)",
                        e.id))
                continue

            if target not in known:
                warnings.append(ValidationError(
                    source, rloc,
                    f"forward reference to {target!r}, which is not in this file",
                    e.id))

    return LoadedFile(
        path, layer, version, tuple(entries), tuple(errors), tuple(warnings),
        registry, mtime, existed=True, parsed=True
    )


# ── projection ───────────────────────────────────────────────────────────────


def _route(entry: ConfigEntry) -> str | None:
    """Which projected domain an entry belongs to, or None if it belongs to none.

    Historical entries leave their source domain entirely: a past routine must
    not sit in `person` where a later layer would read it as current.

    Admission is an ALLOWLIST (§9.1, I15). `archived` is out by status (I5); every
    other exclusion is by verification state — `unverified`, `needs_review`,
    `inferred` and `disputed` are each withheld and returned as None rather than
    quietly dropped, so the caller can collect them into their own buckets.

    The verification gate applies BEFORE historical routing: an unconfirmed claim
    about the past is still an unconfirmed claim, and the historical projection is
    a record, not a holding pen.
    """
    if entry.is_archived:
        return None
    if not entry.is_canonically_admitted:
        return None
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
    warnings: list[ValidationError] = []
    archived: list[ConfigEntry] = []
    review_candidates: list[ConfigEntry] = []
    unverified: list[ConfigEntry] = []
    inferred: list[ConfigEntry] = []
    disputed: list[ConfigEntry] = []
    sources: list[str] = []
    versions: set[int] = set()
    mtimes: list[str] = []

    for lf in files:
        errors.extend(lf.errors)
        warnings.extend(lf.warnings)
        if lf.existed and lf.parsed:
            sources.append(lf.path.name)
            if lf.mtime_iso:
                mtimes.append(lf.mtime_iso)
        if lf.schema_version is not None:
            versions.add(lf.schema_version)
        for entry in lf.entries:
            domain = _route(entry)
            if domain is None:
                # Withheld — into distinct buckets, never one "withheld" count.
                # "Removed", "never checked", "derived", "contested" and "flagged
                # for a human" call for different action (§9.1). Order is fixed so
                # an entry in two states always lands the same way.
                if entry.is_archived:
                    archived.append(entry)
                elif entry.verification_status == "needs_review":
                    review_candidates.append(entry)
                elif entry.verification_status == "inferred":
                    inferred.append(entry)
                elif entry.verification_status == "disputed":
                    disputed.append(entry)
                else:
                    unverified.append(entry)
                continue
            buckets[domain].append(entry)

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
        warnings=tuple(warnings),
        archived=tuple(archived),
        review_candidates=tuple(review_candidates),
        unverified=tuple(unverified),
        inferred=tuple(inferred),
        disputed=tuple(disputed),
        recent_changes=applied_changes,
    )


DEFAULT_PROFILE_FILES = ("person.yaml", "music.yaml")


def verify_sources(
    files: Iterable[LoadedFile],
    roots: dict[str, Path] | None = None,
    *,
    storage_roots: dict[str, str] | None = None,
) -> tuple[tuple[ResolvedSource, ...], tuple[SourceIssue, ...]]:
    """Resolve and hash-check every v2 source. Read-only, and never raises.

    Separate from parsing on purpose: whether a file parses is a property of the
    profile, whether its sources resolve is a property of THIS machine. Mixing
    them would make a valid profile look invalid on a laptop that simply has not
    configured its roots yet.
    """
    if roots is None:
        roots, issues = load_storage_roots(storage_roots)
        config_issues = list(issues)
    else:
        config_issues = []

    resolved: list[ResolvedSource] = []
    issues = list(config_issues)
    seen: set[str] = set()

    for lf in files:
        for sid, src in (lf.registry or {}).items():
            if sid in seen:
                continue
            seen.add(sid)
            got, issue = resolve_source(sid, src.storage_root, src.relative_path, roots)
            if issue is not None:
                issues.append(issue)
            if got is None or not got.exists:
                continue
            ok, hash_issue = verify_hash(sid, got.path, src.content_sha256)
            if hash_issue is not None:
                issues.append(hash_issue)
            resolved.append(ResolvedSource(sid, got.path, True, hash_ok=ok))

    return tuple(resolved), tuple(issues)


def load_personal_config(
    profiles_dir: Path,
    filenames: Sequence[str] = DEFAULT_PROFILE_FILES,
    changes: Sequence[dict[str, Any]] = (),
    *,
    storage_roots: dict[str, str] | None = None,
    verify: bool = False,
) -> tuple[PersonalConfigState, tuple[LoadedFile, ...]]:
    """Load every profile file and project it. Never raises.

    `verify=False` by default: resolution touches the filesystem, and the common
    caller (the Morning Snapshot collector) wants profile health, not an archive
    audit. Pass `verify=True` to resolve sources and check recorded hashes.
    """
    loaded = tuple(load_file(profiles_dir / name) for name in filenames)
    state = project(loaded, changes)
    if verify:
        resolved, issues = verify_sources(loaded, storage_roots=storage_roots)
        state = replace(state, resolved_sources=resolved, source_issues=issues)
    return state, loaded
