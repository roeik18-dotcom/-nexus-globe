"""Shared VAD threshold used by both wake detection and post-wake recording.

A single constant ensures both stages treat the same RMS level as speech.
Calibrated against observed RME Babyface Pro levels (device=2, ch1):
  - Ambient noise floor: ~0.0001
  - Active speech:       ~0.0023–0.0031
  - Threshold 0.001 gives ×10 headroom above floor and ×2.3 below speech peak,
    ensuring continuous utterances are captured without false triggers.
"""

# RMS above this level is considered speech.
# Used in:  wake_trigger.VAD_THRESHOLD  (keyword detection)
#           merlin_service.SILENCE_RMS  (record_utterance VAD)
SPEECH_RMS_THRESHOLD: float = 0.001
