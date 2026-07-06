/**
 * Case Pattern Engine — Schema v0 (Locked)
 * Layer 4 (Application) | Evidence: D — Hypothesis
 * Spec: docs/case-schema-v0.md
 */

// ── Enums ────────────────────────────────────────────────────────────────────

export type GapType =
  | 'value'       // what I believe vs. what is demanded
  | 'relational'  // connection sought vs. disconnection experienced
  | 'resource'    // what is needed vs. what is available
  | 'identity'    // who I am vs. who I am expected to be
  | 'power'       // self-determination vs. external control
  | 'epistemic';  // what I know vs. what I am permitted or able to know

export type PressureType =
  | 'social'      // group expectations, shame, reputation
  | 'emotional'   // internal affect: fear, grief, anger
  | 'economic'    // financial, material scarcity
  | 'physical'    // bodily safety, health
  | 'legal'       // institutional, regulatory, juridical
  | 'moral';      // ethical demands, value violation

export type ActionType =
  | 'approach'    // moved toward the source of tension
  | 'avoid'       // withdrew from the situation
  | 'transform'   // attempted to change the frame or relationship
  | 'surrender'   // accepted gap without addressing it
  | 'mobilize'    // sought external support or resources
  | 'none';       // no action taken

export type OutcomeClass =
  | 'resolved'    // gap closed
  | 'partial'     // gap reduced, tension remains
  | 'unresolved'  // gap unchanged
  | 'escalated'   // situation worsened
  | 'transformed'; // situation fundamentally restructured

export type ValueID =
  | 'truth'       // accurate representation of reality
  | 'justice'     // fair treatment and accountability
  | 'safety'      // freedom from harm
  | 'dignity'     // being treated as fully human
  | 'autonomy'    // self-determination and agency
  | 'belonging'   // connection and acceptance
  | 'loyalty'     // commitment and trust
  | 'growth';     // development, learning, change

export type ParticipantType =
  | 'self' | 'partner' | 'family' | 'friend'
  | 'colleague' | 'employer' | 'institution' | 'society';

// ── Enum sets (for validation) ─────────────────────────────────────────────

export const GAP_TYPES     = new Set<GapType>(['value','relational','resource','identity','power','epistemic']);
export const PRESSURE_TYPES= new Set<PressureType>(['social','emotional','economic','physical','legal','moral']);
export const ACTION_TYPES  = new Set<ActionType>(['approach','avoid','transform','surrender','mobilize','none']);
export const OUTCOME_CLASSES=new Set<OutcomeClass>(['resolved','partial','unresolved','escalated','transformed']);
export const VALUE_IDS     = new Set<ValueID>(['truth','justice','safety','dignity','autonomy','belonging','loyalty','growth']);
export const PARTICIPANT_TYPES=new Set<ParticipantType>(['self','partner','family','friend','colleague','employer','institution','society']);

// ── Gap categories (for partial similarity credit) ─────────────────────────

const GAP_CATEGORY: Record<GapType, string> = {
  value:      'normative',
  identity:   'normative',
  relational: 'interpersonal',
  power:      'interpersonal',
  resource:   'material',
  epistemic:  'epistemic',
};

// ── Case structure ─────────────────────────────────────────────────────────

export interface CaseCounterfactual {
  paths_not_taken:       ActionType[];
  values_not_activated:  ValueID[];
  outcomes_not_realized: Array<{ class: OutcomeClass; description: string }>;
}

/** Required fields — every stored case must have all six. */
export interface CaseRequired {
  id:        string;
  gap_type:  GapType;
  pressure:  PressureType[];   // non-empty
  action:    ActionType;
  outcome:   OutcomeClass;
  values:    ValueID[];        // non-empty
}

/** Optional fields — absent fields do not invalidate the case. */
export interface CaseOptional {
  situation_text?:      string;
  participants?:        ParticipantType[];
  gap_description?:     string;
  outcome_description?: string;
  interpretation?:      string;
  intensity?:           number;   // 0.0–1.0
  duration_days?:       number;   // >= 0
  counterfactual?:      CaseCounterfactual;
  pattern_ids?:         string[]; // assigned after matching, not at creation
}

export type Case = CaseRequired & CaseOptional;

// ── Similarity constants ───────────────────────────────────────────────────

export const SIMILARITY_THRESHOLD = 0.40;
export const STRONG_MATCH         = 0.65;
export const MIN_MATCHES          = 3;

// ── Similarity computation ─────────────────────────────────────────────────

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a);
  const intersection = b.filter(x => setA.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

function gapSim(a: GapType, b: GapType): number {
  if (a === b) return 1.0;
  if (GAP_CATEGORY[a] === GAP_CATEGORY[b]) return 0.5;
  return 0.0;
}

/**
 * Composite similarity between two cases (§4.2).
 *
 *   sim = 0.40 · values_jaccard
 *       + 0.30 · pressure_jaccard
 *       + 0.20 · gap_type_match
 *       + 0.10 · participants_jaccard
 */
export function computeSimilarity(a: Case, b: Case): number {
  const raw = (
    0.40 * jaccard(a.values,               b.values)
  + 0.30 * jaccard(a.pressure,             b.pressure)
  + 0.20 * gapSim(a.gap_type,              b.gap_type)
  + 0.10 * jaccard(a.participants ?? [],   b.participants ?? [])
  );
  // Clamp to [0, 1]: IEEE 754 weight accumulation can produce values slightly outside range.
  return Math.min(1, Math.max(0, raw));
}

// ── Validation ────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid:  boolean;
  errors: string[];
}

