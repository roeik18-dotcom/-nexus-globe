/**
 * Source-backed PHILOS Value Universe (ledger §41, extended §42, §43, §44).
 *
 * §41's entries are quoted/paraphrased from `PHILOS-CORPUS-EXTRACTION-
 * SAMPLE.md` (repo root, 95 files, 4 passes). §42 adds two further
 * provenances over the SAME real Dropbox theory corpus
 * (`source-corpus/README.md`, 2372 real files): direct reads (via
 * Python `plistlib` against the raw `.textClipping` bplist — `textutil`
 * mangles the Hebrew encoding) of files in `+אדם/פילוס אוריאנטציה
 * תזכורות ליבה-2026`, and a relay from a concurrent Claude Code session
 * that independently extracted the same 361-file folder. §43 adds 3
 * more real files from `קונפינג-אדם-מאגר-אב-שלד-היררכי`, all dated
 * 2026-08-15 (the newest source material in the corpus at the time of
 * this pass): `PHILOS_10_Principles_20_Expressions_HE.docx`,
 * `PHILOS_9_STRUCTURE_RECONSTRUCTION_HE.docx`,
 * `PHILOS_Brain_Human_Explanation_HE.docx` — read directly (via macOS
 * `textutil -convert txt`, which converts cleanly for ordinary Word
 * documents; the Hebrew-mangling bug in §42's note is specific to
 * Reminders-app-originated `.textClipping` files, not `.docx`). §44
 * resolves the "20/29/52-item contradiction list" variants named in
 * `rr_multi_version_contradiction_lists` — 3 more real files, all WITHIN
 * the already-scanned 361-file folder, read to full depth (see
 * `SOURCE_CONTRADICTION_LIST_VARIANTS`, which preserves each closed-list
 * claim as its own record rather than picking one). See
 * `SOURCE_COVERAGE` at the bottom of this file for the real, still-
 * partial coverage figure — completeness is not claimed.
 *
 * **"Do not classify every positive concept as a Value. Do not classify
 * every opposition as a Value pair." — applied literally.** Of the
 * opposite-pairs read across both passes, the large majority are
 * `NON_VALUE` (matter↔spaciousness, id↔superego — physical/psychic-
 * structure terms, not value judgments) or `REVIEW_REQUIRED` (the source
 * itself doesn't disambiguate, or — new in §42 — the source contains
 * multiple non-reconciled versions of the same "closed list" claim; see
 * `rr_multi_version_contradiction_lists`). Only a handful are typed
 * `TENSION` — the pairs the source itself frames as value-convergence
 * examples, not "pairs that sound oppositional."
 *
 * **0 concepts overlap the current 15-item runtime Value registry**
 * (`valueRegistry.ts`) — checked directly: "אחריות" (the one real
 * registered Value) does not appear anywhere in either extraction. Two
 * real, disjoint vocabularies, not silently merged — though §42 found
 * one real, worth-noting near-neighbor (`gc_zero_value_personal_
 * responsibility`, explicitly NOT merged — see its own note).
 */

export type SourceConceptType =
  | "VALUE" | "VALUE_DOMAIN" | "PRINCIPLE" | "RIGHT" | "DUTY" | "NEED"
  | "CONDITION" | "CAPABILITY" | "RESOURCE" | "QUALITY" | "STANDARD"
  | "MEASURABLE_DIMENSION" | "CONTINUUM" | "OPPOSITION" | "TENSION"
  | "SOCIAL_RELATION" | "GROUP_CRITERION" | "OUTCOME" | "NON_VALUE" | "REVIEW_REQUIRED";

export const SOURCE_CONCEPT_TYPES: SourceConceptType[] = [
  "VALUE", "VALUE_DOMAIN", "PRINCIPLE", "RIGHT", "DUTY", "NEED",
  "CONDITION", "CAPABILITY", "RESOURCE", "QUALITY", "STANDARD",
  "MEASURABLE_DIMENSION", "CONTINUUM", "OPPOSITION", "TENSION",
  "SOCIAL_RELATION", "GROUP_CRITERION", "OUTCOME", "NON_VALUE", "REVIEW_REQUIRED",
];

export type Confidence = "high" | "moderate" | "low";
export type ReviewStatus = "reviewed" | "needs_review";

/** §49-follow-up (ledger §50): SOURCE MODEL → RUNTIME CANON promotion
 *  status. Every SourceConcept, source relation, quality-group element,
 *  hierarchy axis, and formation rule is classified into exactly one of
 *  these 4 buckets — see `classifyForRuntime()` for the deterministic
 *  rule and its rationale.
 *  - CANONICAL_RUNTIME: the product may present this as its own working
 *    model — high confidence AND independently reviewed.
 *  - REFERENCE_ONLY: real, cited, kept visible — but not yet trusted
 *    enough to drive primary product UI as settled canon (moderate
 *    confidence, or reviewed-but-not-high, or pending independent
 *    re-verification of a peer-relayed citation).
 *  - REVIEW_REQUIRED: unresolved by the SOURCE itself (type
 *    REVIEW_REQUIRED, or low confidence + needs_review) — never
 *    silently resolved by this promotion step.
 *  - REJECTED_FOR_RUNTIME: explicitly excluded from ever being promoted
 *    (NON_VALUE — not a value judgment in the first place — including
 *    the named ranking/scoring anti-patterns this codebase's own
 *    NO_GLOBAL_HUMAN_SCORE invariant forbids). */
export type RuntimeStatus = "CANONICAL_RUNTIME" | "REFERENCE_ONLY" | "REVIEW_REQUIRED" | "REJECTED_FOR_RUNTIME";

export interface SourceConcept {
  canonical_id: string;
  /** Verbatim or near-verbatim source wording (Hebrew, + inline English gloss where the source/extraction supplied one). */
  source_wording: string;
  /** English working label — a rendering aid, never presented as a translation authority over the source_wording. */
  normalized_label: string;
  definition: string;
  type: SourceConceptType;
  /** canonical_id of a VALUE_DOMAIN entry below, when a real source
   *  category applies — undefined when no real domain evidence exists. */
  domain?: string;
  source_document: string;
  /** "Pass 1"–"Pass 4": the original 95-file extraction sample
   *  (`PHILOS-CORPUS-EXTRACTION-SAMPLE.md`). "Pass 5": direct reads this
   *  pass (§42) via plistlib against the raw .textClipping — the highest-
   *  confidence provenance, since the actual file bytes were read.
   *  "Pass 6 (peer relay)": relayed from a concurrent peer Claude Code
   *  session's own direct extraction of `+אדם/פילוס אוריאנטציה תזכורות
   *  ליבה-2026` (361 files) — real, cited by that session down to
   *  clipping index, but NOT independently re-verified against the raw
   *  file by this module's own author; confidence capped at "moderate"
   *  accordingly (never "high") until independently re-checked.
   *  "Pass 7": §43 — direct reads of 3 new `.docx` files (2026-08-15,
   *  `קונפינג-אדם-מאגר-אב-שלד-היררכי`) via `textutil -convert txt`.
   *  "Pass 8": §44/§45 — deeper direct reads (plistlib) of files WITHIN
   *  the already-scanned `תזכורות ליבה-2026` folder (does not move
   *  `files_scanned` — see `SOURCE_COVERAGE`'s own note).
   *  "Pass 9": §46 — 2 new real files in the orientation-dimensions ZIP's
   *  prose folder (` פילוס אוריאנטציה עקרון פריזמת שלוש המיימדים
   *  והכוחות המשפיעים בפועל/פילוס אוריאנטציה`), a NEW corpus region —
   *  this DOES move `files_scanned` (+2).
   *  "Pass 10": §47 — a full deterministic file-type triage of the ENTIRE
   *  2372-file corpus (not just this folder), plus direct reads of the
   *  remaining real prose files in the orientation-dimensions folder's
   *  "פילוס אוריאנטציה" subfolder (the 4 files Pass 9 didn't read) and
   *  header/filename-level inspection (not full-text reading) of the
   *  ~86 remaining .xlsx/.docx/.rtf files — confirming, not re-deriving,
   *  Pass 9's own "already Human Config infrastructure" finding. */
  source_pass: "Pass 1" | "Pass 2" | "Pass 3" | "Pass 4" | "Pass 5" | "Pass 6 (peer relay)" | "Pass 7" | "Pass 8" | "Pass 9" | "Pass 10";
  confidence: Confidence;
  review_status: ReviewStatus;
  notes?: string;
  /** §49 (ledger) reconciliation: when set, this entry is a real,
   *  independently-cited CORROBORATION of the same concept as every
   *  other entry sharing this key — not a distinct concept. The entry
   *  whose own `canonical_id` equals this string is the canonical
   *  representative (first-found, richest citation kept as the primary
   *  record); the others remain in `SOURCE_CONCEPTS` in full (their own
   *  distinct elaboration is real evidence, not discarded) but are
   *  excluded from `countCanonicalConcepts()`'s total. Only set for
   *  entries verified this pass to be the SAME real-world claim, not
   *  merely thematically similar — see ledger §49 for the reconciliation
   *  method (why these 2 clusters merge and why most "corroborating"
   *  entries elsewhere in this file do NOT: they each add real, distinct
   *  elaboration beyond the bare pairing, so merging them would discard
   *  evidence, not just tidy bookkeeping). */
  canonical_group?: string;
}

// ── VALUE_DOMAIN — the real "10 contradiction categories" (Pass 2), reused
//    as the closest real domain taxonomy the source actually contains,
//    not a fabricated new one. ─────────────────────────────────────────
const DOMAIN_SOURCE = "קטגוריות ניגודים — פילוס אוריאנטציה";
export const SOURCE_DOMAINS: SourceConcept[] = [
  { canonical_id: "dom_ontological", source_wording: "ניגודים אונטולוגיים", normalized_label: "Ontological", definition: "Contradiction category A — being/existence-level oppositions.", type: "VALUE_DOMAIN", source_document: DOMAIN_SOURCE, source_pass: "Pass 2", confidence: "high", review_status: "reviewed" },
  { canonical_id: "dom_bodily_sensory", source_wording: "ניגודים גופניים־חושיים", normalized_label: "Bodily-Sensory", definition: "Contradiction category B.", type: "VALUE_DOMAIN", source_document: DOMAIN_SOURCE, source_pass: "Pass 2", confidence: "high", review_status: "reviewed" },
  { canonical_id: "dom_emotional_internal", source_wording: "ניגודים רגשיים־פנימיים", normalized_label: "Emotional-Internal", definition: "Contradiction category C.", type: "VALUE_DOMAIN", source_document: DOMAIN_SOURCE, source_pass: "Pass 2", confidence: "high", review_status: "reviewed" },
  { canonical_id: "dom_cognitive_perceptual", source_wording: "ניגודים שכליים־תפיסתיים", normalized_label: "Cognitive-Perceptual", definition: "Contradiction category D.", type: "VALUE_DOMAIN", source_document: DOMAIN_SOURCE, source_pass: "Pass 2", confidence: "high", review_status: "reviewed" },
  { canonical_id: "dom_interpersonal", source_wording: "ניגודים בין־אישיים", normalized_label: "Interpersonal", definition: "Contradiction category E.", type: "VALUE_DOMAIN", source_document: DOMAIN_SOURCE, source_pass: "Pass 2", confidence: "high", review_status: "reviewed" },
  { canonical_id: "dom_social_cultural", source_wording: "ניגודים חברתיים־תרבותיים", normalized_label: "Social-Cultural", definition: "Contradiction category F.", type: "VALUE_DOMAIN", source_document: DOMAIN_SOURCE, source_pass: "Pass 2", confidence: "high", review_status: "reviewed" },
  { canonical_id: "dom_structural_systemic", source_wording: "ניגודים מבניים־מערכתיים", normalized_label: "Structural-Systemic", definition: "Contradiction category G.", type: "VALUE_DOMAIN", source_document: DOMAIN_SOURCE, source_pass: "Pass 2", confidence: "high", review_status: "reviewed" },
  { canonical_id: "dom_value_moral", source_wording: "ניגודים ערכיים־מוסריים", normalized_label: "Value-Moral", definition: "Contradiction category H — the domain most directly relevant to VALUE/TENSION concepts below.", type: "VALUE_DOMAIN", source_document: DOMAIN_SOURCE, source_pass: "Pass 2", confidence: "high", review_status: "reviewed" },
  { canonical_id: "dom_existential", source_wording: "ניגודים אקזיסטנציאליים־קיומיים", normalized_label: "Existential", definition: "Contradiction category I.", type: "VALUE_DOMAIN", source_document: DOMAIN_SOURCE, source_pass: "Pass 2", confidence: "high", review_status: "reviewed" },
  { canonical_id: "dom_meta_consciousness", source_wording: "ניגודים מטא־תודעתיים", normalized_label: "Meta-Consciousness", definition: "Contradiction category J.", type: "VALUE_DOMAIN", source_document: DOMAIN_SOURCE, source_pass: "Pass 2", confidence: "high", review_status: "reviewed" },
];

