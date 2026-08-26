/**
 * INVITATION — the join path, projected from the group event log.
 *
 * NO STORE OF ITS OWN. `groupEventStore` is append-only, validated, and
 * already carries `MEMBER_JOINED`; an invitation is a sequence of events in
 * that same log. A second store would mean two answers to "is this person a
 * member", which is the failure the operational spine exists to prevent.
 *
 * THE TOKEN IS NEVER STORED. `issueToken()` returns a plaintext token to the
 * caller ONCE, for the link, and the log keeps only its SHA-256 hash. Anyone
 * who later reads the event log — or a backup of it — holds hashes and cannot
 * reconstruct a working link. Lookup is by hash, so the plaintext never has
 * to come back.
 *
 * MEMBERSHIP, ROLE AND CAPABILITY ARE THREE STATES. Accepting an invitation
 * makes someone a member and nothing else. A proposed role travels on the
 * invitation as a PROPOSAL and is projected as `NOT_GRANTED`; granting it is
 * a separate decision by an authority, and this module has no path that
 * grants one.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import type { GroupEvent } from "./groupEvent";

/** DRAFT is pre-persistence (an unsubmitted form) and never appears in the log. */
export type InvitationState =
  | "ISSUED" | "VIEWED" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "REVOKED";

export interface InvitationView {
  invitation_id: string;
  group_id: string;
  /** The person who issued it. Never the invitee. */
  inviter_id: string;
  /**
   * WHO THIS INVITATION IS FOR — bound at issue time.
   *
   * Without this an invitation is a bearer token: whoever holds the link and
   * is signed in becomes a member, so a forwarded or leaked link admits a
   * stranger. Accept and Decline compare the session's `person_id` against
   * this field and refuse on any mismatch, including absence.
   */
  invitee_person_id: string | null;
  state: InvitationState;
  issued_at: string;
  expires_at: string;
  /** Set only once someone accepted, and only ever to that person. */
  accepted_by: string | null;
  /** A PROPOSAL carried on the invitation. Acceptance does not grant it. */
  proposed_role: string | null;
  /** Always NOT_GRANTED here — this module cannot grant a role. */
  role_status: "NOT_GRANTED";
  capability_status: "NOT_GRANTED";
  consent_ref: string | null;
}

