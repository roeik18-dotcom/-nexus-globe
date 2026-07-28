"""Shared VAD threshold used by both wake detection and post-wake recording.

A single constant ensures both stages treat the same RMS level as speech.
Tune this against the device noise floor:
  - RME Babyface Pro: floor ~0.0005, speech ~0.001–0.007 → 0.002 is safe.
"""

# RMS above this level is considered speech.
# Used in:  wake_trigger.VAD_THRESHOLD  (keyword detection)
#           merlin_service.SILENCE_RMS  (record_utterance VAD)
SPEECH_RMS_THRESHOLD: float = 0.002
