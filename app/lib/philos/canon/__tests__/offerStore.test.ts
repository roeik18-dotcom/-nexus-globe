/**
 * OfferStore — the first Offer persistence primitive. Synthetic test
 * fixtures only ("person_test_x" etc.). Mirrors `needStore.test.ts`
 * exactly: real Offer type reused verbatim (validateOffer unmodified),
 * append-only (duplicate offer_id rejected, never silently overwritten),
 * corrupt-log detection, deterministic ordering, and no shared file with
 * CanonEventStore/NeedStore.
 */
import { existsSync, mkdtempSync, readFileSync as readFileSyncFs, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Offer } from "../offer";
import {
  checkOfferAppend,
  FileSystemOfferStore,
  InMemoryOfferStore,
  OfferAppendRejectedError,
  OfferLogCorruptError,
  OFFER_STORE_FILENAME,
  inOfferOrder,
  type OfferRecord,
} from "../offerStore";
import { NEED_STORE_FILENAME } from "../needStore";

function baseOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    offer_id: "offer_test_1",
    source: "person_test_x",
    source_cell: { domain: "E", frame: "I" },
    available_resource: "an hour of focused attention",
    resource_type: "attention",
    amount_or_capacity: "1 hour/week",
    competence: "trained listener",
    willingness: true,
    consent: true,
    availability: "weekday evenings",
    cost: "none",
    constraints: [],
    expiry: "2026-09-15T10:00:00Z",
    provenance: "self_reported",
    ...overrides,
  };
}

function record(overrides: Partial<OfferRecord> = {}, offerOverrides: Partial<Offer> = {}): OfferRecord {
  return {
    offer: baseOffer(offerOverrides),
    recorded_at: "2026-08-15T10:00:01Z",
    ...overrides,
  };
}

describe("checkOfferAppend", () => {
  it("rejects an empty append", () => {
    const check = checkOfferAppend([], []);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error("unreachable");
    expect(check.rejections[0].code).toBe("empty_append");
  });

  it("accepts one valid record against an empty store", () => {
    expect(checkOfferAppend([], [record()])).toEqual({ ok: true });
  });

  it("rejects re-appending an already-stored offer_id", () => {
    const r = record();
    const check = checkOfferAppend([r], [record({}, { offer_id: r.offer.offer_id })]);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error("unreachable");
    expect(check.rejections[0].code).toBe("offer_id_already_stored");
  });

  it("rejects a duplicate offer_id within the same append batch", () => {
    const check = checkOfferAppend([], [record(), record()]);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error("unreachable");
    expect(check.rejections.some((r) => r.code === "duplicate_offer_id")).toBe(true);
  });

  it("rejects a structurally invalid Offer — validateOffer reused verbatim", () => {
    const check = checkOfferAppend([], [record({}, { consent: false })]);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error("unreachable");
    const invalid = check.rejections.find((r) => r.code === "invalid_offer");
    expect(invalid?.errors).toContainEqual({ field: "consent", reason: "not_true" });
  });

  it("rejects an ambiguous recorded_at (no explicit timezone offset)", () => {
    const check = checkOfferAppend([], [record({ recorded_at: "2026-08-15T10:00:01" })]);
    expect(check.ok).toBe(false);
    if (check.ok) throw new Error("unreachable");
    expect(check.rejections.some((r) => r.code === "ambiguous_recorded_at")).toBe(true);
  });
});

describe("InMemoryOfferStore", () => {
  it("create → persist → retrieve round-trips exactly", async () => {
    const store = new InMemoryOfferStore();
    const r = record();
    await store.append([r]);
    expect(await store.load()).toEqual([r]);
  });

  it("throws OfferAppendRejectedError on a rejected append, appends nothing", async () => {
    const store = new InMemoryOfferStore([record()]);
    await expect(store.append([record()])).rejects.toBeInstanceOf(OfferAppendRejectedError);
    expect(await store.load()).toHaveLength(1);
  });

  it("inOfferOrder is deterministic: recorded_at ascending, tie-broken by offer_id", () => {
    const a = record({ recorded_at: "2026-08-15T10:00:02Z" }, { offer_id: "offer_b" });
    const b = record({ recorded_at: "2026-08-15T10:00:01Z" }, { offer_id: "offer_a" });
    expect(inOfferOrder([a, b]).map((r) => r.offer.offer_id)).toEqual(["offer_a", "offer_b"]);
  });
});

describe("FileSystemOfferStore", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "offer-store-test-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("create → persist → retrieve round-trips through a real file", async () => {
    const store = new FileSystemOfferStore(dir);
    const r = record();
    await store.append([r]);
    expect(existsSync(join(dir, OFFER_STORE_FILENAME))).toBe(true);
    const store2 = new FileSystemOfferStore(dir);
    expect(await store2.load()).toEqual([r]);
  });

  it("writes to offers.jsonl, never needs.jsonl or canon-events.jsonl — separate file, separate log", () => {
    new FileSystemOfferStore(dir);
    expect(OFFER_STORE_FILENAME).toBe("offers.jsonl");
    expect(OFFER_STORE_FILENAME).not.toBe(NEED_STORE_FILENAME);
    expect(OFFER_STORE_FILENAME).not.toBe("canon-events.jsonl");
  });

  it("refuses to read a corrupt log rather than silently skip the bad line", async () => {
    const filePath = join(dir, OFFER_STORE_FILENAME);
    writeFileSync(filePath, "not json\n", "utf-8");
    const store = new FileSystemOfferStore(dir);
    await expect(store.load()).rejects.toThrow(OfferLogCorruptError);
  });

  it("rejects a duplicate offer_id across separate append calls, never touching the file on the failed call", async () => {
    const store = new FileSystemOfferStore(dir);
    await store.append([record()]);
    await expect(store.append([record()])).rejects.toThrow(OfferAppendRejectedError);
    const raw = readFileSyncFs(join(dir, OFFER_STORE_FILENAME), "utf-8").trim().split("\n");
    expect(raw).toHaveLength(1);
  });
});
