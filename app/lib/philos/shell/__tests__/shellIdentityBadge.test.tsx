/**
 * THE GLOBAL IDENTITY BADGE — WHAT EVERY TERMINAL TELLS A PERSON.
 *
 * `DayStatusStrip` and `PersonCommunityLinkPanel` were corrected to speak by
 * assurance tier; `SystemShell` was not, and it is the ONE component that
 * renders on all seven terminals. It switched on the stored `link_status`, so
 * a two-step self-report printed as a green `VERIFIED` pill directly above a
 * strip that correctly called the same link self-attested. Two conclusions,
 * one screen, disagreeing.
 *
 * These tests assert the RENDERED MARKUP — what a screenshot would show — and
 * they assert the forbidden words as hard as the required ones.
 */
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SystemShell, type ShellIdentityLink } from "../SystemShell";
import {
  ASSURANCE_LABEL, NO_INDEPENDENT_VERIFICATION, SECOND_STEP_PENDING,
  assuranceQualifier,
} from "../../community/identityAssuranceVocabulary";
import type { AssuranceTier } from "../../community/personCommunityLink";
import { emptyViewerContext } from "../../context/resolvedViewerContext";

vi.mock("next/link", () => ({
  default: ({ children, ...rest }: { children: React.ReactNode }) =>
    React.createElement("a", rest, children),
}));

const SUBJECT = "person_roei", MEMBER = "p_you";

function link(over: Partial<ShellIdentityLink> = {}): ShellIdentityLink {
  return {
    status: "VERIFIED_SAME_PERSON",
    assurance: "SELF_ATTESTED_SAME_PERSON",
    person_id: SUBJECT,
    community_member_id: MEMBER,
    ...over,
  };
}

/* A real, EMPTY context — every field an honest UNKNOWN. The badge under
   test reads none of it; it is here only so the shell can mount. */
const VIEWER = emptyViewerContext(
  { viewer_id: "v", subject_id: SUBJECT, person_id: MEMBER } as Parameters<typeof emptyViewerContext>[0],
  "2026-08-27T00:00:00.000Z");

const render = (identityLink: ShellIdentityLink) =>
  renderToStaticMarkup(React.createElement(SystemShell, {
    viewerContext: VIEWER, surface: "hub", purpose: "test", identityLink,
  } as React.ComponentProps<typeof SystemShell>));

/** Anything that would overclaim for a link resting on the subject's word. */
const FORBIDDEN_FOR_SELF = [
  ">VERIFIED<", "VERIFIED_SAME_PERSON",
  "קישור זהות באימות עצמאי",
];

describe("the badge speaks by tier", () => {
  it("1. SELF_ATTESTED never renders a bare VERIFIED conclusion", () => {
    const html = render(link());
    for (const phrase of FORBIDDEN_FOR_SELF) expect(html).not.toContain(phrase);
    /* Not even as a substring of the pill word. */
    expect(html).not.toMatch(/>\s*VERIFIED\s*</);
  });

  it("2. SELF_ATTESTED renders its truthful label", () => {
    expect(render(link())).toContain("קישור זהות בהצהרה עצמית");
  });

  it("3. SELF_ATTESTED states that independent verification is absent", () => {
    expect(render(link())).toContain(NO_INDEPENDENT_VERIFICATION);
  });

  it("4. SELF_DECLARED renders its own label and its own qualifier", () => {
    const html = render(link({
      status: "DECLARED_SAME_PERSON", assurance: "SELF_DECLARED_SAME_PERSON",
    }));
    expect(html).toContain(ASSURANCE_LABEL.SELF_DECLARED_SAME_PERSON);
    expect(html).toContain(SECOND_STEP_PENDING);
    /* The attested label belongs to the OTHER tier and must not leak in. */
    expect(html).not.toContain(ASSURANCE_LABEL.SELF_ATTESTED_SAME_PERSON);
  });

  it("5. NONE renders 'אין קישור זהות'", () => {
    const html = render(link({ status: "NOT_LINKED", assurance: "NONE" }));
    expect(html).toContain(ASSURANCE_LABEL.NONE);
    expect(html).not.toContain(NO_INDEPENDENT_VERIFICATION);
  });

  it("6. independent wording appears ONLY for the reserved independent tier", () => {
    const independent = ASSURANCE_LABEL.INDEPENDENTLY_VERIFIED_SAME_PERSON;
    for (const tier of ["SELF_ATTESTED_SAME_PERSON", "SELF_DECLARED_SAME_PERSON", "NONE"] as const) {
      expect(render(link({ assurance: tier }))).not.toContain(independent);
    }
    const html = render(link({ assurance: "INDEPENDENTLY_VERIFIED_SAME_PERSON" }));
    expect(html).toContain(independent);
    /* And it carries NO caveat, because there is nothing to caveat. */
    expect(assuranceQualifier("INDEPENDENTLY_VERIFIED_SAME_PERSON")).toBe("");
  });

  it("7. assurance is AUTHORITATIVE — contradictory input renders the tier", () => {
    /* The exact shape that produced the defect: the stored word says
       VERIFIED, the resolver says the link is worth nothing. */
    const html = render(link({ status: "VERIFIED_SAME_PERSON", assurance: "NONE" }));
    expect(html).toContain(ASSURANCE_LABEL.NONE);
    expect(html).not.toContain(ASSURANCE_LABEL.SELF_ATTESTED_SAME_PERSON);
    expect(html).not.toMatch(/>\s*VERIFIED\s*</);
  });

  it("every tier renders exactly its own label, and no other tier's", () => {
    const tiers: AssuranceTier[] = [
      "SELF_ATTESTED_SAME_PERSON", "SELF_DECLARED_SAME_PERSON",
      "INDEPENDENTLY_VERIFIED_SAME_PERSON", "NONE",
    ];
    for (const tier of tiers) {
      const html = render(link({ assurance: tier }));
      expect(html).toContain(ASSURANCE_LABEL[tier]);
      for (const other of tiers) {
        /* NONE's label is a substring of no other; the rest are disjoint. */
        if (other !== tier && !ASSURANCE_LABEL[tier].includes(ASSURANCE_LABEL[other])) {
          expect(html).not.toContain(ASSURANCE_LABEL[other]);
        }
      }
    }
  });
});

