"use client";
/**
 * GROUP NETWORK — the same canonical groups, viewed by relation rather than
 * by meaning. Community's Value Map answers "where does this sit in the value
 * landscape"; this answers "what touches what". One data model, two
 * projections — never two independently-derived edge sets.
 *
 * WITH ZERO EDGES IT MUST STILL BE USEFUL, and today it has zero: the three
 * groups share no member, no sub-value, no need and no resource. So the view
 * states that as a finding, in the ten relation types it CAN carry and what
 * each would need, rather than drawing a graph of nothing or inventing
 * proximity from "both are communities in Israel". SIMILARITY ≠ RELATION.
 *
 * Node position is deterministic (evenly spaced on a ring, ordered by
 * group_id) — not force-simulated, because a random layout would imply a
 * spatial relationship the data does not contain, and would differ between
 * server and client renders.
 */
import { COLOR, FS, RADIUS, SPACE } from "@/app/lib/philos/shell/designTokens";
import { RELATION, STATE, INTERACTION, ENTITY, entityPath } from "@/app/lib/philos/shell/visualGrammar";
import type { GroupRelation, GroupRelationType } from "@/app/lib/philos/community/groupRelations";
import type { SpectrumGroupRef } from "./ValueSpectrumMap";



const REL_LABEL = Object.fromEntries(
  (Object.keys(RELATION) as GroupRelationType[]).map((k) => [k, RELATION[k].label]),
) as Record<GroupRelationType, string>;

/** One edge, drawn with all three channels: dash (primary), endpoint marker
 *  (secondary), hue (third). Two relation types never coincide on both of the
 *  first two, so the graph stays readable with colour removed. */
function Edge({ r, a, b, selected, onSelect, k }: {
  r: GroupRelation; a: { x: number; y: number }; b: { x: number; y: number };
  selected: boolean; onSelect: () => void; k: string;
}) {
  const enc = RELATION[r.type];
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  // Stop the line at the node boundary rather than drawing through and hiding
  // it under a fill — an occluding fill is a coupling to the background.
  const PAD = 22;
  const x1 = a.x + ux * PAD, y1 = a.y + uy * PAD;
  const x2 = b.x - ux * PAD, y2 = b.y - uy * PAD;
  const stroke = selected ? "#ffffff" : enc.hue;
  const w = selected ? 2 : 1;

  const marker = () => {
    const mx = x2, my = y2, s = 5;
    switch (enc.endpoint) {
      case "arrow":
        return <path d={`M ${mx - ux * s * 2 - uy * s} ${my - uy * s * 2 + ux * s} L ${mx} ${my} L ${mx - ux * s * 2 + uy * s} ${my - uy * s * 2 - ux * s}`}
          fill="none" stroke={stroke} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;
      case "bar":
        return <line x1={mx - uy * s} y1={my + ux * s} x2={mx + uy * s} y2={my - ux * s} stroke={stroke} strokeWidth={w * 1.5} />;
      case "dot":
        return <><circle cx={x1} cy={y1} r={2.5} fill={stroke} /><circle cx={mx} cy={my} r={2.5} fill={stroke} /></>;
      case "cross":
        return <><line x1={(x1 + mx) / 2 - 5} y1={(y1 + my) / 2 - 5} x2={(x1 + mx) / 2 + 5} y2={(y1 + my) / 2 + 5} stroke={stroke} strokeWidth={w * 1.5} />
          <line x1={(x1 + mx) / 2 - 5} y1={(y1 + my) / 2 + 5} x2={(x1 + mx) / 2 + 5} y2={(y1 + my) / 2 - 5} stroke={stroke} strokeWidth={w * 1.5} /></>;
      default:
        return null;
    }
  };

  return (
    <g tabIndex={0} role="button" style={{ cursor: "pointer" }}
      aria-label={`${enc.label}: ${r.evidence}`}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={w}
        strokeDasharray={enc.dash} strokeLinecap="round" />
      {marker()}
    </g>
  );
}

/** The legend, drawn from the same map the edges are drawn from — it cannot
 *  drift from what the graph actually does. */
