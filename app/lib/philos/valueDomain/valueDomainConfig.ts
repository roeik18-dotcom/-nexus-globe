/**
 * Generic Value-Domain Config state engine (removes the standing TRUE
 * blocker "Value-Domain state update — no config exists", tracked since
 * PHILOS-PRODUCT-MASTER-LEDGER.md §13/§18/§19/§21).
 *
 * This is a CONTRACT, not a claim of real ingested data. No Human Config
 * or Music Config source file was opened to build this — those remain
 * deferred (standing constraint, confirmed repeatedly this session). What
 * this module proves is the ARCHITECTURE: a domain-agnostic shape for
 * Domain/Parameter/State/Capability/Gap/Acceptance/Action-Result, generic
 * enough that a second, unrelated Value Domain could use it without any
 * code change here — demonstrated with exactly one DEMO instance
 * (`demoMusicDomain.ts`), never presented as real.
 *
 * Every state UPDATE (`deriveDomainStateUpdate`) is GATED the way canon
 * gates: a state only advances when a real, checked `observed_result` +
 * `accepted` outcome exists — an expected-but-unobserved result never
 * silently becomes a state change. The gate is where the resemblance to
 * canon ends, and the difference matters: canon's `deriveLearning` never
 * computes a Level at all, while `deriveDomainStateUpdate` applies
 * `prior.level + 1`. That increment is a QUARANTINED product rule, not
 * canon — see the function's own header and
 * `app/lib/philos/canon/STATE-TRANSITION-BOUNDARY.md`.
 *
 * "Do not assume every domain has skills/tools/workflows" — the core
 * contract below has NO such fields. `demoMusicDomain.ts` adds a
 * domain-specific `practice_note` string on its own action-results,
 * entirely outside this contract, to prove domain-specific extension
 * doesn't require touching the generic shape.
 *
 * ── VALUE_DOMAIN_MASTER audit (this pass) ───────────────────────────────
 *
 * Requested canonical set: VALUE_DOMAIN, VALUE_PARAMETER, NEED,
 * CAPABILITY, RESOURCE, CONSTRAINT, GAP, CONTRIBUTION, RECIPIENT, ACTION,
 * OUTCOME/EFFECT, EVIDENCE, UPDATED_STATE. Checked against two real,
 * already-existing sources — `PHILOS-MELTING-POT-CANON.md` (the locked
 * canon this codebase's `canon/` directory implements field-for-field)
 * and `docs/philos-universal-data-model-v0.md` (PUDM: the SEPARATE
 * Mission→Gap→Value→Capability→Provider chain powering `/marketplace`,
 * `/world`, `/pudm` — evidence-on-relations, no Need/Resource/Action/
 * Outcome nodes at all). This module already existed as the correct
 * home for a Value-Domain-scoped (Music-and-beyond) contract before this
 * pass — PUDM's chain is Mission-scoped, a different axis, intentionally
 * NOT merged in here (would contaminate two real, differently-scoped
 * "Gap" concepts into one).
 *
 *   VALUE_DOMAIN         FOUND_IN_SOURCE — `ValueDomain` (already built, §22)
 *   VALUE_PARAMETER      FOUND_IN_SOURCE — `DomainParameter` (already built, §22)
 *   CAPABILITY           FOUND_IN_SOURCE — `Capability` (already built, §22)
 *   GAP                  FOUND_IN_SOURCE — `Gap` below (already built, §22;
 *                         parameter-scoped — NOT the same object as PUDM's
 *                         mission-scoped `app/lib/gap/schema.ts::Gap`, kept
 *                         deliberately separate, see above)
 *   UPDATED_STATE        FOUND_IN_SOURCE — `DomainState` + `deriveDomainStateUpdate`
 *                         (already built, §22). Its GATE mirrors canon's
 *                         Effect→OutcomeVerification→Learning discipline;
 *                         its `prior.level + 1` magnitude does NOT and is
 *                         quarantined — canon states no update rule, and
 *                         this is not one (see that function's header).
 *   ACTION / OUTCOME     FOUND_IN_SOURCE — `DomainActionResult` (already built,
 *                         §22: ACTION→EXPECTED→OBSERVED→ACCEPTANCE→EVIDENCE
 *                         inline; `action_id`/`evidence` fields bridge to the
 *                         full canon `Action`/`Effect`/`OutcomeVerification`
 *                         objects — canon/action.ts, canon/effect.ts,
 *                         canon/outcomeVerification.ts — when a domain needs
 *                         the richer, separately-verified form)
 *   EVIDENCE             FOUND_IN_SOURCE — canon's `OutcomeVerification`
 *                         (canon/outcomeVerification.ts: statement,
 *                         provenance, verifier_type, confidence, time,
 *                         method, subject_consent) is the real, tested
 *                         Evidence object; `DomainActionResult.evidence`
 *                         already carries a citation into it. PUDM's OWN,
 *                         DIFFERENT evidence model (grade/signalType on
 *                         relations, §4) is not unified with canon's here —
 *                         two real evidence representations exist for two
 *                         real different subsystems; forcing one into the
 *                         other would be invented, not derived, structure.
 *   NEED                 FOUND_IN_SOURCE — canon's `Need` (canon/need.ts,
 *                         PHILOS-MELTING-POT-CANON.md §12) reused VERBATIM
 *                         below via `DomainNeed`, not re-specified.
 *   RESOURCE             DERIVABLE, NOT A NEW NODE — canon never schema-
 *                         closes a standalone `Resource` object either (§11:
 *                         "Resource lives in the transfer layer, typed and
 *                         costed independently"); it is always expressed as
 *                         fields ON `Offer`/`Transfer`
 *                         (`available_resource`/`resource_type`/
 *                         `amount_or_capacity` — canon/offer.ts,
 *                         canon/transfer.ts). A Value-Domain resource is
 *                         represented the same way: import `Offer`/
 *                         `Transfer` directly, no parallel type here.
 *   CONSTRAINT            DERIVABLE FROM AN EXISTING PATTERN — canon's own
 *                         `Offer.constraints: string[]` is a property, never
 *                         a first-class object with its own id/lifecycle.
 *                         `DomainConstraint` below is the ONE genuinely new
 *                         type this pass adds, and it is a direct structural
 *                         copy of the already-real `AcceptanceCriterion`
 *                         shape (parameter-scoped statement) — not an
 *                         invented ontology.
 *   CONTRIBUTION          MISSING BY DESIGN — not a gap to fill. Canon
 *                         locks `NO_PERMANENT_DONOR_OR_CONTRIBUTION_PROFILE`
 *                         (§21), and `canon/offer.ts`'s own header states
 *                         Offer is "never a permanent donor-capacity or
 *                         contribution/reputation profile." Building a
 *                         `Contribution` object — even parameter-scoped —
 *                         would be exactly the aggregable/reputation shape
 *                         the locked canon forbids. The only legitimate
 *                         representation of "what was contributed" is the
 *                         existing EPHEMERAL `DomainActionResult` /
 *                         `Transfer` record itself, one at a time, never
 *                         summed into a profile. No type is added for this.
 *   RECIPIENT              MISSING AS AN OBJECT, DERIVABLE AS A ROLE — canon
 *                         names no standalone "Recipient" entity either;
 *                         `Need.subject` and `Transfer.target` already
 *                         identify who receives. No new type is added —
 *                         a domain reads the recipient off whichever real
 *                         Need/Transfer record it is handling.
 *
 * Music-specific fields removed / never added: NONE were present to remove
 * — `demoMusicDomain.ts`'s only domain-specific field
 * (`MusicActionResult.practice_note`) already lived outside this contract
 * before this pass (see that file's own header) and still does. The two
 * new generic fields this pass adds (`needs`, `constraints` on
 * `ValueDomainConfigInstance`) are both OPTIONAL, so an existing config
 * instance that supplies neither (any non-Music domain instantiated before
 * this pass) remains valid without modification — Music is not privileged
 * by, nor required for, either addition.
 */

