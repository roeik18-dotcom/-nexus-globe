/**
 * THE READ PATH, END TO END, AND WHAT IT LEAVES ON DISK.
 *
 * Two properties the pure-projection tests cannot establish:
 *
 *   1. Reading a stored link does not rewrite it. The whole guard rests on
 *      "the record is left exactly as it is and only the interpretation
 *      changes", so the bytes are compared before and after.
 *
 *   2. The tier survives the SESSION read path, not only LOCAL_DEV. Every
 *      other run in this phase used LOCAL_DEV; a contract that only holds for
 *      the dev provider is not a contract.
 *
 * All I/O is confined to a fresh temp directory. Nothing here can reach a
 * real store: the stores are injected explicitly and torn down in `finally`.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  _setPersonCommunityLinkStore, resolveRealPersonCommunityLink,
} from "../../community/personCommunityLinkStoreAccessor";
import {
  FileSystemPersonCommunityLinkStore, PERSON_COMMUNITY_LINK_STORE_FILENAME,
} from "../../community/personCommunityLinkStore";
import type { PersonCommunityLink } from "../../community/personCommunityLink";
import { resolveShellIdentityLink } from "../../community/resolveShellIdentityLink";
import { _setPhilosEventStore, FileSystemPhilosEventStore } from "@/app/lib/philos-event-store";
import { FileSystemSessionLog, setSessionLog } from "../../identity/sessionLog";
import { issueSession } from "../../identity/sessionStore";
import { SESSION_VIEWER, setSessionReader } from "../../identity/sessionViewer";
import { LOCAL_SINGLE_USER, setViewerProvider } from "../../identity/viewerContext";

const SUBJECT = "person_roei", MEMBER = "p_you", GROUP = "vg_ahrayut_kehilatit";

/** The two records currently on disk, by shape: a declaration then its
 *  confirmation. Written verbatim, the way a pre-existing log looks. */
const STORED: PersonCommunityLink[] = [
  {
    link_id: "link_a_000001", person_id: SUBJECT, community_member_id: MEMBER,
    community_id: GROUP, link_status: "DECLARED_SAME_PERSON",
    evidence: "self-declaration", provenance: "REAL", declaration_source: "self",
    created_at: "2026-08-16T10:00:00Z",
  },
  {
    link_id: "link_b_000002", person_id: SUBJECT, community_member_id: MEMBER,
    community_id: GROUP, link_status: "VERIFIED_SAME_PERSON",
    evidence: "second-step self-confirmation", provenance: "REAL",
    declaration_source: "self", created_at: "2026-08-16T10:05:00Z",
    verified_at: "2026-08-16T10:05:00Z", supersedes_link_id: "link_a_000001",
  },
];

const memberJoined = {
  event_id: "ev_readpath_0001", actor_id: MEMBER, entity_type: "value_group",
  entity_id: GROUP, event_type: "member.joined", value_tags: [],
  timestamp: "2026-08-27T06:00:00.000Z", visibility: "public",
  payload: { person_id: MEMBER }, caused_by: [],
};

let dirs: string[] = [];
function isolated(): { canon: string; events: string; session: string } {
  const base = mkdtempSync(join(tmpdir(), "assurance-readpath-"));
  dirs.push(base);
  const canon = join(base, "canon"), events = join(base, "events"), session = join(base, "session");
  writeFileSync(join(mk(canon), PERSON_COMMUNITY_LINK_STORE_FILENAME),
    STORED.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
  writeFileSync(join(mk(events), "philos-events.jsonl"), JSON.stringify(memberJoined) + "\n", "utf8");
  mk(session);
  return { canon, events, session };
}
function mk(d: string): string {
  new FileSystemPersonCommunityLinkStore(d); // creates the directory
  return d;
}

afterEach(() => {
  _setPersonCommunityLinkStore(null);
  _setPhilosEventStore(null);
  setViewerProvider(LOCAL_SINGLE_USER);
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});

describe("15. reading never rewrites a stored record", () => {
  it("the link log is byte-identical before and after resolution", async () => {
    const { canon } = isolated();
    const file = join(canon, PERSON_COMMUNITY_LINK_STORE_FILENAME);
    const before = readFileSync(file, "utf8");

    _setPersonCommunityLinkStore(new FileSystemPersonCommunityLinkStore(canon));
    const resolved = await resolveRealPersonCommunityLink(SUBJECT, MEMBER, GROUP);

    expect(resolved.link_status).toBe("VERIFIED_SAME_PERSON");
    expect(resolved.assurance).toBe("SELF_ATTESTED_SAME_PERSON");
    /* The interpretation changed; the bytes did not. */
    expect(readFileSync(file, "utf8")).toBe(before);
  });

  it("the stored status is untouched — no tier name is written to disk", async () => {
    const { canon } = isolated();
    _setPersonCommunityLinkStore(new FileSystemPersonCommunityLinkStore(canon));
    await resolveRealPersonCommunityLink(SUBJECT, MEMBER, GROUP);

    const raw = readFileSync(join(canon, PERSON_COMMUNITY_LINK_STORE_FILENAME), "utf8");
    expect(raw).toContain('"link_status":"VERIFIED_SAME_PERSON"');
    expect(raw).not.toContain("SELF_ATTESTED");
    expect(raw).not.toContain("assurance");
  });
});

describe("16. the SESSION read path carries the tier", () => {
  it("a session-resolved viewer gets the same assurance as LOCAL_DEV", async () => {
    const { canon, events, session } = isolated();
    _setPersonCommunityLinkStore(new FileSystemPersonCommunityLinkStore(canon));
    _setPhilosEventStore(new FileSystemPhilosEventStore(events, []));
    setSessionLog(new FileSystemSessionLog(session));

    /* A real session for this viewer — issued through the real store, read
       through the real provider. No REAL directory is involved. */
    const token = await issueSession({ viewer_id: SUBJECT, subject_id: SUBJECT, person_id: MEMBER });
    setSessionReader(async () => token);
    setViewerProvider(SESSION_VIEWER);

    const link = await resolveShellIdentityLink();
    expect(link.status).toBe("VERIFIED_SAME_PERSON");
    expect(link.assurance).toBe("SELF_ATTESTED_SAME_PERSON");
    expect(link.person_id).toBe(SUBJECT);
    expect(link.community_member_id).toBe(MEMBER);
  });

  it("a DEMO-only log yields NONE and an explicit reason through the same path", async () => {
    const { canon, events, session } = isolated();
    writeFileSync(join(canon, PERSON_COMMUNITY_LINK_STORE_FILENAME),
      JSON.stringify({ ...STORED[1], provenance: "DEMO" }) + "\n", "utf8");
    _setPersonCommunityLinkStore(new FileSystemPersonCommunityLinkStore(canon));
    _setPhilosEventStore(new FileSystemPhilosEventStore(events, []));
    setSessionLog(new FileSystemSessionLog(session));

    const token = await issueSession({ viewer_id: SUBJECT, subject_id: SUBJECT, person_id: MEMBER });
    setSessionReader(async () => token);
    setViewerProvider(SESSION_VIEWER);

    const link = await resolveShellIdentityLink();
    expect(link.assurance).toBe("NONE");
    expect(link.status).toBe("UNVERIFIED");
    expect(link.reason).toContain("DEMO");
  });
});