export const SOURCE_CONCEPTS: SourceConcept[] = [
  ...SOURCE_DOMAINS,

  // ── PRINCIPLE ──────────────────────────────────────────────────────
  {
    canonical_id: "pr_value_from_contradiction", source_wording: "המערכת לא מחפשת שכולם יחשבו אותו דבר. היא מחפשת את הערך המשותף שמתעורר דווקא מתוך הניגוד.",
    normalized_label: "Shared value arises from contradiction, not agreement",
    definition: "A governing principle for how a group's value forms: not consensus, but recognition of what real oppositions share.",
    type: "PRINCIPLE", domain: "dom_value_moral",
    source_document: "⸻--🌗 דיון ניגודי–ערכי- איך .textClipping", source_pass: "Pass 4", confidence: "high", review_status: "reviewed",
  },
  {
    canonical_id: "pr_no_scores", source_wording: "אין ציונים. המערכת מזהה דפוס פעולה.",
    normalized_label: "No scores — pattern recognition only",
    definition: "Explicit anti-scoring principle from the full action-cycle document — direct source support for this codebase's own NO_GLOBAL_HUMAN_SCORE invariant.",
    type: "PRINCIPLE", domain: "dom_value_moral",
    source_document: "פילוס — מחזור פעולה מלא למשתמש", source_pass: "Pass 2", confidence: "high", review_status: "reviewed",
  },
  {
    canonical_id: "pr_reality_uses_you", source_wording: "פילוס אינו שואל מה אתה רוצה להיות, אלא מה המציאות משתמשת בך להיות.",
    normalized_label: "PHILOS asks what reality uses you to be, not what you declare",
    definition: "Closing principle of the full action-cycle document — orientation is built from real observed pattern, not declared aspiration.",
    type: "PRINCIPLE",
    source_document: "פילוס — מחזור פעולה מלא למשתמש", source_pass: "Pass 2", confidence: "high", review_status: "reviewed",
  },

  // ── GROUP_CRITERION ────────────────────────────────────────────────
  {
    canonical_id: "gc_value_transparency", source_wording: "שקיפות ערכית = שליטה עצמית של ההמון.",
    normalized_label: "Value transparency as the precondition for legitimate self-governance",
    definition: "The one real, checked criterion found for what makes a value-group's self-governance legitimate: transparent value declaration by its members, not authority or vote.",
    type: "GROUP_CRITERION", domain: "dom_value_moral",
    source_document: "⸻--🌗 דיון ניגודי–ערכי- איך .textClipping", source_pass: "Pass 4", confidence: "moderate", review_status: "reviewed",
  },

  // ── QUALITY ────────────────────────────────────────────────────────
  {
    canonical_id: "ql_value_transparency_quality", source_wording: "שקיפות ערכית", normalized_label: "Value transparency (as a personal/group quality)",
    definition: "The disposition of stating one's real value position plainly — the quality the group-legitimacy criterion above is built on.",
    type: "QUALITY", domain: "dom_value_moral",
    source_document: "⸻--🌗 דיון ניגודי–ערכי- איך .textClipping", source_pass: "Pass 4", confidence: "moderate", review_status: "reviewed",
  },

  // ── TENSION — the exact 4 pairs the compass document itself names ──
  { canonical_id: "tn_honor_freedom", source_wording: "כבוד↔חופש", normalized_label: "Honor ↔ Freedom", definition: "One of 4 real examples the compass document gives of a tension whose reconciliation reveals a shared value.", type: "TENSION", domain: "dom_value_moral", source_document: "⸻--🌗 דיון ניגודי–ערכי- איך .textClipping", source_pass: "Pass 4", confidence: "high", review_status: "reviewed" },
  { canonical_id: "tn_society_individual", source_wording: "חברה↔פרט", normalized_label: "Society ↔ Individual", definition: "Same source, second example. §49: canonical representative of a 3-citation corroboration cluster — see tn_individual_collective_v2, tn_individual_group_degree_v3.", type: "TENSION", domain: "dom_value_moral", source_document: "⸻--🌗 דיון ניגודי–ערכי- איך .textClipping", source_pass: "Pass 4", confidence: "high", review_status: "reviewed", canonical_group: "tn_society_individual" },
  { canonical_id: "tn_tradition_progress", source_wording: "מסורת↔קדמה", normalized_label: "Tradition ↔ Progress", definition: "Same source, third example.", type: "TENSION", domain: "dom_value_moral", source_document: "⸻--🌗 דיון ניגודי–ערכי- איך .textClipping", source_pass: "Pass 4", confidence: "high", review_status: "reviewed" },
  { canonical_id: "tn_identity_universality", source_wording: "זהות↔אוניברסליות", normalized_label: "Identity ↔ Universality", definition: "Same source, fourth example.", type: "TENSION", domain: "dom_value_moral", source_document: "⸻--🌗 דיון ניגודי–ערכי- איך .textClipping", source_pass: "Pass 4", confidence: "high", review_status: "reviewed" },

  // ── OUTCOME ────────────────────────────────────────────────────────
  {
    canonical_id: "oc_center_rebuilt", source_wording: "המרכז נבנה מחדש", normalized_label: "The center is rebuilt",
    definition: "The described real outcome of the value-convergence process (individual→group→collective values).",
    type: "OUTCOME", source_document: "ערכי פרט- ↓ -ערכי קבו...textClipping", source_pass: "Pass 3", confidence: "moderate", review_status: "reviewed",
  },
  {
    canonical_id: "oc_capacity_score", source_wording: "capacityScore, execution gap, readiness to act",
    normalized_label: "Derived outcomes: capacity score / execution gap / readiness to act",
    definition: "Named outputs the weights-model document says are derivable from the summed layer state S.",
    type: "OUTCOME", source_document: "מודל המשקלים של פילוס אוריאנטציה", source_pass: "Pass 1", confidence: "moderate", review_status: "reviewed",
  },

  // ── MEASURABLE_DIMENSION — L1–L5, real quoted formulas ─────────────
  { canonical_id: "md_l1_internal_state", source_wording: "L1 = (Clarity + Regulation − Fear − Fatigue) / 4", normalized_label: "L1 — Internal State", definition: "L1 שלילי = בלימה פנימית · L1 חיובי = דחיפה פנימית.", type: "MEASURABLE_DIMENSION", domain: "dom_emotional_internal", source_document: "L1.textClipping", source_pass: "Pass 1", confidence: "high", review_status: "reviewed" },
  { canonical_id: "md_l2_behavior", source_wording: "L2 = (Execution + Consistency + Intention − Avoidance) / 4", normalized_label: "L2 — Behavior Layer", definition: "Execution Gap = Intention − Execution.", type: "MEASURABLE_DIMENSION", domain: "dom_bodily_sensory", source_document: "L2.textClipping", source_pass: "Pass 1", confidence: "high", review_status: "reviewed" },
  { canonical_id: "md_l3_close_relationships", source_wording: "L3 = (Support + Belonging − Pressure − Conflict) / 4", normalized_label: "L3 — Close Relationships Layer", definition: "L3 חיובי = קשרים שמאפשרים פעולה · L3 שלילי = קשרים שמגבילים פעולה.", type: "MEASURABLE_DIMENSION", domain: "dom_interpersonal", source_document: "L3.textClipping", source_pass: "Pass 1", confidence: "high", review_status: "reviewed" },
  { canonical_id: "md_l4_social_structure", source_wording: "L4 = (Freedom − EconomicPressure − RoleConstraint − SanctionRisk) / 4", normalized_label: "L4 — Social Structure Layer", definition: "L4 חיובי = מבנה מאפשר · L4 שלילי = מבנה חוסם.", type: "MEASURABLE_DIMENSION", domain: "dom_structural_systemic", source_document: "L4.textClipping", source_pass: "Pass 1", confidence: "high", review_status: "reviewed" },
  { canonical_id: "md_l5_broad_system", source_wording: "L5 = − (NormPressure + IdeologyConflict + MediaInfluence + SocialBlindness) / 4", normalized_label: "L5 — Broad System Layer", definition: "L5 קרוב לאפס = עצמאות תודעתית.", type: "MEASURABLE_DIMENSION", domain: "dom_social_cultural", source_document: "L5.textClipping", source_pass: "Pass 1", confidence: "high", review_status: "reviewed" },

  // ── CONTINUUM ──────────────────────────────────────────────────────
  {
    canonical_id: "cn_restraint_scope", source_wording: "יכולת איפוק אישית½יכולת איפוק קבוצתית", normalized_label: "Restraint capacity: personal ↔ group scope",
    definition: "Same underlying quality expressed at two different scopes — a scale/scope continuum, not two opposed values.",
    type: "CONTINUUM", domain: "dom_interpersonal",
    source_document: "טבלת ניגודים אדם.textClipping", source_pass: "Pass 1", confidence: "moderate", review_status: "reviewed",
  },

  // ── OPPOSITION ─────────────────────────────────────────────────────
  { canonical_id: "op_destruction_building", source_wording: "הרס½בניה", normalized_label: "Destruction ↔ Building", definition: "A real directional process opposition.", type: "OPPOSITION", domain: "dom_structural_systemic", source_document: "טבלת ניגודים אדם.textClipping", source_pass: "Pass 1", confidence: "moderate", review_status: "reviewed" },

  // ── NON_VALUE — core-10 base-contradiction list, physical/structural ─
  { canonical_id: "nv_matter_spaciousness", source_wording: "חומר↔מרווח", normalized_label: "Matter ↔ Spaciousness", definition: "Physical/ontological term pair, not a value judgment.", type: "NON_VALUE", domain: "dom_ontological", source_document: "ברור. הנה כל ניגודי־הבסיס", source_pass: "Pass 4", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "nv_energy_spaciousness", source_wording: "אנרגיה↔מרווח", normalized_label: "Energy ↔ Spaciousness", definition: "Physical/ontological term pair.", type: "NON_VALUE", domain: "dom_ontological", source_document: "ברור. הנה כל ניגודי־הבסיס", source_pass: "Pass 4", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "nv_becoming_decay", source_wording: "התהוות↔דעיכה", normalized_label: "Becoming ↔ Decay", definition: "Process/ontological term pair.", type: "NON_VALUE", domain: "dom_ontological", source_document: "ברור. הנה כל ניגודי־הבסיס", source_pass: "Pass 4", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "nv_id_superego", source_wording: "איד↔סופר־אגו", normalized_label: "Id ↔ Superego", definition: "Psychic-structure pairing (cross-referenced by the Six Buildings model) — not a value judgment.", type: "NON_VALUE", domain: "dom_emotional_internal", source_document: "ברור. הנה כל ניגודי־הבסיס", source_pass: "Pass 4", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "nv_threshold_collapse", source_wording: "סף↔קריסה", normalized_label: "Threshold ↔ Collapse", definition: "Structural/systemic term pair.", type: "NON_VALUE", domain: "dom_structural_systemic", source_document: "ברור. הנה כל ניגודי־הבסיס", source_pass: "Pass 4", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "nv_potential_movement", source_wording: "פוטנציאל↔תנועה", normalized_label: "Potential ↔ Movement", definition: "Physical/structural term pair.", type: "NON_VALUE", domain: "dom_structural_systemic", source_document: "ברור. הנה כל ניגודי־הבסיס", source_pass: "Pass 4", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "nv_empty_load", source_wording: "ריק↔עומס", normalized_label: "Empty ↔ Load", definition: "Physical/structural term pair.", type: "NON_VALUE", domain: "dom_structural_systemic", source_document: "ברור. הנה כל ניגודי־הבסיס", source_pass: "Pass 4", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "nv_direction_angle", source_wording: "כיוון↔זווית", normalized_label: "Direction ↔ Angle", definition: "Structural/geometric term pair.", type: "NON_VALUE", domain: "dom_structural_systemic", source_document: "ברור. הנה כל ניגודי־הבסיס", source_pass: "Pass 4", confidence: "moderate", review_status: "reviewed" },

  // ── REVIEW_REQUIRED — genuinely ambiguous, source itself unresolved ─
  { canonical_id: "rr_drive_restraint", source_wording: "דחף↔ריסון", normalized_label: "Drive ↔ Restraint", definition: "Could be value-moral or structural — the source does not disambiguate.", type: "REVIEW_REQUIRED", source_document: "ברור. הנה כל ניגודי־הבסיס", source_pass: "Pass 4", confidence: "low", review_status: "needs_review" },
  {
    canonical_id: "rr_law_freedom", source_wording: "חוק↔חופש", normalized_label: "Law ↔ Freedom",
    definition: "Named as a base-contradiction in TWO independent real documents (the core-10 list, and the 30-item list's 'personal/social' group as חופש↔חוק) — corroborating evidence it is genuinely value-relevant, not resolved to a specific classification since neither document frames it as a value-convergence source the way the compass document does for honor↔freedom.",
    type: "REVIEW_REQUIRED", source_document: "ברור. הנה כל ניגודי־הבסיס; להלן 30 ניגודי־בסיס", source_pass: "Pass 4", confidence: "moderate", review_status: "needs_review",
    notes: "Confidence raised from low to moderate this pass (§42) — real corroboration across 2 independent source documents.",
    canonical_group: "rr_law_freedom",
  },
  { canonical_id: "rr_void_space", source_wording: "חלל½מרחב", normalized_label: "Void/Cavity ↔ Space/Expanse", definition: "The extraction sample itself states this is unresolved — real evidence of a contrasted pair, not proof of how it relates to canon's 'Gap'/'Space'.", type: "REVIEW_REQUIRED", source_document: "טבלת ניגודים אדם.textClipping", source_pass: "Pass 1", confidence: "low", review_status: "needs_review" },
  { canonical_id: "rr_speed_immediacy", source_wording: "מהירות½עכשיויות", normalized_label: "Speed ↔ Immediacy", definition: "Possible near-synonym rather than true opposition — not disambiguated by the source.", type: "REVIEW_REQUIRED", source_document: "טבלת ניגודים אדם.textClipping", source_pass: "Pass 1", confidence: "low", review_status: "needs_review" },
  { canonical_id: "rr_meaning_void", source_wording: "משמעות↔ריק", normalized_label: "Meaning ↔ Void", definition: "Ambiguous: 'meaning' could be value-adjacent, 'void' echoes the purely ontological ריק/עומס pairing elsewhere — the source does not disambiguate which reading applies.", type: "REVIEW_REQUIRED", source_document: "להלן 30 ניגודי־בסיס", source_pass: "Pass 5", confidence: "low", review_status: "needs_review" },
  { canonical_id: "rr_identity_adaptation", source_wording: "זהות↔הסתגלות", normalized_label: "Identity ↔ Adaptation", definition: "A distinct pairing from tn_identity_universality (same 'identity' pole, different opposite) — real, cited, but not directly corroborating the compass document's pairing, so not merged into it.", type: "REVIEW_REQUIRED", source_document: "להלן 30 ניגודי־בסיס", source_pass: "Pass 5", confidence: "low", review_status: "needs_review" },

  // ── §42 direct-read batch (ledger §42) — the REAL, complete 30-item
  //    list ("להלן 30 ניגודי־בסיס — רשימה", 5 groups of 6), read directly
  //    from the source .textClipping file via plistlib (textutil mangled
  //    the Hebrew encoding) rather than re-quoted from the older
  //    extraction sample. Replaces the old bulk "not yet individually
  //    classified" placeholder entry — every one of the 30 items is now
  //    either matched to an existing entry above or classified below. ──
  { canonical_id: "nv_movement_stasis", source_wording: "תנועה↔סטטיות", normalized_label: "Movement ↔ Stasis", definition: "Physical/existential term pair, group 1 of the 30-item list.", type: "NON_VALUE", domain: "dom_ontological", source_document: "להלן 30 ניגודי־בסיס", source_pass: "Pass 5", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "cn_potential_realization", source_wording: "פוטנציאל↔מימוש", normalized_label: "Potential ↔ Realization", definition: "A real developmental-scale continuum — distinct from nv_potential_movement (פוטנציאל↔תנועה, a different real pairing in the core-10 list).", type: "CONTINUUM", domain: "dom_ontological", source_document: "להלן 30 ניגודי־בסיס", source_pass: "Pass 5", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "nv_heat_cold", source_wording: "חום↔קור", normalized_label: "Heat ↔ Cold", definition: "Pure physical term pair.", type: "NON_VALUE", domain: "dom_bodily_sensory", source_document: "להלן 30 ניגודי־בסיס", source_pass: "Pass 5", confidence: "high", review_status: "reviewed" },
  { canonical_id: "cn_pressure_release", source_wording: "לחץ↔שחרור", normalized_label: "Pressure ↔ Release", definition: "A real felt-state axis, echoing L1's Regulation variable — no formula given in this document, so CONTINUUM rather than MEASURABLE_DIMENSION.", type: "CONTINUUM", domain: "dom_emotional_internal", source_document: "להלן 30 ניגודי־בסיס", source_pass: "Pass 5", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "op_order_chaos", source_wording: "סדר↔כאוס", normalized_label: "Order ↔ Chaos", definition: "A real structural opposition.", type: "OPPOSITION", domain: "dom_structural_systemic", source_document: "להלן 30 ניגודי־בסיס", source_pass: "Pass 5", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "cn_will_fear", source_wording: "רצון↔פחד", normalized_label: "Will/Desire ↔ Fear", definition: "An emotional-state continuum, group 2 of the 30-item list.", type: "CONTINUUM", domain: "dom_emotional_internal", source_document: "להלן 30 ניגודי־בסיס", source_pass: "Pass 5", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "nv_conscious_unconscious", source_wording: "מודע↔לא-מודע", normalized_label: "Conscious ↔ Unconscious", definition: "Pure psychological-state term pair, not a value judgment.", type: "NON_VALUE", domain: "dom_cognitive_perceptual", source_document: "להלן 30 ניגודי־בסיס", source_pass: "Pass 5", confidence: "high", review_status: "reviewed" },
  { canonical_id: "cn_control_loss", source_wording: "שליטה↔אובדן־שליטה", normalized_label: "Control ↔ Loss of Control", definition: "A real functional-state axis, echoing L1/L2's readiness-to-act concepts.", type: "CONTINUUM", domain: "dom_cognitive_perceptual", source_document: "להלן 30 ניגודי־בסיס", source_pass: "Pass 5", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "cn_security_threat", source_wording: "ביטחון↔איום", normalized_label: "Security ↔ Threat", definition: "Maps to L4's SanctionRisk/Freedom axis — a real safety continuum.", type: "CONTINUUM", domain: "dom_emotional_internal", source_document: "להלן 30 ניגודי־בסיס", source_pass: "Pass 5", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "sr_trust_suspicion", source_wording: "אמון↔חשד", normalized_label: "Trust ↔ Suspicion", definition: "A real interpersonal-trust axis, echoing L3's Support/Pressure variables — directly relevant to any future TRUST mechanism (this codebase's own rule: trust requires downstream behavioral/effect evidence, never inferred from a visual signal alone).", type: "SOCIAL_RELATION", domain: "dom_interpersonal", source_document: "להלן 30 ניגודי־בסיס", source_pass: "Pass 5", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "cn_concentration_dispersion", source_wording: "ריכוז↔פיזור", normalized_label: "Concentration ↔ Dispersion", definition: "A real attentional continuum, group 3 of the 30-item list.", type: "CONTINUUM", domain: "dom_cognitive_perceptual", source_document: "להלן 30 ניגודי־בסיס", source_pass: "Pass 5", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "cn_depth_shallowness", source_wording: "עומק↔שטח", normalized_label: "Depth ↔ Shallowness", definition: "A real qualitative continuum.", type: "CONTINUUM", domain: "dom_cognitive_perceptual", source_document: "להלן 30 ניגודי־בסיס", source_pass: "Pass 5", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "cn_stability_change", source_wording: "יציבות↔שינוי", normalized_label: "Stability ↔ Change", definition: "A real state-persistence continuum.", type: "CONTINUUM", domain: "dom_structural_systemic", source_document: "להלן 30 ניגודי־בסיס", source_pass: "Pass 5", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "cn_effort_erosion", source_wording: "מאמץ↔שחיקה", normalized_label: "Effort ↔ Erosion", definition: "A real functional continuum.", type: "CONTINUUM", domain: "dom_structural_systemic", source_document: "להלן 30 ניגודי־בסיס", source_pass: "Pass 5", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "cn_repetition_breakthrough", source_wording: "חזרתיות↔פריצה", normalized_label: "Repetition ↔ Breakthrough", definition: "A real process continuum.", type: "CONTINUUM", domain: "dom_structural_systemic", source_document: "להלן 30 ניגודי־בסיס", source_pass: "Pass 5", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "cn_precision_noise", source_wording: "דיוק↔רעש", normalized_label: "Precision ↔ Noise", definition: "A real signal-quality continuum, group 3 close.", type: "CONTINUUM", domain: "dom_cognitive_perceptual", source_document: "להלן 30 ניגודי־בסיס", source_pass: "Pass 5", confidence: "moderate", review_status: "reviewed" },
  {
    canonical_id: "tn_individual_collective_v2", source_wording: "פרט↔כלל", normalized_label: "Individual ↔ Collective",
    definition: "Group 4 of the 30-item list. The SAME concept as tn_society_individual (חברה↔פרט, from the value-compass document) named in a SECOND independent real document — corroborating, not duplicating: confidence raised because two unrelated sources both treat individual-vs-collective as value-relevant.",
    type: "TENSION", domain: "dom_value_moral", source_document: "להלן 30 ניגודי־בסיס", source_pass: "Pass 5", confidence: "high", review_status: "reviewed",
    notes: "Cross-reference: tn_society_individual.", canonical_group: "tn_society_individual",
  },
  { canonical_id: "sr_giving_taking", source_wording: "נתינה↔לקיחה", normalized_label: "Giving ↔ Taking", definition: "A real interpersonal-exchange axis — directly relevant to a future CONTRIBUTION concept for quality-group criteria.", type: "SOCIAL_RELATION", domain: "dom_interpersonal", source_document: "להלן 30 ניגודי־בסיס", source_pass: "Pass 5", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "sr_belonging_disconnection", source_wording: "שייכות↔ניתוק", normalized_label: "Belonging ↔ Disconnection", definition: "Directly echoes L3's Belonging variable.", type: "SOCIAL_RELATION", domain: "dom_interpersonal", source_document: "להלן 30 ניגודי־בסיס", source_pass: "Pass 5", confidence: "high", review_status: "reviewed" },
  { canonical_id: "sr_influence_dependency", source_wording: "השפעה↔תלות", normalized_label: "Influence ↔ Dependency", definition: "A real interpersonal-power axis, group 4 close.", type: "SOCIAL_RELATION", domain: "dom_interpersonal", source_document: "להלן 30 ניגודי־בסיס", source_pass: "Pass 5", confidence: "moderate", review_status: "reviewed" },
  {
    canonical_id: "op_alignment_friction", source_wording: "יישור↔חיכוך", normalized_label: "Alignment ↔ Friction",
    definition: "Group 5 (vectorial/structural). Directly tied to the document's own closing anchor principle (see pr_alignment_creates_movement below): alignment creates movement, friction/angle creates erosion.",
    type: "OPPOSITION", domain: "dom_structural_systemic", source_document: "להלן 30 ניגודי־בסיס", source_pass: "Pass 5", confidence: "high", review_status: "reviewed",
  },
  {
    canonical_id: "pr_alignment_creates_movement", source_wording: "כל מערכת חיה נעה בין ניגודים. יישור יוצר תנועה. זווית מייצרת שחיקה.",
    normalized_label: "Every living system moves between oppositions; alignment creates movement, friction creates erosion",
    definition: "The 30-item list's own closing structural-anchor principle — a real, quoted mechanistic claim about how oppositions function, not itself a value.",
    type: "PRINCIPLE", domain: "dom_structural_systemic",
    source_document: "להלן 30 ניגודי־בסיס", source_pass: "Pass 5", confidence: "high", review_status: "reviewed",
  },

  // ── §42 peer-relay batch — a concurrent Claude Code session
  //    independently extracted the SAME `+אדם/פילוס אוריאנטציה תזכורות
  //    ליבה-2026` folder (361 files, 4 parallel passes, 100% of that
  //    folder) and shared its structured findings. Real, cited by that
  //    session down to clipping index — NOT independently re-verified
  //    against raw file bytes by this module's own author, so
  //    `confidence` is capped at "moderate" here regardless of how
  //    strongly-corroborated the peer reported it, until re-checked. ──

  {
    canonical_id: "pr_right_duty_energetic_theft", source_wording: "זכות בלי השלמת חובה היא גניבה אנרגטית",
    normalized_label: "A right without a fulfilled duty is energetic theft",
    definition: "Repeated, explicit principle (independently corroborated across 2 clippings per the peer report): every action creates a real RIGHT in one structure and a real DUTY to feed the other structures; an unmet duty turns the right into debt, which accumulates toward collapse.",
    type: "PRINCIPLE", domain: "dom_value_moral",
    source_document: "תזכורות ליבה-2026 (peer-cited clipping, chunk1 [22]/chunk3 [197])", source_pass: "Pass 6 (peer relay)", confidence: "moderate", review_status: "needs_review",
    notes: "The RIGHT↔DUTY typed relation this principle implies is not yet built as a runtime relation — see ledger §42.",
  },
  { canonical_id: "rt_right_generic", source_wording: "זכות (right, as created by fulfilling a duty elsewhere in the system)", normalized_label: "Right (system-structural)", definition: "The RIGHT half of the right↔duty principle above — a real source-named type, not yet given a closed enumerated list beyond the 7 permissions below.", type: "RIGHT", domain: "dom_value_moral", source_document: "תזכורות ליבה-2026 (peer-cited)", source_pass: "Pass 6 (peer relay)", confidence: "moderate", review_status: "needs_review" },
  { canonical_id: "dt_duty_generic", source_wording: "חובה (duty, owed to the other structures an action didn't feed)", normalized_label: "Duty (system-structural)", definition: "The DUTY half of the right↔duty principle above.", type: "DUTY", domain: "dom_value_moral", source_document: "תזכורות ליבה-2026 (peer-cited)", source_pass: "Pass 6 (peer relay)", confidence: "moderate", review_status: "needs_review" },

  { canonical_id: "rt_permission_not_know", source_wording: "מותר לא לדעת", normalized_label: "Permitted to not-know", definition: "1 of 7 'free permissions' — a closed list, real member entitlements framed as conditions for a healthy group.", type: "RIGHT", domain: "dom_value_moral", source_document: "תזכורות ליבה-2026, '7 האמונות החופשיות' (peer-cited, chunk3 [197])", source_pass: "Pass 6 (peer relay)", confidence: "moderate", review_status: "needs_review" },
  { canonical_id: "rt_permission_ask", source_wording: "מותר לשאול", normalized_label: "Permitted to ask", definition: "2 of 7.", type: "RIGHT", domain: "dom_value_moral", source_document: "תזכורות ליבה-2026, '7 האמונות החופשיות' (peer-cited)", source_pass: "Pass 6 (peer relay)", confidence: "moderate", review_status: "needs_review" },
  { canonical_id: "rt_permission_only_listen", source_wording: "מותר רק להקשיב", normalized_label: "Permitted to only listen", definition: "3 of 7.", type: "RIGHT", domain: "dom_value_moral", source_document: "תזכורות ליבה-2026, '7 האמונות החופשיות' (peer-cited)", source_pass: "Pass 6 (peer relay)", confidence: "moderate", review_status: "needs_review" },
  { canonical_id: "rt_permission_know_more", source_wording: "מותר לדעת יותר", normalized_label: "Permitted to know more", definition: "4 of 7.", type: "RIGHT", domain: "dom_value_moral", source_document: "תזכורות ליבה-2026, '7 האמונות החופשיות' (peer-cited)", source_pass: "Pass 6 (peer relay)", confidence: "moderate", review_status: "needs_review" },
  { canonical_id: "rt_permission_learn_no_guilt", source_wording: "מותר ללמוד בלי אשמה", normalized_label: "Permitted to learn without guilt", definition: "5 of 7.", type: "RIGHT", domain: "dom_value_moral", source_document: "תזכורות ליבה-2026, '7 האמונות החופשיות' (peer-cited)", source_pass: "Pass 6 (peer relay)", confidence: "moderate", review_status: "needs_review" },
  { canonical_id: "rt_permission_err_and_stay", source_wording: "מותר לטעות ולהישאר", normalized_label: "Permitted to err and stay", definition: "6 of 7.", type: "RIGHT", domain: "dom_value_moral", source_document: "תזכורות ליבה-2026, '7 האמונות החופשיות' (peer-cited)", source_pass: "Pass 6 (peer relay)", confidence: "moderate", review_status: "needs_review" },
  { canonical_id: "rt_permission_leave", source_wording: "מותר לעזוב", normalized_label: "Permitted to leave", definition: "7 of 7.", type: "RIGHT", domain: "dom_value_moral", source_document: "תזכורות ליבה-2026, '7 האמונות החופשיות' (peer-cited)", source_pass: "Pass 6 (peer relay)", confidence: "moderate", review_status: "needs_review" },

  // ── 5 "zero-values" — the most concrete group-access GROUP_CRITERION
  //    set found anywhere in the corpus per the peer report, each with
  //    its own real check method. ──────────────────────────────────────
  { canonical_id: "gc_zero_value_personal_responsibility", source_wording: "אחריות אישית — נבדקת דרך בחירה בלתי מותנית", normalized_label: "Personal responsibility (checked via unconditional choice)", definition: "1 of 5 'zero-values' — an explicit group-access gate criterion.", type: "GROUP_CRITERION", domain: "dom_value_moral", source_document: "תזכורות ליבה-2026, 'ערכי אפס' (peer-cited, chunk3 [237])", source_pass: "Pass 6 (peer relay)", confidence: "moderate", review_status: "needs_review", notes: "Thematically close to, but NOT merged with, the runtime-registered value 'אחריות' (§40) — different scope (personal disposition vs. a Value Group's own central_value), not silently conflated." },
  { canonical_id: "gc_zero_value_consistency", source_wording: "עקביות — נבדקת דרך נכונות לפעול", normalized_label: "Consistency (checked via willingness to act)", definition: "2 of 5.", type: "GROUP_CRITERION", domain: "dom_value_moral", source_document: "תזכורות ליבה-2026, 'ערכי אפס' (peer-cited)", source_pass: "Pass 6 (peer relay)", confidence: "moderate", review_status: "needs_review" },
  { canonical_id: "gc_zero_value_contribution", source_wording: "תרומה — נבדקת דרך מחיר לפני תגמול", normalized_label: "Contribution (checked via price paid before reward)", definition: "3 of 5 — directly relevant to a future CONTRIBUTION concept for group-quality measurement.", type: "GROUP_CRITERION", domain: "dom_value_moral", source_document: "תזכורות ליבה-2026, 'ערכי אפס' (peer-cited)", source_pass: "Pass 6 (peer relay)", confidence: "moderate", review_status: "needs_review" },
  { canonical_id: "gc_zero_value_functional_truth", source_wording: "אמת תפעולית — נבדקת דרך שקיפות תהליך", normalized_label: "Functional truth (checked via process transparency)", definition: "4 of 5 — echoes gc_value_transparency (§41) independently.", type: "GROUP_CRITERION", domain: "dom_value_moral", source_document: "תזכורות ליבה-2026, 'ערכי אפס' (peer-cited)", source_pass: "Pass 6 (peer relay)", confidence: "moderate", review_status: "needs_review" },
  { canonical_id: "gc_zero_value_boundary", source_wording: "גבול — לא הכל פתוח", normalized_label: "Boundary (not everything is open)", definition: "5 of 5.", type: "GROUP_CRITERION", domain: "dom_value_moral", source_document: "תזכורות ליבה-2026, 'ערכי אפס' (peer-cited)", source_pass: "Pass 6 (peer relay)", confidence: "moderate", review_status: "needs_review" },

  // ── Melting-pot 3 roles — real, corroborated 2x per the peer report. ─
  { canonical_id: "sr_role_feeder", source_wording: "מזין (feeder/contributor) — 'מי שמזין בלי לקבל החזרה הופך לדלק'", normalized_label: "Feeder role — burns out without reciprocity", definition: "1 of 3 melting-pot roles; law: whoever feeds without receiving return becomes fuel (burns out).", type: "SOCIAL_RELATION", domain: "dom_interpersonal", source_document: "תזכורות ליבה-2026, כור־היתוך role model (peer-cited)", source_pass: "Pass 6 (peer relay)", confidence: "moderate", review_status: "needs_review" },
  { canonical_id: "sr_role_learner", source_wording: "לומד (learner)", normalized_label: "Learner role", definition: "2 of 3.", type: "SOCIAL_RELATION", domain: "dom_interpersonal", source_document: "תזכורות ליבה-2026, כור־היתוך role model (peer-cited)", source_pass: "Pass 6 (peer relay)", confidence: "moderate", review_status: "needs_review" },
  { canonical_id: "sr_role_coordinator", source_wording: "מתאם (coordinator) — 'לא דורש שוויון, דורש כנות תפקידית'", normalized_label: "Coordinator role — role-honesty, not equality, is the requirement", definition: "3 of 3.", type: "SOCIAL_RELATION", domain: "dom_interpersonal", source_document: "תזכורות ליבה-2026, כור־היתוך role model (peer-cited)", source_pass: "Pass 6 (peer relay)", confidence: "moderate", review_status: "needs_review" },

  // ── Value→Contribution→Trust→Influence→Resources chain, and the
  //    EXCLUDED anti-pattern it must never be confused with. ──────────
  {
    canonical_id: "oc_value_contribution_trust_chain", source_wording: "כסף נעול עד הצטברות אמון; המערכת לא מתגמלת פעולה — היא מתגמלת אמון שנוצר מפעולה",
    normalized_label: "Value → Contribution → Trust → Influence → Resources", definition: "Repeated (5+ clippings per the peer report) real chain: resources/money are explicitly downstream of and locked until trust accumulates from real contribution — matches this codebase's own rule that trust requires downstream behavioral/effect evidence, never a visual signal alone.",
    type: "OUTCOME", domain: "dom_value_moral",
    source_document: "תזכורות ליבה-2026, §5.X.7 'Social Currency Mechanism' (peer-cited, chunk2 [83/158])", source_pass: "Pass 6 (peer relay)", confidence: "moderate", review_status: "needs_review",
  },
  {
    canonical_id: "nv_engagement_funnel_excluded", source_wording: "Reaction → Engagement → Views → Customers → Money",
    normalized_label: "EXCLUDED anti-pattern: engagement/popularity funnel", definition: "The SAME source chapter also contains this different, unreconciled chain (a popularity/engagement funnel) presented without resolving the conflict with the trust chain above. Explicitly classified NON_VALUE and excluded from any real mechanism — visual/engagement signal must never be treated as producing value or trust in this product, matching the existing 'membership ≠ endorsement' / trust-requires-evidence discipline. A related fragment names a scoring product 'ValueRank™', in direct conflict with this codebase's locked NO_GLOBAL_HUMAN_SCORE invariant — that name is not adopted anywhere.",
    type: "NON_VALUE", domain: "dom_value_moral",
    source_document: "תזכורות ליבה-2026, §5.X.8 (peer-cited, chunk2 [83/158], chunk4 [315-318,328-330,350])", source_pass: "Pass 6 (peer relay)", confidence: "moderate", review_status: "reviewed",
  },

  // ── Group-type distinction (involuntary/born-into vs. chosen) — 2
  //    independent citations per the peer report. Kept separate from
  //    `SOURCE_GROUP_HIERARCHY` (a different axis: scope-of-convergence,
  //    not how membership arises). ──────────────────────────────────────
  { canonical_id: "gc_group_type_involuntary", source_wording: "קבוצות שמעל הרצון (born-into / involuntary groups)", normalized_label: "Involuntary / born-into group type", definition: "A real, source-named group-formation TYPE, distinct from chosen groups — corroborated 2x per the peer report.", type: "GROUP_CRITERION", domain: "dom_social_cultural", source_document: "תזכורות ליבה-2026 (peer-cited, chunk1 [32] tail + chunk4 [297])", source_pass: "Pass 6 (peer relay)", confidence: "moderate", review_status: "needs_review" },
  { canonical_id: "gc_group_type_chosen", source_wording: "קבוצות נבחרות (chosen groups, e.g. joined by reasoning/religion)", normalized_label: "Chosen group type", definition: "The other pole of the same real distinction.", type: "GROUP_CRITERION", domain: "dom_social_cultural", source_document: "תזכורות ליבה-2026 (peer-cited)", source_pass: "Pass 6 (peer relay)", confidence: "moderate", review_status: "needs_review" },

  // ── Multi-version contradiction — a real, important, UNRESOLVED
  //    finding: "the closed base-contradiction list" is not one list.
  //    Reported explicitly, not silently picked. ────────────────────────
  {
    canonical_id: "rr_multi_version_contradiction_lists", source_wording: "at least 5 non-identical 'closed/authoritative' base-contradiction enumerations found across the corpus",
    normalized_label: "UNRESOLVED: multiple non-reconciled 'closed list' claims",
    definition: "Per the peer report: (1) a 10-item core set (3x verbatim, matches this module's own core-10 entries); (2) a 29-item 'chronological physical-structural' set in 9 stages; (3) a 20-item 'human-derived' list, explicitly self-described as separate from (2) in the same clipping; (4) the 30-item, 5-groups-of-6 set this module read directly this pass (§42, source_pass 'Pass 5'); (5) a DIFFERENT 30-item set organized 6 operators × 5 (id/ego/superego/body/emotion/mind); (6) a 52-item 'roots' set ('52 roots × 6 layers = 312 configurations'). None reconcile with each other in-source. This module's own directly-read 30-item list is therefore ONE of several non-reconciled versions, not THE list — stated explicitly here rather than presented as settled.",
    type: "REVIEW_REQUIRED",
    source_document: "תזכורות ליבה-2026 (peer-cited across all 4 chunks)", source_pass: "Pass 6 (peer relay)", confidence: "moderate", review_status: "needs_review",
  },

  // ── §43 batch — 3 new .docx files (2026-08-15), read directly. These
  //    documents are mostly about the Force/Structure/Brain-UI model
  //    (a separate track, already governed by the existing
  //    FORCE_COUNT_DECISION in the master ledger) — only the parts
  //    bearing directly on VALUES/GROUPS are extracted here; the rest is
  //    explicitly out of this module's scope, not silently absorbed. ──

  {
    canonical_id: "pr_no_collective_inference", source_wording: "אין להסיק ערך קולקטיבי מפעולה בודדת ללא ראיות מספקות",
    normalized_label: "No collective value may be inferred from a single action without sufficient evidence",
    definition: "A group-level companion to pr_no_scores (§41, which is action/individual-level): explicitly forbids inferring a GROUP's value from one member's one action absent real evidence — direct source support for keeping Community's group-value figures evidence-gated.",
    type: "PRINCIPLE", domain: "dom_value_moral",
    source_document: "PHILOS_10_Principles_20_Expressions_HE.docx", source_pass: "Pass 7", confidence: "high", review_status: "reviewed",
  },
  {
    canonical_id: "gfr_value_compass_corroboration_brainv2", source_wording: "ציר של ערכי פרט → ערכי קבוצה → ערכי כלל, יחד עם רעיון של מצפן ערכי שאינו מחייב הסכמה מלאה אלא מחפש ערך משותף שיכול להתגלות דווקא מתוך ניגודים",
    normalized_label: "Individual→group→collective value axis + value compass (2nd independent source)",
    definition: "The SAME convergence-not-agreement claim as gfr_convergence_not_agreement (§41) and tn_individual_collective_v2 (§42), now independently named in a THIRD, separate document — kept as its own citation rather than merged, since two-or-three independent sources stating the same mechanism is itself evidence worth recording distinctly.",
    type: "PRINCIPLE", domain: "dom_value_moral",
    source_document: "PHILOS_Brain_Human_Explanation_HE.docx §4", source_pass: "Pass 7", confidence: "high", review_status: "reviewed",
    notes: "Cross-reference: gfr_convergence_not_agreement, tn_individual_collective_v2.",
  },
  {
    canonical_id: "pr_no_universal_value_score", source_wording: "אין 'ציון ערך' אוניברסלי לאדם",
    normalized_label: "No universal 'value score' exists for a person",
    definition: "Explicit, VALUE-specific anti-score statement (distinct from pr_no_scores, which is about actions in general): values should render as live relationships (who supports it, where the opposition is, which shared value enables coordination, which action strengthens/harms it) — never as a single number.",
    type: "PRINCIPLE", domain: "dom_value_moral",
    source_document: "PHILOS_Brain_Human_Explanation_HE.docx §4", source_pass: "Pass 7", confidence: "high", review_status: "reviewed",
  },
  {
    canonical_id: "pr_collective_capacity_requires_coordination", source_wording: "אדם יחיד הוא בעל קיבולת פעולה מוגבלת... כמות לבדה אינה כוח אפקטיבי. תיאום, אמון, משאבים, מטרות, ערכים ומגבלות קובעים כמה מהפוטנציאל באמת ניתן להפעלה",
    normalized_label: "Collective capacity requires coordination, trust, resources, goals, values and constraints — not headcount alone",
    definition: "A single person's action capacity is limited; connecting people raises POTENTIAL capacity, but quantity alone is not effective force — real usable capacity is gated by coordination/trust/resources/goals/values/constraints. Directly relevant to how 'group size' should never stand alone as a Community metric.",
    type: "PRINCIPLE", domain: "dom_value_moral",
    source_document: "PHILOS_Brain_Human_Explanation_HE.docx §5", source_pass: "Pass 7", confidence: "high", review_status: "reviewed",
  },
  {
    canonical_id: "ql_color_functional_redundancy", source_wording: "שפת הצבעים היא פונקציונלית, לא קישוט ולא 'סוג אדם'... כל משמעות צבעונית חייבת לקבל גם סימן שאינו צבע: צורה, קו, מיקום, סמל, טקסט או תנועה",
    normalized_label: "Color is functional and must carry a non-color redundant signal",
    definition: "A design/accessibility STANDARD, not a trust claim: every color-coded meaning must be paired with a non-color signal (shape/line/position/symbol/text/motion). Relevant to this task's visual-signal boundary as adjacent context, not as source proof of it — this document states an accessibility-redundancy rule, it does NOT itself say 'visual signal must not produce trust/reputation/value' (that stronger claim remains the product's own instruction, not yet independently source-attested across the files read so far).",
    type: "STANDARD",
    source_document: "PHILOS_Brain_Human_Explanation_HE.docx §10", source_pass: "Pass 7", confidence: "moderate", review_status: "reviewed",
  },
  {
    canonical_id: "pr_unknown_is_not_invitation_to_invent", source_wording: "חוסר נתונים אינו אומר שהמודל נעלם. הוא מוצג כ-UNKNOWN. UNKNOWN אינו תקלה ואינו הזמנה להמציא מידע",
    normalized_label: "Missing data renders as UNKNOWN, never invented",
    definition: "Methodological principle governing every screen this codebase builds from these concepts: absence of data must render as an explicit UNKNOWN state, never silently filled or hidden. Directly reinforces this module's own REVIEW_REQUIRED/needs_review discipline.",
    type: "PRINCIPLE",
    source_document: "PHILOS_Brain_Human_Explanation_HE.docx §6", source_pass: "Pass 7", confidence: "high", review_status: "reviewed",
  },
  {
    canonical_id: "rr_9structure_reconstruction", source_wording: "רקונסטרוקציית מבנה ה-9: 6 בניינים (מוח/לב/גוף/איד/אגו/סופר־אגו) + 3 שדות הקשר (אישי/חברתי/חיצוני) + מסגרת מציאות חומר-מרווח-זמן + 6 וקטורים V0-V5",
    normalized_label: "9-structure reconstruction: 6 buildings + 3 contextual fields + reality frame + 6 vectors",
    definition: "Working reconstruction of the Force/Structure model (INNER HUMAN / CONTEXTUAL FIELDS / REALITY FRAME, kept as 3 distinct families per the source's own explicit rule: 'אסור לאחד את שלוש המשפחות תחת המילה כוחות ללא הבחנה'). Belongs primarily to the separate Force/Structure track (already governed by the ledger's FORCE_COUNT_DECISION), logged here only because it carries one VALUE/GROUP-relevant hypothesis: an individual↔collective analogy mapping (מוח→ידע/מדע, לב→קהילה/אמון, גוף→משאבים/כלכלה, איד→אינטרסים, אגו→מנגנוני איזון, סופר־אגו→ערכים קולקטיביים) — which the source ITSELF explicitly flags as 'הקבלות מודליות ויש לשמור עליהן כהשערות/מיפויים עד reconciliation' (modal analogies to be kept as hypotheses, not fact, until reconciled). Document's own status line: 'RECONSTRUCTION / REVIEW REQUIRED.'",
    type: "REVIEW_REQUIRED",
    source_document: "PHILOS_9_STRUCTURE_RECONSTRUCTION_HE.docx", source_pass: "Pass 7", confidence: "low", review_status: "needs_review",
  },

  // ── §44 — contradiction-list variants, cluster 1 of the Source-
  //    Coverage Autostrada. Direct reads (plistlib) of 3 more real files
  //    in the ALREADY-counted תזכורות ליבה-2026 folder (§42's
  //    files_scanned already includes them — this batch goes DEEPER on
  //    files nominally scanned, it does not add new file coverage; see
  //    `SOURCE_COVERAGE`'s own note). Found the real 29-item
  //    "chronological physical→human" list AND the real 20-item "quasi-
  //    human" list IN THE SAME FILE, plus the real 52-item×6-layer
  //    "wave, six manifestations" model in a separate file — the exact 3
  //    variants the peer's earlier digest could only reference by chunk
  //    index. Each kept as its OWN typed structure
  //    (`SOURCE_CONTRADICTION_LIST_VARIANTS`, below), not exploded into
  //    ~100 individual SourceConcept rows — same restraint
  //    `SOURCE_PRINCIPLE_LENS` (§43) already established. ─────────────

  {
    canonical_id: "pr_base_vs_human_contamination_rule", source_wording: "ניגודי־הבסיס מתארים את פעולת המערכת. הניגודים האנושיים מתארים את חוויית האדם בתוך המערכת... למנוע זיהום אנושי בליבה, לשמור פילוס כאוניברסלי באמת",
    normalized_label: "Base contradictions describe the system; human contradictions describe experience within it — kept apart to prevent 'human contamination' of the universal core",
    definition: "A real, explicit methodological principle from the 29-item chronological list's own closing 'lock rule' — directly relevant to how this codebase should keep physical/structural oppositions (NON_VALUE) separate from human/value-laden ones (TENSION/VALUE), matching the discipline this module already applies.",
    type: "PRINCIPLE", domain: "dom_ontological",
    source_document: "מעולה.-להלן סידור כרונולוגי .textClipping", source_pass: "Pass 8", confidence: "high", review_status: "reviewed",
  },
  {
    canonical_id: "nv_exist_nonexist", source_wording: "קיים↔לא־קיים", normalized_label: "Exist ↔ Non-exist", definition: "Stage 0 of the 29-item chronological list — pure ontological ground.", type: "NON_VALUE", domain: "dom_ontological", source_document: "מעולה.-להלן סידור כרונולוגי .textClipping", source_pass: "Pass 8", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "cn_kinetic_static", source_wording: "קינטי↔סטטי", normalized_label: "Kinetic ↔ Static", definition: "Stage 1.", type: "CONTINUUM", domain: "dom_ontological", source_document: "מעולה.-להלן סידור כרונולוגי .textClipping", source_pass: "Pass 8", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "nv_boundary_expansion", source_wording: "גבול↔התפשטות", normalized_label: "Boundary ↔ Expansion", definition: "Stage 2.", type: "NON_VALUE", domain: "dom_structural_systemic", source_document: "מעולה.-להלן סידור כרונולוגי .textClipping", source_pass: "Pass 8", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "nv_flow_blockage", source_wording: "זרימה↔חסימה", normalized_label: "Flow ↔ Blockage", definition: "Stage 2.", type: "NON_VALUE", domain: "dom_structural_systemic", source_document: "מעולה.-להלן סידור כרונולוגי .textClipping", source_pass: "Pass 8", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "cn_acceleration_deceleration", source_wording: "האצה↔האטה", normalized_label: "Acceleration ↔ Deceleration", definition: "Stage 3.", type: "CONTINUUM", domain: "dom_ontological", source_document: "מעולה.-להלן סידור כרונולוגי .textClipping", source_pass: "Pass 8", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "nv_integration_fragmentation", source_wording: "אינטגרציה↔פירוד", normalized_label: "Integration ↔ Fragmentation", definition: "Stage 4.", type: "NON_VALUE", domain: "dom_structural_systemic", source_document: "מעולה.-להלן סידור כרונולוגי .textClipping", source_pass: "Pass 8", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "cn_continuity_discontinuity", source_wording: "רציפות↔אי־רציפות", normalized_label: "Continuity ↔ Discontinuity", definition: "Stage 4.", type: "CONTINUUM", domain: "dom_structural_systemic", source_document: "מעולה.-להלן סידור כרונולוגי .textClipping", source_pass: "Pass 8", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "cn_restraint_disintegration", source_wording: "ריסון↔התפרקות", normalized_label: "Restraint ↔ Disintegration", definition: "Stage 5 — echoes rr_drive_restraint (§41) thematically, kept distinct (different opposite pole).", type: "CONTINUUM", domain: "dom_structural_systemic", source_document: "מעולה.-להלן סידור כרונולוגי .textClipping", source_pass: "Pass 8", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "nv_control_lack", source_wording: "בקרה↔חוסר־בקרה", normalized_label: "Control ↔ Lack of Control", definition: "Stage 5.", type: "NON_VALUE", domain: "dom_structural_systemic", source_document: "מעולה.-להלן סידור כרונולוגי .textClipping", source_pass: "Pass 8", confidence: "moderate", review_status: "reviewed" },
  {
    canonical_id: "rr_law_freedom_v3", source_wording: "חוק↔חופש (stage 6 of the 29-item list)", normalized_label: "Law ↔ Freedom (3rd independent citation)",
    definition: "A THIRD independent real document naming law↔freedom as a base contradiction (after the core-10 and the 30-item list, §41/§42) — confidence raised further; still REVIEW_REQUIRED since none of the 3 citing documents frame it as a value-convergence source the way the compass document frames honor↔freedom.",
    type: "REVIEW_REQUIRED", source_document: "מעולה.-להלן סידור כרונולוגי .textClipping", source_pass: "Pass 8", confidence: "moderate", review_status: "needs_review",
    notes: "Cross-reference: rr_law_freedom.", canonical_group: "rr_law_freedom",
  },
  { canonical_id: "cn_stability_collapse", source_wording: "יציבות↔קריסה", normalized_label: "Stability ↔ Collapse", definition: "Stage 6.", type: "CONTINUUM", domain: "dom_structural_systemic", source_document: "מעולה.-להלן סידור כרונולוגי .textClipping", source_pass: "Pass 8", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "nv_part_whole", source_wording: "חלק↔שלם", normalized_label: "Part ↔ Whole", definition: "Stage 7.", type: "NON_VALUE", domain: "dom_ontological", source_document: "מעולה.-להלן סידור כרונולוגי .textClipping", source_pass: "Pass 8", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "nv_local_global", source_wording: "מקומי↔גלובלי", normalized_label: "Local ↔ Global", definition: "Stage 7.", type: "NON_VALUE", domain: "dom_structural_systemic", source_document: "מעולה.-להלן סידור כרונולוגי .textClipping", source_pass: "Pass 8", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "nv_cyclical_linear", source_wording: "מחזוריות↔ליניאריות", normalized_label: "Cyclical ↔ Linear", definition: "Stage 7.", type: "NON_VALUE", domain: "dom_ontological", source_document: "מעולה.-להלן סידור כרונולוגי .textClipping", source_pass: "Pass 8", confidence: "moderate", review_status: "reviewed" },

  // ── the 20-item "quasi-human" list, SAME file, section II — real
  //    human-experience-layer oppositions, 5 groups of 4 (body/emotion/
  //    mind-consciousness/value-society/personal purpose). ─────────────
  { canonical_id: "sr_injury_recovery", source_wording: "פציעה↔החלמה", normalized_label: "Injury ↔ Recovery", definition: "Body group, item 1 of 20.", type: "CONTINUUM", domain: "dom_bodily_sensory", source_document: "מעולה.-להלן סידור כרונולוגי .textClipping, section II", source_pass: "Pass 8", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "cn_pain_pleasure", source_wording: "כאב↔עונג", normalized_label: "Pain ↔ Pleasure", definition: "Body group.", type: "CONTINUUM", domain: "dom_bodily_sensory", source_document: "מעולה.-להלן סידור כרונולוגי .textClipping, section II", source_pass: "Pass 8", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "cn_hope_despair", source_wording: "תקווה↔ייאוש", normalized_label: "Hope ↔ Despair", definition: "Emotion group.", type: "CONTINUUM", domain: "dom_emotional_internal", source_document: "מעולה.-להלן סידור כרונולוגי .textClipping, section II", source_pass: "Pass 8", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "cn_certainty_doubt", source_wording: "ודאות↔ספק", normalized_label: "Certainty ↔ Doubt", definition: "Mind/consciousness group.", type: "CONTINUUM", domain: "dom_cognitive_perceptual", source_document: "מעולה.-להלן סידור כרונולוגי .textClipping, section II", source_pass: "Pass 8", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "cn_focus_confusion", source_wording: "מיקוד↔בלבול", normalized_label: "Focus ↔ Confusion", definition: "Mind/consciousness group.", type: "CONTINUUM", domain: "dom_cognitive_perceptual", source_document: "מעולה.-להלן סידור כרונולוגי .textClipping, section II", source_pass: "Pass 8", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "tn_morality_utility", source_wording: "מוסר↔תועלת", normalized_label: "Morality ↔ Utility", definition: "Value/society group, item — a real value-domain opposition (unlike most physical-layer pairs), matching the source's own explicit 'value/society' category label.", type: "TENSION", domain: "dom_value_moral", source_document: "מעולה.-להלן סידור כרונולוגי .textClipping, section II", source_pass: "Pass 8", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "tn_justice_injustice", source_wording: "צדק↔עוול", normalized_label: "Justice ↔ Injustice", definition: "Value/society group — a clear value-moral opposition.", type: "TENSION", domain: "dom_value_moral", source_document: "מעולה.-להלן סידור כרונולוגי .textClipping, section II", source_pass: "Pass 8", confidence: "moderate", review_status: "reviewed" },
  {
    canonical_id: "gc_responsibility_abandonment", source_wording: "אחריות↔הפקרה", normalized_label: "Responsibility ↔ Abandonment/Negligence",
    definition: "Value/society group. Contains 'אחריות' (responsibility) literally — a SECOND real near-neighbor to the runtime-registered value 'אחריות' (after gc_zero_value_personal_responsibility, §42) — explicitly NOT merged: this is 'responsibility' as one pole of an opposition (vs. abandonment/negligence), not the Value Group's own central_value.",
    type: "TENSION", domain: "dom_value_moral",
    source_document: "מעולה.-להלן סידור כרונולוגי .textClipping, section II", source_pass: "Pass 8", confidence: "moderate", review_status: "reviewed",
    notes: "NOT merged with the runtime-registered 'אחריות' value, nor with gc_zero_value_personal_responsibility — three real, distinct concepts sharing a word, kept apart.",
  },
  { canonical_id: "tn_contribution_waste", source_wording: "תרומה↔בזבוז", normalized_label: "Contribution ↔ Waste", definition: "Value/society group — echoes gc_zero_value_contribution (§42) thematically, a distinct citation.", type: "TENSION", domain: "dom_value_moral", source_document: "מעולה.-להלן סידור כרונולוגי .textClipping, section II", source_pass: "Pass 8", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "oc_success_failure", source_wording: "הצלחה↔כישלון", normalized_label: "Success ↔ Failure", definition: "Personal-purpose group — a real outcome-state pair.", type: "OUTCOME", domain: "dom_value_moral", source_document: "מעולה.-להלן סידור כרונולוגי .textClipping, section II", source_pass: "Pass 8", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "oc_realization_missed", source_wording: "מימוש↔החמצה", normalized_label: "Realization ↔ Missed Opportunity", definition: "Personal-purpose group.", type: "OUTCOME", domain: "dom_value_moral", source_document: "מעולה.-להלן סידור כרונולוגי .textClipping, section II", source_pass: "Pass 8", confidence: "moderate", review_status: "reviewed" },
  { canonical_id: "cn_progress_stagnation", source_wording: "התקדמות↔תקיעות", normalized_label: "Progress ↔ Stagnation", definition: "Personal-purpose group.", type: "CONTINUUM", domain: "dom_value_moral", source_document: "מעולה.-להלן סידור כרונולוגי .textClipping, section II", source_pass: "Pass 8", confidence: "moderate", review_status: "reviewed" },

  // ── the 52-root × 6-layer "wave, six manifestations" model — explicitly
  //    DRAFT status per the source document's own closing question
  //    ("רוצה לשמור לליבה? או להמשיך להרחיב?" — "save to the core, or
  //    keep expanding?" — never answered/locked in this file). Kept as
  //    ONE low-confidence structural entry + the full root list in
  //    `SOURCE_CONTRADICTION_LIST_VARIANTS`, not exploded into 52 rows,
  //    let alone the 312 per-layer variations. ───────────────────────────
  {
    canonical_id: "rr_52root_6layer_model", source_wording: "המציאות אינה מורכבת מ־52 ניגודים. היא מורכבת מ־52 תבניות־אם שכל אחת מהן מופיעה כאוסף של שש וריאציות – לפי השכבה. 312 תצורות אנושיות שמבוססות על 52 שורשים.",
    normalized_label: "52 root oppositions × 6 layers = 312 configurations (explicitly a draft, not locked)",
    definition: "A real, coherent, but explicitly UNLOCKED draft model: each of 52 'root' oppositions (archetypes) is claimed to manifest differently across 6 layers (physical/emotional/mental/social/personal/cosmic) — matches and confirms the peer's earlier chunk-indexed reference, now with full real content. The source document's OWN closing line asks whether to save it to the core or keep expanding — i.e. the author himself had not yet locked this as canon at the time of writing. Confidence and review status reflect that explicit draft state, not this module's own doubt about the content's coherence.",
    type: "REVIEW_REQUIRED", domain: "dom_structural_systemic",
    source_document: "הנה הכול – כל פרק 7 המלא-כול .textClipping", source_pass: "Pass 8", confidence: "low", review_status: "needs_review",
  },

  // ── 4-level intensity-scale methodology — a real, reusable measurement
  //    TEMPLATE (weak stipend → medium → strong → systemic level, per
  //    pole of an opposition), demonstrated on 4 example pairs. ─────────
  {
    canonical_id: "pr_four_level_intensity_scale", source_wording: "בניית 4 הרמות לכל ניגוד (הקצבה חלשה → רמה בינונית → רמה חזקה → רמה מערכתית)",
    normalized_label: "4-level intensity scale per opposition pole (weak → medium → strong → systemic)",
    definition: "A real, reusable measurement-template principle: each pole of a real opposition can be read at 4 intensity levels, from a weak individual 'stipend' up to a systemic/collective-level manifestation — demonstrated in the source on 4 example pairs (connection↔disconnection, order↔chaos, power↔weakness, trust↔fear); the source itself states it planned to extend to 20 pairs but this document only completes 4. A real, distinct methodology from the L1–L5 formulas (§41) — no shared variables, no formula, a qualitative 4-rung ladder instead.",
    type: "PRINCIPLE", domain: "dom_structural_systemic",
    source_document: "מצוין — אני מתקדם לשלב הבא--.textClipping", source_pass: "Pass 8", confidence: "moderate", review_status: "reviewed",
  },

  // ── Reconciliation record — real overlap found ACROSS 3 independent
  //    documents, without picking one as authoritative (per this pass's
  //    own explicit instruction). ───────────────────────────────────────
  {
    canonical_id: "rr_reconciliation_direction_angle_order_chaos_law_freedom",
    source_wording: "כיוון↔זווית (core-10, 30-item, 29-item — 3x identical, incl. identical 'כיוון=תנועה / זווית=שחיקה' gloss); סדר↔כאוס (30-item, 29-item, AND the 52-item model's own worked example — 3x); חוק↔חופש (core-10, 30-item, 29-item — 3x, see rr_law_freedom_v3)",
    normalized_label: "Reconciliation: 3 pairs each independently corroborated across 3+ non-identical 'closed list' documents",
    definition: "Explicit reconciliation record (per this pass's instruction: preserve each version, compare overlap, never pick one arbitrarily). Despite the 5+ non-reconciled 'closed list' claims (rr_multi_version_contradiction_lists, §42) genuinely disagreeing on total count and structure, these 3 SPECIFIC pairs recur identically (or near-identically) across independent documents — real convergence at the item level even where the enclosing lists never reconcile at the structural level. This is the strongest real evidence in the corpus so far for which individual oppositions are stable across the author's many drafts.",
    type: "REVIEW_REQUIRED",
    source_document: "ברור. הנה כל ניגודי־הבסיס; להלן 30 ניגודי־בסיס; מעולה.-להלן סידור כרונולוגי; הנה הכול – כל פרק 7", source_pass: "Pass 8", confidence: "high", review_status: "reviewed",
    notes: "Cross-references: nv_direction_angle, op_order_chaos, rr_law_freedom, rr_law_freedom_v3, tn_individual_collective_v2.",
  },

  // ── §45 — cluster 2 attempt ("~70KB explanation cluster"). The EXACT
  //    cluster the original extraction sample's Pass 3 note described
  //    (multiple near-duplicate "explanation" documents, ~70KB combined)
  //    could NOT be conclusively re-identified this pass — checked via
  //    `source-corpus/MANIFEST.json`'s own `version_family`/`duplicate_of`
  //    grouping (no group matches that size/theme) and by filename search
  //    for הסבר/הסברה/מסביר/פרשנות/ביאור/מבוא/תקציר (only 3 real files
  //    found, one alone already 169KB — not a "~70KB cluster of near-
  //    duplicates"). Recorded as a real, unresolved identification gap,
  //    not silently dropped. Read the largest real, on-topic candidate
  //    found instead (`הסבר פשטני ראשיוני פילוס מכלול געש.textClipping`,
  //    169KB, real) — mostly raw physics-metaphor brainstorm (relativity/
  //    reference-frame analogies used loosely, not rigorous claims;
  //    METAPHOR-grade, matching the extraction sample's own established
  //    convention for this kind of content) with two real, extractable,
  //    corroborating finds. ─────────────────────────────────────────────
  {
    canonical_id: "rr_geash_explanation_cluster_not_located",
    source_wording: "~70KB cluster of near-duplicate 'explanation' documents (original Pass-3 note, PHILOS-CORPUS-EXTRACTION-SAMPLE.md)",
    normalized_label: "UNRESOLVED: the specific '~70KB explanation cluster' could not be re-identified",
    definition: "A real, honest identification gap: the original extraction sample's own Pass 3 note referenced this cluster by size/theme only, with no filename list preserved. This pass searched MANIFEST.json's real duplicate/version-family groupings and filename keywords and did not find a matching group. Not classified NON_VALUE/OUT_OF_SCOPE (that would imply the content was found and judged irrelevant) — genuinely UNRESOLVED, distinct from `rr_multi_version_contradiction_lists`.",
    type: "REVIEW_REQUIRED",
    source_document: "PHILOS-CORPUS-EXTRACTION-SAMPLE.md, Pass 3 note", source_pass: "Pass 8", confidence: "low", review_status: "needs_review",
  },
  {
    canonical_id: "nv_ranking_score_app_excluded",
    source_wording: "ניקוד רע / ניקוד טוב — דירוג חברתי מבוסס קרבה, תגמול כספי, הודעות רדיוס על דירוג אנשים סובבים",
    normalized_label: "EXCLUDED anti-pattern: a good-score/bad-score social ranking app concept",
    definition: "A real, explicit product-pitch fragment (proximity-based social ranking, push notifications naming nearby people's scores, money/benefits tied to ranking) — a MUCH more explicit version of the same anti-pattern already excluded in §42 (nv_engagement_funnel_excluded / the 'ValueRank™' flag). Directly and repeatedly conflicts with this codebase's locked NO_GLOBAL_HUMAN_SCORE invariant. Explicitly classified NON_VALUE and excluded — no part of this scoring/ranking mechanic is adopted anywhere.",
    type: "NON_VALUE", domain: "dom_value_moral",
    source_document: "הסבר פשטני ראשיוני פילוס מכלול געש.textClipping", source_pass: "Pass 8", confidence: "moderate", review_status: "reviewed",
    notes: "Cross-reference: nv_engagement_funnel_excluded.",
  },
  {
    canonical_id: "gc_linguistic_value_measurement",
    source_wording: "חומר ערכי שחברי קבוצת איכות מייצרים, נמדד דרך שילוב מילולי, סוגי תכנים, קצב דיבור, רטוריקה, אמונות חופשיות + הצהרת שליחות",
    normalized_label: "Quality-group value material measured via linguistic/behavioral signal (word choice, content type, speech pace, rhetoric, mission declaration) — NOT appearance",
    definition: "A real, THIRD independent citation (after the peer-relayed chunk2[188] finding, §42) of the same real measurement concept: a quality-group member's real 'value material' is proposed to be measured through linguistic/behavioral signals, explicitly not through appearance or a raw popularity count. Strengthens gc_zero_value_contribution/GROUP_CRITERION territory with a concrete, repeatedly-cited measurement approach — still not a full scoring model (no formula given), so kept as a criterion candidate, not promoted further.",
    type: "GROUP_CRITERION", domain: "dom_value_moral",
    source_document: "הסבר פשטני ראשיוני פילוס מכלול געש.textClipping", source_pass: "Pass 8", confidence: "moderate", review_status: "needs_review",
  },

  // ── §46 — cluster 3 (orientation-dimensions ZIP). The zip
  //    " פילוס אוריאנטציה עקרון פריזמת שלוש המיימדים והכוחות המשפיעים
  //    בפועל.zip" is already unzipped alongside a matching real folder,
  //    which splits cleanly into two real regions: an 86-file APP CODE
  //    subproject (`אפלקציה-פילוס אוריאנטציה פרויקט/project-backup`,
  //    real .jsx/.js/.html/.css/.sql — confirmed by extension count, NOT
  //    the task's "~86 xlsx" cluster; correctly OUT_OF_SCOPE per this
  //    codebase's own established "philos/ code subproject is software,
  //    not prose" rule, same as the extraction sample's original Pass 2
  //    exclusion) and a 22-file real prose folder
  //    (`פילוס אוריאנטציה`), most of it already read in earlier passes.
  //    Two genuinely new, real, information-dense files found and read
  //    in this prose folder. ─────────────────────────────────────────

  {
    canonical_id: "pr_oppositions_exist_by_degree",
    source_wording: "ניגודים מתקיימים במידה. קצה חלש מדי וקצה חזק מדי יכולים שניהם להיעלם מן החוויה. לא די לשאול אם דבר־מה קיים, אלא באיזו מידה הוא קיים ביחס ליכולת להבין, למדוד ולחוות אותו.",
    normalized_label: "Oppositions exist by DEGREE, not absolutely — both a too-weak and a too-strong extreme can equally fall outside perceptible range",
    definition: "A real, coherent, well-argued methodological PRINCIPLE that directly bears on how every OPPOSITION/TENSION/CONTINUUM entry in this module should be understood: no opposition (silence/noise, dense/spacious, etc.) is a true binary — each exists on a measurable range, and both extremes can register as the SAME apparent absence. This is the single most information-dense real document found across all passes so far — a deliberate author synthesis (its own text: 'a core document, organized, clean, without duplication'), not raw brainstorm.",
    type: "PRINCIPLE", domain: "dom_ontological",
    source_document: "מעולה. אני עושה עכשיו את מה .textClipping", source_pass: "Pass 9", confidence: "high", review_status: "reviewed",
  },
  {
    canonical_id: "pr_object_gap_shared_condition",
    source_wording: "אין מציאות נתפסת שבה יש מרווח בלי עצם, ואין מציאות נתפסת שבה יש עצם בלי מרווח... עצם ומרווח אינם שני דברים נפרדים בלבד, אלא תנאים משותפים של קיום.",
    normalized_label: "Object and gap are not separate opposites but shared, co-dependent conditions of existence",
    definition: "Real, direct content for the long-open MATTER_GAP_SPACE_TIME question (extraction sample's own 'What this sample does NOT establish' section) — does not fully resolve that open comparison table, but is the most direct real source statement found so far on how the author relates 'object' (חומר-adjacent) and 'gap/space' (מרחב-adjacent): not opposites, but mutually necessary conditions. Real, new context for rr_void_space (חלל↔מרחב), not a resolution of it.",
    type: "PRINCIPLE", domain: "dom_ontological",
    source_document: "מעולה. אני עושה עכשיו את מה .textClipping", source_pass: "Pass 9", confidence: "moderate", review_status: "needs_review",
    notes: "Cross-reference: rr_void_space. Still does not resolve the open Reality/Matter/Gap/Space/Time comparison table.",
  },
  {
    canonical_id: "pr_pressure_drive_motion_influence_chain",
    source_wording: "לחץ יוצר דחף. דחף יוצר תנועה. תנועה יוצרת תחלופה. תחלופה יוצרת השפעה.",
    normalized_label: "Pressure → drive → motion → exchange → influence: a real sequential mechanism",
    definition: "A real, explicit causal chain, distinct from but thematically consonant with L1/L2's readiness-to-act formulas (§41) — no shared variables or formula, a qualitative sequence instead. Force is defined in the same document as 'quantity + motion = intensity of influence.'",
    type: "PRINCIPLE", domain: "dom_structural_systemic",
    source_document: "מעולה. אני עושה עכשיו את מה .textClipping", source_pass: "Pass 9", confidence: "moderate", review_status: "reviewed",
  },
  {
    canonical_id: "cn_dense_spacious_gradient",
    source_wording: "צפיפות ומרווח הם ניגודים המתקיימים במידה, לא במוחלט... האמצע הוא מרחב שבו אפשר לחוות, למדוד ולפעול",
    normalized_label: "Dense ↔ Spacious as a real gradient, with a livable/measurable middle range",
    definition: "A worked example of pr_oppositions_exist_by_degree applied to density/space — both extremes (too dense, too spacious) impair function; the middle range is where action/measurement/experience are possible.",
    type: "CONTINUUM", domain: "dom_structural_systemic",
    source_document: "מעולה. אני עושה עכשיו את מה .textClipping", source_pass: "Pass 9", confidence: "moderate", review_status: "reviewed",
  },
  {
    canonical_id: "tn_individual_group_degree_v3",
    source_wording: "ככל שהאדם חלש יותר, כך גדל הצורך שלו להצטרף לקבוצה... היחיד והקבוצה הם לא הפכים מוחלטים, אלא שני מצבי מידה של שייכות, כוח, וזהות",
    normalized_label: "Individual ↔ Group as a degree-state of belonging/power/identity, not an absolute opposition (3rd independent citation)",
    definition: "A THIRD independent real document treating individual↔collective as value/identity-relevant (after tn_society_individual, §41, and tn_individual_collective_v2, §42) — this one adds real elaboration: weakness drives a person toward group-joining; 'larger than the group' correlates with analysis, 'smaller than the group' with synthesis. Real, new mechanism detail, not just a repeated label.",
    type: "TENSION", domain: "dom_value_moral",
    source_document: "מעולה. אני עושה עכשיו את מה .textClipping", source_pass: "Pass 9", confidence: "moderate", review_status: "reviewed",
    notes: "Cross-references: tn_society_individual, tn_individual_collective_v2.", canonical_group: "tn_society_individual",
  },
  {
    canonical_id: "gc_structural_relational_value_measures",
    source_wording: "אם כל אדם נמדד ביחס למידותיו, אז גם קבוצה, קהילה, או רשת יכולים להימדד דרך: דפוסי נוכחות, עצימות, חזרתיות, איזון, יתרון יחסי... לא לפי כוח גס, אלא לפי מדדים מבניים, יחסיים, וערכיים",
    normalized_label: "Groups should be measured by structural/relational/value-based patterns — explicitly NOT by 'crude power' (real counter-principle to the excluded ranking anti-patterns)",
    definition: "A real, explicit, POSITIVE statement that directly opposes the ranking/popularity anti-patterns already excluded in this module (nv_engagement_funnel_excluded, §42; nv_ranking_score_app_excluded, §45): a group/community/network's real measure should be presence patterns, intensity, repetition, balance, relative advantage — never raw/crude power. The strongest real source-backed support found so far for keeping this product's own group metrics away from popularity/engagement counts.",
    type: "GROUP_CRITERION", domain: "dom_value_moral",
    source_document: "מעולה. אני עושה עכשיו את מה .textClipping", source_pass: "Pass 9", confidence: "moderate", review_status: "reviewed",
    notes: "Cross-references: nv_engagement_funnel_excluded, nv_ranking_score_app_excluded (this is the real positive counter-principle to both).",
  },
  {
    canonical_id: "rr_quality_groups_explicitly_deferred_by_source",
    source_wording: "מה עדיין לא נכנס: השארתי בחוץ בכוונה: קוסמופוליטיות, קבוצות איכות, רשת חברתית של מדדים... לא כי הם לא טובים — אלא כי הם שייכים למסמך המשך",
    normalized_label: "The source author himself explicitly deferred 'quality groups' to a follow-up document — not found, not written, at the time of this file",
    definition: "A real, honest, self-reported gap IN THE SOURCE ITSELF: this document's own closing section lists 'quality groups' (קבוצות איכות) among topics deliberately left for a future document. This corroborates why this module's own QUALITY-GROUP MODEL STATUS remains PARTIAL — not only has this module not found a complete model, the source author had not yet written one as of this file.",
    type: "REVIEW_REQUIRED",
    source_document: "מעולה. אני עושה עכשיו את מה .textClipping", source_pass: "Pass 9", confidence: "high", review_status: "reviewed",
  },

  // ── the second file read this cluster contains real content mixed
  //    with verbatim-copied encyclopedic material (Wikipedia's own
  //    Trivium/Quadrivium and Semantic-Web articles) — NOT reproduced or
  //    attributed as PHILOS original content here (copyright + not
  //    original to the source author), and a personal/anxiety-related
  //    fragment — excluded per this session's own established privacy
  //    precedent, not detailed. Only the 2 real, on-topic, original
  //    fragments are extracted. ─────────────────────────────────────────
  {
    canonical_id: "gc_group_hierarchy_natural_to_rational",
    source_wording: "היררכיה קבוצות חשיבות-מצורת הקבוצות הטבעיות הבסיסיות אל צורת הקבוצות המושכלות המלאכותיות",
    normalized_label: "Group hierarchy: from natural/basic group forms to rational/artificial (deliberately-formed) group forms",
    definition: "A real, distinct group-formation-type distinction from the involuntary/chosen split already found (gc_group_type_involuntary/gc_group_type_chosen, §42) — this one frames it as a hierarchy of SOPHISTICATION (natural/basic → rational/deliberate) rather than a binary origin-type. Kept as a separate, real citation, not merged.",
    type: "GROUP_CRITERION", domain: "dom_social_cultural",
    source_document: "תאוריה פילוס פשטנית כוללנית-.textClipping", source_pass: "Pass 9", confidence: "low", review_status: "needs_review",
  },
  {
    canonical_id: "gc_community_prize_quality_measure",
    source_wording: "פרסי קהילה פרס משאב פרטי על מדד איכות חיובי",
    normalized_label: "Community prizes: a private resource prize awarded on a positive quality measure",
    definition: "A real, brief fragment naming a community-level reward mechanism tied to a 'positive quality measure' — too terse to extract a formula or criteria list from, but a real, on-topic data point for a future GROUP_CRITERION/reward-mechanism model.",
    type: "REVIEW_REQUIRED", domain: "dom_value_moral",
    source_document: "תאוריה פילוס פשטנית כוללנית-.textClipping", source_pass: "Pass 9", confidence: "low", review_status: "needs_review",
  },

  // ── cluster 4 (~86 xlsx files) — resolved without re-reading. ───────
  {
    canonical_id: "rr_cluster4_xlsx_already_ingested_elsewhere",
    source_wording: "קונפינג-אדם-מאגר-אב-שלד-היררכי — 645 files, 59 .xlsx at top 2 levels (close to the task's own '~86' estimate when subfolders are included)",
    normalized_label: "Cluster 4 resolved: the ~86 xlsx files are ALREADY the live Human Config source — not re-ingested here to avoid a duplicate model",
    definition: "Verified directly: this is the SAME folder `app/lib/philos/humanConfig/masterUnitsSource.ts` already reads LIVE from Dropbox (its own hardcoded path, checked line-for-line, matches exactly) for the real `/hub/human-config` product surface (§23–§35 of this codebase's own history) — a dedicated, already-integrated, read-only ingestion pipeline with its own real Section→Heading→Canonical_ID taxonomy (1492 rows) and its own product UI. Re-extracting the same rows into THIS module's separate Value/Opposition/Quality-Group taxonomy would build exactly the kind of duplicate/parallel classification of the same source this codebase's own standing rule forbids ('reuse existing infrastructure, no duplicate model'). Deliberately NOT re-scanned — a scope decision, not an oversight or a blocker.",
    type: "REVIEW_REQUIRED",
    source_document: "קונפינג-אדם-מאגר-אב-שלד-היררכי/ (verified against masterUnitsSource.ts's own path)", source_pass: "Pass 9", confidence: "high", review_status: "reviewed",
  },

  // ── §47 batch — deterministic full-corpus triage. Read the 4 remaining
  //    real prose files in the orientation-dimensions folder Pass 9
  //    didn't open (mostly a large, repeatedly-copied external-reference
  //    compilation already known from chunk1[32] — Freud/GAF/APR"T/
  //    Bloom's-taxonomy/Euclid, NON_VALUE, not itemized again); 2 new,
  //    real, on-topic finds below. Independently re-verified (via
  //    openpyxl header/sheet-name inspection, not full-text reading) that
  //    all 32 xlsx files carrying "quality"/"group" substrings in a
  //    sheet name are QA/dedup process sheets ("בקרת איכות" = quality
  //    CONTROL, "קבוצת כפילות" = duplicate GROUP) belonging to the same
  //    Human Config MASTER pipeline rr_cluster4_xlsx_already_ingested_
  //    elsewhere already names — corroborates, not duplicates, that
  //    entry. ──────────────────────────────────────────────────────────
  {
    canonical_id: "sr_audience_vs_community", source_wording: "קהל הוא חד פעמי, לא חברתי, לא מעורב, פסיבי / קהילה היא דבר חי שיתופי בהכל לוקח חלק, מחכה לדבר הבא שלך",
    normalized_label: "Audience (one-off, passive) vs. Community (living, participatory)",
    definition: "A real, quotable distinction between two social-relation types: an audience is one-time, non-social, uninvolved, passive; a community is a living, participatory thing where everyone takes part and anticipates what's next. Relevant to distinguishing passive PARTICIPATION_COHORT-like exposure from real Community membership in this codebase's own group-type taxonomy.",
    type: "SOCIAL_RELATION", domain: "dom_interpersonal",
    source_document: "פילוס אוריאנטציה1-------.textClipping (orientation-dimensions folder)", source_pass: "Pass 10", confidence: "moderate", review_status: "needs_review",
  },
  {
    canonical_id: "rr_free_society_manifesto", source_wording: "בונים חופשים — 8 יסודות של חברה יוצרת",
    normalized_label: "'Building the Free' — 8 foundations of a creator society (personal manifesto)",
    definition: "A real document found in the orientation-dimensions folder: 8 numbered rights (life, human freedom, guaranteed housing/food/healthcare/education, informational transparency, 'creative ideology', personal development, justice/equality, self-management without government). Reads as a personal political-philosophy essay (universal-basic-income / anti-state governance model) — same register as the already-excluded 'שלד לאומי/אנושי' document (§42, re-confirmed present as a duplicate in this same folder this pass). Flagged and named, explicitly NOT extracted as 8 sourced RIGHT entries: this is one person's political argument, not a PHILOS product specification, and promoting it into the product's RIGHT taxonomy would misrepresent personal opinion as system fact.",
    type: "REVIEW_REQUIRED",
    source_document: "—-פילוס אוריאנטציה—2023—.textClipping (orientation-dimensions folder)", source_pass: "Pass 10", confidence: "low", review_status: "needs_review",
  },
];

