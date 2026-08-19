import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { _setCanonEventStore } from "../canonEventStoreAccessor";
import { InMemoryCanonEventStore } from "../canonEventStore";
import { recordObservationFromForm } from "../observationFormAction";
import { REAL_CURRENT_SUBJECT } from "@/app/lib/philos/subjectRegistry";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("recordObservationFromForm — LOOP 1, the first UI-reachable Observation write path", () => {
  let store: InMemoryCanonEventStore;

  beforeEach(() => {
    store = new InMemoryCanonEventStore();
    _setCanonEventStore(store);
  });

  afterEach(() => {
    _setCanonEventStore(null);
  });

  it("rejects an invalid domain — zero persistence", async () => {
    const result = await recordObservationFromForm(formData({ domain: "X", frame: "I", level: "0", confidence: "0.5", context: "test" }));
    expect(result.ok).toBe(false);
    expect(await store.load()).toHaveLength(0);
  });

  it("rejects frame=S in this minimal form (S requires systemicChannel, a later loop)", async () => {
    const result = await recordObservationFromForm(formData({ domain: "G", frame: "S", level: "0", confidence: "0.5", context: "test" }));
    expect(result.ok).toBe(false);
    expect(await store.load()).toHaveLength(0);
  });

  it("rejects out-of-range confidence — zero persistence", async () => {
    const result = await recordObservationFromForm(formData({ domain: "G", frame: "I", level: "0", confidence: "1.5", context: "test" }));
    expect(result.ok).toBe(false);
    expect(await store.load()).toHaveLength(0);
  });

  it("rejects empty context — zero persistence", async () => {
    const result = await recordObservationFromForm(formData({ domain: "G", frame: "I", level: "0", confidence: "0.5", context: "" }));
    expect(result.ok).toBe(false);
    expect(await store.load()).toHaveLength(0);
  });

  it("accepts a real, valid submission and persists it for REAL_CURRENT_SUBJECT", async () => {
    const result = await recordObservationFromForm(formData({ domain: "E", frame: "R", level: "1.5", confidence: "0.8", context: "real self-report, loop 1" }));
    expect(result.ok).toBe(true);
    const stored = await store.load();
    expect(stored).toHaveLength(1);
    expect(stored[0].payload.subject).toBe(REAL_CURRENT_SUBJECT);
    expect(stored[0].payload.domain).toBe("E");
    expect(stored[0].payload.frame).toBe("R");
    expect(stored[0].payload.level).toBe(1.5);
    expect(stored[0].payload.confidence).toBe(0.8);
    expect(stored[0].payload.provenance).toBe("self_reported");
  });

  it("the FIRST real Observation for a cell has no real prior — before is null, delta is null, gatingReason states exactly why (LOOP A005/A006)", async () => {
    const result = await recordObservationFromForm(formData({ domain: "G", frame: "I", level: "0.3", confidence: "0.7", context: "first ever G/I observation" }));
    if (!result.ok) throw new Error("unreachable");
    expect(result.before).toBeNull();
    expect(result.delta).toBeNull();
    expect(result.gatingReason).toMatch(/no real prior Observation/);
    expect(result.after).toEqual({ level: 0.3, stability: 0 });
  });

  it("a SECOND real Observation for the SAME cell gets a real before/after/delta — never fabricated, computed from the actual prior record", async () => {
    const first = await recordObservationFromForm(formData({ domain: "E", frame: "R", level: "-1", confidence: "0.6", context: "baseline" }));
    if (!first.ok) throw new Error("unreachable");
    const second = await recordObservationFromForm(formData({ domain: "E", frame: "R", level: "0.5", confidence: "0.9", context: "improved" }));
    if (!second.ok) throw new Error("unreachable");

    expect(second.before).not.toBeNull();
    expect(second.before?.canon_event_id).toBe(first.canon_event_id);
    expect(second.before?.level).toBe(-1);
    expect(second.after).toEqual({ level: 0.5, stability: 0 });
    expect(second.delta).toEqual({ level: 1.5, stability: 0 });
    expect(second.gatingReason).toBeNull();
  });

  it("a real Observation for a DIFFERENT cell (domain/frame) never picks up an unrelated prior — no cross-cell contamination", async () => {
    await recordObservationFromForm(formData({ domain: "G", frame: "I", level: "2", confidence: "0.5", context: "unrelated cell" }));
    const result = await recordObservationFromForm(formData({ domain: "C", frame: "I", level: "1", confidence: "0.5", context: "different cell entirely" }));
    if (!result.ok) throw new Error("unreachable");
    expect(result.before).toBeNull();
    expect(result.gatingReason).not.toBeNull();
  });

  it("echoes back the exact real persisted domain/frame/confidence/time on success (LOOP A004 confirmation)", async () => {
    const result = await recordObservationFromForm(formData({ domain: "C", frame: "I", level: "-1", confidence: "0.65", context: "confirmation echo check" }));
    if (!result.ok) throw new Error("unreachable");
    expect(result.domain).toBe("C");
    expect(result.frame).toBe("I");
    expect(result.confidence).toBe(0.65);
    const stored = await store.load();
    expect(result.time).toBe(stored[0].payload.time);
  });

  it("a second valid submission appends a SECOND record — never overwrites the first (append-only)", async () => {
    await recordObservationFromForm(formData({ domain: "G", frame: "I", level: "0", confidence: "0.5", context: "first" }));
    await recordObservationFromForm(formData({ domain: "G", frame: "I", level: "1", confidence: "0.5", context: "second" }));
    const stored = await store.load();
    expect(stored).toHaveLength(2);
  });
});
