"use client";

/**
 * Nexus — OPM graph view (VISUALIZATION ONLY).
 *
 * An OPM-style (object / process / state / agent) rendering of the SAME verified
 * causal graph that drives the card view. The verified graph (PHILOS_CASE_ZERO)
 * is the only source of truth: nodes → processes, produced resources → objects,
 * node.transitions → the Wellbeing state machine, the classifying node's consent
 * gate → the consent condition link, and the value-network helpers → agents on
 * "Redistribute Burden". No new causal relationships, no calculations, no engine.
 */

import type { ReactNode } from "react";
import type { Opm } from "../lib/opm";
import { PHILOS_CASE_ZERO, WELLBEING_STATES, type Wellbeing } from "../lib/causalEngine";
import { useSyncSelection, selectSync } from "./syncStore";

const C = {
  card: "#040e1c", border: "#0a2a4a", borderSoft: "#1e4060", text: "#cfe6f5",
  cyan: "#38bdf8", green: "#34d399", red: "#ef4444", orange: "#fb923c",
  yellow: "#fbbf24", purple: "#a78bfa",
};
type Tone = "neutral" | "bad" | "good";
const TONE: Record<Tone, string> = { neutral: C.purple, bad: C.orange, good: C.green };
const STATE_COLOR: Record<Wellbeing, string> = {
  Destroyed: C.red, Damaged: C.orange, Fragile: C.yellow, Stable: C.cyan, Recovered: C.green,
};

export type OpmAgent = { role: string; label: string; allocated: number; value: string };

// Display mapping per verified graph node (labels only — structure is the graph's).
const NODE_VIEW: Record<string, { proc: string; obj: string; tone: Tone }> = {
  classifying: { proc: "Classify Event",     obj: "Event Classification", tone: "neutral" },
  harming:     { proc: "Harm Values",        obj: "Values Harmed",        tone: "bad" },
  impacting:   { proc: "Generate Burden",     obj: "Burden",               tone: "bad" },
  responding:  { proc: "Redistribute Burden", obj: "Community Capacity",   tone: "good" },
  recovering:  { proc: "Recover",             obj: "Recovery",             tone: "good" },
};

