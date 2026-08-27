/**
 * THE FRAME IS ANCHORED TO THE DAY'S OWN OBSERVATION — NEVER THE LATEST.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildRealOrientationFrame, type OrientationFrameInput } from "../realOrientationFrame";
import type { CanonEvent } from "../../canon/canonEvent";
import type { DomainStateRecord } from "../../canon/domainStateStore";

const SUBJ = "person_roei";
const ANCHOR = "26b866a3-91e4-4c10-9caf-751b71030e2f";
const STATE = "dstate_mtbhct58_000001";
const UNITS = ["time", "matter", "space_gap", "cognitive", "personal", "systemic"];

const obs = (over: Record<string, unknown> = {}) => ({
  subject: SUBJ, domain: "C", frame: "I", level: -2, confidence: 0.95,
  context: "אני רואה שהמערכת בנויה", time: "2026-08-27T11:56:11.916Z",
  /* EXACTLY the shape of the stored REAL record — `stability` is a number and
     `deficitType` is an enum, not the prose the first draft of this fixture
     guessed. A fixture that does not match the store proves nothing. */
  provenance: "self_reported", reference: "self_baseline", stability: 0,
  deficitType: "RELATIVE", expiry: "2026-09-10T11:56:11.916Z",
  analysis_unit_ids: UNITS, ...over });

/* `origin: null` means the field is ABSENT — a default parameter would have
   silently replaced an explicit `undefined` with "REAL", so the legacy case
   would never have been exercised. */
const ev = (id: string, over: Record<string, unknown> = {}, origin: string | null = "REAL") => ({
  canon_event_id: id, canon_type: "observation", recorded_at: "2026-08-27T11:56:11.916Z",
  payload: obs(over), ...(origin ? { record_origin: origin } : {}),
}) as unknown as CanonEvent;

const st = (id = STATE, over: Record<string, unknown> = {}) => ({
  state_id: id, recorded_at: "2026-08-27T12:09:36.908Z",
  state: { subject: SUBJ, domain_id: "human_temperament",
    parameter_id: "temperament_response_intensity", level: 2, confidence: 0.9,
    observed_at: "2026-08-27T12:09:36.908Z", provenance: "REAL", ...over },
}) as unknown as DomainStateRecord;

const base = (over: Partial<OrientationFrameInput> = {}): OrientationFrameInput => ({
  opening: { day_id: "day_2026-08-27_person_roei", event_ref: ANCHOR,
    observation_ref: ANCHOR, state_t0_refs: [STATE] },
  events: [ev(ANCHOR)], domainStates: [st()], subject_id: SUBJ, ...over });

const ok = (i: OrientationFrameInput) => {
  const r = buildRealOrientationFrame(i);
  if (!r.resolved) throw new Error("expected resolved, got " + r.reason);
  return r;
};
const why = (i: OrientationFrameInput) => {
  const r = buildRealOrientationFrame(i);
  return r.resolved ? "RESOLVED" : r.reason;
};

describe("1 + 3 + 10. the anchored frame", () => {
  it("loads the REAL anchor and reports 6 OBSERVED / 4 UNKNOWN", () => {
    const f = ok(base());
    expect(f.canon_event_id).toBe(ANCHOR);
    expect(f.state_t0_id).toBe(STATE);
    expect(f.observedCount).toBe(6);
    expect(f.unknownCount).toBe(4);
    expect(f.readings).toHaveLength(10);
    expect(f.foundation).toHaveLength(4);
    expect(f.departments).toHaveLength(6);
  });

  it("the six observed and four unknown are exactly the named ones", () => {
    const f = ok(base());
    const observed = f.readings.filter((r) => r.status !== "unknown").map((r) => r.unitId).sort();
    const unknown = f.readings.filter((r) => r.status === "unknown").map((r) => r.unitId).sort();
    expect(observed).toEqual([...UNITS].sort());
    expect(unknown).toEqual(["emotional", "energy", "physical", "social"]);
  });
});

describe("2 + 16. the anchor cannot be replaced", () => {
  it("a NEWER Observation does not become the frame", () => {
    const newer = ev("canon_newer", { analysis_unit_ids: ["energy", "social"] });
    const f = ok(base({ events: [ev(ANCHOR), newer] }));
    /* The day still means what it meant when it opened. */
    expect(f.canon_event_id).toBe(ANCHOR);
    expect(f.observedCount).toBe(6);
    expect(f.readings.find((r) => r.unitId === "energy")!.status).toBe("unknown");
  });

  it("16. a historical day uses ITS OWN opening refs", () => {
    const older = ev("canon_older", { analysis_unit_ids: ["energy"] });
    const f = ok(base({
      opening: { day_id: "day_2026-08-26_person_roei", event_ref: "canon_older",
        observation_ref: "canon_older", state_t0_refs: [STATE] },
      events: [ev(ANCHOR), older] }));
    expect(f.canon_event_id).toBe("canon_older");
    expect(f.observedCount).toBe(1);
  });
});

