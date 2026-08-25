"use server";

/**
 * MATCH REQUEST → AUTHORITY DECISION — the one write path this pass adds.
 *
 * Closes the exact gap the Marketplace visual-acceptance pass found: the
 * group operational spine (`groupEvent.ts` / `groupOperationalState.ts`)
 * already models `MATCH_PROPOSED` → `MATCH_ACCEPTED`/`MATCH_REJECTED` and
 * `appendGroupEvents` already validates and persists them — but nothing in
 * the product ever called it. This is that call, and only that call:
 *
 *   - No new authority model. `resolveGroupLeaders` (`groupAuthority.ts`)
 *     reuses the SAME `LeaderView[]` / `projectValueGroup()` every other
 *     terminal already reads. A person decides iff they are already a real
 *     appointed leader of the group the NEED belongs to — nothing here
 *     invents a role, a permission, or a second way to become one.
 *   - No fuzzy trust of the client. Both actions RE-DERIVE the candidate
 *     (`deriveCandidateMatches`, via `loadValueGroupWorld`) and the existing
 *     match state server-side rather than accepting whatever a form field
 *     claims — same posture `matchEvalAction.ts` and `needGroupLinkActions.ts`
 *     already hold.
 *   - ACTION_PROPOSED / ACTION_STARTED / ACTION_COMPLETED stay OUT of scope.
 *     A request that reaches ACCEPTED is a decision, not yet work — this
 *     module writes no Action event of any kind.
 */
import { revalidatePath } from "next/cache";

import { resolveViewerContext } from "@/app/lib/philos/identity/viewerContext";
import { systemClock } from "@/app/lib/philos/eventStore";
import { loadValueGroupWorld } from "./loadValueGroupWorld";
import { appendGroupEvents, GroupEventRejectedError } from "./groupEventStore";
import type { GroupEvent } from "./groupEvent";
import type { MatchState } from "./groupOperationalState";
import { resolveRealGroupLeaders } from "./groupAuthority";

export type MatchRequestResult =
  | { ok: true; match_id: string }
  | { ok: false; message: string };

/** Testable core — no `revalidatePath`, same command/action split every
 *  other real Marketplace action in this codebase already follows
 *  (`app/marketplace/actions.ts::registerNeedCore`). */
export async function requestMatchApprovalCore(formData: FormData): Promise<MatchRequestResult> {
  const viewer = await resolveViewerContext();
  const need_ref = String(formData.get("need_ref") ?? "").trim();
  const resource_ref = String(formData.get("resource_ref") ?? "").trim();
  if (!need_ref || !resource_ref) {
    return { ok: false, message: "need_ref and resource_ref are both required" };
  }

  /* RE-DERIVED, never trusted from the client. `candidateMatches` already
     excludes any pair with a recorded ACCEPTED/REJECTED decision
     (`pendingCandidates`), so a decided pair fails here with "not a real
     candidate" rather than silently re-opening. */
  const world = await loadValueGroupWorld({});
  const candidate = world.candidateMatches.find(
    (c) => c.need_ref === need_ref && c.resource_ref === resource_ref,
  );
  if (!candidate) {
    return { ok: false, message: "צמד זה אינו מועמדת התאמה פתוחה כרגע — ייתכן שהוכרע כבר, או שהשדות שהתאימו השתנו" };
  }

  const existing = [...world.operational.values()]
    .flatMap((s) => s.matches)
    .find((m) => m.match_id === candidate.match_id);
  if (existing) {
    return { ok: false, message: `כבר קיימת בקשה עבור צמד זה — סטטוס: ${existing.status}` };
  }

  const now = systemClock.now();
  const event: GroupEvent = {
    event_id: `ge_${candidate.match_id}_propose_${Date.now().toString(36)}`,
    group_id: candidate.need_group_id,
    event_type: "MATCH_PROPOSED",
    occurred_at: now,
    recorded_at: now,
    /* A PERSON requested this — `viewer.person_id` is the Value-Group log's
       id for the same human (`viewerContext.ts`), the same id space
       `leader.appointed`'s `person_id` already uses. */
    actor_id: viewer.person_id,
    object_id: candidate.match_id,
    source: "בקשת אישור התאמה — Marketplace",
    provenance: "REAL",
    status: "PROPOSED",
    payload: { need_ref: candidate.need_ref, resource_ref: candidate.resource_ref, basis: candidate.basis },
  };

  try {
    appendGroupEvents([event]);
  } catch (err) {
    return { ok: false, message: err instanceof GroupEventRejectedError ? err.message : String(err) };
  }
  return { ok: true, match_id: candidate.match_id };
}

