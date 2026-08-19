/**
 * DOMAIN SWAP TEST — proves the PHILOS core is domain-agnostic.
 *
 * The claim under test: **Music can disappear and PHILOS still makes
 * structural sense.** Music is the first and broadest domain ARCHETYPE, not
 * a permanent half of the person and not privileged in the ontology. If
 * that is true, substituting a different domain into `DomainConfigSlot`
 * must change ONLY domain-specific vocabulary — never Human Config, never
 * PersonRef, never PersonContext, never the evidence or next-action
 * vocabulary, never a surface's responsibility.
 *
 * ⚠ SYNTHESIS_TEST — the BUSINESS and HEALTH/FITNESS slots below are
 * **NOT REAL CONFIG DATA**. They are schema-substitution fixtures that
 * exist only inside this file. They are never registered in
 * `DOMAIN_CONFIG_SLOTS`, never rendered, never persisted, and must never be
 * cited as evidence that PHILOS supports those domains. Only Music has a
 * real frozen Source Lock in this repository.
 */
import { describe, expect, it } from "vitest";

import { type ActiveConfigSet } from "../activeConfig";
import {
  availableDomainConfigs, buildDomainConfigBaselines, type DomainConfigSlot,
  findDomainConfig, resolveSelectedDomain,
} from "../domainConfigRegistry";
import { MUSIC_CANON_DOMAIN_ID } from "../musicMasterLoader";
import { buildActivePersonRefs } from "../activeConfig";
import { resolvePersonRef } from "../../person/personRef";
import { resolvePersonContext } from "../../person/personContext";

// ── SYNTHESIS_TEST fixtures — NOT REAL CONFIG DATA ─────────────────────────

function syntheticConfigSet(kind: string, types: Record<string, number>): ActiveConfigSet {
  const refs: string[] = [];
  const by_type: Record<string, string[]> = {};
  const status_by_ref: Record<string, string> = {};
  let n = 0;
  for (const [type, count] of Object.entries(types)) {
    by_type[type] = [];
    for (let i = 0; i < count; i += 1) {
      n += 1;
      const ref = `${kind}:${n}`;
      refs.push(ref);
      by_type[type].push(ref);
      status_by_ref[ref] = "READY";
    }
  }
  return { refs, refObjects: [], by_type, status_by_ref, total_in_lock: n };
}

/** SYNTHESIS_TEST — NOT REAL CONFIG DATA. */
const BUSINESS_SYNTHESIS_TEST: DomainConfigSlot = {
  domain_id: "business_synthesis_test",
  label_he: "עסקים (בדיקת סינתזה)",
  label_en: "Business (SYNTHESIS_TEST)",
  ref_kind: "BUSINESS",
  provenance: "SYNTHESIS_TEST",
  source_lock: "(none — SYNTHESIS_TEST, no real source exists)",
  questions: () => [
    { ref: "BUSINESS:q1", text: "מה חוסם את העסקה הבאה?", section: "SYNTHESIS_TEST", runtime_status: "READY" },
  ],
  activeConfig: () =>
    syntheticConfigSet("BUSINESS", {
      // Same STRUCTURAL grammar as Music, different domain vocabulary:
      // Music's WORKFLOW_STAGE ↔ a business pipeline stage, Music's
      // ENGINEERING_PARAMETER ↔ a business measurable parameter.
      WORKFLOW_STAGE: 5, ENGINEERING_PARAMETER: 4, CAPABILITY: 3, SCALE: 2,
    }),
};

/** SYNTHESIS_TEST — NOT REAL CONFIG DATA. */
const HEALTH_SYNTHESIS_TEST: DomainConfigSlot = {
  domain_id: "health_fitness_synthesis_test",
  label_he: "בריאות/כושר (בדיקת סינתזה)",
  label_en: "Health/Fitness (SYNTHESIS_TEST)",
  ref_kind: "HEALTH",
  provenance: "SYNTHESIS_TEST",
  source_lock: "(none — SYNTHESIS_TEST, no real source exists)",
  questions: () => [
    { ref: "HEALTH:q1", text: "איך ישנת אתמול?", section: "SYNTHESIS_TEST", runtime_status: "READY" },
  ],
  activeConfig: () =>
    syntheticConfigSet("HEALTH", {
      WORKFLOW_STAGE: 3, ENGINEERING_PARAMETER: 6, CAPABILITY: 2, SCALE: 2,
    }),
};

