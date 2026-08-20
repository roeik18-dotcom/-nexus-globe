"use client";

/**
 * ValueFlowField — Marketplace's PRIMARY experience: a real spatial value-
 * transformation field, replacing the boxes-in-a-row flow strip this pass
 * rejected on live review ("still fundamentally nav bar + cards + tabs +
 * list"). Positions, distance and a real blocked/open path communicate the
 * model — not a row of equal-weight cards.
 *
 * Every node/gate status is a function of the SAME real data
 * (`selected.knownNeeds`, `knownResource`, `selected.actionSpace`)
 * `ActionSpacePanel`/`resolveActionSpace.ts` already compute — nothing new
 * is fabricated here, only how it's drawn. The path is rendered SOLID only
 * as far as real data actually reaches; beyond the first real blocker
 * (today: the Consent gate — no consent mechanism exists anywhere in this
 * codebase) the rest of the pipeline is drawn faint/dashed, never as if it
 * were reachable.
 */
import { useState, type ReactNode } from "react";
import type { KnownResourceResult } from "./resolveActionSpace";
import type { ActionSpaceSummary, KnownNeedResult } from "@/app/lib/systemContext";

// Duplicated verbatim from `resolveActionSpace.ts` (never re-derived) —
// this is a "use client" component, and importing a VALUE from
// `resolveActionSpace.ts` would drag its server-only module graph
// (canon store readers, `node:fs`) into the client bundle. The type-only
// import above is erased at compile time and carries no such risk.
const ADMISSIBILITY_PREDICATE =
  "TransferAllowed ⇔ Benefit(receiver) > Cost ∧ DonorPostState(consumed_resource) ≥ ResourceSpecificFloor ∧ SystemicExternality ≤ AcceptedRisk";
const ADMISSIBILITY_GATE_FUNCTION = "app/lib/philos/canon/matching.ts :: evaluateMatch(attempt, need, offer)";

type NodeStatus = "real" | "partial" | "absent";
const STATUS_COLOR: Record<NodeStatus, string> = { real: "#34d399", partial: "#fbbf24", absent: "#3a4d70" };

const W = 900;
const H = 480;

// Real, fixed positions — a spatial field, not a row. Need/Capacity sit
// upper-left/upper-right (the two real inputs the field is checking for a
// match between); everything downstream sits on the vertical spine below
// their convergence point.
const POS = {
  need: { x: 220, y: 90 },
  capacity: { x: 680, y: 90 },
  match: { x: 450, y: 190 },
  consent: { x: 450, y: 270 },
  antiDepletion: { x: 450, y: 340 },
  action: { x: 450, y: 410 },
  effect: { x: 700, y: 410 },
  state: { x: 700, y: 340 },
};

function FieldNode({
  x, y, r, label, status, onClick, active,
}: { x: number; y: number; r: number; label: string; status: NodeStatus; onClick?: () => void; active?: boolean }) {
  const color = STATUS_COLOR[status];
  return (
    <g onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      <circle
        cx={x} cy={y} r={active ? r + 5 : r}
        fill={status === "absent" ? "none" : `${color}22`}
        stroke={color}
        strokeWidth={active ? 3 : 2}
        strokeDasharray={status === "absent" ? "4 4" : undefined}
      />
      <text x={x} y={y} fill={status === "absent" ? "#6c86b5" : "#f2f6fc"} fontSize={12} fontWeight={700} textAnchor="middle" dominantBaseline="middle">
        {label}
      </text>
    </g>
  );
}

function Gate({ x, y, label, passed, known, onClick, active }: { x: number; y: number; label: string; passed: boolean; known: boolean; onClick?: () => void; active?: boolean }) {
  const color = !known ? "#3a4d70" : passed ? "#34d399" : "#f87171";
  const size = active ? 20 : 16;
  return (
    <g onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      <rect x={x - size} y={y - size} width={size * 2} height={size * 2} fill="#0b0f1a" stroke={color} strokeWidth={2} transform={`rotate(45 ${x} ${y})`} />
      <text x={x} y={y - size - 8} fill={color} fontSize={10} textAnchor="middle">{label}</text>
      <text x={x} y={y + 4} fill={color} fontSize={13} fontWeight={700} textAnchor="middle">{!known ? "?" : passed ? "✓" : "✕"}</text>
    </g>
  );
}

