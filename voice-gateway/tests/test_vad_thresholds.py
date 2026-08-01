"""Guards the wake/command VAD threshold split.

The two stages deliberately use different levels.  A false trigger on the wake
path is nearly free (it fails the keyword match), so it can sit close to the noise
floor.  A false trigger on the command path latches speech_on in the first
callback and SILENCE_S closes the utterance before the user speaks — the failure
observed on 2026-08-01, where 10 of 12 turns recorded a ×20-boosted noise floor
(pre_norm_rms ≈ 0.0026) and Whisper hallucinated 'はい。' / 'Hello'.

These tests pin the wiring, not the numbers: they assert each stage reads the
constant it is supposed to read, so a future edit cannot silently re-merge them.
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock

# Stub sounddevice before importing the service modules — CI may not have
# PortAudio, and pulling the real one in here would defeat the same
# sys.modules.setdefault stub that test_clap_detection.py relies on.  Nothing
# below touches audio: the thresholds are plain module-level floats.
sys.modules.setdefault("sounddevice", MagicMock())

# Make the voice-gateway root importable so `service` resolves regardless of the
# directory pytest is invoked from.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import service.vad_config as vad_config  # noqa: E402
import service.merlin_service as merlin_service  # noqa: E402
import service.wake_trigger as wake_trigger  # noqa: E402


def test_both_thresholds_exist_and_are_distinct():
    assert vad_config.SPEECH_RMS_THRESHOLD != vad_config.COMMAND_RMS_THRESHOLD


def test_command_threshold_has_headroom_over_wake_threshold():
    """The whole point of the split: the command path must gate higher."""
    assert vad_config.COMMAND_RMS_THRESHOLD > vad_config.SPEECH_RMS_THRESHOLD


def test_wake_path_uses_speech_threshold():
    """wake_trigger.VAD_THRESHOLD must remain bound to SPEECH_RMS_THRESHOLD."""
    assert wake_trigger.VAD_THRESHOLD == vad_config.SPEECH_RMS_THRESHOLD
    assert wake_trigger.VAD_THRESHOLD != vad_config.COMMAND_RMS_THRESHOLD


def test_command_capture_uses_command_threshold():
    """record_utterance's gate (SILENCE_RMS) must be the COMMAND constant."""
    assert merlin_service.SILENCE_RMS == vad_config.COMMAND_RMS_THRESHOLD
    assert merlin_service.SILENCE_RMS != vad_config.SPEECH_RMS_THRESHOLD


def test_command_threshold_clears_the_measured_noise_floor():
    """Regression on the actual defect: the gate must sit above the floor.

    Measured at record_utterance open on Babyface ch1 (service.log, 2026-08-01):
    0.0025–0.0035.  A gate at or below the top of that band re-opens the bug.
    """
    OBSERVED_NOISE_FLOOR_MAX = 0.0035
    assert vad_config.COMMAND_RMS_THRESHOLD > OBSERVED_NOISE_FLOOR_MAX


def test_wake_threshold_value_unchanged():
    """The split must not have moved the wake path."""
    assert vad_config.SPEECH_RMS_THRESHOLD == 0.003
