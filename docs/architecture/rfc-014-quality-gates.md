# RFC-014 — Quality Gates

**Subordinate to [RFC-000](system-constitution.md).** Decision type: **[E].**
Status: v0.1 (2026-07-31). The line between "code that works" and "a platform you can
trust."

## Every merge touching core files passes, in order:
```
Architecture  → conforms to RFC-000 (supremacy), RFC-010 ownership, RFC-011 layout
      ↓
Compile       → all touched modules import/compile clean
      ↓
Tests         → unit + the relevant integration tests pass
      ↓
Observability → new/changed subsystems expose OBS-001 telemetry
      ↓
ADR Compliance→ a referenced ADR exists for any architectural change
      ↓
RFC Compliance→ no contradiction with any RFC (else RFC amended first, RFC-000 §12)
```

## Rules
- **R-1** A gate failure blocks the merge — no exceptions "just this once."
- **R-2** Gates are **evidence** (INV-6): a green gate is a checked fact, not a claim.
- **R-3** The pre-merge checklist (RFC-010) is the human-readable form of these gates.
- **R-4** Gates run in this order because each depends on the previous (compile before
  test, test before observe).

*RFC-014 v0.1 — 2026-07-31.*
