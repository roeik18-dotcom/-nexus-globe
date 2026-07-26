/**
 * Essence · LLM-Based Orientation Provider (M0-9B)
 *
 * Implements OrientationInferenceProvider using Claude (tool use) for structured
 * orientation signal extraction from voice exchanges.
 *
 * Evidence provenance invariant:
 *   The assistant response is provided as disambiguation context only.
 *   Signals must be grounded in the user's own statements — never in the assistant's.
 *
 * Weight regime [0.5, 1.0]:
 *   1.0 — explicit direct statement  ("Give me a brief answer")
 *   0.7 — clear indirect implication  ("I'm in a hurry" → single_step)
 *   0.5 — reasonable inference requiring interpretation
 *   The full OrientationSignal contract is (0, 1]; any LLM output outside that
 *   range is rejected during validation.
 *
 * Failure model:
 *   Infrastructure failures (API errors, timeouts, network) and protocol failures
 *   (no tool_use block, malformed tool input) are propagated as thrown errors so
 *   the caller (CompositeOrientationProvider) can distinguish them from a valid
 *   empty inference result.
 *   validate() returns [] only when the LLM genuinely found no valid signals.
 *
 * Content logging policy:
 *   Reasoning produced by the model may contain user-derived content and must
 *   never be logged, persisted, or returned — in any mode.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { AgentName } from './access';
import type { Clock } from './pipeline-runner';
import { systemClock } from './pipeline-runner';
import type {
  OrientationInferenceInput,
  OrientationInferenceProvider,
  OrientationSignal,
} from './orientation-inference';
import type { OrientationDimensionKey } from './orientation';
import { ORIENTATION_SCHEMA, isOrientationNode, isValidOrientationValue } from './orientation';
import type { EssenceProfile } from './schema';

// ── Constants ──────────────────────────────────────────────────────────────────

/**
 * Haiku is the default: orientation inference runs on every voice exchange in a
 * fire-and-forget pipeline; cost and latency matter more than raw capability here.
 * Override via the constructor's `model` parameter when needed.
 */
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 512;
const TOOL_NAME = 'extract_orientation_signals';

// ── Prompt (built once at module load) ────────────────────────────────────────

const SYSTEM_PROMPT: string = (() => {
  const schemaLines = (Object.entries(ORIENTATION_SCHEMA) as [string, readonly string[]][])
    .map(([key, values]) => `  ${key}: [${values.map(v => `'${v}'`).join(', ')}]`)
    .join('\n');

  return [
    'You are an orientation inference engine. Extract signals about user communication preferences from conversational exchanges.',
    '',
    'EVIDENCE RULE (strictly enforced):',
    "- Analyze only the user's message for preference signals.",
    '- The assistant response is provided as context to help interpret ambiguous user phrasing.',
    "- NEVER emit a signal based solely on the assistant's content.",
    "- Only emit a signal when you can identify specific user language that supports it.",
    '- When uncertain, use a lower weight or omit the signal entirely.',
    '',
    'ORIENTATION SCHEMA (allowed dimensions and values):',
    schemaLines,
    '',
    'WEIGHT GUIDANCE:',
    '  1.0 — Explicit direct statement (e.g., "Give me a brief answer", "step by step")',
    "  0.7 — Clear indirect implication (e.g., \"I'm in a hurry\" → single_step cadence)",
    '  0.5 — Reasonable inference requiring interpretation',
    "Prefer lower weights when uncertain. Omit a signal if the user's words do not support it.",
  ].join('\n');
})();

// ── Tool definition ────────────────────────────────────────────────────────────

function buildSignalProperties(debug: boolean): Record<string, unknown> {
  const props: Record<string, unknown> = {
    dimensionKey: {
      type: 'string',
      enum: Object.keys(ORIENTATION_SCHEMA),
      description: 'The orientation dimension this signal applies to.',
    },
    candidateValue: {
      type: 'string',
      description:
        'The inferred value for this dimension. Must be one of the valid values for the chosen dimensionKey.',
    },
    signalWeight: {
      type: 'number',
      minimum: 0.5,
      maximum: 1.0,
      description:
        'Confidence weight: 1.0 = explicit statement, 0.7 = clear indirect implication, 0.5 = reasonable inference.',
    },
  };
  if (debug) {
    // reasoning is requested from the model for schema-level prompting only.
    // It is consumed here for tool-schema completeness and then discarded.
    // It must never be logged, persisted, or returned — see content logging policy above.
    props['reasoning'] = {
      type: 'string',
      description: 'Brief explanation of the specific user language that supports this signal.',
    };
  }
  return props;
}

// ── Raw signal shape from LLM output ──────────────────────────────────────────

interface RawSignal {
  dimensionKey?: unknown;
  candidateValue?: unknown;
  signalWeight?: unknown;
  reasoning?: unknown;
}

// ── Provider ───────────────────────────────────────────────────────────────────

