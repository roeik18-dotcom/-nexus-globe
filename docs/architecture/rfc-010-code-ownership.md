# RFC-010 — Code Ownership

**Subordinate to [RFC-000](system-constitution.md).** Decision type: **[E].**
Status: v0.1 (2026-07-31). Written in response to a real incident: two agents edited
the same core files concurrently, producing duplicate command-capture telemetry. The
problem was not STT — it was the absence of ownership.

## Rule
**Every core file has exactly one Owner.** Only the Owner modifies it directly.
Everyone else proposes changes via ADR / pull request against the Owner. In practice
(multi-session), **one session holds each Owner role at a time** — two sessions never
edit the same core file concurrently.

## Ownership map (voice-gateway core)
| File | Owner role |
|---|---|
| `app/providers/stt/base.py` | Voice Architecture (interfaces) |
| `app/providers/stt/whisper.py` | Speech Runtime |
| `service/merlin_service.py` | Runtime Pipeline |
| `service/wake_trigger.py` | Wake Engine |
| `app/context_builder.py` | Context Engine |
| `app/adapters/claude.py` | Cognition/Adapter |

New core files declare an Owner in this table via ADR.

## Owner roles until the merge completes
Two Owner roles, each with **full** authority over its files. One session holds a
role at a time.

**Owner A — Speech Runtime** owns `base.py`, `whisper.py`, `speech/*`.
Responsible for: STT · Canonical Transcription · Speech Telemetry · ADR-001/002/004.

**Owner B — Runtime Pipeline** owns `merlin_service.py`, `wake_trigger.py`,
`context_builder.py`, `runtime/*`.
Responsible for: Pipeline · Queue · Scheduling · Runtime Telemetry · Event Flow ·
ADR-003.

**The only interface between them is the Canonical Transcription (ADR-002):**
```
Speech Runtime → Transcription → Runtime Pipeline
```
The Runtime never knows whether the transcript came from Whisper, Deepgram, or
Google — it knows only `Transcription`.

## Boundary rule
> **No component may modify a file outside its ownership boundary. Cross-boundary
> changes require an approved ADR or a coordinated merge.**

## Pre-merge checklist (required before any merge touching core files)
```
□ Ownership respected
□ ADR reference exists
□ RFC compliance verified
□ Telemetry ownership preserved (ADR-004)
□ No duplicate responsibility introduced
```

## Enforcement
- A change to a core file by a non-owner is reverted or converted to an ADR.
- **Incident on record (2026-07-31):** command-capture telemetry was added in BOTH
  `merlin_service.py` (Owner B) and `whisper.py` (Owner A). Resolution is governed by
  [ADR-004](adr-004-telemetry-ownership.md); the fold+remove is a **coordinated
  merge** (crosses the A↔B boundary) — do not delete before it is done.

## Review trigger
When a new session/collaborator joins, or when a file needs shared ownership (split
it instead).

*RFC-010 v0.1 — 2026-07-31.*
