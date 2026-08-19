"""PHILOS orientation interview — turns a NATURAL first-person self-report
("אני מרגיש מרוקן לאחרונה") into a canon-valid Observation through explicit,
one-at-a-time follow-up questions. Never infers a canon field from tone,
sentiment, or word-choice severity.

**Relationship to `philos_observation_gate.py`, deliberately NOT merged**:
that module recognizes only the explicit `"philos:"/"פילוס:" key=value`
micro-grammar — a complete self-report in one shot, for a caller (test, API,
power user) that already knows canon's field names. This module is the
natural-speech counterpart: it recognizes an ordinary first-person state
sentence, and gets to the same canon-valid Observation by ASKING for
whatever the sentence didn't already make explicit. Both modules end at the
exact same two capabilities — `PHILOS_OBSERVE` then `PHILOS_ORIENTATION` —
and neither imports the other. A turn starting with the explicit prefix is
deliberately excluded from this module's own intent classifier (see
`_TRIGGER_PREFIXES` below), so the two never race for the same turn.

**The one rule everything here is built around**: a canon Observation field
is only ever filled two ways —
  (A) EXPLICIT wording — a deterministic keyword lookup recognizes a field
      the user actually named (e.g. "רגשית" -> domain=E), never a sentiment
      or severity guess (e.g. "מרוקן"/"drained" NEVER implies domain=E, or
      any level/stability number, on its own);
  (B) a direct ANSWER to this module's own dedicated question for that
      field, still parsed mechanically (keyword lookup for enums, a plain
      number for level/stability, verbatim text for context/reference).
`level` and `stability` are the strictest case: they are NEVER read off
opportunistic wording (a bare number floating in an unrelated sentence is
not reliable evidence of which canon field it measures) — only ever (B),
answering the question that states the exact scale first. See
NUMERIC_HANDLING in the phase report for the two scales this module defines
(canon itself fixes neither).

**Zero-write discipline**: `PHILOS_OBSERVE` (the only network call that
persists anything) is reached from exactly one place, `_finalize()`, gated
behind every required field present AND `confirmation_state == "confirmed"`.
Every other path in this module — a re-ask, a correction, a cancellation, an
expired session — returns before `_finalize()` is ever reached. An
incomplete or abandoned interview is simply a dict entry that gets popped;
nothing about it is ever sent to PHILOS.

**Exactly-once**: `_finalize()` builds `obs_inputs` from the collected
canon fields only (never from `orientation_session_id`/turn ids/timestamps)
and reuses `philos_observe.deterministic_canon_event_id` — the SAME evidence
always hashes to the SAME `canon_event_id`, so a genuine replay (two full
interviews landing on identical answers, a retried final turn, ...) is
deduplicated at both the pipeline's own PURE idempotency cache and PHILOS's
append-only store (409 treated as success), exactly like
`philos_observation_gate.py` already relies on.

**Prompt-injection posture**: every field is filled by a closed, whitelisted
keyword/number/verbatim-text lookup — there is no code path that reads an
arbitrary key out of the turn text and assigns it to a field, so tokens like
`approval=true`/`tool_name=...`/`set policy ...` have no field to land in.
`subject` is never read from turn text at all — always the session's bound
`profile_id`. Free-text fields (`context`/`reference`) additionally have
any `key=value`-shaped fragment stripped before storage (`_strip_injection_tokens`)
as defense in depth, matching this codebase's established "validate once,
scrub again" discipline (see `philos_orientation.py::_scrub_forbidden`).

**Domain isolation while an interview is active** (`_turn_targets_active_interview`):
once an interview starts, it does NOT unconditionally consume every later
turn in the session. Each turn is checked against `app.action_intent.gate`
and `app.domain_router` (read-only reuse, neither module modified); a turn
that independently resolves to a real action intent, a real specific
domain, or an explicit question is left completely untouched — no field
mutation, no expiry change — and this function returns `None` so the
caller's normal routing handles it. The interview simply resumes on the
user's next turn that actually targets it. Fails safe toward the interview:
anything that doesn't positively resolve elsewhere is still treated as
interview input (so a garbled answer re-prompts, it doesn't get dropped).
"""

