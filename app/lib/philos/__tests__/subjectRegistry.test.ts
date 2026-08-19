import { describe, expect, it } from "vitest";
import { classifySubject, isNormalModeSubject, REAL_CURRENT_SUBJECT } from "../subjectRegistry";

describe("classifySubject — real, checked classification of every known subject", () => {
  it("REAL_CURRENT_SUBJECT classifies as real", () => {
    expect(classifySubject(REAL_CURRENT_SUBJECT)).toBe("real");
  });

  it("the 4 real known test/placeholder/system subjects classify correctly", () => {
    expect(classifySubject("merlin_connectivity_test_person")).toBe("system");
    expect(classifySubject("person_e2e")).toBe("test");
    expect(classifySubject("person_live_e2e")).toBe("test");
    expect(classifySubject("person_qa_natural_philos_PLACEHOLDER")).toBe("placeholder");
  });

  it("an unrecognized subject never silently classifies as real", () => {
    expect(classifySubject("some_totally_unknown_id")).not.toBe("real");
  });

  it("DEMO-prefixed ids classify as demo", () => {
    expect(classifySubject("dg_lior")).toBe("demo");
    expect(classifySubject("demo_music_subject")).toBe("demo");
  });
});

describe("isNormalModeSubject — REAL and DEMO only", () => {
  it("REAL_CURRENT_SUBJECT is normal-mode visible", () => {
    expect(isNormalModeSubject(REAL_CURRENT_SUBJECT)).toBe(true);
  });

  it("test/placeholder/system subjects are excluded from normal mode", () => {
    expect(isNormalModeSubject("person_e2e")).toBe(false);
    expect(isNormalModeSubject("person_qa_natural_philos_PLACEHOLDER")).toBe(false);
    expect(isNormalModeSubject("merlin_connectivity_test_person")).toBe(false);
  });

  it("demo subjects are normal-mode visible (they are explicitly labeled DEMO in the UI, not hidden)", () => {
    expect(isNormalModeSubject("dg_lior")).toBe(true);
  });
});
