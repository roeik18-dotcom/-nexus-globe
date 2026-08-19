/**
 * SystemContextRef — a POINTER into identifiers that already exist elsewhere
 * in the system, never a new identity registry or store (systemic-
 * integration-audit → "unified system context" design, first real slice).
 *
 * Deliberately minimal: carries only the bare identifier. Everything else a
 * surface might want to show (subject, domain, provenance, persisted/derived,
 * claimed/verified) is RESOLVED fresh from the real store the id already
 * belongs to — never duplicated into the ref/URL itself, so there is no
 * second copy of that data to go stale or disagree with the source of truth.
 *
 * Two real id spaces are represented, both already existing:
 *   - `canon_event_id` — canon's real, persisted identifier (`canonEvent.ts`).
 *     Canon's `Observation` has no separate `observation_id`; the CanonEvent
 *     id IS the observation's real identity — nothing invented by adding one.
 *   - `event_id` — the legacy Value-Group log's real identifier (`events.ts`).
 *
 * No id is ever minted here. `parseSystemContextRef` only recognizes an id
 * that was already typed/pasted/linked in — it does not generate one, and an
 * unrecognized or malformed string resolves to `"unknown"`, never guessed
 * into one of the two real kinds.
 */

import type { NeedRecord } from "./philos/canon/needStore";
import type { ActionLifecycleSummary } from "./philos/canon/actionLifecycle";
import type { ActionRecord } from "./philos/canon/actionStore";

export type SystemContextRef =
  | { kind: "canon_observation"; canon_event_id: string }
  | { kind: "legacy_event"; event_id: string }
  /** LOOP 0054 — canon `Action.action_id`, the SAME id `/marketplace`,
   *  `/dynamics`, and the Community/Globe canon activity sections
   *  (§0052/§0053) already render. No new id space. */
  | { kind: "action"; action_id: string }
  /** LOOP 0054 — canon `Effect.effect_id`, same discipline as above.
   *  Canon's `OutcomeVerification` (claimed/verified evidence) has no id
   *  field of its own (see `outcomeVerification.ts`'s own header) — it is
   *  never independently addressable, only ever resolved as part of its
   *  parent Effect's context. */
  | { kind: "effect"; effect_id: string }
  | { kind: "unknown"; raw: string };

/** `canon:<id>` / `event:<id>` / `action:<id>` / `effect:<id>` — plain,
 *  inspectable, no encoding scheme of its own. */
export function encodeSystemContextRef(ref: SystemContextRef): string {
  switch (ref.kind) {
    case "canon_observation":
      return `canon:${ref.canon_event_id}`;
    case "legacy_event":
      return `event:${ref.event_id}`;
    case "action":
      return `action:${ref.action_id}`;
    case "effect":
      return `effect:${ref.effect_id}`;
    case "unknown":
      return ref.raw;
  }
}

/**
 * Pure, no I/O. A string with no recognized `canon:`/`event:`/`action:`/
 * `effect:` prefix, or an empty id after the prefix, resolves to
 * `"unknown"` — never coerced into a guess at which real kind it might
 * have meant.
 */
export function parseSystemContextRef(raw: string | undefined | null): SystemContextRef | null {
  if (raw === undefined || raw === null || raw.trim() === "") return null;
  const idx = raw.indexOf(":");
  if (idx === -1) return { kind: "unknown", raw };
  const prefix = raw.slice(0, idx);
  const value = raw.slice(idx + 1).trim();
  if (!value) return { kind: "unknown", raw };
  if (prefix === "canon") return { kind: "canon_observation", canon_event_id: value };
  if (prefix === "event") return { kind: "legacy_event", event_id: value };
  if (prefix === "action") return { kind: "action", action_id: value };
  if (prefix === "effect") return { kind: "effect", effect_id: value };
  return { kind: "unknown", raw };
}

