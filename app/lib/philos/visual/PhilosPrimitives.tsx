"use client";

/**
 * PHILOS VISUAL PRIMITIVES — the one shared visual grammar for every
 * terminal. Six primitive families only (NODE, CONTAINER, EDGE, FLOW,
 * STATE, DELTA), per the product decision: "complex systems should be
 * understood spatially before they are explained textually." This module
 * defines shared shape/typography/color tokens and small composable
 * components — it renders no real data itself and fabricates nothing;
 * every caller passes in real values or an explicit `unknown`/`blocked`
 * status.
 *
 * Design-principle lineage (explicitly NOT visual/brand lineage — no
 * copied illustration, palette, or typography from any external
 * reference): strong containment, obvious hierarchy, spatial grouping,
 * directional flow, readable topology, progressive disclosure, limited
 * labels, and a strict entity/relation/state/change visual distinction.
 *
 * STATUS is the one semantic color channel system-wide — REAL, VERIFIED,
 * ACTIVE, PENDING, UNKNOWN, BLOCKED, DEMO always mean the same thing in
 * every terminal that imports this module.
 */
import type { ReactNode } from "react";

export type PhilosStatus = "real" | "verified" | "active" | "pending" | "unknown" | "blocked" | "demo";

export const STATUS_COLOR: Record<PhilosStatus, string> = {
  real: "#34d399",
  verified: "#22d3ee",
  active: "#5aa6ff",
  pending: "#fbbf24",
  unknown: "#5a76a3",
  blocked: "#f2635c",
  demo: "#a78bfa",
};

export const STATUS_LABEL: Record<PhilosStatus, string> = {
  real: "REAL", verified: "VERIFIED", active: "ACTIVE", pending: "PENDING",
  unknown: "UNKNOWN", blocked: "BLOCKED", demo: "DEMO",
};

/** Typographic grammar — the same six weights everywhere: DISPLAY, H1,
 *  H2, BODY, META, AUDIT (AUDIT is for content the audit/source view
 *  hides by default, never shown at equal weight to BODY). */
export const TYPE: Record<"display" | "h1" | "h2" | "body" | "meta" | "audit", React.CSSProperties> = {
  display: { fontSize: 22, fontWeight: 800, color: "#f0f4fc", letterSpacing: 0.2 },
  h1: { fontSize: 15, fontWeight: 800, color: "#f0f4fc" },
  h2: { fontSize: 12, fontWeight: 700, color: "#8fa3c9", letterSpacing: 0.3 },
  body: { fontSize: 12, fontWeight: 500, color: "#dbe6f6", lineHeight: 1.6 },
  meta: { fontSize: 9.5, fontWeight: 500, color: "#5a76a3" },
  audit: { fontSize: 9, fontWeight: 500, color: "#5a76a3" },
};

// ── NODE — a real entity (Person, Value, Value Group, Need, Resource,
//    Action, Effect, Event). ─────────────────────────────────────────

export function PhilosNode({
  label, labelEn, status, meta, selected, onClick, dim,
}: {
  label: string;
  labelEn?: string;
  status: PhilosStatus;
  meta?: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  /** "recede" treatment for completed/inactive/unknown nodes — always
   *  visible, never hidden, just visually subordinate. */
  dim?: boolean;
}) {
  const color = STATUS_COLOR[status];
  const Tag: "button" | "div" = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      style={{
        display: "block", textAlign: "right", fontFamily: "inherit", cursor: onClick ? "pointer" : "default",
        border: `1px solid ${selected ? color : "rgba(90,120,180,0.22)"}`,
        background: selected ? `${color}14` : "rgba(18,24,38,0.6)",
        borderRadius: 10, padding: "9px 12px", opacity: dim ? 0.55 : 1,
        minWidth: 120, transition: "opacity 120ms, border-color 120ms",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
        <span style={{ ...TYPE.body, fontWeight: 700, color: "#f0f4fc" }}>{label}</span>
        <StatusDot status={status} />
      </div>
      {labelEn ? <div style={TYPE.meta}>{labelEn}</div> : null}
      {meta ? <div style={{ ...TYPE.meta, marginTop: 4 }}>{meta}</div> : null}
    </Tag>
  );
}

export function StatusDot({ status }: { status: PhilosStatus }) {
  return <span title={STATUS_LABEL[status]} style={{ width: 7, height: 7, borderRadius: 99, background: STATUS_COLOR[status], flexShrink: 0 }} />;
}

export function StatusTag({ status, children }: { status: PhilosStatus; children?: ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 800, letterSpacing: 0.4, color: STATUS_COLOR[status] }}>
      <StatusDot status={status} />
      {children ?? STATUS_LABEL[status]}
    </span>
  );
}

// ── CONTAINER — a context that contains/organizes entities (Human,
//    Value Domain, Group, Community, World context). ───────────────

