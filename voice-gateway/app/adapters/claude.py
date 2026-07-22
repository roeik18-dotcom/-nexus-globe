"""Claude adapter — temporary backend for Phase 1 Voice MVP."""

import logging
from collections import defaultdict
from typing import AsyncIterator

import anthropic

from app.adapters.base import VoiceAdapter
from app.config import build_system_prompt_with_task, settings
from app.task import task_registry

logger = logging.getLogger(__name__)


class ClaudeAdapter(VoiceAdapter):
    def __init__(self) -> None:
        self._client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        # session_id → list of {"role": ..., "content": ...}
        self._history: dict[str, list[dict]] = defaultdict(list)

    @property
    def name(self) -> str:
        return "claude"

    async def respond(self, text: str, session_id: str) -> AsyncIterator[str]:
        history = self._history[session_id]
        history.append({"role": "user", "content": text})

        task = task_registry.get(session_id)
        system_prompt = build_system_prompt_with_task(settings.persona, task)

        full_response: list[str] = []

        async with self._client.messages.stream(
            model=settings.claude_model,
            max_tokens=1024,
            system=system_prompt,
            messages=history,
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
