import { describe, expect, it } from "vitest";

import { spineTouchOf } from "../spineTouch";
import { buildSocialValueSpine } from "../../valueSystem/socialValueSpine";

describe("spineTouch — records reach only the last two links", () => {
  it("group.opened instantiates value_group", () => {
    expect(spineTouchOf("group.opened")).toMatchObject({ touches: true, key: "value_group" });
  });

  it("membership events instantiate membership and nothing beyond it", () => {
    expect(spineTouchOf("member.joined")).toMatchObject({ touches: true, key: "membership" });
    expect(spineTouchOf("leader.appointed")).toMatchObject({ touches: true, key: "membership" });
  });

  it("canon pipeline records touch NO spine link — a value word is not a value", () => {
    for (const kind of ["need", "offer", "action", "effect", "observation"]) {
      const t = spineTouchOf(kind);
      expect(t.touches).toBe(false);
      expect(t.because).toBeTruthy();
    }
  });

  it("a resource transfer does not touch a value link", () => {
    expect(spineTouchOf("transfer.completed").touches).toBe(false);
  });

  it("an unknown kind returns a stated non-touch, never a guess", () => {
    const t = spineTouchOf("something.new");
    expect(t.touches).toBe(false);
    expect(t.key).toBeUndefined();
  });

  it("NOTHING reaches the first four links — which is why they show source/conceptual", () => {
    const unreachable = ["contradiction", "emergent_value", "personal_value", "group_value"];
    const kinds = ["group.opened", "member.joined", "leader.appointed", "need", "offer", "action", "effect", "observation", "transfer.completed"];
    const reached = kinds.map((k) => spineTouchOf(k).key).filter(Boolean);
    for (const key of unreachable) expect(reached).not.toContain(key);
  });

  it("every key it can return is a real spine link", () => {
    const spineKeys = buildSocialValueSpine({}).links.map((l) => l.key);
    for (const kind of ["group.opened", "member.joined", "leader.appointed"]) {
      expect(spineKeys).toContain(spineTouchOf(kind).key);
    }
  });
});
