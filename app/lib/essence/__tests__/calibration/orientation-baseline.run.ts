#!/usr/bin/env tsx
/**
 * M0-9C4 — Baseline Runner
 *
 * Runs Rule, LLM, and Composite providers against MEASUREMENT_CORPUS and
 * EVALUATION_CORPUS, records per-entry results to a versioned snapshot file,
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
 * Output:
 *   baselines/corpus-{version}/baseline-NNN.json  (alongside this file)
 *   Each run creates a new file — existing baselines are never overwritten.
 *
 * Does NOT enforce numeric thresholds — thresholds are set in M0-9C5 after
 * the first baseline run.
 */

import Anthropic from '@anthropic-ai/sdk';
import { writeFileSync, mkdirSync, readdirSync, existsSync } from 'fs';
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

// ── Identity constants ─────────────────────────────────────────────────────────

const RULE_PROVIDER_ID              = 'merlin/rule-based';
const RULE_PROVIDER_VERSION         = '1';
const RULE_INFERENCE_POLICY_VERSION = '1';

const LLM_PROVIDER_ID              = 'merlin/llm-orientation';
const LLM_PROVIDER_VERSION         = '1';
const LLM_INFERENCE_POLICY_VERSION = '1';
const LLM_MODEL                    = 'claude-haiku-4-5-20251001';
const LLM_TEMPERATURE              = 0;

// ── Output path ────────────────────────────────────────────────────────────────

function resolveOutputPath(corpusVersion: string): string {
  const dir = join(__dirname, 'baselines', `corpus-${corpusVersion}`);
  mkdirSync(dir, { recursive: true });

  let n = 1;
  while (existsSync(join(dir, `baseline-${String(n).padStart(3, '0')}.json`))) {
    n++;
  }
  return join(dir, `baseline-${String(n).padStart(3, '0')}.json`);
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface RuleProviderMeta {
  providerId:              string;
  providerVersion:         string;
  inferencePolicyVersion:  string;
}

interface LLMProviderMeta extends RuleProviderMeta {
  model:       string;
  temperature: number;
}

interface CompositeMeta {
  memberProviderIds: string[];
}

interface EmittedSignal {
  dimensionKey:   string;
  candidateValue: string;
  signalWeight:   number;
  inferredBy:     string;
}

interface EntryResult {
  entryId:        string;
  dimension:      string;
  category:       string;
  language:       string;
  set:            string;
  emittedSignals: EmittedSignal[];
  isTP:           boolean | null;
  isFP:           boolean;
  tpDetail:       { expected: string[]; detected: string[]; missing: string[] } | null;
  fpDetail:       { forbidden: string[]; detected: string[] };
}

interface CategoryRate {
  tpRate:        number | null;
  fpRate:        number | null;
  tpNumerator:   number;
  tpDenominator: number;
  fpNumerator:   number;
  fpDenominator: number;
}

interface ProviderResult {
  entries: EntryResult[];
  rates:   Record<string, CategoryRate>;
}

interface MeasurementSummary {
  corpusSize:  number;
  byProvider: Record<string, Record<string, {
    tpRate:  number | null;
    tpCount: number;
    total:   number;
    fpRate:  number | null;
    fpCount: number;
  }>>;
}

interface EvaluationSummary {
  corpusSize: number;
  note?:      string;
}

interface BaselineResults {
  metadata: {
    generatedAt:  string;
    corpusVersion: string;
    providers: {
      rule:      RuleProviderMeta;
      llm:       LLMProviderMeta | null;
      composite: CompositeMeta   | null;
    };
  };
  measurementSummary: MeasurementSummary;
  evaluationSummary:  EvaluationSummary;
  measurement: {
    rule:      ProviderResult;
    llm:       ProviderResult | null;
    composite: ProviderResult | null;
  };
  evaluation: {
    rule:      { entries: EntryResult[] };
    llm:       { entries: EntryResult[] } | null;
    composite: { entries: EntryResult[] } | null;
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const PROFILE: Readonly<EssenceProfile> =
  createEmptyEssenceProfile('baseline') as Readonly<EssenceProfile>;

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
  const detectedValues   = new Set(dimensionSignals.map(s => s.candidateValue));

  let isTP: boolean | null           = null;
  let tpDetail: EntryResult['tpDetail'] = null;

  if (entry.expectedSignals.length > 0) {
    const weightMap = new Map<string, number>(
      dimensionSignals.map(s => [s.candidateValue, s.signalWeight]),
    );
    const missing = entry.expectedSignals.filter(
      es => (weightMap.get(es.candidateValue) ?? 0) < es.minWeight,
    );
    isTP     = missing.length === 0;
    tpDetail = {
      expected: entry.expectedSignals.map(es => es.candidateValue),
      detected: [...detectedValues],
      missing:  missing.map(es => es.candidateValue),
    };
  }

  const forbiddenDetected = entry.forbiddenSignals.filter(v => detectedValues.has(v));

  return {
    entryId:        entry.entryId,
    dimension:      entry.dimension,
    category:       entry.category,
    language:       entry.language,
    set:            entry.set,
    emittedSignals: emitted.map(toEmittedSignal),
    isTP,
    isFP:           forbiddenDetected.length > 0,
    tpDetail,
    fpDetail:       { forbidden: entry.forbiddenSignals, detected: forbiddenDetected },
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
      fpRate:        catEntries.length  > 0 ? fpCount / catEntries.length  : null,
      tpNumerator:   tpCount,
      tpDenominator: tpEligible.length,
      fpNumerator:   fpCount,
      fpDenominator: catEntries.length,
    };
  }

  return rates;
}

function buildMeasurementSummary(
  results: BaselineResults['measurement'],
): MeasurementSummary {
  const byProvider: MeasurementSummary['byProvider'] = {};

  for (const [key, pResult] of Object.entries(results) as [string, ProviderResult | null][]) {
    if (!pResult) continue;
    byProvider[key] = {};
    for (const [cat, r] of Object.entries(pResult.rates)) {
      byProvider[key]![cat] = {
        tpRate:  r.tpRate,
        tpCount: r.tpNumerator,
        total:   r.tpDenominator,
        fpRate:  r.fpRate,
        fpCount: r.fpNumerator,
      };
    }
  }

  return { corpusSize: MEASUREMENT_CORPUS.length, byProvider };
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
      const tp = result.isTP === null ? '—' : result.isTP ? 'TP✓' : 'miss✗';
      const fp = result.isFP ? 'FP✗' : 'ok';
      console.log(` ${tp} / ${fp}`);
    } catch (err) {
      console.log(` ERROR: ${(err as Error).message}`);
      results.push(evaluateEntry(entry, []));
    }
  }

  return results;
}

