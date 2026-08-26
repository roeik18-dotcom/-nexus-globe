"use server";

/**
 * LOOP 1 (Product Convergence Autostrada) — the first UI-reachable write
 * path for a real canon Observation. Every rule/field-building/validation
 * decision below reuses existing canon primitives verbatim
 * (`recordObservationAction`, `parseOffsetInstant`'s own offset format,
 * `REAL_CURRENT_SUBJECT`) — nothing here reimplements canon.
 *
 * Identity: same discipline as `app/hub/actions.ts::joinGroupAction` — no
 * person parameter is accepted from the client. `subject` is always
 * `REAL_CURRENT_SUBJECT` server-side, so this action can only ever record
 * the single real local user's own self-report, never a forged subject.
 *
 * Scope, deliberately minimal (a real MVP, not the full 9-cell surface):
 * Frame is restricted to I (individual) / R (relational) — S (systemic)
 * requires a `systemicChannel` and is left for a later loop rather than
 * guessing one. `reference`, `deficitType`, `stability`, `provenance` are
 * given real, stated defaults (not hidden from the user — surfaced in the
 * form's own copy) rather than exposing 12 raw canon fields in a first
 * form; those remain the sanctioned research surfaces
 * (`recordObservationAction`, the internal bearer-token API) for anyone
 * who needs the full field set.
 */
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { resolveViewerContext } from "@/app/lib/philos/identity/viewerContext";
import { recordAuthenticatedObservation } from "./observationWriter";
import { projectCanonDynamics } from "./projectCanonDynamics";
import type { Domain, Frame, Observation } from "./observation";
import { normalizeAnalysisUnitIds } from "../analysisUnitIds";

/** LOOP A005/A006 — the real prior state for this SAME (subject, domain,
 *  frame) cell, if one exists. `null` means genuinely checked, none found
 *  (this is the first real Observation ever recorded for this cell) — the
 *  honest gating reason for "no derived state change is canonically
 *  justified", never a silently-omitted field. */
export interface ObservationStateSnapshot {
  level: number;
  stability: number;
  observed_at: string;
  canon_event_id: string;
}

export type CreateObservationResult =
  | {
      ok: true;
      canon_event_id: string;
      /** LOOP A004 — the exact real, persisted values, echoed back for an
       *  honest confirmation ("RECORDED / entity id / state affected /
       *  confidence / time") — never re-derived or approximated, the
       *  literal fields just written to the store. */
      domain: Domain;
      frame: Frame;
      confidence: number;
      time: string;
      /** LOOP A005/A006 — the most recent REAL prior Observation for this
       *  exact (subject, domain, frame) cell, chronological only (never a
       *  causal claim) — `null` when none exists yet. */
      before: ObservationStateSnapshot | null;
      /** This Observation's own real, just-persisted level/stability. */
      after: { level: number; stability: number };
      /** Real arithmetic difference, `null` when `before` is `null` — a
       *  state CANNOT be "canonically justified" as changed without a real
       *  prior measurement to compare against; this is the exact gating
       *  reason surfaced to the UI, not an invented threshold. */
      delta: { level: number; stability: number } | null;
      gatingReason: string | null;
    }
  | { ok: false; message: string };

const OBSERVATION_EXPIRY_DAYS = 14;

const PROJECTING_ROUTES = ["/hub", "/brain", "/dynamics", "/hub/community", "/planet"] as const;

function isDomain(v: FormDataEntryValue | null): v is Domain {
  return v === "G" || v === "E" || v === "C";
}
function isFrame(v: FormDataEntryValue | null): v is "I" | "R" {
  return v === "I" || v === "R";
}

/**
 * The testable core: validation + Observation construction + persistence,
 * with NO `revalidatePath` call — mirrors `app/hub/actions.ts`'s own
 * command/action split (a command has no cache-revalidation side effect;
 * only its thin server-action wrapper does), so this can be unit-tested
 * directly instead of only reachable through a live Next.js request.
 */
