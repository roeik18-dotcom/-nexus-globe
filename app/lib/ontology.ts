/**
 * Nexus · Canonical Ontology v1
 *
 * Source-of-truth vocabulary registry for every named concept in Nexus / Philos.
 * All future code, agents, UI, and documentation must derive names from this file.
 *
 * No engine logic. No UI. No score computation.
 * Pure data — safe to import anywhere.
 */

// ─── Schema ──────────────────────────────────────────────────────────────────

export type Layer =
  | 'dimension'    // Layer 1 — what the person HAS (resources)
  | 'department'   // Layer 2 — where load is REGISTERED (processors)
  | 'burden-flow'  // Layer 3 — how load MOVES (pressure → capacity → inflow → deficit)
  | 'action'       // Layer 4 — what happens NEXT (first move, no coercion)
  | 'allocation'   // Cross-cut — alternative redistribution scenarios
  | 'cell'         // Cross-cut — 18-cell expression matrix
  | 'collapse'     // Cross-cut — negative dominance diagnosis
  | 'load'         // Cross-cut — burden distribution
  | 'leakage'      // Cross-cut — private energy lost to external mission
  | 'orientation'  // Cross-cut — composite readiness metric
  | 'causal'       // Cross-cut — verified causal spine
  | 'weight'       // Cross-cut — mapping matrices
  | 'opm'          // Output — visual explanation layer
  | 'chain';       // Output — full deterministic computation

export type Kind =
  | 'resource-axis'   // a dimension the person possesses
  | 'processor'       // a department that registers and processes load
  | 'metric'          // a computed quantity (number or ratio)
  | 'diagnostic'      // a classified category (enum value)
  | 'action-type'     // an intervention identifier
  | 'allocation-mode' // an alternative redistribution scenario
  | 'matrix'          // a weight table
  | 'composite'       // a multi-field structure that aggregates others
  | 'concept'         // an abstract principle
  | 'future';         // planned for v2, not yet wired

export type Status = 'stable' | 'experimental' | 'future';

export interface ConceptEntry {
  id: string;
  name: string;
  layer: Layer;
  kind: Kind;
  definition: string;
  answersQuestion: string;
  inputs: string[];
  outputs: string[];
  formula?: string;
  relatedConcepts: string[];
  status: Status;
  userFacing: boolean;
  internalKey?: string;          // code key when visible name differs
  internalKeys?: Record<string, string>; // for mappings (visible → internal)
}

// ─── Registry ────────────────────────────────────────────────────────────────