// ── Table printer ──────────────────────────────────────────────────────────────

const RATE_CATEGORIES = ['explicit', 'implied', 'negative', 'adversarial'] as const;

function fmtRate(rate: number | null, num: number, den: number): string {
  if (rate === null || den === 0) return '—';
  return `${(rate * 100).toFixed(1)}% (${num}/${den})`;
}

function printTable(results: BaselineResults): void {
  const W = { p: 10, c: 11, r: 22, f: 22 };
  const hr = `|${'-'.repeat(W.p + 2)}|${'-'.repeat(W.c + 2)}|${'-'.repeat(W.r + 2)}|${'-'.repeat(W.f + 2)}|`;
  const hd = `| ${'Provider'.padEnd(W.p)} | ${'Category'.padEnd(W.c)} | ${'TP rate'.padEnd(W.r)} | ${'FP rate'.padEnd(W.f)} |`;

  console.log('\n## §6 Baseline Table\n');
  console.log(hd);
  console.log(hr);

  const rows: Array<{ label: string; key: keyof BaselineResults['measurement'] }> = [
    { label: 'Rule',      key: 'rule' },
    { label: 'LLM',       key: 'llm' },
    { label: 'Composite', key: 'composite' },
  ];

  for (const { label, key } of rows) {
    const pResult = results.measurement[key];
    for (const cat of RATE_CATEGORIES) {
      if (!pResult) {
        console.log(`| ${label.padEnd(W.p)} | ${cat.padEnd(W.c)} | ${'(skipped)'.padEnd(W.r)} | ${'(skipped)'.padEnd(W.f)} |`);
        continue;
      }
      const r = pResult.rates[cat];
      if (!r) {
        console.log(`| ${label.padEnd(W.p)} | ${cat.padEnd(W.c)} | ${'—'.padEnd(W.r)} | ${'—'.padEnd(W.f)} |`);
        continue;
      }
      const tpStr = cat === 'negative' || cat === 'adversarial'
        ? '—'
        : fmtRate(r.tpRate, r.tpNumerator, r.tpDenominator);
      const fpStr = cat === 'adversarial' && r.fpNumerator === 0
        ? '0.0% — architectural ✓'
        : fmtRate(r.fpRate, r.fpNumerator, r.fpDenominator);
      console.log(`| ${label.padEnd(W.p)} | ${cat.padEnd(W.c)} | ${tpStr.padEnd(W.r)} | ${fpStr.padEnd(W.f)} |`);
    }
  }

  console.log('');
  console.log(`Corpus version : ${results.metadata.corpusVersion}`);
  console.log(`Generated      : ${results.metadata.generatedAt}`);
  if (results.metadata.providers.llm) {
    const llm = results.metadata.providers.llm;
    console.log(`LLM            : ${llm.model} (temperature=${llm.temperature})`);
  } else {
    console.log('LLM            : (not run — ANTHROPIC_API_KEY not set)');
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('M0-9C4 Baseline Runner');
  console.log(`Corpus: v${CORPUS_VERSION}  |  ${MEASUREMENT_CORPUS.length} measurement / ${EVALUATION_CORPUS.length} evaluation entries`);

  const apiKey = process.env['ANTHROPIC_API_KEY'];
  const hasLLM = !!apiKey;

  if (!hasLLM) {
    console.log('\nWARNING: ANTHROPIC_API_KEY not set. LLM and Composite providers skipped.');
  }

  // ── Build providers ──────────────────────────────────────────────────────────

  const ruleProvider = new RuleBasedOrientationProvider('merlin');

  let llmProvider:       LLMOrientationProvider       | null = null;
  let compositeProvider: CompositeOrientationProvider | null = null;

  if (hasLLM) {
    const client = new Anthropic({ apiKey });
    llmProvider  = new LLMOrientationProvider(
      'merlin',
      false,        // debug off — production-equivalent conditions
      client,
      undefined,    // system clock
      LLM_MODEL,
      LLM_TEMPERATURE,
    );
    compositeProvider = new CompositeOrientationProvider([ruleProvider, llmProvider]);
  }

  // ── Run measurement corpus ───────────────────────────────────────────────────

  console.log('\n── Measurement Corpus ───────────────────────────────────────────────────────\n');

  console.log('Rule Provider:');
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

  let evalRuleEntries:      EntryResult[]      = [];
  let evalLLMEntries:       EntryResult[] | null = null;
  let evalCompositeEntries: EntryResult[] | null = null;

  if (EVALUATION_CORPUS.length > 0) {
    console.log('\n── Evaluation Corpus ────────────────────────────────────────────────────────\n');

    console.log('Rule Provider:');
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
    console.log('\n(Evaluation corpus empty — no ambiguous/contradiction entries in Phase 1)');
  }

  // ── Assemble ─────────────────────────────────────────────────────────────────

  const measurementBlock = {
    rule:      { entries: ruleEntries,       rates: computeRates(ruleEntries) },
    llm:       llmEntries       ? { entries: llmEntries,       rates: computeRates(llmEntries) }       : null,
    composite: compositeEntries ? { entries: compositeEntries, rates: computeRates(compositeEntries) } : null,
  };

  const results: BaselineResults = {
    metadata: {
      generatedAt:   new Date().toISOString(),
      corpusVersion: CORPUS_VERSION,
      providers: {
        rule: {
          providerId:             RULE_PROVIDER_ID,
          providerVersion:        RULE_PROVIDER_VERSION,
          inferencePolicyVersion: RULE_INFERENCE_POLICY_VERSION,
        },
        llm: hasLLM
          ? {
              providerId:             LLM_PROVIDER_ID,
              providerVersion:        LLM_PROVIDER_VERSION,
              inferencePolicyVersion: LLM_INFERENCE_POLICY_VERSION,
              model:                  LLM_MODEL,
              temperature:            LLM_TEMPERATURE,
            }
          : null,
        composite: hasLLM
          ? { memberProviderIds: [RULE_PROVIDER_ID, LLM_PROVIDER_ID] }
          : null,
      },
    },
    measurementSummary: buildMeasurementSummary(measurementBlock),
    evaluationSummary:  {
      corpusSize: EVALUATION_CORPUS.length,
      ...(EVALUATION_CORPUS.length === 0 && { note: 'No evaluation entries in Phase 1 corpus' }),
    },
    measurement: measurementBlock,
    evaluation: {
      rule:      { entries: evalRuleEntries },
      llm:       evalLLMEntries      ? { entries: evalLLMEntries }      : null,
      composite: evalCompositeEntries ? { entries: evalCompositeEntries } : null,
    },
  };

  // ── Write ─────────────────────────────────────────────────────────────────────

  const outputPath = resolveOutputPath(CORPUS_VERSION);
  writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nSnapshot written: ${outputPath}`);

  // ── Print §6 table ────────────────────────────────────────────────────────────

  printTable(results);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
