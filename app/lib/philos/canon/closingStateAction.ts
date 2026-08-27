"use server";

/**
 * RECORD A CLOSING STATE — THE PERSON SUPPLIES THE READING, THE SERVER SUPPLIES
 * THE PROVENANCE.
 *
 * There was one path to a State(t1) and it was the `level + 1` transition rule,
 * which the screen itself labels experimental: it derives the new level by
 * arithmetic rather than asking the person what they actually observe. A day
 * closed on an arithmetic guess is a day closed on a number nobody read.
 *
 * Here the split is explicit. `level`, `confidence` and `evidence` are the
 * person's — nothing computes them. `subject`, `provenance` and
 * `caused_by_ref` are the server's, derived from the Action and Effect that
 * were actually recorded, and no FormData field can reach them.
 *
 * THE CAUSE IS THE EFFECT, NOT THE ACTION. A closing state is what the day
 * ended up at, and what the day produced is its Effect. The Action is checked
 * as the Effect's own `action_ref`, so a mismatched pair is refused rather
 * than quietly recorded as a chain that never existed.
 */
import { revalidatePath } from "next/cache";

import { resolveViewerContext } from "../identity/viewerContext";
import { createIdGenerator, systemClock } from "@/app/lib/philos/eventStore";
import { loadActions } from "./actionStoreAccessor";
import { loadEffects } from "./effectStoreAccessor";
import { domainStateStore } from "./domainStateStoreAccessor";
import { isActionAdmissible } from "./actionStore";
import { isEffectAdmissible } from "./effectStore";

export type ClosingStateResult =
  | { ok: true; state_id: string; caused_by_ref: string }
  | { ok: false; message: string };

export async function recordClosingStateCore(formData: FormData): Promise<ClosingStateResult> {
  const viewer = await resolveViewerContext();

  const domain_id = String(formData.get("domain_id") ?? "").trim();
  const parameter_id = String(formData.get("parameter_id") ?? "").trim();
  const levelRaw = String(formData.get("level") ?? "").trim();
  const confRaw = String(formData.get("confidence") ?? "").trim();
  const evidence = String(formData.get("evidence") ?? "").trim();
  const action_id = String(formData.get("action_id") ?? "").trim();
  const effect_id = String(formData.get("effect_id") ?? "").trim();

  /* THE PERSON'S THREE VALUES. Refused when absent — a closing state with an
     invented level would be the arithmetic rule under another name. */
  if (!domain_id || !parameter_id) return { ok: false, message: "יש לבחור פרמטר" };
  const level = Number(levelRaw);
  const confidence = Number(confRaw);
  if (levelRaw === "" || !Number.isFinite(level)) return { ok: false, message: "level — יש להזין מספר" };
  if (confRaw === "" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    return { ok: false, message: "confidence — יש להזין מספר בין 0 ל-1" };
  }
  if (!evidence) return { ok: false, message: "evidence — יש לכתוב על מה זה מבוסס" };

  /* THE CHAIN, RE-READ FROM THE STORE. The submitted ids are untrusted until
     proven to name this viewer's own admissible records. */
  const [actions, effects] = await Promise.all([loadActions(), loadEffects()]);

  const action = actions.find((r) => r.action?.action_id === action_id);
  if (!action) return { ok: false, message: "הפעולה שנבחרה אינה קיימת במאגר" };
  if (action.action.owner !== viewer.subject_id) {
    return { ok: false, message: "הפעולה שנבחרה שייכת לאדם אחר" };
  }
  if (!isActionAdmissible(action)) {
    return { ok: false, message: "לפעולה שנבחרה אין מקור REAL" };
  }

  const effect = effects.find((r) => r.effect?.effect_id === effect_id);
  if (!effect) return { ok: false, message: "התוצאה שנבחרה אינה קיימת במאגר" };
  if (effect.effect.subject !== viewer.subject_id) {
    return { ok: false, message: "התוצאה שנבחרה שייכת לאדם אחר" };
  }
  if (!isEffectAdmissible(effect)) {
    return { ok: false, message: "לתוצאה שנבחרה אין מקור REAL" };
  }
  /* The pair must actually be a pair. */
  if (effect.effect.action_ref !== action_id) {
    return { ok: false, message: "התוצאה שנבחרה אינה מקושרת לפעולה שנבחרה" };
  }

  const now = systemClock.now();
  const record = {
    state_id: createIdGenerator().next("dstate"),
    recorded_at: now,
    /* SERVER-DERIVED. The Effect is what the day produced, so it is the cause. */
    caused_by_ref: effect_id,
    state: {
      subject: viewer.subject_id,          // server-derived
      provenance: "REAL" as const,         // server-derived
      domain_id, parameter_id, level, confidence,
      observed_at: now,
      ...(evidence ? { evidence } : {}),
    },
  };

  const [stored] = await domainStateStore().append([record as never]);
  return { ok: true, state_id: stored.state_id, caused_by_ref: effect_id };
}

export async function recordClosingState(formData: FormData): Promise<ClosingStateResult> {
  const r = await recordClosingStateCore(formData);
  if (r.ok) { revalidatePath("/hub"); revalidatePath("/hub/human-config"); }
  return r;
}
