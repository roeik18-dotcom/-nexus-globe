/**
 * PHASE 1 ACCEPTANCE — one scenario object, one header, seven terminals.
 *
 * The header is a synchronous server component with no client state, so it
 * can be rendered to static markup here. These tests therefore check the
 * ACTUAL OUTPUT the browser receives, not just the data behind it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import PersonEventOrientationHeader from "../PersonEventOrientationHeader";
import {
  ACCEPTANCE_SCENARIO_CLASSIFICATION, SCENARIO_EVENT_ID, SCENARIO_OBSERVATION_ID,
  loadAcceptanceScenario, scenarioReadingsInOrder, terminalProjection, unitGap,
  type TerminalName,
} from "../acceptanceScenario";
import { ANALYSIS_UNITS, MODEL_LABEL, checkReadingIntegrity } from "../analysisUnit";
import { flowNodes } from "../operationalSlice";

const ROOT = join(__dirname, "../../../../..");
const TERMINALS = {
  hub: "app/hub/page.tsx",
  brain: "app/brain/page.tsx",
  dynamics: "app/dynamics/page.tsx",
  community: "app/hub/community/page.tsx",
  marketplace: "app/marketplace/page.tsx",
  planet: "app/planet/page.tsx",
  world: "app/world/page.tsx",
} as const;

const render = (terminal: string) =>
  renderToStaticMarkup(createElement(PersonEventOrientationHeader, { terminal: terminal as TerminalName }));

describe("one shared source, seven terminals", () => {
  it("every terminal reaches the ONE scenario source and states no scenario data of its own", () => {
    /* STILL ONE SOURCE, ONE MOUNT — reached through the quarantine boundary
       rather than imported page-by-page. `DemoSimulationSection` renders
       `PersonEventOrientationHeader` and nothing else does, so "seven
       terminals, one object" is now enforced by there being a single import
       of the header in the whole app. */
    for (const [name, rel] of Object.entries(TERMINALS)) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src, `${name} must mount the shared DEMO section`)
        .toContain("analysis/DemoSimulationSection");
      expect(src, `${name} must render it`).toContain("<DemoSimulationSection");
      /* NO MANUAL COPY. A page that hard-codes the ids has stopped reading
         the shared source, which is the exact failure this phase prevents. */
      expect(src, `${name} must not hard-code the event id`).not.toContain(SCENARIO_EVENT_ID);
      expect(src, `${name} must not hard-code the observation id`).not.toContain(SCENARIO_OBSERVATION_ID);
    }
  });

  it("the scenario header is imported in exactly one place in the app", () => {
    const boundary = readFileSync(
      join(ROOT, "app/lib/philos/analysis/DemoSimulationSection.tsx"), "utf8");
    expect(boundary).toContain('from "./PersonEventOrientationHeader"');
    for (const rel of Object.values(TERMINALS)) {
      expect(readFileSync(join(ROOT, rel), "utf8"))
        .not.toContain("analysis/PersonEventOrientationHeader");
    }
  });

  it("renders the SAME event id and observation id on all seven", () => {
    const ids = Object.keys(TERMINALS).map((t) => {
      const html = render(t);
      return {
        t,
        event: /data-scenario-event-id="([^"]+)"/.exec(html)?.[1],
        obs: /data-scenario-observation-id="([^"]+)"/.exec(html)?.[1],
      };
    });
    expect(ids).toHaveLength(7);
    expect(new Set(ids.map((i) => i.event))).toEqual(new Set([SCENARIO_EVENT_ID]));
    expect(new Set(ids.map((i) => i.obs))).toEqual(new Set([SCENARIO_OBSERVATION_ID]));
  });

  it("hands every terminal the identical object, not a copy", () => {
    expect(loadAcceptanceScenario()).toBe(loadAcceptanceScenario());
  });
});

describe("two separate claims, neither presented as fact", () => {
  it("has exactly two claims, on distinct subjects of distinct kinds", () => {
    const { claims } = loadAcceptanceScenario();
    expect(claims).toHaveLength(2);
    expect(new Set(claims.map((c) => c.claim_id)).size).toBe(2);
    expect(claims.map((c) => c.subject_kind).sort()).toEqual(["institution", "person"]);
  });

  it("is REPORTED / UNDER_REVIEW and never VERIFIED or GUILTY", () => {
    for (const c of loadAcceptanceScenario().claims) {
      expect(c.reported).toBe("REPORTED");
      expect(c.review).toBe("UNDER_REVIEW");
    }
    const html = render("hub");
    expect(html).toContain("UNDER_REVIEW");
    expect(html).not.toMatch(/\bGUILTY\b/);
    expect(html).not.toMatch(/claim[^<]*VERIFIED/i);
  });

  it("keeps evidence verification independent of relation-to-claim", () => {
    const { evidence } = loadAcceptanceScenario();
    const capture = evidence.find((e) => e.evidence_id === "ev_publication_capture")!;
    /* The screenshot is VERIFIED and yet supports neither claim: it
       establishes only that the publication appeared. */
    expect(capture.verification).toBe("VERIFIED");
    expect(capture.relation).toBe("neutral_unresolved");

    /* A contradicting record is not thereby "rejected". */
    const denial = evidence.find((e) => e.relation === "contradicting")!;
    expect(denial.verification).not.toBe("REJECTED");
  });
});