function RelationLegend({ present, relations }: { present: Set<GroupRelationType>; relations: readonly GroupRelation[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(268px, 1fr))", gap: 4 }}>
      {(Object.keys(RELATION) as GroupRelationType[]).map((t) => {
        const enc = RELATION[t];
        const on = present.has(t);
        return (
          <div key={t} style={{ display: "flex", gap: SPACE.sm, alignItems: "center",
            color: on ? COLOR.text : COLOR.textFaint, opacity: on ? 1 : 0.72 }}>
            <svg width={34} height={12} aria-hidden="true" style={{ flexShrink: 0, direction: "ltr" }}>
              <line x1={2} y1={6} x2={26} y2={6} strokeDasharray={enc.dash}
                stroke={on ? enc.hue : COLOR.textFaint} strokeWidth={1} strokeLinecap="round" />
              {enc.endpoint === "arrow" ? <path d="M 22 3 L 27 6 L 22 9" fill="none" stroke={on ? enc.hue : COLOR.textFaint} strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" /> : null}
              {enc.endpoint === "bar" ? <line x1={27} y1={2} x2={27} y2={10} stroke={on ? enc.hue : COLOR.textFaint} strokeWidth={1.5} /> : null}
              {enc.endpoint === "dot" ? <><circle cx={3} cy={6} r={2} fill={on ? enc.hue : COLOR.textFaint} /><circle cx={26} cy={6} r={2} fill={on ? enc.hue : COLOR.textFaint} /></> : null}
              {enc.endpoint === "cross" ? <><line x1={11} y1={2} x2={18} y2={10} stroke={on ? enc.hue : COLOR.textFaint} strokeWidth={1.5} /><line x1={11} y1={10} x2={18} y2={2} stroke={on ? enc.hue : COLOR.textFaint} strokeWidth={1.5} /></> : null}
            </svg>
            <span style={{ minWidth: 104, fontSize: FS.meta }}>{enc.label}</span>
            <span style={{ fontSize: FS.tag, color: COLOR.textFaint }}>
              {on ? `${relations.filter((r) => r.type === t).length} קשתות` : enc.requires}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function GroupNetworkView({
  groups, relations, selectedGroup, onSelectGroup, onSelectRelation, selectedRelation,
}: {
  groups: readonly (SpectrumGroupRef & { members: number })[];
  relations: readonly GroupRelation[];
  selectedGroup: string | null;
  selectedRelation: string | null;
  onSelectGroup: (id: string | null) => void;
  onSelectRelation: (key: string | null) => void;
}) {
  const W = 560, H = 340, CX = W / 2, CY = H / 2, R = Math.min(W, H) * 0.33;
  const ordered = [...groups].sort((a, b) => a.group_id.localeCompare(b.group_id));
  const pos = new Map(ordered.map((g, i) => {
    const a = (i / Math.max(1, ordered.length)) * Math.PI * 2 - Math.PI / 2;
    return [g.group_id, { x: CX + Math.cos(a) * R, y: CY + Math.sin(a) * R }];
  }));
  const relKey = (r: GroupRelation) => `${r.from_group_id}|${r.to_group_id}|${r.type}`;
  const present = new Set(relations.map((r) => r.type));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="group" aria-label={`רשת קבוצות — ${groups.length} קבוצות, ${relations.length} קשרים`}
        style={{ direction: "ltr", display: "block", background: COLOR.bg, borderRadius: RADIUS.md, border: `1px solid ${COLOR.border}` }}>
        {relations.map((r) => {
          const a = pos.get(r.from_group_id), b = pos.get(r.to_group_id);
          if (!a || !b) return null;
          const k = relKey(r);
          return <Edge key={k} k={k} r={r} a={a} b={b} selected={selectedRelation === k}
            onSelect={() => onSelectRelation(selectedRelation === k ? null : k)} />;
        })}
        {ordered.map((g) => {
          const p = pos.get(g.group_id)!;
          const sel = selectedGroup === g.group_id;
          const rad = 16 + Math.min(16, g.members * 1.4);
          return (
            <g key={g.group_id}>
              {/* INTERACTION — a ring outside the mark. Selection and "mine"
                  never repaint the node, so its shape and dash keep meaning
                  what they mean. */}
              {sel || g.mine ? (
                <path d={entityPath("GROUP", rad + 5)} transform={`translate(${p.x} ${p.y})`}
                  fill="none" pointerEvents="none"
                  stroke={sel ? INTERACTION.selected.ringColor : INTERACTION.viewer.ringColor}
                  strokeWidth={sel ? INTERACTION.selected.ring : INTERACTION.viewer.ring} />
              ) : null}
              {/* ENTITY — a group is a rounded square everywhere in PHILOS.
                  STATE — dash pattern, the cue that survives grayscale. */}
              <path d={entityPath("GROUP", rad)} transform={`translate(${p.x} ${p.y})`}
                fill="#16203a"
                stroke={g.provenance === "REAL" ? STATE.REAL.hue : STATE.DEMO.hue}
                strokeDasharray={g.provenance === "REAL" ? STATE.REAL.dash : STATE.DEMO.dash}
                strokeWidth={1} tabIndex={0} role="button" style={{ cursor: "pointer" }}
                aria-label={`${g.name}, ${g.provenance}, ${g.members} חברים${g.mine ? ", אתה חבר" : ""}`}
                onClick={() => onSelectGroup(sel ? null : g.group_id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectGroup(sel ? null : g.group_id); } }} />
              <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize={12} fill={COLOR.text} pointerEvents="none">{g.members}</text>
              <text x={p.x} y={p.y + rad + 16} textAnchor="middle" fontSize={12} fill={COLOR.textDim} pointerEvents="none">
                {g.name.length > 24 ? g.name.slice(0, 22) + "…" : g.name}
              </text>
              {/* STATE tag — always drawn. The cue that needs no colour, no
                  shape recognition and no legend lookup. */}
              <text x={p.x} y={p.y + rad + 29} textAnchor="middle" fontSize={12}
                fill={g.provenance === "REAL" ? STATE.REAL.hue : STATE.DEMO.hue} pointerEvents="none">
                {g.provenance}{g.mine ? " · אתה כאן" : ""}
              </text>
            </g>
          );
        })}
        {/* 0 EDGES IS A STATE, drawn as one: the nodes stand apart with the
            space between them left visibly empty, and the legend below says
            what each missing edge would require. Not a blank canvas. */}
        {relations.length === 0 ? (
          <>
            <text x={CX} y={H - 20} textAnchor="middle" fontSize={12} fill={COLOR.textFaint}>
              0 קשתות — אין ראיה לקשר בין הקבוצות האלה
            </text>
            <text x={CX} y={H - 6} textAnchor="middle" fontSize={12} fill={COLOR.textFaint}>
              10 סוגי קשר נתמכים · מה שכל אחד דורש מופיע למטה
            </text>
          </>
        ) : null}
      </svg>

      {/* THE TEN TYPES, and what each is waiting for. An empty graph with a
          stated shape is more useful than an empty graph. */}
      <div style={{ marginTop: SPACE.sm, fontSize: FS.meta }}>
        {selectedRelation ? (() => {
          const r = relations.find((x) => relKey(x) === selectedRelation);
          return r ? (
            <div style={{ padding: SPACE.md, background: COLOR.bgCard, border: `1px solid ${COLOR.accent}`, borderRadius: RADIUS.md, color: COLOR.text }}>
              <strong>{REL_LABEL[r.type]}</strong> · {r.from_group_id} ↔ {r.to_group_id}
              <div style={{ color: COLOR.textDim, marginTop: 4 }}>ראיה: {r.evidence}</div>
              {r.shared?.length ? <div style={{ color: COLOR.textFaint, marginTop: 2 }}>משותף: {r.shared.join(" · ")}</div> : null}
            </div>
          ) : null;
        })() : (
          <RelationLegend present={present} relations={relations} />
        )}
      </div>
    </div>
  );
}