export function validateCase(c: Partial<Case>): ValidationResult {
  const errors: string[] = [];

  if (!c.id?.trim())                      errors.push('id is required and must be non-empty');
  if (!c.gap_type)                        errors.push('gap_type is required');
  else if (!GAP_TYPES.has(c.gap_type))   errors.push(`gap_type "${c.gap_type}" is not a valid GapType`);

  if (!c.pressure?.length)               errors.push('pressure must have at least 1 item');
  else c.pressure.forEach((p, i) => {
    if (!PRESSURE_TYPES.has(p)) errors.push(`pressure[${i}] "${p}" is not a valid PressureType`);
  });

  if (!c.action)                          errors.push('action is required');
  else if (!ACTION_TYPES.has(c.action))  errors.push(`action "${c.action}" is not a valid ActionType`);

  if (!c.outcome)                         errors.push('outcome is required');
  else if (!OUTCOME_CLASSES.has(c.outcome)) errors.push(`outcome "${c.outcome}" is not a valid OutcomeClass`);

  if (!c.values?.length)                 errors.push('values must have at least 1 item');
  else c.values.forEach((v, i) => {
    if (!VALUE_IDS.has(v)) errors.push(`values[${i}] "${v}" is not a valid ValueID`);
  });

  if (c.intensity !== undefined) {
    if (typeof c.intensity !== 'number' || c.intensity < 0 || c.intensity > 1)
      errors.push('intensity must be a number in [0.0, 1.0]');
  }

  if (c.duration_days !== undefined) {
    if (typeof c.duration_days !== 'number' || c.duration_days < 0)
      errors.push('duration_days must be a non-negative number');
  }

  if (c.participants) {
    c.participants.forEach((p, i) => {
      if (!PARTICIPANT_TYPES.has(p))
        errors.push(`participants[${i}] "${p}" is not a valid ParticipantType`);
    });
  }

  if (c.counterfactual) {
    c.counterfactual.paths_not_taken.forEach((a, i) => {
      if (!ACTION_TYPES.has(a))
        errors.push(`counterfactual.paths_not_taken[${i}] "${a}" is not a valid ActionType`);
    });
    c.counterfactual.values_not_activated.forEach((v, i) => {
      if (!VALUE_IDS.has(v))
        errors.push(`counterfactual.values_not_activated[${i}] "${v}" is not a valid ValueID`);
    });
  }

  return { valid: errors.length === 0, errors };
}

// ── Output types ─────────────────────────────────────────────────────────

export interface CaseMatch {
  case_id: string;
  score:   number;
  outcome: OutcomeClass;
  action:  ActionType;
}

export interface ActionPath {
  action:               ActionType;
  frequency:            number;                          // fraction of matches that took this action
  outcome_distribution: Partial<Record<OutcomeClass, number>>; // fractions among cases on this path
  risk_level:           'low' | 'medium' | 'high';
}

export type MatchConfidence = 'high' | 'medium' | 'low' | 'insufficient';

export interface MatchOutput {
  query_id:             string;
  confidence:           MatchConfidence;
  total_matches:        number;
  matches:              CaseMatch[];
  outcome_distribution: Partial<Record<OutcomeClass, number>>;
  action_paths:         ActionPath[];
}

// ── Match engine ──────────────────────────────────────────────────────────

function riskLevel(distribution: Partial<Record<OutcomeClass, number>>): 'low' | 'medium' | 'high' {
  const escalated = distribution.escalated ?? 0;
  if (escalated >= 0.4) return 'high';
  if (escalated >= 0.2) return 'medium';
  return 'low';
}

function confidence(n: number, hasStrong: boolean): MatchConfidence {
  if (n < MIN_MATCHES) return 'insufficient';
  if (n >= 10 && hasStrong) return 'high';
  if (n >= 5) return 'medium';
  return 'low';
}

function distribution<T extends string>(items: T[]): Partial<Record<T, number>> {
  if (items.length === 0) return {};
  const counts: Partial<Record<T, number>> = {};
  for (const item of items) counts[item] = (counts[item] ?? 0) + 1;
  const result: Partial<Record<T, number>> = {};
  for (const key in counts) result[key as T] = (counts[key as T] ?? 0) / items.length;
  return result;
}

/**
 * Query the case database for cases similar to the query case.
 * Returns a MatchOutput with outcome distribution and action paths.
 * Returns confidence "insufficient" if fewer than MIN_MATCHES cases exceed the threshold.
 */
export function findMatches(
  query: Case,
  database: Case[],
  topK = 10,
): MatchOutput {
  const scored: CaseMatch[] = database
    .filter(c => c.id !== query.id)
    .map(c => ({
      case_id: c.id,
      score:   computeSimilarity(query, c),
      outcome: c.outcome,
      action:  c.action,
    }))
    .filter(m => m.score >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  const hasStrong = scored.some(m => m.score >= STRONG_MATCH);

  const outcomeDist = distribution(scored.map(m => m.outcome));

  // Build action paths: group by action, compute per-path outcome distribution
  const byAction = new Map<ActionType, CaseMatch[]>();
  for (const m of scored) {
    const existing = byAction.get(m.action) ?? [];
    existing.push(m);
    byAction.set(m.action, existing);
  }

  const actionPaths: ActionPath[] = Array.from(byAction.entries())
    .map(([action, cases]) => {
      const od = distribution(cases.map((c: CaseMatch) => c.outcome));
      return {
        action,
        frequency:            cases.length / (scored.length || 1),
        outcome_distribution: od,
        risk_level:           riskLevel(od),
      };
    })
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 3);

  return {
    query_id:             query.id,
    confidence:           confidence(scored.length, hasStrong),
    total_matches:        scored.length,
    matches:              scored,
    outcome_distribution: outcomeDist,
    action_paths:         actionPaths,
  };
}
