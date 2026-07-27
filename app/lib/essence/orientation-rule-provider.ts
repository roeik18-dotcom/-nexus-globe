/**
 * Essence · Rule-Based Orientation Provider (M0-8B)
 *
 * Deterministic OrientationInferenceProvider. Scans the user message for
 * explicit preference phrases and emits one OrientationSignal per matching
 * (dimensionKey, candidateValue) pair per exchange.
 *
 * Design constraints (M0-8B):
 *   - User message only — assistantResponse is Merlin's output, not a preference signal.
 *   - Competing candidates within a dimension are allowed (e.g. 'brief' and 'explanatory'
 *     can both match). The Accumulator owns candidate ranking; the Provider does not filter.
 *   - At most one signal per (dimensionKey, candidateValue) per call: deduplication
 *     key is JSON.stringify([dimensionKey, candidateValue]).
 *   - One clock tick per extractSignals() call: all signals share one inferredAt timestamp.
 *   - Uniform signalWeight = 1.0 for all rules.
 *   - No LLM, no external I/O, no state between calls.
 *
 * Phrase-boundary policy:
 *   Patterns use \b anchors and explicit multi-word phrases, not bare token stems,
 *   to avoid substring false positives (e.g. 'briefly' matches; 'short' alone does not).
 */

import type { AgentName } from './access';
import type { Clock } from './pipeline-runner';
import { systemClock } from './pipeline-runner';
import type {
  OrientationInferenceInput,
  OrientationInferenceProvider,
  OrientationSignal,
} from './orientation-inference';
import type { OrientationDimensionKey } from './orientation';
import type { EssenceProfile } from './schema';

// ── Rule Definition ────────────────────────────────────────────────────────────

interface Rule {
  readonly dimensionKey:   OrientationDimensionKey;
  readonly candidateValue: string;
  readonly pattern:        RegExp;
}

/** Uniform weight for all M0-8B rules. */
const RULE_SIGNAL_WEIGHT = 1.0;

/**
 * Ordered rule list. Order affects only which entry is iterated first within
 * the same (dimensionKey, candidateValue); the dedup set ensures each pair is
 * emitted at most once regardless of order.
 *
 * Competing candidates within a dimension (e.g. 'brief' and 'explanatory')
 * are intentionally allowed — both will be emitted if both patterns match.
 * The Accumulator tracks them as separate candidates and selects the winner
 * by accumulated weight.
 *
 * Hebrew pattern note: JavaScript \b anchors are ASCII-only (\w = [A-Za-z0-9_]).
 * Hebrew characters are \W, so a space→Hebrew boundary has no \b. Hebrew phrases
 * are therefore listed before the \b-wrapped English alternatives and matched as
 * plain substrings. They are specific enough (multi-char, semantically narrow) to
 * avoid false positives without explicit word-boundary guards.
 */