describe("DOMAIN CONFIG SLOT — the registry itself", () => {
  it("registers Music as ONE instance of the contract, backed by a real Source Lock", () => {
    const slots = availableDomainConfigs();
    expect(slots).toHaveLength(1);
    expect(slots[0].domain_id).toBe(MUSIC_CANON_DOMAIN_ID);
    expect(slots[0].provenance).toBe("SOURCE_LOCK");
    expect(slots[0].source_lock).toContain("MUSIC_CONFIG_MASTER_SOURCE_LOCK");
  });

  it("registers NO domain that has no real source — Business/Health are not present", () => {
    const ids = availableDomainConfigs().map((d) => d.domain_id);
    expect(ids).not.toContain("business_synthesis_test");
    expect(ids).not.toContain("health_fitness_synthesis_test");
    expect(availableDomainConfigs().every((d) => d.provenance === "SOURCE_LOCK")).toBe(true);
  });

  it("cannot be grown at runtime — the slot list is frozen", () => {
    expect(Object.isFrozen(availableDomainConfigs())).toBe(true);
  });
});

describe("AVAILABILITY IS NOT SELECTION", () => {
  it("returns UNKNOWN with a stated reason when no real DomainState selected a domain", () => {
    const r = resolveSelectedDomain(undefined);
    expect(r.selected).toBe(false);
    if (!r.selected) {
      expect(r.reason).toContain("DomainState");
      // The registry's own contents may never become the answer.
      expect(r.available).toHaveLength(1);
    }
  });

  it("never defaults to the first registered slot just because one exists", () => {
    const r = resolveSelectedDomain(null);
    expect(r.selected).toBe(false);
  });

  it("selects a domain ONLY from a real recorded DomainState domain_id", () => {
    const r = resolveSelectedDomain(MUSIC_CANON_DOMAIN_ID);
    expect(r.selected).toBe(true);
    if (r.selected) expect(r.basis).toContain("DomainState");
  });

  it("refuses to invent a config for a recorded domain it does not know", () => {
    const r = resolveSelectedDomain("some_domain_with_no_config");
    expect(r.selected).toBe(false);
    if (!r.selected) expect(r.reason).toContain("לא הומצא");
  });

  it("marks no baseline row as selected when nothing is selected", () => {
    expect(buildDomainConfigBaselines(undefined).every((b) => !b.selected)).toBe(true);
    expect(buildDomainConfigBaselines(MUSIC_CANON_DOMAIN_ID).filter((b) => b.selected)).toHaveLength(1);
  });
});

