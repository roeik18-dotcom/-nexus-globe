"use server";

/**
 * LOOP 4 (Product Convergence Autostrada) — the first UI-reachable use of
 * `evaluateMatch` against REAL, persisted Need/Offer records.
 *
 * **Deliberately NOT persisted — a reasoned deviation from the loop's
 * literal "persist Match state" instruction, not an oversight.**
 * `matching.ts`'s own header (unmodified by this pass) and
 * `PERSISTENCE_POLICY.md` document why: "No history of past match
 * attempts is stored (would risk becoming a contribution/reputation
 * signal, §21)." Storing every match attempt this user ever tried against
 * their own Needs/Offers would build exactly the kind of standing
 * behavioral profile this codebase's own NO_GLOBAL_HUMAN_SCORE-adjacent
 * invariants forbid. `evaluateMatch` stays what it already was: a pure,
 * derived, recomputed-every-call function. This action calls it live and
 * returns the result for display — it does not add a store.
 *
 * Real, not degenerate: with exactly one real subject in this
 * environment, a real match is necessarily self ↔ self today (the same
 * person's own Need against their own Offer) — still a real exercise of
 * the 6 canonical gates (CAN/WANTS/ALLOWED/APPROPRIATE/AVAILABLE/CONSENT)
 * against real persisted records, not fabricated ones. A second real
 * participant is a separate, later capability (blocked on session/auth
 * architecture, not on this action).
 */
import { loadNeeds } from "./needStoreAccessor";
import { loadOffers } from "./offerStoreAccessor";
import { evaluateMatch, validateMatchAttempt, type MatchAttempt, type MatchResult } from "./matching";
import { resolveViewerContext } from "@/app/lib/philos/identity/viewerContext";
import { issueMatchPermit, type MatchPermit } from "./matchPermit";
import { systemClock } from "@/app/lib/philos/eventStore";

export type EvaluateMatchResult =
  /** `permit` is present iff `result.decision === "permitted"` — see
   *  `matchPermit.ts`'s own header on why it's issued only here, never
   *  fabricated elsewhere. Match→Action integrity gate. */
  | { ok: true; result: MatchResult; permit?: MatchPermit }
  | { ok: false; message: string };

const GATES = ["CAN", "WANTS", "ALLOWED", "APPROPRIATE", "AVAILABLE", "CONSENT"] as const;

export async function evaluateMatchForCurrentUser(formData: FormData): Promise<EvaluateMatchResult> {
/* WRITE AUTHORITY comes from the VIEWER, not from a module-level constant.
     The client could never set this field — that part was already right — but
     it was bound to `REAL_CURRENT_SUBJECT`, so every write in the product was
     authored by person_roei regardless of who was acting. Server-bound and
     viewer-bound are two different properties; only the first was true. */
  const viewer = await resolveViewerContext();
  const need_id = String(formData.get("need_id") ?? "").trim();
  const offer_id = String(formData.get("offer_id") ?? "").trim();
  const context = String(formData.get("context") ?? "").trim();

  if (need_id === "") return { ok: false, message: "בחר Need אמיתי" };
  if (offer_id === "") return { ok: false, message: "בחר Offer אמיתי" };
  if (context === "") return { ok: false, message: "context לא יכול להיות ריק" };

  const needs = await loadNeeds();
  const offers = await loadOffers();
  const needRecord = needs.find((r) => r.need.need_id === need_id);
  const offerRecord = offers.find((r) => r.offer.offer_id === offer_id);
  if (!needRecord) return { ok: false, message: "Need לא נמצא — ייתכן שלא נרשם" };
  if (!offerRecord) return { ok: false, message: "Offer לא נמצא — ייתכן שלא נרשם" };

  const gates: Record<(typeof GATES)[number], boolean> = {
    CAN: formData.get("CAN") === "on",
    WANTS: formData.get("WANTS") === "on",
    ALLOWED: formData.get("ALLOWED") === "on",
    APPROPRIATE: formData.get("APPROPRIATE") === "on",
    AVAILABLE: formData.get("AVAILABLE") === "on",
    CONSENT: formData.get("CONSENT") === "on",
  };

  const attempt: MatchAttempt = {
    match_id: `eval_${Date.now()}`,
    need_ref: needRecord.need.need_id,
    offer_ref: offerRecord.offer.offer_id,
    source: viewer.subject_id,
    target: viewer.subject_id,
    cell: offerRecord.offer.source_cell,
    context,
    time: new Date().toISOString(),
    ...gates,
  };

  const structural = validateMatchAttempt(attempt);
  if (!structural.valid) {
    return { ok: false, message: `attempt מעורער מבנית: ${structural.errors.map((e) => `${e.field}: ${e.reason}`).join("; ")}` };
  }

  const result = evaluateMatch(attempt, needRecord.need, offerRecord.offer);
  const permit = result.decision === "permitted" ? issueMatchPermit(need_id, offer_id, systemClock.now()) : undefined;
  return { ok: true, result, permit };
}
