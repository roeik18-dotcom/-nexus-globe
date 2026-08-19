import { describe, expect, it } from "vitest";
import { deriveDomainStateUpdate, buildCapabilityGapSummary, type DomainActionResult, type DomainConstraint, type DomainNeed, type DomainState, type ValueDomainConfigInstance } from "../valueDomainConfig";
import { validateNeed } from "../../canon/need";

const PRIOR: DomainState = { domain_id: "d1", parameter_id: "p1", subject: "s1", level: 1, confidence: 0.8, observed_at: "2026-08-14T10:00:00Z", provenance: "DEMO" };

function result(overrides: Partial<DomainActionResult> = {}): DomainActionResult {
  return {
    result_id: "r1",
    parameter_id: "p1",
    expected_result: "expected",
    time: "2026-08-15T10:00:00Z",
    provenance: "DEMO",
    ...overrides,
  };
}

describe("deriveDomainStateUpdate — advances only on real observed+accepted+evidenced results", () => {
  it("returns null when there is no observed_result at all", () => {
    expect(deriveDomainStateUpdate(PRIOR, result())).toBeNull();
  });

  it("returns null when observed but not accepted", () => {
    expect(deriveDomainStateUpdate(PRIOR, result({ observed_result: "x", accepted: false, evidence: "e" }))).toBeNull();
  });

  it("returns null when accepted but no evidence", () => {
    expect(deriveDomainStateUpdate(PRIOR, result({ observed_result: "x", accepted: true }))).toBeNull();
  });

  it("returns null when the result belongs to a different parameter", () => {
    expect(deriveDomainStateUpdate(PRIOR, result({ parameter_id: "p2", observed_result: "x", accepted: true, evidence: "e" }))).toBeNull();
  });

  it("advances level by exactly 1 when observed_result + accepted + evidence are all real", () => {
    const updated = deriveDomainStateUpdate(PRIOR, result({ observed_result: "x", accepted: true, evidence: "e" }));
    expect(updated).not.toBeNull();
    expect(updated!.level).toBe(2);
    expect(updated!.subject).toBe("s1");
    expect(updated!.evidence).toBe("e");
  });
});

describe("buildCapabilityGapSummary — real, checked per-parameter rows, never one opaque score", () => {
  const config: ValueDomainConfigInstance = {
    domain: { domain_id: "d1", label: "Test Domain", provenance: "DEMO" },
    parameters: [{ parameter_id: "p1", domain_id: "d1", label: "Param One", definition: "test", provenance: "DEMO" }],
    states: [PRIOR],
    capabilities: [{ capability_id: "c1", parameter_id: "p1", label: "cap", status: "developing", provenance: "DEMO" }],
    gaps: [{ gap_id: "g1", parameter_id: "p1", label: "gap", description: "test gap", provenance: "DEMO" }],
    acceptanceCriteria: [],
    actionResults: [],
  };

  it("returns the latest state per parameter for the given subject", () => {
    const summary = buildCapabilityGapSummary(config, "s1");
    expect(summary).toHaveLength(1);
    expect(summary[0].current_level).toBe(1);
    expect(summary[0].capabilities).toHaveLength(1);
    expect(summary[0].gaps).toHaveLength(1);
  });

  it("current_level is null (not 0) for a subject with no real state", () => {
    const summary = buildCapabilityGapSummary(config, "unknown_subject");
    expect(summary[0].current_level).toBeNull();
  });

  it("needs/constraints are optional — a config instance supplying neither remains a valid ValueDomainConfigInstance", () => {
    expect(config.needs).toBeUndefined();
    expect(config.constraints).toBeUndefined();
  });
});

describe("DomainNeed — wraps a full, independently-valid canon Need, no second Need schema", () => {
  it("a domain-scoped Need's own `.need` passes validateNeed() on its own, unmodified", () => {
    const domainNeed: DomainNeed = {
      domain_id: "d1",
      parameter_id: "p1",
      need: {
        need_id: "n1",
        subject: "s1",
        desired_change: "test change",
        scope: { kind: "domain", domain: "C" },
        provenance: "self_reported",
        context: "test",
        time: "2026-08-15T09:00:00+03:00",
        expiry: "2026-09-15T09:00:00+03:00",
        consent_scope: "self",
      },
    };
    expect(validateNeed(domainNeed.need).valid).toBe(true);
  });
});

describe("DomainConstraint — same shape as AcceptanceCriterion, no invented richer object", () => {
  it("is a plain parameter-scoped statement", () => {
    const c: DomainConstraint = { constraint_id: "c1", parameter_id: "p1", statement: "test constraint", provenance: "DEMO" };
    expect(c.statement).toBe("test constraint");
  });
});

describe("buildDemoMusicConfig — the reference instance actually exercises needs/constraints", async () => {
  const { buildDemoMusicConfig } = await import("../demoMusicDomain");

  it("includes a DEMO Need whose .need passes validateNeed()", () => {
    const config = buildDemoMusicConfig("2026-08-16");
    expect(config.needs).toBeDefined();
    expect(config.needs!.length).toBeGreaterThan(0);
    for (const n of config.needs!) expect(validateNeed(n.need).valid).toBe(true);
  });

  it("includes at least one DEMO constraint", () => {
    const config = buildDemoMusicConfig("2026-08-16");
    expect(config.constraints).toBeDefined();
    expect(config.constraints!.length).toBeGreaterThan(0);
  });
});