export function PhilosContainer({
  label, labelEn, status, children, dense,
}: {
  label: string;
  labelEn?: string;
  status?: PhilosStatus;
  children: ReactNode;
  dense?: boolean;
}) {
  return (
    <div style={{ border: `1px solid ${status ? `${STATUS_COLOR[status]}40` : "rgba(90,120,180,0.22)"}`, borderRadius: 14, padding: dense ? "10px 12px" : "14px 16px", background: "rgba(12,17,28,0.5)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: dense ? 6 : 10 }}>
        <div style={TYPE.h2}>{label}{labelEn ? <span style={{ ...TYPE.meta, marginRight: 6 }}>{labelEn}</span> : null}</div>
        {status ? <StatusTag status={status} /> : null}
      </div>
      {children}
    </div>
  );
}

// ── EDGE — a typed relationship between two nodes. Rendered as a
//    labeled connector, not free-floating text. ─────────────────────

export function PhilosEdge({ label, kind = "relation" }: { label?: string; kind?: "relation" | "flow" }) {
  const glyph = kind === "flow" ? "↓" : "↔";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "2px 0" }}>
      <span style={{ fontSize: 13, color: "#3d4f75" }}>{glyph}</span>
      {label ? <span style={TYPE.meta}>{label}</span> : null}
    </div>
  );
}

// ── FLOW — a directional operational process (Need → Resource → Match
//    → Action → Effect → Evidence → Learning). Completed stages recede;
//    the current unresolved stage dominates. ────────────────────────

export interface PhilosFlowStep {
  key: string;
  label: string;
  labelEn?: string;
  state: "done" | "current" | "pending" | "blocked";
}

export function PhilosFlow({ steps, direction = "horizontal" }: { steps: PhilosFlowStep[]; direction?: "horizontal" | "vertical" }) {
  const stepColor: Record<PhilosFlowStep["state"], PhilosStatus> = { done: "real", current: "active", pending: "pending", blocked: "blocked" };
  return (
    <div style={{ display: "flex", flexDirection: direction === "horizontal" ? "row" : "column", alignItems: direction === "horizontal" ? "center" : "stretch", flexWrap: "wrap", gap: 4 }}>
      {steps.map((s, i) => (
        <div key={s.key} style={{ display: "flex", flexDirection: direction === "horizontal" ? "row" : "column", alignItems: "center", gap: 4 }}>
          <div
            style={{
              display: "flex", alignItems: "center", gap: 6, borderRadius: 999,
              padding: s.state === "current" ? "8px 16px" : "6px 12px",
              border: `1px solid ${STATUS_COLOR[stepColor[s.state]]}${s.state === "current" ? "" : "40"}`,
              background: s.state === "current" ? `${STATUS_COLOR[stepColor[s.state]]}1c` : "rgba(18,24,38,0.5)",
              opacity: s.state === "done" ? 0.55 : 1,
              boxShadow: s.state === "current" ? `0 0 0 3px ${STATUS_COLOR[stepColor[s.state]]}22` : "none",
            }}
          >
            <StatusDot status={stepColor[s.state]} />
            <span style={{ display: "flex", flexDirection: "column", alignItems: direction === "horizontal" ? "flex-start" : "stretch" }}>
              <span style={{ fontSize: s.state === "current" ? 12.5 : 11, fontWeight: s.state === "current" ? 800 : 600, color: s.state === "done" ? "#8fa3c9" : "#f0f4fc" }}>{s.label}</span>
              {s.labelEn ? <span style={{ fontSize: 8, color: "#5a76a3" }}>{s.labelEn}</span> : null}
            </span>
          </div>
          {i < steps.length - 1 ? <PhilosEdge kind="flow" /> : null}
        </div>
      ))}
    </div>
  );
}

// ── STATE — a real entity/parameter state at timestamp T. ───────────

export function PhilosState({
  value, confidence, observedAt, unit,
}: {
  value: number | string | null;
  confidence?: number | null;
  observedAt?: string | null;
  unit?: string;
}) {
  if (value === null) {
    return <StatusTag status="unknown">UNKNOWN</StatusTag>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: "#f0f4fc" }}>{value}{unit ? <span style={TYPE.meta}> {unit}</span> : null}</div>
      <div style={{ display: "flex", gap: 8, ...TYPE.meta }}>
        {confidence != null ? <span>confidence {confidence}</span> : null}
        {observedAt ? <span>{observedAt.slice(0, 10)}</span> : null}
      </div>
    </div>
  );
}

// ── DELTA — a verified change: STATE(t0) → Δ → STATE(t1). ───────────

export function PhilosDelta({
  from, to, delta,
}: {
  from: number | null;
  to: number | null;
  delta: number | null;
}) {
  if (from === null || to === null || delta === null) {
    return <div style={TYPE.meta}>אין היסטוריה עדיין — no prior state to compare against</div>;
  }
  const positive = delta >= 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 8, color: "#5a76a3" }}>STATE (t0)</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#8fa3c9" }}>{from}</div>
      </div>
      <span style={{ fontSize: 11, color: positive ? STATUS_COLOR.real : STATUS_COLOR.blocked, fontWeight: 800 }}>
        Δ {positive ? "+" : ""}{delta} →
      </span>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 8, color: "#5a76a3" }}>STATE (t1)</div>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#f0f4fc" }}>{to}</div>
      </div>
    </div>
  );
}
