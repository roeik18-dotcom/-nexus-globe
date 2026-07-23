"""Claude adapter — temporary backend for Phase 1 Voice MVP."""

import logging
from collections import defaultdict
from typing import AsyncIterator

import anthropic

from app.adapters.base import VoiceAdapter
from app.config import build_system_prompt_with_task, settings
from app.summary import (
    SUMMARIZE_PROMPT,
    SummaryState,
    should_summarize,
    summarize_range,
    summary_registry,
)
from app.task import task_registry
from app.tool_memory import tool_memory_registry

logger = logging.getLogger(__name__)


class ClaudeAdapter(VoiceAdapter):
    def __init__(self) -> None:
        self._client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        # session_id → list of {"role": ..., "content": ...}
        self._history: dict[str, list[dict]] = defaultdict(list)

    @property
    def name(self) -> str:
        return "claude"

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

        summary_state = summary_registry.get(session_id)
        task = task_registry.get(session_id)
        tool_mem = tool_memory_registry.get(session_id)
        system_prompt = build_system_prompt_with_task(
            settings.persona, task, summary_state, tool_mem
        )

        # Pass only recent messages; summary covers the rest
        summarized_until = summary_state.summarized_until if summary_state else 0
        recent_messages = history[summarized_until:]

        full_response: list[str] = []

        async with self._client.messages.stream(
            model=settings.claude_model,
            max_tokens=1024,
            system=system_prompt,
            messages=recent_messages,
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
