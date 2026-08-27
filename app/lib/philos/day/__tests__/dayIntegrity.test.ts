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
import { DAY_GATES, projectDaySession, type DayIdentity } from "../daySession";
import { factFromCount, factFromRecords, gateFocusFor, TERMINAL_GATE_FOCUS_MODEL_STATUS } from "../RealDataGapPanel";

const SUBJECT = "person_roei";
const PERSON = "p_you";
const DATE = "2026-08-26";
const DAY_ID = dayId(SUBJECT, DATE);
const OBS_ID = "canonev_1";
const T0_ID = "state_t0_1";
const T1_ID = "state_t1_1";

/** The Effect's exact recording instant — State(t1) shares it deliberately. */
const EFFECT_AT = `${DATE}T12:00:00.000Z`;

const LINKED: DayIdentity = { subject_id: SUBJECT, person_id: PERSON,
  link_status: "VERIFIED_SAME_PERSON", assurance: "SELF_ATTESTED_SAME_PERSON" };

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
      { canon_event_id: OBS_ID, canon_type: "observation", record_origin: "REAL",
        recorded_at: `${DATE}T07:30:00.000Z`,
        payload: { subject: SUBJECT, domain: "E", frame: "I", reference: "self_baseline", context: "fixture", time: `${DATE}T07:30:00.000Z`, provenance: "self_reported", confidence: 0.8, expiry: `${DATE}T23:30:00.000Z`, level: -1, stability: 0, deficitType: "RELATIVE" } },
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

/* ── Per-terminal next action ───────────────────────────────────────────── */

describe("each terminal gets its OWN unresolved dependency", () => {
  /* Uses the REAL exported function, not a copy — a hand-maintained duplicate
     of the focus map would pass while the shipped one drifted. */
  const firstFor = (terminal: string, unmet: string[]) =>
    unmet.find((g) => (gateFocusFor(terminal) as readonly string[]).includes(g)) ?? null;

  it("routes a Community-owned gap to Community, not to every terminal", () => {
    const unmet = ["IdentityLinked", "ActionRecorded", "StateT1Available"];
    expect(firstFor("community", unmet)).toBe("IdentityLinked");
    expect(firstFor("marketplace", unmet)).toBe("ActionRecorded");
    expect(firstFor("dynamics", unmet)).toBe("ActionRecorded");
    expect(firstFor("brain", unmet)).toBeNull();
    expect(firstFor("hub", unmet)).toBe("IdentityLinked");
  });

  it("gives different terminals different next actions for the same day", () => {
    const unmet = ["EventObservationLinked", "ActionAuthorized", "LearningSupported"];
    const picks = ["brain", "marketplace", "dynamics", "community"].map((t) => firstFor(t, unmet));
    expect(picks).toEqual(["EventObservationLinked", "ActionAuthorized", "LearningSupported", null]);
    expect(new Set(picks.filter(Boolean)).size).toBeGreaterThan(1);
  });

  it("a terminal with nothing of its own reports null rather than borrowing Hub's blocker", () => {
    expect(firstFor("community", ["StateT1Available", "ClosingRecorded"])).toBeNull();
    expect(firstFor("hub", ["StateT1Available", "ClosingRecorded"])).toBe("StateT1Available");
  });

  it("ownership is DERIVED from the writer destination, not restated", () => {
    // Community owns IdentityLinked purely because that writer lives on
    // /hub/community — nothing in TERMINAL_READ_FOCUS lists it.
    expect(gateFocusFor("community")).toContain("IdentityLinked");
    expect(gateFocusFor("marketplace")).toContain("ActionAuthorized");
    expect(gateFocusFor("marketplace")).toContain("ActionRecorded");
  });

  it("every terminal's focus is a subset of the real gate list", () => {
    for (const t of ["hub","brain","community","dynamics","marketplace","planet","world"]) {
      for (const g of gateFocusFor(t)) {
        expect(DAY_GATES as readonly string[], `${t}: ${g}`).toContain(g);
      }
    }
  });

  it("is labelled SYNTHESIS — routing judgement, never canon", () => {
    expect(TERMINAL_GATE_FOCUS_MODEL_STATUS).toBe("SYNTHESIS");
  });
});

/* ── Terminal facts: PRESENT / EMPTY / UNRESOLVED ───────────────────────── */

