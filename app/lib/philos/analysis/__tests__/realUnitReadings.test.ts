/**
 * REAL ANALYSIS UNITS — persistence, selection, and the four exclusions.
 *
 * The point under test throughout: a reading exists because a human ticked a
 * box, and it carries no number. Every assertion that a unit is OBSERVED is
 * paired with an assertion that direction/intensity/confidence stayed null.
 */
import { describe, expect, it } from "vitest";

import {
  ANALYSIS_UNIT_IDS, isAnalysisUnitId, normalizeAnalysisUnitIds,
} from "../../analysisUnitIds";
import { validateObservation, type Observation } from "../../canon/observation";
import { recordOriginOf, validateCanonEvent, type CanonEvent } from "../../canon/canonEvent";
import { RECORD_ORIGINS, isRecordOrigin, type RecordOrigin } from "../../recordOrigin";
import { checkReadingIntegrity } from "../analysisUnit";
import { selectRealUnitReadings } from "../realUnitReadings";

const SUBJECT = "person_real";
const OTHER = "person_other";

function obs(over: Partial<Observation> = {}): Observation {
  return {
    subject: SUBJECT, domain: "E", frame: "I", reference: "self_baseline",
    context: "נצפה בפועל", time: "2026-08-25T10:00:00+03:00",
    provenance: "self_reported", confidence: 0.8,
    expiry: "2026-09-25T10:00:00+03:00", level: -1, stability: 0,
    deficitType: "RELATIVE", ...over,
  };
}

/* A REAL record by default, because that is the only thing that contributes.
   `origin` is explicit in every exclusion test so the reason a record is
   excluded is visible in the test itself, never implied by a helper. */
function ev(id: string, o: Observation, origin: RecordOrigin = "REAL"): CanonEvent {
  return { canon_event_id: id, canon_type: "observation", payload: o,
    recorded_at: "2026-08-25T10:00:00Z", record_origin: origin };
}

/* A record written before `record_origin` existed: the field is absent, not
   UNKNOWN. Both must read the same way, and neither may contribute. */
function legacyEv(id: string, o: Observation): CanonEvent {
  return { canon_event_id: id, canon_type: "observation", payload: o,
    recorded_at: "2026-08-25T10:00:00Z" };
}

describe("the id vocabulary", () => {
  it("accepts each of the ten", () => {
    expect(ANALYSIS_UNIT_IDS).toHaveLength(10);
    for (const id of ANALYSIS_UNIT_IDS) expect(isAnalysisUnitId(id)).toBe(true);
  });

  it("rejects an unknown id", () => {
    for (const bad of ["spiritual", "TIME", "", "matter ", 7, null, {}]) {
      expect(isAnalysisUnitId(bad), String(bad)).toBe(false);
    }
  });

  it("drops unknown ids rather than losing the whole selection", () => {
    expect(normalizeAnalysisUnitIds(["time", "nope", "social"]))
      .toEqual(["time", "social"]);
  });

  it("deduplicates and returns canonical order", () => {
    expect(normalizeAnalysisUnitIds(["social", "time", "social", "time"]))
      .toEqual(["time", "social"]);
  });

  it("returns an empty selection for anything that is not an array", () => {
    for (const v of [undefined, null, "time", 3]) {
      expect(normalizeAnalysisUnitIds(v)).toEqual([]);
    }
  });
});

describe("the Observation field is backward compatible", () => {
  it("an Observation written before the field existed is still valid", () => {
    const legacy = obs();
    expect("analysis_unit_ids" in legacy).toBe(false);
    expect(validateObservation(legacy).valid).toBe(true);
  });

  it("an empty selection is valid", () => {
    expect(validateObservation(obs({ analysis_unit_ids: [] })).valid).toBe(true);
  });

  it("accepts all ten", () => {
    expect(validateObservation(obs({ analysis_unit_ids: [...ANALYSIS_UNIT_IDS] })).valid).toBe(true);
  });

  it("rejects an unknown id, a duplicate, and a non-array", () => {
    const unknown = validateObservation(
      obs({ analysis_unit_ids: ["time", "nope"] as never }));
    expect(unknown.valid).toBe(false);
    expect(unknown.errors).toContainEqual({ field: "analysis_unit_ids", reason: "unknown_id" });

    const dup = validateObservation(obs({ analysis_unit_ids: ["time", "time"] }));
    expect(dup.errors).toContainEqual({ field: "analysis_unit_ids", reason: "duplicate_id" });

    const notArray = validateObservation(
      obs({ analysis_unit_ids: "time" as never }));
    expect(notArray.errors).toContainEqual({ field: "analysis_unit_ids", reason: "not_an_array" });
  });
});

