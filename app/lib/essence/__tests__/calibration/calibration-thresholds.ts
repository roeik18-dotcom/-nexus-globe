/**
 * M0-9C5 — Calibration Thresholds
 *
 * Provisional CI gates for orientation inference providers.
 * Thresholds are measured from baseline-001 (corpus v1.0.0) and set as
 * `measured_rate ± tolerance_margin` per §7.3 of the behavioral validation spec.
 *
 * Gate semantics:
 *   minTpRate  — minimum fraction of entries whose expected signals were all
 *                detected with weight ≥ minWeight. Failure = FN regression.
 *   maxFpRate  — maximum fraction of entries that emitted a forbidden signal.
 *                Failure = FP regression.
 *   minSampleSize — CI fails if the relevant measurement set has fewer than this
 *                   many entries. Prevents thresholds from being satisfied on an
 *                   empty corpus.
 *
 * Provisional status:
 *   These thresholds are pinned to corpusVersion 1.0.0 (Phase 1 — 10 explicit +
 *   10 negative entries). They MUST be revisited when the corpus grows, because
 *   90% on 10 entries (= 9/10) is not equivalent to 90% on 50 entries (= 45/50).
 *   Add a `minSampleSize` floor per category before each corpus expansion.
 *
 * Update policy (§4.3):
 *   Any change to this file requires re-running orientation-baseline.run.ts and
 *   updating the baseline table in m0-9c-behavioral-validation.md §6 in the same PR.
 *   Numeric changes also require explicit reviewer sign-off (§7.3).
 */

export const CALIBRATION_THRESHOLDS = {
  /** Threshold policy version — bump when thresholds change, even within same corpus. */
  version:       '1.0.0',
  /** Corpus version these thresholds were measured from. */
  corpusVersion: '1.0.0',
  /** Phase 1 provisional. Revisit when any category reaches ≥ 20 entries. */
  provisional:   true,

  rule: {
    explicit: {
      /** Floor: measured 100%, margin −10%. */
      minTpRate:     0.90,
      /** Prevents threshold from being satisfied on an empty corpus. */
      minSampleSize: 1,
    },
    negative: {
      /** Ceiling: measured 0%, margin +10%. */
      maxFpRate:     0.10,
      minSampleSize: 1,
    },
  },

  llm:       null, // TBD — pending LLM baseline run with ANTHROPIC_API_KEY
  composite: null, // TBD — pending Composite baseline run (§4.4 non-degradation)
} as const;
