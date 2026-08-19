/**
 * ATTENTION CHAIN — six links that were previously one flat list.
 *
 * Hub's ATTENTION card used to concatenate three different KINDS of claim
 * into a single bulleted list: a measured deficit signal, a token-detected
 * contradiction, and a value interpretation. They rendered identically, so
 * a reader had no way to tell that the first came from a real measurement,
 * the second from a regex over the observation's text, and the third from
 * a join against a value universe. Counting them together ("ATTENTION (5)")
 * made it worse, by implying five things of one kind.
 *
 * The chain states each link's own epistemic status instead:
 *
 *   1 MEASURED SIGNAL            MEASURED     real Observation → tension
 *   2 INTERPRETED CONTRADICTIONS INTERPRETED  token detection over the text
 *   3 BASE VALUES                INTERPRETED  the text's own value claim
 *   4 VALUE CHARACTER/DIRECTION  CANDIDATE    aversion+contradiction qualifier
 *   5 VALUE FAMILY               CANDIDATE    join against the value universe
 *   6 VALUE GROUP RELEVANCE      VERIFIED/UNRESOLVED  real membership records
 *
 * **Sequence is not causality, and the chain says so.** Link N+1 is
 * derived FROM link N's material in every case, but "the text that
 * recorded a measured deficit also names a contradiction" is not evidence
 * that the deficit caused the contradiction, nor that the value explains
 * either. Each link carries `derived_from` (what it read) and
 * `not_implied` (what its presence must not be taken to mean).
 *
 * MENTIONED != MEASURED is the load-bearing distinction here: links 2-5
 * are all MENTIONS — tokens found in one Observation's free text. Only
 * link 1 is a measurement, and only link 6 rests on durable records.
 */
import type { ObservationReading } from "./canon/observationReading";
import type { TensionItem } from "./tension";
import type { ValueGroupView } from "./projectValueGroup";

export type EpistemicStatus = "MEASURED" | "INTERPRETED" | "CANDIDATE" | "VERIFIED" | "UNRESOLVED";

export interface AttentionLink {
  key: string;
  /** Formal stage name — the chain's own vocabulary, never data. */
  label: string;
  /** Hebrew gloss of what this link IS. */
  gloss: string;
  status: EpistemicStatus;
  /** Real items for this link. `[]` = none, with `empty` saying why. */
  items: { text: string; detail?: string }[];
  /** Stated when `items` is empty. */
  empty: string;
  /** What this link was derived FROM — one link back, never further. */
  derived_from: string;
  /** What this link's presence must NOT be read as. */
  not_implied: string;
}

export interface AttentionChain {
  links: AttentionLink[];
  /** Counted per STATUS, never as one total — a single "ATTENTION (5)"
   *  number is exactly what flattened the three kinds together. */
  counts: Record<EpistemicStatus, number>;
}