from __future__ import annotations

import logging
import re
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from app.capabilities._framework import pipeline
from app.capabilities.philos_observe import deterministic_canon_event_id

logger = logging.getLogger("merlin.action_intent.philos_orientation_interview")

# ── constants ────────────────────────────────────────────────────────────

_TRIGGER_PREFIXES = ("philos:", "פילוס:")  # owned by philos_observation_gate.py instead

_INTERVIEW_TTL_SECONDS = 600  # idle timeout; see EXPIRATION in the phase report

# canon leaves these two as pure measurement/pipeline metadata (observation.ts:
# "Measurement metadata, never part of a human's value") — fixed Merlin policy
# defaults, disclosed here and in the final confirmation summary, never asked
# as a question and never guessed per-turn from how the user sounds.
_DEFAULT_CONFIDENCE = 0.75
_DEFAULT_EXPIRY_DAYS = 14

_VALID_DOMAINS = frozenset({"G", "E", "C"})
_VALID_FRAMES = frozenset({"I", "R", "S"})
_VALID_DEFICIT_TYPES = frozenset({"RELATIVE", "OBJECTIVE"})
_VALID_CHANNELS = frozenset({
    "institutional", "material", "economic", "informational", "environmental", "other",
})

# ── intent classification (pure, no state) ──────────────────────────────────

_HE_STATE_VERB_RE = re.compile(r"אני\s+(מרגיש|מרגישה|חש|חשה|נהיה|נהייתי|נהייתה)\b")
_HE_STATE_ADJ_RE = re.compile(
    r"אני\s+(עייף|עייפה|לחוץ|לחוצה|מותש|מותשת|מרוקן|מרוקנת|שחוק|שחוקה|"
    r"תקוע|תקועה|בודד|בודדה|חרד|חרדה|מוצף|מוצפת|קרוע|קרועה)\b"
)
_EN_STATE_RE = re.compile(r"\bi\s*(?:'m|\s+am|\s+feel|\s+have been feeling|\s+ve been feeling)\s+(?!like\b)\w+", re.IGNORECASE)


@dataclass(frozen=True)
class OrientationIntentDecision:
    is_orientation_turn: bool
    reason: str


def classify_philos_orientation_intent(text: str) -> OrientationIntentDecision:
    """Deterministic pattern match on first-person self-state phrasing —
    never a sentiment score, never a topic/keyword-anywhere-in-sentence
    match. A turn that merely mentions a feeling word without a first-person
    subject ("stress is bad for you"), or an ordinary Human/Music/Studio/
    General turn, is correctly NOT recognized."""
    stripped = text.strip()
    low = stripped.lower()
    for prefix in _TRIGGER_PREFIXES:
        if low.startswith(prefix) or stripped.startswith(prefix):
            return OrientationIntentDecision(False, "handled by the explicit self-report prefix gate instead")
    if _HE_STATE_VERB_RE.search(stripped) or _HE_STATE_ADJ_RE.search(stripped):
        return OrientationIntentDecision(True, "explicit first-person Hebrew self-state statement")
    if _EN_STATE_RE.search(stripped):
        return OrientationIntentDecision(True, "explicit first-person English self-state statement")
    return OrientationIntentDecision(False, "no first-person self-state statement recognized")


# ── explicit-wording keyword lookups (category A fields only) ──────────────

