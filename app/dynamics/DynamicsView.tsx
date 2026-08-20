/**
 * Dynamics Layer — Step 3, part 3: the view.
 *
 * PHILOS-DYNAMICS-UI-CONTRACT.md. A PURE server component over the view-model
 * (`buildDynamicsView`) — no client JS, no clock, no random, no second data
 * source. Layout is a DOMAIN-LANE TIMELINE: five horizontal lanes (the domains),
 * x = time, causal edges drawn across lanes. Geometry is a rendering choice (§7);
 * the honesty rules it must not weaken are §0/§3/§4/§5:
 *   • every mark maps from a view-model field — nothing invented (§0)
 *   • solid = explicit/self_report, dashed = inferred/system_inference — the two
 *     axes read from separate fields, an inferred line never drawn solid (§3)
 *   • withheld count + unresolved rows are shown, absence stated not faked (§4)
 *   • only view.nodes/edges are drawn, so a hidden event simply is not here (§5)
 *
 * Position semantics are labelled on screen: x is time; vertical offset within a
 * lane is layout, not measurement — the globe's "not geography" rule, applied here.
 *
 * **Canon panel (systemic-integration-audit slice 1, additive):** `canon`, when
 * given, renders as its OWN section below the causal graph — never mixed into
 * the SVG timeline above. Placing a canon Observation on the same x=time axis
 * as a legacy causal-graph node would visually imply a causal/temporal
 * relationship between the two systems that no evidence supports (see
 * `projectCanonDynamics.ts`'s header on why the two stay separate types).
 *
 * **UX depth slice 1 (this pass):** the screen is reorganized into the shared
 * grammar — Purpose Header, a Selected-Context HERO (identity + PHILOS
 * classification + provenance/state chips + an honest explanation grid + the
 * shared Action Layer from `systemContext.ts`), the primary causal graph
 * (visually unchanged, still the largest element on screen), then one
 * clearly-separated Unknown/Unverified section. Nothing about WHAT is shown
 * changed — every fact still traces to `view`/`canon`/`selected` exactly as
 * before; only how it's organized and colored did. Color now comes from
 * `persistedDerivedColor`/`claimedVerifiedColor` — a function of the real
 * field value, never a per-surface decorative choice (see their doc comments
 * in `systemContext.ts`).
 */
import { DOMAIN_COLOR, type DynamicsViewModel } from "@/app/lib/philos/dynamicsView";
import type { Domain } from "@/app/lib/philos/projectDynamics";
import type { CanonDynamicsGraph } from "@/app/lib/philos/canon/projectCanonDynamics";
import type { CapitalTimelinePoint, MembershipTimelinePoint, ValueGroupView } from "@/app/lib/philos/projectValueGroup";
import type { TensionItem } from "@/app/lib/philos/tension";
import { SystemShell, type ShellIdentityLink } from "@/app/lib/philos/shell/SystemShell";
import { AuditHeading, AuditSection } from "@/app/lib/philos/shell/epistemics";
import type { PersonContext } from "@/app/lib/philos/person/personContext";
import EntityContextPanel from "@/app/lib/philos/shell/EntityContextPanel";
import {
  buildContextActions,
  claimedVerifiedColor,
  encodeSystemContextRef,
  persistedDerivedColor,
  type ContextAction,
  type SelectedContext,
} from "@/app/lib/systemContext";
import { buildMeasuredStateSpace } from "@/app/lib/philos/orientationCore";
import { buildHumanTensions, sortTensions } from "@/app/lib/philos/tension";
import { needsRequiringAction } from "@/app/lib/philos/sharedContext";
import { buildDayClosingQuestions } from "@/app/lib/philos/dayClosingFusion";
import type { ActionLifecycleSummary } from "@/app/lib/philos/canon/actionLifecycle";
import type { KnownNeedResult } from "@/app/lib/systemContext";
import type { DomainStateRecord } from "@/app/lib/philos/canon/domainStateStore";
import DayClosingFusion from "@/app/hub/DayClosingFusion";
import ValueDomainDemoPanel from "@/app/hub/ValueDomainDemoPanel";
import CanonicalSlicePanel from "@/app/hub/CanonicalSlicePanel";
import DynamicsHumanValueDepth from "./DynamicsHumanValueDepth";
import CausalChainFlow from "./CausalChainFlow";
import { buildActivePersonRefs } from "@/app/lib/philos/canonical/activeConfig";
import { buildDomainConfigBaselines, resolveSelectedDomain } from "@/app/lib/philos/canonical/domainConfigRegistry";
import ObservationReadingPanel from "@/app/lib/philos/shell/ObservationReadingPanel";
import GroupOpsPanel from "@/app/lib/philos/shell/GroupOpsPanel";
import { COLOR, TYPE } from "@/app/lib/philos/shell/designTokens";
import { isNormalModeSubject } from "@/app/lib/philos/subjectRegistry";
import type { ResolvedViewerContext } from "@/app/lib/philos/context/resolvedViewerContext";

export type { SelectedContext };

/**
 * Real time-range counts over the canon Observation log, computed by
 * `page.tsx` (which owns the one clock read, `systemClock.now()`) and
 * passed down verbatim — this component itself stays clock-free (no
 * `Date.now()`, matching `__tests__/dynamicsHonesty.test.ts`'s own
 * determinism check). Every count is a real `filter().length` over
 * `canon.nodes`, never estimated or extrapolated.
 */
export interface TimeRangeSummary {
  asOf: string;
  today: number;
  last7: number;
  last30: number;
  allTime: number;
}

/**
 * Dynamics ↔ Community capital wiring (System-Wide Build, Pass 3). A real
 * `ValueGroupView` (real or DEMO, `page.tsx` resolves which) plus its own
 * capital time series and shared-shape tensions — no second money model,
 * no page-specific tension logic. `undefined` = no `?community=` selected.
 */
export interface CommunityCapitalContext {
  group: ValueGroupView;
  capital: CapitalTimelinePoint[];
  /** Mission B, B7 — real cumulative membership growth, folded from
   *  real `member.joined` events only (`buildMembershipTimeline`). */
  membership: MembershipTimelinePoint[];
  tensions: TensionItem[];
  provenance: "REAL" | "DEMO";
  /** Canonical Cross-Entity Link Registry — real ACTION_AFFECTS_COMMUNITY
   *  links for this group, computed once by the page (`buildDefaultLinkRegistry`)
   *  and passed down, never re-derived here. */
  bridgeActionCount: number;
}

// ── Hebrew-first orientation vocabulary (product pass) ──────────────────────
//
// Real mappings only, applied to fields that already exist — never a new
// axis invented from a name. `selected.domain`/`selected.frame` are already
// formatted as "E (emotional)"/"I (individual)" by `sharedContext.ts`; these
// helpers translate the parenthetical English word to Hebrew without
// changing the shared resolver's own tested output shape.
const HEBREW_DOMAIN_WORD: Record<string, string> = { physical: "גוף", emotional: "רגש", cognitive: "שכל" };
const HEBREW_FRAME_WORD: Record<string, string> = { individual: "אישי", relational: "יחסי", systemic: "מערכתי" };
const HEBREW_LEGACY_DOMAIN: Record<string, string> = {
  people: "אנשים", community: "קהילה", activity: "פעילות", resources: "משאבים", impact: "השפעה",
};
function hebrewFromParenthetical(s: string, table: Record<string, string>): string | null {
  const m = s.match(/\(([a-z]+)\)/);
  return m ? (table[m[1]] ?? null) : null;
}

/**
 * מצב (state): deficit/equilibrium/surplus — read as the direct SIGN of the
 * real `level` field. Not an invented threshold: canon's own text (§4)
 * defines Level as "signed deficit ← equilibrium → surplus" — this is a
 * literal reading of that definition, not a UI-side classification scheme.
 */
function hebrewLevelState(level: number): { label: string; color: string } {
  if (level < 0) return { label: "גירעון", color: "#f87171" };
  if (level > 0) return { label: "עודף", color: "#34d399" };
  return { label: "שיווי משקל", color: "#fbbf24" };
}

/**
 * PHILOS ORIENTATION — the Hebrew-first semantic reading of the selected
 * record: body/emotion/cognition, personal/relational/systemic, and the
 * real Level→deficit/equilibrium/surplus reading. Rendered ABOVE the
 * technical chip row (which stays available, just no longer primary).
 *
 * "אדם מול עצמו / העולם / הסיטואציה" — the three orientation LENSES named in
 * the current product brief — are shown as labeled vocabulary, explicitly
 * marked NOT YET MODELED: no field in `Observation`/`CellState` (canon
 * §3/§6, confirmed by reading `observation.ts` and
 * `PHILOS-MELTING-POT-CANON.md` §3 this pass) distinguishes these three
 * frames from Frame (I/R/S, "reference space" — individual/relational/
 * systemic scope of the STATE, a different axis: WHAT is being measured,
 * not WHICH lens is analyzing it). No Hebrew or English source text for
 * "אדם מול עצמו/העולם/סיטואציה" exists anywhere in this repository as of
 * this pass (confirmed by grep) — silently equating it with Frame would be
 * exactly the fabrication this product brief forbids, so it is shown
 * honestly as a real product concept with no computable value yet, not
 * hidden and not faked.
 */
