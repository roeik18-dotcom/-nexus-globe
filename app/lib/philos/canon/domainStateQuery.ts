/**
 * Philos Canon — DomainState query functions: the real prior-state
 * lookup and history projection over the DomainState backbone
 * (`domainStateStore.ts`). Pure, deterministic, no I/O — same discipline
 * as `cellStateDerivation.ts`'s own real prior-state lookup for canon
 * Observations, applied to the parameter-scoped model instead.
 *
 * **Why this is a SEPARATE function from `deriveCellStateForPersistedObservation`,
 * never a shared one:** that function returns a canon `CellState`
 * (`{domain: "G"|"E"|"C", frame: "I"|"R"|"S", level, stability}`) — the
 * exact shape `recordLearning`'s `priorState: CellState` parameter
 * requires. `DomainState` has no `frame` and no `stability`; it is
 * scoped by `parameter_id`, not by (domain, frame). Forcing a
 * parameter-scoped reading into a domain/frame cell would require
 * INVENTING a mapping no real product decision has ever made — exactly
 * what this pass's own product decision forbade ("do not fabricate a
 * parameter mapping"). Canon's `recordLearning`/`CellState` model and
 * this DomainState backbone are two real, deliberately un-merged
 * schemas — same boundary `valueDomainConfig.ts`'s own header draws
 * between canon and this generic contract. This module never imports
 * from `cellStateDerivation.ts` or `learning.ts`, and nothing here
 * produces a `CellState`.
 */
import type { DomainParameter, DomainState, ValueDomainConfigInstance } from "../valueDomain/valueDomainConfig";
import type { DomainStateRecord } from "./domainStateStore";

/**
 * The most recent real DomainState for this EXACT (subject, domain_id,
 * parameter_id), strictly before `before` (or the most recent overall
 * when `before` is omitted) — chronological only, never causal, same
 * "prior vs current" discipline every other real lookup in this
 * codebase already uses. Returns `null` when genuinely none exists —
 * never synthesized.
 */
export function findLatestDomainState(
  records: readonly DomainStateRecord[],
  subject: string,
  domain_id: string,
  parameter_id: string,
  before?: string,
): DomainState | null {
  const matching = records
    .map((r) => r.state)
    .filter((s) => s.subject === subject && s.domain_id === domain_id && s.parameter_id === parameter_id)
    .filter((s) => (before === undefined ? true : s.observed_at <= before))
    .sort((a, b) => b.observed_at.localeCompare(a.observed_at));
  return matching[0] ?? null;
}

export interface DomainStateTimelinePoint {
  level: number;
  confidence: number;
  observed_at: string;
  evidence?: string;
  /** Phase 4/8 — this reading's own `CanonicalRef` formatted strings
   *  (`DomainState.source_refs`, `canonical/canonicalRef.ts`), carried
   *  through verbatim so a UI showing this timeline point can also show
   *  which real Source Lock record(s) it cites. `undefined` for a reading
   *  recorded before this field existed, or one that cited none. */
  source_refs?: string[];
  /** This point's real delta from the immediately-prior real reading for
   *  the same (subject, domain_id, parameter_id) — `null` for the first
   *  real reading (no prior to compare against, not a fabricated zero). */
  delta_from_prior: number | null;
}

/**
 * The real chronological history for one (subject, domain_id,
 * parameter_id) — what Dynamics consumes instead of a second timeline
 * store (the mission's own explicit requirement). Every point is a real
 * persisted record; delta is computed, never invented, and `null` for
 * the first point.
 */
export function buildDomainStateTimeline(
  records: readonly DomainStateRecord[],
  subject: string,
  domain_id: string,
  parameter_id: string,
): DomainStateTimelinePoint[] {
  const chronological = records
    .map((r) => r.state)
    .filter((s) => s.subject === subject && s.domain_id === domain_id && s.parameter_id === parameter_id)
    .sort((a, b) => a.observed_at.localeCompare(b.observed_at));
  let prior: DomainState | null = null;
  const out: DomainStateTimelinePoint[] = [];
  for (const s of chronological) {
    out.push({
      level: s.level,
      confidence: s.confidence,
      observed_at: s.observed_at,
      evidence: s.evidence,
      source_refs: s.source_refs,
      delta_from_prior: prior ? s.level - prior.level : null,
    });
    prior = s;
  }
  return out;
}

