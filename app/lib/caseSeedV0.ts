/**
 * Case Pattern Engine — Manual Cases v0
 * Layer 4 (Application) | Evidence: D — Hypothesis
 * Spec: docs/case-schema-v0.md
 *
 * 20 annotated cases covering the full range of enum values.
 * These are the ground truth for engine validation.
 * DO NOT modify cases after the similarity engine is calibrated against them.
 */

import type { Case } from './caseSchema';

export const SEED_CASES_V0: Case[] = [

  // ── Value gaps ─────────────────────────────────────────────────────────────

  {
    id: 'case-001',
    gap_type: 'value',
    pressure: ['moral', 'social'],
    action: 'avoid',
    outcome: 'unresolved',
    values: ['truth', 'loyalty'],
    situation_text: 'Someone asked me to stay silent about information that could hurt a friend but also protect the group.',
    participants: ['self', 'friend'],
    gap_description: 'Truth-telling vs. loyalty to the group — both feel mandatory.',
    outcome_description: 'Stayed silent. Tension remains. Relationship feels dishonest.',
    intensity: 0.7,
    duration_days: 14,
  },

  {
    id: 'case-002',
    gap_type: 'value',
    pressure: ['moral', 'emotional'],
    action: 'approach',
    outcome: 'partial',
    values: ['truth', 'justice', 'dignity'],
    situation_text: 'Witnessed a colleague taking credit for someone else\'s work in a meeting.',
    participants: ['self', 'colleague', 'employer'],
    gap_description: 'What I know to be true vs. what was publicly claimed.',
    outcome_description: 'Spoke up privately to the manager. Credit was partially corrected but no formal acknowledgment.',
    intensity: 0.6,
    duration_days: 3,
  },

  {
    id: 'case-003',
    gap_type: 'value',
    pressure: ['economic', 'moral'],
    action: 'surrender',
    outcome: 'escalated',
    values: ['autonomy', 'justice'],
    situation_text: 'Employer changed contract terms retroactively under financial pressure, demanding agreement.',
    participants: ['self', 'employer'],
    gap_description: 'Fair treatment vs. economic pressure to accept unfair terms.',
    outcome_description: 'Accepted new terms. Financial stability maintained but felt the loss of standing.',
    intensity: 0.8,
    duration_days: 30,
  },

  // ── Relational gaps ────────────────────────────────────────────────────────

  {
    id: 'case-004',
    gap_type: 'relational',
    pressure: ['emotional', 'social'],
    action: 'approach',
    outcome: 'resolved',
    values: ['belonging', 'loyalty'],
    situation_text: 'A close friend went silent after a disagreement. I was unsure whether to reach out.',
    participants: ['self', 'friend'],
    gap_description: 'Connection I was seeking vs. the disconnection created by the conflict.',
    outcome_description: 'Reached out directly. Friend explained they needed time. Relationship restored.',
    intensity: 0.5,
    duration_days: 7,
  },

  {
    id: 'case-005',
    gap_type: 'relational',
    pressure: ['emotional'],
    action: 'avoid',
    outcome: 'escalated',
    values: ['belonging', 'safety'],
    situation_text: 'Partner has been distant for weeks. I don\'t bring it up to avoid conflict.',
    participants: ['self', 'partner'],
    gap_description: 'The closeness I need vs. the growing distance.',
    outcome_description: 'Distance grew. Partner felt I didn\'t care. Relationship reached a crisis point.',
    intensity: 0.75,
    duration_days: 45,
  },

  {
    id: 'case-006',
    gap_type: 'relational',
    pressure: ['social', 'emotional'],
    action: 'transform',
    outcome: 'transformed',
    values: ['belonging', 'growth', 'autonomy'],
    situation_text: 'Family expected me to attend every weekly gathering. I was burning out but felt guilty refusing.',
    participants: ['self', 'family'],
    gap_description: 'The belonging I needed vs. the form of belonging they required.',
    outcome_description: 'Negotiated monthly gatherings instead of weekly. Relationship changed shape but continued.',
    intensity: 0.6,
    duration_days: 60,
    counterfactual: {
      paths_not_taken: ['avoid', 'surrender'],
      values_not_activated: ['loyalty'],
      outcomes_not_realized: [
        { class: 'escalated', description: 'Continued attending until complete withdrawal' },
        { class: 'unresolved', description: 'Continued pattern without addressing it' },
      ],
    },
  },

  // ── Resource gaps ──────────────────────────────────────────────────────────

  {
    id: 'case-007',
    gap_type: 'resource',
    pressure: ['economic', 'emotional'],
    action: 'mobilize',
    outcome: 'partial',
    values: ['safety', 'autonomy'],
    situation_text: 'Lost main source of income unexpectedly. Savings would last 3 months.',
    participants: ['self'],
    gap_description: 'Financial stability needed vs. no income available.',
    outcome_description: 'Found part-time work within 6 weeks. Full recovery took 5 months.',
    intensity: 0.9,
    duration_days: 150,
  },

  {
    id: 'case-008',
    gap_type: 'resource',
    pressure: ['economic', 'social'],
    action: 'approach',
    outcome: 'resolved',
    values: ['dignity', 'autonomy'],
    situation_text: 'Needed financial support from family but dreaded asking.',
    participants: ['self', 'family'],
    gap_description: 'Money needed vs. the cost to dignity of asking.',
    outcome_description: 'Asked. Family helped without judgment. Financial pressure resolved.',
    intensity: 0.65,
    duration_days: 10,
  },

  // ── Identity gaps ──────────────────────────────────────────────────────────

  {
    id: 'case-009',
    gap_type: 'identity',
    pressure: ['social', 'emotional'],
    action: 'avoid',
    outcome: 'unresolved',
    values: ['autonomy', 'belonging'],
    situation_text: 'Career path chosen by family does not match who I feel I am. Stayed silent for years.',
    participants: ['self', 'family'],
    gap_description: 'Who I am vs. who my family needs me to be professionally.',
    outcome_description: 'Still working in the family-chosen career. Identity tension ongoing.',
    intensity: 0.8,
    duration_days: 1460,
  },

  {
    id: 'case-010',
    gap_type: 'identity',
    pressure: ['social', 'moral'],
    action: 'transform',
    outcome: 'partial',
    values: ['truth', 'autonomy', 'dignity'],
    situation_text: 'Religious community expected practices I no longer believed in. Coming out as changed felt dangerous.',
    participants: ['self', 'family', 'society'],
    gap_description: 'Who I genuinely am vs. who the community expects me to perform.',
    outcome_description: 'Disclosed to close family. Accepted by some, rejected by others. Community expectation unchanged.',
    intensity: 0.85,
    duration_days: 180,
    counterfactual: {
      paths_not_taken: ['approach', 'avoid'],
      values_not_activated: ['loyalty'],
      outcomes_not_realized: [
        { class: 'resolved', description: 'Full community acceptance of changed identity' },
        { class: 'escalated', description: 'Complete ostracism from community' },
      ],
    },
  },

  // ── Power gaps ─────────────────────────────────────────────────────────────

  {
    id: 'case-011',
    gap_type: 'power',
    pressure: ['legal', 'economic'],
    action: 'mobilize',
    outcome: 'partial',
    values: ['justice', 'autonomy'],
    situation_text: 'Employer violated labor law. Filing a complaint risked retaliation.',
    participants: ['self', 'employer', 'institution'],
    gap_description: 'My legal rights vs. the power the employer held over my livelihood.',
    outcome_description: 'Filed complaint with labor board. Settlement reached but employer relationship ended.',
    intensity: 0.9,
    duration_days: 90,
  },

  {
    id: 'case-012',
    gap_type: 'power',
    pressure: ['social', 'emotional'],
    action: 'none',
    outcome: 'unresolved',
    values: ['dignity', 'autonomy'],
    situation_text: 'Manager consistently took credit for team ideas in front of senior leadership.',
    participants: ['self', 'employer', 'colleague'],
    gap_description: 'My agency over my own work vs. the manager\'s structural control over visibility.',
    outcome_description: 'Did nothing. Situation continued. Disengaged slowly over the following year.',
    intensity: 0.7,
    duration_days: 365,
  },

  {
    id: 'case-013',
    gap_type: 'power',
    pressure: ['physical', 'emotional'],
    action: 'mobilize',
    outcome: 'resolved',
    values: ['safety', 'justice', 'autonomy'],
    situation_text: 'Experienced harassment in a shared living situation. Landlord refused to act.',
    participants: ['self', 'institution'],
    gap_description: 'Need for safety at home vs. landlord\'s refusal to enforce it.',
    outcome_description: 'Involved housing authority. Harasser was removed. Moved out voluntarily 2 months later.',
    intensity: 0.95,
    duration_days: 45,
  },

  // ── Epistemic gaps ─────────────────────────────────────────────────────────

  {
    id: 'case-014',
    gap_type: 'epistemic',
    pressure: ['emotional', 'social'],
    action: 'approach',
    outcome: 'partial',
    values: ['truth', 'belonging'],
    situation_text: 'Sensed something was wrong in a relationship but got deflected every time I asked.',
    participants: ['self', 'partner'],
    gap_description: 'What I sensed to be true vs. what I was permitted to know.',
    outcome_description: 'Kept asking. Partner eventually disclosed a hidden difficulty. Full picture still unclear.',
    intensity: 0.65,
    duration_days: 21,
  },

  {
    id: 'case-015',
    gap_type: 'epistemic',
    pressure: ['legal', 'economic'],
    action: 'mobilize',
    outcome: 'resolved',
    values: ['truth', 'justice', 'autonomy'],
    situation_text: 'Organization withheld information I needed to make an informed decision about a contract.',
    participants: ['self', 'institution'],
    gap_description: 'Information I was entitled to vs. institutional control over disclosure.',
    outcome_description: 'Formally requested documents under applicable law. Information released. Decision made on full facts.',
    intensity: 0.7,
    duration_days: 30,
  },

  {
    id: 'case-016',
    gap_type: 'epistemic',
    pressure: ['social', 'moral'],
    action: 'avoid',
    outcome: 'escalated',
    values: ['truth', 'loyalty'],
    situation_text: 'Aware of something happening in my social group that others didn\'t know. Felt dangerous to share.',
    participants: ['self', 'friend', 'society'],
    gap_description: 'What I knew vs. what I was willing to say given the social cost.',
    outcome_description: 'Said nothing. The situation unfolded badly. My silence was later seen as complicity.',
    intensity: 0.75,
    duration_days: 20,
  },

  // ── Mixed / harder cases ───────────────────────────────────────────────────

  {
    id: 'case-017',
    gap_type: 'value',
    pressure: ['moral', 'emotional', 'social'],
    action: 'approach',
    outcome: 'transformed',
    values: ['truth', 'dignity', 'growth'],
    situation_text: 'A mentor I respected was behaving unethically toward junior people. I admired them.',
    participants: ['self', 'colleague'],
    gap_description: 'My values around fairness and the way I\'d constructed this relationship.',
    outcome_description: 'Confronted the mentor directly. Relationship ended but I kept the clarity about what I stood for.',
    intensity: 0.85,
    duration_days: 14,
    counterfactual: {
      paths_not_taken: ['avoid', 'mobilize'],
      values_not_activated: ['loyalty'],
      outcomes_not_realized: [
        { class: 'unresolved', description: 'Ongoing witnessing of harm without acting' },
        { class: 'partial', description: 'Spoke up but preserved the relationship' },
      ],
    },
  },

  {
    id: 'case-018',
    gap_type: 'relational',
    pressure: ['emotional', 'physical'],
    action: 'mobilize',
    outcome: 'resolved',
    values: ['safety', 'belonging', 'dignity'],
    situation_text: 'Elderly parent was showing signs of cognitive decline. Siblings disagreed about what to do.',
    participants: ['self', 'family'],
    gap_description: 'Parent\'s need for care vs. the disconnection among family members making it impossible.',
    outcome_description: 'Brought in a mediator. Family agreed on a care plan within 6 weeks.',
    intensity: 0.8,
    duration_days: 60,
  },

  {
    id: 'case-019',
    gap_type: 'identity',
    pressure: ['social', 'emotional', 'moral'],
    action: 'approach',
    outcome: 'partial',
    values: ['autonomy', 'truth', 'belonging'],
    situation_text: 'Started a creative project that felt deeply personal. People close to me didn\'t understand it.',
    participants: ['self', 'family', 'friend'],
    gap_description: 'Who I was becoming vs. who I was expected to remain.',
    outcome_description: 'Continued the project. Some relationships adapted; others became more distant.',
    intensity: 0.6,
    duration_days: 180,
  },

  {
    id: 'case-020',
    gap_type: 'resource',
    pressure: ['economic', 'social', 'emotional'],
    action: 'transform',
    outcome: 'partial',
    values: ['growth', 'autonomy', 'dignity'],
    situation_text: 'Found myself in a city where I had no professional network, no income, and no support structure.',
    participants: ['self', 'society'],
    gap_description: 'The conditions needed for a functioning life vs. what was actually available.',
    outcome_description: 'Built a network from scratch over 8 months. Income stabilized. Original plan had to change substantially.',
    intensity: 0.85,
    duration_days: 240,
    counterfactual: {
      paths_not_taken: ['avoid', 'mobilize'],
      values_not_activated: ['loyalty', 'belonging'],
      outcomes_not_realized: [
        { class: 'resolved', description: 'Quick integration into existing community' },
        { class: 'escalated', description: 'Prolonged isolation leading to leaving the city' },
      ],
    },
  },

];

export default SEED_CASES_V0;
