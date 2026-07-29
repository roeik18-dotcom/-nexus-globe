"""Shared VAD threshold used by both wake detection and post-wake recording.

A single constant ensures both stages treat the same RMS level as speech.
Calibrated against observed RME Babyface Pro levels (device=2, ch1):
  - Ambient noise floor: ~0.0001
  - Active speech:       ~0.001–0.009 (check_channels.py, 2026-07-29)
  - Threshold 0.0003 gives ×3 headroom above floor and ×3–30 below speech.
"""

# RMS above this level is considered speech.
# Used in:  wake_trigger.VAD_THRESHOLD  (keyword detection)
#           merlin_service.SILENCE_RMS  (record_utterance VAD)
SPEECH_RMS_THRESHOLD: float = 0.0003