describe("the selector", () => {
  it("turns explicit selections into OBSERVED and leaves the rest UNKNOWN", () => {
    const r = selectRealUnitReadings({
      events: [ev("ce_1", obs({ analysis_unit_ids: ["time", "social", "systemic"] }))],
      subject_id: SUBJECT,
    });

    expect(r.classifiedCount).toBe(3);
    expect(r.readings).toHaveLength(10);

    const observed = r.readings.filter((x) => x.status === "observed").map((x) => x.unitId);
    expect(observed.sort()).toEqual(["social", "systemic", "time"]);
    expect(r.readings.filter((x) => x.status === "unknown")).toHaveLength(7);
  });

  it("invents no direction, intensity or confidence for ANY unit", () => {
    const r = selectRealUnitReadings({
      events: [ev("ce_1", obs({ analysis_unit_ids: ["time"], confidence: 0.97 }))],
      subject_id: SUBJECT,
    });
    for (const x of r.readings) {
      expect(x.direction, x.unitId).toBeNull();
      expect(x.intensity, x.unitId).toBeNull();
      expect(x.confidence, x.unitId).toBeNull();
    }
    /* The Observation's own confidence is about the observation, not the
       unit, and must not be copied across. */
    expect(r.readings.find((x) => x.unitId === "time")!.confidence).toBeNull();
  });

  it("passes the integrity checker for all ten", () => {
    const r = selectRealUnitReadings({
      events: [ev("ce_1", obs({ analysis_unit_ids: ["matter", "personal"] }))],
      subject_id: SUBJECT,
    });
    for (const x of r.readings) expect(checkReadingIntegrity(x), x.unitId).toEqual([]);
  });

  it("gives every OBSERVED unit the canon_event_id as its source", () => {
    const r = selectRealUnitReadings({
      events: [ev("ce_abc", obs({ analysis_unit_ids: ["energy"] }))],
      subject_id: SUBJECT,
    });
    expect(r.readings.find((x) => x.unitId === "energy")!.sourceRefs).toEqual(["ce_abc"]);
    expect(r.sourceEventIds).toEqual(["ce_abc"]);
  });

  it("gives every UNKNOWN unit a reason and no source", () => {
    const r = selectRealUnitReadings({ events: [], subject_id: SUBJECT });
    for (const x of r.readings) {
      expect(x.status).toBe("unknown");
      expect(x.sourceRefs).toEqual([]);
      expect(x.explanation).toBeTruthy();
    }
    expect(r.classifiedCount).toBe(0);
    expect(r.empty).toBe(true);
  });

  it("keeps every contributing ref, not only the newest", () => {
    const r = selectRealUnitReadings({
      events: [
        ev("ce_1", obs({ analysis_unit_ids: ["social"] })),
        ev("ce_2", obs({ analysis_unit_ids: ["social", "time"] })),
      ],
      subject_id: SUBJECT,
    });
    expect(r.readings.find((x) => x.unitId === "social")!.sourceRefs).toEqual(["ce_1", "ce_2"]);
    expect(r.readings.find((x) => x.unitId === "time")!.sourceRefs).toEqual(["ce_2"]);
  });

  it("a replayed record does not duplicate a reading or its refs", () => {
    const one = ev("ce_dup", obs({ analysis_unit_ids: ["cognitive"] }));
    const r = selectRealUnitReadings({ events: [one, one, one], subject_id: SUBJECT });
    expect(r.readings.find((x) => x.unitId === "cognitive")!.sourceRefs).toEqual(["ce_dup"]);
    expect(r.sourceEventIds).toEqual(["ce_dup"]);
    expect(r.classifiedCount).toBe(1);
  });
});

