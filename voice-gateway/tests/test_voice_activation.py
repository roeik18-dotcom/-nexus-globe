"""Unit tests for the voice client's activation logic — no audio, no network.

Covers clap onset detection, the double-clap timing gate + cooldown, Hebrew
wake-phrase matching, utterance VAD, and the activation-sequence constants.
"""

import sys
from pathlib import Path

import pytest

# The client lives outside the `app` package; put it on the path.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "client"))

import voice  # noqa: E402


# --- ClapDetector -------------------------------------------------------------

def test_clap_single_impulse_fires_once():
    d = voice.ClapDetector()
    # quiet → loud (fires) → quiet
    assert d.push(0.01, 0.00) is False
    assert d.push(0.90, 0.02) is True
    assert d.push(0.01, 0.04) is False


def test_clap_sustained_energy_fires_once_only():
    """Speech-like sustained loudness must not produce repeated onsets."""
    d = voice.ClapDetector()
    fired = [d.push(0.7, i * 0.02) for i in range(20)]  # 400 ms of steady loud
    assert fired.count(True) == 1  # only the first frame is an onset


def test_clap_requires_quiet_to_rearm():
    d = voice.ClapDetector()
    assert d.push(0.9, 0.00) is True
    assert d.push(0.9, 0.02) is False   # still loud, not re-armed
    assert d.push(0.02, 0.04) is False  # quiet → re-armed
    assert d.push(0.9, 0.20) is True    # past min_gap → fires again


def test_clap_debounces_echo():
    d = voice.ClapDetector(min_gap=0.08)
    assert d.push(0.9, 0.00) is True
    d.push(0.02, 0.02)                    # re-arm
    assert d.push(0.9, 0.05) is False     # within min_gap → treated as ringing


# --- DoubleClapDetector -------------------------------------------------------

def test_double_clap_in_window_fires():
    d = voice.DoubleClapDetector()
    assert d.register_clap(0.0) is False
    assert d.register_clap(0.6) is True


def test_single_clap_never_fires():
    d = voice.DoubleClapDetector()
    assert d.register_clap(0.0) is False


def test_double_clap_too_slow_rejected():
    d = voice.DoubleClapDetector(max_interval=1.2)
    assert d.register_clap(0.0) is False
    assert d.register_clap(2.0) is False  # > max_interval → becomes new first
    assert d.register_clap(2.5) is True   # this pair is in window


def test_double_clap_too_fast_rejected():
    d = voice.DoubleClapDetector(min_interval=0.25)
    assert d.register_clap(0.0) is False
    assert d.register_clap(0.10) is False  # < min_interval → not a double-clap


def test_double_clap_cooldown_blocks_repeat():
    d = voice.DoubleClapDetector(cooldown=3.0)
    assert d.register_clap(0.0) is False
    assert d.register_clap(0.5) is True
    # within cooldown (fires at 0.5, cooldown until 3.5)
    assert d.register_clap(1.0) is False
    assert d.register_clap(1.5) is False
    # after cooldown a fresh double-clap works again
    assert d.register_clap(4.0) is False
    assert d.register_clap(4.6) is True


# --- wake-phrase matching -----------------------------------------------------

@pytest.mark.parametrize(
    "text",
    [
        "ג׳רוויס",              # geresh (U+05F3)
        "ג'רוויס",              # straight apostrophe
        "גרוויס",               # no geresh
        "היי ג׳רוויס תתחיל",     # embedded in a sentence
        "Jarvis",               # romanised
        "hey jarvis",
    ],
)
def test_wake_phrase_matches(text):
    assert voice.matches_wake(text) is True


@pytest.mark.parametrize("text", ["", "שלום עולם", "מה השעה", "start recording"])
def test_wake_phrase_rejects_non_wake(text):
    assert voice.matches_wake(text) is False


def test_normalize_strips_geresh_and_whitespace():
    assert voice.normalize_hebrew("ג׳ רו ויס") == voice.normalize_hebrew("גרוויס")


# --- UtteranceVAD -------------------------------------------------------------

def _frame(level: int):
    import numpy as np
    return np.full((voice.BLOCK_SAMPLES, 1), level, dtype=np.int16)


def test_vad_emits_utterance_after_silence():
    vad = voice.UtteranceVAD(silence_hold=0.3, min_dur=0.2, start=0.1, stop=0.05)
    out = None
    # ~0.5s of speech, then silence long enough to close the utterance
    for i in range(25):
        out = vad.push(0.5, _frame(16000), i * 0.02) or out
    for i in range(25, 60):
        got = vad.push(0.0, _frame(0), i * 0.02)
        out = got or out
    assert out is not None
    assert out[:4] == b"RIFF"  # valid WAV


def test_vad_discards_short_blip():
    """A clap-length impulse is below min_dur and must not become an utterance."""
    vad = voice.UtteranceVAD(silence_hold=0.2, min_dur=0.4, start=0.1, stop=0.05)
    vad.push(0.9, _frame(30000), 0.0)          # loud blip starts collecting
    result = None
    for i in range(1, 20):                      # immediate silence closes it
        result = vad.push(0.0, _frame(0), i * 0.02) or result
    assert result is None


# --- activation constants -----------------------------------------------------

def test_set_task_message_shape():
    assert voice.SET_TASK_MSG["type"] == "set_task"
    assert voice.SET_TASK_MSG["title"] == "פתיח יום"
    assert voice.SET_TASK_MSG["description"]


def test_announce_text():
    assert voice.ANNOUNCE_TEXT == "לחיי פתיח יום. מתחילים."


def test_activation_modes():
    assert voice.ACTIVATION_MODES == ("manual", "wake", "clap", "all")
