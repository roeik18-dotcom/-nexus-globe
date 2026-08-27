/**
 * A DEMO IDENTITY LINK MUST NOT CLOSE THE DAY'S IdentityLinked GATE.
 *
 * The gate reads one thing: `DayIdentity.link_status === "VERIFIED_SAME_PERSON"`
 * (`daySession.ts`), which `loadDaySession` derives from
 * `resolvePersonCommunityLink`. Before the provenance guard, a DEMO record
 * claiming VERIFIED for the right id pair reached that comparison as VERIFIED
 * and the gate closed — a demonstration fixture asserting that two real
 * identities are the same human.
 *
 * These tests run the REAL resolver and then the REAL gate projection, so what
 * is proven is the composition rather than either half in isolation.
 */
import { describe, expect, it } from "vitest";

import {
  resolvePersonCommunityLink, type PersonCommunityLink,
} from "../../community/personCommunityLink";
import { projectDaySession, type DayIdentity } from "../daySession";
import { DAY_OPENED, dayId } from "../dayEvent";
import type { PhilosEvent } from "../../events";

const SUBJECT = "person_roei";
const MEMBER = "p_you";
const GROUP = "vg_ahrayut_kehilatit";
const DATE = "2026-08-27";

function link(over: Partial<PersonCommunityLink> = {}): PersonCommunityLink {
  return {
    link_id: "l1", person_id: SUBJECT, community_member_id: MEMBER,
    community_id: GROUP, link_status: "VERIFIED_SAME_PERSON",
    evidence: "fixture", provenance: "REAL", declaration_source: "self",
    created_at: "2026-08-27T10:00:00Z", verified_at: "2026-08-27T10:00:00Z",
    ...over,
  };
}

/** The exact derivation `loadDaySession.ts` performs, applied to a fixture. */
function identityFrom(records: PersonCommunityLink[]): DayIdentity {
  const resolved = resolvePersonCommunityLink(records, SUBJECT, MEMBER, GROUP);
  return {
    subject_id: SUBJECT, person_id: MEMBER,
    /* Unnarrowed, exactly as `loadDaySession` now carries it. */
    link_status: resolved.link_status,
    assurance: resolved.assurance,
    ...(resolved.reason ? { link_reason: resolved.reason } : {}),
  };
}

const opened = (): PhilosEvent => ({
  event_id: "ev_open", actor_id: MEMBER, entity_type: "person", entity_id: MEMBER,
  event_type: DAY_OPENED, value_tags: [], timestamp: `${DATE}T06:00:00.000Z`,
  visibility: "private", caused_by: [],
  payload: {
    day_id: dayId(SUBJECT, DATE), subject_id: SUBJECT, intention: "i", context: "c",
    state_t0_refs: [], carry_forward_refs: [], consent: true, sourceRefs: [],
  },
} as unknown as PhilosEvent);

/** The gate, read out of the real projection. */
function identityGate(records: PersonCommunityLink[]) {
  const session = projectDaySession({
    date: DATE, identity: identityFrom(records), events: [opened()], lifecycle: null,
  });
  return session.gates.find((g) => g.gate === "IdentityLinked")!;
}

describe("IdentityLinked — provenance decides whether the gate can close", () => {
  it("a REAL VERIFIED link makes the gate MET", () => {
    expect(identityGate([link()]).met).toBe(true);
  });

  it("a DEMO VERIFIED link CANNOT make the gate MET", () => {
    const g = identityGate([link({ provenance: "DEMO" })]);
    expect(g.met).toBe(false);
    /* The narrowing that collapsed every non-verified state to "UNRESOLVED" is
       gone: the reason now names the provenance that excluded the record. */
    expect(g.reason).toContain("רשומה לא סמכותית אינה יוצרת קישור זהות");
    expect(g.reason).not.toContain("UNRESOLVED");
  });

  it("a DEMO DECLARED link cannot make the gate MET", () => {
    expect(identityGate([link({ provenance: "DEMO", link_status: "DECLARED_SAME_PERSON", verified_at: undefined })]).met)
      .toBe(false);
  });

  it("a REAL DECLARED link cannot make the gate MET — declaring is not verifying", () => {
    expect(identityGate([link({ link_status: "DECLARED_SAME_PERSON", verified_at: undefined })]).met)
      .toBe(false);
  });

  it("a DEMO record written AFTER a REAL verification leaves the gate MET", () => {
    const g = identityGate([
      link({ link_id: "l1", created_at: "2026-08-27T10:00:00Z" }),
      link({ link_id: "l2", provenance: "DEMO", created_at: "2026-08-27T11:00:00Z" }),
    ]);
    expect(g.met).toBe(true);
  });

  it("a REAL verification written AFTER a DEMO one makes the gate MET", () => {
    const g = identityGate([
      link({ link_id: "l1", provenance: "DEMO", created_at: "2026-08-27T10:00:00Z" }),
      link({ link_id: "l2", created_at: "2026-08-27T11:00:00Z" }),
    ]);
    expect(g.met).toBe(true);
  });

  it("no link record at all leaves the gate UNMET", () => {
    const g = identityGate([]);
    expect(g.met).toBe(false);
    /* An ABSENCE now reads differently from an exclusion — the two situations
       no longer share one word. */
    expect(g.reason).toContain("לא נוצר קישור בין מרחבי השמות");
    expect(resolvePersonCommunityLink([], SUBJECT, MEMBER, GROUP).link_status).toBe("NOT_LINKED");
  });

  it("across all five origin shapes, only REAL VERIFIED closes the gate", () => {
    const cases: Array<[string, PersonCommunityLink[]]> = [
      ["REAL VERIFIED", [link()]],
      ["REAL DECLARED", [link({ link_status: "DECLARED_SAME_PERSON", verified_at: undefined })]],
      ["DEMO VERIFIED", [link({ provenance: "DEMO" })]],
      ["DEMO DECLARED", [link({ provenance: "DEMO", link_status: "DECLARED_SAME_PERSON", verified_at: undefined })]],
      ["none", []],
    ];
    const met = cases.filter(([, records]) => identityGate(records).met).map(([name]) => name);
    expect(met).toEqual(["REAL VERIFIED"]);
  });
});
