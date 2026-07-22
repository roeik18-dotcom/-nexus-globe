"""Per-session current task state."""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


@dataclass
class TaskState:
    title: str
    description: str = ""
    status: str = "active"  # "active" | "completed"
    updated_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(timespec="seconds")
    )


class TaskRegistry:
    def __init__(self) -> None:
        self._tasks: dict[str, TaskState] = {}

    def set(self, session_id: str, title: str, description: str = "") -> TaskState:
        task = TaskState(title=title, description=description)
        self._tasks[session_id] = task
        logger.info("task[%s] set: %r", session_id, title)
        return task

    def update(self, session_id: str, **kwargs: str) -> TaskState | None:
        task = self._tasks.get(session_id)
        if task is None:
            return None
        for key, value in kwargs.items():
            if hasattr(task, key):
                setattr(task, key, value)
        task.updated_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        logger.info("task[%s] updated: %s", session_id, kwargs)
        return task

    def complete(self, session_id: str) -> TaskState | None:
        return self.update(session_id, status="completed")

    def clear(self, session_id: str) -> None:
        self._tasks.pop(session_id, None)
        logger.info("task[%s] cleared", session_id)

    def get(self, session_id: str) -> TaskState | None:
        return self._tasks.get(session_id)


task_registry = TaskRegistry()
