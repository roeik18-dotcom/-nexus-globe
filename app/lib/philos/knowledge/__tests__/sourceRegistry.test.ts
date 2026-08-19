/**
 * SourceRegistry — the ingestion boundary's store. Mirrors
 * `needStore.test.ts` in structure and rigor. Synthetic fixtures only.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  checkSourceRegister,
  computeContentHash,
  deriveSourceId,
  FileSystemSourceRegistryStore,
  InMemorySourceRegistryStore,
  SourceRegisterRejectedError,
  type SourceRecord,
} from "../sourceRegistry";

function baseRecord(overrides: Partial<SourceRecord> = {}): SourceRecord {
  const hash = computeContentHash("hello philos");
  return {
    source_id: deriveSourceId(hash),
    source_title: "Test Source",
    source_path: "/tmp/test-source.md",
    source_type: "markdown",
    origin: "internal_repo",
    status: "RAW_SOURCE",
    ingested_at: "2026-08-15T10:00:00Z",
    content_hash: hash,
    size_bytes: 12,
    ...overrides,
  };
}

describe("computeContentHash / deriveSourceId", () => {
  it("is deterministic — same content, same hash and id", () => {
    const h1 = computeContentHash("same text");
    const h2 = computeContentHash("same text");
    expect(h1).toBe(h2);
    expect(deriveSourceId(h1)).toBe(deriveSourceId(h2));
  });

  it("different content produces a different hash", () => {
    expect(computeContentHash("a")).not.toBe(computeContentHash("b"));
  });
});

describe("checkSourceRegister", () => {
  it("empty append is rejected", () => {
    const check = checkSourceRegister([], []);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error("unreachable");
    expect(check.rejections[0].code).toBe("empty_append");
  });

  it("a valid, novel record is accepted", () => {
    const check = checkSourceRegister([], [baseRecord()]);
    expect(check.ok).toBe(true);
  });

  it("re-registering the SAME content hash is rejected — not a new source", () => {
    const existing = baseRecord();
    const check = checkSourceRegister([existing], [baseRecord({ source_path: "/tmp/different-path.md" })]);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error("unreachable");
    expect(check.rejections[0].code).toBe("duplicate_content_hash");
  });

  it("two records with the same hash in one batch are rejected", () => {
    const r = baseRecord();
    const check = checkSourceRegister([], [r, { ...r }]);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error("unreachable");
    expect(check.rejections.some((x) => x.code === "duplicate_in_batch")).toBe(true);
  });

  it("empty source_path / source_title are rejected", () => {
    const check = checkSourceRegister([], [baseRecord({ source_path: "" }), baseRecord({ content_hash: computeContentHash("other"), source_title: "" })]);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error("unreachable");
    const codes = check.rejections.map((r) => r.code);
    expect(codes).toContain("empty_source_path");
    expect(codes).toContain("empty_source_title");
  });

  it("ambiguous ingested_at (no offset) is rejected", () => {
    const check = checkSourceRegister([], [baseRecord({ ingested_at: "not-a-date" })]);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error("unreachable");
    expect(check.rejections[0].code).toBe("ambiguous_ingested_at");
  });

  it("REVIEW_REQUIRED without a review_note is rejected", () => {
    const check = checkSourceRegister([], [baseRecord({ status: "REVIEW_REQUIRED" })]);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error("unreachable");
    expect(check.rejections[0].code).toBe("review_note_required");
  });

  it("REVIEW_REQUIRED with a review_note is accepted", () => {
    const check = checkSourceRegister([], [baseRecord({ status: "REVIEW_REQUIRED", review_note: "legacy, unvalidated Force model" })]);
    expect(check.ok).toBe(true);
  });
});

describe("InMemorySourceRegistryStore", () => {
  it("register then load round-trips, in ingested_at order", async () => {
    const store = new InMemorySourceRegistryStore();
    const older = baseRecord({ ingested_at: "2026-08-15T09:00:00Z" });
    const newer = baseRecord({ content_hash: computeContentHash("second doc"), source_id: deriveSourceId(computeContentHash("second doc")), ingested_at: "2026-08-15T10:00:00Z" });
    await store.register([newer]);
    await store.register([older]);
    const loaded = await store.load();
    expect(loaded.map((r) => r.ingested_at)).toEqual(["2026-08-15T09:00:00Z", "2026-08-15T10:00:00Z"]);
  });

  it("registering a duplicate hash throws SourceRegisterRejectedError, zero persistence", async () => {
    const store = new InMemorySourceRegistryStore();
    await store.register([baseRecord()]);
    await expect(store.register([baseRecord({ source_path: "/tmp/other.md" })])).rejects.toThrow(SourceRegisterRejectedError);
    expect(await store.load()).toHaveLength(1);
  });
});

describe("FileSystemSourceRegistryStore", () => {
  let dir: string;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("register persists to sources.jsonl and load reads it back", async () => {
    dir = mkdtempSync(join(tmpdir(), "philos-knowledge-test-"));
    const store = new FileSystemSourceRegistryStore(dir);
    await store.register([baseRecord()]);
    expect(existsSync(join(dir, "sources.jsonl"))).toBe(true);
    const loaded = await store.load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].source_title).toBe("Test Source");
  });

  it("real file content — one line per record, real JSON", async () => {
    dir = mkdtempSync(join(tmpdir(), "philos-knowledge-test-"));
    const store = new FileSystemSourceRegistryStore(dir);
    await store.register([baseRecord()]);
    const raw = readFileSync(join(dir, "sources.jsonl"), "utf-8").trim();
    expect(JSON.parse(raw).source_title).toBe("Test Source");
  });

  it("a duplicate-hash register against disk is rejected, file unchanged", async () => {
    dir = mkdtempSync(join(tmpdir(), "philos-knowledge-test-"));
    const store = new FileSystemSourceRegistryStore(dir);
    await store.register([baseRecord()]);
    await expect(store.register([baseRecord({ source_path: "/tmp/other.md" })])).rejects.toThrow(SourceRegisterRejectedError);
    const loaded = await store.load();
    expect(loaded).toHaveLength(1);
  });
});
