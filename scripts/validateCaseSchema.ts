/**
 * Case Schema Validation — v0
 * Run: npx tsx scripts/validateCaseSchema.ts
 *
 * Validates all 20 seed cases against the locked schema and runs
 * similarity engine checks to verify the engine works as designed.
 */

import {
  validateCase,
  computeSimilarity,
  findMatches,
  GAP_TYPES,
  PRESSURE_TYPES,
  ACTION_TYPES,
  OUTCOME_CLASSES,
  VALUE_IDS,
  PARTICIPANT_TYPES,
  SIMILARITY_THRESHOLD,
  MIN_MATCHES,
  type Case,
  type GapType,
  type PressureType,
  type ActionType,
  type OutcomeClass,
  type ValueID,
  type ParticipantType,
} from '../app/lib/caseSchema';

import SEED_CASES_V0 from '../app/lib/caseSeedV0';

// ── Per-case validation ────────────────────────────────────────────────────

console.log('\nCase Schema Validation — v0');
console.log('══════════════════════════════════════════════════════════════\n');

let missingRequiredFields = 0;
let invalidEnumValues     = 0;
let duplicateIds          = 0;
const seenIds = new Set<string>();

for (const c of SEED_CASES_V0) {
  const r = validateCase(c);
  const dupId = seenIds.has(c.id);

  if (!r.valid || dupId) {
    const enumErrors     = r.errors.filter(e => e.includes('is not a valid'));
    const requiredErrors = r.errors.filter(e => !e.includes('is not a valid'));
    invalidEnumValues     += enumErrors.length;
    missingRequiredFields += requiredErrors.length;
    if (dupId) duplicateIds++;
    console.error(`  ✗ ${c.id}  — ${[...r.errors, dupId ? 'duplicate id' : ''].filter(Boolean).join('; ')}`);
  } else {
    console.log(`  ✓ ${c.id}  gap=${c.gap_type.padEnd(11)} action=${c.action.padEnd(10)} outcome=${c.outcome}`);
  }

  seenIds.add(c.id);
}

// ── Enum coverage ──────────────────────────────────────────────────────────

console.log('\n── Enum coverage ──────────────────────────────────────────────\n');

const usedGap      = new Set(SEED_CASES_V0.map(c => c.gap_type));
const usedPressure = new Set(SEED_CASES_V0.flatMap(c => c.pressure));
const usedAction   = new Set(SEED_CASES_V0.map(c => c.action));
const usedOutcome  = new Set(SEED_CASES_V0.map(c => c.outcome));
const usedValues   = new Set(SEED_CASES_V0.flatMap(c => c.values));
const usedPartic   = new Set(SEED_CASES_V0.flatMap(c => c.participants ?? []));

let coverageGaps = 0;

function checkCoverage<T>(label: string, full: Set<T>, used: Set<T>) {
  const missing = [...full].filter(v => !used.has(v));
  if (missing.length) {
    console.warn(`  ⚠ ${label}: missing [${missing.join(', ')}]`);
    coverageGaps += missing.length;
  } else {
    console.log(`  ✓ ${label}: all ${full.size} values covered`);
  }
}

checkCoverage('GapType',       GAP_TYPES,       usedGap as Set<GapType>);
checkCoverage('PressureType',  PRESSURE_TYPES,  usedPressure as Set<PressureType>);
checkCoverage('ActionType',    ACTION_TYPES,    usedAction as Set<ActionType>);
checkCoverage('OutcomeClass',  OUTCOME_CLASSES, usedOutcome as Set<OutcomeClass>);
checkCoverage('ValueID',       VALUE_IDS,       usedValues as Set<ValueID>);
checkCoverage('ParticipantType', PARTICIPANT_TYPES, usedPartic as Set<ParticipantType>);

const cfCount = SEED_CASES_V0.filter(c => c.counterfactual).length;
console.log(`  ✓ Counterfactuals: ${cfCount} cases`);

// ── Similarity engine ──────────────────────────────────────────────────────

console.log('\n── Similarity engine ──────────────────────────────────────────\n');

const testQueries: Array<{ q: Case; expectTopId: string; label: string }> = [
  {
    label: 'value gap, moral+social pressure',
    expectTopId: 'case-001',
    q: {
      id: 'q-value',
      gap_type: 'value',
      pressure: ['moral', 'social'],
      action: 'avoid',
      outcome: 'unresolved',
      values: ['truth', 'loyalty'],
    },
  },
  {
    label: 'relational gap, emotional pressure',
    expectTopId: 'case-005',
    q: {
      id: 'q-relational',
      gap_type: 'relational',
      pressure: ['emotional'],
      action: 'avoid',
      outcome: 'escalated',
      values: ['belonging', 'safety'],
    },
  },
  {
    label: 'power gap, legal+economic',
    expectTopId: 'case-011',
    q: {
      id: 'q-power',
      gap_type: 'power',
      pressure: ['legal', 'economic'],
      action: 'mobilize',
      outcome: 'partial',
      values: ['justice', 'autonomy'],
    },
  },
  {
    label: 'epistemic gap, truth+loyalty',
    expectTopId: 'case-016',
    q: {
      id: 'q-epistemic',
      gap_type: 'epistemic',
      pressure: ['social', 'moral'],
      action: 'avoid',
      outcome: 'escalated',
      values: ['truth', 'loyalty'],
    },
  },
  {
    label: 'resource gap, economic',
    expectTopId: 'case-007',
    q: {
      id: 'q-resource',
      gap_type: 'resource',
      pressure: ['economic', 'emotional'],
      action: 'mobilize',
      outcome: 'partial',
      values: ['autonomy', 'safety'],
    },
  },
];

