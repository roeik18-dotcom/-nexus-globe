#!/usr/bin/env tsx
/**
 * M0-9C4 — Baseline Runner
 *
 * Runs Rule, LLM, and Composite providers against MEASUREMENT_CORPUS and
 * EVALUATION_CORPUS, records per-entry results to orientation-baseline-results.json,
 * and prints the §6 table to stdout.
 *
 * Run:
 *   npx tsx app/lib/essence/__tests__/calibration/orientation-baseline.run.ts
 *
 * Requirements:
 *   - ANTHROPIC_API_KEY must be set for LLM and Composite providers.
 *   - Without it, only the Rule Provider is evaluated and the JSON records
 *     llm/composite as null.
 *
 * Does NOT enforce numeric thresholds — thresholds are set in M0-9C5 after
 * the first baseline run.
 *
 * Output: orientation-baseline-results.json (alongside this file)
 */

import Anthropic from '@anthropic-ai/sdk';
import { writeFileSync } from 'fs';
import { join } from 'path';
import {
  CORPUS_VERSION,
  MEASUREMENT_CORPUS,
  EVALUATION_CORPUS,
} from './corpus/orientation-calibration';
import type { CorpusEntry } from './corpus/orientation-calibration';
import { RuleBasedOrientationProvider } from '../../orientation-rule-provider';
import { LLMOrientationProvider } from '../../orientation-llm-provider';
import { CompositeOrientationProvider } from '../../orientation-composite-provider';
import type { OrientationInferenceProvider, OrientationSignal } from '../../orientation-inference';
import type { OrientationInferenceInput } from '../../orientation-inference';
import { createEmptyEssenceProfile } from '../../schema';
import type { EssenceProfile } from '../../schema';

// ── Constants ──────────────────────────────────────────────────────────────────

const LLM_MODEL       = 'claude-haiku-4-5-20251001';
const LLM_TEMPERATURE = 0;
const RULE_INFERRED_BY = 'merlin/rule-based@1';
const LLM_INFERRED_BY  = 'merlin/llm-orientation@1';

const OUTPUT_PATH = join(__dirname, 'orientation-baseline-results.json');

// ── Types ──────────────────────────────────────────────────────────────────────

interface EmittedSignal {
  dimensionKey: string;
  candidateValue: string;
  signalWeight: number;
  inferredBy: string;
}

interface EntryResult {
  entryId: string;
  dimension: string;
  category: string;
  language: string;
  set: string;
  emittedSignals: EmittedSignal[];
  isTP: boolean | null;
  isFP: boolean;
  tpDetail: { expected: string[]; detected: string[]; missing: string[] } | null;
  fpDetail: { forbidden: string[]; detected: string[] };
}

interface CategoryRate {
  tpRate: number | null;
  fpRate: number | null;
  tpNumerator: number;
  tpDenominator: number;
  fpNumerator: number;
  fpDenominator: number;
}

interface ProviderResult {
  entries: EntryResult[];
  rates: Record<string, CategoryRate>;
}

