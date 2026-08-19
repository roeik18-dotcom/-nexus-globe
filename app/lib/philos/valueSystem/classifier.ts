/**
 * PHILOS Value System — the generic classification engine.
 *
 * System contract: PHILOS_VALUE_SYSTEM_MASTER_INGEST_COMBINED_v4.1.md.
 * Pipeline (§17.1): Observation → Base Values → 6 Classes → Contradictions
 * → Value Family → General Value → Actual Value Group / UNRESOLVED.
 *
 * This REPLACES spider-specific value detection: nothing below names a
 * spider, ugliness, or acceptance. Every rule is generic over the 65-entry
 * Base Value registry, the 28 candidate families, the six-class model and
 * the contract's contradiction types. The spider case is now a REGRESSION
 * TEST of this engine, not its shape.
 *
 * EPISTEMIC RULES the whole module enforces:
 *   - Everything here is INTERPRETATION (STATIC): deterministic token
 *     detection over a persisted record's own text. Every match exposes
 *     `ref`, `reason` (the literal matched tokens), `confidence`, and
 *     `provenance` — the basis is always inspectable.
 *   - Confidence tiers, because a bare token is NOT a value relation
 *     (contract: "no generic single-token match may certify"):
 *       CLAIMED     the stem sits inside the text's own explicit value
 *                   claim ("X היא/הוא ערך") — the strongest a text can say
 *       CONTEXTUAL  the stem recurs (≥2 occurrences) — thematic presence
 *       TOKEN_ONLY  a single occurrence — CONDITIONAL, never certifying;
 *                   surfaced so a reviewer can confirm with real context
 *   - GENERAL VALUE is its own ontology (§5): the claimed phrase becomes a
 *     GENERAL_VALUE_CANDIDATE. A Value Family is NEVER displayed as the
 *     General Value — the F21 ≠ "קבלת השונה" ambiguity is exactly what
 *     this type split exists to prevent.
 *   - VALUE GROUP matching (§17.4): only against EXISTING operational
 *     groups. MATCHED requires a real, REAL-provenance group with members
 *     AND ≥1 operational relation (Need/Capability/Resource/Action/
 *     Effect); CANDIDATE = a name-level join that fails operationality or
 *     is DEMO; otherwise UNRESOLVED. No group is ever created from a
 *     detected value.
 *   - COLOR roles (§8/§17.6) are semantic ROUTING METADATA attached to
 *     detections — never a state, never a value, and Cell_ID ≠ Color_ID.
 */
import { BASE_VALUES, CANDIDATE_VALUE_FAMILIES, type BaseValue } from "./baseValueRegistry";

export type ConfidenceTier = "CLAIMED" | "CONTEXTUAL" | "TOKEN_ONLY";

/** Numeric shadow of the tier for sorting/aggregation — display uses the tier. */
const TIER_SCORE: Record<ConfidenceTier, number> = { CLAIMED: 0.9, CONTEXTUAL: 0.6, TOKEN_ONLY: 0.3 };

export interface ValueMatch {
  ref: string;
  label: string;
  reason: string;
  confidence: number;
  tier: ConfidenceTier;
  /** TOKEN_ONLY matches are conditional — never certifying on their own. */
  conditional: boolean;
  provenance: "TEXT_TOKEN_MATCH";
}

export type SixClassId =
  | "PHYSICAL_INTERNAL" | "PHYSICAL_EXTERNAL"
  | "EMOTIONAL_INTERNAL" | "EMOTIONAL_EXTERNAL"
  | "COGNITIVE_INTERNAL" | "COGNITIVE_EXTERNAL";

export interface SixClassCell {
  class: SixClassId;
  mentioned: boolean;
  /** The literal tokens that justified the mention — [] when absent. */
  tokens: string[];
}

export type ContradictionType =
  | "INTERNAL_VS_EXTERNAL"
  | "PHYSICAL_VS_EMOTIONAL"
  | "EMOTIONAL_VS_COGNITIVE"
  | "COGNITIVE_VS_PHYSICAL_ACTION"
  | "DECLARED_VALUE_VS_ACTION";

