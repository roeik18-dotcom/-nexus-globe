/**
 * WHICH INTERNAL ROLE DOES A RECORD ACTIVATE?
 *
 * The four internal roles come from the Colour Source Lock and mean exactly
 * what it says they mean — they are not repurposed here:
 *
 *   RED    Action / Maximum-energy      an Action or a measured Effect
 *   WHITE  Reference / Zero-energy      evidence and provenance
 *   GREEN  Expression / Connection      a documented social relation
 *   PURPLE Meaning / Vision             value interpretation
 *
 * A RECORD MAY ACTIVATE MORE THAN ONE, and that is real rather than a
 * modelling convenience: a verified Effect is RED because it is an Effect and
 * WHITE because it carries a verified outcome, which is evidence. Forcing one
 * role per record would have to discard one of two true statements.
 *
 * PURPLE IS NEVER ACTIVATED BY A RECORD, and this is the same honest result
 * the spine produces for its first four links. Nothing in the stores IS a
 * value interpretation. A value-family attribution is derived from a reading,
 * not recorded as an entity, so no record instantiates PURPLE — the role
 * still counts real attributions elsewhere, but selecting a record never
 * lights it. Absence here is a fact about the data model, not a gap.
 *
 * WHAT IS REFUSED. RED is not Need (a need is not an action) and not momentum
 * (that is ORANGE, and it stays UNKNOWN system-wide). WHITE is not a
 * confidence score, and an UNVERIFIED outcome is not evidence — a claimed
 * effect activates RED alone. GREEN requires a documented relation; two
 * records sharing a value, a group or a moment activate nothing.
 */

export type InternalRole = "RED" | "WHITE" | "GREEN" | "PURPLE";

export interface RoleActivation {
  role: InternalRole;
  because: string;
}

/** Kinds that ARE a documented social relation. Membership proves MEMBER_OF
 *  and nothing further — it activates GREEN, never RED or WHITE. */
const RELATION_KINDS = new Set(["member.joined", "leader.appointed", "group.opened", "transfer.completed"]);

/** Kinds that ARE an action or a measured effect. */
const ACTION_KINDS = new Set(["action", "effect"]);

export function roleTouchOf(
  kind: string,
  verification: "VERIFIED" | "CLAIMED" | "UNKNOWN",
): RoleActivation[] {
  const out: RoleActivation[] = [];

  if (ACTION_KINDS.has(kind)) {
    out.push({
      role: "RED",
      because: kind === "action"
        ? "Action אמיתי — RED הוא פעולה, ואינו Need ואינו תנופה (זה ORANGE)"
        : "Effect נמדד — תוצאה של פעולה, לא הפעולה עצמה",
    });
  }

  // WHITE is evidence, and only a VERIFIED record carries any. A claimed
  // outcome is a claim; calling it evidence is the exact confusion the
  // epistemic vocabulary exists to prevent.
  if (verification === "VERIFIED") {
    out.push({ role: "WHITE", because: "הרשומה נושאת תוצאה מאומתת — ראיה, לא טענה" });
  } else if (kind === "observation") {
    out.push({ role: "WHITE", because: "תצפית היא מדידה מתועדת — שכבת הייחוס" });
  }

  if (RELATION_KINDS.has(kind)) {
    out.push({
      role: "GREEN",
      because: kind === "member.joined" || kind === "leader.appointed"
        ? "קשר חברתי מתועד — חברות מוכיחה MEMBER_OF בלבד"
        : "קשר מתועד בין שתי ישויות מזוהות",
    });
  }

  return out;
}

/** Why PURPLE is never lit by a record — shown in place, not left blank. */
export const PURPLE_NEVER_ACTIVATED =
  "אף רשומה אינה פרשנות ערך — ייחוס משפחת-ערך נגזר מקריאה, לא נרשם כישות";

/** Why a record lit nothing at all. */
export function noRoleReason(kind: string): string {
  if (kind === "need") return "Need הוא כניסת הנושא למיצוי — לא פעולה, לא ראיה, לא קשר";
  if (kind === "offer") return "Offer הוא היצע משאב — לא פעולה, לא ראיה, לא קשר";
  return "הרשומה אינה מפעילה תפקיד פנימי — וזו תשובה, לא חוסר";
}
