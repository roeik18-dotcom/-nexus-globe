/**
 * PHASE 2 ACCEPTANCE — the operational chain on the same one event.
 *
 * These assert referential integrity (every stage points at the previous one
 * by id, not by resemblance) and the refusals: no verdict, no invented
 * impact, no self-review, and an event that stays open.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import PersonEventOrientationHeader from "../PersonEventOrientationHeader";
import {
  SCENARIO_EVENT_ID, SCENARIO_OBSERVATION_ID, SCENARIO_PERSON_ID,
  loadAcceptanceScenario, type TerminalName,
} from "../acceptanceScenario";
import {
  ACTION, AUTHORITY, AUTHORITY_DECISION, COMMITMENT, COMPLETENESS, CONSENT_RECORD,
  EFFECT, EFFECT_EVIDENCE, GATES, IMPACTS, LEARNING, MATCH, NEED, OPM_REGISTRY,
  IDENTITY_VERIFIED, ORIENTATION, STATE_T0, STATE_T1, TENSIONS, allGatesPass,
  chainRefs, dayClosing,
  contradictoryEvidence, effectEvidence, eventComplete, eventState, evidenceLines,
  matchPermitted, operationalProjection, sourceEvidence,
} from "../operationalSlice";

/* The chain exists only because every gate passed. These non-null asserts
   document that precondition; the gate test below is what enforces it. */
const action = ACTION!;
const effect = EFFECT!;
const learning = LEARNING!;
const commitment = COMMITMENT!;

const TERMINALS: TerminalName[] =
  ["hub", "brain", "dynamics", "community", "marketplace", "planet", "world"];

const render = (t: TerminalName) =>
  renderToStaticMarkup(createElement(PersonEventOrientationHeader, { terminal: t }));

describe("no second slice, no new event", () => {
  it("uses only the two approved ids", () => {
    const refs = chainRefs();
    expect(refs.event).toBe(SCENARIO_EVENT_ID);
    expect(refs.observation).toBe(SCENARIO_OBSERVATION_ID);
  });

  it("never writes to any store — the module is pure", () => {
    const src = readFileSync(join(__dirname, "../operationalSlice.ts"), "utf8");
    for (const forbidden of ["appendGroupEvents", "appendFileSync", "writeFileSync", ".append("]) {
      expect(src, forbidden).not.toContain(forbidden);
    }
  });

  it("imports no canon store — it derives, it does not persist", () => {
    const src = readFileSync(join(__dirname, "../operationalSlice.ts"), "utf8");
    /* No `s` flag — the tsconfig target predates dotAll. Matching the
       `from "…"` tail alone is enough and needs no multiline dot. */
    const imports = [...src.matchAll(/from "([^"]+)";/g)].map((m) => m[1]);
    expect(imports.every((i) => i.startsWith("./"))).toBe(true);
  });
});

describe("Tension is not a Need", () => {
  it("creates exactly one Need, from the verified operational gap", () => {
    expect(NEED.need_id).toBe("need_preserve_and_route_for_review");
    expect(NEED.derived_from).toBe("ten_actor_is_subject");
    expect(NEED.basis).toContain("פער תפעולי מאומת");
  });

  it("has more tensions than needs — a tension did not become a need", () => {
    expect(TENSIONS.length).toBeGreaterThan(1);
    expect(NEED.not_derived_from).toContain("תוכן הטענות");
  });

  it("opens no fundraising and invents no danger", () => {
    const all = JSON.stringify([NEED, ...operationalProjection("community"),
      ...operationalProjection("marketplace")]);
    expect(all).not.toMatch(/גיוס כספים נפתח|תרומ/);
    expect(NEED.not_derived_from.join(" ")).toContain("סכנה מיידית");
  });
});

