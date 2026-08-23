import { describe, expect, it } from "vitest";

import { projectSocialSystem, findObject, atScaleObjects } from "../socialSystemProjection";
import { resolveSocialSelection, withSelection } from "../socialSelection";
import type { ChronoEntry } from "../socialChronology";

const entry = (o: Partial<ChronoEntry>): ChronoEntry => ({
  record_id: "r1", layer: "CANON", kind: "effect", at: "2026-08-16T18:30:00+03:00",
  label: "x", scopes: ["GROUP"], references: [], verification: "CLAIMED", provenance: "REAL", ...o,
});

describe("SOCIAL_SYSTEM_PROJECTION — one identity, three representations", () => {
  it("keeps ONE record_id across all scales", () => {
    const [o] = projectSocialSystem({ chronology: [entry({ record_id: "same_id" })], needGroups: new Map(), systemEvidence: new Map() });
    expect(o.record_id).toBe("same_id");
    expect(Object.keys(o.scales).sort()).toEqual(["GROUP", "NETWORK", "SYSTEM"]);
  });

  it("every record is present at GROUP — that is the operational state", () => {
    const objs = projectSocialSystem({
      chronology: [entry({ record_id: "a" }), entry({ record_id: "b", kind: "need" })],
      needGroups: new Map(), systemEvidence: new Map(),
    });
    expect(atScaleObjects(objs, "GROUP")).toHaveLength(2);
  });
});

describe("NETWORK promotion — edges only", () => {
  it("an edge kind reaches NETWORK", () => {
    const [o] = projectSocialSystem({ chronology: [entry({ kind: "member.joined" })], needGroups: new Map(), systemEvidence: new Map() });
    expect(o.scales.NETWORK.present).toBe(true);
  });

  it("a non-edge is absent WITH A REASON, not merely missing", () => {
    const [o] = projectSocialSystem({ chronology: [entry({ kind: "effect" })], needGroups: new Map(), systemEvidence: new Map() });
    expect(o.scales.NETWORK.present).toBe(false);
    expect(o.scales.NETWORK.absent_because).toBe("NOT_AN_EDGE");
  });

  it("a Need reaches NETWORK only with an explicit group attachment", () => {
    const bare = projectSocialSystem({ chronology: [entry({ record_id: "n1", kind: "need" })], needGroups: new Map(), systemEvidence: new Map() })[0];
    expect(bare.scales.NETWORK.present).toBe(false);
    expect(bare.scales.NETWORK.absent_because).toBe("NO_GROUP_ATTACHMENT");

    const attached = projectSocialSystem({
      chronology: [entry({ record_id: "n1", kind: "need" })],
      systemEvidence: new Map(), needGroups: new Map([["n1", "vg_1"]]),
    })[0];
    expect(attached.scales.NETWORK.present).toBe(true);
  });
});

describe("SYSTEM promotion — network presence is never a reason", () => {
  it("an edge present at NETWORK is still absent at SYSTEM", () => {
    const [o] = projectSocialSystem({ chronology: [entry({ kind: "member.joined" })], needGroups: new Map(), systemEvidence: new Map() });
    expect(o.scales.NETWORK.present).toBe(true);
    expect(o.scales.SYSTEM.present).toBe(false);
    expect(o.scales.SYSTEM.absent_because).toBe("NO_SYSTEM_EVIDENCE");
  });

  it("evidence that exists but is not VERIFIED does not promote", () => {
    const [o] = projectSocialSystem({
      chronology: [entry({ record_id: "e1", verification: "CLAIMED" })],
      needGroups: new Map(), systemEvidence: new Map([["e1", "ref_1"]]),
    });
    expect(o.scales.SYSTEM.present).toBe(false);
    expect(o.scales.SYSTEM.absent_because).toBe("NOT_VERIFIED");
  });

  it("promotes only with its own verified evidence", () => {
    const [o] = projectSocialSystem({
      chronology: [entry({ record_id: "e1", verification: "VERIFIED" })],
      needGroups: new Map(), systemEvidence: new Map([["e1", "ref_1"]]),
    });
    expect(o.scales.SYSTEM.present).toBe(true);
  });
});

