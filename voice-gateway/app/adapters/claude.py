"""Claude adapter — temporary backend for Phase 1 Voice MVP."""

import asyncio
import logging
import time
from collections import Counter, defaultdict
from typing import TYPE_CHECKING, AsyncIterator

import anthropic

from app import turn_context
from app.adapters.base import VoiceAdapter
from app.config import build_system_prompt_with_task, settings
from app.context_builder import load_memory_dict
from app.control_events import append_event, new_turn_id
from app.delegation.bus import DelegationRequest, DelegationResult
from app.delegation.rules import should_delegate
from app.language_gate import HEBREW_FALLBACK_MESSAGE, RETRY_CORRECTION_SUFFIX, looks_non_target_language
from app.recall import default_recall_policy
from app.summary import (
    SUMMARIZE_PROMPT,
    SummaryState,
    should_summarize,
    summarize_range,
    summary_latency_registry,
    summary_registry,
)
from app.task import task_registry
from app.tool_memory import tool_memory_registry
from app.trace import SystemSnapshot, TraceStep
from app.trace_context import get_route_domain, set_route_domain

# Specialist domains that own a private master. Cross-specialist history must NOT
# survive between them (music_config != human_config != philos). general is NOT
# here on purpose: its continuity is suppressed initially (see _scope_history).
_SPECIALIST_DOMAINS = ("music_config", "human_config", "philos")


def _scope_history_by_domain(messages: list[dict], current_domain: str) -> tuple[list[dict], int]:
    """Domain-scope the outgoing message array.

    The current turn's own messages are always kept. Prior turns survive ONLY
    when they share the current turn's SPECIALIST domain — so a music answer can
    never enter a philos/human request, and vice-versa. Different specialist
    domains and (initially) general continuity are dropped. Returns
    (scoped_messages, dropped_count). Untagged legacy entries have no domain and
    are therefore dropped by the same rule, which is the safe default.
    """
    if not messages:
        return messages, 0
    current, prior = messages[-1], messages[:-1]
    specialist = current_domain in _SPECIALIST_DOMAINS
    kept = [m for m in prior if specialist and m.get("domain") == current_domain]
    return kept + [current], len(prior) - len(kept)

if TYPE_CHECKING:
    from app.delegation.bus import DelegationBus

logger = logging.getLogger(__name__)


def _format_delegation_block(result: DelegationResult) -> str:
    """Render a DelegationResult as a system-prompt context block."""
    lines = [f"## Delegated Analysis — {result.agent}"]
    if result.summary:
        lines.append(f"Summary: {result.summary}")
    if result.findings:
        lines.append("Findings:")
        lines.extend(f"  • {f}" for f in result.findings)
    if result.content and not result.summary and not result.findings:
        lines.append(result.content)
    if result.confidence < 1.0:
        lines.append(f"Confidence: {result.confidence:.0%}")
    lines.append(
        "(Internal context — synthesize naturally, do not quote directly)"
    )
    return "\n".join(lines)