/**
 * SelectedContext — the ONE shared result shape a `?ctx=` resolution
 * produces, reused verbatim across every surface (Dynamics, Globe/Planet,
 * Marketplace).
 *
 * **Semantic-unity update (this slice):** resolution logic is now ALSO
 * shared, not just the output shape. `app/lib/philos/sharedContext.ts`'s
 * `resolveCoreContext` is the one function every surface calls — Dynamics'
 * `DynamicsViewModel` (event-keyed nodes/edges) is now the one legacy read
 * every surface resolves against, including Planet and Marketplace, which
 * previously ran their own poorer/divergent resolvers (Planet matched only
 * against `GlobeArc`, with no subject/timestamp/priorState/relationships;
 * Marketplace didn't compute relationships at all). The prior rationale for
 * three separate resolvers ("those shapes genuinely differ") turned out to
 * be true only of each surface's PRIMARY view data (Planet still separately
 * loads `GlobeArc`/`GlobeNode` to draw the sphere) — never of context
 * resolution itself, which only ever needed the same event/Observation
 * lookup everywhere. Duplicating it three ways was producing a different
 * answer to the same question depending which screen asked.
 *
 * `related` is intentionally a human-readable summary, not a raw edge/arc
 * type from either system. `null` means "no verified relationship exists
 * yet" — a real, checked absence, never a placeholder for one not looked up.
 *
 * `knownNeeds`/`actionSpace` (this slice): the VALUE/NEED and ACTION answers
 * are now part of the same shared projection too, computed once by
 * `resolveSharedContext` (the async wrapper around `resolveCoreContext`) and
 * consumed identically by Dynamics, Globe, and Marketplace — not
 * Marketplace-only as in the prior slice.
 */
export interface RelatedMarkSummary {
  description: string;
  event_id?: string;
}

/**
 * The most recent PRIOR record for the SAME real subject/entity, chronological
 * only — never a causal claim. Canon Observations already carry a real
 * `subject` and a real `time`; grouping by the field the schema already has
 * and ordering by the timestamp it already carries is a query over existing
 * data, not a new primitive. `null` means this was actually checked and none
 * exists (the honest "no prior verified state"), distinct from the field
 * being `undefined` (this resolver doesn't compute this at all).
 */
export interface PriorStateSummary {
  matched_id: string;
  label: string;
  observed_at: string;
  level?: number;
  stability?: number;
}

/** Plain arithmetic difference between two REAL persisted values — never a
 *  causal or significance claim, just "the number changed by this much". */
export interface StateDelta {
  level?: number;
  stability?: number;
}

/**
 * One real, directional relationship this item participates in, read
 * verbatim off an existing edge/arc — never a generic "connected". Replaces
 * flattening multiple real edges into one string: when several real
 * relationships exist, all are listed, each with its own real direction and
 * honesty axis.
 */
export interface RelationshipSummary {
  direction: "incoming" | "outgoing";
  other_id: string;
  other_label: string;
  relation_label: string;
  origin?: "explicit" | "inferred";
  evidence_level?: string;
}

/**
 * VALUE/NEED — a REAL, never-skipped read against the real Need store
 * (`app/lib/philos/canon/needStore.ts`), never a derived/inferred Need
 * silently treated as persisted. `checked: true, needs: []` is an honest
 * "looked, none exist" — distinct from `checked: false`, a real read
 * failure (e.g. a corrupt log), which must not be reported as if it had
 * found nothing.
 */
export type KnownNeedResult =
  | { needs: NeedRecord[]; checked: true }
  | { needs: []; checked: false; reason: string };

/**
 * ACTION SPACE — an honest admissibility summary, never a computed score.
 * `admissible` is only ever true once a real Need AND a real Offer both
 * exist for this context; `blockers` names exactly what's missing. Offer
 * persistence does not exist anywhere in this codebase yet, so `"Offer"` is
 * always a blocker today — stated, not hidden.
 */
export interface ActionSpaceSummary {
  admissible: boolean;
  blockers: string[];
}

