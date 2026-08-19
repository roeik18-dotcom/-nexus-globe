import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { _setNeedStore } from "../needStoreAccessor";
import { InMemoryNeedStore } from "../needStore";
import { _setOfferStore } from "../offerStoreAccessor";
import { InMemoryOfferStore } from "../offerStore";
import { evaluateMatchForCurrentUser } from "../matchEvalAction";
import { REAL_CURRENT_SUBJECT } from "@/app/lib/philos/subjectRegistry";
import type { Need } from "../need";
import type { Offer } from "../offer";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const NOW = new Date().toISOString();
const FUTURE = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

const REAL_NEED: Need = {
  need_id: "need_1", subject: REAL_CURRENT_SUBJECT, desired_change: "x",
  scope: { kind: "domain", domain: "G" }, provenance: "self_reported",
  context: "x", time: NOW, expiry: FUTURE, consent_scope: "subject_only",
};
const REAL_OFFER: Offer = {
  offer_id: "offer_1", source: REAL_CURRENT_SUBJECT, source_cell: { domain: "G", frame: "I" },
  available_resource: "time", resource_type: "mentorship", amount_or_capacity: "1h", competence: "x",
  willingness: true, consent: true, availability: "x", cost: "free", constraints: [], expiry: FUTURE,
  provenance: "self_reported",
};

const ALL_GATES_ON = { CAN: "on", WANTS: "on", ALLOWED: "on", APPROPRIATE: "on", AVAILABLE: "on", CONSENT: "on" };

describe("evaluateMatchForCurrentUser — LOOP 4, live canonical-gate evaluation over REAL persisted Need/Offer", () => {
  beforeEach(async () => {
    const needStore = new InMemoryNeedStore();
    await needStore.append([{ need: REAL_NEED, recorded_at: NOW, status: "open" }]);
    _setNeedStore(needStore);

    const offerStore = new InMemoryOfferStore();
    await offerStore.append([{ offer: REAL_OFFER, recorded_at: NOW }]);
    _setOfferStore(offerStore);
  });

  afterEach(() => {
    _setNeedStore(null);
    _setOfferStore(null);
  });

  it("rejects an unknown need_id — cannot fabricate a Need to match against", async () => {
    const result = await evaluateMatchForCurrentUser(formData({ need_id: "nope", offer_id: "offer_1", context: "x", ...ALL_GATES_ON }));
    expect(result.ok).toBe(false);
  });

  it("rejects an unknown offer_id — cannot fabricate an Offer to match against", async () => {
    const result = await evaluateMatchForCurrentUser(formData({ need_id: "need_1", offer_id: "nope", context: "x", ...ALL_GATES_ON }));
    expect(result.ok).toBe(false);
  });

  it("real gates all true → permitted, with real Need/Offer refs, zero rejection reasons, and a real MatchPermit issued", async () => {
    const result = await evaluateMatchForCurrentUser(formData({ need_id: "need_1", offer_id: "offer_1", context: "real evaluation", ...ALL_GATES_ON }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.decision).toBe("permitted");
      expect(result.result.rejection_reasons).toEqual([]);
      // Match→Action integrity gate: a permit is issued ONLY on a real
      // "permitted" decision, scoped to this exact need_id/offer_id pair.
      expect(result.permit).toBeDefined();
      expect(result.permit?.need_id).toBe("need_1");
      expect(result.permit?.offer_id).toBe("offer_1");
    }
  });

  it("one real gate false (CONSENT) → not_permitted, with the EXACT gate named in rejection_reasons, and NO permit issued", async () => {
    const result = await evaluateMatchForCurrentUser(formData({ need_id: "need_1", offer_id: "offer_1", context: "real evaluation", ...ALL_GATES_ON, CONSENT: "" }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.decision).toBe("not_permitted");
      expect(result.result.rejection_reasons).toContain("CONSENT_false");
      expect(result.permit).toBeUndefined();
    }
  });

  it("no gate checked at all → not_permitted with all 6 reasons named", async () => {
    const result = await evaluateMatchForCurrentUser(formData({ need_id: "need_1", offer_id: "offer_1", context: "real evaluation" }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.decision).toBe("not_permitted");
      expect(result.result.rejection_reasons).toHaveLength(6);
    }
  });
});
