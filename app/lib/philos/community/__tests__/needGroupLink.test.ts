import { describe, expect, it } from "vitest";

import { mayDeclare, resolveNeedGroup, validateNeedGroupLink, type NeedGroupLink } from "../needGroupLink";
import { checkNeedGroupLinkAppend, InMemoryNeedGroupLinkStore } from "../needGroupLinkStore";
import { buildRealNeedCommunityLinks } from "../../bridge/linkRegistry";

const link = (over: Partial<NeedGroupLink> = {}): NeedGroupLink => ({
  link_id: "link_1", need_id: "need_1", group_id: "vg_real",
  declared_by: "person_roei", evidence: "כי זה הצעד הבא של הקבוצה",
  declaration_source: "self", created_at: "2026-08-20T10:00:00+03:00", ...over,
});

describe("NeedGroupLink — authority", () => {
  it("only the Need's own subject may declare", () => {
    expect(mayDeclare("person_roei", "person_roei")).toBe(true);
    expect(mayDeclare("person_roei", "someone_else")).toBe(false);
    expect(mayDeclare("", "person_roei")).toBe(false);
  });

  it("requires an explicit evidence sentence — a declaration with no reason is invalid", () => {
    expect(validateNeedGroupLink(link({ evidence: "" })).valid).toBe(false);
    expect(validateNeedGroupLink(link()).valid).toBe(true);
  });
});

describe("NeedGroupLink — append-only store", () => {
  it("rejects a duplicate link_id rather than silently ignoring it", async () => {
    const store = new InMemoryNeedGroupLinkStore([link()]);
    await expect(store.append([link()])).rejects.toThrow(/already in the log/);
  });

  it("a correction is a NEW record and the latest wins", () => {
    const first = link({ link_id: "link_1", group_id: "vg_a", created_at: "2026-08-20T10:00:00+03:00" });
    const second = link({ link_id: "link_2", group_id: "vg_b", created_at: "2026-08-20T11:00:00+03:00" });
    expect(resolveNeedGroup([first, second], "need_1")?.group_id).toBe("vg_b");
  });

  it("an empty append is rejected", () => {
    expect(checkNeedGroupLinkAppend([], []).ok).toBe(false);
  });
});

describe("NeedGroupLink — registry precedence", () => {
  const known = new Set(["vg_real"]);

  it("a declaration produces a REAL COMMUNITY_HAS_NEED for a Need with no origin group", () => {
    const out = buildRealNeedCommunityLinks(
      [{ need_id: "need_1" }], known,
      new Map([["need_1", { group_id: "vg_real", link_id: "link_1", created_at: "2026-08-20T10:00:00+03:00" }]]),
    );
    expect(out).toHaveLength(1);
    expect(out[0].provenance).toBe("REAL");
    expect(out[0].note).toContain("explicit declaration");
    expect(out[0].valid_from).toBe("2026-08-20T10:00:00+03:00");
  });

  it("origin_group_id OUTRANKS a later declaration — what the write recorded wins", () => {
    const out = buildRealNeedCommunityLinks(
      [{ need_id: "need_1", origin_group_id: "vg_real", recorded_at: "2026-08-16T00:00:00+03:00" }], known,
      new Map([["need_1", { group_id: "vg_other", link_id: "link_1", created_at: "2026-08-20T10:00:00+03:00" }]]),
    );
    expect(out).toHaveLength(1);
    expect(out[0].source.canonical_id).toBe("vg_real");
    expect(out[0].note).toContain("origin_group_id");
  });

  it("no declaration and no origin group produces NOTHING — text is never consulted", () => {
    expect(buildRealNeedCommunityLinks([{ need_id: "need_1" }], known, new Map())).toEqual([]);
  });

  it("a declaration naming an unknown group is dropped", () => {
    const out = buildRealNeedCommunityLinks(
      [{ need_id: "need_1" }], known,
      new Map([["need_1", { group_id: "vg_ghost", link_id: "l", created_at: "t" }]]),
    );
    expect(out).toEqual([]);
  });
});
