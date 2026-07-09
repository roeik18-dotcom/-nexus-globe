/**
 * Case Pattern Engine — Similarity Benchmark
 * Run: npx tsx scripts/benchmarkCaseSimilarity.ts
 *
 * Verifies that the similarity engine ranks 25 case pairs in the expected order:
 *
 *   10 positive pairs   — structurally similar; expected score ≥ 0.65 (STRONG_MATCH)
 *   10 negative pairs   — structurally dissimilar; expected score < 0.40 (SIMILARITY_THRESHOLD)
 *    5 borderline pairs — partially similar; expected score 0.35–0.70
 *
 * Pass conditions:
 *   P1  All 10 positive pairs ≥ POSITIVE_MIN (0.65)
 *   P2  All 10 negative pairs < NEGATIVE_MAX (0.40)
 *   P3  All  5 borderline pairs in [BORDERLINE_MIN, BORDERLINE_MAX] (0.35–0.70)
 *   P4  min(positive_scores) > max(negative_scores)     — no rank inversion
 *   P5  findMatches ranking: for each positive pair (A, B), querying a challenge
 *       database of {B} + all 10 negative cases returns B as the top result
 */

import { computeSimilarity, findMatches, type Case } from '../app/lib/caseSchema';

// ── Thresholds ────────────────────────────────────────────────────────────────

const POSITIVE_MIN   = 0.65;   // = STRONG_MATCH
const NEGATIVE_MAX   = 0.40;   // = SIMILARITY_THRESHOLD
const BORDERLINE_MIN = 0.40;   // borderline starts where negative ends
const BORDERLINE_MAX = 0.65;   // borderline ends where positive begins

// ── Benchmark pairs ───────────────────────────────────────────────────────────
//
// Expected scores (pre-verified):
//   sim = 0.40·jaccard(values) + 0.30·jaccard(pressure) + 0.20·gapSim + 0.10·jaccard(participants)
//
// Positive pair design principle: cases share the same core structure — gap type (or same
// category), values at stake, and pressure sources — but may differ in action or outcome.
// Negative pair design principle: all structural components differ across the four
// similarity dimensions.
// Borderline pairs: share one strong component and partially share one or two others.

type Pair = { id: string; label: string; a: Case; b: Case; expectedScore: number };

