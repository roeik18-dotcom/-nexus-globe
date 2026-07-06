/**
 * Situation → Case classifier and analysis pipeline (Schema v0)
 *
 * Full flow:
 *   raw text
 *   → classifySituationToCase()  — LLM structured extraction, schema validation
 *   → analyzeHumanSituation()    — findMatches + outcome distribution + action paths + explanation
 *
 * Usage:
 *   import { analyzeHumanSituation } from '@/app/lib/classifySituationToCase';
 *   const result = await analyzeHumanSituation(text, SEED_CASES_V0);
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  validateCase,
  findMatches,
  type Case,
  type GapType,
  type PressureType,
  type ActionType,
  type OutcomeClass,
  type ValueID,
  type ParticipantType,
  type MatchOutput,
} from './caseSchema';

const client = new Anthropic();

let _idSeq = 0;
function generateCaseId(): string {
  return `live-${Date.now()}-${++_idSeq}`;
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `\
You are a psychological and social situation analyst. Classify a human situation \
into Case Schema v0 fields for pattern-based outcome prediction.

## gap_type — the deepest structural tension (pick exactly one)
  value      : what I believe vs. what is demanded of me
  relational : connection sought vs. disconnection experienced
  resource   : what is needed vs. what is available
  identity   : who I am vs. who I am expected to be
  power      : self-determination vs. external control
  epistemic  : what I know vs. what I am permitted or able to know

## pressure — forces acting on the person (list all that apply)
  social    : group expectations, shame, reputation
  emotional : internal affect — fear, grief, anger, guilt
  economic  : financial or material scarcity
  physical  : bodily safety or health threat
  legal     : institutional, regulatory, juridical
  moral     : ethical demands, value violation

## action — what the person has already done (pick the most accurate)
  approach  : moved toward the source of tension
  avoid     : withdrew or has not yet addressed the situation
  transform : attempted to change the frame or relationship
  surrender : accepted the gap without addressing it
  mobilize  : sought external support or resources
  none      : no action taken

## outcome — current state of the situation
  resolved    : gap closed
  partial     : gap reduced, tension remains
  unresolved  : gap unchanged
  escalated   : situation worsened
  transformed : situation fundamentally restructured

## values — what is genuinely at stake (1–4 most relevant)
  truth     : accurate representation of reality
  justice   : fair treatment and accountability
  safety    : freedom from harm
  dignity   : being treated as fully human
  autonomy  : self-determination and agency
  belonging : connection and acceptance
  loyalty   : commitment and trust
  growth    : development, learning, change

## participants — who is involved
  self, partner, family, friend, colleague, employer, institution, society

## Classification rules
1. Identify the PRIMARY gap_type — the deepest structural tension, not every surface conflict.
2. List ALL pressures present; under-listing is more costly than over-listing.
3. For action: what the person has ALREADY done, not what they wish to do.
4. For outcome: the current state as described. If unchanged and the person has not acted → unresolved.
   If unchanged and things are getting worse → escalated.
5. For values: only values that are genuinely threatened or in tension, not peripheral ones.
6. intensity 0.0–1.0: estimate severity from the language used (fear, urgency, described stakes).
7. gap_description format: "[what person needs/believes] vs. [what the situation imposes]".`;

// ── Tool definition ───────────────────────────────────────────────────────────

const CLASSIFY_TOOL: Anthropic.Tool = {
  name: 'classify_situation',
  description: 'Classify the situation into Case Schema v0 fields.',
  input_schema: {
    type: 'object' as const,
    properties: {
      gap_type: {
        type: 'string',
        enum: ['value', 'relational', 'resource', 'identity', 'power', 'epistemic'],
        description: 'Primary gap driving the tension.',
      },
      pressure: {
        type: 'array',
        items: { type: 'string', enum: ['social', 'emotional', 'economic', 'physical', 'legal', 'moral'] },
        minItems: 1,
        description: 'All pressure types present.',
      },
      action: {
        type: 'string',
        enum: ['approach', 'avoid', 'transform', 'surrender', 'mobilize', 'none'],
        description: 'What the person has already done.',
      },
      outcome: {
        type: 'string',
        enum: ['resolved', 'partial', 'unresolved', 'escalated', 'transformed'],
        description: 'Current state of the situation.',
      },
      values: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['truth', 'justice', 'safety', 'dignity', 'autonomy', 'belonging', 'loyalty', 'growth'],
        },
        minItems: 1,
        description: '1–4 values genuinely at stake.',
      },
      participants: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['self', 'partner', 'family', 'friend', 'colleague', 'employer', 'institution', 'society'],
        },
        description: 'All participants involved.',
      },
      gap_description: {
        type: 'string',
        description: '"[what person needs] vs. [what situation imposes]" — one sentence.',
      },
      intensity: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Situation severity 0.0–1.0.',
      },
    },
    required: ['gap_type', 'pressure', 'action', 'outcome', 'values'],
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface RawClassification {
  gap_type:         GapType;
  pressure:         PressureType[];
  action:           ActionType;
  outcome:          OutcomeClass;
  values:           ValueID[];
  participants?:    ParticipantType[];
  gap_description?: string;
  intensity?:       number;
}

export interface AnalysisOutput {
  case:        Case;
  matches:     MatchOutput;
  explanation: string;
}

// ── Errors ────────────────────────────────────────────────────────────────────

export class ClassificationError extends Error {
  constructor(
    message: string,
    public readonly validationErrors?: string[],
  ) {
    super(message);
    this.name = 'ClassificationError';
  }
}

// ── Explanation builder ───────────────────────────────────────────────────────

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function outcomeVerb(o: OutcomeClass): string {
  const verbs: Record<OutcomeClass, string> = {
    resolved:    'resolved',
    partial:     'partially improved',
    unresolved:  'stayed unresolved',
    escalated:   'escalated',
    transformed: 'transformed',
  };
  return verbs[o];
}

function riskAdj(r: 'low' | 'medium' | 'high'): string {
  return { low: 'low', medium: 'moderate', high: 'elevated' }[r];
}

function buildExplanation(c: Case, m: MatchOutput): string {
  const gap = c.gap_description
    ? `a ${c.gap_type} gap — ${c.gap_description}`
    : `a ${c.gap_type} gap`;

  if (m.confidence === 'insufficient') {
    return (
      `Your situation shows ${gap}. ` +
      `The database does not yet have enough similar cases to project an outcome reliably. ` +
      `As more cases are added, this analysis will improve.`
    );
  }

  const n = m.total_matches;

  const sortedOutcomes = (Object.entries(m.outcome_distribution) as [OutcomeClass, number][])
    .sort(([, a], [, b]) => b - a);

  const outcomeSummary = sortedOutcomes
    .slice(0, 2)
    .map(([o, f]) => `${pct(f)} ${outcomeVerb(o)}`)
    .join(', ');

  const topPath = m.action_paths[0];

  const safestPath = [...m.action_paths].sort((a, b) => {
    const rank = { low: 0, medium: 1, high: 2 } as const;
    return rank[a.risk_level] - rank[b.risk_level];
  })[0];

  const pathLine = topPath
    ? `The most common response in similar cases was to **${topPath.action}** (${pct(topPath.frequency)}), ` +
      `with ${riskAdj(topPath.risk_level)} escalation risk.`
    : '';

  const safeLine =
    safestPath && safestPath.action !== topPath?.action
      ? ` Cases where people chose to **${safestPath.action}** showed lower escalation risk.`
      : '';

  return (
    `Your situation shows ${gap}. ` +
    `Across ${n} similar case${n === 1 ? '' : 's'}, ${outcomeSummary}. ` +
    pathLine +
    safeLine
  );
}

// ── Core classifier ───────────────────────────────────────────────────────────

/**
 * Convert raw situation text into a validated Case (Schema v0).
 * Throws ClassificationError if the model output fails schema validation.
 */
