"use server";

/**
 * INVITATION WRITES — every one of them gated server-side.
 *
 * FOUR RULES THIS FILE ENFORCES STRUCTURALLY, not by convention:
 *
 *  1. ONLY A REAL LEADER MAY INVITE. `resolveRealGroupLeaders` reads real
 *     appointment events only; a DEMO coordinator fails here exactly as a
 *     stranger does, so a compiled-in fixture can never authorise a
 *     `provenance: "REAL"` invitation.
 *
 *  2. THE CLIENT NEVER NAMES THE GROUP ON ACCEPT. Accepting submits a token
 *     and nothing else; the group comes from the invitation the token
 *     resolves to. A form field cannot point an acceptance at another group.
 *
 *  3. NOBODY CONSENTS FOR ANYBODY ELSE. `actor_id` on the acceptance is
 *     always `viewer.person_id`, read from the session — there is no
 *     parameter through which one person could accept as another, and the
 *     inviter is refused outright.
 *
 *  4. ACCEPTANCE GRANTS MEMBERSHIP AND NOTHING ELSE. It writes
 *     `MEMBER_JOINED`; it writes no `ROLE_CHANGED`, and a `proposed_role`
 *     stays a proposal. Granting a role is a separate decision this file
 *     has no path to make.
 */
import { mkdirSync, openSync, closeSync, rmSync } from "node:fs";
import { join } from "node:path";

import { revalidatePath } from "next/cache";

import { resolveViewerContext } from "@/app/lib/philos/identity/viewerContext";
import { systemClock } from "../eventStore";
import { appendGroupEvents, GroupEventRejectedError, loadGroupEvents } from "./groupEventStore";
import { resolveRealGroupLeaders } from "./groupAuthority";
import type { GroupEvent } from "./groupEvent";
import {
  checkRecipient, findByToken, generateToken, hashToken, isOpen, projectInvitation,
  RECIPIENT_MESSAGE,
} from "./invitation";

export type IssueResult =
  | { ok: true; invitation_id: string; token: string; url: string }
  | { ok: false; message: string };

export type DecideResult = { ok: true; state: string } | { ok: false; message: string };

const DEFAULT_TTL_DAYS = 7;

function canonDir(): string {
  return process.env.PHILOS_CANON_DIR ?? join(process.cwd(), ".philos-canon-data");
}

/**
 * A mutex around one invitation's acceptance.
 *
 * `appendGroupEvents` is all-or-nothing PER CALL — it validates every event,
 * throws before touching the file, and then writes both events in one
 * `appendFileSync`. Replay is already refused, because both events carry
 * deterministic ids and the store rejects an id it has seen.
 *
 * What that does NOT cover is two accepts arriving at once: both read the
 * store before either writes, both see no existing id, and both append. The
 * lock closes that window with `openSync(..., "wx")`, which fails if the file
 * exists — an atomic test-and-set the filesystem provides, needing no change
 * to the shared store.
 */
function withInvitationLock<T>(invitation_id: string, fn: () => T): T | "LOCKED" {
  const d = canonDir();
  mkdirSync(d, { recursive: true });
  const lock = join(d, `.invitation-${invitation_id}.lock`);
  let fd: number;
  try {
    fd = openSync(lock, "wx");
  } catch {
    return "LOCKED";
  }
  try {
    return fn();
  } finally {
    closeSync(fd);
    rmSync(lock, { force: true });
  }
}

function ev(e: GroupEvent): GroupEvent { return e; }

/* ── ISSUE ───────────────────────────────────────────────────────────── */

