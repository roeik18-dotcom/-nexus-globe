"""PHILOS-domain discrimination and Observation construction for a real
Merlin turn. Separate from app.action_intent.gate by design (same reasoning
that module already gives for staying separate from domain_router — see its
own module header): this is a third, narrower discrimination axis
("does this turn carry an explicit canon self-report"), not a rephrasing of
either of the other two.

**Why an explicit key=value micro-grammar, not natural-language inference —
read this before changing anything here.** Canon's Observation requires
`domain`/`frame`/`level`/`stability`/`deficitType` (app/lib/philos/canon/
observation.ts, read this pass). A real free-form utterance ("I'm tired")
does not explicitly state which of {G,E,C} domain, which of {I,R,S} frame,
or what numeric level/stability it corresponds to — mapping it to those
values would require sentiment/NLU judgment this pass's own rule forbids
("No inference disguised as observation"). This module therefore does NOT
attempt that mapping. It recognizes only an EXPLICIT, deterministic
self-report shape — a "philos:"/"פילוס:" prefix followed by space-separated
key=value tokens naming canon fields directly — and parses it mechanically,
the same class of operation as parsing a query string, not NLU. A turn that
doesn't use this explicit shape is correctly not recognized at all (see
UNFORMABLE_FIELDS in the phase report for which fields this affects and
why every one of them requires this explicit shape).

This is a genuine, disclosed scope limit: today, a real spoken sentence like
"I feel tired" can NEVER form a canon Observation through this module — not
because of a bug, but because canon's own required fields are not present,
explicitly or otherwise, in that sentence, and inventing them is exactly
what this pass forbids. Closing that gap (if ever done) needs a real,
separately-approved design for how a subjective self-report becomes a
canon-valid numeric measurement — not assumed here.

Orchestration: `handle_philos_observation_turn` is the ONE function that
chains PHILOS_OBSERVE -> PHILOS_ORIENTATION for a recognized turn. It never
imports or references philos_transfer_execute / PHILOS_TRANSFER_EXECUTE —
creating an Observation grants no execution permission (this pass's explicit
rule), and there is no code path here that could invoke it even by
accident.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from app.capabilities._framework import pipeline
from app.capabilities.philos_observe import deterministic_canon_event_id

logger = logging.getLogger("merlin.action_intent.philos_observation")

_TRIGGER_PREFIXES = ("philos:", "פילוס:")

_REQUIRED_TOKEN_KEYS = (
    "domain", "frame", "level", "stability", "deficit", "context",
    "reference", "confidence", "expiry_days",
)
_VALID_DOMAINS = frozenset({"G", "E", "C"})
_VALID_FRAMES = frozenset({"I", "R", "S"})
_VALID_DEFICIT_TYPES = frozenset({"RELATIVE", "OBJECTIVE"})
_VALID_CHANNELS = frozenset({
    "institutional", "material", "economic", "informational", "environmental", "other",
})


@dataclass(frozen=True)
class PhilosObservationDecision:
    is_philos_observation_turn: bool
    reason: str


def classify_philos_observation_intent(text: str) -> PhilosObservationDecision:
    """Deterministic, rule-based — no NLU. Recognizes only the explicit
    trigger prefix; everything else (including a turn that merely mentions
    the word "philos") is correctly NOT recognized."""
    stripped = text.strip()
    low = stripped.lower()
    for prefix in _TRIGGER_PREFIXES:
        if low.startswith(prefix) or stripped.startswith(prefix):
            return PhilosObservationDecision(True, f"explicit {prefix!r} self-report prefix")
    return PhilosObservationDecision(False, "no explicit philos self-report prefix")


@dataclass(frozen=True)
class ObservationEvidence:
    subject: str
    domain: str
    frame: str
    level: float
    stability: float
    deficit_type: str
    context: str
    reference: str
    confidence: float
    expiry_days: int
    systemic_channel: Optional[str]


@dataclass(frozen=True)
class MissingEvidence:
    missing_fields: tuple[str, ...]
    invalid_fields: tuple[str, ...]


def _strip_prefix(stripped: str) -> str:
    low = stripped.lower()
    for prefix in _TRIGGER_PREFIXES:
        if low.startswith(prefix):
            return stripped[len(prefix):]
        if stripped.startswith(prefix):
            return stripped[len(prefix):]
    return stripped


def _tokenize(body: str) -> dict[str, str]:
    tokens: dict[str, str] = {}
    for chunk in body.split():
        if "=" not in chunk:
            continue
        k, _, v = chunk.partition("=")
        k = k.strip().lower()
        v = v.strip()
        if k and v:
            tokens[k] = v
    return tokens


def parse_philos_self_report(text: str, *, subject: Optional[str]) -> "ObservationEvidence | MissingEvidence":
    """Pure, deterministic, mechanical key=value extraction — never guesses
    a missing or malformed field, always reports it by name instead."""
    tokens = _tokenize(_strip_prefix(text.strip()))

    missing: list[str] = []
    invalid: list[str] = []

    if not subject:
        missing.append("subject (no profile_id bound to this session)")

    for key in _REQUIRED_TOKEN_KEYS:
        if not tokens.get(key):
            missing.append(key)

    domain = tokens.get("domain", "").upper()
    if tokens.get("domain") and domain not in _VALID_DOMAINS:
        invalid.append("domain")

    frame = tokens.get("frame", "").upper()
    if tokens.get("frame") and frame not in _VALID_FRAMES:
        invalid.append("frame")

    deficit_type = tokens.get("deficit", "").upper()
    if tokens.get("deficit") and deficit_type not in _VALID_DEFICIT_TYPES:
        invalid.append("deficit")

    def _parse_float(key: str, *, unit_range: Optional[tuple[float, float]] = None) -> Optional[float]:
        raw = tokens.get(key)
        if raw is None:
            return None
        try:
            v = float(raw)
        except ValueError:
            invalid.append(key)
            return None
        if unit_range and not (unit_range[0] <= v <= unit_range[1]):
            invalid.append(key)
            return None
        return v

    level = _parse_float("level")
    stability = _parse_float("stability")
    confidence = _parse_float("confidence", unit_range=(0.0, 1.0))

    expiry_days: Optional[int] = None
    raw_expiry = tokens.get("expiry_days")
    if raw_expiry is not None:
        try:
            expiry_days = int(raw_expiry)
            if expiry_days <= 0:
                invalid.append("expiry_days")
                expiry_days = None
        except ValueError:
            invalid.append("expiry_days")

    channel = tokens.get("channel")
    if frame == "S":
        if not channel:
            missing.append("channel (required because frame=S)")
        elif channel not in _VALID_CHANNELS:
            invalid.append("channel")
    elif channel and channel not in _VALID_CHANNELS:
        invalid.append("channel")

    context = tokens.get("context")
    reference = tokens.get("reference")

    if missing or invalid:
        return MissingEvidence(missing_fields=tuple(missing), invalid_fields=tuple(invalid))

    return ObservationEvidence(
        subject=subject,  # non-None: the "not subject" branch above would have short-circuited via `missing`
        domain=domain, frame=frame, level=level, stability=stability,
        deficit_type=deficit_type, context=context, reference=reference,
        confidence=confidence, expiry_days=expiry_days,
        systemic_channel=channel if frame == "S" else None,
    )


def _evidence_to_inputs(evidence: ObservationEvidence) -> dict:
    d = {
        "subject": evidence.subject,
        "domain": evidence.domain,
        "frame": evidence.frame,
        "level": evidence.level,
        "stability": evidence.stability,
        "deficit_type": evidence.deficit_type,
        "context": evidence.context,
        "reference": evidence.reference,
        "confidence": evidence.confidence,
        "expiry_days": evidence.expiry_days,
    }
    if evidence.systemic_channel:
        d["systemic_channel"] = evidence.systemic_channel
    return d


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _missing_evidence_reply(parsed: MissingEvidence) -> str:
    parts = []
    if parsed.missing_fields:
        parts.append("חסרים: " + ", ".join(parsed.missing_fields))
    if parsed.invalid_fields:
        parts.append("לא תקינים: " + ", ".join(parsed.invalid_fields))
    return "לא ניתן לבנות תצפית פילוס — " + "; ".join(parts) + "."


async def handle_philos_observation_turn(text: str, profile_id: Optional[str]) -> Optional[str]:
    """Returns None when this turn is not a philos self-report at all (the
    caller should fall through to its normal path unchanged). Otherwise
    always returns a user-facing reply string — never raises, never leaves
    an in-between state: either a full ingest+orientation round trip, or a
    controlled explanation of exactly what evidence is missing/invalid,
    with zero Observation written in that case."""
    decision = classify_philos_observation_intent(text)
    if not decision.is_philos_observation_turn:
        return None

    parsed = parse_philos_self_report(text, subject=profile_id)
    if isinstance(parsed, MissingEvidence):
        logger.info("PHILOS_OBSERVATION_TURN missing=%s invalid=%s", parsed.missing_fields, parsed.invalid_fields)
        return _missing_evidence_reply(parsed)

    obs_inputs = _evidence_to_inputs(parsed)
    action_id = f"act-observe-{deterministic_canon_event_id(obs_inputs)}"

    from app.capabilities.registry import REGISTRY

    observe_sr = await pipeline.execute(
        REGISTRY, "PHILOS_OBSERVE", obs_inputs, action_id=action_id,
        provenance_source="merlin-philos-self-report",
    )
    if observe_sr.status not in ("accepted", "duplicate"):
        logger.info("PHILOS_OBSERVATION_TURN observe failed status=%s code=%s", observe_sr.status, observe_sr.code)
        return f"רישום התצפית נכשל: {observe_sr.code}."

    result = observe_sr.result or {}
    if not result.get("ingested"):
        return f"רישום התצפית נכשל: {result.get('error')}."
    canon_event_id = result["canon_event_id"]

    orient_sr = await pipeline.execute(
        REGISTRY, "PHILOS_ORIENTATION",
        {"canon_event_id": canon_event_id, "as_of": _now_iso()},
        provenance_source="merlin-philos-self-report",
    )
    orient_result = orient_sr.result or {}
    if orient_sr.status != "accepted" or not orient_result.get("connected"):
        return f"התצפית נרשמה (canon_event_id={canon_event_id}) אך לא ניתן היה לקבל כיוון מפילוס כרגע."

    handoff = orient_result.get("handoff") or {}
    current_state = handoff.get("current_state")
    if current_state:
        reply = (
            f"נרשם. מצב נוכחי: domain={current_state.get('domain')} "
            f"frame={current_state.get('frame')} level={current_state.get('level')} "
            f"stability={current_state.get('stability')}."
        )
    else:
        reply = f"נרשם (canon_event_id={canon_event_id}), אך פילוס לא החזיר מצב נוכחי."

    if handoff.get("candidate_action"):
        reply += " קיימת פעולת מועמד — נדרש אישור נפרד לביצוע דרך Action Registry."

    return reply
