/**
 * Essence · Domain Ontology v1
 *
 * The Philos Human Model — canonical vocabulary for what it means to know a person.
 * This is the single source of truth about the user. All agents query here.
 * No agent maintains an independent user model.
 *
 * Architecture:
 *   Human Model  → Essence  (this file)
 *   Reasoning    → Philos
 *   Control      → Apex     (not an agent — a control structure)
 *   Coordination → Nexus
 *   Execution    → Merlin, Morgana
 *
 * Structural relationships (DAG, not a linear chain):
 *
 *   Core ──────────────→ Aspirations
 *     │                       │
 *     └──────────────→ Expression
 *                            │
 *             Expression + Context → Identity
 *
 * Stability classes:
 *   Foundational  — deeply stable; changes require years or significant life events
 *   Stable        — changes with experience and maturity
 *   Adaptive      — changes with creative phases or relational context
 *   Contextual    — changes frequently with role, audience, life stage
 *
 * No property is classified as Immutable — human properties are deeply stable,
 * not metaphysically frozen.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type EssenceLayer =
  | 'core'
  | 'aspirations'
  | 'expression'
  | 'identity';

export type StabilityClass =
  | 'Foundational'  // deeply stable — not immutable, but changes require years
  | 'Stable'        // changes occasionally with experience
  | 'Adaptive'      // changes with creative phases, maturity, relational context
  | 'Contextual';   // changes frequently with role, audience, life stage

export type OntologyStatus = 'stable' | 'experimental' | 'future';

export type RelationType =
  | 'depends_on'   // this node requires the other to be populated first
  | 'informs'      // this node provides upstream context to the other
  | 'contradicts'  // high-confidence values here create tension with the other
  | 'refines'      // this node narrows or specializes the other
  | 'precedes'     // this node is upstream in the generative flow
  | 'grounds';     // this node is the ontological foundation of the other

export interface EssenceRelation {
  targetId: string;
  type: RelationType;
  note?: string;
}

export interface ConfidenceRules {
  writeThreshold: 'user_confirmed' | 'multi_source' | 'single_source';
  requiresUserConfirmation: boolean;
  /** Highest confidence level a single observation source can produce for this node. */
  maxConfidenceFromSingleSource: 'verified' | 'high' | 'medium' | 'low';
  /** Minimum distinct observations before writing any interpretation. */
  minEvidenceCount: number;
}