describe("the tier reaches the badge unchanged", () => {
  const ROOT = join(process.cwd(), "app");

  it("8. every SystemShell caller passes the resolver's link straight through", () => {
    /* The single resolver is the only constructor of a ShellIdentityLink, and
       it carries `assurance` verbatim. Callers spread the whole object, so
       there is no site at which a tier could be substituted. Proven by
       source: no caller builds its own `assurance`. */
    const resolver = readFileSync(
      join(ROOT, "lib/philos/community/resolveShellIdentityLink.ts"), "utf8");
    expect(resolver).toContain("assurance: resolved.assurance");

    const callers = execSyncFiles()
      /* The two AUTHORITY modules are the constructors of the tier, not
         consumers of it: `personCommunityLink.assuranceOf` derives it, and
         `resolveShellIdentityLink` mints NONE when there is no group context
         to be linked to. Every other file must only pass it along. */
      .filter(([f]) => !f.endsWith("resolveShellIdentityLink.ts")
                    && !f.endsWith("personCommunityLink.ts"));
    expect(callers.length).toBeGreaterThan(5);
    for (const [file, src] of callers) {
      /* A caller may READ the tier; it may not mint one. */
      const minted = src.match(/assurance:\s*"(SELF_|INDEPENDENTLY_|NONE)/g) ?? [];
      expect(minted, `${file} constructs an assurance tier of its own`).toEqual([]);
    }
  });

  it("9. no shell source derives the visible conclusion from link_status", () => {
    const shell = readFileSync(join(ROOT, "lib/philos/shell/SystemShell.tsx"), "utf8");
    /* The precise defect: a status comparison feeding a presentation kind. */
    expect(shell).not.toContain('identityLink?.status === "VERIFIED_SAME_PERSON" ? "verified"');
    expect(shell).not.toMatch(/identityKind/);
    /* The badge's word must come from the vocabulary, not from a literal. */
    expect(shell).toContain("ASSURANCE_LABEL[identityLink.assurance]");

    const panel = readFileSync(join(ROOT, "hub/community/PersonCommunityLinkPanel.tsx"), "utf8");
    expect(panel).not.toContain("ASSURANCE_LABEL.SELF_ATTESTED_SAME_PERSON");
    expect(panel).toContain("isLinkedTier(assurance)");
  });
});

/** Every product source that names `identityLink=` as a SystemShell prop. */
function execSyncFiles(): [string, string][] {
  const out = execSync(
    "grep -rl 'identityLink' app --include='*.tsx' --include='*.ts' || true",
    { cwd: process.cwd(), encoding: "utf8" });
  return out.split("\n").filter((f) => f && !f.includes("__tests__"))
    .map((f) => [f, readFileSync(join(process.cwd(), f), "utf8")] as [string, string]);
}
