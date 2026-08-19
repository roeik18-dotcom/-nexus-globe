import { describe, expect, it } from "vitest";
import { resolvePersonRef, type PersonRef } from "../personRef";
import { REAL_CURRENT_SUBJECT } from "../../subjectRegistry";

describe("resolvePersonRef — the ONE identity resolver (PHILOS-PERSON-CONTRACT.md §1)", () => {
  it("no request -> the designated real subject, classified real", () => {
    const ref = resolvePersonRef();
    expect(ref.person_id).toBe(REAL_CURRENT_SUBJECT);
    expect(ref.person_id).toBe("person_roei");
    expect(ref.classification).toBe("real");
  });

  it("a real `?subject=` is honoured verbatim — Hub/Brain behaviour preserved", () => {
    expect(resolvePersonRef("person_e2e").person_id).toBe("person_e2e");
    expect(resolvePersonRef("person_e2e").classification).toBe("test");
  });

  it("a non-string searchParam (array / undefined) falls back to the real subject", () => {
    expect(resolvePersonRef(undefined).person_id).toBe(REAL_CURRENT_SUBJECT);
    expect(resolvePersonRef(["a", "b"]).person_id).toBe(REAL_CURRENT_SUBJECT);
  });

  it("an explicit empty `?subject=` passes through as \"\" — NOT silently defaulted", () => {
    // Mirrors the pre-existing two-step exactly. Trimming it to the default
    // would be a behaviour change this pass must not make.
    expect(resolvePersonRef("").person_id).toBe("");
  });

  it("classification is never guessed into `real` for an unknown id", () => {
    expect(resolvePersonRef("person_never_seen").classification).toBe("test");
    expect(resolvePersonRef("demo_someone").classification).toBe("demo");
    expect(resolvePersonRef("merlin_connectivity_test_person").classification).toBe("system");
  });

  it("display_name is UNKNOWN for a canon subject and is NEVER derived from person_id", () => {
    const ref = resolvePersonRef();
    expect(ref.display_name).toBeUndefined();
    expect(ref.display_name_source).toBe("none");
    // the id must not leak into a human-readable name
    expect(ref.display_name).not.toBe("person_roei");
    expect(ref.display_name).not.toBe("roei");
    expect(ref.display_name).not.toBe("רואי");
  });

  it("the viewer's name is NOT copied onto the subject — two identities stay separate", () => {
    // "את/ה" belongs to CURRENT_VIEWER (p_you), resolved through
    // projectViewerIdentity. It must never appear on a PersonRef.
    expect(resolvePersonRef().display_name).not.toBe("את/ה");
  });

  it("carries NO state, level, value, domain, config or cell field", () => {
    const ref = resolvePersonRef();
    const allowed = ["person_id", "classification", "display_name", "display_name_source"];
    expect(Object.keys(ref).sort()).toEqual([...allowed].sort());
    for (const forbidden of [
      "level", "stability", "state", "current_state", "cells", "cell", "observed_count",
      "domain", "frame", "value", "config", "source_refs", "score", "tension", "need",
    ]) {
      expect(Object.keys(ref)).not.toContain(forbidden);
    }
  });

  it("is pure — same input, same output, no hidden read", () => {
    const a = resolvePersonRef("person_roei");
    const b = resolvePersonRef("person_roei");
    expect(a).toEqual(b);
  });

  it("the type admits only identity fields (compile-time guard)", () => {
    const ref: PersonRef = {
      person_id: "person_x",
      classification: "test",
      display_name_source: "none",
    };
    expect(ref.person_id).toBe("person_x");
  });
});