const positivePairs: Pair[] = [
  {
    id: 'PP-01',
    label: 'Same gap/values/pressure — truth-vs-loyalty under moral+social pressure',
    // Expected: values=1.0, pressure=1.0, gap=1.0 → 0.9
    expectedScore: 0.9,
    a: { id: 'pp01-a', gap_type: 'value',    pressure: ['moral','social'],    action: 'approach',  outcome: 'unresolved',  values: ['truth','loyalty'] },
    b: { id: 'pp01-b', gap_type: 'value',    pressure: ['moral','social'],    action: 'avoid',     outcome: 'unresolved',  values: ['truth','loyalty'] },
  },
  {
    id: 'PP-02',
    label: 'Same gap/values, partial pressure overlap — relational disconnection',
    // Expected: values=1.0, pressure=jaccard([emotional,social],[emotional,moral])=1/3=0.33, gap=1.0 → 0.7
    expectedScore: 0.7,
    a: { id: 'pp02-a', gap_type: 'relational', pressure: ['emotional','social'], action: 'approach', outcome: 'escalated', values: ['belonging','loyalty'] },
    b: { id: 'pp02-b', gap_type: 'relational', pressure: ['emotional','moral'],  action: 'avoid',    outcome: 'partial',   values: ['belonging','loyalty'] },
  },
  {
    id: 'PP-03',
    label: 'Normative category (value↔identity) — identical values+pressure',
    // Expected: values=1.0, pressure=1.0, gap=0.5 (same normative category) → 0.8
    expectedScore: 0.8,
    a: { id: 'pp03-a', gap_type: 'value',    pressure: ['social','emotional'], action: 'mobilize',  outcome: 'partial',     values: ['autonomy','belonging'] },
    b: { id: 'pp03-b', gap_type: 'identity', pressure: ['social','emotional'], action: 'surrender', outcome: 'unresolved',  values: ['autonomy','belonging'] },
  },
  {
    id: 'PP-04',
    label: 'Interpersonal category (relational↔power) — good value overlap, exact pressure',
    // Expected: values=2/3=0.67, pressure=1.0, gap=0.5 (interpersonal) → 0.667
    expectedScore: 0.667,
    a: { id: 'pp04-a', gap_type: 'relational', pressure: ['emotional','social'], action: 'avoid',     outcome: 'escalated', values: ['belonging','autonomy','safety'] },
    b: { id: 'pp04-b', gap_type: 'power',      pressure: ['emotional','social'], action: 'surrender', outcome: 'unresolved',values: ['belonging','autonomy'] },
  },
  {
    id: 'PP-05',
    label: 'Same power gap — same values, high pressure overlap (3 shared of 4)',
    // Expected: values=1.0, pressure=2/4=0.5, gap=1.0 → 0.75
    expectedScore: 0.75,
    a: { id: 'pp05-a', gap_type: 'power', pressure: ['legal','economic','social'], action: 'mobilize',  outcome: 'partial',   values: ['justice','autonomy'] },
    b: { id: 'pp05-b', gap_type: 'power', pressure: ['legal','economic','moral'],  action: 'approach',  outcome: 'resolved',  values: ['justice','autonomy'] },
  },
  {
    id: 'PP-06',
    label: 'Same identity gap — high value overlap (3/4), partial pressure',
    // Expected: values=3/4=0.75, pressure=1/2=0.5, gap=1.0 → 0.65
    expectedScore: 0.65,
    a: { id: 'pp06-a', gap_type: 'identity', pressure: ['social'],           action: 'avoid',     outcome: 'unresolved', values: ['autonomy','dignity','belonging','truth'] },
    b: { id: 'pp06-b', gap_type: 'identity', pressure: ['social','emotional'],action: 'transform', outcome: 'partial',   values: ['autonomy','dignity','belonging'] },
  },
  {
    id: 'PP-07',
    label: 'Normative category (value↔identity) — exact values+pressure, different framing',
    // Expected: values=1.0, pressure=1.0, gap=0.5 → 0.8
    expectedScore: 0.8,
    a: { id: 'pp07-a', gap_type: 'value',    pressure: ['moral','emotional'], action: 'surrender', outcome: 'unresolved', values: ['truth','justice','dignity'] },
    b: { id: 'pp07-b', gap_type: 'identity', pressure: ['moral','emotional'], action: 'avoid',     outcome: 'unresolved', values: ['truth','justice','dignity'] },
  },
  {
    id: 'PP-08',
    label: 'Same relational gap — exact values, partial pressure, participants boost',
    // Expected: values=1.0, pressure=1/2=0.5, gap=1.0, participants=1.0 → 0.85
    expectedScore: 0.85,
    a: { id: 'pp08-a', gap_type: 'relational', pressure: ['emotional'],          action: 'approach', outcome: 'resolved',   values: ['belonging','loyalty'], participants: ['self','partner'] },
    b: { id: 'pp08-b', gap_type: 'relational', pressure: ['emotional','social'], action: 'avoid',    outcome: 'escalated',  values: ['belonging','loyalty'], participants: ['self','partner'] },
  },
  {
    id: 'PP-09',
    label: 'Same resource gap — identical structure, different actions',
    // Expected: values=1.0, pressure=1.0, gap=1.0 → 0.9
    expectedScore: 0.9,
    a: { id: 'pp09-a', gap_type: 'resource', pressure: ['economic','physical'], action: 'none',     outcome: 'unresolved', values: ['safety','autonomy','dignity'] },
    b: { id: 'pp09-b', gap_type: 'resource', pressure: ['economic','physical'], action: 'mobilize', outcome: 'partial',    values: ['safety','autonomy','dignity'] },
  },
  {
    id: 'PP-10',
    label: 'Interpersonal category (power↔relational) — exact values+pressure',
    // Expected: values=1.0, pressure=1.0, gap=0.5 (interpersonal) → 0.8
    expectedScore: 0.8,
    a: { id: 'pp10-a', gap_type: 'power',      pressure: ['legal','social'], action: 'mobilize',  outcome: 'partial',  values: ['justice','autonomy','dignity'] },
    b: { id: 'pp10-b', gap_type: 'relational', pressure: ['legal','social'], action: 'transform', outcome: 'partial',  values: ['justice','autonomy','dignity'] },
  },
];

