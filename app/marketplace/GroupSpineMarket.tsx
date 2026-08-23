/**
 * MARKETPLACE ↔ GROUP SPINE — the canonical group needs and resources, and
 * the candidate matches derived between them.
 *
 * Marketplace previously showed only the PERSONAL canon slice (1 need, 1
 * offer, 1 action). Group-scale needs and resources had no channel at all, so
 * the market had nothing to match across groups. It does now, and this panel
 * reads the same projection Community reads — no second model, no second
 * derivation of "what is available".
 *
 * THE THREE STATES ARE DRAWN AS THREE THINGS. A candidate is a proposal the
 * system computed and labels DERIVED; an accepted match is a decision a person
 * recorded; an action is work that started. The panel never renders a
 * candidate in the same lane as an action, because reading one as the other is
 * how a system starts reporting activity it merely inferred.
 */
import { COLOR, FS, RADIUS, SPACE } from "@/app/lib/philos/shell/designTokens";
import { ENTITY, STATE, entityPath } from "@/app/lib/philos/shell/visualGrammar";
import type { NeedState, ResourceState, MatchState, ActionState } from "@/app/lib/philos/community/groupOperationalState";
import type { CandidateMatch } from "@/app/lib/philos/community/needResourceBridge";

export interface SpineMarketInput {
  needs: NeedState[];
  resources: ResourceState[];
  candidates: CandidateMatch[];
  accepted: MatchState[];
  actions: ActionState[];
  /** Groups that have ANY operational event. Distinguishes "no group has
   *  declared anything" from "the channel does not exist". */
  groupsWithEvents: number;
  totalGroups: number;
}

/**
 * THE FLOW — five stages with the transitions drawn between them.
 *
 * Five separate cards with five zeros was the defect: nothing on screen said
 * that a need becomes a match becomes an action, so the reader saw five
 * unrelated counters rather than one pipeline that has not started. The shapes
 * come from the shared grammar — a need points up because it asks, a resource
 * points down because it offers, and they converge on the match that pairs
 * them.
 *
 * A CONNECTOR ENCODES WHETHER ANYTHING CROSSED IT. A solid link means objects
 * actually moved from this stage to the next; a dotted link means the stage
 * ahead is empty and nothing has crossed. The reader can see where the
 * pipeline stops without reading a single number.
 */
const STAGE_W = 108, STAGE_H = 74, GAP = 46, FLOW_H = 168;

interface Stage {
  key: string;
  entity: Parameters<typeof entityPath>[0];
  label: string;
  term: string;
  count: number;
  note: string;
  derived?: boolean;
}