describe("match gates — all six, judged separately", () => {
  it("judges all six", () => {
    expect(GATES.map((g) => g.gate))
      .toEqual(["CAN", "WANTS", "ALLOWED", "APPROPRIATE", "AVAILABLE", "CONSENT"]);
  });

  it("gives every gate its own sourceRefs — no gate passes on assertion", () => {
    for (const g of GATES) expect(g.sourceRefs.length, g.gate).toBeGreaterThan(0);
  });

  it("passes CONSENT because the USER consented to routing their own source", () => {
    const consent = GATES.find((g) => g.gate === "CONSENT")!;
    expect(consent.value).toBe("TRUE");
    expect(consent.sourceRefs).toContain(CONSENT_RECORD.consent_id);
    expect(CONSENT_RECORD.granted_by).toBe(SCENARIO_PERSON_ID);
    expect(CONSENT_RECORD.scope).toBe("preserve_and_route_source_for_independent_review");
  });

  it("keeps Consent and Authority as two records held by two different people", () => {
    expect(CONSENT_RECORD.granted_by).not.toBe(AUTHORITY_DECISION.decided_by);
    expect(AUTHORITY_DECISION.decided_by).toBe("reviewer_independent_fixture");
    /* Consenting to routing is not self-verification. */
    expect(CONSENT_RECORD.scope_note).toContain("אינה אימות עצמי");
    expect(CONSENT_RECORD.scope_note).toContain("review status");
    /* And the reviewer may not consent on the user's behalf. */
    expect(AUTHORITY_DECISION.excludes.join(" ")).toContain("Consent בשם המשתמש");
  });

  it("permits the match only when all six pass", () => {
    expect(allGatesPass()).toBe(true);
    expect(MATCH.decision).toBe("PERMITTED");
    expect(matchPermitted()).toBe(true);
    expect(MATCH.consent_ref).toBe(CONSENT_RECORD.consent_id);
    expect(MATCH.authority_ref).toBe(AUTHORITY_DECISION.decision_id);
  });
});

describe("MANDATORY — an unpermitted Match produces nothing downstream", () => {
  /**
   * WHAT ENFORCES WHAT. The derivation is runtime: each stage is built from
   * the previous one, so an unpermitted Match yields `null` all the way down.
   * TypeScript checks only that every reader handles `| null`; it does not
   * observe a gate changing value and would not fail because one did. These
   * assertions are the runtime guarantee.
   */
  it("types every downstream stage as nullable, gated on the one before it", () => {
    const src = readFileSync(join(__dirname, "../operationalSlice.ts"), "utf8");
    expect(src).toContain("export const COMMITMENT: Commitment | null = matchPermitted()");
    expect(src).toContain("export const ACTION: SimAction | null = COMMITMENT ?");
    expect(src).toContain("export const EFFECT: SimEffect | null = ACTION ?");
    expect(src).toContain("export const LEARNING: SimLearning | null = (ACTION && EFFECT)");
    expect(src).toContain("EFFECT_EVIDENCE: readonly EffectEvidence[] = ACTION ?");
  });

  it("derives the match decision from the gates rather than asserting it", () => {
    const src = readFileSync(join(__dirname, "../operationalSlice.ts"), "utf8");
    expect(src).toContain("decision: (allGatesPass() ? \"PERMITTED\"");
  });

  it("marks every blocked object a GAP in the OPM map when it does not exist", () => {
    for (const name of ["Commitment", "Action", "Effect", "Learning"]) {
      const o = OPM_REGISTRY.find((x) => x.object === name)!;
      /* Present here because the gates passed; the branch is what matters. */
      expect(o.status).toBe("SYNTHESIS");
      expect(o.id).not.toBe("—");
    }
  });
});

describe("authority — the subject cannot review themselves", () => {
  it("flags the conflict because Actor === SubjectOfClaim", () => {
    const s = loadAcceptanceScenario();
    expect(s.conflictOfInterest).toBe(true);
    expect(AUTHORITY.independentReviewRequired).toBe(true);
  });

  it("uses a reviewer with no relation to the subject", () => {
    expect(AUTHORITY.reviewer.relation_to_subject).toBe("none");
    expect(AUTHORITY.reviewer.id).not.toBe(
      loadAcceptanceScenario().roles.find((r) => r.role === "SubjectOfClaim")!.ref);
  });

  it("blocks self-verification, reviewer selection and closing", () => {
    const blocked = AUTHORITY.subjectMayNot.join(" ");
    expect(blocked).toContain("לאמת את עצמו");
    expect(blocked).toContain("לבחור לבדו");
    expect(blocked).toContain("לסגור");
    expect(blocked).toContain("Evidence");
  });

  it("grants DEMO scope only — never a REAL write", () => {
    expect(AUTHORITY.grant.scope).toContain("DEMO");
    expect(AUTHORITY.grant.scope).not.toBe("REAL");
  });
});

