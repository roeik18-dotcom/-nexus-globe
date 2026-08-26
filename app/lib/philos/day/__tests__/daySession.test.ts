/**
 * DAY SESSION — the gates, and the refusals.
 *
 * The load-bearing assertion in this file is that CLOSED cannot be reached by
 * any path except all ten gates being genuinely met. A test that only checked
 * the happy path would still pass if `closing_status` were hard-coded.
 */
import { describe, expect, it } from "vitest";

import type { PhilosEvent } from "../../events";
import type { ActionLifecycleSummary } from "../../canon/actionLifecycle";
import {
  DAY_CLOSING_RECORDED,
  DAY_OPENED,
  dayDateOf,
  dayId,
  validateDayClosingRecordedPayload,
  validateDayOpenedPayload,
} from "../dayEvent";
import type { DayRefWorld } from "../dayRefs";
import {
  countDayRecords,
  DAY_GATES,
  nextActionFor,
  projectDaySession,
  type DayIdentity,
} from "../daySession";

const SUBJECT = "person_roei";
const PERSON = "p_you";
const DATE = "2026-08-26";
const DAY_ID = dayId(SUBJECT, DATE);

const LINKED: DayIdentity = { subject_id: SUBJECT, person_id: PERSON, link_status: "VERIFIED_SAME_PERSON" };
const UNLINKED: DayIdentity = { subject_id: SUBJECT, person_id: PERSON, link_status: "UNRESOLVED" };

function ev(over: Partial<PhilosEvent> & Pick<PhilosEvent, "event_type">): PhilosEvent {
  return {
    event_id: `ev_${Math.random().toString(36).slice(2)}`,
    actor_id: PERSON,
    entity_type: "person",
    entity_id: PERSON,
    value_tags: [],
    timestamp: `${DATE}T08:00:00.000Z`,
    visibility: "private",
    ...over,
  } as PhilosEvent;
}

const OBS_ID = "canonev_1";
/* The Effect's recording instant. t1 shares it exactly, to prove an equal
   millisecond is accepted when causality is declared. */
const EFFECT_AT = `${DATE}T12:00:00.000Z`;
const T0_ID = "state_t0_1";
const T1_ID = "state_t1_1";

/** Stored records the refs must resolve against. */
function refWorld(over: Partial<DayRefWorld> = {}): DayRefWorld {
  return {
    domainStates: [
      { state_id: T0_ID, recorded_at: `${DATE}T07:00:00.000Z`, state: { subject: SUBJECT } },
      /* t1 declares the day's Effect as its cause and shares its exact
         millisecond — legitimate under the declared-causality contract. */
      { state_id: T1_ID, recorded_at: EFFECT_AT, caused_by_ref: "effect_1", state: { subject: SUBJECT } },
    ],
    canonEvents: [
      { canon_event_id: OBS_ID, canon_type: "observation", recorded_at: `${DATE}T07:30:00.000Z`, payload: { subject: SUBJECT } },
    ],
    ...over,
  } as unknown as DayRefWorld;
}

const openedPayload = (over: Record<string, unknown> = {}) => ({
  day_id: DAY_ID,
  subject_id: SUBJECT,
  intention: "לסגור את הלולאה של אתמול",
  context: "בוקר, אחרי אימון",
  state_t0_refs: [T0_ID],
  event_ref: OBS_ID,
  observation_ref: OBS_ID,
  carry_forward_refs: [],
  consent: true,
  sourceRefs: ["src_1"],
  ...over,
});

const closingPayload = (over: Record<string, unknown> = {}) => ({
  day_id: DAY_ID,
  subject_id: SUBJECT,
  state_t1_refs: [T1_ID],
  action_refs: ["action_1"],
  effect_refs: ["effect_1"],
  evidence_refs: ["effect_1"],
  learning_refs: ["learning_1"],
  open_loop_refs: [],
  consent: true,
  sourceRefs: ["src_2"],
  ...over,
});

