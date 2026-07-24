"""TurnTrace — per-turn telemetry contract for the Nexus Observability layer.

Architecture principle:
  Runtime emits TurnTrace as the single source of truth.
  Every consumer (Benchmark, JSON logs, Visualization, Replay, Analytics)
  subscribes to TurnTrace and never reaches into the Runtime internals.

Event taxonomy uses dot-notation so consumers can match on prefix:
  - "recall.*"      covers all recall events
  - "delegation.*"  covers all delegation events
  etc.
This lets consumers distinguish WHERE time is spent, not just WHAT happened.
"""

from dataclasses import dataclass, field
from typing import Literal

# fmt: off
StepType = Literal[
    # ── Routing ──────────────────────────────────────────
    "routing.start",            # turn enters Jarvis
    "routing.complete",         # Jarvis decides how to handle

    # ── Recall ───────────────────────────────────────────
    "recall.start",             # RecallPolicy.select() called
    "recall.selected",          # items chosen (payload_size = count)
    "recall.truncated",         # result was truncated to fit budget
    "recall.complete",          # context appended to system prompt

    # ── Summary ──────────────────────────────────────────
    "summary.start",            # should_summarize() returned True
    "summary.complete",         # new SummaryState stored

    # ── Delegation ───────────────────────────────────────
    "delegation.start",         # DelegationBus.call() dispatched
    "delegation.complete",      # DelegationResult received (confidence in field)
    "delegation.error",         # sub-agent raised or returned error

    # ── Planning ─────────────────────────────────────────
    "planning.intent",          # Planner resolved user intent
    "planning.capability",      # capability matched in registry
    "planning.ready",           # execution plan assembled

    # ── Tool ─────────────────────────────────────────────
    "tool.start",               # tool invoked
    "tool.complete",            # tool returned result
    "tool.error",               # tool raised or timed out

    # ── Voice ────────────────────────────────────────────
    "voice.stt.start",          # audio → text transcription started
    "voice.stt.complete",       # transcription ready
    "voice.tts.start",          # text → audio synthesis started
    "voice.tts.complete",       # audio stream ready

    # ── LLM call ─────────────────────────────────────────
    "llm.start",                # messages.stream() called
    "llm.first_token",          # first chunk received (TTFT)
    "llm.complete",             # full response assembled

    # ── Errors ───────────────────────────────────────────
    "error.timeout",
    "error.exception",
]
# fmt: on

# Colour hint for visualization layer — keyed on dot-prefix.
# Consumers may use STEP_COLOR_HINTS[step.type.split(".")[0]] as a fallback.
STEP_COLOR_HINTS: dict[str, str] = {
    "routing":    "#60A5FA",  # blue
    "recall":     "#F59E0B",  # amber
    "summary":    "#0891B2",  # cyan
    "delegation": "#A78BFA",  # violet
    "planning":   "#FCD34D",  # yellow
    "tool":       "#34D399",  # green
    "voice":      "#F87171",  # rose
    "llm":        "#818CF8",  # indigo
    "error":      "#EF4444",  # red
}


@dataclass
class TraceStep:
    from_node: str              # node id (matches visualization registry)
    to_node: str                # node id
    type: StepType              # dot-notation event (drives colour + grouping)
    latency_ms: float = 0.0    # wall time for this step
    payload_size: int = 0      # chars / bytes / item count (context-dependent)
    confidence: float | None = None  # delegation.complete only
    metadata: dict = field(default_factory=dict)
    description: str = ""      # human-readable label for Timeline UI


@dataclass
class SystemSnapshot:
    """State of the system at the moment a TurnTrace is opened.

    Answers "what was the system's condition when this turn ran?" —
    separate from TurnTrace which answers "what happened during the turn?".
    """
    active_persona: str
    active_agents: list[str] = field(default_factory=list)
    recall_items: int = 0       # items returned by RecallPolicy this turn
    summary_version: int = 0   # SummaryState.version (0 = no summary yet)
    memory_items: int = 0      # total items in the persona memory dict
    history_len: int = 0       # messages in session history before this turn
    delegation_active: bool = False


@dataclass
class TurnTrace:
    session_id: str
    turn_id: str
    user_text: str
    snapshot: SystemSnapshot | None = None   # state when turn started
    steps: list[TraceStep] = field(default_factory=list)
    total_ms: float = 0.0
    recall_count: int = 0       # convenience: items actually retrieved
    delegation: bool = False    # convenience: whether delegation.start fired
    error: str | None = None

    def add_step(self, step: TraceStep) -> None:
        self.steps.append(step)
        if step.type.startswith("delegation."):
            if step.type == "delegation.start":
                self.delegation = True
        if step.type == "recall.selected":
            self.recall_count = step.payload_size

    def step_latency(self, prefix: str) -> float:
        """Sum of latency_ms for all steps matching dot-prefix (e.g. 'recall')."""
        return sum(s.latency_ms for s in self.steps
                   if s.type.startswith(prefix))
