/**
 * ONE ACTION AND ITS EFFECT, READ ONCE, INTERPRETED SEVEN TIMES.
 *
 * Every terminal was answering "what happened today?" out of its own reader,
 * so the same pair of records appeared as ids on Hub, as a bare count on
 * Marketplace and Dynamics, and not at all on Community, Planet and World.
 * Seven readers produced seven different answers about two records.
 *
 * This is the single read model. It resolves the pair ONCE and then asks a
 * separate question per terminal: not "can I show this?" but "what does THIS
 * surface actually know about it, and what does it not?" A terminal that
 * cannot establish group, network or systemic meaning says exactly that, with
 * the ids still inspectable — because hiding a person's own record is as
 * dishonest as claiming it had world impact.
 *
 * NO NEW STORE, NO WRITER, NO COPY. It reads the two existing stores and
 * derives; nothing here mutates anything.
 */
import type { ActionRecord } from "../canon/actionStore";
import type { EffectRecord } from "../canon/effectStore";
import { actionOriginOf } from "../canon/actionStore";
import { effectOriginOf } from "../canon/effectStore";
import type { RecordOrigin } from "../recordOrigin";

/** Which terminals this model speaks for. The seven, and only the seven. */
export type ProjectionTerminal =
  | "hub" | "brain" | "dynamics" | "marketplace" | "community" | "planet" | "world";

/**
 * HOW FAR THIS PAIR'S MEANING ACTUALLY REACHES.
 *
 * Deliberately not a confidence score. A number would invite averaging, and
 * "0.4 systemic" is not a thing anyone can act on. These are the three claims
 * a terminal might want to make, and only the first is ever established by an
 * Action and an Effect on their own.
 */
export type Scope =
  /** One person acted and reported an outcome. Always true when the pair exists. */
  | "PERSONAL"
  /** An executable reference ties the Action to a group. Requires a real link. */
  | "GROUP_ATTRIBUTED"
  /** Relations/arcs carry it beyond the group. Requires network records. */
  | "NETWORK_PROPAGATED"
  /** Evidence establishes systemic effect. Requires far more than one Effect. */
  | "SYSTEMIC";

export interface ActionEffectPair {
  action_id: string;
  /** `null` when the Action has no Effect yet — a real state, not an error. */
  effect_id: string | null;
  day_ref: string | null;
  action_owner: string;
  effect_subject: string | null;
  action_origin: RecordOrigin;
  effect_origin: RecordOrigin | null;
  /** True only when the Effect names this exact Action. */
  linked: boolean;
  /** The furthest scope any record actually establishes. */
  scope: Scope;
}

/** What one terminal may say, and what it must admit it cannot say. */
export interface TerminalReading {
  terminal: ProjectionTerminal;
  /** What this surface can state from records it can actually reach. */
  knows: string;
  /** What it cannot establish. Never empty for the non-personal terminals. */
  does_not_know: string;
  /** Present when the terminal is structurally unable to infer more. */
  unresolved_reason?: string;
  /** The pair stays inspectable even where nothing can be claimed. */
  ids_inspectable: true;
}

export interface ActionEffectProjection {
  pairs: ActionEffectPair[];
  /** Records excluded, and why — never silently dropped. */
  excluded: { id: string; reason: string }[];
  /** REAL vs legacy, kept apart. */
  counts: { real: number; legacy: number; non_real: number };
}

export interface ProjectionInput {
  actions: readonly ActionRecord[];
  effects: readonly EffectRecord[];
  /** The viewer whose records these must be. Never widened. */
  subject_id: string;
  /**
   * An executable Action→group reference, when one exists. Supplied by the
   * caller that can read it; `[]` means NO group attribution is established,
   * which is the honest default rather than an optimistic one.
   */
  groupLinkedActionIds?: readonly string[];
  /** Network relation records. `[]` means no propagation is established. */
  networkRelationCount?: number;
}

/**
 * Resolve the pairs. Ownership is checked on BOTH records: an Effect whose
 * subject is someone else may not be attached to this person's Action merely
 * because its `action_ref` matches.
 */