let engineFails = 0;

for (const { q, label, expectTopId } of testQueries) {
  const result = findMatches(q, SEED_CASES_V0);
  const topMatch = result.matches[0];
  const topScore = topMatch?.score?.toFixed(3) ?? '—';
  const topId    = topMatch?.case_id ?? 'none';
  const selfInResults = result.matches.some(m => m.case_id === q.id);
  const allAboveThreshold = result.matches.every(m => m.score >= SIMILARITY_THRESHOLD);
  const distSum = Object.values(result.outcome_distribution).reduce((a, b) => a + b, 0);

  const ok = result.confidence !== 'insufficient'
    && !selfInResults
    && allAboveThreshold
    && Math.abs(distSum - 1.0) < 0.001;

  if (!ok) engineFails++;

  const flag = ok ? '✓' : '✗';
  console.log(
    `  ${flag} [${label}]\n` +
    `      confidence=${result.confidence}  matches=${result.total_matches}  top=${topId}(${topScore})\n` +
    `      outcome_dist=${JSON.stringify(result.outcome_distribution)}\n`,
  );
}

// Gap category partial credit — isolate the gap component by holding all other fields constant.
// Two synthetic cases differ only in gap_type: same category (normative) vs different category.
const gapBase: Case = {
  id: 'gap-base',
  gap_type: 'identity',      // normative category
  pressure: ['social'],
  action: 'avoid',
  outcome: 'unresolved',
  values: ['autonomy'],
};
const gapNormative: Case = { ...gapBase, id: 'gap-normative', gap_type: 'value' };      // same category → 0.5
const gapDifferent: Case = { ...gapBase, id: 'gap-different', gap_type: 'relational' }; // different    → 0.0
const simNorm = computeSimilarity(gapBase, gapNormative);
const simDiff = computeSimilarity(gapBase, gapDifferent);
const gapCreditOk = simNorm > simDiff;
if (!gapCreditOk) engineFails++;
console.log(
  `  ${gapCreditOk ? '✓' : '✗'} Gap category partial credit:\n` +
  `      identity↔value(normative=${simNorm.toFixed(4)}) > identity↔relational(interpersonal=${simDiff.toFixed(4)})\n`,
);

// Symmetry: sim(A,B) == sim(B,A)
const a = SEED_CASES_V0[0];
const b = SEED_CASES_V0[3];
const symOk = Math.abs(computeSimilarity(a, b) - computeSimilarity(b, a)) < 1e-10;
if (!symOk) engineFails++;
console.log(`  ${symOk ? '✓' : '✗'} computeSimilarity is symmetric`);

// Identical case → score = 1.0 (within floating-point tolerance)
const twin: Case = { ...SEED_CASES_V0[0], id: 'twin' };
const identicalSim = computeSimilarity(SEED_CASES_V0[0], twin);
const identicalOk = Math.abs(identicalSim - 1.0) < 1e-10;
if (!identicalOk) engineFails++;
console.log(`  ${identicalOk ? '✓' : '✗'} Identical case scores 1.0 (got ${identicalSim.toFixed(10)})`);

// Empty database → insufficient
const emptyResult = findMatches(testQueries[0].q, []);
const emptyOk = emptyResult.confidence === 'insufficient' && emptyResult.total_matches === 0;
if (!emptyOk) engineFails++;
console.log(`  ${emptyOk ? '✓' : '✗'} Empty database → confidence=insufficient`);

// ── Summary ────────────────────────────────────────────────────────────────

const totalCases   = SEED_CASES_V0.length;
const validCases   = totalCases - (missingRequiredFields > 0 || invalidEnumValues > 0 ? 1 : 0);
const similarityReady = missingRequiredFields === 0 && invalidEnumValues === 0 && duplicateIds === 0;

console.log('\n══════════════════════════════════════════════════════════════');
console.log('Summary\n');
console.log(`  ${missingRequiredFields === 0 && invalidEnumValues === 0 && duplicateIds === 0 ? '✓' : '✗'} ${totalCases} / ${totalCases} cases valid`);
console.log(`  Missing required fields : ${missingRequiredFields}`);
console.log(`  Invalid enum values     : ${invalidEnumValues}`);
console.log(`  Duplicate IDs           : ${duplicateIds}`);
console.log(`  Enum coverage gaps      : ${coverageGaps}`);
console.log(`  Engine check failures   : ${engineFails}`);
console.log(`  Similarity-ready        : ${similarityReady && engineFails === 0 ? 'YES' : 'NO'}`);
console.log('');

if (missingRequiredFields + invalidEnumValues + duplicateIds + coverageGaps + engineFails > 0) {
  process.exit(1);
}
