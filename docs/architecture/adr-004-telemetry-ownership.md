# ADR-004 — Telemetry Ownership

**Subordinate to [RFC-000](system-constitution.md); enforces
[RFC-010](rfc-010-code-ownership.md) and [OBS-001](obs-001-system-observability.md).**
Decision type: **[E].** Status: Accepted (v0.1, 2026-07-31).

## Rule
**Telemetry follows the owner.** Each layer emits **only its own** telemetry. No
layer writes another layer's metrics. This prevents two files from writing the same
information (the 2026-07-31 duplicate-capture incident).

## Ownership by layer
| Layer | Owns (emits) |
|---|---|
| **Audio / Capture** | rms, peak, norm_gain, clipping, SNR, sample_rate, WAV + sha256 |
| **Wake** | wake confidence, false positives, detection latency, WAKE_TRANSCRIPT |
| **Speech (STT)** | transcript, confidence, language, no_speech, duration, provider, model, STT latency |
| **Runtime Pipeline** | end-to-end latency, queue depth, per-stage timing, errors |
| **Intent** | parsed intent, match confidence |

The **Canonical Transcription** object (ADR-002) is assembled by the Speech layer and
*carries* the Audio layer's `audio_metrics` by reference — it does not re-measure them.

## The current duplicate (to consolidate, NOT delete yet)
| Field | `merlin_service.py` (Runtime) | `whisper.py` (Speech) |
|---|---|---|
| rms / peak | pre_norm + post_norm | rms, peak |
| norm_gain | ✅ | ✗ |
| sha256 | ✅ | ✗ |
| pipeline cfg (vad/model/temp) | ✅ | ✗ |
| **transcript** | ✗ (null) | ✅ |
| **no_speech** | ✗ | ✅ |
| **language** | ✅ pipeline only | ✅ detected |
| experiment phrase/run | ✗ | ✅ |

**They are complementary, not identical.** Per the ownership rule:
- **Speech-layer telemetry (transcript, no_speech, language, confidence, duration)**
  → canonical home is **`whisper.py`** (Speech Runtime).
- **Audio-layer telemetry (norm_gain, sha256, pre/post-norm rms)** → belongs to the
  **capture layer**, and rides on the Transcription's `audio_metrics` (ADR-002).

## Decision (staged, low-risk — matches "don't delete yet")
1. **Freeze** core files (RFC-010).
2. **Canonical = `whisper.py`** for STT telemetry.
3. **Preserve** the unique Runtime fields (norm_gain, sha256, pre/post-norm) by folding
   them into the Transcription `audio_metrics` (owned by capture, emitted once).
4. **Only then** remove the duplicate writer in `merlin_service.py`.

No deletion until step 3 confirms no useful field is lost.

## Review trigger
When a field is found to have no owner, or two owners still overlap.

*ADR-004 v0.1 — 2026-07-31.*