export function projectActionEffects(input: ProjectionInput): ActionEffectProjection {
  const excluded: { id: string; reason: string }[] = [];
  const groupLinked = new Set(input.groupLinkedActionIds ?? []);

  const mine = input.actions.filter((r) => {
    if (r.action?.owner !== input.subject_id) {
      excluded.push({ id: r.action?.action_id ?? "(no id)", reason: "action.owner is a different subject" });
      return false;
    }
    return true;
  });

  const pairs: ActionEffectPair[] = mine.map((a) => {
    const action_id = a.action.action_id;
    const action_origin = actionOriginOf(a);

    /* The Effect must name THIS action and belong to the same subject. A
       matching `action_ref` alone is not enough — that is how one person's
       outcome could be shown as another's. */
    const candidates = input.effects.filter((e) => e.effect?.action_ref === action_id);
    const owned = candidates.filter((e) => {
      if (e.effect.subject !== input.subject_id) {
        excluded.push({ id: e.effect.effect_id, reason: "effect.subject is a different subject" });
        return false;
      }
      return true;
    });
    const e = owned[0];

    const scope: Scope =
      groupLinked.has(action_id)
        ? ((input.networkRelationCount ?? 0) > 0 ? "NETWORK_PROPAGATED" : "GROUP_ATTRIBUTED")
        : "PERSONAL";

    return {
      action_id,
      effect_id: e?.effect.effect_id ?? null,
      day_ref: (a.action as { day_ref?: string }).day_ref ?? null,
      action_owner: a.action.owner,
      effect_subject: e?.effect.subject ?? null,
      action_origin,
      effect_origin: e ? effectOriginOf(e) : null,
      linked: !!e,
      scope,
    };
  });

  const real = pairs.filter((p) => p.action_origin === "REAL").length;
  const legacy = pairs.filter((p) => p.action_origin === "UNKNOWN").length;
  return { pairs, excluded, counts: { real, legacy, non_real: pairs.length - real - legacy } };
}

/**
 * WHAT EACH TERMINAL MAY SAY ABOUT ONE PAIR.
 *
 * The wording is here, once, rather than in seven components, so no surface
 * can quietly upgrade "a person did this" into "the group achieved this".
 */
export function readingFor(terminal: ProjectionTerminal, pair: ActionEffectPair): TerminalReading {
  const linked = pair.linked
    ? `Action ${pair.action_id} → Effect ${pair.effect_id}`
    : `Action ${pair.action_id} — טרם נרשמה תוצאה מקושרת`;

  switch (terminal) {
    case "hub":
      return { terminal, ids_inspectable: true,
        knows: `${linked}${pair.day_ref ? ` · יום ${pair.day_ref}` : ""}`,
        does_not_know: "אין כאן ראיה מאומתת ואין למידה — רק מה שנרשם." };

    case "brain":
      return { terminal, ids_inspectable: true,
        knows: `${linked} — הפעולה שנבחרה והתוצאה שדווחה עליה.`,
        does_not_know: "כוונה, תובנה או למידה שלא נרשמו אינן נגזרות כאן." };

    case "dynamics":
      return { terminal, ids_inspectable: true,
        knows: `${linked} — שרשרת סיבתית מתועדת.`,
        does_not_know: pair.linked
          ? "קישור מתועד אינו הוכחת סיבתיות; אין ראיה עצמאית."
          : "אין תוצאה מקושרת, ולכן אין שרשרת." };

    case "marketplace":
      return { terminal, ids_inspectable: true,
        knows: `${linked} · origin ${pair.action_origin}/${pair.effect_origin ?? "—"}`,
        does_not_know: "אין התאמה מאושרת (MatchPermit) ואין אימות חיצוני." };

    case "community":
      return { terminal, ids_inspectable: true,
        knows: `${linked} — פעולה אישית של ${pair.action_owner}.`,
        does_not_know: pair.scope === "PERSONAL"
          ? "לא משויכת לקבוצה זו — אין קישור קבוצתי בר-ביצוע. אינה נספרת כהשפעה קהילתית."
          : "השפעה קהילתית לא הוכחה מעבר לקישור עצמו.",
        ...(pair.scope === "PERSONAL"
          ? { unresolved_reason: "no executable Action→group reference exists" } : {}) };

    case "planet":
      return { terminal, ids_inspectable: true,
        knows: `${linked} — הרשומות קיימות וניתנות לבדיקה.`,
        does_not_know: "לא הוכחה התפשטות ברשת — אין יחסים או קשתות הנושאים את הפעולה הזו.",
        unresolved_reason: "no network propagation established" };

    case "world":
      return { terminal, ids_inspectable: true,
        knows: `${linked} — רשומה אישית אחת.`,
        does_not_know: "השפעה מערכתית לא הוכחה. תוצאה אישית אחת אינה השפעה עולמית.",
        unresolved_reason: "systemic effect not established" };
  }
}

/** Every terminal's reading of one pair — the acceptance table, in code. */
export function allReadings(pair: ActionEffectPair): TerminalReading[] {
  return (["hub", "brain", "dynamics", "marketplace", "community", "planet", "world"] as const)
    .map((t) => readingFor(t, pair));
}