function PhilosOrientation({ selected }: { selected: FoundContext }) {
  const isCanon = selected.system === "canon";
  const bodyWord = hebrewFromParenthetical(selected.domain, HEBREW_DOMAIN_WORD);
  const frameWord = selected.frame ? hebrewFromParenthetical(selected.frame, HEBREW_FRAME_WORD) : null;
  const legacyWord = !isCanon ? HEBREW_LEGACY_DOMAIN[selected.domain] : null;
  const state = selected.currentState ? hebrewLevelState(selected.currentState.level) : null;

  return (
    <div dir="rtl" style={{ textAlign: "right", marginTop: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
        {isCanon ? (
          <>
            <Chip label="ממד" value={bodyWord ?? "לא ידוע"} />
            {frameWord ? <Chip label="היקף" value={frameWord} /> : null}
          </>
        ) : (
          <Chip label="תחום (יומן ישן)" value={legacyWord ?? selected.domain} />
        )}
        {state ? (
          <Chip label="מצב (Level)" value={`${state.label} (${selected.currentState!.level})`} color={state.color} />
        ) : (
          <Chip label="מצב (Level)" value="לא ישים — אין ערך Level לאירוע יומן" />
        )}
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: "#8fa3c9", lineHeight: 1.7 }}>
        <span style={{ color: "#5a76a3" }}>אדם מול עצמו · העולם · הסיטואציה — </span>
        עדיין לא ממופה: אין שדה במודל הנוכחי (Observation/CellState) שמייצג את שלושת העדשות הללו.
        <span style={{ color: "#5a76a3" }}> ״היקף״ (Frame: אישי/יחסי/מערכתי) הוא ציר אחר — </span>
        מגדיר את היקף המצב הנמדד, לא את זווית ההתבוננות עליו. אין להניח זהות בין השניים.
      </div>
    </div>
  );
}

// ── shared visual primitives (chips, action bar) ──────────────────────────

function Chip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 100 }}>
      <span style={{ fontSize: 9, letterSpacing: 1, color: "#5a76a3", textTransform: "uppercase" }}>{label}</span>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: color ?? "#dbe6f6",
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        {color ? <span style={{ width: 7, height: 7, borderRadius: 4, background: color, display: "inline-block" }} /> : null}
        {value}
      </span>
    </div>
  );
}

function ActionBar({ actions }: { actions: ContextAction[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
      {actions.map((a) => (
        <ActionPill key={a.label} action={a} />
      ))}
    </div>
  );
}

function ActionPill({ action }: { action: ContextAction }) {
  const base = {
    fontSize: 11,
    padding: "6px 12px",
    borderRadius: 20,
    border: "1px solid",
    display: "inline-block",
  };
  if (action.state === "live" && action.href) {
    return (
      <a
        href={action.href}
        style={{
          ...base,
          color: "#0b0f1a",
          background: "#38bdf8",
          borderColor: "#38bdf8",
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        {action.label} →
      </a>
    );
  }
  if (action.state === "here") {
    return (
      <span style={{ ...base, color: "#38bdf8", borderColor: "#2a3f66", background: "transparent" }}>
        {action.label} · you are here
      </span>
    );
  }
  return (
    <span style={{ ...base, color: "#4a5a78", borderColor: "#1e2740", background: "transparent" }}>
      {action.label} · not connected yet
    </span>
  );
}

// ── Selected System Context hero ───────────────────────────────────────────

function SelectedContextHero({ selected }: { selected: SelectedContext }) {
  if (selected.status === "none") return null;

  const shell = {
    marginBottom: 20,
    padding: "16px 20px",
    background: "#0f1a2e",
    border: "1px solid #2a3f66",
    borderRadius: 8,
    maxWidth: 900,
  } as const;
  const kicker = { fontSize: 10, letterSpacing: 2, color: "#5aa6ff", marginBottom: 8 } as const;

  if (selected.status === "unknown" || selected.status === "not_found") {
    const src =
      selected.status === "unknown"
        ? selected.raw
        : selected.ref.kind === "canon_observation"
          ? `canon:${selected.ref.canon_event_id}`
          : selected.ref.kind === "legacy_event"
            ? `event:${selected.ref.event_id}`
            : selected.ref.kind === "action"
              ? `action:${selected.ref.action_id}`
              : selected.ref.kind === "effect"
                ? `effect:${selected.ref.effect_id}`
                : selected.ref.raw;
    return (
      <div style={{ ...shell, borderColor: "#5a4a2a" }}>
        <div style={kicker}>SELECTED SYSTEM CONTEXT</div>
        <div style={{ fontSize: 13 }}>
          {src} —{" "}
          {selected.status === "unknown"
            ? "not a recognized identifier shape. UNKNOWN."
            : "a real identifier shape, but no matching record on this screen. UNKNOWN."}
        </div>
      </div>
    );
  }

  // LOOP 0054 — a resolved canon Action/Effect entity renders via the
  // shared `EntityContextPanel`, never through the canon-Observation/
  // legacy-event code below (which this branch's early return keeps
  // completely unreached for `found_entity`, so its behavior for
  // `system: "canon" | "legacy"` is unchanged).
  if (selected.status === "found_entity") {
    return <EntityContextPanel selected={selected} here="dynamics" style={{ ...shell }} />;
  }

  const persistedColor = persistedDerivedColor(selected.persisted_or_derived);
  const claimedColor = claimedVerifiedColor(selected.claimed_or_verified);
  const actions = buildContextActions(selected.ref, "dynamics");

  return (
    <div style={{ ...shell, borderLeft: `3px solid ${claimedColor}` }}>
      <div dir="rtl" style={{ textAlign: "right", fontSize: 10, letterSpacing: 1, color: "#5aa6ff" }}>
        ההקשר הנבחר
      </div>

      {/* WHAT AM I LOOKING AT — Hebrew-first, real label, no raw id here */}
      <div dir="rtl" style={{ textAlign: "right", fontSize: 16, fontWeight: 700, color: "#f2f6fc" }}>{selected.label}</div>

      {/* PRIMARY VISUAL — real spatial state-transition flow, not text.
          Replaces the text-first StateAndTime as the dominant signal;
          StateAndTime's exact same real data is still shown, demoted into
          the technical details below (never deleted, never duplicated with
          different numbers). */}
      <StateTransitionFlow selected={selected} />
      <ActionEffectLearningFlow selected={selected} />

      <PhilosOrientation selected={selected} />
      <Relationships selected={selected} />
      <NeedActionLine selected={selected} />

      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: "pointer", fontSize: 10, letterSpacing: 1.5, color: "#5a76a3" }}>
          תצוגה מתקדמת — Canon / SystemContextRef / STATE+TIME גולמי (diagnostic detail)
        </summary>
        <div style={{ marginTop: 10 }}>
          <div style={kicker}>SELECTED SYSTEM CONTEXT</div>
          <div style={{ fontSize: 11, color: "#7f97c2" }}>
            {selected.system === "canon" ? "canon Observation" : "legacy event"} · {selected.matched_id}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginTop: 14 }}>
            <Chip label="Domain" value={selected.domain} />
            {selected.frame ? <Chip label="Frame" value={selected.frame} /> : null}
            <Chip label="Provenance" value={selected.provenance} />
            <Chip label="Persisted / derived" value={selected.persisted_or_derived} color={persistedColor} />
            <Chip label="Claimed / verified" value={selected.claimed_or_verified} color={claimedColor} />
            <Chip label="Timestamp" value={selected.timestamp ?? "UNKNOWN — not yet wired"} />
          </div>
          <StateAndTime selected={selected} />
          <EvidenceTrace selected={selected} />
        </div>
      </details>

      <ActionBar actions={actions} />
    </div>
  );
}

function ExplanationRow({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: 0.5, color: "#5a76a3" }}>{q}</div>
      <div style={{ fontSize: 12, color: "#cfe0f5", marginTop: 3, lineHeight: 1.4 }}>{a}</div>
    </div>
  );
}

type FoundContext = Extract<SelectedContext, { status: "found" }>;

const sectionHead = { fontSize: 10, letterSpacing: 1.5, color: "#5aa6ff", marginTop: 18, marginBottom: 8 } as const;
const emptyState = { fontSize: 12, color: "#7b8ca6", fontStyle: "italic" as const };

/**
 * PRIMARY VISUAL — a real spatial STATE(t0) → FORCE/EVENT → Δ → STATE(t1) →
 * ACTION/EFFECT diagram. Every box's content is the SAME real data
 * `StateAndTime`/`NeedActionLine` already compute — this is a different
 * drawing of it, not a second source of truth. `t0`/force/effect stay
 * honestly empty (dashed) when no real data reaches them — never a
 * fabricated placeholder.
 */
