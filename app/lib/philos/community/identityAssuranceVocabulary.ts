/**
 * THE ONE PLACE THE IDENTITY LINK IS PUT INTO WORDS.
 *
 * Every surface that told a person about their identity link had its own
 * sentence, and each one said "מאומת" — verified. The stored status literally
 * reads `VERIFIED_SAME_PERSON`, so a component printing it was not being
 * careless; it was printing the truth of the record and the wrong claim about
 * the world. What actually happened is that one person declared a link and
 * then confirmed their own declaration.
 *
 * So the wording lives here, once, keyed by `AssuranceTier`, and no component
 * composes its own. A surface that cannot reach the tier must not guess from
 * `link_status` — that is precisely the substitution this module removes.
 *
 * THE GATE IS `IdentityLinked`, NOT `IdentityVerified`. The question is
 * whether the two namespaces were explicitly linked, never whether anyone
 * independently verified the human. `NONE` is therefore "אין קישור זהות" —
 * "no identity link" — and not "no VERIFIED identity link", which would imply
 * a verification tier was being sought and missed.
 */
import type { AssuranceTier, LinkStatus } from "./personCommunityLink";

/** The conclusion. Never contains "מאומת" for a self tier. */
export const ASSURANCE_LABEL: Record<AssuranceTier, string> = {
  SELF_ATTESTED_SAME_PERSON: "קישור זהות בהצהרה עצמית",
  SELF_DECLARED_SAME_PERSON: "הצהרת קישור זהות",
  INDEPENDENTLY_VERIFIED_SAME_PERSON: "קישור זהות באימות עצמאי",
  NONE: "אין קישור זהות",
};

/** Said wherever a self tier is shown, so absence is stated, not inferred. */
export const NO_INDEPENDENT_VERIFICATION = "אין אימות עצמאי";

/** The second step a declaration is still waiting for. */
export const SECOND_STEP_PENDING = "טרם בוצע אישור עצמי שני";

/** When records exist for the pair but none of them can vouch. */
export const NON_AUTHORITATIVE_RECORD = "רשומה לא סמכותית אינה יוצרת קישור זהות";

/** The stored value may be shown ONLY behind this exact prefix. */
export const STORED_LEGACY_PREFIX = "סטטוס מאוחסן (legacy):";

/** Whether this tier means the namespaces ARE linked. */
export function isLinkedTier(tier: AssuranceTier): boolean {
  return tier === "SELF_ATTESTED_SAME_PERSON"
    || tier === "INDEPENDENTLY_VERIFIED_SAME_PERSON";
}

/** Whether the link rests on the subject's own word alone. */
export function isSelfTier(tier: AssuranceTier): boolean {
  return tier === "SELF_ATTESTED_SAME_PERSON"
    || tier === "SELF_DECLARED_SAME_PERSON";
}

/** The colour role each tier earns. A self tier is never "verified green". */
export const ASSURANCE_TONE: Record<AssuranceTier, string> = {
  SELF_ATTESTED_SAME_PERSON: "#34d399",
  INDEPENDENTLY_VERIFIED_SAME_PERSON: "#34d399",
  SELF_DECLARED_SAME_PERSON: "#5b9cf6",
  NONE: "#8798b8",
};

/** The stored status, rendered as audit metadata and never as a conclusion. */
export function storedStatusLine(status: LinkStatus | "UNRESOLVED"): string {
  return `${STORED_LEGACY_PREFIX} ${status}`;
}

/**
 * THE VISIBLE SENTENCE — Hebrew, always.
 *
 * The resolver's own `reason` is precise English written for an audit trail
 * ("link record(s) exist for this pair but carry provenance DEMO, not REAL").
 * It is kept, and it is the right thing in a log; it is the wrong thing on a
 * screen. This builds the user-facing sentence from the TIER and the stored
 * status, so the two never drift and the screen is never English.
 *
 * Five distinguishable outcomes: attested, declared-not-attested,
 * non-authoritative, conflict, absent.
 */
export function visibleAssuranceReason(
  tier: AssuranceTier,
  status: LinkStatus | "UNRESOLVED",
): string {
  if (tier === "SELF_ATTESTED_SAME_PERSON") {
    return `${ASSURANCE_LABEL[tier]} — הנושא הצהיר ואישר בשני שלבים. ${NO_INDEPENDENT_VERIFICATION}. ${storedStatusLine(status)}`;
  }
  if (tier === "INDEPENDENTLY_VERIFIED_SAME_PERSON") {
    return `${ASSURANCE_LABEL[tier]} — אושר על ידי גורם עצמאי מורשה. ${storedStatusLine(status)}`;
  }
  if (tier === "SELF_DECLARED_SAME_PERSON") {
    return `${ASSURANCE_LABEL[tier]} — ${SECOND_STEP_PENDING}. ${NO_INDEPENDENT_VERIFICATION}. ${storedStatusLine(status)}`;
  }
  if (status === "CONFLICT") {
    return `${ASSURANCE_LABEL.NONE} — קיימות רשומות קישור סותרות; אף אחת מהן אינה קובעת`;
  }
  if (status === "UNVERIFIED") {
    return `${ASSURANCE_LABEL.NONE} — ${NON_AUTHORITATIVE_RECORD}`;
  }
  return `${ASSURANCE_LABEL.NONE} — לא נוצר קישור בין מרחבי השמות`;
}

/**
 * The short form for a badge or an empty-state line, where a full sentence
 * does not fit. Same vocabulary, fewer words — never a different claim.
 */
export function shortAssurance(tier: AssuranceTier): string {
  if (isSelfTier(tier)) return `${ASSURANCE_LABEL[tier]} · ${NO_INDEPENDENT_VERIFICATION}`;
  return ASSURANCE_LABEL[tier];
}
