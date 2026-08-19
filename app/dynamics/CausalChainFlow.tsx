/**
 * CausalChainFlow — Dynamics' DOMINANT visual (Dynamics Visual Delivery pass).
 *
 * One causal timeline, top of the route, spanning the full loop:
 *
 *   STATE(t0) → OBSERVATION → ACTION → EFFECT → EVIDENCE → LEARNING
 *             → STATE(t1) → NEXT ACTION
 *
 * over the SAME real data `DynamicsDayClosingSection` already computed
 * (`core`, `lifecycle`, `nextAction`) — no new fact, no new store, no new
 * read. This is a spatial re-arrangement of already-real values, not a
 * second derivation.
 *
 * Every stage states four things about itself, and nothing more than the
 * record actually carries:
 *   - CONTENT      the real value/statement, verbatim from the record
 *   - TIME         the record's own timestamp (Observation.time /
 *                  Action.time / Effect.time / OutcomeVerification.time /
 *                  Learning.time) — never "now", never inferred
 *   - CONFIDENCE   only where the schema HAS one: Observation.confidence,
 *                  OutcomeVerification.confidence (claimed and verified),
 *                  Learning.confidence. Action carries no confidence field
 *                  in canon §24, so ACTION states UNKNOWN rather than
 *                  borrowing a neighbour's number.
 *   - PROVENANCE   which layer the value came from:
 *                    CANON  — a persisted canon record (Observation /
 *                             Action / Effect / Learning store)
 *                    REAL   — the real durable event log
 *                    LEGACY — the pre-canon projectDynamics graph
 *                    DEMO   — a DEMO_COMMUNITIES reference instance
 *                    STATIC — computed in-code from a rule, not stored
 *                  Every stage on this chain is CANON except NEXT ACTION,
 *                  which is STATIC: it is a priority rule over the real
 *                  records, not itself a record. Saying so is the point.
 *
 * A stage with no real record renders as an explicit UNKNOWN card — the
 * gap is stated, sized and counted, never filled with a placeholder and
 * never quietly dropped from the chain. `STATE(t0)` is the real prior canon
 * Observation for the SAME (subject, domain); when no earlier Observation
 * exists it is UNKNOWN rather than a fabricated baseline, and the Δ is
 * withheld rather than computed against a guess.
 *
 * `STATE(t1)` is the chain's OPEN BOUNDARY and is ALWAYS UNKNOWN today —
 * see the stage's own comment and `OpenBoundaryBand` below. It used to
 * re-show the anchor Observation's level, which let one measurement stand
 * in for a state transition and made the loop read as closed. It is not:
 * no canonical persistence/update contract for State′ exists, and a
 * VERIFIED Effect proves an Effect outcome only — never Learning, never a
 * changed Level/Stability, never State(t+1). The five unresolved questions
 * behind that gap are recorded, unsolved, in
 * `app/lib/philos/canon/STATE-TRANSITION-BOUNDARY.md`.
 *
 * Selection rule is the pre-existing one, not a new one: the most recent
 * real Observation (whichever domain last changed) anchors the chain, and
 * the most recent real Action carries its own real Effect/Evidence/
 * Learning — the same `mostRecentMark`/lifecycle sort used elsewhere.
 */
import type { OrientationCore } from "@/app/lib/philos/orientationCore";
import type { ActionLifecycleSummary } from "@/app/lib/philos/canon/actionLifecycle";
import type { ActiveConfigSet } from "@/app/lib/philos/canonical/activeConfig";
import type { DomainConfigBaseline, SelectedDomainResolution } from "@/app/lib/philos/canonical/domainConfigRegistry";
import { encodeSystemContextRef } from "@/app/lib/systemContext";
import { COLOR, RADIUS, SPACE, STATUS, TYPE } from "@/app/lib/philos/shell/designTokens";
import { ProvenanceBadge, PROVENANCE_STYLE, type Provenance } from "@/app/lib/philos/shell/provenance";
import {
  EPISTEMIC_WEIGHT, OPEN_BOUNDARY_SURFACE, OpenBoundaryMark, weightOfProvenance,
} from "@/app/lib/philos/shell/epistemics";
import { LinkageConnector, LinkageLegend, type Linkage } from "@/app/lib/philos/shell/linkage";

const DOMAIN_WORD: Record<"G" | "E" | "C", string> = { G: "גוף", E: "רגש", C: "שכל" };
const DOMAINS: ("G" | "E" | "C")[] = ["G", "E", "C"];