function StateTransitionFlow({ selected }: { selected: FoundContext }) {
  const hasPrior = selected.priorState !== undefined && selected.priorState !== null;
  const prior = hasPrior ? selected.priorState! : null;
  const delta = selected.delta;
  const admissible = !!selected.actionSpace?.admissible;

  const W = 900, H = 150;
  const boxW = 160, boxH = 70, y = H / 2 - boxH / 2;
  const xs = { t0: 20, force: 240, t1: 400, action: 620, effect: 800 };

  const Box = ({ x, label, sub, known, color }: { x: number; label: string; sub: string; known: boolean; color: string }) => (
    <g>
      <rect x={x} y={y} width={boxW} height={boxH} rx={8} fill={known ? `${color}18` : "none"} stroke={color} strokeWidth={known ? 2 : 1.5} strokeDasharray={known ? undefined : "4 4"} />
      <text x={x + boxW / 2} y={y + 24} fill={known ? "#f2f6fc" : "#5a76a3"} fontSize={11} fontWeight={700} textAnchor="middle">{label}</text>
      <text x={x + boxW / 2} y={y + 44} fill={known ? "#9fb0d0" : "#5a76a3"} fontSize={10} textAnchor="middle">{sub}</text>
    </g>
  );
  const Arrow = ({ x1, x2, label, open }: { x1: number; x2: number; label?: string; open: boolean }) => (
    <g>
      <line x1={x1} y1={y + boxH / 2} x2={x2} y2={y + boxH / 2} stroke={open ? "#5a76a3" : "#1e2740"} strokeWidth={2} strokeDasharray={open ? undefined : "5 5"} markerEnd="url(#dfArrow)" />
      {label ? <text x={(x1 + x2) / 2} y={y + boxH / 2 - 8} fill="#7b8ca6" fontSize={9} textAnchor="middle">{label}</text> : null}
    </g>
  );

  const deltaLabel = delta && (delta.level !== undefined || delta.stability !== undefined)
    ? `Δ level ${delta.level !== undefined ? (delta.level >= 0 ? "+" : "") + delta.level.toFixed(2) : "—"}`
    : undefined;

  return (
    <div dir="rtl" style={{ marginTop: 14 }}>
      <div style={{ ...sectionHead, textAlign: "right" }}>ציר זמן — מצב ← כוח/אירוע ← מעבר ← מצב ← פעולה ← השפעה</div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: 170 }} role="img" aria-label="ציר מעבר מצב">
        <defs>
          <marker id="dfArrow" markerWidth={8} markerHeight={8} refX={6} refY={4} orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#5a76a3" /></marker>
        </defs>
        <Box x={xs.t0} label="מצב קודם (t0)" sub={hasPrior ? `level ${prior!.level}` : "לא ידוע"} known={hasPrior} color="#7f97c2" />
        <Arrow x1={xs.t0 + boxW} x2={xs.force} open={hasPrior} label={selected.relationships && selected.relationships.length > 0 ? selected.relationships[0].relation_label : undefined} />
        <Box x={xs.force} label="כוח / אירוע" sub={selected.relationships && selected.relationships.length > 0 ? `${selected.relationships.length} קשרים אמיתיים` : "לא ידוע"} known={!!(selected.relationships && selected.relationships.length > 0)} color="#f2a154" />
        <Arrow x1={xs.force + boxW} x2={xs.t1} open={true} label={deltaLabel} />
        <Box x={xs.t1} label="מצב נוכחי (t1)" sub={selected.currentState ? `level ${selected.currentState.level}` : selected.label} known={true} color="#38bdf8" />
        <Arrow x1={xs.t1 + boxW} x2={xs.action} open={admissible} />
        <Box x={xs.action} label="פעולה" sub={admissible ? "כשיר" : "חסום"} known={admissible} color="#f2635c" />
        <Arrow x1={xs.action + boxW} x2={xs.effect} open={false} />
        <Box x={xs.effect} label="השפעה / למידה" sub="לא ידוע" known={false} color="#5a76a3" />
      </svg>
      <div style={{ fontSize: 10, color: "#5a76a3", marginTop: 4 }}>
        קרונולוגיה אינה סיבתיות — "כוח/אירוע" מוצג רק כאשר קיים קשר אמיתי (relationships) או Δ אמיתי; "פעולה"/"השפעה" מוצגים כלא ידוע כל עוד אין מנגנון ממומש.
      </div>
    </div>
  );
}

/**
 * ActionEffectLearningFlow — the primary visualization surface for the
 * Action/Effect/Learning lifecycle (integration pass): STATE(t0) →
 * ORIENTATION → ACTION → EXPECTED EFFECT → OBSERVED EFFECT → DELTA →
 * LEARNING → STATE(t1). A real, checked read from `selected.actionLifecycle`
 * (`sharedContext.ts`, canon-system only — legacy has no Action/Effect/
 * Learning store) — never a second data source, never a fabricated stage.
 *
 * Time stays explicit: every populated stage below shows the real ISO
 * timestamp it was recorded/observed at, never a relative/derived label.
 * CHRONOLOGY != CAUSALITY, held here too — ACTION/EXPECTED EFFECT/OBSERVED
 * EFFECT/DELTA/LEARNING are shown only when a real, explicit `action_ref`/
 * `effect_ref` link exists in the store (the same referential-integrity
 * discipline `actionLifecycle.ts` itself enforces); this component adds no
 * chronological inference of its own. The most recent real Action for this
 * subject is chosen (deterministic sort on `recorded_at`) — when several
 * exist, this is stated in the caption, never silently picked as "the"
 * Action.
 */
function ActionEffectLearningFlow({ selected }: { selected: FoundContext }) {
  if (selected.system !== "canon" || !selected.actionLifecycle) return null;
  const { actionLifecycle } = selected;

  if (actionLifecycle.actions.length === 0) {
    return (
      <div dir="rtl" style={{ marginTop: 14 }}>
        <div style={{ ...sectionHead, textAlign: "right" }}>Action / Effect / Learning</div>
        <div style={emptyState}>אין Action רשום לנושא זה — לא ידוע.</div>
      </div>
    );
  }

  const entry = [...actionLifecycle.actions].sort((a, b) => b.action.recorded_at.localeCompare(a.action.recorded_at))[0];
  const effectEntry = entry.effects.length > 0
    ? [...entry.effects].sort((a, b) => b.effect.recorded_at.localeCompare(a.effect.recorded_at))[0]
    : null;
  const learningRecord = effectEntry && effectEntry.learnings.length > 0
    ? [...effectEntry.learnings].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0]
    : null;
  const acceptedStatePrime = learningRecord?.learning.result.kind === "state_prime" ? learningRecord.learning.result.candidate_state_prime : null;

  const stageBox = (known: boolean, color: string) => ({
    minWidth: 140,
    flex: "0 0 auto",
    border: `1px solid ${known ? color : "#2a3f66"}`,
    borderRadius: 8,
    padding: "8px 12px",
    background: known ? `${color}14` : "transparent",
    opacity: known ? 1 : 0.65,
  } as const);
  const stageLabel = { fontSize: 9, letterSpacing: 1, color: "#5a76a3" } as const;
  const stageValue = { fontSize: 12, color: "#f2f6fc", marginTop: 3 } as const;
  const stageTime = { fontSize: 9.5, color: "#7b8ca6", marginTop: 3 } as const;
  const arrow = { color: "#5a76a3", fontSize: 14, padding: "0 2px", flex: "0 0 auto" } as const;

  return (
    <div dir="rtl" style={{ marginTop: 14 }}>
      <div style={{ ...sectionHead, textAlign: "right" }}>
        Action / Effect / Learning — STATE(t0) → ORIENTATION → ACTION → EXPECTED EFFECT → OBSERVED EFFECT → DELTA → LEARNING → STATE(t1)
      </div>
      {actionLifecycle.actions.length > 1 ? (
        <div style={{ fontSize: 10, color: "#5a76a3", marginBottom: 6 }}>
          {actionLifecycle.actions.length} Actions רשומות לנושא זה — מוצגת האחרונה ({entry.action.action.action_id}).
        </div>
      ) : null}
      <div style={{ display: "flex", alignItems: "stretch", gap: 2, overflowX: "auto", paddingBottom: 4 }}>
        <div style={stageBox(selected.priorState !== undefined && selected.priorState !== null, "#7f97c2")}>
          <div style={stageLabel}>STATE (t0)</div>
          <div style={stageValue}>{selected.priorState ? `level ${selected.priorState.level}` : "לא ידוע"}</div>
        </div>
        <div style={arrow}>→</div>
        <div style={stageBox(!!selected.currentState, "#38bdf8")}>
          <div style={stageLabel}>ORIENTATION</div>
          <div style={stageValue}>{selected.currentState ? `level ${selected.currentState.level} · stability ${selected.currentState.stability}` : "לא ידוע"}</div>
        </div>
        <div style={arrow}>→</div>
        <div style={stageBox(true, "#f2635c")}>
          <div style={stageLabel}>ACTION</div>
          <div style={stageValue}>{entry.action.action.type}</div>
          <div style={stageTime}>{entry.action.action.time}</div>
        </div>
        <div style={arrow}>→</div>
        <div style={stageBox(!!effectEntry, "#f2a154")}>
          <div style={stageLabel}>EXPECTED EFFECT</div>
          <div style={stageValue}>{effectEntry ? effectEntry.effect.effect.claimed_outcome.statement : "לא ידוע"}</div>
          {effectEntry ? <div style={stageTime}>{effectEntry.effect.effect.claimed_outcome.time}</div> : null}
        </div>
        <div style={arrow}>→</div>
        <div style={stageBox(!!effectEntry?.effect.effect.verified_outcome, "#34d399")}>
          <div style={stageLabel}>OBSERVED EFFECT</div>
          <div style={stageValue}>
            {effectEntry?.effect.effect.verified_outcome ? effectEntry.effect.effect.verified_outcome.statement : "לא ידוע — לא אומת"}
          </div>
          {effectEntry?.effect.effect.verified_outcome ? <div style={stageTime}>{effectEntry.effect.effect.verified_outcome.time}</div> : null}
        </div>
        <div style={arrow}>→</div>
        <div style={stageBox(!!learningRecord?.delta, "#a78bfa")}>
          <div style={stageLabel}>DELTA</div>
          <div style={stageValue}>
            {learningRecord?.delta
              ? `Δ level ${learningRecord.delta.level_delta >= 0 ? "+" : ""}${learningRecord.delta.level_delta} · Δ stability ${learningRecord.delta.stability_delta >= 0 ? "+" : ""}${learningRecord.delta.stability_delta.toFixed(2)}`
              : "לא ידוע"}
          </div>
        </div>
        <div style={arrow}>→</div>
        <div style={stageBox(!!learningRecord, learningRecord?.learning.result.kind === "state_prime" ? "#34d399" : "#5a76a3")}>
          <div style={stageLabel}>LEARNING</div>
          <div style={stageValue}>
            {learningRecord
              ? learningRecord.learning.result.kind === "state_prime"
                ? "state_prime התקבל"
                : `no_update (${learningRecord.learning.result.reason})`
              : "לא ידוע"}
          </div>
        </div>
        <div style={arrow}>→</div>
        {/* STATE(t1) — the OPEN BOUNDARY, never rendered as a reached state.
            `candidate_state_prime` is exactly that: canon's `learning.ts`
            GATES a caller-proposed candidate and never computes one, and no
            canonical persistence/update contract for State′ exists at all
            (`STATE-TRANSITION-BOUNDARY.md`). So the box stays visually
            un-filled even when a candidate is present, and the candidate is
            labelled CANDIDATE rather than shown as the subject's new state. */}
        <div style={stageBox(false, "#38bdf8")}>
          <div style={stageLabel}>STATE (t1)</div>
          <div style={stageValue}>
            {acceptedStatePrime
              ? `CANDIDATE בלבד — level ${acceptedStatePrime.level} · stability ${acceptedStatePrime.stability}`
              : "לא ידוע — אין חוזה קנוני לשמירה/עדכון של State′"}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 10, color: "#5a76a3", marginTop: 4 }}>
        קרונולוגיה אינה סיבתיות — כל שלב מוצג רק כאשר קיים קישור אמיתי (action_ref / effect_ref) במאגר; שלב לא ידוע נשאר "לא ידוע", לעולם לא מומצא.
      </div>
      <div style={{ fontSize: 10, color: "#fbbf24", marginTop: 3 }}>
        גבול פתוח — Effect מאומת מוכיח תוצאת Effect לפי רשומת האימות שלו בלבד; אינו מוכיח Learning ואינו מוכיח State(t+1).
      </div>
    </div>
  );
}