describe("SOCIAL_SELECTION_STATE — the same object across scales", () => {
  const objs = projectSocialSystem({ chronology: [entry({ record_id: "r1" })], needGroups: new Map(), systemEvidence: new Map() });

  it("resolves to the one object", () => {
    expect(resolveSocialSelection("r1", objs)).toMatchObject({ status: "resolved", record_id: "r1" });
  });

  it("reports UNRESOLVED rather than silently dropping a dead link", () => {
    expect(resolveSocialSelection("gone", objs)).toMatchObject({ status: "unresolved", record_id: "gone" });
  });

  it("no selection is none", () => {
    expect(resolveSocialSelection(undefined, objs)).toMatchObject({ status: "none" });
  });

  it("carries the selection to another scale's href", () => {
    expect(withSelection("/planet", "r1")).toBe("/planet?sel=r1");
    expect(withSelection("/planet?ctx=x", "r1")).toBe("/planet?ctx=x&sel=r1");
    expect(withSelection("/planet", undefined)).toBe("/planet");
  });
});

describe("provenance and verification survive projection unchanged", () => {
  it("does not upgrade CLAIMED to VERIFIED", () => {
    const [o] = projectSocialSystem({ chronology: [entry({ verification: "CLAIMED" })], needGroups: new Map(), systemEvidence: new Map() });
    expect(o.verification).toBe("CLAIMED");
  });

  it("carries only RECORDED references, never chronological neighbours", () => {
    const objs = projectSocialSystem({
      chronology: [entry({ record_id: "a", references: [] }), entry({ record_id: "b", references: ["a"] })],
      needGroups: new Map(), systemEvidence: new Map(),
    });
    expect(findObject(objs, "a")!.source_record_ids).toEqual([]);
    expect(findObject(objs, "b")!.source_record_ids).toEqual(["a"]);
  });
});


describe("PROVENANCE IS PRESERVED, NEVER PROMOTED", () => {
  // Regression for a dead ternary: `e.layer === "CANON" ? "REAL" : "REAL"`.
  // Both branches were identical, so every object became REAL no matter its
  // source. It read like a decision, which is why review never caught it.
  const project = (over: Partial<ChronoEntry>) =>
    projectSocialSystem({ chronology: [entry(over)], needGroups: new Map(), systemEvidence: new Map() })[0];

  it("DEMO never becomes REAL", () => {
    expect(project({ provenance: "DEMO" }).provenance).toBe("DEMO");
    expect(project({ provenance: "DEMO", layer: "CANON" }).provenance).toBe("DEMO");
  });

  it("REFERENCE never becomes REAL", () => {
    expect(project({ provenance: "REFERENCE" }).provenance).toBe("REFERENCE");
    expect(project({ provenance: "REFERENCE", layer: "CANON" }).provenance).toBe("REFERENCE");
  });

  it("UNKNOWN never becomes REAL", () => {
    expect(project({ provenance: "UNKNOWN" }).provenance).toBe("UNKNOWN");
    expect(project({ provenance: "UNKNOWN", layer: "CANON" }).provenance).toBe("UNKNOWN");
  });

  it("REAL remains REAL", () => {
    expect(project({ provenance: "REAL" }).provenance).toBe("REAL");
  });

  it("the LAYER never decides provenance — same layer, four different results", () => {
    const layer = "CANON" as const;
    expect(project({ layer, provenance: "REAL" }).provenance).toBe("REAL");
    expect(project({ layer, provenance: "DEMO" }).provenance).toBe("DEMO");
    expect(project({ layer, provenance: "REFERENCE" }).provenance).toBe("REFERENCE");
    expect(project({ layer, provenance: "UNKNOWN" }).provenance).toBe("UNKNOWN");
  });

  it("no input yields a provenance the record did not carry", () => {
    for (const p of ["REAL", "DEMO", "REFERENCE", "UNKNOWN"] as const) {
      for (const layer of ["CANON", "EVENT_LOG"] as const) {
        for (const kind of ["need", "effect", "member.joined"]) {
          expect(project({ provenance: p, layer, kind }).provenance).toBe(p);
        }
      }
    }
  });
});