export type SelectedContext =
  | { status: "none" }
  | { status: "unknown"; raw: string }
  | { status: "not_found"; ref: SystemContextRef }
  | {
      status: "found";
      ref: SystemContextRef;
      system: "canon" | "legacy";
      matched_id: string;
      label: string;
      domain: string;
      frame?: string;
      provenance: string;
      persisted_or_derived: string;
      claimed_or_verified: string;
      related: RelatedMarkSummary | null;
      /**
       * The real subject/actor string this record is about — canon
       * `Observation.subject`, or legacy `PhilosEvent.actor_id`. Both fields
       * already existed and were already read internally (for the prior-
       * state lookup); this just surfaces the value instead of discarding
       * it, so a THIRD surface (Marketplace) can check whether any real
       * Need/Offer/Provider elsewhere in the system names the same subject
       * — an honest lookup, not a new identifier.
       */
      subject?: string;
      /**
       * Real event/observation time. Populated by both resolvers as of the
       * "investigation surface" slice — `CanonObservationMark.observed_at`
       * for canon, the matched node/arc's real `timestamp` for legacy.
       */
      timestamp?: string;
      /**
       * STATE + TIME. `undefined` = this resolver doesn't compute state
       * history for this system (legacy events are discrete facts, not
       * repeated measurements, so this stays undefined there — see
       * `resolveContext`'s own note). `null` = genuinely checked, no prior
       * exists. An object = a real, found prior record.
       */
      priorState?: PriorStateSummary | null;
      delta?: StateDelta | null;
      /**
       * RELATIONSHIP TYPES. `undefined` = not computed by this resolver.
       * An empty array = genuinely checked, none exist — render as
       * "UNRESOLVED — no verified relationship", never hidden.
       */
      relationships?: RelationshipSummary[];
      /**
       * The CURRENT record's own Level/Stability/DeficitType — canon §4
       * defines Level as "signed deficit ← equilibrium → surplus"; this
       * surfaces that real field so a screen can state deficit/equilibrium/
       * surplus as a direct reading of canon's own definition (sign of
       * `level`), never an invented threshold. `undefined` for legacy
       * events, which carry no Level/Stability at all (a different
       * ontology — a discrete fact, not a cell measurement).
       */
      currentState?: { level: number; stability: number; deficitType?: string; confidence?: number };
      /**
       * `undefined` = not computed by this resolver call (e.g. the pure
       * `resolveCoreContext` path used directly by tests). Populated by
       * `resolveSharedContext`, the async wrapper every route calls.
       */
      knownNeeds?: KnownNeedResult;
      actionSpace?: ActionSpaceSummary;
      /**
       * ORIENTATION → ACTION → EFFECT → LEARNING, resolved against the SAME
       * `canon_event_id`/`subject` this context already resolved — no new id
       * space (`orientationActionBridge.ts`'s own no-parallel-ID discipline,
       * carried through to this shared shape). `undefined` = not computed by
       * this resolver call (e.g. `resolveCoreContext` used directly, or a
       * `legacy` system, which has no Action/Effect/Learning store at all).
       * Populated only by `resolveSharedContext`, for `system: "canon"`.
       */
      actionLifecycle?: ActionLifecycleSummary;
      /**
       * Real, stored Actions whose `inputs` explicitly names this context's
       * own `canon_event_id` — the reference-checked link, distinct from
       * `actionLifecycle` (subject-wide). Empty means genuinely checked,
       * none found. `undefined` = not computed (same scoping as
       * `actionLifecycle`).
       */
      relatedActions?: ActionRecord[];
    }
  /**
   * LOOP 0054 — a resolved canon Action or Effect entity, kept as a
   * SEPARATE `status` value (not folded into `"found"`/`system:"canon"`)
   * so every pre-existing `selected.status === "found"` consumer across
   * Dynamics/Globe/Marketplace is completely untouched — none of them
   * will ever see this new status unless explicitly checking for it, so
   * the existing canon-Observation/legacy-event behavior cannot regress.
   * Fields are deliberately narrower than the `"found"` shape above:
   * Action/Effect carry no domain/frame/CellState (canon's own schemas
   * genuinely have none — see `action.ts`/`effect.ts`), so this shape
   * does not pretend they do.
   */
  | {
      status: "found_entity";
      ref: SystemContextRef;
      entity_kind: "action" | "effect";
      matched_id: string;
      label: string;
      /** `Action.owner` or `Effect.subject` — same real field either way. */
      owner_or_subject: string;
      provenance: string;
      /** `"not_applicable"` for an Action (canon has no claimed/verified
       *  axis for Action itself); `"claimed"`/`"verified"` for an Effect,
       *  computed via `isEffectVerified` — the same real gate `/marketplace`
       *  and the canon activity sections already use. */
      claimed_or_verified: string;
      timestamp: string;
      /** Action → its Effect(s) (outgoing); Effect → its causal Action
       *  (incoming) — both real, checked via `action_ref`/
       *  `findEffectsForAction`, never inferred from proximity. */
      relationships: RelationshipSummary[];
      knownNeeds?: KnownNeedResult;
      actionSpace?: ActionSpaceSummary;
      /** LOOP 06A — the ONE real, honestly-computed next step for this
       *  entity (SEQUENCE 23 dead-end elimination): an Action with no
       *  Effect yet points at recording one; an Effect not yet verified
       *  points at verification; `null` when nothing further is genuinely
       *  justified — never invented urgency, matching `HubCommandCenter`'s
       *  own primary-CTA discipline. */
      nextAction: { label: string; href: string } | null;
    };

