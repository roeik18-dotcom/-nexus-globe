"""TurnTrace — per-turn telemetry contract for the Nexus visualization layer.

Every field here is populated by real events inside a turn. The visualization
layer consumes TurnTrace objects and renders nothing that is not grounded in
an actual event. No field is optional except error.
"""

from dataclasses import dataclass, field
from typing import Literal

StepType = Literal[
    "normal",       # Nexus → Jarvis routing
    "recall",       # Memory / Recall operations
    "delegation",   # Jarvis → Philos delegation
    "planning",     # Planner / Agents resolution
    "tool",         # External tool execution
    "voice",        # STT / TTS pipeline
    "error",        # Any error or timeout
]


@dataclass
class TraceStep:
    from_node: str          # node id (matches visualization registry)
    to_node: str            # node id
    type: StepType          # determines pulse color in the visualization
    latency_ms: float = 0.0
    payload_size: int = 0   # chars / bytes
    confidence: float | None = None   # populated by delegation steps
    metadata: dict = field(default_factory=dict)
    description: str = ""   # human-readable label shown in the timeline


@dataclass
class TurnTrace:
    session_id: str
    turn_id: str
    user_text: str
    steps: list[TraceStep] = field(default_factory=list)
    total_ms: float = 0.0
    recall_count: int = 0       # memories retrieved
    delegation: bool = False    # whether Philos was called
    error: str | None = None

    def add_step(self, step: TraceStep) -> None:
        self.steps.append(step)
        if step.type == "delegation":
            self.delegation = True