const negativePairs: Pair[] = [
  {
    id: 'NP-01',
    label: 'Completely orthogonal: value(moral) vs resource(physical), no shared values',
    // Expected: values=0, pressure=0, gap=0 (normative vs material) → 0.0
    expectedScore: 0.0,
    a: { id: 'np01-a', gap_type: 'value',    pressure: ['moral'],    action: 'approach', outcome: 'partial',    values: ['truth','justice'] },
    b: { id: 'np01-b', gap_type: 'resource', pressure: ['physical'], action: 'avoid',    outcome: 'escalated',  values: ['safety'] },
  },
  {
    id: 'NP-02',
    label: 'Completely orthogonal: epistemic(social) vs resource(economic), no shared values',
    // Expected: all 0 → 0.0
    expectedScore: 0.0,
    a: { id: 'np02-a', gap_type: 'epistemic', pressure: ['social'],    action: 'mobilize', outcome: 'resolved',   values: ['truth'] },
    b: { id: 'np02-b', gap_type: 'resource',  pressure: ['economic'],  action: 'avoid',    outcome: 'unresolved', values: ['autonomy'] },
  },
  {
    id: 'NP-03',
    label: 'Same gap type, near-zero overlap elsewhere (different values+pressure)',
    // Expected: values=0, pressure=0, gap=1.0 → 0.2
    expectedScore: 0.2,
    a: { id: 'np03-a', gap_type: 'relational', pressure: ['moral'],    action: 'approach',  outcome: 'partial',    values: ['truth','justice'] },
    b: { id: 'np03-b', gap_type: 'relational', pressure: ['physical'], action: 'surrender', outcome: 'escalated',  values: ['safety','loyalty'] },
  },
  {
    id: 'NP-04',
    label: 'Same category (normative: value↔identity), everything else zero',
    // Expected: values=0, pressure=0, gap=0.5 → 0.1
    expectedScore: 0.1,
    a: { id: 'np04-a', gap_type: 'value',    pressure: ['social'],   action: 'avoid',    outcome: 'unresolved', values: ['belonging'] },
    b: { id: 'np04-b', gap_type: 'identity', pressure: ['physical'], action: 'mobilize', outcome: 'resolved',   values: ['truth'] },
  },
  {
    id: 'NP-05',
    label: 'Same category (interpersonal: power↔relational), no shared values or pressure',
    // Expected: values=0, pressure=0, gap=0.5 (interpersonal) → 0.1
    // np05-b uses economic/truth/growth to avoid accidental overlap with relational positive pairs
    expectedScore: 0.1,
    a: { id: 'np05-a', gap_type: 'power',      pressure: ['legal'],     action: 'mobilize', outcome: 'partial',    values: ['justice','autonomy'] },
    b: { id: 'np05-b', gap_type: 'relational', pressure: ['economic'],  action: 'avoid',    outcome: 'escalated',  values: ['truth','growth'] },
  },
  {
    id: 'NP-06',
    label: 'One shared pressure, no shared values, different gap categories',
    // Expected: values=0, pressure=1/3=0.33, gap=0 (normative vs material) → 0.1
    expectedScore: 0.1,
    a: { id: 'np06-a', gap_type: 'value',    pressure: ['social','moral'],     action: 'approach', outcome: 'unresolved', values: ['truth'] },
    b: { id: 'np06-b', gap_type: 'resource', pressure: ['social','economic'],  action: 'avoid',    outcome: 'partial',    values: ['autonomy'] },
  },
  {
    id: 'NP-07',
    label: 'One shared value, different gap categories, no shared pressure',
    // Expected: values=1/3=0.33, pressure=0, gap=0 (epistemic vs material) → 0.133
    expectedScore: 0.133,
    a: { id: 'np07-a', gap_type: 'epistemic', pressure: ['social'],           action: 'avoid',    outcome: 'escalated',  values: ['truth','loyalty'] },
    b: { id: 'np07-b', gap_type: 'resource',  pressure: ['physical','economic'], action: 'mobilize', outcome: 'partial',  values: ['truth','safety'] },
  },
  {
    id: 'NP-08',
    label: 'Partial pressure overlap, no shared values, cross-category gap (normative vs interpersonal)',
    // Expected: values=0, pressure=1/2=0.5, gap=0 → 0.15
    expectedScore: 0.15,
    a: { id: 'np08-a', gap_type: 'identity', pressure: ['emotional'],          action: 'surrender', outcome: 'unresolved', values: ['dignity','autonomy'] },
    b: { id: 'np08-b', gap_type: 'power',    pressure: ['emotional','legal'],  action: 'mobilize',  outcome: 'resolved',   values: ['justice','safety'] },
  },
  {
    id: 'NP-09',
    label: 'Completely orthogonal: relational(emotional) vs epistemic(legal)',
    // Expected: values=0, pressure=0, gap=0 (interpersonal vs epistemic) → 0.0
    expectedScore: 0.0,
    a: { id: 'np09-a', gap_type: 'relational', pressure: ['emotional'], action: 'approach', outcome: 'resolved',   values: ['belonging'] },
    b: { id: 'np09-b', gap_type: 'epistemic',  pressure: ['legal'],     action: 'mobilize', outcome: 'partial',    values: ['truth','justice'] },
  },
  {
    id: 'NP-10',
    label: 'Participants overlap only — all four components differ',
    // Expected: values=0, pressure=0, gap=0 (normative vs material), participants=1.0 → 0.1
    expectedScore: 0.1,
    a: { id: 'np10-a', gap_type: 'value',    pressure: ['moral'],    action: 'avoid',     outcome: 'unresolved', values: ['truth'],   participants: ['self','family'] },
    b: { id: 'np10-b', gap_type: 'resource', pressure: ['physical'], action: 'surrender', outcome: 'escalated',  values: ['safety'],  participants: ['self','family'] },
  },
];

