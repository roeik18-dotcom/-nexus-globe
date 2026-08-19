/**
 * PHILOS Canonical layer — PersonInstance / ValueDomainInstance (Phase 4 §2).
 *
 * Both are pure, in-memory PROJECTIONS over the SAME already-real,
 * already-persisted `DomainStateStore` (`canon/domainStateStore.ts`, reused
 * verbatim — no new store, per Phase 4 §4) plus a caller-supplied list of
 * `CanonicalRef`s. Neither type has its own store, its own file, or its own
 * append path: building one is a read, never a write.
 *
 * **"Store refs only. NEVER copy SOURCE_TEXT into runtime instances"** —
 * enforced structurally: `source_refs` on both types is `string[]`
 * (`CanonicalRef` formatted strings only, via `formatCanonicalRef`). No
 * field anywhere on `CanonicalInstance` can hold a `HumanMasterRecord`/
 * `MusicMasterRecord`/`ColorMasterRecord`, so there is no field to
 * accidentally assign a `SOURCE_TEXT` value into. A UI that wants to show
 * the real source text for a ref resolves it separately, on demand, via
 * `canonicalRef.ts::resolveCanonicalRef` (whose own resolved type also has
 * no `SOURCE_TEXT` field) or a kind-specific loader — never through this
 * module.
 *
 * **`PersonInstance` vs `ValueDomainInstance`** — structurally identical
 * (both are a `CanonicalInstance`), kept as two distinct, non-interchangeable
 * types (not a type alias) for the same reason `DomainState`/`CellState`
 * stay two distinct types elsewhere in this codebase: a `PersonInstance`
 * projects Human-domain state for one subject; a `ValueDomainInstance`
 * projects one Value Domain's (e.g. Music) state for one subject. Nothing
 * here would ever accept one where the other is expected — enforced by the
 * `kind` discriminant field, checked by `buildPersonInstance`/
 * `buildValueDomainInstance` themselves (never left to the caller to get
 * right).
 *
 * **`current_state`/`changed`/`confidence`/`timestamp` describe the single
 * MOST RECENTLY OBSERVED reading across the whole domain** — the same "most
 * recently observed wins" real, non-arbitrary criterion
 * `domainStateQuery.ts::resolveValueDomainParam` already uses (never an
 * invented aggregate/average across parameters — this codebase's own
 * anti-aggregation discipline, `valueDomainConfig.ts`'s header). `changed`
 * compares that one reading against the immediately-PRIOR real reading for
 * the SAME `parameter_id` only (chronological, never cross-parameter) —
 * `false`, not `null`, when there is nothing to compare against yet (no
 * second reading exists), since the Phase 4 field list types `changed` as a
 * plain boolean.
 */
import type { DomainStateRecord } from "../canon/domainStateStore";
import {
  buildDomainStateTimeline,
  domainStateParametersForSubject,
  type DomainStateTimelinePoint,
} from "../canon/domainStateQuery";
import { formatCanonicalRef, type CanonicalRef } from "./canonicalRef";
import type { SourceKind } from "./sourceKind";

export interface CanonicalStateSnapshot {
  parameter_id: string;
  level: number;
  confidence: number;
  observed_at: string;
  /** Real evidence citation for this one reading — `undefined` when the
   *  underlying `DomainState.evidence` was itself absent (never
   *  fabricated). */
  evidence?: string;
  /** This one reading's own real `CanonicalRef` strings — `undefined` when
   *  the underlying `DomainState.source_refs` was itself absent. */
  source_refs?: string[];
}

interface CanonicalInstanceBase {
  id: string;
  subject_id: string;
  domain_id: string;
  source_kind: SourceKind;
  /** `CanonicalRef` strings only (`HUMAN:12`, `MUSIC:GEN-MU-PROC-04`,
   *  `COLOR:6`) — never a resolved record, never `SOURCE_TEXT`. */
  source_refs: string[];
  /** One entry per `parameter_id` this subject has a real reading for in
   *  this domain — always that parameter's LATEST real reading. Empty when
   *  the subject has no real DomainState in this domain yet (never
   *  fabricated). */
  current_state: CanonicalStateSnapshot[];
  /** The full real chronological reading log across every parameter in
   *  this domain — ascending by `observed_at`, same order
   *  `buildDomainStateTimeline` already establishes. */
  history: CanonicalStateSnapshot[];
  /** Deduplicated, non-empty evidence citations pulled from `history` —
   *  never invented, never one per reading if the same citation repeats. */
  evidence: string[];
  /** `observed_at` of the single most-recently-observed reading in
   *  `history`, or the caller-supplied `asOf` fallback when `history` is
   *  empty (no real reading exists yet to date this instance by). */
  timestamp: string;
  /** `confidence` of that same most-recent reading, or `0` when none
   *  exists — `0` here means "no real reading," not "measured and low." */
  confidence: number;
  /** Whether that most-recent reading's `level` differs from the
   *  immediately-prior real reading for the SAME `parameter_id`. `false`
   *  when there is no prior reading to compare against. */
  changed: boolean;
}