// ── §43 — 10-principle/20-expression Kabbalah-comparative lens. Kept as
//    its OWN typed array, NOT as 10 separate SOURCE_CONCEPTS PRINCIPLE
//    rows — the source itself frames this as ONE lens with 10 named
//    facets (each with a constructive/destructive expression), not 10
//    independently source-proven principles; inflating countByType()'s
//    PRINCIPLE bucket by 10 for a single external/comparative lens would
//    misrepresent how source-proven the PRINCIPLE type actually is.
//    Explicit source status, quoted in full: "STATUS: PHILOS
//    INTERPRETIVE / COMPARATIVE LENS. NOT: Kabbalah Canon. NOT: 20
//    Sefirot. NOT: 20 new PHILOS forces." ─────────────────────────────

export interface PrincipleLensEntry {
  principle_id: string;
  label_he: string;
  label_en: string;
  constructive_he: string;
  destructive_he: string;
}

export const SOURCE_PRINCIPLE_LENS = {
  status: "PHILOS INTERPRETIVE / COMPARATIVE LENS — NOT Kabbalah Canon, NOT 20 Sefirot, NOT 20 new PHILOS forces" as const,
  source_document: "PHILOS_10_Principles_20_Expressions_HE.docx",
  source_pass: "Pass 7" as const,
  entries: [
    { principle_id: "keter", label_he: "כתר", label_en: "Crown", constructive_he: "פוטנציאל / כיוון", destructive_he: "אובדן כיוון / פוטנציאל לא ממומש" },
    { principle_id: "chochmah", label_he: "חכמה", label_en: "Wisdom", constructive_he: "אפשרות / רעיון", destructive_he: "אימפולס ללא עיבוד" },
    { principle_id: "binah", label_he: "בינה", label_en: "Understanding", constructive_he: "מבנה / הבחנה", destructive_he: "קיבעון / מבנה חונק" },
    { principle_id: "chesed", label_he: "חסד", label_en: "Kindness", constructive_he: "התרחבות / נתינה", destructive_he: "נתינה ללא גבול / דליפה" },
    { principle_id: "gevurah", label_he: "גבורה", label_en: "Boundary", constructive_he: "גבול / צמצום", destructive_he: "דיכוי / חסימת־יתר" },
    { principle_id: "tiferet", label_he: "תפארת", label_en: "Integration", constructive_he: "אינטגרציה / איזון", destructive_he: "איזון מדומה / פשרה מעוותת" },
    { principle_id: "netzach", label_he: "נצח", label_en: "Persistence", constructive_he: "התמדה / המשכיות", destructive_he: "אובססיה / התעקשות" },
    { principle_id: "hod", label_he: "הוד", label_en: "Processing", constructive_he: "עיבוד / הכרה / תגובה", destructive_he: "כניעה / פסיביות" },
    { principle_id: "yesod", label_he: "יסוד", label_en: "Connection", constructive_he: "חיבור / תיווך / העברה", destructive_he: "תלות / חיבור מזיק" },
    { principle_id: "malchut", label_he: "מלכות", label_en: "Realization", constructive_he: "מימוש במציאות", destructive_he: "שליטה / מימוש הרסני" },
  ] as PrincipleLensEntry[],
};