const borderlinePairs: Pair[] = [
  {
    id: 'BP-01',
    label: 'Interpersonal category (relational↔power), exact pressure, weak value overlap',
    // Expected: values=1/4=0.25, pressure=1.0, gap=0.5 → 0.5
    expectedScore: 0.5,
    a: { id: 'bp01-a', gap_type: 'relational', pressure: ['emotional','social'], action: 'approach',  outcome: 'partial',    values: ['belonging','loyalty','safety'] },
    b: { id: 'bp01-b', gap_type: 'power',      pressure: ['emotional','social'], action: 'transform', outcome: 'unresolved', values: ['autonomy','belonging'] },
  },
  {
    id: 'BP-02',
    label: 'Same gap, partial value overlap (1/3), partial pressure overlap (1/3)',
    // Expected: values=1/3=0.33, pressure=1/3=0.33, gap=1.0 → 0.433
    expectedScore: 0.433,
    a: { id: 'bp02-a', gap_type: 'value', pressure: ['moral','social'],    action: 'approach',  outcome: 'unresolved', values: ['truth','justice'] },
    b: { id: 'bp02-b', gap_type: 'value', pressure: ['moral','emotional'], action: 'surrender', outcome: 'partial',    values: ['truth','loyalty'] },
  },
  {
    id: 'BP-03',
    label: 'Same relational gap, 1 shared value (1/3), 1 shared pressure (1/3)',
    // Expected: values=1/3=0.33, pressure=1/3=0.33, gap=1.0 → 0.433
    expectedScore: 0.433,
    a: { id: 'bp03-a', gap_type: 'relational', pressure: ['social','emotional'], action: 'approach', outcome: 'resolved',   values: ['belonging','loyalty'] },
    b: { id: 'bp03-b', gap_type: 'relational', pressure: ['social','physical'],  action: 'avoid',    outcome: 'escalated',  values: ['belonging','safety'] },
  },
  {
    id: 'BP-04',
    label: 'Same power gap, moderate value overlap (2/3=0.67), weak pressure overlap (1/3)',
    // Expected: values=jaccard([justice,autonomy,safety],[justice,safety])=2/3=0.67,
    //           pressure=jaccard([legal,economic],[economic,social])=1/3=0.33, gap=1.0 → 0.567
    expectedScore: 0.567,
    a: { id: 'bp04-a', gap_type: 'power', pressure: ['legal','economic'],        action: 'mobilize', outcome: 'partial',    values: ['justice','autonomy','safety'] },
    b: { id: 'bp04-b', gap_type: 'power', pressure: ['economic','social'],       action: 'approach', outcome: 'unresolved', values: ['justice','safety'] },
  },
  {
    id: 'BP-05',
    label: 'Normative category (identity↔value), moderate value (2/4=0.5), high pressure (2/3)',
    // Expected: values=2/4=0.5, pressure=2/3=0.67, gap=0.5 → 0.5
    expectedScore: 0.5,
    a: { id: 'bp05-a', gap_type: 'identity', pressure: ['social','emotional','moral'], action: 'avoid',    outcome: 'unresolved', values: ['autonomy','belonging','dignity'] },
    b: { id: 'bp05-b', gap_type: 'value',    pressure: ['social','moral'],             action: 'approach', outcome: 'partial',    values: ['truth','dignity','autonomy'] },
  },
];

