"""Session lifecycle and duration enforcement."""

import asyncio
import logging
import time
from dataclasses import dataclass, field

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class Session:
    session_id: str
    started_at: float = field(default_factory=time.monotonic)

    def is_expired(self) -> bool:
        return (time.monotonic() - self.started_at) > settings.max_session_duration_seconds

    def elapsed(self) -> float:
        return time.monotonic() - self.started_at


class SessionRegistry:
    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}

    def create(self, session_id: str) -> Session:
        session = Session(session_id=session_id)
        self._sessions[session_id] = session
        logger.info("session[%s] created", session_id)
        return session

    def get(self, session_id: str) -> Session | None:
        return self._sessions.get(session_id)

    def remove(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)
        logger.info("session[%s] removed", session_id)

    def check_expiry(self, session_id: str) -> bool:
        session = self._sessions.get(session_id)
        if session and session.is_expired():
            logger.warning("session[%s] expired after %.0fs", session_id, session.elapsed())
            return True
        return False


registry = SessionRegistry()
