/**
 * ONE PAIR, SEVEN TERMINALS, NO TERMINAL CLAIMING MORE THAN IT KNOWS.
 */
import { describe, expect, it } from "vitest";

import {
  projectActionEffects, allReadings, readingFor, type ProjectionTerminal,
} from "../actionEffectProjection";
import type { ActionRecord } from "../../canon/actionStore";
import type { EffectRecord } from "../../canon/effectStore";

const SUBJ = "person_roei";
const A_ID = "action_new_001", E_ID = "effect_new_001";

const act = (over: Record<string, unknown> = {}, origin?: string) => ({
  action: { action_id: A_ID, owner: SUBJ, day_ref: "day_2026-08-27_person_roei",
    provenance: "טקסט חופשי", ...over },
  recorded_at: "t", ...(origin ? { record_origin: origin } : {}),
}) as unknown as ActionRecord;

const eff = (over: Record<string, unknown> = {}, origin?: string) => ({
  effect: { effect_id: E_ID, action_ref: A_ID, subject: SUBJ, provenance: "prose", ...over },
  recorded_at: "t", ...(origin ? { record_origin: origin } : {}),
}) as unknown as EffectRecord;

const project = (a: ActionRecord[], e: EffectRecord[], extra = {}) =>
  projectActionEffects({ actions: a, effects: e, subject_id: SUBJ, ...extra });

const TERMINALS: ProjectionTerminal[] =
  ["hub", "brain", "dynamics", "marketplace", "community", "planet", "world"];

describe("1. the same ids reach all seven projections", () => {
  it("every terminal names the identical action_id and effect_id", () => {
    const { pairs } = project([act({}, "REAL")], [eff({}, "REAL")]);
    expect(pairs).toHaveLength(1);
    const readings = allReadings(pairs[0]);
    expect(readings).toHaveLength(7);
    for (const r of readings) {
      expect(r.knows, r.terminal).toContain(A_ID);
      expect(r.knows, r.terminal).toContain(E_ID);
      expect(r.ids_inspectable).toBe(true);
    }
    expect(new Set(readings.map((r) => r.terminal))).toEqual(new Set(TERMINALS));
  });
});

describe("2-4. what is excluded, and why", () => {
  it("2. an Effect naming a different Action is not attached", () => {
    const { pairs } = project([act({}, "REAL")], [eff({ action_ref: "action_other" }, "REAL")]);
    expect(pairs[0].linked).toBe(false);
    expect(pairs[0].effect_id).toBeNull();
  });

  it("3. another subject's records are excluded, with a stated reason", () => {
    const r = project([act({ owner: "person_bet" }, "REAL")], []);
    expect(r.pairs).toHaveLength(0);
    expect(r.excluded[0].reason).toContain("different subject");

    /* And an Effect that merely matches the ref but belongs to someone else. */
    const r2 = project([act({}, "REAL")], [eff({ subject: "person_bet" }, "REAL")]);
    expect(r2.pairs[0].linked).toBe(false);
    expect(r2.excluded.some((x) => x.reason.includes("effect.subject"))).toBe(true);
  });

  it("4. DEMO / DERIVED / IMPORTED never count as REAL", () => {
    for (const o of ["DEMO", "DERIVED", "IMPORTED"]) {
      const r = project([act({}, o)], []);
      expect(r.counts.real, o).toBe(0);
      expect(r.pairs[0].action_origin, o).toBe(o);
    }
  });
});

describe("5. legacy records are shown separately and are never authoritative", () => {
  it("a missing origin is UNKNOWN, counted apart from REAL", () => {
    const r = project([act({ action_id: "a_legacy" }), act({}, "REAL")], []);
    expect(r.counts).toMatchObject({ real: 1, legacy: 1 });
    const legacy = r.pairs.find((p) => p.action_id === "a_legacy")!;
    expect(legacy.action_origin).toBe("UNKNOWN");
    /* Still visible — hiding a person's record is its own dishonesty. */
    expect(readingFor("hub", legacy).knows).toContain("a_legacy");
  });
});

describe("6-9. no terminal may overclaim", () => {
  const pair = () => project([act({}, "REAL")], [eff({}, "REAL")]).pairs[0];

  it("6. a personal Action is visible on Community but NOT group-attributed", () => {
    const p = pair();
    expect(p.scope).toBe("PERSONAL");
    const r = readingFor("community", p);
    expect(r.knows).toContain(A_ID);
    expect(r.does_not_know).toContain("לא משויכת לקבוצה");
    expect(r.unresolved_reason).toContain("no executable Action→group reference");
  });

  it("6b. an executable group reference DOES attribute it — and only then", () => {
    const p = project([act({}, "REAL")], [eff({}, "REAL")],
      { groupLinkedActionIds: [A_ID] }).pairs[0];
    expect(p.scope).toBe("GROUP_ATTRIBUTED");
  });

  it("7. no relations → Planet claims no network propagation", () => {
    const r = readingFor("planet", pair());
    expect(r.unresolved_reason).toBe("no network propagation established");
    expect(r.knows).toContain(A_ID);
    expect(r.does_not_know).toContain("לא הוכחה התפשטות");
    /* Scope must not have been upgraded without relation records. */
    expect(pair().scope).not.toBe("NETWORK_PROPAGATED");
  });

  it("8. World never converts one personal Effect into systemic impact", () => {
    const r = readingFor("world", pair());
    expect(r.unresolved_reason).toBe("systemic effect not established");
    expect(r.does_not_know).toContain("אינה השפעה עולמית");
    expect(pair().scope).not.toBe("SYSTEMIC");
  });

  it("9. no evidence and no learning may be claimed anywhere", () => {
    for (const r of allReadings(pair())) {
      expect(r.knows, r.terminal).not.toMatch(/מאומת|verified|למידה|learning/i);
    }
    expect(readingFor("hub", pair()).does_not_know).toContain("אין כאן ראיה מאומתת");
    expect(readingFor("brain", pair()).does_not_know).toContain("למידה");
  });
});

describe("10. the projection mutates nothing", () => {
  it("the input records are untouched, structurally and by identity", () => {
    const a = act({}, "REAL"), e = eff({}, "REAL");
    const beforeA = JSON.stringify(a), beforeE = JSON.stringify(e);
    const actions = [a], effects = [e];
    project(actions, effects);
    expect(JSON.stringify(a)).toBe(beforeA);
    expect(JSON.stringify(e)).toBe(beforeE);
    expect(actions).toHaveLength(1);
    expect(effects).toHaveLength(1);
  });

  it("an Action with no Effect is a real state, not an error", () => {
    const { pairs } = project([act({}, "REAL")], []);
    expect(pairs[0].linked).toBe(false);
    expect(readingFor("dynamics", pairs[0]).does_not_know).toContain("אין תוצאה מקושרת");
  });
});
