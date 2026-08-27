/**
 * WHAT A PERSON IS ACTUALLY TOLD ABOUT THEIR IDENTITY LINK.
 *
 * The model could express "self-attested" since Phase 8.1B's resolver work,
 * but nothing rendered it: the strip printed the stored string
 * `VERIFIED_SAME_PERSON`, so a two-step self-report was displayed to a person
 * as though an authority had verified them.
 *
 * These tests assert the RENDERED OUTPUT — the DOM a screenshot would be taken
 * of — not the source, and they assert the words that must NEVER appear as
 * much as the words that must.
 */
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import { projectDaySession, type DayIdentity } from "../daySession";
import {
  ASSURANCE_LABEL, NON_AUTHORITATIVE_RECORD, NO_INDEPENDENT_VERIFICATION,
  SECOND_STEP_PENDING,
} from "../../community/identityAssuranceVocabulary";
import { resolvePersonCommunityLink, type PersonCommunityLink } from "../../community/personCommunityLink";
import type { AssuranceTier } from "../../community/personCommunityLink";
import { DAY_OPENED, dayId } from "../dayEvent";
import type { PhilosEvent } from "../../events";

vi.mock("next/link", () => ({
  default: ({ children, ...rest }: { children: React.ReactNode }) =>
    React.createElement("a", rest, children),
}));

const SUBJECT = "person_roei", MEMBER = "p_you", GROUP = "vg_ahrayut_kehilatit";
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

