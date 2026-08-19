/**
 * Synthetic fixtures only — this module is not exercised against any
 * real subject/parameter this pass (see the module's own header for why:
 * no real source-backed question exists for any of the 7 verified
 * measurable Human parameters, checked directly against the real
 * source).
 */
import { describe, expect, it } from "vitest";
import { deriveParameterStateUpdate, type ParameterObservation, type SubjectResponse } from "../parameterAcquisition";

function response(overrides: Partial<SubjectResponse> = {}): SubjectResponse {
  return {
    subject_id: "test_subject",
    source_item_id: "SRC-TEST-1",
    canonical_parameter_id: "CAN-TEST-1",
    answer: "test answer",
    context: "test",
    timestamp: "2026-08-16T10:00:00Z",
    provenance: "SELF_DECLARED",
    consent: true,
    ...overrides,
  };
}

function observation(overrides: Partial<ParameterObservation> = {}): ParameterObservation {
  return {
    subject_id: "test_subject",
    canonical_parameter_id: "CAN-TEST-1",
    observed_value: "HIGH",
    context: "test",
    timestamp: "2026-08-16T10:00:01Z",
    source: "test-source",
    evidence_type: "SELF_DECLARED",
    response_id: "SRC-TEST-1",
    ...overrides,
  };
}

describe("deriveParameterStateUpdate — one response/Observation never automatically becomes a durable trait", () => {
  it("no consent -> INSUFFICIENT_EVIDENCE, never a state update", () => {
    const result = deriveParameterStateUpdate({ response: response({ consent: false }), observation: observation(), previousState: null });
    expect(result.kind).toBe("insufficient_evidence");
  });

  it("empty observed_value -> INSUFFICIENT_EVIDENCE", () => {
    const result = deriveParameterStateUpdate({ response: response(), observation: observation({ observed_value: "" }), previousState: null });
    expect(result.kind).toBe("insufficient_evidence");
  });

  it("HYPOTHESIS evidence alone never updates state", () => {
    const result = deriveParameterStateUpdate({ response: response(), observation: observation({ evidence_type: "HYPOTHESIS" }), previousState: null });
    expect(result.kind).toBe("insufficient_evidence");
  });

  it("consent + real observed_value + non-HYPOTHESIS evidence -> STATE_UPDATED, with real provenance carried through", () => {
    const result = deriveParameterStateUpdate({ response: response(), observation: observation(), previousState: null });
    expect(result.kind).toBe("state_updated");
    if (result.kind === "state_updated") {
      expect(result.new_state).toBe("HIGH");
      expect(result.previous_state).toBeNull();
      expect(result.evidence_ids).toEqual(["SRC-TEST-1"]);
    }
  });

  it("SELF_DECLARED evidence yields lower confidence than DIRECT_OBSERVATION — never a fabricated high-confidence claim from a single self-report", () => {
    const selfDeclared = deriveParameterStateUpdate({ response: response(), observation: observation({ evidence_type: "SELF_DECLARED" }), previousState: null });
    const direct = deriveParameterStateUpdate({ response: response(), observation: observation({ evidence_type: "DIRECT_OBSERVATION" }), previousState: null });
    if (selfDeclared.kind === "state_updated" && direct.kind === "state_updated") {
      expect(selfDeclared.confidence).toBeLessThan(direct.confidence);
    } else {
      throw new Error("expected both to update");
    }
  });
});