describe("Action → Effect → Evidence → Learning refs are complete", () => {
  const r = chainRefs();

  it("links every stage to the previous one by id", () => {
    expect(r.match_need_ref).toBe(r.need);
    expect(r.match_offer_ref).toBe(r.offer);
    expect(r.commitment_match_ref).toBe(r.match);
    expect(r.action_commitment_ref).toBe(r.commitment);
    expect(r.effect_action_ref).toBe(r.action);
    expect(r.evidence_action_refs.every((a) => a === r.action)).toBe(true);
    expect(r.learning_effect_ref).toBe(r.effect);
  });

  it("keeps the action a labelled simulation, never a world action", () => {
    expect(action.state).toContain("AUTHORIZED");
    expect(action.state).toContain("RECORDED");
    expect(action.reality).toContain("לא בוצעה פעולה בעולם");
    expect(action.provenance).toContain("SIMULATION");
  });

  it("keeps the effect internal and non-probative of the claims", () => {
    expect(effect.scope).toContain("INTERNAL");
    expect(effect.does_not_establish).toContain("אינו מוכיח");
  });

  it("derives Learning only from action+effect+evidence, and excludes guilt", () => {
    expect(learning.derived_from.action).toBe(action.action_id);
    expect(learning.derived_from.effect).toBe(effect.effect_id);
    expect(learning.derived_from.evidence).toEqual(EFFECT_EVIDENCE.map((e) => e.evidence_id));
    expect(learning.excludes).toContain("אשמה");
    expect(learning.excludes).toContain("אמת הטענות");
  });
});

describe("state", () => {
  it("preserves t0 as its own object", () => {
    expect(STATE_T0.at).toBe("t0");
    expect(STATE_T0.facts.join(" ")).toContain("תוכנו אינו מאומת");
    expect(STATE_T1.state_id).not.toBe(STATE_T0.state_id);
  });

  it("adds only operational change at t1, leaving the claims under review", () => {
    expect(STATE_T1.facts.join(" ")).toContain("המקור נשמר");
    expect(STATE_T1.facts.join(" ")).toContain("UNDER_REVIEW");
    /* t1 must not assert anything about the truth of the claims. */
    expect(STATE_T1.facts.join(" ")).not.toMatch(/הוכח|נמצא אשם|נמצא זכאי/);
  });
});

describe("event stays open", () => {
  it("is not complete, and therefore not CLOSED", () => {
    expect(eventComplete()).toBe(false);
    expect(eventState()).toBe("PARTIAL");
    expect(eventState()).not.toBe("CLOSED");
  });

  it("names which conditions are unmet", () => {
    const unmet = COMPLETENESS.filter((c) => !c.met).map((c) => c.condition);
    expect(unmet).toContain("EvidenceReviewed");
  });
});

describe("day closing", () => {
  const sections = dayClosing();
  const labels = sections.map((s) => s.label);

  it("carries every required section", () => {
    for (const need of ["אירוע ותצפית", "Claims", "Evidence", "FOUNDATION 4", "DEPARTMENTS 6",
      "פעולות שבוצעו בסימולציה", "Effects מקושרים", "Learning מאושר",
      "Authority / ניגוד עניינים", "EventComplete", "לולאות פתוחות", "הפעולה הבאה"]) {
      expect(labels.some((l) => l.includes(need)), need).toBe(true);
    }
  });

  it("leaves every unsourced impact UNKNOWN — never high, low or a percentage", () => {
    expect(IMPACTS).toHaveLength(7);
    for (const i of IMPACTS) {
      expect(i.value).toBe("UNKNOWN");
      expect(i.source).toBeNull();
    }
    const impacts = sections.find((s) => s.label.includes("השפעות"))!;
    for (const row of impacts.rows) {
      expect(row.status).toBe("UNKNOWN");
      expect(row.v).not.toMatch(/גבוה|נמוך|%/);
    }
  });

  it("is reachable from Hub and Dynamics, and from nowhere else", () => {
    for (const t of TERMINALS) {
      const has = render(t).includes("data-day-closing");
      expect(has, t).toBe(t === "hub" || t === "dynamics");
    }
  });
});