_DOMAIN_KEYWORDS = {
    "רגשית": "E", "רגשי": "E",
    "גופנית": "G", "גופני": "G", "פיזית": "G", "פיזי": "G",
    "קוגניטיבית": "C", "קוגניטיבי": "C", "מחשבתית": "C", "מחשבתי": "C", "מנטלית": "C", "מנטלי": "C",
    "emotionally": "E", "emotional": "E",
    "physically": "G", "physical": "G",
    "cognitively": "C", "cognitive": "C", "mentally": "C", "mental": "C",
}
_FRAME_KEYWORDS = {
    "אישית": "I", "אישי": "I",
    "ביחסים": "R", "יחסים": "R", "זוגי": "R", "זוגית": "R",
    "מערכתית": "S", "מערכתי": "S", "מוסדית": "S", "מוסדי": "S",
    "individually": "I", "individual": "I", "personally": "I", "personal": "I",
    "relationally": "R", "relational": "R", "relationship": "R",
    "systemically": "S", "systemic": "S",
}
_DEFICIT_KEYWORDS = {
    "יחסי": "RELATIVE", "יחסית": "RELATIVE", "relative": "RELATIVE",
    "אובייקטיבי": "OBJECTIVE", "אובייקטיבית": "OBJECTIVE", "objective": "OBJECTIVE",
}
_CHANNEL_KEYWORDS = {
    "מוסדי": "institutional", "institutional": "institutional",
    "חומרי": "material", "material": "material",
    "כלכלי": "economic", "economic": "economic",
    "מידעי": "informational", "מידע": "informational", "informational": "informational",
    "סביבתי": "environmental", "environmental": "environmental",
    "אחר": "other", "other": "other",
}
_CONTEXT_KEYWORDS = {
    kw: kw for kw in (
        "עבודה", "בית", "זוגיות", "משפחה", "בריאות", "כסף", "כלכלה", "לימודים",
        "work", "home", "family", "health", "money", "relationship", "school",
    )
}

_NEGATIONS = ("לא", "אין", "not")

# Closed set of intensifier/filler words that may sit between a negation and
# the field keyword it governs without breaking the negation scope — e.g.
# "לא ממש רגשי" (not really emotional), "לא כל כך רגשי" (not so emotional),
# "not really emotional", "not that physical". Deliberately narrow: any
# OTHER word between the negation and the keyword ends the scan (see
# _is_negated_before), so this never reaches back across a clause/comma
# boundary to negate an unrelated later word.
_NEGATION_FILLERS = frozenset({
    "ממש", "כל", "כך", "כזה", "כזאת", "בכלל", "לגמרי",
    "really", "that", "so", "very", "particularly", "exactly",
})
_NEGATION_LOOKBACK = 4  # negation word + up to 3 filler tokens (covers "כל כך" plus one more)
_PUNCT_STRIP = ",.!?״\"'"


def _is_negated_before(text: str, idx: int) -> bool:
    """True when a negation word governs the keyword starting at character
    index `idx` — scanning backward through up to `_NEGATION_LOOKBACK`
    preceding tokens, but only through tokens in `_NEGATION_FILLERS`. Any
    other preceding token stops the scan (not negated): a real word between
    the negation and the keyword means the negation was governing something
    else, not this keyword. Still mechanical token matching, not NLU — this
    never infers an opposite value, it only decides whether the literal
    keyword match should count as an explicit positive statement."""
    preceding = [tok.strip(_PUNCT_STRIP) for tok in text[:idx].strip().split()]
    if not preceding:
        return False
    for tok in reversed(preceding[-_NEGATION_LOOKBACK:]):
        low_tok = tok.lower()
        if tok in _NEGATIONS or low_tok in _NEGATIONS:
            return True
        if tok not in _NEGATION_FILLERS and low_tok not in _NEGATION_FILLERS:
            return False
    return False


def _first_non_negated_match(text: str, keywords: dict) -> Optional[tuple]:
    """Deterministic keyword scan with a negation guard: a keyword governed
    by "לא"/"אין"/"not" — directly, or across a small closed set of
    intensifier fillers ("ממש"/"כל כך"/"really"/"that", see
    _NEGATION_FILLERS — is NOT treated as an explicit positive statement of
    that field. Still mechanical (token position plus a closed word list),
    not NLU: no opposite value is ever inferred here — the field is simply
    left unmatched, so the caller's existing missing-field handling asks a
    clarifying question instead of fabricating a value. Returns
    (matched_keyword, value) or None."""
    low = text.lower()
    for kw, val in keywords.items():
        idx = text.find(kw)
        if idx == -1:
            idx = low.find(kw.lower())
            if idx == -1:
                continue
        if _is_negated_before(text, idx):
            continue
        return kw, val
    return None