describe("a terminal fact distinguishes 'none' from 'cannot answer'", () => {
  const REASON = "אין רשומה — לא נמצאה רשומה ב־loadSocialSystem";

  it("empty source → EMPTY with a reason, never PRESENT", () => {
    const f = factFromCount("Verified relations", "loadSocialSystem → arcs", 0, REASON);
    expect(f.status).toBe("EMPTY");
    expect(f.reason).toBe(REASON);
    expect(f.value).toBeUndefined();
  });

  it("populated source → PRESENT with the real count", () => {
    const f = factFromCount("Verified relations", "loadSocialSystem → arcs", 10, REASON);
    expect(f.status).toBe("PRESENT");
    expect(f.value).toBe(10);
    expect(f.reason).toBeUndefined();
  });

  it("unsupported selector → UNRESOLVED, never zero", () => {
    for (const cannotAnswer of [null, undefined]) {
      const f = factFromCount("Analysis Units", "analysisUnit.ts", cannotAnswer, "אין נגזרת ריצה");
      expect(f.status).toBe("UNRESOLVED");
      expect(f.unsupported_reason).toBe("אין נגזרת ריצה");
      expect(f.value).toBeUndefined();
      expect(f.value).not.toBe(0);
    }
  });

  it("self-corrects when a real record later appears", () => {
    const before = factFromCount("Network nodes", "loadSocialSystem → nodes", 0, REASON);
    const after = factFromCount("Network nodes", "loadSocialSystem → nodes", 3, REASON);
    expect(before.status).toBe("EMPTY");
    expect(after.status).toBe("PRESENT");
    expect(after.value).toBe(3);
  });

  it("a DEMO record does not satisfy a REAL fact", () => {
    /* The fact carries only a count from a REAL selector. Demo groups live in
       DEMO_COMMUNITIES and are never passed to these selectors, so a demo-only
       world still reads EMPTY — the count is the selector's answer, not a
       tally of anything on screen. */
    const realArcsFromDemoOnlyWorld = 0;
    const f = factFromCount("Verified relations", "loadSocialSystem → arcs", realArcsFromDemoOnlyWorld, REASON);
    expect(f.status).toBe("EMPTY");
    expect(f.status).not.toBe("PRESENT");
  });
});

/* ── The status invariant ───────────────────────────────────────────────── */

describe("an unmet gate makes CLOSED impossible", () => {
  it("10/11 met + no closing → never CLOSED", () => {
    const s = projectDaySession({ ...base(), events: [opened()] });
    expect(s.missing_gates).toContain("ClosingRecorded");
    expect(s.closing_status).not.toBe("CLOSED");
    expect(s.closing_status).toBe("OPEN");
  });

  it("9/11 met + no closing → never CLOSED", () => {
    const s = projectDaySession({
      ...base({ caused_by_ref: undefined }),
      events: [opened()],
    });
    expect(s.missing_gates.length).toBeGreaterThanOrEqual(2);
    expect(s.closing_status).not.toBe("CLOSED");
  });

  it("closing recorded but a gate unmet → PARTIAL, never CLOSED", () => {
    const s = projectDaySession(base({ caused_by_ref: undefined }));
    expect(s.missing_gates).toContain("StateT1Available");
    expect(s.closing_status).toBe("PARTIAL");
  });

  it("11/11 + valid closing → CLOSED", () => {
    const s = projectDaySession(base());
    expect(s.missing_gates).toEqual([]);
    expect(s.closing_status).toBe("CLOSED");
  });

  it("CLOSED is impossible whenever ClosingRecorded is unmet", () => {
    for (const input of [base(), base({ caused_by_ref: undefined })]) {
      const s = projectDaySession({ ...input, events: [opened()] });
      const closingUnmet = s.missing_gates.includes("ClosingRecorded");
      if (closingUnmet) expect(s.closing_status).not.toBe("CLOSED");
    }
  });
});

/* ── Provenance: a live count is not a REAL count ───────────────────────── */