describe("record origin decides, and the subject cannot stand in for it", () => {
  /* Every record below names the VIEWER'S OWN subject and ticks real units.
     The only thing keeping each one out is its origin — which is the point:
     a subject test could never catch a demo fixture that names this viewer. */
  const ALL_TEN = [...ANALYSIS_UNIT_IDS];

  it("a same-subject REAL record contributes", () => {
    const r = selectRealUnitReadings({
      events: [ev("ce_real", obs({ analysis_unit_ids: ["time", "social"] }), "REAL")],
      subject_id: SUBJECT,
    });
    expect(r.classifiedCount).toBe(2);
    expect(r.recordOrigin).toBe("REAL");
    expect(r.empty).toBe(false);
  });

  for (const origin of ["DEMO", "DERIVED", "IMPORTED", "UNKNOWN"] as const) {
    it(`a same-subject ${origin} record contributes zero`, () => {
      const r = selectRealUnitReadings({
        events: [ev(`ce_${origin}`, obs({ analysis_unit_ids: ALL_TEN }), origin)],
        subject_id: SUBJECT,
      });
      expect(r.classifiedCount).toBe(0);
      expect(r.readings.filter((x) => x.status === "unknown")).toHaveLength(10);
      expect(r.sourceEventIds).toEqual([]);
      expect(r.recordOrigin).toBeNull();
      expect(r.empty).toBe(true);
    });
  }

  it("a same-subject record with NO origin field contributes zero", () => {
    const r = selectRealUnitReadings({
      events: [legacyEv("ce_legacy", obs({ analysis_unit_ids: ALL_TEN }))],
      subject_id: SUBJECT,
    });
    expect(r.classifiedCount).toBe(0);
    expect(r.recordOrigin).toBeNull();
  });

  it("another subject's REAL record contributes zero", () => {
    const r = selectRealUnitReadings({
      events: [ev("ce_other_real", obs({ subject: OTHER, analysis_unit_ids: ALL_TEN }), "REAL")],
      subject_id: SUBJECT,
    });
    expect(r.classifiedCount).toBe(0);
    expect(r.recordOrigin).toBeNull();
  });

  it("one REAL record among four non-REAL ones is the only contributor", () => {
    const r = selectRealUnitReadings({
      events: [
        ev("ce_demo2", obs({ analysis_unit_ids: ALL_TEN }), "DEMO"),
        ev("ce_derived2", obs({ analysis_unit_ids: ALL_TEN }), "DERIVED"),
        ev("ce_real2", obs({ analysis_unit_ids: ["energy"] }), "REAL"),
        ev("ce_imported2", obs({ analysis_unit_ids: ALL_TEN }), "IMPORTED"),
        legacyEv("ce_legacy2", obs({ analysis_unit_ids: ALL_TEN })),
      ],
      subject_id: SUBJECT,
    });
    expect(r.classifiedCount).toBe(1);
    expect(r.sourceEventIds).toEqual(["ce_real2"]);
    expect(r.recordOrigin).toBe("REAL");
    /* And still no numbers, on the one unit that did survive. */
    const energy = r.readings.find((x) => x.unitId === "energy")!;
    expect(energy.direction).toBeNull();
    expect(energy.intensity).toBeNull();
    expect(energy.confidence).toBeNull();
  });

  it("a duplicated REAL record does not duplicate sourceRefs", () => {
    const one = ev("ce_dup", obs({ analysis_unit_ids: ["time"] }), "REAL");
    const r = selectRealUnitReadings({ events: [one, one, one], subject_id: SUBJECT });
    expect(r.sourceEventIds).toEqual(["ce_dup"]);
    expect(r.readings.find((x) => x.unitId === "time")!.sourceRefs).toEqual(["ce_dup"]);
  });
});

