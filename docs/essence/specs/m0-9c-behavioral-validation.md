# M0-9C — Behavioral Validation and Calibration Spec

**Status:** Design spec fully locked. Performance thresholds TBD pending baseline run.  
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
  language: 'he' | 'en';          // 'he' = reference; 'en' = parity subset
  pairId?: string;                 // links an 'en' entry to its 'he' source (same goldLabel)
  userMessage: string;
  assistantResponse: string;       // disambiguation context only
  goldLabel: GoldLabel;
  secondarySignals?: Array<{ candidateValue: string }>;
  deprecated?: true;               // set when entry is superseded; never deleted
}

// Categories are split by their role in measurement (see §2.5):
//   Measurement set — explicit, implied, negative, adversarial
//   Evaluation set only — ambiguous, contradiction
type CorpusCategory =
  | 'explicit'      // user states preference directly
  | 'implied'       // preference inferable without direct statement
  | 'negative'      // no preference signal present
  | 'adversarial'   // signal in assistantResponse only — must not produce output
  | 'ambiguous'     // genuinely uncertain; evaluation set only (not in FP/FN)
  | 'contradiction' // user message contradicts itself; evaluation set only

type GoldLabel =
  | { kind: 'signal'; candidateValue: string; minWeight: number }
  | { kind: 'no_signal' }
  | { kind: 'eval_only' }          // ambiguous / contradiction entries carry this label
```

### 2.2 Entry IDs (locked)

Entry IDs use the format `OD-NNN` (zero-padded three digits, e.g. `OD-001`). IDs are assigned sequentially and permanently. A deprecated entry keeps its ID forever — IDs are never recycled. Historical baseline reports reference entries by ID; recycling would corrupt comparisons.

English parity entries share the same `OD-NNN` space as Hebrew entries (they do not have a separate counter). The `pairId` field on an English entry references its Hebrew source ID.

### 2.3 Authoring Rules (locked)

- Gold labels are set **manually** before any provider sees the corpus. They must not be derived from provider output.
- Each gold label that expects a signal includes a `minWeight` floor derived from the weight regime (explicit → 1.0, implied → 0.7, inference → 0.5). A provider producing a signal below `minWeight` fails that entry.
- `assistantResponse` in `adversarial` entries **must** contain a plausible-looking preference phrase. The gold label is always `no_signal`.
- `negative` entries must not be borderline — if a reviewer would hesitate, reclassify as `ambiguous`.

### 2.4 Versioning (locked)

- The corpus lives at `app/lib/essence/__tests__/corpus/orientation-calibration.ts`.
- Each entry carries a `version` field; the file carries a `CORPUS_VERSION` constant.
- Entries are **append-only**: existing `id` values are never deleted or relabeled. A label correction creates a new entry with a new `id` and marks the old one `deprecated: true`.
- Corpus changes require a reviewer sign-off separate from code review.

### 2.5 Measurement Set vs Evaluation Set (locked)

The corpus is partitioned into two roles that must not be conflated:

**Measurement set** — `explicit`, `implied`, `negative`, `adversarial`  
Used to compute TP/FP rates, set Acceptance Criteria, and gate CI. A provider either meets the threshold on this set or fails.

**Evaluation set** — `ambiguous`, `contradiction`  
Used to track drift, compare providers across releases, and inform prompt tuning. Provider output on these entries is **recorded but never used to pass or fail a run**. This prevents prompt changes from causing instability in metrics derived from genuinely indeterminate inputs.

The baseline table (§6) contains rows only for the measurement set. Evaluation-set results are recorded in a separate section of `orientation-baseline-results.json` for human review.

### 2.6 Multi-Signal Entries (locked)

A single `userMessage` may legitimately express preferences for more than one `candidateValue` within the same dimension (e.g., `brief` and `explanatory` from the same message). This is not a corpus error or a provider failure.

For such entries, the gold label carries a single `candidateValue` representing the **dominant** preference. The entry may carry a `secondarySignals` annotation for reference:

```typescript
interface CorpusEntry {
  // ...
  secondarySignals?: Array<{ candidateValue: string }>;
}
```

Providers are scored on the gold label only. Secondary signals are informational and not used in FP/FN computation. The architectural invariant (§4.7) separately asserts that providers are **permitted** to emit multiple signals per dimension per observation.

### 2.7 Dimension Coverage (locked)

The v1 corpus **must** provide at least one `explicit` (Positive) and one `negative` entry for every `OrientationDimensionKey`. No dimension may be absent from the first corpus version.

Density — number of entries per dimension beyond this floor — is incremental and may grow across corpus versions without structural changes. Coverage is not incremental: a corpus missing any dimension produces a baseline that cannot be compared to future baselines.

```
[TBD] Target entries per dimension beyond the mandatory floor (set after v1 baseline)
[TBD] Minimum entries in evaluation set (ambiguous) per dimension
```

### 2.8 Language Coverage (locked)

Hebrew is the reference language. All primary corpus entries are authored in Hebrew.

English validation uses a **parity subset**: faithful translations of existing Hebrew corpus entries, not an independent corpus. The purpose is behavioral invariant verification, not linguistic accuracy measurement. A parity subset entry must share the same `dimension`, `category`, and `goldLabel` as its Hebrew source. It carries a `pairId` linking it to the source entry.

Cross-language parity is evaluated by comparing provider behavior on the Hebrew entry and its English translation. A divergence in signal emission or weight between the pair indicates a language-sensitivity issue, not necessarily a performance regression.

```
[TBD] Minimum parity subset size (set after v1 baseline; not required to cover all entries)
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

