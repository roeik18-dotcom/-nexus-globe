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
 *
 * REQUEST → PENDING → APPROVE/REJECT. Three lanes, from three sources this
 * panel does not re-derive:
 *
 *   `input.candidates`      DERIVED pairs with NO recorded request. Each gets
 *                           a real `requestMatchApprovalAction` form.
 *   `input.pendingRequests` recorded `MATCH_PROPOSED`, undecided. Status
 *                           badge, plus Approve/Reject forms for a viewer who
 *                           is a REAL appointed leader of that group.
 *   `input.rejectedRequests` recorded `MATCH_REJECTED`. Terminal, listed.
 *
 * All three arrive as props from `page.tsx`, which reads them off the one
 * operational projection every terminal shares. This file computes no fourth
 * view of "what is available".
 *
 * THE BUTTON IS NOT THE GATE. Approve/Reject render only when
 * `resolveGroupLeadership` reports `source === "REAL"` and the viewer is in
 * that leader set — but `decideMatchRequestCore` re-derives the group and
 * re-checks REAL leadership server-side on every submit regardless. Hiding
 * the control is a courtesy so a viewer is not offered an action that will
 * be refused; it is not what makes the action safe.
 *
 * ACCEPTED IS A DECISION, NOT WORK. An approved match moves to the ACCEPTED
 * lane and stays there. Nothing in this panel writes, implies, or renders an
 * ACTION as a consequence of approval — the `action` stage keeps its own
 * count from its own events, and reads 0 until real Action events exist.
 */
import type { CSSProperties } from "react";

import { COLOR, FS, RADIUS, SPACE } from "@/app/lib/philos/shell/designTokens";
import { ENTITY, STATE, entityPath } from "@/app/lib/philos/shell/visualGrammar";
import type { NeedState, ResourceState, MatchState, ActionState } from "@/app/lib/philos/community/groupOperationalState";
import type { CandidateMatch } from "@/app/lib/philos/community/needResourceBridge";
import { resolveViewerContext } from "@/app/lib/philos/identity/viewerContext";
import { resolveGroupLeadership } from "@/app/lib/philos/community/groupAuthority";
import { requestMatchApprovalAction, decideMatchRequestAction } from "@/app/lib/philos/community/matchRequestAction";
import MatchRequestButton from "./MatchRequestButton";

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
  /** Real `MATCH_PROPOSED`, no decision yet. */
  pendingRequests: MatchState[];
  /** Real `MATCH_REJECTED`. */
  rejectedRequests: MatchState[];
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

/** One row's shared layout. Keeps the three lanes visually parallel. */
const ROW: CSSProperties = {
  display: "flex", flexWrap: "wrap", gap: SPACE.md, alignItems: "baseline",
  padding: "7px 0", borderTop: `1px solid ${COLOR.border}`, fontSize: FS.base,
};

function Pair({ need_ref, resource_ref }: { need_ref: string; resource_ref: string }) {
  return (
    <>
      <span style={{ color: COLOR.text }}>{need_ref}</span>
      <span style={{ color: COLOR.textFaint }}>↔</span>
      <span style={{ color: COLOR.text }}>{resource_ref}</span>
    </>
  );
}

