/**
 * PHILOS Canonical layer — Active Config (Person + Music activation pass).
 *
 * THE GAP THIS CLOSES: `PersonInstance`/`ValueDomainInstance` were built
 * everywhere with `source_refs: []` — Human (189 records) and Music (80
 * records) were loaded as Canon, yet the live runtime instances pointed at
 * NONE of it. This module builds the ACTIVE canonical reference set for
 * each domain, as refs only (`HUMAN:<SOURCE_NUMBER>` / `MUSIC:<SOURCE_NUMBER>`
 * via `formatCanonicalRef`), so every instance-building call site can pass
 * the same activated set instead of `[]`.
 *
 * AUTHORITY: this module is the RUNTIME GOVERNANCE authority for Human
 * Config — the only place activation happens. The ~1492-unit Production
 * corpus is a SEPARATE, co-equal SEMANTIC authority that cannot activate
 * anything here. Ratified dual-authority model, locked: see
 * `PHILOS-SOURCE-AUTHORITY-CONTRACT.md` and the bridge in
 * `humanConfig/crosswalk.ts`.
 *
 * WHAT "ACTIVE" MEANS — a MECHANICAL fold over the Source Locks' OWN two
 * classification fields (`TYPE`, `RUNTIME_STATUS`), never a hand-picked or
 * semantic selection invented here:
 *
 *   HUMAN  active := TYPE ∈ {STATIC_ATTRIBUTE, SCALE, DYNAMIC_PARAMETER}
 *                    AND RUNTIME_STATUS ≠ NOT_FOR_RUNTIME
 *          — the lock's own words for identity/profile/stable attributes
 *          (STATIC_ATTRIBUTE), relevant dimensions (SCALE) and available
 *          runtime parameters (DYNAMIC_PARAMETER). THEORY_REFERENCE /
 *          CLINICAL_REFERENCE / REVIEW_REQUIRED / QUESTION / SOURCE_GAP
 *          stay inactive: they describe knowledge ABOUT humans, open
 *          questions, or gaps — not this person's configuration. A record
 *          the lock itself marked NOT_FOR_RUNTIME is never activated,
 *          whatever its TYPE.
 *
 *   MUSIC  active := RUNTIME_STATUS = READY
 *                    AND TYPE ∈ {MUSIC_PREFERENCE, CAPABILITY,
 *                    WORKFLOW_STAGE, ENGINEERING_PARAMETER, SCALE,
 *                    SESSION_STATE_PARAMETER, PROJECT_STATE_PARAMETER,
 *                    ENVIRONMENT_STATE}
 *          — preferences, capabilities, the workflow model's stages, and
 *          the parameter DEFINITIONS (engineering/session/project/
 *          environment). THEORY_ONLY / QUESTION / SOURCE_GAP stay
 *          inactive.
 *
 * WHAT THIS IS NOT — the two rules the whole pass hangs on:
 *   1. Refs only. No `SOURCE_TEXT` ever leaves the loaders through this
 *      module — the return values are formatted ref strings plus the
 *      lock's own short classification words for grouping. Display labels
 *      come from `resolveCanonicalRef` at render time, whose result type
 *      structurally has no SOURCE_TEXT field.
 *   2. Config ≠ state. Activating `MUSIC:GEN-MU-PROC-04` (a WORKFLOW_STAGE)
 *      says "the workflow model KNOWS this stage exists" — it does NOT say
 *      the person is currently in it. Nothing here writes DomainState,
 *      nothing here becomes `current_state`, and no caller may treat an
 *      activated ref as an Observation. CURRENT STATE stays UNKNOWN until
 *      a real Observation/Evidence exists — the same honesty line every
 *      surface already draws.
 *
 * Pure, synchronous folds over the frozen locks (the loaders are sync
 * reads of the frozen JSON) — deterministic, no clock, no store.
 */
import { formatCanonicalRef, type CanonicalRef } from "./canonicalRef";
import { loadHumanMaster } from "./humanMasterLoader";
import { loadMusicMaster } from "./musicMasterLoader";

/** The Human TYPEs that describe THIS person's configuration (the lock's
 *  own vocabulary — see module header for why the others stay inactive). */
export const ACTIVE_HUMAN_TYPES = ["STATIC_ATTRIBUTE", "SCALE", "DYNAMIC_PARAMETER"] as const;

/** The Music TYPEs that describe known configuration (preferences,
 *  capabilities, workflow model, parameter definitions). */
export const ACTIVE_MUSIC_TYPES = [
  "MUSIC_PREFERENCE", "CAPABILITY", "WORKFLOW_STAGE", "ENGINEERING_PARAMETER",
  "SCALE", "SESSION_STATE_PARAMETER", "PROJECT_STATE_PARAMETER", "ENVIRONMENT_STATE",
] as const;

export interface ActiveConfigSet {
  /** Formatted `KIND:<SOURCE_NUMBER>` refs — the ONLY thing runtime
   *  instances store. Order = the lock's own SOURCE_ORDER (load order). */
  refs: string[];
  /** The same refs as structured `CanonicalRef` objects — the exact shape
   *  `buildPersonInstance`/`buildValueDomainInstance` take. */
  refObjects: CanonicalRef[];
  /** refs grouped by the lock's own TYPE word — for display grouping
   *  (preferences / capabilities / workflow …), never re-classified. */
  by_type: Record<string, string[]>;
  /** The lock's own RUNTIME_STATUS per ref — REVIEW stays visible as
   *  REVIEW, never silently promoted to ready. */
  status_by_ref: Record<string, string>;
  total_in_lock: number;
}

