/**
 * PERSON-IN-CONTEXT — the reference frame, composed from three separate
 * axes that must never collapse into each other.
 *
 *     HumanUserBase              (cross-domain reference base)
 *   + Value / Direction          (what matters — a SEPARATE axis)
 *   + Selected DomainConfig<T>   (a swappable contextual slot)
 *   ─────────────────────────────────────────────────────────────
 *   = Person-in-context REFERENCE FRAME
 *
 * ── The whole point: this is a FRAME, not a state ──────────────────────
 *
 * A reference frame says what could be asked, measured, or organised
 * around — for this person, in this context, right now. It says nothing
 * about what IS true of them. Everything downstream of the frame needs
 * real records:
 *
 *   frame → Observation → Measurement → Interpretation
 *         → Need / Capability / Resource → Action → Effect → Evidence
 *
 * The frame is the LEFT edge of that chain and never reaches past it. It
 * has no `measured_state`, no `orientation`, no `tension`, no
 * `next_action` — those are produced by their own systems from live
 * records, and a frame that carried them would let config masquerade as
 * measurement at the exact point the two meet.
 *
 * ── Music is not in this file ──────────────────────────────────────────
 *
 * The domain axis is a `DomainConfigSlot`, resolved through
 * `domainConfigRegistry.ts`. This module names no domain, and the domain
 * is `null` unless a REAL recorded DomainState selected one — availability
 * is never selection. Music can be removed from the registry entirely and
 * every type here still holds.
 */
import {
  type DomainConfigSlot, type SelectedDomainResolution,
  availableDomainConfigs, resolveSelectedDomain,
} from "../canonical/domainConfigRegistry";
import { type HumanUserBase, buildHumanUserBase } from "./humanUserBase";
import type { PersonContext } from "./personContext";
import type { PersonRef } from "./personRef";

/**
 * The VALUE / DIRECTION axis, kept structurally separate from both the
 * human base and the domain.
 *
 * A value relation may establish RELEVANCE for exploration. It may never,
 * by itself, create membership, a group relation, a Need, an Offer, an
 * Action, or a graph edge — and it may never activate a domain. Those all
 * require their own real records, and nothing in this type can stand in
 * for one.
 */
export interface ValueDirectionAxis {
  /** Real, verified value-group relations for this subject. `[]` = none
   *  verified, never "not checked". */
  verified_group_relations: { group_id: string; name: string; central_value: string }[];
  /** Why the axis is empty, when it is. */
  basis: string;
}

export interface PersonInContext {
  person: PersonRef;
  /** The measurement FRAME (reference/context/as-of) — not a measurement. */
  context: PersonContext;
  /** Axis 1 — cross-domain reference base. */
  human_base: HumanUserBase;
  /** Axis 2 — what matters. Separate from base and domain by construction. */
  value_direction: ValueDirectionAxis;
  /** Axis 3 — the swappable domain slot. `null` unless really selected. */
  selected_domain: DomainConfigSlot | null;
  /** Why the domain is what it is — stated, never implied. */
  domain_resolution: SelectedDomainResolution;
  /** Domains that EXIST and could be selected. Availability only. */
  available_domains: readonly DomainConfigSlot[];
  /**
   * What this frame makes POSSIBLE — never what is true. Each list is a
   * vocabulary the frame licenses a question about, drawn from the base
   * and (when selected) the domain. Nothing here is a measurement, a
   * possession, or a need.
   */
  possible: {
    /** Parameters that could be measured, if someone measured them. */
    measurable_parameters: string[];
    /** Questions the config says may be asked. */
    questions: string[];
    /** Capabilities the config DEFINES (defining != possessing). */
    defined_capabilities: string[];
  };
  /** Real, stated gaps in the frame itself. */
  unresolved: string[];
}

/**
 * Compose the frame. Pure and synchronous.
 *
 * `activeDomainId` MUST come from a real recorded DomainState (that is how
 * `app/hub/page.tsx` resolves it). Passing the registry's own contents
 * here would be exactly the config→state inference the architecture
 * forbids, and `resolveSelectedDomain` is written to make that visible
 * rather than silently accepted.
 */
export function buildPersonInContext(params: {
  person: PersonRef;
  context: PersonContext;
  /** From a REAL DomainState, or `null`/`undefined` when none exists. */
  activeDomainId?: string | null;
  /** Real verified value-group relations, already resolved by the caller. */
  verifiedGroupRelations?: { group_id: string; name: string; central_value: string }[];
}): PersonInContext {
  const { person, context, activeDomainId, verifiedGroupRelations = [] } = params;

  const human_base = buildHumanUserBase(person);
  const domain_resolution = resolveSelectedDomain(activeDomainId);
  const selected_domain = domain_resolution.selected ? domain_resolution.slot : null;

  // The domain contributes vocabulary ONLY when really selected. An
  // available-but-unselected domain contributes nothing to `possible` —
  // otherwise availability would quietly widen what the frame licenses.
  const domainSet = selected_domain ? selected_domain.activeConfig() : null;
  const domainQuestions = selected_domain ? selected_domain.questions() : [];

  return {
    person,
    context,
    human_base,
    value_direction: {
      verified_group_relations: verifiedGroupRelations,
      basis: verifiedGroupRelations.length > 0
        ? `${verifiedGroupRelations.length} verified value-group relation(s) — membership is a real record, never inferred from value similarity`
        : "no verified value-group relation for this subject; value similarity alone never creates one",
    },
    selected_domain,
    domain_resolution,
    available_domains: availableDomainConfigs(),
    possible: {
      measurable_parameters: human_base.parameter.map((p) => p.id),
      questions: [...human_base.question.map((q) => q.text), ...domainQuestions.map((q) => q.text)],
      defined_capabilities: domainSet ? (domainSet.by_type.CAPABILITY ?? []) : [],
    },
    unresolved: [
      ...human_base.unresolved,
      ...(selected_domain
        ? []
        : [`SELECTED DOMAIN — ${"reason" in domain_resolution ? domain_resolution.reason : "unresolved"}`]),
    ],
  };
}
