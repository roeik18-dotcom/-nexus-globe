"""Assembles the per-turn system prompt from ordered context layers."""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Callable, Protocol

logger = logging.getLogger(__name__)

_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
_MEMORY_DIR = Path(__file__).parent.parent / "memory" / "persistent"


def _load_prompt_layer(name: str) -> str:
    path = _PROMPTS_DIR / f"{name}.md"
    return path.read_text(encoding="utf-8") if path.exists() else ""


def load_memory_dict(persona: str) -> dict:
    path = _MEMORY_DIR / f"{persona}.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


class ContextLayer(Protocol):
    def render(self) -> str: ...


class BaseIdentityLayer:
    def __init__(self, persona: str) -> None:
        self._persona = persona

    def render(self) -> str:
        return _load_prompt_layer("base")


# Persona sections that describe OTHER domains / the project portfolio. On a
# non-Philos turn these are exactly the "volunteer Philos / project status /
# About-Roei" contamination the response rule forbids, so they are stripped —
# the behavioral persona (## Persona / ## Responsibilities) always stays.
_PERSONA_DROP_SECTIONS = ("About Roei", "Projects", "About Essence")


def _strip_persona_narrative(md: str) -> str:
    out, skip = [], False
    for ln in md.split("\n"):
        if ln.startswith("## "):
            skip = ln[3:].strip() in _PERSONA_DROP_SECTIONS
        if not skip:
            out.append(ln)
    return "\n".join(out).strip()


class PersonaLayer:
    def __init__(self, persona: str, keep_project_narrative: bool = True) -> None:
        self._persona = persona
        self._keep_project_narrative = keep_project_narrative

    def render(self) -> str:
        md = _load_prompt_layer(self._persona)
        if not self._keep_project_narrative:
            md = _strip_persona_narrative(md)
        return md


class PersistentMemoryLayer:
    """Renders pre-selected recall items into the system prompt.

    When recall_result is None (no turn context), falls back to rendering
    the full memory file so that callers like build_system_prompt() still work.
    """

    def __init__(self, persona: str = "", *, recall_result=None, critical_only: bool = False) -> None:
        self._recall_result = recall_result
        self._persona = persona
        self._critical_only = critical_only

    def render(self) -> str:
        if self._recall_result is not None:
            items = self._recall_result.items
        else:
            from app.recall import RecallItem
            memory = load_memory_dict(self._persona)
            items = [RecallItem(key=k, value=v, reason="all") for k, v in memory.items()]

        if self._critical_only:
            # Low-confidence GENERAL turn: keep ONLY critical items. No recall/
            # persistent item carries an importance marker today, so this is zero
            # — a future importance-tagged item would survive unchanged.
            def _crit(it):
                imp = getattr(it, "importance", None)
                if imp is None and isinstance(it, dict):
                    imp = it.get("importance")
                return imp == "critical"
            items = [it for it in items if _crit(it)]
            if not items:
                logger.info("MEMORY_SUPPRESSED_LOW_CONFIDENCE_GENERAL layer=persistent")
                return ""

        if not items:
            return ""
        selected = {item.key: item.value for item in items}
        return f"## Persistent memory\n\n```json\n{json.dumps(selected, ensure_ascii=False, indent=2)}\n```"


def _local_now() -> datetime:
    """Current local time from the Mac system clock, timezone-aware.

    `.astimezone()` with no argument attaches whatever zone the OS is configured
    for, so this follows the machine instead of pinning a region.  Naive
    `datetime.now()` would render an ISO string with no offset, which is exactly
    the ambiguity this layer exists to remove.
    """
    return datetime.now().astimezone()