function fold(
  rows: { TYPE: string; RUNTIME_STATUS: string; refObject: CanonicalRef }[],
  totalInLock: number,
): ActiveConfigSet {
  const refs: string[] = [];
  const refObjects: CanonicalRef[] = [];
  const by_type: Record<string, string[]> = {};
  const status_by_ref: Record<string, string> = {};
  for (const r of rows) {
    const ref = formatCanonicalRef(r.refObject);
    refs.push(ref);
    refObjects.push(r.refObject);
    (by_type[r.TYPE] ??= []).push(ref);
    status_by_ref[ref] = r.RUNTIME_STATUS;
  }
  return { refs, refObjects, by_type, status_by_ref, total_in_lock: totalInLock };
}

// ── CONFIG QUESTIONS — "what may be ASKED", kept off the active set ────────

/**
 * One question a Source Lock declares. REFERENCE ONLY.
 *
 * These are the `TYPE = "QUESTION"` rows, and they are deliberately NOT in
 * `buildActivePersonRefs`/`buildActiveMusicRefs`: the active set feeds
 * `CanonicalInstance.source_refs`, and a question is not a configuration
 * fact ABOUT the person the way a STATIC_ATTRIBUTE or a parameter
 * definition is. Mixing them would quietly grow "what is known" by the
 * count of things that are merely askable.
 *
 * They are exposed here, separately, because they are the missing rung of
 * the config→runtime ladder:
 *
 *   CONFIG → **AVAILABLE / RELEVANT PARAMETER** → **QUESTION / INPUT** →
 *   OBSERVATION → MEASUREMENT → MEASURED STATE → ORIENTATION
 *
 * **A question is not an answer, and an answer is not a measurement.**
 * Nothing in this module records a response, derives an Observation, or
 * touches state. `humanConfig/parameterAcquisition.ts` is the real,
 * already-built mechanism for the next steps (SOURCE QUESTION ≠ USER
 * ANSWER ≠ OBSERVATION ≠ EVIDENCE ≠ STATE, four distinct types); it stays
 * unwired here on purpose — wiring it would mean creating subject
 * responses that nobody gave.
 *
 * `text` IS the row's own `SOURCE_HEADING` — the question as the source
 * phrases it. This is the one place a Source Lock's own words are exposed,
 * and it is limited to the heading of a QUESTION row for exactly that
 * reason: a question has to be readable to be askable. `SOURCE_TEXT` is
 * never returned (the no-SOURCE_TEXT-into-runtime rule stands — see
 * `personInstance.ts`); `note` carries the row's own short gloss instead.
 */
export interface ConfigQuestion {
  /** The formatted `KIND:<SOURCE_NUMBER>` ref, for citation. */
  ref: string;
  /** The question, verbatim from the row's own `SOURCE_HEADING`. */
  text: string;
  /** The row's own `SOURCE_SECTION` — where the question comes from. */
  section: string;
  /** The lock's own `RUNTIME_STATUS`, never re-labelled. */
  runtime_status: string;
}

function isRuntimeReadyQuestion(runtimeStatus: string): boolean {
  // Both locks' own vocabulary, used verbatim — Human writes
  // `RUNTIME_READY`, Music writes `READY`. Neither word is invented here,
  // and `NOT_FOR_RUNTIME` is never accepted.
  return runtimeStatus === "READY" || runtimeStatus === "RUNTIME_READY";
}

/** The Human Config's declared questions. REFERENCE only — see above. */
export function buildHumanConfigQuestions(): ConfigQuestion[] {
  return loadHumanMaster()
    .filter((r) => r.TYPE === "QUESTION" && isRuntimeReadyQuestion(r.RUNTIME_STATUS))
    .map((r) => ({
      ref: formatCanonicalRef({ kind: "HUMAN", source_number: String(r.SOURCE_NUMBER) }),
      text: String(r.SOURCE_HEADING),
      section: String(r.SOURCE_SECTION),
      runtime_status: r.RUNTIME_STATUS,
    }));
}

/** The Music Domain Config's declared questions. REFERENCE only. */
export function buildMusicConfigQuestions(): ConfigQuestion[] {
  return loadMusicMaster()
    .filter((r) => r.TYPE === "QUESTION" && isRuntimeReadyQuestion(r.RUNTIME_STATUS))
    .map((r) => ({
      ref: formatCanonicalRef({ kind: "MUSIC", source_number: r.SOURCE_NUMBER }),
      text: String(r.SOURCE_HEADING),
      section: String(r.SOURCE_SECTION),
      runtime_status: r.RUNTIME_STATUS,
    }));
}

/** The active Human config reference set — see module header for the rule. */
export function buildActivePersonRefs(): ActiveConfigSet {
  const all = loadHumanMaster();
  const rows = all
    .filter((r) => (ACTIVE_HUMAN_TYPES as readonly string[]).includes(r.TYPE) && r.RUNTIME_STATUS !== "NOT_FOR_RUNTIME")
    .map((r) => ({ TYPE: r.TYPE, RUNTIME_STATUS: r.RUNTIME_STATUS, refObject: { kind: "HUMAN" as const, source_number: String(r.SOURCE_NUMBER) } }));
  return fold(rows, all.length);
}

/** The active Music config reference set — see module header for the rule. */
export function buildActiveMusicRefs(): ActiveConfigSet {
  const all = loadMusicMaster();
  const rows = all
    .filter((r) => (ACTIVE_MUSIC_TYPES as readonly string[]).includes(r.TYPE) && r.RUNTIME_STATUS === "READY")
    .map((r) => ({ TYPE: r.TYPE, RUNTIME_STATUS: r.RUNTIME_STATUS, refObject: { kind: "MUSIC" as const, source_number: r.SOURCE_NUMBER } }));
  return fold(rows, all.length);
}