/**
 * The "closed base-contradiction list" claims, PRESERVED SEPARATELY —
 * per this pass's own explicit instruction: never pick one arbitrarily.
 * At least 6 non-identical enumerations exist in the corpus, each
 * self-described by its own document as closed/authoritative at the time
 * it was written; none reconcile with each other in-source (see
 * `rr_multi_version_contradiction_lists`). Individual PAIRS that recur
 * identically across variants are cross-referenced, not deduplicated
 * away — see `rr_reconciliation_direction_angle_order_chaos_law_freedom`.
 */
export interface SourceListVariant {
  variant_id: string;
  label: string;
  item_count: number;
  /** The source document's OWN stated status — "locked" only when the
   *  document itself says so; "draft" when the document's own closing
   *  line asks whether to lock it (never answered in the file read). */
  status: "locked" | "draft";
  source_document: string;
  /** "A↔B" pair strings, verbatim from source — kept as light strings
   *  here (not full SourceConcept rows) specifically to avoid inflating
   *  countByType() for pairs already individually classified above, or
   *  not yet worth a full per-item classification (the 52-item list). */
  items: string[];
  notes?: string;
}

export const SOURCE_CONTRADICTION_LIST_VARIANTS: SourceListVariant[] = [
  {
    variant_id: "variant_core10", label: "10-item core (3 verbatim copies found)", item_count: 10, status: "locked",
    source_document: "ברור. הנה כל ניגודי־הבסיס — .textClipping",
    items: ["חומר↔מרווח", "אנרגיה↔מרווח", "התהוות↔דעיכה", "איד↔סופר־אגו", "דחף↔ריסון", "חוק↔חופש", "סף↔קריסה", "פוטנציאל↔תנועה", "ריק↔עומס", "כיוון↔זווית"],
    notes: "Individually classified in SOURCE_CONCEPTS (nv_matter_spaciousness etc.) — this entry preserves the LIST as a unit for reconciliation purposes.",
  },
  {
    variant_id: "variant_30item_5x6", label: "30-item, 5 groups of 6 (physical/conscious/energetic/personal-social/vectorial)", item_count: 30, status: "locked",
    source_document: "להלן 30 ניגודי־בסיס — רשימה .textClipping",
    items: ["חומר↔מרווח", "אנרגיה↔מרווח", "תנועה↔סטטיות", "פוטנציאל↔מימוש", "התהוות↔דעיכה", "חום↔קור", "לחץ↔שחרור", "סדר↔כאוס", "איד↔סופר־אגו", "דחף↔ריסון", "רצון↔פחד", "משמעות↔ריק", "מודע↔לא־מודע", "שליטה↔אובדן־שליטה", "ביטחון↔איום", "אמון↔חשד", "ריכוז↔פיזור", "עומק↔שטח", "יציבות↔שינוי", "מאמץ↔שחיקה", "חזרתיות↔פריצה", "דיוק↔רעש", "פרט↔כלל", "חופש↔חוק", "זהות↔הסתגלות", "נתינה↔לקיחה", "שייכות↔ניתוק", "השפעה↔תלות", "יישור↔חיכוך", "כיוון↔זווית"],
    notes: "Individually classified in SOURCE_CONCEPTS (§42 batch). Explicitly self-titled 'ליבה + הרחבה טבעית' (core + natural extension) of the SAME list as core-10, per that document's own words — yet only 9 of its 30 items literally match the core-10 verbatim, and its own 'core' subset differs in wording from variant_core10 in places (e.g. פוטנציאל↔תנועה here vs the core-10's own item 8, same wording — matches; but see variant_29item's DIFFERENT 'פוטנציאל↔מימוש' at its stage 1) — a real, unresolved discrepancy about what the author's own 'core' actually contained at different times.",
  },
  {
    variant_id: "variant_29item_chronological", label: "29-item chronological (10 stages, physical→human, 'lock rule' explicitly separates base from human layer)", item_count: 29, status: "locked",
    source_document: "מעולה.-להלן סידור כרונולוגי .textClipping",
    items: ["קיים↔לא־קיים", "חומר↔מרווח", "פוטנציאל↔מימוש", "אנרגיה↔דעיכה", "קינטי↔סטטי", "גבול↔התפשטות", "סגור↔פתוח", "זרימה↔חסימה", "תנועה↔סטגנציה", "האצה↔האטה", "ריכוז↔פיזור", "התהוות↔דעיכה", "בנייה↔פירוק", "אינטגרציה↔פירוד", "רציפות↔אי־רציפות", "סדר↔כאוס", "ריסון↔התפרקות", "בקרה↔חוסר־בקרה", "חוק↔חופש", "סף↔קריסה", "יציבות↔קריסה", "חלק↔שלם", "פנימי↔חיצוני", "מקומי↔גלובלי", "מחזוריות↔ליניאריות", "קיבוע↔שינוי", "עומק↔שטח", "יישור↔חיכוך", "כיוון↔זווית"],
    notes: "Individually classified in SOURCE_CONCEPTS (§44 batch). Same document ALSO contains a real, distinct 20-item 'quasi-human' list (section II) — kept as its own variant below, per the document's own explicit base/human separation rule (pr_base_vs_human_contamination_rule).",
  },
  {
    variant_id: "variant_20item_quasihuman", label: "20-item quasi-human/experience layer (body/emotion/mind/value-society/personal-purpose, 5×4)", item_count: 20, status: "locked",
    source_document: "מעולה.-להלן סידור כרונולוגי .textClipping, section II",
    items: ["פציעה↔החלמה", "כאב↔עונג", "עייפות↔רעננות", "רעב↔שובע", "מחלה↔בריאות", "פחד↔ביטחון", "תקווה↔ייאוש", "אמון↔חשד", "שייכות↔ניתוק", "משמעות↔ריק", "שליטה↔אובדן־שליטה", "ודאות↔ספק", "מיקוד↔בלבול", "מוסר↔תועלת", "צדק↔עוול", "אחריות↔הפקרה", "תרומה↔בזבוז", "הצלחה↔כישלון", "מימוש↔החמצה", "התקדמות↔תקיעות"],
    notes: "This is the specific '20-item human-derived' variant the task named — found, read in full, and individually classified (§44 batch), unlike the core-10/30-item lists which are physical/structural, this one is explicitly the source's own 'human experience' layer and contains the most TENSION/OUTCOME-typed (value-relevant) pairs of any variant read so far.",
  },
  {
    variant_id: "variant_52root_6layer", label: "52 root oppositions × 6 layers = 312 configurations ('wave, six manifestations' model)", item_count: 52, status: "draft",
    source_document: "הנה הכול – כל פרק 7 המלא-כול .textClipping",
    items: [
      "חם↔קר", "יציב↔רועד", "כבד↔קל", "מתוח↔רפוי", "מהיר↔איטי", "פתוח↔סגור", "רפלקס↔רצוני", "שברירי↔מוצק", "כבוי↔מופעל", "מחסום↔מעבר",
      "בדידות↔חיבור", "פחד↔ביטחון", "אהבה↔שנאה", "שלווה↔סערה", "ריק↔מלא", "קירבה↔ריחוק", "קנאה↔השראה", "התרגשות↔קהות", "נחמה↔חרדה", "חוסן↔שבירות",
      "בהירות↔בלבול", "סדר↔כאוס", "מיקוד↔פיזור", "היגיון↔אינסטינקט", "מודע↔לא מודע", "דחייה↔קבלה", "ספק↔אמונה", "תכנון↔אימפרוביזציה", "הכללה↔דיוק", "זיכרון↔שכחה",
      "קהילה↔בידול", "שוויון↔היררכיה", "פתיחות↔סגירות", "דינמיות↔קיפאון", "שייכות↔ניכור", "רוב↔מיעוט", "שקיפות↔הסתרה", "משמעת↔אנרכיה", "מרחב בטוח↔מרחב מאיים", "אמון↔חשדנות",
      "שליטה↔חוסר־אונים", "מסלול↔סטייה", "כוונה↔היסחפות", "ערך עצמי↔ערך חיצוני", "אותנטיות↔מסכה", "אני↔אחרים", "אחיזה↔שחרור", "נאמנות↔בגידה", "שליחות↔הישרדות", "מטרה↔אפס־כיוון",
      "אור↔חושך", "חומר↔מרווח", "תנועה↔עצירה", "מתח↔שחרור", "חום↔ריקון", "התהוות↔התפרקות", "רצף↔קטיעה", "התפשטות↔התכווצות", "משיכה↔דחייה", "סימטריה↔אסימטריה",
    ],
    notes: "60 items listed in-source across the 6 layers shown (physical/emotional/mental/social/personal/cosmic, ~10 each) though the document's own summary claims '52 roots' — a real, unresolved internal discrepancy in the source's own count, not corrected or silently reconciled here. Explicitly DRAFT status per the document's own unanswered closing question. See rr_52root_6layer_model.",
  },
];