describe("the fixture is never REAL", () => {
  it("carries the DEMO classification on the object and on screen", () => {
    expect(loadAcceptanceScenario().classification).toBe(ACCEPTANCE_SCENARIO_CLASSIFICATION);
    expect(ACCEPTANCE_SCENARIO_CLASSIFICATION).toContain("DEMO");
    expect(render("world")).toContain("DEMO / SIMULATION / ACCEPTANCE_SCENARIO");
  });

  it("never labels its provenance REAL", () => {
    const s = loadAcceptanceScenario();
    expect(s.observation.provenance).not.toBe("REAL");
    expect(s.white.provenance).not.toBe("REAL");
  });

  it("names no real person — the subject is described by role only", () => {
    const s = loadAcceptanceScenario();
    const subject = s.roles.find((r) => r.role === "SubjectOfClaim")!;
    expect(subject.ref).toMatch(/^scenario_/);
  });
});

describe("UNKNOWN is an absence, not a zero", () => {
  it("every unknown reading carries three nulls, and all ten pass integrity", () => {
    const readings = scenarioReadingsInOrder();
    expect(readings).toHaveLength(10);
    for (const r of readings) {
      expect(checkReadingIntegrity(r), `${r.unitId} must be sound`).toEqual([]);
      if (r.status === "unknown") {
        expect(r.direction).toBeNull();
        expect(r.intensity).toBeNull();
        expect(r.confidence).toBeNull();
      }
    }
  });

  it("carries no numeric intensity or confidence anywhere — no source supplies one", () => {
    for (const r of scenarioReadingsInOrder()) {
      expect(r.intensity).toBeNull();
      expect(r.confidence).toBeNull();
    }
  });

  it("draws unknown as an absence rather than a number", () => {
    expect(render("brain")).toContain("אין קריאה — לא אפס");
  });
});

describe("conflict of interest is derived and open", () => {
  it("is true because Actor and SubjectOfClaim are the same ref", () => {
    const s = loadAcceptanceScenario();
    const actor = s.roles.find((r) => r.role === "Actor")!.ref;
    const subject = s.roles.find((r) => r.role === "SubjectOfClaim")!.ref;
    expect(actor).toBe(subject);
    expect(s.conflictOfInterest).toBe(true);
    expect(s.independentReviewRequired).toBe(true);
  });

  it("surfaces the conflict on every terminal", () => {
    for (const t of Object.keys(TERMINALS)) {
      expect(render(t)).toContain('data-conflict-of-interest="true"');
    }
  });

  it("keeps all six roles as separate entries", () => {
    const roles = loadAcceptanceScenario().roles.map((r) => r.role);
    expect(new Set(roles)).toEqual(new Set(
      ["User", "Person", "WealthContext", "SubjectOfClaim", "Actor", "CommunityMember"],
    ));
  });
});