class CurrentTimeLayer:
    """Puts the wall clock in the system prompt.

    Merlin has no clock and no tool-calling: `app/adapters/claude.py` passes no
    `tools=`, and the MOS `read_clock` (mos/tools.py) is reachable only through the
    MERLIN_MOS_BRIDGE path, which is off.  Asked "מה השעה", the model therefore
    invented one — it answered 05:49 at 19:24 local on 2026-08-01, in a tone
    indistinguishable from a real reading.

    This is context injection, NOT tool-calling: the time is stamped once per turn
    and is correct only as of prompt assembly.  It is deliberately isolated behind
    `clock` so a real clock tool can replace it by swapping this one dependency,
    with no other caller affected.
    """

    def __init__(self, clock: Callable[[], datetime] = _local_now) -> None:
        self._clock = clock

    def render(self) -> str:
        now = self._clock()
        raw = now.strftime("%z")                       # e.g. "+0300"
        offset = f"{raw[:3]}:{raw[3:]}" if raw else "?"
        hhmm = now.strftime("%H:%M")
        h12 = now.hour % 12 or 12                       # portable 12-hour form
        spoken = f"{h12}:{now.strftime('%M')} {'AM' if now.hour < 12 else 'PM'}"
        # Lead with the ANSWER in one unambiguous value. The prior 3-line block
        # (ISO / Timezone / Local) let the model pick the wrong field or recompute
        # and state a wrong time; giving the spoken HH:MM first + a verbatim rule
        # removes that failure mode without adding tool-calling.
        return (
            "## Current time (authoritative — do not recompute)\n"
            f"The current time is exactly {hhmm} ({spoken}) on "
            f"{now.strftime('%A, %d %B %Y')}. "
            f"Timezone {now.tzname() or 'local'} (UTC{offset}); "
            f"ISO {now.isoformat(timespec='seconds')}.\n"
            f"When the user asks the time or date, answer with exactly this value — "
            f"say {hhmm} — and never add, subtract, round, reformat, or invent any "
            "other time. This is the real machine clock at the start of this turn."
        )


class SessionSummaryLayer:
    def __init__(self, summary) -> None:
        self._summary = summary

    def render(self) -> str:
        if not self._summary or not self._summary.text:
            return ""
        return f"## Session Summary\n\n{self._summary.text}"


class CurrentTaskLayer:
    def __init__(self, task) -> None:
        self._task = task

    def render(self) -> str:
        if self._task is None:
            return ""
        block = f"## Current Task\n\nTitle: {self._task.title}\nStatus: {self._task.status}"
        if self._task.description:
            block += f"\nContext: {self._task.description}"
        return block


class ToolMemoryLayer:
    def __init__(self, entries: list) -> None:
        self._entries = entries

    def render(self) -> str:
        from app.tool_memory import format_block
        return format_block(self._entries)


class ControlPolicyLayer:
    """Renders Merlin Control Center policy into the system prompt.

    Sourced from config/merlin_control.json (via config/merlin_control_schema.py),
    NOT from prompts/merlin.md — this layer is additive and leaves the persona file
    untouched. Read fresh on every render() call (load_with_fallback has no cache),
    matching every other layer in this file, so a saved config change is visible on
    the very next turn without a restart.
    """

    def render(self) -> str:
        from config.merlin_control_schema import load_with_fallback

        cfg, _source = load_with_fallback()
        lines = ["## Control Policy (Merlin Control Center — live config)"]

        allowed = cfg.language.allowed_output_languages
        if allowed == ["he"]:
            lines.append(
                "- Respond in Hebrew only. Do not switch to English because of a "
                "loanword, a stray English phrase in the transcript, or a technical "
                "term — only an explicit, direct request from the user to switch "
                "languages may change this. Technical terms, filenames, API/command "
                "names, and code may remain in English inside an otherwise-Hebrew reply."
            )
        elif allowed == ["en"]:
            lines.append("- Respond in English only, regardless of transcript language.")
        else:
            lines.append(
                f"- Respond in the user's language, limited to: {', '.join(allowed)}."
            )

        length = cfg.conversation.default_length
        length_line = {
            "short": "Keep responses short by default.",
            "normal": "Use a normal, moderate response length by default.",
            "deep": "Responses may be longer/more thorough by default.",
        }.get(length, "Keep responses short by default.")
        lines.append(f"- {length_line}")

        if cfg.conversation.answer_first:
            lines.append("- Answer the question first; explain only if needed after.")
        if cfg.conversation.avoid_repetition:
            lines.append("- Do not repeat back what the user just said.")
        if cfg.conversation.avoid_stock_phrases:
            lines.append('- No stock phrasing ("certainly", "I\'d be happy to", "בהחלט", "בשמחה", "כמובן").')
        if not cfg.conversation.offer_unrequested_followups:
            lines.append("- Do not offer follow-up actions that were not requested.")
        if cfg.conversation.ask_followup_only_when_blocked:
            lines.append("- Ask a follow-up question only when you are genuinely blocked without one.")
        if cfg.persona.direct_corrections and not cfg.persona.automatic_agreement:
            lines.append("- Do not auto-agree; correct the user directly when they are wrong.")

        return "\n".join(lines)