function Flow({ stages, rtl = true }: { stages: Stage[]; rtl?: boolean }) {
  const W = stages.length * STAGE_W + (stages.length - 1) * GAP + 24;
  // RTL flow: first stage on the right, coordinates stay LTR so text-anchor
  // does not mirror — the same fix the causal chain already carries.
  const xOf = (i: number) => rtl
    ? W - 12 - STAGE_W - i * (STAGE_W + GAP)
    : 12 + i * (STAGE_W + GAP);
  const cy = 62;

  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${FLOW_H}`} width="100%" role="group"
        aria-label={`זרימת השוק: ${stages.map((s) => `${s.label} ${s.count}`).join(" ואז ")}`}
        style={{ direction: "ltr", display: "block", minWidth: 520,
          background: COLOR.bg, borderRadius: RADIUS.md, border: `0.5px solid ${COLOR.border}` }}>
        {stages.slice(0, -1).map((s, i) => {
          const next = stages[i + 1];
          const crossed = s.count > 0 && next.count > 0;
          const x1 = rtl ? xOf(i) : xOf(i) + STAGE_W;
          const x2 = rtl ? xOf(i + 1) + STAGE_W : xOf(i + 1);
          const dir = rtl ? -1 : 1;
          return (
            <g key={`link-${s.key}`}>
              <line x1={x1} y1={cy} x2={x2} y2={cy}
                stroke={crossed ? "#4ade80" : "rgba(120,150,220,0.3)"} strokeWidth={crossed ? 1.5 : 1}
                strokeDasharray={crossed ? undefined : "2 4"} strokeLinecap="round" />
              {crossed ? (
                <path d={`M ${x2 - dir * 7} ${cy - 4} L ${x2} ${cy} L ${x2 - dir * 7} ${cy + 4}`}
                  fill="none" stroke="#4ade80" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              ) : null}
            </g>
          );
        })}
        {stages.map((s, i) => {
          const x = xOf(i) + STAGE_W / 2;
          const on = s.count > 0;
          const hue = s.derived ? STATE.DERIVED.hue : on ? STATE.REAL.hue : COLOR.textFaint;
          const dash = s.derived ? STATE.DERIVED.dash : on ? undefined : STATE.NO_EVENTS.dash;
          return (
            <g key={s.key}>
              <path d={entityPath(s.entity, 20)} transform={`translate(${x} ${cy})`}
                fill={on ? "rgba(49,131,212,0.16)" : "transparent"}
                stroke={hue} strokeDasharray={dash} strokeWidth={1} />
              <text x={x} y={cy + 5} textAnchor="middle" fontSize={14} fill={on ? COLOR.text : COLOR.textFaint}
                style={{ fontVariantNumeric: "tabular-nums" }}>{s.count}</text>
              <text x={x} y={cy + 40} textAnchor="middle" fontSize={12} fill={COLOR.text}>{s.label}</text>
              <text x={x} y={cy + 54} textAnchor="middle" fontSize={12} fill={COLOR.textFaint}>{s.term}</text>
              <text x={x} y={cy + 74} textAnchor="middle" fontSize={12} fill={s.derived ? STATE.DERIVED.hue : COLOR.textFaint}>
                {s.derived ? STATE.DERIVED.tag : on ? "" : STATE.NO_EVENTS.tag}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function GroupSpineMarket({ input }: { input: SpineMarketInput }) {
  const open = input.needs.filter((n) => n.status === "OPEN");
  const available = input.resources.filter((r) => r.status === "AVAILABLE");
  const crossGroup = input.candidates.filter((c) => c.cross_group);

  return (
    <section dir="rtl" style={{ margin: `${SPACE.md}px 0 0`, padding: SPACE.lg,
      background: COLOR.bgRaised, border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.lg }}>
      <h3 style={{ fontSize: FS.head, fontWeight: 650, margin: 0, color: COLOR.text }}>
        שוק ברמת הקבוצה — מהשדרה התפעולית
      </h3>
      <p style={{ fontSize: FS.meta, color: COLOR.textDim, margin: `${SPACE.xs}px 0 ${SPACE.md}px`, maxWidth: "70ch" }}>
        {input.groupsWithEvents === 0
          ? `ערוץ הצורך/המשאב קיים ופתוח לקליטה, ואף אחת מ-${input.totalGroups} הקבוצות עדיין לא הצהירה דבר. זה אפס נמדד, לא ערוץ חסר.`
          : `${input.groupsWithEvents} מתוך ${input.totalGroups} קבוצות רשמו פעילות תפעולית.`}
      </p>

      <Flow stages={[
        { key: "need", entity: "NEED", label: "צורך", term: "NEED", count: open.length,
          note: `${input.needs.length} סה"כ` },
        { key: "resource", entity: "RESOURCE", label: "משאב", term: "RESOURCE", count: available.length,
          note: `${input.resources.length} סה"כ` },
        { key: "candidate", entity: "MATCH", label: "מועמדת", term: "CANDIDATE", count: input.candidates.length,
          note: `${crossGroup.length} בין-קבוצתיות`, derived: true },
        { key: "accepted", entity: "MATCH", label: "אושרה", term: "ACCEPTED", count: input.accepted.length,
          note: "החלטה של אדם" },
        { key: "action", entity: "ACTION", label: "פעולה", term: "ACTION", count: input.actions.length,
          note: "עבודה שהתחילה" },
      ]} />

      {/* The three separations the flow must never collapse, said in words
          beneath the drawing that keeps them apart. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.lg, marginTop: SPACE.sm,
        fontSize: FS.meta, color: COLOR.textFaint }}>
        <span>▲ צורך מבקש · ▼ משאב מציע</span>
        <span style={{ color: STATE.DERIVED.hue }}>מועמדת = נגזרת, לא הסכמה</span>
        <span>אושרה = החלטת אדם · פעולה = ביצוע</span>
        <span>קו רציף = משהו עבר · קו מקווקו = השלב הבא ריק</span>
      </div>

      {input.candidates.length > 0 ? (
        <div style={{ marginTop: SPACE.md }}>
          <div style={{ fontSize: FS.section, color: COLOR.text, marginBottom: SPACE.sm }}>
            מועמדות להתאמה — נגזרו משדות מתועדים
          </div>
          {input.candidates.slice(0, 12).map((c) => (
            <div key={c.match_id} style={{ display: "flex", flexWrap: "wrap", gap: SPACE.md, alignItems: "baseline",
              padding: "6px 0", borderTop: `1px solid ${COLOR.border}`, fontSize: FS.base }}>
              <span style={{ color: COLOR.text }}>{c.need_ref}</span>
              <span style={{ color: COLOR.textFaint }}>↔</span>
              <span style={{ color: COLOR.text }}>{c.resource_ref}</span>
              {c.cross_group ? (
                <span style={{ fontSize: FS.tag, padding: "2px 7px", borderRadius: RADIUS.sm,
                  border: `1px solid ${COLOR.borderStrong}`, color: COLOR.textDim }}>
                  {c.need_group_id} ← {c.resource_group_id}
                </span>
              ) : null}
              <span style={{ fontSize: FS.meta, color: COLOR.textDim }}>{c.basis}</span>
              <span style={{ marginInlineStart: "auto", fontSize: FS.tag, color: "#f0b45c" }}>DERIVED · טעונה החלטה</span>
            </div>
          ))}
          {input.candidates.length > 12 ? (
            <div style={{ fontSize: FS.meta, color: COLOR.textFaint, marginTop: 4 }}>
              ועוד {input.candidates.length - 12}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