const opened = (over: Record<string, unknown> = {}) =>
  ev({ event_type: DAY_OPENED, payload: openedPayload(over) });

const closed = (over: Record<string, unknown> = {}) =>
  ev({ event_type: DAY_CLOSING_RECORDED, payload: closingPayload(over), timestamp: `${DATE}T20:00:00.000Z` });

/** A lifecycle whose Action is consented, effected, verified and learned from. */
function fullLifecycle(over: { day_ref?: string; owner?: string } = {}): ActionLifecycleSummary {
  return {
    subject: SUBJECT,
    actions: [
      {
        action: {
          action: {
            action_id: "action_1", type: "non_transfer", owner: SUBJECT,
            mechanism_scope: "self_regulation", consent: true, inputs: [],
            reversibility: "reversible", time: `${DATE}T10:00:00.000Z`, provenance: "test",
            day_ref: DAY_ID, ...over,
          },
          recorded_at: `${DATE}T10:00:00.000Z`,
        },
        effects: [
          {
            effect: { effect: { effect_id: "effect_1", action_ref: "action_1" }, recorded_at: EFFECT_AT },
            verified: true,
            learnings: [{ learning: { learning_id: "learning_1", effect_ref: "effect_1" }, recorded_at: `${DATE}T13:00:00.000Z`, delta: null }],
          },
        ],
        verification_state: "effect_verified",
      },
    ],
    counts: {
      actions_total: 1, no_effect_recorded: 0, effect_claimed_only: 0,
      effect_verified: 1, learnings_with_state_prime: 1,
    },
  } as unknown as ActionLifecycleSummary;
}

/** Every input satisfied — the only shape that may reach CLOSED. */
function closedInput() {
  return {
    date: DATE,
    identity: LINKED,
    events: [opened(), closed()],
    lifecycle: fullLifecycle(),
    refWorld: refWorld(),
  };
}

describe("day_id", () => {
  it("is derivable and round-trips its date", () => {
    expect(DAY_ID).toBe(`day_${DATE}_${SUBJECT}`);
    expect(dayDateOf(DAY_ID)).toBe(DATE);
  });

  it("reads malformed ids as no date rather than guessing one", () => {
    expect(dayDateOf("day_nonsense_person")).toBeNull();
    expect(dayDateOf("")).toBeNull();
  });
});

