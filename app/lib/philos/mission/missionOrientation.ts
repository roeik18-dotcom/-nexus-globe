/**
 * Mission / Orientation Object — the canonical, reusable, multi-user
 * bridge the product request named:
 *
 *   PERSON → CURRENT STATE → NEED/DEFICIT/TENSION → VALUE →
 *   CAPABILITY/RESOURCE → POSSIBLE CONTRIBUTION → RECIPIENT/VALUE GROUP →
 *   CONTEXT → ACTION → EFFECT → EVIDENCE → LEARNING → UPDATED ORIENTATION
 *
 * "Mission" here is explicitly NOT spiritual/destiny-based — it is a
 * revisable, evidence-based orientation picture, recomputed from real
 * state every time (see §6 below).
 *
 * REUSE, NOT DUPLICATION. Every dimension below either reuses an existing
 * typed shape directly (`TensionItem`, `NeedRecord`, `ActionLifecycleEntry`,
 * `EntityLink`, `CarryForwardState`, `CapabilityGapSummary`,
 * `HumanChangeRow`) or wraps a value in the one new primitive this module
 * adds, `MissionDimension<T>` — a real/declared/observed/derived/
 * hypothesis/unknown/demo-tagged value, never a bare fact. No second
 * Action/Effect/Evidence/CarryForward model was created.
 *
 * WHAT THIS MODULE DOES NOT DO: it does not parse free-text personal
 * source material (journals, aphorism collections, narrative profiles)
 * into structured "declared" dimension values. That would require
 * interpreting deeply personal reflective statements as operational
 * psychological/relational facts — exactly the automated diagnosis this
 * feature's own product rule forbids ("a source statement is not evidence
 * that a user possesses X"). Such material is category E in the
 * request's own A–E source split (UNSUPPORTED / NON-OPERATIONAL — remains
 * source text, never drives inference) and is out of scope for this
 * module. What IS real and wired in: the general taxonomy (§23,
 * `humanConfigHierarchy.ts` — theory/framework content, not personal
 * disclosure) and every other piece of already-real product state.
 */
import type { TensionItem } from "../tension";
import type { NeedRecord } from "../canon/needStore";
import type { ActionLifecycleEntry, ActionLifecycleSummary } from "../canon/actionLifecycle";
import type { EntityLink } from "../bridge/entityLink";
import type { CarryForwardState, HumanChangeRow } from "../dayClosingFusion";
import { humanChangeRows } from "../dayClosingFusion";
import { buildCapabilityGapSummary, type CapabilityGapSummary, type ValueDomainConfigInstance } from "../valueDomain/valueDomainConfig";
import { linksForEntity } from "../bridge/entityLink";

export type EpistemicStatus = "fact" | "declared" | "observed" | "derived" | "hypothesis" | "unknown" | "demo";

/** Every dimension in a MissionOrientation is wrapped in this — a bare
 *  value is never rendered without stating how confident/sourced it is. */
export interface MissionDimension<T> {
  value: T | null;
  status: EpistemicStatus;
  evidence?: string;
  source?: string;
}

function unknown<T>(): MissionDimension<T> {
  return { value: null, status: "unknown" };
}

function known<T>(value: T, status: EpistemicStatus, evidence?: string, source?: string): MissionDimension<T> {
  return { value, status, evidence, source };
}

/**
 * ONE operational value path (product §2–3): a value is never a
 * decorative tag — it only exists here already threaded through WHY IT
 * MATTERS → CURRENT EXPRESSION → OPPOSING CONDITION → NEED → AVAILABLE
 * CAPABILITY → MISSING CAPABILITY → RECIPIENT → CONTRIBUTION → ACTION →
 * EXPECTED EFFECT → OBSERVED EFFECT → VALUE CREATED → EVIDENCE → NEXT
 * ACTION. Every field is a `MissionDimension` — most are `unknown()` for
 * a value with no real backing, by construction, never fabricated.
 */
export interface OperationalValuePath {
  value_id: string;
  label: string;
  why_it_matters: MissionDimension<string>;
  current_expression: MissionDimension<string>;
  opposing_condition: MissionDimension<string>;
  need: MissionDimension<string>;
  available_capability: MissionDimension<string>;
  missing_capability: MissionDimension<string>;
  possible_recipient: MissionDimension<string>;
  possible_contribution: MissionDimension<string>;
  action: MissionDimension<string>;
  expected_effect: MissionDimension<string>;
  observed_effect: MissionDimension<string>;
  value_created: MissionDimension<string>;
  evidence: MissionDimension<string>;
  next_action: MissionDimension<string>;
}

export interface MissionOrientation {
  subject: string;
  provenance: "REAL" | "DEMO";
  today: string;

  // PERSON → CURRENT STATE
  identity_context: MissionDimension<string>;
  current_state: HumanChangeRow[];