### 4.6 Multi-Signal Emission (locked)

Providers are explicitly permitted to emit more than one signal per `OrientationDimensionKey` from a single observation. There is no architectural invariant of "one signal per dimension per observation."

**Rationale:** human preferences are contextual. A user may express both `brief` (default) and `explanatory` (when learning) in the same message. Suppressing either signal would lose information. Downstream resolution — when two signals for the same dimension reach the accumulator — is handled by weight accumulation and the ProposalEngine, not by the provider.

**Verification:** the calibration suite must not assert that `signals.filter(s => s.dimensionKey === key).length <= 1`. Any such assertion is a spec violation.

### 4.7 `inferredBy` Provenance Format

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

Measurement set only (`explicit`, `implied`, `negative`, `adversarial`). Evaluation-set results (`ambiguous`, `contradiction`) are recorded separately in `orientation-baseline-results.json`.

| Provider | Category | TP rate | FP rate | Notes |
|---|---|---|---|---|
| Rule | explicit | [TBD] | [TBD] | |
| Rule | implied | [TBD] | [TBD] | |
| Rule | negative | — | [TBD] | |
| Rule | adversarial | — | must be 0 | architectural (§4.1) |
| LLM | explicit | [TBD] | [TBD] | |
| LLM | implied | [TBD] | [TBD] | |
| LLM | negative | — | [TBD] | |
| LLM | adversarial | — | must be 0 | architectural (§4.1) |
| Composite | explicit | [TBD] | [TBD] | |
| Composite | implied | [TBD] | [TBD] | |
| Composite | negative | — | [TBD] | |
| Composite | adversarial | — | must be 0 | architectural (§4.1) |

Corpus version at baseline: [TBD]  
Date: [TBD]  
Models: Rule `rule-based@1`, LLM `claude-haiku-4-5-20251001`

---

## 7. Corpus Build Phases

The corpus is built in three phases. Phase 1 produces the first runnable baseline; Phases 2 and 3 expand density without breaking comparability.

### Phase 1 — Golden Corpus (minimum viable baseline)

One `explicit` Positive and one `negative` entry per `OrientationDimensionKey`, all in Hebrew. With five dimensions this yields ten Hebrew entries. English parity entries are created immediately after as faithful translations linked via `pairId`.

Goal: a runnable, comparable baseline — not a large corpus. A minimal corpus with reliable gold labels is more valuable than a large corpus with uncertain ones.

### Phase 2 — Dimension Completion

For each dimension, add the remaining categories systematically:

| Category | Role |
|---|---|
| `implied` Positive | measurement set |
| `adversarial` | measurement set (provenance invariant) |
| `ambiguous` | evaluation set only |
| `contradiction` / multi-signal | evaluation set only |

Each dimension reaches a consistent structure. All additions are backward-compatible (existing IDs unchanged).

### Phase 3 — Baseline and Threshold Locking

Performance thresholds are set by measurement, never by estimation:

1. **Run Rule alone** — record TP/FP rates per category.
2. **Run LLM alone** — record TP/FP rates per category at `temperature: 0`.
3. **Run Composite** — record TP/FP rates and verify §4.5 (non-degradation).
4. **Fill §6 baseline table.**
5. **Propose thresholds** — set each threshold as `measured_rate + tolerance_margin` (margin is an explicit editorial choice, justified in the PR).
6. **Lock thresholds** — merge the update to this document. From this point forward, any run that exceeds a threshold is a CI failure.

Steps 1–4 must be completed before any threshold is written. Proposed thresholds from step 5 require explicit reviewer sign-off.

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

## 9. Resolved Decisions

- **Q3 — `ambiguous` entries in FP/FN measurement** (resolved)  
  `ambiguous` and `contradiction` entries are **evaluation set only**. They are never included in FP/FN computation or Acceptance Criteria. They are recorded separately in baseline results for drift tracking and provider comparison. This prevents prompt changes from producing unstable metrics derived from genuinely indeterminate inputs. See §2.5.

- **Q4 — Contradictory signals from the same observation** (resolved)  
  Contradictory signals from the same observation are not a provider failure. A message may legitimately express multiple preferences for the same dimension (e.g., `brief` by default, `explanatory` when learning). Providers may emit both signals. The Accumulator and ProposalEngine resolve them downstream via weight accumulation. There is no architectural invariant of "one signal per dimension per observation." Corpus entries with multi-signal potential carry a dominant gold label for scoring and optional `secondarySignals` annotations for reference. See §2.6 and §4.6.

- **Q1 — Dimension coverage in v1** (resolved)  
  Full coverage from v1. Every `OrientationDimensionKey` must appear in the first corpus with at least one Positive (`explicit`) and one Negative entry. Corpus density is incremental; dimension coverage is not. A baseline missing any dimension cannot be compared to future baselines. See §2.7.

- **Q2 — Hebrew / English language policy** (resolved)  
  Hebrew is the reference language. The primary corpus is authored in Hebrew. English validation uses a parity subset of faithful translations of existing Hebrew entries, carrying the same `goldLabel` and linked via `pairId`. The goal is behavioral invariant verification across languages, not linguistic accuracy measurement. A divergence between a Hebrew entry and its English pair indicates language-sensitivity, not a performance regression. See §2.8.