describe("the record origin vocabulary and envelope", () => {
  it("has exactly the five values, and rejects anything else", () => {
    expect([...RECORD_ORIGINS]).toEqual(["REAL", "DERIVED", "DEMO", "IMPORTED", "UNKNOWN"]);
    for (const bad of ["REFERENCE", "DERIVED_REAL", "real", "", 1, null, {}, undefined]) {
      expect(isRecordOrigin(bad), String(bad)).toBe(false);
    }
  });

  it("every valid origin is accepted by CanonEvent validation", () => {
    for (const o of RECORD_ORIGINS) {
      expect(validateCanonEvent(ev("ce_v", obs(), o)).valid, o).toBe(true);
    }
  });

  it("an absent origin is valid — every pre-existing record stays valid", () => {
    expect(validateCanonEvent(legacyEv("ce_legacy3", obs())).valid).toBe(true);
  });

  it("an unrecognised origin is REJECTED, not silently downgraded to UNKNOWN", () => {
    const bad = { ...legacyEv("ce_bad", obs()), record_origin: "REFERENCE" } as unknown as CanonEvent;
    const result = validateCanonEvent(bad);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({ field: "record_origin", reason: "invalid" });
  });

  it("recordOriginOf reads missing and explicit UNKNOWN identically", () => {
    expect(recordOriginOf(legacyEv("a", obs()))).toBe("UNKNOWN");
    expect(recordOriginOf(ev("b", obs(), "UNKNOWN"))).toBe("UNKNOWN");
  });

  it("recordOriginOf returns a declared valid origin verbatim", () => {
    for (const o of RECORD_ORIGINS) expect(recordOriginOf(ev("c", obs(), o))).toBe(o);
  });

  it("recordOriginOf never throws, and never invents REAL", () => {
    for (const junk of [{}, { record_origin: "REAL " }, { record_origin: 7 }]) {
      expect(recordOriginOf(junk as unknown as CanonEvent)).toBe("UNKNOWN");
    }
  });
});

describe("the four exclusions", () => {
  it("another subject's Observation does not reach the viewer", () => {
    const r = selectRealUnitReadings({
      events: [ev("ce_other", obs({ subject: OTHER, analysis_unit_ids: ["time", "social"] }))],
      subject_id: SUBJECT,
    });
    expect(r.classifiedCount).toBe(0);
    expect(r.readings.every((x) => x.status === "unknown")).toBe(true);
  });

  it("a DEMO subject cannot satisfy a REAL subject", () => {
    const r = selectRealUnitReadings({
      events: [ev("ce_demo", obs({ subject: "scenario_person_sim_user",
        analysis_unit_ids: [...ANALYSIS_UNIT_IDS] }))],
      subject_id: SUBJECT,
    });
    expect(r.classifiedCount).toBe(0);
  });

  it("a non-observation canon record contributes nothing", () => {
    const notObs = { canon_event_id: "ce_x", canon_type: "effect",
      payload: obs({ analysis_unit_ids: ["time"] }), recorded_at: "2026-08-25T10:00:00Z" };
    const r = selectRealUnitReadings({
      events: [notObs as unknown as CanonEvent], subject_id: SUBJECT });
    expect(r.classifiedCount).toBe(0);
  });

  it("an Observation with no selection contributes nothing — 10 UNKNOWN", () => {
    const r = selectRealUnitReadings({
      events: [ev("ce_plain", obs()), ev("ce_empty", obs({ analysis_unit_ids: [] }))],
      subject_id: SUBJECT,
    });
    expect(r.classifiedCount).toBe(0);
    expect(r.readings.filter((x) => x.status === "unknown")).toHaveLength(10);
    expect(r.empty).toBe(true);
  });
});

describe("no keyword inference anywhere", () => {
  it("a context naming every unit still yields nothing without a tick", () => {
    const wordy = obs({
      context: "זמן חומר מרווח אנרגיה רגשית שכלית גופנית אישית חברתית מערכתית",
    });
    const r = selectRealUnitReadings({ events: [ev("ce_w", wordy)], subject_id: SUBJECT });
    expect(r.classifiedCount).toBe(0);
  });

  it("Domain and Frame do not map to units", () => {
    const r = selectRealUnitReadings({
      events: [ev("ce_g", obs({ domain: "G", frame: "S", systemicChannel: "institutional" }))],
      subject_id: SUBJECT,
    });
    expect(r.classifiedCount).toBe(0);
  });
});

describe("every terminal consumer sees the same result", () => {
  it("is a pure function of records and subject", () => {
    const events = [ev("ce_1", obs({ analysis_unit_ids: ["time", "matter", "social"] }))];
    const seven = ["hub", "brain", "dynamics", "community", "marketplace", "planet", "world"]
      .map(() => selectRealUnitReadings({ events, subject_id: SUBJECT }));

    const first = JSON.stringify(seven[0]);
    for (const r of seven) expect(JSON.stringify(r)).toBe(first);
    expect(seven[0]!.classifiedCount).toBe(3);
    expect(seven[0]!.subject_id).toBe(SUBJECT);
  });
});
