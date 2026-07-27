/**
 * M0-9C — Orientation Calibration Corpus
 *
 * Versioned, append-only set of labeled exchanges for behavioral validation.
 * See docs/essence/specs/m0-9c-behavioral-validation.md for authoring rules.
 *
 * ID convention : OD-NNN — sequential, permanent, never recycled.
 *                 Deprecated entries keep their ID and carry deprecated: true.
 * Language      : 'he' entries are the reference corpus.
 *                 'en' entries are parity translations, linked via pairId.
 * set field     : explicit source of truth for FP/FN gating.
 *                 'measurement' — participates in TP/FP/FN computation and CI.
 *                 'evaluation'  — recorded for drift tracking; never fails a run.
 *
 * forbiddenSignals policy (§2.3 of the spec):
 *   explicit (positive)  → [] unless a specific value must be suppressed
 *   negative             → allValues(dimension) — any emission is a false positive
 *   adversarial          → values the model may wrongly infer from assistantResponse
 *   ambiguous/eval_only  → case by case
 *
 * Current phase: Phase 1 — Golden Corpus (minimum viable baseline).
 *   OD-001 – OD-010  Hebrew reference (one Positive + one Negative per dimension)
 *   OD-011 – OD-020  English parity translations (pairId → Hebrew source)
 */

import type { OrientationDimensionKey } from '../../../orientation';
import { ORIENTATION_SCHEMA } from '../../../orientation';

// ── Types ──────────────────────────────────────────────────────────────────────

export type CorpusCategory =
  | 'explicit'       // user states preference directly           (measurement)
  | 'implied'        // preference inferable, no direct statement (measurement)
  | 'negative'       // no preference signal present             (measurement)
  | 'adversarial'    // signal in assistantResponse only         (measurement)
  | 'ambiguous'      // genuinely uncertain                      (evaluation only)
  | 'contradiction'; // user message self-contradicts            (evaluation only)

export interface ExpectedSignal {
  candidateValue: string;
  minWeight: number; // 1.0 = explicit | 0.7 = implied | 0.5 = inferred
}

export interface Exchange {
  userMessage: string;
  assistantResponse: string; // disambiguation context only — never an evidence source
}

export interface CorpusEntry {
  entryId: string;                      // OD-NNN — permanent, never recycled
  corpusVersion: string;                // corpus version when this entry was added
  dimension: OrientationDimensionKey;
  category: CorpusCategory;
  set: 'measurement' | 'evaluation';   // explicit; source of truth for FP/FN gating
  language: 'he' | 'en';
  pairId?: string;                      // 'en' entry → entryId of its 'he' source
  exchange: Exchange;
  expectedSignals: ExpectedSignal[];    // [] for negative / adversarial / eval entries
  forbiddenSignals: string[];           // candidateValues that must NOT appear in output
  secondarySignals?: Array<{ candidateValue: string }>; // informational only; not scored
  deprecated?: true;
}

// ── Version ────────────────────────────────────────────────────────────────────

export const CORPUS_VERSION = '1.0.0';

// ── Helpers ────────────────────────────────────────────────────────────────────

// Returns all candidateValues for a dimension. Used to populate forbiddenSignals
// on negative entries: any signal emission on a negative entry is a false positive.
function allValues(dim: OrientationDimensionKey): string[] {
  return [...ORIENTATION_SCHEMA[dim]];
}

// ── Corpus ─────────────────────────────────────────────────────────────────────
//
// Entries are append-only. Never delete or renumber an existing entry.
// To supersede, add a new entry and set deprecated: true on the old one.