interface StageData {
  key: string;
  /** The formal stage name — the timeline's own vocabulary, never data. */
  label: string;
  /** Hebrew gloss of what this stage IS, so the chain reads as product. */
  gloss: string;
  /** The real value, or `null` when no real record exists for this stage. */
  content: string | null;
  /** Secondary real detail (domain, mechanism, method, verifier…). */
  detail?: string;
  /** The record's OWN timestamp; `null` when the stage has no record. */
  time: string | null;
  /** Only where the schema carries one; `null` = the schema has none, or
   *  the record is absent. `note` says which of the two it is. */
  confidence: number | null;
  confidenceNote?: string;
  provenance: Provenance;
  /** Why this stage is empty, stated in the card itself. */
  empty: string;
  /** How this stage is connected to the PREVIOUS one — classified from the
   *  real records, never from position in the row (`shell/linkage.tsx`).
   *  Ignored on the first stage, which has no predecessor. */
  linkFromPrevious: Linkage;
  /** Set on an INTENDED stage whose data/persistence contract is genuinely
   *  unresolved, so it renders as an OPEN BOUNDARY rather than as an
   *  ordinary empty card ("unresolved contract" != "zero happened"). */
  boundary?: boolean;
  /** The word shown on an empty card — "UNKNOWN" (no record at all) or
   *  "UNLINKED" (records exist but none explicitly references the anchor
   *  Observation). The two are different facts and never share a label. */
  stateWord?: "UNKNOWN" | "UNLINKED";
  href?: string;
}