def _extract_explicit_fields(text: str, *, known_frame: Optional[str]) -> dict:
    """Category-A extraction only: domain, frame, deficit_type, context, and
    (only when the frame is already known to be "S") systemic_channel.
    `level`, `stability`, and `reference` are deliberately never scanned for
    here — see the module header."""
    found: dict = {}

    m = _first_non_negated_match(text, _DOMAIN_KEYWORDS)
    if m:
        found["domain"] = m

    m = _first_non_negated_match(text, _FRAME_KEYWORDS)
    if m:
        found["frame"] = m

    m = _first_non_negated_match(text, _DEFICIT_KEYWORDS)
    if m:
        found["deficit_type"] = m

    effective_frame = found["frame"][1] if "frame" in found else known_frame
    if effective_frame == "S":
        m = _first_non_negated_match(text, _CHANNEL_KEYWORDS)
        if m:
            found["systemic_channel"] = m

    m = _first_non_negated_match(text, _CONTEXT_KEYWORDS)
    if m:
        found["context"] = m

    return found


# ── numeric parsing (targeted-answer only — never opportunistic) ───────────

_HEBREW_NUM_WORDS = {
    "אפס": "0", "אחד": "1", "אחת": "1", "שתיים": "2", "שניים": "2",
    "שלוש": "3", "שלושה": "3", "ארבע": "4", "ארבעה": "4", "חמש": "5", "חמישה": "5",
    "שש": "6", "שישה": "6", "שבע": "7", "שבעה": "7", "שמונה": "8",
    "תשע": "9", "תשעה": "9", "עשר": "10", "עשרה": "10",
}


def _parse_number(text: str) -> Optional[float]:
    t = text
    for word, digit in _HEBREW_NUM_WORDS.items():
        t = re.sub(rf"\b{word}\b", digit, t)
    t = re.sub(r"מינוס\s*", "-", t)
    t = t.replace(",", ".")
    m = re.search(r"-?\d+(?:\.\d+)?", t)
    if not m:
        return None
    try:
        return float(m.group(0))
    except ValueError:
        return None


_INJECTION_TOKEN_RE = re.compile(r"\b\w+=\S+")


def _strip_injection_tokens(text: str) -> str:
    """Defense in depth for free-text fields: removes any `key=value`-shaped
    fragment before storage. Ordinary natural language is untouched."""
    cleaned = _INJECTION_TOKEN_RE.sub("", text)
    return re.sub(r"\s+", " ", cleaned).strip()


# ── Hebrew question / label / control-phrase text ───────────────────────────

QUESTIONS = {
    "domain": "האם זה נוגע לגוף, לרגש, או למחשבה? (גופני / רגשי / קוגניטיבי)",
    "frame": "זה קשור אליך באופן אישי, ביחסים עם מישהו, או במערכת/מוסד? (אישי / יחסים / מערכתי)",
    "systemic_channel": "באיזה ערוץ מערכתי מדובר — מוסדי, חומרי, כלכלי, מידע, סביבתי, או אחר?",
    "deficit_type": "זה נמדד ביחס לנורמה או לאנשים אחרים (יחסי), או ביחס לסף אובייקטיבי וברור (אובייקטיבי)?",
    "context": "מה ההקשר של זה? (למשל: עבודה, בית, זוגיות)",
    "reference": "ביחס למה אתה משווה את זה? (למשל: איך שאתה מרגיש בדרך כלל)",
    "level": "בסולם מ-5- (חוסר חמור) עד 5+ (עודף), כש-0 הוא נקודת האיזון הרגילה שלך — איפה זה עכשיו? אמור את המספר במילים, למשל 'זה בערך מינוס שלוש'.",
    "stability": "בסולם מ-0 (מאוד לא יציב ומשתנה) עד 10 (מאוד יציב לאורך זמן) — כמה יציב זה מרגיש? אמור את המספר במילים, למשל 'זה בערך ארבע'.",
}

_DOMAIN_LABELS = {"G": "גופני", "E": "רגשי", "C": "קוגניטיבי"}
_FRAME_LABELS = {"I": "אישי", "R": "יחסים", "S": "מערכתי"}
_DEFICIT_LABELS = {"RELATIVE": "יחסי", "OBJECTIVE": "אובייקטיבי"}
_CHANNEL_LABELS = {
    "institutional": "מוסדי", "material": "חומרי", "economic": "כלכלי",
    "informational": "מידע", "environmental": "סביבתי", "other": "אחר",
}

