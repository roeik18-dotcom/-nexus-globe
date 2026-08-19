/**
 * PersonCommunityLink — pure logic tests, synthetic fixtures only
 * ("person_test_x" / "member_test_x"), no real person_roei/p_you data.
 *
 * Verifies: validation, the two-step declare→confirm flow, NOT_LINKED as
 * the honest default (never written, only returned), and CONFLICT
 * surfacing every disagreeing record rather than silently picking one.
 */
import { describe, expect, it } from "vitest";
import {
  confirmSamePerson,
  declareSamePerson,
  resolvePersonCommunityLink,
  validateLink,
  type PersonCommunityLink,
} from "../personCommunityLink";

function baseLink(overrides: Partial<PersonCommunityLink> = {}): PersonCommunityLink {
  return {
    link_id: "link_test_1",
    person_id: "person_test_x",
    community_member_id: "member_test_x",
    community_id: "community_test_x",
    link_status: "DECLARED_SAME_PERSON",
    evidence: "test evidence",
    provenance: "DEMO",
    declaration_source: "self",
    created_at: "2026-08-16T10:00:00Z",
    ...overrides,
  };
}

describe("validateLink", () => {
  it("accepts a well-formed self-declared record", () => {
    expect(validateLink(baseLink()).valid).toBe(true);
  });

  it("rejects DECLARED_SAME_PERSON asserted by a third party", () => {
    const result = validateLink(baseLink({ declaration_source: "third_party" }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.reason === "requires_self_declaration")).toBe(true);
  });

  it("rejects VERIFIED_SAME_PERSON asserted by a third party", () => {
    const result = validateLink(baseLink({ link_status: "VERIFIED_SAME_PERSON", declaration_source: "third_party", verified_at: "2026-08-16T10:00:01Z" }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.reason === "requires_self_declaration")).toBe(true);
  });

  it("UNVERIFIED is legal for a third-party declaration", () => {
    expect(validateLink(baseLink({ link_status: "UNVERIFIED", declaration_source: "third_party" })).valid).toBe(true);
  });

  it("rejects verified_at present on a non-VERIFIED record", () => {
    const result = validateLink(baseLink({ verified_at: "2026-08-16T10:00:01Z" }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "verified_at")).toBe(true);
  });

  it("rejects an empty evidence field", () => {
    expect(validateLink(baseLink({ evidence: "" })).valid).toBe(false);
  });
});

describe("declareSamePerson / confirmSamePerson — the real two-step flow", () => {
  it("declareSamePerson produces DECLARED_SAME_PERSON, self-sourced, no verified_at", () => {
    const d = declareSamePerson({
      link_id: "l1", person_id: "person_test_x", community_member_id: "member_test_x",
      community_id: "community_test_x", evidence: "self-declared via UI", provenance: "DEMO", now: "2026-08-16T10:00:00Z",
    });
    expect(d.link_status).toBe("DECLARED_SAME_PERSON");
    expect(d.declaration_source).toBe("self");
    expect(d.verified_at).toBeUndefined();
    expect(validateLink(d).valid).toBe(true);
  });

  it("confirmSamePerson requires an existing declaration and produces VERIFIED_SAME_PERSON pointing back at it", () => {
    const d = declareSamePerson({
      link_id: "l1", person_id: "person_test_x", community_member_id: "member_test_x",
      community_id: "community_test_x", evidence: "self-declared via UI", provenance: "DEMO", now: "2026-08-16T10:00:00Z",
    });
    const c = confirmSamePerson({ link_id: "l2", declaration: d, evidence: "self-confirmed via UI, second step", now: "2026-08-16T10:05:00Z" });
    expect(c.link_status).toBe("VERIFIED_SAME_PERSON");
    expect(c.verified_at).toBe("2026-08-16T10:05:00Z");
    expect(c.supersedes_link_id).toBe("l1");
    expect(c.person_id).toBe(d.person_id);
    expect(validateLink(c).valid).toBe(true);
  });
});

describe("resolvePersonCommunityLink — NOT_LINKED is the honest default, never persisted", () => {
  it("returns NOT_LINKED when no record exists for the triple", () => {
    const resolved = resolvePersonCommunityLink([], "person_test_x", "member_test_x", "community_test_x");
    expect(resolved.link_status).toBe("NOT_LINKED");
    expect(resolved.latest).toBeUndefined();
  });

  it("returns the latest record's status when one or more real records exist for the exact triple", () => {
    const d = baseLink({ link_id: "l1", created_at: "2026-08-16T10:00:00Z" });
    const c = baseLink({ link_id: "l2", link_status: "VERIFIED_SAME_PERSON", verified_at: "2026-08-16T10:05:00Z", created_at: "2026-08-16T10:05:00Z" });
    const resolved = resolvePersonCommunityLink([d, c], "person_test_x", "member_test_x", "community_test_x");
    expect(resolved.link_status).toBe("VERIFIED_SAME_PERSON");
    expect(resolved.latest?.link_id).toBe("l2");
  });

  it("HARD ACCEPTANCE TEST: two records claiming the same community_member_id for DIFFERENT person_ids -> CONFLICT, both records surfaced, never silently picked", () => {
    const a = baseLink({ link_id: "l1", person_id: "person_a" });
    const b = baseLink({ link_id: "l2", person_id: "person_b" });
    const resolved = resolvePersonCommunityLink([a, b], "person_a", "member_test_x", "community_test_x");
    expect(resolved.link_status).toBe("CONFLICT");
    expect(resolved.conflicting?.map((r) => r.link_id).sort()).toEqual(["l1", "l2"]);
  });

  it("two records claiming the same person_id belongs to DIFFERENT community_member_ids -> CONFLICT", () => {
    const a = baseLink({ link_id: "l1", community_member_id: "member_a" });
    const b = baseLink({ link_id: "l2", community_member_id: "member_b" });
    const resolved = resolvePersonCommunityLink([a, b], "person_test_x", "member_a", "community_test_x");
    expect(resolved.link_status).toBe("CONFLICT");
  });
});