export default function CausalChainFlow({
  core, lifecycle, nextAction, subject, today, configBaseline,
}: {
  core: OrientationCore;
  lifecycle: ActionLifecycleSummary;
  nextAction: { label: string; href: string } | null;
  subject?: string;
  today?: string;
  /** The two config AXES, kept separate on purpose (they are not the same
   *  kind of thing and must never be rendered as one bag):
   *    `person`    HUMAN CONFIG — the reusable, cross-domain reference base.
   *    `domains`   DOMAIN CONFIG SLOTS — swappable contextual slots, read
   *                from `domainConfigRegistry.ts`. Music is one registered
   *                instance; this component names no domain of its own.
   *    `selection` which domain is ACTIVE, resolved only from a real
   *                recorded DomainState — availability is never selection.
   *  Config is NEVER poured into STATE(t0)/STATE(t1): those stages keep
   *  reading only real Observations, and stay UNKNOWN without one. */
  configBaseline?: {
    person: ActiveConfigSet;
    domains: DomainConfigBaseline[];
    selection: SelectedDomainResolution;
  };
}) {
  const marks = DOMAINS
    .map((d) => ({ d, mark: core[d], prior: d === "G" ? core.priorG : d === "E" ? core.priorE : core.priorC }))
    .filter((x): x is { d: "G" | "E" | "C"; mark: NonNullable<typeof x.mark>; prior: typeof x.prior } => !!x.mark);
  const anchor = marks.length > 0 ? [...marks].sort((a, b) => b.mark.observed_at.localeCompare(a.mark.observed_at))[0] : null;

  const sortedActions = [...lifecycle.actions].sort((a, b) => b.action.recorded_at.localeCompare(a.action.recorded_at));

  // CAUSAL CHAIN INTEGRITY (semantic-integrity repair): an Action enters
  // THIS chain only through an EXPLICIT canonical reference to the anchor
  // Observation — `action.inputs` naming its canon_event_id, or a Learning
  // whose `prior_state_ref` names it (reaching the Action via its own
  // effect_ref/action_ref chain). "Latest record" is NOT a causal link:
  // without an explicit reference the chain renders UNLINKED, and recent
  // unrelated records appear ONLY in the CONTEXT / RECENT ACTIVITY section
  // below — never as this Observation's own Action/Effect.
  const anchorId = anchor?.mark.canon_event_id;
  const linkedAction = anchorId
    ? sortedActions.find((a) =>
        a.action.action.inputs.includes(anchorId)
        || a.effects.some((e) => e.learnings.some((l) => l.learning.prior_state_ref === anchorId)))
      ?? null
    : null;
  const latestAction = linkedAction;
  const latestEffect = linkedAction?.effects[0] ?? null;
  const verifiedOutcome = latestEffect?.verified ? latestEffect.effect.effect.verified_outcome ?? null : null;
  const latestLearning = latestEffect?.learnings.find((l) => l.learning.result.kind === "state_prime")
    ?? latestEffect?.learnings[0]
    ?? null;
  // A `state_prime` Learning yields a CANDIDATE, never a State(t+1) — see
  // the STATE(t1) stage below and `STATE-TRANSITION-BOUNDARY.md`.
  const candidateStatePrime = latestLearning?.learning.result.kind === "state_prime"
    ? latestLearning.learning.result.candidate_state_prime
    : null;
  // Real records that exist but are NOT linked to this Observation —
  // context only, clearly labeled, never implied causal.
  const unlinkedRecent = sortedActions.filter((a) => a !== linkedAction).slice(0, 3);
  const hasUnlinked = unlinkedRecent.length > 0;
  const unlinkedNote = hasUnlinked
    ? "UNLINKED — קיימות רשומות אחרות ללא קישור מפורש לתצפית זו (ראה CONTEXT למטה)"
    : null;

  // ── LINKAGE CLASSIFICATION (`shell/linkage.tsx`) ────────────────────────
  //
  // One classification per transition, each read off the REAL records — a
  // horizontal row of identical arrows was itself a causal claim the store
  // does not support, so every connector now states which kind of link it
  // is (or that there is none).
  //
  // Nothing here can return VERIFIED_CAUSAL_LINK, and that is the honest
  // state of the data: no canon primitive carries a causal field — no
  // `caused_by`, no cause/effect edge type. The strongest real statement
  // any two records make about each other is "this one names that one's
  // id", which is exactly VERIFIED_REFERENCE_LINK.
  const linkage = {
    // Two real Observations of the same (subject, domain), ordered in time.
    // Neither references the other — canon has no cross-Observation link.
    t0_obs: (anchor && anchor.prior ? "CHRONOLOGICAL_ONLY" : "UNKNOWN") as Linkage,
    // `linkedAction` was found ONLY via an explicit id reference
    // (`action.inputs` naming the anchor's canon_event_id, or a Learning's
    // `prior_state_ref`). Real Actions that exist without such a reference
    // are a real negative finding, not missing data.
    obs_action: (latestAction ? "VERIFIED_REFERENCE_LINK" : hasUnlinked ? "UNLINKED" : "UNKNOWN") as Linkage,
    // `effect.action_ref` — an explicit, checked id reference.
    action_effect: (latestEffect ? "VERIFIED_REFERENCE_LINK" : "UNKNOWN") as Linkage,
    // EVIDENCE is `Effect.verified_outcome`: a field ON the same record.
    effect_evidence: (verifiedOutcome ? "VERIFIED_REFERENCE_LINK" : "UNKNOWN") as Linkage,
    // `learning.effect_ref` — an explicit, checked id reference.
    evidence_learning: (latestLearning ? "VERIFIED_REFERENCE_LINK" : "UNKNOWN") as Linkage,
    // OPEN BOUNDARY: no canonical persistence/update contract for State′
    // exists, so this transition can never be classified as a link today —
    // not "not yet recorded", but "no contract to record it under".
    learning_t1: "UNKNOWN" as Linkage,
    // STATE(t1) has no record, so nothing can link FROM it. NEXT ACTION is
    // separately a STATIC priority rule over ALL real records — never a
    // consequence of the stage drawn to its left.
    t1_next: "UNKNOWN" as Linkage,
  };

  const stages: StageData[] = [
    {
      key: "t0", label: "STATE(t0)", gloss: "מצב לפני", linkFromPrevious: "UNKNOWN",
      content: anchor?.prior ? `level ${anchor.prior.level}` : null,
      detail: anchor?.prior ? `${DOMAIN_WORD[anchor.d]} · stability ${anchor.prior.stability}` : undefined,
      time: anchor?.prior?.observed_at ?? null,
      confidence: anchor?.prior?.confidence ?? null,
      confidenceNote: anchor?.prior && anchor.prior.confidence === undefined ? "לא נרשם ברשומה" : undefined,
      provenance: anchor?.prior ? "CANON" : "UNKNOWN",
      empty: "אין תצפית קודמת לאותו domain — אין בסיס להשוואה",
      href: anchor?.prior
        ? `?ctx=${encodeURIComponent(encodeSystemContextRef({ kind: "canon_observation", canon_event_id: anchor.prior.canon_event_id }))}`
        : undefined,
    },
    {
      key: "obs", label: "OBSERVATION", gloss: "מה נצפה", linkFromPrevious: linkage.t0_obs,
      content: anchor ? `${DOMAIN_WORD[anchor.d]} · level ${anchor.mark.level}` : null,
      detail: anchor ? `${anchor.mark.deficitType} · ${anchor.mark.provenance}` : undefined,
      time: anchor?.mark.observed_at ?? null,
      confidence: anchor?.mark.confidence ?? null,
      confidenceNote: anchor && anchor.mark.confidence === undefined ? "לא נרשם ברשומה" : undefined,
      provenance: anchor ? "CANON" : "UNKNOWN",
      empty: "אין Observation אמיתית לנושא זה",
      href: anchor
        ? `?ctx=${encodeURIComponent(encodeSystemContextRef({ kind: "canon_observation", canon_event_id: anchor.mark.canon_event_id }))}`
        : undefined,
    },
    {
      key: "action", label: "ACTION", gloss: "מה נעשה", linkFromPrevious: linkage.obs_action,
      content: latestAction ? latestAction.action.action.type : null,
      detail: latestAction
        ? `${latestAction.action.action.mechanism_scope} · ${latestAction.action.action.reversibility}`
        : undefined,
      time: latestAction?.action.action.time ?? null,
      confidence: null,
      confidenceNote: latestAction ? "Action אינו נושא confidence בסכימה" : undefined,
      provenance: latestAction ? "CANON" : "UNKNOWN",
      stateWord: latestAction ? undefined : hasUnlinked ? "UNLINKED" : "UNKNOWN",
      empty: unlinkedNote ?? "אין Action אמיתית רשומה",
      href: latestAction ? `?ctx=${encodeURIComponent(`action:${latestAction.action.action.action_id}`)}` : undefined,
    },
    {
      key: "effect", label: "EFFECT", gloss: "מה נטען שקרה", linkFromPrevious: linkage.action_effect,
      content: latestEffect ? latestEffect.effect.effect.claimed_outcome.statement : null,
      detail: latestEffect ? (latestEffect.verified ? "VERIFIED" : "CLAIMED ONLY") : undefined,
      time: latestEffect?.effect.effect.claimed_outcome.time ?? null,
      confidence: latestEffect?.effect.effect.claimed_outcome.confidence ?? null,
      provenance: latestEffect ? "CANON" : "UNKNOWN",
      stateWord: latestEffect ? undefined : hasUnlinked ? "UNLINKED" : "UNKNOWN",
      empty: unlinkedNote ?? "אין Effect רשום ל-Action מקושר",
      href: latestEffect ? `?ctx=${encodeURIComponent(`effect:${latestEffect.effect.effect.effect_id}`)}` : undefined,
    },
    {
      key: "evidence", label: "EVIDENCE", gloss: "מה מאמת", linkFromPrevious: linkage.effect_evidence,
      content: verifiedOutcome ? verifiedOutcome.statement : null,
      detail: verifiedOutcome ? `${verifiedOutcome.verifier_type} · ${verifiedOutcome.method}` : undefined,
      time: verifiedOutcome?.time ?? null,
      confidence: verifiedOutcome?.confidence ?? null,
      provenance: verifiedOutcome ? "CANON" : "UNKNOWN",
      stateWord: verifiedOutcome ? undefined : latestEffect ? "UNKNOWN" : hasUnlinked ? "UNLINKED" : "UNKNOWN",
      empty: latestEffect ? "Effect נטען בלבד — אין אימות" : unlinkedNote ?? "אין ראיה מאומתת",
    },
    {
      key: "learning", label: "LEARNING", gloss: "מה נלמד", linkFromPrevious: linkage.evidence_learning, boundary: !latestLearning,
      content: latestLearning
        ? (latestLearning.learning.result.kind === "state_prime" ? "state_prime" : `no_update · ${latestLearning.learning.result.reason}`)
        : null,
      detail: latestLearning ? latestLearning.learning.update_method : undefined,
      time: latestLearning?.learning.time ?? null,
      confidence: latestLearning?.learning.confidence ?? null,
      provenance: latestLearning ? "CANON" : "UNKNOWN",
      stateWord: latestLearning ? undefined : hasUnlinked ? "UNLINKED" : "UNKNOWN",
      empty: unlinkedNote ?? "אין רשומת Learning — מעבר Learning אינו נתמך בחוזה הקנוני הנוכחי. Effect מאומת אינו Learning.",
    },
    // STATE(t1) — THE OPEN BOUNDARY, stated rather than filled.
    //
    // This card used to re-show the ANCHOR Observation's own level, which
    // made the chain read as a CLOSED loop: one single measurement filled
    // both OBSERVATION and STATE(t1), so "…→ LEARNING → STATE(t1)" appeared
    // satisfied while nothing in this system had ever produced a State(t+1).
    // Nothing can today: no canonical persistence/update contract for State′
    // exists. No store writes a "current" CellState (`PERSISTENCE_POLICY.md`,
    // CellState row), and `learning.ts` deliberately only GATES a
    // caller-proposed candidate — which it names `candidate_state_prime`
    // precisely because it is a candidate, not a new state.
    //
    // The two real MEASUREMENTS (prior → current Observation) are not
    // removed: they render below in BEFORE → AFTER, labelled as measurement.
    // A second reading is a second measurement, never a derived transition.
    // See `app/lib/philos/canon/STATE-TRANSITION-BOUNDARY.md`.
    {
      key: "t1", label: "STATE(t1)", gloss: "מצב אחרי", linkFromPrevious: linkage.learning_t1, boundary: true,
      content: null,
      time: null,
      confidence: null,
      confidenceNote: "אין רשומת State′ שתישא confidence",
      provenance: "UNKNOWN",
      stateWord: "UNKNOWN",
      empty: candidateStatePrime
        ? `קיים candidate_state_prime (level ${candidateStatePrime.level}) — מועמד בלבד. אין חוזה קנוני לשמירה/עדכון של State′.`
        : "אין חוזה קנוני לשמירה/עדכון של State′ — מעבר המצב אינו נתמך היום. מדידה חוזרת (BEFORE → AFTER) אינה מעבר מצב.",
    },
    {
      key: "next", label: "NEXT ACTION", gloss: "מה הצעד הבא", linkFromPrevious: linkage.t1_next,
      content: nextAction ? nextAction.label : null,
      detail: nextAction ? "נגזר מכלל עדיפות על הרשומות האמיתיות" : undefined,
      time: null,
      confidence: null,
      confidenceNote: nextAction ? "כלל, לא רשומה" : undefined,
      provenance: nextAction ? "STATIC" : "UNKNOWN",
      empty: "אין פעולה מוצדקת מהנתונים הקיימים",
      href: nextAction?.href,
    },
  ];

  const known = stages.filter((s) => s.content !== null).length;

  return (
    <section dir="rtl" style={S.band}>
      <header style={S.head}>
        <div>
          <div style={S.eyebrow}>הציר הסיבתי · CAUSAL TIMELINE</div>
          <h2 style={S.title}>
            STATE(t0) → OBSERVATION → ACTION → EFFECT → EVIDENCE → LEARNING → STATE(t1) → NEXT ACTION
          </h2>
        </div>
        <div style={S.headMeta}>
          {subject ? <span style={S.headChip}>{subject}</span> : null}
          {today ? <span style={S.headChip}>{today}</span> : null}
          <span style={{ ...S.headChip, color: known === stages.length ? STATUS.real.text : "#fbbf24" }}>
            {known}/{stages.length} שלבים מגובים ברשומה
          </span>
        </div>
      </header>

      <div dir="ltr" style={S.rail}>
        <div style={S.track}>
          {stages.map((s, i) => (
            <div key={s.key} style={S.stageWrap}>
              {i > 0 ? <LinkageConnector kind={s.linkFromPrevious} /> : null}
              <StageCard stage={s} index={i + 1} />
            </div>
          ))}
        </div>
      </div>
      <LinkageLegend kinds={stages.slice(1).map((st) => st.linkFromPrevious)} />

      <OpenBoundaryBand
        hasVerifiedEvidence={!!verifiedOutcome}
        learningRecorded={!!latestLearning}
        candidateLevel={candidateStatePrime ? candidateStatePrime.level : null}
      />

      <BeforeAfter core={core} />
      {configBaseline ? (
        <ConfigBaseline
          person={configBaseline.person}
          domains={configBaseline.domains}
          selection={configBaseline.selection}
        />
      ) : null}

      {/* CONTEXT / RECENT ACTIVITY — real records that are NOT linked to
          the anchor Observation. They live here, clearly labeled, so the
          chain above never implies Observation → unrelated Action. */}
      {unlinkedRecent.length > 0 ? (
        <div style={{ marginTop: SPACE.md, paddingTop: SPACE.md, borderTop: `1px solid ${COLOR.border}` }}>
          <div style={S.eyebrow}>הקשר · CONTEXT / RECENT ACTIVITY — לא מקושר לתצפית</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
            {unlinkedRecent.map((a) => (
              <div key={a.action.action.action_id} style={S.baRow}>
                <span style={{ ...S.baDomain, minWidth: 150 }}>{a.action.action.type} · {a.action.action.time.slice(0, 10)}</span>
                <span style={{ ...S.baCell, minWidth: 0, flex: 1 }}>
                  {a.effects[0]?.effect.effect.claimed_outcome.statement ?? "אין Effect"} — ללא קישור מפורש (observation_ref/prior_state_ref) לתצפית הנוכחית
                </span>
                <ProvenanceBadge p="CANON" />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

/**
 * OPEN BOUNDARY — the honest end of the chain.
 *
 * The chronology above is complete and intentionally keeps all eight stages
 * visible. Its last two stages are the unresolved part of the system, and
 * this band says so in words rather than leaving two grey cards to be read
 * as "no data yet":
 *
 *   LEARNING   — no persisted Learning transition is supported by the
 *                current canonical contract. A VERIFIED Effect proves an
 *                Effect outcome per its own verification record; it does
 *                not prove Learning.
 *   STATE(t1)  — no canonical persistence/update contract for State′
 *                exists, so no verified Effect and no accepted candidate
 *                becomes a new measured state.
 *
 * This band asserts nothing about the subject. It states the contract gap,
 * cites the record where the five unresolved questions live, and carries no
 * number of its own — `candidateLevel` is read verbatim off a real
 * `candidate_state_prime` when one exists, and is labelled CANDIDATE.
 */
function OpenBoundaryBand({
  hasVerifiedEvidence, learningRecorded, candidateLevel,
}: { hasVerifiedEvidence: boolean; learningRecorded: boolean; candidateLevel: number | null }) {
  return (
    <div style={{ marginTop: SPACE.md, paddingTop: SPACE.md, borderTop: `1px solid ${COLOR.border}` }}>
      <div style={{ ...S.eyebrow, color: "#fbbf24" }}>גבול פתוח · OPEN BOUNDARY — LEARNING → STATE(t+1)</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
        <div style={S.baRow}>
          <span style={{ ...S.baDomain, minWidth: 110 }}>LEARNING</span>
          <span style={{ ...S.baCell, minWidth: 0, flex: 1 }}>
            {learningRecorded
              ? "קיימת רשומת Learning אמיתית — היא נשארת שיפוט על מועמד, ואינה מעבר מצב מתמשך."
              : "UNKNOWN — אין מעבר Learning מתמשך הנתמך בחוזה הקנוני הנוכחי."}
          </span>
          <ProvenanceBadge p={learningRecorded ? "CANON" : "UNKNOWN"} />
        </div>
        <div style={S.baRow}>
          <span style={{ ...S.baDomain, minWidth: 110 }}>STATE(t+1)</span>
          <span style={{ ...S.baCell, minWidth: 0, flex: 1 }}>
            UNKNOWN — אין חוזה קנוני לשמירה/עדכון של State′.
            {candidateLevel !== null ? ` קיים candidate_state_prime (level ${candidateLevel}) — CANDIDATE בלבד.` : ""}
          </span>
          <ProvenanceBadge p="UNKNOWN" />
        </div>
        {hasVerifiedEvidence ? (
          <div style={S.baRow}>
            <span style={{ ...S.baDomain, minWidth: 110 }}>EVIDENCE</span>
            <span style={{ ...S.baCell, minWidth: 0, flex: 1 }}>
              קיימת עדות Effect מאומתת — Effect מאומת מוכיח תוצאת Effect לפי רשומת האימות שלו בלבד; אינו מוכיח Learning, שינוי Level/Stability או State(t+1).
            </span>
            <ProvenanceBadge p="CANON" />
          </div>
        ) : null}
        <div style={{ ...S.baRow, background: "transparent", fontSize: 10, color: COLOR.textFaint }}>
          חמש השאלות הפתוחות מתועדות ב-<code>app/lib/philos/canon/STATE-TRANSITION-BOUNDARY.md</code> — לא נפתרות כאן.
        </div>
      </div>
    </div>
  );
}

/**
 * CONFIG BASELINE vs LIVE STATE — three rows that must never blur:
 *
 *   HUMAN CONFIG   the cross-domain reference base for the person. What is
 *                  KNOWN/askable/measurable about them, in any domain.
 *   DOMAIN CONFIG  the SWAPPABLE slots (`domainConfigRegistry.ts`). One row
 *                  per AVAILABLE domain — availability, never selection.
 *                  This component names no domain: Music appears because it
 *                  is registered, not because it is written here.
 *   LIVE STATE     only real Observations. Config never fills it.
 *
 * ACTIVE DOMAIN gets its own line, and it is UNKNOWN with the real reason
 * whenever no recorded DomainState selected one — the existence of a domain
 * config is not a person being in that domain, which is precisely the
 * inference this row exists to refuse out loud.
 *
 * Counts only. No ref ever becomes a level, a stage, a possessed
 * capability, or a measurement.
 */
function ConfigBaseline({
  person, domains, selection,
}: { person: ActiveConfigSet; domains: DomainConfigBaseline[]; selection: SelectedDomainResolution }) {
  const summarize = (byType: Record<string, string[]>) =>
    Object.entries(byType).map(([t, refs]) => `${t} ${refs.length}`).join(" · ");
  return (
    <div style={{ marginTop: SPACE.md, paddingTop: SPACE.md, borderTop: `1px solid ${COLOR.border}` }}>
      <div style={S.eyebrow}>בסיס קונפיג מול מצב חי · CONFIG BASELINE vs LIVE STATE</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
        <div style={S.baRow}>
          <span style={{ ...S.baDomain, minWidth: 150 }}>HUMAN CONFIG · בסיס</span>
          <span style={{ ...S.baCell, minWidth: 0, flex: 1 }}>
            {person.refs.length} refs פעילים מתוך {person.total_in_lock} — {summarize(person.by_type)}
            <span style={{ color: COLOR.textFaint }}> · בסיס חוצה-דומיינים, אינו דומיין</span>
          </span>
          <ProvenanceBadge p={person.refs.length > 0 ? "CANON" : "UNKNOWN"} />
        </div>

        {domains.map((d) => (
          <div key={d.domain_id} style={S.baRow}>
            <span style={{ ...S.baDomain, minWidth: 150 }}>DOMAIN CONFIG · {d.label_he}</span>
            <span style={{ ...S.baCell, minWidth: 0, flex: 1 }}>
              {d.active_refs} refs פעילים מתוך {d.total_in_lock} — {summarize(d.by_type)}
              <span style={{ color: COLOR.textFaint }}> · זמין, לא נבחר</span>
            </span>
            <ProvenanceBadge p={d.provenance === "SOURCE_LOCK" ? "CANON" : "DEMO"} />
          </div>
        ))}

        <div style={S.baRow}>
          <span style={{ ...S.baDomain, minWidth: 150 }}>ACTIVE DOMAIN</span>
          <span style={{ ...S.baCell, minWidth: 0, flex: 1, fontStyle: selection.selected ? "normal" : "italic", color: selection.selected ? COLOR.textDim : "#8798b8" }}>
            {selection.selected
              ? `${selection.slot.label_he} — ${selection.basis}`
              : `UNKNOWN — ${selection.reason}`}
          </span>
          <ProvenanceBadge p={selection.selected ? "CANON" : "UNKNOWN"} />
        </div>

        <div style={S.baRow}>
          <span style={{ ...S.baDomain, minWidth: 150 }}>LIVE STATE</span>
          <span style={{ ...S.baCell, minWidth: 0, flex: 1, fontStyle: "italic", color: "#8798b8" }}>
            רק Observation אמיתית קובעת מצב — הקונפיג למעלה לעולם אינו ממלא STATE(t0)/STATE(t1)
          </span>
          <ProvenanceBadge p="UNKNOWN" />
        </div>
      </div>
    </div>
  );
}

/**
 * BEFORE → AFTER, per domain, over the SAME `core` the chain above already
 * uses. Δ is computed ONLY when both a prior and a current real Observation
 * exist for that domain; otherwise the cell says why it cannot be computed.
 */
function BeforeAfter({ core }: { core: OrientationCore }) {
  const rows = DOMAINS.map((d) => {
    const mark = core[d];
    const prior = d === "G" ? core.priorG : d === "E" ? core.priorE : core.priorC;
    return { d, mark, prior, delta: mark && prior ? mark.level - prior.level : null };
  });

  return (
    <div style={S.beforeAfter}>
      <div style={S.eyebrow}>לפני → אחרי · BEFORE → AFTER (per domain)</div>
      <div style={S.baGrid}>
        {rows.map(({ d, mark, prior, delta }) => (
          <div key={d} style={S.baRow}>
            <span style={S.baDomain}>{DOMAIN_WORD[d]} · {d}</span>
            <span style={S.baCell}>
              {prior ? (
                <><b style={{ color: COLOR.text }}>level {prior.level}</b> <span style={S.baTime}>{prior.observed_at.slice(0, 10)}</span></>
              ) : (
                <span style={S.baUnknown}>UNKNOWN — אין תצפית קודמת</span>
              )}
            </span>
            <span style={S.baArrow}>→</span>
            <span style={S.baCell}>
              {mark ? (
                <><b style={{ color: COLOR.text }}>level {mark.level}</b> <span style={S.baTime}>{mark.observed_at.slice(0, 10)}</span></>
              ) : (
                <span style={S.baUnknown}>UNKNOWN — אין תצפית</span>
              )}
            </span>
            <span style={{ ...S.baDelta, color: delta === null ? COLOR.textFaint : delta > 0 ? STATUS.real.text : delta < 0 ? "#f2635c" : COLOR.textDim }}>
              {delta === null ? "Δ לא ניתן לחישוב" : `Δ ${delta > 0 ? "+" : ""}${delta}`}
            </span>
            <span style={S.baProv}>
              <ProvenanceBadge p={mark || prior ? "CANON" : "UNKNOWN"} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * One stage card. Three visual bands, from `shell/epistemics.tsx`, so a
 * real record never arrives on screen with the same authority as a card
 * that says "we never looked":
 *
 *   A  a real persisted record (CANON/REAL)   — full weight
 *   B  our framing over real rows (STATIC/…)  — intermediate
 *   C  UNKNOWN/UNLINKED                       — visibly lower certainty,
 *                                               still fully legible
 *
 * `boundary` overrides the C treatment with the OPEN BOUNDARY treatment:
 * an intended stage whose data contract is unresolved is NOT the same
 * statement as an empty stage that could fill tomorrow, and it must not
 * look like one.
 *
 * DENSITY: the primary statement is the only thing at full size. TIME and
 * CONFIDENCE are real and load-bearing (chronology, epistemic status) so
 * they stay, compressed onto one line instead of two labelled rows. No raw
 * record id is rendered here — ids live in the ctx link and in the
 * SECONDARY/AUDIT sections below the chain.
 */
function StageCard({ stage, index }: { stage: StageData; index: number }) {
  const real = stage.content !== null;
  const p = PROVENANCE_STYLE[stage.provenance];
  const weight = real ? weightOfProvenance(stage.provenance) : "C";
  const w = EPISTEMIC_WEIGHT[weight];

  const box: React.CSSProperties = {
    width: 216, minHeight: 172, boxSizing: "border-box",
    borderRadius: RADIUS.lg,
    padding: `${SPACE.md}px ${SPACE.md}px`,
    display: "flex", flexDirection: "column", gap: 6,
    textDecoration: "none", color: "inherit",
    flexShrink: 0,
    ...w.surface,
    ...(stage.boundary
      ? OPEN_BOUNDARY_SURFACE
      : {
          border: `1px solid ${real ? p.border : COLOR.border}`,
          borderTop: `3px solid ${real ? p.text : "rgba(90,111,150,0.35)"}`,
        }),
  };

  const inner = (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <span style={{ ...TYPE.micro, color: real ? p.text : COLOR.textFaint, letterSpacing: 0.8 }}>
          {index}. {stage.label}
        </span>
        {stage.boundary && !real ? <OpenBoundaryMark note={stage.empty} /> : <ProvenanceBadge p={stage.provenance} />}
      </div>
      <div dir="rtl" style={{ fontSize: 9.5, color: COLOR.textFaint }}>{stage.gloss}</div>

      {real ? (
        <div dir="rtl" style={{ ...w.text, minHeight: 34 }}>
          {stage.content!.length > 62 ? `${stage.content!.slice(0, 62)}…` : stage.content}
        </div>
      ) : (
        <div dir="rtl" style={{ ...EPISTEMIC_WEIGHT.C.text, minHeight: 34 }}>
          <span
            style={{
              ...TYPE.micro,
              color: stage.boundary ? "#fbbf24" : stage.stateWord === "UNLINKED" ? "#fbbf24" : "#8798b8",
              display: "block", marginBottom: 2, fontStyle: "normal",
            }}
          >
            {stage.boundary ? "UNKNOWN · חוזה לא פתור" : stage.stateWord ?? "UNKNOWN"}
          </span>
          {stage.empty}
        </div>
      )}

      {stage.detail ? (
        <div dir="rtl" style={{ fontSize: 10, color: COLOR.textDim, lineHeight: 1.3 }}>
          {stage.detail.length > 46 ? `${stage.detail.slice(0, 46)}…` : stage.detail}
        </div>
      ) : null}

      {/* Compressed metadata line — real timestamp (chronology) + real
          confidence (epistemic status). Both are required by the honesty
          rules, so neither is moved to AUDIT; they are just no longer two
          full-width labelled rows competing with the statement above. */}
      <div
        dir="ltr"
        style={{
          marginTop: "auto", paddingTop: 6, borderTop: `1px solid ${COLOR.border}`,
          display: "flex", justifyContent: "space-between", gap: 6,
          fontSize: 9, fontFamily: "ui-monospace, monospace",
        }}
      >
        <span style={{ color: stage.time ? COLOR.textDim : "#8798b8", fontStyle: stage.time ? "normal" : "italic" }}>
          {stage.time ? stage.time.slice(0, 16).replace("T", " ") : "TIME UNKNOWN"}
        </span>
        <span
          dir="rtl"
          title={stage.confidence === null ? stage.confidenceNote : undefined}
          style={{
            color: stage.confidence !== null ? COLOR.textDim : "#8798b8",
            fontStyle: stage.confidence !== null ? "normal" : "italic",
            maxWidth: 118, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {stage.confidence !== null ? `conf ${stage.confidence.toFixed(2)}` : stage.confidenceNote ?? "conf UNKNOWN"}
        </span>
      </div>
    </>
  );

  return stage.href ? <a href={stage.href} style={box}>{inner}</a> : <div style={box}>{inner}</div>;
}

const S: Record<string, React.CSSProperties> = {
  band: {
    background: "linear-gradient(180deg, rgba(91,156,246,0.07), rgba(11,15,26,0.9))",
    border: `1px solid ${COLOR.borderStrong}`,
    borderRadius: 20,
    padding: `${SPACE.lg}px ${SPACE.lg}px ${SPACE.md}px`,
    marginBottom: SPACE.lg,
  },
  head: { display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: SPACE.sm, marginBottom: SPACE.md },
  eyebrow: { ...TYPE.micro, color: COLOR.accent, marginBottom: 4 },
  title: { fontSize: 14, fontWeight: 800, letterSpacing: 0.2, margin: 0, color: COLOR.text, direction: "ltr", textAlign: "right" },
  headMeta: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" },
  headChip: { fontSize: 9.5, fontWeight: 700, color: COLOR.textDim, border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.pill, padding: "2px 9px", fontFamily: "ui-monospace, monospace" },
  rail: { overflowX: "auto", paddingBottom: SPACE.sm },
  track: { display: "flex", alignItems: "stretch", minWidth: "fit-content" },
  stageWrap: { display: "flex", alignItems: "stretch" },
  beforeAfter: { marginTop: SPACE.md, paddingTop: SPACE.md, borderTop: `1px solid ${COLOR.border}` },
  baGrid: { display: "flex", flexDirection: "column", gap: 4, marginTop: 6 },
  baRow: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 11, background: "rgba(90,120,180,0.05)", borderRadius: RADIUS.sm, padding: "5px 10px" },
  baDomain: { minWidth: 78, fontWeight: 700, color: COLOR.textDim },
  baCell: { minWidth: 170, color: COLOR.textDim },
  baTime: { fontSize: 9.5, color: COLOR.textFaint, marginInlineStart: 6, fontFamily: "ui-monospace, monospace" },
  baArrow: { color: COLOR.textFaint },
  baUnknown: { fontStyle: "italic", color: "#8798b8" },
  baDelta: { minWidth: 120, fontWeight: 800, fontSize: 11 },
  baProv: { marginInlineStart: "auto" },
};