export default function NoaOpmGraph({ opm, agents }: { opm: Opm; agents: OpmAgent[] }) {
  const W = 360;
  const cx = W / 2;
  const sync = useSyncSelection(); // Globe ↔ OPM shared selection (value-bridged)
  const agentMatched = sync.value != null && agents.some((a) => a.value === sync.value);
  const nodes = PHILOS_CASE_ZERO.nodes;
  const classifying = nodes.find((n) => n.id === "classifying");
  const hasConsentGate = !!classifying?.inputs.some((i) => i.type === "gates" && i.resource === "PublicationConsent");
  const consentGranted = opm.classification.classified;

  // Wellbeing transition summary per process (from → to), straight from the graph.
  const transitionSummary = nodes
    .filter((n) => n.transitions.length > 0)
    .map((n) => {
      const v = NODE_VIEW[n.id];
      const from = n.transitions[0].from;
      const to = n.transitions[n.transitions.length - 1].to;
      return { proc: v?.proc ?? n.title, from, to, tone: v?.tone ?? "neutral" as Tone };
    });

  const els: ReactNode[] = [];
  let y = 14;

  // helper renderers ---------------------------------------------------------
  const arrow = (key: string, color = C.borderSoft, dashed = false, label?: string) => {
    const top = y;
    els.push(
      <g key={key}>
        <line x1={cx} y1={top} x2={cx} y2={top + 18} stroke={color} strokeWidth={1.5}
          strokeDasharray={dashed ? "4 3" : undefined} markerEnd="url(#opm-arrow)" />
        {label && <text x={cx + 7} y={top + 13} fontSize={9} fontWeight={700} fill={color}>{label}</text>}
      </g>,
    );
    y += 22;
  };
  const ellipse = (key: string, label: string, tone: Tone, highlight = false) => {
    const cyc = y + 21;
    const stroke = highlight ? C.cyan : TONE[tone];
    els.push(
      <g key={key}>
        {highlight && <ellipse cx={cx} cy={cyc} rx={89} ry={25} fill="none" stroke={`${C.cyan}55`} strokeWidth={1} />}
        <ellipse cx={cx} cy={cyc} rx={84} ry={21} fill={highlight ? "#06223a" : C.card} stroke={stroke} strokeWidth={highlight ? 2.2 : 1.6} />
        <text x={cx} y={cyc + 4} fontSize={12} fontWeight={700} fill={C.text} textAnchor="middle">{label}</text>
      </g>,
    );
    y += 42;
  };
  const object = (key: string, lines: { t: string; he?: boolean }[], tone: Tone, badge?: string) => {
    const h = lines.length > 1 ? 44 : 34;
    els.push(
      <g key={key}>
        <rect x={cx - 108} y={y} width={216} height={h} rx={6} fill={C.card} stroke={TONE[tone]} strokeWidth={1.4} />
        {lines.map((ln, i) => (
          <text key={i} x={cx} y={y + (lines.length > 1 ? 17 + i * 15 : 21)} fontSize={ln.he ? 12 : 10}
            fontWeight={ln.he ? 800 : 600} fill={ln.he ? C.text : C.borderSoft} textAnchor="middle">{ln.t}</text>
        ))}
        {badge && (
          <g>
            <circle cx={cx - 99} cy={y + 9} r={2.5} fill={C.green} />
            <text x={cx - 93} y={y + 12} fontSize={7.5} fontWeight={700} fill={C.green}>{badge}</text>
          </g>
        )}
      </g>,
    );
    y += h + 4;
  };

  // 1 · CONSENT GATE ---------------------------------------------------------
  if (hasConsentGate) {
    const col = consentGranted ? C.green : C.borderSoft;
    els.push(
      <g key="consent">
        <rect x={cx - 92} y={y} width={184} height={24} rx={12} fill={`${col}1a`} stroke={`${col}88`} />
        <text x={cx} y={y + 16} fontSize={9.5} fontWeight={700} fill={col} textAnchor="middle">
          ◆ Publication Consent · {consentGranted ? "granted" : "withheld"}
        </text>
      </g>,
    );
    y += 24;
    arrow("a-consent", consentGranted ? C.green : C.borderSoft, true, "c");
  }

  // 2 · SPINE: process → object, with agents fanning into Redistribute -------
  nodes.forEach((n, idx) => {
    const v = NODE_VIEW[n.id];
    if (!v) return;
    // Redistribute Burden glows when a matched agent is selected (the burden path).
    ellipse(`p-${n.id}`, v.proc, v.tone, n.id === "responding" && agentMatched);

    // agents attach to the Redistribute Burden process (value-network carriers)
    if (n.id === "responding") {
      arrow(`a-agents-${n.id}`, C.green);
      const shown = agents.slice(0, 5);
      const aw = 62, gapx = 6;
      const rowW = shown.length * aw + (shown.length - 1) * gapx;
      const startX = cx - rowW / 2;
      els.push(
        <g key={`agents-${n.id}`}>
          <text x={cx} y={y} fontSize={8} fill={C.borderSoft} textAnchor="middle">agents · value-network carriers</text>
          {shown.length === 0 && (
            <text x={cx} y={y + 18} fontSize={9} fill={C.borderSoft} textAnchor="middle">(no carriers allocated)</text>
          )}
          {shown.map((a, i) => {
            const ax = startX + i * (aw + gapx);
            // Globe↔OPM sync: clicking an agent selects its value; a value
            // selected from the globe highlights the matching agent here.
            const matched = sync.value != null && a.value === sync.value;
            const dim = sync.value != null && a.value !== sync.value;
            const stroke = matched ? C.cyan : `${C.green}88`;
            return (
              <g key={a.role} onClick={() => selectSync(a.value, "opm", a.role)}
                style={{ cursor: "pointer" }} opacity={dim ? 0.32 : 1}>
                <line x1={cx} y1={y + 2} x2={ax + aw / 2} y2={y + 12} stroke={matched ? C.cyan : C.green} strokeWidth={matched ? 1.6 : 1} />
                <circle cx={cx} cy={y + 2} r={3} fill={matched ? C.cyan : C.green} />
                <rect x={ax} y={y + 12} width={aw} height={28} rx={5} fill={matched ? "#06223a" : C.card} stroke={stroke} strokeWidth={matched ? 2 : 1} />
                <text x={ax + aw / 2} y={y + 25} fontSize={8} fontWeight={700} fill={C.text} textAnchor="middle">{a.label}</text>
                <text x={ax + aw / 2} y={y + 35} fontSize={7} fill={matched ? C.cyan : C.borderSoft} textAnchor="middle">{a.value || `load ${a.allocated}`}</text>
              </g>
            );
          })}
        </g>,
      );
      y += 48;
      arrow(`a-after-agents-${n.id}`, C.green);
    } else {
      arrow(`a-po-${n.id}`, TONE[v.tone]);
    }

    // produced object
    if (n.id === "classifying") {
      const cls = opm.classification;
      object("o-classifying", cls.classified
        ? [{ t: cls.labelHe, he: true }, { t: cls.labelEn }]
        : [{ t: cls.labelEn, he: true }], v.tone, cls.classified ? "published" : undefined);
    } else {
      object(`o-${n.id}`, [{ t: v.obj, he: true }], v.tone);
    }

    if (idx < nodes.length - 1) arrow(`a-next-${n.id}`, C.borderSoft);
  });

  // 3 · WELLBEING object + state machine track -------------------------------
  arrow("a-wb", C.cyan);
  els.push(
    <g key="wb-obj">
      <rect x={cx - 108} y={y} width={216} height={26} rx={6} fill={C.card} stroke={`${C.cyan}aa`} strokeWidth={1.4} />
      <text x={cx} y={y + 17} fontSize={11} fontWeight={800} fill={C.text} textAnchor="middle">Wellbeing · subject state</text>
    </g>,
  );
  y += 32;

  // state track: 5 pills + arrows
  const pw = 60, pgap = 8;
  const trackW = WELLBEING_STATES.length * pw + (WELLBEING_STATES.length - 1) * pgap;
  const sx = (W - trackW) / 2;
  els.push(
    <g key="wb-track">
      {WELLBEING_STATES.map((s, i) => {
        const x = sx + i * (pw + pgap);
        return (
          <g key={s}>
            <rect x={x} y={y} width={pw} height={22} rx={11} fill={`${STATE_COLOR[s]}1a`} stroke={STATE_COLOR[s]} />
            <text x={x + pw / 2} y={y + 15} fontSize={7.5} fontWeight={700} fill={STATE_COLOR[s]} textAnchor="middle">{s}</text>
            {i < WELLBEING_STATES.length - 1 && (
              <text x={x + pw + pgap / 2} y={y + 15} fontSize={9} fill={C.borderSoft} textAnchor="middle">→</text>
            )}
          </g>
        );
      })}
    </g>,
  );
  y += 30;

  // transitions, grouped by process (from the verified graph)
  transitionSummary.forEach((ts, i) => {
    els.push(
      <text key={`ts-${i}`} x={cx} y={y} fontSize={9} fill={TONE[ts.tone]} textAnchor="middle">
        {ts.tone === "bad" ? "▼" : "▲"} {ts.proc}: {ts.from} → {ts.to}
      </text>,
    );
    y += 14;
  });

  const H = y + 8;

  return (
    <div style={{ background: "radial-gradient(circle at 50% 0%, #07182b 0%, #030f1e 80%)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 6px" }}>
      {/* legend */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 8, color: C.borderSoft, padding: "0 6px 6px" }}>
        <span>▭ object</span><span>◯ process</span><span>⬭ state</span><span style={{ color: C.green }}>● agent</span><span style={{ color: C.green }}>c consent</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }} role="img" aria-label="OPM graph view of the verified causal graph">
        <defs>
          <marker id="opm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={C.borderSoft} />
          </marker>
        </defs>
        {els}
      </svg>
    </div>
  );
}
