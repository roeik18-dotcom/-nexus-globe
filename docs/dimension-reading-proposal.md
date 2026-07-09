# DimensionReading — Entity 11 Proposal

**Status: Candidate — interface proposed; not yet implemented**

*This document records the architectural proposal for DimensionReading as a formal entity
in the Philos Marketplace. It does not implement the entity. It does not modify any existing
code or doc. It is a recorded proposal awaiting review before implementation.*

---

## §1 The Problem It Addresses

The current Marketplace Core (v0) chain contains an unspecified step:

```
Mission + Current State
    ↓
??? (how does this become Required Values?)
    ↓
Required Values → Capability Domains → Value Providers
```

OPM performs this inference in practice, but:
- OPM is a full engine (not an atomic entity)
- The interface between OPM and Marketplace is not formally defined
- Marketplace Core v0 implicitly assumes someone already knows which values are missing

Without a formal interface, OPM is a black box to the Marketplace.

---

## §2 The Proposed Entity

### `DimensionReading`

```typescript
interface DimensionReading {
  dimension:     string;           // name of the dimension (Knowledge, Trust, Capital, ...)
  pressure:      number;           // load the mission places on this dimension
  capacity:      number;           // current capability in this dimension
  deficit:       number;           // pressure − capacity (positive = gap)
  evidenceGrade: EvidenceGrade;    // Frozen | Candidate | Placeholder | NotEstablished
}
```

### Inference rule

```
deficit > 0
  → this dimension is a Gap
  → dimension name = Required Value
```

This makes the OPM → Marketplace interface explicit: OPM produces `DimensionReading[]`,
the Marketplace consumes it.

---

## §3 Position in the Chain

```
Mission + Current State
    ↓
[OPM applies Model of 9 — internal to OPM]
    ↓
DimensionReading[]          ← this is the formal interface
    ↓
where deficit > 0 → Required Value
    ↓
[Marketplace begins here]
Required Values → Capability Domains → Value Providers
```

OPM ends at `DimensionReading[]`. Marketplace begins at `Required Values` derived from it.

---

## §4 Architecture Implications

### What this enables

1. **Marketplace is decoupled from OPM** — any source that produces `DimensionReading[]`
   can feed the Marketplace (another diagnostic engine, a human clinician, a research instrument)
2. **The interface is testable** — given a fixed Mission + Current State, we can check whether
   the DimensionReading[] output matches expected Required Values
3. **Evidence grade is explicit** — `capacity` is Placeholder (no measurement protocol);
   `pressure` is Candidate; `deficit` is derived from both

### What this does NOT do

- It does not define how OPM computes `pressure` — that is internal to OPM
- It does not specify how `capacity` is measured — that is Placeholder
- It does not replace the Model of 9 — M9 governs which dimensions exist
- It does not validate matching quality — that requires controlled evaluation

---

## §5 Relationship to Existing Code

The concepts already exist in the codebase under different names:

| Codebase term | DimensionReading field | File |
|---|---|---|
| `dimensionPressure` | `pressure` | `app/lib/noa/harmonicFlow.ts` |
| `dimensionDeficit` | `deficit` | `app/lib/noa/harmonicFlow.ts` |
| `calculateDimensionPressure` | — (the function that produces readings) | `app/lib/noa/resourceMatrix.ts` |
| `DimensionPressure` (type) | partial — missing capacity, evidenceGrade | `app/lib/noa/index.ts` |

`DimensionReading` formalizes and extends what already exists, adding:
- `capacity` as an explicit field (currently implicit)
- `evidenceGrade` as required metadata on every reading

---

## §6 Open Questions Before Implementation

1. **Is `capacity` independent of Value Providers?**
   If capacity = "what the available Value Providers can supply," then it is not a field
   on DimensionReading — it is derived from Entity 6. This would simplify the entity.

2. **Should `evidenceGrade` be per-field or per-reading?**
   `pressure` (Candidate) and `capacity` (Placeholder) may have different grades.
   A per-reading grade may be misleading.

3. **Is `DimensionReading` part of Marketplace Core v1 or a separate interface spec?**
   If it belongs to an interface spec (`docs/opm-marketplace-interface.md`), it should
   not appear in `marketplace-core-v1.md` at all.

4. **Is the `dimension` field free-text or an enum?**
   An enum is safer (enforces M9's defined dimensions); free-text is more extensible.
   This is an architectural decision, not a trivial one.

---

## §7 Prerequisite

Before implementing DimensionReading, the following must exist:

- `docs/marketplace-core-v1.md` with the 10 entities formally defined
- At least one of the open questions in §6 answered
- A decision on whether capacity is independent or derived

---

## §8 Evidence Status

| Claim | Grade |
|---|---|
| OPM → Marketplace interface needs a formal definition | Candidate |
| DimensionReading is the correct form of that interface | Candidate — proposed, not validated |
| deficit > 0 → Required Value is the correct inference rule | Candidate — designed, not tested |
| capacity is measurable from observable data | Placeholder — no protocol |
| DimensionReading matches what the codebase already computes | Candidate — partially true (pressure + deficit exist; capacity + evidenceGrade do not) |

---

*DimensionReading Proposal | Created from session record 2026-07-09*
*Evidence grade: Candidate | Do not implement until §6 open questions are resolved*