export class LLMOrientationProvider implements OrientationInferenceProvider {
  private readonly client: Anthropic;
  private readonly model: string;

  /**
   * @param agentName - Agent name embedded in the `inferredBy` field of each signal.
   * @param debug     - When true, include reasoning in the tool schema (schema-level only;
   *                    reasoning is never logged, persisted, or returned in any mode).
   * @param client    - Anthropic client; defaults to `new Anthropic()` (uses ANTHROPIC_API_KEY).
   * @param clock     - Injected clock; defaults to system clock.
   * @param model     - Model override; defaults to claude-haiku-4-5-20251001.
   */
  constructor(
    private readonly agentName: AgentName,
    private readonly debug = false,
    client?: Anthropic,
    private readonly clock: Clock = systemClock,
    model = DEFAULT_MODEL,
  ) {
    this.client = client ?? new Anthropic();
    this.model = model;
  }

  /**
   * Extract orientation signals from the exchange.
   *
   * Throws on infrastructure or protocol failures — the caller
   * (CompositeOrientationProvider) handles these via Promise.allSettled and
   * reports them through its diagnostics hook.
   * Returns [] only when the LLM genuinely produced no valid signals.
   */
  async extractSignals(
    input: OrientationInferenceInput,
    _profile: Readonly<EssenceProfile>,
  ): Promise<OrientationSignal[]> {
    const rawSignals = await this.callLLM(input);
    return this.validate(rawSignals, input);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Call the LLM and return raw signal objects from the tool response.
   *
   * Throws on:
   *   - API / transport errors (propagated from client.messages.create)
   *   - Missing tool_use block (protocol violation; tool_choice forces it)
   *   - Missing or non-array signals field (malformed tool input)
   *
   * Returns [] only when the model explicitly provides an empty signals array.
   */
  private async callLLM(input: OrientationInferenceInput): Promise<RawSignal[]> {
    const userContent =
      `<assistant_response>\n${input.exchange.assistantResponse}\n</assistant_response>\n\n` +
      `<user_message>\n${input.exchange.userMessage}\n</user_message>`;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: TOOL_NAME,
          description:
            "Extract orientation preference signals from the user message. " +
            "Return an empty signals array if no signals are confidently supported by the user's own words.",
          input_schema: {
            type: 'object' as const,
            properties: {
              signals: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: buildSignalProperties(this.debug),
                  required: ['dimensionKey', 'candidateValue', 'signalWeight'],
                },
                description: 'List of inferred orientation signals. May be empty.',
              },
            },
            required: ['signals'],
          },
        },
      ],
      tool_choice: { type: 'tool' as const, name: TOOL_NAME },
      messages: [{ role: 'user', content: userContent }],
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );
    if (!toolUse) {
      throw new Error(
        `[LLMOrientationProvider] protocol violation: no tool_use block in response despite forced tool_choice`,
      );
    }

    const toolInput = toolUse.input as Record<string, unknown>;
    if (!Array.isArray(toolInput['signals'])) {
      throw new Error(
        `[LLMOrientationProvider] malformed tool input: signals field is missing or not an array`,
      );
    }

    return toolInput['signals'] as RawSignal[];
  }

  /**
   * Validate and map raw LLM output to OrientationSignals.
   * Invalid entries are silently dropped — this is not a failure.
   * Returns [] when the LLM found no valid signals for this exchange.
   * The reasoning field, if present, is read for deduplication bookkeeping
   * and then discarded — never logged, persisted, or returned.
   */
  private validate(rawSignals: RawSignal[], input: OrientationInferenceInput): OrientationSignal[] {
    const inferredAt = new Date(this.clock.now()).toISOString();
    const emitted = new Set<string>();
    const signals: OrientationSignal[] = [];

    for (const raw of rawSignals) {
      if (typeof raw.dimensionKey !== 'string') continue;
      if (!isOrientationNode(raw.dimensionKey)) continue;
      const dimensionKey = raw.dimensionKey as OrientationDimensionKey;

      if (typeof raw.candidateValue !== 'string') continue;
      if (!isValidOrientationValue(dimensionKey, raw.candidateValue)) continue;

      if (typeof raw.signalWeight !== 'number') continue;
      if (raw.signalWeight <= 0 || raw.signalWeight > 1) continue;

      const dedupKey = JSON.stringify([dimensionKey, raw.candidateValue]);
      if (emitted.has(dedupKey)) continue;
      emitted.add(dedupKey);

      // raw.reasoning is intentionally not used here.
      // Content logging policy: reasoning is discarded without logging in all modes.

      signals.push({
        dimensionKey,
        candidateValue:      raw.candidateValue,
        sourceObservationId: input.sourceObservationId,
        signalWeight:        raw.signalWeight,
        inferredBy:          `${this.agentName}/llm-orientation@1`,
        sessionId:           input.sessionId,
        inferredAt,
      });
    }

    return signals;
  }
}