import type { Need } from "../canon/need";

export type ValueDomainProvenance = "REAL" | "DEMO";

export interface ValueDomain {
  domain_id: string;
  label: string;
  provenance: ValueDomainProvenance;
}

export interface DomainParameter {
  parameter_id: string;
  domain_id: string;
  label: string;
  definition: string;
  provenance: ValueDomainProvenance;
}

/** One state reading for a parameter, for one subject, at one time — same
 *  "prior vs current, chronological only" discipline canon's
 *  `CanonObservationMark` already uses.
 *
 *  State-fusion backbone pass — two fields added, both required:
 *  `domain_id` (previously only derivable by joining through a
 *  `ValueDomainConfigInstance.parameters` lookup table; a persisted
 *  `DomainState` needs to be self-contained, since it now lives in its
 *  own store, not always alongside a full in-memory config instance) and
 *  `confidence` (0–1, the same real self-reported honesty signal canon's
 *  own `Observation.confidence` already carries — was silently absent
 *  before, never defaulted here either: every real caller must state
 *  it). Both existing callers (`demoMusicDomain.ts` and this file's own
 *  tests) were updated to supply them — no field is backfilled with a
 *  guess. */
export interface DomainState {
  domain_id: string;
  parameter_id: string;
  subject: string;
  level: number;
  confidence: number;
  observed_at: string;
  evidence?: string;
  provenance: ValueDomainProvenance;
  /** Phase 4 canonical layer, additive/optional — `CanonicalRef` formatted
   *  strings (`HUMAN:12`, `MUSIC:GEN-MU-PROC-04`, `COLOR:6`,
   *  `canonical/canonicalRef.ts`) this one reading cites. Optional so every
   *  DomainState instantiated before this pass (none of which name a
   *  canonical ref) remains valid without modification — same discipline
   *  this file's own header already documents for `needs`/`constraints`. */
  source_refs?: string[];
}

