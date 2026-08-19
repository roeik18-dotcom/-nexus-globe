/**
 * ingestOffer / findOffersForSource — the explicit acceptance/write
 * boundary and the real read path Marketplace uses. Synthetic test
 * fixtures only. Mirrors `needIngestion.test.ts` exactly.
 */
import { describe, expect, it } from "vitest";
import type { Offer } from "../offer";
import { InMemoryOfferStore, type OfferRecord } from "../offerStore";
import { ingestOffer } from "../offerIngestion";
import { findOffersForSource, _setOfferStore } from "../offerStoreAccessor";

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

describe("ingestOffer", () => {
  it("a valid, explicit OfferRecord is accepted and persisted", async () => {
    const store = new InMemoryOfferStore();
    const record: OfferRecord = { offer: baseOffer(), recorded_at: "2026-08-15T10:00:01Z" };
    const result = await ingestOffer(record, store);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.offer_id).toBe("offer_test_1");
    expect(await store.load()).toEqual([record]);
  });

  it("an invalid Offer (consent not true) is rejected BEFORE any store call — zero persistence on failure", async () => {
    const store = new InMemoryOfferStore();
    const record: OfferRecord = { offer: baseOffer({ consent: false }), recorded_at: "2026-08-15T10:00:01Z" };
    const result = await ingestOffer(record, store);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toBe("invalid");
    expect(await store.load()).toEqual([]);
  });

  it("re-ingesting the same offer_id is rejected, not silently duplicated", async () => {
    const store = new InMemoryOfferStore();
    const record: OfferRecord = { offer: baseOffer(), recorded_at: "2026-08-15T10:00:01Z" };
    await ingestOffer(record, store);
    const second = await ingestOffer({ ...record, recorded_at: "2026-08-15T11:00:00Z" }, store);
    expect(second.ok).toBe(false);
    if (second.ok) throw new Error("unreachable");
    expect(second.reason).toBe("rejected");
    expect(await store.load()).toHaveLength(1);
  });

  it("never mints offer_id or recorded_at — both come through verbatim", async () => {
    const store = new InMemoryOfferStore();
    const record: OfferRecord = { offer: baseOffer({ offer_id: "offer_caller_chosen" }), recorded_at: "2026-08-15T10:00:01Z" };
    const result = await ingestOffer(record, store);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.record.offer.offer_id).toBe("offer_caller_chosen");
    expect(result.record.recorded_at).toBe("2026-08-15T10:00:01Z");
  });
});

describe("findOffersForSource (via the real accessor + injected in-memory store)", () => {
  it("an undefined source returns [] without touching the store", async () => {
    _setOfferStore(new InMemoryOfferStore());
    expect(await findOffersForSource(undefined)).toEqual([]);
    _setOfferStore(null);
  });

  it("real exact-source match: only records for the given source are returned", async () => {
    const store = new InMemoryOfferStore([
      { offer: baseOffer({ offer_id: "o1", source: "person_a" }), recorded_at: "2026-08-15T10:00:01Z" },
      { offer: baseOffer({ offer_id: "o2", source: "person_b" }), recorded_at: "2026-08-15T10:00:02Z" },
    ]);
    _setOfferStore(store);
    const found = await findOffersForSource("person_a");
    expect(found).toHaveLength(1);
    expect(found[0].offer.offer_id).toBe("o1");
    _setOfferStore(null);
  });

  it("a source with no real Offers returns [] — honest absence, not an error", async () => {
    _setOfferStore(new InMemoryOfferStore());
    expect(await findOffersForSource("person_nobody")).toEqual([]);
    _setOfferStore(null);
  });
});
