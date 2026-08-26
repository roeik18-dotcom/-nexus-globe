/**
 * DAY INTEGRITY — declared causality for State(t1), and per-person event ids.
 *
 * Two properties that a clock alone cannot establish:
 *
 *   1. A State(t1) recorded in the SAME millisecond as the Effect it followed
 *      is legitimate. Requiring "strictly later" made the normal case invalid
 *      and pushed callers into inserting sleeps to satisfy an ordering test.
 *      Causality is DECLARED (`caused_by_ref`) and the timestamp only rules
 *      out a state that genuinely predates its cause.
 *
 *   2. Two people opening the same calendar day must not collide. The event id
 *      is derived from the act, the person and the day, and hashed so no
 *      caller-supplied text is spliced into an identifier.
 */
import { describe, expect, it } from "vitest";

import type { PhilosEvent } from "../../events";
import type { ActionLifecycleSummary } from "../../canon/actionLifecycle";
import type { DayRefWorld } from "../dayRefs";
import {
  DAY_CLOSING_RECORDED,
  DAY_OPENED,
  dayClosedEventId,
  dayId,
  dayOpenedEventId,
} from "../dayEvent";
import { projectDaySession, type DayIdentity } from "../daySession";

const SUBJECT = "person_roei";
const PERSON = "p_you";
const DATE = "2026-08-26";
const DAY_ID = dayId(SUBJECT, DATE);
const OBS_ID = "canonev_1";
const T0_ID = "state_t0_1";
const T1_ID = "state_t1_1";

/** The Effect's exact recording instant — State(t1) shares it deliberately. */
const EFFECT_AT = `${DATE}T12:00:00.000Z`;

const LINKED: DayIdentity = { subject_id: SUBJECT, person_id: PERSON, link_status: "VERIFIED_SAME_PERSON" };

function ev(over: Partial<PhilosEvent> & Pick<PhilosEvent, "event_type">): PhilosEvent {
  return {
    event_id: `ev_${Math.random().toString(36).slice(2)}`,
    actor_id: PERSON, entity_type: "person", entity_id: PERSON,
    value_tags: [], timestamp: `${DATE}T08:00:00.000Z`, visibility: "private",
    ...over,
  } as PhilosEvent;
}

const openedPayload = (over: Record<string, unknown> = {}) => ({
  day_id: DAY_ID, subject_id: SUBJECT,
  intention: "כוונה", context: "הקשר",
  state_t0_refs: [T0_ID], event_ref: OBS_ID, observation_ref: OBS_ID,
  carry_forward_refs: [], consent: true, sourceRefs: ["t"],
  ...over,
});

const closingPayload = (over: Record<string, unknown> = {}) => ({
  day_id: DAY_ID, subject_id: SUBJECT,
  state_t1_refs: [T1_ID], action_refs: ["action_1"], effect_refs: ["effect_1"],
  evidence_refs: ["effect_1"], learning_refs: ["learning_1"],
  open_loop_refs: [], consent: true, sourceRefs: ["t"],
  ...over,
});

const opened = (o: Record<string, unknown> = {}) => ev({ event_type: DAY_OPENED, payload: openedPayload(o) });
const closed = (o: Record<string, unknown> = {}) =>
  ev({ event_type: DAY_CLOSING_RECORDED, payload: closingPayload(o), timestamp: `${DATE}T20:00:00.000Z` });

function fullLifecycle(over: { day_ref?: string; owner?: string } = {}): ActionLifecycleSummary {
  return {
    subject: SUBJECT,
    actions: [{
      action: {
        action: {
          action_id: "action_1", type: "non_transfer", owner: SUBJECT,
          mechanism_scope: "self_regulation", consent: true, inputs: [],
          reversibility: "reversible", time: `${DATE}T10:00:00.000Z`, provenance: "test",
          day_ref: DAY_ID, ...over,
        },
        recorded_at: `${DATE}T10:00:00.000Z`,
      },
      effects: [{
        effect: { effect: { effect_id: "effect_1", action_ref: "action_1" }, recorded_at: EFFECT_AT },
        verified: true,
        learnings: [{ learning: { learning_id: "learning_1", effect_ref: "effect_1" }, recorded_at: EFFECT_AT, delta: null }],
      }],
      verification_state: "effect_verified",
    }],
    counts: { actions_total: 1, no_effect_recorded: 0, effect_claimed_only: 0, effect_verified: 1, learnings_with_state_prime: 1 },
  } as unknown as ActionLifecycleSummary;
}

/** t1 shares the Effect's millisecond and declares it as its cause. */
function world(t1: Record<string, unknown> = {}): DayRefWorld {
  return {
    domainStates: [
      { state_id: T0_ID, recorded_at: `${DATE}T07:00:00.000Z`, state: { subject: SUBJECT } },
      { state_id: T1_ID, recorded_at: EFFECT_AT, caused_by_ref: "effect_1", state: { subject: SUBJECT }, ...t1 },
    ],
    canonEvents: [
      { canon_event_id: OBS_ID, canon_type: "observation", recorded_at: `${DATE}T07:30:00.000Z`, payload: { subject: SUBJECT } },
    ],
  } as unknown as DayRefWorld;
}