export const ONTOLOGY: Record<string, ConceptEntry> = {

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 1 — DIMENSIONS
  // Resource axes. Outputs of department aggregation.
  // ═══════════════════════════════════════════════════════════════════════════

  Physical: {
    id: 'Physical',
    name: 'Physical',
    layer: 'dimension',
    kind: 'resource-axis',
    definition: 'The body\'s resource axis. Aggregated from all department loads weighted by their physical contribution. Measures bodily capacity remaining.',
    answersQuestion: 'How much physical capacity does the person still have?',
    inputs: ['CollapseMap (all 6 departments)', 'DEPT_TO_DIM_WEIGHTS column Physical'],
    outputs: ['dimensionPressure.Physical', 'dimensionCapacity.Physical', 'dimensionInflow.Physical', 'dimensionDeficit.Physical'],
    formula: 'Σ(dept.negativeDominance × dept.weight.Physical) / Σ(dept.weight.Physical)',
    relatedConcepts: ['Body', 'Drive', 'dimensionPressure'],
    status: 'stable',
    userFacing: true,
  },

  Emotional: {
    id: 'Emotional',
    name: 'Emotional',
    layer: 'dimension',
    kind: 'resource-axis',
    definition: 'The relational resource axis. Measures remaining capacity for trust, belonging, and connection.',
    answersQuestion: 'How much emotional capacity does the person still have?',
    inputs: ['CollapseMap (all 6 departments)', 'DEPT_TO_DIM_WEIGHTS column Emotional'],
    outputs: ['dimensionPressure.Emotional', 'dimensionCapacity.Emotional', 'dimensionInflow.Emotional', 'dimensionDeficit.Emotional'],
    formula: 'Σ(dept.negativeDominance × dept.weight.Emotional) / Σ(dept.weight.Emotional)',
    relatedConcepts: ['Heart', 'Drive', 'dimensionPressure'],
    status: 'stable',
    userFacing: true,
  },

  Rational: {
    id: 'Rational',
    name: 'Rational',
    layer: 'dimension',
    kind: 'resource-axis',
    definition: 'The cognitive resource axis. Measures remaining capacity for clarity, planning, and decision-making.',
    answersQuestion: 'How much rational capacity does the person still have?',
    inputs: ['CollapseMap (all 6 departments)', 'DEPT_TO_DIM_WEIGHTS column Rational'],
    outputs: ['dimensionPressure.Rational', 'dimensionCapacity.Rational', 'dimensionInflow.Rational', 'dimensionDeficit.Rational'],
    formula: 'Σ(dept.negativeDominance × dept.weight.Rational) / Σ(dept.weight.Rational)',
    relatedConcepts: ['Mind', 'Navigation', 'Values', 'dimensionPressure'],
    status: 'stable',
    userFacing: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 2 — DEPARTMENTS
  // Processors. Where load is registered and handled.
  // Visible names are distinct from Dimension names to prevent overlap.
  // ═══════════════════════════════════════════════════════════════════════════

  Body: {
    id: 'Body',
    name: 'Body',
    layer: 'department',
    kind: 'processor',
    definition: 'The somatic processor. Registers and processes direct bodily burden: exhaustion, physical safety, sleep deprivation, pain, and freeze response.',
    answersQuestion: 'Where is physical load entering the system?',
    inputs: ['CollapseMap.negativeDominance[Physical]', 'baseTension: Existence ↔ Decay'],
    outputs: ['negativeDominance', 'DepartmentRebalance', 'DEPT_TO_DIM_WEIGHTS row Body'],
    relatedConcepts: ['Physical', 'Drive', 'negativeDominance'],
    status: 'stable',
    userFacing: true,
    internalKey: 'Physical',
  },

  Drive: {
    id: 'Drive',
    name: 'Drive',
    layer: 'department',
    kind: 'processor',
    definition: 'The survival-energy processor. Registers raw survival pressure: panic, escape impulse, energy depletion, and the need for rest and protection.',
    answersQuestion: 'Where is survival-energy load entering the system?',
    inputs: ['CollapseMap.negativeDominance[ID]', 'baseTension: Security ↔ Threat'],
    outputs: ['negativeDominance', 'DepartmentRebalance', 'DEPT_TO_DIM_WEIGHTS row Drive'],
    relatedConcepts: ['Physical', 'Body', 'negativeDominance'],
    status: 'stable',
    userFacing: true,
    internalKey: 'ID',
  },

  Heart: {
    id: 'Heart',
    name: 'Heart',
    layer: 'department',
    kind: 'processor',
    definition: 'The relational processor. Registers emotional burden: loneliness, shame, anxiety, loss of belonging, and rupture of trust.',
    answersQuestion: 'Where is relational/emotional load entering the system?',
    inputs: ['CollapseMap.negativeDominance[Emotional]', 'baseTension: Connection ↔ Disconnection'],
    outputs: ['negativeDominance', 'DepartmentRebalance', 'DEPT_TO_DIM_WEIGHTS row Heart'],
    relatedConcepts: ['Emotional', 'Values', 'negativeDominance'],
    status: 'stable',
    userFacing: true,
    internalKey: 'Emotional',
  },

  Mind: {
    id: 'Mind',
    name: 'Mind',
    layer: 'department',
    kind: 'processor',
    definition: 'The cognitive processor. Registers rational burden: confusion, information overload, bureaucratic chaos, inability to plan, and decision paralysis.',
    answersQuestion: 'Where is cognitive load entering the system?',
    inputs: ['CollapseMap.negativeDominance[Rational]', 'baseTension: Clarity ↔ Confusion'],
    outputs: ['negativeDominance', 'DepartmentRebalance', 'DEPT_TO_DIM_WEIGHTS row Mind'],
    relatedConcepts: ['Rational', 'Navigation', 'negativeDominance'],
    status: 'stable',
    userFacing: true,
    internalKey: 'Rational',
  },

  Navigation: {
    id: 'Navigation',
    name: 'Navigation',
    layer: 'department',
    kind: 'processor',
    definition: 'The orientation processor. Registers loss of agency: helplessness, identity fracture, loss of control, inability to set boundaries, functional exhaustion.',
    answersQuestion: 'Where is orientation/agency load entering the system?',
    inputs: ['CollapseMap.negativeDominance[EGO]', 'baseTension: Navigation ↔ Lostness'],
    outputs: ['negativeDominance', 'DepartmentRebalance', 'DEPT_TO_DIM_WEIGHTS row Navigation'],
    relatedConcepts: ['Rational', 'Mind', 'OrientationScore', 'negativeDominance'],
    status: 'stable',
    userFacing: true,
    internalKey: 'EGO',
  },

  Values: {
    id: 'Values',
    name: 'Values',
    layer: 'department',
    kind: 'processor',
    definition: 'The moral processor. Registers value-layer burden: obsessive mission, moral self-pressure, inability to release injustice, self-sacrifice, and the war with untruth.',
    answersQuestion: 'Where is moral/meaning load entering the system?',
    inputs: ['CollapseMap.negativeDominance[SUPEREGO]', 'baseTension: Truth/Justice ↔ Falsehood/Injustice'],
    outputs: ['negativeDominance', 'missionPressure', 'DepartmentRebalance', 'DEPT_TO_DIM_WEIGHTS row Values'],
    relatedConcepts: ['Rational', 'Heart', 'missionPressure', 'negativeDominance'],
    status: 'stable',
    userFacing: true,
    internalKey: 'SUPEREGO',
  },

  Communal: {
    id: 'Communal',
    name: 'Communal',
    layer: 'department',
    kind: 'processor',
    definition: 'The value-network carrying layer. Not a personal processor — represents the community\'s capacity to absorb redistributed burden through shared values. Downstream of all other departments.',
    answersQuestion: 'How much is the community carrying?',
    inputs: ['LoadDistribution.distributedLoad', 'LoadDistribution.communityPct'],
    outputs: ['OpmCommunal.carryingCapacity', 'OpmCommunal.communityPct', 'OpmCommunal.gap'],
    relatedConcepts: ['ValueNetwork', 'LoadDistribution', 'communityPct'],
    status: 'stable',
    userFacing: true,
    internalKey: 'Communal',
  },

  departmentToDimensionWeights: {
    id: 'departmentToDimensionWeights',
    name: 'Department → Dimension Weights',
    layer: 'weight',
    kind: 'matrix',
    definition: 'The weight matrix defining how each department\'s load contributes to each dimension. Each row sums to 1.0. Enables computing dimension pressure from department loads and routing inflow back to departments.',
    answersQuestion: 'How much does each department contribute to each resource dimension?',
    inputs: ['DepartmentName', 'Dimension'],
    outputs: ['dimensionPressure (via calculateDimensionPressure)', 'DepartmentRebalance.recovery'],
    formula: `Body:       { Physical: 0.70, Emotional: 0.15, Rational: 0.15 }
Drive:      { Physical: 0.60, Emotional: 0.30, Rational: 0.10 }
Heart:      { Physical: 0.10, Emotional: 0.75, Rational: 0.15 }
Mind:       { Physical: 0.10, Emotional: 0.15, Rational: 0.75 }
Navigation: { Physical: 0.20, Emotional: 0.25, Rational: 0.55 }
Values:     { Physical: 0.10, Emotional: 0.30, Rational: 0.60 }`,
    relatedConcepts: ['Physical', 'Emotional', 'Rational', 'Body', 'Drive', 'Heart', 'Mind', 'Navigation', 'Values', 'dimensionPressure'],
    status: 'stable',
    userFacing: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 3 — BURDEN FLOW
  // The core causal chain per dimension: Pressure → Capacity → Inflow → Deficit
  // ═══════════════════════════════════════════════════════════════════════════

  dimensionPressure: {
    id: 'dimensionPressure',
    name: 'dimensionPressure',
    layer: 'burden-flow',
    kind: 'metric',
    definition: 'Gross load bearing on a dimension before any support is applied. Weighted aggregate of all department loads. Distinct from deficit — does not account for capacity or inflow.',
    answersQuestion: 'How much force is pressing on this dimension right now?',
    inputs: ['CollapseMap (6 departments)', 'departmentToDimensionWeights'],
    outputs: ['DimensionFlow.dimensionPressure', 'ResourceState.dimensionPressure', 'failureType input'],
    formula: 'Σ(dept.negativeDominance × dept.weight[dim]) / Σ(dept.weight[dim])',
    relatedConcepts: ['dimensionCapacity', 'dimensionInflow', 'dimensionDeficit', 'negativeDominance'],
    status: 'stable',
    userFacing: true,
  },

  dimensionCapacity: {
    id: 'dimensionCapacity',
    name: 'dimensionCapacity',
    layer: 'burden-flow',
    kind: 'metric',
    definition: 'Maximum support the helper network COULD route into a dimension if all helpers contributed at their role ceiling. Capacity ≥ Inflow always.',
    answersQuestion: 'How much help could theoretically arrive at this dimension?',
    inputs: ['HelperAllocation.capacity (per helper)', 'HELPER_DIMENSION_WEIGHTS'],
    outputs: ['DimensionFlow.dimensionCapacity', 'mobilizationGap input', 'failureType input'],
    formula: 'Σ(helper.capacity × HELPER_DIMENSION_WEIGHTS[role][dim])',
    relatedConcepts: ['dimensionInflow', 'mobilizationGap', 'failureType', 'supportCapacity'],
    status: 'stable',
    userFacing: true,
  },

  dimensionInflow: {
    id: 'dimensionInflow',
    name: 'dimensionInflow',
    layer: 'burden-flow',
    kind: 'metric',
    definition: 'Support that actually reached a dimension in this redistribution. Always ≤ dimensionCapacity. The gap between capacity and inflow is the mobilizationGap.',
    answersQuestion: 'How much help actually reached this dimension?',
    inputs: ['HelperAllocation.allocated (per helper)', 'HELPER_DIMENSION_WEIGHTS'],
    outputs: ['DimensionFlow.dimensionInflow', 'dimensionDeficit input', 'coveragePct input'],
    formula: 'Σ(helper.allocated × HELPER_DIMENSION_WEIGHTS[role][dim])',
    relatedConcepts: ['dimensionCapacity', 'dimensionDeficit', 'mobilizationGap', 'coveragePct'],
    status: 'stable',
    userFacing: true,
  },

  dimensionDeficit: {
    id: 'dimensionDeficit',
    name: 'dimensionDeficit',
    layer: 'burden-flow',
    kind: 'metric',
    definition: 'Net unresolved load after all support has been applied. The true measure of what a dimension still lacks. Distinct from pressure (ignores support) and capacity (ignores what was used).',
    answersQuestion: 'What remains unresolved in this dimension after all help?',
    inputs: ['dimensionPressure', 'dimensionInflow'],
    outputs: ['DimensionFlow.dimensionDeficit', 'OrientationScore.strongestRemainingDeficit', 'ActionImpact.targetDimension'],
    formula: 'max(0, dimensionPressure − dimensionInflow)',
    relatedConcepts: ['dimensionPressure', 'dimensionInflow', 'failureType', 'Action'],
    status: 'stable',
    userFacing: true,
  },

  mobilizationGap: {
    id: 'mobilizationGap',
    name: 'mobilizationGap',
    layer: 'burden-flow',
    kind: 'metric',
    definition: 'Untapped capacity: the gap between what the helper network could provide and what it actually provided. A high mobilizationGap with high deficit indicates flow_disconnection, not resource shortage.',
    answersQuestion: 'How much available help is not being mobilized?',
    inputs: ['dimensionCapacity', 'dimensionInflow'],
    outputs: ['DimensionFlow.mobilizationGap', 'failureType classification'],
    formula: 'max(0, dimensionCapacity − dimensionInflow)',
    relatedConcepts: ['dimensionCapacity', 'dimensionInflow', 'failureType', 'flow_disconnection'],
    status: 'stable',
    userFacing: true,
  },

  coveragePct: {
    id: 'coveragePct',
    name: 'coveragePct',
    layer: 'burden-flow',
    kind: 'metric',
    definition: 'The percentage of dimension pressure covered by actual inflow. 100% means fully resolved; below 100% means a deficit remains.',
    answersQuestion: 'What percentage of pressure is covered by incoming support?',
    inputs: ['dimensionInflow', 'dimensionPressure'],
    outputs: ['DimensionFlow.coveragePct'],
    formula: 'round((dimensionInflow / dimensionPressure) × 100)',
    relatedConcepts: ['dimensionPressure', 'dimensionInflow', 'dimensionDeficit', 'mobilizationGap'],
    status: 'stable',
    userFacing: true,
  },

  failureType: {
    id: 'failureType',
    name: 'failureType',
    layer: 'burden-flow',
    kind: 'diagnostic',
    definition: 'Auto-classified diagnosis of why a dimension remains under-resourced. Converts numeric ratios into an actionable category. The same deficit value can result from different root causes requiring different interventions.',
    answersQuestion: 'Why does this dimension still have a deficit?',
    inputs: ['dimensionPressure', 'dimensionCapacity', 'dimensionInflow', 'dimensionDeficit'],
    outputs: ['DimensionFlow.failureType'],
    formula: 'deficit ≤ 0 → resolved | capacity < pressure×0.40 → capacity_shortage | inflow < capacity×0.40 → flow_disconnection | else → mobilization_gap',
    relatedConcepts: ['capacity_shortage', 'flow_disconnection', 'mobilization_gap', 'resolved', 'coveragePct', 'Action'],
    status: 'stable',
    userFacing: true,
  },

  capacity_shortage: {
    id: 'capacity_shortage',
    name: 'capacity_shortage',
    layer: 'burden-flow',
    kind: 'diagnostic',
    definition: 'The helper network lacks sufficient capacity to cover the dimension pressure. Real resource scarcity. Required intervention: expand the value network.',
    answersQuestion: 'Is the deficit caused by insufficient helpers?',
    inputs: ['dimensionCapacity < dimensionPressure × 0.40'],
    outputs: ['DimensionFlow.failureType = capacity_shortage'],
    relatedConcepts: ['failureType', 'dimensionCapacity', 'ValueNetwork'],
    status: 'stable',
    userFacing: true,
  },

  flow_disconnection: {
    id: 'flow_disconnection',
    name: 'flow_disconnection',
    layer: 'burden-flow',
    kind: 'diagnostic',
    definition: 'Capacity exists in the network but is not being mobilized. The barrier is relational, coordination-based, or structural — not a resource shortage. Required intervention: remove the barrier to flow.',
    answersQuestion: 'Is the deficit caused by capacity that isn\'t flowing?',
    inputs: ['dimensionCapacity ≥ dimensionPressure × 0.40', 'dimensionInflow < dimensionCapacity × 0.40'],
    outputs: ['DimensionFlow.failureType = flow_disconnection'],
    relatedConcepts: ['failureType', 'mobilizationGap', 'ValueNetwork'],
    status: 'stable',
    userFacing: true,
  },

  mobilization_gap: {
    id: 'mobilization_gap',
    name: 'mobilization_gap',
    layer: 'burden-flow',
    kind: 'diagnostic',
    definition: 'Most capacity has been mobilized; a small residual gap remains. Near-solution state. Required intervention: targeted completion.',
    answersQuestion: 'Is the deficit a small residual after good coverage?',
    inputs: ['dimensionCapacity ≥ dimensionPressure × 0.40', 'dimensionInflow ≥ dimensionCapacity × 0.40', 'dimensionDeficit > 0'],
    outputs: ['DimensionFlow.failureType = mobilization_gap'],
    relatedConcepts: ['failureType', 'dimensionDeficit'],
    status: 'stable',
    userFacing: true,
  },

  resolved: {
    id: 'resolved',
    name: 'resolved',
    layer: 'burden-flow',
    kind: 'diagnostic',
    definition: 'The dimension has no remaining deficit. Inflow has fully offset pressure. No action required on this dimension.',
    answersQuestion: 'Is this dimension fully covered?',
    inputs: ['dimensionDeficit ≤ 0'],
    outputs: ['DimensionFlow.failureType = resolved'],
    relatedConcepts: ['failureType', 'dimensionDeficit'],
    status: 'stable',
    userFacing: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 4 — ACTION
  // First move only. No coercion. No decision on behalf of the person.
  // ═══════════════════════════════════════════════════════════════════════════

  Action: {
    id: 'Action',
    name: 'Action',
    layer: 'action',
    kind: 'composite',
    definition: 'The recommended first intervention. Always one concrete move targeting one dimension and one department. Never prescriptive — surfaces the move, the person decides.',
    answersQuestion: 'What is the single next move the system recommends?',
    inputs: ['OrientationScore.strongestRemainingDeficit', 'HarmonicFlow.departments'],
    outputs: ['ActionImpact: recommendedAction, targetDimension, targetDepartment, expectedGains'],
    relatedConcepts: ['firstMove', 'targetDimension', 'targetDepartment', 'stabilize', 'support', 'clarify', 'distribute', 'amplify'],
    status: 'stable',
    userFacing: true,
  },

  firstMove: {
    id: 'firstMove',
    name: 'firstMove',
    layer: 'action',
    kind: 'concept',
    definition: 'The Nexus principle that action is always a single first step, not a plan. The system does not generate multi-step plans. It identifies the one move that unblocks the most critical deficit.',
    answersQuestion: 'Why only one move?',
    inputs: [],
    outputs: ['Action.recommendedAction'],
    relatedConcepts: ['Action', 'dimensionDeficit', 'OrientationScore'],
    status: 'stable',
    userFacing: false,
  },

  redistributionMove: {
    id: 'redistributionMove',
    name: 'redistributionMove',
    layer: 'action',
    kind: 'concept',
    definition: 'The Nexus principle that all actions are forms of burden redistribution. No action is purely individual — every first move targets the flow of burden between the individual and the value network.',
    answersQuestion: 'What kind of action does Nexus recommend?',
    inputs: [],
    outputs: ['Action', 'LoadDistribution'],
    relatedConcepts: ['Action', 'LoadDistribution', 'ValueNetwork'],
    status: 'stable',
    userFacing: false,
  },

  targetDimension: {
    id: 'targetDimension',
    name: 'targetDimension',
    layer: 'action',
    kind: 'metric',
    definition: 'The dimension (Physical, Emotional, or Rational) with the strongest remaining deficit after redistribution. Determines which ActionId is selected.',
    answersQuestion: 'Which dimension needs the first move most urgently?',
    inputs: ['OrientationScore.strongestRemainingDeficit'],
    outputs: ['ActionImpact.targetDimension', 'ActionImpact.recommendedAction'],
    relatedConcepts: ['dimensionDeficit', 'Action', 'targetDepartment'],
    status: 'stable',
    userFacing: true,
  },

  targetDepartment: {
    id: 'targetDepartment',
    name: 'targetDepartment',
    layer: 'action',
    kind: 'metric',
    definition: 'The department with the highest weight in the targetDimension. The "lead processor" for that dimension. Focuses the action at the most impactful processing point.',
    answersQuestion: 'Which department should the first move target?',
    inputs: ['targetDimension', 'departmentToDimensionWeights'],
    outputs: ['ActionImpact.targetDepartment'],
    formula: 'argmax(dept.weight[targetDimension]) across all departments',
    relatedConcepts: ['targetDimension', 'Action', 'departmentToDimensionWeights'],
    status: 'stable',
    userFacing: true,
  },

  // ActionId options — the concrete identifier values for Action.recommendedAction

  stabilize: {
    id: 'stabilize',
    name: 'stabilize',
    layer: 'action',
    kind: 'action-type',
    definition: 'ActionId targeting the Physical dimension. Mobilises bodily support: rest, safety, physical care. Selected when Physical dimensionDeficit is the strongest remaining deficit.',
    answersQuestion: 'What is the first move when Physical capacity is most depleted?',
    inputs: ['targetDimension = Physical', 'Physical dimensionDeficit is strongest'],
    outputs: ['ActionImpact.recommendedAction = stabilize', 'ActionImpact.targetDimension = Physical'],
    relatedConcepts: ['Action', 'Physical', 'Body', 'targetDimension'],
    status: 'stable',
    userFacing: true,
  },

  support: {
    id: 'support',
    name: 'support',
    layer: 'action',
    kind: 'action-type',
    definition: 'ActionId targeting the Emotional dimension. Mobilises relational support: connection, witness, belonging. Selected when Emotional dimensionDeficit is the strongest remaining deficit.',
    answersQuestion: 'What is the first move when Emotional capacity is most depleted?',
    inputs: ['targetDimension = Emotional', 'Emotional dimensionDeficit is strongest'],
    outputs: ['ActionImpact.recommendedAction = support', 'ActionImpact.targetDimension = Emotional'],
    relatedConcepts: ['Action', 'Emotional', 'Heart', 'targetDimension'],
    status: 'stable',
    userFacing: true,
  },

  clarify: {
    id: 'clarify',
    name: 'clarify',
    layer: 'action',
    kind: 'action-type',
    definition: 'ActionId targeting the Rational dimension. Mobilises cognitive support: information, clarity, decision help. Selected when Rational dimensionDeficit is the strongest remaining deficit.',
    answersQuestion: 'What is the first move when Rational capacity is most depleted?',
    inputs: ['targetDimension = Rational', 'Rational dimensionDeficit is strongest'],
    outputs: ['ActionImpact.recommendedAction = clarify', 'ActionImpact.targetDimension = Rational'],
    relatedConcepts: ['Action', 'Rational', 'Mind', 'targetDimension'],
    status: 'stable',
    userFacing: true,
  },

  distribute: {
    id: 'distribute',
    name: 'distribute',
    layer: 'action',
    kind: 'action-type',
    definition: 'ActionId targeting collective redistribution across all dimensions. Selected when broadening the value network is the priority move rather than addressing one specific dimension.',
    answersQuestion: 'What is the first move when collective redistribution is the priority?',
    inputs: ['LoadDistribution', 'communityPct', 'all dimensions'],
    outputs: ['ActionImpact.recommendedAction = distribute'],
    relatedConcepts: ['Action', 'LoadDistribution', 'Communal', 'redistributionMove'],
    status: 'stable',
    userFacing: true,
  },

  amplify: {
    id: 'amplify',
    name: 'amplify',
    layer: 'action',
    kind: 'action-type',
    definition: 'ActionId targeting flow amplification when mobilizationGap is high. Selected when capacity exists in the network but is not reaching the dimension — the barrier is flow, not resource scarcity. Targets the Orientation / Navigation layer.',
    answersQuestion: 'What is the first move when existing capacity is not flowing?',
    inputs: ['mobilizationGap (high)', 'failureType = flow_disconnection', 'OrientationScore'],
    outputs: ['ActionImpact.recommendedAction = amplify'],
    relatedConcepts: ['Action', 'mobilizationGap', 'Navigation', 'flow_disconnection'],
    status: 'stable',
    userFacing: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ALLOCATION
  // Alternative redistribution scenarios shown side-by-side.
  // The system presents options; the person chooses.
  // ═══════════════════════════════════════════════════════════════════════════

  currentAllocation: {
    id: 'currentAllocation',
    name: 'currentAllocation',
    layer: 'allocation',
    kind: 'allocation-mode',
    definition: 'The actual redistribution as computed by the system: priority-ordered helper allocation up to DISTRIBUTABLE_FRACTION (65%) of personal load.',
    answersQuestion: 'What does the current redistribution look like?',
    inputs: ['LoadDistribution (computed)'],
    outputs: ['Allocation display baseline'],
    relatedConcepts: ['LoadDistribution', 'maxCarryAllocation', 'balancedAllocation', 'valuePreservingAllocation'],
    status: 'stable',
    userFacing: true,
  },

  maxCarryAllocation: {
    id: 'maxCarryAllocation',
    name: 'maxCarryAllocation',
    layer: 'allocation',
    kind: 'allocation-mode',
    definition: 'An alternative scenario where each helper carries the maximum their supportCapacity allows, without priority ordering. Maximizes total load transferred.',
    answersQuestion: 'What if every helper gave as much as they could?',
    inputs: ['seedLoadProfiles (all helpers)', 'ROLE_LOAD.amount'],
    outputs: ['Allocation scenario: max transferred'],
    relatedConcepts: ['currentAllocation', 'supportCapacity', 'peakUtilization'],
    status: 'experimental',
    userFacing: true,
  },

  balancedAllocation: {
    id: 'balancedAllocation',
    name: 'balancedAllocation',
    layer: 'allocation',
    kind: 'allocation-mode',
    definition: 'An alternative scenario where load is distributed evenly across all helpers regardless of role priority or role-load amount.',
    answersQuestion: 'What if the load were spread equally across all helpers?',
    inputs: ['seedLoadProfiles (all helpers)', 'distributable load'],
    outputs: ['Allocation scenario: equal share per helper'],
    relatedConcepts: ['currentAllocation', 'maxCarryAllocation', 'finalGap'],
    status: 'experimental',
    userFacing: true,
  },

  valuePreservingAllocation: {
    id: 'valuePreservingAllocation',
    name: 'valuePreservingAllocation',
    layer: 'allocation',
    kind: 'allocation-mode',
    definition: 'An alternative scenario where only helpers with high value affinity to the individual are engaged, preserving value alignment at the cost of total coverage.',
    answersQuestion: 'What if we only used helpers who share the person\'s values?',
    inputs: ['affinity (per helper)', 'distributable load'],
    outputs: ['Allocation scenario: value-aligned helpers only'],
    relatedConcepts: ['currentAllocation', 'affinity', 'ValueNetwork'],
    status: 'experimental',
    userFacing: true,
  },

  paretoStatus: {
    id: 'paretoStatus',
    name: 'paretoStatus',
    layer: 'allocation',
    kind: 'metric',
    definition: 'Whether a given allocation is Pareto-optimal: no helper could give more without reducing someone else\'s capacity below threshold.',
    answersQuestion: 'Is this allocation Pareto-optimal?',
    inputs: ['HelperAllocation[]', 'supportCapacity thresholds'],
    outputs: ['boolean flag per allocation scenario'],
    relatedConcepts: ['maxCarryAllocation', 'peakUtilization'],
    status: 'experimental',
    userFacing: false,
  },

  peakUtilization: {
    id: 'peakUtilization',
    name: 'peakUtilization',
    layer: 'allocation',
    kind: 'metric',
    definition: 'The highest utilization rate of any single helper in an allocation (allocated / capacity). Identifies over-reliance on a single node.',
    answersQuestion: 'Is any single helper carrying a disproportionate share?',
    inputs: ['HelperAllocation.allocated', 'HelperAllocation.capacity'],
    outputs: ['ratio per helper, max across helpers'],
    formula: 'max(helper.allocated / helper.capacity) for all helpers',
    relatedConcepts: ['HelperAllocation', 'maxCarryAllocation', 'paretoStatus'],
    status: 'experimental',
    userFacing: true,
  },

  finalGap: {
    id: 'finalGap',
    name: 'finalGap',
    layer: 'allocation',
    kind: 'metric',
    definition: 'The remaining unallocated personal load after all helpers have been engaged in a given scenario. Lower finalGap = more effective redistribution.',
    answersQuestion: 'How much burden remains on the individual after this allocation?',
    inputs: ['LoadDistribution.afterIndividualLoad'],
    outputs: ['display metric per allocation scenario'],
    formula: 'beforeIndividualLoad − distributedLoad',
    relatedConcepts: ['currentAllocation', 'dimensionDeficit', 'LoadDistribution'],
    status: 'experimental',
    userFacing: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FUTURE — v2 only (not wired into any calculation)
  // ═══════════════════════════════════════════════════════════════════════════

  internalAbsorption: {
    id: 'internalAbsorption',
    name: 'internalAbsorption',
    layer: 'burden-flow',
    kind: 'future',
    definition: 'The person\'s capacity to absorb and process incoming support, gated by their internal energy level. Low energy → less effective absorption of the same inflow.',
    answersQuestion: 'Can the person actually receive and use the support that arrives?',
    inputs: ['NodeLoadProfile.energy (individual, node 0)', 'dimensionInflow'],
    outputs: ['effectiveInflow'],
    relatedConcepts: ['effectiveInflow', 'absorptionFactor', 'energy', 'dimensionInflow'],
    status: 'future',
    userFacing: false,
  },

  absorptionFactor: {
    id: 'absorptionFactor',
    name: 'absorptionFactor',
    layer: 'burden-flow',
    kind: 'future',
    definition: 'A scalar (0–1) derived from the individual\'s energy level, representing how effectively they can convert inflow into actual relief. Shape TBD: linear, logistic, or threshold.',
    answersQuestion: 'How efficiently does this person absorb incoming support?',
    inputs: ['NodeLoadProfile.energy (individual)'],
    outputs: ['internalAbsorption', 'effectiveInflow'],
    formula: 'TBD — options: linear (0.4 + energy×0.006) | logistic | threshold (floor 0.30 below energy=20)',
    relatedConcepts: ['internalAbsorption', 'effectiveInflow', 'energy'],
    status: 'future',
    userFacing: false,
  },

  effectiveInflow: {
    id: 'effectiveInflow',
    name: 'effectiveInflow',
    layer: 'burden-flow',
    kind: 'future',
    definition: 'Support that was not just delivered but actually received and processed by the individual. Accounts for absorption capacity. Will replace dimensionInflow in the deficit formula for v2.',
    answersQuestion: 'How much support actually landed and was processed?',
    inputs: ['dimensionInflow', 'absorptionFactor'],
    outputs: ['dimensionDeficit (v2 formula)'],
    formula: 'dimensionInflow × absorptionFactor(energy)',
    relatedConcepts: ['dimensionInflow', 'absorptionFactor', 'internalAbsorption', 'dimensionDeficit'],
    status: 'future',
    userFacing: false,
  },

  energyGatedAbsorption: {
    id: 'energyGatedAbsorption',
    name: 'energyGatedAbsorption',
    layer: 'burden-flow',
    kind: 'future',
    definition: 'The v2 principle that inflow is gated by internal energy: two people with identical pressure and inflow will experience different deficits if their energy levels differ.',
    answersQuestion: 'Why do identical external conditions produce different outcomes for different people?',
    inputs: ['dimensionInflow', 'energy'],
    outputs: ['effectiveInflow', 'dimensionDeficit v2'],
    relatedConcepts: ['effectiveInflow', 'absorptionFactor', 'internalAbsorption'],
    status: 'future',
    userFacing: false,
  },

};

// ─── Layer ordering ───────────────────────────────────────────────────────────

export const LAYER_ORDER: Layer[] = [
  'dimension',
  'department',
  'weight',
  'burden-flow',
  'action',
  'allocation',
  'cell',
  'collapse',
  'load',
  'leakage',
  'orientation',
  'causal',
  'opm',
  'chain',
];

// ─── Internal key map (visible name → code identifier) ───────────────────────

export const DEPT_INTERNAL_KEYS: Record<string, string> = {
  Body: 'Physical',
  Drive: 'ID',
  Heart: 'Emotional',
  Mind: 'Rational',
  Navigation: 'EGO',
  Values: 'SUPEREGO',
  Communal: 'Communal',
};

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getConcept(id: string): ConceptEntry | undefined {
  return ONTOLOGY[id];
}

export function getConceptsByLayer(layer: Layer): ConceptEntry[] {
  return Object.values(ONTOLOGY).filter(c => c.layer === layer);
}

export function getConceptsByStatus(status: Status): ConceptEntry[] {
  return Object.values(ONTOLOGY).filter(c => c.status === status);
}

export const CONCEPT_IDS = Object.keys(ONTOLOGY);