describe("payload validation — refused before append", () => {
  it("accepts a well-formed opening", () => {
    expect(validateDayOpenedPayload(openedPayload()).valid).toBe(true);
  });

  it("refuses consent that was not explicitly granted", () => {
    for (const bad of [false, undefined, "on", 1, null]) {
      const r = validateDayOpenedPayload(openedPayload({ consent: bad }));
      expect(r.valid).toBe(false);
      expect(r.errors).toContainEqual({ field: "consent", reason: "consent_not_granted" });
      expect(r.payload).toBeUndefined();
    }
  });

  it("refuses an empty intention or context rather than storing an empty string", () => {
    expect(validateDayOpenedPayload(openedPayload({ intention: "   " })).errors)
      .toContainEqual({ field: "intention", reason: "empty" });
    expect(validateDayOpenedPayload(openedPayload({ context: "" })).errors)
      .toContainEqual({ field: "context", reason: "empty" });
  });

  it("refuses a day_id whose subject contradicts the payload subject", () => {
    const r = validateDayOpenedPayload(openedPayload({ subject_id: "person_someone_else" }));
    expect(r.valid).toBe(false);
    expect(r.errors).toContainEqual({ field: "subject_id", reason: "subject_mismatch" });
  });

  it("refuses ref fields that are not string arrays", () => {
    expect(validateDayOpenedPayload(openedPayload({ state_t0_refs: "obs_1" })).errors)
      .toContainEqual({ field: "state_t0_refs", reason: "not_a_string_array" });
    expect(validateDayClosingRecordedPayload(closingPayload({ effect_refs: [1, 2] })).errors)
      .toContainEqual({ field: "effect_refs", reason: "not_a_string_array" });
  });

  it("refuses a non-object payload without throwing", () => {
    for (const bad of [null, undefined, 42, "x", []]) {
      expect(validateDayOpenedPayload(bad).valid).toBe(false);
      expect(validateDayClosingRecordedPayload(bad).valid).toBe(false);
    }
  });

  it("reports every problem at once, not just the first", () => {
    const r = validateDayOpenedPayload(openedPayload({ intention: "", context: "", consent: false }));
    expect(r.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe("closing_status", () => {
  it("is CLOSED only when all ten gates are met", () => {
    const s = projectDaySession(closedInput());
    expect(s.missing_gates).toEqual([]);
    expect(s.gates).toHaveLength(DAY_GATES.length);
    expect(s.closing_status).toBe("CLOSED");
  });

  it("is OPEN when the day was opened but no closing was recorded", () => {
    const s = projectDaySession({ ...closedInput(), events: [opened()] });
    expect(s.closing_status).toBe("OPEN");
    expect(s.missing_gates).toContain("ClosingRecorded");
  });

  it("is PARTIAL — never CLOSED — when a closing exists but a gate is missing", () => {
    // The opening records no event/observation pair at all.
    const s = projectDaySession({
      ...closedInput(),
      events: [opened({ event_ref: undefined, observation_ref: undefined }), closed()],
    });
    expect(s.closing_status).toBe("PARTIAL");
    expect(s.missing_gates).toContain("EventObservationLinked");
  });

  it("refuses CLOSED when identity is not VERIFIED_SAME_PERSON", () => {
    const s = projectDaySession({ ...closedInput(), identity: UNLINKED });
    expect(s.closing_status).toBe("PARTIAL");
    expect(s.missing_gates).toContain("IdentityLinked");
  });

  it("refuses CLOSED when each single gate is removed — no gate is decorative", () => {
    const removals: Array<[string, () => ReturnType<typeof projectDaySession>]> = [
      ["DayOpened", () => projectDaySession({ ...closedInput(), events: [closed()] })],
      ["IdentityLinked", () => projectDaySession({ ...closedInput(), identity: UNLINKED })],
      ["EventObservationLinked", () => projectDaySession({
        ...closedInput(),
        events: [opened({ event_ref: undefined, observation_ref: undefined }), closed()],
      })],
      ["ActionRecorded", () => projectDaySession({ ...closedInput(), lifecycle: null })],
      ["ClosingRecorded", () => projectDaySession({ ...closedInput(), events: [opened()] })],
      ["StateT1Available", () => projectDaySession({
        ...closedInput(),
        events: [opened(), closed({ state_t1_refs: [] })],
      })],
    ];
    for (const [gate, run] of removals) {
      const s = run();
      expect(s.closing_status, `${gate} must block CLOSED`).not.toBe("CLOSED");
      expect(s.missing_gates).toContain(gate);
    }
  });

  it("refuses CLOSED when an Action carries no recorded consent", () => {
    const lc = fullLifecycle();
    (lc.actions[0].action.action as { consent: boolean }).consent = false;
    const s = projectDaySession({ ...closedInput(), lifecycle: lc });
    expect(s.missing_gates).toContain("ActionAuthorized");
    expect(s.closing_status).not.toBe("CLOSED");
  });

  it("refuses CLOSED when the Effect is unverified — no Learning without Effect+Evidence", () => {
    const lc = fullLifecycle();
    lc.actions[0].effects[0].verified = false;
    lc.actions[0].effects[0].learnings = [];
    const s = projectDaySession({ ...closedInput(), lifecycle: lc });
    expect(s.missing_gates).toContain("EvidencePresent");
    expect(s.missing_gates).toContain("LearningSupported");
    expect(s.closing_status).not.toBe("CLOSED");
  });
});

describe("UNKNOWN is absence, never zero", () => {
  it("reads null with a reason — not 0, not an empty answer", () => {
    const s = projectDaySession({ date: DATE, identity: LINKED, events: [], lifecycle: null });
    for (const f of [s.opened_at, s.intention, s.context, s.state_t0, s.action_refs, s.effect_refs, s.evidence_refs, s.learning_refs, s.state_t1] as const) {
      expect(f.value).toBeNull();
      expect(f.unresolved_reason).toBeTruthy();
      expect(f.provenance).toBeNull();
    }
  });

  it("never invents a score, confidence or value", () => {
    const s = projectDaySession(closedInput());
    expect(JSON.stringify(s)).not.toMatch(/"(confidence|score|impact_score)":/);
  });
});

describe("open loops and carry-forward", () => {
  it("creates an open loop for every missing gate", () => {
    const s = projectDaySession({ date: DATE, identity: LINKED, events: [], lifecycle: null });
    const missing = s.open_loops.filter((l) => l.kind === "missing_gate");
    expect(missing.length).toBe(s.missing_gates.length);
  });

  it("carries yesterday's loops into today, marked as carried_forward", () => {
    const s = projectDaySession({
      ...closedInput(),
      carriedForward: [{ ref: "loop_x", kind: "missing_gate", detail: "yesterday" }],
    });
    const carried = s.carry_forward.find((l) => l.ref === "loop_x");
    expect(carried).toBeDefined();
    expect(carried?.kind).toBe("carried_forward");
  });

  it("a fully closed day carries nothing forward of its own", () => {
    const s = projectDaySession(closedInput());
    expect(s.open_loops).toEqual([]);
    expect(s.carry_forward).toEqual([]);
  });
});

describe("claim review stays separate", () => {
  it("does not resolve a claim just because the day closed", () => {
    const s = projectDaySession({ ...closedInput(), claimsUnderReview: ["claim_7"] });
    expect(s.closing_status).toBe("CLOSED");
    expect(s.claims_under_review).toEqual(["claim_7"]);
  });
});

describe("exactly one opening and one closing", () => {
  it("counts real duplicates instead of hiding them", () => {
    expect(countDayRecords([opened(), closed()], DAY_ID)).toEqual({ openings: 1, closings: 1 });
    expect(countDayRecords([opened(), opened(), closed()], DAY_ID)).toEqual({ openings: 2, closings: 1 });
  });

  it("ignores malformed day rows rather than counting them", () => {
    const malformed = ev({ event_type: DAY_OPENED, payload: { day_id: DAY_ID } });
    expect(countDayRecords([malformed], DAY_ID)).toEqual({ openings: 0, closings: 0 });
  });

  it("ignores another person's day", () => {
    const other = ev({
      event_type: DAY_OPENED,
      payload: openedPayload({ day_id: dayId("person_other", DATE), subject_id: "person_other" }),
    });
    expect(countDayRecords([other], DAY_ID)).toEqual({ openings: 0, closings: 0 });
  });
});

describe("the Action chain is DAY-SCOPED, not subject-wide", () => {
  /* Regression: the projection counted every Action the SUBJECT had ever
     recorded, so yesterday's verified chain satisfied today's gates and a day
     with no work read as complete. */
  const YESTERDAY_ID = dayId(SUBJECT, "2026-08-25");

  it("yesterday's Action does not satisfy today's gates", () => {
    const s = projectDaySession({
      ...closedInput(),
      lifecycle: fullLifecycle({ day_ref: YESTERDAY_ID }),
    });
    expect(s.closing_status).not.toBe("CLOSED");
    for (const g of ["ActionRecorded", "ActionAuthorized", "EffectLinked", "EvidencePresent", "LearningSupported"]) {
      expect(s.missing_gates, `${g} must be unmet`).toContain(g);
    }
  });

  it("another subject's Action does not satisfy the day", () => {
    const s = projectDaySession({
      ...closedInput(),
      lifecycle: fullLifecycle({ owner: "person_someone_else" }),
    });
    expect(s.closing_status).not.toBe("CLOSED");
    expect(s.missing_gates).toContain("ActionRecorded");
  });

  it("an Action with no day_ref at all does not satisfy any day", () => {
    const s = projectDaySession({
      ...closedInput(),
      lifecycle: fullLifecycle({ day_ref: undefined }),
    });
    expect(s.missing_gates).toContain("ActionRecorded");
  });

  it("a matching day_ref satisfies ONLY its own day", () => {
    const today = projectDaySession(closedInput());
    expect(today.closing_status).toBe("CLOSED");

    // Same lifecycle, projected for a different date — must not carry over.
    const other = projectDaySession({
      ...closedInput(),
      date: "2026-08-28",
      events: [],
    });
    expect(other.missing_gates).toContain("ActionRecorded");
  });

  it("Effect / Evidence / Learning count only when transitively linked", () => {
    // Day-linked Action, but its Effect is unverified and has no Learning:
    // ActionRecorded is met, the rest of the chain is not.
    const lc = fullLifecycle();
    lc.actions[0].effects[0].verified = false;
    lc.actions[0].effects[0].learnings = [];
    const s = projectDaySession({ ...closedInput(), lifecycle: lc });
    expect(s.missing_gates).not.toContain("ActionRecorded");
    expect(s.missing_gates).not.toContain("EffectLinked");
    expect(s.missing_gates).toContain("EvidencePresent");
    expect(s.missing_gates).toContain("LearningSupported");
  });

  it("the closing payload's action_refs are NOT accepted as proof", () => {
    // The closing lists action_1, but no day-linked Action exists.
    const s = projectDaySession({
      ...closedInput(),
      lifecycle: fullLifecycle({ day_ref: YESTERDAY_ID }),
    });
    const closingPayloadRefs = (closed().payload as { action_refs: string[] }).action_refs;
    expect(closingPayloadRefs).toContain("action_1");
    expect(s.missing_gates).toContain("ActionRecorded");
  });
});

describe("the projection does not depend on its caller", () => {
  /* Regression, now structural: the caller-supplied observation list was
     REMOVED. The only inputs are the stored records, so there is no argument
     a call site could pass that would change a gate. */
  it("resolves the event/observation pair from the opening record alone", () => {
    const s = projectDaySession(closedInput());
    expect(s.event_observation_refs.value).toContain(OBS_ID);
    expect(s.closing_status).toBe("CLOSED");
  });
});

describe("next action", () => {
  it("names a real missing gate, never an invented task", () => {
    const s = projectDaySession({ date: DATE, identity: LINKED, events: [], lifecycle: null });
    expect(nextActionFor(s)).toBeTruthy();
    expect(s.missing_gates[0]).toBe("DayOpened");
  });

  it("says nothing is required once the day is closed", () => {
    expect(nextActionFor(projectDaySession(closedInput()))).toContain("סגור");
  });
});

/* ── REFERENTIAL INTEGRITY — a payload string is a claim, not proof ─────── */

describe("forged and missing refs keep the day PARTIAL", () => {
  it("fake t0 ref — names no stored state record", () => {
    const s = projectDaySession({
      ...closedInput(),
      events: [opened({ state_t0_refs: ["state_does_not_exist"] }), closed()],
    });
    expect(s.missing_gates).toContain("StateT0Available");
    expect(s.closing_status).toBe("PARTIAL");
    expect(s.state_t0.unresolved_reason).toMatch(/no stored state record/);
  });

  it("fake event ref — names no stored canon event", () => {
    const s = projectDaySession({
      ...closedInput(),
      events: [opened({ event_ref: "canonev_forged" }), closed()],
    });
    expect(s.missing_gates).toContain("EventObservationLinked");
    expect(s.closing_status).toBe("PARTIAL");
    expect(s.event_observation_refs.unresolved_reason).toMatch(/names no stored canon event/);
  });

  it("fake observation ref — names no stored canon event", () => {
    const s = projectDaySession({
      ...closedInput(),
      events: [opened({ observation_ref: "obs_forged" }), closed()],
    });
    expect(s.missing_gates).toContain("EventObservationLinked");
    expect(s.event_observation_refs.unresolved_reason).toMatch(/names no stored canon event/);
  });

  it("observation owned by ANOTHER subject", () => {
    const s = projectDaySession({
      ...closedInput(),
      refWorld: refWorld({
        canonEvents: [{
          canon_event_id: OBS_ID, canon_type: "observation",
          recorded_at: `${DATE}T07:30:00.000Z`, payload: { subject: "person_someone_else" },
        }],
      } as never),
    });
    expect(s.missing_gates).toContain("EventObservationLinked");
    expect(s.event_observation_refs.unresolved_reason).toMatch(/belongs to person_someone_else/);
  });

  it("event_ref and observation_ref naming DIFFERENT records is a forgery", () => {
    const s = projectDaySession({
      ...closedInput(),
      events: [opened({ observation_ref: "canonev_2" }), closed()],
      refWorld: refWorld({
        canonEvents: [
          { canon_event_id: OBS_ID, canon_type: "observation", recorded_at: `${DATE}T07:30:00.000Z`, payload: { subject: SUBJECT } },
          { canon_event_id: "canonev_2", canon_type: "observation", recorded_at: `${DATE}T07:40:00.000Z`, payload: { subject: SUBJECT } },
        ],
      } as never),
    });
    expect(s.missing_gates).toContain("EventObservationLinked");
    expect(s.event_observation_refs.unresolved_reason).toMatch(/not the observation carried by event/);
  });

  it("fake t1 ref — names no stored state record", () => {
    const s = projectDaySession({
      ...closedInput(),
      events: [opened(), closed({ state_t1_refs: ["state_forged"] })],
    });
    expect(s.missing_gates).toContain("StateT1Available");
    expect(s.closing_status).toBe("PARTIAL");
    expect(s.state_t1.unresolved_reason).toMatch(/no stored state record/);
  });

  it("a PRE-ACTION state cannot be used as State(t1)", () => {
    // T0_ID was recorded at 07:00 and declares no cause at all.
    const s = projectDaySession({
      ...closedInput(),
      events: [opened(), closed({ state_t1_refs: [T0_ID] })],
    });
    expect(s.missing_gates).toContain("StateT1Available");
    expect(s.state_t1.unresolved_reason).toMatch(/declares no caused_by_ref/);
  });

  it("a state belonging to another subject cannot be State(t1)", () => {
    const s = projectDaySession({
      ...closedInput(),
      refWorld: refWorld({
        domainStates: [
          { state_id: T0_ID, recorded_at: `${DATE}T07:00:00.000Z`, state: { subject: SUBJECT } },
          { state_id: T1_ID, recorded_at: `${DATE}T19:00:00.000Z`, state: { subject: "person_someone_else" } },
        ],
      } as never),
    });
    expect(s.missing_gates).toContain("StateT1Available");
    expect(s.state_t1.unresolved_reason).toMatch(/belongs to person_someone_else/);
  });

  it("forged refs inside an OTHERWISE VALID closing still refuse CLOSED", () => {
    const valid = projectDaySession(closedInput());
    expect(valid.closing_status).toBe("CLOSED");

    const forged = projectDaySession({
      ...closedInput(),
      events: [opened(), closed({ state_t1_refs: [T1_ID, "state_forged_extra"] })],
    });
    // Everything else about this closing is real; one bad ref is enough.
    expect(forged.missing_gates).toEqual(["StateT1Available"]);
    expect(forged.closing_status).toBe("PARTIAL");
  });

  it("an empty ref world resolves nothing — a caller cannot skip loading records", () => {
    const s = projectDaySession({ ...closedInput(), refWorld: undefined });
    expect(s.closing_status).toBe("PARTIAL");
    for (const g of ["StateT0Available", "EventObservationLinked", "StateT1Available"]) {
      expect(s.missing_gates).toContain(g);
    }
  });
});