export interface ContradictionMatch {
  ref: ContradictionType;
  reason: string;
  confidence: number;
  provenance: "TEXT_TOKEN_MATCH";
}

export interface FamilyMatch {
  ref: string;
  label: string;
  /** Which base-value matches carried it — the inspectable basis. */
  via_base_values: string[];
  reason: string;
  confidence: number;
  tier: ConfidenceTier;
  status: "REVIEW_REQUIRED";
  provenance: "BASE_VALUE_SORT_v4.1";
}

export interface GeneralValueMatch {
  /** Normalized candidate ref — its OWN ontology, never a family id. */
  ref: string;
  claimed_phrase: string;
  reason: string;
  confidence: number;
  status: "GENERAL_VALUE_CANDIDATE";
  provenance: "TEXT_VALUE_CLAIM";
}

export type GroupMatchState = "MATCHED" | "CANDIDATE" | "UNRESOLVED";

export interface OperationalGroupInput {
  group_id: string;
  name: string;
  central_value: string;
  provenance: "REAL" | "DEMO";
  member_count: number;
  /** Real operational relations this group actually has. */
  operational_links: { needs: number; offers: number; actions: number; effects: number };
}

export interface GroupMatch {
  state: GroupMatchState;
  ref: string | null;
  label: string | null;
  reason: string;
  confidence: number;
  provenance: "GROUP_JOIN";
}

export type ColorRole = "RED" | "ORANGE" | "YELLOW" | "GREEN" | "BLUE" | "PURPLE" | "WHITE";

export interface ColorRoleRef {
  role: ColorRole;
  /** The contract's own semantic word for the role. */
  meaning: string;
  reason: string;
}

export interface ObservationClassification {
  base_value_matches: ValueMatch[];
  six_class_reading: SixClassCell[];
  contradictions: ContradictionMatch[];
  value_family_matches: FamilyMatch[];
  general_value_matches: GeneralValueMatch[];
  value_group_match: GroupMatch;
  color_roles: ColorRoleRef[];
}

// ── token machinery ─────────────────────────────────────────────────────────

/** Occurrences of a base-value label's stem(s) in the text. A multi-word
 *  label counts only when EVERY word's stem appears (e.g. "שיתוף פעולה"
 *  must not fire on "פעולה" alone). */
function labelOccurrences(label: string, text: string): { count: number; tokens: string[] } {
  const words = label.split(/\s+/);
  const stems = words.map((w) => w.replace(/[^֐-׿]/g, "").slice(0, 3)).filter((s) => s.length >= 3);
  if (stems.length === 0) return { count: 0, tokens: [] };
  const textTokens = text.split(/[^֐-׿]+/).filter(Boolean);
  const perStem = stems.map((s) => textTokens.filter((t) => t.replace(/^[הולב]/, "").startsWith(s) || t.startsWith(s)));
  if (perStem.some((hits) => hits.length === 0)) return { count: 0, tokens: [] };
  const count = Math.min(...perStem.map((h) => h.length));
  return { count, tokens: [...new Set(perStem.flat())].slice(0, 4) };
}

