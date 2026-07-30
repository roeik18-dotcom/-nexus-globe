"""Shared VAD threshold used by both wake detection and post-wake recording.

A single constant ensures both stages treat the same RMS level as speech.
Calibrated against observed RME Babyface Pro levels (device=2, ch1):
  - Ambient noise floor: ~0.002–0.003 (measured 2026-07-29 live session)
  - Active speech:       ~0.020–0.100
  - Threshold 0.006 gives ×2 headroom above floor and ×3–16 below speech.
"""

# RMS above this level is considered speech.
# Used in:  wake_trigger.VAD_THRESHOLD  (keyword detection)
#           merlin_service.SILENCE_RMS  (record_utterance VAD)
#
# 2026-07-30: live mic level dropped ~10x vs the 2026-07-29 calibration (speech
# now arrives at ~0.002–0.006 instead of 0.02–0.1, while the noise floor stayed
# at ~0.002–0.003).  Lowered 0.006 -> 0.004 so quiet speech still crosses the
# gate while staying above the measured noise floor.  The real fix is raising the
# Babyface Pro input gain; this keeps the software usable until that is done.
SPEECH_RMS_THRESHOLD: float = 0.004

# ── Whisper input normalization ───────────────────────────────────────────────
# VAD-gated utterances are peak-normalized to this target level before being sent
# to Whisper.  Very low-amplitude audio makes Whisper hallucinate stock phrases
# (e.g. "MBC 뉴스…", "you", "thank you"); boosting an *already-gated* utterance to
# a healthy amplitude improves transcription without affecting VAD gating.
WHISPER_NORMALIZE_PEAK: float = 0.30
# Cap the boost so a near-silent chunk that slipped through isn't amplified into
# full-scale noise.
WHISPER_NORMALIZE_MAX_GAIN: float = 20.0


def normalize_for_whisper(audio):
    """Peak-normalize a mono float32 array toward WHISPER_NORMALIZE_PEAK.

    Returns ``(array, gain)`` — the possibly-amplified array clipped to [-1, 1]
    and the gain applied — so callers can log it.  Never attenuates (gain >= 1.0)
    and never exceeds WHISPER_NORMALIZE_MAX_GAIN.
    """
    import numpy as np

    peak = float(np.max(np.abs(audio))) if audio.size else 0.0
    if peak <= 0.0:
        return audio, 1.0
    gain = min(WHISPER_NORMALIZE_PEAK / peak, WHISPER_NORMALIZE_MAX_GAIN)
    if gain <= 1.0:
        return audio, 1.0
    boosted = np.clip(audio * gain, -1.0, 1.0).astype(np.float32)
    return boosted, gain
