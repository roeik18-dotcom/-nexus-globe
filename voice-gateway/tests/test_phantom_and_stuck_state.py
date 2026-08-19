"""B: bare wake-word phantom guard, and C: SPEAKING⇔playback_active invariant
(2026-08-10). Fixtures include the exact live phantom transcript (STT='מרלין'
→ route=general) this fixes.
"""
import pytest

from service.turn_guard import is_bare_wake_word


# ── B: a bare wake word must be rejected; a real command must pass ───────────

@pytest.mark.parametrize("txt", ["מרלין", "מרלן", "מארלין", "merlin", "Merlin",
                                  "היי מרלין", "הי מרלין", "hey merlin",
                                  "מרלין.", "‫מרלין", "  מרלין  ", "מרלין!"])
def test_bare_wake_word_rejected(txt):
    assert is_bare_wake_word(txt) is True, txt


@pytest.mark.parametrize("txt", [
    "מרלין מה השעה",
    "מרלין תספר לי על הזהות המוזיקלית שלי",
    "מרלין מה אתה יודע עליי ועל המטרות שלי",
    "מה השעה",                       # no wake word at all
    "תספר לי על המוזיקה",
    "היי מה קורה",                    # greeting but not the wake word alone
    "",
])
def test_real_command_or_non_wake_not_rejected(txt):
    assert is_bare_wake_word(txt) is False, txt


# ── C: playback ending must not leave a stale SPEAKING ───────────────────────

def _state():
    from service.control_state import RuntimeControlState
    return RuntimeControlState()


def test_playback_end_clears_stale_speaking():
    s = _state()
    s.set_playback_active(True)
    s.set_state("SPEAKING")
    assert s.runtime_state == "SPEAKING" and s.playback_active is True
    s.set_playback_active(False)                    # playback ends
    assert s.playback_active is False
    assert s.runtime_state == "LISTENING"           # SPEAKING did NOT persist


def test_playback_start_does_not_force_state():
    s = _state()
    s.set_state("SPEAKING")
    s.set_playback_active(True)
    assert s.runtime_state == "SPEAKING" and s.playback_active is True


def test_non_speaking_states_are_untouched_on_playback_end():
    for st in ("IDLE", "LISTENING", "THINKING", "INTERRUPTED"):
        s = _state()
        s.set_state(st)
        s.set_playback_active(False)
        assert s.runtime_state == st, st          # only a stale SPEAKING is demoted
        assert s.playback_active is False