const RULES: readonly Rule[] = [

  // ── OrientationResponseDepth ─────────────────────────────────────────────────
  {
    dimensionKey:   'OrientationResponseDepth',
    candidateValue: 'brief',
    // 'short' alone is excluded — too broad (short-term, short circuit, shortly after).
    // 'brief' (adjective) is included — narrow enough, unlike 'short'.
    pattern: /בקצרה|\b(?:briefly|concisely?|brief|keep it short|short answer|tl;?dr)\b/i,
  },
  {
    dimensionKey:   'OrientationResponseDepth',
    candidateValue: 'explanatory',
    pattern: /בפירוט|\b(?:in detail|elaborat(?:e|ion)|explain (?:thoroughly|fully|in depth)|walk me through|comprehensive(?:ly)?|detailed? explanation)\b/i,
  },

  // ── OrientationCommunicationStyle ────────────────────────────────────────────
  {
    dimensionKey:   'OrientationCommunicationStyle',
    candidateValue: 'direct',
    pattern: /ישירות|רק את התשובה|\b(?:straight to the point|no fluff|just (?:give|tell) me(?: the answer)?|cut to the chase)\b/i,
  },
  {
    dimensionKey:   'OrientationCommunicationStyle',
    candidateValue: 'exploratory',
    // 'what are my options' is not here — that maps to options_first framing, not exploratory style.
    pattern: /נחקור|\b(?:let(?:'?s| us) explore|think (?:it )?through|think out loud)\b/i,
  },

  // ── OrientationTaskFraming ───────────────────────────────────────────────────
  {
    dimensionKey:   'OrientationTaskFraming',
    candidateValue: 'action_first',
    pattern: /מה לעשות|\b(?:what should I do|just (?:tell|show) me (?:the )?steps?|give me (?:the )?steps?)\b/i,
  },
  {
    dimensionKey:   'OrientationTaskFraming',
    candidateValue: 'context_first',
    // 'why does' alone excluded — too broad. Require fuller phrase patterns.
    pattern: /הסבר לי|\b(?:explain why|help me understand|what(?:'?s| is) the (?:reason|context|background)|how does (?:this|it) work)\b/i,
  },
  {
    dimensionKey:   'OrientationTaskFraming',
    candidateValue: 'options_first',
    pattern: /\b(?:what are my options|what (?:can|could) I do|give me (?:a few|some) options?|show me alternatives?|what(?:'re| are)(?: the)? alternatives?)\b/i,
  },

  // ── OrientationDecisionStyle ─────────────────────────────────────────────────
  {
    dimensionKey:   'OrientationDecisionStyle',
    candidateValue: 'decisive',
    pattern: /מה הכי עדיף|מה הכי כדאי|\b(?:just (?:decide|pick|choose)|what(?:'?s| is) (?:the )?best option|recommend (?:one|a single option)|which (?:one )?(?:would you|do you) (?:choose|recommend|pick))\b/i,
  },
  {
    dimensionKey:   'OrientationDecisionStyle',
    candidateValue: 'comparative',
    pattern: /\b(?:pros? and cons?|compare (?:the )?options?|which is better|trade.?offs?)\b/i,
  },

  // ── OrientationTaskCadence ───────────────────────────────────────────────────
  {
    dimensionKey:   'OrientationTaskCadence',
    candidateValue: 'phased',
    pattern: /שלב אחר שלב|\b(?:step by step|break it down|in phases?|one step at a time|gradually)\b/i,
  },
  {
    dimensionKey:   'OrientationTaskCadence',
    candidateValue: 'single_step',
    // 'one thing' alone excluded — too broad. Require explicit directive phrasing.
    pattern: /\b(?:just do (?:it|this|that)|do (?:this|that) (?:one )?thing|one (?:quick )?thing only)\b/i,
  },
];

// ── Provider ───────────────────────────────────────────────────────────────────

export class RuleBasedOrientationProvider implements OrientationInferenceProvider {
  constructor(
    private readonly agentName: AgentName,
    private readonly clock: Clock = systemClock,
  ) {}

  async extractSignals(
    input: OrientationInferenceInput,
    _profile: Readonly<EssenceProfile>,
  ): Promise<OrientationSignal[]> {
    const text = input.exchange.userMessage;

    // One timestamp for all signals in this extraction call.
    const inferredAt = new Date(this.clock.now()).toISOString();

    const emitted = new Set<string>();
    const signals: OrientationSignal[] = [];

    for (const rule of RULES) {
      const dedupKey = JSON.stringify([rule.dimensionKey, rule.candidateValue]);
      if (emitted.has(dedupKey)) continue;
      if (!rule.pattern.test(text)) continue;

      emitted.add(dedupKey);
      signals.push({
        dimensionKey:        rule.dimensionKey,
        candidateValue:      rule.candidateValue,
        sourceObservationId: input.sourceObservationId,
        signalWeight:        RULE_SIGNAL_WEIGHT,
        inferredBy:          `${this.agentName}/rule-based@1`,
        sessionId:           input.sessionId,
        inferredAt,
      });
    }

    return signals;
  }
}
