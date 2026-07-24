"""Claude adapter — temporary backend for Phase 1 Voice MVP."""

import logging
import time
from collections import Counter, defaultdict
from typing import TYPE_CHECKING, AsyncIterator

import anthropic

from app import turn_context
from app.adapters.base import VoiceAdapter
from app.config import build_system_prompt_with_task, settings
from app.context_builder import load_memory_dict
from app.delegation.bus import DelegationRequest, DelegationResult
from app.delegation.rules import should_delegate
from app.recall import default_recall_policy
from app.summary import (
    SUMMARIZE_PROMPT,
    SummaryState,
    should_summarize,
    summarize_range,
    summary_registry,
)
from app.task import task_registry
from app.tool_memory import tool_memory_registry
from app.trace import SystemSnapshot, TraceStep

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

    @property
    def name(self) -> str:
        return f"claude:{self._persona}"

    async def _maybe_summarize(self, session_id: str, history: list[dict]) -> None:
        state = summary_registry.get(session_id)
        summarized_until = state.summarized_until if state else 0

        if not should_summarize(len(history), summarized_until):
            return

        start, end = summarize_range(len(history), summarized_until)
        t0 = time.perf_counter()
        turn_context.emit(TraceStep(
            from_node="claude", to_node="summary",
            type="summary.start",
            description=f"msgs {start}..{end}",
        ))

        to_summarize = history[start:end]

        lines = "\n".join(
            f"{'User' if m['role'] == 'user' else 'Assistant'}: {m['content']}"
            for m in to_summarize
        )
        prior = f"Prior summary:\n{state.text}\n\n" if state and state.text else ""
        prompt = f"{prior}Conversation:\n{lines}"

        parts: list[str] = []
        async with self._client.messages.stream(
            model=settings.claude_model,
            max_tokens=512,
            system=SUMMARIZE_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            async for chunk in stream.text_stream:
                parts.append(chunk)

        new_state = SummaryState(
            text="".join(parts),
            version=(state.version + 1 if state else 1),
            summarized_until=end,
        )
        summary_registry.set(session_id, new_state)
        turn_context.emit(TraceStep(
            from_node="summary", to_node="claude",
            type="summary.complete",
            latency_ms=round((time.perf_counter() - t0) * 1000),
            payload_size=len(new_state.text),
        ))
        logger.info(
            "summary[%s] v%d covers 0..%d (%d messages compressed)",
            session_id, new_state.version, end, end - start,
        )

    async def respond(self, text: str, session_id: str) -> AsyncIterator[str]:
        history = self._history[session_id]
        history.append({"role": "user", "content": text})
        _history_len_before = len(history) - 1
        _pre_summary_state = summary_registry.get(session_id)

        await self._maybe_summarize(session_id, history)

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
            self._persona, task, summary_state, tool_mem, recall_result=recall_result
        )

        # Inject delegation result as a dedicated block in the system prompt.
        # Keeping it in the system layer (not the user message) signals to Claude
        # that this is internal context, not part of the user's utterance.
        if delegation_result and not delegation_result.error and delegation_result.content:
            system_prompt = system_prompt + "\n\n" + _format_delegation_block(delegation_result)

        # Pass only recent messages; summary covers the rest.
        # History is never modified — enrichment lives in system_prompt only.
        summarized_until = summary_state.summarized_until if summary_state else 0
        recent_messages = history[summarized_until:]

        full_response: list[str] = []
        t_llm = time.perf_counter()
        turn_context.emit(TraceStep(
            from_node="claude", to_node="llm",
            type="llm.start",
            payload_size=len(system_prompt) + sum(len(m.get("content", "")) for m in recent_messages),
        ))
        _first_token = True

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

        turn_context.emit(TraceStep(
            from_node="llm", to_node="claude",
            type="llm.complete",
            latency_ms=round((time.perf_counter() - t_llm) * 1000),
            payload_size=len("".join(full_response)),
        ))

        history.append({"role": "assistant", "content": "".join(full_response)})
        logger.debug(
            "claude[%s] turn complete (%d chars)", session_id, len("".join(full_response))
        )

    async def reset(self, session_id: str) -> None:
        self._history.pop(session_id, None)
        logger.debug("claude[%s] history cleared", session_id)