export const CORPUS: CorpusEntry[] = [

  // ── OrientationResponseDepth ────────────────────────────────────────────────
  // values: brief | balanced | explanatory

  {
    entryId:          'OD-001',
    corpusVersion:    '1.0.0',
    dimension:        'OrientationResponseDepth',
    category:         'explicit',
    set:              'measurement',
    language:         'he',
    exchange: {
      userMessage:        'תסביר לי בקצרה מה זה למידת מכונה.',
      assistantResponse:  'בשמחה.',
    },
    expectedSignals:  [{ candidateValue: 'brief', minWeight: 1.0 }],
    forbiddenSignals: [],
  },
  {
    entryId:          'OD-002',
    corpusVersion:    '1.0.0',
    dimension:        'OrientationResponseDepth',
    category:         'negative',
    set:              'measurement',
    language:         'he',
    exchange: {
      userMessage:        'מה זה למידת מכונה?',
      assistantResponse:  'זו טכנולוגיה מרתקת.',
    },
    expectedSignals:  [],
    forbiddenSignals: allValues('OrientationResponseDepth'),
  },

  // ── OrientationCommunicationStyle ───────────────────────────────────────────
  // values: direct | exploratory | collaborative

  {
    entryId:          'OD-003',
    corpusVersion:    '1.0.0',
    dimension:        'OrientationCommunicationStyle',
    category:         'explicit',
    set:              'measurement',
    language:         'he',
    exchange: {
      userMessage:        'אל תסביר רקע, רק תגיד לי מה לעשות.',
      assistantResponse:  'הבנתי.',
    },
    expectedSignals:  [{ candidateValue: 'direct', minWeight: 1.0 }],
    forbiddenSignals: [],
  },
  {
    entryId:          'OD-004',
    corpusVersion:    '1.0.0',
    dimension:        'OrientationCommunicationStyle',
    category:         'negative',
    set:              'measurement',
    language:         'he',
    exchange: {
      userMessage:        'איך עובד React?',
      assistantResponse:  'React היא ספריית JavaScript.',
    },
    expectedSignals:  [],
    forbiddenSignals: allValues('OrientationCommunicationStyle'),
  },

  // ── OrientationTaskFraming ──────────────────────────────────────────────────
  // values: action_first | context_first | options_first

  {
    entryId:          'OD-005',
    corpusVersion:    '1.0.0',
    dimension:        'OrientationTaskFraming',
    category:         'explicit',
    set:              'measurement',
    language:         'he',
    exchange: {
      userMessage:        'מה עלי לעשות כדי לפתור את הבעיה הזו?',
      assistantResponse:  'נבדוק יחד.',
    },
    expectedSignals:  [{ candidateValue: 'action_first', minWeight: 1.0 }],
    forbiddenSignals: [],
  },
  {
    entryId:          'OD-006',
    corpusVersion:    '1.0.0',
    dimension:        'OrientationTaskFraming',
    category:         'negative',
    set:              'measurement',
    language:         'he',
    exchange: {
      userMessage:        'אני נתקל בבעיה ב-deployment.',
      assistantResponse:  'אשמח לעזור.',
    },
    expectedSignals:  [],
    forbiddenSignals: allValues('OrientationTaskFraming'),
  },

  // ── OrientationDecisionStyle ────────────────────────────────────────────────
  // values: decisive | comparative | deliberative

  {
    entryId:          'OD-007',
    corpusVersion:    '1.0.0',
    dimension:        'OrientationDecisionStyle',
    category:         'explicit',
    set:              'measurement',
    language:         'he',
    exchange: {
      userMessage:        'מה הכי עדיף לי לבחור?',
      assistantResponse:  'תלוי בכמה גורמים.',
    },
    expectedSignals:  [{ candidateValue: 'decisive', minWeight: 1.0 }],
    forbiddenSignals: [],
  },
  {
    entryId:          'OD-008',
    corpusVersion:    '1.0.0',
    dimension:        'OrientationDecisionStyle',
    category:         'negative',
    set:              'measurement',
    language:         'he',
    exchange: {
      userMessage:        'יש לי שתי אפשרויות לבחירה.',
      assistantResponse:  'שתיהן נשמעות סבירות.',
    },
    expectedSignals:  [],
    forbiddenSignals: allValues('OrientationDecisionStyle'),
  },

  // ── OrientationTaskCadence ──────────────────────────────────────────────────
  // values: single_step | phased | continuous

  {
    entryId:          'OD-009',
    corpusVersion:    '1.0.0',
    dimension:        'OrientationTaskCadence',
    category:         'explicit',
    set:              'measurement',
    language:         'he',
    exchange: {
      userMessage:        'תסביר לי את זה שלב אחר שלב.',
      assistantResponse:  'בשמחה.',
    },
    expectedSignals:  [{ candidateValue: 'phased', minWeight: 1.0 }],
    forbiddenSignals: [],
  },
  {
    entryId:          'OD-010',
    corpusVersion:    '1.0.0',
    dimension:        'OrientationTaskCadence',
    category:         'negative',
    set:              'measurement',
    language:         'he',
    exchange: {
      userMessage:        'תעזור לי ללמוד את הנושא הזה.',
      assistantResponse:  'בשמחה.',
    },
    expectedSignals:  [],
    forbiddenSignals: allValues('OrientationTaskCadence'),
  },

  // ── English parity subset — Phase 1 ────────────────────────────────────────
  //
  // Faithful translations of OD-001 – OD-010. Same dimension, category, set,
  // and expectedSignals / forbiddenSignals as the Hebrew source.
  // pairId links each entry to its Hebrew counterpart.
  //
  // Purpose: behavioral invariant verification across languages, not
  // linguistic accuracy measurement. A divergence between a Hebrew entry
  // and its English pair indicates language-sensitivity, not regression.

  {
    entryId:          'OD-011',
    corpusVersion:    '1.0.0',
    dimension:        'OrientationResponseDepth',
    category:         'explicit',
    set:              'measurement',
    language:         'en',
    pairId:           'OD-001',
    exchange: {
      userMessage:        'Explain briefly what machine learning is.',
      assistantResponse:  'Sure.',
    },
    expectedSignals:  [{ candidateValue: 'brief', minWeight: 1.0 }],
    forbiddenSignals: [],
  },
  {
    entryId:          'OD-012',
    corpusVersion:    '1.0.0',
    dimension:        'OrientationResponseDepth',
    category:         'negative',
    set:              'measurement',
    language:         'en',
    pairId:           'OD-002',
    exchange: {
      userMessage:        'What is machine learning?',
      assistantResponse:  "It's a fascinating technology.",
    },
    expectedSignals:  [],
    forbiddenSignals: allValues('OrientationResponseDepth'),
  },
  {
    entryId:          'OD-013',
    corpusVersion:    '1.0.0',
    dimension:        'OrientationCommunicationStyle',
    category:         'explicit',
    set:              'measurement',
    language:         'en',
    pairId:           'OD-003',
    exchange: {
      userMessage:        "Don't explain the background, just tell me what to do.",
      assistantResponse:  'Understood.',
    },
    expectedSignals:  [{ candidateValue: 'direct', minWeight: 1.0 }],
    forbiddenSignals: [],
  },
  {
    entryId:          'OD-014',
    corpusVersion:    '1.0.0',
    dimension:        'OrientationCommunicationStyle',
    category:         'negative',
    set:              'measurement',
    language:         'en',
    pairId:           'OD-004',
    exchange: {
      userMessage:        'How does React work?',
      assistantResponse:  'React is a JavaScript library.',
    },
    expectedSignals:  [],
    forbiddenSignals: allValues('OrientationCommunicationStyle'),
  },
  {
    entryId:          'OD-015',
    corpusVersion:    '1.0.0',
    dimension:        'OrientationTaskFraming',
    category:         'explicit',
    set:              'measurement',
    language:         'en',
    pairId:           'OD-005',
    exchange: {
      userMessage:        'What should I do to solve this problem?',
      assistantResponse:  "Let's look at it together.",
    },
    expectedSignals:  [{ candidateValue: 'action_first', minWeight: 1.0 }],
    forbiddenSignals: [],
  },
  {
    entryId:          'OD-016',
    corpusVersion:    '1.0.0',
    dimension:        'OrientationTaskFraming',
    category:         'negative',
    set:              'measurement',
    language:         'en',
    pairId:           'OD-006',
    exchange: {
      userMessage:        "I'm running into an issue with the deployment.",
      assistantResponse:  'Happy to help.',
    },
    expectedSignals:  [],
    forbiddenSignals: allValues('OrientationTaskFraming'),
  },
  {
    entryId:          'OD-017',
    corpusVersion:    '1.0.0',
    dimension:        'OrientationDecisionStyle',
    category:         'explicit',
    set:              'measurement',
    language:         'en',
    pairId:           'OD-007',
    exchange: {
      userMessage:        "What's the best option for me to choose?",
      assistantResponse:  'It depends on a few factors.',
    },
    expectedSignals:  [{ candidateValue: 'decisive', minWeight: 1.0 }],
    forbiddenSignals: [],
  },
  {
    entryId:          'OD-018',
    corpusVersion:    '1.0.0',
    dimension:        'OrientationDecisionStyle',
    category:         'negative',
    set:              'measurement',
    language:         'en',
    pairId:           'OD-008',
    exchange: {
      userMessage:        'I have two options to choose from.',
      assistantResponse:  'Both sound reasonable.',
    },
    expectedSignals:  [],
    forbiddenSignals: allValues('OrientationDecisionStyle'),
  },
  {
    entryId:          'OD-019',
    corpusVersion:    '1.0.0',
    dimension:        'OrientationTaskCadence',
    category:         'explicit',
    set:              'measurement',
    language:         'en',
    pairId:           'OD-009',
    exchange: {
      userMessage:        'Walk me through this step by step.',
      assistantResponse:  'Sure.',
    },
    expectedSignals:  [{ candidateValue: 'phased', minWeight: 1.0 }],
    forbiddenSignals: [],
  },
  {
    entryId:          'OD-020',
    corpusVersion:    '1.0.0',
    dimension:        'OrientationTaskCadence',
    category:         'negative',
    set:              'measurement',
    language:         'en',
    pairId:           'OD-010',
    exchange: {
      userMessage:        'Help me learn this topic.',
      assistantResponse:  'Sure.',
    },
    expectedSignals:  [],
    forbiddenSignals: allValues('OrientationTaskCadence'),
  },
];

// ── Derived views ──────────────────────────────────────────────────────────────
//
// `set` is the source of truth. These views filter on it directly.

export const MEASUREMENT_CORPUS = CORPUS.filter(e => !e.deprecated && e.set === 'measurement');
export const EVALUATION_CORPUS  = CORPUS.filter(e => !e.deprecated && e.set === 'evaluation');
export const HEBREW_CORPUS      = CORPUS.filter(e => !e.deprecated && e.language === 'he');
export const ENGLISH_PARITY     = CORPUS.filter(e => !e.deprecated && e.language === 'en');
