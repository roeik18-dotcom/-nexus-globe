import { describe, expect, it } from "vitest";

import {
  passesNetworkTruthGate, runNetworkTruthGate, evaluateWorldPromotion,
  type EdgeCandidate,
} from "../networkTruthGate";

const cand = (o: Partial<EdgeCandidate> = {}): EdgeCandidate => ({
  from_entity_id: "p_you", to_entity_id: "vg_1", relation_type: "member.joined",
  source_record_id: "e020", provenance: "REAL", epistemic_status: "CLAIMED", ...o,
});

describe("NETWORK_TRUTH_GATE — the five conditions", () => {
  it("passes an edge with explicit endpoints, supported relation and a source record", () => {
    expect(passesNetworkTruthGate(cand()).ok).toBe(true);
  });

  it("rejects a missing endpoint rather than drawing to nowhere", () => {
    expect(passesNetworkTruthGate(cand({ from_entity_id: "" }))).toMatchObject({ ok: false, reason: "NO_FROM_ENTITY" });
    expect(passesNetworkTruthGate(cand({ to_entity_id: "  " }))).toMatchObject({ ok: false, reason: "NO_TO_ENTITY" });
  });

  it("rejects a self edge", () => {
    expect(passesNetworkTruthGate(cand({ to_entity_id: "p_you" }))).toMatchObject({ ok: false, reason: "SELF_EDGE" });
  });

  it("rejects a relation type not already in the model", () => {
    expect(passesNetworkTruthGate(cand({ relation_type: "SHARES_VALUE" }))).toMatchObject({ ok: false, reason: "UNSUPPORTED_RELATION_TYPE" });
    expect(passesNetworkTruthGate(cand({ relation_type: "SIMILAR_TO" }))).toMatchObject({ ok: false, reason: "UNSUPPORTED_RELATION_TYPE" });
  });

  it("rejects an edge with no backing record", () => {
    expect(passesNetworkTruthGate(cand({ source_record_id: "" }))).toMatchObject({ ok: false, reason: "NO_SOURCE_RECORD" });
  });
});

describe("NETWORK_TRUTH_GATE — membership proves MEMBER_OF and nothing else", () => {
  it("allows membership to back a membership relation", () => {
    expect(passesNetworkTruthGate(cand({ backed_only_by_membership: true, relation_type: "member.joined" })).ok).toBe(true);
    expect(passesNetworkTruthGate(cand({ backed_only_by_membership: true, relation_type: "PERSON_MEMBER_OF_COMMUNITY" })).ok).toBe(true);
  });

  it("refuses to upgrade membership into any other relation", () => {
    for (const rel of ["ACTION_AFFECTS_COMMUNITY", "EFFECT_AFFECTS_COMMUNITY", "COMMUNITY_HAS_NEED"]) {
      expect(passesNetworkTruthGate(cand({ backed_only_by_membership: true, relation_type: rel })))
        .toMatchObject({ ok: false, reason: "MEMBERSHIP_DOES_NOT_IMPLY_THIS" });
    }
  });
});

describe("NETWORK_TRUTH_GATE — derivation integrity", () => {
  it("accepts DERIVED_REAL when every step names a backing record", () => {
    const r = passesNetworkTruthGate(cand({
      relation_type: "EFFECT_AFFECTS_COMMUNITY", provenance: "DERIVED_REAL",
      derivation_steps: [
        { rule: "Effect.action_ref", backed_by: "action_1" },
        { rule: "ACTION_AFFECTS_COMMUNITY", backed_by: "link_1" },
      ],
    }));
    expect(r.ok).toBe(true);
  });

  it("rejects the WHOLE derivation when one step is unbacked", () => {
    expect(passesNetworkTruthGate(cand({
      relation_type: "EFFECT_AFFECTS_COMMUNITY", provenance: "DERIVED_REAL",
      derivation_steps: [{ rule: "Effect.action_ref", backed_by: "action_1" }, { rule: "assumed", backed_by: "" }],
    }))).toMatchObject({ ok: false, reason: "DERIVATION_STEP_UNBACKED" });
  });

  it("rejects DERIVED_REAL with no declared steps", () => {
    expect(passesNetworkTruthGate(cand({ provenance: "DERIVED_REAL" })))
      .toMatchObject({ ok: false, reason: "DERIVATION_STEP_UNBACKED" });
  });

  it("a derivation can never produce VERIFIED", () => {
    expect(passesNetworkTruthGate(cand({
      provenance: "DERIVED_REAL", epistemic_status: "VERIFIED",
      derivation_steps: [{ rule: "r", backed_by: "x" }],
    }))).toMatchObject({ ok: false, reason: "PROVENANCE_UPGRADE_ATTEMPTED" });
  });
});

describe("NETWORK_TRUTH_GATE — report preserves provenance and status exactly", () => {
  it("counts without upgrading anything", () => {
    const rep = runNetworkTruthGate([
      cand({ provenance: "REAL", epistemic_status: "VERIFIED" }),
      cand({ provenance: "DEMO", epistemic_status: "CLAIMED", source_record_id: "d1" }),
      cand({ relation_type: "SHARES_VALUE" }),
    ]);
    expect(rep.candidates).toBe(3);
    expect(rep.passed).toHaveLength(2);
    expect(rep.byProvenance.REAL).toBe(1);
    expect(rep.byProvenance.DEMO).toBe(1);
    expect(rep.byStatus.VERIFIED).toBe(1);
    expect(rep.byReason.UNSUPPORTED_RELATION_TYPE).toBe(1);
  });
});

describe("WORLD promotion — network density is not system relevance", () => {
  it("rejects when no wider-system evidence exists", () => {
    expect(evaluateWorldPromotion({ subject_record_id: "eff_1", epistemic_status: "VERIFIED" }))
      .toMatchObject({ eligible: false, reason: "NO_SYSTEM_EVIDENCE" });
  });

  it("rejects a claimed system effect — claimed is not relevance", () => {
    expect(evaluateWorldPromotion({ subject_record_id: "eff_1", system_evidence_ref: "ref_1", epistemic_status: "CLAIMED" }))
      .toMatchObject({ eligible: false, reason: "NOT_VERIFIED" });
  });

  it("accepts only verified evidence that actually exists", () => {
    expect(evaluateWorldPromotion({ subject_record_id: "eff_1", system_evidence_ref: "ref_1", epistemic_status: "VERIFIED" }))
      .toMatchObject({ eligible: true, evidence_ref: "ref_1" });
  });
});