export function buildAttentionChain(params: {
  tensions: readonly TensionItem[];
  reading: ObservationReading | null;
  /** Real, already-verified value-group memberships. */
  verifiedGroups: readonly { view: ValueGroupView }[];
}): AttentionChain {
  const { tensions, reading, verifiedGroups } = params;

  // 1 — MEASURED. The only link backed by a measurement.
  const measured: AttentionLink = {
    key: "measured", label: "MEASURED SIGNAL", gloss: "אות מדוד",
    status: "MEASURED",
    items: tensions.map((t) => ({ text: t.label, detail: `${t.severity} · ${t.current_state}` })),
    empty: "אין תצפית אמיתית שמייצרת אות מדוד",
    derived_from: "Observation אמיתית (Domain × Frame, level/stability)",
    not_implied: "אות מדוד אינו קובע סיבה, ואינו מסביר את עצמו",
  };

  // 2 — INTERPRETED. Token detection over ONE observation's free text.
  const contradictionItems: { text: string; detail?: string }[] = [];
  if (reading?.contradiction.detected) {
    contradictionItems.push({
      text: reading.contradiction.matched_token ?? "ניגוד",
      detail: "זוהה טוקן בטקסט התצפית",
    });
  }
  for (const d of reading?.dimensions ?? []) {
    if (d.matched_token) contradictionItems.push({ text: d.dimension, detail: `אזכור: ${d.matched_token}` });
  }
  const interpreted: AttentionLink = {
    key: "contradictions", label: "INTERPRETED CONTRADICTIONS", gloss: "ניגודים מפורשים",
    status: "INTERPRETED",
    items: contradictionItems,
    empty: "לא זוהה ניגוד בטקסט התצפית",
    derived_from: "טקסט התצפית של האות המדוד (זיהוי טוקנים דטרמיניסטי)",
    not_implied: "אזכור אינו מדידה — ניגוד שזוהה בטקסט אינו קובע מצב תא ואינו נגרם מהאות המדוד",
  };

  // 3 — INTERPRETED. The text's OWN explicit value claim.
  const baseValues: AttentionLink = {
    key: "base_values", label: "BASE VALUES", gloss: "ערכי בסיס",
    status: "INTERPRETED",
    items: reading?.general_value?.claimed_phrase
      ? [{ text: reading.general_value.claimed_phrase, detail: "טענת ערך מפורשת בטקסט" }]
      : [],
    empty: "הטקסט אינו טוען ערך מפורש",
    derived_from: "אותו טקסט תצפית — ניסוח \"X היא ערך\"",
    not_implied: "טענת ערך בטקסט אינה הופכת את הערך למדוד, מוחזק או פעיל",
  };

  // 4 — CANDIDATE. Attached only when aversion AND contradiction co-occur.
  const direction: AttentionLink = {
    key: "direction", label: "VALUE CHARACTER / DIRECTION", gloss: "אופי וכיוון הערך",
    status: "CANDIDATE",
    items: reading?.principle
      ? [{ text: reading.principle.text, detail: reading.principle.qualifier }]
      : [],
    empty: "לא זוהו יחד רתיעה/שוני וניגוד — אין כיוון מועמד",
    derived_from: "צירוף של ערך הבסיס עם הניגוד שזוהה",
    not_implied: "כיוון מועמד אינו עמדה מאומתת של האדם",
  };

  // 5 — CANDIDATE. A join against the value universe.
  const family: AttentionLink = {
    key: "family", label: "VALUE FAMILY", gloss: "משפחת ערך",
    status: "CANDIDATE",
    items: reading?.general_value?.matched_family
      ? [{
          text: reading.general_value.matched_family.name_he,
          detail: `${reading.general_value.matched_family.family_id} · התאמה ליקום הערכים`,
        }]
      : [],
    empty: "אין התאמת משפחה ליקום הערכים",
    derived_from: "ערך הבסיס שנטען, מוצלב מול יקום הערכים",
    not_implied: "משפחת ערך היא קיבוץ, לא ערך ריצה, ואינה חברות בקבוצה",
  };

  // 6 — VERIFIED membership, but its RELATION to the observation is not.
  const groupItems = verifiedGroups.map((g) => ({
    text: g.view.name,
    detail: `${g.view.central_value} · חברות מאומתת`,
  }));
  const groups: AttentionLink = {
    key: "groups", label: "VALUE GROUP RELEVANCE", gloss: "רלוונטיות קבוצת ערך",
    status: groupItems.length > 0 ? "VERIFIED" : "UNRESOLVED",
    items: groupItems,
    empty: "אין קשר זהות מאומת לחבר בקבוצה",
    derived_from: "רשומות חברות אמיתיות — לא ממשפחת הערך שלמעלה",
    not_implied: "חברות מאומתת אינה מוכיחה שהקבוצה קשורה לתצפית הזו (GENERAL VALUE != VALUE GROUP)",
  };

  const links = [measured, interpreted, baseValues, direction, family, groups];
  const counts = { MEASURED: 0, INTERPRETED: 0, CANDIDATE: 0, VERIFIED: 0, UNRESOLVED: 0 } as Record<EpistemicStatus, number>;
  for (const l of links) counts[l.status] += l.items.length;

  return { links, counts };
}