/** Network edge. */
export async function requestMatchApprovalAction(formData: FormData): Promise<MatchRequestResult> {
  const result = await requestMatchApprovalCore(formData);
  if (result.ok) revalidatePath("/marketplace");
  return result;
}

export type DecideMatchResult =
  | { ok: true; status: "ACCEPTED" | "REJECTED" }
  | { ok: false; message: string };

/** Testable core — no `revalidatePath`. See `requestMatchApprovalCore`. */
export async function decideMatchRequestCore(formData: FormData): Promise<DecideMatchResult> {
  const viewer = await resolveViewerContext();
  /* THE CLIENT SUPPLIES TWO FIELDS, AND NEITHER NAMES A GROUP. `group_id` is
     deliberately NOT read from `formData` — see header, hardening A. */
  const match_id = String(formData.get("match_id") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  if (!match_id) return { ok: false, message: "match_id is required" };
  if (decision !== "ACCEPTED" && decision !== "REJECTED") {
    return { ok: false, message: 'decision must be exactly "ACCEPTED" or "REJECTED"' };
  }

  /* DERIVE the owning group by locating the match across every operational
     state. `operational` is projected from `loadGroupEvents()` — the real
     append-only group log — so a match found here is real by construction. */
  const world = await loadValueGroupWorld({});
  const hits: { group_id: string; match: MatchState }[] = [];
  for (const [group_id, state] of world.operational) {
    for (const m of state.matches) if (m.match_id === match_id) hits.push({ group_id, match: m });
  }

  if (hits.length === 0) {
    return { ok: false, message: "בקשת התאמה זו לא נמצאה בשדרה התפעולית" };
  }
  /* AMBIGUITY IS REFUSED, NOT RESOLVED. One match_id in two groups means the
     log disagrees with itself; picking either one would be inventing an
     answer the data does not contain. */
  if (hits.length > 1) {
    return {
      ok: false,
      message: `match_id זה מופיע ביותר מקבוצה אחת (${hits.map((h) => h.group_id).join(", ")}) — ההכרעה נדחתה`,
    };
  }

  const { group_id, match } = hits[0];
  if (match.status !== "CANDIDATE") {
    return { ok: false, message: `הבקשה כבר הוכרעה — סטטוס נוכחי: ${match.status}` };
  }
  /* A non-REAL match may not become a REAL decision event. */
  if (match.provenance !== "REAL") {
    return { ok: false, message: `בקשה שמקורה ${match.provenance} אינה יכולה להפוך להחלטה REAL` };
  }

  /* THE AUTHORITY GATE. REAL appointments only — a DEMO coordinator fails
     here exactly as a non-leader does. Fails closed for every reason: no
     such group in the real log, no leaders appointed, viewer is a member
     but not a leader, viewer leads a DIFFERENT group. */
  const leaders = await resolveRealGroupLeaders(group_id);
  if (!leaders.some((l) => l.person_id === viewer.person_id)) {
    return { ok: false, message: "רק רכז/ת מאומת/ת של הקבוצה יכול/ה להכריע בבקשת התאמה — הצפייה מותרת, ההכרעה לא" };
  }

  const now = systemClock.now();
  const event: GroupEvent = {
    event_id: `ge_${match_id}_${decision.toLowerCase()}_${Date.now().toString(36)}`,
    group_id,
    event_type: decision === "ACCEPTED" ? "MATCH_ACCEPTED" : "MATCH_REJECTED",
    occurred_at: now,
    recorded_at: now,
    actor_id: viewer.person_id,
    object_id: match_id,
    source: "החלטת רכז — Marketplace",
    provenance: "REAL",
    status: decision === "ACCEPTED" ? "CONFIRMED" : "REJECTED",
    payload: { need_ref: match.need_ref, resource_ref: match.resource_ref },
  };

  try {
    appendGroupEvents([event]);
  } catch (err) {
    return { ok: false, message: err instanceof GroupEventRejectedError ? err.message : String(err) };
  }
  return { ok: true, status: decision };
}

/** Network edge. */
export async function decideMatchRequestAction(formData: FormData): Promise<DecideMatchResult> {
  const result = await decideMatchRequestCore(formData);
  if (result.ok) revalidatePath("/marketplace");
  return result;
}
