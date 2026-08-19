"""Single source of truth for which input channel is 'the microphone'.

2026-08-08 — before this module existed, three call sites each made their own
channel-selection decision and two of them disagreed with their own
docstrings:

  * wake_trigger.py hardcoded channel 1 (comment: "hardcoded; not argmax").
  * merlin_service.py::record_utterance's docstring said "selects the
    loudest channel" but the executing callback also hardcoded channel 1 —
    the docstring was stale, not the behaviour.
  * merlin_service.py::play_with_barge_in (the barge-in duplex stream) is
    the one place that actually used blind per-callback argmax — which is
    exactly the risky choice during active TTS playback: the loudest
    channel at that moment can be an output/reference channel leaking back
    in (observed on this rig on channels in the 12/13 range), not the mic.

DEFAULT_MIC_CHANNEL=1 is not a guess — it is the channel confirmed useful on
the current hardware (RME Babyface Pro, device 4, 14 channels). Preferring it
over argmax during playback is deliberate: a known-correct fixed channel
cannot be fooled by a single loud reference-channel block the way argmax can.
"""

from __future__ import annotations

import numpy as np

# Babyface Pro (device 4, 14 channels) — confirmed useful microphone channel.
DEFAULT_MIC_CHANNEL = 1


def select_mic_channel(
    ch_rms: "np.ndarray",
    *,
    forced: int | None = None,
    preferred: int = DEFAULT_MIC_CHANNEL,
) -> int:
    """Pick which channel of a multi-channel input block is the microphone.

    Precedence:
      1. `forced` — an explicit operator override (e.g. the control panel's
         "force channel" setting). Always wins when it names a channel that
         exists in this block.
      2. `preferred` — the known, hardware-confirmed mic channel. Used even
         when some other channel is momentarily louder, because "loudest"
         is not the same signal as "the microphone" (see module docstring).
      3. argmax — only as a last resort, when `preferred` does not exist in
         this block at all (e.g. a mono fallback device with fewer channels
         than the multi-channel rig this was tuned on).
    """
    n = int(ch_rms.shape[0])
    if forced is not None and 0 <= forced < n:
        return forced
    if 0 <= preferred < n:
        return preferred
    return int(np.argmax(ch_rms))