describe("3-9. every refusal is explicit, with no fallback", () => {
  it("17. no opening → a truthful empty state, not a borrowed record", () => {
    expect(why(base({ opening: null }))).toBe("no_opening");
  });
  it("mismatched refs → unresolved", () => {
    expect(why(base({ opening: { day_id: "d", event_ref: ANCHOR,
      observation_ref: "other", state_t0_refs: [STATE] } }))).toBe("refs_disagree");
  });
  it("missing record → unresolved", () => {
    expect(why(base({ events: [] }))).toBe("event_not_found");
  });
  it("5. DEMO / DERIVED / IMPORTED / missing origin → unresolved", () => {
    for (const o of ["DEMO", "DERIVED", "IMPORTED", null] as (string | null)[]) {
      expect(why(base({ events: [ev(ANCHOR, {}, o)] })), String(o)).toBe("origin_not_real");
    }
  });
  it("6. another subject → unresolved", () => {
    expect(why(base({ events: [ev(ANCHOR, { subject: "person_bet" })] }))).toBe("subject_mismatch");
  });
  it("7. an invalid payload → unresolved", () => {
    expect(why(base({ events: [ev(ANCHOR, { level: "not-a-number" })] }))).toBe("invalid_observation");
  });
  it("not an observation → unresolved", () => {
    const e = { ...ev(ANCHOR), canon_type: "action" } as unknown as CanonEvent;
    expect(why(base({ events: [e] }))).toBe("not_an_observation");
  });
});

describe("8-9. State(t0) comes from the citation, and is checked", () => {
  it("8. resolves from opening.state_t0_refs", () => {
    expect(ok(base()).state_t0_id).toBe(STATE);
  });
  it("9. non-REAL or other-subject State(t0) is rejected, never substituted", () => {
    expect(why(base({ domainStates: [st(STATE, { provenance: "DEMO" })] }))).toBe("state_t0_not_real");
    expect(why(base({ domainStates: [st(STATE, { subject: "person_bet" })] }))).toBe("state_t0_subject_mismatch");
    expect(why(base({ domainStates: [] }))).toBe("state_t0_not_found");
    expect(why(base({ opening: { day_id: "d", event_ref: ANCHOR, observation_ref: ANCHOR,
      state_t0_refs: [] } }))).toBe("state_t0_not_cited");
    /* A second, valid state must NOT be picked up when the cited one fails. */
    expect(why(base({ domainStates: [st("dstate_other")] }))).toBe("state_t0_not_found");
  });
});

describe("13-15. nothing is inferred, nothing is mutated", () => {
  it("13. no reading is upgraded from UNKNOWN, and none carries a made-up number", () => {
    const f = ok(base());
    for (const r of f.readings) {
      expect(r.direction).toBeNull();
      expect(r.intensity).toBeNull();
      expect(r.confidence).toBeNull();
      if (r.status === "unknown") expect(r.sourceRefs).toEqual([]);
    }
  });

  it("14. no scenario or demo id can appear in a REAL frame", () => {
    const f = ok(base());
    const json = JSON.stringify(f);
    expect(json).not.toContain("scenario_person_sim_user");
    expect(json).not.toMatch(/scenario_/);
    expect(f.readings.flatMap((r) => r.sourceRefs).every((id) => id === ANCHOR)).toBe(true);
  });

  it("15. the input records are untouched", () => {
    const e = ev(ANCHOR), s = st();
    const before = JSON.stringify([e, s]);
    buildRealOrientationFrame(base({ events: [e], domainStates: [s] }));
    expect(JSON.stringify([e, s])).toBe(before);
  });
});

describe("11-12 + 18-19. one frame, seven terminals, diagnostics last", () => {
  const PAGES = ["hub/page.tsx", "brain/page.tsx", "dynamics/page.tsx", "marketplace/page.tsx",
    "hub/community/page.tsx", "planet/page.tsx", "world/page.tsx"];
  const src = (f: string) => readFileSync(join(process.cwd(), "app", f), "utf8");

  it("11+12. all seven read the ONE loader — no terminal resolves its own anchor", () => {
    for (const f of PAGES) {
      expect(src(f), f).toContain("loadRealOrientationFrame(");
      expect(src(f), f).toContain("<RealOrientationPanel");
      /* A page must not call the pure builder itself, which would let it
         choose different inputs and therefore a different anchor. */
      expect(src(f), f).not.toContain("buildRealOrientationFrame(");
    }
  });

  it("18. material comes BEFORE the chain, and the gap panel is last", () => {
    for (const f of PAGES) {
      const s = src(f);
      const o = s.indexOf("<RealOrientationPanel");
      const a = s.indexOf("<ActionEffectPanel");
      const g = s.indexOf("<RealDataGapPanel");
      expect(o, f).toBeGreaterThan(-1);
      expect(o, `${f}: orientation before chain`).toBeLessThan(a);
      expect(a, `${f}: chain before diagnostics`).toBeLessThan(g);
    }
  });

  it("19. DemoSimulationSection stays opt-in and unchanged", () => {
    const demo = src("lib/philos/analysis/DemoSimulationSection.tsx");
    expect(demo).toContain('process.env.PHILOS_SHOW_DEMO === "1"');
    expect(demo).toContain("if (!demoToolsEnabled()) return null;");
    /* The REAL panel must never import the scenario. */
    const panel = src("lib/philos/analysis/RealOrientationPanel.tsx");
    expect(panel).not.toContain("acceptanceScenario");
    expect(panel).not.toContain("loadAcceptanceScenario");
  });

  it("the 4+6 drawing is SHARED, not duplicated", () => {
    const panel = src("lib/philos/analysis/RealOrientationPanel.tsx");
    const header = src("lib/philos/analysis/PersonEventOrientationHeader.tsx");
    /* Both import UnitRow; neither declares it. */
    expect(panel).toContain('from "./analysisUnitSections"');
    expect(header).toContain('from "./analysisUnitSections"');
    expect(panel).not.toContain("function UnitRow");
    expect(header).not.toContain("function UnitRow");
  });
});