export async function recordObservationFromForm(formData: FormData): Promise<CreateObservationResult> {
/* WRITE AUTHORITY comes from the VIEWER, not from a module-level constant.
     The client could never set this field — that part was already right — but
     it was bound to `REAL_CURRENT_SUBJECT`, so every write in the product was
     authored by person_roei regardless of who was acting. Server-bound and
     viewer-bound are two different properties; only the first was true. */
  const viewer = await resolveViewerContext();
  const domainRaw = formData.get("domain");
  const frameRaw = formData.get("frame");
  const levelRaw = formData.get("level");
  const confidenceRaw = formData.get("confidence");
  const context = String(formData.get("context") ?? "").trim();
  /* EXPLICIT HUMAN CLASSIFICATION. Whatever checkboxes the person ticked,
     normalised: unknown ids dropped, duplicates collapsed, canonical order.
     Absent or empty is a legitimate answer and stays absent on the record. */
  const analysisUnits = normalizeAnalysisUnitIds(formData.getAll("analysis_unit_ids"));

  if (!isDomain(domainRaw)) return { ok: false, message: "domain חייב להיות אחד מ-G/E/C" };
  if (!isFrame(frameRaw)) return { ok: false, message: "frame חייב להיות I או R בטופס זה (S דורש systemicChannel — לולאה נפרדת)" };
  if (context === "") return { ok: false, message: "context לא יכול להיות ריק" };

  const level = Number(levelRaw);
  const confidence = Number(confidenceRaw);
  if (!Number.isFinite(level)) return { ok: false, message: "level חייב להיות מספר" };
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return { ok: false, message: "confidence חייב להיות בין 0 ל-1" };

  const now = new Date();
  const expiry = new Date(now.getTime() + OBSERVATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const domain: Domain = domainRaw;
  const frame: Frame = frameRaw;

  const observation: Observation = {
    subject: viewer.subject_id,
    domain,
    frame,
    reference: "self_baseline",
    context,
    time: now.toISOString(),
    provenance: "self_reported",
    confidence,
    expiry: expiry.toISOString(),
    level,
    stability: 0,
    deficitType: "RELATIVE",
    /* Omitted entirely when nothing was selected, so an unclassified
       Observation is byte-identical to one written before this field. */
    ...(analysisUnits.length > 0 ? { analysis_unit_ids: analysisUnits } : {}),
  };

  const canon_event_id = randomUUID();
  /* THE ONE WRITER PERMITTED TO DECLARE `REAL`, and the reasons it qualifies:
     this is a `"use server"` action, so it runs server-side only; `subject`
     is `viewer.subject_id` resolved server-side by `resolveViewerContext()`
     and never accepted from the client; and the content is a person's own
     self-report submitted through the real form.

     `record_origin` is NOT read from `formData` — not here, not anywhere. A
     client that posts `record_origin=REAL` in the form body changes nothing,
     because the value below is a literal and the submitted field is never
     consulted. That is the whole spoof defence: not a filter that strips a
     client value, but a writer that never looks. */
  const result = await recordAuthenticatedObservation(
    canon_event_id, observation, now.toISOString(),
  );
  if (!result.ok) return { ok: false, message: result.message };

  // LOOP A005/A006 — the real prior state for this SAME cell, found the
  // exact same way `resolveCoreContext`'s STATE+TIME lookup already does
  // (chronological only, same subject/domain/frame, never causal): the
  // most recent mark strictly before this one, if any real one exists.
  let before: ObservationStateSnapshot | null = null;
  try {
    const canon = await projectCanonDynamics();
    const priorCandidates = canon.nodes
      .filter((n) => n.subject === viewer.subject_id && n.domain === domain && n.frame === frame && n.canon_event_id !== result.canon_event_id && n.observed_at <= observation.time)
      .sort((a, b) => b.observed_at.localeCompare(a.observed_at));
    const prior = priorCandidates[0];
    if (prior) before = { level: prior.level, stability: prior.stability, observed_at: prior.observed_at, canon_event_id: prior.canon_event_id };
  } catch {
    before = null; // a read failure here must not hide the (already-persisted) write's own confirmation
  }

  const after = { level, stability: observation.stability };
  const delta = before ? { level: after.level - before.level, stability: after.stability - before.stability } : null;
  const gatingReason = before
    ? null
    : "no real prior Observation exists for this exact (subject, domain, frame) cell yet — a state change cannot be canonically justified against nothing; this is the first real measurement for this cell.";

  return { ok: true, canon_event_id: result.canon_event_id, domain, frame, confidence, time: observation.time, before, after, delta, gatingReason };
}

/** The network edge — the ONE place this write path revalidates the
 *  projecting screens, same discipline as `app/hub/actions.ts::commit`. */
export async function createObservationForCurrentUser(formData: FormData): Promise<CreateObservationResult> {
  const result = await recordObservationFromForm(formData);
  if (result.ok) {
    for (const route of PROJECTING_ROUTES) revalidatePath(route);
  }
  return result;
}