// ── Run benchmark ─────────────────────────────────────────────────────────────

console.log('\nCase Similarity Benchmark — v0');
console.log('══════════════════════════════════════════════════════════════\n');

type Result = { pair: Pair; score: number; pass: boolean; category: string };
const results: Result[] = [];

function runGroup(pairs: Pair[], category: string, min: number, max: number | null) {
  console.log(`── ${category} pairs ─────────────────────────────────────────\n`);
  let groupPass = 0;

  for (const pair of pairs) {
    const score = computeSimilarity(pair.a, pair.b);
    const pass  = max === null ? score >= min : score >= min && score < max;
    results.push({ pair, score, pass, category });

    const flag   = pass ? '✓' : '✗';
    const range  = max === null ? `≥${min}` : `${min}–${max}`;
    const delta  = Math.abs(score - pair.expectedScore);
    const deltaStr = delta > 0.001 ? `  ⚠ expected ${pair.expectedScore.toFixed(4)}` : '';
    console.log(`  ${flag} ${pair.id}  score=${score.toFixed(4)}  [${range}]${deltaStr}`);
    console.log(`      ${pair.label}\n`);

    if (pass) groupPass++;
  }
  return groupPass;
}

const posPass  = runGroup(positivePairs,  'Positive',   POSITIVE_MIN,   null);
const negPass  = runGroup(negativePairs,  'Negative',   0,              NEGATIVE_MAX);
const bpPass   = runGroup(borderlinePairs,'Borderline', BORDERLINE_MIN, BORDERLINE_MAX);

// ── Ranking check (P4) ────────────────────────────────────────────────────────

console.log('── Ranking check ─────────────────────────────────────────────\n');

