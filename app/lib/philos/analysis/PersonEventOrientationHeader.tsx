/**
 * PERSON · EVENT · ORIENTATION HEADER — one component, seven terminals.
 *
 * THERE IS EXACTLY ONE OF THESE, and it is the top display authority for the
 * person. Hub, Brain, Dynamics, Community, Marketplace (both routes),
 * Planet/Globe and World each render this same component reading the same
 * `loadAcceptanceScenario()` object. If a value differs between two
 * terminals, that is a defect here, not seven places to reconcile.
 *
 * NO PERSON IS SHOWN TWICE. `SystemShell`'s own `OrientationBand` renders a
 * PERSON strip whenever a terminal is not `dense`. Hub and Brain were the two
 * that were not, so they drew a person above this band and again inside it.
 * They now pass `dense`, and whatever that dropped is handed back through
 * `legacy` below — folded, not deleted.
 *
 * WHAT MUST SURVIVE THE FOLD, at 1280×800 with no scrolling: the purple
 * person line, the technical id line, the event line, the WHITE reference
 * strip, and ALL TEN analysis units as two clearly separated rows — four
 * foundation variables, then six contradiction departments. Everything else
 * is inside `<details>`. That budget is why the units are compact chips here
 * and only gain explanation, sources and direction when expanded.
 *
 * COLOUR IS A BORDER, A TAG OR A ROUTE — never a heavy background. WHITE is
 * the source strip, PURPLE is the person, and the remaining five mark record
 * role on a 3px edge or a chip outline. A Claim is never red: red is
 * matter/body/action, and an allegation drawn in it would read as an act
 * that happened.
 *
 * NO CLIENT JAVASCRIPT. Collapse/expand is a native `<details>`, the same
 * mechanism `shell/TerminalPage.tsx` uses. Nothing hydrates, so nothing can
 * mismatch.
 */
import type { ReactNode } from "react";

import {
  DEPARTMENTS_6, FOUNDATION_4,
  type AnalysisUnitReading, type AnalysisUnitMeta,
} from "./analysisUnit";
import {
  ACCEPTANCE_SCENARIO_CLASSIFICATION,
  loadAcceptanceScenario, scenarioReadingsInOrder, terminalProjection,
  type ProjectionSection, type TerminalName,
} from "./acceptanceScenario";
import {
  ACTION, AUTHORITY_DECISION, COMMITMENT, CONSENT_RECORD, EFFECT, LEARNING,
  MATCH, NEED, OPM_REGISTRY, STATE_T1, contradictoryEvidence, dayClosing, flowNodes,
  effectEvidence, eventState, matchPermitted, operationalProjection, sourceEvidence,
} from "./operationalSlice";
import { unitGap } from "./acceptanceScenario";
import { COLOR, COLOR_ROLE, FS, RADIUS, SPACE, STATUS, TYPE } from "../shell/designTokens";
import { T, UnitRow } from "./analysisUnitSections";

/**
 * ONE TYPE SCALE for this band, and nothing here reads below it.
 *
 * The previous pass failed visual acceptance for density, not for data: the
 * same facts were correct and unreadable. These are floors, not suggestions —
 * body never drops below 16, and English status words never outrank the
 * Hebrew they annotate.
 */

const READ = T.body;

/** Human status words. Hebrew leads; the English key is metadata, not a label. */

/**
 * ONE SURFACE AT A TIME, with no client state.
 *
 * Each lens is hidden until it is the `:target`. Only one element can be the
 * document target, so the "exactly one coloured surface" rule is enforced by
 * the browser rather than by a flag this component would have to hold, and it
 * survives a reload and a shared link.
 */
const LENS_CSS = `
[data-lens]{display:none}
[data-lens]:target{display:block}
`;

/** Status → label and tone. `unknown` is drawn as absence, never as a zero. */

/**
 * ONE UNIT, as a card a person can read.
 *
 * This replaced a narrow cell that showed a Hebrew name over a large English
 * status word — which made the annotation louder than the thing annotated,
 * and made ten of them read as a debug table. Hebrew leads, the status is a
 * Hebrew word, and the English key survives only inside Audit.
 *
 * Closed, the card answers "what do we know here?" in one sentence. Open, it
 * gives the source and the collection step. A unit with nothing known says so
 * in words and names what would fix it — never a bare UNKNOWN.
 */