export type CapabilityStatus = "present" | "developing" | "gap" | "unknown";

export interface Capability {
  capability_id: string;
  parameter_id: string;
  label: string;
  status: CapabilityStatus;
  provenance: ValueDomainProvenance;
}

export interface Gap {
  gap_id: string;
  parameter_id: string;
  label: string;
  description: string;
  provenance: ValueDomainProvenance;
}

export interface AcceptanceCriterion {
  criterion_id: string;
  parameter_id: string;
  statement: string;
  provenance: ValueDomainProvenance;
}

/**
 * NEED, domain-scoped. Wraps canon's real `Need` VERBATIM (see this
 * module's header audit) — `need` is a full, independently-valid
 * `canon/need.ts::Need` object (validate it with `validateNeed`, same as
 * any other canon Need); `domain_id`/`parameter_id` are the ONLY new
 * fields, and they exist purely to scope an otherwise-generic canon Need
 * to one Value Domain / parameter for this contract's own navigation —
 * they add no new semantics to Need itself.
 */
export interface DomainNeed {
  domain_id: string;
  parameter_id?: string;
  need: Need;
}

/**
 * CONSTRAINT, domain-scoped. Structurally identical to
 * `AcceptanceCriterion` on purpose — both are "one real statement, cited
 * to a parameter" — see this module's header audit for why no richer
 * object is invented here (canon itself only ever carries constraints as
 * a plain `string[]` property on `Offer`, never as a first-class type).
 */
export interface DomainConstraint {
  constraint_id: string;
  parameter_id: string;
  statement: string;
  provenance: ValueDomainProvenance;
}

/**
 * ACTION → EXPECTED_RESULT → OBSERVED_RESULT → ACCEPTANCE → EVIDENCE, for
 * one domain parameter. `action_id` ties back to a real canon
 * `Action.action_id` when this domain action is also a persisted canon
 * Action (never required — a domain action-result can exist without one).
 */
export interface DomainActionResult {
  result_id: string;
  parameter_id: string;
  action_id?: string;
  expected_result: string;
  observed_result?: string;
  accepted?: boolean;
  evidence?: string;
  time: string;
  provenance: ValueDomainProvenance;
}

