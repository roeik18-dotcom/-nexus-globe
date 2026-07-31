# ADR-001 — Merlin never depends on a single STT engine

**Subordinate to [RFC-000](system-constitution.md).** Decision type: **[E] Engineering.**
Status: **Accepted (v0.1, 2026-07-31)** — records the decision; implementation is a
follow-up task, not done here.

## Context
- Merlin already has a provider seam: `app/providers/stt/base.py` defines
  `STTProvider.transcribe(audio_bytes) -> str`, selected by `app/router.py:build_stt()`;
  only `whisper.py` (+ `mock.py`) implement it. The command path calls it at
  `service/merlin_service.py:622`.
- **The seam is too thin:** it returns a bare `str` — no confidence, language,
  timestamps, or `no_speech_prob`. Merlin cannot reason about *how sure* the
  transcript is.
- **It is effectively Whisper-only.** The open bottleneck (RFC-000 context) is
  command-STT reliability on low-SNR Hebrew, where Whisper hallucinates stock phrases
  ("תודה רבה") or returns empty. Being locked to one engine blocks evaluating
  alternatives that may handle this input better.
- World-class systems build *on top of* speech recognition; they do not reinvent it.
  Merlin's value is Intent · Context · Memory · Decision · Action · Learning — not
  being another STT.

## Decision
1. Define a **SpeechEngine** contract that returns a structured result, not a string:
   ```
   Transcription {
     transcript: str
     confidence: float | None      # 0..1, engine-reported or derived
     language:   str  | None       # detected/forced language code
     segments:   [ {text, start_s, end_s, no_speech_prob?} ] | None
     metadata:   dict              # engine-specific extras
     engine:     str               # which adapter produced this
   }
   ```
2. One **adapter per provider** behind that contract: Whisper, OpenAI STT, Deepgram,
   AssemblyAI, Google Speech, … (future engines). `build_stt()` selects by config.
3. **Merlin's Intent/Cognition layers depend only on this contract** — never on a
   concrete engine (RFC-000 §8 dependency rule; INV against reinvention).
4. Engine selection may key on language / quality / cost — a config/policy choice,
   not a code change.

## Alternatives considered
- **(a) Keep Whisper-only, bare `str`** — rejected: single point of failure, cannot
  A/B engines, and directly contradicts the rule "Merlin never depends on a single
  STT engine."
- **(b) Structured SpeechEngine interface with adapters** — **chosen.**
- **(c) Build our own STT** — rejected: reinvention; violates "build on top."

## Consequences
- **Unblocks the bottleneck as an [M] experiment:** trying Deepgram/AssemblyAI/Google
  on the weak-Hebrew input becomes a config switch, not a rewrite — a concrete path
  to test whether the failure is Whisper-specific or input-specific.
- Requires enriching `STTProvider` to return `Transcription` (keep a `.transcript`
  string for existing callers → backward-compatible refactor). Confidence/language/
  `no_speech_prob` need providers that expose them (Whisper `verbose_json` does).
- The same adapter pattern should later cover **TTS** (already partially there:
  openai/fish/elevenlabs providers) — a future ADR.
- Enables per-turn logging of confidence/no_speech alongside the E2 telemetry.

## Review trigger
Revisit when a second engine is added, or if the `Transcription` contract proves
insufficient for the Intent layer.

*ADR-001 v0.1 — 2026-07-31. Implementation (enrich `STTProvider` + add one second
adapter) is a separate task, to be scheduled against the Dependency Graph.*
