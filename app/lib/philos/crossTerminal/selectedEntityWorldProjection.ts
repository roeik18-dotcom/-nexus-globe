/**
 * SELECTED ENTITY · WORLD PROJECTION — the one cross-terminal object.
 *
 * Community, Globe and World were three routes reading three different slices
 * of the same real object graph, each assembling its own answer. That is not a
 * presentation problem: it is why `/world` could print ACTION = 1 while
 * `/hub/community` printed "אין אף אירוע פעולה לקבוצה הזאת" for the same group
 * on the same data. Both sentences were rendered from literals or from ONE
 * store each, and no code anywhere held the two side by side.
 *
 * This module holds them side by side. It owns NO truth of its own: every cell
 * below is a fold over a store that already exists, and every store is named in
 * the cell that quotes it. When two stores answer the same chain position
 * differently, that is recorded as a CONTRADICTION with both readings and both
 * store names — never averaged, never silently preferred, never hidden.
 *
 * THE JOIN KEY IS `group_id`. Never a display label. `אחריות קהילתית` is a name
 * a human typed; `g_*` is what the records agree on. Label matching is what
 * makes two different groups look like one, and it is not used here even as a
 * fallback — a store that cannot be joined by id contributes MISSING, with the
 * reason "no canonical id on that record".
 *
 * NO FAKE COMPLETION. A chain position with no record is `MISSING` or `UNKNOWN`
 * at its exact index — the chain is never shortened to look finished, and a
 * later position is never promoted because an earlier one is green.
 */
import { resolveAdministrative } from "../geo/adminResolver";
import { isPlottable, unlocated, type GeographicReference } from "../geo/geographicReference";

import type { GroupOperationalState } from "../community/groupOperationalState";
import type { OperationalGroupProfile } from "../valueSystem/operationalGroup";
import type { SystemEvidenceResult } from "../world/systemEvidenceProjection";

/**
 * The four operational colors, as a type. They encode TRUTH AT A SCALE, not
 * severity and not progress:
 *
 *   REAL      🟢 recorded, and verified at its OWN scale
 *   PROJECTED 🟣 a PHILOS relation — this position is reachable from the
 *                selected path, but the record lives at another scale
 *   MISSING   ⚪ no record. Includes "external, not observed"
 *   TENSION   🔴 documented tension or unresolved risk. ONLY that.
 *
 * A green GROUP cell never makes a downstream SYSTEM cell green: each cell is
 * colored from its own record, and the chain renders every cell at once.
 */
export type CellStatus = "REAL" | "PROJECTED" | "MISSING" | "TENSION";

/**
 * WHITE IS NOT ONE STATE. `MISSING` as a colour was hiding four different
 * facts behind one absence: a record that was never written, a record that
 * exists but is not joined, a record that exists and FAILS a gate, and a
 * world that was simply never observed. "A group that exists but fails the
 * SYSTEM gate is not missing" — so every white cell carries which of these
 * it is, and the gate cells carry the gate's own reason verbatim.
 */
/** The projection's own provenance vocabulary — deliberately a string union,
 *  not the events module's `Provenance` record, because a CELL reports where
 *  its figure came from, while that record reports how a metric was computed.
 *  Two different questions; sharing one name for them is how they get confused. */
export type CellProvenance = "REAL" | "DERIVED" | "DEMO" | "NONE";

export type AbsenceState =
  | "NO_RECORD"          // nothing was ever written
  | "NO_EVENTS"          // the channel exists; this group has no events in it
  | "NO_CANONICAL_LINK"  // records exist, but none joins to this group_id
  | "NOT_QUALIFIED"      // the record exists and does not pass a named gate
  | "NOT_OBSERVED"       // nothing outside PHILOS was observed
  | "UNCONNECTED"        // both ends exist; the link between them does not
  | "NO_COORDINATE";     // resolved administratively; no point was recorded

export const ABSENCE_WORD: Record<AbsenceState, string> = {
  NO_RECORD: "לא נרשם",
  NO_EVENTS: "ערוץ ריק",
  NO_CANONICAL_LINK: "אין קישור קנוני",
  NOT_QUALIFIED: "לא עומד בשער",
  NOT_OBSERVED: "לא נצפה",
  UNCONNECTED: "לא מחובר",
  NO_COORDINATE: "ללא קואורדינטה",
};

/**
 * One cell may carry more than one true reading at different strengths. A
 * canonical group link and a member happening to own a record are BOTH facts
 * and they are NOT the same fact — collapsing them is how "1" came to stand
 * for a join that does not exist. Readings are never summed.
 */