/**
 * Shared state vocabulary (UX-depth slice 1): color communicates the ACTUAL
 * value of a real field, never decoration. Every color below is a function of
 * data already present in `SelectedContext` — none is picked per-surface.
 * `"#38bdf8"` (persisted / the selection accent) and `"#34d399"` (verified)
 * are not new picks: both already appear in this codebase's own palette
 * (Dynamics' and Planet's own highlight accent; Nexus's trust/reputation
 * green — `app/nexus/*`) — reused, not invented.
 */
export const PHILOS_STATE_COLOR = {
  persisted: "#38bdf8",
  derived: "#8fa3c9",
  verified: "#34d399",
  claimed: "#fbbf24",
  neutral: "#7b8ca6",
  unknown: "#64748b",
} as const;

/** `persisted_or_derived` string -> the ONE color that fact maps to. */
export function persistedDerivedColor(value: string): string {
  return value === "persisted" ? PHILOS_STATE_COLOR.persisted : PHILOS_STATE_COLOR.derived;
}

/** `claimed_or_verified` string (canon's 3-value axis, or a legacy VerificationStatus/free text) -> color. */
export function claimedVerifiedColor(value: string): string {
  if (value === "verified" || value === "community_verified" || value === "external_verified") {
    return PHILOS_STATE_COLOR.verified;
  }
  if (value === "not_applicable") return PHILOS_STATE_COLOR.neutral;
  if (value.startsWith("not tracked")) return PHILOS_STATE_COLOR.unknown;
  return PHILOS_STATE_COLOR.claimed; // "claimed", "self_report", "evidence", "system_inference", ...
}

/**
 * One entry in the shared Action Layer — reused by Dynamics, Globe, and now
 * Marketplace so the same six destinations render in the same order with the
 * same labels everywhere.
 *   "live"          — a real, ctx-preserving link to another surface
 *   "here"          — this IS the current surface, not a link
 *   "not_connected" — genuinely no real target exists yet — rendered
 *                     disabled, never a fake link
 */
export interface ContextAction {
  label: string;
  href: string | null;
  state: "live" | "here" | "not_connected";
}

export type ContextSurface = "dynamics" | "globe" | "marketplace" | "community" | "hub" | "brain";

/**
 * The real, ctx-preserving cross-links every resolving surface can offer
 * today, plus the honestly-unconnected future destinations — one function,
 * so every view builds the identical list instead of hand-maintained copies.
 * `here` names the surface building the list so it marks itself rather than
 * linking to itself. Marketplace joined the "live" set once `/marketplace`
 * itself gained a real `?ctx=` resolver (Action Space slice) — it now leads
 * to a real investigation view, even when that view's honest answer is
 * "nothing known yet", so it is no longer a fake/disabled stub. Community
 * and Hub joined the "live" set in LOOP 0054, once both gained a real
 * `?ctx=` resolver of their own.
 */
export function buildContextActions(ref: SystemContextRef, here: ContextSurface): ContextAction[] {
  const ctx = encodeURIComponent(encodeSystemContextRef(ref));
  return [
    here === "dynamics"
      ? { label: "Dynamics", href: null, state: "here" }
      : { label: "Open in Dynamics", href: `/dynamics?ctx=${ctx}`, state: "live" },
    here === "globe"
      ? { label: "Globe", href: null, state: "here" }
      : { label: "Locate on Globe", href: `/planet?ctx=${ctx}`, state: "live" },
    here === "community"
      ? { label: "Community", href: null, state: "here" }
      : { label: "Open in Community", href: `/hub/community?ctx=${ctx}`, state: "live" },
    here === "hub"
      ? { label: "Hub", href: null, state: "here" }
      : { label: "Open in Hub", href: `/hub?ctx=${ctx}`, state: "live" },
    here === "brain"
      ? { label: "Brain", href: null, state: "here" }
      : { label: "Open in Brain", href: `/brain?ctx=${ctx}`, state: "live" },
    { label: "Needs / Values", href: null, state: "not_connected" },
    here === "marketplace"
      ? { label: "Marketplace", href: null, state: "here" }
      : { label: "Marketplace opportunities", href: `/marketplace?ctx=${ctx}`, state: "live" },
    { label: "Ask Merlin", href: null, state: "not_connected" },
  ];
}
