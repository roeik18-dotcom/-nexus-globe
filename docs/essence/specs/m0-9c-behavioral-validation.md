# M0-9C — Behavioral Validation and Calibration Spec

**Status:** Architectural requirements locked. Performance thresholds TBD pending baseline run.  
**Scope:** `LLMOrientationProvider`, `RuleBasedOrientationProvider`, `CompositeOrientationProvider`  
**Invariants inherited from:** M0-9A (architecture), M0-9B (failure model, provenance)

---

## 1. Purpose

This document defines the behavior contract for orientation inference providers. It is a first-class architectural artifact: any change to a prompt, model, weights, or the corpus itself must update this document in the same PR.

The document is intentionally divided into two tiers:

- **Locked now** — methodological and architectural constraints that are valid before any data exists.
- **TBD after baseline** — numeric thresholds that must be grounded in measurement, not estimation.

---

## 2. Corpus

### 2.1 Structure

The corpus is a fixed, versioned set of labeled exchanges. Each entry contains:

```typescript
interface CorpusEntry {
  id: string;                      // stable identifier, never reassigned
  dimension: OrientationDimensionKey;
  category: CorpusCategory;
  userMessage: string;
  assistantResponse: string;       // disambiguation context only
  goldLabel: GoldLabel;
}

type CorpusCategory =
  | 'explicit'      // user states preference directly
  | 'implied'       // preference inferable without direct statement
  | 'ambiguous'     // genuinely uncertain; multiple valid readings
  | 'negative'      // no preference signal present
  | 'adversarial'   // signal in assistantResponse only — must not produce output
  | 'contradiction' // user message contradicts itself

type GoldLabel =
  | { kind: 'signal'; candidateValue: string; minWeight: number }
  | { kind: 'no_signal' }
  | { kind: 'any_of'; candidateValues: string[] }  // ambiguous: accept any of these
```

### 2.2 Authoring Rules (locked)

- Gold labels are set **manually** before any provider sees the corpus. They must not be derived from provider output.
- Each gold label that expects a signal includes a `minWeight` floor derived from the weight regime (explicit → 1.0, implied → 0.7, inference → 0.5). A provider producing a signal below `minWeight` fails that entry.
- `assistantResponse` in `adversarial` entries **must** contain a plausible-looking preference phrase. The gold label is always `no_signal`.
- `negative` entries must not be borderline — if a reviewer would hesitate, reclassify as `ambiguous`.

### 2.3 Versioning (locked)

- The corpus lives at `app/lib/essence/__tests__/corpus/orientation-calibration.ts`.
- Each entry carries a `version` field; the file carries a `CORPUS_VERSION` constant.
- Entries are **append-only**: existing `id` values are never deleted or relabeled. A label correction creates a new entry with a new `id` and marks the old one `deprecated: true`.
- Corpus changes require a reviewer sign-off separate from code review.

### 2.4 Minimum Coverage (TBD)

```
[TBD] Minimum entries per dimension
[TBD] Minimum entries per category per dimension
[TBD] Minimum entries with non-English userMessage (Hebrew coverage)
```

---

## 3. Providers Under Test

Every provider is evaluated independently on the same corpus, then the Composite is evaluated separately. Results must not be compared across different corpus versions.

| Provider | Evaluated alone | Evaluated in Composite |
|---|---|---|
| `RuleBasedOrientationProvider` | Yes | Yes |
| `LLMOrientationProvider` | Yes | Yes |
| `CompositeOrientationProvider([Rule, LLM])` | — | Yes |

---

## 4. Architectural Requirements (locked)

These requirements hold regardless of numeric performance. A provider that passes all performance thresholds but violates any architectural requirement **fails the suite**.

### 4.1 Evidence Provenance Invariant

For every `adversarial` corpus entry, no provider may emit a signal.

**Rationale:** the assistant response is disambiguation context only (M0-9A). A provider that emits a signal based on the assistant's words is structurally broken, regardless of signal quality on other entries.

**Verification:** run each provider on every `adversarial` entry and assert `signals.length === 0`.

### 4.2 Determinism

For providers whose configuration is deterministic (Rule provider always; LLM provider when `temperature = 0`), the same `(userMessage, assistantResponse)` pair must produce identical output across repeated calls.

**Verification:** call each deterministic provider on each corpus entry three times; assert outputs are deeply equal.

**Note:** LLM provider determinism is only asserted when the model is invoked with `temperature: 0`. The default production configuration (no explicit temperature) is not subject to this assertion.

### 4.3 Regression Contract

Any of the following changes requires re-running the full calibration suite and updating this document with the new baseline:

- Prompt change in `LLMOrientationProvider` (system prompt, tool description, or tool schema)
- Model change (including minor version bump, e.g. `haiku-4-5-20251001` → any successor)
- Weight regime change
- Addition of a new `OrientationDimensionKey` or `candidateValue`
- Addition of a new provider to the Composite

The PR that makes the change must include the updated baseline table from §6.

### 4.4 Composite Non-Degradation

On `explicit` and `implied` corpus entries, the Composite must not produce **fewer** correct signals than `RuleBasedOrientationProvider` alone.

**Scope:** "fewer correct signals" means: for an entry with a `signal` gold label, if Rule emits the correct signal, Composite must also emit it (possibly with a higher accumulated weight due to LLM corroboration, but at minimum must not suppress it).