export interface CellReading {
  label: string;
  count: number;
  store: string;
  record_ids: readonly string[];
  provenance: CellProvenance;
  /** How strong this reading's claim on the group actually is. */
  join: "CANONICAL_GROUP_ID" | "MEMBERSHIP_ONLY" | "NONE";
  because: string;
}

export interface ChainCell {
  /** Stable position id. Terminals key off this, never off the label. */
  key: string;
  label_he: string;
  term: string;
  status: CellStatus;
  /** The measured figure, or null when there is nothing to measure. */
  value: string | null;
  /** Which store produced this cell. Always named, always singular. */
  store: string;
  /** Why this status and not a stronger one. Always present. */
  because: string;
  /** The scale the record actually lives at — never upgraded by proximity. */
  scale: "GROUP" | "NETWORK" | "SYSTEM" | "NONE";

  /* ── PROVENANCE, on every cell ───────────────────────────────────────── */
  /** Which specific absence this is. Present on every non-REAL cell. */
  absence?: AbsenceState;
  /** The exact records behind `value`. Empty when there are none. */
  record_ids: readonly string[];
  provenance: CellProvenance;
  /** The gate's own words, when a gate — not a silence — produced this. */
  gate_reason?: string;
  /** Separate true readings at different join strengths. Never summed. */
  readings?: readonly CellReading[];
}

/** Two stores answering one chain position differently. Both kept. */
export interface ChainContradiction {
  key: string;
  readings: { store: string; value: string; because: string }[];
  /** The reading this projection publishes, and the rule that chose it. */
  canonical: string;
  rule: string;
}

export interface SelectedEntityWorldProjection {
  /** THE JOIN KEY. */
  groupId: string;
  groupName: string;
  provenance: "REAL" | "DEMO";

  valueFamily: string | null;
  subValue: string | null;

  /**
   * MEMBER_COUNT — distinct persons currently affiliated with the group,
   * by ANY affiliation-creating event: the founder named on `group.opened`,
   * every `leader.appointed` appointee, and every `member.joined` actor.
   *
   * This is NOT the number of join events, and the two must never be swapped:
   * this group's founder (`p_dana`) and its two leaders (`p_omer`, `p_yael`)
   * are affiliated without ever having emitted `member.joined`.
   */
  memberCount: number;
  /**
   * MEMBERSHIP_HISTORY_COUNT — `member.joined` events only, which is what a
   * join curve can plot. Lower than `memberCount` by exactly the number of
   * persons who joined by founding or appointment.
   *
   * ACTIVE_MEMBER_COUNT IS DELIBERATELY ABSENT. No departure/removal event
   * type exists in this codebase, so "still active" is unmeasurable — and a
   * field that silently equalled `memberCount` would assert nobody ever left.
   */
  membershipHistoryCount: number;
  roles: { person_id: string; role: string }[];

  budget: { available: number; currency: string; received: number; spent: number; committed: number } | null;
  /**
   * BUDGET_TRANSACTION_COUNT — events that ACTUALLY MOVED MONEY:
   * `resource_delta.kind === "money" && resource_delta.amount !== 0`.
   *
   * Read from `budget.provenance.source_events`, i.e. the exact event set that
   * produced received/spent/available and that `buildCapitalTimeline` folds —
   * so the figure, the balance and the capital chart can never disagree. It is
   * never derived from the balance and never counted a second way.
   */
  budgetTransactionCount: number;
  /** The ids behind that count, so the figure is auditable from the surface. */
  budgetTransactionIds: readonly string[];
  /**
   * FUNDING_DECISION_COUNT — allocation proposals + transfer entities.
   *
   * THIS IS NOT A MOVEMENT COUNT AND MUST NEVER BE LABELLED AS ONE. It counts
   * INTENTS: an approved allocation and the transfer that executes it are the
   * same money counted twice, and inbound receipts are not counted at all.
   * It was previously published as `moneyMovements` and rendered as
   * "N תנועות", which is the defect this field's name exists to prevent.
   */
  fundingDecisionCount: number;

  /** Counts only. The records themselves stay in their own stores. */
  needs: number;
  resources: number;
  matches: number;
  actions: number;
  effects: number;
  evidence: number;
  tensions: number;

  location: GeographicReference;
  geoResolution: GeographicReference["precision"];

  /* The three world facts, kept apart because they are three facts. */
  worldRelevance: "CONNECTED" | "UNCONNECTED";
  systemEligibility: "ELIGIBLE" | "NOT_QUALIFIED";
  systemGateReason: string;
  externalEvidence: number;
  externalEvent: string | null;
  /** True only when a coordinate was actually recorded. Administrative
   *  resolution never sets this — that is the whole point of the field. */
  plottable: boolean;