/** Outlined tag. Colour rides the border, never a filled background. */
function Tag({ children, tone = COLOR.textDim }: { children: ReactNode; tone?: string }) {
  return (
    /* Metadata floor is 13px. Nothing in this band renders below it. */
    <span style={{ fontSize: T.micro, padding: "2px 8px", borderRadius: RADIUS.sm,
      border: `1px solid ${tone}`, color: tone, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

/** Renders any list of projection sections. One renderer, three callers. */
function Sections({ sections, mark }: { sections: ProjectionSection[]; mark: string }) {
  return (
    <div data-sections={mark}
      style={{ display: "flex", flexWrap: "wrap", gap: SPACE.sm, marginTop: SPACE.sm }}>
      {sections.map((sec) => (
        <div key={sec.label} data-projection-section={sec.label}
          /* WHITE, RED and Day Closing are read top to bottom, so they get
             full width. Three narrow columns was the density complaint. */
          style={{ flex: ["day-closing", "white", "red"].includes(mark) ? "1 1 100%" : "1 1 420px",
            minInlineSize: 300, padding: "10px 14px",
            borderRadius: RADIUS.md, background: "rgba(0,0,0,0.18)",
            borderInlineStart: `3px solid ${COLOR_ROLE[sec.colorRole]}` }}>
          <div style={{ fontSize: T.card, fontWeight: 700,
            color: COLOR.text, marginBottom: 6 }}>{sec.label}</div>
          {sec.rows.map((row) => (
            <div key={row.k + row.v} style={{ display: "flex", flexWrap: "wrap", gap: 6,
              alignItems: "baseline", padding: "3px 0", borderTop: `1px solid ${COLOR.border}` }}>
              <span style={{ fontSize: T.meta, color: COLOR.textDim, minInlineSize: 120 }}>{row.k}</span>
              <span style={{ fontSize: T.body, color: COLOR.text, flex: "1 1 260px",
                lineHeight: T.lh }}>{row.v}</span>
              {/* Status is metadata: quiet, small, and never louder than the
                  sentence it qualifies. */}
              {row.status ? (
                <span style={{ fontSize: T.micro, color: COLOR.textFaint, whiteSpace: "nowrap" }}>
                  {row.status}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** This terminal's reading: the evidentiary half, then the operational half. */
function Projection({ terminal }: { terminal: TerminalName }) {
  return (
    <div data-terminal-projection={terminal}>
      <Sections sections={terminalProjection(terminal)} mark="base" />
      <Sections sections={operationalProjection(terminal)} mark="operational" />
    </div>
  );
}

/** The four absences, drawn apart. Colour is a dot, never a filled block. */
const FLOW_TONE: Record<string, string> = {
  CONNECTED: "#34d399", PARTIAL: "#fbbf24", BLOCKED: "#f2635c",
  STRUCTURAL_GAP: "#fc8a84", NO_RECORD: "#8798b8",
  MISSING_DATA: "#8798b8", UNLINKED: "#fb923c", UNRESOLVED: "#8798b8",
};

/**
 * THE WHOLE CHAIN, once, as navigation.
 *
 * A node links to the terminal that OWNS its object, so the diagram doubles
 * as the map of where each question is answered. An arrow is drawn only
 * where `previousRef` names an actual predecessor — a node with no ref gets
 * no causal line, because a line the data cannot justify is an invented
 * claim about cause.
 */
function FlowMap({ variant }: { variant: "full" | "summary" | "link" }) {
  const nodes = flowNodes();

  /* THE MAP IS DRAWN ONCE. Twenty-one nodes repeated on all seven terminals
     was the same picture seven times, and it pushed every terminal's own work
     below the fold. Dynamics owns the chain, so Dynamics draws it; Hub shows
     where the chain currently stands; the rest link. One selector throughout —
     no data is removed, only the number of times it is painted. */
  if (variant !== "full") {
    const open = nodes.filter((n) => n.state !== "CONNECTED");
    const stage = nodes.find((n) => n.state !== "CONNECTED") ?? nodes[nodes.length - 1]!;
    return (
      <a data-flow-map data-flow-variant={variant} href="/dynamics#flow" dir="rtl"
        style={{ display: "block", background: COLOR.bgRaised,
          border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.lg,
          padding: `${SPACE.sm}px ${SPACE.md}px`, margin: "10px 0", textDecoration: "none" }}>
        <div style={{ fontSize: T.card, color: COLOR.text, fontWeight: 700 }}>
          הזרימה המלאה — {nodes.length} שלבים
        </div>
        {variant === "summary" ? (
          <div style={{ fontSize: T.body, color: COLOR.textDim, marginTop: 4, lineHeight: T.lh }}>
            השלב הפתוח הנוכחי: {stage.label} · {stage.note} — {open.length} שלבים לא סגורים.
          </div>
        ) : null}
        <div style={{ fontSize: T.meta, color: COLOR_ROLE.yellow, marginTop: 4 }}>
          הצג את המפה המלאה ב-Dynamics ←
        </div>
      </a>
    );
  }

  return (
    <section id="flow" data-flow-map dir="rtl"
      style={{ background: COLOR.bgRaised, border: `1px solid ${COLOR.border}`,
        borderRadius: RADIUS.lg, padding: `${SPACE.md}px ${SPACE.lg}px`, margin: "12px 0",
        scrollMarginBlockStart: 24 }}>
      <div style={{ fontSize: T.section, color: COLOR.text, fontWeight: 700, marginBottom: 10 }}>
        הזרימה המלאה — מאות חיצוני עד לולאות פתוחות
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {nodes.map((nd) => (
          <a key={nd.key} data-flow-node={nd.key} data-flow-state={nd.state} href={nd.href}
            /* Three per row at 1280, not five. At 240px the labels broke
               across three lines and the map read as noise. */
            style={{ flex: "1 1 360px", minInlineSize: 330, padding: "11px 14px",
              borderRadius: RADIUS.sm, background: "rgba(0,0,0,0.2)", textDecoration: "none",
              borderInlineStart: `3px solid ${FLOW_TONE[nd.state]}` }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: T.card, color: COLOR.text, fontWeight: 700,
                whiteSpace: "nowrap" }}>{nd.label}</span>
              <span style={{ marginInlineStart: "auto", fontSize: T.micro,
                color: FLOW_TONE[nd.state], whiteSpace: "nowrap" }}>{nd.state}</span>
            </div>
            <div style={{ fontSize: T.body, color: COLOR.textDim, marginTop: 4, lineHeight: T.lh }}>
              {nd.note}
            </div>
            <div style={{ fontSize: T.micro, color: COLOR.textFaint, marginTop: 4 }}>
              {nd.terminal}{nd.previousRef ? ` · אחרי ${nd.previousRef}` : " · נקודת פתיחה"}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

/** One coloured lens surface. Hidden until it is the document target. */
function Lens({ id, hue, title, children, anchorId, always }: {
  id: string; hue: string; title: string; children: React.ReactNode;
  /** Canonical cross-terminal anchor, on the terminal that owns this layer. */
  anchorId?: string;
  /** On its home terminal the layer is the content, not a pop-over. */
  always?: boolean;
}) {
  return (
    <section id={anchorId ?? id} data-lens={always ? undefined : id}
      data-lens-name={id} data-lens-home={always ? "true" : undefined} dir="rtl"
      style={{ background: COLOR.bgRaised, border: `1px solid ${hue}44`,
        borderInlineStart: `4px solid ${hue}`, borderRadius: RADIUS.lg,
        padding: `${SPACE.sm}px ${SPACE.md}px`, margin: "8px 0",
        scrollMarginBlockStart: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: SPACE.sm, marginBottom: 6 }}>
        <span style={{ fontSize: 18, color: hue, fontWeight: 700 }}>{title}</span>
        {/* One small classification mark, not the whole scenario title again. */}
        <span style={{ fontSize: T.micro, color: STATUS.demo.text }}>סימולציה</span>
        <a href="#" style={{ marginInlineStart: "auto", fontSize: FS.meta,
          color: COLOR.textFaint, textDecoration: "none" }}>סגור ✕</a>
      </div>
      {children}
    </section>
  );
}

/** Human meaning, in full sentences, before any identifier. */
function Meaning({ rows }: { rows: readonly (readonly [string, string])[] }) {
  return (
    <div style={{ marginBottom: SPACE.sm }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ padding: "5px 0", borderTop: `1px solid ${COLOR.border}` }}>
          <div style={{ fontSize: FS.meta, color: COLOR.textDim }}>{k}</div>
          <div style={{ fontSize: READ, color: COLOR.text, lineHeight: 1.7 }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

/** Identifiers live here and nowhere else in a lens. LTR inside RTL. */
function Audit({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details style={{ marginTop: SPACE.sm }}>
      <summary style={{ cursor: "pointer", listStyle: "none", fontSize: FS.meta,
        color: COLOR.textFaint, padding: "5px 0" }}>▾ Audit — {title}</summary>
      <div dir="ltr" style={{ marginTop: 4, textAlign: "left", wordBreak: "break-all" }}>
        {children}
      </div>
    </details>
  );
}

/**
 * The chain, one row per stage: state, whether it is linked to the stage
 * before it, who is authorised, what is missing, and the next action.
 *
 * Stages after Match are OMITTED ENTIRELY when the match is not permitted —
 * not greyed out, not shown as blocked, absent. Showing an Action beside an
 * unpermitted Match is the contradiction this whole pass removed.
 */
function chainStages(): ProjectionSection["rows"] {
  const permitted = matchPermitted();
  const rows: ProjectionSection["rows"] = [
    { k: "צורך", v: `${NEED.desired_change} · מחובר ל-${NEED.derived_from} · מוסמך: המערכת · חסר: —`,
      status: NEED.state },
    { k: "הסכמה", v: `${CONSENT_RECORD.grants} · מוסמך: המשתמש · חסר: —`, status: "RECORDED" },
    { k: "אישור סמכות", v: `${AUTHORITY_DECISION.approves} · מוסמך: ${AUTHORITY_DECISION.decided_by} · חסר: —`,
      status: AUTHORITY_DECISION.decision },
    { k: "התאמה", v: `${MATCH.because} · מחובר לצורך ולהצעה · חסר: —`, status: MATCH.decision },
  ];
  if (!permitted) {
    rows.push({ k: "הבא", v: "אין התאמה מאושרת — לא נוצרים התחייבות, פעולה, אפקט או למידה.",
      status: "BLOCKED" });
    return rows;
  }
  rows.push(
    { k: "התחייבות", v: `מחובר להתאמה · מוסמך: ${COMMITMENT!.authorized_by} · חסר: —`,
      status: COMMITMENT!.state },
    { k: "פעולה", v: `${ACTION!.reality} · מחובר להתחייבות · מוסמך: ${ACTION!.authority_ref}`,
      status: `${ACTION!.state} · ${ACTION!.executionScope}` },
    { k: "אפקט", v: `${EFFECT!.claimed_outcome} · מחובר לפעולה · ${EFFECT!.does_not_establish}`,
      status: EFFECT!.scope },
    { k: "ראיות", v: effectEvidence().map((e) => e.meaning).join(" "), status: "VERIFIED" },
    { k: "למידה", v: `${LEARNING!.statement} · אינו כולל: ${LEARNING!.excludes.join(" · ")}`,
      status: "DERIVED" },
    { k: "מצב t1", v: STATE_T1.facts.join(" "), status: "ADDED" },
    { k: "סגירת יום", v: "סיכום מלא זמין ב-Hub וב-Dynamics.", status: eventState() },
    { k: "הפעולה הבאה", v: "המתנה לממצאי הבדיקה העצמאית. הטענות נותרות UNDER_REVIEW.",
      status: "PENDING" },
  );
  return rows;
}

export default function PersonEventOrientationHeader({ terminal, legacy }: {
  terminal: TerminalName;
  /** Content `SystemShell`'s `dense` mode dropped on this terminal. Folded
   *  below rather than removed — no information is deleted to stop a
   *  duplicate, only demoted beneath the authority that replaced it. */
  legacy?: ReactNode;
}) {
  const s = loadAcceptanceScenario();
  const readings = Object.fromEntries(scenarioReadingsInOrder().map((r) => [r.unitId, r]));

  return (
    <>
    <section dir="rtl"
      data-acceptance-surface={ACCEPTANCE_SCENARIO_CLASSIFICATION}
      data-person-event-header={terminal}
      data-scenario-event-id={s.event.event_id}
      data-scenario-observation-id={s.observation.observation_id}
      data-conflict-of-interest={String(s.conflictOfInterest)}
      style={{ background: COLOR.bgRaised, border: `1px solid ${COLOR.border}`,
        borderRadius: RADIUS.lg, padding: `${SPACE.sm}px ${SPACE.md}px`, margin: "8px 0" }}
    >
      {/* ── ORIENTATION HERO ─────────────────────────────────────────────
          What replaced the chip wall. A reader's first question is what
          happened and what it means, and that was previously answerable only
          by decoding a row of uppercase tags. Four figures, one sentence, and
          the identifiers moved out of the fold entirely. */}
      <div data-person-band style={{ borderInlineStart: `4px solid ${COLOR_ROLE.purple}`,
        paddingInlineStart: SPACE.md }}>
        <h2 style={{ fontSize: T.section, lineHeight: 1.3, color: COLOR.text,
          fontWeight: 700, margin: 0 }}>
          אירוע ציבורי בבדיקה
        </h2>
        <p style={{ fontSize: T.body, lineHeight: T.lh, color: COLOR.textDim,
          margin: "6px 0 0", maxWidth: "62ch" }}>
          טענה נגד אדם בעל כוח וטענה מערכתית נפרדת נגד מנגנוני אכיפה.
        </p>

        {/* FOUR FIGURES, large enough to read at a glance. */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.lg, margin: "14px 0 0" }}>
          {([["מצב", s.event.state], ["טענות", String(s.claims.length)],
             ["ראיות מקור", String(s.evidence.length)],
             ["לולאות פתוחות", String(s.openLoops.length)]] as const).map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: T.hero, lineHeight: 1.1, color: COLOR.text,
                fontWeight: 700 }}>{v}</div>
              <div style={{ fontSize: T.meta, color: COLOR.textDim, marginTop: 2 }}>{k}</div>
            </div>
          ))}
        </div>

        {/* Three standing conditions, as sentences rather than tags. */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.md, marginTop: 12,
          fontSize: T.meta, color: COLOR.textDim }}>
          <span style={{ color: STATUS.demo.text }}>{s.classification}</span>
          <span style={{ color: "#fc8a84" }}>הצופה הוא מושא הטענה — אימות עצמי חסום</span>
          <span>בדיקה עצמאית נדרשת</span>
        </div>
      </div>

      {/* WHITE — reference status, as one quiet line rather than eight chips. */}
      <div data-white-band style={{ marginTop: 14, paddingInlineStart: SPACE.md,
        borderInlineStart: `4px solid ${COLOR_ROLE.white}` }}>
        <div style={{ fontSize: T.card, color: COLOR.text, fontWeight: 600 }}>
          מקור: {s.white.primary_source}
        </div>
        <div style={{ fontSize: T.meta, color: COLOR.textDim, marginTop: 3, lineHeight: T.lh }}>
          ראיות מקור {s.evidence.length} · מאומת {s.white.evidence_verified} ·
          לא מאומת {s.white.evidence_unverified} · שתי הטענות תחת בדיקה · ביטחון לא ידוע.
          פס הראיות מדווח על המקור, לא על מצבו של אדם.
        </div>
      </div>

      {/* ── TIER 3 · THE ACTIVE LENS ────────────────────────────────────
          A person who clicks GREEN, WHITE or RED must land on what they
          chose. Day Closing and the flow map were rendered first, which put
          a targeted lens at scrollY 1075–4686 — the anchor resolved, and the
          reader still saw the previous screen. The lens now sits directly
          under the Hero, and the two long summaries moved below it. */}
      {/* ── THE THREE LENSES ──────────────────────────────────────────── */}
      <style dangerouslySetInnerHTML={{ __html: LENS_CSS }} />

      {/* GREEN — the social system. FOUR LENSES, ONE SURFACE. */}
      <Lens id="lens-green" hue={COLOR_ROLE.green} title="מערכת חברתית">
        {[
          { t: "Community — קבוצות ואנשים", rows: terminalProjection("community") },
          { t: "Globe — קשרים ורשתות", rows: terminalProjection("planet") },
          { t: "World — מוסדות ומערכת", rows: terminalProjection("world") },
        ].map((g) => (
          <div key={g.t} data-green-lens={g.t} style={{ marginBottom: SPACE.md }}>
            <div style={{ fontSize: READ, color: COLOR_ROLE.green, fontWeight: 700,
              marginBottom: 4 }}>{g.t}</div>
            <Sections sections={g.rows} mark="green" />
          </div>
        ))}
        <div data-green-lens="Social — השפעה חברתית" style={{ marginBottom: SPACE.md }}>
          <div style={{ fontSize: READ, color: COLOR_ROLE.green, fontWeight: 700, marginBottom: 4 }}>
            Social — השפעה חברתית
          </div>
          <Sections sections={[{ label: "השפעה חברתית", colorRole: "green", rows: [
            { k: "היקף ההפצה", v: unitGap("social").missingReason, status: "UNKNOWN" },
            { k: "כדי להשלים", v: unitGap("social").collectionAction, status: "COLLECT" },
            { k: "קהילה מקושרת", v: "אין קבוצת ערך מקושרת לאירוע", status: "UNRESOLVED" },
          ]}]} mark="green-social" />
        </div>
      </Lens>

      {/* WHITE — source and evidence. Meaning first; ids live in Audit. */}
      <Lens id="lens-white" hue={COLOR_ROLE.white} title="מקור וראיות"
        anchorId={terminal === "brain" ? "evidence" : undefined}
        always={terminal === "brain"}>
        <Meaning rows={[
          ["האות החיצוני", s.observation.source],
          ["האירוע", s.event.title],
          ["מה נצפה", s.observation.original_text],
          ["טענה א׳", s.claims[0]!.statement],
          ["טענה ב׳", s.claims[1]!.statement],
        ]} />
        <Sections mark="white" sections={[
          { label: "ראיות על המקור", colorRole: "white",
            rows: sourceEvidence().map((e) => ({ k: e.verification, v: e.meaning,
              status: e.relation })) },
          { label: "ראיות על פעולת המערכת", colorRole: "green",
            rows: effectEvidence().map((e) => ({ k: e.verification, v: e.meaning,
              status: "לא נוגע לטענות" })) },
          { label: "ראיה סותרת", colorRole: "orange",
            rows: contradictoryEvidence().map((e) => ({ k: e.verification, v: e.meaning,
              status: "סותר" })) },
          { label: "מה חסר", colorRole: "white",
            rows: s.white.missing.map((m) => ({ k: "חסר", v: m, status: "MISSING" })) },
          { label: "מקור ומצב בדיקה", colorRole: "white", rows: [
            { k: "provenance", v: s.observation.provenance, status: "DEMO" },
            { k: "review status", v: "שתי הטענות תחת בדיקה", status: s.observation.review_status },
            { k: "ביטחון", v: "אין שיטת חישוב — לא מוצג מספר", status: "UNKNOWN" },
          ]},
        ]} />
        <Audit title="מזהים">
          {[s.event.event_id, s.observation.observation_id,
            ...s.claims.map((c) => c.claim_id),
            ...sourceEvidence().map((e) => e.evidence_id),
            ...effectEvidence().map((e) => e.evidence_id)].map((id) => (
            <code key={id} style={{ display: "block", fontSize: FS.meta, color: "#9fd0ff" }}>{id}</code>
          ))}
        </Audit>
      </Lens>

      {/* RED — the operational chain. Never shows an Action without a
          PERMITTED Match, and never colours a Claim. */}
      <Lens id="lens-red" hue={COLOR_ROLE.red} title="פעולה וביצוע"
        anchorId={terminal === "dynamics" ? "action-layer" : undefined}
        always={terminal === "dynamics"}>
        <Sections mark="red" sections={[{ label: "השרשרת התפעולית", colorRole: "red",
          rows: chainStages() }]} />
        <Audit title="מזהי שרשרת">
          {[NEED.need_id, CONSENT_RECORD.consent_id, AUTHORITY_DECISION.decision_id,
            MATCH.match_id, COMMITMENT?.commitment_id, ACTION?.action_id,
            EFFECT?.effect_id, LEARNING?.learning_id, STATE_T1.state_id]
            .filter(Boolean).map((id) => (
            <code key={id} style={{ display: "block", fontSize: FS.meta, color: "#9fd0ff" }}>{id}</code>
          ))}
        </Audit>
      </Lens>



      {/* ── TIER 4 · this terminal's own projection ─────────────────── */}
        <Projection terminal={terminal} />

      {/* ── 5+6 · THE TEN, AS TWO CLEAR ROWS ───────────────────────────── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.sm, alignItems: "center", marginTop: 7 }}>
        <span style={{ ...TYPE.micro, fontSize: FS.tag, letterSpacing: 1.2, color: COLOR.textDim }}>
          יחידות ניתוח
        </span>
        <Tag tone={STATUS.demo.text}>MODEL_STATUS: {s.model_status}</Tag>
        <span style={{ fontSize: FS.tag, color: COLOR.textFaint }}>4 יסוד + 6 ניגוד = 10</span>
      </div>
      <UnitRow group="FOUNDATION" title="משתני יסוד" note="4" units={FOUNDATION_4} readings={readings} />
      <UnitRow group="DEPARTMENTS" title="מחלקות ניגוד" note="6" units={DEPARTMENTS_6} readings={readings} />

      {/* ── TIER 6 · route-specific deep content ────────────────────── */}
      {/* ── DAY CLOSING — VISIBLE, addressable, never inside a closed
          disclosure. `#day-closing` must land on something a reader can
          see; a details that happens to be shut makes the anchor a lie. ── */}
      {terminal === "hub" || terminal === "dynamics" ? (
        <section
          id="day-closing"
          data-day-closing
          dir="rtl"
          style={{ background: COLOR.bgRaised, border: `1px solid ${COLOR_ROLE.white}33`,
            borderRadius: RADIUS.lg, padding: `${SPACE.sm}px ${SPACE.md}px`, margin: "8px 0",
            scrollMarginBlockStart: 24 }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.sm, alignItems: "center" }}>
            <span style={{ ...TYPE.micro, fontSize: FS.tag, letterSpacing: 1.2,
              color: COLOR_ROLE.white }}>סגירת יום · אירוע הקבלה</span>
            <Tag tone={STATUS.demo.text}>{s.classification}</Tag>
            <Tag tone={COLOR_ROLE.yellow}>{eventState()}</Tag>
          </div>
          <Sections sections={dayClosing()} mark="day-closing" />
        </section>
      ) : null}


      <FlowMap variant={terminal === "dynamics" ? "full"
        : terminal === "hub" ? "summary" : "link"} />

      {/* ── EXPANDED ───────────────────────────────────────────────────── */}
      <details data-header-expand style={{ marginTop: 6 }}>
        <summary style={{ cursor: "pointer", listStyle: "none", fontSize: FS.meta,
          color: COLOR.textDim, padding: "5px 0" }}>
          ▾ פירוט — קריאות, טענות, ראיות ולולאות פתוחות
        </summary>

        {/* The unit detail moved INTO each card, where a reader opens the
            one unit they are asking about instead of a second grid of ten. */}

        {/* Claims — status always attached, never red. */}
        {s.claims.map((c) => (
          <div key={c.claim_id} data-claim={c.claim_id}
            style={{ padding: "5px 0", borderTop: `1px solid ${COLOR.border}`, marginTop: 4 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "baseline" }}>
              <code dir="ltr" style={{ fontSize: FS.tag, color: "#9fd0ff" }}>{c.claim_id}</code>
              <Tag tone={COLOR_ROLE.yellow}>{c.reported} / {c.review}</Tag>
            </div>
            <div style={{ fontSize: FS.read, color: COLOR.text, marginTop: 3, lineHeight: 1.65 }}>
              {c.statement}
            </div>
          </div>
        ))}

        {/* Evidence — two independent axes, two tags. */}
        {s.evidence.map((e) => (
          <div key={e.evidence_id} data-evidence={e.evidence_id}
            style={{ padding: "5px 0", borderTop: `1px solid ${COLOR.border}` }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "baseline" }}>
              <code dir="ltr" style={{ fontSize: FS.tag, color: "#9fd0ff" }}>{e.evidence_id}</code>
              <Tag tone={e.verification === "VERIFIED" ? "#34d399" : STATUS.unknown.text}>
                {e.verification}
              </Tag>
              <Tag tone={e.relation === "contradicting" ? "#fc8a84" : COLOR.textDim}>{e.relation}</Tag>
            </div>
            <div style={{ fontSize: FS.meta, color: COLOR.text, marginTop: 3, lineHeight: 1.6 }}>
              {e.description} — {e.establishes}
            </div>
          </div>
        ))}

        <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.md, marginTop: SPACE.sm }}>
          {([["ידוע", s.white.known], ["חסר", s.white.missing],
             ["סותר", s.white.contradictory], ["לולאות פתוחות", s.openLoops]] as const).map(([t, items]) => (
            <div key={t} style={{ flex: "1 1 200px" }}>
              <div style={{ ...TYPE.micro, fontSize: FS.tag, color: COLOR.textDim, marginBottom: 2 }}>{t}</div>
              <ul style={{ margin: 0, paddingInlineStart: 16, fontSize: FS.meta,
                color: COLOR.textDim, lineHeight: 1.75 }}>
                {items.map((i) => <li key={i}>{i}</li>)}
              </ul>
            </div>
          ))}
        </div>


        {/* ── OPM MAP — object → id → state → writer → reader → consumers ─ */}
        <details data-opm-map style={{ marginTop: SPACE.sm }}>
          <summary style={{ cursor: "pointer", listStyle: "none", fontSize: FS.meta,
            color: COLOR.textFaint, padding: "5px 0" }}>
            ▾ מפת OPM — {OPM_REGISTRY.length} אובייקטים
          </summary>
          <div style={{ overflowX: "auto", marginTop: 4 }}>
            <table style={{ borderCollapse: "collapse", fontSize: FS.tag, width: "100%" }}>
              <thead>
                <tr style={{ color: COLOR.textDim, textAlign: "right" }}>
                  {["Object", "ID", "State", "Writer", "Reader", "Consumers", "Status"].map((h) => (
                    <th key={h} style={{ padding: "3px 6px", borderBottom: `1px solid ${COLOR.border}`,
                      fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {OPM_REGISTRY.map((o) => (
                  <tr key={o.object} data-opm-object={o.object} style={{ color: COLOR.textDim }}>
                    <td style={{ padding: "3px 6px", color: COLOR.text, whiteSpace: "nowrap" }}>{o.object}</td>
                    <td dir="ltr" style={{ padding: "3px 6px", color: "#9fd0ff", wordBreak: "break-all",
                      maxWidth: 220, textAlign: "right" }}>{o.id}</td>
                    <td style={{ padding: "3px 6px" }}>{o.state}</td>
                    <td dir="ltr" style={{ padding: "3px 6px", textAlign: "right" }}>{o.writer}</td>
                    <td dir="ltr" style={{ padding: "3px 6px", textAlign: "right" }}>{o.reader}</td>
                    <td style={{ padding: "3px 6px" }}>{o.consumers.join(", ")}</td>
                    <td style={{ padding: "3px 6px", color: o.status === "GAP" ? "#fc8a84" : COLOR.textFaint }}>
                      {o.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        {/* Whatever `dense` dropped from SystemShell on this terminal. */}
        {legacy ? (
          <details data-legacy-frame style={{ marginTop: SPACE.sm }}>
            <summary style={{ cursor: "pointer", listStyle: "none", fontSize: FS.meta,
              color: COLOR.textFaint, padding: "4px 0" }}>
              ▾ מסגרת קודמת — נשמרה, הועברה למטה
            </summary>
            <div style={{ marginTop: 4 }}>{legacy}</div>
          </details>
        ) : null}
      </details>
    </section>

      {/* ── THE BOUNDARY. Everything below this line on the page is the
          terminal's own REAL/legacy material. It predates this scenario, it
          is kept, and it is NOT part of the acceptance event — no group, sum,
          location or observation below belongs to this EVENT_ID. ────────── */}
      <div data-real-legacy-boundary dir="rtl"
        style={{ display: "flex", flexWrap: "wrap", gap: SPACE.sm, alignItems: "center",
          margin: "10px 0 4px", padding: "5px 10px", borderRadius: RADIUS.sm,
          borderInlineStart: `3px solid ${STATUS.real.border}`, background: STATUS.real.bg }}>
        <span style={{ ...TYPE.micro, fontSize: FS.tag, letterSpacing: 1.2, color: STATUS.real.text }}>
          REAL LEGACY CONTEXT
        </span>
        <span style={{ fontSize: FS.meta, color: COLOR.text }}>
          כל מה שמתחת שייך למסוף עצמו — אינו חלק מאירוע הקבלה.
        </span>
        <span style={{ marginInlineStart: "auto", fontSize: FS.tag, color: COLOR.textFaint }}>
          אין לקשר קבוצה, סכום, מיקום או תצפית מכאן ל-{s.event.event_id}
        </span>
      </div>
    </>
  );
}
