/**
 * The channel that was never connected, and the gate that never moved.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { projectSystemEvidence, type EvidenceRecord } from "../systemEvidenceProjection";
import { buildWorldDataContract } from "../worldDataContract";
import { projectSocialSystem } from "../../social/socialSystemProjection";
import type { ChronoEntry } from "../../social/socialChronology";

const entry = (o: Partial<ChronoEntry> & { record_id: string }): ChronoEntry => ({
  layer: "CANON", kind: "effect", at: "2026-08-01T00:00:00Z", label: "l",
  scopes: [], references: [], verification: "VERIFIED", provenance: "REAL", ...o,
} as ChronoEntry);

const ev = (o: Partial<EvidenceRecord> & { effect_id: string }): EvidenceRecord => ({
  evidence_id: `ev_${o.effect_id}`, level: "external_verified", provenance: "REAL", source: "s", ...o,
});

describe("the channel is now structurally impossible to omit", () => {
  it("systemEvidence is a REQUIRED input — omitting it no longer compiles", () => {
    const src = readFileSync("app/lib/philos/social/socialSystemProjection.ts", "utf8");
    // Optional would read `systemEvidence?:`. It must not.
    expect(src).not.toMatch(/systemEvidence\?:/);
    expect(src).toMatch(/systemEvidence: ReadonlyMap/);
    // And no `?? new Map()` fallback that would silently re-create the bug.
    expect(src).not.toMatch(/input\.systemEvidence \?\?/);
  });

  it("the loader actually supplies it", () => {
    const src = readFileSync("app/lib/philos/social/loadSocialSystem.ts", "utf8");
    expect(src).toMatch(/projectSystemEvidence\(/);
    expect(src).toMatch(/systemEvidence: systemEv\.systemEvidence/);
  });
});

describe("the gate did not move", () => {
  it("missing evidence cannot pass", () => {
    const r = projectSystemEvidence([entry({ record_id: "r1" })], []);
    expect(r.systemEvidence.size).toBe(0);
    expect(r.rejections[0].reason).toBe("NO_EVIDENCE_RECORD");
  });

  it("evidence with no level cannot pass", () => {
    const r = projectSystemEvidence([entry({ record_id: "r1" })], [ev({ effect_id: "r1", level: null })]);
    expect(r.systemEvidence.size).toBe(0);
    expect(r.rejections[0].reason).toBe("NOT_VERIFIED");
  });

  it("community verification is real and is NOT system scale", () => {
    const r = projectSystemEvidence([entry({ record_id: "r1" })], [ev({ effect_id: "r1", level: "community_verified" })]);
    expect(r.systemEvidence.size).toBe(0);
    expect(r.rejections[0].reason).toBe("VERIFIED_BUT_NOT_EXTERNAL");
    // It is a candidate, not a failure — stated as such.
    expect(r.unresolvedCandidates).toHaveLength(1);
  });

  it("DEMO can never satisfy REAL eligibility — checked before verification", () => {
    const demoRecord = projectSystemEvidence([entry({ record_id: "r1", provenance: "DEMO" })],
      [ev({ effect_id: "r1", level: "external_verified" })]);
    expect(demoRecord.systemEvidence.size).toBe(0);
    expect(demoRecord.rejections[0].reason).toBe("DEMO_NOT_ELIGIBLE");

    const demoEvidence = projectSystemEvidence([entry({ record_id: "r1" })],
      [ev({ effect_id: "r1", level: "external_verified", provenance: "DEMO" })]);
    expect(demoEvidence.systemEvidence.size).toBe(0);
    expect(demoEvidence.rejections[0].reason).toBe("DEMO_NOT_ELIGIBLE");
  });

  it("reference material describes the world and is not an observation of it", () => {
    const r = projectSystemEvidence([entry({ record_id: "r1", provenance: "REFERENCE" })],
      [ev({ effect_id: "r1" })]);
    expect(r.rejections[0].reason).toBe("REFERENCE_NOT_ELIGIBLE");
  });

  it("externally verified evidence DOES pass, and reaches SYSTEM through the unchanged gate", () => {
    const chron = [entry({ record_id: "r1", verification: "VERIFIED" })];
    const r = projectSystemEvidence(chron, [ev({ effect_id: "r1" })]);
    expect(r.systemEvidence.get("r1")).toBe("ev_r1");

    const [o] = projectSocialSystem({ chronology: chron, needGroups: new Map(), systemEvidence: r.systemEvidence });
    expect(o.scales.SYSTEM.present).toBe(true);
  });

  it("external evidence on an UNVERIFIED record is still refused downstream", () => {
    const chron = [entry({ record_id: "r1", verification: "CLAIMED" })];
    const r = projectSystemEvidence(chron, [ev({ effect_id: "r1" })]);
    expect(r.systemEvidence.size).toBe(1);           // evidence exists…
    const [o] = projectSocialSystem({ chronology: chron, needGroups: new Map(), systemEvidence: r.systemEvidence });
    expect(o.scales.SYSTEM.present).toBe(false);      // …and the record still fails
    expect(o.scales.SYSTEM.absent_because).toBe("NOT_VERIFIED");
  });
});

describe("the World contract keeps provenance apart and states its zero", () => {
  const mixed = [
    entry({ record_id: "a", provenance: "REAL" }),
    entry({ record_id: "b", provenance: "DEMO" }),
    entry({ record_id: "c", provenance: "DEMO" }),
    entry({ record_id: "d", provenance: "REFERENCE" }),
  ];

  it("never produces a combined total that reads as all-real", () => {
    const r = projectSystemEvidence(mixed, []);
    const c = buildWorldDataContract({
      chronology: mixed, systemEvidence: r.systemEvidence, rejections: r.rejections,
      unresolvedCandidates: r.unresolvedCandidates, objects: [], evidence: [],
    });
    expect(c.real_count).toBe(1);
    expect(c.demo_count).toBe(2);
    expect(c.provenance.reference).toBe(1);
    expect(c).not.toHaveProperty("total");
  });

  it("rejection reasons survive into the contract", () => {
    const r = projectSystemEvidence(mixed, []);
    const c = buildWorldDataContract({
      chronology: mixed, systemEvidence: r.systemEvidence, rejections: r.rejections,
      unresolvedCandidates: r.unresolvedCandidates, objects: [], evidence: [],
    });
    expect(c.rejection_reasons.length).toBe(4);
    expect(c.rejection_summary.DEMO_NOT_ELIGIBLE).toBe(2);
    expect(c.rejection_summary.NO_EVIDENCE_RECORD).toBe(1);
  });

  it("a truthful zero names the channel as connected", () => {
    const evs = [{ evidence_id: "e1", effect_id: "a", level: "verified", provenance: "REAL" }];
    const r = projectSystemEvidence(mixed, evs as EvidenceRecord[]);
    const c = buildWorldDataContract({
      chronology: mixed, systemEvidence: r.systemEvidence, rejections: r.rejections,
      unresolvedCandidates: r.unresolvedCandidates, objects: [], evidence: evs,
    });
    expect(c.system_observed_records).toHaveLength(0);
    expect(c.system_zero_reason).toContain("הערוץ מחובר");
    expect(c.system_zero_reason).toContain("0 באימות חיצוני");
  });

  it("every contract array is present even when empty — absent is not a state", () => {
    const c = buildWorldDataContract({
      chronology: [], systemEvidence: new Map(), rejections: [], unresolvedCandidates: [], objects: [], evidence: [],
    });
    for (const k of ["external_events","verified_sources","external_evidence","system_eligible_records",
      "system_observed_records","unresolved_system_candidates","rejection_reasons"] as const) {
      expect(Array.isArray(c[k])).toBe(true);
    }
  });
});
