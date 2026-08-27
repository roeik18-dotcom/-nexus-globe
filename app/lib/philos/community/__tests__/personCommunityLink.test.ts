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
  assuranceOf,
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
    /* REAL by default: authority now depends on provenance, and these fixtures
       exercise latest-wins and conflict, not the provenance gate. The DEMO
       cases below set it explicitly so the reason a record is refused is
       visible in the test rather than inherited from a default. */
    provenance: "REAL",
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

/**
 * PROVENANCE DECIDES AUTHORITY.
 *
 * `provenance` was carried on every link record and read by nobody, so a DEMO
 * record claiming VERIFIED_SAME_PERSON for the right id pair resolved as
 * verified — and satisfied the Day's IdentityLinked gate. A demonstration
 * fixture could assert that two real identities are the same human.
 *
 * Every case below uses the SAME id triple, so the only thing deciding the
 * outcome is which records are admissible.
 */
describe("resolvePersonCommunityLink — only a REAL record confers authority", () => {
  const P = "person_test_x", M = "member_test_x", C = "community_test_x";
  const at = (t: string) => `2026-08-16T${t}:00Z`;
  const resolve = (records: PersonCommunityLink[]) => resolvePersonCommunityLink(records, P, M, C);

  const real = (status: PersonCommunityLink["link_status"], id: string, created_at: string) =>
    baseLink({ link_id: id, link_status: status, provenance: "REAL", created_at,
      ...(status === "VERIFIED_SAME_PERSON" ? { verified_at: created_at } : {}) });
  const demo = (status: PersonCommunityLink["link_status"], id: string, created_at: string) =>
    baseLink({ link_id: id, link_status: status, provenance: "DEMO", created_at,
      ...(status === "VERIFIED_SAME_PERSON" ? { verified_at: created_at } : {}) });

  it("1. REAL VERIFIED only → VERIFIED_SAME_PERSON", () => {
    const r = resolve([real("VERIFIED_SAME_PERSON", "l1", at("10"))]);
    expect(r.link_status).toBe("VERIFIED_SAME_PERSON");
    expect(r.latest?.link_id).toBe("l1");
    expect(r.reason).toBeUndefined();
  });

  it("2. DEMO VERIFIED only → UNVERIFIED, with the reason stated", () => {
    const r = resolve([demo("VERIFIED_SAME_PERSON", "l1", at("10"))]);
    expect(r.link_status).toBe("UNVERIFIED");
    expect(r.latest).toBeUndefined();
    expect(r.reason).toContain("DEMO");
    expect(r.reason).toContain("not REAL");
    /* Seen and surfaced, never counted. */
    expect(r.nonAuthoritative?.map((x) => x.link_id)).toEqual(["l1"]);
  });

  it("3. REAL DECLARED only → DECLARED_SAME_PERSON", () => {
    const r = resolve([real("DECLARED_SAME_PERSON", "l1", at("10"))]);
    expect(r.link_status).toBe("DECLARED_SAME_PERSON");
  });

  it("4. DEMO DECLARED only → UNVERIFIED", () => {
    const r = resolve([demo("DECLARED_SAME_PERSON", "l1", at("10"))]);
    expect(r.link_status).toBe("UNVERIFIED");
    expect(r.reason).toContain("DEMO");
  });

  it("5. REAL VERIFIED then later DEMO VERIFIED → REAL remains effective", () => {
    const r = resolve([real("VERIFIED_SAME_PERSON", "l1", at("10")),
                       demo("VERIFIED_SAME_PERSON", "l2", at("11"))]);
    expect(r.link_status).toBe("VERIFIED_SAME_PERSON");
    /* Latest-wins must not reach past the provenance filter. */
    expect(r.latest?.link_id).toBe("l1");
    expect(r.nonAuthoritative?.map((x) => x.link_id)).toEqual(["l2"]);
  });

  it("6. REAL VERIFIED then later DEMO DECLARED → no downgrade", () => {
    const r = resolve([real("VERIFIED_SAME_PERSON", "l1", at("10")),
                       demo("DECLARED_SAME_PERSON", "l2", at("11"))]);
    expect(r.link_status).toBe("VERIFIED_SAME_PERSON");
    expect(r.latest?.link_id).toBe("l1");
  });

  it("7. DEMO VERIFIED then later REAL DECLARED → REAL DECLARED", () => {
    const r = resolve([demo("VERIFIED_SAME_PERSON", "l1", at("10")),
                       real("DECLARED_SAME_PERSON", "l2", at("11"))]);
    expect(r.link_status).toBe("DECLARED_SAME_PERSON");
    expect(r.latest?.link_id).toBe("l2");
  });

  it("8. DEMO VERIFIED then later REAL VERIFIED → REAL VERIFIED", () => {
    const r = resolve([demo("VERIFIED_SAME_PERSON", "l1", at("10")),
                       real("VERIFIED_SAME_PERSON", "l2", at("11"))]);
    expect(r.link_status).toBe("VERIFIED_SAME_PERSON");
    expect(r.latest?.link_id).toBe("l2");
  });

  it("9. a REAL conflict is still CONFLICT", () => {
    const a = baseLink({ link_id: "l1", person_id: "person_a", provenance: "REAL" });
    const b = baseLink({ link_id: "l2", person_id: "person_b", provenance: "REAL" });
    const r = resolvePersonCommunityLink([a, b], "person_a", M, C);
    expect(r.link_status).toBe("CONFLICT");
  });

  it("10. no record at all → NOT_LINKED, distinct from UNVERIFIED", () => {
    const r = resolve([]);
    expect(r.link_status).toBe("NOT_LINKED");
    expect(r.reason).toBeUndefined();
    expect(r.nonAuthoritative).toBeUndefined();
  });

  it("a DEMO record naming a DIFFERENT person cannot force CONFLICT on REAL authority", () => {
    /* A demo fixture is not a contradiction. Letting it force CONFLICT would
       be a demonstration revoking real authority — the same defect inverted. */
    const r = resolve([
      real("VERIFIED_SAME_PERSON", "l1", at("10")),
      baseLink({ link_id: "l2", person_id: "person_other", provenance: "DEMO" }),
    ]);
    expect(r.link_status).toBe("VERIFIED_SAME_PERSON");
  });

  it("the stored records are never mutated by resolving", () => {
    const records = [real("VERIFIED_SAME_PERSON", "l1", at("10")),
                     demo("VERIFIED_SAME_PERSON", "l2", at("11"))];
    const before = JSON.stringify(records);
    resolve(records);
    expect(JSON.stringify(records)).toBe(before);
  });

  it("the REAL person_roei ↔ p_you pair resolves exactly as it does on disk", () => {
    /* The two records currently in the real store, by shape: a declaration and
       the confirmation that supersedes it, both provenance REAL. */
    const declared = baseLink({
      link_id: "link_msuzqvmf_000001", person_id: "person_roei",
      community_member_id: "p_you", community_id: "vg_ahrayut_kehilatit",
      link_status: "DECLARED_SAME_PERSON", provenance: "REAL", created_at: at("10"),
    });
    const verified = baseLink({
      link_id: "link_msuzr1zb_000002", person_id: "person_roei",
      community_member_id: "p_you", community_id: "vg_ahrayut_kehilatit",
      link_status: "VERIFIED_SAME_PERSON", provenance: "REAL",
      created_at: at("11"), verified_at: at("11"),
      supersedes_link_id: "link_msuzqvmf_000001",
    });
    const r = resolvePersonCommunityLink([declared, verified],
      "person_roei", "p_you", "vg_ahrayut_kehilatit");
    expect(r.link_status).toBe("VERIFIED_SAME_PERSON");
    expect(r.latest?.link_id).toBe("link_msuzr1zb_000002");
  });
});