  /** The ordered chain, VALUE → SYSTEM. Rendered identically by all three
   *  terminals; only the emphasis differs. */
  chain: ChainCell[];
  contradictions: ChainContradiction[];
}

const STORE = {
  registry: "valueGroupRegistry (philos-events.jsonl)",
  realizedMatch: "actions.jsonl → action.inputs ⊇ {need_id, offer_id} — נגזרת; אין מאגר Match",
  needLink: "need-group-links.jsonl (canonical need↔group join)",
  canonNeed: "needs.jsonl via findNeedsForSubject (membership-gated, not joined)",
  canonOffer: "offers.jsonl via findOffersForSource (membership-gated; no offer↔group store exists)",
  groupEffect: "projectValueGroup.impact ← impact.recorded (philos-events.jsonl)",
  groupEvidence: "projectValueGroup.impact.verification ← impact.verified, attached by impact_event_id",
  view: "projectValueGroup (philos-events.jsonl)",
  spine: "groupOperationalState (group-events.jsonl)",
  canon: "canon Action/Effect/Evidence + bridge ACTION_AFFECTS_COMMUNITY",
  geo: "adminResolver (Natural Earth 110m)",
  sysev: "systemEvidenceProjection",
} as const;

const cell = (
  key: string, label_he: string, term: string,
  status: CellStatus, value: string | null, store: string, because: string,
  scale: ChainCell["scale"],
  extra: Partial<Pick<ChainCell, "absence" | "record_ids" | "provenance" | "gate_reason" | "readings">> = {},
): ChainCell => ({
  key, label_he, term, status, value, store, because, scale,
  record_ids: extra.record_ids ?? [],
  provenance: extra.provenance ?? (status === "REAL" ? "REAL" : "NONE"),
  ...(extra.absence ? { absence: extra.absence } : {}),
  ...(extra.gate_reason ? { gate_reason: extra.gate_reason } : {}),
  ...(extra.readings ? { readings: extra.readings } : {}),
});

export interface ProjectionInput {
  /** The one assembler for group facts. Null = no real group resolved. */
  profile: OperationalGroupProfile | null;
  /** The operational spine state for THIS group id, if the log has one. */
  state: GroupOperationalState | null;
  /** System-scale evidence, already projected. */
  systemEvidence: SystemEvidenceResult;
  /** Records that reached SYSTEM scale, from the world contract. */
  systemEligibleRecords: number;
  /** Observed world events, from the world contract. */
  observedWorldEvents: number;
  /** The gate's own sentence for why SYSTEM is 0. Null when it is not. */
  systemZeroReason: string | null;
  /** Actions that reach this group through DECLARED IDS ONLY:
   *  `action.inputs ∋ need_id` where `need_group_link(need_id) = group_id`.
   *  The operational trace found these; the bridge-only reading missed them,
   *  and the ACTION cell was reporting an empty channel while a real action
   *  named a real need of this group. Not a label join and not membership —
   *  every hop is an id on a stored record. */
  viaNeedActionIds: readonly string[];
  /** Actions whose `inputs` name BOTH a linked need and an offer.
   *
   *  THIS IS A REALIZED MATCH, NOT A CANONICAL ONE. `matchPermit.ts` states in
   *  its own header that match history is deliberately NOT persisted and that
   *  a permit is "a signed, short-lived, stateless capability token — not a
   *  record. Nothing here is written to any store." So no independent Match
   *  object exists to be found: the action's inputs prove a match was REALIZED
   *  — the pair was consumed — and prove nothing about a Match record having
   *  preceded it. Colouring that green would invent a record type the system
   *  deliberately does not have. */
  realizedMatchIds: readonly string[];
  /** CANONICAL need↔group links, joined on group_id. The audit found the
   *  NEED cell was reading membership-owned needs and calling that a join. */
  linkedNeedIds: readonly string[];
  /** Group effect/evidence records, already scoped to this group_id. */
  groupEffects: readonly { effect_id: string; status: string; provenance: CellProvenance }[];
  groupEvidence: readonly { evidence_id: string; effect_id: string; level: string; provenance: CellProvenance }[];
}

/**
 * Build the projection. Pure — every store read happens in the callers that
 * already read those stores, so no terminal pays for a second load and no
 * truth logic is duplicated here.
 */