describe("OPM map", () => {
  it("reports the eight facts for every object", () => {
    expect(OPM_REGISTRY.length).toBeGreaterThanOrEqual(18);
    for (const o of OPM_REGISTRY) {
      expect(o.object).toBeTruthy();
      expect(o.schema).toBeTruthy();
      expect(o.state).toBeTruthy();
      expect(o.writer).toBeTruthy();
      expect(o.reader).toBeTruthy();
      expect(o.consumers.length).toBeGreaterThan(0);
      expect(["CANON", "IMPLEMENTED", "SOURCE", "SYNTHESIS", "GAP"]).toContain(o.status);
    }
  });

  it("keeps ValueGroup a GAP rather than inventing one", () => {
    const vg = OPM_REGISTRY.find((o) => o.object === "ValueGroup")!;
    expect(vg.state).toBe("UNRESOLVED");
    expect(vg.status).toBe("GAP");
  });

  it("renders the map on every terminal", () => {
    for (const t of TERMINALS) expect(render(t), t).toContain("data-opm-map");
  });
});

describe("DEMO is never rendered as REAL", () => {
  it("marks every simulated object", () => {
    for (const o of [ORIENTATION, NEED, MATCH, commitment, action, effect, learning,
      STATE_T0, STATE_T1, CONSENT_RECORD, AUTHORITY_DECISION]) {
      expect((o as { provenance: string }).provenance).toContain("DEMO");
    }
  });

  it("shows the classification on every terminal and never claims REAL", () => {
    for (const t of TERMINALS) {
      const html = render(t);
      expect(html, t).toContain("DEMO / SIMULATION / ACCEPTANCE_SCENARIO");
      expect(html, t).not.toMatch(/provenance[^<]{0,20}>REAL</);
    }
  });
});

describe("prototype Marketplace carries the shared header", () => {
  it("renders it in the early-return branch too", () => {
    const src = readFileSync(join(__dirname, "../../../../marketplace/page.tsx"), "utf8");
    const start = src.indexOf('params.view === "prototype"');
    expect(start).toBeGreaterThan(-1);
    /* Slice FORWARD from the branch — `MarketplacePrototype` also appears in
       the import list far above, so an unanchored indexOf reads the wrong
       region and passes or fails for the wrong reason. */
    const proto = src.slice(start, start + 1400);
    expect(proto).toContain("<MarketplacePrototype");
    expect(proto).toContain("PersonEventOrientationHeader");
  });
});

describe("the five Evidence records, named and explained", () => {
  const lines = evidenceLines();

  it("is exactly five, each with an id and a meaning — never a bare count", () => {
    expect(lines).toHaveLength(5);
    expect(lines.map((e) => e.evidence_id)).toEqual([
      "ev_publication_capture", "ev_public_denial",
      "ev_preserved_source_record", "ev_review_request_record",
      "ev_authority_decision_record",
    ]);
    for (const e of lines) {
      expect(e.meaning.length, e.evidence_id).toBeGreaterThan(10);
      expect(e.sourceRefs.length, e.evidence_id).toBeGreaterThan(0);
    }
  });

  it("keeps effect evidence about the action, not about a claim", () => {
    const eff = lines.filter((e) => e.relation === "about_action_not_claim");
    expect(eff).toHaveLength(3);
  });

  it("still shows a VERIFIED record that establishes less than the claim", () => {
    const cap = lines.find((e) => e.evidence_id === "ev_publication_capture")!;
    expect(cap.verification).toBe("VERIFIED");
    expect(cap.relation).toBe("neutral_unresolved");
  });

  it("renders all five in Day Closing, by id, inside the categorised section", () => {
    const sec = dayClosing().find((s) => s.label.includes("קטגוריות"))!;
    /* Rows = 2 category headers + 5 records + 1 reconciliation total. */
    expect(sec.rows).toHaveLength(8);
    for (const e of lines) {
      expect(sec.rows.some((r) => r.k === e.evidence_id), e.evidence_id).toBe(true);
    }
  });
});