export async function issueInvitationCore(formData: FormData): Promise<IssueResult> {
  const viewer = await resolveViewerContext();
  const group_id = String(formData.get("group_id") ?? "").trim();
  const proposed_role = String(formData.get("proposed_role") ?? "").trim();
  /* BOUND AT ISSUE. An invitation with no named recipient is a bearer token,
     and a forwarded link would admit whoever opened it. */
  const invitee_person_id = String(formData.get("invitee_person_id") ?? "").trim();
  if (!group_id) return { ok: false, message: "group_id is required" };
  if (!invitee_person_id) return { ok: false, message: "יש לציין את מזהה האדם המוזמן" };
  if (invitee_person_id === viewer.person_id) {
    return { ok: false, message: "לא ניתן להזמין את עצמך" };
  }

  /* RULE 1. Real appointments only — and for THIS group, not any group. */
  const leaders = await resolveRealGroupLeaders(group_id);
  if (!leaders.some((l) => l.person_id === viewer.person_id)) {
    return { ok: false, message: "רק רכז/ת מאומת/ת של הקבוצה יכול/ה להזמין" };
  }

  const now = systemClock.now();
  const expires = new Date(Date.parse(now) + DEFAULT_TTL_DAYS * 86_400_000).toISOString();
  const invitation_id = `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  /* The plaintext is returned to the caller once, for the link. Only the
     hash reaches the log. */
  const token = generateToken();

  try {
    appendGroupEvents([ev({
      event_id: `ge_${invitation_id}_issued`,
      group_id,
      event_type: "INVITATION_ISSUED",
      occurred_at: now,
      recorded_at: now,
      actor_id: viewer.person_id,
      object_id: invitation_id,
      source: "הזמנה לקבוצה — Community",
      provenance: "REAL",
      status: "PROPOSED",
      payload: {
        token_hash: hashToken(token),
        expires_at: expires,
        invitee_person_id,
        ...(proposed_role ? { proposed_role } : {}),
      },
    })]);
  } catch (err) {
    return { ok: false, message: err instanceof GroupEventRejectedError ? err.message : String(err) };
  }
  return { ok: true, invitation_id, token, url: `/invite/${token}` };
}

export async function issueInvitationAction(formData: FormData): Promise<IssueResult> {
  const r = await issueInvitationCore(formData);
  if (r.ok) revalidatePath("/hub/community");
  return r;
}

/* ── VIEW ────────────────────────────────────────────────────────────── */

/**
 * Records that the link was opened, and REPORTS whether that succeeded.
 *
 * The earlier version swallowed a write failure, so a page could render the
 * invitation as VIEWED while nothing had been recorded — a status the log
 * could not support. The page may still render on failure, but it renders
 * knowing the view was not persisted, and the caller gets an auditable
 * reason rather than silence.
 *
 * The reason never carries the token or any part of it.
 */
export type ViewResult =
  | { recorded: true }
  | { recorded: false; audit: "NOT_FOUND" | "NOT_OPEN" | "ALREADY_VIEWED" | "NOT_RECIPIENT" }
  | { recorded: false; audit: "VIEW_RECORDING_FAILED"; because: string };

export async function markViewedCore(token: string): Promise<ViewResult> {
  const viewer = await resolveViewerContext();
  const { events } = loadGroupEvents();
  const now = systemClock.now();
  const inv = findByToken(events, token, now);
  if (!inv) return { recorded: false, audit: "NOT_FOUND" };
  if (!isOpen(inv)) return { recorded: false, audit: "NOT_OPEN" };
  if (inv.state === "VIEWED") return { recorded: false, audit: "ALREADY_VIEWED" };
  /* A stranger opening a forwarded link does not move the invitation's state. */
  if (!checkRecipient(inv, viewer.person_id).ok) {
    return { recorded: false, audit: "NOT_RECIPIENT" };
  }

  try {
    appendGroupEvents([ev({
      event_id: `ge_${inv.invitation_id}_viewed`,
      group_id: inv.group_id,
      event_type: "INVITATION_VIEWED",
      occurred_at: now, recorded_at: now,
      actor_id: viewer.person_id,
      object_id: inv.invitation_id,
      source: "פתיחת קישור הזמנה",
      provenance: "REAL",
      status: "OBSERVED",
    })]);
  } catch (err) {
    /* The message comes from the store's own rejection, which names event
       ids and reasons — never a token. */
    return {
      recorded: false, audit: "VIEW_RECORDING_FAILED",
      because: err instanceof GroupEventRejectedError ? err.message : "append failed",
    };
  }
  return { recorded: true };
}

/* ── ACCEPT ──────────────────────────────────────────────────────────── */

export async function acceptInvitationCore(formData: FormData): Promise<DecideResult> {
  /* RULE 3. The acceptor is the session, not a field. */
  const viewer = await resolveViewerContext();
  /* THE TOKEN IS NOT A PARAMETER HERE. It was, and passing it to the client
     component that renders the buttons serialised it into the page HTML —
     putting a live credential in the document source. The invitation is
     addressed by id, and RECIPIENT BINDING is what authorises: only the
     bound person's session can decide, so knowing an id grants nothing. */
  const invitation_id = String(formData.get("invitation_id") ?? "").trim();
  if (!invitation_id) return { ok: false, message: "invitation_id is required" };

  const { events } = loadGroupEvents();
  const now = systemClock.now();

  /* RULE 2. The group comes from the invitation, never from the client. */
  const inv = projectInvitation(events, invitation_id, now);
  if (!inv) return { ok: false, message: "הזמנה זו אינה קיימת" };
  if (inv.state === "EXPIRED") return { ok: false, message: "ההזמנה פגה ואינה ניתנת לקבלה" };
  if (inv.state === "REVOKED") return { ok: false, message: "ההזמנה בוטלה" };
  if (!isOpen(inv)) return { ok: false, message: `ההזמנה כבר הוכרעה — ${inv.state}` };

  /* RECIPIENT BINDING. The session's person must BE the bound invitee. This
     subsumes the inviter case — an inviter is not the recipient — and closes
     the forwarded-link hole that a bearer token left open. */
  const who = checkRecipient(inv, viewer.person_id);
  if (!who.ok) return { ok: false, message: RECIPIENT_MESSAGE[who.reason] };

  /* IDEMPOTENCY. A person already in this group does not join twice. */
  const already = events.some((e) =>
    e.event_type === "MEMBER_JOINED" &&
    e.group_id === inv.group_id &&
    (e.object_id === viewer.person_id ||
     (e.payload as { person_id?: string } | undefined)?.person_id === viewer.person_id));
  if (already) return { ok: false, message: "כבר קיימת חברות בקבוצה זו" };

  const consent_ref = `consent_${inv.invitation_id}_${viewer.person_id}`;

  /* Both events in ONE append: the store validates all, throws before
     writing anything, then writes them together. There is no path that
     leaves INVITATION_ACCEPTED recorded without MEMBER_JOINED. */
  const written = withInvitationLock(inv.invitation_id, () => {
  try {
    appendGroupEvents([
      ev({
        event_id: `ge_${inv.invitation_id}_accepted`,
        group_id: inv.group_id,
        event_type: "INVITATION_ACCEPTED",
        occurred_at: now, recorded_at: now,
        actor_id: viewer.person_id,
        object_id: inv.invitation_id,
        source: "קבלת הזמנה על ידי המוזמן/ת",
        provenance: "REAL",
        status: "CONFIRMED",
        /* The consent is the invitee's own act, recorded on their event. */
        payload: { consent_ref, consent_by: viewer.person_id },
      }),
      /* RULE 4. Membership, and nothing else. No ROLE_CHANGED is written
         here, whatever role the invitation proposed. */
      ev({
        event_id: `ge_${inv.invitation_id}_member_joined`,
        group_id: inv.group_id,
        event_type: "MEMBER_JOINED",
        occurred_at: now, recorded_at: now,
        actor_id: viewer.person_id,
        object_id: viewer.person_id,
        source: "הצטרפות דרך הזמנה",
        provenance: "REAL",
        status: "CONFIRMED",
        payload: {
          person_id: viewer.person_id,
          invitation_ref: inv.invitation_id,
          consent_ref,
          role_status: "NOT_GRANTED",
          capability_status: "NOT_GRANTED",
        },
      }),
    ]);
  } catch (err) {
    /* A duplicate event_id is the store refusing a replay. Both writes carry
       deterministic ids, so a replayed accept collides rather than doubling. */
    return { ok: false as const, message: err instanceof GroupEventRejectedError ? err.message : String(err) };
  }
  return { ok: true as const, state: "ACCEPTED" };
  });

  if (written === "LOCKED") {
    return { ok: false, message: "בקשה מקבילה מטפלת בהזמנה זו — נסה/י שוב" };
  }
  return written;
}

export async function acceptInvitationAction(formData: FormData): Promise<DecideResult> {
  const r = await acceptInvitationCore(formData);
  if (r.ok) { revalidatePath("/hub/community"); revalidatePath("/invite"); }
  return r;
}

/* ── DECLINE ─────────────────────────────────────────────────────────── */

export async function declineInvitationCore(formData: FormData): Promise<DecideResult> {
  const viewer = await resolveViewerContext();
  const invitation_id = String(formData.get("invitation_id") ?? "").trim();
  if (!invitation_id) return { ok: false, message: "invitation_id is required" };

  const { events } = loadGroupEvents();
  const now = systemClock.now();
  const inv = projectInvitation(events, invitation_id, now);
  if (!inv) return { ok: false, message: "הזמנה זו אינה קיימת" };
  if (!isOpen(inv)) return { ok: false, message: `ההזמנה כבר הוכרעה — ${inv.state}` };
  /* Only the recipient may decline. A stranger declining would destroy an
     invitation that was never theirs. */
  const whoD = checkRecipient(inv, viewer.person_id);
  if (!whoD.ok) return { ok: false, message: RECIPIENT_MESSAGE[whoD.reason] };

  try {
    /* Declining writes ONE event and no membership. */
    appendGroupEvents([ev({
      event_id: `ge_${inv.invitation_id}_declined`,
      group_id: inv.group_id,
      event_type: "INVITATION_DECLINED",
      occurred_at: now, recorded_at: now,
      actor_id: viewer.person_id,
      object_id: inv.invitation_id,
      source: "דחיית הזמנה על ידי המוזמן/ת",
      provenance: "REAL",
      status: "REJECTED",
    })]);
  } catch (err) {
    return { ok: false, message: err instanceof GroupEventRejectedError ? err.message : String(err) };
  }
  return { ok: true, state: "DECLINED" };
}

export async function declineInvitationAction(formData: FormData): Promise<DecideResult> {
  const r = await declineInvitationCore(formData);
  if (r.ok) revalidatePath("/invite");
  return r;
}

/* ── REVOKE ──────────────────────────────────────────────────────────── */

export async function revokeInvitationCore(formData: FormData): Promise<DecideResult> {
  const viewer = await resolveViewerContext();
  const invitation_id = String(formData.get("invitation_id") ?? "").trim();
  if (!invitation_id) return { ok: false, message: "invitation_id is required" };

  const { events } = loadGroupEvents();
  const now = systemClock.now();
  /* Group derived from the invitation, same posture as accept. */
  const inv = projectInvitation(events, invitation_id, now);
  if (!inv) return { ok: false, message: "הזמנה זו אינה קיימת" };
  if (!isOpen(inv)) return { ok: false, message: `לא ניתן לבטל — ${inv.state}` };

  const leaders = await resolveRealGroupLeaders(inv.group_id);
  if (!leaders.some((l) => l.person_id === viewer.person_id)) {
    return { ok: false, message: "רק רכז/ת מאומת/ת של הקבוצה יכול/ה לבטל הזמנה" };
  }

  try {
    appendGroupEvents([ev({
      event_id: `ge_${invitation_id}_revoked`,
      group_id: inv.group_id,
      event_type: "INVITATION_REVOKED",
      occurred_at: now, recorded_at: now,
      actor_id: viewer.person_id,
      object_id: invitation_id,
      source: "ביטול הזמנה — Community",
      provenance: "REAL",
      status: "REJECTED",
    })]);
  } catch (err) {
    return { ok: false, message: err instanceof GroupEventRejectedError ? err.message : String(err) };
  }
  return { ok: true, state: "REVOKED" };
}

export async function revokeInvitationAction(formData: FormData): Promise<DecideResult> {
  const r = await revokeInvitationCore(formData);
  if (r.ok) revalidatePath("/hub/community");
  return r;
}
