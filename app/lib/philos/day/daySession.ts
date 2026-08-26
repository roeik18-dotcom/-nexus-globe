/**
 * DAY SESSION — a READ PROJECTION of one person's one calendar day.
 *
 * NOT A STORE, AND NOT A SNAPSHOT. Nothing here is persisted. Every field is
 * derived, at read time, from records that already exist: the two day acts in
 * the `PhilosEvent` log, and the Action/Effect/Evidence/Learning chain canon
 * already keeps. A serialized DaySession would be a second answer to
 * questions the canonical records already answer, and the first time the two
 * disagreed the stored one would win by accident.
 *
 * IDENTITY IS A PAIR, NEVER COLLAPSED. This repository keys canon records by
 * `subject_id` (`person_roei` — `Need.subject`, `Action.owner`) and the
 * PhilosEvent/community records by `person_id` (`p_you`). They are the same
 * human, joined by a real checked bridge, and `personRef.ts` forbids merging
 * them. A single `person_id` field here would be a false claim, so the
 * projection carries both plus the link status — and CLOSED is refused
 * unless that link actually reads VERIFIED_SAME_PERSON.
 *
 * UNKNOWN IS ABSENCE, NEVER ZERO. A field with no record reads `value: null`
 * with an `unresolved_reason`. It never reads `0`, `[]`-as-answer, or an
 * invented default. Nothing here computes an impact score, a confidence or a
 * value — where canon has no number, this projection has none either.
 *
 * CLOSED IS EARNED, NOT ASSERTED. Ten mandatory gates are checked
 * individually; CLOSED requires all ten. A missing gate produces PARTIAL, the
 * named missing gates, and carry-forward loops — never a completion claim.
 * A day cannot be talked into being finished.
 *
 * CLAIM REVIEW IS SEPARATE. A claim still UNDER_REVIEW does not become true
 * because the operational day closed. Review status is carried through
 * untouched and is deliberately not an input to `closing_status`.
 */
import type { PhilosEvent } from "../events";
import type { ActionLifecycleSummary } from "../canon/actionLifecycle";
import {
  EMPTY_REF_WORLD,
  resolveEventObservation,
  resolveStateRefs,
  type DayRefWorld,
} from "./dayRefs";
import {
  asDayClosingRecorded,
  asDayOpened,
  dayId,
  type DayClosingRecordedPayload,
  type DayOpenedPayload,
} from "./dayEvent";

/** Same four values as `GroupEventProvenance`; never inferred from location. */
export type DayProvenance = "REAL" | "DERIVED" | "DEMO" | "IMPORTED";

export type DayLinkStatus = "VERIFIED_SAME_PERSON" | "UNRESOLVED";

export interface DayIdentity {
  /** Canon Action/Effect/Evidence/Learning space. */
  subject_id: string;
  /** PhilosEvent / community space. */
  person_id: string;
  link_status: DayLinkStatus;
}

/**
 * One projected field. `value === null` means UNKNOWN — the record does not
 * exist — and `unresolved_reason` says why. It never means zero.
 */
export interface DayField<T> {
  value: T | null;
  refs: string[];
  provenance: DayProvenance | null;
  status: string | null;
  sourceRefs: string[];
  occurred_at: string | null;
  recorded_at: string | null;
  unresolved_reason: string | null;
}

function unknownField<T>(reason: string): DayField<T> {
  return {
    value: null, refs: [], provenance: null, status: null,
    sourceRefs: [], occurred_at: null, recorded_at: null,
    unresolved_reason: reason,
  };
}

function knownField<T>(value: T, over: Partial<DayField<T>> = {}): DayField<T> {
  return {
    value, refs: [], provenance: "REAL", status: null,
    sourceRefs: [], occurred_at: null, recorded_at: null,
    unresolved_reason: null,
    ...over,
  };
}

/** The ten mandatory gates. CLOSED requires every one of them. */
export const DAY_GATES = [
  "DayOpened",
  "IdentityLinked",
  /* Named in the referential-integrity spec alongside StateT1Available. It
     was not in the original ten; without it a day could open citing State(t0)
     refs that resolve to nothing and still close, which is the exact hole the
     integrity pass exists to shut. */
  "StateT0Available",
  "EventObservationLinked",
  "ActionAuthorized",
  "ActionRecorded",
  "EffectLinked",
  "EvidencePresent",
  "LearningSupported",
  "StateT1Available",
  "ClosingRecorded",
] as const;