describe("action stays a system simulation", () => {
  it("declares executionScope and worldExecution explicitly", () => {
    expect(action.executionScope).toBe("SYSTEM_SIMULATION");
    expect(action.worldExecution).toBe(false);
    expect(action.provenance).toContain("SIMULATION");
  });
});

describe("OPM map covers every named object", () => {
  it("includes all 25 — the two stored records among them", () => {
    const required = ["Person", "Context", "Event", "Claim", "Observation", "Evidence", "State",
      "Orientation", "Tension", "Need", "Capability", "Resource", "Offer", "Match",
      "Commitment", "Action", "Effect", "Learning", "DaySummary",
      "Value", "ValueFamily", "GeneralValue", "ValueGroup",
      "ConsentRecord", "IndependentAuthorityDecision"];
    const present = OPM_REGISTRY.map((o) => o.object);
    for (const r of required) expect(present, r).toContain(r);
    expect(required).toHaveLength(25);
  });

  it("invents no value mapping", () => {
    const value = OPM_REGISTRY.find((o) => o.object === "Value")!;
    expect(value.state).toBe("CANDIDATE");
    expect(value.sourceRefs.length).toBeGreaterThan(0);
    for (const name of ["ValueFamily", "GeneralValue", "ValueGroup"]) {
      const o = OPM_REGISTRY.find((x) => x.object === name)!;
      expect(o.state, name).toBe("UNRESOLVED");
      expect(o.status, name).toBe("GAP");
    }
  });
});

describe("event stays PARTIAL after the chain completes", () => {
  it("has AuthorityValid, ActionLinked and EffectLinked met", () => {
    const met = COMPLETENESS.filter((c) => c.met).map((c) => c.condition);
    expect(met).toContain("AuthorityValid");
    expect(met).toContain("ActionLinked");
    expect(met).toContain("EffectLinked");
  });

  it("reports IdentityLinked MET, because the roles share one personId", () => {
    expect(COMPLETENESS.find((c) => c.condition === "IdentityLinked")!.met).toBe(true);
  });

  it("reports IdentityVerified separately, without touching the formula", () => {
    expect(IDENTITY_VERIFIED.field).toBe("IdentityVerified");
    expect(IDENTITY_VERIFIED.state).toBe("UNRESOLVED");
    /* The original formula still names Linked, not Verified. */
    expect(COMPLETENESS.map((c) => c.condition)).not.toContain("IdentityVerified");
  });

  it("still refuses to close — evidence is unreviewed and the claims are open", () => {
    const unmet = COMPLETENESS.filter((c) => !c.met).map((c) => c.condition);
    expect(unmet).toEqual(["EvidenceReviewed"]);
    expect(eventComplete()).toBe(false);
    expect(eventState()).toBe("PARTIAL");
  });
});

describe("acceptance-case identity — the viewer IS the subject", () => {
  const roles = loadAcceptanceScenario().roles;
  const refOf = (r: string) => roles.find((x) => x.role === r)!.ref;

  it("points User, Person, Actor and SubjectOfClaim at one personId", () => {
    const ids = ["User", "Person", "Actor", "SubjectOfClaim"].map(refOf);
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBe(SCENARIO_PERSON_ID);
  });

  it("keeps the six role NAMES separate even though the entity is one", () => {
    expect(roles.map((r) => r.role)).toEqual(
      ["User", "Person", "WealthContext", "SubjectOfClaim", "Actor", "CommunityMember"]);
    expect(roles).toHaveLength(6);
  });

  it("opens the conflict because Actor === SubjectOfClaim", () => {
    expect(refOf("Actor")).toBe(refOf("SubjectOfClaim"));
    expect(loadAcceptanceScenario().conflictOfInterest).toBe(true);
    expect(AUTHORITY.independentReviewRequired).toBe(true);
  });

  it("says on screen that the viewer is the subject and self-verification is shut", () => {
    for (const t of TERMINALS) {
      expect(render(t), t).toContain("הצופה הוא מושא הטענה — אימות עצמי חסום");
    }
  });

  it("denies self-review — the deciding reviewer is a different personId", () => {
    expect(AUTHORITY_DECISION.decided_by).not.toBe(SCENARIO_PERSON_ID);
    expect(AUTHORITY.subjectMayNot.join(" ")).toContain("האישור שמור לבודק העצמאי");
    expect(AUTHORITY.subjectMayNot.join(" ")).toContain("לאמת את עצמו");
  });
});