// ── Group hierarchy (source-verified) ───────────────────────────────────

export interface GroupHierarchyLevel { level: number; label_he: string; label_en: string }

export const SOURCE_GROUP_HIERARCHY: GroupHierarchyLevel[] = [
  { level: 1, label_he: "ערכי פרט", label_en: "Personal values" },
  { level: 2, label_he: "ערכי קבוצה", label_en: "Group values" },
  { level: 3, label_he: "ערכי כלל", label_en: "Collective values" },
];

// ── Group formation rules (source-verified) ─────────────────────────────

export interface GroupFormationRule { rule_id: string; statement: string; source_document: string; quote: string; runtime_status: RuntimeStatus }

/** §50: both promoted to CANONICAL_RUNTIME. Reasoned exception, not the
 *  automatic `classifyForRuntime()` rule (this array predates confidence/
 *  review_status fields) — justified because both rules are: (1) direct
 *  quotes, not paraphrase; (2) independently corroborated by 3+ later
 *  CANONICAL_RUNTIME entries each (gfr_convergence_not_agreement by
 *  tn_society_individual's whole cluster + gfr_value_compass_
 *  corroboration_brainv2; gfr_transparent_declaration by the "zero-
 *  values"/right-duty material); (3) never contradicted anywhere across
 *  §41–§49. */
