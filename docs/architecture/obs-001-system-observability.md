# OBS-001 — System Observability

**Subordinate to [RFC-000](system-constitution.md).** Decision type: **[E].**
Status: v0.1 (2026-07-31). Turns Mission Control from a pretty screen into a
telemetry-backed diagnostic surface, and turns Merlin from "a system you debug" into
"a system that diagnoses itself."

## Rule
**Every subsystem exposes a standard health/telemetry surface.** No subsystem is a
black box. A subsystem that cannot report on itself is incomplete.

```
Subsystem.observe() → {
  health:       "green" | "yellow" | "red"
  latency_ms:   number            # last op / rolling p50,p95
  errors:       [{code, message, ts}]
  confidence:   0..1 | null        # if the subsystem produces judgments
  version:      str                # subsystem version
  dependencies: [{name, health}]   # what it depends on, and their health
  metrics:      dict               # subsystem-specific (e.g. SNR, fragmentation)
}
```
Examples: Kernel says "I'm healthy"; Speech says "my confidence dropped to 0.3";
Memory says "I'm fragmented."

## The voice chain becomes measurable per stage
Sprint-1 target: instrument the full chain so each stage is independently observable.
```
Audio Capture   → rms, peak, clipping, device, channel
Audio Health     → SNR, noise floor, gain staging ok?
Noise Analysis   → ambient vs speech energy
VAD              → onset, duration, too-short discards, frames>threshold
Speech Engine    → provider, model, latency, confidence, no_speech, language
Canonical Transcription → text, confidence, audio_metrics (ADR-002)
Intent           → parsed intent, match confidence
Context          → items injected, recall count
Planner          → actions, dependencies
Execution        → result, origin, approval state
```
This answers, per turn: **where** did it fall, what was the SNR, what was the STT
confidence, is it audio vs engine vs intent, and did another engine actually help.

## Emission
- Every observation is emitted as an **Event** (ADR-003), `type: "obs.<subsystem>"`,
  so it is replayable and feeds Mission Control (LEVEL 6) and the E2 experiment.
- Cost: observability is on by default at INFO-summary granularity; verbose per-frame
  telemetry is gated (as the current `MERLIN_CAPTURE_WAV` / `MERLIN_DEBUG_MESSAGES`).

## Review trigger
When Mission Control needs a field no subsystem currently exposes.

*OBS-001 v0.1 — 2026-07-31.*
