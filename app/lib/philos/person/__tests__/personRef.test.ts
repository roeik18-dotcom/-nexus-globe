import { describe, expect, it } from "vitest";
import { USER_A, USER_B } from "@/app/lib/philos/identity/__tests__/viewerFixtures";
import { resolvePersonRef, type PersonRef } from "../personRef";
import { REAL_CURRENT_SUBJECT } from "../../subjectRegistry";

describe("resolvePersonRef — the ONE identity resolver (PHILOS-PERSON-CONTRACT.md §1)", () => {
  it("no request -> the designated real subject, classified real", () => {
    const ref = resolvePersonRef(USER_A);
    expect(ref.person_id).toBe(REAL_CURRENT_SUBJECT);
    expect(ref.person_id).toBe("person_roei");
    expect(ref.classification).toBe("real");
  });

  /* BEHAVIOUR CHANGE, DELIBERATE. This test used to assert that any
     `?subject=` was honoured verbatim. That WAS the contract, and it is the
     hole: six pages passed the raw query value in, so a URL chose whose
     records the whole page read. A viewer reads their own subject; naming
     anyone else throws rather than rendering, and rather than quietly
     narrowing to the viewer under the name that was asked for. */
  it("a `?subject=` naming the viewer is honoured", () => {
    expect(resolvePersonRef(USER_A, "person_roei").person_id).toBe("person_roei");
    expect(resolvePersonRef(USER_A, "p_you").person_id).toBe("p_you");
  });

  it("a `?subject=` naming ANYONE ELSE throws — it never falls back to the viewer", () => {
    expect(() => resolvePersonRef(USER_A, "person_e2e")).toThrow(/not readable by viewer/);
    expect(() => resolvePersonRef(USER_A, "person_bet")).toThrow(/not readable by viewer/);
    expect(() => resolvePersonRef(USER_B, "person_roei")).toThrow(/not readable by viewer/);
  });

  it("a non-string searchParam (array / undefined) falls back to the real subject", () => {
    expect(resolvePersonRef(USER_A, undefined).person_id).toBe(REAL_CURRENT_SUBJECT);
    expect(resolvePersonRef(USER_A, ["a", "b"]).person_id).toBe(REAL_CURRENT_SUBJECT);
  });

  it("an explicit empty `?subject=` passes through as \"\" — NOT silently defaulted", () => {
    // Mirrors the pre-existing two-step exactly. Trimming it to the default
    // would be a behaviour change this pass must not make.
    expect(resolvePersonRef(USER_A, "").person_id).toBe("");
  });

  it("classification is never guessed into `real` for an unknown id", () => {
    // Classification is a property of the id, tested through the ONE id this
    // viewer may resolve; the unreadable ids above can no longer reach it.
    expect(resolvePersonRef(USER_A).classification).toBe("real");
    expect(resolvePersonRef(USER_B).classification).not.toBe("real");
  });

  it("display_name is UNKNOWN for a canon subject and is NEVER derived from person_id", () => {
    const ref = resolvePersonRef(USER_A);
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
    expect(resolvePersonRef(USER_A).display_name).not.toBe("את/ה");
  });

  it("carries NO state, level, value, domain, config or cell field", () => {
    const ref = resolvePersonRef(USER_A);
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
    const a = resolvePersonRef(USER_A, "person_roei");
    const b = resolvePersonRef(USER_A, "person_roei");
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