class EssenceContextLayer:
    """Renders a pre-fetched Essence context block into the system prompt."""

    def __init__(self, block: str) -> None:
        self._block = block

    def render(self) -> str:
        return self._block  # Already formatted with provenance by essence_context.py


_RELATIONSHIP_MEMORY_FILE = Path(__file__).parent.parent / "memory" / "relationship" / "memories.json"
_IMPORTANCE_RANK = {"critical": 0, "high": 1, "medium": 2, "low": 3}


class RelationshipMemoryLayer:
    """Injects relationship memories into the system prompt.

    Self-loading: reads memory/relationship/memories.json on every render so
    memories written by the background extractor appear in the next turn
    without any change to the ContextBuilder interface.
    """

    _MAX_ITEMS = 20
    _PHILOS_RE = __import__("re").compile(r"philos|פילוס|nexus|globe|גלוב", __import__("re").I)

    # Per-domain relevance cues (Hebrew + English) — used to decide whether a
    # project/domain-operational memory belongs in a SPECIFIC domain turn.
    _DOMAIN_KEYWORDS = {
        "studio_project": ("studio", "אולפן", "rme", "ableton", "routing", "monitor", "voloco",
                            "mix", "master", "plugin", "mic", "totalmix", "babyface"),
        "music_config": ("music", "מוזיק", "song", "שיר", "genre", "ז'אנר", "vocal", "arrangement",
                         "mix", "master", "lyric", "melody", "harmony", "psytrance"),
        "human_config": ("human", "אדם", "identity", "personal", "value", "ערך", "behavior", "goal"),
        "philos": ("philos", "פילוס", "nexus", "globe", "גלוב", "orientation"),
        "runtime": ("merlin", "runtime", "transcription", "transcribe", "תמלול", "audio", "wake",
                    "clap", "barge", "stt", "tts", "voice", "mic", "service"),
        "merlin_dev": ("merlin", "runtime", "transcription", "audio", "wake", "barge", "stt",
                       "tts", "control", "panel"),
        "day_opening": ("day_opening", "morning", "פתיח", "orientation"),
    }

    def __init__(self, selected_domain: str | None = None, query: str = "",
                 confidence: float = 1.0) -> None:
        # selected_domain is the router domain for THIS turn (e.g. 'studio_project',
        # 'human_config', 'philos', 'general'). None => no gating (non-merlin personas,
        # or a merlin turn with no query) => fully backward-compatible.
        self._selected_domain = selected_domain
        self._query = query or ""
        self._confidence = float(confidence) if confidence is not None else 1.0

    @classmethod
    def _is_philos_memory(cls, m: dict) -> bool:
        blob = " ".join(str(m.get(k, "")) for k in ("key", "value", "tier", "category"))
        blob += " " + " ".join(m.get("tags", []) or [])
        return bool(cls._PHILOS_RE.search(blob))

    @classmethod
    def _relevant_to_domain(cls, sd: str, m: dict) -> bool:
        kws = cls._DOMAIN_KEYWORDS.get(sd, ())
        if not kws:
            return False
        blob = (" ".join(str(m.get(k, "")) for k in ("key", "value", "category")) + " "
                + " ".join(m.get("tags", []) or [])).lower()
        return any(k.lower() in blob for k in kws)

    @classmethod
    def _admit(cls, m: dict, sd: str, is_general: bool, query_philos: bool) -> bool:
        # Philos/Nexus memory: only in a philos turn (or an explicitly-philos query).
        if cls._is_philos_memory(m):
            return sd == "philos" or query_philos
        # personal + relationship are the general-safe base — always admitted.
        # NOT "unrelated domain memory": by this layer's own tier taxonomy,
        # domain/project memory is the "project / domain-operational" tier
        # below, which general/low-confidence turns already get ZERO of. A
        # general-routed turn already cannot carry MASTER-domain or
        # project-operational content — verified live, 2026-08-09:
        # DOMAIN_ISOLATION_VIOLATION has never fired, and explicit
        # music/human/philos queries route with confidence=1.0 to their own
        # domain only. Keeping personal/relationship here (matches
        # tests/test_memory_gate_widened.py's explicit contract) so Merlin
        # still knows who it's talking to in plain conversation.
        tier = (m.get("tier") or "").lower()
        if tier in ("personal", "relationship"):
            return True
        # project / domain-operational / other: only in a SPECIFIC domain turn and only
        # when relevant to that domain. General / low-confidence => excluded entirely.
        if is_general:
            return False
        return cls._relevant_to_domain(sd, m)

    def render(self) -> str:
        # Low-confidence GENERAL turn: inject ZERO relationship memory. An
        # ambiguous/unrelated question does not need 20 personal facts, and this
        # is exactly the unconditional injection the audit flagged. Specialist
        # domains and confident routes are unaffected.
        if self._selected_domain == "general" and self._confidence < 0.5:
            logger.info("MEMORY_SUPPRESSED_LOW_CONFIDENCE_GENERAL layer=relationship confidence=%.2f",
                        self._confidence)
            return ""
        if not _RELATIONSHIP_MEMORY_FILE.exists():
            return ""
        try:
            data    = json.loads(_RELATIONSHIP_MEMORY_FILE.read_text(encoding="utf-8"))
            raw     = data.get("memories", [])
        except Exception:
            return ""

        if not raw:
            return ""

        # ---- domain gate (Fix #1) ----
        # general / low-confidence turns get ONLY personal + relationship memory;
        # project/domain-operational memory enters a SPECIFIC domain turn only when
        # relevant to it; philos/nexus only in a philos turn. selected_domain=None =>
        # no gating (non-merlin persona / no query) => fully backward-compatible.
        sd = self._selected_domain
        rejected = 0
        if sd is not None:
            is_general = (sd == "general") or (self._confidence < 0.5)
            query_philos = bool(self._PHILOS_RE.search(self._query))
            kept = [m for m in raw if self._admit(m, sd, is_general, query_philos)]
            rejected = len(raw) - len(kept)
            raw = kept
            logger.info("MEMORY_GATE selected_domain=%s confidence=%.2f MEMORY_REJECTED_DOMAIN count=%d",
                        sd, self._confidence, rejected)
        if not raw:
            if sd is not None:
                logger.info("MEMORY_INCLUDED count=0")
            return ""

        ranked = sorted(raw, key=lambda m: (
            _IMPORTANCE_RANK.get(m.get("importance", "medium"), 2),
            m.get("last_used", ""),
        ), reverse=False)

        # Always include critical/high; pad with medium if space allows
        top = [m for m in ranked if m.get("importance") in ("critical", "high")]
        if len(top) < self._MAX_ITEMS:
            medium = [m for m in ranked if m.get("importance") == "medium"]
            top += medium[: self._MAX_ITEMS - len(top)]
        top = top[: self._MAX_ITEMS]
        if self._selected_domain is not None:
            logger.info("MEMORY_INCLUDED count=%d", len(top))

        # Group by tier/category for readability
        groups: dict[str, list[str]] = {}
        for m in top:
            label = f"{m.get('tier','personal')}/{m.get('category','fact')}"
            groups.setdefault(label, []).append(
                f"  - {m['key']}: {m['value']}"
            )

        lines = ["## What I know about you (relationship memory)\n"]
        for label, items in groups.items():
            lines.append(f"**{label}**")
            lines.extend(items)
            lines.append("")

        return "\n".join(lines).strip()