/* ── Token ───────────────────────────────────────────────────────────── */

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Constant-time compare, so a wrong token cannot be found by timing it. */
export function tokenMatches(token: string, storedHash: string): boolean {
  const a = Buffer.from(hashToken(token), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ── Projection ──────────────────────────────────────────────────────── */

export interface InvitationPayload {
  token_hash: string;
  expires_at: string;
  /** The intended recipient. Absent on legacy rows — treated as unbound. */
  invitee_person_id?: string;
  proposed_role?: string;
  consent_ref?: string;
}

const p = (e: GroupEvent) => (e.payload ?? {}) as Partial<InvitationPayload>;

/**
 * Fold the log into one invitation's current state.
 *
 * Terminal states are TERMINAL: once accepted, declined or revoked, a later
 * event of any kind cannot move it. That is what makes replaying a captured
 * accept request harmless — the second one finds a state that no longer
 * transitions.
 *
 * EXPIRY IS DERIVED, never written: an invitation that ran out of time did
 * not have something done to it, and inventing an event for the passage of
 * time would put a fact in the log that no actor produced.
 */
export function projectInvitation(
  events: readonly GroupEvent[],
  invitation_id: string,
  now: string,
): InvitationView | null {
  const mine = events
    .filter((e) => e.object_id === invitation_id && e.event_type.startsWith("INVITATION_"))
    .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
  const issued = mine.find((e) => e.event_type === "INVITATION_ISSUED");
  if (!issued) return null;

  const view: InvitationView = {
    invitation_id,
    group_id: issued.group_id,
    inviter_id: issued.actor_id ?? "",
    invitee_person_id: p(issued).invitee_person_id ?? null,
    state: "ISSUED",
    issued_at: issued.occurred_at,
    expires_at: p(issued).expires_at ?? issued.occurred_at,
    accepted_by: null,
    proposed_role: p(issued).proposed_role ?? null,
    role_status: "NOT_GRANTED",
    capability_status: "NOT_GRANTED",
    consent_ref: null,
  };

  for (const e of mine) {
    if (view.state === "ACCEPTED" || view.state === "DECLINED" || view.state === "REVOKED") break;
    switch (e.event_type) {
      case "INVITATION_VIEWED": view.state = "VIEWED"; break;
      case "INVITATION_ACCEPTED":
        view.state = "ACCEPTED";
        view.accepted_by = e.actor_id ?? null;
        view.consent_ref = p(e).consent_ref ?? null;
        break;
      case "INVITATION_DECLINED": view.state = "DECLINED"; break;
      case "INVITATION_REVOKED": view.state = "REVOKED"; break;
      default: break;
    }
  }

  /* Expiry applies only while the invitation is still open. An accepted
     invitation does not become expired by the clock moving on. */
  if ((view.state === "ISSUED" || view.state === "VIEWED") && now > view.expires_at) {
    view.state = "EXPIRED";
  }
  return view;
}

/** Every invitation in the log, newest first. Used by the Community panel. */
export function projectAllInvitations(
  events: readonly GroupEvent[],
  now: string,
): InvitationView[] {
  const ids = [...new Set(events
    .filter((e) => e.event_type === "INVITATION_ISSUED")
    .map((e) => e.object_id))];
  return ids
    .map((id) => projectInvitation(events, id, now))
    .filter((v): v is InvitationView => v !== null)
    .sort((a, b) => b.issued_at.localeCompare(a.issued_at));
}

/** Find an invitation by the token a link carries. Hash lookup, never plaintext. */
export function findByToken(
  events: readonly GroupEvent[],
  token: string,
  now: string,
): InvitationView | null {
  const issued = events.find((e) =>
    e.event_type === "INVITATION_ISSUED" &&
    typeof p(e).token_hash === "string" &&
    tokenMatches(token, p(e).token_hash!));
  return issued ? projectInvitation(events, issued.object_id, now) : null;
}

/** Only an open invitation can be accepted or declined. */
export function isOpen(v: InvitationView): boolean {
  return v.state === "ISSUED" || v.state === "VIEWED";
}

/* ── Recipient binding ───────────────────────────────────────────────── */

export type RecipientCheck =
  | { ok: true }
  | { ok: false; reason: "unbound" | "no_identity" | "not_the_recipient" };

/**
 * May this viewer decide this invitation?
 *
 * FAILS CLOSED IN THREE DIRECTIONS, and they are distinguished because they
 * call for different answers:
 *   `unbound`          the invitation names no recipient (a legacy row, or
 *                      one written before binding existed). Refused rather
 *                      than treated as "anyone", which is what made a bearer
 *                      token dangerous in the first place.
 *   `no_identity`      the session resolved to nobody.
 *   `not_the_recipient` a real person, but not this invitation's.
 *
 * A DEMO identity is not special-cased here: it simply is not the bound
 * `invitee_person_id`, so it lands in `not_the_recipient` like any other
 * stranger.
 */
export function checkRecipient(
  v: InvitationView,
  viewerPersonId: string | null | undefined,
): RecipientCheck {
  if (!v.invitee_person_id) return { ok: false, reason: "unbound" };
  if (!viewerPersonId) return { ok: false, reason: "no_identity" };
  if (viewerPersonId !== v.invitee_person_id) return { ok: false, reason: "not_the_recipient" };
  return { ok: true };
}

export const RECIPIENT_MESSAGE: Record<
  Exclude<RecipientCheck, { ok: true }>["reason"], string
> = {
  unbound: "הזמנה זו אינה קשורה לנמען מזוהה ולא ניתן לקבלה",
  no_identity: "נדרשת התחברות כדי להכריע בהזמנה",
  not_the_recipient: "הזמנה זו נועדה לאדם אחר",
};
