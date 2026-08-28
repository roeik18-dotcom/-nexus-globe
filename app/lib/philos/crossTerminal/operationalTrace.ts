/**
 * THE OPERATIONAL TRACE — every arrow in the middle of PHILOS, classified.
 *
 * The 14-cell projection answers "what is true at each position". This answers
 * the harder question next to it: "what actually connects one position to the
 * next, and by what". A cell can be green while the arrow into it is broken —
 * two real records with no relation between them is not a chain, and a drawing
 * that joins them anyway is the fabrication this codebase exists to prevent.
 *
 * EVERY HOP NAMES ITS JOIN MECHANISM. Not "linked" — WHICH field on WHICH
 * record carries WHICH id. A hop with no mechanism in the schema at all is
 * `STRUCTURAL_GAP`, which is a statement about the DATA MODEL rather than about
 * this group's data, and the two must never read the same: one is fixed by
 * recording something, the other only by designing something.
 *
 * NO LABEL JOINS. NO MEMBERSHIP-AS-JOIN. A person being a member of a group
 * does not make the records they own the group's records. That inference was
 * live in this product and it is the reason a resource count of 1 stood for a
 * join that has never existed.
 */
import { loadActions } from "../canon/actionStoreAccessor";
import { loadEffects } from "../canon/effectStoreAccessor";
import { loadLearnings } from "../canon/learningStoreAccessor";
import { loadNeedGroupLinks } from "../community/needGroupLinkStoreAccessor";
import { findNeedsForSubject } from "../canon/needStoreAccessor";
import { findOffersForSource } from "../canon/offerStoreAccessor";

/**
 * How one hop is joined to the next.
 *
 *   CONNECTED           a real stored reference carries this hop
 *   AVAILABLE_UPSTREAM  both ends are real; the relation lives at another
 *                       scale and is reachable, not asserted here
 *   NO_CANONICAL_LINK   the join mechanism EXISTS and no record uses it
 *   STRUCTURAL_GAP      the schema has no mechanism for this join at all
 *   NO_EVENT            an event channel exists and is empty for this group
 *   NO_RECORD           the store itself holds nothing
 */
export type { HopState, TraceHop, OperationalTrace } from "./operationalTraceModel";
export { HOP_WORD } from "./operationalTraceModel";
import type { HopState, TraceHop, OperationalTrace } from "./operationalTraceModel";