/**
 * ASSURANCE — what a resolved status is actually WORTH.
 *
 * The persisted vocabulary is unchanged and unmigrated; these tests read the
 * derived tier alongside it. The claim under test is that "VERIFIED" stops
 * being one word covering two very different things.
 */
describe("assurance tiers — derived, never stored", () => {
  const P = "person_test_x", M = "member_test_x", C = "community_test_x";
  const resolve = (records: PersonCommunityLink[]) => resolvePersonCommunityLink(records, P, M, C);

  it("DECLARED_SAME_PERSON → SELF_DECLARED_SAME_PERSON", () => {
    const r = resolve([baseLink({ link_status: "DECLARED_SAME_PERSON" })]);
    /* The stored status is untouched; the tier sits beside it. */
    expect(r.link_status).toBe("DECLARED_SAME_PERSON");
    expect(r.assurance).toBe("SELF_DECLARED_SAME_PERSON");
  });

  it("VERIFIED_SAME_PERSON + declaration_source=self → SELF_ATTESTED_SAME_PERSON", () => {
    const r = resolve([baseLink({
      link_status: "VERIFIED_SAME_PERSON", verified_at: "2026-08-16T10:05:00Z",
      declaration_source: "self",
    })]);
    expect(r.link_status).toBe("VERIFIED_SAME_PERSON");
    expect(r.assurance).toBe("SELF_ATTESTED_SAME_PERSON");
  });

  it("a DEMO record substantiates no tier at all", () => {
    expect(resolve([baseLink({ provenance: "DEMO" })]).assurance).toBe("NONE");
  });

  it("CONFLICT and NOT_LINKED substantiate no tier", () => {
    expect(resolve([]).assurance).toBe("NONE");
    const a = baseLink({ link_id: "l1", person_id: "person_a" });
    const b = baseLink({ link_id: "l2", person_id: "person_b" });
    expect(resolvePersonCommunityLink([a, b], "person_a", M, C).assurance).toBe("NONE");
  });

  it("the tier describes the AUTHORITATIVE record, not a later DEMO one", () => {
    const r = resolve([
      baseLink({ link_id: "l1", link_status: "VERIFIED_SAME_PERSON",
        verified_at: "2026-08-16T10:00:00Z", created_at: "2026-08-16T10:00:00Z" }),
      baseLink({ link_id: "l2", provenance: "DEMO", created_at: "2026-08-16T11:00:00Z" }),
    ]);
    expect(r.assurance).toBe("SELF_ATTESTED_SAME_PERSON");
    expect(r.latest?.link_id).toBe("l1");
  });

  /**
   * THE RESERVED TIER IS UNREACHABLE, AND THIS IS THE PROOF.
   *
   * Not a comment promising it: an exhaustive sweep of every record shape the
   * type system can express. `INDEPENDENTLY_VERIFIED_SAME_PERSON` requires an
   * authority model that does not exist — `PersonCommunityLink` has no
   * `actor_id`, so a record cannot even name who attested.
   */
  it("INDEPENDENTLY_VERIFIED_SAME_PERSON is returned by NO expressible record", () => {
    const statuses = ["VERIFIED_SAME_PERSON", "DECLARED_SAME_PERSON", "UNVERIFIED"] as const;
    const sources = ["self", "third_party", "system_import"] as const;
    const provenances = ["REAL", "DEMO"] as const;

    const seen = new Set<string>();
    for (const link_status of statuses) {
      for (const declaration_source of sources) {
        for (const provenance of provenances) {
          const record = baseLink({
            link_status, declaration_source, provenance,
            ...(link_status === "VERIFIED_SAME_PERSON" ? { verified_at: "2026-08-16T10:05:00Z" } : {}),
          });
          seen.add(assuranceOf(record));
          seen.add(resolve([record]).assurance);
        }
      }
    }
    expect(seen.has("INDEPENDENTLY_VERIFIED_SAME_PERSON")).toBe(false);
    expect([...seen].sort()).toEqual(
      ["NONE", "SELF_ATTESTED_SAME_PERSON", "SELF_DECLARED_SAME_PERSON"]);
  });

  it("a third-party VERIFIED record claims a tier it cannot substantiate → NONE", () => {
    /* `declaration_source: "third_party"` records a CLAIMED origin, not a
       proven authorization, and no actor is named. Treating it as independent
       verification would grant the strongest tier on the weakest evidence.
       `validateLink` refuses such a record anyway. */
    const forged = baseLink({
      link_status: "VERIFIED_SAME_PERSON", verified_at: "2026-08-16T10:05:00Z",
      declaration_source: "third_party",
    });
    expect(assuranceOf(forged)).toBe("NONE");
    expect(validateLink(forged).valid).toBe(false);
  });

  it("the real person_roei ↔ p_you link is SELF_ATTESTED, not independently verified", () => {
    const verified = baseLink({
      link_id: "link_msuzr1zb_000002", person_id: "person_roei",
      community_member_id: "p_you", community_id: "vg_ahrayut_kehilatit",
      link_status: "VERIFIED_SAME_PERSON", provenance: "REAL",
      declaration_source: "self", verified_at: "2026-08-16T10:05:00Z",
      supersedes_link_id: "link_msuzqvmf_000001",
    });
    const r = resolvePersonCommunityLink([verified], "person_roei", "p_you", "vg_ahrayut_kehilatit");
    expect(r.link_status).toBe("VERIFIED_SAME_PERSON");
    expect(r.assurance).toBe("SELF_ATTESTED_SAME_PERSON");
  });
});
