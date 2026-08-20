import { describe, expect, it } from "vitest";

import { roleTouchOf, noRoleReason } from "../roleTouch";

const roles = (k: string, v: "VERIFIED" | "CLAIMED" | "UNKNOWN" = "CLAIMED") =>
  roleTouchOf(k, v).map((r) => r.role).sort();

describe("roleTouch — RED is action, and only action", () => {
  it("an Action and a measured Effect activate RED", () => {
    expect(roles("action")).toContain("RED");
    expect(roles("effect")).toContain("RED");
  });

  it("a Need does NOT activate RED — a need is not an action", () => {
    expect(roles("need")).toEqual([]);
    expect(noRoleReason("need")).toBeTruthy();
  });

  it("an Offer activates nothing", () => {
    expect(roles("offer")).toEqual([]);
  });
});

describe("roleTouch — WHITE is evidence, not a claim", () => {
  it("a VERIFIED record carries evidence", () => {
    expect(roles("effect", "VERIFIED")).toEqual(["RED", "WHITE"]);
  });

  it("a CLAIMED effect activates RED alone — claimed is not evidence", () => {
    expect(roles("effect", "CLAIMED")).toEqual(["RED"]);
    expect(roles("effect", "UNKNOWN")).toEqual(["RED"]);
  });

  it("an observation is reference even when unverified", () => {
    expect(roles("observation")).toEqual(["WHITE"]);
  });
});

describe("roleTouch — GREEN needs a documented relation", () => {
  it("membership and appointment activate GREEN", () => {
    expect(roles("member.joined")).toEqual(["GREEN"]);
    expect(roles("leader.appointed")).toEqual(["GREEN"]);
  });

  it("membership activates GREEN ONLY — never RED or WHITE", () => {
    const r = roles("member.joined", "VERIFIED");
    expect(r).toContain("GREEN");
    expect(r).not.toContain("RED");
  });

  it("a transfer is a documented relation", () => {
    expect(roles("transfer.completed")).toContain("GREEN");
  });
});

describe("roleTouch — PURPLE is never activated by a record", () => {
  it("no kind, at any verification, lights PURPLE", () => {
    const kinds = ["action", "effect", "need", "offer", "observation", "member.joined", "leader.appointed", "group.opened", "transfer.completed"];
    for (const k of kinds) {
      for (const v of ["VERIFIED", "CLAIMED", "UNKNOWN"] as const) {
        expect(roleTouchOf(k, v).map((r) => r.role)).not.toContain("PURPLE");
      }
    }
  });
});

describe("roleTouch — every activation states its reason", () => {
  it("no activation is returned without a because", () => {
    for (const k of ["action", "effect", "observation", "member.joined"]) {
      for (const a of roleTouchOf(k, "VERIFIED")) expect(a.because.trim()).not.toBe("");
    }
  });
});
