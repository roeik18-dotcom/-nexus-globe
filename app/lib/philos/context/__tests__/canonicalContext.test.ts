/**
 * ONE ANSWER, SEVEN TERMINALS.
 *
 * The resolver takes a ViewerContext and nothing else — no surface, no route,
 * no selection — so "the same for every terminal" is a property of the
 * signature rather than of discipline. These tests assert that property AND
 * the specific truths the audit uncovered, so a future edit that puts a group
 * value back into the person slot fails here.
 */
import { describe, expect, it } from "vitest";

import { resolveViewerContextSemantics } from "../resolveViewerContextSemantics";
import { USER_A, USER_B } from "../../identity/__tests__/viewerFixtures";
import type { ResolvedViewerContext } from "../resolvedViewerContext";

const SURFACES = ["hub", "brain", "community", "globe", "world", "dynamics", "marketplace"];

const semantic = (c: ResolvedViewerContext) => ({
  PERSON: c.subject_id,
  ACTIVE_DOMAIN: c.active_domain.value ?? c.active_domain.status,
  VALUE: c.personal_value.value ?? c.personal_value.status,
  PROJECT: c.project.value ?? c.project.status,
  REFERENCE: c.reference.value ?? c.reference.status,
  REFERENCE_GROUP: c.reference_group.value ?? c.reference_group.status,
});

describe("CANONICAL VIEWER CONTEXT — one answer for every terminal", () => {
  it("all seven surfaces receive an identical semantic result", async () => {
    const results = await Promise.all(SURFACES.map(() => resolveViewerContextSemantics(USER_A)));
    const first = JSON.stringify(semantic(results[0]));
    for (const r of results) expect(JSON.stringify(semantic(r))).toBe(first);
  });

  it("the resolver cannot be told which surface it is on", () => {
    /* `.length` was the wrong probe — an optional parameter still counts, so
       it measured arity rather than the property that matters. Read the
       signature instead: the only inputs are a viewer and an as-of clock.
       There is no surface, route, selection or community parameter, so a
       caller has no channel through which navigation state could arrive. */
    const src = resolveViewerContextSemantics.toString();
    const params = src.slice(src.indexOf("(") + 1, src.indexOf(")"));
    expect(params).toContain("viewer");
    for (const forbidden of ["surface", "route", "path", "selected", "community", "params"]) {
      expect(params).not.toContain(forbidden);
    }
  });

  it("a GROUP value never becomes the PERSON's value", async () => {
    const a = await resolveViewerContextSemantics(USER_A);
    expect(a.group_values.map((g) => g.label)).toContain("אחריות");
    // Authoring a group's declaration is not holding the value.
    expect(a.group_values[0].declared_by).toBe("person_roei");
    expect(a.personal_value.value).toBeNull();
    expect(a.personal_value.status).toBe("UNKNOWN");
  });

  it("REFERENCE resolves from the viewer's own observation", async () => {
    const a = await resolveViewerContextSemantics(USER_A);
    expect(a.reference.status).toBe("RESOLVED");
    expect(a.reference.value).toBe("self_baseline");
    expect(a.reference.evidence.length).toBeGreaterThan(0);
  });

  it("PROJECT and REFERENCE GROUP stay UNKNOWN and say why", async () => {
    const a = await resolveViewerContextSemantics(USER_A);
    for (const f of [a.project, a.reference_group]) {
      expect(f.value).toBeNull();
      expect(f.status).toBe("UNKNOWN");
      expect(f.because.length).toBeGreaterThan(10);
    }
  });

  it("every field carries a reason, resolved or not", async () => {
    const a = await resolveViewerContextSemantics(USER_A);
    for (const f of [a.personal_value, a.active_domain, a.project, a.reference, a.reference_group]) {
      expect(f.because.trim()).not.toBe("");
      if (f.status === "UNKNOWN" || f.status === "CONFLICTING") expect(f.value).toBeNull();
    }
  });

  it("USER B inherits nothing of A's context", async () => {
    const b = await resolveViewerContextSemantics(USER_B);
    expect(b.subject_id).toBe("person_bet");
    expect(b.personal_value.value).toBeNull();
    expect(b.reference.value).toBeNull();
    expect(b.active_domain.value).toBeNull();
    expect(b.project.value).toBeNull();
    expect(b.reference_group.value).toBeNull();
    expect(b.group_values).toEqual([]);
  });

  it("B's UNKNOWN is a real answer, not A's data withheld", async () => {
    const [a, b] = await Promise.all([
      resolveViewerContextSemantics(USER_A),
      resolveViewerContextSemantics(USER_B),
    ]);
    expect(a.reference.value).toBe("self_baseline");
    expect(b.reference.value).toBeNull();
    for (const leak of ["self_baseline", "אחריות", "person_roei", "vg_ahrayut"]) {
      expect(JSON.stringify(b)).not.toContain(leak);
    }
  });

  it("DEMO material never becomes viewer context", async () => {
    for (const v of [USER_A, USER_B]) {
      const c = await resolveViewerContextSemantics(v);
      expect(JSON.stringify(c)).not.toMatch(/demo_|dg_|"DEMO"/);
    }
  });
});
