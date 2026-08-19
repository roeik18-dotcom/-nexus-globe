"""Unit tests for service.turn_state.TurnController (PHASE 2 / PHASE 8)."""

import pytest

from service.turn_state import IllegalTransition, TurnController, TurnState


def test_new_turn_is_monotonically_increasing():
    ctrl = TurnController()
    assert ctrl.new_turn() == 1
    assert ctrl.new_turn() == 2
    assert ctrl.new_turn() == 3


def test_is_current_true_for_latest_turn_only():
    ctrl = TurnController()
    t1 = ctrl.new_turn()
    assert ctrl.is_current(t1) is True
    t2 = ctrl.new_turn()
    assert ctrl.is_current(t1) is False   # turn 1 superseded by turn 2
    assert ctrl.is_current(t2) is True


def test_cancel_marks_turn_not_current_even_without_a_newer_turn():
    ctrl = TurnController()
    t1 = ctrl.new_turn()
    assert ctrl.is_current(t1) is True
    ctrl.cancel(t1)
    assert ctrl.is_current(t1) is False
    assert ctrl.is_cancelled(t1) is True


def test_stale_turn_id_never_becomes_current_again():
    ctrl = TurnController()
    t1 = ctrl.new_turn()
    ctrl.cancel(t1)
    t2 = ctrl.new_turn()
    t3 = ctrl.new_turn()
    assert ctrl.is_current(t1) is False
    assert ctrl.is_current(t2) is False
    assert ctrl.is_current(t3) is True


def test_default_state_is_standby():
    ctrl = TurnController()
    assert ctrl.get_state() is TurnState.STANDBY


def test_legal_transition_chain_succeeds():
    ctrl = TurnController()
    for state in (
        TurnState.LISTENING,
        TurnState.USER_SPEAKING,
        TurnState.TRANSCRIBING,
        TurnState.THINKING,
        TurnState.ASSISTANT_SPEAKING,
        TurnState.INTERRUPTING,
        TurnState.LISTENING,
    ):
        ctrl.set_state(state)  # strict=True by default — must not raise
    assert ctrl.get_state() is TurnState.LISTENING


def test_impossible_transition_is_rejected_in_strict_mode():
    ctrl = TurnController()
    assert ctrl.get_state() is TurnState.STANDBY
    with pytest.raises(IllegalTransition):
        ctrl.set_state(TurnState.ASSISTANT_SPEAKING)  # STANDBY -> ASSISTANT_SPEAKING is not legal


def test_impossible_transition_allowed_when_strict_false():
    ctrl = TurnController()
    ctrl.set_state(TurnState.ASSISTANT_SPEAKING, strict=False)  # must not raise
    assert ctrl.get_state() is TurnState.ASSISTANT_SPEAKING
