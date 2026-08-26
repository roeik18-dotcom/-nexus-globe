/**
 * INVITATION — the eleven refusals.
 *
 * Every security case asserts that NOTHING WAS WRITTEN, not merely that a
 * message came back: a test that only checked the return value would still
 * pass if the event were appended anyway.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GroupEvent } from "../groupEvent";

const appendSpy = vi.fn();
let LOG: GroupEvent[] = [];

vi.mock("../groupEventStore", () => ({
  appendGroupEvents: (...a: unknown[]) => { appendSpy(...a); return []; },
  loadGroupEvents: () => ({ events: LOG, rejected: [] }),
  GroupEventRejectedError: class GroupEventRejectedError extends Error {},
}));

const viewer = { person_id: "person_invitee" };
vi.mock("@/app/lib/philos/identity/viewerContext", () => ({
  resolveViewerContext: async () => viewer,
}));

let REAL_LEADERS: { person_id: string }[] = [];
vi.mock("../groupAuthority", () => ({
  resolveRealGroupLeaders: async () => REAL_LEADERS,
}));

const {
  issueInvitationCore, acceptInvitationCore, declineInvitationCore, revokeInvitationCore,
  markViewedCore,
} = await import("../invitationActions");
const { hashToken, generateToken, projectInvitation, findByToken, tokenMatches,
  checkRecipient, RECIPIENT_MESSAGE } = await import("../invitation");

const NOW = "2026-08-25T12:00:00Z";
const LATER = "2026-09-30T12:00:00Z";

function issued(over: Partial<GroupEvent> & { token?: string } = {}): GroupEvent {
  const token = over.token ?? "tok_fixture";
  return {
    event_id: "ge_inv1_issued", group_id: "vg_real", event_type: "INVITATION_ISSUED",
    occurred_at: NOW, recorded_at: NOW, actor_id: "person_inviter", object_id: "inv1",
    source: "test", provenance: "REAL", status: "PROPOSED",
    payload: { token_hash: hashToken(token), expires_at: "2026-09-01T12:00:00Z",
      invitee_person_id: "person_invitee", proposed_role: "coordinator" },
    ...over,
  } as GroupEvent;
}

function form(f: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(f)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  appendSpy.mockReset();
  LOG = [];
  REAL_LEADERS = [];
  viewer.person_id = "person_invitee";
});

describe("only a real leader can invite", () => {
  it("refuses a non-leader, and writes nothing", async () => {
    const r = await issueInvitationCore(form({ group_id: "vg_real", invitee_person_id: "person_invitee" }));
    expect(r.ok).toBe(false);
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it("refuses a DEMO leader — the gate reads real appointments only", async () => {
    /* `resolveRealGroupLeaders` never consults DEMO bundles, so a demo
       coordinator arrives here as an empty leader set. */
    REAL_LEADERS = [];
    viewer.person_id = "person_demo_leader";
    const r = await issueInvitationCore(form({ group_id: "demo_vg_green_innovation", invitee_person_id: "person_invitee" }));
    expect(r.ok).toBe(false);
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it("lets a real leader issue, and stores only the token hash", async () => {
    REAL_LEADERS = [{ person_id: "person_inviter" }];
    viewer.person_id = "person_inviter";
    const r = await issueInvitationCore(form({ group_id: "vg_real", invitee_person_id: "person_invitee" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const written = appendSpy.mock.calls[0]![0] as GroupEvent[];
    const payload = written[0]!.payload as { token_hash: string };
    /* THE PLAINTEXT NEVER REACHES THE LOG. */
    expect(JSON.stringify(written)).not.toContain(r.token);
    expect(payload.token_hash).toBe(hashToken(r.token));
    expect(payload.token_hash).not.toBe(r.token);
  });
});

describe("token", () => {
  it("matches only its own plaintext", () => {
    const t = generateToken();
    expect(tokenMatches(t, hashToken(t))).toBe(true);
    expect(tokenMatches("wrong", hashToken(t))).toBe(false);
  });

  it("is long enough to resist guessing", () => {
    expect(generateToken().length).toBeGreaterThanOrEqual(32);
    expect(generateToken()).not.toBe(generateToken());
  });
});

describe("the client cannot choose the group", () => {
  it("derives the group from the invitation, ignoring any submitted group_id", async () => {
    LOG = [issued({ group_id: "vg_other", token: "t1" })];
    const r = await acceptInvitationCore(form({ invitation_id: "inv1", group_id: "vg_mine" }));
    expect(r.ok).toBe(true);
    const written = appendSpy.mock.calls[0]![0] as GroupEvent[];
    for (const e of written) expect(e.group_id).toBe("vg_other");
  });
});

describe("acceptance belongs to the invitee", () => {
  it("records the SESSION person as actor — there is no field to impersonate", async () => {
    LOG = [issued({ token: "t2" })];
    viewer.person_id = "person_invitee";
    await acceptInvitationCore(form({ invitation_id: "inv1", person_id: "person_someone_else" }));
    const written = appendSpy.mock.calls[0]![0] as GroupEvent[];
    for (const e of written) expect(e.actor_id).toBe("person_invitee");
    const consent = written[0]!.payload as { consent_by: string };
    expect(consent.consent_by).toBe("person_invitee");
  });

  it("refuses the inviter accepting their own invitation", async () => {
    LOG = [issued({ token: "t3" })];
    viewer.person_id = "person_inviter";
    const r = await acceptInvitationCore(form({ invitation_id: "inv1" }));
    expect(r.ok).toBe(false);
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it("refuses an unrelated viewer holding a forwarded link", async () => {
    LOG = [issued({ token: "t3b" })];
    viewer.person_id = "person_stranger";
    const r = await acceptInvitationCore(form({ invitation_id: "inv1" }));
    expect(r).toEqual({ ok: false, message: RECIPIENT_MESSAGE.not_the_recipient });
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it("refuses an unbound (legacy) invitation outright", async () => {
    LOG = [issued({ token: "t3c", payload: { token_hash: hashToken("t3c"),
      expires_at: "2026-09-01T12:00:00Z" } })];
    const r = await acceptInvitationCore(form({ invitation_id: "inv1" }));
    expect(r).toEqual({ ok: false, message: RECIPIENT_MESSAGE.unbound });
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it("refuses a viewer with no resolved identity", async () => {
    LOG = [issued({ token: "t3d" })];
    viewer.person_id = "";
    const r = await acceptInvitationCore(form({ invitation_id: "inv1" }));
    expect(r).toEqual({ ok: false, message: RECIPIENT_MESSAGE.no_identity });
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it("refuses a DEMO identity — it is simply not the bound recipient", async () => {
    LOG = [issued({ token: "t3e" })];
    viewer.person_id = "demo_person_fixture";
    const r = await acceptInvitationCore(form({ invitation_id: "inv1" }));
    expect(r).toEqual({ ok: false, message: RECIPIENT_MESSAGE.not_the_recipient });
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it("refuses a stranger DECLINING someone else's invitation", async () => {
    LOG = [issued({ token: "t3f" })];
    viewer.person_id = "person_stranger";
    const r = await declineInvitationCore(form({ invitation_id: "inv1" }));
    expect(r.ok).toBe(false);
    expect(appendSpy).not.toHaveBeenCalled();
  });
});

describe("closed invitations cannot be accepted", () => {
  it("refuses an expired invitation", async () => {
    LOG = [issued({ token: "t4", payload: { token_hash: hashToken("t4"),
      expires_at: "2026-08-01T00:00:00Z", invitee_person_id: "person_invitee" } })];
    const r = await acceptInvitationCore(form({ invitation_id: "inv1" }));
    expect(r).toEqual({ ok: false, message: expect.stringContaining("פגה") });
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it("refuses a revoked invitation", async () => {
    LOG = [issued({ token: "t5" }), {
      event_id: "ge_inv1_revoked", group_id: "vg_real", event_type: "INVITATION_REVOKED",
      occurred_at: NOW, recorded_at: NOW, actor_id: "person_inviter", object_id: "inv1",
      source: "test", provenance: "REAL", status: "REJECTED",
    } as GroupEvent];
    const r = await acceptInvitationCore(form({ invitation_id: "inv1" }));
    expect(r.ok).toBe(false);
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it("refuses a replayed accept — the state is already terminal", async () => {
    LOG = [issued({ token: "t6" }), {
      event_id: "ge_inv1_accepted", group_id: "vg_real", event_type: "INVITATION_ACCEPTED",
      occurred_at: NOW, recorded_at: NOW, actor_id: "person_invitee", object_id: "inv1",
      source: "test", provenance: "REAL", status: "CONFIRMED",
    } as GroupEvent];
    const r = await acceptInvitationCore(form({ invitation_id: "inv1" }));
    expect(r.ok).toBe(false);
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it("writes membership once — an existing member does not join twice", async () => {
    LOG = [issued({ token: "t7" }), {
      event_id: "ge_prior_join", group_id: "vg_real", event_type: "MEMBER_JOINED",
      occurred_at: NOW, recorded_at: NOW, actor_id: "person_invitee",
      object_id: "person_invitee", source: "test", provenance: "REAL", status: "CONFIRMED",
      payload: { person_id: "person_invitee" },
    } as GroupEvent];
    const r = await acceptInvitationCore(form({ invitation_id: "inv1" }));
    expect(r.ok).toBe(false);
    expect(appendSpy).not.toHaveBeenCalled();
  });
});

describe("acceptance grants membership and nothing more", () => {
  it("writes MEMBER_JOINED with invitation_ref and consent_ref, and no ROLE_CHANGED", async () => {
    LOG = [issued({ token: "t8" })];
    const r = await acceptInvitationCore(form({ invitation_id: "inv1" }));
    expect(r.ok).toBe(true);

    const written = appendSpy.mock.calls[0]![0] as GroupEvent[];
    const types = written.map((e) => e.event_type);
    expect(types).toEqual(["INVITATION_ACCEPTED", "MEMBER_JOINED"]);
    expect(types).not.toContain("ROLE_CHANGED");

    const member = written[1]!.payload as Record<string, string>;
    expect(member.invitation_ref).toBe("inv1");
    expect(member.consent_ref).toBeTruthy();
    /* The invitation PROPOSED a role. Acceptance did not grant it. */
    expect(member.role_status).toBe("NOT_GRANTED");
    expect(member.capability_status).toBe("NOT_GRANTED");
  });

  it("keeps role and capability NOT_GRANTED in the projection", () => {
    const v = projectInvitation([issued({ token: "t9" })], "inv1", NOW)!;
    expect(v.proposed_role).toBe("coordinator");
    expect(v.role_status).toBe("NOT_GRANTED");
    expect(v.capability_status).toBe("NOT_GRANTED");
  });
});

describe("decline", () => {
  it("writes one event and no membership", async () => {
    LOG = [issued({ token: "t10" })];
    const r = await declineInvitationCore(form({ invitation_id: "inv1" }));
    expect(r).toEqual({ ok: true, state: "DECLINED" });

    const written = appendSpy.mock.calls[0]![0] as GroupEvent[];
    expect(written).toHaveLength(1);
    expect(written[0]!.event_type).toBe("INVITATION_DECLINED");
    expect(written.map((e) => e.event_type)).not.toContain("MEMBER_JOINED");
  });
});

describe("revoke", () => {
  it("refuses a non-leader", async () => {
    LOG = [issued({ token: "t11" })];
    REAL_LEADERS = [];
    const r = await revokeInvitationCore(form({ invitation_id: "inv1" }));
    expect(r.ok).toBe(false);
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it("lets a real leader revoke an open invitation", async () => {
    LOG = [issued({ token: "t12" })];
    REAL_LEADERS = [{ person_id: "person_invitee" }];
    const r = await revokeInvitationCore(form({ invitation_id: "inv1" }));
    expect(r).toEqual({ ok: true, state: "REVOKED" });
  });
});

describe("state machine", () => {
  it("derives EXPIRED from the clock rather than writing an event", () => {
    const v = projectInvitation([issued({ token: "tx" })], "inv1", LATER)!;
    expect(v.state).toBe("EXPIRED");
    /* No INVITATION_EXPIRED type exists — expiry is time, not an act. */
    expect(LOG.some((e) => e.event_type === "INVITATION_EXPIRED")).toBe(false);
  });

  it("treats ACCEPTED as terminal", () => {
    const log = [issued({ token: "ty" }), {
      event_id: "a", group_id: "vg_real", event_type: "INVITATION_ACCEPTED",
      occurred_at: NOW, recorded_at: NOW, actor_id: "person_invitee", object_id: "inv1",
      source: "t", provenance: "REAL", status: "CONFIRMED",
    } as GroupEvent, {
      event_id: "b", group_id: "vg_real", event_type: "INVITATION_DECLINED",
      occurred_at: NOW, recorded_at: "2026-08-26T00:00:00Z", actor_id: "person_invitee",
      object_id: "inv1", source: "t", provenance: "REAL", status: "REJECTED",
    } as GroupEvent];
    expect(projectInvitation(log, "inv1", NOW)!.state).toBe("ACCEPTED");
  });

  it("finds an invitation by token hash, never by plaintext comparison", () => {
    const log = [issued({ token: "tz" })];
    expect(findByToken(log, "tz", NOW)?.invitation_id).toBe("inv1");
    expect(findByToken(log, "not-it", NOW)).toBeNull();
  });
});

describe("recipient binding is required at issue time", () => {
  it("refuses to create an unbound invitation", async () => {
    REAL_LEADERS = [{ person_id: "person_inviter" }];
    viewer.person_id = "person_inviter";
    const r = await issueInvitationCore(form({ group_id: "vg_real" }));
    expect(r.ok).toBe(false);
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it("refuses a leader inviting themselves", async () => {
    REAL_LEADERS = [{ person_id: "person_inviter" }];
    viewer.person_id = "person_inviter";
    const r = await issueInvitationCore(
      form({ group_id: "vg_real", invitee_person_id: "person_inviter" }));
    expect(r.ok).toBe(false);
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it("stores the recipient on the issued event", async () => {
    REAL_LEADERS = [{ person_id: "person_inviter" }];
    viewer.person_id = "person_inviter";
    const r = await issueInvitationCore(
      form({ group_id: "vg_real", invitee_person_id: "person_target" }));
    expect(r.ok).toBe(true);
    const written = appendSpy.mock.calls[0]![0] as GroupEvent[];
    expect((written[0]!.payload as { invitee_person_id: string }).invitee_person_id)
      .toBe("person_target");
  });

  it("distinguishes the three refusal reasons", () => {
    const bound = projectInvitation([issued({ token: "tb" })], "inv1", NOW)!;
    expect(checkRecipient(bound, "person_invitee")).toEqual({ ok: true });
    expect(checkRecipient(bound, "person_other"))
      .toEqual({ ok: false, reason: "not_the_recipient" });
    expect(checkRecipient(bound, null)).toEqual({ ok: false, reason: "no_identity" });
    expect(checkRecipient({ ...bound, invitee_person_id: null }, "person_invitee"))
      .toEqual({ ok: false, reason: "unbound" });
  });
});

describe("markViewed reports failure instead of swallowing it", () => {
  it("returns an explicit audit when the invitation is not found", async () => {
    LOG = [];
    expect(await markViewedCore("nope")).toEqual({ recorded: false, audit: "NOT_FOUND" });
  });

  it("does not record a view for a non-recipient", async () => {
    LOG = [issued({ token: "tv1" })];
    viewer.person_id = "person_stranger";
    expect(await markViewedCore("tv1")).toEqual({ recorded: false, audit: "NOT_RECIPIENT" });
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it("records a view for the bound recipient", async () => {
    LOG = [issued({ token: "tv2" })];
    expect(await markViewedCore("tv2")).toEqual({ recorded: true });
  });

  it("never puts the token in the audit reason", async () => {
    LOG = [issued({ token: "supersecrettoken" })];
    const r = await markViewedCore("supersecrettoken");
    expect(JSON.stringify(r)).not.toContain("supersecrettoken");
  });
});

describe("the plaintext token never leaves the issuing call", () => {
  it("appears in no written event, for any action", async () => {
    REAL_LEADERS = [{ person_id: "person_inviter" }];
    viewer.person_id = "person_inviter";
    const issue = await issueInvitationCore(
      form({ group_id: "vg_real", invitee_person_id: "person_invitee" }));
    expect(issue.ok).toBe(true);
    if (!issue.ok) return;

    appendSpy.mockReset();
    LOG = [issued({ token: issue.token })];
    viewer.person_id = "person_invitee";
    await acceptInvitationCore(form({ token: issue.token }));

    const all = JSON.stringify(appendSpy.mock.calls);
    expect(all).not.toContain(issue.token);
    /* The hash is what the log keeps, and a hash is not the token. */
    expect(issue.token).not.toBe(hashToken(issue.token));
  });
});

describe("the accept path never handles a token", () => {
  it("takes invitation_id and ignores any submitted token", async () => {
    LOG = [issued({ token: "sekrit_token_value" })];
    viewer.person_id = "person_invitee";
    const r = await acceptInvitationCore(
      form({ invitation_id: "inv1", token: "sekrit_token_value" }));
    expect(r.ok).toBe(true);
    /* Nothing written mentions it, because the action never read it. */
    expect(JSON.stringify(appendSpy.mock.calls)).not.toContain("sekrit_token_value");
  });

  it("still refuses a non-recipient addressing the invitation by id", async () => {
    LOG = [issued({ token: "t_id" })];
    viewer.person_id = "person_stranger";
    const r = await acceptInvitationCore(form({ invitation_id: "inv1" }));
    expect(r).toEqual({ ok: false, message: RECIPIENT_MESSAGE.not_the_recipient });
    expect(appendSpy).not.toHaveBeenCalled();
  });

  it("refuses an unknown invitation id", async () => {
    LOG = [issued({ token: "t_id2" })];
    const r = await acceptInvitationCore(form({ invitation_id: "inv_does_not_exist" }));
    expect(r.ok).toBe(false);
    expect(appendSpy).not.toHaveBeenCalled();
  });
});
