"""Claude adapter — temporary backend for Phase 1 Voice MVP."""

import logging
from collections import Counter, defaultdict
from typing import TYPE_CHECKING, AsyncIterator

import anthropic

from app.adapters.base import VoiceAdapter
from app.config import build_system_prompt_with_task, settings
from app.context_builder import load_memory_dict
from app.delegation.bus import DelegationRequest
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

if TYPE_CHECKING:
    from app.delegation.bus import DelegationBus

logger = logging.getLogger(__name__)


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
        logger.info(
            "summary[%s] v%d covers 0..%d (%d messages compressed)",
            session_id, new_state.version, end, end - start,
        )

    async def respond(self, text: str, session_id: str) -> AsyncIterator[str]:
        history = self._history[session_id]
        history.append({"role": "user", "content": text})

        await self._maybe_summarize(session_id, history)

        # Delegation: call sub-agent before building the API prompt
        delegation_result = None
        if self._bus is not None:
            target = should_delegate(text)
            if target:
                req = DelegationRequest(
                    target=target,
                    purpose="deep_analysis",
                    prompt=text,
                    context={"parent_session": session_id},
                )
                delegation_result = await self._bus.call(req)
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
        recall_result = default_recall_policy.select(memory, self._persona, task, text)
        reason_counts = Counter(item.reason for item in recall_result.items)
        logger.info(
            "recall persona=%s selected=%d candidates=%d truncated=%s | reasons %s",
            self._persona,
            len(recall_result.items),
            recall_result.total_candidates,
            recall_result.truncated,
            " ".join(f"{r}={c}" for r, c in sorted(reason_counts.items())),
        )
        system_prompt = build_system_prompt_with_task(
            self._persona, task, summary_state, tool_mem, recall_result=recall_result
        )

        # Build API messages: inject delegation result into the current user turn.
        # History always stores the original text; the enriched content is API-only.
        summarized_until = summary_state.summarized_until if summary_state else 0
        recent_base = history[summarized_until:-1]  # recent turns except current user turn

        user_content = text
        if (
            delegation_result
            and not delegation_result.error
            and delegation_result.content
        ):
            user_content = (
                f"{text}\n\n"
                f"[Background analysis from {delegation_result.agent} — "
                f"synthesize naturally, do not quote directly]:\n"
                f"{delegation_result.content}"
            )

        api_messages = [*recent_base, {"role": "user", "content": user_content}]

        full_response: list[str] = []

        async with self._client.messages.stream(
            model=settings.claude_model,
            max_tokens=1024,
            system=system_prompt,
            messages=api_messages,
        ) as stream:
            async for chunk in stream.text_stream:
                full_response.append(chunk)
                yield chunk

        history.append({"role": "assistant", "content": "".join(full_response)})
        logger.debug(
            "claude[%s] turn complete (%d chars)", session_id, len("".join(full_response))
        )

    async def reset(self, session_id: str) -> None:
        self._history.pop(session_id, None)
        logger.debug("claude[%s] history cleared", session_id)