const base = (t1: Record<string, unknown> = {}) => ({
  date: DATE, identity: LINKED,
  events: [opened(), closed()],
  lifecycle: fullLifecycle(),
  refWorld: world(t1),
});

describe("State(t1) causality is declared, not inferred from a clock", () => {
  it("equal millisecond + valid causal ref → MET, with no waiting anywhere", () => {
    const s = projectDaySession(base());
    expect(s.state_t1.value).toContain(T1_ID);
    expect(s.missing_gates).toEqual([]);
    expect(s.closing_status).toBe("CLOSED");
  });

  it("the Action is an equally valid cause, not only the Effect", () => {
    const s = projectDaySession(base({ caused_by_ref: "action_1" }));
    expect(s.missing_gates).not.toContain("StateT1Available");
  });

  it("equal millisecond WITHOUT a causal ref → UNMET", () => {
    const s = projectDaySession(base({ caused_by_ref: undefined }));
    expect(s.missing_gates).toContain("StateT1Available");
    expect(s.state_t1.unresolved_reason).toMatch(/declares no caused_by_ref/);
  });

  it("a blank causal ref is not a causal ref", () => {
    const s = projectDaySession(base({ caused_by_ref: "   " }));
    expect(s.missing_gates).toContain("StateT1Available");
  });

  it("EARLIER timestamp, even with a valid causal ref → UNMET", () => {
    const s = projectDaySession(base({ recorded_at: `${DATE}T08:00:00.000Z` }));
    expect(s.missing_gates).toContain("StateT1Available");
    expect(s.state_t1.unresolved_reason).toMatch(/cannot precede its declared cause/);
  });

  it("LATER timestamp with a valid causal ref stays MET", () => {
    const s = projectDaySession(base({ recorded_at: `${DATE}T19:00:00.000Z` }));
    expect(s.missing_gates).not.toContain("StateT1Available");
  });

  it("causal ref to YESTERDAY's Action → UNMET", () => {
    const s = projectDaySession(base({ caused_by_ref: "action_from_yesterday" }));
    expect(s.missing_gates).toContain("StateT1Available");
    expect(s.state_t1.unresolved_reason).toMatch(/not an Action or Effect of this day/);
  });

  it("causal ref to ANOTHER SUBJECT's Action → UNMET", () => {
    // That subject's chain is excluded from this day, so nothing resolves.
    const s = projectDaySession({ ...base(), lifecycle: fullLifecycle({ owner: "person_someone_else" }) });
    expect(s.missing_gates).toContain("StateT1Available");
    expect(s.state_t1.unresolved_reason).toMatch(/not an Action or Effect of this day/);
  });

  it("a FAKE causal ref naming nothing → UNMET", () => {
    const s = projectDaySession(base({ caused_by_ref: "totally_made_up" }));
    expect(s.missing_gates).toContain("StateT1Available");
    expect(s.state_t1.unresolved_reason).toMatch(/not an Action or Effect of this day/);
  });
});

describe("day event ids are deterministic and per-person", () => {
  it("two different people can open the SAME calendar day", () => {
    expect(dayOpenedEventId("p_you", DAY_ID)).not.toBe(dayOpenedEventId("p_other", DAY_ID));
  });

  it("replaying the same opening yields the SAME id — the append-only log refuses the duplicate", () => {
    expect(dayOpenedEventId(PERSON, DAY_ID)).toBe(dayOpenedEventId(PERSON, DAY_ID));
  });

  it("opening and closing ids differ for the same person and day", () => {
    expect(dayOpenedEventId(PERSON, DAY_ID)).not.toBe(dayClosedEventId(PERSON, DAY_ID));
  });

  it("different days give different ids", () => {
    expect(dayOpenedEventId(PERSON, DAY_ID)).not.toBe(dayOpenedEventId(PERSON, dayId(SUBJECT, "2026-08-27")));
  });

  it("no caller-supplied text is spliced into the identifier", () => {
    const id = dayOpenedEventId("p_you forged/../x", DAY_ID);
    expect(id).toMatch(/^dayev_opened_[0-9a-f]{32}$/);
    expect(id).not.toContain("forged");
  });

  it("a field separator cannot be forged across parts", () => {
    // Plain concatenation would make these two collide.
    expect(dayOpenedEventId("a", "b_c")).not.toBe(dayOpenedEventId("a_b", "c"));
  });

  it("another person's day event cannot satisfy this person's DaySession", () => {
    const foreign = ev({
      event_type: DAY_OPENED,
      payload: openedPayload({ day_id: dayId("person_other", DATE), subject_id: "person_other" }),
    });
    const s = projectDaySession({ ...base(), events: [foreign, closed()] });
    expect(s.missing_gates).toContain("DayOpened");
    expect(s.closing_status).not.toBe("CLOSED");
  });
});