export type DayGate = (typeof DAY_GATES)[number];

export interface DayGateResult {
  gate: DayGate;
  met: boolean;
  /** Why it is not met. Null when met. */
  reason: string | null;
}

export type DayClosingStatus = "OPEN" | "PARTIAL" | "CLOSED";

export interface DayOpenLoop {
  ref: string;
  kind: "missing_gate" | "carried_forward" | "unresolved_record";
  detail: string;
}

export interface DaySession {
  day_id: string;
  date: string;
  identity: DayIdentity;

  opened_at: DayField<string>;
  intention: DayField<string>;
  context: DayField<string>;
  state_t0: DayField<string[]>;

  event_observation_refs: DayField<string[]>;
  action_refs: DayField<string[]>;
  effect_refs: DayField<string[]>;
  evidence_refs: DayField<string[]>;
  learning_refs: DayField<string[]>;

  state_t1: DayField<string[]>;

  gates: DayGateResult[];
  missing_gates: DayGate[];
  closing_status: DayClosingStatus;
  closing_recorded_at: DayField<string>;

  open_loops: DayOpenLoop[];
  carry_forward: DayOpenLoop[];

  /**
   * Claim review state, carried through untouched. Never an input to
   * `closing_status` — a day closing does not resolve a claim.
   */
  claims_under_review: string[];
}

export interface ProjectDaySessionInput {
  date: string;
  identity: DayIdentity;
  /** The whole PhilosEvent log; this function selects what it needs. */
  events: readonly PhilosEvent[];
  /** Canon's Action → Effect → Learning chain for this subject. */
  lifecycle: ActionLifecycleSummary | null;
  /* `linkedObservationIds` was removed deliberately. It let a caller supply
     the very ids the EventObservationLinked gate checked, so the gate could
     be satisfied by the caller rather than by a stored record. The pair now
     comes from the opening payload and is resolved against the canon event
     store — see `dayRefs.ts`. */
  /** Claim ids still under review. Passed through, never resolved here. */
  claimsUnderReview?: readonly string[];
  /** Open loops inherited from the previous day. */
  carriedForward?: readonly DayOpenLoop[];
  /**
   * The stored records every ref in the day payloads is checked against.
   * Absent means nothing resolves — which is the correct, refusing default:
   * a caller that forgets to load the world does not get free gates.
   */
  refWorld?: DayRefWorld;
}

/** Fold the log to the LAST valid day-opening for this day. */
function findOpening(
  events: readonly PhilosEvent[],
  day_id: string,
): { event: PhilosEvent; payload: DayOpenedPayload } | null {
  let found: { event: PhilosEvent; payload: DayOpenedPayload } | null = null;
  for (const e of events) {
    const d = asDayOpened(e);
    if (d && d.payload.day_id === day_id) found = d;
  }
  return found;
}

function findClosing(
  events: readonly PhilosEvent[],
  day_id: string,
): { event: PhilosEvent; payload: DayClosingRecordedPayload } | null {
  let found: { event: PhilosEvent; payload: DayClosingRecordedPayload } | null = null;
  for (const e of events) {
    const d = asDayClosingRecorded(e);
    if (d && d.payload.day_id === day_id) found = d;
  }
  return found;
}

/**
 * How many day-opening / day-closing records exist for this day.
 *
 * Acceptance requires "exactly one Day Opening and one Day Closing after
 * replay/refresh". Reporting the real count makes a duplicate visible instead
 * of silently last-write-wins.
 */
export function countDayRecords(
  events: readonly PhilosEvent[],
  day_id: string,
): { openings: number; closings: number } {
  let openings = 0;
  let closings = 0;
  for (const e of events) {
    if (asDayOpened(e)?.payload.day_id === day_id) openings++;
    if (asDayClosingRecorded(e)?.payload.day_id === day_id) closings++;
  }
  return { openings, closings };
}

/**
 * The whole projection. Pure: no I/O, no clock, no store.
 */
