"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";

// ── Public types — Data Layer contract ────────────────────────────────────────

export type NodeType = "mission" | "gap" | "value" | "capability" | "provider";
export type EdgeType =
  | "mission_gap"
  | "gap_value"
  | "required_for"
  | "can_address"
  | "can_deliver";

export interface GraphNode {
  id:       string;
  type:     NodeType;
  label:    string;
  sublabel?: string;
  data?:    Record<string, unknown>;
}

export interface GraphEdge {
  id:     string;
  source: string;
  target: string;
  type:   EdgeType;
}

// ── Rendering constants ───────────────────────────────────────────────────────

const NODE_COLOR: Record<NodeType, string> = {
  mission:    "#A371F7",
  gap:        "#5B8CFF",
  value:      "#22D3EE",
  capability: "#FFB84D",
  provider:   "#34D399",
};

const NODE_R: Record<NodeType, number> = {
  mission:    20,
  gap:        13,
  value:      11,
  capability: 11,
  provider:   9,
};

// Fraction of height at which each level is anchored
const LEVEL_Y: Record<NodeType, number> = {
  mission:    0.10,
  gap:        0.26,
  value:      0.42,
  capability: 0.60,
  provider:   0.78,
};

// Minimum cascadeStep for a node type to be visible
const NODE_REVEAL: Record<NodeType, number> = {
  mission:    0,
  gap:        1,
  value:      2,
  capability: 3,
  provider:   4,
};

const EDGE_REVEAL: Record<EdgeType, number> = {
  mission_gap:  1,
  gap_value:    2,
  required_for: 3,
  can_address:  3,
  can_deliver:  4,
};

const EDGE_COLOR: Record<EdgeType, string> = {
  mission_gap:  "#5B8CFF",
  gap_value:    "#22D3EE",
  required_for: "#FFB84D",
  can_address:  "#22D3EE",
  can_deliver:  "#34D399",
};

const EDGE_DASH: Record<EdgeType, string | null> = {
  mission_gap:  "5 3",
  gap_value:    "4 3",
  required_for: null,
  can_address:  "4 3",
  can_deliver:  null,
};

const EDGE_W: Record<EdgeType, number> = {
  mission_gap:  1,
  gap_value:    1,
  required_for: 1.5,
  can_address:  1,
  can_deliver:  1.5,
};

// ── D3 internal types ─────────────────────────────────────────────────────────

type SimNode = GraphNode & d3.SimulationNodeDatum;
type SimLink = d3.SimulationLinkDatum<SimNode> & { type: EdgeType; id: string };

// ── Opacity helpers ───────────────────────────────────────────────────────────

function nodeOp(
  d: SimNode,
  step: number,
  selId: string | null,
  connected: Set<string>,
): number {
  if (selId) {
    if (d.id === selId) return 1;
    return connected.has(d.id) ? 0.72 : 0.09;
  }
  return step >= NODE_REVEAL[d.type] ? 1 : 0.05;
}

function edgeOp(type: EdgeType, step: number, selId: string | null): number {
  if (step < EDGE_REVEAL[type]) return 0.02;
  if (selId) return 0.1;
  return type === "required_for" || type === "can_deliver" ? 0.6 : 0.28;
}

function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface ForceGraphProps {
  nodes:          GraphNode[];
  edges:          GraphEdge[];
  selectedNodeId: string | null;
  cascadeStep:    number;
  onNodeClick:    (node: GraphNode | null) => void;
  reducedMotion?: boolean;
}

