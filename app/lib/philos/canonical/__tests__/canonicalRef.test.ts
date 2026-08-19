import { describe, expect, it } from "vitest";

import { formatCanonicalRef, parseCanonicalRef, resolveCanonicalRef } from "../canonicalRef";

describe("CanonicalRef format/parse", () => {
  it("formats and parses HUMAN/MUSIC/COLOR refs round-trip", () => {
    for (const ref of [
      { kind: "HUMAN" as const, source_number: "12" },
      { kind: "MUSIC" as const, source_number: "GEN-MU-PROC-04" },
      { kind: "COLOR" as const, source_number: "0" },
    ]) {
      const formatted = formatCanonicalRef(ref);
      expect(parseCanonicalRef(formatted)).toEqual(ref);
    }
  });

  it("rejects an unrecognized kind, empty body, or malformed string", () => {
    expect(parseCanonicalRef("PLANET:5")).toBeNull();
    expect(parseCanonicalRef("HUMAN:")).toBeNull();
    expect(parseCanonicalRef("not-a-ref")).toBeNull();
    expect(parseCanonicalRef("")).toBeNull();
  });
});

describe("resolveCanonicalRef", () => {
  it("resolves a real HUMAN:<SOURCE_NUMBER> ref as CANON, with no SOURCE_TEXT field", () => {
    const r = resolveCanonicalRef("HUMAN:12");
    expect(r.status).toBe("resolved");
    if (r.status === "resolved") {
      expect(r.source_kind).toBe("CANON");
      expect(r).not.toHaveProperty("SOURCE_TEXT");
      expect(JSON.stringify(r)).not.toContain("SOURCE_TEXT");
    }
  });

  it("resolves a real MUSIC:<SOURCE_NUMBER> ref", () => {
    const r = resolveCanonicalRef("MUSIC:GEN-MU-PROC-04");
    expect(r.status).toBe("resolved");
    if (r.status === "resolved") {
      expect(r.source_kind).toBe("CANON");
      expect(r.ref.kind).toBe("MUSIC");
    }
  });

  it("resolves COLOR:0 (White) and surfaces its OPEN conflict_status", () => {
    const r = resolveCanonicalRef("COLOR:0");
    expect(r.status).toBe("resolved");
    if (r.status === "resolved") {
      expect(r.conflict_status).toBe("OPEN");
    }
  });

  it("resolves COLOR:6 with no conflict", () => {
    const r = resolveCanonicalRef("COLOR:6");
    expect(r.status).toBe("resolved");
    if (r.status === "resolved") {
      expect(r.conflict_status).toBeNull();
    }
  });

  it("returns not_found for a well-formed ref whose id does not exist", () => {
    const r = resolveCanonicalRef("HUMAN:99999999");
    expect(r.status).toBe("not_found");
  });

  it("returns invalid for a malformed ref string", () => {
    const r = resolveCanonicalRef("garbage");
    expect(r.status).toBe("invalid");
  });
});