_CANCEL_PHRASES = ("בטל", "תבטל", "עזוב את זה", "עזוב", "תשכח מזה", "לא משנה", "cancel", "never mind", "forget it")
_CONFIRM_PHRASES = ("כן", "מאשר", "מאשרת", "נכון", "אישור", "שמור", "תשמור", "yes", "confirm", "correct")

_EXPIRED_MESSAGE = "הזמן לענות פג ולא נשמר שום דבר. אפשר להתחיל תצפית חדשה בכל רגע."
_CANCELLED_MESSAGE = "בסדר, ביטלתי — לא נשמר שום דבר."
_NO_PROFILE_MESSAGE = "אין פרופיל מזוהה לשיחה הזו, אז אי אפשר לפתוח תצפית פילוס כרגע."


def _looks_like(text: str, phrases: tuple, max_words: int = 4) -> bool:
    normalized = text.strip().strip(".!?,״\"").lower()
    if not normalized:
        return False
    if normalized in phrases:
        return True
    if len(normalized.split()) <= max_words and any(normalized.startswith(p) for p in phrases):
        return True
    return False


# ── interview state ──────────────────────────────────────────────────────

@dataclass(frozen=True)
class FieldProvenance:
    value: Any
    source: str  # "explicit_wording" | "user_answer"
    turn_id: str
    raw: str


@dataclass
class InterviewState:
    orientation_session_id: str
    session_id: str
    profile_id: str
    created_at: datetime
    expires_at: datetime
    source_turn_ids: list = field(default_factory=list)
    collected: dict = field(default_factory=dict)  # field_name -> FieldProvenance
    confirmation_state: str = "not_reached"  # not_reached | pending | confirmed
    status: str = "active"  # active | completed
    canon_event_id: Optional[str] = None
    raw_statement: str = ""
    next_field: Optional[str] = None

    def missing_fields(self) -> list:
        return _missing_fields(self)


_SESSIONS: dict = {}  # session_id -> InterviewState


def reset_interview_sessions() -> None:
    """Test seam — mirrors pipeline.reset_idempotency_store()."""
    _SESSIONS.clear()


def has_active_interview(session_id: str) -> bool:
    return session_id in _SESSIONS


def cancel_interview(session_id: str) -> None:
    """Drops any interview state for session_id with zero persistence — call
    at WebSocket disconnect (unregister_session) so a stale reconnect never
    resumes someone else's half-answered interview."""
    _SESSIONS.pop(session_id, None)


# ── field ordering ──────────────────────────────────────────────────────

def _required_field_order(state: InterviewState) -> list:
    order = ["domain", "frame"]
    frame_prov = state.collected.get("frame")
    if frame_prov is not None and frame_prov.value == "S":
        order.append("systemic_channel")
    order += ["deficit_type", "context", "reference", "level", "stability"]
    return order


def _missing_fields(state: InterviewState) -> list:
    return [f for f in _required_field_order(state) if f not in state.collected]


def _next_field(state: InterviewState) -> Optional[str]:
    missing = _missing_fields(state)
    return missing[0] if missing else None


# ── per-turn field resolution ───────────────────────────────────────────

def _apply_broad_extraction(state: InterviewState, text: str, turn_id: str) -> bool:
    frame_prov = state.collected.get("frame")
    known_frame = frame_prov.value if frame_prov is not None else None
    found = _extract_explicit_fields(text, known_frame=known_frame)
    changed = False
    for f, (raw_kw, value) in found.items():
        existing = state.collected.get(f)
        if existing is None or existing.value != value:
            state.collected[f] = FieldProvenance(value, "explicit_wording", turn_id, raw_kw)
            changed = True
    return changed