function Edge({ from, to, open }: { from: { x: number; y: number }; to: { x: number; y: number }; open: boolean }) {
  return (
    <line
      x1={from.x} y1={from.y} x2={to.x} y2={to.y}
      stroke={open ? "#6c86b5" : "#1e2740"}
      strokeWidth={open ? 2 : 1.5}
      strokeDasharray={open ? undefined : "5 5"}
    />
  );
}

type FocusKey = "need" | "capacity" | "match" | "consent" | "antiDepletion" | "action" | "effect" | "state";

export default function ValueFlowField({
  knownNeeds,
  knownResource,
  actionSpace,
}: {
  knownNeeds: KnownNeedResult;
  knownResource: KnownResourceResult;
  actionSpace: ActionSpaceSummary;
}) {
  const [focus, setFocus] = useState<FocusKey | null>(null);

  const needStatus: NodeStatus = !knownNeeds.checked ? "absent" : knownNeeds.needs.length > 0 ? "real" : "absent";
  const capacityStatus: NodeStatus = knownResource.found ? "real" : "absent";
  const matchStatus: NodeStatus = needStatus === "real" && capacityStatus === "real" ? "partial" : "absent";
  // Consent: no real consent mechanism exists anywhere in this codebase —
  // always the real, honest blocker today, never faked as passed.
  const consentPassed = false;
  const consentKnown = true;
  const antiDepletionKnown = false; // no real mechanism to check yet — genuinely unknown, not "failed"
  const pathOpenToMatch = needStatus === "real" || capacityStatus === "real";
  const pathOpenPastConsent = false; // real: nothing gets past the real, always-missing consent gate today

  return (
    <div dir="rtl" style={{ fontFamily: "system-ui", background: "#0b0f1a", color: "#e6ebf5" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "12px 20px 0" }}>
        <div style={{ fontSize: 12, letterSpacing: 1, color: "#5aa6ff" }}>שדה זרימת ערך</div>
        <div style={{ fontSize: 12, color: "#6c86b5" }}>קהילה / כלל</div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minHeight: "60vh" }} role="img" aria-label="שדה זרימת ערך">
        {/* background plane label */}
        <text x={W / 2} y={30} fill="#3a4d70" fontSize={11} textAnchor="middle">קהילה / כלל — יכולות ומשאבים סביב ההקשר הנבחר</text>

        <Edge from={POS.need} to={POS.match} open={pathOpenToMatch} />
        <Edge from={POS.capacity} to={POS.match} open={pathOpenToMatch} />
        <Edge from={POS.match} to={POS.consent} open={matchStatus !== "absent"} />
        <Edge from={POS.consent} to={POS.antiDepletion} open={pathOpenPastConsent} />
        <Edge from={POS.antiDepletion} to={POS.action} open={pathOpenPastConsent} />
        <Edge from={POS.action} to={POS.effect} open={pathOpenPastConsent} />
        <Edge from={POS.effect} to={POS.state} open={pathOpenPastConsent} />

        <FieldNode x={POS.need.x} y={POS.need.y} r={44} label="צורך" status={needStatus} active={focus === "need"} onClick={() => setFocus(focus === "need" ? null : "need")} />
        <FieldNode x={POS.capacity.x} y={POS.capacity.y} r={44} label="יכולת" status={capacityStatus} active={focus === "capacity"} onClick={() => setFocus(focus === "capacity" ? null : "capacity")} />
        <FieldNode x={POS.match.x} y={POS.match.y} r={34} label="התאמה" status={matchStatus} active={focus === "match"} onClick={() => setFocus(focus === "match" ? null : "match")} />

        <Gate x={POS.consent.x} y={POS.consent.y} label="הסכמה" passed={consentPassed} known={consentKnown} active={focus === "consent"} onClick={() => setFocus(focus === "consent" ? null : "consent")} />
        <Gate x={POS.antiDepletion.x} y={POS.antiDepletion.y} label="אי־הידלדלות" passed={false} known={antiDepletionKnown} active={focus === "antiDepletion"} onClick={() => setFocus(focus === "antiDepletion" ? null : "antiDepletion")} />

        <FieldNode x={POS.action.x} y={POS.action.y} r={30} label="פעולה" status="absent" active={focus === "action"} onClick={() => setFocus(focus === "action" ? null : "action")} />
        <FieldNode x={POS.effect.x} y={POS.effect.y} r={30} label="השפעה" status="absent" active={focus === "effect"} onClick={() => setFocus(focus === "effect" ? null : "effect")} />
        <FieldNode x={POS.state.x} y={POS.state.y} r={30} label="מצב מעודכן" status="absent" active={focus === "state"} onClick={() => setFocus(focus === "state" ? null : "state")} />
      </svg>

      <div style={{ padding: "0 20px 16px", minHeight: 90 }}>
        {focus === "need" ? (
          <FocusPanel title="צורך">
            {!knownNeeds.checked
              ? `לא ניתן לבדוק — ${knownNeeds.reason}`
              : knownNeeds.needs.length > 0
                ? knownNeeds.needs.map((r) => `${r.need.desired_change} (${r.need.context}, ${r.status})`).join(" · ")
                : "נבדק — אין צורך רשום לנושא זה"}
          </FocusPanel>
        ) : focus === "capacity" ? (
          <FocusPanel title="יכולת">
            {knownResource.found
              ? `ספק ${knownResource.provider.id} — ${knownResource.provider.context.label}`
              : `נבדקו ${knownResource.checked_entities} ספקים אמיתיים — אין התאמה`}
          </FocusPanel>
        ) : focus === "match" ? (
          <FocusPanel title="התאמה">
            {matchStatus === "absent" ? "אין עדיין צורך ויכולת תואמים בו־זמנית" : "צורך ויכולת קיימים — לא בהכרח אותו סוג משאב"}
          </FocusPanel>
        ) : focus === "consent" ? (
          <FocusPanel title="שער הסכמה">
            אין מנגנון הסכמה ממומש עדיין בשום מקום במערכת — זהו החסם האמיתי הראשון בצינור היום, לא הנחה.
          </FocusPanel>
        ) : focus === "antiDepletion" ? (
          <FocusPanel title="שער אי־הידלדלות">
            עקרון: אין לפתור מחסור אחד ביצירת מחסור בלתי מקובל אצל התורם. לא ניתן להערכה עדיין — אין מנגנון בדיקה ממומש.
          </FocusPanel>
        ) : focus === "action" || focus === "effect" || focus === "state" ? (
          <FocusPanel title={focus === "action" ? "פעולה" : focus === "effect" ? "השפעה" : "מצב מעודכן"}>
            לא מוצג — לא ניתן להגיע לשלב זה כל עוד שער ההסכמה חסום.
          </FocusPanel>
        ) : (
          <div style={{ fontSize: 13, color: "#7b8ca6", fontStyle: "italic" }}>לחץ על צומת או שער כדי לראות פרטים אמיתיים.</div>
        )}
      </div>

      <div dir="rtl" style={{ padding: "0 20px 16px", fontSize: 12, color: "#6c86b5", lineHeight: 1.7 }}>
        {ADMISSIBILITY_PREDICATE}
        <span style={{ marginRight: 6 }}> (PHILOS-MELTING-POT-CANON.md §21 — gate: {ADMISSIBILITY_GATE_FUNCTION})</span>
      </div>
    </div>
  );
}

function FocusPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: "#111726", border: "1px solid #1e2740", borderRadius: 8, padding: "10px 14px", maxWidth: 500 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#f2f6fc" }}>{title}</div>
      <div style={{ fontSize: 13, color: "#9fb0d0", marginTop: 6, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}