  // NEED / DEFICIT / TENSION
  needs: NeedRecord[];
  tensions: TensionItem[];

  // VALUE (operational only — see OperationalValuePath)
  values: OperationalValuePath[];
  value_oppositions: MissionDimension<string>[];

  // CAPABILITY / RESOURCE
  capabilities: CapabilityGapSummary[];
  resources: MissionDimension<string>[];
  constraints: MissionDimension<string>[];

  // Dimensions with genuinely no real backing anywhere in this product
  // today — always unknown() for a REAL subject, never fabricated. Kept
  // as real typed fields (not omitted) so the schema is honest about what
  // it intends to hold once real data exists.
  skills: MissionDimension<string>[];
  boundaries: MissionDimension<string>[];
  interests: MissionDimension<string>[];
  motivations: MissionDimension<string>[];
  attention: MissionDimension<string>[];
  behavior_patterns: MissionDimension<string>[];
  relationships: MissionDimension<string>[];
  available_energy: MissionDimension<string>;
  available_time: MissionDimension<string>;
  available_capital: MissionDimension<number>;
  opportunities: MissionDimension<string>[];
  risks: MissionDimension<string>[];

  // CONTEXT
  community_context: EntityLink[];
  world_context: MissionDimension<string>[];

  // RECIPIENT / VALUE GROUP
  possible_contributions: MissionDimension<string>[];
  recipients: MissionDimension<string>[];
  value_groups: EntityLink[];

  // ACTION → EFFECT → EVIDENCE → LEARNING
  candidate_actions: ActionLifecycleEntry[];
  uncertainty: MissionDimension<string>;
  confidence: MissionDimension<number>;
  learning: MissionDimension<string>;

  // UPDATED ORIENTATION — the SAME carry-forward object §21 already
  // computes, never a second one.
  carry_forward: CarryForwardState;
}

export function buildMissionOrientation(params: {
  subject: string;
  provenance: "REAL" | "DEMO";
  today: string;
  core: Parameters<typeof humanChangeRows>[0];
  needs: NeedRecord[];
  tensions: TensionItem[];
  lifecycle: ActionLifecycleSummary;
  bridgeRegistry: EntityLink[];
  carryForward: CarryForwardState;
  valueDomain?: { config: ValueDomainConfigInstance; subject: string; operationalValues: OperationalValuePath[] };
}): MissionOrientation {
  const communityLinks = linksForEntity(params.bridgeRegistry, "person", params.subject);
  const capabilities = params.valueDomain
    ? buildCapabilityGapSummary(params.valueDomain.config, params.valueDomain.subject)
    : [];
  const constraints: MissionDimension<string>[] = capabilities
    .flatMap((c) => c.gaps.map((g) => known(g.label, params.provenance === "DEMO" ? "demo" : "declared", g.description, "ValueDomainConfig gap")));

  return {
    subject: params.subject,
    provenance: params.provenance,
    today: params.today,
    identity_context: known(params.subject, "fact", undefined, "canon subject / bridge identity"),
    current_state: humanChangeRows(params.core),
    needs: params.needs,
    tensions: params.tensions,
    values: params.valueDomain?.operationalValues ?? [],
    value_oppositions: [unknown()],
    capabilities,
    resources: capabilities.length > 0 ? [] : [unknown()],
    constraints: constraints.length > 0 ? constraints : [unknown()],
    skills: [unknown()],
    boundaries: [unknown()],
    interests: [unknown()],
    motivations: [unknown()],
    attention: [unknown()],
    behavior_patterns: [unknown()],
    relationships: [unknown()],
    available_energy: unknown(),
    available_time: unknown(),
    available_capital: unknown(),
    opportunities: [unknown()],
    risks: [unknown()],
    community_context: communityLinks,
    world_context: [unknown()],
    possible_contributions: params.valueDomain
      ? params.valueDomain.operationalValues.map((v) => v.possible_contribution)
      : [unknown()],
    recipients: params.valueDomain
      ? params.valueDomain.operationalValues.map((v) => v.possible_recipient)
      : [unknown()],
    value_groups: linksForEntity(params.bridgeRegistry, "community", params.subject),
    candidate_actions: params.lifecycle.actions,
    uncertainty: known(
      `${[...constraints].length} constraint(s) known; skills/interests/motivations/relationships/resources genuinely unknown for this subject`,
      "derived",
    ),
    confidence: params.lifecycle.actions.length > 0 ? known(0.3, "derived", "some real Action history exists") : unknown(),
    learning: params.carryForward.learning_realized_today > 0
      ? known(`${params.carryForward.learning_realized_today} real state_prime Learning today`, "observed")
      : unknown(),
    carry_forward: params.carryForward,
  };
}