def _parse_targeted_answer(field_name: str, text: str) -> tuple:
    """Returns (value, raw, error). error is a short Hebrew clarification to
    show when the answer couldn't be parsed for this field."""
    t = text.strip()
    if field_name == "domain":
        m = _first_non_negated_match(t, _DOMAIN_KEYWORDS)
        if m:
            return m[1], m[0], None
        if t.upper() in _VALID_DOMAINS:
            return t.upper(), t, None
        return None, None, "לא זיהיתי — ענה 'גופני', 'רגשי' או 'קוגניטיבי'."
    if field_name == "frame":
        m = _first_non_negated_match(t, _FRAME_KEYWORDS)
        if m:
            return m[1], m[0], None
        if t.upper() in _VALID_FRAMES:
            return t.upper(), t, None
        return None, None, "לא זיהיתי — ענה 'אישי', 'יחסים' או 'מערכתי'."
    if field_name == "systemic_channel":
        m = _first_non_negated_match(t, _CHANNEL_KEYWORDS)
        if m:
            return m[1], m[0], None
        if t.lower() in _VALID_CHANNELS:
            return t.lower(), t, None
        return None, None, "לא זיהיתי ערוץ — מוסדי / חומרי / כלכלי / מידע / סביבתי / אחר?"
    if field_name == "deficit_type":
        m = _first_non_negated_match(t, _DEFICIT_KEYWORDS)
        if m:
            return m[1], m[0], None
        return None, None, "לא זיהיתי — 'יחסי' (לנורמה) או 'אובייקטיבי' (לסף מוגדר)?"
    if field_name == "context":
        cleaned = _strip_injection_tokens(t)
        return (cleaned, cleaned, None) if cleaned else (None, None, "אנא ספר בכמה מילים מה ההקשר.")
    if field_name == "reference":
        cleaned = _strip_injection_tokens(t)
        return (cleaned, cleaned, None) if cleaned else (None, None, "ביחס למה? אנא ספר בכמה מילים.")
    if field_name == "level":
        v = _parse_number(t)
        if v is None:
            return None, None, "לא זיהיתי מספר. " + QUESTIONS["level"]
        if not (-5.0 <= v <= 5.0):
            return None, None, "המספר צריך להיות בין 5- ל-5+."
        return v, t, None
    if field_name == "stability":
        v = _parse_number(t)
        if v is None:
            return None, None, "לא זיהיתי מספר. " + QUESTIONS["stability"]
        if not (0.0 <= v <= 10.0):
            return None, None, "המספר צריך להיות בין 0 ל-10."
        return v, t, None
    return None, None, None


# ── confirmation summary ────────────────────────────────────────────────

def _summary_text(state: InterviewState) -> str:
    c = state.collected
    parts = [
        f"תחום: {_DOMAIN_LABELS[c['domain'].value]}",
        f"מסגרת: {_FRAME_LABELS[c['frame'].value]}",
    ]
    if c["frame"].value == "S" and "systemic_channel" in c:
        parts.append(f"ערוץ מערכתי: {_CHANNEL_LABELS[c['systemic_channel'].value]}")
    parts.append(f"סוג: {_DEFICIT_LABELS[c['deficit_type'].value]}")
    parts.append(f"הקשר: {c['context'].value}")
    parts.append(f"ביחס ל: {c['reference'].value}")
    parts.append(f"רמה: {c['level'].value} (מתוך 5- עד 5+)")
    parts.append(f"יציבות: {c['stability'].value} (מתוך 0 עד 10)")
    return "סיכום — " + ", ".join(parts) + "."


def _confirmation_prompt(state: InterviewState, prefix: str = "") -> str:
    return prefix + _summary_text(state) + " לשמור ככה? (כן / תגיד מה לתקן)"


# ── ingestion (the ONLY place PHILOS_OBSERVE is ever called from here) ────

def _build_obs_inputs(state: InterviewState) -> dict:
    c = state.collected
    inputs = {
        "subject": state.profile_id,
        "domain": c["domain"].value,
        "frame": c["frame"].value,
        "level": c["level"].value,
        "stability": c["stability"].value,
        "deficit_type": c["deficit_type"].value,
        "context": c["context"].value,
        "reference": c["reference"].value,
        "confidence": _DEFAULT_CONFIDENCE,
        "expiry_days": _DEFAULT_EXPIRY_DAYS,
    }
    if c["frame"].value == "S" and "systemic_channel" in c:
        inputs["systemic_channel"] = c["systemic_channel"].value
    return inputs


