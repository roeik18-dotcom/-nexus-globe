# ADR-002 — Canonical Transcription Object

**Subordinate to [RFC-000](system-constitution.md); depends on
[ADR-001](adr-001-speech-engine-interface.md).** Decision type: **[E] Engineering.**
Status: Accepted (v0.1, 2026-07-31). Supersedes the inline `Transcription` sketch in
ADR-001 §Decision — that sketch is now defined canonically here.

## Context
ADR-001 says Merlin never depends on a single STT engine. For that to hold, **every
engine must return the same object**, or the coupling just moves from "which engine"
to "which result shape." Different providers return wildly different payloads
(Whisper verbose_json, Deepgram JSON, Google, …). Merlin's Intent/Cognition layers
must not care.

## Decision
Define one **Canonical `Transcription`** object. Every SpeechEngine adapter maps its
provider's native output into exactly this shape; nothing downstream sees provider
JSON.

```
Transcription
├── text          : str              # final transcript
├── language       : str | None       # detected/forced language code
├── confidence     : float | None     # 0..1, normalized across providers
├── words          : [Word] | None    # {text, start_s, end_s, confidence?}
├── segments       : [Segment] | None # {text, start_s, end_s, no_speech_prob?}
├── timestamps     : {start_s, end_s} | None
├── duration_s     : float
├── provider       : str              # "whisper" | "deepgram" | ...
├── model          : str              # provider model id
├── latency_ms     : int              # engine round-trip
├── audio_metrics  : {rms, peak, norm_gain, sha256}  # from capture telemetry
└── raw_reference  : str | None       # opaque pointer to the provider's raw payload
```

Rules:
- **Adapters normalize, never leak.** Downstream code reads only these fields.
- **`confidence` is normalized** to 0..1 with a documented per-provider mapping
  (Whisper: derived from `avg_logprob`/`no_speech_prob`; Deepgram: native).
- **`audio_metrics`** carries the E2 capture data (rms/peak/norm_gain/sha256) so a
  Transcription is self-contained and comparable across experiments (matches the E2
  cmd_*.json goal).
- **`raw_reference`** preserves provenance (INV-2 / RFC-000B `derived_from`) without
  polluting the canonical shape.

## Alternatives
- **Return provider-native payloads** — rejected: re-couples Merlin to each provider.
- **Return bare `text` (current)** — rejected: loses confidence/language/timestamps
  the Intent and Verification layers need.
- **Canonical object (this ADR)** — chosen.

## Consequences
- `STTProvider` (ADR-001) returns `Transcription`, not `str`. Implement additively
  (keep `.text`) so the running command path (`merlin_service.py:622`) is not broken.
- Confidence + no_speech become first-class → the Intent layer can gate on them, and
  the E2 experiment gets its `no_speech` / `confidence` columns for free.
- Same pattern is the template for a future canonical **TTS** result.

## Review trigger
When the second adapter (Deepgram/AssemblyAI) is added and a field proves missing or
mis-normalized.

*ADR-002 v0.1 — 2026-07-31.*