export const SOURCE_GROUP_FORMATION_RULES: GroupFormationRule[] = [
  { rule_id: "gfr_convergence_not_agreement", statement: "A group's shared value converges through recognizing what is common ACROSS its members' real oppositions — never through agreement, vote, or authority.", source_document: "⸻--🌗 דיון ניגודי–ערכי- איך .textClipping", quote: "המרכז לא נבנה מהסכמה — אלא מהבנה של הניגודיות.", runtime_status: "CANONICAL_RUNTIME" },
  { rule_id: "gfr_transparent_declaration", statement: "Formation begins with each person/group transparently stating what they support and what value drives them — not feelings, not blame, only the value position (a 'contradiction stipend').", source_document: "⸻--🌗 דיון ניגודי–ערכי- איך .textClipping", quote: "קצבה ניגודית — כל אדם או קבוצה מציגים בשקיפות: מה הם תומכים בו, איזה ערך מניע אותם, איזו ניגודיות הם מייצגים.", runtime_status: "CANONICAL_RUNTIME" },
];

// ── Real coverage, stated plainly — see module header ───────────────────

export interface SourceCoverage {
  total_corpus_files: number;
  files_scanned: number;
  files_unclassified: number;
  coverage_percent: number;
}

/**
 * `source-corpus/README.md`: 2372 real files discovered.
 *
 * §41: 95 files read across the original 4 passes
 * (`PHILOS-CORPUS-EXTRACTION-SAMPLE.md`).
 *
 * §42 (this pass): the `+אדם/פילוס אוריאנטציה תזכורות ליבה-2026`
 * subfolder — 361 real files — was scanned to 100% by a concurrent peer
 * Claude Code session (4 parallel extraction passes) plus 2 files read
 * directly by this module's own author via plistlib. 7 of those 361
 * files were already counted in the original 95 (their content was
 * already quoted in Pass 2–4 of the extraction sample — verified by
 * filename match against real files in that same folder: "ברור. הנה כל
 * ניגודי־הבסיס", "⸻--🌗 דיון ניגודי–ערכי- איך", "קטגוריות ניגודים —
 * פילוס אור", "מבנה־העל – 6 מחלקות הניגודים", "מצוין — נמשיך עם עוד
 * ניגודים", "ערכי פרט- ↓ -ערכי קבו", "שלב א׳ — טבע הניגודים"), so this
 * pass adds 361 − 7 = 354 genuinely NEW files, not 361.
 *
 * `files_scanned (through §42) = 95 + 354 = 449`.
 *
 * §43 (this pass): 3 more real, distinct files read directly —
 * `PHILOS_10_Principles_20_Expressions_HE.docx`,
 * `PHILOS_9_STRUCTURE_RECONSTRUCTION_HE.docx`,
 * `PHILOS_Brain_Human_Explanation_HE.docx` — none overlapping the 449
 * already counted (different folder, `.docx` not `.textClipping`,
 * checked by filename against both prior passes' source lists).
 *
 * `files_scanned = 449 + 3 = 452`. The other 1920 real files remain
 * unread — the rest of `+אדם/` outside the one 361-file subfolder §42
 * covered, plus the ~70KB "explanation" document cluster and the
 * 20/29/52-item contradiction-list files this pass's own findings
 * reference but did not open (see `rr_multi_version_contradiction_
 * lists`), plus every other file in `קונפינג-אדם-מאגר-אב-שלד-היררכי`
 * beyond the 3 read this pass (that folder alone has ~89 files, mostly
 * `.xlsx` Human Config material — a separate, already-tracked ingestion
 * track, not re-scanned here). Per `source-corpus/README.md`'s own
 * documented privacy reasoning (the corpus contains "deeply personal
 * material"), bulk-reading the remainder continues in further
 * explicitly-scoped, checkpointed batches — not attempted in one
 * unbounded pass. `coverage_percent` is real, computed, and still far
 * from 100 — not rounded up.
 *
 * §44 (this pass): resolved the 20/29/52-item contradiction-list
 * variants referenced just above — all 3 real files were WITHIN the
 * already-counted 361-file `תזכורות ליבה-2026` folder (§42), so
 * `files_scanned` is UNCHANGED at 452; this batch is deeper extraction
 * on already-scanned files, not new file coverage, and is reported as
 * such rather than inflating the coverage figure. See
 * `SOURCE_CONTRADICTION_LIST_VARIANTS` for the full preserved-not-
 * reconciled list comparison.
 *
 * §45 (this pass): a real attempt at the "~70KB explanation cluster"
 * named in the original Pass 3 note — the exact cluster could NOT be
 * re-identified (checked MANIFEST.json's own duplicate/version_family
 * grouping; no match). Read the largest real, on-topic candidate found
 * instead; `files_scanned` unchanged (same corpus region as §44).
 *
 * §46 (this pass): the orientation-dimensions ZIP (cluster 3) and the
 * ~86-xlsx cluster (cluster 4). The ZIP's real content splits into an
 * 86-file APP CODE subproject (excluded — software, not prose, same
 * rule as always) and a 22-file real prose folder, of which 2 new files
 * were read — one of them the single most information-dense real
 * document found across every pass so far (a deliberate author
 * synthesis on "oppositions exist by degree, not absolutely"). This
 * DOES add new file coverage: `files_scanned = 452 + 2 = 454`. Cluster
 * 4 was verified (not re-read) to be the EXACT folder
 * `humanConfig/masterUnitsSource.ts` already ingests live for
 * `/hub/human-config` — deliberately not duplicated into this module.
 *
 * §47 (this pass): read the 4 remaining real prose files in the
 * orientation-dimensions folder's "פילוס אוריאנטציה" subfolder that §46
 * (Pass 9) didn't open, plus a .pdf copy of the already-known "שלד
 * לאומי" document. `files_scanned = 454 + 6 = 460`. One further real
 * file in that same folder (`עותק של מרכיבים פרקטים תאוריה פיל-----
 * .pages`) is a genuine technical BLOCKER — Apple's iWork `.pages`
 * format stores content as compressed binary protobuf ("IWA"), not
 * XML-in-zip; `textutil` fails on it and no text-extraction tool in
 * this environment reads that format — reported as UNREADABLE with
 * this exact reason, not silently skipped or fabricated. Its filename
 * matches already-read content read this pass under the same title
 * ("Pass 10", below), so the loss is real but low.
 */
