/**
 * M0-9C — Orientation Calibration Corpus
 *
 * Versioned, append-only set of labeled exchanges for behavioral validation.
 * See docs/essence/specs/m0-9c-behavioral-validation.md for authoring rules.
 *
 * ID convention: OD-NNN (sequential, permanent, never recycled).
 * Deprecated entries keep their ID and carry deprecated: true.
 *
 * Language: 'he' entries are the reference corpus.
 *           'en' entries are parity translations, linked via pairId.
 *
 * Current phase: Phase 1 — Golden Corpus (minimum viable baseline).
 *   OD-001 – OD-010  Hebrew reference entries (one Positive + one Negative per dimension)
 *   OD-011 – OD-020  English parity translations
 */

import type { OrientationDimensionKey } from '../../../orientation';

// ── Types ──────────────────────────────────────────────────────────────────────

export type CorpusCategory =
  | 'explicit'      // user states preference directly (measurement set — Positive)
  | 'implied'       // inferable without direct statement (measurement set — Positive)
  | 'negative'      // no preference signal present (measurement set — Negative)
  | 'adversarial'   // signal in assistantResponse only; must never yield output (measurement set)
  | 'ambiguous'     // genuinely uncertain (evaluation set only — not in FP/FN)
  | 'contradiction'; // user message self-contradicts (evaluation set only)

export type GoldLabel =
  | { kind: 'signal'; candidateValue: string; minWeight: number }
  | { kind: 'no_signal' }
  | { kind: 'eval_only' }; // ambiguous / contradiction: recorded but not scored

export interface CorpusEntry {
  id: string;
  dimension: OrientationDimensionKey;
  category: CorpusCategory;
  language: 'he' | 'en';
  pairId?: string;          // 'en' entry → ID of the 'he' source entry
  userMessage: string;
  assistantResponse: string; // disambiguation context only; never the evidence source
  goldLabel: GoldLabel;
  secondarySignals?: Array<{ candidateValue: string }>; // informational only, not scored
  deprecated?: true;
}

// ── Corpus version ─────────────────────────────────────────────────────────────

export const CORPUS_VERSION = '1.0.0';

// ── Phase 1 — Golden Corpus ────────────────────────────────────────────────────
//
// One explicit Positive + one Negative per dimension, Hebrew reference first.
// English parity translations follow (OD-011 – OD-020).

