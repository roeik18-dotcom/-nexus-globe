"""Single source of truth for conversational turn ownership.

Everything that can produce an audible or persisted side effect (LLM chunks,
TTS audio, playback, history writes) must check `TurnController.is_current`
before applying that effect. This is the mechanism PHASE 2 of the turn-taking
fix requires: no stale turn may survive past the moment a newer turn is
created.

Accessed from both the asyncio event loop and PortAudio callback threads
(the barge-in mic callback fires on a separate OS thread), so every method
is protected by a plain `threading.Lock` — cheap, and correct across both
callers.
"""

from __future__ import annotations

import threading
from enum import Enum, auto


class TurnState(Enum):
    STANDBY = auto()
    LISTENING = auto()
    USER_SPEAKING = auto()
    TRANSCRIBING = auto()
    THINKING = auto()
    ASSISTANT_SPEAKING = auto()
    INTERRUPTING = auto()


# States a transition is allowed to move FROM, per target state. Used only to
# catch programming errors (e.g. jumping straight from LISTENING to
# ASSISTANT_SPEAKING) — the acceptance tests exercise this via
# `set_state(..., strict=True)`.
_ALLOWED_PREDECESSORS: dict[TurnState, set[TurnState]] = {
    TurnState.STANDBY:            {TurnState.STANDBY, TurnState.LISTENING, TurnState.ASSISTANT_SPEAKING},
    TurnState.LISTENING:          {TurnState.STANDBY, TurnState.LISTENING, TurnState.ASSISTANT_SPEAKING, TurnState.INTERRUPTING, TurnState.USER_SPEAKING},
    TurnState.USER_SPEAKING:      {TurnState.LISTENING, TurnState.USER_SPEAKING, TurnState.INTERRUPTING},
    TurnState.TRANSCRIBING:       {TurnState.USER_SPEAKING, TurnState.TRANSCRIBING},
    TurnState.THINKING:           {TurnState.TRANSCRIBING, TurnState.THINKING},
    TurnState.ASSISTANT_SPEAKING: {TurnState.THINKING, TurnState.ASSISTANT_SPEAKING},
    TurnState.INTERRUPTING:       {TurnState.ASSISTANT_SPEAKING, TurnState.INTERRUPTING},
}


class IllegalTransition(Exception):
    pass


class TurnController:
    """Owns `current_turn_id` and the coarse conversational state.

    A turn_id is minted by `new_turn()` and is monotonically increasing for
    the lifetime of the controller (one instance per running session — see
    service/merlin_service.py::main()). `cancel(turn_id)` marks a turn stale
    without needing to also bump current_turn_id (the next `new_turn()` call
    does that); this lets a still-in-flight coroutine observe
    "my turn_id is cancelled" even before a replacement turn exists.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._turn_id = 0
        self._state = TurnState.STANDBY
        self._cancelled: set[int] = set()

    def new_turn(self) -> int:
        with self._lock:
            self._turn_id += 1
            return self._turn_id

    @property
    def current_turn_id(self) -> int:
        with self._lock:
            return self._turn_id

    def cancel(self, turn_id: int) -> None:
        with self._lock:
            self._cancelled.add(turn_id)

    def cancel_current(self) -> int | None:
        """Cancel whichever turn is current right now. Returns its id, or
        None if no turn has ever been minted. Used by the control panel's
        CANCEL CURRENT TURN / EMERGENCY KILL — idempotent (cancelling an
        already-cancelled/no-longer-current turn is a safe no-op)."""
        with self._lock:
            if self._turn_id == 0:
                return None
            self._cancelled.add(self._turn_id)
            return self._turn_id

    def reset(self) -> None:
        """RESET SESSION: return to a fresh turn-numbering/state baseline
        without restarting the process. Does not touch conversation history
        (that is ClaudeAdapter's job — see reset(session_id))."""
        with self._lock:
            self._turn_id = 0
            self._cancelled.clear()
            self._state = TurnState.STANDBY

    def is_current(self, turn_id: int) -> bool:
        """True only if turn_id is the newest minted turn AND not cancelled."""
        with self._lock:
            return turn_id == self._turn_id and turn_id not in self._cancelled

    # turn_id IS the generation/output-owner id: exactly one generation may own
    # output at a time, and it is always the newest non-cancelled turn. Every
    # output operation (TTS enqueue, playback callback, history write, any
    # continuation) MUST gate on this — if it returns False, the caller drops
    # the operation. This is the single authoritative owner check the voice
    # controller enforces; there is no second owner concept.
    def owns_output(self, turn_id: int) -> bool:
        return self.is_current(turn_id)

    def is_cancelled(self, turn_id: int) -> bool:
        with self._lock:
            return turn_id in self._cancelled

    @property
    def cancelled_turn_ids(self) -> list[int]:
        """For the operator console — TURN OWNERSHIP panel's 'cancelled turn IDs'."""
        with self._lock:
            return sorted(self._cancelled)

    def get_state(self) -> TurnState:
        with self._lock:
            return self._state

    def set_state(self, state: TurnState, *, strict: bool = True) -> None:
        with self._lock:
            if strict:
                allowed = _ALLOWED_PREDECESSORS.get(state)
                if allowed is not None and self._state not in allowed:
                    raise IllegalTransition(
                        f"{self._state.name} -> {state.name} is not a permitted transition"
                    )
            self._state = state
