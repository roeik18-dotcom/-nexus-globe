/**
 * PHILOS Value System — Value Group Resolver (operationalization pass).
 *
 * Turns classified value structure (family / general-value matches from
 * `classifier.ts`) plus REAL group data into operational Value-Group
 * RELATIONSHIPS — or an honest CANDIDATE/UNRESOLVED. Pure function, no
 * I/O: every input is real data the caller already loads, every output
 * names its evidence.
 *
 * THE ONE RULE ABOVE ALL (contract + this pass's own directive):
 * **membership is NEVER inferred from value similarity.** The two layers
 * this resolver computes are structurally separate:
 *
 *   PERSON-LEVEL relations — only from REAL records:
 *     MEMBER_OF        the resolved identity link's member id appears in
 *                      the group's own real member list
 *     CONTRIBUTES_TO   a real ACTION_AFFECTS_COMMUNITY bridge link targets
 *                      the group (evidence: the action ids)
 *     AFFECTED_BY      a real EFFECT_AFFECTS_PERSON bridge link from the
 *                      group's sphere reaches the person (evidence: ids)
 *     BENEFITS_FROM    a real completed transfer names the person as
 *                      recipient (evidence: transfer ids)
 *     TENSION          real open tension records on a group the person
 *                      actually relates to (never a free-floating tension)
 *
 *   VALUE-LEVEL relations — interpretation, clearly labeled:
 *     SHARED_VALUE     a non-conditional classified value/family joins the
 *                      group's own central_value. This is a VALUE overlap,
 *                      explicitly NOT membership and never promoted to it.
 *     SUPPORTS         SHARED_VALUE + the person's real operational
 *                      contribution to the same group (both must hold —
 *                      value words alone never make a supporter)
 *     OPPOSES          requires real opposition/negation evidence; NO such
 *                      record type exists in this codebase today, so this
 *                      resolver NEVER emits it — documented absence, not
 *                      an oversight. (A tension is not an opposition.)
 *
 * States per group: MATCHED (≥1 person-level relation backed by real
 * operational evidence, or SHARED_VALUE with a REAL operational group),
 * CANDIDATE (value join only, on a DEMO or non-operational group),
 * UNRESOLVED (nothing real joins). A family with no group carrying it
 * resolves UNRESOLVED — no group is ever created for it.
 */
import type { FamilyMatch, GeneralValueMatch, ValueMatch } from "./classifier";

export type GroupRelationType =
  | "SUPPORTS" | "OPPOSES" | "TENSION" | "SHARED_VALUE"
  | "MEMBER_OF" | "AFFECTED_BY" | "BENEFITS_FROM" | "CONTRIBUTES_TO";

export interface GroupRelation {
  group_id: string;
  group_name: string;
  /** The family that drove a value-level relation — null for person-level
   *  relations, which do not pass through value similarity at all. */
  family_ref: string | null;
  relation_type: GroupRelationType;
  match_reason: string;
  confidence: number;
  provenance: "REAL_MEMBERSHIP" | "BRIDGE_LINK" | "TRANSFER_RECORD" | "TENSION_RECORD" | "VALUE_JOIN";
  /** The real record ids backing this relation — [] ONLY for VALUE_JOIN
   *  (which is interpretation, and says so in match_reason). */
  operational_evidence: string[];
}

export type GroupResolutionState = "MATCHED" | "CANDIDATE" | "UNRESOLVED";

/**
 * TWO SEPARATE GRAPHS (semantic-integrity repair). A person's membership
 * in a group and an observation's value-relevance to a group are different
 * facts about different edges:
 *
 *   SUBJECT graph      person ↔ group, from real records only (MEMBER_OF /
 *                      CONTRIBUTES_TO / AFFECTED_BY / BENEFITS_FROM /
 *                      TENSION). Exists independently of any observation.
 *   OBSERVATION graph  observation's classified values ↔ group central
 *                      value (SHARED_VALUE / SUPPORTS). This is the ONLY
 *                      graph that may certify "this observation relates to
 *                      that group".
 *
 * A person-level membership NEVER certifies observation→group relevance —
 * the two graphs carry separate states and are never merged.
 */
export interface GroupResolution {
  group_id: string;
  group_name: string;
  provenance: "REAL" | "DEMO";
  /** Person↔group state — real-record relations only. */
  subject_state: GroupResolutionState;
  /** Observation↔group state — value joins only; membership plays no part. */
  observation_state: GroupResolutionState;
  subject_relations: GroupRelation[];
  observation_relations: GroupRelation[];
}