export const CORPUS: CorpusEntry[] = [

  // ── OrientationResponseDepth ────────────────────────────────────────────────

  {
    id:                'OD-001',
    dimension:         'OrientationResponseDepth',
    category:          'explicit',
    language:          'he',
    userMessage:       'תסביר לי בקצרה מה זה למידת מכונה.',
    assistantResponse: 'בשמחה.',
    goldLabel:         { kind: 'signal', candidateValue: 'brief', minWeight: 1.0 },
  },
  {
    id:                'OD-002',
    dimension:         'OrientationResponseDepth',
    category:          'negative',
    language:          'he',
    userMessage:       'מה זה למידת מכונה?',
    assistantResponse: 'זו טכנולוגיה מרתקת.',
    goldLabel:         { kind: 'no_signal' },
  },

  // ── OrientationCommunicationStyle ───────────────────────────────────────────

  {
    id:                'OD-003',
    dimension:         'OrientationCommunicationStyle',
    category:          'explicit',
    language:          'he',
    userMessage:       'אל תסביר רקע, רק תגיד לי מה לעשות.',
    assistantResponse: 'הבנתי.',
    goldLabel:         { kind: 'signal', candidateValue: 'direct', minWeight: 1.0 },
  },
  {
    id:                'OD-004',
    dimension:         'OrientationCommunicationStyle',
    category:          'negative',
    language:          'he',
    userMessage:       'איך עובד React?',
    assistantResponse: 'React היא ספריית JavaScript.',
    goldLabel:         { kind: 'no_signal' },
  },

  // ── OrientationTaskFraming ──────────────────────────────────────────────────

  {
    id:                'OD-005',
    dimension:         'OrientationTaskFraming',
    category:          'explicit',
    language:          'he',
    userMessage:       'מה עלי לעשות כדי לפתור את הבעיה הזו?',
    assistantResponse: 'נבדוק יחד.',
    goldLabel:         { kind: 'signal', candidateValue: 'action_first', minWeight: 1.0 },
  },
  {
    id:                'OD-006',
    dimension:         'OrientationTaskFraming',
    category:          'negative',
    language:          'he',
    userMessage:       'אני נתקל בבעיה ב-deployment.',
    assistantResponse: 'אשמח לעזור.',
    goldLabel:         { kind: 'no_signal' },
  },

  // ── OrientationDecisionStyle ────────────────────────────────────────────────

  {
    id:                'OD-007',
    dimension:         'OrientationDecisionStyle',
    category:          'explicit',
    language:          'he',
    userMessage:       'מה הכי עדיף לי לבחור?',
    assistantResponse: 'תלוי בכמה גורמים.',
    goldLabel:         { kind: 'signal', candidateValue: 'decisive', minWeight: 1.0 },
  },
  {
    id:                'OD-008',
    dimension:         'OrientationDecisionStyle',
    category:          'negative',
    language:          'he',
    userMessage:       'יש לי שתי אפשרויות לבחירה.',
    assistantResponse: 'שתיהן נשמעות סבירות.',
    goldLabel:         { kind: 'no_signal' },
  },

  // ── OrientationTaskCadence ──────────────────────────────────────────────────

  {
    id:                'OD-009',
    dimension:         'OrientationTaskCadence',
    category:          'explicit',
    language:          'he',
    userMessage:       'תסביר לי את זה שלב אחר שלב.',
    assistantResponse: 'בשמחה.',
    goldLabel:         { kind: 'signal', candidateValue: 'phased', minWeight: 1.0 },
  },
  {
    id:                'OD-010',
    dimension:         'OrientationTaskCadence',
    category:          'negative',
    language:          'he',
    userMessage:       'תעזור לי ללמוד את הנושא הזה.',
    assistantResponse: 'בשמחה.',
    goldLabel:         { kind: 'no_signal' },
  },

  // ── English parity subset (Phase 1) ────────────────────────────────────────
  //
  // Faithful translations of OD-001 – OD-010.
  // Same dimension, category, and goldLabel as the Hebrew source.
  // Divergence in provider output between a pair → language-sensitivity, not regression.

  {
    id:                'OD-011',
    dimension:         'OrientationResponseDepth',
    category:          'explicit',
    language:          'en',
    pairId:            'OD-001',
    userMessage:       'Explain briefly what machine learning is.',
    assistantResponse: 'Sure.',
    goldLabel:         { kind: 'signal', candidateValue: 'brief', minWeight: 1.0 },
  },
  {
    id:                'OD-012',
    dimension:         'OrientationResponseDepth',
    category:          'negative',
    language:          'en',
    pairId:            'OD-002',
    userMessage:       'What is machine learning?',
    assistantResponse: 'It\'s a fascinating technology.',
    goldLabel:         { kind: 'no_signal' },
  },
  {
    id:                'OD-013',
    dimension:         'OrientationCommunicationStyle',
    category:          'explicit',
    language:          'en',
    pairId:            'OD-003',
    userMessage:       'Don\'t explain the background, just tell me what to do.',
    assistantResponse: 'Understood.',
    goldLabel:         { kind: 'signal', candidateValue: 'direct', minWeight: 1.0 },
  },
  {
    id:                'OD-014',
    dimension:         'OrientationCommunicationStyle',
    category:          'negative',
    language:          'en',
    pairId:            'OD-004',
    userMessage:       'How does React work?',
    assistantResponse: 'React is a JavaScript library.',
    goldLabel:         { kind: 'no_signal' },
  },
  {
    id:                'OD-015',
    dimension:         'OrientationTaskFraming',
    category:          'explicit',
    language:          'en',
    pairId:            'OD-005',
    userMessage:       'What should I do to solve this problem?',
    assistantResponse: 'Let\'s look at it together.',
    goldLabel:         { kind: 'signal', candidateValue: 'action_first', minWeight: 1.0 },
  },
  {
    id:                'OD-016',
    dimension:         'OrientationTaskFraming',
    category:          'negative',
    language:          'en',
    pairId:            'OD-006',
    userMessage:       'I\'m running into an issue with the deployment.',
    assistantResponse: 'Happy to help.',
    goldLabel:         { kind: 'no_signal' },
  },
  {
    id:                'OD-017',
    dimension:         'OrientationDecisionStyle',
    category:          'explicit',
    language:          'en',
    pairId:            'OD-007',
    userMessage:       'What\'s the best option for me to choose?',
    assistantResponse: 'It depends on a few factors.',
    goldLabel:         { kind: 'signal', candidateValue: 'decisive', minWeight: 1.0 },
  },
  {
    id:                'OD-018',
    dimension:         'OrientationDecisionStyle',
    category:          'negative',
    language:          'en',
    pairId:            'OD-008',
    userMessage:       'I have two options to choose from.',
    assistantResponse: 'Both sound reasonable.',
    goldLabel:         { kind: 'no_signal' },
  },
  {
    id:                'OD-019',
    dimension:         'OrientationTaskCadence',
    category:          'explicit',
    language:          'en',
    pairId:            'OD-009',
    userMessage:       'Walk me through this step by step.',
    assistantResponse: 'Sure.',
    goldLabel:         { kind: 'signal', candidateValue: 'phased', minWeight: 1.0 },
  },
  {
    id:                'OD-020',
    dimension:         'OrientationTaskCadence',
    category:          'negative',
    language:          'en',
    pairId:            'OD-010',
    userMessage:       'Help me learn this topic.',
    assistantResponse: 'Sure.',
    goldLabel:         { kind: 'no_signal' },
  },
];

// ── Derived views ──────────────────────────────────────────────────────────────

export const MEASUREMENT_CORPUS = CORPUS.filter(
  e => !e.deprecated && e.category !== 'ambiguous' && e.category !== 'contradiction',
);

export const EVALUATION_CORPUS = CORPUS.filter(
  e => !e.deprecated && (e.category === 'ambiguous' || e.category === 'contradiction'),
);

export const HEBREW_CORPUS = CORPUS.filter(e => !e.deprecated && e.language === 'he');
export const ENGLISH_PARITY = CORPUS.filter(e => !e.deprecated && e.language === 'en');
