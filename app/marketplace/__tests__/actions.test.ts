import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { _setNeedStore } from "@/app/lib/philos/canon/needStoreAccessor";
import { InMemoryNeedStore } from "@/app/lib/philos/canon/needStore";
import { _setOfferStore } from "@/app/lib/philos/canon/offerStoreAccessor";
import { InMemoryOfferStore } from "@/app/lib/philos/canon/offerStore";
import { registerNeedCore, registerOfferCore } from "../actions";
import { REAL_CURRENT_SUBJECT } from "@/app/lib/philos/subjectRegistry";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("registerNeedCore — real Need registration, consolidated write path (§52)", () => {
  let store: InMemoryNeedStore;
  beforeEach(() => { store = new InMemoryNeedStore(); _setNeedStore(store); });
  afterEach(() => { _setNeedStore(null); });

  it("rejects an empty desired_change — zero persistence", async () => {
    const result = await registerNeedCore(formData({ desired_change: "" }));
    expect(result.ok).toBe(false);
    expect(await store.load()).toHaveLength(0);
  });

  it("accepts a real submission, uses REAL_CURRENT_SUBJECT, and preserves a caller-supplied context accurately", async () => {
    const result = await registerNeedCore(formData({ desired_change: "clarity", context: "registered via Community", domain: "C" }));
    expect(result.ok).toBe(true);
    const stored = await store.load();
    expect(stored[0].need.subject).toBe(REAL_CURRENT_SUBJECT);
    expect(stored[0].need.context).toBe("registered via Community");
  });

  it("falls back to an honest generic context when the caller doesn't supply one — never claims a specific route it wasn't submitted from", async () => {
    const result = await registerNeedCore(formData({ desired_change: "clarity" }));
    expect(result.ok).toBe(true);
    const stored = await store.load();
    expect(stored[0].need.context).not.toMatch(/marketplace|community/i);
  });
});

describe("registerOfferCore — real Offer registration, CONSENT-gate fix (§52)", () => {
  let store: InMemoryOfferStore;
  beforeEach(() => { store = new InMemoryOfferStore(); _setOfferStore(store); });
  afterEach(() => { _setOfferStore(null); });

  const VALID = { available_resource: "time", resource_type: "mentorship", amount_or_capacity: "1h" };

  it("rejects when willingness is not checked — the CONSENT gate is never fabricated true (regression test for the prior hardcoded-true bug)", async () => {
    const result = await registerOfferCore(formData({ ...VALID, consent: "on" }));
    expect(result.ok).toBe(false);
    expect(await store.load()).toHaveLength(0);
  });

  it("rejects when consent is not checked", async () => {
    const result = await registerOfferCore(formData({ ...VALID, willingness: "on" }));
    expect(result.ok).toBe(false);
    expect(await store.load()).toHaveLength(0);
  });

  it("accepts a real submission with both real checkboxes checked", async () => {
    const result = await registerOfferCore(formData({ ...VALID, willingness: "on", consent: "on" }));
    expect(result.ok).toBe(true);
    const stored = await store.load();
    expect(stored[0].offer.willingness).toBe(true);
    expect(stored[0].offer.consent).toBe(true);
    expect(stored[0].offer.source).toBe(REAL_CURRENT_SUBJECT);
  });
});
