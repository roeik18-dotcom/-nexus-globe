/**
 * M0-9B — LLM-Based Orientation Provider
 *
 * Unit tests for LLMOrientationProvider. The Anthropic client is injected as
 * a mock — no real API calls are made.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { LLMOrientationProvider } from '../orientation-llm-provider';
import type { OrientationInferenceInput } from '../orientation-inference';
import type { EssenceProfile } from '../schema';
import { createEmptyEssenceProfile } from '../schema';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const NOW = '2026-07-26T12:00:00.000Z';
const NOW_MS = new Date(NOW).getTime();

function makeClock() {
  return { now: vi.fn(() => NOW_MS) };
}

function makeInput(
  userMessage = 'Explain this briefly.',
  assistantResponse = 'OK',
  overrides: Partial<OrientationInferenceInput> = {},
): OrientationInferenceInput {
  return {
    sessionId:           's1',
    profileId:           'u1',
    sourceObservationId: 'obs-1',
    exchange:            { userMessage, assistantResponse },
    ...overrides,
  };
}

function makeProfile(): Readonly<EssenceProfile> {
  return createEmptyEssenceProfile('u1') as Readonly<EssenceProfile>;
}

/** Build a mock Anthropic Message with a tool_use block containing the given signals. */
function makeToolResponse(signals: object[]) {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        id: 'toolu_test',
        name: 'extract_orientation_signals',
        input: { signals },
      },
    ],
    model: 'claude-haiku-4-5-20251001',
    stop_reason: 'tool_use',
    stop_sequence: null,
    usage: { input_tokens: 50, output_tokens: 20 },
  };
}

