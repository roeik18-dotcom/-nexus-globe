"use server";

/**
 * State-fusion backbone — the real write path for `DomainState`,
 * serving both Human Config state and Value Domain state through the
 * SAME real store (`domainStateStore.ts`). Mirrors
 * `observationFormAction.ts`/`effectFormAction.ts` exactly: `subject` is
 * always `REAL_CURRENT_SUBJECT`, never client-supplied; `provenance` is
 * always hardcoded `"REAL"` here — a caller cannot submit a `"DEMO"`
 * state through this real write path (DEMO data comes only from
 * `demoMusicDomain.ts`'s own hardcoded fixtures, never through this
 * action), keeping REAL/DEMO separation intact by construction, not by
 * convention.
 *
 * `domain_id`/`parameter_id` are free real text here, not constrained to
 * a fixed enum — matching `valueDomainConfig.ts`'s own design ("a
 * second, unrelated Value Domain could use it without any code change
 * here"). The caller (a real UI form) is responsible for offering real
 * canonical IDs where they exist (e.g. Human Config's own curated
 * `TEMPERAMENT_DIMENSIONS`) rather than free-typing them — this action
 * itself does not validate a parameter_id against any catalog, since the
 * whole point of the generic contract is that new domains need none.
 */
import { revalidatePath } from "next/cache";

import { domainStateStore } from "./domainStateStoreAccessor";
import { DomainStateAppendRejectedError, type DomainStateRecord } from "./domainStateStore";
import type { DomainState } from "../valueDomain/valueDomainConfig";
import { REAL_CURRENT_SUBJECT } from "@/app/lib/philos/subjectRegistry";
import { createIdGenerator, systemClock } from "@/app/lib/philos/eventStore";

export type CreateDomainStateResult =
  | { ok: true; state_id: string; domain_id: string; parameter_id: string; level: number }
  | { ok: false; message: string };

/** Testable core — no `revalidatePath`, same split as every other real
 *  write path in this directory. */
export async function createDomainStateForCurrentUserCore(formData: FormData): Promise<CreateDomainStateResult> {
  const domain_id = String(formData.get("domain_id") ?? "").trim();
  const parameter_id = String(formData.get("parameter_id") ?? "").trim();
  const levelRaw = formData.get("level");
  const confidenceRaw = formData.get("confidence");
  const evidence = String(formData.get("evidence") ?? "").trim();

  if (!domain_id) return { ok: false, message: "domain_id is required" };
  if (!parameter_id) return { ok: false, message: "parameter_id is required" };

  const level = Number(levelRaw);
  const confidence = Number(confidenceRaw);
  if (!Number.isFinite(level)) return { ok: false, message: "level must be a number" };
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return { ok: false, message: "confidence must be a number between 0 and 1" };

  const now = systemClock.now();
  const state: DomainState = {
    domain_id,
    parameter_id,
    subject: REAL_CURRENT_SUBJECT,
    level,
    confidence,
    observed_at: now,
    evidence: evidence || undefined,
    provenance: "REAL",
  };

  const record: DomainStateRecord = {
    state_id: createIdGenerator().next("dstate"),
    state,
    recorded_at: now,
  };

  try {
    const [stored] = await domainStateStore().append([record]);
    return { ok: true, state_id: stored.state_id, domain_id, parameter_id, level };
  } catch (e) {
    if (e instanceof DomainStateAppendRejectedError) return { ok: false, message: e.message };
    throw e;
  }
}

/** The network edge — records a real DomainState, then revalidates every
 *  screen that could project it. */
export async function createDomainStateForCurrentUser(formData: FormData): Promise<CreateDomainStateResult> {
  const result = await createDomainStateForCurrentUserCore(formData);
  if (result.ok) {
    revalidatePath("/hub/human-config");
    revalidatePath("/hub");
    revalidatePath("/dynamics");
  }
  return result;
}
