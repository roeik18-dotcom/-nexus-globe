import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { _setActionStore } from "../actionStoreAccessor";
import { InMemoryActionStore } from "../actionStore";
import { createActionForCurrentUserCore } from "../actionFormAction";
import { REAL_CURRENT_SUBJECT } from "@/app/lib/philos/subjectRegistry";
import { issueMatchPermit } from "../matchPermit";

function formData(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) v.forEach((item) => fd.append(k, item));
    else fd.set(k, v);
  }
  return fd;
}

const VALID = {
  type: "non_transfer",
  mechanism_scope: "self_regulation",
  reversibility: "reversible — can be undone within 24h",
  provenance: "self-initiated via /marketplace",
};

describe("createActionForCurrentUserCore — real Action creation (LOOP 5)", () => {
  let store: InMemoryActionStore;
  beforeEach(() => { store = new InMemoryActionStore(); _setActionStore(store); });
  afterEach(() => { _setActionStore(null); });

  it("rejects when consent is not checked — the CONSENT gate is never fabricated true", async () => {
    const result = await createActionForCurrentUserCore(formData(VALID));
    expect(result.ok).toBe(false);
    expect(await store.load()).toHaveLength(0);
  });

  it("rejects an invalid type", async () => {
    const result = await createActionForCurrentUserCore(formData({ ...VALID, type: "bogus", consent: "on" }));
    expect(result.ok).toBe(false);
    expect(await store.load()).toHaveLength(0);
  });

  it("rejects an invalid mechanism_scope", async () => {
    const result = await createActionForCurrentUserCore(formData({ ...VALID, mechanism_scope: "bogus", consent: "on" }));
    expect(result.ok).toBe(false);
    expect(await store.load()).toHaveLength(0);
  });

  it("accepts a real submission, uses REAL_CURRENT_SUBJECT as owner, and persists real inputs that don't name a Need+Offer pair", async () => {
    const result = await createActionForCurrentUserCore(
      formData({ ...VALID, consent: "on", inputs: ["need_abc"] }),
    );
    expect(result.ok).toBe(true);
    const stored = await store.load();
    expect(stored).toHaveLength(1);
    expect(stored[0].action.owner).toBe(REAL_CURRENT_SUBJECT);
    expect(stored[0].action.consent).toBe(true);
    expect(stored[0].action.inputs).toEqual(["need_abc"]);
  });

  it("accepts a real submission with no inputs — inputs is honestly empty, never fabricated", async () => {
    const result = await createActionForCurrentUserCore(formData({ ...VALID, consent: "on" }));
    expect(result.ok).toBe(true);
    const stored = await store.load();
    expect(stored[0].action.inputs).toEqual([]);
  });

  // ── Match→Action integrity gate ─────────────────────────────────────
  describe("inputs naming both a real Need and a real Offer — Match→Action integrity gate", () => {
    it("rejects when inputs name a Need+Offer pair but no match_permit is supplied — the unresolved-match path", async () => {
      const result = await createActionForCurrentUserCore(
        formData({ ...VALID, consent: "on", inputs: ["need_abc", "offer_xyz"] }),
      );
      expect(result.ok).toBe(false);
      expect(await store.load()).toHaveLength(0);
    });

    it("rejects a forged/mismatched match_permit — the blocked/tampered-match path", async () => {
      const permit = issueMatchPermit("need_other", "offer_other", new Date().toISOString());
      const result = await createActionForCurrentUserCore(
        formData({ ...VALID, consent: "on", inputs: ["need_abc", "offer_xyz"], match_permit: JSON.stringify(permit) }),
      );
      expect(result.ok).toBe(false);
      expect(await store.load()).toHaveLength(0);
    });

    it("rejects an expired match_permit", async () => {
      const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const permit = issueMatchPermit("need_abc", "offer_xyz", past);
      const result = await createActionForCurrentUserCore(
        formData({ ...VALID, consent: "on", inputs: ["need_abc", "offer_xyz"], match_permit: JSON.stringify(permit) }),
      );
      expect(result.ok).toBe(false);
      expect(await store.load()).toHaveLength(0);
    });

    it("accepts when inputs name a Need+Offer pair AND a valid, matching match_permit is supplied — the permitted path", async () => {
      const permit = issueMatchPermit("need_abc", "offer_xyz", new Date().toISOString());
      const result = await createActionForCurrentUserCore(
        formData({ ...VALID, consent: "on", inputs: ["need_abc", "offer_xyz"], match_permit: JSON.stringify(permit) }),
      );
      expect(result.ok).toBe(true);
      const stored = await store.load();
      expect(stored).toHaveLength(1);
      expect(stored[0].action.inputs).toEqual(["need_abc", "offer_xyz"]);
      // Auditability — the Action's own real, persisted `provenance` field
      // records why it was allowed, without a separate history store.
      expect(stored[0].action.provenance).toContain("match_permit verified");
      expect(stored[0].action.provenance).toContain("need_abc");
      expect(stored[0].action.provenance).toContain("offer_xyz");
    });
  });
});
