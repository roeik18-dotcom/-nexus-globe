"""SCHEDULED_AUTOMATION / CONDITION_WATCH data model.

Standing automation is deliberately weaker than a live capability call: it
can only ever fire a READ_ONLY action_type (enforced both at creation time,
`engine.create_automation`, and again at every fire, `engine.tick` — the
registry could in principle change between the two). There is no approval
object anywhere in this module: a side-effecting action_type is refused
outright, not queued for later approval, because standing/unattended
approval collection is exactly the escalation this framework's approval
binding exists to prevent (see app/capabilities/_framework/models.py —
ApprovalPolicy is bound to a human decision, not a timer).
"""

from __future__ import annotations

import enum
import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional


class TriggerType(str, enum.Enum):
    SCHEDULED = "scheduled"              # fires every interval_s
    CONDITION_WATCH = "condition_watch"  # fires when a registered predicate returns True


class AutomationStatus(str, enum.Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def to_iso(dt: datetime) -> str:
    return dt.isoformat().replace("+00:00", "Z")


def from_iso(s: str) -> datetime:
    dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def dedup_key(action_type: str, inputs: dict[str, Any], trigger_type: TriggerType,
              interval_s: Optional[float], predicate_name: Optional[str]) -> str:
    """Deterministic key identifying "the same standing automation" — used to
    refuse creating a duplicate rather than silently stacking two automations
    that would both fire the same read-only action on the same trigger."""
    compact = json.dumps(
        {
            "action_type": action_type,
            "inputs": inputs,
            "trigger_type": trigger_type.value,
            "interval_s": interval_s,
            "predicate_name": predicate_name,
        },
        separators=(",", ":"), ensure_ascii=False, sort_keys=True,
    )
    return hashlib.sha256(compact.encode("utf-8")).hexdigest()


@dataclass
class NotificationRecord:
    at: str
    status: str          # the StructuredResult.status from the fired action
    code: str
    action_id: str

    def to_dict(self) -> dict[str, Any]:
        return {"at": self.at, "status": self.status, "code": self.code, "action_id": self.action_id}

    @staticmethod
    def from_dict(d: dict[str, Any]) -> "NotificationRecord":
        return NotificationRecord(at=d["at"], status=d["status"], code=d["code"], action_id=d["action_id"])


_MAX_NOTIFICATIONS = 20


@dataclass
class Automation:
    id: str
    action_type: str
    inputs: dict[str, Any]
    trigger_type: TriggerType
    dedup_key: str
    created_at: str
    expires_at: str
    next_check_at: str
    status: AutomationStatus = AutomationStatus.ACTIVE
    interval_s: Optional[float] = None
    predicate_name: Optional[str] = None
    last_fired_at: Optional[str] = None
    fire_count: int = 0
    notifications: list[NotificationRecord] = field(default_factory=list)

    def record_notification(self, note: NotificationRecord) -> None:
        self.notifications.append(note)
        if len(self.notifications) > _MAX_NOTIFICATIONS:
            self.notifications = self.notifications[-_MAX_NOTIFICATIONS:]

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id, "action_type": self.action_type, "inputs": self.inputs,
            "trigger_type": self.trigger_type.value, "dedup_key": self.dedup_key,
            "created_at": self.created_at, "expires_at": self.expires_at,
            "next_check_at": self.next_check_at, "status": self.status.value,
            "interval_s": self.interval_s, "predicate_name": self.predicate_name,
            "last_fired_at": self.last_fired_at, "fire_count": self.fire_count,
            "notifications": [n.to_dict() for n in self.notifications],
        }

    @staticmethod
    def from_dict(d: dict[str, Any]) -> "Automation":
        return Automation(
            id=d["id"], action_type=d["action_type"], inputs=d["inputs"],
            trigger_type=TriggerType(d["trigger_type"]), dedup_key=d["dedup_key"],
            created_at=d["created_at"], expires_at=d["expires_at"],
            next_check_at=d["next_check_at"], status=AutomationStatus(d["status"]),
            interval_s=d.get("interval_s"), predicate_name=d.get("predicate_name"),
            last_fired_at=d.get("last_fired_at"), fire_count=d.get("fire_count", 0),
            notifications=[NotificationRecord.from_dict(n) for n in d.get("notifications", [])],
        )