async def _finalize(state: InterviewState, now: datetime) -> str:
    obs_inputs = _build_obs_inputs(state)
    action_id = f"act-observe-{deterministic_canon_event_id(obs_inputs)}"

    from app.capabilities.registry import REGISTRY

    observe_sr = await pipeline.execute(
        REGISTRY, "PHILOS_OBSERVE", obs_inputs, action_id=action_id,
        provenance_source="merlin-philos-orientation-interview",
    )
    _SESSIONS.pop(state.session_id, None)  # interview is over either way — no resumption of a finished flow

    if observe_sr.status not in ("accepted", "duplicate"):
        logger.info("PHILOS_ORIENTATION_INTERVIEW observe failed status=%s code=%s", observe_sr.status, observe_sr.code)
        return f"רישום התצפית נכשל: {observe_sr.code}."

    result = observe_sr.result or {}
    if not result.get("ingested"):
        return f"רישום התצפית נכשל: {result.get('error')}."
    canon_event_id = result["canon_event_id"]
    state.status = "completed"
    state.canon_event_id = canon_event_id

    orient_sr = await pipeline.execute(
        REGISTRY, "PHILOS_ORIENTATION",
        {"canon_event_id": canon_event_id, "as_of": now.strftime("%Y-%m-%dT%H:%M:%SZ")},
        provenance_source="merlin-philos-orientation-interview",
    )
    orient_result = orient_sr.result or {}
    if orient_sr.status != "accepted" or not orient_result.get("connected"):
        return f"נרשם (canon_event_id={canon_event_id}) אך לא ניתן היה לקבל כיוון מפילוס כרגע."

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


# ── per-turn orchestration ──────────────────────────────────────────────

async def _continue_interview(state: InterviewState, text: str, now: datetime, *, is_fresh: bool = False) -> str:
    turn_id = uuid.uuid4().hex[:10]
    state.source_turn_ids.append(turn_id)

    if state.confirmation_state == "pending":
        if _looks_like(text, _CONFIRM_PHRASES):
            state.confirmation_state = "confirmed"
        else:
            changed = _apply_broad_extraction(state, text, turn_id)
            if not changed:
                state.next_field = None
                return _confirmation_prompt(state, prefix="לא הבנתי — ")
            state.confirmation_state = "not_reached"
    elif not is_fresh:
        prior_next = _next_field(state)
        _apply_broad_extraction(state, text, turn_id)
        if prior_next is not None and prior_next not in state.collected:
            value, raw, err = _parse_targeted_answer(prior_next, text)
            if value is not None:
                state.collected[prior_next] = FieldProvenance(value, "user_answer", turn_id, raw)
            elif err:
                state.next_field = prior_next
                return err
    else:
        _apply_broad_extraction(state, text, turn_id)

    missing = _missing_fields(state)
    if missing:
        state.next_field = missing[0]
        return QUESTIONS[state.next_field]

    if state.confirmation_state != "confirmed":
        state.confirmation_state = "pending"
        state.next_field = None
        return _confirmation_prompt(state)

    return await _finalize(state, now)


def _new_state(session_id: str, profile_id: str, trigger_text: str, now: datetime) -> InterviewState:
    return InterviewState(
        orientation_session_id=f"philos_orient_{uuid.uuid4().hex[:16]}",
        session_id=session_id,
        profile_id=profile_id,
        created_at=now,
        expires_at=now + timedelta(seconds=_INTERVIEW_TTL_SECONDS),
        raw_statement=trigger_text,
    )


# ── domain isolation: does THIS turn even belong to the active interview? ──

# Mirrors app.action_intent.gate's own interrogative-word list — a small,
# deliberate local copy (same "closed vocabulary duplicated per concern"
# precedent already used throughout this codebase for _VALID_DOMAINS/
# _VALID_FRAMES/etc.), not an import, so this module stays independent of
# gate.py's internals.
_QUESTION_WORDS_HE = frozenset({"מה", "איך", "למה", "מי", "האם", "מתי", "איפה", "כמה"})
_QUESTION_MARKS = ("?", "؟")

