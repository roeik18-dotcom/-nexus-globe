"use server";

/**
 * Real registration server actions for Marketplace's REAL DEMAND/SUPPLY
 * sections (Marketplace Legacy Convergence pass). Both `ingestNeed`
 * (already existed) and `ingestOffer` (new this pass, `offerIngestion.ts`)
 * require a FULLY EXPLICIT record — nothing here infers a field the
 * caller didn't supply. `subject`/`source` is resolved server-side via
 * `REAL_CURRENT_SUBJECT`, never taken from the client, matching the same
 * "cannot forge a different identity" posture `app/hub/actions.ts`/
 * `identityLinkActions.ts` already establish.
 */
import { revalidatePath } from "next/cache";

import { REAL_CURRENT_SUBJECT } from "@/app/lib/philos/subjectRegistry";
import { createIdGenerator, systemClock } from "@/app/lib/philos/eventStore";
import { ingestNeed } from "@/app/lib/philos/canon/needIngestion";
import { ingestOffer } from "@/app/lib/philos/canon/offerIngestion";
import type { Domain } from "@/app/lib/philos/canon/observation";

export type RegisterActionResult =
  | { ok: true; id: string }
  | { ok: false; message: string };

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/** Testable core — no `revalidatePath` (same command/action split as
 *  `app/lib/philos/canon/observationFormAction.ts`'s LOOP 1 convention),
 *  so this is reachable outside a live Next.js request. */
export async function registerNeedCore(formData: FormData): Promise<RegisterActionResult> {
  const desired_change = String(formData.get("desired_change") ?? "").trim();
  const domain = String(formData.get("domain") ?? "E") as Domain;
  if (!desired_change) return { ok: false, message: "desired_change is required" };

  // §52 (Product Convergence Autostrada, LOOP 2 consolidation): `context` is
  // now a real, caller-supplied field — accurate regardless of which real
  // surface (Marketplace or Community) calls this SAME action, rather than a
  // string naming one specific route regardless of where the write actually
  // came from. Existing callers that don't send it keep working via the
  // generic, honest fallback.
  const context = String(formData.get("context") ?? "").trim() || "self-reported real demand";

  const now = systemClock.now();
  const ids = createIdGenerator();
  const result = await ingestNeed({
    need: {
      need_id: ids.next("need"),
      subject: REAL_CURRENT_SUBJECT,
      desired_change,
      scope: { kind: "domain", domain },
      provenance: "self_reported",
      context,
      time: now,
      expiry: addDays(now, 30),
      consent_scope: "visible_to_marketplace_matching",
    },
    recorded_at: now,
    status: "open",
  });

  if (!result.ok) return { ok: false, message: result.reason === "invalid" ? "invalid Need" : result.rejections.map((r) => r.message).join("; ") };
  return { ok: true, id: result.need_id };
}

/** Network edge — registers a real, explicit Need for the real current
 *  subject, then revalidates every screen that projects it. Every field
 *  the form doesn't ask for is a fixed, honest, stated default — never
 *  inferred from anything implicit. */
export async function registerNeedAction(formData: FormData): Promise<RegisterActionResult> {
  const result = await registerNeedCore(formData);
  if (result.ok) {
    revalidatePath("/marketplace");
    revalidatePath("/hub/community");
  }
  return result;
}

/** Testable core — no `revalidatePath`. See `registerNeedCore`. */
export async function registerOfferCore(formData: FormData): Promise<RegisterActionResult> {
  const available_resource = String(formData.get("available_resource") ?? "").trim();
  const resource_type = String(formData.get("resource_type") ?? "").trim();
  const amount_or_capacity = String(formData.get("amount_or_capacity") ?? "").trim();
  const domain = String(formData.get("domain") ?? "E") as Domain;
  if (!available_resource || !resource_type || !amount_or_capacity) {
    return { ok: false, message: "available_resource, resource_type, and amount_or_capacity are required" };
  }

  // §52 (Product Convergence Autostrada, LOOP 3 fix): `willingness`/`consent`
  // are canon's own CONSENT gate (§10) — a real per-submission checkbox the
  // user must actually check, never hardcoded `true` regardless of what they
  // submitted. The prior version of this action defaulted both to `true`
  // unconditionally, which fabricated consent that was never actually given
  // — corrected here, not silently left in place once found.
  const willingness = formData.get("willingness") === "on";
  const consent = formData.get("consent") === "on";
  if (!willingness) return { ok: false, message: "willingness — יש לאשר במפורש (canon §10 CONSENT gate)" };
  if (!consent) return { ok: false, message: "consent — יש לאשר במפורש (canon §10 CONSENT gate)" };

  const now = systemClock.now();
  const ids = createIdGenerator();
  const result = await ingestOffer({
    offer: {
      offer_id: ids.next("offer"),
      source: REAL_CURRENT_SUBJECT,
      source_cell: { domain, frame: "I" },
      available_resource,
      resource_type,
      amount_or_capacity,
      competence: "self-declared, unverified",
      willingness,
      consent,
      availability: "unspecified",
      cost: "none stated",
      constraints: [],
      expiry: addDays(now, 30),
      provenance: "self_reported",
    },
    recorded_at: now,
  });

  if (!result.ok) return { ok: false, message: result.reason === "invalid" ? "invalid Offer" : result.rejections.map((r) => r.message).join("; ") };
  return { ok: true, id: result.offer_id };
}

/** Network edge — registers a real, explicit Offer sourced from the real
 *  current subject, then revalidates every screen that projects it. Same
 *  "explicit only, no inference" discipline as `registerNeedAction`. */
export async function registerOfferAction(formData: FormData): Promise<RegisterActionResult> {
  const result = await registerOfferCore(formData);
  if (result.ok) {
    revalidatePath("/marketplace");
    revalidatePath("/hub/community");
  }
  return result;
}