/** "X היא/הוא ערך" — the text's own explicit value claim(s). */
const VALUE_CLAIM = /([֐-׿"׳״ ]{2,40}?)\s+(?:היא|הוא)\s+ערך/g;

function valueClaims(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(VALUE_CLAIM)) out.push(m[1].trim());
  return out;
}

// ── six classes (contract §3: 3 DOMAINS × 2 ORIENTATIONS) ───────────────────

const DOMAIN_TOKENS = {
  PHYSICAL: /גופני|גופנית|גוף|פיזי|פיזית/g,
  EMOTIONAL: /רגשי|רגשית|רגש|פחד|גועל|דחייה|חמלה/g,
  COGNITIVE: /שכלי|שכלית|שכל|קוגניטיבי|תפיסה|שיפוט/g,
} as const;

const ORIENTATION_TOKENS = {
  INTERNAL: /פנימי|פנימית|תחושה|דחף/g,
  EXTERNAL: /חיצוני|חיצונית|בעולם|כלפי/g,
} as const;

const CONTRADICTION_TOKENS = /ניגוד|סתירה|קונפליקט|למרות ש/;
const ACTION_PUSH_TOKENS = /פעולה פיזית|להרוג|הריגה|לפגוע|פגיעה/;
const DRIVE_TOKENS = /דחף|דוחף|לדחוף|דחיפה|מומנטום/;
const TRANSITION_TOKENS = /מעבר|שינוי|הפך ל/;

function matchesOf(re: RegExp, text: string): string[] {
  return [...new Set([...text.matchAll(new RegExp(re.source, "g"))].map((m) => m[0]))];
}

// ── the engine ──────────────────────────────────────────────────────────────

export function classifyObservationText(
  text: string,
  operationalGroups: readonly OperationalGroupInput[] = [],
): ObservationClassification {
  const claims = valueClaims(text);
  const claimText = claims.join(" ");

  // 1. Base Values — generic scan of ALL 65 registry entries.
  const base_value_matches: ValueMatch[] = [];
  for (const bv of BASE_VALUES) {
    const occ = labelOccurrences(bv.label, text);
    if (occ.count === 0) continue;
    const inClaim = claimText.length > 0 && labelOccurrences(bv.label, claimText).count > 0;
    const tier: ConfidenceTier = inClaim ? "CLAIMED" : occ.count >= 2 ? "CONTEXTUAL" : "TOKEN_ONLY";
    base_value_matches.push({
      ref: bv.id,
      label: bv.label,
      reason: inClaim
        ? `בתוך הצהרת ערך מפורשת (tokens: ${occ.tokens.join(", ")})`
        : `tokens: ${occ.tokens.join(", ")} × ${occ.count}`,
      confidence: TIER_SCORE[tier],
      tier,
      conditional: tier === "TOKEN_ONLY",
      provenance: "TEXT_TOKEN_MATCH",
    });
  }
  base_value_matches.sort((a, b) => b.confidence - a.confidence);

  // 2. Six classes — a cell is mentioned only when BOTH its domain and its
  //    orientation are named; the six cells stay distinct by construction.
  const domainHits = {
    PHYSICAL: matchesOf(DOMAIN_TOKENS.PHYSICAL, text),
    EMOTIONAL: matchesOf(DOMAIN_TOKENS.EMOTIONAL, text),
    COGNITIVE: matchesOf(DOMAIN_TOKENS.COGNITIVE, text),
  };
  const orientationHits = {
    INTERNAL: matchesOf(ORIENTATION_TOKENS.INTERNAL, text),
    EXTERNAL: matchesOf(ORIENTATION_TOKENS.EXTERNAL, text),
  };
  const six_class_reading: SixClassCell[] = (["PHYSICAL", "EMOTIONAL", "COGNITIVE"] as const).flatMap((d) =>
    (["INTERNAL", "EXTERNAL"] as const).map((o): SixClassCell => ({
      class: `${d}_${o}` as SixClassId,
      mentioned: domainHits[d].length > 0 && orientationHits[o].length > 0,
      tokens: domainHits[d].length > 0 && orientationHits[o].length > 0 ? [...domainHits[d].slice(0, 2), ...orientationHits[o].slice(0, 2)] : [],
    })),
  );

  // 3. Contradictions — typed per the contract; each requires its OWN
  //    components present plus an opposition marker. First-class, never
  //    merged into the class reading.
  const contradictions: ContradictionMatch[] = [];
  const oppo = CONTRADICTION_TOKENS.exec(text)?.[0] ?? null;
  if (oppo) {
    const add = (ref: ContradictionType, ok: boolean, why: string) => {
      if (ok) contradictions.push({ ref, reason: `${why} · marker: "${oppo}"`, confidence: 0.6, provenance: "TEXT_TOKEN_MATCH" });
    };
    add("INTERNAL_VS_EXTERNAL", orientationHits.INTERNAL.length > 0 && orientationHits.EXTERNAL.length > 0,
      `פנימי (${orientationHits.INTERNAL[0] ?? ""}) מול חיצוני (${orientationHits.EXTERNAL[0] ?? ""})`);
    add("EMOTIONAL_VS_COGNITIVE", domainHits.EMOTIONAL.length > 0 && domainHits.COGNITIVE.length > 0,
      `רגש (${domainHits.EMOTIONAL[0] ?? ""}) מול שכל (${domainHits.COGNITIVE[0] ?? ""})`);
    add("PHYSICAL_VS_EMOTIONAL", domainHits.PHYSICAL.length > 0 && domainHits.EMOTIONAL.length > 0
      && ACTION_PUSH_TOKENS.test(text) === false,
      `גופני (${domainHits.PHYSICAL[0] ?? ""}) מול רגשי (${domainHits.EMOTIONAL[0] ?? ""})`);
    add("COGNITIVE_VS_PHYSICAL_ACTION", domainHits.COGNITIVE.length > 0 && ACTION_PUSH_TOKENS.test(text),
      `שכל (${domainHits.COGNITIVE[0] ?? ""}) מול פעולה פיזית (${ACTION_PUSH_TOKENS.exec(text)?.[0] ?? ""})`);
    add("DECLARED_VALUE_VS_ACTION", claims.length > 0 && ACTION_PUSH_TOKENS.test(text),
      `ערך מוצהר ("${claims[0] ?? ""}") מול דחף לפעולה (${ACTION_PUSH_TOKENS.exec(text)?.[0] ?? ""})`);
  }

  // 4. Value Families — ONLY via matched base values and the registry's
  //    own §17.3 sort. Family tier = best member tier; ≥2 member base
  //    values strengthen the reason but never invent a new tier.
  const value_family_matches: FamilyMatch[] = CANDIDATE_VALUE_FAMILIES.flatMap((fam) => {
    const members = base_value_matches.filter((m) => {
      const bv = BASE_VALUES.find((b) => b.id === m.ref) as BaseValue;
      return bv.candidate_family_refs.includes(fam.id);
    });
    if (members.length === 0) return [];
    const best = members[0].tier;
    return [{
      ref: fam.id,
      label: fam.label,
      via_base_values: members.map((m) => `${m.ref} ${m.label} (${m.tier})`),
      reason: `${members.length} ערכי בסיס מתוך המשפחה זוהו בטקסט`,
      confidence: Math.min(0.95, TIER_SCORE[best] + (members.length - 1) * 0.05),
      tier: best,
      status: "REVIEW_REQUIRED" as const,
      provenance: "BASE_VALUE_SORT_v4.1" as const,
    }];
  }).sort((a, b) => b.confidence - a.confidence);

  // 5. General Values — the text's OWN claims, a separate ontology. Never
  //    a family id, never replaced by the family's name.
  const general_value_matches: GeneralValueMatch[] = claims.map((phrase) => ({
    ref: `gv_candidate:${phrase.replace(/\s+/g, "_")}`,
    claimed_phrase: phrase,
    reason: `הטקסט עצמו מצהיר "${phrase} היא/הוא ערך"`,
    confidence: 0.9,
    status: "GENERAL_VALUE_CANDIDATE",
    provenance: "TEXT_VALUE_CLAIM",
  }));

  // 6. Value Group — match ONLY against existing operational groups.
  const value_group_match = matchValueGroups(base_value_matches, value_family_matches, general_value_matches, operationalGroups);

  // 7. Color roles — semantic routing metadata (§8/§17.6), attached per
  //    detection. Cell_ID ≠ Color_ID; never a state, never a value.
  const color_roles: ColorRoleRef[] = [
    { role: "WHITE" as const, meaning: "Evidence/Reference", reason: "ה-Observation עצמו הוא הראיה" },
    ...(general_value_matches.length > 0 ? [{ role: "PURPLE" as const, meaning: "Meaning/General Value", reason: `ערך כללי מוצהר: ${general_value_matches[0].claimed_phrase}` }] : []),
    ...(value_family_matches.length > 0 ? [{ role: "BLUE" as const, meaning: "Classification/Logic", reason: `סיווג למשפחת ערך: ${value_family_matches[0].label}` }] : []),
    ...(value_group_match.state !== "UNRESOLVED" ? [{ role: "GREEN" as const, meaning: "Connection/Value Group", reason: `קשר קבוצתי: ${value_group_match.label ?? ""}` }] : []),
    ...(ACTION_PUSH_TOKENS.test(text) ? [{ role: "RED" as const, meaning: "Action", reason: `token פעולה: "${ACTION_PUSH_TOKENS.exec(text)?.[0]}"` }] : []),
    ...(DRIVE_TOKENS.test(text) ? [{ role: "ORANGE" as const, meaning: "Drive/Transfer", reason: `token דחף: "${DRIVE_TOKENS.exec(text)?.[0]}"` }] : []),
    ...(TRANSITION_TOKENS.test(text) ? [{ role: "YELLOW" as const, meaning: "Transition", reason: `token מעבר: "${TRANSITION_TOKENS.exec(text)?.[0]}"` }] : []),
  ];

  return { base_value_matches, six_class_reading, contradictions, value_family_matches, general_value_matches, value_group_match, color_roles };
}

/**
 * §17.4 — Actual Value Group matching. Never creates a group. A name-level
 * join uses the group's own central_value against matched base values /
 * general-value claims; operationality gates MATCHED.
 */
export function matchValueGroups(
  baseValues: readonly ValueMatch[],
  families: readonly FamilyMatch[],
  generalValues: readonly GeneralValueMatch[],
  groups: readonly OperationalGroupInput[],
): GroupMatch {
  const nameCandidates = [
    ...generalValues.map((g) => g.claimed_phrase),
    ...baseValues.filter((b) => !b.conditional).map((b) => b.label),
    ...families.filter((f) => f.tier !== "TOKEN_ONLY").map((f) => f.label),
  ];
  for (const group of groups) {
    const joined = nameCandidates.find((n) => {
      const stems3 = n.split(/[\s,]+/).map((w) => w.replace(/^ה/, "").replace(/[^֐-׿]/g, "").slice(0, 3)).filter((s) => s.length >= 3);
      return stems3.some((s) => group.central_value.includes(s)) || group.central_value.includes(n) || n.includes(group.central_value);
    });
    if (!joined) continue;
    const links = group.operational_links;
    const operational = group.member_count > 0 && (links.needs + links.offers + links.actions + links.effects) > 0;
    if (group.provenance === "REAL" && operational) {
      return { state: "MATCHED", ref: group.group_id, label: group.name, reason: `join דרך "${joined}" → central_value "${group.central_value}" · ${group.member_count} members · קשר תפעולי קיים`, confidence: 0.7, provenance: "GROUP_JOIN" };
    }
    return {
      state: "CANDIDATE", ref: group.group_id, label: group.name,
      reason: group.provenance !== "REAL"
        ? `join דרך "${joined}" אבל הקבוצה DEMO — לא קבוצה תפעולית אמיתית`
        : `join דרך "${joined}" אבל אין קשר תפעולי (Need/Offer/Action/Effect) — קטגוריית תוכן, לא קבוצה`,
      confidence: 0.4, provenance: "GROUP_JOIN",
    };
  }
  return { state: "UNRESOLVED", ref: null, label: null, reason: "אף קבוצת ערך קיימת לא הצטלבה עם הערכים שזוהו — לא נוצרת קבוצה מערך מזוהה", confidence: 0, provenance: "GROUP_JOIN" };
}
