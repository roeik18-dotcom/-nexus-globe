"""VAD thresholds for wake detection and post-wake recording.

The two stages deliberately do NOT share one level — see COMMAND_RMS_THRESHOLD
below for why a false trigger costs almost nothing on the wake path and costs the
entire listening window on the command path.
Calibrated against observed RME Babyface Pro levels (device=2, ch1):
  - Ambient noise floor: ~0.002–0.003 (measured 2026-07-29 live session)
  - Active speech:       ~0.020–0.100
  - Threshold 0.006 gives ×2 headroom above floor and ×3–16 below speech.
"""

# RMS above this level is considered speech.
# Used in:  wake_trigger.VAD_THRESHOLD  (keyword detection)
#
# 2026-07-30: live mic level dropped ~10x vs the 2026-07-29 calibration (speech
# now arrives at ~0.002–0.006 instead of 0.02–0.1, while the noise floor stayed
# at ~0.002–0.003).  Lowered 0.006 -> 0.004 so quiet speech still crosses the
# gate while staying above the measured noise floor.  The real fix is raising the
# Babyface Pro input gain; this keeps the software usable until that is done.
SPEECH_RMS_THRESHOLD: float = 0.003

# ── Command-recording threshold (record_utterance) ────────────────────────────
# The command recorder needs real headroom over the noise floor; the wake path
# does not.  A false wake trigger is nearly free — it fails the keyword match and
# costs one STT call.  A false COMMAND trigger latches speech_on in the very first
# callback, and SILENCE_S (0.8 s) then closes the utterance before the user has
# begun speaking; Whisper is handed the ×20-boosted noise floor and hallucinates.
#
# Observed 2026-08-01 (service.log, Babyface ch1, threshold 0.003):
#   floor at record_utterance open = 0.0025–0.0035  ← straddles the threshold
#   10 of 12 turns → pre_norm_rms ≈ 0.0026, norm_gain ×20, transcript 'はい。'/'Hello'
#   voiced time after the trigger block: 0.00 s / 0.07 s / 0.41 s
#   real speech, when it landed inside the window: peak 0.068–0.084
# 0.006 restores the ×2 headroom this module's header specifies, and stays well
# under the 0.011–0.05 RMS that actual speech blocks reach on this rig.
# 2026-08-08: this constant still read 0.003 (identical to SPEECH_RMS_THRESHOLD,
# straddling the measured noise floor per the comment above it) despite the
# comment already documenting 0.006 as the fix — the value was never actually
# changed. Corrected to match the documented, measured fix.
# 2026-08-08 (live evidence): real user speech commonly arrives at RMS 0.002–0.005
# on this rig, so 0.006 was rejecting genuine speech. Reverted to 0.003 to admit it;
# silence/hallucination is caught downstream by the STT acceptance gate, not this floor.
COMMAND_RMS_THRESHOLD: float = 0.003
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
