"""Per-session working summary — compresses message history when it grows large."""

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

KEEP_RECENT: int = 8    # always keep this many messages verbatim
SUMMARIZE_NEW: int = 8  # trigger when this many new messages are unsummarized (beyond KEEP_RECENT)

SUMMARIZE_PROMPT = (
    "You are compressing a conversation between a user and an AI assistant.\n\n"
    "Produce a concise working summary that captures:\n"
    "- Decisions made\n"
    "- Open tasks\n"
    "- Active assumptions\n"
    "- Relevant constraints\n\n"
    "Omit pleasantries and back-and-forth. Be terse. Output only the summary, no preamble."
)


@dataclass
class SummaryState:
    text: str
    version: int
    summarized_until: int  # exclusive upper bound: messages[0:summarized_until] are covered


class SummaryRegistry:
    def __init__(self) -> None:
        self._states: dict[str, SummaryState] = {}

    def get(self, session_id: str) -> SummaryState | None:
        return self._states.get(session_id)

    def set(self, session_id: str, state: SummaryState) -> None:
        self._states[session_id] = state
        logger.info(
            "summary[%s] v%d covers 0..%d",
            session_id, state.version, state.summarized_until,
        )

    def clear(self, session_id: str) -> None:
        self._states.pop(session_id, None)

    def get_summarized_until(self, session_id: str) -> int:
        state = self._states.get(session_id)
        return state.summarized_until if state else 0


def should_summarize(history_len: int, summarized_until: int) -> bool:
    """True when enough unsummarized messages exist beyond the KEEP_RECENT tail."""
    return history_len - summarized_until >= SUMMARIZE_NEW + KEEP_RECENT


def summarize_range(history_len: int, summarized_until: int) -> tuple[int, int]:
    """(start, end) of messages to summarize — end is exclusive, leaves KEEP_RECENT intact."""
    return summarized_until, history_len - KEEP_RECENT


summary_registry = SummaryRegistry()
