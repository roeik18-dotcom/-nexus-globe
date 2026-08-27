/**
 * THE SIX THINGS THAT MUST NOT SILENTLY COME BACK.
 *
 * Each assertion here corresponds to a defect that was live on a REAL screen:
 * a seeded roster counted as REAL members, a seeded budget counted as REAL
 * money, two membership sources unioned without a word, a DEMO tool rendered
 * over real records, and three canonical terminals with no way to click to
 * them.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { countByOrigin, splitByOrigin, isBootstrapEvent, BOOTSTRAP_LABEL } from "../eventProvenance";
import { VALUE_GROUP_EVENTS } from "../valueGroupLog";
import { demoToolsEnabled } from "../analysis/DemoSimulationSection";

const ROOT = join(process.cwd(), "app");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("1. seed membership never contributes to a REAL member count", () => {
  it("every seeded member.joined classifies as bootstrap, and REAL is 0", () => {
    const joins = VALUE_GROUP_EVENTS.filter((e) => e.event_type === "member.joined");
    expect(joins.length).toBeGreaterThan(0);
    expect(countByOrigin(joins).real).toBe(0);
    expect(joins.every(isBootstrapEvent)).toBe(true);
  });

  it("the panel renders the REAL join count, NOT the merged roster length", () => {
    const panel = read("hub/community/GroupOperationsPanel.tsx");
    expect(panel).toContain("profile.origin.joins.real");
    /* The exact expression that printed 9: a bare roster length in the figure. */
    expect(panel).not.toMatch(/colFigure\}>\{memberCount\}/);
    expect(panel).not.toMatch(/S\.chip\}>\{profile\.members\.length\} חברים/);
  });
});

describe("2. seed budget never contributes to a REAL budget", () => {
  it("seeded money events classify as bootstrap only", () => {
    const MONEY = new Set(["resource.received", "allocation.proposed", "allocation.voted",
      "allocation.approved", "transfer.approved", "transfer.completed"]);
    const money = VALUE_GROUP_EVENTS.filter((e) => MONEY.has(e.event_type));
    expect(money.length).toBeGreaterThan(0);
    expect(countByOrigin(money)).toEqual({ real: 0, bootstrap: money.length, bootstrapOnly: true });
  });

  it("the budget figure reads the REAL count and flags a bootstrap-only balance", () => {
    const panel = read("hub/community/GroupOperationsPanel.tsx");
    expect(panel).toContain("profile.origin.money.real");
    /* The balance is cumulative, so ANY seeded money event contaminates it —
       `bootstrapOnly` was too weak, since one real allocation that moved no
       money made it false while every displayed shekel was still seed. */
    expect(panel).toContain("profile.origin.money.bootstrap > 0");
  });
});

describe("3. a REAL event and a legacy membership row are never silently unioned", () => {
  it("the split is total and lossless — no record is dropped or double-counted", () => {
    const log = [...VALUE_GROUP_EVENTS, { event_id: "real_join" } as never];
    const { real, bootstrap } = splitByOrigin(log);
    expect(real.length + bootstrap.length).toBe(log.length);
    expect(real.length).toBe(1);
  });

  it("the panel states UNRESOLVED and names both sources without merging them", () => {
    const panel = read("hub/community/GroupOperationsPanel.tsx");
    expect(panel).toContain("UNRESOLVED");
    expect(panel).toContain("memberships.jsonl");
    expect(panel).toContain("member.joined");
    expect(panel).toContain("ואינם מאוחדים");
  });
});

describe("4. the DEMO tool is absent on REAL", () => {
  it("is opt-in and off unless the flag is exactly \"1\"", () => {
    const prev = process.env.PHILOS_SHOW_DEMO;
    try {
      delete process.env.PHILOS_SHOW_DEMO;
      expect(demoToolsEnabled()).toBe(false);
      for (const v of ["", "0", "true", "REAL"]) {
        process.env.PHILOS_SHOW_DEMO = v;
        expect(demoToolsEnabled()).toBe(false);
      }
      process.env.PHILOS_SHOW_DEMO = "1";
      expect(demoToolsEnabled()).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.PHILOS_SHOW_DEMO;
      else process.env.PHILOS_SHOW_DEMO = prev;
    }
  });
});

describe("5. bootstrap wording is visible wherever seed material is shown", () => {
  it("the label names itself as not-REAL", () => {
    expect(BOOTSTRAP_LABEL).toBe("BOOTSTRAP / REFERENCE — לא נתון REAL");
  });

  it("both seeded surfaces render the label", () => {
    for (const f of ["hub/community/GroupOperationsPanel.tsx", "hub/community/CommunityUniverse.tsx"]) {
      expect(read(f), f).toContain("BOOTSTRAP_LABEL");
    }
  });
});

describe("6. Community, Globe and World stay reachable", () => {
  const shell = read("lib/philos/shell/SystemShell.tsx");
  const scales = read("lib/philos/shell/SocialScaleNav.tsx");

  /* CONTRACT CHANGED. `SocialScaleNav` was the fix for an orphaned social
     family, but it then COMPETED with the role bar: "מערכת חברתית" appeared
     twice, and the more prominent copy was an anchor that navigated nowhere.
     One `PhilosNav` now owns all four families. The guarantee is unchanged —
     the three social terminals must be reachable — only its owner moved. */
  it("the shell MOUNTS the one navigation", () => {
    expect(shell).toContain("<PhilosNav");
    expect(shell).toContain('import PhilosNav');
    /* And the superseded controls are gone, not merely unused. */
    expect(shell).not.toContain("ROLE_BAR.map");
    expect(shell).not.toContain("<SocialScaleNav");
  });

  it("all three destinations are real routes, not in-page anchors", () => {
    const nav = read("lib/philos/shell/PhilosNav.tsx");
    for (const href of ["/hub/community", "/planet", "/world"]) {
      expect(nav, href).toContain(`href: "${href}"`);
    }
    /* The regression itself: the green control's href was an in-page anchor.
       Asserted on HREFS, not on the file text — the file explains the bug in
       a comment, and a comment naming the defect is not the defect. */
    const hrefs = [...nav.matchAll(/href:\s*"([^"]+)"/g)].map((x) => x[1]);
    expect(hrefs.length).toBeGreaterThanOrEqual(9);
    for (const h of hrefs) expect(h.startsWith("#"), h).toBe(false);
  });

  it("Human Config — which owns the DomainState writer — is linked, under אדם", () => {
    const nav = read("lib/philos/shell/PhilosNav.tsx");
    expect(nav).toContain('href: "/hub/human-config"');
    /* It belongs to the PERSON family, never to the green social one. */
    const person = nav.slice(nav.indexOf('id: "person"'), nav.indexOf('id: "action"'));
    expect(person).toContain("/hub/human-config");
  });
});