export interface ValueDomainConfigInstance {
  domain: ValueDomain;
  parameters: DomainParameter[];
  states: DomainState[];
  capabilities: Capability[];
  gaps: Gap[];
  acceptanceCriteria: AcceptanceCriterion[];
  actionResults: DomainActionResult[];
  /** Optional (see module header) — a config instance built before this
   *  pass, or a domain with no real Need yet, supplies neither and
   *  remains valid. */
  needs?: DomainNeed[];
  constraints?: DomainConstraint[];
}

/**
 * A parameter's state only advances when a real observed+accepted result
 * exists for it. Returns `null` (never a fabricated delta) when the result
 * is unaccepted, unobserved, or has no evidence.
 *
 * ── QUARANTINE — `prior.level + 1` IS NOT A CANONICAL PHILOS RULE ───────
 *
 * The GATE above is real. The magnitude below is not derived from anything:
 * `level: prior.level + 1` is a product-level bookkeeping increment chosen
 * when this module was built, not a canon-stated update rule.
 *
 * It must not be read as canon's `State → State'`. Canon's `learning.ts`
 * refuses to compute a candidate Level/Stability at all — it only GATES a
 * caller-proposed one — because canon §26 keeps "receiving support raises
 * future stability/capacity" an OPEN EMPIRICAL ASSUMPTION to measure, never
 * to assert. `+1` asserts it. This function's earlier doc line claiming it
 * "mirrors `deriveLearning`'s own state_prime discipline" was the exact
 * inversion of the truth and has been removed: `deriveLearning`'s
 * discipline is to NOT produce a number.
 *
 * Do not copy this formula into canon, do not cite it as precedent for a
 * state-transition rule, and do not present its output as the subject's
 * measured state having changed. The unresolved canonical questions are
 * recorded, deliberately unsolved, in
 * `app/lib/philos/canon/STATE-TRANSITION-BOUNDARY.md`; the one live caller
 * is quarantined at `app/lib/philos/canon/domainStateLearning.ts`.
 */
export function deriveDomainStateUpdate(
  prior: DomainState,
  result: DomainActionResult,
): DomainState | null {
  if (result.parameter_id !== prior.parameter_id) return null;
  if (!result.observed_result || result.accepted !== true || !result.evidence) return null;
  return {
    domain_id: prior.domain_id,
    parameter_id: prior.parameter_id,
    subject: prior.subject,
    // QUARANTINED product rule — not canon. See this function's header.
    level: prior.level + 1,
    confidence: prior.confidence,
    observed_at: result.time,
    evidence: result.evidence,
    provenance: prior.provenance,
  };
}

export interface CapabilityGapSummary {
  parameter_id: string;
  parameter_label: string;
  current_level: number | null;
  capabilities: Capability[];
  gaps: Gap[];
}

/** One row per parameter, aggregating its current state + capabilities +
 *  gaps — real, checked, never a single opaque "domain score". */
export function buildCapabilityGapSummary(config: ValueDomainConfigInstance, subject: string): CapabilityGapSummary[] {
  return config.parameters.map((p) => {
    const subjectStates = config.states.filter((s) => s.parameter_id === p.parameter_id && s.subject === subject);
    const latest = [...subjectStates].sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0];
    return {
      parameter_id: p.parameter_id,
      parameter_label: p.label,
      current_level: latest ? latest.level : null,
      capabilities: config.capabilities.filter((c) => c.parameter_id === p.parameter_id),
      gaps: config.gaps.filter((g) => g.parameter_id === p.parameter_id),
    };
  });
}

export type HumanValueRelationType = "supports" | "enables" | "constrains" | "requires" | "conflicts";

/**
 * A Human×Value relation is a literal, evidence-backed FACT — never
 * computed/inferred from correlation. Every instance must state its own
 * evidence. There is no function anywhere that derives one automatically,
 * matching this session's standing "do not infer Human↔Value causality
 * without evidence" rule.
 */
export interface HumanValueRelation {
  relation_id: string;
  type: HumanValueRelationType;
  human_domain: "G" | "E" | "C";
  parameter_id: string;
  statement: string;
  evidence: string;
  provenance: ValueDomainProvenance;
}
