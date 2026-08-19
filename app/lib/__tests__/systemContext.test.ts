/**
 * SystemContextRef — pure parse/encode roundtrip. No id is ever minted; an
 * unrecognized string resolves to "unknown", never guessed into a real kind.
 */
import { describe, expect, it } from "vitest";
import {
  buildContextActions,
  claimedVerifiedColor,
  encodeSystemContextRef,
  parseSystemContextRef,
  persistedDerivedColor,
  PHILOS_STATE_COLOR,
  type SystemContextRef,
} from "../systemContext";

describe("parseSystemContextRef", () => {
  it("returns null for empty/undefined/null input", () => {
    expect(parseSystemContextRef(undefined)).toBeNull();
    expect(parseSystemContextRef(null)).toBeNull();
    expect(parseSystemContextRef("")).toBeNull();
    expect(parseSystemContextRef("   ")).toBeNull();
  });

  it("parses a real canon_event_id ref", () => {
    const ref = parseSystemContextRef("canon:canon_evt_merlin_abc123");
    expect(ref).toEqual({ kind: "canon_observation", canon_event_id: "canon_evt_merlin_abc123" });
  });

  it("parses a real legacy event_id ref", () => {
    const ref = parseSystemContextRef("event:e010");
    expect(ref).toEqual({ kind: "legacy_event", event_id: "e010" });
  });

  it("parses a real action_id ref (LOOP 0054)", () => {
    const ref = parseSystemContextRef("action:action_abc123");
    expect(ref).toEqual({ kind: "action", action_id: "action_abc123" });
  });

  it("parses a real effect_id ref (LOOP 0054)", () => {
    const ref = parseSystemContextRef("effect:effect_abc123");
    expect(ref).toEqual({ kind: "effect", effect_id: "effect_abc123" });
  });

  it("an unrecognized prefix resolves to unknown, never guessed into a real kind", () => {
    const ref = parseSystemContextRef("mystery:xyz");
    expect(ref).toEqual({ kind: "unknown", raw: "mystery:xyz" });
  });

  it("no colon at all resolves to unknown", () => {
    const ref = parseSystemContextRef("just-some-string");
    expect(ref).toEqual({ kind: "unknown", raw: "just-some-string" });
  });

  it("a recognized prefix with an empty id resolves to unknown, not a real ref with an empty id", () => {
    expect(parseSystemContextRef("canon:")).toEqual({ kind: "unknown", raw: "canon:" });
    expect(parseSystemContextRef("event:")).toEqual({ kind: "unknown", raw: "event:" });
  });
});

describe("encodeSystemContextRef", () => {
  it("roundtrips canon_observation", () => {
    const ref: SystemContextRef = { kind: "canon_observation", canon_event_id: "x1" };
    expect(parseSystemContextRef(encodeSystemContextRef(ref))).toEqual(ref);
  });

  it("roundtrips legacy_event", () => {
    const ref: SystemContextRef = { kind: "legacy_event", event_id: "e010" };
    expect(parseSystemContextRef(encodeSystemContextRef(ref))).toEqual(ref);
  });

  it("roundtrips action (LOOP 0054)", () => {
    const ref: SystemContextRef = { kind: "action", action_id: "action_x1" };
    expect(parseSystemContextRef(encodeSystemContextRef(ref))).toEqual(ref);
  });

  it("roundtrips effect (LOOP 0054)", () => {
    const ref: SystemContextRef = { kind: "effect", effect_id: "effect_x1" };
    expect(parseSystemContextRef(encodeSystemContextRef(ref))).toEqual(ref);
  });
});

describe("persistedDerivedColor", () => {
  it("colors 'persisted' distinctly from every other value — a function of the real field, not a per-surface pick", () => {
    expect(persistedDerivedColor("persisted")).toBe(PHILOS_STATE_COLOR.persisted);
    expect(persistedDerivedColor("derived")).toBe(PHILOS_STATE_COLOR.derived);
    expect(persistedDerivedColor("caller_supplied")).toBe(PHILOS_STATE_COLOR.derived);
    expect(persistedDerivedColor("persisted")).not.toBe(persistedDerivedColor("derived"));
  });
});

describe("claimedVerifiedColor", () => {
  it("verified statuses map to the verified color", () => {
    expect(claimedVerifiedColor("verified")).toBe(PHILOS_STATE_COLOR.verified);
    expect(claimedVerifiedColor("community_verified")).toBe(PHILOS_STATE_COLOR.verified);
    expect(claimedVerifiedColor("external_verified")).toBe(PHILOS_STATE_COLOR.verified);
  });
  it("not_applicable is neutral, never verified-green", () => {
    expect(claimedVerifiedColor("not_applicable")).toBe(PHILOS_STATE_COLOR.neutral);
  });
  it("an explicit 'not tracked' string is the unknown color, not claimed", () => {
    expect(claimedVerifiedColor("not tracked at node level — see the related graph mark below")).toBe(
      PHILOS_STATE_COLOR.unknown,
    );
  });
  it("everything else (claimed, self_report, system_inference, ...) falls to the claimed color", () => {
    expect(claimedVerifiedColor("claimed")).toBe(PHILOS_STATE_COLOR.claimed);
    expect(claimedVerifiedColor("self_report")).toBe(PHILOS_STATE_COLOR.claimed);
  });
});