export function projectDaySession(input: ProjectDaySessionInput): DaySession {
  const { date, identity, events, lifecycle } = input;
  const day_id = dayId(identity.subject_id, date);

  const opening = findOpening(events, day_id);
  const closing = findClosing(events, day_id);

  /* ── Opening-derived fields ─────────────────────────────────────────── */

  const opened_at: DayField<string> = opening
    ? knownField(opening.event.timestamp, {
        refs: [opening.event.event_id],
        sourceRefs: opening.payload.sourceRefs,
        occurred_at: opening.event.timestamp,
        recorded_at: opening.event.timestamp,
        status: "OPENED",
      })
    : unknownField("no day.opened record for this person and date");

  const intention: DayField<string> = opening
    ? knownField(opening.payload.intention, {
        refs: [opening.event.event_id],
        sourceRefs: opening.payload.sourceRefs,
        occurred_at: opening.event.timestamp,
      })
    : unknownField("no day.opened record — intention is not recorded anywhere else");

  const context: DayField<string> = opening
    ? knownField(opening.payload.context, {
        refs: [opening.event.event_id],
        sourceRefs: opening.payload.sourceRefs,
        occurred_at: opening.event.timestamp,
      })
    : unknownField("no day.opened record — context is not recorded anywhere else");

  /* Every ref below is RESOLVED against stored records, never counted.
     See `dayRefs.ts` — a string in a payload is a claim, not proof. */
  const refWorld = input.refWorld ?? EMPTY_REF_WORLD;

  const t0Check = opening
    ? resolveStateRefs(opening.payload.state_t0_refs, refWorld, identity.subject_id)
    : null;

  const state_t0: DayField<string[]> =
    t0Check && t0Check.ok
      ? knownField(t0Check.resolvedRefs, {
          refs: t0Check.resolvedRefs,
          sourceRefs: opening!.payload.sourceRefs,
          occurred_at: opening!.event.timestamp,
          status: "RESOLVED",
        })
      : unknownField(
          opening ? (t0Check?.reason ?? "State(t0) refs do not resolve") : "no day.opened record",
        );

  /* ── Chain fields, from canon's own lifecycle ───────────────────────── */

  /* DAY-SCOPED, NOT SUBJECT-WIDE.
     `buildActionLifecycleSummary` answers "everything this SUBJECT ever did",
     which is the right question for a lifecycle view and the wrong one for a
     day. Counting it unfiltered made yesterday's verified chain satisfy
     today's gates — a day the person never worked would read as having a
     recorded Action, a linked Effect and a supported Learning.
     Only the chain hanging off an Action that DECLARES this day counts:
       • `day_ref` must equal this day_id — a declared link, never chronology
       • `owner` must be this day's canon subject — another person's Action,
         even on the same day, is not this person's day
     The closing payload's `action_refs` are deliberately NOT consulted here:
     a person listing an id in a form is a claim about the chain, not the
     chain itself, and a gate that accepted it could be satisfied by typing. */
  const allEntries = lifecycle?.actions ?? [];
  const entries = allEntries.filter((e) => {
    const a = e.action.action as { day_ref?: string; owner?: string };
    return a.day_ref === day_id && a.owner === identity.subject_id;
  });
  const actionIds = entries.map((e) => e.action.action.action_id);

  const effectIds: string[] = [];
  const evidenceIds: string[] = [];
  const learningIds: string[] = [];
  for (const entry of entries) {
    for (const eff of entry.effects) {
      // Real shapes, not guessed: EffectWithLearning = { effect: EffectRecord;
      // verified: boolean; learnings: LearningRecord[] }, and EffectRecord
      // = { effect: Effect; recorded_at } — hence the double `.effect`.
      effectIds.push(eff.effect.effect.effect_id);
      // Evidence is what makes an Effect VERIFIED — canon's own contract
      // (`learning.ts`: insufficient_evidence / evidence_expired_or_irrelevant).
      // A verified Effect is the checkable signal that evidence was accepted;
      // an unverified one is absence of evidence, never evidence of absence.
      if (eff.verified) evidenceIds.push(eff.effect.effect.effect_id);
      for (const l of eff.learnings) learningIds.push(l.learning.learning_id);
    }
  }

  const action_refs: DayField<string[]> =
    actionIds.length > 0
      ? knownField(actionIds, { refs: actionIds, status: "RECORDED" })
      : unknownField("no Action recorded through the canonical writer for this subject");

  const effect_refs: DayField<string[]> =
    effectIds.length > 0
      ? knownField(effectIds, { refs: effectIds, status: "RECORDED" })
      : unknownField("no Effect linked to any recorded Action");

  const evidence_refs: DayField<string[]> =
    evidenceIds.length > 0
      ? knownField(evidenceIds, { refs: evidenceIds, status: "VERIFIED" })
      : unknownField("no verified Effect — evidence is absent, not zero");

  const learning_refs: DayField<string[]> =
    learningIds.length > 0
      ? knownField(learningIds, { refs: learningIds, status: "RECORDED" })
      : unknownField("no Learning satisfies canon's Effect+Evidence precondition");

  /* THE DAY'S OWN RECORD IS THE ONLY SOURCE. The Event/Observation pair is
     recorded on the opening and RESOLVED here against the canon event store;
     a caller-supplied list can no longer stand in for a stored record. */
  const obsCheck = opening
    ? resolveEventObservation(
        opening.payload.event_ref,
        opening.payload.observation_ref,
        refWorld,
        identity.subject_id,
      )
    : null;

  const event_observation_refs: DayField<string[]> =
    obsCheck && obsCheck.ok
      ? knownField(obsCheck.resolvedRefs, {
          refs: obsCheck.resolvedRefs,
          occurred_at: opening!.event.timestamp,
          status: "RESOLVED",
        })
      : unknownField(
          opening ? (obsCheck?.reason ?? "Event/Observation does not resolve") : "no day.opened record",
        );

  /* The day's own Action/Effect records, by id and recording instant. A
     State(t1) must DECLARE one of these as its cause — this is the set its
     `caused_by_ref` is checked against. Day-scoped and subject-scoped by
     construction, because `entries` already is: yesterday's Action and another
     person's Action are not in this list, so neither can be named as a cause. */
  const dayChain = [
    ...entries.map((e) => ({ ref: e.action.action.action_id, recorded_at: e.action.recorded_at })),
    ...entries.flatMap((e) =>
      e.effects.map((x) => ({ ref: x.effect.effect.effect_id, recorded_at: x.effect.recorded_at })),
    ),
  ];

  const t1Check = closing
    ? resolveStateRefs(closing.payload.state_t1_refs, refWorld, identity.subject_id, {
        causedBy: dayChain,
      })
    : null;

  const state_t1: DayField<string[]> =
    t1Check && t1Check.ok
      ? knownField(t1Check.resolvedRefs, {
          refs: t1Check.resolvedRefs,
          sourceRefs: closing!.payload.sourceRefs,
          occurred_at: closing!.event.timestamp,
          status: "RESOLVED",
        })
      : unknownField(
          closing
            ? (t1Check?.reason ?? "State(t1) refs do not resolve")
            : "no day.closing_recorded record — State(t1) is not available",
        );

  const closing_recorded_at: DayField<string> = closing
    ? knownField(closing.event.timestamp, {
        refs: [closing.event.event_id],
        sourceRefs: closing.payload.sourceRefs,
        occurred_at: closing.event.timestamp,
        recorded_at: closing.event.timestamp,
        status: "RECORDED",
      })
    : unknownField("the person has not recorded a closing for this day");

  /* ── The ten gates ──────────────────────────────────────────────────── */

  // ActionAuthorized: canon's Action writer refuses without explicit consent
  // (canon §10) and, for a Need+Offer match, without a verified MatchPermit.
  // A stored Action therefore carries `consent: true` as the evidence that
  // the authority gate was actually passed — this does not re-run the gate,
  // it reads the record the gate produced.
  const authorizedActions = entries.filter(
    (e) => (e.action.action as { consent?: boolean }).consent === true,
  );

  const gateResults: DayGateResult[] = [
    {
      gate: "DayOpened",
      met: opening !== null,
      reason: opening ? null : "no day.opened record for this person and date",
    },
    {
      gate: "IdentityLinked",
      met: identity.link_status === "VERIFIED_SAME_PERSON",
      reason:
        identity.link_status === "VERIFIED_SAME_PERSON"
          ? null
          : `identity link is ${identity.link_status} — canon subject and PhilosEvent person are not proven to be the same human`,
    },
    {
      gate: "StateT0Available",
      met: state_t0.value !== null,
      reason: state_t0.value !== null ? null : (state_t0.unresolved_reason ?? "State(t0) unavailable"),
    },
    {
      gate: "EventObservationLinked",
      met: event_observation_refs.value !== null,
      reason: event_observation_refs.value !== null
        ? null
        : (event_observation_refs.unresolved_reason ?? "Event/Observation not linked"),
    },
    {
      gate: "ActionAuthorized",
      met: authorizedActions.length > 0,
      reason:
        authorizedActions.length > 0
          ? null
          : "no Action carries recorded consent — the authority gate was not passed",
    },
    {
      gate: "ActionRecorded",
      met: actionIds.length > 0,
      reason: actionIds.length > 0 ? null : "no Action recorded through the canonical writer",
    },
    {
      gate: "EffectLinked",
      met: effectIds.length > 0,
      reason: effectIds.length > 0 ? null : "no Effect linked to a recorded Action",
    },
    {
      gate: "EvidencePresent",
      met: evidenceIds.length > 0,
      reason: evidenceIds.length > 0 ? null : "no verified Effect — evidence absent",
    },
    {
      gate: "LearningSupported",
      met: learningIds.length > 0,
      reason:
        learningIds.length > 0
          ? null
          : "no Learning satisfies canon's Effect+Evidence precondition",
    },
    {
      gate: "StateT1Available",
      met: state_t1.value !== null,
      reason: state_t1.value !== null ? null : (state_t1.unresolved_reason ?? "State(t1) unavailable"),
    },
    {
      gate: "ClosingRecorded",
      met: closing !== null,
      reason: closing ? null : "the person has not recorded a closing for this day",
    },
  ];

  const missing_gates = gateResults.filter((g) => !g.met).map((g) => g.gate);

  // OPEN before anyone opened it or before a closing was attempted; PARTIAL
  // once a closing exists but a gate is missing; CLOSED only with all ten.
  // A false CLOSED is structurally impossible: this is the only assignment
  // of "CLOSED" in the module, and it is guarded by the full gate list.
  const closing_status: DayClosingStatus =
    missing_gates.length === 0 ? "CLOSED" : closing !== null ? "PARTIAL" : "OPEN";

  const open_loops: DayOpenLoop[] = [
    ...gateResults
      .filter((g) => !g.met)
      .map<DayOpenLoop>((g) => ({
        ref: `${day_id}:${g.gate}`,
        kind: "missing_gate",
        detail: g.reason ?? g.gate,
      })),
    ...entries
      .filter((e) => e.verification_state !== "effect_verified")
      .map<DayOpenLoop>((e) => ({
        ref: e.action.action.action_id,
        kind: "unresolved_record",
        detail: `Action ${e.action.action.action_id}: ${e.verification_state}`,
      })),
  ];

  // Carry-forward is what the NEXT day inherits: everything still open,
  // plus anything the previous day handed to this one and that is still open.
  const carry_forward: DayOpenLoop[] = [
    ...(input.carriedForward ?? []).map((l) => ({ ...l, kind: "carried_forward" as const })),
    ...open_loops,
  ];

  return {
    day_id,
    date,
    identity,
    opened_at,
    intention,
    context,
    state_t0,
    event_observation_refs,
    action_refs,
    effect_refs,
    evidence_refs,
    learning_refs,
    state_t1,
    gates: gateResults,
    missing_gates,
    closing_status,
    closing_recorded_at,
    open_loops,
    carry_forward,
    claims_under_review: [...(input.claimsUnderReview ?? [])],
  };
}

/** The single next action a terminal should show. Never invented: it names a real missing gate. */
export function nextActionFor(session: DaySession): string {
  const first = session.gates.find((g) => !g.met);
  if (!first) return "היום סגור — אין פעולה נדרשת";
  const LABEL: Record<DayGate, string> = {
    DayOpened: "פתח/י את היום",
    IdentityLinked: "אמת/י את קישור הזהות",
    StateT0Available: "רשום/י State(t0) שמפנה לרשומה קיימת",
    EventObservationLinked: "קשר/י אירוע ותצפית קיימים (event_ref + observation_ref)",
    ActionAuthorized: "אשר/י פעולה דרך שער ההרשאה",
    ActionRecorded: "רשום/י פעולה דרך הכותב הקנוני",
    EffectLinked: "קשר/י Effect לפעולה",
    EvidencePresent: "צרף/י ראיה",
    LearningSupported: "אין Learning נתמך — נדרשים Effect + ראיה",
    StateT1Available: "רשום/י State(t1)",
    ClosingRecorded: "רשום/י סגירת יום",
  };
  return LABEL[first.gate];
}
