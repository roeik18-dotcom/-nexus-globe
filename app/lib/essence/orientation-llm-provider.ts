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
 * Graceful degradation: extractSignals() returns [] on any error — never throws.
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
   * @param debug     - When true, include reasoning in the tool schema and log signals.
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

  async extractSignals(
    input: OrientationInferenceInput,
    _profile: Readonly<EssenceProfile>,
  ): Promise<OrientationSignal[]> {
    try {
      const rawSignals = await this.callLLM(input);
      return this.validate(rawSignals, input);
    } catch {
      return [];
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

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
    if (!toolUse) return [];

    const toolInput = toolUse.input as Record<string, unknown>;
    if (!Array.isArray(toolInput['signals'])) return [];

    return toolInput['signals'] as RawSignal[];
  }

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

      if (this.debug && typeof raw.reasoning === 'string') {
        console.debug(
          `[LLMOrientationProvider] ${dimensionKey}=${raw.candidateValue}` +
            ` (w=${raw.signalWeight}): ${raw.reasoning}`,
        );
      }

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
