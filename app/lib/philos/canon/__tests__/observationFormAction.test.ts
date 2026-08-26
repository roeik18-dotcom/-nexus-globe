import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { _setCanonEventStore } from "../canonEventStoreAccessor";
import {
  CANON_STORE_FILENAME, FileSystemCanonEventStore, InMemoryCanonEventStore,
} from "../canonEventStore";
import { recordOriginOf } from "../canonEvent";
import { recordObservationAction } from "../observationWriter";
import { selectRealUnitReadings } from "@/app/lib/philos/analysis/realUnitReadings";
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

/**
 * TRUSTED WRITER — what the form may claim, and what a client may not.
 *
 * The claim under test is narrow and total: `REAL` is produced by the
 * authenticated form writer and by nothing else a client can reach.
 */
describe("record_origin — the trusted write boundary", () => {
  let store: InMemoryCanonEventStore;

  beforeEach(() => {
    store = new InMemoryCanonEventStore();
    _setCanonEventStore(store);
  });
  afterEach(() => { _setCanonEventStore(null); });

  const valid = {
    domain: "E", frame: "I", level: "-1", confidence: "0.8",
    context: "self-report through the real form",
  };

  it("the authenticated form writes record_origin REAL", async () => {
    const result = await recordObservationFromForm(formData(valid));
    expect(result.ok).toBe(true);
    const [stored] = await store.load();
    expect(stored.record_origin).toBe("REAL");
    expect(recordOriginOf(stored)).toBe("REAL");
  });

  it("a client submitting record_origin=DEMO cannot downgrade the record", async () => {
    await recordObservationFromForm(formData({ ...valid, record_origin: "DEMO" }));
    const [stored] = await store.load();
    expect(stored.record_origin).toBe("REAL");
  });

  /* The spoof that matters most is the one that GRANTS: a client posting
     REAL through a path that is not the authenticated form. The general
     writer is reachable, so it is the one that must refuse to confer. */
  it("the unattributed writer cannot be made to write REAL — it writes UNKNOWN", async () => {
    const observation = {
      subject: REAL_CURRENT_SUBJECT, domain: "E", frame: "I",
      reference: "self_baseline", context: "posted directly, not through the form",
      time: "2026-08-25T10:00:00Z", provenance: "self_reported", confidence: 0.8,
      expiry: "2026-09-25T10:00:00Z", level: -1, stability: 0,
      deficitType: "RELATIVE", analysis_unit_ids: ["time"],
      /* A client-supplied origin, planted INSIDE the payload — the only place
         a caller of this function could put one. It must not surface on the
         envelope, which is where the selector reads. */
      record_origin: "REAL",
    } as unknown as Parameters<typeof recordObservationAction>[1];

    const result = await recordObservationAction("ce_spoof", observation, "2026-08-25T10:00:00Z");
    expect(result.ok).toBe(true);
    const [stored] = await store.load();
    expect(stored.record_origin).toBe("UNKNOWN");
    expect(recordOriginOf(stored)).toBe("UNKNOWN");
  });

  it("a spoofed payload origin never reaches the readings", async () => {
    const observation = {
      subject: REAL_CURRENT_SUBJECT, domain: "E", frame: "I",
      reference: "self_baseline", context: "spoof attempt",
      time: "2026-08-25T10:00:00Z", provenance: "self_reported", confidence: 0.8,
      expiry: "2026-09-25T10:00:00Z", level: -1, stability: 0,
      deficitType: "RELATIVE", analysis_unit_ids: ["time", "social", "systemic"],
      record_origin: "REAL",
    } as unknown as Parameters<typeof recordObservationAction>[1];

    await recordObservationAction("ce_spoof_2", observation, "2026-08-25T10:00:00Z");
    const readings = selectRealUnitReadings({
      events: await store.load(), subject_id: REAL_CURRENT_SUBJECT,
    });
    expect(readings.classifiedCount).toBe(0);
    expect(readings.recordOrigin).toBeNull();
  });

  /* END-TO-END, through the real form and the real selector: the one path
     that is supposed to work, still works. */
  it("a form-written record is the one thing the selector accepts", async () => {
    const fd = formData({ ...valid, context: "three units" });
    for (const id of ["time", "social", "systemic"]) fd.append("analysis_unit_ids", id);
    await recordObservationFromForm(fd);

    const readings = selectRealUnitReadings({
      events: await store.load(), subject_id: REAL_CURRENT_SUBJECT,
    });
    expect(readings.classifiedCount).toBe(3);
    expect(readings.recordOrigin).toBe("REAL");
    expect(readings.readings.filter((r) => r.status === "unknown")).toHaveLength(7);
    for (const r of readings.readings) {
      expect(r.direction).toBeNull();
      expect(r.intensity).toBeNull();
      expect(r.confidence).toBeNull();
    }
  });

  /* STORE ROUND-TRIP through the real filesystem store: the envelope field
     must survive JSONL serialisation, not merely exist in memory. */
  it("record_origin survives a filesystem store round-trip", async () => {
    const dir = mkdtempSync(join(tmpdir(), "origin-roundtrip-"));
    try {
      const fsStore = new FileSystemCanonEventStore(dir);
      _setCanonEventStore(fsStore);
      await recordObservationFromForm(formData(valid));

      /* A SECOND store over the same directory — reading back from disk,
         not from the writer's own memory. */
      const [reloaded] = await new FileSystemCanonEventStore(dir).load();
      expect(reloaded.record_origin).toBe("REAL");
      expect(recordOriginOf(reloaded)).toBe("REAL");

      const raw = readFileSync(join(dir, CANON_STORE_FILENAME), "utf-8").trim();
      expect(JSON.parse(raw).record_origin).toBe("REAL");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a legacy field-less line loads as UNKNOWN and is not rewritten", async () => {
    const dir = mkdtempSync(join(tmpdir(), "origin-legacy-"));
    try {
      /* Written the way a pre-field record actually looks on disk. */
      const legacy = {
        canon_event_id: "ce_legacy_disk", canon_type: "observation",
        recorded_at: "2026-08-20T10:00:00Z",
        payload: {
          subject: REAL_CURRENT_SUBJECT, domain: "E", frame: "I",
          reference: "self_baseline", context: "written before the field existed",
          time: "2026-08-20T10:00:00Z", provenance: "self_reported", confidence: 0.8,
          expiry: "2026-09-20T10:00:00Z", level: -1, stability: 0,
          deficitType: "RELATIVE", analysis_unit_ids: ["time"],
        },
      };
      const file = join(dir, CANON_STORE_FILENAME);
      const before = JSON.stringify(legacy) + "\n";
      writeFileSync(file, before, "utf-8");

      const [loaded] = await new FileSystemCanonEventStore(dir).load();
      expect(loaded.record_origin).toBeUndefined();
      expect(recordOriginOf(loaded)).toBe("UNKNOWN");

      /* NOT REWRITTEN. Loading is a read; the bytes on disk are untouched. */
      expect(readFileSync(file, "utf-8")).toBe(before);

      /* And it contributes nothing, despite naming the viewer's own subject. */
      const readings = selectRealUnitReadings({
        events: [loaded], subject_id: REAL_CURRENT_SUBJECT });
      expect(readings.classifiedCount).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