export interface ValueGroupResolverResult {
  groups: GroupResolution[];
  /** Flattened person↔group relations across all groups. */
  subject_group_relations: GroupRelation[];
  /** Flattened observation↔group relations across all groups. */
  observation_group_relations: GroupRelation[];
  /** Best person↔group state — independent of the observation. */
  subject_overall: GroupResolutionState;
  /** Best observation↔group state — the answer to "does this observation
   *  relate to any group"; UNRESOLVED when no value join exists. */
  observation_overall: GroupResolutionState;
  /** Families that matched in text but joined NO group — stated, so an
   *  unmatched family is visible as such rather than silently dropped. */
  unresolved_families: { family_ref: string; label: string; reason: string }[];
}

export interface ResolverGroupInput {
  group_id: string;
  name: string;
  central_value: string;
  provenance: "REAL" | "DEMO";
  /** Real member person-ids from the group projection. */
  member_ids: string[];
  /** Real completed-transfer recipients (id per transfer). */
  transfers: { transfer_id: string; recipient: string }[];
  /** Real impact/effect claims (id + verified). */
  effects: { id: string; verified: boolean }[];
  /** Real open tension ids for this group. */
  tension_ids: string[];
  /** Real ACTION_AFFECTS_COMMUNITY bridge-link action ids targeting it. */
  bridge_action_ids: string[];
  /** Real EFFECT_AFFECTS_PERSON bridge-link effect ids reaching viewer. */
  bridge_effect_ids: string[];
}

export interface ResolverViewer {
  linked: boolean;
  community_member_id?: string;
}

function stems3(phrase: string): string[] {
  return phrase.split(/[\s,·-]+/)
    .map((w) => w.replace(/^[הו]/, "").replace(/[^֐-׿]/g, "").slice(0, 3))
    .filter((s) => s.length >= 3);
}

