"""Unit tests for service.mic_channel.select_mic_channel.

2026-08-08: locks in the fix for the barge-in stream defaulting to blind
argmax (risky during TTS playback — the loudest channel can be an
output/reference channel leaking back in, not the mic) instead of the known,
hardware-confirmed mic channel used by the other two capture paths.
"""

import numpy as np

from service.mic_channel import DEFAULT_MIC_CHANNEL, select_mic_channel


def test_prefers_known_channel_even_when_another_channel_is_louder():
    # Channel 0 (e.g. an output/reference channel leaking back in) is louder
    # than the known mic channel — must still select the known channel.
    ch_rms = np.array([0.09, 0.02, 0.01, 0.005])
    assert select_mic_channel(ch_rms) == DEFAULT_MIC_CHANNEL


def test_forced_override_wins_over_preferred():
    ch_rms = np.array([0.09, 0.02, 0.01, 0.005])
    assert select_mic_channel(ch_rms, forced=3) == 3


def test_out_of_range_forced_override_is_ignored():
    ch_rms = np.array([0.09, 0.02, 0.01, 0.005])
    assert select_mic_channel(ch_rms, forced=99) == DEFAULT_MIC_CHANNEL


def test_falls_back_to_argmax_when_preferred_channel_does_not_exist():
    # Only channel 0 exists (e.g. a mono fallback device) — preferred (1) is
    # out of range, so argmax is used as a last resort.
    ch_rms = np.array([0.03])
    assert select_mic_channel(ch_rms, preferred=1) == 0


def test_custom_preferred_channel():
    ch_rms = np.array([0.09, 0.02, 0.01, 0.005])
    assert select_mic_channel(ch_rms, preferred=2) == 2