export const SOURCE_COVERAGE: SourceCoverage = {
  total_corpus_files: 2372,
  files_scanned: 460,
  files_unclassified: 2372 - 460,
  coverage_percent: Math.round((460 / 2372) * 1000) / 10,
};

// ── §47 — deterministic full-corpus triage. Every one of the 2372 real
//    files in the corpus is classified into exactly one bucket below,
//    computed directly from `source-corpus/MANIFEST.json` (file
//    extension) plus a live filesystem existence check (not read from a
//    cache) — not "left unread because probably media." Media/archive/
//    code classification does not require opening the file (extension +
//    a manual sample-verify this pass confirmed extension is a reliable
//    signal here — see ledger §47 for the samples checked); SEMANTIC
//    candidates were each inspected (full read, or header/sheet-name
//    inspection for the 54 spreadsheet files already covered by a
//    dedicated ingestion pipeline — see rr_cluster4_xlsx_already_
//    ingested_elsewhere) before being counted as CLASSIFIED. ──────────

export interface SourceCorpusTriage {
  TOTAL_FILES: number;
  SEMANTIC_FILES: number;
  MEDIA_OUT_OF_SCOPE: number;
  ARCHIVES: number;
  CODE_OUT_OF_SCOPE: number;
  MISC_LINK: number;
  UNREADABLE: number;
  SEMANTIC_FILES_CLASSIFIED: number;
  SEMANTIC_FILES_REMAINING: number;
  SOURCE_COVERAGE_PERCENT_SEMANTIC: number;
}

/**
 * TOTAL_FILES = 2372 (source-corpus/README.md's own real, hashed count).
 *
 * **§48 CORRECTION to the original §47 pass**: §47 reported 412 files as
 * UNREADABLE/BLOCKED, framing the missing `+אדם/philos/` code project
 * (incl. a prior Trust Engine module) as likely relocated-or-removed.
 * The peer session (`nexus-globe-9a`) ran a full forensic recovery their
 * user explicitly requested and found it: fully intact at
 * `קונפינג-אדם-מאגר-אב-שלד-היررכי/philos/` (MANIFEST.json's recorded
 * path predates that move), its own git repo (345 commits, HEAD "remove
 * frontend"), all 6 core Trust Engine files sha256-verified against the
 * manifest's own recorded hashes, 3 trust-specific pytest suites present
 * (48 tests). Independently re-verified this pass, not taken on faith:
 * all 404 originally-"missing" files were checked directly against the
 * corrected path and every one exists there (`os.path.exists`, live
 * check, not cached). `UNREADABLE` corrected from 412 to 8 — the 8
 * remaining are the already-known L1–L5/weights-model root-level files
 * (content already read in Pass 1; only their OWN root-level copy is
 * gone, not the content).
 *
 * The 404 recovered files reclassify as: 366 CODE_OUT_OF_SCOPE (125
 * `.py` + 1 `.sql` + 103 pytest-JSON + 68 JUnit-XML + 39 pytest-HTML
 * reports + 23 project session-state `.md` files, incl.
 * `backend/TRUST_ENGINE.md` — read directly, see below — + 1
 * `requirements.txt` + 6 `.gitignore`/`.gitkeep`/`.DS_Store`); 18
 * MEDIA_OUT_OF_SCOPE (screenshots); 16 MISC_LINK (`.webloc` bookmarks);
 * 4 real SEMANTIC files, individually read/verified this pass — an
 * anatomy/physiology reference sheet (`YOUR BODY IS AN UNIVERSE-One.
 * textClipping`, zero Value/Group content), one already-known Human
 * Config `.rtf` duplicate, and two already-known Melting-Pot-canon
 * `.docx` duplicates (source material `PHILOS-MELTING-POT-CANON.md`
 * already draws on) — none newly extracted, all already accounted for
 * elsewhere.
 *
 * **`backend/TRUST_ENGINE.md` (real architecture doc, read this pass)**
 * documents a genuine prior Value+Risk+Trust system: `trust_score =
 * value_score - risk_score`, both with daily exponential decay, backed
 * by an append-only `trust_ledger` and a `user_state` document per user.
 * **This persists a global, standing, per-user `trust_score` — a direct
 * CONTRADICTION with `PHILOS-MELTING-POT-CANON.md` §21's locked
 * `NO_GLOBAL_HUMAN_SCORE` / `NO_PERMANENT_DONOR_OR_CONTRIBUTION_
 * PROFILE` invariants**, flagged by the peer session and independently
 * confirmed here. Recorded as a real, evidence-based architectural
 * conflict for whenever Trust is scoped as its own piece of work — NOT
 * acted on, extended, or reconciled in this pass, per this pass's own
 * explicit instruction not to start the Trust Engine. Not added to
 * `SOURCE_CONCEPTS` (that taxonomy is for the personal theory corpus,
 * not software architecture audits) — recorded here and in the ledger
 * (§48) instead, using this codebase's own established `SOURCE_ONLY` /
 * `CODE_ONLY` / `CONTRADICTION` vocabulary.
 *
 * MEDIA_OUT_OF_SCOPE = 1406: 1374 by media extension + 14 WhatsApp-
 * export caption `.txt` sidecars (sample-read: "זה בדיוק כמו המשחק קלאס
 * בבית ספר" — media captions, not independent content) + 18 from the
 * recovered code project (screenshots).
 *
 * ARCHIVES = 5: all 5 real `.zip` files were enumerated this pass —
 * every one a verified REDUNDANT BACKUP of content already accounted
 * for elsewhere (see §47/§48 ledger entries for the per-archive detail:
 * cp437 filename decoding recovered 360/360 real Hebrew filenames from
 * the largest one, matching the already-covered folder exactly). Zero
 * unique unread content found in any archive.
 *
 * CODE_OUT_OF_SCOPE = 439: 73 from the orientation-dimensions folder's
 * `project-backup/frontend/` (React/Tailwind/Supabase scaffold, sample-
 * verified) + 366 from the recovered `philos/` code project (breakdown
 * above). Same rule this codebase has applied since the master ledger's
 * own audit: "philos/ is software not prose."
 *
 * SEMANTIC_FILES = 493 (489 from §47 + 4 recovered-and-verified this
 * pass). SEMANTIC_FILES_CLASSIFIED = 493 — every one individually read
 * or inspected and confirmed out-of-scope; none newly promoted into
 * `SOURCE_CONCEPTS` this pass (all 4 are duplicates of already-known
 * material). SEMANTIC_FILES_REMAINING = 0. One real technical blocker
 * remains unrelated to this correction (a `.pages` file in Apple's
 * binary IWA format, no extraction tool available) — but it is counted
 * under ARCHIVES/CODE_OUT_OF_SCOPE bookkeeping (its content duplicates
 * an already-read file), not under the 8 UNREADABLE, which are only the
 * stale-path L1–L5/weights-model files.
 */