export interface EssenceNode {
  id: string;
  name: string;
  layer: EssenceLayer;
  parent: string | null;
  children: string[];
  stabilityClass: StabilityClass;
  definition: string;
  /** The single question that determines whether information belongs here. */
  ownershipQuestion: string;
  /** How to decide deterministically if new information belongs in this node. */
  classificationTest: string;
  relations: EssenceRelation[];
  /** The structural negation — what this node is NOT. */
  opposites: string[];
  /** What must be known before this node can be populated accurately. */
  dependencies: string[];
  examples: string[];
  /** What appears to belong here but belongs elsewhere — and where. */
  nonExamples: string[];
  status: OntologyStatus;
  userFacing: boolean;
  confidenceRules: ConfidenceRules;
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const ESSENCE_ONTOLOGY: Record<string, EssenceNode> = {

  // ═══════════════════════════════════════════════════════════════════════════
  // CORE — what fundamentally defines this person
  // Most stable layer. Core informs both Aspirations and Expression directly.
  // ═══════════════════════════════════════════════════════════════════════════

  Values: {
    id: 'Values',
    name: 'Values',
    layer: 'core',
    parent: null,
    children: [],
    stabilityClass: 'Foundational',
    definition: 'The non-negotiable moral commitments that guide every decision. Not opinions or preferences — they are the criteria by which goals, actions, and relationships are evaluated. They persist even when upholding them is costly.',
    ownershipQuestion: 'What does this person treat as non-negotiable, regardless of cost?',
    classificationTest: 'Does this commitment persist even when it creates friction or sacrifice? Does it organize behavior across unrelated domains and time periods? If yes → Values.',
    relations: [
      { targetId: 'Beliefs', type: 'informs', note: 'Values shape which beliefs are worth defending' },
      { targetId: 'Principles', type: 'precedes', note: 'Principles are the applied operational form of Values' },
      { targetId: 'Aspirations_Becoming', type: 'informs' },
      { targetId: 'Motivations', type: 'grounds' },
    ],
    opposites: [
      'Preferences (optional, no cost to abandon)',
      'Opinions (shift with information)',
      'Goals (time-bound, not definitional)',
    ],
    dependencies: [],
    examples: [
      'Truth as non-negotiable even when it creates friction',
      'Creative integrity over commercial compromise',
      'Justice as a personal obligation, not outsourced to institutions',
      'Depth over surface in all creative and intellectual work',
    ],
    nonExamples: [
      'Goals ("I want to release an album") → Aspirations',
      'Preferences ("I prefer night sessions") → Expression/Preferences',
      'Current opinions about events → temporary; only Values if the commitment is persistent',
    ],
    status: 'stable',
    userFacing: true,
    confidenceRules: {
      writeThreshold: 'multi_source',
      requiresUserConfirmation: true,
      maxConfidenceFromSingleSource: 'medium',
      minEvidenceCount: 2,
    },
  },

  Beliefs: {
    id: 'Beliefs',
    name: 'Beliefs',
    layer: 'core',
    parent: null,
    children: [],
    stabilityClass: 'Stable',
    definition: 'Propositions the person holds to be true about the world, people, systems, and themselves. Beliefs are descriptive (what is), not prescriptive (what should be). They form the content within the worldview frame and shape interpretation of events.',
    ownershipQuestion: 'What does this person hold to be true — persistently, and across contexts?',
    classificationTest: 'Is this a proposition about how the world works that appears consistently over time? Does the person act as though it were true even without stating it? If yes → Beliefs.',
    relations: [
      { targetId: 'Worldview', type: 'refines', note: 'Beliefs are specific propositions within the Worldview frame' },
      { targetId: 'Values', type: 'informs', note: 'Beliefs about human nature shape what is worth valuing' },
      { targetId: 'Psychology', type: 'depends_on', note: 'Some beliefs are rationalizations of psychological structure' },
    ],
    opposites: [
      'Worldview (the frame, not the propositions)',
      'Opinions (mutable, context-dependent)',
      'Facts (objective, person-independent)',
    ],
    dependencies: ['Worldview'],
    examples: [
      'Most people are unconscious of their real motivations',
      'Systems cause suffering more reliably than individuals do',
      'The real and the symbolic are not separable',
      'Beauty is a form of truth',
    ],
    nonExamples: [
      'A current opinion about a specific event → may be temporary',
      'A value statement ("truth matters") → Values',
      'A preference → Expression/Preferences',
    ],
    status: 'stable',
    userFacing: true,
    confidenceRules: {
      writeThreshold: 'multi_source',
      requiresUserConfirmation: false,
      maxConfidenceFromSingleSource: 'medium',
      minEvidenceCount: 2,
    },
  },

  Worldview: {
    id: 'Worldview',
    name: 'Worldview',
    layer: 'core',
    parent: null,
    children: [],
    stabilityClass: 'Stable',
    definition: 'The interpretive lens through which reality is organized and made meaningful. Not a set of beliefs — the frame that makes certain beliefs possible and others invisible. Determines what the person notices, how they explain cause and effect, and what they expect of people and systems.',
    ownershipQuestion: 'Through what lens does this person organize reality into meaning?',
    classificationTest: 'Does this describe a frame of interpretation that organizes multiple unrelated beliefs and observations? Is it stable across decades and domains? If yes → Worldview.',
    relations: [
      { targetId: 'Beliefs', type: 'precedes', note: 'Worldview is the frame; Beliefs are the content' },
      { targetId: 'Psychology', type: 'informs', note: 'Worldview is partly shaped by psychological structure' },
      { targetId: 'CognitivePatterns', type: 'informs' },
    ],
    opposites: [
      'Beliefs (specific propositions within the frame)',
      'Opinions (mutable)',
      'Knowledge (objective, transferable)',
    ],
    dependencies: [],
    examples: [
      'A structuralist lens: patterns and systems explain individual experience',
      'A tragic lens: beauty and loss are inseparable',
      'A dual-consciousness lens: the person lives between worlds simultaneously',
      'A relational lens: everything meaningful happens between people',
    ],
    nonExamples: [
      'A specific belief ("people are unconscious") → Beliefs',
      'A value ("truth matters") → Values',
      'A preference for a kind of music → Aesthetics',
    ],
    status: 'stable',
    userFacing: true,
    confidenceRules: {
      writeThreshold: 'multi_source',
      requiresUserConfirmation: false,
      maxConfidenceFromSingleSource: 'low',
      minEvidenceCount: 3,
    },
  },

  Motivations: {
    id: 'Motivations',
    name: 'Motivations',
    layer: 'core',
    parent: null,
    children: [],
    stabilityClass: 'Stable',
    definition: 'What energizes and pulls the person forward. Motivations explain why the person acts. Distinct from Values (what they won\'t compromise) and Needs (what is required). A person may be motivated by things they don\'t value — ego, fear, status — and the system must represent this without judgment.',
    ownershipQuestion: 'What pulls this person toward action, creation, or movement — persistently?',
    classificationTest: 'Does this describe an internal pull that energizes behavior across domains? Does it persist even without external reward or recognition? If yes → Motivations.',
    relations: [
      { targetId: 'Values', type: 'informs', note: 'Values often shape motivation, but they are not identical' },
      { targetId: 'Needs', type: 'grounds', note: 'Some motivations are the pursuit of unmet Needs' },
      { targetId: 'Aspirations_Becoming', type: 'informs' },
      { targetId: 'Psychology', type: 'depends_on' },
    ],
    opposites: [
      'Values (non-negotiable commitments)',
      'Needs (requirements, not directional pulls)',
      'Goals (time-bound targets)',
    ],
    dependencies: ['Psychology'],
    examples: [
      'The need to create something that carries a permanent mark',
      'The drive to understand what others do not yet see',
      'The pull toward precision — making something exactly right',
      'The desire to be understood at full depth',
    ],
    nonExamples: [
      '"Release an album" → Aspirations (a goal, not a motivating force)',
      '"I need sleep to function" → Needs',
      '"I should email the producer" → Operations',
    ],
    status: 'stable',
    userFacing: true,
    confidenceRules: {
      writeThreshold: 'multi_source',
      requiresUserConfirmation: false,
      maxConfidenceFromSingleSource: 'medium',
      minEvidenceCount: 2,
    },
  },

  Needs: {
    id: 'Needs',
    name: 'Needs',
    layer: 'core',
    parent: null,
    children: [],
    stabilityClass: 'Foundational',
    definition: 'What the person requires to function — psychologically, relationally, and existentially. Needs are non-optional: sustained deprivation produces dysfunction. Distinct from Preferences (optional choices) and Motivations (directional pulls).',
    ownershipQuestion: 'What, if absent for a sustained period, causes this person to lose capacity to function?',
    classificationTest: 'Is this a requirement whose sustained absence creates genuine dysfunction — not discomfort? Is it consistent across roles and life stages? If yes → Needs.',
    relations: [
      { targetId: 'Psychology', type: 'depends_on', note: 'Needs emerge partly from psychological structure' },
      { targetId: 'IntrinsicConstraints', type: 'informs', note: 'Violated Needs often manifest as IntrinsicConstraints' },
      { targetId: 'Motivations', type: 'grounds', note: 'Unmet Needs often generate Motivations' },
    ],
    opposites: [
      'Preferences (optional, no dysfunction on absence)',
      'Motivations (pulls, not requirements)',
      'Wants (desires without dysfunction on deprivation)',
    ],
    dependencies: ['Psychology'],
    examples: [
      'Uninterrupted creative time — absence produces creative collapse, not just discomfort',
      'Genuine understanding from at least one person — sustained isolation produces existential crisis',
      'A sense of forward movement — stagnation creates functional collapse',
      'Control over the final form of creative work — external control produces creative shutdown',
    ],
    nonExamples: [
      'Working environment preferences → Preferences',
      'Goals and aspirations → Aspirations',
      'Current state (tired, distracted) → State',
    ],
    status: 'stable',
    userFacing: true,
    confidenceRules: {
      writeThreshold: 'user_confirmed',
      requiresUserConfirmation: true,
      maxConfidenceFromSingleSource: 'medium',
      minEvidenceCount: 2,
    },
  },

  Psychology: {
    id: 'Psychology',
    name: 'Psychology',
    layer: 'core',
    parent: null,
    children: [],
    stabilityClass: 'Foundational',
    definition: 'The inner emotional-cognitive architecture. Deepest structural layer: attachment style, defense mechanisms, emotional regulation patterns, dominant psychological forces, and developmental history that shapes current behavior. Shows up across all contexts, relationships, and decades.',
    ownershipQuestion: 'How is this person emotionally and cognitively structured at the foundational level?',
    classificationTest: 'Does this pattern appear across unrelated situations, roles, and time periods? Does it predate the person\'s current life context? If yes → Psychology.',
    relations: [
      { targetId: 'CognitivePatterns', type: 'informs', note: 'Psychological structure shapes how thought is organized' },
      { targetId: 'Motivations', type: 'grounds' },
      { targetId: 'Needs', type: 'grounds' },
      { targetId: 'Values', type: 'informs', note: 'Some values are psychological defenses elevated to principles' },
    ],
    opposites: [
      'Current state or mood → State',
      'Beliefs (content, not structure)',
      'Skills (acquired, not structural)',
    ],
    dependencies: [],
    examples: [
      'High superego dominance — strong internal critic, persistent moral self-pressure',
      'Intellectualization as primary defense mechanism',
      'Anxious attachment with compensatory hyperfocus on work and output',
      'High baseline functioning with acute sensitivity to meaning disruption',
    ],
    nonExamples: [
      'Current emotional state or mood → State',
      'Reaction to a specific event → may reveal Psychology but is not Psychology itself',
      'Self-concept or narrative → Personal Identity',
    ],
    status: 'stable',
    userFacing: true,
    confidenceRules: {
      writeThreshold: 'user_confirmed',
      requiresUserConfirmation: true,
      maxConfidenceFromSingleSource: 'low',
      minEvidenceCount: 3,
    },
  },

  CognitivePatterns: {
    id: 'CognitivePatterns',
    name: 'Cognitive Patterns',
    layer: 'core',
    parent: null,
    children: [],
    stabilityClass: 'Stable',
    definition: 'The habitual ways the person organizes thought: preferred reasoning modes, learning style, relationship to abstraction and detail, how complexity is decomposed, what structure is imposed on problems. Distinct from Psychology (emotional architecture) and Beliefs (content).',
    ownershipQuestion: 'How does this person think — not what they think, but in what mode?',
    classificationTest: 'Does this describe a processing mode that appears across unrelated domains (music, code, relationships, philosophy)? If yes → CognitivePatterns.',
    relations: [
      { targetId: 'Psychology', type: 'depends_on' },
      { targetId: 'CreativeDNA', type: 'informs' },
      { targetId: 'Principles', type: 'informs', note: 'Cognitive patterns shape how principles are derived and applied' },
    ],
    opposites: [
      'Beliefs (what is thought)',
      'Psychology (emotional structure)',
      'Skills (trained, not structural)',
    ],
    dependencies: ['Psychology'],
    examples: [
      'Systems thinking as the default lens — any problem immediately becomes a model',
      'Strong preference for abstraction before implementation',
      'Synthesis over recall — always seeking the integrating principle',
      'Thinking through making — creation precedes conceptualization',
    ],
    nonExamples: [
      'A specific solution to a problem → Operations or domain-specific',
      'Communication preferences → Communication',
      'A creative technique → Creative DNA',
    ],
    status: 'stable',
    userFacing: true,
    confidenceRules: {
      writeThreshold: 'multi_source',
      requiresUserConfirmation: false,
      maxConfidenceFromSingleSource: 'medium',
      minEvidenceCount: 2,
    },
  },

  IntrinsicConstraints: {
    id: 'IntrinsicConstraints',
    name: 'Intrinsic Constraints',
    layer: 'core',
    parent: null,
    children: [],
    stabilityClass: 'Foundational',
    definition: 'The structural, non-situational limits that define the person\'s operational envelope. Not weaknesses or failures — architectural facts the system must respect. Includes cognitive limits, physiological requirements, deep psychological boundaries, and stable conditions necessary for functioning. Explicitly excludes situational constraints.',
    ownershipQuestion: 'What structural limits define what is possible for this person — independent of their current situation?',
    classificationTest: 'Is this a limit that persists regardless of circumstance, resources, or external factors? Would it be true even if the person had unlimited money and perfect conditions? If yes → IntrinsicConstraints.',
    relations: [
      { targetId: 'Needs', type: 'informs', note: 'Violated Needs often produce IntrinsicConstraints' },
      { targetId: 'Psychology', type: 'depends_on' },
    ],
    opposites: [
      'Situational constraints (money, time, tools, deadlines) → Nexus or Operations',
      'External blockers (other people, institutions) → Nexus or Operations',
      'Project-specific limits → relevant domain',
    ],
    dependencies: ['Psychology', 'Needs'],
    examples: [
      'Cannot sustain creative output below 7 hours of sleep — physiological floor, not preference',
      'Cannot function in auditory chaos — deep sensory requirement',
      'Requires control over final form — psychological boundary, not preference',
      'Cannot produce in environments of distrust — relational prerequisite for creative function',
    ],
    nonExamples: [
      '"I don\'t have enough money" → situational → Nexus/Operations',
      '"I don\'t have a visa" → situational → Operations',
      '"My collaborator is unavailable" → situational → Projects or Nexus',
      '"I have a deadline" → situational → Operations',
    ],
    status: 'stable',
    userFacing: true,
    confidenceRules: {
      writeThreshold: 'user_confirmed',
      requiresUserConfirmation: true,
      maxConfidenceFromSingleSource: 'medium',
      minEvidenceCount: 2,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ASPIRATIONS — where this person is going
  // Not tasks, not projects. Life directions and intended becoming.
  // Core informs Aspirations. Aspirations also inform Expression.
  // ═══════════════════════════════════════════════════════════════════════════

  Aspirations_Becoming: {
    id: 'Aspirations_Becoming',
    name: 'Becoming',
    layer: 'aspirations',
    parent: null,
    children: [],
    stabilityClass: 'Stable',
    definition: 'Who this person is working toward becoming. The identity horizon — the person they intend to develop into over years. Not a task, not a project, not an achievement. The direction of personal development.',
    ownershipQuestion: 'Who is this person trying to become?',
    classificationTest: 'Does this describe a long-horizon personal development direction, not a concrete achievement or deliverable? If yes → Becoming.',
    relations: [
      { targetId: 'Values', type: 'depends_on' },
      { targetId: 'Motivations', type: 'depends_on' },
      { targetId: 'ProfessionalIdentity', type: 'informs' },
    ],
    opposites: [
      'Projects (concrete deliverables)',
      'Tasks (single actions)',
      'Goals with success criteria',
    ],
    dependencies: ['Values', 'Motivations'],
    examples: [
      'Becoming a world-class music producer',
      'Becoming someone who builds systems that change how people understand themselves',
      'Becoming financially sovereign without compromising creative work',
    ],
    nonExamples: [
      '"Release an EP" → project goal → Music domain',
      '"Learn mixing" → skill goal → Music or Personal Development',
      '"Be more organized" → habit → Personal Management',
    ],
    status: 'stable',
    userFacing: true,
    confidenceRules: {
      writeThreshold: 'single_source',
      requiresUserConfirmation: false,
      maxConfidenceFromSingleSource: 'high',
      minEvidenceCount: 1,
    },
  },

  Aspirations_LifeDirections: {
    id: 'Aspirations_LifeDirections',
    name: 'Life Directions',
    layer: 'aspirations',
    parent: null,
    children: [],
    stabilityClass: 'Stable',
    definition: 'The broad orientations that shape major life decisions over years. Not the direction of a project — the direction of a life. Life Directions influence where the person lives, who they surround themselves with, and what they spend their energy on.',
    ownershipQuestion: 'Which directions is this person orienting their life toward?',
    classificationTest: 'Does this describe a macro-orientation that shapes how major life decisions are made over years? If yes → Life Directions.',
    relations: [
      { targetId: 'Aspirations_Becoming', type: 'informs' },
      { targetId: 'Aspirations_DesiredConditions', type: 'informs' },
      { targetId: 'Values', type: 'depends_on' },
    ],
    opposites: ['Project plans', 'Operational decisions', 'Habits and routines'],
    dependencies: ['Values', 'Aspirations_Becoming'],
    examples: [
      'Relocating to Southeast Asia — orienting the life base',
      'Building in the intersection of technology and creativity',
      'Operating independently of institutional structures',
    ],
    nonExamples: [
      '"I will move to Thailand in Q3" → operational plan → Operations',
      '"I prefer warm weather" → preference → Preferences',
    ],
    status: 'stable',
    userFacing: true,
    confidenceRules: {
      writeThreshold: 'single_source',
      requiresUserConfirmation: false,
      maxConfidenceFromSingleSource: 'high',
      minEvidenceCount: 1,
    },
  },

  Aspirations_DesiredConditions: {
    id: 'Aspirations_DesiredConditions',
    name: 'Desired Conditions',
    layer: 'aspirations',
    parent: null,
    children: [],
    stabilityClass: 'Adaptive',
    definition: 'The living conditions the person is working toward. The environment, material circumstances, and structural situation they want their life to inhabit. Different from current situational constraints — these are intended states.',
    ownershipQuestion: 'What conditions of life is this person working toward?',
    classificationTest: 'Does this describe an intended life-condition that shapes medium-to-long-term decisions? If yes → Desired Conditions.',
    relations: [
      { targetId: 'Aspirations_LifeDirections', type: 'refines' },
      { targetId: 'Needs', type: 'informs' },
    ],
    opposites: [
      'Current situational constraints → Nexus or Operations',
      'Situational preferences → Preferences',
    ],
    dependencies: ['Needs'],
    examples: [
      'Financial sovereignty — income independent of any single employer',
      'Creative autonomy — full ownership of process and final product',
      'Geographic freedom — the ability to work and live from anywhere',
    ],
    nonExamples: [
      '"I don\'t have money right now" → current situational → Nexus',
      '"I prefer to own my equipment" → preference → Preferences',
    ],
    status: 'stable',
    userFacing: true,
    confidenceRules: {
      writeThreshold: 'single_source',
      requiresUserConfirmation: false,
      maxConfidenceFromSingleSource: 'high',
      minEvidenceCount: 1,
    },
  },

  Aspirations_Contribution: {
    id: 'Aspirations_Contribution',
    name: 'Contribution',
    layer: 'aspirations',
    parent: null,
    children: [],
    stabilityClass: 'Stable',
    definition: 'What the person wants to give, create, or change in the world beyond themselves. The outward-facing aspiration — what the person intends their work and life to produce in the world. Distinct from Legacy (what remains) and Becoming (who they are).',
    ownershipQuestion: 'What does this person want to give or change in the world?',
    classificationTest: 'Does this describe an intended contribution to others, a community, or the world — beyond personal benefit? If yes → Contribution.',
    relations: [
      { targetId: 'Values', type: 'depends_on' },
      { targetId: 'Aspirations_Legacy', type: 'precedes' },
      { targetId: 'Motivations', type: 'informs' },
    ],
    opposites: ['Personal gain (unless framed as enabling Contribution)', 'Status'],
    dependencies: ['Values'],
    examples: [
      'Build a system that helps people understand their own complexity',
      'Create music that gives language to experiences that have no other form',
      'Demonstrate that technical depth and creative depth can coexist in one person',
    ],
    nonExamples: [
      '"I want to make money" → Desired Conditions (unless framed as enabling contribution)',
      '"I want to release an album" → Music domain',
    ],
    status: 'stable',
    userFacing: true,
    confidenceRules: {
      writeThreshold: 'single_source',
      requiresUserConfirmation: false,
      maxConfidenceFromSingleSource: 'high',
      minEvidenceCount: 1,
    },
  },

  Aspirations_Legacy: {
    id: 'Aspirations_Legacy',
    name: 'Legacy',
    layer: 'aspirations',
    parent: null,
    children: [],
    stabilityClass: 'Foundational',
    definition: 'What the person wants to leave behind. The mark that remains after the work is done. The most existential aspiration — what gives the whole thing its meaning and permanence.',
    ownershipQuestion: 'What does this person want to remain after they are gone?',
    classificationTest: 'Does this describe what the person believes gives their existence its ultimate meaning or permanence? If yes → Legacy.',
    relations: [
      { targetId: 'Values', type: 'depends_on' },
      { targetId: 'Aspirations_Contribution', type: 'refines' },
      { targetId: 'Psychology', type: 'informs', note: 'Some legacy aspirations are psychologically driven' },
    ],
    opposites: ['Short-term goals', 'Commercial outcomes', 'Reputation (temporary recognition)'],
    dependencies: ['Values', 'Aspirations_Contribution'],
    examples: [
      'Creating something that outlasts the creator — a body of work that continues to resonate',
      'Demonstrating a way of living that integrates depth, creativity, and independence',
      'Building a system that continues to help people after it is built',
    ],
    nonExamples: [
      'A specific product → Music or Projects domain',
      'A reputation → Public Persona or Professional Identity',
    ],
    status: 'stable',
    userFacing: true,
    confidenceRules: {
      writeThreshold: 'user_confirmed',
      requiresUserConfirmation: true,
      maxConfidenceFromSingleSource: 'medium',
      minEvidenceCount: 1,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPRESSION — how the internal structure manifests externally
  // Core informs Expression directly. Aspirations also inform Expression.
  // Expression produces Identity when it meets Context.
  // ═══════════════════════════════════════════════════════════════════════════

  Aesthetics: {
    id: 'Aesthetics',
    name: 'Aesthetics',
    layer: 'expression',
    parent: null,
    children: [],
    stabilityClass: 'Stable',
    definition: 'The criteria through which beauty is recognized and created. The principles the person applies when judging whether something is beautiful, right, or finished. More stable than taste — these are the underlying criteria that generate taste across domains.',
    ownershipQuestion: 'What principles define what this person finds beautiful, and why?',
    classificationTest: 'Does this describe a criterion for quality that the person applies consistently across domains, not just a preference for a particular work? If yes → Aesthetics.',
    relations: [
      { targetId: 'CreativeDNA', type: 'informs' },
      { targetId: 'Style', type: 'precedes' },
      { targetId: 'Values', type: 'depends_on', note: 'Aesthetic criteria are often expressions of values' },
    ],
    opposites: [
      'Specific tastes (particular songs, films) → Preferences',
      'Style (the integrated output of multiple Expression nodes)',
    ],
    dependencies: ['Values'],
    examples: [
      'Restraint over excess — "what you leave out defines the work"',
      'Simultaneous elegance and rawness — not one or the other',
      'Dark palettes, architectural geometry, minimal ornamentation (visual)',
      'Analog warmth with precise electronic control (sonic)',
    ],
    nonExamples: [
      '"I like J. Cole\'s album" → specific taste → Preferences or Creative DNA',
      '"I prefer dark clothes" → only Aesthetics if it reveals the underlying principle',
      '"I want this plugin in my chain" → production choice → Music domain',
    ],
    status: 'stable',
    userFacing: true,
    confidenceRules: {
      writeThreshold: 'multi_source',
      requiresUserConfirmation: false,
      maxConfidenceFromSingleSource: 'medium',
      minEvidenceCount: 2,
    },
  },

  CreativeDNA: {
    id: 'CreativeDNA',
    name: 'Creative DNA',
    layer: 'expression',
    parent: null,
    children: [],
    stabilityClass: 'Adaptive',
    definition: 'The creative impulses, influences, references, modes, and generative processes that define how this person creates. Not the outputs — the inner logic of creation: where ideas begin, what they are drawn toward, what makes a work feel complete.',
    ownershipQuestion: 'What is the inner logic and source material of this person\'s creative output?',
    classificationTest: 'Does this describe a source, mode, or impulse that shapes creative output across different projects and over time? If yes → Creative DNA.',
    relations: [
      { targetId: 'Aesthetics', type: 'depends_on' },
      { targetId: 'Style', type: 'precedes' },
      { targetId: 'CognitivePatterns', type: 'informs' },
    ],
    opposites: [
      'Specific projects → domain-specific',
      'Production techniques in isolation → Music domain',
    ],
    dependencies: ['Aesthetics', 'CognitivePatterns'],
    examples: [
      'Influences: J. Cole, Kendrick Lamar, Frank Ocean, Radiohead, Bon Iver, Travis Scott',
      'Starting from atmosphere, not from groove or rhythmic grid',
      'Lyrical approach: narrative specificity with philosophical undercurrent',
      'Tension between intimacy and scale — making small things feel vast',
    ],
    nonExamples: [
      '"I use Serum as a synth" → Music domain',
      '"I\'m working on this specific song" → Music domain',
      '"I want to learn mixing" → Music or Personal Development',
    ],
    status: 'stable',
    userFacing: true,
    confidenceRules: {
      writeThreshold: 'single_source',
      requiresUserConfirmation: false,
      maxConfidenceFromSingleSource: 'high',
      minEvidenceCount: 1,
    },
  },

  Principles: {
    id: 'Principles',
    name: 'Principles',
    layer: 'expression',
    parent: null,
    children: [],
    stabilityClass: 'Stable',
    definition: 'The applied behavioral rules the person follows when acting in the world. Not abstract values — concrete decision heuristics derived from Values and experience. The operational translation of Core into action. When a Principle is violated, the person registers it as a failure of integrity.',
    ownershipQuestion: 'What rules does this person reliably hold themselves to in practice, even under pressure?',
    classificationTest: 'Is this a rule the person applies across decisions, holds themselves to, and registers a failure when violated? If yes → Principles.',
    relations: [
      { targetId: 'Values', type: 'depends_on' },
      { targetId: 'Communication', type: 'informs' },
      { targetId: 'CognitivePatterns', type: 'informs' },
    ],
    opposites: [
      'Values (the abstract ground)',
      'Preferences (optional, no integrity cost)',
      'Goals (time-bound, not integrity-bound)',
    ],
    dependencies: ['Values'],
    examples: [
      'Never compromise the core creative concept for external approval',
      'Begin with the question, not the answer',
      'Finish what matters; abandon what doesn\'t serve the work',
      'Choose depth over breadth when resources are constrained',
    ],
    nonExamples: [
      'A value statement ("truth matters") → Values (Principles are the applied form)',
      'A preference ("I prefer mornings") → Preferences',
      'A goal → Aspirations or Operations',
    ],
    status: 'stable',
    userFacing: true,
    confidenceRules: {
      writeThreshold: 'single_source',
      requiresUserConfirmation: false,
      maxConfidenceFromSingleSource: 'high',
      minEvidenceCount: 1,
    },
  },

  Communication: {
    id: 'Communication',
    name: 'Communication',
    layer: 'expression',
    parent: null,
    children: [],
    stabilityClass: 'Adaptive',
    definition: 'The style, register, and mode through which ideas are externalized. How the person structures sentences, what they avoid, what they gravitate toward in dialogue, how they handle ambiguity, the rhythm of speech and writing.',
    ownershipQuestion: 'How does this person express ideas to others — independent of topic and audience?',
    classificationTest: 'Does this describe a recurring pattern in how the person speaks or writes that persists across topics and contexts? If yes → Communication.',
    relations: [
      { targetId: 'CognitivePatterns', type: 'depends_on' },
      { targetId: 'Aesthetics', type: 'informs' },
      { targetId: 'Style', type: 'precedes' },
    ],
    opposites: [
      'Public Persona (audience-specific curation)',
      'Content (what is said, not how)',
    ],
    dependencies: ['CognitivePatterns', 'Aesthetics'],
    examples: [
      'Directness; dislikes preamble and hedging',
      'Responds well to structured framing before detail',
      'Uses Hebrew in emotional or conceptual contexts; English in technical ones',
      'Expects specificity from interlocutors — vagueness reads as evasion',
    ],
    nonExamples: [
      '"I talk differently to clients than to friends" → context-shifting is expected; Communication is the underlying style across contexts',
      '"I use English for coding" → language choice by domain, not a communication pattern',
    ],
    status: 'stable',
    userFacing: true,
    confidenceRules: {
      writeThreshold: 'multi_source',
      requiresUserConfirmation: false,
      maxConfidenceFromSingleSource: 'medium',
      minEvidenceCount: 2,
    },
  },

  Style: {
    id: 'Style',
    name: 'Style',
    layer: 'expression',
    parent: null,
    children: [],
    stabilityClass: 'Adaptive',
    definition: 'The recognizable personal signature across all expressive domains. The gestalt that makes different outputs identifiable as coming from the same person. Style is the integration of Aesthetics, Creative DNA, and Communication — downstream of the other Expression nodes.',
    ownershipQuestion: 'What is immediately recognizable as belonging to this person across different domains?',
    classificationTest: 'Does this describe a signature quality that appears consistently across different types of output — not just in one domain? If yes → Style.',
    relations: [
      { targetId: 'Aesthetics', type: 'depends_on' },
      { targetId: 'CreativeDNA', type: 'depends_on' },
      { targetId: 'Communication', type: 'depends_on' },
      { targetId: 'PublicPersona', type: 'informs' },
    ],
    opposites: [
      'Aesthetics (the criteria, not the integrated output)',
      'Public Persona (audience-specific)',
      'Individual works',
    ],
    dependencies: ['Aesthetics', 'CreativeDNA', 'Communication'],
    examples: [
      'Emotional precision: intense but controlled — not raw, not cold',
      'Conceptual density beneath accessible surface forms',
      'Philosophical depth with street-level grounding',
      'Dark visual world, architectural sensibility across domains',
    ],
    nonExamples: [
      'A single aesthetic preference → Aesthetics',
      'A specific work → domain-specific',
      'A stage name → Public Persona',
    ],
    status: 'stable',
    userFacing: true,
    confidenceRules: {
      writeThreshold: 'multi_source',
      requiresUserConfirmation: false,
      maxConfidenceFromSingleSource: 'low',
      minEvidenceCount: 3,
    },
  },

  Preferences: {
    id: 'Preferences',
    name: 'Preferences',
    layer: 'expression',
    parent: null,
    children: [],
    stabilityClass: 'Adaptive',
    definition: 'The recurring choices the person makes when given options. Preferences are expressive acts — they reveal inner position but do not define the person. They can change without compromising Core. Note: mood-based temporary choices belong in State, not Preferences.',
    ownershipQuestion: 'What does this person consistently choose, given the option — persistently over weeks or months?',
    classificationTest: 'Is this a choice pattern that recurs across time, but is not a non-negotiable rule? If yes → Preferences. If it is only present today → State.',
    relations: [
      { targetId: 'Aesthetics', type: 'depends_on', note: 'Many preferences are expressions of aesthetic criteria' },
      { targetId: 'CognitivePatterns', type: 'informs' },
      { targetId: 'PersonalIdentity', type: 'informs' },
    ],
    opposites: [
      'Principles (non-negotiable, integrity-bound)',
      'Values (commitments, not choices)',
      'State (temporary, session-scoped or TTL-scoped)',
    ],
    dependencies: ['Aesthetics'],
    examples: [
      'Prefers to work at night',
      'Prefers audio-first ideation before text',
      'Prefers minimal interfaces with maximal depth',
      'Prefers receiving feedback as questions rather than directives',
    ],
    nonExamples: [
      'A non-negotiable rule → Principles',
      'A value commitment → Values',
      'A temporary preference based on current mood → State',
    ],
    status: 'stable',
    userFacing: true,
    confidenceRules: {
      writeThreshold: 'single_source',
      requiresUserConfirmation: false,
      maxConfidenceFromSingleSource: 'high',
      minEvidenceCount: 1,
    },
  },

  // ── Orientation Dimensions — Merlin interaction preferences ─────────────────
  // Five single-valued traits that personalize how Merlin communicates.
  // Stored as Interpretation nodes in the expression layer.
  // Canonical node IDs are in orientation.ts; this file defines the ontology.
  // Lifecycle: each dimension must have at most one active Interpretation.
  // Future write paths (M0-5+) must archive the prior value on update.

  OrientationCommunicationStyle: {
    id: 'OrientationCommunicationStyle',
    name: 'Orientation: Communication Style',
    layer: 'expression',
    parent: null,
    children: [],
    stabilityClass: 'Adaptive',
    definition: 'The preferred delivery register for Merlin interactions: how direct, exploratory, or collaborative the user wants responses to be. Captures whether answers should be led, reasoning shown, or collaboration invited.',
    ownershipQuestion: 'Does the user want answers delivered directly, thinking shown openly, or collaboration invited?',
    classificationTest: 'Does this signal how the user wants Merlin to frame and deliver responses in terms of directness vs. exploration? If yes → OrientationCommunicationStyle.',
    relations: [
      { targetId: 'Communication', type: 'refines', note: 'Narrows the general Communication node to Merlin-specific interaction register' },
      { targetId: 'Preferences', type: 'refines', note: 'A Merlin-specific operational preference' },
    ],
    opposites: [
      'Communication (general expression node; this is Merlin-interaction-specific)',
      'OrientationResponseDepth (how much, not in what mode)',
    ],
    dependencies: ['Communication'],
    examples: [
      'direct: "Give me the answer, skip the setup"',
      'exploratory: "Walk me through the reasoning"',
      'collaborative: "Give me a starting point and ask what I think"',
    ],
    nonExamples: [
      'How much context to include → OrientationResponseDepth',
      'Whether to show one option or several → OrientationDecisionStyle',
      'General communication style across all agents → Communication',
    ],
    status: 'stable',
    userFacing: true,
    confidenceRules: {
      writeThreshold: 'single_source',
      requiresUserConfirmation: false,
      maxConfidenceFromSingleSource: 'high',
      minEvidenceCount: 1,
    },
  },

  OrientationResponseDepth: {
    id: 'OrientationResponseDepth',
    name: 'Orientation: Response Depth',
    layer: 'expression',
    parent: null,
    children: [],
    stabilityClass: 'Adaptive',
    definition: 'How much explanatory context and rationale Merlin should include by default. Controls whether Merlin omits explanations, adds brief rationale, or expands reasoning unless told otherwise.',
    ownershipQuestion: 'Does the user want Merlin to omit explanations, include brief rationale, or expand reasoning by default?',
    classificationTest: 'Does this signal how much explanatory content Merlin should include in a typical response? If yes → OrientationResponseDepth.',
    relations: [
      { targetId: 'Preferences', type: 'refines', note: 'A Merlin-specific operational preference' },
      { targetId: 'OrientationCommunicationStyle', type: 'informs', note: 'Depth and register together shape response texture' },
    ],
    opposites: [
      'OrientationCommunicationStyle (the mode, not the amount)',
      'OrientationTaskFraming (how to open, not how much to include)',
    ],
    dependencies: [],
    examples: [
      'brief: "Just the result — I\'ll ask if I need context"',
      'balanced: "A sentence of rationale is fine"',
      'explanatory: "Show me your reasoning"',
    ],
    nonExamples: [
      'Delivery register → OrientationCommunicationStyle',
      'How to open a response → OrientationTaskFraming',
    ],
    status: 'stable',
    userFacing: true,
    confidenceRules: {
      writeThreshold: 'single_source',
      requiresUserConfirmation: false,
      maxConfidenceFromSingleSource: 'high',
      minEvidenceCount: 1,
    },
  },

  OrientationTaskFraming: {
    id: 'OrientationTaskFraming',
    name: 'Orientation: Task Framing',
    layer: 'expression',
    parent: null,
    children: [],
    stabilityClass: 'Adaptive',
    definition: 'How Merlin should open its response to task requests — whether to lead with the action, provide brief context first, or present multiple paths before recommending.',
    ownershipQuestion: 'Does the user want task responses opened with the action, with context, or with options?',
    classificationTest: 'Does this signal how Merlin should structure the opening of a task response? If yes → OrientationTaskFraming.',
    relations: [
      { targetId: 'Preferences', type: 'refines' },
      { targetId: 'OrientationDecisionStyle', type: 'informs', note: 'Framing and decision style interact when multiple options are relevant' },
    ],
    opposites: [
      'OrientationResponseDepth (how much, not how to open)',
      'OrientationDecisionStyle (how to handle choices, not how to open tasks)',
    ],
    dependencies: [],
    examples: [
      'action_first: "Start with what to do, explain if I ask"',
      'context_first: "A sentence of context before the action"',
      'options_first: "Show me two or three paths before committing"',
    ],
    nonExamples: [
      'How to present decisions → OrientationDecisionStyle',
      'How much rationale to include → OrientationResponseDepth',
    ],
    status: 'stable',
    userFacing: true,
    confidenceRules: {
      writeThreshold: 'single_source',
      requiresUserConfirmation: false,
      maxConfidenceFromSingleSource: 'high',
      minEvidenceCount: 1,
    },
  },

  OrientationDecisionStyle: {
    id: 'OrientationDecisionStyle',
    name: 'Orientation: Decision Style',
    layer: 'expression',
    parent: null,
    children: [],
    stabilityClass: 'Adaptive',
    definition: 'How Merlin should handle decisions and recommendations — whether to recommend one option directly, present two options for comparison, or outline trade-offs before recommending.',
    ownershipQuestion: 'Does the user want Merlin to recommend directly, compare options, or deliberate on trade-offs?',
    classificationTest: 'Does this signal how Merlin should approach choices and recommendations? If yes → OrientationDecisionStyle.',
    relations: [
      { targetId: 'Preferences', type: 'refines' },
      { targetId: 'OrientationTaskFraming', type: 'informs' },
    ],
    opposites: [
      'OrientationTaskFraming (how to open tasks, not how to decide)',
      'OrientationTaskCadence (pacing, not decision style)',
    ],
    dependencies: [],
    examples: [
      'decisive: "Pick one and tell me why"',
      'comparative: "Two options with a short comparison"',
      'deliberative: "Show trade-offs before recommending"',
    ],
    nonExamples: [
      'How to open a task response → OrientationTaskFraming',
      'How much detail to include → OrientationResponseDepth',
    ],
    status: 'stable',
    userFacing: true,
    confidenceRules: {
      writeThreshold: 'single_source',
      requiresUserConfirmation: false,
      maxConfidenceFromSingleSource: 'high',
      minEvidenceCount: 1,
    },
  },

  OrientationTaskCadence: {
    id: 'OrientationTaskCadence',
    name: 'Orientation: Task Cadence',
    layer: 'expression',
    parent: null,
    children: [],
    stabilityClass: 'Adaptive',
    definition: 'How Merlin should pace and sequence task breakdown — whether to present only the immediate next step, show the current step with a brief overall plan, or lay out the full flow at once.',
    ownershipQuestion: 'Does the user want Merlin to focus on the next step, show a brief plan, or present the full flow?',
    classificationTest: 'Does this signal how Merlin should pace task delivery and sequencing? If yes → OrientationTaskCadence.',
    relations: [
      { targetId: 'Preferences', type: 'refines' },
      { targetId: 'OrientationTaskFraming', type: 'informs' },
    ],
    opposites: [
      'OrientationTaskFraming (how to open a response, not how to pace steps)',
      'OrientationDecisionStyle (handling choices, not pacing)',
    ],
    dependencies: [],
    examples: [
      'single_step: "One thing at a time — I\'ll ask for the next"',
      'phased: "Show the step and a brief roadmap"',
      'continuous: "Walk me through the whole thing"',
    ],
    nonExamples: [
      'How to open a task → OrientationTaskFraming',
      'How to handle decisions → OrientationDecisionStyle',
    ],
    status: 'stable',
    userFacing: true,
    confidenceRules: {
      writeThreshold: 'single_source',
      requiresUserConfirmation: false,
      maxConfidenceFromSingleSource: 'high',
      minEvidenceCount: 1,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // IDENTITY — how Expression is recognized when it meets the world
  // Identity is not produced by Expression alone.
  // It emerges from Expression + Context (role, audience, relationship, culture).
  // ═══════════════════════════════════════════════════════════════════════════

  Roles: {
    id: 'Roles',
    name: 'Roles',
    layer: 'identity',
    parent: null,
    children: [],
    stabilityClass: 'Contextual',
    definition: 'The formal and informal functions the person occupies in different systems — organizations, creative projects, relationships, communities. Roles are context-dependent and change over time. They define the person\'s current functional position in the world but are not the person.',
    ownershipQuestion: 'What functions does this person fill in relation to others and to systems?',
    classificationTest: 'Does this describe a function the person fills in relation to others or a system, which changes when the context changes? If yes → Roles.',
    relations: [
      { targetId: 'ProfessionalIdentity', type: 'informs' },
      { targetId: 'Style', type: 'depends_on', note: 'Roles shape how Style is expressed in context' },
    ],
    opposites: [
      'Values (define the person independent of role)',
      'Self-concept → Personal Identity',
    ],
    dependencies: [],
    examples: [
      'Music producer and recording artist',
      'Software engineer / technical lead',
      'Creative director — own collective',
      'Eldest sibling — family role with specific responsibilities',
    ],
    nonExamples: [
      'A value about a role → Values',
      'How the person is perceived in a role → Public Persona or Professional Identity',
      'A past role no longer held → should be archived, not current Roles',
    ],
    status: 'stable',
    userFacing: true,
    confidenceRules: {
      writeThreshold: 'single_source',
      requiresUserConfirmation: false,
      maxConfidenceFromSingleSource: 'verified',
      minEvidenceCount: 1,
    },
  },

  PublicPersona: {
    id: 'PublicPersona',
    name: 'Public Persona',
    layer: 'identity',
    parent: null,
    children: [],
    stabilityClass: 'Adaptive',
    definition: 'The intentionally curated self-presentation for specific audiences. Not separate from the person — a selective emphasis of real aspects of self, shaped for relational context. Includes stage identities, public aesthetic, and how the person frames themselves in professional or public settings.',
    ownershipQuestion: 'How does this person intentionally present themselves to specific audiences?',
    classificationTest: 'Is this self-presentation intentionally shaped for a specific audience or public context? If yes → Public Persona.',
    relations: [
      { targetId: 'Style', type: 'depends_on' },
      { targetId: 'Roles', type: 'informs' },
      { targetId: 'ProfessionalIdentity', type: 'informs' },
    ],
    opposites: [
      'Core (who the person actually is, not how they present)',
      'Private roles or relationships',
    ],
    dependencies: ['Style', 'Roles'],
    examples: [
      'Artistic identity and stage name',
      'How the person frames themselves in professional music contexts vs engineering contexts',
      'The aesthetic and messaging of public profiles',
      'How the person introduces themselves when meeting collaborators',
    ],
    nonExamples: [
      'Who the person is in private → Core or Personal Identity',
      'An artistic output → Music domain',
      'A role the person occupies → Roles',
    ],
    status: 'stable',
    userFacing: true,
    confidenceRules: {
      writeThreshold: 'single_source',
      requiresUserConfirmation: false,
      maxConfidenceFromSingleSource: 'high',
      minEvidenceCount: 1,
    },
  },

  ProfessionalIdentity: {
    id: 'ProfessionalIdentity',
    name: 'Professional Identity',
    layer: 'identity',
    parent: null,
    children: [],
    stabilityClass: 'Adaptive',
    definition: 'How the person is known and positioned in their professional field(s). The intersection of actual capabilities, reputation, and intended professional trajectory. Includes how the person positions themselves to clients, collaborators, and industry.',
    ownershipQuestion: 'How is this person known and positioned in their professional world?',
    classificationTest: 'Does this describe how the person is professionally positioned or recognized, in relation to their field? If yes → Professional Identity.',
    relations: [
      { targetId: 'Roles', type: 'depends_on' },
      { targetId: 'PublicPersona', type: 'depends_on' },
      { targetId: 'Aspirations_Becoming', type: 'informs', note: 'Current professional identity and intended becoming shape each other' },
    ],
    opposites: [
      'Personal Identity (non-professional life narrative)',
      'Specific projects or achievements → domain-specific',
    ],
    dependencies: ['Roles', 'PublicPersona'],
    examples: [
      'Music producer with a distinct sound in trap, alternative, and introspective rap',
      'Software engineer with strong systems architecture and AI background',
      'Independent artist-engineer — not operating through a label',
    ],
    nonExamples: [
      'A specific project → Music or Software domain',
      'A personal value → Values',
      'A business relationship → Collective Management domain',
    ],
    status: 'stable',
    userFacing: true,
    confidenceRules: {
      writeThreshold: 'single_source',
      requiresUserConfirmation: false,
      maxConfidenceFromSingleSource: 'high',
      minEvidenceCount: 1,
    },
  },

  PersonalIdentity: {
    id: 'PersonalIdentity',
    name: 'Personal Identity',
    layer: 'identity',
    parent: null,
    children: [],
    stabilityClass: 'Adaptive',
    definition: 'The narrative the person maintains about who they are in the non-professional, non-public dimensions of life. The personal self-concept: how they understand their own character, history, and place in relationships, family, and private experience.',
    ownershipQuestion: 'How does this person understand themselves as a person — not as a professional or public figure?',
    classificationTest: 'Does this describe self-understanding in personal, family, or intimate contexts — the story the person tells themselves about who they are? If yes → Personal Identity.',
    relations: [
      { targetId: 'Psychology', type: 'depends_on' },
      { targetId: 'Preferences', type: 'informs' },
      { targetId: 'Roles', type: 'informs' },
    ],
    opposites: [
      'Public Persona (outward-facing, audience-specific)',
      'Professional Identity (field-specific positioning)',
    ],
    dependencies: ['Psychology'],
    examples: [
      'Self-understanding as someone who sees the gap between what is and what could be',
      'The feeling of existing between worlds — culturally, linguistically, professionally',
      'Identification with the figure of the artist as truth-teller, not entertainer',
      'Sense of responsibility toward family that coexists with creative freedom',
    ],
    nonExamples: [
      'Current emotional state → State',
      'Public self-description → Public Persona',
      'Professional framing → Professional Identity',
    ],
    status: 'stable',
    userFacing: true,
    confidenceRules: {
      writeThreshold: 'multi_source',
      requiresUserConfirmation: false,
      maxConfidenceFromSingleSource: 'medium',
      minEvidenceCount: 2,
    },
  },

};

// ── Layer ordering ────────────────────────────────────────────────────────────

export const ESSENCE_LAYER_ORDER: EssenceLayer[] = [
  'core',
  'aspirations',
  'expression',
  'identity',
];

export const STABILITY_ORDER: StabilityClass[] = [
  'Foundational',
  'Stable',
  'Adaptive',
  'Contextual',
];

// ── Structural flow (DAG) ─────────────────────────────────────────────────────

/**
 * Generative relationships between layers.
 * Core produces both Aspirations and Expression directly.
 * Aspirations also inform Expression.
 * Expression + external Context produces Identity.
 */
export const ESSENCE_FLOW: Record<EssenceLayer, EssenceLayer[]> = {
  core: ['aspirations', 'expression'],
  aspirations: ['expression'],
  expression: ['identity'],
  identity: [],
};

// ── Ownership boundaries ──────────────────────────────────────────────────────

export const ESSENCE_OWNS = [
  'Non-negotiable moral commitments and values',
  'Persistent beliefs and interpretive worldview',
  'Motivational drives — what energizes the person',
  'Non-optional needs — deprivation produces dysfunction',
  'Psychological architecture — structure, not current state',
  'Habitual cognitive patterns and reasoning modes',
  'Structural personal constraints (physiological, cognitive, psychological)',
  'Life directions, intended becoming, desired conditions, contribution, legacy',
  'Aesthetic criteria, creative DNA, behavioral principles',
  'Communication style and integrated personal signature',
  'Recurring expressive choices (Preferences)',
  'Current roles and functional positions in systems',
  'Intentionally curated public self-presentation',
  'Professional positioning and personal self-narrative',
] as const;

export const ESSENCE_DOES_NOT_OWN = [
  'Tasks, plans, deadlines, reminders → Personal Management / Operations',
  'Current emotional or mental load state → Nexus (burden system)',
  'Social graph and relationship quality → Nexus',
  'Financial data and accounts → Operations',
  'Project state (music, software) → domain-specific',
  'Market data, capabilities, providers → PUDM',
  'Technical configuration → infrastructure',
  'Situational constraints (money, visa, tools, permissions) → Nexus / Operations',
  'Session-level mood or temporary choices → State (expires by TTL)',
  'Specific works and outputs → domain-specific',
  'Schedules, habits, routines → Personal Management',
] as const;

// ── Deterministic classification ──────────────────────────────────────────────

export interface ClassificationAnswer {
  belongsInEssence: boolean;
  layer: EssenceLayer | null;
  candidateNodeIds: string[];
  reason: string;
}

/**
 * Deterministic classification for any piece of information about a person.
 *
 * Works from structural questions about the information — not keyword matching.
 * Returns the layer and candidate nodes; the caller selects the most specific node.
 */
export function classifyEssenceInformation(params: {
  isAboutThePersonNotTheirSituation: boolean;
  isStableAcrossContextsAndYears: boolean;
  isAboutDirectionOrBecoming: boolean;
  isAboutHowTheyCreateOrExpress: boolean;
  isAboutHowTheyAreRecognizedByOthers: boolean;
}): ClassificationAnswer {
  const {
    isAboutThePersonNotTheirSituation,
    isStableAcrossContextsAndYears,
    isAboutDirectionOrBecoming,
    isAboutHowTheyCreateOrExpress,
    isAboutHowTheyAreRecognizedByOthers,
  } = params;

  if (!isAboutThePersonNotTheirSituation) {
    return {
      belongsInEssence: false,
      layer: null,
      candidateNodeIds: [],
      reason: 'Describes the situation, not the person. Belongs in Nexus, Operations, or a domain-specific store.',
    };
  }

  if (
    isStableAcrossContextsAndYears &&
    !isAboutDirectionOrBecoming &&
    !isAboutHowTheyCreateOrExpress &&
    !isAboutHowTheyAreRecognizedByOthers
  ) {
    return {
      belongsInEssence: true,
      layer: 'core',
      candidateNodeIds: [
        'Values', 'Beliefs', 'Worldview', 'Motivations', 'Needs',
        'Psychology', 'CognitivePatterns', 'IntrinsicConstraints',
      ],
      reason: 'Describes a stable, context-independent personal property. Belongs in Core.',
    };
  }

  if (isAboutDirectionOrBecoming) {
    return {
      belongsInEssence: true,
      layer: 'aspirations',
      candidateNodeIds: [
        'Aspirations_Becoming', 'Aspirations_LifeDirections',
        'Aspirations_DesiredConditions', 'Aspirations_Contribution', 'Aspirations_Legacy',
      ],
      reason: 'Describes life direction or intended becoming. Belongs in Aspirations.',
    };
  }

  if (isAboutHowTheyCreateOrExpress) {
    return {
      belongsInEssence: true,
      layer: 'expression',
      candidateNodeIds: [
        'Aesthetics', 'CreativeDNA', 'Principles', 'Communication', 'Style', 'Preferences',
      ],
      reason: 'Describes how the person creates, communicates, or expresses. Belongs in Expression.',
    };
  }

  if (isAboutHowTheyAreRecognizedByOthers) {
    return {
      belongsInEssence: true,
      layer: 'identity',
      candidateNodeIds: ['Roles', 'PublicPersona', 'ProfessionalIdentity', 'PersonalIdentity'],
      reason: 'Describes how the person appears or is recognized. Belongs in Identity.',
    };
  }

  return {
    belongsInEssence: false,
    layer: null,
    candidateNodeIds: [],
    reason: 'Cannot be classified into any Essence layer. Flag for human review.',
  };
}

// ── Lookup helpers ────────────────────────────────────────────────────────────

export function getEssenceNode(id: string): EssenceNode | undefined {
  return ESSENCE_ONTOLOGY[id];
}

export function getNodesByLayer(layer: EssenceLayer): EssenceNode[] {
  return Object.values(ESSENCE_ONTOLOGY).filter(n => n.layer === layer);
}

export function getNodesByStability(cls: StabilityClass): EssenceNode[] {
  return Object.values(ESSENCE_ONTOLOGY).filter(n => n.stabilityClass === cls);
}

export const ESSENCE_NODE_IDS = Object.keys(ESSENCE_ONTOLOGY);
