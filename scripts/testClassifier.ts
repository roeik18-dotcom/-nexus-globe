/**
 * Classifier integration test — 5 real situations
 * Run: npx tsx scripts/testClassifier.ts
 *
 * Tests the full pipeline:
 *   situation text → classifySituationToCase → findMatches → explanation
 *
 * Evaluate manually:
 *   1. Schema fields — does the classification make sense for the situation?
 *   2. Matches        — are the matched seed cases structurally relevant?
 *   3. Outcome dist   — does the distribution reflect plausible real-world outcomes?
 *   4. Action paths   — are the paths and risk levels realistic?
 */

import { analyzeHumanSituation } from '../app/lib/classifySituationToCase';
import SEED_CASES_V0 from '../app/lib/caseSeedV0';

// ── Test situations ────────────────────────────────────────────────────────────

const TESTS: Array<{ label: string; text: string }> = [
  {
    label: 'Workplace ethics',
    text: `My manager asked me to sign off on a financial report that I know contains inflated numbers. \
He says this is standard practice and everyone here does it. I haven't said anything yet — I've been \
avoiding the conversation — but he's following up now and wants my signature by end of week. \
If I refuse I'm worried about losing the job.`,
  },

  {
    label: 'Friendship breakdown',
    text: `My closest friend of twelve years stopped speaking to me after I missed her wedding. \
I couldn't make it because of a sudden family medical emergency that week. I've called, texted, \
and sent a long message explaining and apologizing, but she hasn't responded to any of it. \
I keep reaching out every few weeks and getting nothing back. I don't know how much longer to keep trying.`,
  },

  {
    label: 'Landlord rights violation',
    text: `My landlord has been entering my apartment without giving notice — multiple times a month. \
I've asked him verbally to stop and sent a written letter citing the relevant law. He keeps doing it. \
I know I have legal rights here but I'm afraid that if I escalate this he'll find a way to not renew \
my lease or make things difficult. I haven't taken any formal steps yet.`,
  },

  {
    label: 'Return to work after parenting',
    text: `I took seven years off my career as a software engineer to raise my kids. Now that they're all \
in school I want to go back to work. I brought this up with my partner who says we don't financially need \
the income so why add stress. My parents think a mother's place is at home. I've started applying for jobs \
quietly and had some interviews, but the tension at home is growing and I'm starting to doubt whether I'm \
making the right choice.`,
  },

  {
    label: 'Medical dismissal',
    text: `For eight months I've had persistent exhaustion, joint pain, and difficulty concentrating. \
My doctor has run standard blood work twice and says everything is normal. I keep raising it at every \
appointment but feel like I'm being dismissed — just told to sleep better and exercise more. \
I've requested a referral to a specialist twice and been told it's not necessary. \
I know something is wrong but I don't know whether to push harder, find a new doctor, or accept the diagnosis.`,
  },
];

// ── Formatting helpers ─────────────────────────────────────────────────────────

