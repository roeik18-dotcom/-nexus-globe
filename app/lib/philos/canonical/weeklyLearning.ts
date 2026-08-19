/**
 * PHILOS Canonical layer — Weekly Learning summary (P2).
 *
 * Pure fold over already-real data — `ActionLifecycleSummary`
 * (`canon/actionLifecycle.ts`) and `CanonicalInstance` history
 * (`personInstance.ts`) — filtered to a real 7-day window ending at a
 * caller-supplied `now`. No new store, no invented rollup: every count
 * here is a real `.filter().length` over already-persisted records, same
 * discipline `buildDomainStateTimeline`/`buildBrainDerivation` already
 * established. When the window has no real activity, every field is
 * honestly empty/zero — never backfilled with a plausible-looking number.
 *
 * **`state_transitions_this_week` is a MEASUREMENT pair, not a canonical
 * State′ transition.** Each entry is two consecutive real DomainState
 * READINGS of the SAME parameter, taken from `instance.history`. Nothing
 * here derives, gates or asserts a `State → State'` transition: no
 * canonical persistence/update contract for State′ exists at all
 * (`canon/STATE-TRANSITION-BOUNDARY.md`). The field name is kept for
 * compatibility with its existing callers/tests; the UI
 * (`app/hub/WeeklyLearningPanel.tsx`) states what it actually is.
 */
import type { ActionLifecycleSummary } from "../canon/actionLifecycle";
import type { PersonInstance, ValueDomainInstance } from "./personInstance";
import type { SourceKind } from "./sourceKind";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface StateTransitionInWindow {
  domain_id: string;
  parameter_id: string;
  from_level: number | null;
  to_level: number;
  observed_at: string;
}

export interface WeeklyLearningSummary {
  subject_id: string;
  window_start: string;
  window_end: string;
  source_kind: SourceKind;
  actions_this_week: number;
  effects_verified_this_week: number;
  effects_claimed_only_this_week: number;
  state_transitions_this_week: StateTransitionInWindow[];
  evidence_this_week: string[];
  open_loops: { no_effect_recorded: number; effect_claimed_only: number };
  unresolved_unknowns: string[];
  carry_forward_priorities: string[];
}

function inWindow(iso: string, startMs: number, endMs: number): boolean {
  const t = Date.parse(iso);
  return Number.isFinite(t) && t >= startMs && t <= endMs;
}

/**
 * The one Weekly Learning derivation. Pure — no I/O, no clock of its own
 * (`now` is caller-supplied, same discipline as every other real
 * derivation in this directory).
 */
export function buildWeeklyLearningSummary(params: {
  subject_id: string;
  now: string;
  lifecycle: ActionLifecycleSummary;
  instances: readonly (PersonInstance | ValueDomainInstance)[];
  unresolvedUnknowns: readonly string[];
  nextActionLabel?: string | null;
}): WeeklyLearningSummary {
  const { subject_id, now, lifecycle, instances, unresolvedUnknowns, nextActionLabel } = params;
  const endMs = Date.parse(now);
  const startMs = endMs - WEEK_MS;
  const window_start = new Date(startMs).toISOString();
  const window_end = new Date(endMs).toISOString();

  const actionsInWindow = lifecycle.actions.filter((a) => inWindow(a.action.recorded_at, startMs, endMs));
  const effectsInWindow = actionsInWindow.flatMap((a) => a.effects.filter((e) => inWindow(e.effect.recorded_at, startMs, endMs)));

  const state_transitions_this_week: StateTransitionInWindow[] = [];
  const evidenceSet = new Set<string>();
  for (const instance of instances) {
    // Real chronological history for this domain, grouped by parameter_id
    // so "from" always means the immediately-prior REAL reading for the
    // SAME parameter — never a cross-parameter comparison.
    const byParam = new Map<string, typeof instance.history>();
    for (const h of instance.history) {
      const list = byParam.get(h.parameter_id) ?? [];
      list.push(h);
      byParam.set(h.parameter_id, list);
    }
    for (const [parameter_id, readings] of byParam) {
      const sorted = [...readings].sort((a, b) => a.observed_at.localeCompare(b.observed_at));
      for (let i = 0; i < sorted.length; i++) {
        const cur = sorted[i];
        if (cur.evidence && inWindow(cur.observed_at, startMs, endMs)) evidenceSet.add(cur.evidence);
        if (!inWindow(cur.observed_at, startMs, endMs)) continue;
        const prev = i > 0 ? sorted[i - 1] : null;
        state_transitions_this_week.push({
          domain_id: instance.domain_id, parameter_id,
          from_level: prev ? prev.level : null, to_level: cur.level, observed_at: cur.observed_at,
        });
      }
    }
  }

  return {
    subject_id, window_start, window_end, source_kind: "CANON",
    actions_this_week: actionsInWindow.length,
    effects_verified_this_week: effectsInWindow.filter((e) => e.verified).length,
    effects_claimed_only_this_week: effectsInWindow.filter((e) => !e.verified).length,
    state_transitions_this_week,
    evidence_this_week: [...evidenceSet],
    open_loops: { no_effect_recorded: lifecycle.counts.no_effect_recorded, effect_claimed_only: lifecycle.counts.effect_claimed_only },
    unresolved_unknowns: [...unresolvedUnknowns],
    carry_forward_priorities: nextActionLabel ? [nextActionLabel] : [],
  };
}