class ClaudeAdapter(VoiceAdapter):
    def __init__(
        self,
        persona: str | None = None,
        bus: "DelegationBus | None" = None,
    ) -> None:
        self._client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        self._persona = persona if persona is not None else settings.persona
        self._bus = bus
        # session_id → list of {"role": ..., "content": ...}
        self._history: dict[str, list[dict]] = defaultdict(list)
        # per-session asyncio.Lock to prevent concurrent summaries
        self._summary_locks: dict[str, asyncio.Lock] = {}
        # per-session Essence context block; written via _set_session_essence only
        self._essence_extra: dict[str, str] = {}

    def _set_session_essence(self, session_id: str, block: str) -> None:
        """Set or clear the Essence context block for a session."""
        if block:
            self._essence_extra[session_id] = block
        else:
            self._essence_extra.pop(session_id, None)

    def _clear_session_essence(self, session_id: str) -> None:
        """Remove the Essence context block for a session."""
        self._essence_extra.pop(session_id, None)

    @property
    def name(self) -> str:
        return f"claude:{self._persona}"

    async def _bg_summarize(self, session_id: str, history_len: int) -> None:
        """Compress message history in the background without blocking LLM token generation."""
        if session_id not in self._summary_locks:
            self._summary_locks[session_id] = asyncio.Lock()
        lock = self._summary_locks[session_id]

        if lock.locked():
            logger.debug("summary[%s] skipped — previous summary still in progress", session_id)
            return

        async with lock:
            state = summary_registry.get(session_id)
            summarized_until = state.summarized_until if state else 0

            if not should_summarize(history_len, summarized_until):
                return

            history = self._history.get(session_id, [])
            if len(history) < history_len:
                return  # session reset between scheduling and execution

            start, end = summarize_range(history_len, summarized_until)
            to_summarize = history[start:end]

            t0 = time.perf_counter()
            lines = "\n".join(
                f"{'User' if m['role'] == 'user' else 'Assistant'}: {m['content']}"
                for m in to_summarize
            )
            prior = f"Prior summary:\n{state.text}\n\n" if state and state.text else ""
            prompt = f"{prior}Conversation:\n{lines}"

            parts: list[str] = []
            try:
                async with self._client.messages.stream(
                    model=settings.claude_model,
                    max_tokens=512,
                    system=SUMMARIZE_PROMPT,
                    messages=[{"role": "user", "content": prompt}],
                ) as stream:
                    async for chunk in stream.text_stream:
                        parts.append(chunk)
            except Exception as exc:
                logger.error("summary[%s] background error: %s", session_id, exc)
                return

            new_state = SummaryState(
                text="".join(parts),
                version=(state.version + 1 if state else 1),
                summarized_until=end,
            )
            summary_registry.set(session_id, new_state)
            elapsed_ms = round((time.perf_counter() - t0) * 1000)
            summary_latency_registry.set(session_id, elapsed_ms)
            logger.info(
                "summary[%s] v%d covers 0..%d (%d messages) latency=%dms",
                session_id, new_state.version, end, end - start, elapsed_ms,
            )

    async def respond(self, text: str, session_id: str) -> AsyncIterator[str]:
        history = self._history[session_id]
        history.append({"role": "user", "content": text})
        set_route_domain("")   # cleared per turn; route() (via build) sets the real value
        _history_len_before = len(history) - 1
        _pre_summary_state = summary_registry.get(session_id)
        # Summary runs as a background task AFTER this turn to avoid blocking LLM start.

        # Delegation: call sub-agent before building the API prompt
        delegation_result = None
        if self._bus is not None:
            target = should_delegate(text)
            if target:
                t_deleg = time.perf_counter()
                turn_context.emit(TraceStep(
                    from_node="claude", to_node=target,
                    type="delegation.start",
                    description=target,
                ))
                req = DelegationRequest(
                    target=target,
                    purpose="deep_analysis",
                    prompt=text,
                    context={"parent_session": session_id},
                )
                try:
                    delegation_result = await self._bus.call(req)
                    turn_context.emit(TraceStep(
                        from_node=target, to_node="claude",
                        type="delegation.complete" if not delegation_result.error else "delegation.error",
                        latency_ms=round((time.perf_counter() - t_deleg) * 1000),
                        payload_size=len(delegation_result.content),
                        confidence=delegation_result.confidence,
                    ))
                except Exception as exc:
                    turn_context.emit(TraceStep(
                        from_node=target, to_node="claude",
                        type="delegation.error",
                        latency_ms=round((time.perf_counter() - t_deleg) * 1000),
                        description=str(exc),
                    ))
                    raise
                logger.info(
                    "delegation[%s] → %s  chars=%d  error=%s",
                    session_id, target,
                    len(delegation_result.content),
                    delegation_result.error,
                )

        summary_state = summary_registry.get(session_id)
        task = task_registry.get(session_id)
        tool_mem = tool_memory_registry.get(session_id)
        memory = load_memory_dict(self._persona)

        t_recall = time.perf_counter()
        turn_context.emit(TraceStep(
            from_node="claude", to_node="recall",
            type="recall.start",
        ))
        recall_result = default_recall_policy.select(memory, self._persona, task, text)
        t_recall_end = time.perf_counter()

        turn_context.emit(TraceStep(
            from_node="recall", to_node="claude",
            type="recall.selected",
            latency_ms=round((t_recall_end - t_recall) * 1000),
            payload_size=len(recall_result.items),
        ))
        if recall_result.truncated:
            turn_context.emit(TraceStep(
                from_node="recall", to_node="claude",
                type="recall.truncated",
                payload_size=recall_result.total_candidates - len(recall_result.items),
            ))
        turn_context.emit(TraceStep(
            from_node="recall", to_node="claude",
            type="recall.complete",
            payload_size=len(recall_result.items),
        ))

        reason_counts = Counter(item.reason for item in recall_result.items)
        logger.info(
            "recall persona=%s selected=%d candidates=%d truncated=%s | reasons %s",
            self._persona,
            len(recall_result.items),
            recall_result.total_candidates,
            recall_result.truncated,
            " ".join(f"{r}={c}" for r, c in sorted(reason_counts.items())),
        )

        # Set SystemSnapshot now that we have all the info for this turn
        _trace = turn_context.get_trace()
        if _trace is not None and _trace.snapshot is None:
            _trace.snapshot = SystemSnapshot(
                active_persona=self._persona,
                recall_items=len(recall_result.items),
                summary_version=_pre_summary_state.version if _pre_summary_state else 0,
                memory_items=len(memory),
                history_len=_history_len_before,
                delegation_active=self._bus is not None,
            )

        system_prompt = build_system_prompt_with_task(
            self._persona, task, summary_state, tool_mem, recall_result=recall_result,
            essence_context=self._essence_extra.get(session_id, ""),
            query=text,
        )

        # ── Merlin Control Center — output-language gate ──────────────────────
        # Merlin-only (jarvis/philos untouched). Inactive → behavior below is
        # byte-identical to before this feature existed (same streaming loop,
        # same yields). Active only when the live config restricts output to
        # Hebrew only — see config/merlin_control_schema.py / docs/MERLIN_CONTROL_SPEC.md.
        _turn_id = new_turn_id()
        _gate_allowed: list[str] = ["he", "en"]
        _config_version: int | None = None
        if self._persona == "merlin":
            from config.merlin_control_schema import load_with_fallback
            _control_cfg, _ = load_with_fallback()
            _gate_allowed = _control_cfg.language.allowed_output_languages
            _config_version = _control_cfg.version
        _gate_active = self._persona == "merlin" and _gate_allowed == ["he"]

        # Inject delegation result as a dedicated block in the system prompt.
        # Keeping it in the system layer (not the user message) signals to Claude
        # that this is internal context, not part of the user's utterance.
        if delegation_result and not delegation_result.error and delegation_result.content:
            system_prompt = system_prompt + "\n\n" + _format_delegation_block(delegation_result)

        # Pass only recent messages; summary covers the rest.
        summarized_until = summary_state.summarized_until if summary_state else 0
        recent_messages = history[summarized_until:]

        # ── Cross-domain history scoping (merlin only) ────────────────────────
        # The system prompt is domain-isolated, but the messages array is not:
        # a prior music/philos exchange would otherwise ride along into a human
        # turn. Tag this turn with the domain route() just selected (single
        # source of truth, no second routing), then drop prior turns from other
        # specialist domains. jarvis/philos personas and unknown domains are
        # left untouched (full continuity). The "domain" key is internal and is
        # stripped before the API call.
        _current_domain = get_route_domain()
        if self._persona == "merlin":
            if history and history[-1].get("role") == "user":
                history[-1]["domain"] = _current_domain
            scoped, _dropped = _scope_history_by_domain(recent_messages, _current_domain)
            if _dropped:
                logger.info("HISTORY_SCOPED domain=%s dropped=%d kept=%d",
                            _current_domain, _dropped, len(scoped))
            recent_messages = scoped
        # Strip internal keys ("domain") — the Anthropic API accepts role/content only.
        recent_messages = [{"role": m["role"], "content": m["content"]} for m in recent_messages]

        full_response: list[str] = []
        t_llm = time.perf_counter()
        turn_context.emit(TraceStep(
            from_node="claude", to_node="llm",
            type="llm.start",
            payload_size=len(system_prompt) + sum(len(m.get("content", "")) for m in recent_messages),
        ))
        _first_token = True

        # ── DEBUG (temporary, OFF by default): log the STRUCTURE of what is sent
        # to Anthropic — message count, per-message role+length, system-prompt
        # length + a short prefix, and the current user message prefix.  No keys,
        # no headers, no full content.  Enable with MERLIN_DEBUG_MESSAGES=1.
        import os as _os
        if _os.environ.get("MERLIN_DEBUG_MESSAGES") == "1":
            _rl = [(m.get("role"), len(m.get("content", "") or "")) for m in recent_messages]
            logger.info("DBG_MSGS  count=%d  roles/lens=%s", len(recent_messages), _rl)
            logger.info("DBG_SYS   len=%d  head=%r", len(system_prompt or ""), (system_prompt or "")[:200])
            # DBG_CONTEXT — per-layer view of ALL context sources feeding the
            # system prompt.  Mirrors the real for_session() layer list (single
            # source of truth) so no source is a blind spot — e.g. the
            # RelationshipMemoryLayer is shown alongside the recall path.  Char
            # counts only, no content.
            _ess = self._essence_extra.get(session_id, "")
            try:
                from app.context_builder import ContextBuilder as _CB
                _diag = _CB.for_session(
                    self._persona, task, summary_state, tool_mem,
                    recall_result=recall_result, essence_context=_ess,
                ).layer_diagnostics()
                logger.info("DBG_CTX   layers=%s", [f"{n}={c}" for n, c in _diag])
            except Exception as _e:
                logger.warning("DBG_CTX   layer diagnostics failed: %s", _e)
            logger.info(
                "DBG_CTX   recall: items=%d candidates=%d reasons=%s | memory_items=%d",
                len(recall_result.items), recall_result.total_candidates,
                dict(Counter(i.reason for i in recall_result.items)), len(memory),
            )
            _last_user = next((m for m in reversed(recent_messages) if m.get("role") == "user"), None)
            if _last_user is not None:
                logger.info("DBG_USER  head=%r", (_last_user.get("content") or "")[:200])
            else:
                logger.info("DBG_USER  (no user message in recent_messages)")

        _response_language_ok: bool | None = None

        if not _gate_active:
            # Unchanged path — identical to before the Control Center existed.
            async with self._client.messages.stream(
                model=settings.claude_model,
                max_tokens=1024,
                system=system_prompt,
                messages=recent_messages,
            ) as stream:
                async for chunk in stream.text_stream:
                    if _first_token:
                        turn_context.emit(TraceStep(
                            from_node="llm", to_node="claude",
                            type="llm.first_token",
                            latency_ms=round((time.perf_counter() - t_llm) * 1000),
                        ))
                        _first_token = False
                    full_response.append(chunk)
                    yield chunk
        else:
            # Gated path (Merlin, Hebrew-only policy active): buffer the full
            # response before yielding anything, so a wrong-language draft never
            # reaches the caller's sentence-buffer/TTS at all. Costs incremental
            # streaming latency for this turn only.
            async with self._client.messages.stream(
                model=settings.claude_model,
                max_tokens=1024,
                system=system_prompt,
                messages=recent_messages,
            ) as stream:
                async for chunk in stream.text_stream:
                    if _first_token:
                        turn_context.emit(TraceStep(
                            from_node="llm", to_node="claude",
                            type="llm.first_token",
                            latency_ms=round((time.perf_counter() - t_llm) * 1000),
                        ))
                        _first_token = False
                    full_response.append(chunk)

            draft = "".join(full_response)
            if looks_non_target_language(draft, _gate_allowed):
                logger.info("claude[%s] language gate: draft flagged, retrying once", session_id)
                try:
                    retry = await self._client.messages.create(
                        model=settings.claude_model,
                        max_tokens=1024,
                        system=system_prompt + RETRY_CORRECTION_SUFFIX,
                        messages=recent_messages + [{"role": "assistant", "content": draft}],
                    )
                    corrected = "".join(
                        block.text for block in retry.content if getattr(block, "type", "") == "text"
                    )
                except Exception as exc:
                    logger.warning("claude[%s] language gate retry failed: %s", session_id, exc)
                    corrected = ""

                if corrected and not looks_non_target_language(corrected, _gate_allowed):
                    full_response = [corrected]
                    _response_language_ok = True
                else:
                    full_response = [HEBREW_FALLBACK_MESSAGE]
                    _response_language_ok = False
            else:
                _response_language_ok = True

            yield "".join(full_response)

        turn_context.emit(TraceStep(
            from_node="llm", to_node="claude",
            type="llm.complete",
            latency_ms=round((time.perf_counter() - t_llm) * 1000),
            payload_size=len("".join(full_response)),
        ))

        history.append({"role": "assistant", "content": "".join(full_response),
                        "domain": _current_domain})
        logger.debug(
            "claude[%s] turn complete (%d chars)", session_id, len("".join(full_response))
        )
        if self._persona == "merlin":
            try:
                append_event(
                    turn_id=_turn_id,
                    runtime_state="speaking",
                    transcript_excerpt=text,
                    enforced_output_language=(_gate_allowed[0] if _gate_active else None),
                    config_version=_config_version,
                    response_language_ok=_response_language_ok,
                )
            except Exception as exc:  # observability must never break the live path
                logger.debug("control_events append failed (ignored): %s", exc)
        # Schedule background summary now that history is complete for this turn.
        asyncio.create_task(self._bg_summarize(session_id, len(history)))

    async def reset(self, session_id: str) -> None:
        self._history.pop(session_id, None)
        self._summary_locks.pop(session_id, None)
        self._clear_session_essence(session_id)
        logger.debug("claude[%s] history cleared", session_id)

    def truncate_last_assistant_turn(self, session_id: str, spoken_text: str) -> None:
        """Correct the last turn's history to reflect what was ACTUALLY spoken.

        `respond()` may or may not have already appended its assistant reply to
        history by the time a caller learns playback was interrupted — that
        depends on exactly which chunk boundary the interruption landed on
        (respond()'s post-yield code, including the history.append, only runs
        once the caller asks the generator for a NEXT item; a caller that
        breaks immediately after the chunk that triggered the interrupt never
        does that). So this handles both shapes:

          - last entry is "assistant"  → its content is REPLACED with
            spoken_text (respond() already appended the full, un-interrupted
            draft; overwrite it with only what actually reached the speaker).
          - last entry is "user"       → an assistant entry is APPENDED with
            spoken_text (respond() never got to append at all). Appending
            here — rather than leaving the turn answer-less — preserves the
            strict user/assistant alternation the Anthropic Messages API
            requires for the next real call.

        If nothing was spoken at all (barge-in landed before the first word
        reached the speaker), a short honest placeholder is used instead of an
        empty content block (which the API rejects) — never text implying
        Merlin said something he didn't.
        """
        history = self._history.get(session_id)
        if not history:
            return
        content = spoken_text or "(interrupted before any text was spoken)"
        if history[-1].get("role") == "assistant":
            history[-1]["content"] = content
        elif history[-1].get("role") == "user":
            # inherit the user turn's domain so history scoping treats the pair consistently
            history.append({"role": "assistant", "content": content,
                            "domain": history[-1].get("domain", "")})