/** Exactly the mapping `loadDaySession.resolveDayIdentity` performs. */
function identityFrom(records: PersonCommunityLink[]): DayIdentity {
  const r = resolvePersonCommunityLink(records, SUBJECT, MEMBER, GROUP);
  return {
    subject_id: SUBJECT, person_id: MEMBER,
    link_status: r.link_status, assurance: r.assurance,
    ...(r.reason ? { link_reason: r.reason } : {}),
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

const sessionFor = (identity: DayIdentity) =>
  projectDaySession({ date: DATE, identity, events: [opened()], lifecycle: null });

const gateOf = (identity: DayIdentity) =>
  sessionFor(identity).gates.find((g) => g.gate === "IdentityLinked")!;

const renderStrip = async (identity: DayIdentity) => {
  const { default: DayStatusStrip } = await import("../DayStatusStrip");
  return renderToStaticMarkup(
    React.createElement(DayStatusStrip, { session: sessionFor(identity) }));
};

/** Every phrasing that would overclaim. None may ever appear for a self tier. */
const FORBIDDEN = [
  "independently verified", "identity verified", "externally verified",
  "verified by authority", "אימות עצמאי קיים", "מאומת עצמאית",
];

describe("assurance reaches the gate", () => {
  it("1+2. REAL VERIFIED self → SELF_ATTESTED, and the gate is MET", () => {
    const id = identityFrom([link()]);
    expect(id.assurance).toBe("SELF_ATTESTED_SAME_PERSON");
    expect(gateOf(id).met).toBe(true);
  });

  it("3. the gate reason says self-attested, and says independent verification is absent", () => {
    const reason = gateOf(identityFrom([link()])).reason!;
    expect(reason).toContain(ASSURANCE_LABEL.SELF_ATTESTED_SAME_PERSON);
    expect(reason).toContain(NO_INDEPENDENT_VERIFICATION);
    /* The stored value appears only as labelled audit metadata. */
    expect(reason).toContain("סטטוס מאוחסן");
  });

  it("7. REAL DECLARED → SELF_DECLARED and UNMET", () => {
    const id = identityFrom([link({ link_status: "DECLARED_SAME_PERSON", verified_at: undefined })]);
    expect(id.assurance).toBe("SELF_DECLARED_SAME_PERSON");
    expect(gateOf(id).met).toBe(false);
    expect(gateOf(id).reason).toContain(SECOND_STEP_PENDING);
  });

  it("8. DEMO VERIFIED → NONE, UNMET, with the provenance refusal reason", () => {
    const id = identityFrom([link({ provenance: "DEMO" })]);
    expect(id.assurance).toBe("NONE");
    expect(gateOf(id).met).toBe(false);
    /* Hebrew, and specific: a non-authoritative record, not a bare absence. */
    expect(gateOf(id).reason).toContain(NON_AUTHORITATIVE_RECORD);
  });

  it("9. missing link → NONE and a DISTINCT absent reason", () => {
    const g = gateOf(identityFrom([]));
    expect(g.met).toBe(false);
    expect(g.reason).toContain("לא נוצר קישור בין מרחבי השמות");
    /* Distinguishable from the DEMO exclusion, which is the whole point. */
    expect(g.reason).not.toBe(gateOf(identityFrom([link({ provenance: "DEMO" })])).reason);
  });

  it("10. REAL conflict → CONFLICT, NONE, UNMET, with a conflict reason", () => {
    const a = link({ link_id: "l1", person_id: "person_a" });
    const b = link({ link_id: "l2", person_id: "person_b" });
    const r = resolvePersonCommunityLink([a, b], "person_a", MEMBER, GROUP);
    const id: DayIdentity = {
      subject_id: "person_a", person_id: MEMBER,
      link_status: r.link_status, assurance: r.assurance,
    };
    expect(r.link_status).toBe("CONFLICT");
    expect(id.assurance).toBe("NONE");
    expect(gateOf(id).met).toBe(false);
    expect(gateOf(id).reason).toContain("סותרות");
  });

  it("11. a raw persisted VERIFIED cannot produce MET when assurance is NONE", () => {
    /* The exact shape that used to close the gate: the stored word is right,
       the tier is not. The gate must read the tier. */
    const id: DayIdentity = {
      subject_id: SUBJECT, person_id: MEMBER,
      link_status: "VERIFIED_SAME_PERSON", assurance: "NONE",
    };
    expect(gateOf(id).met).toBe(false);
  });

  it("12. the RESERVED tier is accepted by the gate but unreachable from stored records", () => {
    /* Pure unit assertion — no independently-verified record is fabricated. */
    const id: DayIdentity = {
      subject_id: SUBJECT, person_id: MEMBER,
      link_status: "VERIFIED_SAME_PERSON",
      assurance: "INDEPENDENTLY_VERIFIED_SAME_PERSON",
    };
    expect(gateOf(id).met).toBe(true);

    /* And no expressible stored record yields it. */
    const tiers = new Set<AssuranceTier>();
    for (const link_status of ["VERIFIED_SAME_PERSON", "DECLARED_SAME_PERSON", "UNVERIFIED"] as const) {
      for (const declaration_source of ["self", "third_party", "system_import"] as const) {
        for (const provenance of ["REAL", "DEMO"] as const) {
          tiers.add(identityFrom([link({
            link_status, declaration_source, provenance,
            ...(link_status === "VERIFIED_SAME_PERSON" ? { verified_at: "2026-08-27T10:00:00Z" } : {}),
          })]).assurance);
        }
      }
    }
    expect(tiers.has("INDEPENDENTLY_VERIFIED_SAME_PERSON")).toBe(false);
  });
});

describe("what the visible strip actually says", () => {
  it("4+5. shows the self-attested label and states independent verification is absent", async () => {
    const html = await renderStrip(identityFrom([link()]));
    expect(html).toContain("קישור זהות בהצהרה עצמית");
    expect(html).toContain("אין אימות עצמאי");
  });

  it("6. never calls a self tier independently/externally verified", async () => {
    const html = (await renderStrip(identityFrom([link()]))).toLowerCase();
    for (const phrase of FORBIDDEN) expect(html).not.toContain(phrase.toLowerCase());
  });

  it("the stored legacy status appears ONLY as labelled audit metadata", async () => {
    const html = await renderStrip(identityFrom([link()]));
    /* Present — an audit needs it — but never bare, and never as the
       conclusion: every occurrence is inside the labelled span. */
    expect(html).toContain('data-stored-link-status="VERIFIED_SAME_PERSON"');
    expect(html).toContain("סטטוס מאוחסן (legacy)");
    const conclusionIdx = html.indexOf("קישור זהות בהצהרה עצמית");
    const storedIdx = html.indexOf("סטטוס מאוחסן (legacy)");
    expect(conclusionIdx).toBeGreaterThan(-1);
    expect(conclusionIdx).toBeLessThan(storedIdx);
  });

  it("a DECLARED-only link renders its own label, not the attested one", async () => {
    const html = await renderStrip(
      identityFrom([link({ link_status: "DECLARED_SAME_PERSON", verified_at: undefined })]));
    expect(html).toContain(ASSURANCE_LABEL.SELF_DECLARED_SAME_PERSON);
    expect(html).not.toContain("קישור זהות בהצהרה עצמית — ");
    expect(html).toContain("אין אימות עצמאי");
  });

  it("a DEMO-only link renders the no-link label and no self tier", async () => {
    const html = await renderStrip(identityFrom([link({ provenance: "DEMO" })]));
    expect(html).toContain(ASSURANCE_LABEL.NONE);
    expect(html).not.toContain("אין אימות עצמאי");
  });

  it("13. the strip PROPAGATES the tier — it does not recompute it", async () => {
    /* A hand-made identity whose tier deliberately disagrees with its stored
       status. If the strip re-derived the tier from `link_status` it would
       print the attested label; it must print what it was handed. */
    const html = await renderStrip({
      subject_id: SUBJECT, person_id: MEMBER,
      link_status: "VERIFIED_SAME_PERSON", assurance: "NONE",
    });
    expect(html).toContain('data-identity-assurance="NONE"');
    expect(html).toContain(ASSURANCE_LABEL.NONE);
    expect(html).not.toContain("קישור זהות בהצהרה עצמית");
  });
});

describe("every terminal agrees", () => {
  /** The seven terminals all render this ONE component from this ONE session. */
  const TERMINALS = ["hub", "brain", "community", "dynamics", "marketplace", "planet", "world"];

  it("14. all seven terminal projections agree on gate and tier", async () => {
    const identity = identityFrom([link()]);
    const rows = await Promise.all(TERMINALS.map(async (terminal) => {
      const { default: DayStatusStrip } = await import("../DayStatusStrip");
      const html = renderToStaticMarkup(React.createElement(DayStatusStrip, {
        session: sessionFor(identity),
        closingHref: `/hub#day-closing-record?from=${terminal}`,
      }));
      return {
        terminal,
        met: gateOf(identity).met,
        tier: /data-identity-assurance="([^"]+)"/.exec(html)?.[1],
        label: html.includes("קישור זהות בהצהרה עצמית"),
        noIndependent: html.includes("אין אימות עצמאי"),
      };
    }));
    expect(new Set(rows.map((r) => r.met))).toEqual(new Set([true]));
    expect(new Set(rows.map((r) => r.tier))).toEqual(new Set(["SELF_ATTESTED_SAME_PERSON"]));
    expect(rows.every((r) => r.label && r.noIndependent)).toBe(true);
  });
});