export default async function GroupSpineMarket({ input }: { input: SpineMarketInput }) {
  const open = input.needs.filter((n) => n.status === "OPEN");
  const available = input.resources.filter((r) => r.status === "AVAILABLE");
  const crossGroup = input.candidates.filter((c) => c.cross_group);

  /* WHICH GROUPS MAY THIS VIEWER DECIDE FOR? Resolved once, only for the
     groups that actually have something pending, and only from REAL
     appointments — `resolveGroupLeadership` reports its source and a DEMO
     answer is not treated as authority here any more than it is server-side. */
  const viewer = await resolveViewerContext();
  const pendingGroupIds = [...new Set(input.pendingRequests.map((m) => m.group_id))];
  const decidable = new Set<string>();
  for (const gid of pendingGroupIds) {
    const { leaders, source } = await resolveGroupLeadership(gid);
    if (source === "REAL" && leaders.some((l) => l.person_id === viewer.person_id)) decidable.add(gid);
  }

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

      {/* ── LANE 1 · DERIVED CANDIDATE → request ───────────────────────── */}
      {input.candidates.length > 0 ? (
        <div style={{ marginTop: SPACE.md }} data-lane="candidates">
          <div style={{ fontSize: FS.section, color: COLOR.text, marginBottom: SPACE.sm }}>
            מועמדות להתאמה — נגזרו משדות מתועדים, טרם נתבקש אישור
          </div>
          {input.candidates.slice(0, 12).map((c) => (
            <div key={c.match_id} style={ROW}>
              <Pair need_ref={c.need_ref} resource_ref={c.resource_ref} />
              {c.cross_group ? (
                <span style={{ fontSize: FS.tag, padding: "2px 7px", borderRadius: RADIUS.sm,
                  border: `1px solid ${COLOR.borderStrong}`, color: COLOR.textDim }}>
                  {c.need_group_id} ← {c.resource_group_id}
                </span>
              ) : null}
              <span style={{ fontSize: FS.meta, color: COLOR.textDim }}>{c.basis}</span>
              <span style={{ fontSize: FS.tag, color: STATE.DERIVED.hue }}>נגזר מחישוב</span>
              {/* A real write. The action re-derives this candidate server-side
                  and refuses anything it cannot find. */}
              <span style={{ marginInlineStart: "auto" }}>
                <MatchRequestButton
                  action={requestMatchApprovalAction}
                  fields={{ need_ref: c.need_ref, resource_ref: c.resource_ref }}
                  label="בקש אישור" tone="accent" done="נרשמה בקשה"
                />
              </span>
            </div>
          ))}
          {input.candidates.length > 12 ? (
            <div style={{ fontSize: FS.meta, color: COLOR.textFaint, marginTop: 4 }}>
              ועוד {input.candidates.length - 12}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── LANE 2 · PENDING → decision ─────────────────────────────────── */}
      {input.pendingRequests.length > 0 ? (
        <div style={{ marginTop: SPACE.lg }} data-lane="pending">
          <div style={{ fontSize: FS.section, color: COLOR.text, marginBottom: SPACE.sm }}>
            בקשות ממתינות להכרעה — נרשמו, טרם הוכרעו
          </div>
          {input.pendingRequests.map((m) => {
            const mayDecide = decidable.has(m.group_id);
            return (
              <div key={m.match_id} style={ROW}>
                <Pair need_ref={m.need_ref} resource_ref={m.resource_ref} />
                <span style={{ fontSize: FS.tag, padding: "2px 7px", borderRadius: RADIUS.sm,
                  border: `1px solid ${COLOR.borderStrong}`, color: COLOR.textDim }}>{m.group_id}</span>
                <span style={{ fontSize: FS.tag, color: "#f0b45c" }}>PENDING</span>
                {mayDecide ? (
                  <div style={{ marginInlineStart: "auto", display: "flex", gap: SPACE.sm }}>
                    {/* group_id is deliberately NOT submitted — the server
                        derives it from match_id. See matchRequestAction.ts. */}
                    <MatchRequestButton
                      action={decideMatchRequestAction}
                      fields={{ match_id: m.match_id, decision: "ACCEPTED" }}
                      label="אשר" tone="approve" done="אושרה"
                    />
                    <MatchRequestButton
                      action={decideMatchRequestAction}
                      fields={{ match_id: m.match_id, decision: "REJECTED" }}
                      label="דחה" tone="reject" done="נדחתה"
                    />
                  </div>
                ) : (
                  <span style={{ marginInlineStart: "auto", fontSize: FS.meta, color: COLOR.textFaint }}>
                    ההכרעה שמורה לרכז/ת מאומת/ת של הקבוצה
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* ── LANE 3 · REJECTED, terminal ─────────────────────────────────── */}
      {input.rejectedRequests.length > 0 ? (
        <div style={{ marginTop: SPACE.lg }} data-lane="rejected">
          <div style={{ fontSize: FS.section, color: COLOR.text, marginBottom: SPACE.sm }}>
            בקשות שנדחו
          </div>
          {input.rejectedRequests.map((m) => (
            <div key={m.match_id} style={ROW}>
              <Pair need_ref={m.need_ref} resource_ref={m.resource_ref} />
              <span style={{ fontSize: FS.tag, padding: "2px 7px", borderRadius: RADIUS.sm,
                border: `1px solid ${COLOR.borderStrong}`, color: COLOR.textDim }}>{m.group_id}</span>
              <span style={{ marginInlineStart: "auto", fontSize: FS.tag, color: "#f2635c" }}>REJECTED</span>
            </div>
          ))}
        </div>
      ) : null}

      {/* ── ACCEPTED — a decision on record. NOT work in progress. ──────── */}
      {input.accepted.length > 0 ? (
        <div style={{ marginTop: SPACE.lg }} data-lane="accepted">
          <div style={{ fontSize: FS.section, color: COLOR.text, marginBottom: SPACE.sm }}>
            התאמות שאושרו — החלטה רשומה, לא פעולה שהחלה
          </div>
          {input.accepted.map((m) => (
            <div key={m.match_id} style={ROW}>
              <Pair need_ref={m.need_ref} resource_ref={m.resource_ref} />
              <span style={{ fontSize: FS.tag, padding: "2px 7px", borderRadius: RADIUS.sm,
                border: `1px solid ${COLOR.borderStrong}`, color: COLOR.textDim }}>{m.group_id}</span>
              <span style={{ marginInlineStart: "auto", fontSize: FS.tag, color: "#34d399" }}>ACCEPTED</span>
            </div>
          ))}
          <div style={{ fontSize: FS.meta, color: COLOR.textFaint, marginTop: SPACE.xs }}>
            אישור אינו התחלת עבודה. שלב הפעולה סופר {input.actions.length} — מאירועי ACTION בלבד.
          </div>
        </div>
      ) : null}
    </section>
  );
}