interface BaselineResults {
  metadata: {
    generatedAt: string;
    corpusVersion: string;
    providers: {
      rule: { inferredBy: string };
      llm: { inferredBy: string; model: string; temperature: number } | null;
      composite: { providers: string[] } | null;
    };
  };
  measurement: {
    rule: ProviderResult;
    llm: ProviderResult | null;
    composite: ProviderResult | null;
  };
  evaluation: {
    rule: { entries: EntryResult[] };
    llm: { entries: EntryResult[] } | null;
    composite: { entries: EntryResult[] } | null;
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const PROFILE: Readonly<EssenceProfile> = createEmptyEssenceProfile('baseline') as Readonly<EssenceProfile>;

function makeInput(entry: CorpusEntry): OrientationInferenceInput {
  return {
    sessionId:           'baseline',
    profileId:           'baseline',
    sourceObservationId: entry.entryId,
    exchange:            entry.exchange,
  };
}

function toEmittedSignal(s: OrientationSignal): EmittedSignal {
  return {
    dimensionKey:   s.dimensionKey,
    candidateValue: s.candidateValue,
    signalWeight:   s.signalWeight,
    inferredBy:     s.inferredBy,
  };
}

function evaluateEntry(entry: CorpusEntry, emitted: OrientationSignal[]): EntryResult {
  const dimensionSignals = emitted.filter(s => s.dimensionKey === entry.dimension);
  const detectedValues = new Set(dimensionSignals.map(s => s.candidateValue));

  // TP: all expectedSignals detected with weight >= minWeight
  let isTP: boolean | null = null;
  let tpDetail: EntryResult['tpDetail'] = null;
  if (entry.expectedSignals.length > 0) {
    const detectedWeightMap = new Map<string, number>(
      dimensionSignals.map(s => [s.candidateValue, s.signalWeight]),
    );
    const missing = entry.expectedSignals.filter(
      es => (detectedWeightMap.get(es.candidateValue) ?? 0) < es.minWeight,
    );
    isTP = missing.length === 0;
    tpDetail = {
      expected: entry.expectedSignals.map(es => es.candidateValue),
      detected: [...detectedValues],
      missing:  missing.map(es => es.candidateValue),
    };
  }

  // FP: any forbiddenSignal detected for this dimension
  const forbiddenDetected = entry.forbiddenSignals.filter(v => detectedValues.has(v));
  const isFP = forbiddenDetected.length > 0;

  return {
    entryId:       entry.entryId,
    dimension:     entry.dimension,
    category:      entry.category,
    language:      entry.language,
    set:           entry.set,
    emittedSignals: emitted.map(toEmittedSignal),
    isTP,
    isFP,
    tpDetail,
    fpDetail: { forbidden: entry.forbiddenSignals, detected: forbiddenDetected },
  };
}

function computeRates(entries: EntryResult[]): Record<string, CategoryRate> {
  const categories = [...new Set(entries.map(e => e.category))];
  const rates: Record<string, CategoryRate> = {};

  for (const cat of categories) {
    const catEntries = entries.filter(e => e.category === cat);
    const tpEligible = catEntries.filter(e => e.isTP !== null);
    const tpCount    = tpEligible.filter(e => e.isTP === true).length;
    const fpCount    = catEntries.filter(e => e.isFP).length;

    rates[cat] = {
      tpRate:        tpEligible.length > 0 ? tpCount / tpEligible.length : null,
      fpRate:        catEntries.length > 0 ? fpCount / catEntries.length : null,
      tpNumerator:   tpCount,
      tpDenominator: tpEligible.length,
      fpNumerator:   fpCount,
      fpDenominator: catEntries.length,
    };
  }

  return rates;
}

async function runProvider(
  name: string,
  provider: OrientationInferenceProvider,
  entries: CorpusEntry[],
): Promise<EntryResult[]> {
  const results: EntryResult[] = [];

  for (const entry of entries) {
    process.stdout.write(`  [${name}] ${entry.entryId} (${entry.category}, ${entry.language})...`);
    try {
      const signals = await provider.extractSignals(makeInput(entry), PROFILE);
      const result  = evaluateEntry(entry, signals);
      results.push(result);
      const tp = result.isTP === null ? '—' : result.isTP ? 'TP' : 'miss';
      const fp = result.isFP ? 'FP' : 'ok';
      console.log(` ${tp} / ${fp}`);
    } catch (err) {
      console.log(` ERROR: ${(err as Error).message}`);
      results.push(evaluateEntry(entry, []));
    }
  }

  return results;
}

// ── Table printer ──────────────────────────────────────────────────────────────

function fmt(rate: number | null, denominator: number): string {
  if (rate === null || denominator === 0) return '—';
  return `${(rate * 100).toFixed(1)}% (${Math.round(rate * denominator)}/${denominator})`;
}

const RATE_CATEGORIES = ['explicit', 'implied', 'negative', 'adversarial'] as const;

function printTable(results: BaselineResults): void {
  const col = (v: string, w: number) => v.padEnd(w);

  console.log('\n## §6 Baseline Table');
  console.log('');
  console.log(`| ${'Provider'.padEnd(10)} | ${'Category'.padEnd(11)} | ${'TP rate'.padEnd(20)} | ${'FP rate'.padEnd(20)} |`);
  console.log(`|${''.padEnd(12, '-')}|${''.padEnd(13, '-')}|${''.padEnd(22, '-')}|${''.padEnd(22, '-')}|`);

  const rows: Array<{ provider: string; key: keyof typeof results.measurement }> = [
    { provider: 'Rule',      key: 'rule' },
    { provider: 'LLM',       key: 'llm' },
    { provider: 'Composite', key: 'composite' },
  ];

  for (const { provider, key } of rows) {
    const provResult = results.measurement[key];
    if (provResult === null) {
      for (const cat of RATE_CATEGORIES) {
        console.log(`| ${col(provider, 10)} | ${col(cat, 11)} | ${'(skipped)'.padEnd(20)} | ${'(skipped)'.padEnd(20)} |`);
      }
      continue;
    }
    for (const cat of RATE_CATEGORIES) {
      const r = provResult.rates[cat];
      if (!r) {
        console.log(`| ${col(provider, 10)} | ${col(cat, 11)} | ${'—'.padEnd(20)} | ${'—'.padEnd(20)} |`);
        continue;
      }
      const tpStr = cat === 'adversarial' ? '—' : fmt(r.tpRate, r.tpDenominator);
      const fpStr = cat === 'adversarial' && r.fpNumerator === 0
        ? `0.0% — architectural ✓`
        : fmt(r.fpRate, r.fpDenominator);
      console.log(`| ${col(provider, 10)} | ${col(cat, 11)} | ${col(tpStr, 20)} | ${col(fpStr, 20)} |`);
    }
  }

  console.log('');
  console.log(`Corpus version: ${results.metadata.corpusVersion}`);
  console.log(`Generated:      ${results.metadata.generatedAt}`);
  if (results.metadata.providers.llm) {
    console.log(`LLM model:      ${results.metadata.providers.llm.model} (temperature=${results.metadata.providers.llm.temperature})`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('M0-9C4 Baseline Runner');
  console.log(`Corpus: v${CORPUS_VERSION}, ${MEASUREMENT_CORPUS.length} measurement / ${EVALUATION_CORPUS.length} evaluation entries`);

  const apiKey = process.env['ANTHROPIC_API_KEY'];
  const hasLLM = !!apiKey;

  if (!hasLLM) {
    console.log('\nWARNING: ANTHROPIC_API_KEY not set. LLM and Composite providers will be skipped.');
  }

  // ── Build providers ──────────────────────────────────────────────────────────

  const ruleProvider = new RuleBasedOrientationProvider('merlin');

  let llmProvider:       LLMOrientationProvider | null       = null;
  let compositeProvider: CompositeOrientationProvider | null = null;

  if (hasLLM) {
    const client = new Anthropic({ apiKey });
    llmProvider  = new LLMOrientationProvider(
      'merlin',
      false,            // debug: false for production-equivalent conditions
      client,
      undefined,        // use system clock
      LLM_MODEL,
      LLM_TEMPERATURE,
    );
    compositeProvider = new CompositeOrientationProvider([ruleProvider, llmProvider]);
  }

  // ── Run measurement corpus ───────────────────────────────────────────────────

  console.log('\n── Measurement Corpus ──────────────────────────────────────────────────────');

  console.log('\nRule Provider:');
  const ruleEntries = await runProvider('rule', ruleProvider, MEASUREMENT_CORPUS);

  let llmEntries:       EntryResult[] | null = null;
  let compositeEntries: EntryResult[] | null = null;

  if (llmProvider) {
    console.log('\nLLM Provider:');
    llmEntries = await runProvider('llm', llmProvider, MEASUREMENT_CORPUS);
  }

  if (compositeProvider) {
    console.log('\nComposite Provider:');
    compositeEntries = await runProvider('composite', compositeProvider, MEASUREMENT_CORPUS);
  }

  // ── Run evaluation corpus ────────────────────────────────────────────────────

  let evalRuleEntries:       EntryResult[] = [];
  let evalLLMEntries:        EntryResult[] | null = null;
  let evalCompositeEntries:  EntryResult[] | null = null;

  if (EVALUATION_CORPUS.length > 0) {
    console.log('\n── Evaluation Corpus ───────────────────────────────────────────────────────');

    console.log('\nRule Provider:');
    evalRuleEntries = await runProvider('rule', ruleProvider, EVALUATION_CORPUS);

    if (llmProvider) {
      console.log('\nLLM Provider:');
      evalLLMEntries = await runProvider('llm', llmProvider, EVALUATION_CORPUS);
    }

    if (compositeProvider) {
      console.log('\nComposite Provider:');
      evalCompositeEntries = await runProvider('composite', compositeProvider, EVALUATION_CORPUS);
    }
  } else {
    console.log('\n(Evaluation corpus is empty — no ambiguous/contradiction entries in Phase 1)');
  }

  // ── Assemble results ─────────────────────────────────────────────────────────

  const results: BaselineResults = {
    metadata: {
      generatedAt:   new Date().toISOString(),
      corpusVersion: CORPUS_VERSION,
      providers: {
        rule: { inferredBy: RULE_INFERRED_BY },
        llm:  hasLLM
          ? { inferredBy: LLM_INFERRED_BY, model: LLM_MODEL, temperature: LLM_TEMPERATURE }
          : null,
        composite: hasLLM
          ? { providers: [RULE_INFERRED_BY, LLM_INFERRED_BY] }
          : null,
      },
    },
    measurement: {
      rule:      { entries: ruleEntries,      rates: computeRates(ruleEntries) },
      llm:       llmEntries      ? { entries: llmEntries,      rates: computeRates(llmEntries) }      : null,
      composite: compositeEntries ? { entries: compositeEntries, rates: computeRates(compositeEntries) } : null,
    },
    evaluation: {
      rule:      { entries: evalRuleEntries },
      llm:       evalLLMEntries      ? { entries: evalLLMEntries }      : null,
      composite: evalCompositeEntries ? { entries: evalCompositeEntries } : null,
    },
  };

  // ── Write JSON ───────────────────────────────────────────────────────────────

  writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nResults written to: ${OUTPUT_PATH}`);

  // ── Print §6 table ───────────────────────────────────────────────────────────

  printTable(results);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
