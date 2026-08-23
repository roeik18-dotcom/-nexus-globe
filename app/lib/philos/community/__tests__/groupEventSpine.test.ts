/**
 * The operational spine, at every scale and every awkward input the ruling
 * names. Nothing here is promoted to REAL: every fixture is DEMO or IMPORTED.
 */
import { describe, expect, it } from "vitest";
import { validateGroupEvent, GROUP_EVENT_TYPES, type GroupEvent } from "../groupEvent";
import { parseGroupEvents } from "../groupEventStore";
import { projectGroupOperationalState, projectAllGroupStates, orderEvents } from "../groupOperationalState";
import { deriveCandidateMatches, pendingCandidates } from "../needResourceBridge";
import { deriveEventRelations } from "../eventGroupRelations";
import { personLabel, isViewerRelativeLabel, countViewerRelativeLabels } from "../../person/personLabel";

const ev = (o: Partial<GroupEvent> & { event_id: string; event_type: string; object_id: string }): GroupEvent => ({
  group_id: "g1", occurred_at: "2026-08-01T10:00:00Z", recorded_at: "2026-08-01T10:00:00Z",
  source: "fixture", provenance: "DEMO", status: "RECORDED", ...o,
} as GroupEvent);

describe("the event model", () => {
  it("covers every type the ruling names", () => {
    for (const t of ["NEED_DECLARED","NEED_UPDATED","NEED_RESOLVED","RESOURCE_OFFERED","RESOURCE_UPDATED",
      "RESOURCE_WITHDRAWN","ACTION_PROPOSED","ACTION_STARTED","ACTION_COMPLETED","ACTION_CANCELLED",
      "EFFECT_OBSERVED","EVIDENCE_ATTACHED","MEMBER_JOINED","MEMBER_LEFT","ROLE_CHANGED","BUDGET_RECEIVED",
      "BUDGET_SPENT","BUDGET_COMMITTED","TENSION_OBSERVED","VALUE_MAPPING_PROPOSED","VALUE_MAPPING_CONFIRMED"]) {
      expect(GROUP_EVENT_TYPES).toContain(t);
    }
  });

  it("refuses to let a derivation become a social actor", () => {
    const r = validateGroupEvent(ev({ event_id: "e1", event_type: "NEED_DECLARED", object_id: "n1", provenance: "DERIVED", actor_id: "ai" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rejection.because).toContain("DERIVED");
    // The same event without an actor is fine — deriving is allowed, acting is not.
    expect(validateGroupEvent(ev({ event_id: "e1", event_type: "NEED_DECLARED", object_id: "n1", provenance: "DERIVED" })).ok).toBe(true);
  });

  it("preserves an event type this build does not know", () => {
    const s = projectGroupOperationalState("g1", [
      ev({ event_id: "e1", event_type: "SOMETHING_FROM_A_NEWER_BUILD", object_id: "x1" }),
      ev({ event_id: "e2", event_type: "NEED_DECLARED", object_id: "n1", status: "OPEN" }),
    ]);
    expect(s.unrecognised).toHaveLength(1);
    expect(s.counts.events).toBe(2);
    expect(s.needs).toHaveLength(1);
  });
});

describe("projection scale and awkward input", () => {
  it("0 events yields NO_EVENTS on every channel, never an empty measurement", () => {
    const s = projectGroupOperationalState("g1", []);
    expect(s.counts.events).toBe(0);
    for (const c of Object.values(s.channels)) expect(c).toBe("NO_EVENTS");
    expect(s.needs).toEqual([]);
    expect(s.budget).toBeNull();
  });

  it("1 event", () => {
    const s = projectGroupOperationalState("g1", [ev({ event_id: "e1", event_type: "NEED_DECLARED", object_id: "n1", status: "OPEN" })]);
    expect(s.channels.needs).toBe("MEASURED");
    expect(s.channels.resources).toBe("NO_EVENTS");
    expect(s.needs[0].status).toBe("OPEN");
  });

  it("folds a full lifecycle to current state", () => {
    const s = projectGroupOperationalState("g1", [
      ev({ event_id: "e1", event_type: "NEED_DECLARED", object_id: "n1", status: "OPEN", payload: { subvalue_id: "SV026", quantity: 5, unit: "שעות" } }),
      ev({ event_id: "e2", event_type: "RESOURCE_OFFERED", object_id: "r1", payload: { subvalue_id: "SV026", quantity: 9, unit: "שעות" } }),
      ev({ event_id: "e3", event_type: "MATCH_PROPOSED", object_id: "m1", payload: { need_ref: "n1", resource_ref: "r1" } }),
      ev({ event_id: "e4", event_type: "MATCH_ACCEPTED", object_id: "m1", payload: { need_ref: "n1", resource_ref: "r1" } }),
      ev({ event_id: "e5", event_type: "ACTION_PROPOSED", object_id: "a1", payload: { match_ref: "m1", inputs: ["n1", "r1"] } }),
      ev({ event_id: "e6", event_type: "ACTION_STARTED", object_id: "a1" }),
      ev({ event_id: "e7", event_type: "ACTION_COMPLETED", object_id: "a1" }),
      ev({ event_id: "e8", event_type: "EFFECT_OBSERVED", object_id: "f1", payload: { action_ref: "a1", metric: "שעות", value: 5 } }),
      ev({ event_id: "e9", event_type: "EVIDENCE_ATTACHED", object_id: "v1", payload: { effect_ref: "f1", verified_by: "p_a" } }),
      ev({ event_id: "e10", event_type: "NEED_RESOLVED", object_id: "n1" }),
    ]);
    expect(s.needs[0].status).toBe("RESOLVED");
    expect(s.matches[0].status).toBe("ACCEPTED");
    expect(s.actions[0].status).toBe("COMPLETED");
    // VERIFIED is what evidence DOES to an effect — nothing else sets it.
    expect(s.effects[0].status).toBe("VERIFIED");
    expect(s.evidence).toHaveLength(1);
    // The chain is ids end to end.
    expect(s.actions[0].inputs).toEqual(["n1", "r1"]);
    expect(s.effects[0].action_ref).toBe("a1");
    expect(s.evidence[0].effect_ref).toBe("f1");
  });

  it("an effect without evidence stays CLAIMED", () => {
    const s = projectGroupOperationalState("g1", [ev({ event_id: "e1", event_type: "EFFECT_OBSERVED", object_id: "f1" })]);
    expect(s.effects[0].status).toBe("CLAIMED");
  });

  it("is order-independent — a shuffled file folds to the same state", () => {
    const evs = [
      ev({ event_id: "e1", event_type: "MEMBER_JOINED", object_id: "p1", occurred_at: "2026-08-01T10:00:00Z", payload: { person_id: "p1" } }),
      ev({ event_id: "e2", event_type: "ROLE_CHANGED", object_id: "p1", occurred_at: "2026-08-02T10:00:00Z", payload: { person_id: "p1", role: "מוביל" } }),
      ev({ event_id: "e3", event_type: "MEMBER_LEFT", object_id: "p1", occurred_at: "2026-08-03T10:00:00Z", payload: { person_id: "p1" } }),
    ];
    const inOrder = projectGroupOperationalState("g1", evs);
    const shuffled = projectGroupOperationalState("g1", [evs[2], evs[0], evs[1]]);
    expect(JSON.stringify(shuffled)).toBe(JSON.stringify(inOrder));
    expect(inOrder.members[0].active).toBe(false);
    expect(inOrder.members[0].left_at).toBe("2026-08-03T10:00:00Z");
    // A member who left is not on the active roster and holds no role.
    expect(inOrder.roles).toEqual([]);
    expect(orderEvents([evs[2], evs[0]])[0].event_id).toBe("e1");
  });

  it("rejects a duplicate event id rather than folding it twice", () => {
    const text = [
      JSON.stringify(ev({ event_id: "e1", event_type: "BUDGET_RECEIVED", object_id: "b1", payload: { amount: 100, currency: "ILS" } })),
      JSON.stringify(ev({ event_id: "e1", event_type: "BUDGET_RECEIVED", object_id: "b1", payload: { amount: 100, currency: "ILS" } })),
      "{ broken",
      JSON.stringify({ event_id: "e2", group_id: "g1" }),
    ].join("\n");
    const { events, rejected } = parseGroupEvents(text);
    expect(events).toHaveLength(1);
    expect(rejected).toHaveLength(3);
    expect(rejected[0].because).toContain("כפול");
    // The duplicate did NOT double the budget.
    expect(projectGroupOperationalState("g1", events).budget!.received).toBe(100);
  });

  it("holds at 50 groups with mixed activity", () => {
    const evs: GroupEvent[] = [];
    for (let g = 0; g < 50; g++) {
      evs.push(ev({ event_id: `n${g}`, group_id: `g${g}`, event_type: "NEED_DECLARED", object_id: `need_${g}`, status: "OPEN", payload: { subvalue_id: `SV${String((g % 10) + 1).padStart(3, "0")}` } }));
      evs.push(ev({ event_id: `r${g}`, group_id: `g${g}`, event_type: "RESOURCE_OFFERED", object_id: `res_${g}`, payload: { subvalue_id: `SV${String((g % 10) + 1).padStart(3, "0")}` } }));
      evs.push(ev({ event_id: `b${g}`, group_id: `g${g}`, event_type: "BUDGET_RECEIVED", object_id: `bud_${g}`, payload: { amount: 100 * g, currency: "ILS" } }));
    }
    const states = projectAllGroupStates(evs);
    expect(states.size).toBe(50);
    expect([...states.values()].every((s) => s.channels.needs === "MEASURED")).toBe(true);
    expect([...states.values()].every((s) => s.counts.demo === 3)).toBe(true);
    expect([...states.values()].every((s) => s.counts.real === 0)).toBe(true);
  });
});

describe("need ↔ resource bridge", () => {
  const needs = [{ need_id: "n1", group_id: "g1", status: "OPEN", subvalue_id: "SV026", unit: "שעות", geography: "חיפה", provenance: "DEMO", source: "f", declared_at: "", last_event_id: "e1" }] as never;
  const resources = [
    { resource_id: "r1", group_id: "g2", status: "AVAILABLE", subvalue_id: "SV026", provenance: "DEMO", source: "f", offered_at: "", last_event_id: "e2" },
    { resource_id: "r2", group_id: "g3", status: "AVAILABLE", subvalue_id: "SV999", provenance: "DEMO", source: "f", offered_at: "", last_event_id: "e3" },
  ] as never;

  it("pairs only on a recorded shared field, never on resemblance", () => {
    const c = deriveCandidateMatches(needs, resources);
    expect(c).toHaveLength(1);
    expect(c[0].resource_ref).toBe("r1");
    expect(c[0].bases).toEqual(["SHARED_SUBVALUE"]);
    expect(c[0].provenance).toBe("DERIVED");
    expect(c[0].cross_group).toBe(true);
  });

  it("a candidate is not an acceptance and not an action", () => {
    const c = deriveCandidateMatches(needs, resources);
    // Nothing in a candidate can be read as agreed or performed.
    expect(JSON.stringify(c)).not.toContain("ACCEPTED");
    const decided = [{ match_id: "m1", need_ref: "n1", resource_ref: "r1", group_id: "g1", status: "ACCEPTED", provenance: "REAL", source: "s", proposed_at: "", last_event_id: "e" }] as never;
    expect(pendingCandidates(c, decided)).toHaveLength(0);
  });
});

describe("relations appear only when history justifies them", () => {
  it("two isolated groups produce no edge", () => {
    const states = projectAllGroupStates([
      ev({ event_id: "e1", group_id: "gA", event_type: "NEED_DECLARED", object_id: "n1", status: "OPEN" }),
      ev({ event_id: "e2", group_id: "gB", event_type: "RESOURCE_OFFERED", object_id: "r1" }),
    ]);
    expect(deriveEventRelations(states)).toHaveLength(0);
  });

  it("two groups interacting produce edges that name their event ids", () => {
    const evs = [
      ev({ event_id: "e1", group_id: "gA", event_type: "NEED_DECLARED", object_id: "n1", status: "OPEN", payload: { subvalue_id: "SV026" } }),
      ev({ event_id: "e2", group_id: "gB", event_type: "NEED_DECLARED", object_id: "n2", status: "OPEN", payload: { subvalue_id: "SV026" } }),
      ev({ event_id: "e3", group_id: "gA", event_type: "MEMBER_JOINED", object_id: "p1", payload: { person_id: "p1" } }),
      ev({ event_id: "e4", group_id: "gB", event_type: "MEMBER_JOINED", object_id: "p1", payload: { person_id: "p1" } }),
      ev({ event_id: "e5", group_id: "gA", event_type: "BUDGET_SPENT", object_id: "b1", payload: { amount: 500, currency: "ILS", counterparty_group_id: "gB" } }),
    ];
    const rel = deriveEventRelations(projectAllGroupStates(evs));
    const types = rel.map((r) => r.type).sort();
    expect(types).toEqual(["OVERLAPPING_MEMBERS", "RESOURCE_FLOW", "SHARED_NEED"]);
    expect(rel.every((r) => r.justifying_event_ids.length > 0)).toBe(true);
    expect(rel.find((r) => r.type === "RESOURCE_FLOW")!.justifying_event_ids).toEqual(["e5"]);
  });

  it("does not turn a value disagreement into a CONFLICT edge", () => {
    const rel = deriveEventRelations(projectAllGroupStates([
      ev({ event_id: "e1", group_id: "gA", event_type: "TENSION_OBSERVED", object_id: "t1", payload: { pole_a: "חופש", pole_b: "כבוד" } }),
      ev({ event_id: "e2", group_id: "gB", event_type: "NEED_DECLARED", object_id: "n1", status: "OPEN" }),
    ]));
    // The poles are values, not groups — no edge.
    expect(rel.filter((r) => r.type === "CONFLICT")).toHaveLength(0);
  });
});

describe("viewer-relative labels never reach another reader", () => {
  it("resolves the stored \"את/ה\" to the id for anyone who is not that person", () => {
    expect(isViewerRelativeLabel("את/ה")).toBe(true);
    const forOwner = personLabel("p_you", "את/ה", ["p_you"]);
    expect(forOwner).toEqual({ text: "את/ה", status: "SECOND_PERSON" });
    const forOther = personLabel("p_you", "את/ה", ["p_bet"]);
    expect(forOther.text).toBe("p_you");
    expect(forOther.status).toBe("UNRESOLVED_NAME");
    expect(forOther.text).not.toContain("את");
  });

  it("leaves a real recorded name alone for everyone", () => {
    expect(personLabel("p_dana", "דנה לוי", ["p_bet"])).toEqual({ text: "דנה לוי", status: "RECORDED_NAME" });
  });

  it("counts canonical records that still carry viewer-relative language", () => {
    expect(countViewerRelativeLabels([
      { person_id: "p_you", display_name: "את/ה" },
      { person_id: "p_dana", display_name: "דנה לוי" },
      { person_id: "p_x", display_name: "you" },
    ])).toBe(2);
  });

  it("no production module still stamps a second-person constant in CODE", async () => {
    const { readFileSync } = await import("node:fs");
    const { execSync } = await import("node:child_process");
    const files = execSync(`grep -rl "את/ה" app --include=*.ts --include=*.tsx || true`, { encoding: "utf8" })
      .split("\n").filter(Boolean)
      .filter((f) => !f.includes("__tests__") && !f.includes("personLabel"));
    const offenders: string[] = [];
    for (const f of files) {
      let inBlock = false;
      for (const line of readFileSync(f, "utf8").split("\n")) {
        const t = line.trim();
        const opens = t.includes("/*"), closes = t.includes("*/");
        const was = inBlock;
        if (opens && !closes) inBlock = true;
        if (closes) inBlock = false;
        if (was || opens || t.startsWith("//") || t.startsWith("*")) continue;
        if (t.includes("את/ה")) { offenders.push(`${f}: ${t.slice(0, 60)}`); break; }
      }
    }
    expect(offenders).toEqual([]);
  });
});
