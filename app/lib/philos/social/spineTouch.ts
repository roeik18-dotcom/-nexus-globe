/**
 * WHICH SPINE LINK DOES A RECORD ACTUALLY TOUCH?
 *
 * The value spine runs contradiction -> emergent_value -> personal_value ->
 * group_value -> value_group -> membership. Selecting a record should light
 * the link it genuinely reaches — and, far more often, should light nothing,
 * because most records touch no link at all.
 *
 * THE HONEST RESULT THIS PRODUCES. Real records reach only the LAST TWO
 * links. `group.opened` instantiates a value group; `member.joined` and
 * `leader.appointed` instantiate membership. Nothing in the stores reaches
 * contradiction, emergent_value, personal_value or group_value — which is
 * exactly why those render 110 / 4 / — / —: source inventory and conceptual
 * aggregation, with no instantiated entities behind them. Selecting a record
 * makes that visible instead of leaving it as a footnote.
 *
 * WHAT IS DELIBERATELY NOT MAPPED. Need, Offer, Action and Effect are canon
 * pipeline records, not value-spine concepts. They have real value_tags and
 * real text, and mapping either into a spine link would be inference of
 * exactly the kind the spine's own header forbids — a value word is not a
 * value entity, and a Need mentioning a value does not instantiate one.
 * `transfer.completed` moves a resource; a resource is not a value.
 *
 * So this function returns `null` for most kinds, and `null` is the answer,
 * not a gap. `NO_TOUCH_REASON` says why in each case.
 */
import type { SpineLinkKey } from "./spineKeys";

export const SPINE_KEYS = [
  "contradiction", "emergent_value", "personal_value",
  "group_value", "value_group", "membership",
] as const;

/** Kinds that genuinely instantiate a spine link, with the reason they do. */
const TOUCHES: Record<string, { key: SpineLinkKey; because: string }> = {
  "group.opened": {
    key: "value_group",
    because: "האירוע יוצר קבוצת-ערך אמיתית — זו בדיוק החוליה הזאת",
  },
  "member.joined": {
    key: "membership",
    because: "חברות מתועדת — החוליה האחרונה, ורק היא (חברות מוכיחה MEMBER_OF בלבד)",
  },
  "leader.appointed": {
    key: "membership",
    because: "מינוי בתוך קבוצה — תפקיד בתוך חברות מתועדת",
  },
};

export const NO_TOUCH_REASON: Record<string, string> = {
  need: "Need הוא רשומת צינור קנוני, לא ישות ערך — מילת ערך אינה ערך",
  offer: "Offer הוא משאב, ומשאב אינו ערך",
  action: "Action הוא פעולה, לא ישות ערך",
  effect: "Effect הוא תוצאה נמדדת, לא ישות ערך",
  observation: "תצפית היא מדידה, לא ישות ערך",
  "transfer.completed": "העברת משאב — משאב אינו ערך",
};

export interface SpineTouch {
  touches: boolean;
  key?: SpineLinkKey;
  because: string;
}

export function spineTouchOf(kind: string): SpineTouch {
  const hit = TOUCHES[kind];
  if (hit) return { touches: true, key: hit.key, because: hit.because };
  return {
    touches: false,
    because: NO_TOUCH_REASON[kind] ?? "אין חוליה בשדרה שהרשומה הזאת ממשת — וזו תשובה, לא חוסר",
  };
}
