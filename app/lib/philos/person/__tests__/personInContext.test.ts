import { describe, expect, it } from "vitest";
import { USER_A } from "@/app/lib/philos/identity/__tests__/viewerFixtures";
import { buildPersonInContext } from "../personInContext";
import { resolvePersonContext } from "../personContext";
import { resolvePersonRef } from "../personRef";
import { MUSIC_CANON_DOMAIN_ID } from "../../canonical/musicMasterLoader";

const person = resolvePersonRef(USER_A, "person_roei");
const context = resolvePersonContext({ person, reference: null, context: null, asOf: "2026-08-19T00:00:00Z" });
const frame = (activeDomainId?: string | null) => buildPersonInContext({ person, context, activeDomainId });

describe("person-in-context — a FRAME, never a state", () => {
  const f = frame(undefined);

  it("has no measured/orientation/tension/next-action field", () => {
    for (const forbidden of ["measured_state", "measurement", "orientation", "tension", "tensions",
      "next_action", "score", "level", "stability", "current_state"]) {
      expect(f).not.toHaveProperty(forbidden);
    }
  });

  it("keeps the three axes structurally separate", () => {
    expect(f).toHaveProperty("human_base");
    expect(f).toHaveProperty("value_direction");
    expect(f).toHaveProperty("selected_domain");
    // the base must not contain the domain, nor the domain the base
    expect(JSON.stringify(f.human_base)).not.toContain("music");
    expect(f.value_direction).not.toHaveProperty("domain");
  });

  it("`possible` licenses questions, never asserts answers", () => {
    expect(Array.isArray(f.possible.measurable_parameters)).toBe(true);
    expect(f.possible).not.toHaveProperty("measured");
    expect(f.possible).not.toHaveProperty("possessed_capabilities");
    // capabilities are DEFINED, and with no domain selected there are none
    expect(f.possible.defined_capabilities).toEqual([]);
  });
});

describe("person-in-context — availability is never selection", () => {
  it("selects no domain when no real DomainState did", () => {
    const f = frame(undefined);
    expect(f.selected_domain).toBeNull();
    expect(f.domain_resolution.selected).toBe(false);
    // ...even though a domain IS available
    expect(f.available_domains.length).toBeGreaterThan(0);
    expect(f.unresolved.some((u) => u.startsWith("SELECTED DOMAIN"))).toBe(true);
  });

  it("an AVAILABLE but unselected domain contributes no vocabulary", () => {
    const none = frame(undefined);
    const sel = frame(MUSIC_CANON_DOMAIN_ID);
    expect(none.possible.defined_capabilities).toEqual([]);
    expect(sel.possible.defined_capabilities.length).toBeGreaterThan(0);
    expect(sel.possible.questions.length).toBeGreaterThan(none.possible.questions.length);
  });

  it("selects only from a real recorded DomainState id", () => {
    const f = frame(MUSIC_CANON_DOMAIN_ID);
    expect(f.selected_domain?.domain_id).toBe(MUSIC_CANON_DOMAIN_ID);
    if (f.domain_resolution.selected) expect(f.domain_resolution.basis).toContain("DomainState");
  });
});

describe("person-in-context — value axis cannot create relations", () => {
  it("is empty with a stated reason when nothing is verified", () => {
    const f = frame(undefined);
    expect(f.value_direction.verified_group_relations).toEqual([]);
    expect(f.value_direction.basis).toContain("never");
  });

  it("reports only relations the caller verified — it derives none itself", () => {
    const f = buildPersonInContext({
      person, context,
      verifiedGroupRelations: [{ group_id: "g1", name: "n", central_value: "v" }],
    });
    expect(f.value_direction.verified_group_relations).toHaveLength(1);
  });
});

describe("person-in-context — survives Music's removal", () => {
  it("holds structurally with an unknown domain id (nothing invented)", () => {
    const f = frame("some_domain_that_does_not_exist");
    expect(f.selected_domain).toBeNull();
    expect(f.domain_resolution.selected).toBe(false);
    // base and value axes are unaffected by the domain axis failing
    expect(f.human_base.parameter.length).toBe(17);
    expect(f.value_direction.verified_group_relations).toEqual([]);
  });
});