const positiveScores  = results.filter(r => r.category === 'Positive').map(r => r.score);
const negativeScores  = results.filter(r => r.category === 'Negative').map(r => r.score);
const borderlineScores= results.filter(r => r.category === 'Borderline').map(r => r.score);

const minPos    = Math.min(...positiveScores);
const maxNeg    = Math.max(...negativeScores);
const minBp     = Math.min(...borderlineScores);
const maxBp     = Math.max(...borderlineScores);

// Two-level ranking check:
//   positive > borderline > negative
const rankPosAboveBp  = minPos > maxBp;
const rankBpAboveNeg  = minBp  > maxNeg;

console.log(`  ${rankPosAboveBp ? '✓' : '✗'} min(positive)=${minPos.toFixed(4)} > max(borderline)=${maxBp.toFixed(4)}  →  positives above borderlines`);
console.log(`  ${rankBpAboveNeg ? '✓' : '✗'} min(borderline)=${minBp.toFixed(4)} > max(negative)=${maxNeg.toFixed(4)}    →  borderlines above negatives`);
console.log('');

// ── findMatches ranking check (P5) ────────────────────────────────────────────
// For each positive pair (A, B), build a challenge database of {B} + all 10 negative B-cases.
// Query with A. B must appear as the top result.

console.log('── findMatches ranking check ──────────────────────────────────\n');
console.log('  (For each positive pair A↔B, queries challenge_db = {B} + all 10 negative cases)');
console.log('  B must rank first in results.\n');

const negCasesForDB: Case[] = negativePairs.flatMap(p => [p.a, p.b]);
let findMatchesPass = 0;

for (const pp of positivePairs) {
  // Assign unique db ids to avoid self-exclusion collisions
  const bForDB: Case = { ...pp.b, id: `${pp.b.id}-db` };
  const challengeDB: Case[] = [bForDB, ...negCasesForDB];
  const query: Case = { ...pp.a };

  const output = findMatches(query, challengeDB, 20);
  const topMatch = output.matches[0];
  const bIsTop = topMatch?.case_id === bForDB.id;

  if (bIsTop) findMatchesPass++;
  const flag = bIsTop ? '✓' : '✗';
  console.log(`  ${flag} ${pp.id}: top=${topMatch?.case_id ?? 'none'}(${topMatch?.score?.toFixed(4) ?? '—'})  ${bIsTop ? 'B ranked first' : `B ranked ${output.matches.findIndex(m => m.case_id === bForDB.id) + 1}`}`);
}
console.log('');

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('══════════════════════════════════════════════════════════════');
console.log('Summary\n');

const p1 = posPass  === positivePairs.length;
const p2 = negPass  === negativePairs.length;
const p3 = bpPass   === borderlinePairs.length;
const p4 = rankPosAboveBp && rankBpAboveNeg;
const p5 = findMatchesPass === positivePairs.length;
const allPass = p1 && p2 && p3 && p4 && p5;

console.log(`  P1 Positive pairs ≥ ${POSITIVE_MIN}     : ${posPass}/${positivePairs.length}   ${p1 ? '✓' : '✗'}`);
console.log(`  P2 Negative pairs < ${NEGATIVE_MAX}     : ${negPass}/${negativePairs.length}  ${p2 ? '✓' : '✗'}`);
console.log(`  P3 Borderline pairs in range : ${bpPass}/${borderlinePairs.length}    ${p3 ? '✓' : '✗'}`);
console.log(`  P4 Ranking (pos>bp>neg)       :          ${p4 ? '✓' : '✗'}  ${minPos.toFixed(4)} > ${maxBp.toFixed(4)} > ${maxNeg.toFixed(4)}`);
console.log(`  P5 findMatches B ranks first : ${findMatchesPass}/${positivePairs.length}  ${p5 ? '✓' : '✗'}`);
console.log('');
console.log(`  Verdict: ${allPass ? '✓ PASS — engine ranks pairs as expected' : '✗ FAIL — see failures above'}`);
console.log('');

if (!allPass) process.exit(1);