export default function ForceGraph({
  nodes,
  edges,
  selectedNodeId,
  cascadeStep,
  onNodeClick,
  reducedMotion = false,
}: ForceGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Stable callback ref — D3 event handlers read from this, never stale
  const onClickRef = useRef(onNodeClick);
  onClickRef.current = onNodeClick;

  // D3 object refs (not React state — no re-renders from these)
  const simRef     = useRef<d3.Simulation<SimNode, SimLink> | undefined>(undefined);
  const nodeSelRef = useRef<d3.Selection<SVGGElement, SimNode, SVGGElement, unknown> | undefined>(undefined);
  const edgeSelRef = useRef<d3.Selection<SVGLineElement, SimLink, SVGGElement, unknown> | undefined>(undefined);
  const edgesRef   = useRef(edges); // for connected-set lookup without rebuilding
  edgesRef.current = edges;

  // ── Build simulation (only when node/edge data changes) ───────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const W = el.clientWidth  || 740;
    const H = el.clientHeight || 540;

    // ── SVG ────────────────────────────────────────────────────────────────
    const svg = d3.select(el)
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .style("cursor", "grab")
      .on("click", () => onClickRef.current(null));

    // Glow filter
    const defs = svg.append("defs");
    const f = defs.append("filter")
      .attr("id", "fg-glow")
      .attr("x", "-60%").attr("y", "-60%")
      .attr("width", "220%").attr("height", "220%");
    f.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "blur");
    const merge = f.append("feMerge");
    merge.append("feMergeNode").attr("in", "blur");
    merge.append("feMergeNode").attr("in", "SourceGraphic");

    // ── Zoom / pan ─────────────────────────────────────────────────────────
    const zoomG = svg.append("g");
    const zoomer = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 6])
      .on("zoom", ev => zoomG.attr("transform", ev.transform.toString()));
    svg.call(zoomer)
       .call(zoomer.transform, d3.zoomIdentity.translate(W / 2, H * 0.47).scale(0.9));
    svg.on("dblclick.zoom", null);

    const edgeLayer = zoomG.append("g");
    const nodeLayer = zoomG.append("g");

    // ── Simulation nodes ────────────────────────────────────────────────────
    const simNodes: SimNode[] = nodes.map(n => ({
      ...n,
      x: (Math.random() - 0.5) * 60,
      y: H * (LEVEL_Y[n.type] - 0.47) + (Math.random() - 0.5) * 25,
    }));
    const byId = new Map(simNodes.map(n => [n.id, n]));

    const simLinks: SimLink[] = edges
      .map(e => {
        const s = byId.get(e.source);
        const t = byId.get(e.target);
        return s && t ? ({ ...e, source: s, target: t } as SimLink) : null;
      })
      .filter((x): x is SimLink => x !== null);

    // ── Force simulation ────────────────────────────────────────────────────
    const sim = d3.forceSimulation(simNodes)
      .force("link",
        d3.forceLink<SimNode, SimLink>(simLinks)
          .id(d => d.id)
          .distance(d => {
            const s = d.source as SimNode;
            if (s.type === "mission") return 88;
            if (s.type === "gap")     return 74;
            return 60;
          })
          .strength(0.5))
      .force("charge", d3.forceManyBody<SimNode>().strength(-270))
      .force("y", d3.forceY<SimNode>(d => H * (LEVEL_Y[d.type] - 0.47)).strength(0.52))
      .force("x", d3.forceX<SimNode>(0).strength(0.09))
      .force("collide", d3.forceCollide<SimNode>(d => NODE_R[d.type] + 6));

    simRef.current = sim;

    // Pre-warm: 140 silent ticks → stable initial layout, no flying-in effect
    for (let i = 0; i < 140; i++) sim.tick();

    // ── Edges ───────────────────────────────────────────────────────────────
    const edgeSel = edgeLayer
      .selectAll<SVGLineElement, SimLink>("line")
      .data(simLinks, d => d.id)
      .enter().append("line")
      .attr("stroke",           d => EDGE_COLOR[d.type])
      .attr("stroke-width",     d => EDGE_W[d.type])
      .attr("stroke-dasharray", d => EDGE_DASH[d.type] ?? "none")
      .attr("stroke-opacity",   0.02)
      .attr("pointer-events",   "none")
      // Draw at pre-warmed positions
      .attr("x1", d => (d.source as SimNode).x ?? 0)
      .attr("y1", d => (d.source as SimNode).y ?? 0)
      .attr("x2", d => (d.target as SimNode).x ?? 0)
      .attr("y2", d => (d.target as SimNode).y ?? 0);

    edgeSelRef.current = edgeSel;

    // ── Drag ────────────────────────────────────────────────────────────────
    const drag = d3.drag<SVGGElement, SimNode>()
      .on("start", (ev, d) => {
        if (!ev.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on("drag",  (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
      .on("end",   (ev, d) => {
        if (!ev.active) sim.alphaTarget(0);
        d.fx = null; d.fy = null;
      });

    // ── Nodes ───────────────────────────────────────────────────────────────
    const nodeSel = nodeLayer
      .selectAll<SVGGElement, SimNode>("g")
      .data(simNodes, d => d.id)
      .enter().append("g")
      .attr("cursor",    "pointer")
      .attr("opacity",   0.05)
      .attr("transform", d => `translate(${d.x ?? 0},${d.y ?? 0})`)
      .call(drag)
      .on("click", (ev, d) => { ev.stopPropagation(); onClickRef.current(d); });

    // Glow ring — visible only when selected
    nodeSel.append("circle")
      .attr("class",          "glow-ring")
      .attr("r",              d => NODE_R[d.type] + 8)
      .attr("fill",           "none")
      .attr("stroke",         d => NODE_COLOR[d.type])
      .attr("stroke-width",   1.5)
      .attr("stroke-opacity", 0)
      .attr("filter",         "url(#fg-glow)");

    // Main circle
    nodeSel.append("circle")
      .attr("class",         "node-circle")
      .attr("r",             d => NODE_R[d.type])
      .attr("fill",          d => NODE_COLOR[d.type])
      .attr("fill-opacity",  0.10)
      .attr("stroke",        d => NODE_COLOR[d.type])
      .attr("stroke-width",  d => d.type === "mission" ? 2.5 : 1.5)
      .attr("stroke-opacity", 0.88);

    // Inner dot for mission (anchor visual)
    nodeSel.filter(d => d.type === "mission")
      .append("circle")
      .attr("r",            4)
      .attr("fill",         "#A371F7")
      .attr("fill-opacity", 0.45)
      .attr("pointer-events", "none");

    // Label
    nodeSel.append("text")
      .attr("text-anchor",   "middle")
      .attr("dy",            d => NODE_R[d.type] + 14)
      .attr("fill",          d => NODE_COLOR[d.type])
      .attr("fill-opacity",  0.88)
      .attr("font-size",     d => d.type === "mission" ? 10 : 8.5)
      .attr("font-weight",   d => d.type === "mission" ? "600" : "400")
      .attr("font-family",   "var(--font-geist-sans), system-ui, sans-serif")
      .attr("pointer-events", "none")
      .text(d => trunc(d.label, d.type === "mission" ? 24 : 18));

    nodeSelRef.current = nodeSel;

    // ── Tick ────────────────────────────────────────────────────────────────
    sim.on("tick", () => {
      edgeSel
        .attr("x1", d => (d.source as SimNode).x ?? 0)
        .attr("y1", d => (d.source as SimNode).y ?? 0)
        .attr("x2", d => (d.target as SimNode).x ?? 0)
        .attr("y2", d => (d.target as SimNode).y ?? 0);
      nodeSel.attr("transform", d => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    sim.alpha(0.35).restart();

    return () => {
      sim.stop();
      svg.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]); // Rebuild only on data change — not on visual state change

  // ── Visual state updates (cascade + selection) — no simulation touch ───────
  useEffect(() => {
    const nodeSel = nodeSelRef.current;
    const edgeSel = edgeSelRef.current;
    if (!nodeSel || !edgeSel) return;

    // Connected set for focus mode
    const connected = new Set<string>();
    if (selectedNodeId) {
      for (const e of edgesRef.current) {
        if (e.source === selectedNodeId) connected.add(e.target);
        if (e.target === selectedNodeId) connected.add(e.source);
      }
    }

    const dur = reducedMotion ? 0 : 250;

    nodeSel.each(function(d) {
      const s        = d3.select(this);
      const isChosen = d.id === selectedNodeId;
      const op       = nodeOp(d, cascadeStep, selectedNodeId, connected);

      s.transition().duration(dur).attr("opacity", op);

      s.select(".glow-ring")
        .transition().duration(dur)
        .attr("stroke-opacity", isChosen ? 1 : 0);

      s.select(".node-circle")
        .transition().duration(dur)
        .attr("fill-opacity", isChosen ? 0.26 : 0.10)
        .attr("stroke-width", isChosen ? 3 : d.type === "mission" ? 2.5 : 1.5);
    });

    edgeSel
      .transition().duration(dur)
      .attr("stroke-opacity", d => edgeOp(d.type, cascadeStep, selectedNodeId));

  }, [cascadeStep, selectedNodeId, reducedMotion]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", minHeight: 400, position: "relative" }}
      aria-label="Philos interactive force graph — Mission, Gap, Value, Capability, Provider network"
    />
  );
}