class DomainRoutedLayer:
    """Injects ONLY the retrieved context for the classified domain of the
    current turn (production repair section 5, 2026-08-08) — renders empty
    for Domain.GENERAL, which is the correct behavior (no config dump for
    plain conversation), not a missing feature."""

    def __init__(self, route_result) -> None:
        self._result = route_result

    def render(self) -> str:
        if self._result is None:
            return ""
        return (self._result.context_text or "").strip()


import re as _re

# Narrative layers that can carry cross-domain (persona bio / Philos project /
# recalled) material. Identity/policy/time layers are excluded from the leak
# scan on purpose: base.md legitimately names "Nexus-Globe architecture" as the
# system's own identity, which is not a Philos-project leak. PersonaLayer
# (prompts/merlin.md) is excluded for the same reason: it permanently names
# "Philos" as one of Merlin's three efforts and even contains the literal
# phrase "orientation over ideology" (the domain-isolation instruction
# itself) — every turn's PersonaLayer matched _PHILOS_MARK before this fix,
# so its full length was misattributed as a Philos leak on EVERY turn,
# general included (root cause of PHILOS_CONTEXT_CHARS == PERSONA_CONTEXT_CHARS
# on plain chitchat, 2026-08-09). A real leak is content that varies by turn
# (recalled memory, session summary, essence context) — not the fixed persona
# bio, which mentioning Philos by name is not the same as injecting Philos
# project/master content.
_NARRATIVE_LAYERS = {
    "PersistentMemoryLayer", "SessionSummaryLayer",
    "EssenceContextLayer", "RelationshipMemoryLayer",
}
_PHILOS_MARK = _re.compile(r"philos|פילוס|value hub|orientation over ideology|social-orientation|כור ההיתוך|positive melting pot", _re.I)