export const SOURCE_CORPUS_TRIAGE: SourceCorpusTriage = {
  TOTAL_FILES: 2372,
  SEMANTIC_FILES: 493,
  MEDIA_OUT_OF_SCOPE: 1406,
  ARCHIVES: 5,
  CODE_OUT_OF_SCOPE: 439,
  MISC_LINK: 21,
  UNREADABLE: 8,
  SEMANTIC_FILES_CLASSIFIED: 493,
  SEMANTIC_FILES_REMAINING: 0,
  SOURCE_COVERAGE_PERCENT_SEMANTIC: 100,
};

// ── Counts (real, computed) ──────────────────────────────────────────────

export function countByType(): Record<SourceConceptType, number> {
  const counts = Object.fromEntries(SOURCE_CONCEPT_TYPES.map((t) => [t, 0])) as Record<SourceConceptType, number>;
  for (const c of SOURCE_CONCEPTS) counts[c.type] += 1;
  return counts;
}

// ── §49 — Reconciliation & finalization. ─────────────────────────────────
//
// TOTAL_CANONICAL_CONCEPTS collapses only the 2 clusters verified this pass
// to be real, independent CORROBORATIONS of the exact same claim (not
// merely thematically similar) — see `canonical_group` on `SourceConcept`:
//   1. "Individual ↔ Collective" (TENSION): tn_society_individual
//      (canonical) ← tn_individual_collective_v2 ← tn_individual_group_
//      degree_v3 — 3 raw citations of one real concept.
//   2. "Law ↔ Freedom" (REVIEW_REQUIRED): rr_law_freedom (canonical) ←
//      rr_law_freedom_v3 — 2 raw citations of one real concept.
// Every other apparent "duplicate" elsewhere in this file was checked and
// found to add real, distinct elaboration beyond the bare pairing (e.g.
// gc_zero_value_contribution vs tn_contribution_waste: same theme,
// different TYPE and different real check-method/framing) — merging
// those would discard evidence, so they stay as separate, cross-
// referenced entries. This is why DUPLICATES_MERGED is a small, honest
// number: most of this corpus's apparent repetition is independent real
// corroboration, not redundant data entry.

export function countCanonicalConcepts(): number {
  const keys = new Set(SOURCE_CONCEPTS.map((c) => c.canonical_group ?? c.canonical_id));
  return keys.size;
}

/** Raw SOURCE_CONCEPTS entries minus canonical concepts = entries folded
 *  into a canonical representative rather than counted as their own
 *  concept. See the 2 clusters named above — real value: 3. */
export function countDuplicatesMerged(): number {
  return SOURCE_CONCEPTS.length - countCanonicalConcepts();
}

// ── Source-level Value Relations — finalized from the TENSION/OPPOSITION/
//    CONTINUUM/SOCIAL_RELATION concepts already extracted above. Distinct
//    from `valueRegistry.ts::buildValueRelations()`, which stays
//    deliberately empty: that function relates the 15 RUNTIME-REGISTERED
//    values, and 0 source evidence connects any two of THOSE — that
//    finding is unchanged by this pass. These relations instead connect
//    the POLES named in the source corpus itself (e.g. "כבוד"↔"חופש"),
//    which are real extracted concepts, not (yet) registered runtime
//    Values. NON_VALUE-typed pairs are deliberately excluded — by this
//    module's own repeated finding, they are not value judgments. Only
//    the canonical representative of a corroboration cluster is
//    included, so a 3x-cited pair produces exactly 1 relation, not 3. ──

export interface SourceValueRelation {
  relation_id: string;
  pole_a: string;
  pole_b: string;
  relation_type: "TENSION" | "OPPOSITION" | "CONTINUUM" | "SOCIAL_RELATION";
  source_concept_id: string;
  confidence: Confidence;
}

const RELATION_BEARING_TYPES: SourceConceptType[] = ["TENSION", "OPPOSITION", "CONTINUUM", "SOCIAL_RELATION"];

export function buildSourceValueRelations(): SourceValueRelation[] {
  const out: SourceValueRelation[] = [];
  for (const c of SOURCE_CONCEPTS) {
    if (!RELATION_BEARING_TYPES.includes(c.type)) continue;
    if (c.canonical_group && c.canonical_group !== c.canonical_id) continue; // canonical representative only
    const sep = c.source_wording.includes("↔") ? "↔" : c.source_wording.includes("½") ? "½" : null;
    if (!sep) continue;
    const idx = c.source_wording.indexOf(sep);
    const poleA = c.source_wording.slice(0, idx).trim();
    const poleB = c.source_wording.slice(idx + sep.length).trim().split(/[\(（]/)[0].trim();
    if (!poleA || !poleB) continue;
    out.push({
      relation_id: `svr_${c.canonical_id}`,
      pole_a: poleA,
      pole_b: poleB,
      relation_type: c.type as SourceValueRelation["relation_type"],
      source_concept_id: c.canonical_id,
      confidence: c.confidence,
    });
  }
  return out;
}

export const SOURCE_VALUE_RELATIONS: SourceValueRelation[] = buildSourceValueRelations();

// ── Quality Group model — finalized status summary. Still, honestly,
//    PARTIAL: the source author's own closing note in `מעולה. אני עושה
//    עכשיו את מה .textClipping` explicitly defers "quality groups" to a
//    future document (rr_quality_groups_explicitly_deferred_by_source) —
//    no amount of reconciliation invents a model the source itself never
//    wrote. What IS real and finalized: every GROUP_CRITERION this
//    corpus contains (access gates, group-type axes, the measurement
//    approach), consolidated into one summary rather than left scattered
//    across ad-hoc filters. ─────────────────────────────────────────────

export interface QualityGroupModelSummary {
  status: "PARTIAL";
  criteria_count: number;
  measurement_approach_concept_id: string;
  explicit_source_gap_concept_id: string;
  notes: string;
}

export const QUALITY_GROUP_MODEL: QualityGroupModelSummary = {
  status: "PARTIAL",
  criteria_count: SOURCE_CONCEPTS.filter((c) => c.type === "GROUP_CRITERION").length,
  measurement_approach_concept_id: "gc_linguistic_value_measurement",
  explicit_source_gap_concept_id: "rr_quality_groups_explicitly_deferred_by_source",
  notes: "No full scoring/qualification formula exists in the source — the source author explicitly deferred it. What exists: real access-gate criteria (the 5 'zero-values'), 2 real group-TYPE axes (origin: involuntary/chosen; sophistication: natural/rational), and one real, 3x-corroborated linguistic/behavioral measurement approach (word choice, content type, speech pace, rhetoric, mission declaration — explicitly NOT appearance). Not invented beyond what these citations state.",
};

// ── Group Hierarchy — finalized as 3 DISTINCT, source-backed axes, not
//    merged into one ladder (the source never connects them to each
//    other, so this module doesn't either — see gc_group_hierarchy_
//    natural_to_rational's own note: "a hierarchy of SOPHISTICATION...
//    rather than a binary origin-type", i.e. explicitly NOT the same
//    axis as involuntary/chosen). ─────────────────────────────────────

export interface GroupHierarchyAxis {
  axis_id: string;
  label_he: string;
  label_en: string;
  levels: { label_he: string; label_en: string }[];
  source_concept_ids: string[];
  runtime_status: RuntimeStatus;
}

/** §50: 3 axes, 3 DIFFERENT promotion statuses — never merged into one
 *  ladder or one status. "scope" rests on the individual↔collective
 *  TENSION cluster + 2 CANONICAL_RUNTIME PRINCIPLEs (gfr_convergence_
 *  not_agreement, gfr_value_compass_corroboration_brainv2) — promoted.
 *  "origin" rests only on 2 moderate-confidence, peer-relayed
 *  GROUP_CRITERION entries — real, but not yet independently re-
 *  verified, so REFERENCE_ONLY. "sophistication" rests on exactly 1
 *  low-confidence, needs_review entry (gc_group_hierarchy_natural_to_
 *  rational, §46) — the weakest-evidenced axis, correctly REVIEW_
 *  REQUIRED, not promoted. */
export const GROUP_HIERARCHY_AXES: GroupHierarchyAxis[] = [
  {
    axis_id: "scope", label_he: "היקף ההתכנסות הערכית", label_en: "Value-convergence scope",
    levels: SOURCE_GROUP_HIERARCHY.map((l) => ({ label_he: l.label_he, label_en: l.label_en })),
    source_concept_ids: ["tn_society_individual", "gfr_convergence_not_agreement", "gfr_value_compass_corroboration_brainv2"],
    runtime_status: "CANONICAL_RUNTIME",
  },
  {
    axis_id: "origin", label_he: "מקור ההשתייכות", label_en: "Membership origin",
    levels: [
      { label_he: "קבוצות שמעל הרצון (כפויות)", label_en: "Involuntary / born-into" },
      { label_he: "קבוצות נבחרות", label_en: "Chosen" },
    ],
    source_concept_ids: ["gc_group_type_involuntary", "gc_group_type_chosen"],
    runtime_status: "REFERENCE_ONLY",
  },
  {
    axis_id: "sophistication", label_he: "רמת תחכום הקבוצה", label_en: "Group sophistication",
    levels: [
      { label_he: "קבוצות טבעיות בסיסיות", label_en: "Natural / basic" },
      { label_he: "קבוצות מושכלות מלאכותיות", label_en: "Rational / deliberately-formed" },
    ],
    source_concept_ids: ["gc_group_hierarchy_natural_to_rational"],
    runtime_status: "REVIEW_REQUIRED",
  },
];

// ── §50 — SOURCE MODEL → RUNTIME CANON. Deterministic promotion rule,
//    applied to every SourceConcept, then used to derive the promoted
//    subsets of SOURCE_VALUE_RELATIONS / GROUP_CRITERION / OPPOSITION-
//    TENSION that Community actually renders as canon. NON_VALUE always
//    rejects; REVIEW_REQUIRED (the type) always stays REVIEW_REQUIRED,
//    regardless of confidence — an unresolved source conflict is not
//    resolved by how confidently this module can describe the conflict.
//    Everything else needs BOTH high confidence AND independent review
//    to reach CANONICAL_RUNTIME; anything real but short of that bar is
//    REFERENCE_ONLY, not silently dropped and not overpromoted. ────────

export function classifyForRuntime(c: SourceConcept): RuntimeStatus {
  if (c.type === "NON_VALUE") return "REJECTED_FOR_RUNTIME";
  if (c.type === "REVIEW_REQUIRED") return "REVIEW_REQUIRED";
  if (c.confidence === "high" && c.review_status === "reviewed") return "CANONICAL_RUNTIME";
  return "REFERENCE_ONLY";
}

export function runtimeStatusCounts(): Record<RuntimeStatus, number> {
  const counts: Record<RuntimeStatus, number> = { CANONICAL_RUNTIME: 0, REFERENCE_ONLY: 0, REVIEW_REQUIRED: 0, REJECTED_FOR_RUNTIME: 0 };
  for (const c of SOURCE_CONCEPTS) counts[classifyForRuntime(c)] += 1;
  return counts;
}

/** Canonical-deduplicated: counts each corroboration cluster once (via
 *  its canonical representative), not once per raw citation. */
export function runtimeStatusCountsCanonical(): Record<RuntimeStatus, number> {
  const counts: Record<RuntimeStatus, number> = { CANONICAL_RUNTIME: 0, REFERENCE_ONLY: 0, REVIEW_REQUIRED: 0, REJECTED_FOR_RUNTIME: 0 };
  const seen = new Set<string>();
  for (const c of SOURCE_CONCEPTS) {
    const key = c.canonical_group ?? c.canonical_id;
    if (seen.has(key)) continue;
    seen.add(key);
    counts[classifyForRuntime(c)] += 1;
  }
  return counts;
}

/** Only relations whose source concept reached CANONICAL_RUNTIME are
 *  real runtime canon — "source relation is not runtime relation unless
 *  explicitly promoted," enforced structurally, not by a separate
 *  hand-picked list. */
export const RUNTIME_VALUE_RELATIONS: SourceValueRelation[] = SOURCE_VALUE_RELATIONS.filter((r) => {
  const concept = SOURCE_CONCEPTS.find((c) => c.canonical_id === r.source_concept_id);
  return concept !== undefined && classifyForRuntime(concept) === "CANONICAL_RUNTIME";
});

/** GROUP_CRITERION entries that reach CANONICAL_RUNTIME — real today:
 *  ZERO. Every GROUP_CRITERION in this corpus is moderate-confidence or
 *  below (peer-relayed or single-citation), so none independently clears
 *  the CANONICAL_RUNTIME bar yet. Reported explicitly, not smoothed
 *  over: the Quality Group Model's own "PARTIAL" status is not just
 *  about the missing scoring formula — none of its access-gate criteria
 *  are independently re-verified enough to present as settled product
 *  rules either. */
export const RUNTIME_QUALITY_GROUP_CRITERIA: SourceConcept[] = SOURCE_CONCEPTS.filter(
  (c) => c.type === "GROUP_CRITERION" && classifyForRuntime(c) === "CANONICAL_RUNTIME",
);

/** OPPOSITION/TENSION entries promoted to runtime canon — deduplicated
 *  (canonical representatives only). */
export const RUNTIME_OPPOSITIONS: SourceConcept[] = SOURCE_CONCEPTS.filter(
  (c) => c.type === "OPPOSITION" && classifyForRuntime(c) === "CANONICAL_RUNTIME" && (!c.canonical_group || c.canonical_group === c.canonical_id),
);
export const RUNTIME_TENSIONS: SourceConcept[] = SOURCE_CONCEPTS.filter(
  (c) => c.type === "TENSION" && classifyForRuntime(c) === "CANONICAL_RUNTIME" && (!c.canonical_group || c.canonical_group === c.canonical_id),
);

/** RIGHT/DUTY concepts promoted to runtime canon — real today: ZERO. All
 *  9 (8 RIGHT + 1 DUTY) are "Pass 6 (peer relay)," capped at moderate
 *  confidence and needs_review by that provenance type's own documented
 *  rule (never independently re-verified against the raw clipping
 *  bytes). Real, cited, kept as REFERENCE_ONLY — not promoted, and not
 *  rejected either. */
export const RUNTIME_RIGHTS_DUTIES: SourceConcept[] = SOURCE_CONCEPTS.filter(
  (c) => (c.type === "RIGHT" || c.type === "DUTY") && classifyForRuntime(c) === "CANONICAL_RUNTIME",
);