# Fields with a closed, mechanically-checkable vocabulary — a successful
# parse is strong, specific evidence this turn IS the answer, and the
# generic question-word heuristic below is safe to apply to them. Free-text
# fields (context/reference) are deliberately excluded from both: they
# legitimately accept ANY non-empty text (see _parse_targeted_answer), so a
# successful "parse" there is not evidence of anything, and a real answer to
# e.g. the reference question ("ביחס למה?") routinely starts with an
# interrogative-looking word used as a relativizer, not a question — "איך
# שאני מרגיש בדרך כלל" ("the way I usually feel") — which the question
# heuristic must not misfire on.
_CLOSED_VOCAB_FIELDS = frozenset({"domain", "frame", "systemic_channel", "deficit_type", "level", "stability"})


def _looks_like_question(text: str) -> bool:
    stripped = text.strip()
    if any(m in stripped for m in _QUESTION_MARKS):
        return True
    tokens = [t.strip(_PUNCT_STRIP) for t in stripped.split()]
    return any(t in _QUESTION_WORDS_HE for t in tokens)


def _turn_targets_active_interview(state: InterviewState, text: str) -> bool:
    """True when `text` is plausibly meant to continue/correct/confirm the
    active interview, rather than an unrelated Human/Music/Studio/General/
    action-intent turn that must be routed normally and left untouched.

    Deliberately fails safe TOWARD the interview: a turn is only ruled
    unrelated when it independently, positively resolves to a real action
    intent, a real specific domain, or (for a closed-vocabulary pending
    field only) an explicit question — never merely because it failed to
    parse as an answer. A genuinely garbled answer attempt must still
    re-prompt inside the interview, not silently drop it; only turns with
    their OWN clear destination are let through elsewhere. Confirm/cancel
    phrases are handled by the caller before this is reached but are also
    treated as interview-targeted here for safety.
    """
    if _looks_like(text, _CONFIRM_PHRASES) or _looks_like(text, _CANCEL_PHRASES):
        return True

    next_field = None if state.confirmation_state == "pending" else _next_field(state)

    if next_field in _CLOSED_VOCAB_FIELDS:
        value, _raw, _err = _parse_targeted_answer(next_field, text)
        if value is not None:
            return True  # a real, specific answer to the current question

    from app.action_intent.gate import classify_action_intent
    if classify_action_intent(text).dispatch:
        return False

    from app.domain_router import Domain, classify as classify_domain
    domain, confidence = classify_domain(text)
    if domain != Domain.GENERAL and confidence > 0:
        return False

    if next_field is None or next_field in _CLOSED_VOCAB_FIELDS:
        if _looks_like_question(text):
            return False

    return True


async def handle_philos_orientation_turn(
    text: str, session_id: str, profile_id: Optional[str], *, now: Optional[datetime] = None,
) -> Optional[str]:
    """The ONE entry point. Returns None when this turn is neither an active
    interview's next answer nor a fresh natural-language self-report — the
    caller falls through to its normal path unchanged (ordinary
    Human/Music/Studio/General turns, and turns handled by the explicit
    "philos:" prefix gate instead)."""
    now = now or datetime.now(timezone.utc)
    state = _SESSIONS.get(session_id)

    if state is not None:
        if now > state.expires_at:
            _SESSIONS.pop(session_id, None)
            return _EXPIRED_MESSAGE
        if _looks_like(text, _CANCEL_PHRASES):
            _SESSIONS.pop(session_id, None)
            return _CANCELLED_MESSAGE
        if not _turn_targets_active_interview(state, text):
            # Unrelated Human/Music/Studio/General/action turn: leave the
            # interview's collected fields and confirmation state exactly as
            # they are (no mutation, no expiry change) and fall through so
            # the caller's normal routing handles this turn instead. The
            # interview resumes on the user's next relevant turn.
            return None
        return await _continue_interview(state, text, now)

    decision = classify_philos_orientation_intent(text)
    if not decision.is_orientation_turn:
        return None
    if not profile_id:
        return _NO_PROFILE_MESSAGE
    state = _new_state(session_id, profile_id, text, now)
    _SESSIONS[session_id] = state
    return await _continue_interview(state, text, now, is_fresh=True)