export function resolveValueGroups(params: {
  familyMatches: readonly FamilyMatch[];
  generalValueMatches: readonly GeneralValueMatch[];
  baseValueMatches: readonly ValueMatch[];
  groups: readonly ResolverGroupInput[];
  viewer: ResolverViewer;
}): ValueGroupResolverResult {
  const { familyMatches, generalValueMatches, baseValueMatches, groups, viewer } = params;

  // Value-join candidates: only non-conditional matches may join (a bare
  // single token never certifies a value relation — classifier contract).
  const joinCandidates: { text: string; family_ref: string | null; tierWord: string }[] = [
    ...generalValueMatches.map((g) => ({ text: g.claimed_phrase, family_ref: null, tierWord: "CLAIMED" })),
    ...baseValueMatches.filter((b) => !b.conditional).map((b) => ({ text: b.label, family_ref: null, tierWord: b.tier })),
    ...familyMatches.filter((f) => f.tier !== "TOKEN_ONLY").map((f) => ({ text: f.label, family_ref: f.ref, tierWord: f.tier })),
  ];

  const resolutions: GroupResolution[] = groups.map((g) => {
    const subject_relations: GroupRelation[] = [];
    const observation_relations: GroupRelation[] = [];
    const memberId = viewer.linked ? viewer.community_member_id : undefined;
    // DEMO groups: their member lists / activity are reference fixtures,
    // not real records — every relation on them says so, and the group
    // caps at CANDIDATE below regardless of apparent evidence.
    const isDemo = g.provenance === "DEMO";
    const demoSuffix = isDemo ? " · נתוני DEMO — לא קשר אמיתי" : "";

    // ── person-level: real records only, value similarity NEVER involved ──
    if (memberId && g.member_ids.includes(memberId)) {
      subject_relations.push({
        group_id: g.group_id, group_name: g.name, family_ref: null,
        relation_type: "MEMBER_OF",
        match_reason: `${isDemo ? "חברות ברשימת DEMO" : "חברות אמיתית"}: ${memberId} ברשימת החברים של הקבוצה${demoSuffix}`,
        confidence: 0.95, provenance: "REAL_MEMBERSHIP", operational_evidence: [memberId],
      });
    }
    if (g.bridge_action_ids.length > 0) {
      subject_relations.push({
        group_id: g.group_id, group_name: g.name, family_ref: null,
        relation_type: "CONTRIBUTES_TO",
        match_reason: `${g.bridge_action_ids.length} Action מקושר לקבוצה (ACTION_AFFECTS_COMMUNITY)${demoSuffix}`,
        confidence: 0.85, provenance: "BRIDGE_LINK", operational_evidence: [...g.bridge_action_ids],
      });
    }
    if (g.bridge_effect_ids.length > 0) {
      subject_relations.push({
        group_id: g.group_id, group_name: g.name, family_ref: null,
        relation_type: "AFFECTED_BY",
        match_reason: `${g.bridge_effect_ids.length} Effect מהקבוצה מגיע לאדם (EFFECT_AFFECTS_PERSON)${demoSuffix}`,
        confidence: 0.85, provenance: "BRIDGE_LINK", operational_evidence: [...g.bridge_effect_ids],
      });
    }
    const benefits = memberId ? g.transfers.filter((t) => t.recipient === memberId) : [];
    if (benefits.length > 0) {
      subject_relations.push({
        group_id: g.group_id, group_name: g.name, family_ref: null,
        relation_type: "BENEFITS_FROM",
        match_reason: `${benefits.length} Transfer שהאדם נמענו${demoSuffix}`,
        confidence: 0.9, provenance: "TRANSFER_RECORD", operational_evidence: benefits.map((b) => b.transfer_id),
      });
    }

    // ── value-level: interpretation, labeled as such ──
    const joined = joinCandidates.find((c) =>
      stems3(c.text).some((s) => g.central_value.includes(s))
      || g.central_value.includes(c.text) || c.text.includes(g.central_value));
    if (joined) {
      observation_relations.push({
        group_id: g.group_id, group_name: g.name, family_ref: joined.family_ref,
        relation_type: "SHARED_VALUE",
        match_reason: `חפיפת ערך: "${joined.text}" (${joined.tierWord}) ↔ central_value "${g.central_value}" — חפיפת ערכים, לא חברות`,
        confidence: joined.tierWord === "CLAIMED" ? 0.7 : 0.5,
        provenance: "VALUE_JOIN", operational_evidence: [],
      });
      // SUPPORTS only when the value overlap AND a real contribution both hold.
      if (g.bridge_action_ids.length > 0) {
        observation_relations.push({
          group_id: g.group_id, group_name: g.name, family_ref: joined.family_ref,
          relation_type: "SUPPORTS",
          match_reason: `חפיפת ערך + תרומה תפעולית אמיתית (${g.bridge_action_ids.length} Action) — שניהם נדרשים`,
          confidence: 0.75, provenance: "BRIDGE_LINK", operational_evidence: [...g.bridge_action_ids],
        });
      }
    }

    // TENSION only on a group the person actually relates to (subject graph).
    if (g.tension_ids.length > 0 && subject_relations.length > 0) {
      subject_relations.push({
        group_id: g.group_id, group_name: g.name, family_ref: null,
        relation_type: "TENSION",
        match_reason: `${g.tension_ids.length} Tension פתוח בקבוצה שהאדם קשור אליה${demoSuffix}`,
        confidence: 0.7, provenance: "TENSION_RECORD", operational_evidence: [...g.tension_ids],
      });
    }
    // OPPOSES: no real opposition record type exists — never emitted.

    const operational = g.member_ids.length > 0 && (g.transfers.length + g.effects.length + g.bridge_action_ids.length) > 0;
    // A DEMO group can never be MATCHED — its "evidence" is fixture data.
    const subject_state: GroupResolutionState = isDemo
      ? (subject_relations.length > 0 ? "CANDIDATE" : "UNRESOLVED")
      : subject_relations.some((r) => r.operational_evidence.length > 0)
        ? "MATCHED"
        : "UNRESOLVED";
    const observation_state: GroupResolutionState = isDemo
      ? (joined ? "CANDIDATE" : "UNRESOLVED")
      : joined && operational
        ? "MATCHED"
        : joined
          ? "CANDIDATE"
          : "UNRESOLVED";

    return { group_id: g.group_id, group_name: g.name, provenance: g.provenance, subject_state, observation_state, subject_relations, observation_relations };
  });

  // Families that joined nothing — visible, never silently dropped.
  const joinedFamilyRefs = new Set(
    resolutions.flatMap((r) => r.observation_relations.map((rel) => rel.family_ref).filter((f): f is string => f !== null)),
  );
  const unresolved_families = familyMatches
    .filter((f) => f.tier !== "TOKEN_ONLY" && !joinedFamilyRefs.has(f.ref))
    .map((f) => ({
      family_ref: f.ref, label: f.label,
      reason: "אף קבוצת ערך קיימת אינה נושאת את המשפחה הזו — UNRESOLVED; לא נוצרת קבוצה",
    }));

  const best = (states: GroupResolutionState[]): GroupResolutionState =>
    states.includes("MATCHED") ? "MATCHED" : states.includes("CANDIDATE") ? "CANDIDATE" : "UNRESOLVED";

  return {
    groups: resolutions,
    subject_group_relations: resolutions.flatMap((r) => r.subject_relations),
    observation_group_relations: resolutions.flatMap((r) => r.observation_relations),
    subject_overall: best(resolutions.map((r) => r.subject_state)),
    observation_overall: best(resolutions.map((r) => r.observation_state)),
    unresolved_families,
  };
}