export async function buildOperationalTrace(group_id: string, subject: string): Promise<OperationalTrace> {
  const [needs, offers, links, actions, effects, learnings] = await Promise.all([
    findNeedsForSubject(subject).catch(() => []),
    findOffersForSource(subject).catch(() => []),
    loadNeedGroupLinks().catch(() => []),
    loadActions().catch(() => []),
    loadEffects().catch(() => []),
    loadLearnings().catch(() => []),
  ]);

  /* 1 · NEED → GROUP. The one join in this chain that a record explicitly
     declares: `need_group_link.group_id`. */
  const groupLinks = links.filter((l) => l.group_id === group_id);
  const linkedNeedIds = groupLinks.map((l) => l.need_id);
  const linkedNeeds = needs.filter((n) => linkedNeedIds.includes(n.need.need_id));

  /* 2 · OFFER → GROUP. There is no store, no field and no event type for this.
     Membership is NOT substituted: an offer owned by a member stays an offer
     owned by a member, and is reported at that strength or not at all. */
  const offerJoinExists = false;

  /* 3 · MATCH. The canonical match is not a record type of its own here — it
     is an Action whose `inputs` name BOTH a need and an offer by id. That is a
     real join on canonical ids, so it counts; a match asserted any other way
     does not. */
  const matchedActions = actions.filter((a) => {
    const ins = a.action.inputs ?? [];
    return linkedNeedIds.some((id) => ins.includes(id)) && offers.some((o) => ins.includes(o.offer.offer_id));
  });

  /* 4 · ACTION → GROUP, transitively and only through declared ids:
     `action.inputs ∋ need_id` and `need_group_link(need_id) = group_id`.
     Every hop is an id on a stored record. No label, no membership. */
  const groupActions = actions.filter((a) =>
    (a.action.inputs ?? []).some((i) => linkedNeedIds.includes(i)));
  const actionIds = groupActions.map((a) => a.action.action_id);

  const chainEffects = effects.filter((e) => actionIds.includes(e.effect.action_ref));
  const effectIds = chainEffects.map((e) => e.effect.effect_id);
  const chainLearnings = learnings.filter((l) => effectIds.includes(l.learning.effect_ref));

  const hops: TraceHop[] = [
    {
      key: "need", label_he: "צורך", ids: linkedNeeds.map((n) => n.need.need_id),
      state: linkedNeeds.length > 0 ? "CONNECTED" : needs.length > 0 ? "NO_CANONICAL_LINK" : "NO_RECORD",
      mechanism: "needs.jsonl → need.need_id",
      because: linkedNeeds.length > 0
        ? `${linkedNeeds.length} צרכים בבעלות הנושא`
        : needs.length > 0 ? "צרכים קיימים ואף אחד אינו מקושר לקבוצה" : "אין אף רשומת צורך",
    },
    {
      key: "need_group_link", label_he: "צורך → קבוצה", ids: groupLinks.map((l) => l.link_id),
      state: groupLinks.length > 0 ? "CONNECTED" : "NO_CANONICAL_LINK",
      mechanism: "need-group-links.jsonl → link.group_id + link.need_id",
      because: groupLinks.length > 0
        ? "רשומת קישור מצהירה על שני המזהים במפורש"
        : "מנגנון הקישור קיים ואף רשומה אינה משתמשת בו",
    },
    {
      key: "offer", label_he: "משאב → קבוצה", ids: offers.map((o) => o.offer.offer_id),
      state: offers.length === 0 ? "NO_RECORD" : offerJoinExists ? "CONNECTED" : "STRUCTURAL_GAP",
      gap_reason: offers.length > 0 && !offerJoinExists ? "NO_OFFER_GROUP_JOIN_MODEL" : undefined,
      mechanism: "offers.jsonl → offer.offer_id · אין שדה group_id, אין מאגר offer-group-links, אין סוג אירוע",
      because: offers.length === 0
        ? "אין אף רשומת משאב"
        : `${offers.length} רשומות משאב אמיתיות. האדום כאן אינו על הרשומה — הרשומה REAL — אלא על היחס: אין בסכימה שום מנגנון לקשור משאב לקבוצה. זה פער יכולת, לא היעדר נתון, וחברוּת אינה מוצעת כתחליף.`,
    },
    {
      /* REALIZED, NOT CANONICAL. `matchPermit.ts` states it in its own header:
         "match history is deliberately NOT persisted… a signed, short-lived,
         stateless capability token — not a record. Nothing here is written to
         any store." So no independent Match object exists to be found, by
         design. What the action's `inputs` prove is that a match WAS realized
         — the pair was consumed — not that a canonical Match record preceded
         it. Presenting the derivation as canonical would invent a record type
         the system deliberately does not have. */
      key: "match", label_he: "התאמה שמומשה", ids: matchedActions.map((a) => a.action.action_id),
      state: matchedActions.length > 0 ? "AVAILABLE_UPSTREAM" : "NO_RECORD",
      mechanism: "action.inputs ⊇ {need_id, offer_id} — נגזרת, לא רשומה",
      derivation: matchedActions.length > 0 ? {
        rule: "REALIZED_MATCH — DERIVED_FROM_ACTION_INPUTS: פעולה אמיתית צרכה גם צורך וגם משאב. זו ראיה שהתאמה מומשה, ואינה ראיה שאובייקט Match קנוני התקיים לפניה.",
        from: Object.fromEntries(matchedActions.flatMap((a) => {
          const ins = a.action.inputs ?? [];
          return [
            ["action_id", a.action.action_id],
            ["need_id", ins.find((i) => linkedNeedIds.includes(i)) ?? ""],
            ["offer_id", ins.find((i) => offers.some((o) => o.offer.offer_id === i)) ?? ""],
          ];
        })),
        store: "actions.jsonl → action.inputs (אין מאגר Match; matchPermit הוא טוקן חולף ולא רשומה)",
      } : undefined,
      because: matchedActions.length > 0
        ? "התאמה שמומשה: פעולה אמיתית נוקבת בצמד. אין אובייקט Match עצמאי במערכת — לפי התכנון, היסטוריית התאמות אינה נשמרת."
        : "אף פעולה אינה נוקבת גם בצורך וגם במשאב, ואין מאגר Match לבדוק בו",
    },
    {
      /* NAMED BY ITS JOIN. Community also publishes `linked_actions`, which
         is a DIFFERENT join (the bridge registry ACTION_AFFECTS_COMMUNITY) and
         legitimately returns a different number. Two joins rendered as two
         bare "actions" figures read as one number contradicting itself, so
         each now states the edge it travelled. */
      key: "action", label_he: "פעולות דרך צורך→קבוצה", ids: actionIds,
      state: actionIds.length > 0 ? "CONNECTED" : actions.length > 0 ? "NO_CANONICAL_LINK" : "NO_RECORD",
      mechanism: "action.inputs ∋ need_id · need_group_link(need_id) = group_id",
      because: actionIds.length > 0
        ? "מגיעה לקבוצה דרך מזהים מוצהרים בלבד: הפעולה נוקבת בצורך, והצורך מקושר לקבוצה"
        : actions.length > 0 ? "פעולות קיימות ואף אחת אינה נוקבת בצורך של הקבוצה" : "אין אף רשומת פעולה",
    },
    {
      key: "effect", label_he: "אפקט", ids: effectIds,
      state: effectIds.length > 0 ? "CONNECTED" : chainEffects.length === 0 && effects.length > 0 ? "NO_CANONICAL_LINK" : "NO_RECORD",
      mechanism: "effect.action_ref = action.action_id",
      because: effectIds.length > 0
        ? "האפקט נוקב בפעולה במפורש"
        : effects.length > 0 ? "אפקטים קיימים ואף אחד אינו נוקב בפעולה של הקבוצה" : "אין אף רשומת אפקט",
    },
    {
      key: "evidence", label_he: "ראיה", ids: chainEffects.filter((e) => e.effect.verified_outcome).map((e) => `${e.effect.effect_id}#verified`),
      state: chainEffects.some((e) => e.effect.verified_outcome) ? "CONNECTED"
        : effectIds.length > 0 ? "NO_RECORD" : "NO_RECORD",
      mechanism: "effect.verified_outcome",
      because: chainEffects.some((e) => e.effect.verified_outcome)
        ? "תוצאה מאומתת רשומה על האפקט עצמו — לא רשומה סמוכה"
        : "אף אפקט בשרשרת אינו נושא תוצאה מאומתת",
    },
    {
      key: "learning", label_he: "למידה", ids: chainLearnings.map((l) => l.learning.learning_id),
      state: chainLearnings.length > 0 ? "CONNECTED" : learnings.length > 0 ? "NO_CANONICAL_LINK" : "NO_RECORD",
      mechanism: "learning.effect_ref = effect.effect_id",
      because: chainLearnings.length > 0
        ? "הלמידה נוקבת באפקט במפורש"
        : learnings.length > 0
          ? "למידות קיימות ואף אחת אינה נוקבת באפקט של השרשרת"
          : "מאגר הלמידה קיים בקוד ואין בו אף רשומה — NO_RECORD, לא 'לא למדנו'",
    },
  ];

  return {
    group_id,
    hops,
    missing_join_models: offers.length > 0 && !offerJoinExists
      ? [{
          join: "הצעה → קבוצה",
          because: "משאב אינו ניתן לקישור לקבוצה: אין שדה group_id על offer, אין מאגר offer-group-links, ואין סוג אירוע קבוצתי לכך. כרגע משאב מגיע לקבוצה רק דרך action.inputs של פעולה שכבר קיימת — כלומר אחרי ההתאמה, לא לפניה.",
          would_need: "מאגר קישור מקביל ל-need-group-links (offer_id + group_id + declared_by + evidence), או שדה group_id על ההצעה עצמה. עד שאחד מהם קיים — STRUCTURAL_GAP, ולא NO_CANONICAL_LINK.",
        }]
      : [],
  };
}
