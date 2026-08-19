/**
 * PersonCommunityLinkStore — synthetic fixtures only ("person_test_x"
 * etc.), no real person_roei/p_you data written during tests.
 *
 * Verifies: append-only (duplicate link_id rejected), corrupt-log
 * detection, deterministic ordering, and that this store shares no
 * file/state with CanonEventStore or NeedStore.
 */
import { existsSync, mkdtempSync, readFileSync as readFileSyncFs, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NEED_STORE_FILENAME } from "../../canon/needStore";
import type { PersonCommunityLink } from "../personCommunityLink";
import {
  checkLinkAppend,
  FileSystemPersonCommunityLinkStore,
  InMemoryPersonCommunityLinkStore,
  LinkAppendRejectedError,
  LinkLogCorruptError,
  PERSON_COMMUNITY_LINK_STORE_FILENAME,
  inLinkOrder,
} from "../personCommunityLinkStore";

function baseLink(overrides: Partial<PersonCommunityLink> = {}): PersonCommunityLink {
  return {
    link_id: "link_test_1",
    person_id: "person_test_x",
    community_member_id: "member_test_x",
    community_id: "community_test_x",
    link_status: "DECLARED_SAME_PERSON",
    evidence: "test evidence",
    provenance: "DEMO",
    declaration_source: "self",
    created_at: "2026-08-16T10:00:00Z",
    ...overrides,
  };
}

describe("checkLinkAppend", () => {
  it("rejects an empty append", () => {
    expect(checkLinkAppend([], []).ok).toBe(false);
  });

  it("accepts a single valid record against an empty log", () => {
    expect(checkLinkAppend([], [baseLink()]).ok).toBe(true);
  });

  it("rejects a link_id already stored — append-only, no silent overwrite", () => {
    const stored = [baseLink()];
    const check = checkLinkAppend(stored, [baseLink()]);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.rejections[0].code).toBe("link_id_already_stored");
  });

  it("rejects an invalid record (empty evidence)", () => {
    const check = checkLinkAppend([], [baseLink({ evidence: "" })]);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.rejections[0].code).toBe("invalid_link");
  });
});

describe("InMemoryPersonCommunityLinkStore", () => {
  it("loads back what was appended, in created_at order", async () => {
    const store = new InMemoryPersonCommunityLinkStore();
    await store.append([baseLink({ link_id: "l2", created_at: "2026-08-16T10:05:00Z" })]);
    await store.append([baseLink({ link_id: "l1", created_at: "2026-08-16T10:00:00Z" })]);
    const loaded = await store.load();
    expect(loaded.map((r) => r.link_id)).toEqual(["l1", "l2"]);
  });

  it("throws LinkAppendRejectedError on a duplicate link_id", async () => {
    const store = new InMemoryPersonCommunityLinkStore([baseLink()]);
    await expect(store.append([baseLink()])).rejects.toThrow(LinkAppendRejectedError);
  });
});

describe("inLinkOrder", () => {
  it("is deterministic and ties break by link_id", () => {
    const a = baseLink({ link_id: "l_b", created_at: "2026-08-16T10:00:00Z" });
    const b = baseLink({ link_id: "l_a", created_at: "2026-08-16T10:00:00Z" });
    expect(inLinkOrder([a, b]).map((r) => r.link_id)).toEqual(["l_a", "l_b"]);
  });
});

describe("FileSystemPersonCommunityLinkStore", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "philos-link-store-test-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("persists and reloads across store instances", async () => {
    const store1 = new FileSystemPersonCommunityLinkStore(dir);
    await store1.append([baseLink()]);
    const store2 = new FileSystemPersonCommunityLinkStore(dir);
    const loaded = await store2.load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].link_id).toBe("link_test_1");
  });

  it("writes to its OWN file, never NeedStore's or CanonEventStore's", async () => {
    const store = new FileSystemPersonCommunityLinkStore(dir);
    await store.append([baseLink()]);
    expect(existsSync(join(dir, PERSON_COMMUNITY_LINK_STORE_FILENAME))).toBe(true);
    expect(PERSON_COMMUNITY_LINK_STORE_FILENAME).not.toBe(NEED_STORE_FILENAME);
    expect(existsSync(join(dir, NEED_STORE_FILENAME))).toBe(false);
  });

  it("throws LinkLogCorruptError on an unparseable line, refusing a partial read", async () => {
    const filePath = join(dir, PERSON_COMMUNITY_LINK_STORE_FILENAME);
    writeFileSync(filePath, "not json\n", "utf-8");
    const store = new FileSystemPersonCommunityLinkStore(dir);
    await expect(store.load()).rejects.toThrow(LinkLogCorruptError);
  });

  it("rejects a duplicate link_id across separate append calls", async () => {
    const store = new FileSystemPersonCommunityLinkStore(dir);
    await store.append([baseLink()]);
    await expect(store.append([baseLink()])).rejects.toThrow(LinkAppendRejectedError);
    // Confirms the file was never touched by the rejected second append.
    const raw = readFileSyncFs(join(dir, PERSON_COMMUNITY_LINK_STORE_FILENAME), "utf-8").trim().split("\n");
    expect(raw).toHaveLength(1);
  });
});