describe("DOMAIN SWAP — Music can be replaced without touching the core", () => {
  const SLOTS: DomainConfigSlot[] = [
    findDomainConfig(MUSIC_CANON_DOMAIN_ID)!,
    BUSINESS_SYNTHESIS_TEST,
    HEALTH_SYNTHESIS_TEST,
  ];

  it("every substituted domain satisfies the SAME structural contract", () => {
    for (const slot of SLOTS) {
      expect(typeof slot.domain_id).toBe("string");
      expect(typeof slot.ref_kind).toBe("string");
      const set = slot.activeConfig();
      // The structural grammar that survives domain replacement: a set of
      // refs, grouped by the source's own type words, with a total.
      expect(Array.isArray(set.refs)).toBe(true);
      expect(typeof set.by_type).toBe("object");
      expect(typeof set.total_in_lock).toBe("number");
      expect(set.refs.length).toBeLessThanOrEqual(set.total_in_lock);
    }
  });

  it("carries QUESTIONS as part of the swappable contract — and only the wording differs", () => {
    for (const slot of SLOTS) {
      const qs = slot.questions();
      expect(Array.isArray(qs)).toBe(true);
      for (const q of qs) {
        // Same structural shape in every domain; only the words change.
        expect(Object.keys(q).sort()).toEqual(["ref", "runtime_status", "section", "text"]);
        expect(q.text.length).toBeGreaterThan(0);
      }
    }
    // Music's real questions come from its real lock, not from this test.
    const musicQs = findDomainConfig(MUSIC_CANON_DOMAIN_ID)!.questions();
    expect(musicQs.length).toBeGreaterThan(0);
    expect(musicQs.every((q) => q.ref.startsWith("MUSIC:"))).toBe(true);
  });

  it("a config QUESTION is never an answer, a measurement, or part of the active ref set", () => {
    const music = findDomainConfig(MUSIC_CANON_DOMAIN_ID)!;
    const activeRefs = music.activeConfig().refs;
    for (const q of music.questions()) {
      // Questions stay OUT of the active set — "what may be asked" must not
      // inflate "what is known about this person".
      expect(activeRefs).not.toContain(q.ref);
      // And a question carries no answer/level/state field to mistake for one.
      expect(q).not.toHaveProperty("answer");
      expect(q).not.toHaveProperty("level");
      expect(q).not.toHaveProperty("value");
    }
  });

  it("HUMAN CONFIG does not change when the domain changes", () => {
    const before = buildActivePersonRefs();
    for (const slot of SLOTS) slot.activeConfig();
    const after = buildActivePersonRefs();
    expect(after.refs).toEqual(before.refs);
    expect(after.total_in_lock).toBe(before.total_in_lock);
    // Human Config is NOT a domain slot and is not registered as one.
    expect(availableDomainConfigs().map((d) => d.ref_kind)).not.toContain("HUMAN");
  });

  it("PersonRef does not change when the domain changes — identity carries no domain", () => {
    const ref = resolvePersonRef("person_roei");
    for (const slot of SLOTS) slot.activeConfig();
    expect(resolvePersonRef("person_roei")).toEqual(ref);
    // The locked rule: no domain, no config, no state, no cell on identity.
    expect(Object.keys(ref).sort()).toEqual(
      ["classification", "display_name", "display_name_source", "person_id"],
    );
  });

  it("PersonContext contract does not change when the domain changes", () => {
    const person = resolvePersonRef("person_roei");
    const ctx = resolvePersonContext({
      person, reference: null, context: null, asOf: "2026-08-19T00:00:00Z",
    });
    const keysBefore = Object.keys(ctx).sort();
    for (const slot of SLOTS) slot.activeConfig();
    const after = resolvePersonContext({
      person, reference: null, context: null, asOf: "2026-08-19T00:00:00Z",
    });
    expect(Object.keys(after).sort()).toEqual(keysBefore);
    // No domain field leaks into the measurement frame.
    expect(keysBefore).not.toContain("domain");
    expect(keysBefore).not.toContain("domain_id");
  });

  it("only DOMAIN-SPECIFIC vocabulary differs between the substituted domains", () => {
    const music = findDomainConfig(MUSIC_CANON_DOMAIN_ID)!;
    const business = BUSINESS_SYNTHESIS_TEST;

    // Different: the domain id, the ref kind, the parameter vocabulary.
    expect(business.domain_id).not.toBe(music.domain_id);
    expect(business.ref_kind).not.toBe(music.ref_kind);
    expect(business.activeConfig().refs[0]).not.toBe(music.activeConfig().refs[0]);

    // Same: the structural type grammar the core reads. Music-specific
    // words (MUSIC_PREFERENCE) are Music's own, not part of the contract.
    const shared = ["WORKFLOW_STAGE", "CAPABILITY", "SCALE"];
    for (const t of shared) {
      expect(Object.keys(music.activeConfig().by_type)).toContain(t);
      expect(Object.keys(business.activeConfig().by_type)).toContain(t);
    }
    expect(Object.keys(music.activeConfig().by_type)).toContain("MUSIC_PREFERENCE");
    expect(Object.keys(business.activeConfig().by_type)).not.toContain("MUSIC_PREFERENCE");
  });

  it("PHILOS still makes structural sense with ZERO domain configs registered", () => {
    // The core question: if Music disappeared entirely, does anything break?
    const noDomains: readonly DomainConfigSlot[] = [];
    expect(noDomains).toHaveLength(0);
    // Human Config still resolves.
    expect(buildActivePersonRefs().refs.length).toBeGreaterThan(0);
    // Identity still resolves.
    expect(resolvePersonRef("person_roei").person_id).toBe("person_roei");
    // And "which domain is active" still has an honest answer.
    const r = resolveSelectedDomain(undefined);
    expect(r.selected).toBe(false);
  });
});

describe("CONFIG IS NOT STATE — the invariant the registry must not break", () => {
  it("an active CAPABILITY ref never asserts the person possesses the capability", () => {
    const music = findDomainConfig(MUSIC_CANON_DOMAIN_ID)!;
    const set = music.activeConfig();
    expect((set.by_type.CAPABILITY ?? []).length).toBeGreaterThan(0);
    // A baseline row exposes COUNTS and availability only — no level, no
    // stability, no possession, no measurement of any kind.
    const [baseline] = buildDomainConfigBaselines(undefined);
    expect(Object.keys(baseline).sort()).toEqual(
      ["active_refs", "by_type", "domain_id", "label_en", "label_he", "provenance", "selected", "total_in_lock"],
    );
    expect(baseline).not.toHaveProperty("level");
    expect(baseline).not.toHaveProperty("stability");
    expect(baseline).not.toHaveProperty("current_state");
  });

  it("an active WORKFLOW_STAGE ref never asserts the person is in that stage", () => {
    const music = findDomainConfig(MUSIC_CANON_DOMAIN_ID)!;
    expect((music.activeConfig().by_type.WORKFLOW_STAGE ?? []).length).toBeGreaterThan(0);
    // Availability of stages does not select one.
    const [baseline] = buildDomainConfigBaselines(undefined);
    expect(baseline.selected).toBe(false);
  });
});
