/**
 * NO VISIBLE SURFACE MAY CONCLUDE "VERIFIED" FOR A SELF-ATTESTED LINK.
 *
 * The Day strip was corrected first, but the community surfaces still printed
 * the stored word: `⚭ VERIFIED_SAME_PERSON` on a badge, "חבר מאומת" on a
 * board, "VERIFIED_SAME_PERSON" as a status tag. Each was individually
 * defensible — it is what the record says — and collectively they told a
 * person their identity had been verified by something.
 *
 * These render the real components and assert the rendered markup.
 */
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

import type { ShellIdentityLink } from "@/app/lib/philos/shell/SystemShell";
import type { AssuranceTier } from "../personCommunityLink";
import {
  ASSURANCE_LABEL, NO_INDEPENDENT_VERIFICATION, SECOND_STEP_PENDING,
  STORED_LEGACY_PREFIX,
} from "../identityAssuranceVocabulary";

vi.mock("next/link", () => ({
  default: ({ children, ...rest }: { children: React.ReactNode }) =>
    React.createElement("a", rest, children),
}));

/** Every phrasing that would overclaim for a self tier. */
const FORBIDDEN = [
  "VERIFIED_SAME_PERSON", "חבר מאומת", "זהות מאומתת",
  "independently verified", "externally verified", "verified by authority",
];
/** …except behind the explicit legacy label, which is allowed and required. */
function forbiddenOutsideLegacy(html: string): string[] {
  /* The prefix contains "(legacy):" — regex metacharacters — so it is escaped
     rather than interpolated raw. Getting this wrong made the strip silently
     no-op and the assertion fail on text that was correctly labelled. */
  const escaped = STORED_LEGACY_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const withoutLegacy = html.replace(new RegExp(`${escaped}[^<]*`, "g"), "");
  return FORBIDDEN.filter((p) => withoutLegacy.includes(p));
}

const idLink = (assurance: AssuranceTier, status: ShellIdentityLink["status"]): ShellIdentityLink =>
  ({ status, assurance, person_id: "person_roei", community_member_id: "p_you" });

describe("1+4. IdentityBadge (CommunityLivingView) uses the tier", () => {
  const render = async (link: ShellIdentityLink) => {
    const { IdentityBadge } = await import("@/app/hub/community/CommunityLivingView");
    return renderToStaticMarkup(React.createElement(IdentityBadge, { identityLink: link }));
  };

  it("does not conclude VERIFIED for SELF_ATTESTED", async () => {
    const html = await render(idLink("SELF_ATTESTED_SAME_PERSON", "VERIFIED_SAME_PERSON"));
    expect(html).toContain(ASSURANCE_LABEL.SELF_ATTESTED_SAME_PERSON);
    expect(forbiddenOutsideLegacy(html)).toEqual([]);
  });

  it("shows the no-link label when nothing is linked", async () => {
    const html = await render(idLink("NONE", "NOT_LINKED"));
    expect(html).toContain(ASSURANCE_LABEL.NONE);
    expect(forbiddenOutsideLegacy(html)).toEqual([]);
  });
});