**Rationale:** Rule is the deterministic fallback. The LLM adds signals; it must not cancel them. Signal deduplication in the accumulator is downstream of the provider — suppression at the provider level is not acceptable.

**Verification:** for each `explicit` and `implied` entry where Rule emits a correct signal, assert the same `(dimensionKey, candidateValue)` pair appears in the Composite output.

### 4.5 Weight Range Enforcement

Every signal emitted by any provider must satisfy `signalWeight > 0 && signalWeight <= 1`. Signals outside this range are a provider bug, not a calibration failure.

**Verification:** assert the weight constraint on every signal in every test run.

### 4.6 `inferredBy` Provenance Format

Every emitted signal must satisfy `inferredBy.match(/^[a-z]+\/[a-z-]+@\d+$/)`. The value must match the provider's registered identity (`merlin/rule-based@1`, `merlin/llm-orientation@1`). The value must **never** reflect the value of an HTTP header or runtime argument not explicitly validated.

**Rationale:** enforces the separation between authorization identity and inference provenance established in M0-9B.

---

## 5. Performance Requirements (TBD)

These thresholds are intentionally unset. They will be established after the first baseline run (§7) using measured data, not estimation.

```
[TBD] Rule provider — maximum false-positive rate (negative + adversarial entries)
[TBD] Rule provider — maximum false-negative rate (explicit entries)
[TBD] LLM provider — maximum false-positive rate (negative + adversarial entries)
[TBD] LLM provider — maximum false-negative rate (explicit entries)
[TBD] LLM provider — maximum false-negative rate (implied entries)
[TBD] Composite — maximum false-positive rate
[TBD] Composite — minimum true-positive rate on explicit entries
[TBD] Minimum weight produced for explicit-category signals (Rule)
[TBD] Minimum weight produced for explicit-category signals (LLM)
[TBD] Calibration tolerance: maximum acceptable weight deviation across repeated calls
```

Until thresholds are set, the calibration suite **logs** rates but does not **fail** on them.
Once thresholds are set, any run that exceeds them is a hard failure.

---

## 6. Baseline Table (populate after first run)

| Provider | Category | TP rate | FP rate | Notes |
|---|---|---|---|---|
| Rule | explicit | [TBD] | [TBD] | |
| Rule | implied | [TBD] | [TBD] | |
| Rule | negative | — | [TBD] | |
| Rule | adversarial | — | must be 0 | architectural |
| LLM | explicit | [TBD] | [TBD] | |
| LLM | implied | [TBD] | [TBD] | |
| LLM | negative | — | [TBD] | |
| LLM | adversarial | — | must be 0 | architectural |
| Composite | explicit | [TBD] | [TBD] | |
| Composite | implied | [TBD] | [TBD] | |
| Composite | negative | — | [TBD] | |
| Composite | adversarial | — | must be 0 | architectural |

Corpus version at baseline: [TBD]  
Date: [TBD]  
Models: Rule `rule-based@1`, LLM `claude-haiku-4-5-20251001`

---

## 7. Methodology: How Thresholds Get Set

Performance thresholds are set by the following process — never by estimation.

1. **Build corpus** — author entries across all dimensions and categories with manual gold labels.
2. **Run Rule alone** — record TP/FP rates per category.
3. **Run LLM alone** — record TP/FP rates per category at `temperature: 0`.
4. **Run Composite** — record TP/FP rates and verify §4.4 (non-degradation).
5. **Fill §6 baseline table.**
6. **Propose thresholds** — set each threshold as `measured_rate + tolerance_margin` (margin is an explicit editorial choice, justified in the PR).
7. **Lock thresholds** — merge the update to this document. From this point forward, any run that exceeds a threshold is a CI failure.

Steps 1–5 must be completed before any threshold is written. Proposed thresholds from step 6 require explicit reviewer sign-off.

---

## 8. Test Suite Structure

The calibration suite lives alongside the unit tests but is marked so it does not run in the standard `vitest run` pass (it requires LLM API access and a fixed seed):

```
app/lib/essence/__tests__/
  calibration/
    corpus/
      orientation-calibration.ts   ← versioned entries + CORPUS_VERSION
    orientation-calibration.test.ts ← architectural assertions (run in CI)
    orientation-baseline.run.ts    ← full TP/FP measurement (run manually / on demand)
```

**`orientation-calibration.test.ts`** runs in CI and asserts only the architectural requirements (§4): provenance invariant, weight range, `inferredBy` format, and non-degradation on explicit entries. It mocks the LLM client for the LLM provider tests.

**`orientation-baseline.run.ts`** is not a vitest suite. It calls the real LLM, records output to `orientation-baseline-results.json`, and prints the §6 table. It is run manually when updating the baseline.

---

## 9. Open Questions

These must be resolved before the corpus can be authored:

- **Q1** — How many dimensions need full coverage on the first corpus, versus which can start with `explicit` entries only?
- **Q2** — What is the target Hebrew-to-English ratio in the corpus? Rule patterns already have Hebrew coverage; LLM should be tested separately.
- **Q3** — Should `ambiguous` entries be excluded from automated TP/FP measurement, or scored against `any_of` gold labels?
- **Q4** — What is the policy for contradictory signals in a single user message (e.g. both `brief` and `explanatory` triggered)? Score both correct, or require a primary?