export interface PersonInstance extends CanonicalInstanceBase {
  readonly kind: "person";
}

export interface ValueDomainInstance extends CanonicalInstanceBase {
  readonly kind: "value_domain";
}

function toSnapshot(point: DomainStateTimelinePoint, parameter_id: string): CanonicalStateSnapshot {
  return {
    parameter_id, level: point.level, confidence: point.confidence, observed_at: point.observed_at,
    evidence: point.evidence, source_refs: point.source_refs,
  };
}

interface BuildCanonicalInstanceParams {
  subject_id: string;
  domain_id: string;
  records: readonly DomainStateRecord[];
  source_kind: SourceKind;
  source_refs: readonly CanonicalRef[];
  asOf: string;
}

function buildCanonicalInstanceBase(params: BuildCanonicalInstanceParams): CanonicalInstanceBase {
  const { subject_id, domain_id, records, source_kind, source_refs, asOf } = params;

  const parameterIds = domainStateParametersForSubject(records, subject_id)
    .filter((p) => p.domain_id === domain_id)
    .map((p) => p.parameter_id);

  const timelinesByParam = new Map<string, DomainStateTimelinePoint[]>();
  for (const parameter_id of parameterIds) {
    timelinesByParam.set(parameter_id, buildDomainStateTimeline(records, subject_id, domain_id, parameter_id));
  }

  const history: CanonicalStateSnapshot[] = [];
  const current_state: CanonicalStateSnapshot[] = [];
  for (const [parameter_id, timeline] of timelinesByParam) {
    for (const point of timeline) history.push(toSnapshot(point, parameter_id));
    const latest = timeline[timeline.length - 1];
    if (latest) current_state.push(toSnapshot(latest, parameter_id));
  }
  history.sort((a, b) => a.observed_at.localeCompare(b.observed_at));

  const mostRecent = [...history].sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0] ?? null;

  let changed = false;
  if (mostRecent) {
    const ownTimeline = timelinesByParam.get(mostRecent.parameter_id) ?? [];
    const lastPoint = ownTimeline[ownTimeline.length - 1];
    changed = lastPoint ? lastPoint.delta_from_prior !== null && lastPoint.delta_from_prior !== 0 : false;
  }

  const evidence = [...new Set(history.map((h) => h.evidence).filter((e): e is string => !!e))];

  // Phase 8 — the real per-reading refs (`DomainState.source_refs`,
  // persisted by `stateLoop.ts`) are unioned with any caller-supplied
  // refs, never replaced by them — a caller may supply refs the domain
  // itself has no reading for yet (e.g. Color semantic metadata), while
  // real per-reading refs must always surface even when the caller passes
  // none.
  const refsFromHistory = history.flatMap((h) => h.source_refs ?? []);
  const allSourceRefs = [...new Set([...source_refs.map(formatCanonicalRef), ...refsFromHistory])];

  return {
    id: `${subject_id}::${domain_id}`,
    subject_id,
    domain_id,
    source_kind,
    source_refs: allSourceRefs,
    current_state,
    history,
    evidence,
    timestamp: mostRecent?.observed_at ?? asOf,
    confidence: mostRecent?.confidence ?? 0,
    changed,
  };
}

/** Projects Human-domain state for one subject — e.g. `domain_id:
 *  "human_temperament"`. Read-only; `records` is the caller's already-loaded
 *  `DomainStateRecord[]` (typically `findDomainStatesForSubject(subject_id)`
 *  — this function performs no I/O of its own). */
export function buildPersonInstance(params: BuildCanonicalInstanceParams): PersonInstance {
  return { kind: "person", ...buildCanonicalInstanceBase(params) };
}

/** Projects one Value Domain's (e.g. Music, `MUSIC_CANON_DOMAIN_ID`) state
 *  for one subject. Same contract as `buildPersonInstance`. */
export function buildValueDomainInstance(params: BuildCanonicalInstanceParams): ValueDomainInstance {
  return { kind: "value_domain", ...buildCanonicalInstanceBase(params) };
}