/** Every distinct real (domain_id, parameter_id) pair this subject has
 *  at least one real reading for — the honest "what do we actually know
 *  about this subject" index, never the full catalog of possible
 *  parameters (which would include ones with zero real readings). */
export function domainStateParametersForSubject(records: readonly DomainStateRecord[], subject: string): { domain_id: string; parameter_id: string }[] {
  const seen = new Map<string, { domain_id: string; parameter_id: string }>();
  for (const r of records) {
    if (r.state.subject !== subject) continue;
    const key = `${r.state.domain_id}::${r.state.parameter_id}`;
    if (!seen.has(key)) seen.set(key, { domain_id: r.state.domain_id, parameter_id: r.state.parameter_id });
  }
  return [...seen.values()];
}

export interface DomainStateProjectionRow {
  domain_id: string;
  parameter_id: string;
  /** Chronological, real, never fabricated — see `buildDomainStateTimeline`. */
  timeline: DomainStateTimelinePoint[];
}

/**
 * The real per-parameter projection any terminal (Dynamics, or any future
 * consumer) needs to show "prior state → current state → delta" for one
 * subject, across EVERY domain that subject has real state in — Human and
 * Value alike, same query path, no domain special-cased. A pure
 * composition of `domainStateParametersForSubject` +
 * `buildDomainStateTimeline`, both already real/tested — this adds no new
 * derivation, only the "for every real parameter, build its timeline"
 * loop a caller would otherwise have to duplicate.
 */
export function buildDomainStateProjectionRows(records: readonly DomainStateRecord[], subject: string): DomainStateProjectionRow[] {
  return domainStateParametersForSubject(records, subject).map(({ domain_id, parameter_id }) => ({
    domain_id,
    parameter_id,
    timeline: buildDomainStateTimeline(records, subject, domain_id, parameter_id),
  }));
}

/**
 * The one real `valueDomain` param `buildCarryForward` accepts — extracted
 * verbatim from `/hub/page.tsx`'s original inline construction (state-
 * fusion backbone pass) so every caller (Hub, now Dynamics) shares ONE
 * resolver instead of independently re-deriving the same shape. When the
 * subject has real DomainState in more than one domain_id, the most
 * recently-observed domain wins — a real, non-arbitrary "what's most
 * relevant right now" criterion, not a guess. `actionResults` stays
 * empty — 0 real `DomainActionResult` records exist yet, so this
 * surfaces real PRIOR state without fabricating today's advancement.
 * Returns `undefined` exactly when the subject has no real DomainState
 * at all — never a synthesized empty config.
 */
export function resolveValueDomainParam(
  subject: string,
  records: readonly DomainStateRecord[],
): { config: ValueDomainConfigInstance; subject: string } | undefined {
  const mine = records.filter((r) => r.state.subject === subject);
  if (mine.length === 0) return undefined;
  const mostRecentDomainId = [...mine].sort((a, b) => b.state.observed_at.localeCompare(a.state.observed_at))[0].state.domain_id;
  const statesForDomain = mine.filter((r) => r.state.domain_id === mostRecentDomainId).map((r) => r.state);
  const parameterIds = [...new Set(statesForDomain.map((s) => s.parameter_id))];
  const parameters: DomainParameter[] = parameterIds.map((pid) => ({
    parameter_id: pid, domain_id: mostRecentDomainId, label: pid, definition: "real parameter, recorded via /hub/human-config", provenance: "REAL",
  }));
  return {
    subject,
    config: {
      domain: { domain_id: mostRecentDomainId, label: mostRecentDomainId, provenance: "REAL" },
      parameters, states: statesForDomain,
      capabilities: [], gaps: [], acceptanceCriteria: [], actionResults: [],
    },
  };
}