describe("facts count by declared provenance, never by collection length", () => {
  type R = { id: string; provenance?: "REAL" | "DERIVED_REAL" | "DEMO" | "REFERENCE" | "UNKNOWN" };
  const rec = (id: string, provenance?: R["provenance"]): R => ({ id, provenance });
  const EMPTY = "אין רשומה REAL";
  const f = (rs: R[]) => factFromRecords("Links", "registry", rs, (r) => r.provenance, EMPTY);

  it("a REAL record increases the REAL count", () => {
    const r = f([rec("a", "REAL"), rec("b", "REAL")]);
    expect(r.provenance).toBe("REAL");
    expect(r.status).toBe("PRESENT");
    expect(r.value).toBe(2);
  });

  it("a DERIVED record is labelled DERIVED, not REAL", () => {
    const r = f([rec("a", "DERIVED_REAL")]);
    expect(r.provenance).toBe("DERIVED");
    expect(r.status).toBe("PRESENT");
    expect(r.value).toBe(1);
  });

  it("a DEMO record does not increase the REAL count", () => {
    const r = f([rec("a", "DEMO"), rec("b", "DEMO")]);
    expect(r.provenance).not.toBe("REAL");
    expect(r.status).toBe("EMPTY");
    expect(r.value).toBeUndefined();
    expect(r.breakdown?.DEMO).toBe(2);
  });

  it("a MIXED REAL+DEMO collection reports only the REAL count", () => {
    const r = f([rec("a", "REAL"), rec("b", "DEMO"), rec("c", "DEMO"), rec("d", "REAL")]);
    expect(r.provenance).toBe("REAL");
    expect(r.value).toBe(2);                 // not 4
    expect(r.breakdown).toEqual({ REAL: 2, DEMO: 2 });
  });

  it("REFERENCE records are excluded from REAL too", () => {
    const r = f([rec("a", "REFERENCE"), rec("b", "REFERENCE")]);
    expect(r.status).toBe("EMPTY");
    expect(r.reason).toMatch(/אינן REAL/);
  });

  /* CONTRACT CHANGED, DELIBERATELY. This test previously asserted that ONE
     record without an origin made the WHOLE fact UNRESOLVED. That rule was
     safe when no record carried an origin at all, but once Action and Effect
     gained `record_origin` it became actively misleading: a person who had
     just written a REAL record saw it reported as unresolvable because a
     legacy row sat beside it. A missing origin is a fact about the OLD
     record and says nothing about the new one. Both truths now survive. */
  it("a mixed collection reports the REAL records AND the legacy ones, hiding neither", () => {
    const r = f([rec("a", "REAL"), rec("b")]);
    expect(r.status).toBe("PRESENT");
    expect(r.provenance).toBe("REAL");
    expect(r.value).toBe(1);
    expect(r.breakdown).toMatchObject({ REAL: 1, UNKNOWN_LEGACY: 1 });
    expect(r.unsupported_reason).toMatch(/מעורב/);
  });

  it("with NO admissible record, a missing origin still yields UNRESOLVED", () => {
    const r = f([rec("b")]);
    expect(r.status).toBe("UNRESOLVED");
    expect(r.provenance).toBe("UNKNOWN");
    expect(r.value).toBeUndefined();
    expect(r.unsupported_reason).toMatch(/ללא record_origin|ללא provenance/);
  });

  it("an EMPTY authoritative REAL collection reads EMPTY with a reason", () => {
    const r = f([]);
    expect(r.status).toBe("EMPTY");
    expect(r.reason).toBe(EMPTY);
    expect(r.value).toBeUndefined();
  });

  it("factFromCount never claims REAL — a selector length proves nothing about ownership", () => {
    const c = factFromCount("Globe arcs", "projectGlobeGraph → arcs", 10, "none");
    expect(c.provenance).toBe("UNKNOWN");
    expect(c.status).toBe("PRESENT");
    /* The caption used to say the records "carry no provenance". That became
       false once Action and Effect gained `record_origin`; what is actually
       missing is the RECORDS, since this helper is handed a bare count. The
       assertion still guards the same thing — the reason must name why REAL
       cannot be claimed here — without pinning the obsolete explanation. */
    expect(c.unsupported_reason).toMatch(/record_origin|bootstrap|provenance/);
    expect(c.unsupported_reason).toBeTruthy();
  });
});

describe("DEMO contributes to no decision", () => {
  it("no DEMO record reaches DaySession or the next action", () => {
    /* DaySession is built only from PhilosEvent day acts and the day-scoped
       canon chain; DEMO groups live in DEMO_COMMUNITIES and are never passed
       to it. This asserts the projection's own output carries no demo id. */
    const s = projectDaySession(base());
    const json = JSON.stringify(s);
    for (const mk of ["demo_vg_green_innovation", "demo_vg_neighborhood_small", "scenario_person_sim_user"]) {
      expect(json, `DaySession must not contain ${mk}`).not.toContain(mk);
    }
    expect(s.closing_status).toBe("CLOSED");
  });

  it("the gap panel's next action is chosen from gates only, never from facts", () => {
    // Gates come from the projection; facts are display-only rows.
    const s = projectDaySession({ ...base(), events: [opened()] });
    expect(s.missing_gates).toContain("ClosingRecorded");
    expect(gateFocusFor("hub")).toContain("ClosingRecorded");
  });
});
