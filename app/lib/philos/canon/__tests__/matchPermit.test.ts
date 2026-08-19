import { describe, expect, it } from "vitest";
import { issueMatchPermit, verifyMatchPermit } from "../matchPermit";

const NOW = new Date().toISOString();

describe("matchPermit — Match→Action integrity gate", () => {
  it("a freshly issued permit verifies for the exact pair it was issued for", () => {
    const permit = issueMatchPermit("need_1", "offer_1", NOW);
    const result = verifyMatchPermit(permit, "need_1", "offer_1", NOW);
    expect(result.valid).toBe(true);
  });

  it("rejects a permit checked against a different need_id", () => {
    const permit = issueMatchPermit("need_1", "offer_1", NOW);
    const result = verifyMatchPermit(permit, "need_2", "offer_1", NOW);
    expect(result.valid).toBe(false);
  });

  it("rejects a permit checked against a different offer_id", () => {
    const permit = issueMatchPermit("need_1", "offer_1", NOW);
    const result = verifyMatchPermit(permit, "need_1", "offer_2", NOW);
    expect(result.valid).toBe(false);
  });

  it("rejects a tampered signature — a client cannot forge a permit", () => {
    const permit = issueMatchPermit("need_1", "offer_1", NOW);
    const tampered = { ...permit, signature: "0".repeat(permit.signature.length) };
    const result = verifyMatchPermit(tampered, "need_1", "offer_1", NOW);
    expect(result.valid).toBe(false);
  });

  it("rejects a permit whose need_id was edited to match a different pair without re-signing", () => {
    const permit = issueMatchPermit("need_1", "offer_1", NOW);
    const forged = { ...permit, need_id: "need_2" };
    const result = verifyMatchPermit(forged, "need_2", "offer_1", NOW);
    expect(result.valid).toBe(false);
  });

  it("rejects an expired permit — same real decision must be re-evaluated, never replayed indefinitely", () => {
    const permit = issueMatchPermit("need_1", "offer_1", NOW);
    const wayLater = new Date(new Date(NOW).getTime() + 11 * 60 * 1000).toISOString();
    const result = verifyMatchPermit(permit, "need_1", "offer_1", wayLater);
    expect(result.valid).toBe(false);
  });

  it("rejects a missing/malformed permit", () => {
    expect(verifyMatchPermit(undefined, "need_1", "offer_1", NOW).valid).toBe(false);
    expect(verifyMatchPermit({}, "need_1", "offer_1", NOW).valid).toBe(false);
    expect(verifyMatchPermit("not-an-object", "need_1", "offer_1", NOW).valid).toBe(false);
  });
});
