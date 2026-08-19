import { describe, expect, it } from "vitest";

import type { DomainStateRecord } from "../../canon/domainStateStore";
import { buildPersonInstance, buildValueDomainInstance } from "../personInstance";

const SUBJECT = "person_test_instance";
const DOMAIN = "music_canon";

function record(overrides: Partial<DomainStateRecord["state"]>, recorded_at: string): DomainStateRecord {
  return {
    state_id: `st_${recorded_at}`,
    recorded_at,
    state: {
      domain_id: DOMAIN,
      parameter_id: "harmony_practice",
      subject: SUBJECT,
      level: 0,
      confidence: 0.7,
      observed_at: recorded_at,
      provenance: "REAL",
      ...overrides,
    },
  };
}

describe("buildValueDomainInstance / buildPersonInstance", () => {
  it("projects current_state/history/evidence/changed/confidence/timestamp from real DomainState records only", () => {
    const records: DomainStateRecord[] = [
      record({ level: 0, evidence: "first reading" }, "2026-08-14T10:00:00+03:00"),
      record({ level: 1, evidence: "second reading" }, "2026-08-15T10:00:00+03:00"),
    ];

    const instance = buildValueDomainInstance({
      subject_id: SUBJECT,
      domain_id: DOMAIN,
      records,
      source_kind: "CANON",
      source_refs: [{ kind: "MUSIC", source_number: "GEN-MU-PROC-04" }],
      asOf: "2026-08-16T00:00:00+03:00",
    });

    expect(instance.kind).toBe("value_domain");
    expect(instance.subject_id).toBe(SUBJECT);
    expect(instance.domain_id).toBe(DOMAIN);
    expect(instance.source_kind).toBe("CANON");
    expect(instance.source_refs).toEqual(["MUSIC:GEN-MU-PROC-04"]);

    expect(instance.current_state).toHaveLength(1);
    expect(instance.current_state[0]).toMatchObject({ parameter_id: "harmony_practice", level: 1 });

    expect(instance.history).toHaveLength(2);
    expect(instance.history[0].level).toBe(0);
    expect(instance.history[1].level).toBe(1);

    expect(instance.evidence.sort()).toEqual(["first reading", "second reading"]);
    expect(instance.changed).toBe(true);
    expect(instance.confidence).toBe(0.7);
    expect(instance.timestamp).toBe("2026-08-15T10:00:00+03:00");
  });

  it("changed is false when only one real reading exists", () => {
    const records: DomainStateRecord[] = [record({ level: 3 }, "2026-08-14T10:00:00+03:00")];
    const instance = buildPersonInstance({
      subject_id: SUBJECT, domain_id: DOMAIN, records, source_kind: "CANON", source_refs: [], asOf: "2026-08-16T00:00:00+03:00",
    });
    expect(instance.kind).toBe("person");
    expect(instance.changed).toBe(false);
  });

  it("is honestly empty (never fabricated) when the subject has no real readings in this domain", () => {
    const instance = buildValueDomainInstance({
      subject_id: SUBJECT, domain_id: DOMAIN, records: [], source_kind: "CANON", source_refs: [], asOf: "2026-08-16T00:00:00+03:00",
    });
    expect(instance.current_state).toEqual([]);
    expect(instance.history).toEqual([]);
    expect(instance.evidence).toEqual([]);
    expect(instance.confidence).toBe(0);
    expect(instance.changed).toBe(false);
    expect(instance.timestamp).toBe("2026-08-16T00:00:00+03:00");
  });

  it("never carries a SOURCE_TEXT field anywhere on the built instance", () => {
    const records: DomainStateRecord[] = [record({ level: 1, evidence: "x" }, "2026-08-14T10:00:00+03:00")];
    const instance = buildValueDomainInstance({
      subject_id: SUBJECT, domain_id: DOMAIN, records, source_kind: "CANON",
      source_refs: [{ kind: "MUSIC", source_number: "GEN-MU-PROC-04" }], asOf: "2026-08-16T00:00:00+03:00",
    });
    expect(JSON.stringify(instance)).not.toContain("SOURCE_TEXT");
  });

  it("ignores readings from a different domain_id for the same subject", () => {
    const records: DomainStateRecord[] = [
      record({ level: 5, domain_id: "some_other_domain", parameter_id: "x" }, "2026-08-14T10:00:00+03:00"),
    ];
    const instance = buildValueDomainInstance({
      subject_id: SUBJECT, domain_id: DOMAIN, records, source_kind: "CANON", source_refs: [], asOf: "2026-08-16T00:00:00+03:00",
    });
    expect(instance.current_state).toEqual([]);
  });
});
