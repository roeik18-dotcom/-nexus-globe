/**
 * Comparison — shared canonical ranking/comparison utilities (System-Wide
 * Build). ONE shape, reusable across Community/Person/Marketplace/Time —
 * never a page-specific opaque score. Every metric declares its own
 * `unit`/`time_range`/`provenance`, and a genuinely unavailable value is
 * `null` (rendered UNKNOWN), never silently `0` — a community with no
 * recorded impact is not the same fact as a community with zero impact by
 * measurement, and this module keeps that distinction structural, not a
 * per-caller convention.
 *
 * No overall/opaque score anywhere in this file — `CommunityComparison`
 * returns a `metrics[]` array, each independently labeled; a caller may
 * choose to highlight one, never a weighted sum this module invents.
 */
import type { ValueGroupView } from "./projectValueGroup";

export type MetricProvenance = "REAL" | "DEMO" | "UNKNOWN";

export interface ComparisonMetric {
  key: string;
  label: string;
  unit: string;
  time_range: string;
  provenance: MetricProvenance;
  /** `null` = genuinely unknown/not computed — NEVER rendered or ranked as 0. */
  value: number | null;
}

export interface CommunityComparison {
  subject_a: { id: string; label: string; provenance: MetricProvenance };
  subject_b: { id: string; label: string; provenance: MetricProvenance };
  metrics: { key: string; label: string; unit: string; a: ComparisonMetric; b: ComparisonMetric }[];
}

/**
 * Compares two `ValueGroupView`s on the real, compatible dimensions both
 * carry — treasury (received/spent/available), member count, real
 * allocations count, verified-impact count. Never compares communities on
 * an incompatible/invented dimension (e.g. "quality-group composition" —
 * no such data exists, see `CommunityCommandTerminal.tsx`'s own honest gap
 * note — so it is not offered here either).
 */
export function compareCommunities(
  a: ValueGroupView,
  aProvenance: MetricProvenance,
  b: ValueGroupView,
  bProvenance: MetricProvenance,
): CommunityComparison {
  const metricPair = (key: string, label: string, unit: string, valueA: number, valueB: number) => ({
    key,
    label,
    unit,
    a: { key, label, unit, time_range: `מ-${a.opened_at}`, provenance: aProvenance, value: valueA },
    b: { key, label, unit, time_range: `מ-${b.opened_at}`, provenance: bProvenance, value: valueB },
  });

  return {
    subject_a: { id: a.group_id, label: a.name, provenance: aProvenance },
    subject_b: { id: b.group_id, label: b.name, provenance: bProvenance },
    metrics: [
      metricPair("treasury_received", "התקבל בסה״כ", "₪", a.budget.received, b.budget.received),
      metricPair("treasury_spent", "הושקע", "₪", a.budget.spent, b.budget.spent),
      metricPair("treasury_available", "זמין", "₪", a.budget.available, b.budget.available),
      metricPair("members", "חברים", "אנשים", a.members.length, b.members.length),
      metricPair("allocations", "הצעות הקצאה", "מספר", a.allocations.length, b.allocations.length),
      metricPair("effects_verified", "Effect מאומתים", "מספר", a.impact.filter((i) => i.verified).length, b.impact.filter((i) => i.verified).length),
    ],
  };
}

/** Real, checked "which side wins" — `null` on either side means
 *  incomparable (UNKNOWN), never treated as a loss. */
export function winningSide(m: { a: ComparisonMetric; b: ComparisonMetric }): "a" | "b" | "tie" | "unknown" {
  if (m.a.value === null || m.b.value === null) return "unknown";
  if (m.a.value === m.b.value) return "tie";
  return m.a.value > m.b.value ? "a" : "b";
}

/**
 * A single subject's own baseline-vs-current comparison (e.g. a canon
 * domain's prior vs current Level, or a community's month-ago vs now) —
 * the one-sided counterpart to `compareCommunities`, same honesty rules.
 * `null` when no real baseline exists (never fabricated as 0).
 */
export interface BaselineComparison {
  key: string;
  label: string;
  unit: string;
  baseline: number | null;
  current: number | null;
  delta: number | null;
  provenance: MetricProvenance;
}

export function buildBaselineComparison(
  key: string,
  label: string,
  unit: string,
  baseline: number | undefined,
  current: number | undefined,
  provenance: MetricProvenance,
): BaselineComparison {
  const b = baseline ?? null;
  const c = current ?? null;
  return { key, label, unit, baseline: b, current: c, delta: b !== null && c !== null ? c - b : null, provenance };
}