const W = 70;
const HR  = '─'.repeat(W);
const HR2 = '═'.repeat(W);

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function pad(s: string, w: number): string {
  return s.padEnd(w);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nClassifier Integration Test — ${TESTS.length} situations`);
  console.log(`Database: ${SEED_CASES_V0.length} seed cases`);
  console.log(HR2 + '\n');

  const summary: Array<{
    label:      string;
    gap_type:   string;
    pressure:   string;
    action:     string;
    outcome:    string;
    confidence: string;
    matches:    number;
  }> = [];

  for (let i = 0; i < TESTS.length; i++) {
    const { label, text } = TESTS[i];

    console.log(`TEST ${i + 1} — ${label}`);
    console.log(HR2);

    console.log('\nSituation:');
    // Wrap at ~66 chars
    const words = text.split(' ');
    let line = '  ';
    for (const word of words) {
      if (line.length + word.length > 68) {
        console.log(line);
        line = '  ' + word + ' ';
      } else {
        line += word + ' ';
      }
    }
    if (line.trim()) console.log(line);

    let result;
    try {
      result = await analyzeHumanSituation(text, SEED_CASES_V0);
    } catch (err) {
      console.error(`\n  ERROR: ${err instanceof Error ? err.message : String(err)}\n`);
      continue;
    }

    const { case: c, matches: m } = result;

    // ── Classification ──────────────────────────────────────────────────────
    console.log(`\n── Classification ${HR.slice(18)}`);
    console.log(`  gap_type     : ${c.gap_type}`);
    console.log(`  pressure     : [${c.pressure.join(', ')}]`);
    console.log(`  action       : ${c.action}`);
    console.log(`  outcome      : ${c.outcome}`);
    console.log(`  values       : [${c.values.join(', ')}]`);
    if (c.participants?.length) {
      console.log(`  participants : [${c.participants.join(', ')}]`);
    }
    if (c.intensity !== undefined) {
      console.log(`  intensity    : ${c.intensity.toFixed(2)}`);
    }
    if (c.gap_description) {
      // Wrap long descriptions
      const desc = c.gap_description;
      if (desc.length <= 58) {
        console.log(`  gap_desc     : ${desc}`);
      } else {
        console.log(`  gap_desc     : ${desc.slice(0, 58)}`);
        console.log(`                 ${desc.slice(58)}`);
      }
    }

    // ── Matches ─────────────────────────────────────────────────────────────
    console.log(`\n── Matches (confidence=${m.confidence}, n=${m.total_matches}) ${HR.slice(36)}`);
    if (m.total_matches === 0) {
      console.log('  (none above threshold)');
    } else {
      for (const match of m.matches.slice(0, 5)) {
        const seedCase = SEED_CASES_V0.find(sc => sc.id === match.case_id);
        const pressStr = seedCase ? `[${seedCase.pressure.join('+')}]` : '';
        console.log(
          `  ${pad(match.case_id, 10)}  ${match.score.toFixed(3)}  ` +
          `${pad(match.outcome, 12)}  ${pad(match.action, 10)}  ${pressStr}`,
        );
      }
      if (m.total_matches > 5) {
        console.log(`  … and ${m.total_matches - 5} more`);
      }
    }

    // ── Outcome distribution ────────────────────────────────────────────────
    console.log(`\n── Outcome distribution ${HR.slice(24)}`);
    const sortedOutcomes = (Object.entries(m.outcome_distribution) as [string, number][])
      .sort(([, a], [, b]) => b - a);
    for (const [outcome, frac] of sortedOutcomes) {
      const bar = '█'.repeat(Math.round(frac * 20));
      console.log(`  ${pad(outcome, 14)}  ${pad(pct(frac), 5)}  ${bar}`);
    }

    // ── Action paths ────────────────────────────────────────────────────────
    console.log(`\n── Action paths ${HR.slice(16)}`);
    if (m.action_paths.length === 0) {
      console.log('  (no paths — insufficient matches)');
    } else {
      for (const path of m.action_paths) {
        const pathOutcomes = (Object.entries(path.outcome_distribution) as [string, number][])
          .sort(([, a], [, b]) => b - a)
          .map(([o, f]) => `${o}=${pct(f)}`)
          .join('  ');
        console.log(
          `  ${pad(path.action, 10)}  ${pad(pct(path.frequency), 5)}  ` +
          `risk=${pad(path.risk_level, 7)}  ${pathOutcomes}`,
        );
      }
    }

    // ── Explanation ─────────────────────────────────────────────────────────
    console.log(`\n── Explanation ${HR.slice(15)}`);
    // Wrap explanation text at 66 chars
    const expWords = result.explanation.split(' ');
    let expLine = '  ';
    for (const word of expWords) {
      if (expLine.length + word.length > 68) {
        console.log(expLine);
        expLine = '  ' + word + ' ';
      } else {
        expLine += word + ' ';
      }
    }
    if (expLine.trim()) console.log(expLine);

    console.log('\n' + HR2 + '\n');

    summary.push({
      label,
      gap_type:   c.gap_type,
      pressure:   c.pressure.join('+'),
      action:     c.action,
      outcome:    c.outcome,
      confidence: m.confidence,
      matches:    m.total_matches,
    });
  }

  // ── Summary table ──────────────────────────────────────────────────────────
  console.log('SUMMARY');
  console.log(HR2);
  console.log(
    `  ${pad('#', 3)} ` +
    `${pad('Label', 30)} ` +
    `${pad('Gap', 12)} ` +
    `${pad('Action', 10)} ` +
    `${pad('Outcome', 12)} ` +
    `${pad('Conf', 12)} ` +
    `N`,
  );
  console.log(`  ${HR}`);
  for (let i = 0; i < summary.length; i++) {
    const s = summary[i];
    console.log(
      `  ${pad(String(i + 1), 3)} ` +
      `${pad(s.label, 30)} ` +
      `${pad(s.gap_type, 12)} ` +
      `${pad(s.action, 10)} ` +
      `${pad(s.outcome, 12)} ` +
      `${pad(s.confidence, 12)} ` +
      `${s.matches}`,
    );
  }
  console.log('');
}

main().catch(err => {
  console.error('\nFatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