/** Build a mock Anthropic Message with only a text block (no tool_use). */
function makeTextResponse() {
  return {
    id: 'msg_text',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: 'I found nothing relevant.' }],
    model: 'claude-haiku-4-5-20251001',
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 30, output_tokens: 10 },
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeProvider(debug = false) {
  const mockCreate = vi.fn();
  const mockClient = { messages: { create: mockCreate } } as unknown as Anthropic;
  const clock = makeClock();
  const provider = new LLMOrientationProvider('merlin', debug, mockClient, clock);
  return { provider, mockCreate, clock };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('LLMOrientationProvider', () => {

  // ── Valid signal extraction ────────────────────────────────────────────────

  it('extracts a single valid signal', async () => {
    const { provider, mockCreate } = makeProvider();
    mockCreate.mockResolvedValueOnce(makeToolResponse([
      { dimensionKey: 'OrientationResponseDepth', candidateValue: 'brief', signalWeight: 1.0 },
    ]));

    const signals = await provider.extractSignals(makeInput(), makeProfile());

    expect(signals).toHaveLength(1);
    expect(signals[0].dimensionKey).toBe('OrientationResponseDepth');
    expect(signals[0].candidateValue).toBe('brief');
    expect(signals[0].signalWeight).toBe(1.0);
  });

  it('extracts multiple signals across dimensions', async () => {
    const { provider, mockCreate } = makeProvider();
    mockCreate.mockResolvedValueOnce(makeToolResponse([
      { dimensionKey: 'OrientationResponseDepth',      candidateValue: 'brief',       signalWeight: 1.0 },
      { dimensionKey: 'OrientationCommunicationStyle', candidateValue: 'direct',      signalWeight: 0.7 },
      { dimensionKey: 'OrientationTaskCadence',        candidateValue: 'single_step', signalWeight: 0.5 },
    ]));

    const signals = await provider.extractSignals(makeInput(), makeProfile());
    expect(signals).toHaveLength(3);
  });

  // ── Field values ───────────────────────────────────────────────────────────

  it('populates all required signal fields from input', async () => {
    const { provider, mockCreate, clock } = makeProvider();
    mockCreate.mockResolvedValueOnce(makeToolResponse([
      { dimensionKey: 'OrientationResponseDepth', candidateValue: 'brief', signalWeight: 0.7 },
    ]));

    const input = makeInput('Explain briefly.', 'OK', {
      sessionId:           'session-99',
      profileId:           'profile-42',
      sourceObservationId: 'obs-xyz',
    });
    const [signal] = await provider.extractSignals(input, makeProfile());

    expect(signal.sourceObservationId).toBe('obs-xyz');
    expect(signal.sessionId).toBe('session-99');
    expect(signal.inferredBy).toBe('merlin/llm-orientation@1');
    expect(signal.inferredAt).toBe(NOW);
    expect(clock.now).toHaveBeenCalledTimes(1);
  });

  // ── inferredBy format ──────────────────────────────────────────────────────

  it('inferredBy uses agentName/llm-orientation@1 format', async () => {
    const mockCreate = vi.fn();
    const mockClient = { messages: { create: mockCreate } } as unknown as Anthropic;
    const provider = new LLMOrientationProvider('philos', false, mockClient);
    mockCreate.mockResolvedValueOnce(makeToolResponse([
      { dimensionKey: 'OrientationResponseDepth', candidateValue: 'explanatory', signalWeight: 0.5 },
    ]));

    const [signal] = await provider.extractSignals(makeInput(), makeProfile());
    expect(signal.inferredBy).toBe('philos/llm-orientation@1');
  });

  // ── Validation: unknown dimensionKey ──────────────────────────────────────

  it('rejects signal with unknown dimensionKey', async () => {
    const { provider, mockCreate } = makeProvider();
    mockCreate.mockResolvedValueOnce(makeToolResponse([
      { dimensionKey: 'UnknownDimension', candidateValue: 'brief', signalWeight: 1.0 },
    ]));

    const signals = await provider.extractSignals(makeInput(), makeProfile());
    expect(signals).toHaveLength(0);
  });

  it('rejects signal with non-string dimensionKey', async () => {
    const { provider, mockCreate } = makeProvider();
    mockCreate.mockResolvedValueOnce(makeToolResponse([
      { dimensionKey: 42, candidateValue: 'brief', signalWeight: 1.0 },
    ]));

    const signals = await provider.extractSignals(makeInput(), makeProfile());
    expect(signals).toHaveLength(0);
  });

  // ── Validation: invalid candidateValue ────────────────────────────────────

  it('rejects signal with candidateValue not in schema', async () => {
    const { provider, mockCreate } = makeProvider();
    mockCreate.mockResolvedValueOnce(makeToolResponse([
      { dimensionKey: 'OrientationResponseDepth', candidateValue: 'verbose', signalWeight: 1.0 },
    ]));

    const signals = await provider.extractSignals(makeInput(), makeProfile());
    expect(signals).toHaveLength(0);
  });

  it('rejects signal with non-string candidateValue', async () => {
    const { provider, mockCreate } = makeProvider();
    mockCreate.mockResolvedValueOnce(makeToolResponse([
      { dimensionKey: 'OrientationResponseDepth', candidateValue: null, signalWeight: 1.0 },
    ]));

    const signals = await provider.extractSignals(makeInput(), makeProfile());
    expect(signals).toHaveLength(0);
  });

  // ── Validation: weight bounds ──────────────────────────────────────────────

  it('rejects signal with weight === 0', async () => {
    const { provider, mockCreate } = makeProvider();
    mockCreate.mockResolvedValueOnce(makeToolResponse([
      { dimensionKey: 'OrientationResponseDepth', candidateValue: 'brief', signalWeight: 0 },
    ]));

    const signals = await provider.extractSignals(makeInput(), makeProfile());
    expect(signals).toHaveLength(0);
  });

  it('rejects signal with weight > 1', async () => {
    const { provider, mockCreate } = makeProvider();
    mockCreate.mockResolvedValueOnce(makeToolResponse([
      { dimensionKey: 'OrientationResponseDepth', candidateValue: 'brief', signalWeight: 1.5 },
    ]));

    const signals = await provider.extractSignals(makeInput(), makeProfile());
    expect(signals).toHaveLength(0);
  });

  it('accepts signal with weight exactly at 1.0', async () => {
    const { provider, mockCreate } = makeProvider();
    mockCreate.mockResolvedValueOnce(makeToolResponse([
      { dimensionKey: 'OrientationResponseDepth', candidateValue: 'brief', signalWeight: 1.0 },
    ]));

    const signals = await provider.extractSignals(makeInput(), makeProfile());
    expect(signals).toHaveLength(1);
    expect(signals[0].signalWeight).toBe(1.0);
  });

  it('accepts fractional weight within (0, 1]', async () => {
    const { provider, mockCreate } = makeProvider();
    mockCreate.mockResolvedValueOnce(makeToolResponse([
      { dimensionKey: 'OrientationResponseDepth', candidateValue: 'brief', signalWeight: 0.5 },
    ]));

    const signals = await provider.extractSignals(makeInput(), makeProfile());
    expect(signals).toHaveLength(1);
    expect(signals[0].signalWeight).toBe(0.5);
  });

  it('rejects signal with non-number weight', async () => {
    const { provider, mockCreate } = makeProvider();
    mockCreate.mockResolvedValueOnce(makeToolResponse([
      { dimensionKey: 'OrientationResponseDepth', candidateValue: 'brief', signalWeight: '1.0' },
    ]));

    const signals = await provider.extractSignals(makeInput(), makeProfile());
    expect(signals).toHaveLength(0);
  });

  // ── Deduplication ─────────────────────────────────────────────────────────

  it('deduplicates by (dimensionKey, candidateValue) — first occurrence kept', async () => {
    const { provider, mockCreate } = makeProvider();
    mockCreate.mockResolvedValueOnce(makeToolResponse([
      { dimensionKey: 'OrientationResponseDepth', candidateValue: 'brief', signalWeight: 1.0 },
      { dimensionKey: 'OrientationResponseDepth', candidateValue: 'brief', signalWeight: 0.7 },
    ]));

    const signals = await provider.extractSignals(makeInput(), makeProfile());
    expect(signals).toHaveLength(1);
    expect(signals[0].signalWeight).toBe(1.0);
  });

  it('allows different candidateValues in the same dimension (competing candidates)', async () => {
    const { provider, mockCreate } = makeProvider();
    mockCreate.mockResolvedValueOnce(makeToolResponse([
      { dimensionKey: 'OrientationResponseDepth', candidateValue: 'brief',       signalWeight: 0.7 },
      { dimensionKey: 'OrientationResponseDepth', candidateValue: 'explanatory', signalWeight: 0.5 },
    ]));

    const signals = await provider.extractSignals(makeInput(), makeProfile());
    expect(signals).toHaveLength(2);
  });

  // ── No tool_use block ──────────────────────────────────────────────────────

  it('returns [] when LLM returns no tool_use block', async () => {
    const { provider, mockCreate } = makeProvider();
    mockCreate.mockResolvedValueOnce(makeTextResponse());

    const signals = await provider.extractSignals(makeInput(), makeProfile());
    expect(signals).toHaveLength(0);
  });

  it('returns [] when tool input has no signals array', async () => {
    const { provider, mockCreate } = makeProvider();
    mockCreate.mockResolvedValueOnce({
      ...makeToolResponse([]),
      content: [{
        type: 'tool_use',
        id: 'toolu_test',
        name: 'extract_orientation_signals',
        input: {},
      }],
    });

    const signals = await provider.extractSignals(makeInput(), makeProfile());
    expect(signals).toHaveLength(0);
  });

  it('returns [] when signals is not an array', async () => {
    const { provider, mockCreate } = makeProvider();
    mockCreate.mockResolvedValueOnce({
      ...makeToolResponse([]),
      content: [{
        type: 'tool_use',
        id: 'toolu_test',
        name: 'extract_orientation_signals',
        input: { signals: 'not-an-array' },
      }],
    });

    const signals = await provider.extractSignals(makeInput(), makeProfile());
    expect(signals).toHaveLength(0);
  });

  // ── Graceful degradation ───────────────────────────────────────────────────

  it('returns [] when the API call throws — never propagates the error', async () => {
    const { provider, mockCreate } = makeProvider();
    mockCreate.mockRejectedValueOnce(new Error('API unavailable'));

    const signals = await provider.extractSignals(makeInput(), makeProfile());
    expect(signals).toHaveLength(0);
  });

  it('returns [] when the API call rejects with a non-Error value', async () => {
    const { provider, mockCreate } = makeProvider();
    mockCreate.mockRejectedValueOnce('string error');

    const signals = await provider.extractSignals(makeInput(), makeProfile());
    expect(signals).toHaveLength(0);
  });

  // ── Valid signals pass through alongside invalid ones ──────────────────────

  it('emits valid signals and silently drops invalid ones from the same response', async () => {
    const { provider, mockCreate } = makeProvider();
    mockCreate.mockResolvedValueOnce(makeToolResponse([
      { dimensionKey: 'OrientationResponseDepth', candidateValue: 'brief',     signalWeight: 1.0 },
      { dimensionKey: 'BadDimension',             candidateValue: 'anything',  signalWeight: 1.0 },
      { dimensionKey: 'OrientationTaskCadence',   candidateValue: 'phased',    signalWeight: 0.7 },
      { dimensionKey: 'OrientationDecisionStyle', candidateValue: 'made_up',   signalWeight: 0.5 },
    ]));

    const signals = await provider.extractSignals(makeInput(), makeProfile());
    expect(signals).toHaveLength(2);
    expect(signals.map(s => s.candidateValue)).toEqual(['brief', 'phased']);
  });

  // ── debug mode ────────────────────────────────────────────────────────────

  it('debug=false: reasoning field is omitted from tool schema (inspects the create call)', async () => {
    const { provider, mockCreate } = makeProvider(false);
    mockCreate.mockResolvedValueOnce(makeToolResponse([]));

    await provider.extractSignals(makeInput(), makeProfile());

    const callArgs = mockCreate.mock.calls[0][0];
    const itemProps = callArgs.tools[0].input_schema.properties.signals.items.properties;
    expect(itemProps['reasoning']).toBeUndefined();
  });

  it('debug=true: reasoning field is included in tool schema', async () => {
    const { provider, mockCreate } = makeProvider(true);
    mockCreate.mockResolvedValueOnce(makeToolResponse([]));

    await provider.extractSignals(makeInput(), makeProfile());

    const callArgs = mockCreate.mock.calls[0][0];
    const itemProps = callArgs.tools[0].input_schema.properties.signals.items.properties;
    expect(itemProps['reasoning']).toBeDefined();
  });

  it('debug=true: reasoning is logged via console.debug when present in signal', async () => {
    const { provider, mockCreate } = makeProvider(true);
    mockCreate.mockResolvedValueOnce(makeToolResponse([
      {
        dimensionKey: 'OrientationResponseDepth',
        candidateValue: 'brief',
        signalWeight: 1.0,
        reasoning: 'User explicitly said "brief".',
      },
    ]));

    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    await provider.extractSignals(makeInput(), makeProfile());
    expect(debugSpy).toHaveBeenCalledOnce();
    debugSpy.mockRestore();
  });

  it('debug=false: reasoning in response is silently ignored', async () => {
    const { provider, mockCreate } = makeProvider(false);
    mockCreate.mockResolvedValueOnce(makeToolResponse([
      {
        dimensionKey: 'OrientationResponseDepth',
        candidateValue: 'brief',
        signalWeight: 1.0,
        reasoning: 'Would be logged in debug mode.',
      },
    ]));

    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const signals = await provider.extractSignals(makeInput(), makeProfile());
    expect(debugSpy).not.toHaveBeenCalled();
    expect(signals).toHaveLength(1);
    debugSpy.mockRestore();
  });

  // ── Empty signals array ────────────────────────────────────────────────────

  it('returns [] when LLM returns an empty signals array', async () => {
    const { provider, mockCreate } = makeProvider();
    mockCreate.mockResolvedValueOnce(makeToolResponse([]));

    const signals = await provider.extractSignals(makeInput(), makeProfile());
    expect(signals).toHaveLength(0);
  });

  // ── tool_choice and model pass-through (observability of API call) ─────────

  it('forces tool_choice to the extraction tool', async () => {
    const { provider, mockCreate } = makeProvider();
    mockCreate.mockResolvedValueOnce(makeToolResponse([]));

    await provider.extractSignals(makeInput(), makeProfile());

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.tool_choice).toEqual({ type: 'tool', name: 'extract_orientation_signals' });
  });
});