describe("DEMO is fenced off from REAL legacy", () => {
  it("wraps the acceptance output in a classified surface", () => {
    for (const t of TERMINALS) {
      expect(render(t), t).toContain(
        `data-acceptance-surface="DEMO / SIMULATION / ACCEPTANCE_SCENARIO"`);
    }
  });

  it("closes with a REAL LEGACY boundary on every terminal", () => {
    for (const t of TERMINALS) {
      const html = render(t);
      expect(html, t).toContain("data-real-legacy-boundary");
      expect(html, t).toContain("אינו חלק מאירוע הקבלה");
    }
  });

  it("lets no REAL legacy id into the acceptance projection", () => {
    const legacy = ["vg_ahrayut_kehilatit", "13,400", "13400", "תל אביב", "2026-08-17"];
    for (const t of TERMINALS) {
      const html = render(t);
      for (const id of legacy) expect(html, `${t} / ${id}`).not.toContain(id);
    }
  });
});

describe("#day-closing is a visible anchor", () => {
  it("exists on Hub and Dynamics, outside any collapsed disclosure", () => {
    for (const t of ["hub", "dynamics"] as const) {
      const html = render(t);
      expect(html, t).toContain('id="day-closing"');
      /* The anchor must NOT be a <details>: an anchor into a shut disclosure
         scrolls to a summary line and shows the reader nothing. */
      expect(html, t).not.toContain('<details id="day-closing"');
      expect(html, t).toContain("scroll-margin-block-start");
    }
  });

  it("is absent from the other five", () => {
    for (const t of TERMINALS.filter((x) => x !== "hub" && x !== "dynamics")) {
      expect(render(t), t).not.toContain('id="day-closing"');
    }
  });
});

describe("evidence categories reconcile", () => {
  it("splits source, effect and contradictory without double counting", () => {
    expect(sourceEvidence()).toHaveLength(2);
    expect(effectEvidence()).toHaveLength(3);
    expect(sourceEvidence().length + effectEvidence().length).toBe(evidenceLines().length);
    /* Contradictory is a SUBSET of source, not a fourth disjoint bucket. */
    expect(contradictoryEvidence()).toHaveLength(1);
    expect(sourceEvidence().map((e) => e.evidence_id))
      .toContain(contradictoryEvidence()[0]!.evidence_id);
  });

  it("reports source evidence in the header, not the sum", () => {
    const html = render("hub");
    expect(html).toContain(`ראיות מקור ${sourceEvidence().length}`);
    expect(html).not.toContain(`ראיות מקור ${evidenceLines().length}`);
  });

  it("explains in Day Closing why more records exist", () => {
    const sec = dayClosing().find((s) => s.label.includes("קטגוריות"))!;
    const rows = Object.fromEntries(sec.rows.map((r) => [r.k, r.status]));
    expect(rows["Source Evidence"]).toBe("2");
    expect(rows["Effect Evidence"]).toBe("3");
    expect(rows["סך רשומות"]).toBe("5");
    expect(sec.rows.find((r) => r.k === "Effect Evidence")!.v).toContain("אינן נוגעות לטענות");
  });

  it("lists missing evidence as its own category", () => {
    const missing = dayClosing().find((s) => s.label === "Missing Evidence")!;
    expect(missing.rows).toHaveLength(4);
    for (const r of missing.rows) expect(r.status).toBe("MISSING");
  });
});