describe("naming and structure", () => {
  it("never PRESENTS the ten as departments or contradictions", () => {
    /* Scope is the RENDERED OUTPUT and the exported labels — a doc comment
       that names the wrong phrasing in order to forbid it is the file doing
       its job, and greping source text cannot tell the two apart. */
    for (const t of Object.keys(TERMINALS)) {
      const html = render(t).toLowerCase();
      expect(html, t).not.toContain("10 departments");
      expect(html, t).not.toContain("ten departments");
      expect(html, t).not.toContain("10 contradictions");
      expect(html, t).not.toContain("ten contradictions");
      expect(html, t).not.toContain("10 personality");
      expect(html, t).not.toContain("10 values");
    }
    /* The label names the composition, never a flat ten. */
    expect(MODEL_LABEL).toBe(
      "4 FOUNDATION VARIABLES + 6 CONTRADICTION DEPARTMENTS = 10 ANALYSIS UNITS",
    );
  });

  it("renders FOUNDATION and DEPARTMENTS as two distinct groups", () => {
    const html = render("planet");
    expect(html).toContain('data-analysis-group="FOUNDATION"');
    expect(html).toContain('data-analysis-group="DEPARTMENTS"');
    expect((html.match(/data-unit="/g) ?? [])).toHaveLength(10);
  });

  it("shows the model's SYNTHESIS status on screen", () => {
    expect(render("hub")).toContain("SYNTHESIS");
  });

  it("is collapsible with a native, keyboard-accessible control", () => {
    const html = render("community");
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
  });
});

describe("every terminal renders its own projection from the shared source", () => {
  it("all seven produce a non-empty projection", () => {
    for (const t of Object.keys(TERMINALS)) {
      const sections = terminalProjection(t as TerminalName);
      expect(sections.length, t).toBeGreaterThan(0);
      const html = render(t);
      expect(html, t).toContain(`data-terminal-projection="${t}"`);
      for (const sec of sections) expect(html, `${t}/${sec.label}`).toContain(sec.label);
    }
  });

  it("gives each terminal a DIFFERENT reading — not one body repeated", () => {
    const bodies = Object.keys(TERMINALS).map((t) =>
      terminalProjection(t as TerminalName).map((s) => s.label).join("|"));
    expect(new Set(bodies).size).toBe(7);
  });

  it("shows the purple person band and the white reference band", () => {
    const html = render("hub");
    expect(html).toContain("data-person-band");
    expect(html).toContain("data-white-band");
  });

  it("never colours a Claim with the action colour", () => {
    /* RED is matter/body/action. An allegation drawn in it would read as an
       act that happened, which is the one thing a claim is not. */
    for (const t of Object.keys(TERMINALS)) {
      for (const sec of terminalProjection(t as TerminalName)) {
        const mentionsClaim = /claim|טענ/i.test(sec.label);
        if (mentionsClaim) expect(sec.colorRole, `${t}/${sec.label}`).not.toBe("red");
      }
    }
  });

  it("marketplace leaves all six matching gates UNRESOLVED", () => {
    const gates = terminalProjection("marketplace")
      .find((s) => s.label.includes("שערי"))!;
    expect(gates.rows.map((r) => r.k))
      .toEqual(["CAN", "WANTS", "ALLOWED", "APPROPRIATE", "AVAILABLE", "CONSENT"]);
    for (const r of gates.rows) expect(r.status).toBe("UNRESOLVED");
  });

  it("dynamics invents no Action, Effect or Learning", () => {
    const sec = terminalProjection("dynamics").find((s) => s.label.includes("Action"))!;
    for (const r of sec.rows) expect(["OUT_OF_SCOPE", "NONE"]).toContain(r.status);
  });

  it("globe refuses a location it cannot verify", () => {
    const loc = terminalProjection("planet").find((s) => s.label === "מיקום")!;
    expect(loc.rows.find((r) => r.k === "LOCATION")!.status).toBe("UNRESOLVED");
  });
});

describe("the role bar and the three lenses", () => {
  it("gives every unit a missing reason and one collection action", () => {
    const html = render("hub");
    expect((html.match(/data-missing-reason/g) ?? [])).toHaveLength(10);
    expect((html.match(/data-collection-action/g) ?? [])).toHaveLength(10);
    for (const u of ANALYSIS_UNITS) {
      const g = unitGap(u.id);
      expect(g.missingReason.length, u.id).toBeGreaterThan(15);
      expect(g.collectionAction.length, u.id).toBeGreaterThan(15);
      expect(typeof g.evidenceCount).toBe("number");
    }
  });

  it("never invents a number to fill a gap", () => {
    for (const r of scenarioReadingsInOrder()) {
      expect(r.intensity).toBeNull();
      expect(r.confidence).toBeNull();
    }
    for (const u of ANALYSIS_UNITS) {
      const g = unitGap(u.id);
      expect(g.missingReason).not.toMatch(/\d+%|גבוה|נמוך/);
    }
  });

  it("renders exactly three lens surfaces, each hidden until targeted", () => {
    const html = render("world");
    for (const id of ["lens-green", "lens-white", "lens-red"]) {
      expect(html, id).toContain(`id="${id}"`);
      expect(html, id).toContain(`data-lens="${id}"`);
    }
    expect(html).toContain("[data-lens]:target{display:block}");
  });

  it("puts the four social lenses inside the green surface, not in the bar", () => {
    const html = render("hub");
    for (const l of ["Community — קבוצות ואנשים", "Globe — קשרים ורשתות",
      "World — מוסדות ומערכת", "Social — השפעה חברתית"]) {
      expect(html, l).toContain(l);
    }
    expect((html.match(/data-green-lens=/g) ?? [])).toHaveLength(4);
  });

  it("keeps identifiers out of the lens body and inside Audit", () => {
    const html = render("hub");
    /* Every lens that shows ids wraps them in a disclosure labelled Audit. */
    expect(html).toContain("▾ Audit — מזהים");
    expect(html).toContain("▾ Audit — מזהי שרשרת");
  });
});

describe("navigation — seven lenses over seven canonical terminals", () => {
  const shell = readFileSync(join(ROOT, "app/lib/philos/shell/SystemShell.tsx"), "utf8");
  const bar = shell.slice(shell.indexOf("const ROLE_BAR"), shell.indexOf("];", shell.indexOf("const ROLE_BAR")));

  it("declares exactly seven role controls", () => {
    expect((bar.match(/\{ id: "/g) ?? [])).toHaveLength(7);
    for (const id of ["purple", "blue", "green", "yellow", "orange", "red", "white"]) {
      expect(bar, id).toContain(`id: "${id}"`);
    }
  });

  it("makes GREEN one control, not four", () => {
    expect((bar.match(/id: "green"/g) ?? [])).toHaveLength(1);
    /* Community, Globe and World are not role controls. */
    for (const label of ["Community", "Globe", "World"]) {
      expect(bar, label).not.toContain(`label: "${label}"`);
    }
  });

  it("keeps all seven canonical terminal routes intact", () => {
    for (const r of ["/hub", "/brain", "/dynamics", "/hub/community",
      "/marketplace", "/planet", "/world"]) {
      expect(shell, r).toContain(`"${r}"`);
    }
  });

  it("points RED and WHITE at layers of existing terminals, not new ones", () => {
    expect(bar).toContain('"/dynamics#action-layer"');
    expect(bar).toContain('"/brain#evidence"');
  });
});

describe("canonical anchors", () => {
  it("puts #evidence on Brain and #action-layer on Dynamics, always visible", () => {
    const brain = render("brain");
    expect(brain).toContain('id="evidence"');
    expect(brain).toContain('data-lens-home="true"');

    const dyn = render("dynamics");
    expect(dyn).toContain('id="action-layer"');
    expect(dyn).toContain('data-lens-home="true"');
  });

  it("does not claim those anchors on terminals that do not own them", () => {
    for (const t of ["hub", "marketplace", "planet", "world", "community"] as const) {
      const html = render(t);
      expect(html, t).not.toContain('id="evidence"');
      expect(html, t).not.toContain('id="action-layer"');
    }
  });
});

describe("the full flow map", () => {
  it("draws the whole chain from external signal to open loops", () => {
    const nodes = flowNodes();
    expect(nodes[0]!.key).toBe("signal");
    expect(nodes[nodes.length - 1]!.key).toBe("loops");
    expect(nodes.length).toBeGreaterThanOrEqual(20);
  });

  it("gives the opening node no predecessor, and every other node one", () => {
    const nodes = flowNodes();
    expect(nodes[0]!.previousRef).toBeNull();
    /* No ref ⇒ no causal arrow. A line the data cannot justify is a claim. */
    for (const n of nodes.slice(1)) expect(n.previousRef, n.key).not.toBeNull();
  });

  it("keeps the four absences distinct", () => {
    const states = new Set(flowNodes().map((n) => n.state));
    for (const s of states) {
      expect(["CONNECTED", "PARTIAL", "STRUCTURAL_GAP", "NO_RECORD",
        "MISSING_DATA", "UNLINKED", "BLOCKED", "UNRESOLVED"]).toContain(s);
    }
    expect(states.has("MISSING_DATA")).toBe(true);
    expect(states.has("UNRESOLVED")).toBe(true);
  });

  it("routes every node to a canonical terminal", () => {
    const ok = ["/hub", "/brain", "/dynamics", "/hub/community", "/marketplace", "/planet", "/world"];
    for (const n of flowNodes()) {
      expect(ok.some((r) => n.href.startsWith(r)), `${n.key} → ${n.href}`).toBe(true);
    }
  });

  it("is drawn in full ONLY by Dynamics, which owns the chain", () => {
    /* Painting all 21 nodes on all seven terminals was the same picture seven
       times, and it pushed each terminal's own work below the fold. */
    const dyn = render("dynamics");
    expect((dyn.match(/data-flow-node=/g) ?? []).length).toBe(flowNodes().length);
    expect(dyn).toContain("data-flow-map");
  });

  it("gives Hub a summary and the rest a link — never a second copy", () => {
    const hub = render("hub");
    expect(hub).toContain('data-flow-variant="summary"');
    expect((hub.match(/data-flow-node=/g) ?? [])).toHaveLength(0);

    for (const t of Object.keys(TERMINALS).filter((x) => x !== "hub" && x !== "dynamics")) {
      const html = render(t);
      expect(html, t).toContain('data-flow-variant="link"');
      expect((html.match(/data-flow-node=/g) ?? []).length, t).toBe(0);
    }
  });

  it("still reads the one shared selector on every terminal", () => {
    for (const t of Object.keys(TERMINALS)) {
      const html = render(t);
      expect(html, t).toContain("data-flow-map");
      /* Dynamics HOSTS the map at #flow; everyone else points at it. */
      if (t === "dynamics") expect(html, t).toContain('id="flow"');
      else expect(html, t).toContain("/dynamics#flow");
    }
  });
});
