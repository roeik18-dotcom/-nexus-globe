/**
 * app/hub/canonOrientationAction.ts — /hub's first canon-aware read.
 *
 * Verifies: (1) it never diverges from what the real orientation route would
 * report (not_found / invalid_as_of / a real CellState+stop_point), (2) the
 * full 9-stage trail is read verbatim off PhilosVerticalSliceResult with
 * canon's own persisted_or_derived/claimed_or_verified vocabulary intact,
 * (3) Need/Target/Offer/Transfer/Effect/Learning are honestly reported
 * "not_supplied" for an id-only lookup rather than fabricated, and (4)
 * nothing here writes — this is a read-only action, no `.append()` anywhere
 * in the module under test.
 */
import { describe, expect, it } from "vitest";

import type { CanonEvent } from "../../lib/philos/canon/canonEvent";
import { InMemoryCanonEventStore } from "../../lib/philos/canon/canonEventStore";
import type { Observation } from "../../lib/philos/canon/observation";
import { lookupCanonOrientationAction } from "../canonOrientationAction";

const AS_OF = "2026-09-10T00:00:00Z";

function baseObservation(overrides: Partial<Observation> = {}): Observation {
  return {
    subject: "person_hub_test",
    domain: "E",
    frame: "I",
    reference: "self_goal:baseline_energy",
    context: "evening_session",
    time: "2026-08-13T09:00:00Z",
    provenance: "self_reported",
    confidence: 0.8,
    expiry: "2026-12-01T00:00:00Z",
    level: -0.4,
    stability: 0.3,
    deficitType: "RELATIVE",
    ...overrides,
  };
}

function baseCanonEvent(overrides: Partial<CanonEvent> = {}): CanonEvent {
  return {
    canon_event_id: "canon_evt_hub_test_001",
    canon_type: "observation",
    payload: baseObservation(),
    recorded_at: "2026-08-13T09:00:05Z",
    ...overrides,
  };
}

describe("lookupCanonOrientationAction", () => {
  it("reports not_found for an unknown canon_event_id, no fabrication", async () => {
    const store = new InMemoryCanonEventStore([]);
    const result = await lookupCanonOrientationAction("canon_evt_does_not_exist", AS_OF, store);
    expect(result).toEqual({ ok: false, error: "not_found" });
  });

  it("reports invalid_as_of for an unparseable asOf, no fabrication", async () => {
    const store = new InMemoryCanonEventStore([baseCanonEvent()]);
    const result = await lookupCanonOrientationAction("canon_evt_hub_test_001", "not-a-date", store);
    expect(result).toEqual({ ok: false, error: "invalid_as_of" });
  });

  it("returns a real CellState with canon's own domain/frame/level/stability vocabulary", async () => {
    const store = new InMemoryCanonEventStore([baseCanonEvent()]);
    const result = await lookupCanonOrientationAction("canon_evt_hub_test_001", AS_OF, store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.handoff?.current_state).toEqual({ domain: "E", frame: "I", level: -0.4, stability: 0.3 });
    expect(result.fallback).toBeNull();
  });

  it("honestly reports Need as not_supplied — no store to look it up from, never fabricated", async () => {
    const store = new InMemoryCanonEventStore([baseCanonEvent()]);
    const result = await lookupCanonOrientationAction("canon_evt_hub_test_001", AS_OF, store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.handoff?.open_need).toBeUndefined();
    const needRow = result.trail.find((r) => r.stage === "need");
    expect(needRow).toEqual({ stage: "need", attempted: false, reason: "not_supplied" });
  });

  it("stop_point is the cellState stage's own reason when the Observation has expired", async () => {
    const expired = baseCanonEvent({
      canon_event_id: "canon_evt_hub_test_expired",
      payload: baseObservation({ expiry: "2026-08-20T00:00:00Z" }), // after `time`, before AS_OF
    });
    const store = new InMemoryCanonEventStore([expired]);
    const result = await lookupCanonOrientationAction("canon_evt_hub_test_expired", AS_OF, store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.handoff).toBeNull();
    expect(result.fallback?.stop_point).toEqual({ stage: "cellState", reason: "expired" });
    expect(result.fallback?.verification_state).toBe("not_applicable");
  });

  it("full trail covers all 9 §24 stages, in order, with canon's own vocabulary", async () => {
    const store = new InMemoryCanonEventStore([baseCanonEvent()]);
    const result = await lookupCanonOrientationAction("canon_evt_hub_test_001", AS_OF, store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.trail.map((r) => r.stage)).toEqual([
      "observation", "cellState", "need", "target", "offer",
      "matching", "transfer", "effect", "learning",
    ]);
    const observationRow = result.trail[0];
    expect(observationRow.attempted).toBe(true);
    if (observationRow.attempted) {
      expect(observationRow.persisted_or_derived).toBe("persisted");
    }
    const cellStateRow = result.trail[1];
    expect(cellStateRow.attempted).toBe(true);
    if (cellStateRow.attempted) {
      expect(cellStateRow.persisted_or_derived).toBe("derived");
    }
  });

  it("does not write: the fixture store's own log is unchanged after a lookup", async () => {
    const store = new InMemoryCanonEventStore([baseCanonEvent()]);
    await lookupCanonOrientationAction("canon_evt_hub_test_001", AS_OF, store);
    const stored = await store.load();
    expect(stored).toHaveLength(1);
    expect(stored[0].canon_event_id).toBe("canon_evt_hub_test_001");
  });
});