/**
 * STATE + TIME. `priorState`/`delta` are `undefined` for legacy events (an
 * event is a discrete fact, not a repeated measurement — genuinely not
 * computed, never shown as if it were checked). For canon, `null` means
 * checked and none exists; an object means a real prior Observation for the
 * SAME subject was found — the delta is plain arithmetic between two real
 * numbers, never a causal or significance claim.
 */
function StateAndTime({ selected }: { selected: FoundContext }) {
  if (selected.priorState === undefined) {
    return (
      <div>
        <div style={sectionHead}>STATE + TIME</div>
        <div style={emptyState}>
          Not applicable — a {selected.system === "legacy" ? "legacy event" : "record"} is a discrete fact, not a
          repeated state measurement, so there is no prior value to compare against.
        </div>
      </div>
    );
  }

  if (selected.priorState === null) {
    return (
      <div>
        <div style={sectionHead}>STATE + TIME</div>
        <div style={emptyState}>No prior verified state — this is the earliest recorded Observation for this subject.</div>
      </div>
    );
  }

  const prior = selected.priorState;
  const delta = selected.delta;
  const box = { background: "#111726", border: "1px solid #1e2740", borderRadius: 6, padding: "8px 12px", flex: "1 1 200px" };

  return (
    <div>
      <div style={sectionHead}>STATE + TIME</div>
      <div style={{ fontSize: 11, color: "#7b8ca6", marginBottom: 8 }}>
        Most recent PRIOR Observation for the same subject — chronological order only, never a causal claim.
      </div>
      <div style={{ display: "flex", alignItems: "stretch", gap: 10, flexWrap: "wrap" }}>
        <div style={box}>
          <div style={{ fontSize: 9, letterSpacing: 1, color: "#5a76a3" }}>PRIOR · {prior.observed_at}</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>{prior.label}</div>
          {prior.level !== undefined ? (
            <div style={{ fontSize: 11, color: "#9fb0d0", marginTop: 4 }}>
              level {prior.level} · stability {prior.stability}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", color: "#5a76a3", fontSize: 16 }}>→</div>
        <div style={{ ...box, borderColor: "#38bdf6" }}>
          <div style={{ fontSize: 9, letterSpacing: 1, color: "#38bdf8" }}>CURRENT · {selected.timestamp}</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>{selected.label}</div>
        </div>
      </div>
      {delta && (delta.level !== undefined || delta.stability !== undefined) ? (
        <div style={{ fontSize: 11, color: "#cfe0f5", marginTop: 8 }}>
          observed change:{" "}
          {delta.level !== undefined ? <>level {delta.level >= 0 ? "+" : ""}{delta.level.toFixed(2)} </> : null}
          {delta.stability !== undefined ? <>· stability {delta.stability >= 0 ? "+" : ""}{delta.stability.toFixed(2)}</> : null}
          <span style={{ color: "#5a76a3" }}> (plain difference between two real values — not a verified causal effect)</span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * RELATIONSHIP TYPES. Lists every real, directional edge — never a generic
 * "connected". An empty (but defined) array is a real, checked absence,
 * rendered as UNRESOLVED rather than hidden.
 */
function Relationships({ selected }: { selected: FoundContext }) {
  const rels = selected.relationships;
  return (
    <div>
      <div style={sectionHead}>RELATIONSHIPS</div>
      {rels === undefined || rels.length === 0 ? (
        <div style={emptyState}>UNRESOLVED — no verified relationship.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rels.map((r, i) => (
            <div key={`${r.direction}-${r.other_id}-${i}`} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: r.direction === "incoming" ? "#fbbf24" : "#34d399", fontWeight: 700 }}>
                {r.direction === "incoming" ? "↙" : "↗"}
              </span>
              <span>{r.relation_label}</span>
              <span style={{ color: "#7f97c2" }}>{r.other_label}</span>
              <span style={{ color: "#5a76a3", marginLeft: "auto" }}>
                {r.origin ?? "—"} · {r.evidence_level ?? "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * VALUE/NEED + ACTION — a single compact line, deliberately secondary here:
 * Dynamics' emphasis is time/change/causality (above). Same shared fields
 * (`knownNeeds`/`actionSpace`) Globe and Marketplace show, from the SAME
 * projection — never recomputed per surface.
 */
function NeedActionLine({ selected }: { selected: FoundContext }) {
  const needText = !selected.knownNeeds
    ? "not computed"
    : !selected.knownNeeds.checked
      ? `could not check (${selected.knownNeeds.reason})`
      : selected.knownNeeds.needs.length > 0
        ? `${selected.knownNeeds.needs.length} real Need(s) — ${selected.knownNeeds.needs[0].need.desired_change}`
        : "UNKNOWN — none persisted for this subject";
  const actionText = !selected.actionSpace
    ? "not computed"
    : selected.actionSpace.admissible
      ? "admissible"
      : `not admissible — missing ${selected.actionSpace.blockers.join(", ")}`;

  return (
    <div style={{ fontSize: 11, color: "#8fa3c9", marginTop: 12, lineHeight: 1.6 }}>
      <span style={{ color: "#5a76a3" }}>need: </span>{needText}
      <span style={{ color: "#5a76a3" }}> · action: </span>{actionText}
    </div>
  );
}

/**
 * EVIDENCE TRACE. The vertical trail from raw evidence to what remains
 * unresolved — every stage reads an existing field, none is a fabricated
 * inference. Also carries the "why does it matter" honesty note, since
 * canon's own anti-ranking rule (§21) means there is genuinely no further
 * derived significance to report beyond what's traced here.
 */
function EvidenceTrace({ selected }: { selected: FoundContext }) {
  const unresolvedBits: string[] = [];
  if (selected.timestamp === undefined) unresolvedBits.push("exact timestamp");
  if (selected.priorState === undefined) unresolvedBits.push("state history (not applicable to this record type)");
  if (selected.relationships === undefined || selected.relationships.length === 0) unresolvedBits.push("verified relationships");

  return (
    <div>
      <div style={sectionHead}>EVIDENCE TRACE</div>
      <div style={{ fontSize: 12, lineHeight: 1.8 }}>
        <div>Source Evidence → {selected.system === "canon" ? "canon Observation" : "legacy event"} <b>{selected.matched_id}</b></div>
        <div>→ persisted fact: {selected.persisted_or_derived} ({selected.provenance})</div>
        <div>→ derived projection: {selected.label}</div>
        <div>
          → relationship/state:{" "}
          {selected.relationships && selected.relationships.length > 0
            ? `${selected.relationships.length} real relationship(s)`
            : selected.priorState
              ? "1 prior state found"
              : "none supported by current data"}
        </div>
        <div style={{ color: "#fbbf24" }}>
          → unknown/unresolved: {unresolvedBits.length > 0 ? unresolvedBits.join(", ") : "nothing outstanding for this record"}
        </div>
      </div>
      <div style={{ fontSize: 11, color: "#7b8ca6", marginTop: 8, maxWidth: 640 }}>
        Why does it matter: PHILOS does not compute significance or a ranking for this item — canon's own design
        forbids a single combined score (PHILOS-MELTING-POT-CANON.md §21). Shown as recorded, not ranked.
      </div>
    </div>
  );
}

// ── canon observations — a real visual timeline, not list rows ─────────────

const DOMAIN_ORDER: Domain[] = ["people", "community", "activity", "resources", "impact"];

const CANON_DOMAIN_COLOR: Record<string, string> = { G: "#38bdf8", E: "#f472b6", C: "#a78bfa" };
const CANON_DOMAIN_LABEL: Record<string, string> = { G: "physical", E: "emotional", C: "cognitive" };
const CANON_FRAME_LABEL: Record<string, string> = { I: "individual", R: "relational", S: "systemic" };
const CANON_LANES: ("G" | "E" | "C")[] = ["G", "E", "C"];
const CANON_LANE_H = 64;
const CANON_PAD_T = 20;
const CANON_H = CANON_PAD_T + CANON_LANES.length * CANON_LANE_H + 12;

/**
 * A real event/node timeline for canon Observations — the SAME time/lane
 * visual language as the causal graph above (x = observed_at, y = lane), a
 * SEPARATE svg (never merged: canon has no edges, and mixing the two axes
 * would visually imply a causal relationship no evidence supports — see
 * `projectCanonDynamics.ts`'s header). Every dot IS the real click-to-select
 * entry point (SVG `<a>`), not a decorative mark over a list.
 */
function CanonPanel({ canon, highlightId }: { canon: CanonDynamicsGraph; highlightId?: string }) {
  const laneTop = (d: "G" | "E" | "C") => CANON_PAD_T + CANON_LANES.indexOf(d) * CANON_LANE_H;
  const laneMid = (d: "G" | "E" | "C") => laneTop(d) + CANON_LANE_H / 2;

  // Ledger §33: normal mode never shows TEST/PLACEHOLDER/SYSTEM
  // Observations as part of the visible "world" timeline — the store's
  // own real totals (`canon.summary`) are shown separately below, stated
  // explicitly as store-wide, so the two numbers never silently disagree.
  const visibleNodes = canon.nodes.filter((n) => isNormalModeSubject(n.subject));
  const hiddenCount = canon.nodes.length - visibleNodes.length;

  const times = visibleNodes.map((n) => Date.parse(n.observed_at)).filter((t) => !Number.isNaN(t));
  const minT = times.length ? Math.min(...times) : 0;
  const span = (times.length ? Math.max(...times) : 1) - minT || 1;
  const x = (ts: string) => {
    const t = Date.parse(ts);
    return Number.isNaN(t) ? PAD_L : PAD_L + ((t - minT) / span) * (W - PAD_L - PAD_R);
  };

  const perLane: Record<string, number> = {};
  const pos = new Map<string, { x: number; y: number }>();
  for (const n of visibleNodes) {
    const i = perLane[n.domain] ?? 0;
    perLane[n.domain] = i + 1;
    pos.set(n.canon_event_id, { x: x(n.observed_at), y: laneMid(n.domain) + ((i % 3) - 1) * 16 });
  }

  return (
    <div style={{ marginTop: 28, paddingTop: 16, borderTop: "1px solid #1e2740" }}>
      <div style={{ fontSize: 10, letterSpacing: 2, color: "#5a76a3", marginBottom: 6 }}>
        CANON OBSERVATIONS — TIME/DOMAIN VIEW
      </div>
      <p style={{ fontSize: 11, opacity: 0.6, margin: "0 0 10px", maxWidth: 900 }}>
        A separate log from the causal graph above — no edge is drawn between the two systems.
        Every dot is a real, persisted Observation for a normal-mode (REAL/DEMO) subject; click one to select it.
        visible {visibleNodes.length}{hiddenCount > 0 ? ` (${hiddenCount} TEST/PLACEHOLDER/SYSTEM Observation(s) in the store, hidden in normal mode)` : ""} ·
        store totals — physical {canon.summary.domains.G} · emotional {canon.summary.domains.E} ·
        cognitive {canon.summary.domains.C}
      </p>
      {visibleNodes.length === 0 ? (
        <div style={{ fontSize: 12, opacity: 0.7 }}>No canon Observations for a normal-mode subject in the store.</div>
      ) : (
        <svg viewBox={`0 0 ${W} ${CANON_H}`} width="100%" role="img" aria-label="Canon Observation timeline">
          {CANON_LANES.map((d) => (
            <g key={d}>
              <rect x={PAD_L} y={laneTop(d)} width={W - PAD_L - PAD_R} height={CANON_LANE_H} fill="#111726" stroke="#1e2740" />
              <rect x={PAD_L} y={laneTop(d)} width={6} height={CANON_LANE_H} fill={CANON_DOMAIN_COLOR[d]} />
              <text x={16} y={laneMid(d)} fill="#9fb0d0" fontSize={12} dominantBaseline="middle">{CANON_DOMAIN_LABEL[d]}</text>
            </g>
          ))}
          {visibleNodes.map((n) => {
            const p = pos.get(n.canon_event_id);
            if (!p) return null;
            const isHighlighted = n.canon_event_id === highlightId;
            const href = `/dynamics?ctx=${encodeURIComponent(encodeSystemContextRef({ kind: "canon_observation", canon_event_id: n.canon_event_id }))}`;
            return (
              <a key={n.id} href={href}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHighlighted ? 8 : 5}
                  fill={CANON_DOMAIN_COLOR[n.domain]}
                  stroke={isHighlighted ? "#f2f6fc" : "#0b0f1a"}
                  strokeWidth={isHighlighted ? 3 : 1.5}
                >
                  <title>{`${n.label}\n${n.tooltip}\nlevel ${n.level} · stability ${n.stability} · ${n.observed_at}\npersisted · self_reported`}</title>
                </circle>
                {isHighlighted ? (
                  <text x={p.x} y={p.y - 14} fill="#f2f6fc" fontSize={10} textAnchor="middle">{n.context}</text>
                ) : null}
              </a>
            );
          })}
        </svg>
      )}
    </div>
  );
}

/**
 * TIME RANGE — real counts of persisted canon Observations within
 * today/7-day/30-day/all-time windows, computed by `page.tsx` and shown
 * verbatim. This is TIME AWARENESS over the real log, not a filtered view
 * of the causal graph below (the graph's own x-axis stays the deterministic
 * min/max span it already used — narrowing it to a selected range is
 * separate, future work; this panel states real counts only).
 */
function TimeRangePanel({ timeRange }: { timeRange: TimeRangeSummary }) {
  const cell = { minWidth: 90, textAlign: "center" as const };
  const num = { fontSize: 20, fontWeight: 700, color: "#5b9cf6", fontVariantNumeric: "tabular-nums" as const };
  const lbl = { fontSize: 9.5, color: "#5a76a3", letterSpacing: 0.5, marginTop: 2 };
  return (
    <div dir="rtl" style={{ display: "flex", gap: 20, alignItems: "center", padding: "10px 16px", background: "#0f1a2e", border: "1px solid #2a3f66", borderRadius: 8, marginBottom: 16, maxWidth: 900 }}>
      <div style={{ fontSize: 10, letterSpacing: 1, color: "#5aa6ff", minWidth: 70 }}>טווח זמן</div>
      <div style={cell}><div style={num}>{timeRange.today}</div><div style={lbl}>היום</div></div>
      <div style={cell}><div style={num}>{timeRange.last7}</div><div style={lbl}>7 ימים</div></div>
      <div style={cell}><div style={num}>{timeRange.last30}</div><div style={lbl}>30 יום</div></div>
      <div style={cell}><div style={num}>{timeRange.allTime}</div><div style={lbl}>כל הזמן</div></div>
      <div style={{ fontSize: 9.5, color: "#5a76a3", marginLeft: "auto" }}>Observations אמיתיים · נכון ל-{timeRange.asOf.slice(0, 16).replace("T", " ")}</div>
    </div>
  );
}

/**
 * COMMUNITY CAPITAL — Dynamics ↔ Community wiring (System-Wide Build, Pass
 * 3). TREASURY → inflow/outflow (`community.capital`, the real chronological
 * running balance) → allocation/investment (`community.group.allocations`,
 * each state real) → resulting Effect (real verified/rejected/pending, from
 * the SAME `group.impact` Community's own terminal reads) → resulting
 * community state (`group.budget.available`). A capital movement never
 * appears as a disconnected number: every allocation row states its own
 * real state, and whether a real Effect exists for it — "לא ידוע" when it
 * genuinely doesn't, never silently omitted.
 */
function CommunityCapitalPanel({ community }: { community: CommunityCapitalContext }) {
  const { group, capital, membership, tensions, provenance, bridgeActionCount } = community;
  const badgeColor = provenance === "DEMO" ? "#fbbf24" : "#34d399";
  const maxBalance = Math.max(1, ...capital.map((p) => Math.abs(p.balance)));
  const maxMembers = Math.max(1, ...membership.map((p) => p.count));

  return (
    <div dir="rtl" style={{ padding: "12px 16px", background: "#0f1a2e", border: "1px solid #2a3f66", borderRadius: 8, marginBottom: 16, maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6, border: `1px solid ${badgeColor}55`, color: badgeColor, fontFamily: "ui-monospace, monospace" }}>{provenance}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#f2f6fc" }}>{group.name} — הון לאורך זמן</span>
      </div>

      {capital.length === 0 ? (
        <div style={{ fontSize: 12, color: "#7b8ca6", fontStyle: "italic" }}>אין תנועת כסף רשומה לקהילה זו.</div>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 70, marginBottom: 10, overflowX: "auto" }}>
          {capital.map((p) => (
            <div key={p.event_id} title={`${p.date} · ${p.delta >= 0 ? "+" : ""}${p.delta} → יתרה ${p.balance}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 22 }}>
              <div style={{ width: 12, borderRadius: 3, height: `${Math.max(4, (Math.abs(p.balance) / maxBalance) * 50)}px`, background: p.balance >= 0 ? "#34d399" : "#f2635c" }} />
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 10.5, color: "#5a76a3", marginBottom: 8 }}>
        זמין כרגע: ₪{group.budget.available.toLocaleString()} · הושקע: ₪{group.budget.spent.toLocaleString()}
      </div>

      {/* Mission B, B7 — MEMBERSHIP change over time, real
          `member.joined` events only (see `buildMembershipTimeline`
          header — no leave event type exists, so this is honestly
          monotonic, never a fabricated churn curve). */}
      <div style={{ fontSize: 10.5, color: "#8fa3c9", marginBottom: 4 }}>חברות לאורך זמן · {group.members.length} חברים כיום</div>
      {membership.length === 0 ? (
        <div style={{ fontSize: 12, color: "#7b8ca6", fontStyle: "italic", marginBottom: 8 }}>אין אירוע member.joined רשום.</div>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 40, marginBottom: 10, overflowX: "auto" }}>
          {membership.map((p) => (
            <div key={p.event_id} title={`${p.date} · ${p.person_id} → סה"כ ${p.count}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 16 }}>
              <div style={{ width: 10, borderRadius: 3, height: `${Math.max(4, (p.count / maxMembers) * 30)}px`, background: "#5b9cf6" }} />
            </div>
          ))}
        </div>
      )}

      {/* BRIDGE — real ACTION_AFFECTS_COMMUNITY links from the Canonical
          Cross-Entity Link Registry, for this same group_id. An honest
          zero for the real group (no real canon Action has ever recorded
          a community link — canon's Action type carries no community_id
          field), non-zero only where the DEMO marketplace scenario's own
          object graph actually reaches this community. */}
      <div style={{ fontSize: 10, color: "#5a76a3", marginBottom: 8 }}>
        גשר · Actions מקושרים (ACTION_AFFECTS_COMMUNITY): {bridgeActionCount > 0 ? `${bridgeActionCount} (DEMO)` : "0 — לא ידוע ל-canon Action אמיתי"}
      </div>

      {group.allocations.length === 0 ? (
        <div style={{ fontSize: 12, color: "#7b8ca6", fontStyle: "italic" }}>אין הקצאה/השקעה רשומה.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {group.allocations.map((a) => {
            // Real, explicit link: only an ImpactView whose OWN allocation_id
            // matches — never inferred from title/proximity.
            const effects = group.impact.filter((i) => i.allocation_id === a.allocation_id);
            const effectLabel = effects.length === 0
              ? "לא ידוע — אין Effect רשום"
              : effects.some((i) => i.verified)
                ? "Effect אומת"
                : effects.some((i) => i.rejected)
                  ? "Effect נדחה"
                  : "Effect ממתין";
            const effectColor = effects.length === 0 ? "#5a76a3" : effects.some((i) => i.verified) ? "#34d399" : effects.some((i) => i.rejected) ? "#f2635c" : "#fbbf24";
            return (
              <div key={a.allocation_id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11.5, padding: "4px 8px", borderRadius: 6, background: "rgba(90,120,180,0.06)", flexWrap: "wrap" }}>
                <span style={{ color: "#dbe6f6" }}>{a.title}</span>
                <span style={{ color: "#8aa0c8" }}>₪{a.amount.toLocaleString()} · {ALLOC_STATE_LABEL[a.state]}</span>
                <span style={{ color: effectColor, fontWeight: 600 }}>{effectLabel}</span>
              </div>
            );
          })}
        </div>
      )}

      {tensions.length > 0 ? (
        <div style={{ marginTop: 8, fontSize: 10.5, color: "#f2635c" }}>
          {tensions.length} Tension פתוח בקהילה זו — {tensions[0].label}
        </div>
      ) : null}
    </div>
  );
}

const ALLOC_STATE_LABEL: Record<string, string> = { voting: "בהצבעה", approved: "אושר", transferred: "הועבר" };

/**
 * MY IMPACT vs COLLECTIVE IMPACT — MY IMPACT is real (`selected.
 * actionLifecycle`, the same per-subject read Hub/Brain/Marketplace already
 * show — no recomputation). COLLECTIVE IMPACT is stated honestly as
 * UNKNOWN: canon's `Action`/`Effect` carry no `group_id` field (confirmed
 * across this codebase — `ActionCollectiveContext.tsx`'s own header), so
 * there is no real data to attribute an Action's effect to a group/
 * community with. Never bridged to the separate legacy Value-Group system
 * here — that is a structurally different ontology (see `canonEvent.ts`
 * header on why the two never merge).
 */
function ImpactScope({ selected }: { selected: Extract<SelectedContext, { status: "found" }> }) {
  const lifecycle = selected.actionLifecycle;
  return (
    <div dir="rtl" style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "10px 16px", background: "#0f1a2e", border: "1px solid #2a3f66", borderRadius: 8, marginBottom: 16, maxWidth: 900 }}>
      <div style={{ fontSize: 10, letterSpacing: 1, color: "#5aa6ff", minWidth: 90 }}>היקף השפעה</div>
      <div style={{ fontSize: 12, color: "#dbe6f6" }}>
        <span style={{ color: "#5a76a3" }}>ההשפעה שלי: </span>
        {lifecycle ? `${lifecycle.counts.actions_total} Action(s), ${lifecycle.counts.effect_verified} אומתו` : "לא חושב"}
      </div>
      <div style={{ fontSize: 12, color: "#7b8ca6", fontStyle: "italic" }}>
        <span style={{ color: "#5a76a3" }}>השפעה קולקטיבית: </span>
        לא ידוע — Action/Effect קנוני אינם נושאים group_id
      </div>
    </div>
  );
}

/**
 * Day Closing fusion, exposed in Dynamics history (product requirement:
 * "also expose the same chronological chain in Dynamics — do not create a
 * separate Day-Cycle truth"). Calls the SAME `buildDayClosingQuestions` and
 * renders the SAME `DayClosingFusion` component `/hub` uses — no second
 * question engine, no second UI. The only new thing here is deriving
 * `core`/`tensions` for the SELECTED canon subject from the `canon` graph
 * this route already loads, via the SAME `buildMeasuredStateSpace`/
 * `buildHumanTensions` Hub/Brain already call.
 */
function DynamicsDayClosingSection({
  canon, subject, knownNeeds, lifecycle, today, domainStates,
}: {
  canon: CanonDynamicsGraph;
  subject: string;
  knownNeeds: KnownNeedResult | undefined;
  lifecycle: ActionLifecycleSummary | undefined;
  today: string;
  domainStates: DomainStateRecord[];
}) {
  const core = buildMeasuredStateSpace(canon, subject);
  const tensions = sortTensions(buildHumanTensions(core));
  const effectiveLifecycle = lifecycle ?? EMPTY_LIFECYCLE_DV;
  const pendingNeeds = needsRequiringAction(knownNeeds ?? EMPTY_KNOWN_NEEDS_DV, effectiveLifecycle);
  const todaysActions = effectiveLifecycle.actions.filter((a) => a.action.action.time.slice(0, 10) === today);
  const questions = buildDayClosingQuestions({ todaysActions, pendingNeeds, tensions, lifecycle: effectiveLifecycle });

  // V04 — the same real, computed NEXT ACTION CTA `HubCommandCenter.tsx`
  // already uses (same priority: pending Need > open-loop Action > Tension
  // > "no Observation at all yet" > honest "nothing justified") — Dynamics
  // reads the exact same real `knownNeeds`/`lifecycle`/`tensions`/`core`
  // this section already computed above, never a second derivation.
  const openLoopActions = effectiveLifecycle.actions.filter((a) => a.verification_state === "no_effect_recorded");
  const marks = ([core.G, core.E, core.C] as const).filter((m): m is NonNullable<typeof m> => !!m);
  const anchor = marks.length > 0 ? [...marks].sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0] : undefined;
  const hasAnyObservation = !!anchor;
  const nextAction = pendingNeeds.length > 0
    ? { label: `טפל בצורך: ${pendingNeeds[0].need.desired_change}`, href: "/hub#action-outcomes" }
    : openLoopActions.length > 0
      ? { label: `רשום Effect ל-Action: ${openLoopActions[0].action.action.type}`, href: "/marketplace" }
      : tensions.length > 0
        ? { label: `בדוק Tension: ${tensions[0].label}`, href: anchor ? `?ctx=${encodeURIComponent(`canon:${anchor.canon_event_id}`)}` : "/hub" }
        : !hasAnyObservation
          ? { label: "רשום תצפית עצמית ראשונה", href: "/hub#record-observation" }
          : null;

  return (
    <div style={{ marginBottom: 16 }}>
      <CausalChainFlow
        core={core} lifecycle={effectiveLifecycle} nextAction={nextAction}
        subject={subject} today={today}
        // HUMAN CONFIG (cross-domain base) and the DOMAIN CONFIG SLOTS are
        // passed as two separate axes, and the domain axis is read from the
        // registry rather than naming Music here — `domainConfigRegistry.ts`.
        // No `activeDomainId` is passed because Dynamics resolves none: the
        // selection therefore reports UNKNOWN with its real reason, and the
        // registry never lets availability stand in for selection.
        configBaseline={{
          person: buildActivePersonRefs(),
          domains: buildDomainConfigBaselines(undefined),
          selection: resolveSelectedDomain(undefined),
        }}
      />

      {/* 7-terminal propagation — the SAME shared Observation reading Hub/
          Brain/Community/World/Planet render; here it sits directly under
          the causal chain whose OBSERVATION stage it explains. */}
      {/* STEP 5/6 — Dynamics' PRIMARY is the causal chain above. The reading
          that explains its OBSERVATION stage is real and unchanged, one click
          away. `PHILOS-SYSTEM-LANGUAGE.md` §9. */}
      <AuditHeading accent="#fbbf24" />
      <AuditSection
        title="קריאת התצפית האחרונה · OBSERVATION READING"
        note="6 אזכורים, ערכי בסיס, משפחות ערך, ניגודים, Color Roles, DEMO"
      >
        <ObservationReadingPanel subject={subject} surface="DYNAMICS" />
      </AuditSection>

      {/* Operational-groups pass — the REAL group's trajectory over time
          (members/resources/needs/actions/effects/learning/trend), from
          the ONE shared profile assembler. */}
      <div dir="rtl"><GroupOpsPanel variant="trajectory" /></div>

      {/* Everything below the timeline is real, kept, and reachable — just
          demoted out of the primary band, so the causal chain is what the
          route actually reads as. Nothing here was removed. */}
      <details style={{ marginBottom: 12 }}>
        <summary style={{ cursor: "pointer", ...TYPE.micro, color: COLOR.textFaint, padding: "6px 0" }}>
          DETAILS / AUDIT — Day Closing (שאלות ממוקדות, Learning, נשא הלאה)
        </summary>
        <div style={{ marginTop: 8 }}>
          <DayClosingFusion core={core} todaysActions={todaysActions} questions={questions} />
        </div>
      </details>
      <details style={{ marginBottom: 12 }}>
        <summary style={{ cursor: "pointer", ...TYPE.micro, color: COLOR.textFaint, padding: "6px 0" }}>
          DETAILS / AUDIT — עומק ערך אנושי (Human Value Depth, DomainState, Mission)
        </summary>
        <div style={{ marginTop: 8 }}>
          <DynamicsHumanValueDepth
            core={core} tensions={tensions} lifecycle={effectiveLifecycle} needs={pendingNeeds}
            todaysActions={todaysActions} subject={subject} today={today} domainStates={domainStates}
          />
        </div>
      </details>
    </div>
  );
}

// ── primary causal graph geometry (unchanged logic) ─────────────────────────

const W = 1200;
const LANE_H = 110;
const PAD_L = 150;
const PAD_R = 40;
const PAD_T = 24;
const H = PAD_T + DOMAIN_ORDER.length * LANE_H + 16;

const EMPTY_LIFECYCLE_DV: ActionLifecycleSummary = { subject: "", actions: [], counts: { actions_total: 0, no_effect_recorded: 0, effect_claimed_only: 0, effect_verified: 0, learnings_with_state_prime: 0 } };
const EMPTY_KNOWN_NEEDS_DV: KnownNeedResult = { needs: [], checked: false, reason: "not computed" };

export default function DynamicsView({
  semanticContext,
  viewerSubject,
  view,
  canon,
  selected,
  timeRange,
  community,
  today,
  identityLink,
  personContext,
  defaultLifecycle,
  domainStates,
  personFrameSlot,
}: {
  /** The ONE canonical semantic context, resolved server-side. */
  semanticContext: ResolvedViewerContext;
  /** The VIEWER's own canon subject, resolved server-side — never a
   *  constant imported by a client component. */
  viewerSubject: string;
  view: DynamicsViewModel;
  /** The shared PERSON-IN-CONTEXT frame, rendered server-side in page.tsx
   *  and threaded here as a slot — this component is `"use client"` and
   *  cannot resolve the frame itself. It is REFERENCE, and sits ABOVE the
   *  chronology it is a frame for; it never enters the causal chain, never
   *  becomes a stage, and never fills STATE(t0)/STATE(t1). */
  personFrameSlot?: React.ReactNode;
  canon?: CanonDynamicsGraph;
  selected?: SelectedContext;
  timeRange?: TimeRangeSummary;
  community?: CommunityCapitalContext;
  /** Same clock read `page.tsx` already owns for `timeRange` — this
   *  component stays clock-free itself (see its own header). Only used to
   *  scope "today's" Actions for the Day Closing fusion section below. */
  today?: string;
  /** The real, resolved Person↔Community-Member identity link status —
   *  `page.tsx` resolves it once via `resolveShellIdentityLink()`. */
  identityLink?: ShellIdentityLink;
  personContext?: PersonContext;
  /** REAL_CURRENT_SUBJECT's real Action lifecycle (`page.tsx::
   *  buildActionLifecycleSummary`, same function `selected.actionLifecycle`
   *  already uses when a `?ctx=` is selected), computed unconditionally so
   *  the Day Closing section never shows a false-empty lifecycle just
   *  because no `?ctx=` happens to be in the URL — real Actions/Effects/
   *  Learnings exist for person_roei independent of any selection. Used
   *  only as the fallback when no `?ctx=` selection already supplied one. */
  defaultLifecycle?: ActionLifecycleSummary;
  /** Real DomainState history for the SAME subject this render already
   *  resolves below (`?ctx=`-selected canon subject, or
   *  REAL_CURRENT_SUBJECT) — `page.tsx` fetches it via the same
   *  `findDomainStatesForSubject` accessor `/hub`/`/hub/human-config`
   *  already use. Threaded down to `DynamicsHumanValueDepth`, the P0
   *  fix wiring this backbone into Dynamics for the first time. */
  domainStates?: DomainStateRecord[];
}) {
  const highlightedCanonId =
    selected?.status === "found" && selected.system === "canon" ? selected.matched_id : undefined;
  const highlightedEventId =
    selected?.status === "found" && selected.system === "legacy" ? selected.matched_id : undefined;
  const laneTop = (d: Domain) => PAD_T + DOMAIN_ORDER.indexOf(d) * LANE_H;
  const laneMid = (d: Domain) => laneTop(d) + LANE_H / 2;

  // x = time. Deterministic min/max over the rendered nodes; no clock.
  const times = view.nodes.map((n) => Date.parse(n.timestamp)).filter((t) => !Number.isNaN(t));
  const minT = times.length ? Math.min(...times) : 0;
  const span = (times.length ? Math.max(...times) : 1) - minT || 1;
  const x = (ts: string) => {
    const t = Date.parse(ts);
    return Number.isNaN(t) ? PAD_L : PAD_L + ((t - minT) / span) * (W - PAD_L - PAD_R);
  };

  // Endpoint positions come ONLY from view.nodes — an id that is not a node has
  // no coordinate, so its edge is dropped rather than drawn at a guess (§0/§5).
  // The within-lane vertical stagger is deterministic LAYOUT, not data.
  const perLane: Record<string, number> = {};
  const pos = new Map<string, { x: number; y: number }>();
  for (const n of view.nodes) {
    const i = perLane[n.domain] ?? 0;
    perLane[n.domain] = i + 1;
    pos.set(n.event_id, { x: x(n.timestamp), y: laneMid(n.domain) + ((i % 3) - 1) * 22 });
  }

  // Selected-context FOCUS: real neighbors of the selected node, read off
  // the same view.edges every relationship already comes from — never a
  // fabricated grouping. When nothing is selected, everything stays at full
  // opacity (unchanged from before this pass).
  const touchedByNode = new Set<string>();
  for (const e of view.edges) {
    touchedByNode.add(e.source_event_id);
    touchedByNode.add(e.target_event_id);
  }
  const connected = new Set<string>();
  if (highlightedEventId) {
    connected.add(highlightedEventId);
    for (const e of view.edges) {
      if (e.source_event_id === highlightedEventId) connected.add(e.target_event_id);
      if (e.target_event_id === highlightedEventId) connected.add(e.source_event_id);
    }
  }
  const dim = (id: string) => (highlightedEventId ? (connected.has(id) ? 1 : 0.22) : 1);

  return (
    <div style={{ fontFamily: "system-ui", background: "#0b0f1a", color: "#e6ebf5", minHeight: "100vh", padding: 20 }}>
      <SystemShell
          viewerContext={semanticContext}
        surface="dynamics"
        purpose="What changed, when, and what do we know about why — a time/causality view of the system."
        selected={selected}
        subject={selected?.status === "found" && selected.subject ? selected.subject : viewerSubject}
        identityLink={identityLink}
      />

      {/* PERSON-IN-CONTEXT frame — ABOVE the chronology, because it is the
          frame the chronology is OF. Reference only: it never enters the
          causal chain, never becomes a stage, and never fills
          STATE(t0)/STATE(t1) — those still read real Observations only. */}
      {personFrameSlot}

      {/* PRIMARY — the one causal timeline. Ledger §33: with no explicit
          `?ctx=` selecting a canon subject, default to REAL_CURRENT_SUBJECT
          — never silently blank, never a TEST/PLACEHOLDER fallback. An
          explicit `?ctx=` still resolves to whatever it names (diagnostic/
          direct-link use is unaffected). */}
      {canon && today ? (
        <DynamicsDayClosingSection
          canon={canon}
          subject={selected?.status === "found" && selected.system === "canon" && selected.subject ? selected.subject : viewerSubject}
          knownNeeds={selected?.status === "found" && selected.system === "canon" ? selected.knownNeeds : undefined}
          lifecycle={(selected?.status === "found" && selected.system === "canon" ? selected.actionLifecycle : undefined) ?? defaultLifecycle}
          today={today}
          domainStates={domainStates ?? []}
        />
      ) : null}
      {/* ── SECONDARY: real, kept, reachable — demoted below the timeline ──
          Selected `?ctx=` context, time-range counts, community capital and
          the canonical slice are all still exactly what they were; they are
          simply no longer what the route opens with. Open by default only
          when the viewer explicitly selected something via `?ctx=`. */}
      <details open={selected?.status === "found"} style={S_SEC.details}>
        <summary style={S_SEC.summary}>
          CONTEXT / RANGE — הקשר נבחר, טווחי זמן, הון קהילתי, פרוסה קנונית
        </summary>
        <div style={{ marginTop: 10 }}>
          {selected ? <SelectedContextHero selected={selected} /> : null}
          {selected?.status === "found" && selected.system === "canon" ? <ImpactScope selected={selected} /> : null}
          {timeRange ? <TimeRangePanel timeRange={timeRange} /> : null}
          {community ? <CommunityCapitalPanel community={community} /> : null}

          {/* Phase 4 vertical slice — the SAME shared component `/hub` renders
              (`CanonicalSlicePanel.tsx`), given the SAME subject resolution
              the timeline above already uses, so Hub and Dynamics never
              disagree about PersonInstance/ValueDomainInstance state for a
              given subject. */}
          {today ? (
            <CanonicalSlicePanel
              subject={selected?.status === "found" && selected.system === "canon" && selected.subject ? selected.subject : viewerSubject}
              asOf={timeRange?.asOf ?? today}
            />
          ) : null}

          {/* Generic Value-Domain Config engine — same DEMO reference instance
              Hub shows, same component, feeding the same event history this
              Dynamics route already renders. Not a Dynamics-specific
              re-implementation. V04 — collapsed, same as Hub §58, never
              primary flow content. */}
          {today ? (
            <details dir="rtl" style={{ margin: "12px 0 0" }}>
              <summary style={{ cursor: "pointer", fontSize: 10.5, letterSpacing: 1, color: "#5a76a3", padding: "4px 0" }}>
                EXAMPLES / DEMO — Value Domain (Music, hypothesis-only) — לא משפיע על REAL
              </summary>
              <div style={{ marginTop: 8 }}>
                <ValueDomainDemoPanel today={today} />
              </div>
            </details>
          ) : null}
        </div>
      </details>

      {/* ── AUDIT / DEBUG: the legacy cross-domain causal graph ──
          Unchanged in every respect except position — same projection, same
          marks, same honesty panels. It answers a different question from
          the timeline above ("all events, all lanes, over time") and stays
          a diagnostic surface rather than the route's opening statement. */}
      <details style={S_SEC.details}>
        <summary style={S_SEC.summary}>
          AUDIT / DEBUG — גרף סיבתי legacy (כל האירועים, כל הנתיבים) · {view.hud.nodes} nodes / {view.hud.edges} edges
        </summary>
        <div style={{ marginTop: 10 }}>
      <div dir="rtl" style={{ textAlign: "right", fontSize: 10, letterSpacing: 1, color: "#5a76a3", marginBottom: 4 }}>
        גרף סיבתי — כוחות פועלים ושינוי לאורך זמן
      </div>
      <p style={{ fontSize: 11, opacity: 0.65, margin: "0 0 8px", maxWidth: 640 }}>
        Solid = declared (self_report); dashed = inferred (system_inference). Horizontal position
        is time; vertical position within a lane is layout, not measurement.
      </p>
      <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.85 }}>
        nodes {view.hud.nodes} · edges {view.hud.edges} (explicit {view.hud.explicit_edges} /
        inferred {view.hud.inferred_edges}) · withheld {view.hud.withheld} · unresolved {view.hud.unresolved}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Dynamics causal graph">
        {DOMAIN_ORDER.map((d) => (
          <g key={d}>
            <rect x={PAD_L} y={laneTop(d)} width={W - PAD_L - PAD_R} height={LANE_H} fill="#111726" stroke="#1e2740" />
            <rect x={PAD_L} y={laneTop(d)} width={6} height={LANE_H} fill={DOMAIN_COLOR[d]} />
            <text x={16} y={laneMid(d)} fill="#9fb0d0" fontSize={13} dominantBaseline="middle">{d}</text>
          </g>
        ))}

        {view.edges.map((e, i) => {
          const s = pos.get(e.source_event_id);
          const t = pos.get(e.target_event_id);
          if (!s || !t) return null;
          const edgeConnected = !highlightedEventId || connected.has(e.source_event_id) && connected.has(e.target_event_id);
          const opacity = (e.dashed ? 0.3 + 0.5 * (e.confidence ?? 0.5) : 0.9) * (edgeConnected ? 1 : 0.15);
          return (
            <line
              key={`${e.source_event_id}->${e.target_event_id}-${i}`}
              x1={s.x}
              y1={s.y}
              x2={t.x}
              y2={t.y}
              stroke="#cbd5e1"
              strokeWidth={e.dashed ? 1.5 : 2}
              strokeDasharray={e.dashed ? "5 4" : undefined}
              opacity={opacity}
            >
              <title>
                {`${e.origin} · ${e.evidence_word}${e.join_key_label ? ` · ${e.join_key_label}` : ""}\n${e.popover}\nwhy: ${e.source_events.join(", ")}`}
              </title>
            </line>
          );
        })}

        {view.nodes.map((n) => {
          const p = pos.get(n.event_id);
          if (!p) return null;
          const isHighlighted = n.event_id === highlightedEventId;
          const isUnresolved = !touchedByNode.has(n.event_id); // no edge touches this node at all
          return (
            <g key={n.event_id} opacity={dim(n.event_id)}>
              {isUnresolved ? (
                <circle cx={p.x} cy={p.y} r={isHighlighted ? 13 : 10} fill="none" stroke="#fbbf24" strokeWidth={1} strokeDasharray="3 3" />
              ) : null}
              <circle
                cx={p.x}
                cy={p.y}
                r={isHighlighted ? 9 : 6}
                fill={n.lane_color}
                stroke={isHighlighted ? "#38bdf8" : "#0b0f1a"}
                strokeWidth={isHighlighted ? 3 : 1.5}
              >
                <title>
                  {`${n.label}\n${n.tooltip}\nactor ${n.actor_id}${isUnresolved ? "\n(unresolved — no verified relationship touches this event)" : ""}`}
                </title>
              </circle>
            </g>
          );
        })}
      </svg>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, marginTop: 10 }}>
        {DOMAIN_ORDER.map((d) => (
          <span key={d} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, background: DOMAIN_COLOR[d], display: "inline-block", borderRadius: 2 }} />
            {d}
          </span>
        ))}
        <span>— solid = declared (self_report)</span>
        <span>– – dashed = inferred (system_inference)</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 5, border: "1px dashed #fbbf24", display: "inline-block" }} />
          unresolved (no verified relationship)
        </span>
      </div>

      {/* UNKNOWN / UNVERIFIED — visually separated, never hidden */}
      {view.withheld.text || view.unresolved.length > 0 ? (
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #1e2740" }}>
          <div dir="rtl" style={{ textAlign: "right", fontSize: 10, letterSpacing: 1, color: "#fbbf24", marginBottom: 8 }}>
            לא ידוע / לא מאומת
          </div>
          {view.withheld.text ? (
            <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8 }}>⨯ {view.withheld.text}</div>
          ) : null}
          {view.unresolved.length > 0 ? (
            <>
              <div style={{ fontSize: 13, marginBottom: 4 }}>Unresolved ({view.unresolved.length})</div>
              <ul style={{ fontSize: 12, opacity: 0.85, margin: 0, paddingLeft: 18 }}>
                {view.unresolved.map((u) => (
                  <li key={`${u.event_id}-${u.reference}`}>{u.text}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      {canon ? <CanonPanel canon={canon} highlightId={highlightedCanonId} /> : null}
        </div>
      </details>
    </div>
  );
}

/** Shared treatment for the two demoted sections below the timeline. */
const S_SEC: Record<string, React.CSSProperties> = {
  details: { margin: "0 0 12px", borderTop: "1px solid rgba(90,120,180,0.15)" },
  summary: { cursor: "pointer", fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#5a76a3", padding: "10px 0" },
};