export function buildSelectedEntityWorldProjection(
  input: ProjectionInput,
): SelectedEntityWorldProjection | null {
  const { profile, state, systemEvidence } = input;
  if (!profile) return null;

  const groupId = profile.group_id;
  const view = profile.view;
  const contradictions: ChainContradiction[] = [];

  /* ── THE ACTION CONTRADICTION, RESOLVED IN THE OPEN ──────────────────────
     Two stores hold things called "action" for this group and they are NOT
     the same records:

       canon   Action records owned by a person, tied to the group by a real
               `ACTION_AFFECTS_COMMUNITY` bridge link on canonical ids.
       spine   ACTION_* GroupEvents in the group's own operational log.

     Their id spaces are disjoint, so the honest total is the sum — but the
     sum was never the bug. The bug was each terminal reading ONE store and
     printing its answer as though it were the whole. Both readings are kept
     below, and the published figure states its composition. */
  const canonActions = profile.linked_actions.length;
  const spineActions = state?.channels.actions === "MEASURED" ? state.actions.length : 0;
  const spineActionsKnown = state?.channels.actions === "MEASURED";
  /* THIRD STORE, THIRD JOIN. Disjoint from both of the above: the bridge reads
     ACTION_AFFECTS_COMMUNITY, the spine reads group ACTION_* events, and this
     reads the action's own declared inputs. Ids are unioned, never summed, so
     an action reachable two ways is still one action. */
  const viaNeed = input.viaNeedActionIds.filter(
    (id) => !profile.linked_actions.some((a) => a.action.action.action_id === id));
  const actions = canonActions + spineActions + viaNeed.length;
  if (canonActions !== spineActions || viaNeed.length > 0) {
    contradictions.push({
      key: "action",
      readings: [
        { store: STORE.canon, value: String(canonActions),
          because: "פעולות קנוניות המקושרות לקבוצה דרך ACTION_AFFECTS_COMMUNITY על מזהים קנוניים" },
        { store: "action.inputs ∋ need_id · need-group-links (declared ids only)",
          value: String(viaNeed.length),
          because: "פעולות שנוקבות בצורך של הקבוצה במזהה מוצהר — הצירוף שהבדיקה הקודמת פספסה" },
        { store: STORE.spine, value: spineActionsKnown ? String(spineActions) : "NO_EVENTS",
          because: spineActionsKnown
            ? "אירועי ACTION_* בלוג התפעולי של הקבוצה"
            : "לא נרשם אף אירוע ACTION_* לקבוצה — ערוץ ריק, לא אפס נמדד" },
      ],
      canonical: String(actions),
      rule: "מרחבי המזהים זרים — הסכום הוא התשובה, ושני המקורות מוצגים בנפרד. אף מסוף לא מדווח מקור אחד כאילו הוא השלם.",
    });
  }

  /* ── NEED / RESOURCE: THREE JOIN STRENGTHS, NEVER ONE NUMBER ────────────
     The audit found this cell reporting "1 · 1" from `findNeedsForSubject` /
     `findOffersForSource` — records owned by a person who happens to be a
     member. That is a real fact and it is NOT a group join. Meanwhile a real
     canonical join exists in `need-group-links` and was not being read at all,
     and NO offer↔group link store exists anywhere in this codebase, so a
     resource cannot currently be joined to a group by id even in principle.
     All three states are now distinct and none is summed into the others. */
  const linkedNeeds = profile.member_needs.filter((n) => input.linkedNeedIds.includes(n.need.need_id));
  const memberOnlyNeeds = profile.member_needs.filter((n) => !input.linkedNeedIds.includes(n.need.need_id));
  const spineNeeds = state?.channels.needs === "MEASURED" ? state.needs : [];
  const spineResources = state?.channels.resources === "MEASURED" ? state.resources : [];

  /* THE PUBLISHED FIGURE IS THE CANONICAL JOIN ONLY. Everything weaker is a
     reading beside it, visible and labelled, never folded into the count. */
  const needs = linkedNeeds.length + spineNeeds.length;
  const resources = spineResources.length;
  /* TWO MATCH MECHANISMS, both real, disjoint ids: MATCH_* events on the
     operational spine, and an action naming a need and an offer together. */
  const spineMatches = state?.channels.matches === "MEASURED" ? state.matches.length : 0;
  const realizedMatches = input.realizedMatchIds.length;
  /* Two mechanisms, disjoint ids, and DIFFERENT STRENGTHS — a recorded MATCH_*
     event is canonical; an action's inputs are a derivation. They are reported
     separately and the cell takes the weaker colour when only the derivation
     exists, because the stronger claim was never made by any record. */
  const matches = spineMatches + realizedMatches;
  /* ── EFFECT / EVIDENCE: proven by reference, not by adjacency ───────────
     Both stores are already scoped to this group_id. The evidence cell used
     to count `evidence_statements` — strings — which cannot prove that any
     evidence record actually references any effect record. It now counts
     evidence whose `effect_id` names an effect of THIS group, so "adjacent
     evidence" and "supporting evidence" can no longer read the same. */
  const effectRecords = input.groupEffects;
  const effectIds = new Set(effectRecords.map((e) => e.effect_id));
  const supporting = input.groupEvidence.filter((e) => effectIds.has(e.effect_id));
  const adjacent = input.groupEvidence.filter((e) => !effectIds.has(e.effect_id));
  const effects = effectRecords.length > 0 ? effectRecords.length : profile.effect_claims;
  const verified = effectRecords.length > 0
    ? effectRecords.filter((e) => e.status === "VERIFIED").length
    : profile.verified_effects;
  const evidence = supporting.length;
  const tensions = profile.tensions.length;
  const roles = state?.roles ?? [];
  const memberCount = view.members.length;
  /* JOIN EVENTS ONLY — the same timeline the Community join curve plots. */
  const membershipHistoryCount = profile.membership_over_time.length;

  /* THE MONEY COUNT, from the budget's OWN provenance: the events whose
     `resource_delta` is money and non-zero. Same set that produced
     received/spent/available, same set `buildCapitalTimeline` folds. */
  const budgetTransactionIds = view.budget?.provenance?.source_events ?? [];
  const budgetTransactionCount = budgetTransactionIds.length;
  /* Kept, because "how many funding decisions were taken" is a real question —
     but under a name that cannot be read as money having moved. */
  const fundingDecisionCount = view.allocations.length + view.transfers.length;

  /* GEOGRAPHY. `view.region` is a raw string a human typed. It is resolved by
     the SAME resolver Globe uses, and an unrecognised label stays UNLOCATED
     rather than being upgraded into a country. */
  const location = view.region
    ? resolveAdministrative(view.region, STORE.view)
    : unlocated(null, STORE.view);

  /* SYSTEM. The gate is evidence at SYSTEM scale — `external_verified`. A
     group effect verified at GROUP scale does not reach it, and saying so is
     this terminal's whole job. */
  const plottable = isPlottable(location);
  const externalEvidence = systemEvidence.counts.external_verified;
  const systemEligibility = input.systemEligibleRecords > 0 ? "ELIGIBLE" : "NOT_QUALIFIED";
  const worldRelevance = input.observedWorldEvents > 0 ? "CONNECTED" : "UNCONNECTED";

  const budget = view.budget
    ? { available: view.budget.available, currency: view.budget.currency,
        received: view.budget.received, spent: view.budget.spent, committed: view.budget.committed }
    : null;

  const family = profile.leading_family
    ? `${profile.leading_family.family_ref} ${profile.leading_family.label}`
    : null;

  const chain: ChainCell[] = [
    cell("value", "משפחת ערך / תת-ערך", "VALUE",
      family ? "PROJECTED" : "MISSING", family ?? null, STORE.registry,
      family
        ? `נגזר מ-${profile.leading_family!.via_base_value} דרך רישום ערכי הבסיס — כלל STATIC, לא ראיה`
        : "הקבוצה לא ממופה לאף משפחת ערך קנונית", family ? "GROUP" : "NONE",
      { record_ids: profile.leading_family ? [profile.leading_family.family_ref] : [],
        provenance: family ? "DERIVED" : "NONE",
        absence: family ? undefined : "NO_CANONICAL_LINK" }),

    cell("group", "קבוצת ערך", "GROUP", "REAL", profile.name, STORE.registry,
      `רשומה אמיתית · ערך מרכזי "${view.central_value}" · סטטוס ${view.status}`, "GROUP",
      { record_ids: [groupId], provenance: "REAL" }),

    /* MEMBERS states the AFFILIATION count and, separately, the join-event
       count. The `because` used to read "מאירועי member.joined", which was
       simply false: it named the join events while reporting the affiliation
       total, and that mislabel is why 9 and 6 read as a contradiction. */
    cell("members", "חברים (מסונפים)", "MEMBERS",
      memberCount > 0 ? "REAL" : "MISSING", memberCount > 0 ? String(memberCount) : null, STORE.view,
      memberCount > 0
        ? `כל אדם המסונף לקבוצה דרך אירוע מסוג group.opened (מייסד), leader.appointed (ממונה) `
          + `או member.joined (מצטרף). מתוכם ${membershipHistoryCount} הגיעו באירוע member.joined; `
          + `היתר מייסד וממונים, שאין להם אירוע הצטרפות. שני המספרים אמיתיים ואינם אותה כמות. `
          + `active_member_count אינו נמדד — אין סוג אירוע עזיבה במערכת.`
        : "לא נרשם אף אירוע סינוף",
      memberCount > 0 ? "GROUP" : "NONE",
      { record_ids: view.members.map((m) => m.person_id),
        provenance: memberCount > 0 ? "REAL" : "NONE",
        absence: memberCount > 0 ? undefined : "NO_EVENTS" }),

    /* MONEY now publishes the BUDGET TRANSACTION count — the events that moved
       money — instead of allocations+transfers, which counted intents, double
       counted an executed allocation against its own transfer, and omitted
       both inbound receipts. `record_ids` are those same event ids. */
    cell("money", "תקציב / תנועות תקציב", "MONEY",
      budget ? "REAL" : "MISSING",
      budget
        ? `${budget.available.toLocaleString()} ${budget.currency} · ${budgetTransactionCount} תנועות תקציב`
        : null,
      STORE.view,
      budget
        ? `התקבל ${budget.received.toLocaleString()} · הוצא ${budget.spent.toLocaleString()} · מחויב ${budget.committed.toLocaleString()}. `
          + `תנועת תקציב = אירוע עם resource_delta.kind="money" וסכום ≠ 0 (${budgetTransactionCount}) — `
          + `אותה קבוצת אירועים שממנה חושבו הסכומים ושעליה בנוי גרף ההון. `
          + `בנפרד: ${fundingDecisionCount} החלטות מימון (הקצאות + העברות) — כוונות, לא תנועות כסף.`
        : "לא נרשם אף אירוע כספי", budget ? "GROUP" : "NONE",
      { record_ids: budgetTransactionIds, provenance: budget ? "REAL" : "NONE",
        absence: budget ? undefined : "NO_EVENTS" }),

    cell("need", "צורך ↔ משאב", "NEED",
      needs > 0 ? "REAL" : memberOnlyNeeds.length + profile.member_offers.length > 0 ? "PROJECTED" : "MISSING",
      `${needs} · ${resources}`,
      STORE.needLink,
      needs > 0
        ? `${linkedNeeds.length} צרכים מקושרים לקבוצה במפתח קנוני (need-group-links); ${resources} משאבים מקושרים — אין מאגר קישור offer↔group בקוד הזה`
        : "אין אף צורך או משאב המקושר לקבוצה במפתח קנוני",
      needs > 0 ? "GROUP" : "NONE",
      {
        record_ids: [...linkedNeeds.map((n) => n.need.need_id), ...spineNeeds.map((n) => n.need_id), ...spineResources.map((r) => r.resource_id)],
        provenance: needs > 0 ? "REAL" : "NONE",
        absence: needs > 0 ? undefined : "NO_CANONICAL_LINK",
        readings: [
          { label: "צורך · קישור קנוני", count: linkedNeeds.length, store: STORE.needLink,
            record_ids: linkedNeeds.map((n) => n.need.need_id), provenance: "REAL", join: "CANONICAL_GROUP_ID",
            because: "רשומת need-group-link מצהירה על group_id — הצירוף החזק ביותר שקיים" },
          { label: "צורך · בבעלות חבר בלבד", count: memberOnlyNeeds.length, store: STORE.canonNeed,
            record_ids: memberOnlyNeeds.map((n) => n.need.need_id), provenance: "REAL", join: "MEMBERSHIP_ONLY",
            because: "בבעלות אדם שהוא חבר — עובדה אמיתית, ואינה קישור לקבוצה" },
          { label: "משאב · בבעלות חבר בלבד", count: profile.member_offers.length, store: STORE.canonOffer,
            record_ids: profile.member_offers.map((o) => o.offer.offer_id), provenance: "REAL", join: "MEMBERSHIP_ONLY",
            because: "אין מאגר offer↔group בקוד — משאב אינו ניתן לצירוף לקבוצה במפתח קנוני היום" },
          { label: "צורך/משאב · שדרה תפעולית", count: spineNeeds.length + spineResources.length, store: STORE.spine,
            record_ids: [], provenance: state ? "REAL" : "NONE",
            join: state?.channels.needs === "MEASURED" ? "CANONICAL_GROUP_ID" : "NONE",
            because: state ? "אירועי NEED_*/RESOURCE_* בלוג התפעולי" : "לוג תפעולי ריק לקבוצה — ערוץ, לא אפס נמדד" },
        ],
      }),

    cell("match", "התאמה", "MATCH",
      spineMatches > 0 ? "REAL" : realizedMatches > 0 ? "PROJECTED" : "MISSING",
      matches > 0 ? `${matches} מומשה` : null,
      spineMatches > 0 ? STORE.spine : STORE.realizedMatch,
      matches > 0
        ? `REALIZED_MATCH · DERIVED_FROM_ACTION_INPUTS — ${realizedMatches} פעולות נוקבות גם בצורך וגם במשאב. אין אובייקט Match עצמאי במערכת: היסטוריית התאמות אינה נשמרת בכוונה (matchPermit הוא טוקן חולף, לא רשומה). ${spineMatches > 0 ? `${spineMatches} אירועי MATCH_* קנוניים` : "ערוץ MATCH_* ריק"}`
        : "אין התאמה: לא אירוע MATCH_* קנוני, ואף פעולה אינה נוקבת בצמד",
      matches > 0 ? "GROUP" : "NONE",
      { record_ids: [...(state?.matches ?? []).map((m) => m.match_id), ...input.realizedMatchIds],
        provenance: spineMatches > 0 ? "REAL" : realizedMatches > 0 ? "DERIVED" : "NONE",
        absence: matches > 0 ? undefined : "NO_RECORD" }),

    cell("action", "פעולה", "ACTION",
      actions > 0 ? "REAL" : "MISSING", actions > 0 ? String(actions) : null,
      `${STORE.canon} + ${STORE.spine}`,
      actions > 0
        ? `${canonActions} דרך גשר + ${viaNeed.length} דרך action.inputs של צורך מקושר + ${spineActionsKnown ? `${spineActions} תפעוליות` : "ערוץ תפעולי ריק"} — שלושה צירופים, כולם על מזהים מוצהרים`
        : "אין אף פעולה קנונית מקושרת בגשר, והלוג התפעולי ריק — שני מאגרים, שתי סיבות נפרדות",
      actions > 0 ? "GROUP" : "NONE",
      { record_ids: [...profile.linked_actions.map((a) => a.action.action.action_id), ...viaNeed],
        provenance: actions > 0 ? "REAL" : "NONE",
        absence: actions > 0 ? undefined : spineActionsKnown ? "NO_CANONICAL_LINK" : "NO_EVENTS" }),

    cell("effect", "אפקט", "EFFECT",
      verified > 0 ? "REAL" : effects > 0 ? "PROJECTED" : "MISSING",
      effects > 0 ? `${effects} · ${verified} מאומת` : null, STORE.groupEffect,
      effects > 0
        ? `${verified} מתוך ${effects} במצב VERIFIED · CLAIMED ≠ VERIFIED`
        : "לא נרשמה אף השפעה", effects > 0 ? "GROUP" : "NONE",
      { record_ids: effectRecords.map((e) => e.effect_id),
        provenance: effectRecords.every((e) => e.provenance === "REAL") && effects > 0 ? "REAL" : effects > 0 ? "DEMO" : "NONE",
        absence: effects > 0 ? undefined : "NO_RECORD" }),

    cell("evidence", "ראיה", "EVIDENCE",
      evidence > 0 ? "REAL" : "MISSING", evidence > 0 ? String(evidence) : null, STORE.groupEvidence,
      evidence > 0
        ? `${supporting.map((e) => `${e.evidence_id} → ${e.effect_id}`).join(" · ")} — level "${supporting[0].level}"; אין רשומה במצב external_verified, ולכן אין אימות בקנה-מידה מערכתי`
        : adjacent.length > 0
          ? `${adjacent.length} רשומות ראיה קיימות לקבוצה אך אינן מפנות לאף אפקט שלה — סמיכות אינה תמיכה`
          : "אף אפקט לא אומת",
      evidence > 0 ? "GROUP" : "NONE",
      { record_ids: supporting.map((e) => e.evidence_id),
        provenance: evidence > 0 && supporting.every((e) => e.provenance === "REAL") ? "REAL" : evidence > 0 ? "DEMO" : "NONE",
        absence: evidence > 0 ? undefined : adjacent.length > 0 ? "NO_CANONICAL_LINK" : "NO_RECORD" }),

    cell("tension", "מתח", "TENSION",
      tensions > 0 ? "TENSION" : "MISSING", tensions > 0 ? String(tensions) : null, STORE.registry,
      tensions > 0 ? "מתח מתועד — לא נגזר מהבדל ערכים" : "אין אף מתח מתועד לקבוצה הזאת",
      tensions > 0 ? "GROUP" : "NONE",
      { record_ids: [], provenance: tensions > 0 ? "REAL" : "NONE",
        absence: tensions > 0 ? undefined : "NO_RECORD" }),

    /* LOCATION. Administrative resolution and coordinate presence are two
       different facts and the cell used to show only the first, in a colour
       a reader could take for "it is on the map". The value now states the
       full resolution — raw label, city, country, precision — and the absence
       state says NO_COORDINATE explicitly whenever nothing plottable exists.
       DERIVED provenance, never promoted to REAL: PHILOS inferred the country,
       the source only ever said a city name. */
    cell("location", "מיקום", "LOCATION",
      location.precision === "UNLOCATED" ? "MISSING" : "PROJECTED",
      location.precision === "UNLOCATED"
        ? location.raw_label
        : `${location.raw_label} → ${location.city_name ?? location.region_name ?? "—"} · ${location.country_code ?? "—"}`,
      STORE.geo,
      `${location.because} precision=${location.precision} · provenance=${location.provenance}`
        + (plottable ? "" : " · לא נרשמה קואורדינטה — לא ניתן לשרטט כנקודה"),
      location.precision === "UNLOCATED" ? "NONE" : "NETWORK",
      { record_ids: location.raw_label ? [location.raw_label] : [],
        provenance: location.precision === "UNLOCATED" ? "NONE" : location.provenance,
        absence: location.precision === "UNLOCATED" ? "NO_RECORD" : plottable ? undefined : "NO_COORDINATE" }),

    /* RELEVANCE is a LINK, EXTERNAL EVIDENCE is a RECORD LEVEL, and a WORLD
       EVENT is an OBSERVATION. Three facts; the pass before this one gave all
       three the same white and the same silence. Each now carries its own
       absence state and its own reason. */
    cell("relevance", "רלוונטיות עולמית", "RELEVANCE",
      worldRelevance === "CONNECTED" ? "REAL" : "MISSING", null, STORE.sysev,
      worldRelevance === "CONNECTED"
        ? "קיים קישור WorldRelevance מאומת"
        : "שני הקצוות קיימים — קבוצה אמיתית ומודל עולם — והקישור ביניהם מעולם לא נוצר. זה חוסר קישור, לא חוסר רשומה.",
      "NONE",
      { absence: worldRelevance === "CONNECTED" ? undefined : "UNCONNECTED",
        record_ids: [], provenance: "NONE" }),

    /* SYSTEM. `MISSING` was wrong here and the audit named it: the entity
       EXISTS, is REAL, and FAILS a named gate. That is NOT an absence of
       record — it is a verdict. The cell states ENTITY_EXISTS separately from
       the gate result, and carries the gate's own sentence verbatim. */
    cell("system", "כשירות מערכתית", "SYSTEM",
      systemEligibility === "ELIGIBLE" ? "REAL" : "MISSING",
      /* null, not "0": the absence word below already says NOT_QUALIFIED, and
         printing a figure here made the cell say the same thing twice. */
      systemEligibility === "ELIGIBLE" ? String(input.systemEligibleRecords) : null,
      STORE.sysev,
      systemEligibility === "ELIGIBLE"
        ? `${input.systemEligibleRecords} רשומות עוברות את שער ה-SYSTEM`
        : `הישות קיימת ואמיתית — ונדחית בשער. ${systemEvidence.counts.evidence_records} רשומות ראיה נבדקו, ${externalEvidence} במצב external_verified. אימות בקנה-מידה קבוצתי אינו חוצה את השער.`,
      "SYSTEM",
      { record_ids: systemEvidence.unresolvedCandidates.map((c) => c.evidence_id),
        provenance: "REAL",
        absence: systemEligibility === "ELIGIBLE" ? undefined : "NOT_QUALIFIED",
        gate_reason: input.systemZeroReason
          ?? (systemEvidence.rejections[0]?.reason ?? "NO_SYSTEM_SCOPE") }),

    cell("external", "אירוע / מקור חיצוני", "EXTERNAL",
      input.observedWorldEvents > 0 ? "REAL" : "MISSING",
      input.observedWorldEvents > 0 ? String(input.observedWorldEvents) : null, STORE.sysev,
      input.observedWorldEvents > 0
        ? "אירוע עולם נצפה ומקושר"
        : `לא נצפה אף אירוע עולם חיצוני. בנפרד: ${externalEvidence} רשומות במצב external_verified — שתי עובדות שונות, שתי סיבות שונות.`,
      "NONE",
      { absence: input.observedWorldEvents > 0 ? undefined : "NOT_OBSERVED",
        record_ids: [], provenance: "NONE" }),
  ];

  return {
    groupId, groupName: profile.name, provenance: "REAL",
    valueFamily: family,
    subValue: view.central_value || null,
    memberCount, membershipHistoryCount, roles, budget,
    budgetTransactionCount, budgetTransactionIds, fundingDecisionCount,
    needs, resources, matches, actions, effects, evidence, tensions,
    location, geoResolution: location.precision,
    worldRelevance, systemEligibility, externalEvidence,
    systemGateReason: input.systemZeroReason
      ?? systemEvidence.rejections[0]?.reason ?? "NO_SYSTEM_SCOPE",
    externalEvent: null,
    plottable,
    chain, contradictions,
  };
}