export async function classifySituationToCase(situationText: string): Promise<Case> {
  if (!situationText.trim()) {
    throw new ClassificationError('situationText must not be empty');
  }

  const response = await client.messages.create({
    model:       'claude-opus-4-8',
    max_tokens:  4096,
    thinking:    { type: 'adaptive' },
    system:      SYSTEM_PROMPT,
    tools:       [CLASSIFY_TOOL],
    tool_choice: { type: 'tool', name: 'classify_situation' },
    messages: [
      { role: 'user', content: `Classify this situation:\n\n${situationText}` },
    ],
  });

  const toolBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
  );

  if (!toolBlock) {
    throw new ClassificationError('Model did not call classify_situation');
  }

  const raw = toolBlock.input as RawClassification;

  const classified: Case = {
    id:             generateCaseId(),
    situation_text: situationText,
    gap_type:       raw.gap_type,
    pressure:       raw.pressure,
    action:         raw.action,
    outcome:        raw.outcome,
    values:         raw.values,
    ...(raw.participants?.length    && { participants:    raw.participants }),
    ...(raw.gap_description         && { gap_description: raw.gap_description }),
    ...(raw.intensity !== undefined && { intensity:       raw.intensity }),
  };

  const validation = validateCase(classified);
  if (!validation.valid) {
    throw new ClassificationError(
      `Classification produced an invalid Case: ${validation.errors.join('; ')}`,
      validation.errors,
    );
  }

  return classified;
}

// ── Full pipeline ─────────────────────────────────────────────────────────────

/**
 * Full analysis pipeline: text → Case → findMatches → explanation.
 * Pass your case database as the second argument.
 */
export async function analyzeHumanSituation(
  situationText: string,
  database: Case[],
): Promise<AnalysisOutput> {
  const classified  = await classifySituationToCase(situationText);
  const matches     = findMatches(classified, database);
  const explanation = buildExplanation(classified, matches);
  return { case: classified, matches, explanation };
}
