/**
 * EventObservationLinked MUST NOT BE TRUE OF A RECORD NOBODY VOUCHED FOR.
 *
 * Phase 7 made the WRITE path prove record-level REAL origin before appending
 * a day.opened. That guaranteed the future and nothing else: the projection
 * still resolved any stored pair, so an opening written earlier — or one that
 * reached the log another way — could show the gate as MET while pointing at
 * a DEMO fixture, an imported record, or a legacy line with no origin at all.
 *
 * These tests pin the projection to the same contract as the writer. Every
 * exclusion below is proven with a record naming the VIEWER'S OWN subject, so
 * a subject test could not account for any of them: the only thing keeping
 * each one out is its origin.
 *
 * Nothing here migrates or rewrites a stored record. What changes is what the
 * gate SAYS about it — and it must say why.
 */
import { describe, expect, it } from "vitest";

import type { CanonEvent } from "../../canon/canonEvent";
import type { Observation } from "../../canon/observation";
import type { RecordOrigin } from "../../recordOrigin";
import { resolveEventObservation, type DayRefWorld } from "../dayRefs";

const SUBJECT = "person_roei";
const OTHER = "person_someone_else";
const REF = "canonev_1";

function obs(over: Partial<Observation> = {}): Observation {
  return {
    subject: SUBJECT, domain: "E", frame: "I", reference: "self_baseline",
    context: "נצפה בפועל", time: "2026-08-26T07:30:00+03:00",
    provenance: "self_reported", confidence: 0.8,
    expiry: "2026-09-26T07:30:00+03:00", level: -1, stability: 0,
    deficitType: "RELATIVE", analysis_unit_ids: ["time", "social", "systemic"], ...over,
  };
}

/** REAL unless a test says otherwise — the only origin that anchors a day. */
function ev(origin: RecordOrigin = "REAL", o: Observation = obs(), id = REF): CanonEvent {
  return { canon_event_id: id, canon_type: "observation", payload: o,
    recorded_at: "2026-08-26T07:30:00.000Z", record_origin: origin };
}

/** A record written before `record_origin` existed: the key is simply absent. */
function legacyEv(o: Observation = obs(), id = REF): CanonEvent {
  return { canon_event_id: id, canon_type: "observation", payload: o,
    recorded_at: "2026-08-26T07:30:00.000Z" };
}

const world = (...canonEvents: CanonEvent[]): DayRefWorld =>
  ({ domainStates: [], canonEvents }) as unknown as DayRefWorld;

/** The gate as the day projects it: both refs name the same stored record. */
const gate = (w: DayRefWorld, ref = REF, subject = SUBJECT) =>
  resolveEventObservation(ref, ref, w, subject);

describe("EventObservationLinked — record origin decides", () => {
  it("a matching REAL Observation is MET", () => {
    const r = gate(world(ev("REAL")));
    expect(r.ok).toBe(true);
    expect(r.resolvedRefs).toEqual([REF]);
    expect(r.reason).toBeNull();
  });

  /* Four origins, one legacy absence — every one naming THIS viewer. */
  for (const origin of ["DEMO", "DERIVED", "IMPORTED", "UNKNOWN"] as const) {
    it(`a same-subject ${origin} record is UNMET, and says so`, () => {
      const r = gate(world(ev(origin)));
      expect(r.ok).toBe(false);
      expect(r.resolvedRefs).toEqual([]);
      /* Not a generic "missing" — the reason names the record and what it
         actually carries, which is the only version a person can act on. */
      expect(r.reason).toContain(REF);
      expect(r.reason).toContain(origin);
      expect(r.reason).toContain("not REAL");
    });
  }

  it("a same-subject record with NO origin field is UNMET, reported as UNKNOWN", () => {
    const r = gate(world(legacyEv()));
    expect(r.ok).toBe(false);
    /* Missing and explicit UNKNOWN are the same answer, so they get the same
       stated reason — a record written before the field existed is not
       thereby trustworthy. */
    expect(r.reason).toContain("UNKNOWN");
    expect(r.reason).toContain("not REAL");
  });

  it("another subject's REAL Observation is UNMET", () => {
    const r = gate(world(ev("REAL", obs({ subject: OTHER }))));
    expect(r.ok).toBe(false);
    expect(r.reason).toContain(OTHER);
    expect(r.reason).toContain(SUBJECT);
  });

  it("mismatched refs are UNMET even when both records are REAL", () => {
    const w = world(ev("REAL"), ev("REAL", obs(), "canonev_2"));
    const r = resolveEventObservation(REF, "canonev_2", w, SUBJECT);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("must name the same canon event");
  });

  it("a stored but INVALID Observation payload is UNMET", () => {
    /* Stored records are validated on append, so this state only arises from a
       line that reached the log another way — exactly the case worth refusing. */
    const r = gate(world(ev("REAL", obs({ confidence: 5 }))));
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("does not validate");
  });

  it("a REAL record that is not an observation is UNMET", () => {
    const notObs = { ...ev("REAL"), canon_type: "effect" } as unknown as CanonEvent;
    const r = gate(world(notObs));
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("not an observation");
  });

  it("a ref naming no stored record is UNMET", () => {
    const r = gate(world(ev("REAL")), "canonev_missing");
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("names no stored canon event");
  });

  it("an absent ref is UNMET, and is not confused with a refused one", () => {
    expect(resolveEventObservation(undefined, undefined, world(ev()), SUBJECT).reason)
      .toContain("no event_ref recorded");
    expect(resolveEventObservation(REF, undefined, world(ev()), SUBJECT).reason)
      .toContain("no observation_ref recorded");
  });

  /**
   * THE PHASE 7 PATH STILL WORKS. The visible selector writes both refs equal
   * to one canon_event_id whose origin the writer proved REAL. That exact
   * shape must stay MET — this change tightens the projection without
   * invalidating anything the real UI can produce.
   */
  it("a Phase 7 UI-created link remains MET", () => {
    const uiWritten = ev("REAL", obs({ context: "תצפית לקישור ליום · phase7" }),
      "380e8a34-efbe-4566-b35f-3010f3d7e392");
    const r = resolveEventObservation(
      uiWritten.canon_event_id, uiWritten.canon_event_id, world(uiWritten), SUBJECT);
    expect(r.ok).toBe(true);
    expect(r.resolvedRefs).toEqual([uiWritten.canon_event_id]);
  });

  it("the projection is at least as strict as the writer — no origin passes both", () => {
    /* The writer accepts REAL only. Anything the projection accepts that the
       writer would refuse is exactly the divergence this phase closes. */
    const accepted = (["REAL", "DERIVED", "DEMO", "IMPORTED", "UNKNOWN"] as const)
      .filter((o) => gate(world(ev(o))).ok);
    expect(accepted).toEqual(["REAL"]);
  });

  it("nothing is mutated by projecting", () => {
    const records = [ev("REAL"), ev("DEMO", obs(), "canonev_2")];
    const before = JSON.stringify(records);
    gate(world(...records));
    expect(JSON.stringify(records)).toBe(before);
  });
});