# Domains that own a private master and must answer ONLY from it — Philos
# project progress, the persona bio, and the OTHER master are physically
# removed from their prompt (not merely deprioritized). The music variants all
# collapse to the same isolation bucket.
_MUSIC_DOMAINS = {"music_config", "music_production", "music_course"}


def _domain_bucket(sel_domain: str | None) -> str:
    dv = sel_domain or "general"
    if dv in _MUSIC_DOMAINS:
        return "music_config"
    if dv == "human_config":
        return "human_config"
    if dv == "philos":
        return "philos"
    return "general"


class ContextBuilder:
    def __init__(self, layers: list, route_result=None, bucket: str = "general",
                 query: str = "") -> None:
        self._layers = layers
        self.route_result = route_result
        self._bucket = bucket
        self._query = query

    def build(self) -> str:
        rendered: list[tuple[str, str]] = []
        for layer in self._layers:
            try:
                text = (layer.render() or "").strip()
            except Exception:
                text = ""
            rendered.append((type(layer).__name__, text))

        # Block, not just log: any narrative section that trips the leak scan
        # is physically removed before the prompt is assembled, so a real
        # future violation cannot reach the LLM merely because it was detected.
        leak_sections = self._emit_domain_audit(rendered)
        if leak_sections:
            rendered = [(n, t) for n, t in rendered if n not in leak_sections]

        # RUNTIME CLOCK (2026-08-17 live gap): "מה השעה?" was unanswerable —
        # no layer carried the current time. One line, computed per turn.
        import datetime as _dt
        _now = _dt.datetime.now().astimezone()
        _days = ["שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת", "ראשון"]
        _clock = (f"זמן נוכחי: יום {_days[_now.weekday()]}, {_now.strftime('%d.%m.%Y')}, "
                  f"השעה {_now.strftime('%H:%M')} ({_now.tzname()}). ענה על שאלות שעה/תאריך מכאן.")
        result = "\n\n---\n\n".join([_clock] + [t for _n, t in rendered if t])

        # Proof point (retained): the SAME context_text the router retrieved is
        # present verbatim in the string that becomes the `system=` argument.
        rr = self.route_result
        if rr is not None and getattr(getattr(rr, "domain", None), "value", None) != "general":
            ctx = (rr.context_text or "").strip()
            propagated = bool(ctx) and ctx in result
            logger.info(
                "CONTEXT_PROPAGATION domain=%s route_context_chars=%d propagated=%s system_prompt_chars=%d",
                rr.domain.value, len(ctx), propagated, len(result),
            )

        return result

    def _emit_domain_audit(self, rendered: list[tuple[str, str]]) -> set[str]:
        """Logs FINAL_PROMPT_AUDIT and, on a real cross-domain violation,
        DOMAIN_ISOLATION_VIOLATION. Returns the set of section names to strip
        from the prompt (empty on the normal, clean path) — the caller
        removes them BEFORE assembling `result`, so detection also blocks,
        it does not merely log after the fact."""
        from app.trace_context import get_trace_id
        bucket = self._bucket or "general"
        persona_chars = sum(len(t) for n, t in rendered if n == "PersonaLayer")
        memory_chars = sum(len(t) for n, t in rendered
                           if n in ("PersistentMemoryLayer", "RelationshipMemoryLayer"))
        orient_chars = sum(len(t) for n, t in rendered if n == "OrientationLayer")
        music_chars = orient_chars if bucket == "music_config" else 0
        human_chars = orient_chars if bucket == "human_config" else 0
        philos_chars = orient_chars if bucket == "philos" else 0

        # Scan narrative sections for Philos-project material leaking into a
        # non-Philos turn. On an isolated turn these layers are absent, so this
        # is 0; if a future change reintroduces one, it surfaces here.
        leak_sections: list[str] = []
        if bucket != "philos":
            for n, t in rendered:
                if n in _NARRATIVE_LAYERS and t and _PHILOS_MARK.search(t):
                    philos_chars += len(t)
                    leak_sections.append(n)

        rr = self.route_result
        unit_ids = list(getattr(rr, "retrieved_unit_ids", []) or [])[:8]
        section_names = [n for n, t in rendered if t]
        # STEP-4 master proof: the exact absolute source path whose retrieved text
        # is present, verbatim, in the assembled prompt (LOADED sources only).
        master_path = ""
        for s in (getattr(rr, "sources", []) or []):
            if getattr(s, "status", "") == "LOADED" and getattr(s, "path", ""):
                master_path = s.path
                break
        tid = get_trace_id()
        logger.info(
            "FINAL_PROMPT_AUDIT trace_id=%s current_domain=%s user_text=%r sections=%s "
            "MUSIC_CONTEXT_CHARS=%d HUMAN_CONTEXT_CHARS=%d PHILOS_CONTEXT_CHARS=%d "
            "PERSONA_CONTEXT_CHARS=%d MEMORY_CONTEXT_CHARS=%d MASTER_ABSOLUTE_PATH=%r retrieved_unit_ids=%s",
            tid, bucket, (self._query or "")[:80], section_names,
            music_chars, human_chars, philos_chars, persona_chars, memory_chars, master_path, unit_ids,
        )

        # NOTE: after the context reset, PERSONA is ALWAYS the stripped, neutral
        # behavioral persona (no About-Roei / Projects / Philos bio) — allowed
        # system instructions, NOT contamination. So persona chars are reported
        # for visibility but are NOT a violation; only foreign-DOMAIN material is.
        violations: list[str] = []
        if bucket == "music_config":
            if human_chars:   violations.append(f"HUMAN_CONTEXT_CHARS={human_chars}")
            if philos_chars:  violations.append(f"PHILOS_CONTEXT_CHARS={philos_chars} sections={leak_sections}")
        elif bucket == "human_config":
            if music_chars:   violations.append(f"MUSIC_CONTEXT_CHARS={music_chars}")
            if philos_chars:  violations.append(f"PHILOS_CONTEXT_CHARS={philos_chars} sections={leak_sections}")
        elif bucket == "philos":
            # Philos is itself an OrientationLayer domain like music/human, so
            # persona bio and (deliberately) recalled philos-tagged memory are
            # expected here — only the OTHER two masters are a real leak.
            if music_chars: violations.append(f"MUSIC_CONTEXT_CHARS={music_chars}")
            if human_chars: violations.append(f"HUMAN_CONTEXT_CHARS={human_chars}")
        if violations:
            logger.error(
                "DOMAIN_ISOLATION_VIOLATION trace_id=%s current_domain=%s %s",
                tid, bucket, "; ".join(violations),
            )
            return set(leak_sections)
        return set()

    def layer_diagnostics(self) -> list[tuple[str, int]]:
        """Per-layer (class name, rendered char count) — for debug/observability.

        Reflects the REAL layer list so no context source becomes a blind spot
        (e.g. RelationshipMemoryLayer is visible alongside the recall path)."""
        out: list[tuple[str, int]] = []
        for layer in self._layers:
            try:
                out.append((type(layer).__name__, len((layer.render() or "").strip())))
            except Exception:
                out.append((type(layer).__name__, -1))
        return out

    @classmethod
    def for_session(
        cls,
        persona: str,
        task=None,
        summary=None,
        tool_memory=None,
        recall_result=None,
        essence_context: str = "",
        clock: Callable[[], datetime] | None = None,
        query: str = "",
    ) -> "ContextBuilder":
        # Route ONCE per merlin turn: the same RouteResult feeds both the memory
        # domain-gate and the OrientationLayer (no double routing).
        _rr = None
        if persona == "merlin" and query:
            from app.domain_router import route as _route_query
            _rr = _route_query(query)
        _sel_domain = getattr(getattr(_rr, "domain", None), "value", None) if _rr is not None else None
        _sel_conf = getattr(_rr, "confidence", 1.0) if _rr is not None else 1.0
        _bucket = _domain_bucket(_sel_domain)
        # A specialist domain that owns a master answers ONLY from that master.
        # Physically EXCLUDE the persona bio (prompts/merlin.md — carries the
        # "About Roei" block AND a Philos project description), recalled/session
        # memory, task, tool memory and Essence, so none of them can be blended
        # in instead of the retrieved master. Not a deprioritization — removal.
        if persona == "merlin":
            # ── HARD CONTEXT RESET (voice controller) ────────────────────────
            # A normal runtime turn carries ONLY: neutral system instructions +
            # the current utterance's selected domain source. NOTHING is auto-
            # injected — no relationship/persistent memory, session summary, task,
            # tool memory, Essence, Day-Opening state, or persona project/Philos
            # bio. Memory is pull-based, never pushed into every turn. The current
            # utterance (via _rr) selects exactly one domain source; history is
            # scoped separately in the adapter. This single path replaces all the
            # per-domain special cases.
            from orientation.orientation_layer import OrientationLayer as _OrientationLayer
            layers = [
                BaseIdentityLayer(persona),                           # neutral identity
                ControlPolicyLayer(),                                 # neutral output policy
                CurrentTimeLayer(clock) if clock else CurrentTimeLayer(),
                PersonaLayer(persona, keep_project_narrative=False),  # behavioral rules only
            ]
            if query:
                layers.append(_OrientationLayer.from_route(_rr))      # the ONE selected domain source
            return cls(layers, route_result=_rr, bucket=_bucket, query=query)

        # ── Non-merlin personas (jarvis / philos): unchanged legacy behavior ──
        layers: list = [
            BaseIdentityLayer(persona),
            PersonaLayer(persona),
            CurrentTimeLayer(clock) if clock else CurrentTimeLayer(),
            PersistentMemoryLayer(recall_result=recall_result, persona=persona),
            RelationshipMemoryLayer(selected_domain=_sel_domain, query=query, confidence=_sel_conf),
            SessionSummaryLayer(summary),
            CurrentTaskLayer(task),
            ToolMemoryLayer(tool_memory or []),
        ]
        if essence_context:
            layers.append(EssenceContextLayer(essence_context))
        return cls(layers, route_result=_rr, bucket=_bucket, query=query)