describe("buildContextActions", () => {
  const ref: SystemContextRef = { kind: "canon_observation", canon_event_id: "canon_evt_1" };

  it("on Dynamics: Dynamics is 'here', Globe and Marketplace are real ctx-preserving links", () => {
    const actions = buildContextActions(ref, "dynamics");
    const dyn = actions.find((a) => a.label === "Dynamics")!;
    const globe = actions.find((a) => a.label === "Open in Dynamics")!; // absent on this surface
    expect(dyn.state).toBe("here");
    expect(dyn.href).toBeNull();
    expect(globe).toBeUndefined();
    const locate = actions.find((a) => a.label === "Locate on Globe")!;
    expect(locate.state).toBe("live");
    expect(locate.href).toBe("/planet?ctx=canon%3Acanon_evt_1");
    const market = actions.find((a) => a.label === "Marketplace opportunities")!;
    expect(market.state).toBe("live");
    expect(market.href).toBe("/marketplace?ctx=canon%3Acanon_evt_1");
  });

  it("on Globe: Globe is 'here', Dynamics is a real ctx-preserving link", () => {
    const actions = buildContextActions(ref, "globe");
    const globe = actions.find((a) => a.label === "Globe")!;
    expect(globe.state).toBe("here");
    expect(globe.href).toBeNull();
    const openDynamics = actions.find((a) => a.label === "Open in Dynamics")!;
    expect(openDynamics.state).toBe("live");
    expect(openDynamics.href).toBe("/dynamics?ctx=canon%3Acanon_evt_1");
  });

  it("on Marketplace: Marketplace is 'here', Dynamics and Globe are real ctx-preserving links", () => {
    const actions = buildContextActions(ref, "marketplace");
    const here = actions.find((a) => a.label === "Marketplace")!;
    expect(here.state).toBe("here");
    expect(here.href).toBeNull();
    expect(actions.find((a) => a.label === "Marketplace opportunities")).toBeUndefined();
    const openDynamics = actions.find((a) => a.label === "Open in Dynamics")!;
    expect(openDynamics.state).toBe("live");
    const locate = actions.find((a) => a.label === "Locate on Globe")!;
    expect(locate.state).toBe("live");
  });

  it("the two still-unconnected destinations stay explicitly not_connected — never a fake link", () => {
    for (const here of ["dynamics", "globe", "marketplace", "community", "hub"] as const) {
      const actions = buildContextActions(ref, here);
      for (const label of ["Needs / Values", "Ask Merlin"]) {
        const a = actions.find((x) => x.label === label)!;
        expect(a.state).toBe("not_connected");
        expect(a.href).toBeNull();
      }
    }
  });

  it("on Community: Community is 'here', every other surface is a real ctx-preserving link (LOOP 0054)", () => {
    const actions = buildContextActions(ref, "community");
    const here = actions.find((a) => a.label === "Community")!;
    expect(here.state).toBe("here");
    expect(here.href).toBeNull();
    expect(actions.find((a) => a.label === "Open in Community")).toBeUndefined();
    const openHub = actions.find((a) => a.label === "Open in Hub")!;
    expect(openHub.state).toBe("live");
    expect(openHub.href).toBe("/hub?ctx=canon%3Acanon_evt_1");
  });

  it("on Hub: Hub is 'here', Community is a real ctx-preserving link (LOOP 0054)", () => {
    const actions = buildContextActions(ref, "hub");
    const here = actions.find((a) => a.label === "Hub")!;
    expect(here.state).toBe("here");
    expect(here.href).toBeNull();
    const openCommunity = actions.find((a) => a.label === "Open in Community")!;
    expect(openCommunity.state).toBe("live");
    expect(openCommunity.href).toBe("/hub/community?ctx=canon%3Acanon_evt_1");
  });

  it("from Dynamics/Globe/Marketplace, Community and Hub are now real live links (LOOP 0054, not not_connected anymore)", () => {
    for (const here of ["dynamics", "globe", "marketplace"] as const) {
      const actions = buildContextActions(ref, here);
      const community = actions.find((a) => a.label === "Open in Community")!;
      expect(community.state).toBe("live");
      const hub = actions.find((a) => a.label === "Open in Hub")!;
      expect(hub.state).toBe("live");
    }
  });
});