describe("2+6. PersonCommunityLinkPanel", () => {
  const render = async (assurance: AssuranceTier, status: ShellIdentityLink["status"]) => {
    const { default: Panel } = await import("@/app/hub/community/PersonCommunityLinkPanel");
    return renderToStaticMarkup(React.createElement(Panel, {
      personId: "person_roei", communityMemberId: "p_you",
      communityMemberDisplayName: "את/ה", communityId: "vg_ahrayut_kehilatit",
      initialStatus: status, initialAssurance: assurance,
    }));
  };

  it("shows self-attested wording, not a verification claim", async () => {
    const html = await render("SELF_ATTESTED_SAME_PERSON", "VERIFIED_SAME_PERSON");
    expect(html).toContain(ASSURANCE_LABEL.SELF_ATTESTED_SAME_PERSON);
    expect(html).toContain(NO_INDEPENDENT_VERIFICATION);
    expect(forbiddenOutsideLegacy(html)).toEqual([]);
  });

  it("6. the raw persisted status appears ONLY behind the legacy label", async () => {
    const html = await render("SELF_ATTESTED_SAME_PERSON", "VERIFIED_SAME_PERSON");
    expect(html).toContain(`${STORED_LEGACY_PREFIX} VERIFIED_SAME_PERSON`);
    expect(forbiddenOutsideLegacy(html)).toEqual([]);
  });

  it("a declared-only link says the second step is pending", async () => {
    const html = await render("SELF_DECLARED_SAME_PERSON", "DECLARED_SAME_PERSON");
    expect(html).toContain(ASSURANCE_LABEL.SELF_DECLARED_SAME_PERSON);
    expect(html).toContain(SECOND_STEP_PENDING);
    expect(html).toContain(NO_INDEPENDENT_VERIFICATION);
  });

  it("7. the behavioural buttons are unchanged — gated on stored status", async () => {
    /* Declare offered only from NOT_LINKED; confirm only from DECLARED. The
       wording changed; which control appears did not. */
    expect(await render("NONE", "NOT_LINKED")).toContain("זה אני");
    expect(await render("SELF_DECLARED_SAME_PERSON", "DECLARED_SAME_PERSON")).toContain("שלב 2/2");
    const attested = await render("SELF_ATTESTED_SAME_PERSON", "VERIFIED_SAME_PERSON");
    expect(attested).not.toContain("שלב 2/2");
    expect(attested).not.toContain("זה אני");
  });
});

describe("3. ValueGroupsBoard no longer says חבר מאומת", () => {
  it("the source file contains no 'חבר מאומת' identity claim", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("app/hub/community/ValueGroupsBoard.tsx", "utf8");
    expect(src).not.toContain("חבר מאומת");
    expect(src).not.toContain("VERIFIED_SAME_PERSON");
    expect(src).toContain("ASSURANCE_LABEL");
  });
});

describe("5+10. no identity surface concludes independent verification", () => {
  const SURFACES = [
    "app/hub/community/CommunityLivingView.tsx",
    "app/hub/community/PersonCommunityLinkPanel.tsx",
    "app/hub/community/ValueGroupsBoard.tsx",
    "app/hub/community/ActionCollectiveContext.tsx",
    "app/hub/community/CommunityUniverse.tsx",
    "app/hub/community/CommunityExperience.tsx",
    "app/hub/community/CommunityPrototype.tsx",
    "app/hub/HubCommandCenter.tsx",
    "app/hub/HubNowPanel.tsx",
    "app/brain/BrainV2.tsx",
    "app/marketplace/MarketplacePrototype.tsx",
    "app/lib/philos/day/DayStatusStrip.tsx",
  ];

  it("no surface renders a bare VERIFIED_SAME_PERSON or 'זהות מאומתת'", async () => {
    const { readFileSync } = await import("node:fs");
    const offenders: string[] = [];
    for (const f of SURFACES) {
      const src = readFileSync(f, "utf8");
      /* Comparisons (`=== "VERIFIED_SAME_PERSON"`) are BEHAVIOUR and stay.
         Only rendered text is under test, so comparison operators and type
         positions are stripped before looking. */
      const rendered = src
        .split("\n")
        .filter((l) => !/===|!==|:\s*LinkStatus|Record<LinkStatus|\* /.test(l))
        .join("\n");
      for (const bad of ["חבר מאומת", "זהות מאומתת", "גשר זהות מאומת"]) {
        if (rendered.includes(bad)) offenders.push(`${f}: ${bad}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("visible identity reasons are Hebrew — no English resolver text leaks", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of ["app/lib/philos/day/DayStatusStrip.tsx", "app/hub/community/PersonCommunityLinkPanel.tsx"]) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toContain("link record(s) exist");
      expect(src).not.toContain("carry provenance");
      expect(src).not.toContain("cannot assert");
    }
  });
});
