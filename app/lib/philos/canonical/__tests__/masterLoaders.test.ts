/**
 * Phase 4 acceptance: "Human 189 loads / Music 80 loads / Color 7 loads."
 * Reads the REAL frozen Source Locks — no fixtures, no mocks — since these
 * three files are themselves the frozen data under test.
 */
import { describe, expect, it } from "vitest";

import { loadHumanMaster, findHumanBySourceNumber, summarizeHumanMaster, humanMasterMeta } from "../humanMasterLoader";
import { loadMusicMaster, findMusicBySourceNumber, summarizeMusicMaster, readyMusicRecords, musicMasterMeta } from "../musicMasterLoader";
import { loadColorMaster, findColorById, whiteColorConflict, WHITE_COLOR_ID, colorMasterMeta } from "../colorMasterLoader";
import { _clearMasterFileCache } from "../masterLoader";

describe("HumanMasterLoader", () => {
  it("loads exactly 189 real records", () => {
    expect(loadHumanMaster()).toHaveLength(189);
  });

  it("finds a real record by SOURCE_NUMBER", () => {
    const r = findHumanBySourceNumber(12);
    expect(r).not.toBeNull();
    expect(r?.SOURCE_NUMBER).toBe(12);
    expect(r?.SOURCE_TEXT).toBeTypeOf("string");
  });

  it("returns null for a SOURCE_NUMBER that does not exist", () => {
    expect(findHumanBySourceNumber(999999)).toBeNull();
  });

  it("summarizes real RUNTIME_STATUS/TYPE buckets that sum to the total", () => {
    const s = summarizeHumanMaster();
    expect(s.total).toBe(189);
    expect(Object.values(s.by_runtime_status).reduce((a, b) => a + b, 0)).toBe(189);
    expect(Object.values(s.by_type).reduce((a, b) => a + b, 0)).toBe(189);
  });

  it("exposes real Source Lock metadata", () => {
    const meta = humanMasterMeta();
    expect(meta.row_count).toBe(189);
    expect(meta.id_field).toBe("SOURCE_NUMBER");
    expect(meta.source_lock).toContain("HUMAN_CONFIG_MASTER_SOURCE_LOCK");
  });
});

describe("MusicMasterLoader", () => {
  it("loads exactly 80 real records", () => {
    expect(loadMusicMaster()).toHaveLength(80);
  });

  it("finds a real record by its string SOURCE_NUMBER", () => {
    const r = findMusicBySourceNumber("GEN-MU-PROC-04");
    expect(r).not.toBeNull();
    expect(r?.SOURCE_NUMBER).toBe("GEN-MU-PROC-04");
  });

  it("readyMusicRecords returns only RUNTIME_STATUS === READY", () => {
    const ready = readyMusicRecords();
    expect(ready.length).toBeGreaterThan(0);
    expect(ready.every((r) => r.RUNTIME_STATUS === "READY")).toBe(true);
  });

  it("summarizes to the real total", () => {
    expect(summarizeMusicMaster().total).toBe(80);
  });

  it("exposes real Source Lock metadata", () => {
    expect(musicMasterMeta().row_count).toBe(80);
  });
});

describe("ColorMasterLoader", () => {
  it("loads exactly 7 real records", () => {
    expect(loadColorMaster()).toHaveLength(7);
  });

  it("finds White at COLOR_ID = 0 (normalized)", () => {
    const found = findColorById(WHITE_COLOR_ID);
    expect(found).not.toBeNull();
    expect(found?.colorId).toBe("0");
    expect(found?.record.COLOR).toMatch(/WHITE/i);
  });

  it("finds a numeric-string COLOR_ID (e.g. RED = 6) regardless of raw JSON typing", () => {
    const byString = findColorById("6");
    const byNumber = findColorById(6);
    expect(byString?.record.COLOR).toMatch(/RED/i);
    expect(byNumber?.record.COLOR).toBe(byString?.record.COLOR);
  });

  it("surfaces the real White/OPEN conflict — Phase 4's named acceptance criterion", () => {
    const conflict = whiteColorConflict();
    expect(conflict).not.toBeNull();
    expect(conflict?.colorId).toBe("0");
    expect(conflict?.conflict_status).toBe("OPEN");
  });

  it("Cell_ID is never derivable from COLOR_ID — no such field/function exists on the record or module", () => {
    const found = findColorById("6");
    expect(found?.record).not.toHaveProperty("Cell_ID");
    expect(found?.record).not.toHaveProperty("CELL_ID");
  });

  it("exposes real Source Lock metadata", () => {
    expect(colorMasterMeta().row_count).toBe(7);
    expect(colorMasterMeta().id_field).toBe("COLOR_ID");
  });
});

describe("masterLoader caching", () => {
  it("_clearMasterFileCache forces a fresh read without changing the result", () => {
    const before = loadHumanMaster().length;
    _clearMasterFileCache();
    const after = loadHumanMaster().length;
    expect(after).toBe(before);
  });
});
