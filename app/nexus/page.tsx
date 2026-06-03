"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FORCE_COLOR,
  FORCE_LABEL,
  CONTEXT_LABEL,
  LINK_COLOR,
  LINK_LABEL,
  loadNodes,
  clearNodes,
  saveNode,
  buildLinks,
  applyFilter,
  rankNodes,
  type UserNode,
  type DominantForce,
  type NodeContext,
  type Filter,
  type RankQuery,
  type Ranked,
  type Link,
  type LinkType,
} from "../lib/philos";
import { loadProfile, dominantBaseForce, type UserProfile } from "../lib/profile";
import { computeDailySummary, IMPACT_COLOR, IMPACT_LABEL, type DailySummary } from "../lib/daily";
import { computeMatches, URGENCY_COLOR, URGENCY_LABEL, type Match } from "../lib/match";
import {
  computeNeedFits,
  needSummary,
  NEED_LABEL,
  NEED_COLOR,
  type NeedFit,
  type NeedTag,
} from "../lib/need";
import {
  SEED_TOPICS,
  computeEdges,
  clusters as topicClustersFn,
  systemStress,
  generateSyntheticStances,
  saveStance,
  saveStances,
  loadStances,
  clearStances,
  RELATION_COLOR,
  RELATION_LABEL,
  type Topic,
  type Stance,
  type Edge as TopicEdge,
} from "../lib/topics";
import { generateSeedNodes } from "../lib/seed";
import {
  generateOpportunities, generateAllOpportunities,
  OPPORTUNITY_TYPE_LABEL, OPPORTUNITY_TYPE_COLOR,
  type RealOpportunity,
} from "../lib/opportunity";
import {
  loadProofs, computeReputation,
  REPUTATION_LEVEL_LABEL, REPUTATION_LEVEL_COLOR,
  type ProofItem,
} from "../lib/proof";
import LiveFeed from "./LiveFeed";
import GlobeLiveLayer from "./GlobeLiveLayer";
import DynamicsPanel from "./DynamicsPanel";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

// ─── Semantic color system (shared by nodes and links) ────────────────
const SEMANTIC_C = {
  green:  "#34d399",
  yellow: "#fbbf24",
  orange: "#fb923c",
  red:    "#ef4444",
  blue:   "#38bdf8",
  purple: "#a78bfa",
} as const;

function getNodeSemanticColor(n: UserNode, effectiveTrust?: number): string {
  const trust = effectiveTrust ?? n.trustScore;
  // Red: high-intensity regression or active conflict while going backward
  if (n.direction === "backward" && n.intensity >= 7)  return SEMANTIC_C.red;
  if (n.conflict   && n.direction === "backward")       return SEMANTIC_C.red;
  // Orange: any conflict or backward movement
  if (n.conflict   || n.direction === "backward")       return SEMANTIC_C.orange;
  // Green: forward + prosocial / high trust / strong intensity
  if (n.direction === "forward" &&
      (n.dominantForce === "social" || trust > 50 || n.intensity >= 7)) return SEMANTIC_C.green;
  if (n.direction === "forward" && n.dominantForce === "physical")       return SEMANTIC_C.green;
  // Blue: rational clarity
  if (n.dominantForce === "rational")                   return SEMANTIC_C.blue;
  // Purple: ego / superego depth
  if (n.dominantForce === "ego" || n.dominantForce === "superego") return SEMANTIC_C.purple;
  // Yellow: stuck or unknown
  return SEMANTIC_C.yellow;
}

const TOP_N = 5;
const ALL_LINK_TYPES: LinkType[] = ["alignment", "complementary", "influence", "opportunity"];

export default function Page() {
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [selected, setSelected]   = useState<UserNode | null>(null);
  const [selectedLink, setSelectedLink] = useState<Link | null>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [allNodes, setAllNodes] = useState<UserNode[]>([]);
  const [filter, setFilter] = useState<Filter>({});
  const [target, setTarget] = useState<RankQuery>({});

  const [linkTypeMask, setLinkTypeMask] = useState<Record<LinkType, boolean>>({
    alignment: true, complementary: true, influence: true, opportunity: true,
  });
  const [minStrength, setMinStrength] = useState(0);

  /* Topic / Debate Layer */
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [stances, setStances] = useState<Stance[]>([]);
  const [stressMode, setStressMode] = useState(false);

  useEffect(() => {
    if (!wrap.current) return;
    const el = wrap.current;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [allProofs, setAllProofs] = useState<ProofItem[]>([]);
  const [showFeed,     setShowFeed]     = useState(false);
  const [showDynamics, setShowDynamics] = useState(false);

  useEffect(() => {
    setAllNodes(loadNodes());
    setProfile(loadProfile());
    setStances(loadStances());
    setAllProofs(loadProofs());
  }, []);

  // Per-node proof-based trust: node.name matches ProofItem.userId
  const proofTrustMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const n of allNodes) {
      const nodeProofs = allProofs.filter(p => p.userId === n.name);
      if (nodeProofs.length > 0) {
        map[n.id] = Math.min(nodeProofs.reduce((s, p) => s + p.weight, 0), 100);
      }
    }
    return map;
  }, [allNodes, allProofs]);

  const activeTopic: Topic | null = useMemo(
    () => SEED_TOPICS.find(t => t.id === activeTopicId) ?? null,
    [activeTopicId],
  );

  const last = allNodes[allNodes.length - 1];

  /* effective target: user override > profile coords > last node */
  const effectiveTarget: RankQuery = useMemo(() => ({
    context:       target.context       ?? last?.context,
    dominantForce: target.dominantForce ?? last?.dominantForce,
    center:        target.center
                  ?? (profile ? { lat: profile.lat, lng: profile.lng } : undefined)
                  ?? (last ? { lat: last.lat, lng: last.lng } : undefined),
  }), [target, last, profile]);

  const visible = useMemo(() => applyFilter(allNodes, {
    ...filter,
    center: filter.maxDistanceKm
      ? (profile ? { lat: profile.lat, lng: profile.lng }
        : last    ? { lat: last.lat, lng: last.lng } : undefined)
      : undefined,
  }), [allNodes, filter, last, profile]);

  const ranked: Ranked[] = useMemo(
    () => rankNodes(visible, effectiveTarget),
    [visible, effectiveTarget],
  );

  const topIds = useMemo(() => new Set(ranked.slice(0, TOP_N).map(n => n.id)), [ranked]);

  const links = useMemo(() => buildLinks(visible), [visible]);

  const filteredLinks = useMemo(
    () => links.filter(l => linkTypeMask[l.type] && l.strength >= minStrength),
    [links, linkTypeMask, minStrength]
  );

  const arcs = useMemo(() => {
    const byId: Record<string, UserNode> = {};
    visible.forEach(n => (byId[n.id] = n));
    return filteredLinks
      .map(l => {
        const s = byId[l.source], t = byId[l.target];
        if (!s || !t) return null;
        const hot = topIds.has(s.id) || topIds.has(t.id);
        // pass proof-enhanced trust so high-proof nodes get green links
        const sWithTrust = proofTrustMap[s.id] !== undefined
          ? { ...s, trustScore: proofTrustMap[s.id] } : s;
        const tWithTrust = proofTrustMap[t.id] !== undefined
          ? { ...t, trustScore: proofTrustMap[t.id] } : t;
        const col = getLinkSemanticColor(l, sWithTrust, tWithTrust);
        return {
          _link: l,
          startLat: s.lat, startLng: s.lng,
          endLat: t.lat,   endLng: t.lng,
          color: [col, col],
          stroke: 0.25 + l.strength * 0.9 + (hot ? 0.3 : 0),
          altitude: 0.12 + l.strength * 0.15,
          dash: l.directional ? 0.25 : 0.6,
          gap:  l.directional ? 0.15 : 0.05,
          speed: l.directional ? 900 : 2500,
        };
      })
      .filter(Boolean) as any[];
  }, [visible, filteredLinks, topIds]);

  const summary = useMemo(() => {
    if (!visible.length) return null;
    const totalNodes = visible.length;
    const avgIntensity = visible.reduce((s, n) => s + n.intensity, 0) / totalNodes;
    const forceDist: Record<string, number> = {};
    visible.forEach(n => {
      forceDist[n.dominantForce] = (forceDist[n.dominantForce] || 0) + 1;
    });
    const activeConflicts = visible.filter(n => n.conflict).length;
    const forwardMovementRatio =
      visible.filter(n => n.direction === "forward").length / totalNodes;
    return { totalNodes, avgIntensity, forceDist, activeConflicts, forwardMovementRatio };
  }, [visible]);

  const daily: DailySummary = useMemo(() => computeDailySummary(allNodes), [allNodes]);

  // ── Pulse: 4 system-wide vitals ──────────────────────────────────
  const pulse = useMemo(() => {
    const n = visible.length;
    if (!n) return null;
    const energy   = Math.round(visible.reduce((s, x) => s + x.intensity, 0) / n * 10);
    const trust    = Math.round(visible.reduce((s, x) => s + (proofTrustMap[x.id] ?? x.trustScore), 0) / n);
    const stressN  = visible.filter(x => x.conflict || x.direction === "backward").length;
    const stress   = Math.round((stressN / n) * 100);
    const todayN   = visible.filter(x => Date.now() - x.createdAt < 86_400_000).length;
    const activity = Math.round((Math.max(todayN, 1) / n) * 100);
    const fd: Record<string, number> = {};
    visible.forEach(x => { fd[x.dominantForce] = (fd[x.dominantForce] || 0) + 1; });
    const dominant = Object.entries(fd).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "emotional";
    return { energy, trust, stress, activity, dominant, fd, total: n };
  }, [visible, proofTrustMap]);

  // ── What Changed Today (last 24h) ────────────────────────────────
  const todayStats = useMemo(() => {
    const cut = Date.now() - 86_400_000;
    const newNodes = visible.filter(x => x.createdAt > cut).length;
    const newProofsCount = allProofs.filter(p => p.createdAt > cut).length;
    const newVerified = allProofs.filter(p => p.status === "verified" && p.createdAt > cut).length;
    const newOpps = visible.filter(x => {
      const t = proofTrustMap[x.id] ?? x.trustScore;
      return t >= 20;
    }).length;
    return { newNodes, newProofsCount, newVerified, newOpps };
  }, [visible, allProofs, proofTrustMap]);

  // ── Real Opportunities ───────────────────────────────────────────
  const systemOpportunities = useMemo(() =>
    generateAllOpportunities(visible, proofTrustMap, 8),
    [visible, proofTrustMap]
  );

  const selectedOpportunities = useMemo(() =>
    selected ? generateOpportunities(selected, visible, proofTrustMap).slice(0, 4) : [],
    [selected, visible, proofTrustMap]
  );

  const matches: Match[] = useMemo(
    () => computeMatches(visible, profile).slice(0, 5),
    [visible, profile],
  );

  const needFits: NeedFit[] = useMemo(
    () => computeNeedFits(visible).slice(0, 5),
    [visible],
  );

  const selectedNeeds = useMemo(
    () => selected ? needSummary(selected) : null,
    [selected],
  );

  /* topic layer */
  const topicEdges: TopicEdge[] = useMemo(
    () => activeTopic ? computeEdges(activeTopic, stances) : [],
    [activeTopic, stances],
  );

  const topicClusters = useMemo(
    () => activeTopic ? topicClustersFn(activeTopic, stances) : [],
    [activeTopic, stances],
  );

  const stress = useMemo(() => systemStress(topicEdges), [topicEdges]);

  const topTensions = useMemo(
    () => [...topicEdges]
      .filter(e => e.relation !== "agree")
      .sort((a, b) => b.dist - a.dist)
      .slice(0, 5),
    [topicEdges],
  );

  /* topic arcs (render when a topic is active — replace normal arcs) */
  const topicArcs = useMemo(() => {
    if (!activeTopic) return [];
    const byId: Record<string, UserNode> = {};
    visible.forEach(n => (byId[n.id] = n));
    return topicEdges
      .map(e => {
        const a = byId[e.a], b = byId[e.b];
        if (!a || !b) return null;
        const col = RELATION_COLOR[e.relation];
        const dimmed = stressMode && e.relation !== "conflict";
        return {
          _topicEdge: e,
          startLat: a.lat, startLng: a.lng,
          endLat:   b.lat, endLng:   b.lng,
          color: dimmed ? [col + "22", col + "22"] : [col, col],
          stroke: 0.25 + e.closeness * 0.5 + (e.relation === "conflict" ? e.dist * 0.6 : 0),
          altitude: 0.10 + e.dist * 0.25,
          dash: e.relation === "conflict" ? 0.2 : 0.6,
          gap:  e.relation === "conflict" ? 0.15 : 0.05,
          speed: e.relation === "conflict" ? 700 : 2500,
        };
      })
      .filter(Boolean) as any[];
  }, [activeTopic, topicEdges, visible, stressMode]);

  /* profile as anchor point (special node) */
  const profileAnchor = useMemo(() => {
    if (!profile) return null;
    const force = dominantBaseForce(profile);
    return {
      _anchor: true,
      id: "__profile__",
      name: profile.name || "אני",
      lat: profile.lat,
      lng: profile.lng,
      color: FORCE_COLOR[force],
      force,
      age: profile.age,
      location: profile.location,
    };
  }, [profile]);

  /* combined points: anchor + ranked nodes */
  const pointsData = useMemo(() => {
    const arr: any[] = [];
    if (profileAnchor) arr.push(profileAnchor);
    arr.push(...ranked);
    return arr;
  }, [profileAnchor, ranked]);

  /* connections for selected node (for Pentagon panel) */
  const selectedConnections = useMemo(() => {
    if (!selected) return [];
    const byId: Record<string, UserNode> = {};
    visible.forEach(n => (byId[n.id] = n));
    return links
      .filter(l => l.source === selected.id || l.target === selected.id)
      .map(l => {
        const otherId = l.source === selected.id ? l.target : l.source;
        return { link: l, other: byId[otherId] };
      })
      .filter(c => !!c.other)
      .sort((a, b) => b.link.strength - a.link.strength);
  }, [selected, links, visible]);

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", background: "#020d1a", color: "#e0f2fe", fontFamily: "system-ui, sans-serif" }}>
      <div ref={wrap} style={{ flex: 1, position: "relative" }}>

        {/* ── PULSE BAR ── */}
        {pulse && (
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, zIndex: 8,
            background: "rgba(2,13,26,0.88)",
            backdropFilter: "blur(10px)",
            borderBottom: "1px solid #0a2a4a",
            display: "flex", alignItems: "center",
            height: 42, padding: "0 14px",
          }}>
            {[
              { label: "אנרגיה", val: pulse.energy,   color: "#fbbf24" },
              { label: "אמון",   val: pulse.trust,    color: "#34d399" },
              { label: "מתח",    val: pulse.stress,   color: "#f87171" },
              { label: "פעילות", val: pulse.activity, color: "#38bdf8" },
            ].map(m => (
              <div key={m.label} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: m.color, lineHeight: 1 }}>{m.val}</div>
                <div style={{ fontSize: 8, color: "#1e4060", letterSpacing: 1 }}>{m.label}</div>
              </div>
            ))}
            <div style={{ width: 1, height: 24, background: "#0a2a4a", margin: "0 8px" }} />
            <div style={{ fontSize: 9, color: FORCE_COLOR[pulse.dominant as DominantForce] ?? "#38bdf8", letterSpacing: 1 }}>
              {FORCE_LABEL[pulse.dominant as DominantForce] ?? pulse.dominant}
            </div>
          </div>
        )}

        {/* LAST ACTION OVERLAY */}
        {last && (
          <div
            style={{
              position: "absolute", top: pulse ? 50 : 20, left: 20, right: 340, zIndex: 5,
              background: "rgba(3,15,30,0.85)",
              border: `1px solid ${FORCE_COLOR[last.dominantForce]}55`,
              backdropFilter: "blur(8px)",
              borderRadius: 8, padding: "14px 18px",
              pointerEvents: "none", maxWidth: 560,
            }}
          >
            <div style={{ fontSize: 9, letterSpacing: 3, color: FORCE_COLOR[last.dominantForce], textTransform: "uppercase", marginBottom: 6 }}>
              Last action · {last.name}
            </div>
            <div style={{ fontSize: 16, color: "#00f5d4", fontWeight: 700, marginBottom: 8 }}>
              {last.action}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 10, color: "#8bb8cc" }}>
              <span>force: <b style={{ color: FORCE_COLOR[last.dominantForce] }}>{FORCE_LABEL[last.dominantForce]}</b></span>
              <span>context: <b style={{ color: "#e0f2fe" }}>{CONTEXT_LABEL[last.context]}</b></span>
              <span>intensity: <b style={{ color: "#e0f2fe" }}>{last.intensity}/10</b></span>
              <span>impact: <b style={{ color: "#e0f2fe" }}>{last.impact}</b></span>
              <span>trust: <b style={{ color: "#e0f2fe" }}>{last.trustScore}</b></span>
              {last.conflict && <span>conflict: <b style={{ color: "#ef4444" }}>{last.conflict}</b></span>}
            </div>
          </div>
        )}

        {/* LINK TYPE LEGEND */}
        <div style={{
          position: "absolute", bottom: 20, left: 20, zIndex: 5,
          background: "rgba(3,15,30,0.85)", border: "1px solid #0a2a4a",
          backdropFilter: "blur(8px)", borderRadius: 8, padding: "10px 12px",
        }}>
          <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
            {activeTopic ? `קווים · ${activeTopic.title}` : "קווים"}
          </div>

          {/* Semantic color legend */}
          {!activeTopic && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #0a2a4a" }}>
              {SEMANTIC_LEGEND.map(({ color, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <span style={{ width: 12, height: 3, borderRadius: 2, background: color, display: "inline-block" }} />
                  <span style={{ fontSize: 9, color }}>{label}</span>
                </div>
              ))}
            </div>
          )}

          {activeTopic ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["agree", "tension", "conflict"] as const).map(r => (
                <span key={r} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "4px 8px", fontSize: 10,
                  border: `1px solid ${RELATION_COLOR[r]}`,
                  background: `${RELATION_COLOR[r]}22`,
                  color: RELATION_COLOR[r],
                  borderRadius: 4,
                }}>
                  <span style={{ width: 10, height: 3, background: RELATION_COLOR[r], borderRadius: 2 }} />
                  {RELATION_LABEL[r]}
                </span>
              ))}
            </div>
          ) : (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {ALL_LINK_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setLinkTypeMask(m => ({ ...m, [t]: !m[t] }))}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "4px 8px", fontSize: 10,
                  border: `1px solid ${linkTypeMask[t] ? LINK_COLOR[t] : "#0a2a4a"}`,
                  background: linkTypeMask[t] ? `${LINK_COLOR[t]}22` : "transparent",
                  color: linkTypeMask[t] ? LINK_COLOR[t] : "#8bb8cc",
                  borderRadius: 4, cursor: "pointer",
                  opacity: linkTypeMask[t] ? 1 : 0.5,
                }}
              >
                <span style={{ width: 10, height: 3, background: LINK_COLOR[t], borderRadius: 2 }} />
                {LINK_LABEL[t]}
              </button>
            ))}
          </div>
          )}

          {!activeTopic && (
            <>
              <div style={{ marginTop: 8, fontSize: 9, color: "#8bb8cc" }}>
                min strength: <b style={{ color: "#38bdf8" }}>{minStrength.toFixed(2)}</b>
              </div>
              <input
                type="range" min={0} max={1} step={0.05}
                value={minStrength}
                onChange={e => setMinStrength(Number(e.target.value))}
                style={{ width: 180, accentColor: "#38bdf8" }}
              />
            </>
          )}
        </div>

        {/* LINK REASON CARD */}
        {selectedLink && (
          <div style={{
            position: "absolute", bottom: 20, right: 340, zIndex: 5,
            background: "rgba(3,15,30,0.92)",
            border: `1px solid ${LINK_COLOR[selectedLink.type]}aa`,
            borderRadius: 8, padding: "12px 14px", maxWidth: 340,
            boxShadow: `0 0 18px ${LINK_COLOR[selectedLink.type]}44`,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 10, letterSpacing: 2, color: LINK_COLOR[selectedLink.type], textTransform: "uppercase" }}>
                {LINK_LABEL[selectedLink.type]}
              </span>
              <button onClick={() => setSelectedLink(null)} style={{
                background: "transparent", border: "none", color: "#8bb8cc", cursor: "pointer", fontSize: 14,
              }}>×</button>
            </div>
            <div style={{ fontSize: 12, color: "#e0f2fe", marginBottom: 6 }}>{selectedLink.reason}</div>
            <div style={{ fontSize: 10, color: "#8bb8cc" }}>
              strength: <b style={{ color: LINK_COLOR[selectedLink.type] }}>{selectedLink.strength.toFixed(2)}</b>
              {selectedLink.directional && <span> · directional →</span>}
            </div>
          </div>
        )}

        {!allNodes.length && (
          <div
            style={{
              position: "absolute", top: 20, left: 20, zIndex: 5,
              background: "rgba(3,15,30,0.75)",
              border: "1px solid #0a2a4a", backdropFilter: "blur(8px)",
              borderRadius: 8, padding: "12px 16px",
              fontSize: 11, color: "#8bb8cc",
            }}
          >
            אין עדיין נודים. מלא את הטופס ב־<a href="/" style={{ color: "#38bdf8" }}>דף הבית</a>.
          </div>
        )}

        {size.w > 0 && (
          <Globe
            width={size.w}
            height={size.h}
            globeImageUrl="https://unpkg.com/three-globe/example/img/earth-dark.jpg"
            backgroundColor="#020d1a"
            atmosphereColor="#38bdf8"
            atmosphereAltitude={0.18}
            pointsData={pointsData}
            pointLat={(d: any) => d.lat}
            pointLng={(d: any) => d.lng}
            pointColor={(d: any) => d._anchor ? d.color : getNodeSemanticColor(d as UserNode, proofTrustMap[(d as UserNode).id])}
            pointAltitude={(d: any) => {
              if (d._anchor) return 0.06;
              const base = d.intensity / 10;
              return topIds.has(d.id) ? base + 0.15 : base;
            }}
            pointRadius={(d: any) => {
              if (d._anchor) return 1.4;
              const base = 0.4 + d.intensity / 20;
              return topIds.has(d.id) ? base * 1.9 : base * (topIds.size ? 0.7 : 1);
            }}
            pointLabel={(d: any) => {
              if (d._anchor) {
                return `<div style="font-family:system-ui;padding:4px 2px">
                  <b style="color:${d.color}">⚓ ${escapeHtml(d.name)}</b> · ${d.age}<br/>
                  <span style="color:#8bb8cc">${escapeHtml(d.location || "")}</span><br/>
                  <span style="color:#fbbf24">base force: ${FORCE_LABEL[d.force as DominantForce]}</span>
                </div>`;
              }
              return `<div style="font-family:system-ui;padding:4px 2px">
                <b>${escapeHtml(d.name)}</b> <span style="color:#38bdf8">#${d.rank}</span><br/>
                ${FORCE_LABEL[d.dominantForce as DominantForce]} · ${CONTEXT_LABEL[d.context as NodeContext]}<br/>
                <span style="color:#fbbf24">score ${d.score.toFixed(2)}</span><br/>
                <span style="color:#00f5d4">${escapeHtml(d.action)}</span>
              </div>`;
            }}
            onPointClick={(p: any) => {
              if (p._anchor) return; // anchor is non-selectable
              setSelected(p);
              setSelectedLink(null);
            }}
            arcsData={activeTopic ? topicArcs : arcs}
            arcStartLat={(d: any) => d.startLat}
            arcStartLng={(d: any) => d.startLng}
            arcEndLat={(d: any) => d.endLat}
            arcEndLng={(d: any) => d.endLng}
            arcColor={(d: any) => d.color}
            arcStroke={(d: any) => d.stroke}
            arcAltitude={(d: any) => d.altitude}
            arcDashLength={(d: any) => d.dash}
            arcDashGap={(d: any) => d.gap}
            arcDashAnimateTime={(d: any) => d.speed}
            arcLabel={(d: any) => {
              if (d._topicEdge) {
                const e: TopicEdge = d._topicEdge;
                const biggest = e.axisDiffs[0];
                return `<div style="font-family:system-ui;padding:4px 2px">
                  <b style="color:${RELATION_COLOR[e.relation]}">${RELATION_LABEL[e.relation]}</b><br/>
                  dist ${e.dist.toFixed(2)} · closeness ${e.closeness.toFixed(2)}<br/>
                  <span style="color:#8bb8cc">פער מוביל: ${escapeHtml(biggest.key)} (${biggest.diff.toFixed(2)})</span>
                </div>`;
              }
              const l: Link = d._link;
              return `<div style="font-family:system-ui;padding:4px 2px">
                <b style="color:${LINK_COLOR[l.type]}">${LINK_LABEL[l.type]}</b><br/>
                ${escapeHtml(l.reason)}<br/>
                <span style="color:#8bb8cc">strength ${l.strength.toFixed(2)}</span>
              </div>`;
            }}
            onArcClick={(d: any) => {
              if (d._link) setSelectedLink(d._link);
            }}
          />
        )}

        {/* ── GLOBE LIVE LAYER ── */}
        <GlobeLiveLayer proofTrustMap={proofTrustMap} />

      </div>

      {/* SIDE PANEL */}
      <div style={{ width: 320, background: "#030f1e", borderLeft: "1px solid #0a2a4a", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Panel header + Feed toggle */}
        <div style={{ padding: "14px 20px 10px", borderBottom: "1px solid #0a2a4a", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, letterSpacing: 4, color: "#38bdf8", fontWeight: 700, marginBottom: 2 }}>
              PHILOS · NEXUS
            </div>
            <div style={{ fontSize: 10, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase" }}>
              {visible.length}/{allNodes.length} nodes · {filteredLinks.length} links
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => { setShowFeed(f => !f); setShowDynamics(false); }}
              style={{ padding: "4px 8px", borderRadius: 4, fontSize: 9, cursor: "pointer", fontWeight: 600, border: `1px solid ${showFeed ? "#38bdf8" : "#1e4060"}`, background: showFeed ? "#38bdf822" : "transparent", color: showFeed ? "#38bdf8" : "#1e4060" }}>
              ⚡ Feed
            </button>
            <button onClick={() => { setShowDynamics(d => !d); setShowFeed(false); }}
              style={{ padding: "4px 8px", borderRadius: 4, fontSize: 9, cursor: "pointer", fontWeight: 600, border: `1px solid ${showDynamics ? "#a78bfa" : "#1e4060"}`, background: showDynamics ? "#a78bfa22" : "transparent", color: showDynamics ? "#a78bfa" : "#1e4060" }}>
              ◈ Dynamics
            </button>
          </div>
        </div>

        {/* Feed / Dynamics / regular panels */}
        {showFeed ? (
          <div style={{ flex: 1, overflow: "hidden" }}>
            <LiveFeed />
          </div>
        ) : showDynamics ? (
          <div style={{ flex: 1, overflow: "hidden" }}>
            <DynamicsPanel
            selected={selected}
            allNodes={visible}
            proofTrustMap={proofTrustMap}
            onTransition={transition => {
              // Reload nodes so globe + panels refresh
              setAllNodes(loadNodes());
              // Update selected to the new node state so panel stays live
              setSelected(transition.updatedNode);
            }}
          />
          </div>
        ) : (
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        <div style={{ marginBottom: 18 }} />

        {/* PROFILE ANCHOR */}
        {profile && (
          <div style={{
            padding: 12, borderRadius: 6, marginBottom: 16,
            border: `1px solid ${FORCE_COLOR[dominantBaseForce(profile)]}55`,
            background: "#040e1c",
          }}>
            <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
              Anchor · אתה
            </div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{profile.name}</div>
            <div style={{ fontSize: 10, color: "#8bb8cc", marginBottom: 6 }}>
              {profile.age} · {profile.location || "—"}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Pill color={FORCE_COLOR[dominantBaseForce(profile)]}>
                base: {FORCE_LABEL[dominantBaseForce(profile)]}
              </Pill>
              <Pill color="#a78bfa">
                אישי↔חברתי: {profile.personalVsSocial > 0 ? "+" : ""}{profile.personalVsSocial}
              </Pill>
              <Pill color="#00f5d4">
                צמיחה: {profile.growthCoefficient > 0 ? "+" : ""}{profile.growthCoefficient.toFixed(2)}
              </Pill>
            </div>
            <a href="/profile" style={{ display: "inline-block", marginTop: 8, fontSize: 10, color: "#38bdf8" }}>
              → ערוך פרופיל
            </a>
          </div>
        )}

        {!profile && (
          <a href="/profile" style={{
            display: "block", padding: 12, marginBottom: 16,
            border: "1px solid #fbbf2466", borderRadius: 6,
            background: "#fbbf2411", color: "#fbbf24",
            fontSize: 11, textDecoration: "none", textAlign: "center",
          }}>
            → צור פרופיל להיות מסומן בגלובוס
          </a>
        )}

        {/* DAILY SUMMARY */}
        <div style={{ padding: 12, border: `1px solid ${IMPACT_COLOR[daily.impact]}55`, borderRadius: 6, background: "#040e1c", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase" }}>
              סיכום יום
            </span>
            <span style={{
              fontSize: 9, padding: "2px 6px", borderRadius: 10,
              background: `${IMPACT_COLOR[daily.impact]}22`,
              color: IMPACT_COLOR[daily.impact],
              border: `1px solid ${IMPACT_COLOR[daily.impact]}66`,
            }}>
              {IMPACT_LABEL[daily.impact]}
            </span>
          </div>

          <ScoreBar label="personal" value={daily.personalScore} color="#38bdf8" />
          <ScoreBar label="social"   value={daily.socialScore}   color="#fb923c" />
          <ScoreBar label="value"    value={daily.valueScore}    color={IMPACT_COLOR[daily.impact]} />

          <div style={{ marginTop: 10, fontSize: 10, color: "#8bb8cc", lineHeight: 1.5 }}>
            <div>avg intensity: <b style={{ color: "#e0f2fe" }}>{daily.avgIntensity.toFixed(1)}</b> · forward: <b style={{ color: "#e0f2fe" }}>{Math.round(daily.forwardRatio * 100)}%</b></div>
            <div>links: <b style={{ color: "#e0f2fe" }}>{daily.linksCreated}</b> · help: <b style={{ color: "#e0f2fe" }}>{daily.helpGiven}</b></div>
          </div>

          <div style={{ marginTop: 10, padding: "8px 10px", background: `${IMPACT_COLOR[daily.impact]}11`, borderRadius: 4 }}>
            <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
              המלצה
            </div>
            <div style={{ fontSize: 11, color: "#e0f2fe", lineHeight: 1.4 }}>
              {daily.recommendation}
            </div>
          </div>
        </div>

        {/* MATCHES */}
        {matches.length > 0 && (
          <div style={{ padding: 12, border: "1px solid #ef444455", borderRadius: 6, background: "#040e1c", marginBottom: 16 }}>
            <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
              Match · מי צריך את מי
            </div>
            {matches.map((m, i) => (
              <div
                key={m.a.id + m.b.id}
                onClick={() => { setSelected(m.a); setSelectedLink(m.link); }}
                style={{
                  padding: "8px 10px", marginBottom: 6,
                  border: `1px solid ${URGENCY_COLOR[m.urgency]}55`,
                  background: `${URGENCY_COLOR[m.urgency]}0e`,
                  borderRadius: 6, cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "#e0f2fe", fontWeight: 700 }}>
                    {m.a.name} {m.link.directional ? "→" : "↔"} {m.b.name}
                  </span>
                  <span style={{
                    fontSize: 8, padding: "2px 6px", borderRadius: 8,
                    background: `${URGENCY_COLOR[m.urgency]}22`,
                    color: URGENCY_COLOR[m.urgency],
                    border: `1px solid ${URGENCY_COLOR[m.urgency]}66`,
                    letterSpacing: 1, textTransform: "uppercase",
                  }}>
                    {URGENCY_LABEL[m.urgency]} · {(m.score * 100).toFixed(0)}
                  </span>
                </div>
                <div style={{ fontSize: 9, color: "#8bb8cc", marginBottom: 4 }}>{m.reason}</div>
                <div style={{ fontSize: 10, color: "#00f5d4", fontStyle: "italic" }}>
                  → {m.suggestion}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* DEBATE LAYER — Topic Stances */}
        <div style={{
          padding: 12, borderRadius: 6, marginBottom: 16,
          border: `1px solid ${activeTopic ? activeTopic.color + "88" : "#0a2a4a"}`,
          background: "#040e1c",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase" }}>
              Debate · דיון ציבורי
            </span>
            {activeTopic && (
              <span style={{
                fontSize: 9, padding: "2px 6px", borderRadius: 8,
                background: `${activeTopic.color}22`, color: activeTopic.color,
                border: `1px solid ${activeTopic.color}66`,
              }}>
                {topicEdges.length} edges
              </span>
            )}
          </div>

          <Label>נושא</Label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 10 }}>
            <MiniChip active={!activeTopicId} onClick={() => setActiveTopicId(null)} color="#38bdf8">
              כבוי
            </MiniChip>
            {SEED_TOPICS.map(t => (
              <MiniChip
                key={t.id}
                active={activeTopicId === t.id}
                onClick={() => setActiveTopicId(t.id)}
                color={t.color}
              >
                {t.title}
              </MiniChip>
            ))}
          </div>

          {activeTopic && (
            <>
              {/* axes legend */}
              <div style={{
                padding: "6px 8px", borderRadius: 4,
                background: `${activeTopic.color}0e`,
                border: `1px solid ${activeTopic.color}33`,
                marginBottom: 8,
              }}>
                {activeTopic.axes.map(ax => (
                  <div key={ax.key} style={{
                    display: "flex", justifyContent: "space-between",
                    fontSize: 9, color: "#8bb8cc", marginBottom: 2,
                  }}>
                    <span>{ax.left}</span>
                    <span style={{ color: "#1e4060" }}>↔</span>
                    <span>{ax.right}</span>
                  </div>
                ))}
              </div>

              {/* system stress meter */}
              <div style={{ marginBottom: 8 }}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  fontSize: 10, color: "#8bb8cc", marginBottom: 3,
                }}>
                  <span>system stress</span>
                  <b style={{ color: stress > 0.5 ? "#ef4444" : stress > 0.25 ? "#fb923c" : "#22c55e" }}>
                    {(stress * 100).toFixed(0)}%
                  </b>
                </div>
                <div style={{ height: 4, background: "#0a2a4a", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{
                    width: `${Math.max(0, Math.min(100, stress * 100))}%`,
                    height: "100%",
                    background: stress > 0.5 ? "#ef4444" : stress > 0.25 ? "#fb923c" : "#22c55e",
                  }} />
                </div>
              </div>

              <button
                onClick={() => setStressMode(m => !m)}
                style={{
                  width: "100%", marginBottom: 8,
                  padding: "6px 8px", fontSize: 10, letterSpacing: 1,
                  color: stressMode ? "#ef4444" : "#8bb8cc",
                  background: stressMode ? "#ef444411" : "transparent",
                  border: `1px solid ${stressMode ? "#ef444488" : "#0a2a4a"}`,
                  borderRadius: 4, cursor: "pointer",
                }}
              >
                {stressMode ? "✓ Show system stress" : "Show system stress"}
              </button>

              {/* clusters */}
              {topicClusters.length > 0 && (
                <div style={{ fontSize: 10, color: "#8bb8cc", marginBottom: 8 }}>
                  קלאסטרים: {topicClusters.map(c => c.userIds.length).join(" · ")}
                  <span style={{ color: "#1e4060" }}> ({topicClusters.length} קבוצות)</span>
                </div>
              )}

              {/* top tensions */}
              {topTensions.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
                    מתחים מובילים
                  </div>
                  {topTensions.map(e => {
                    const byId: Record<string, UserNode> = {};
                    visible.forEach(n => (byId[n.id] = n));
                    const a = byId[e.a], b = byId[e.b];
                    if (!a || !b) return null;
                    return (
                      <div
                        key={e.a + e.b}
                        onClick={() => setSelected(a)}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "4px 6px", marginBottom: 3,
                          border: `1px solid ${RELATION_COLOR[e.relation]}44`,
                          background: `${RELATION_COLOR[e.relation]}0e`,
                          borderRadius: 4, fontSize: 10, cursor: "pointer",
                        }}
                      >
                        <span style={{ color: "#e0f2fe", flex: 1 }}>
                          {a.name} ↔ {b.name}
                        </span>
                        <span style={{ color: RELATION_COLOR[e.relation], fontSize: 9 }}>
                          {RELATION_LABEL[e.relation]}
                        </span>
                        <b style={{ color: "#38bdf8", fontSize: 10 }}>{e.dist.toFixed(2)}</b>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => {
                const fresh = generateSyntheticStances(allNodes);
                const merged = saveStances(fresh);
                setStances(merged);
                if (!activeTopicId) setActiveTopicId(SEED_TOPICS[0].id);
              }}
              style={{
                flex: 1,
                padding: "6px 8px", fontSize: 9, letterSpacing: 1,
                color: "#a78bfa", background: "transparent",
                border: "1px dashed #a78bfa66", borderRadius: 4, cursor: "pointer",
              }}
            >
              סנכרן עמדות (synthetic)
            </button>
            <button
              onClick={() => { clearStances(); setStances([]); }}
              style={{
                padding: "6px 8px", fontSize: 9,
                color: "#8bb8cc", background: "transparent",
                border: "1px solid #0a2a4a", borderRadius: 4, cursor: "pointer",
              }}
            >
              נקה
            </button>
          </div>
        </div>

        {/* NEED FITS — חוסר ↔ השלמה */}
        {needFits.length > 0 && (
          <div style={{ padding: 12, border: "1px solid #a78bfa55", borderRadius: 6, background: "#040e1c", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase" }}>
                Need · חוסר ↔ השלמה
              </span>
              <span style={{ fontSize: 9, color: "#a78bfa" }}>
                {needFits.filter(f => f.bidirectional).length} הדדיים
              </span>
            </div>
            {needFits.map(f => (
              <div
                key={f.a.id + "_" + f.b.id}
                onClick={() => setSelected(f.a)}
                style={{
                  padding: "8px 10px", marginBottom: 6,
                  border: `1px solid ${f.bidirectional ? "#a78bfa88" : "#a78bfa33"}`,
                  background: f.bidirectional ? "#a78bfa14" : "#a78bfa07",
                  borderRadius: 6, cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "#e0f2fe", fontWeight: 700 }}>
                    {f.a.name} {f.bidirectional ? "⇌" : f.matched.aGetsFromB.length ? "←" : "→"} {f.b.name}
                  </span>
                  <span style={{
                    fontSize: 8, padding: "2px 6px", borderRadius: 8,
                    background: "#a78bfa22", color: "#a78bfa",
                    border: "1px solid #a78bfa66",
                    letterSpacing: 1, textTransform: "uppercase",
                  }}>
                    {f.bidirectional ? "הדדי" : "חד-צדדי"} · {(f.score * 100).toFixed(0)}
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
                  {f.matched.aGetsFromB.map(t => (
                    <NeedPill key={"a" + t} tag={t} dir="in" />
                  ))}
                  {f.matched.bGetsFromA.map(t => (
                    <NeedPill key={"b" + t} tag={t} dir="out" />
                  ))}
                </div>
                <div style={{ fontSize: 9, color: "#8bb8cc", marginBottom: 2 }}>
                  {f.reason}
                </div>
                <div style={{ fontSize: 10, color: "#00f5d4", fontStyle: "italic" }}>
                  → {f.suggestion}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* FORCE MAP */}
        {pulse && (
          <div style={{ padding: 12, border: "1px solid #0a2a4a", borderRadius: 6, background: "#040e1c", marginBottom: 16 }}>
            <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
              Map of Forces
            </div>
            {Object.entries(pulse.fd)
              .sort((a, b) => b[1] - a[1])
              .map(([f, c]) => {
                const pct = Math.round((c / pulse.total) * 100);
                const col = FORCE_COLOR[f as DominantForce] ?? "#38bdf8";
                return (
                  <div key={f} style={{ marginBottom: 5 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: col, marginBottom: 2 }}>
                      <span>{FORCE_LABEL[f as DominantForce] ?? f}</span>
                      <span>{pct}%</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: "#0a2a4a", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: col, borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })
            }
            <div style={{ marginTop: 8, display: "flex", gap: 8, fontSize: 9, color: "#8bb8cc" }}>
              <span>total: {pulse.total}</span>
              <span>energy: {pulse.energy}</span>
              <span>stress: {pulse.stress}%</span>
            </div>
          </div>
        )}

        {/* WHAT CHANGED TODAY */}
        <div style={{ padding: 12, border: "1px solid #0a2a4a", borderRadius: 6, background: "#040e1c", marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
            שינויים היום
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {[
              { label: "נקודות חדשות",   val: todayStats.newNodes,       color: "#38bdf8" },
              { label: "הוכחות חדשות",   val: todayStats.newProofsCount, color: "#fbbf24" },
              { label: "אימותים",         val: todayStats.newVerified,    color: "#34d399" },
              { label: "הזדמנויות פתוחות",val: todayStats.newOpps,        color: "#a78bfa" },
            ].map(s => (
              <div key={s.label} style={{ padding: "6px 8px", borderRadius: 4, border: `1px solid ${s.color}22`, background: s.color + "08" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 8, color: "#1e4060" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* REAL OPPORTUNITIES */}
        {systemOpportunities.length > 0 && (
          <div style={{ padding: 12, border: "1px solid #0a2a4a", borderRadius: 6, background: "#040e1c", marginBottom: 16 }}>
            <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
              הזדמנויות אמיתיות
            </div>
            {systemOpportunities.map(opp => (
              <OppCard key={opp.id} opp={opp} />
            ))}
          </div>
        )}

        {/* TARGET */}
        <div style={{ padding: 12, border: "1px solid #0a2a4a", borderRadius: 6, background: "#040e1c", marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
            Target · מול מי מדרגים
          </div>

          <Label>context</Label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4, marginBottom: 10 }}>
            <MiniChip active={!target.context} onClick={() => setTarget(t => ({ ...t, context: undefined }))} color="#38bdf8">אוטו</MiniChip>
            {(Object.keys(CONTEXT_LABEL) as NodeContext[]).map(c => (
              <MiniChip key={c} active={target.context === c} onClick={() => setTarget(t => ({ ...t, context: c }))} color="#38bdf8">
                {CONTEXT_LABEL[c]}
              </MiniChip>
            ))}
          </div>

          <Label>force</Label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4 }}>
            <MiniChip active={!target.dominantForce} onClick={() => setTarget(t => ({ ...t, dominantForce: undefined }))} color="#38bdf8">אוטו</MiniChip>
            {(Object.keys(FORCE_COLOR) as DominantForce[]).map(f => (
              <MiniChip key={f} active={target.dominantForce === f} onClick={() => setTarget(t => ({ ...t, dominantForce: f }))} color={FORCE_COLOR[f]}>
                {FORCE_LABEL[f]}
              </MiniChip>
            ))}
          </div>
        </div>

        {/* FILTER */}
        <div style={{ padding: 12, border: "1px solid #0a2a4a", borderRadius: 6, background: "#040e1c", marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
            Filter
          </div>

          <Label>context</Label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4, marginBottom: 10 }}>
            <MiniChip active={!filter.context} onClick={() => setFilter(f => ({ ...f, context: undefined }))} color="#38bdf8">הכל</MiniChip>
            {(Object.keys(CONTEXT_LABEL) as NodeContext[]).map(c => (
              <MiniChip key={c} active={filter.context === c} onClick={() => setFilter(f => ({ ...f, context: c }))} color="#38bdf8">
                {CONTEXT_LABEL[c]}
              </MiniChip>
            ))}
          </div>

          <Label>force</Label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4, marginBottom: 10 }}>
            <MiniChip active={!filter.dominantForce} onClick={() => setFilter(f => ({ ...f, dominantForce: undefined }))} color="#38bdf8">הכל</MiniChip>
            {(Object.keys(FORCE_COLOR) as DominantForce[]).map(f => (
              <MiniChip key={f} active={filter.dominantForce === f} onClick={() => setFilter(x => ({ ...x, dominantForce: f }))} color={FORCE_COLOR[f]}>
                {FORCE_LABEL[f]}
              </MiniChip>
            ))}
          </div>

          <Label>min intensity — {filter.minIntensity ?? 1}</Label>
          <input
            type="range" min={1} max={10}
            value={filter.minIntensity ?? 1}
            onChange={e => setFilter(f => ({ ...f, minIntensity: Number(e.target.value) || undefined }))}
            style={{ width: "100%", accentColor: "#38bdf8", marginBottom: 10 }}
          />

          <Label>max distance (km) — {filter.maxDistanceKm ?? "∞"}</Label>
          <input
            type="range" min={0} max={20000} step={100}
            value={filter.maxDistanceKm ?? 20000}
            onChange={e => {
              const v = Number(e.target.value);
              setFilter(f => ({ ...f, maxDistanceKm: v >= 20000 ? undefined : v }));
            }}
            style={{ width: "100%", accentColor: "#38bdf8" }}
          />

          <button
            onClick={() => { setFilter({}); setTarget({}); }}
            style={{
              marginTop: 10, width: "100%",
              padding: "6px 8px", fontSize: 10,
              background: "transparent", color: "#8bb8cc",
              border: "1px solid #0a2a4a", borderRadius: 4, cursor: "pointer",
            }}
          >
            איפוס
          </button>
        </div>

        {/* SELECTED — PENTAGON PANEL */}
        {selected && (
          <div style={{ padding: 12, border: `1px solid ${FORCE_COLOR[selected.dominantForce]}88`, borderRadius: 6, background: "#040e1c", marginBottom: 16 }}>
            <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
              Pentagon
            </div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{selected.name}</div>
            <div style={{ fontSize: 10, color: "#8bb8cc", marginBottom: 8 }}>
              {CONTEXT_LABEL[selected.context]} · intensity {selected.intensity}/10
            </div>

            <div style={{
              fontSize: 13, color: "#00f5d4", fontWeight: 600,
              padding: "8px 10px", background: "#00f5d411",
              border: "1px solid #00f5d433", borderRadius: 4,
              marginBottom: 10,
            }}>
              {selected.action}
            </div>

            <div style={{ fontSize: 11, color: "#8bb8cc", marginBottom: 10, lineHeight: 1.4, fontStyle: "italic" }}>
              "{selected.event}"
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
              <MetaBox label="force" value={FORCE_LABEL[selected.dominantForce]} color={FORCE_COLOR[selected.dominantForce]} />
              <MetaBox label="direction" value={selected.direction} color={selected.direction === "forward" ? "#00f5d4" : selected.direction === "stuck" ? "#fbbf24" : "#ef4444"} />
              <MetaBox label="trust" value={String(proofTrustMap[selected.id] ?? selected.trustScore)} color={proofTrustMap[selected.id] !== undefined ? "#34d399" : "#38bdf8"} />
              <MetaBox label="impact" value={selected.impact} color="#e0f2fe" />
            </div>

            {/* ── Proof layer ── */}
            {(() => {
              const nodeProofs = allProofs.filter(p => p.userId === selected.name);
              if (nodeProofs.length === 0) return null;
              const verified = nodeProofs.filter(p => p.status === "verified");
              const claimed  = nodeProofs.filter(p => p.status === "claimed");
              const rep      = computeReputation(verified, []);
              return (
                <div style={{
                  padding: "8px 10px", borderRadius: 4, marginBottom: 10,
                  border: `1px solid ${REPUTATION_LEVEL_COLOR[rep.level]}44`,
                  background: `${REPUTATION_LEVEL_COLOR[rep.level]}08`,
                }}>
                  <div style={{ fontSize: 8, color: "#1e4060", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Proof Layer</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{
                      fontSize: 10, padding: "2px 8px", borderRadius: 8,
                      background: REPUTATION_LEVEL_COLOR[rep.level] + "22",
                      color: REPUTATION_LEVEL_COLOR[rep.level],
                      border: `1px solid ${REPUTATION_LEVEL_COLOR[rep.level]}55`,
                      fontWeight: 600,
                    }}>
                      {REPUTATION_LEVEL_LABEL[rep.level]}
                    </span>
                    <span style={{ fontSize: 11, color: REPUTATION_LEVEL_COLOR[rep.level], fontWeight: 700 }}>
                      {rep.overall}/100
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, fontSize: 9, color: "#8bb8cc" }}>
                    <span>✓ מאומת: <b style={{ color: "#34d399" }}>{verified.length}</b></span>
                    <span>⏳ ממתין: <b style={{ color: "#fbbf24" }}>{claimed.length}</b></span>
                    <span>proof trust: <b style={{ color: REPUTATION_LEVEL_COLOR[rep.level] }}>{proofTrustMap[selected.id] ?? 0}</b></span>
                  </div>
                </div>
              );
            })()}

            {selected.conflict && (
              <div style={{
                fontSize: 10, color: "#ef4444", padding: "6px 8px",
                border: "1px solid #ef444455", background: "#ef444411",
                borderRadius: 4, marginBottom: 10,
              }}>
                ⚠ conflict: {selected.conflict}
              </div>
            )}

            {/* NEEDS / OFFERS */}
            {selectedNeeds && (selectedNeeds.needs.length > 0 || selectedNeeds.offers.length > 0) && (
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10,
              }}>
                <div style={{
                  padding: "6px 8px", borderRadius: 4,
                  border: "1px solid #ef444444", background: "#ef44440e",
                }}>
                  <div style={{ fontSize: 8, color: "#ef4444", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
                    צריך
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                    {selectedNeeds.needs.length
                      ? selectedNeeds.needs.map(t => <NeedPill key={"n" + t} tag={t} dir="in" />)
                      : <span style={{ fontSize: 10, color: "#1e4060" }}>—</span>}
                  </div>
                </div>
                <div style={{
                  padding: "6px 8px", borderRadius: 4,
                  border: "1px solid #22c55e44", background: "#22c55e0e",
                }}>
                  <div style={{ fontSize: 8, color: "#22c55e", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
                    מציע
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                    {selectedNeeds.offers.length
                      ? selectedNeeds.offers.map(t => <NeedPill key={"o" + t} tag={t} dir="out" />)
                      : <span style={{ fontSize: 10, color: "#1e4060" }}>—</span>}
                  </div>
                </div>
              </div>
            )}

            {/* ── EVOLUTION PATH ── */}
            {(() => {
              const evo = EVOLUTION_MAP[selected.dominantForce];
              if (!evo) return null;
              const balColor = FORCE_COLOR[evo.balance as DominantForce] ?? "#38bdf8";
              const nextColor = evo.next ? (FORCE_COLOR[evo.next as DominantForce] ?? "#a78bfa") : "#a78bfa";
              return (
                <div style={{ padding: "8px 10px", borderRadius: 4, marginBottom: 10, border: "1px solid #0a2a4a", background: "#040e1c" }}>
                  <div style={{ fontSize: 8, color: "#1e4060", letterSpacing: 1, textTransform: "uppercase", marginBottom: 7 }}>נתיב אבולוציה</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8, flexWrap: "wrap", fontSize: 9 }}>
                    <span style={{ padding: "2px 7px", borderRadius: 10, border: `1px solid ${FORCE_COLOR[selected.dominantForce]}55`, color: FORCE_COLOR[selected.dominantForce], background: FORCE_COLOR[selected.dominantForce] + "22", fontWeight: 600 }}>
                      {FORCE_LABEL[selected.dominantForce]}
                    </span>
                    <span style={{ color: "#1e4060" }}>→ מאזן:</span>
                    <span style={{ padding: "2px 7px", borderRadius: 10, border: `1px solid ${balColor}55`, color: balColor }}>{FORCE_LABEL[evo.balance as DominantForce] ?? evo.balance}</span>
                    {evo.next && <>
                      <span style={{ color: "#1e4060" }}>→ הבא:</span>
                      <span style={{ padding: "2px 7px", borderRadius: 10, border: `1px solid ${nextColor}55`, color: nextColor }}>{FORCE_LABEL[evo.next as DominantForce] ?? evo.next}</span>
                    </>}
                  </div>
                  <div style={{ fontSize: 10, color: "#00f5d4", padding: "6px 8px", background: "#020d1a", borderRadius: 4 }}>{evo.action}</div>
                </div>
              );
            })()}

            {/* ── WHY IT MATTERS ── */}
            {(() => {
              const evo = EVOLUTION_MAP[selected.dominantForce];
              if (!evo) return null;
              const trust = proofTrustMap[selected.id] ?? selected.trustScore;
              const conns = links.filter(l => l.source === selected.id || l.target === selected.id).length;
              return (
                <div style={{ padding: "8px 10px", borderRadius: 4, marginBottom: 10, border: "1px solid #0a2a4a", background: "#040e1c" }}>
                  <div style={{ fontSize: 8, color: "#1e4060", letterSpacing: 1, textTransform: "uppercase", marginBottom: 7 }}>למה זה משנה</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                    <SmallCard label="⚠ סיכון"       text={evo.risk}         color="#f87171" />
                    <SmallCard label="✦ הזדמנות"     text={evo.opportunity}  color="#34d399" />
                    <SmallCard label="🤝 השפעה חברתית" text={`${conns} קשרים פעילים ברשת`} color="#fb923c" />
                    <SmallCard label="⬡ אמון"          text={`${trust}/100 — ${trust > 60 ? "מהימן" : trust > 20 ? "בבנייה" : "חדש"}`} color="#38bdf8" />
                  </div>
                </div>
              );
            })()}

            {/* ── SELECTED NODE OPPORTUNITIES ── */}
            {selectedOpportunities.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 8, color: "#1e4060", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>הזדמנויות עבור {selected.name}</div>
                {selectedOpportunities.map(opp => (
                  <OppCard key={opp.id} opp={opp} compact />
                ))}
              </div>
            )}

            {/* STANCE EDITOR (active topic) */}
            {activeTopic && (() => {
              const current = stances.find(s => s.topicId === activeTopic.id && s.userId === selected.id);
              const values = current?.values ?? activeTopic.axes.map(() => 0);
              const setVal = (idx: number, v: number) => {
                const next: Stance = {
                  topicId: activeTopic.id,
                  userId:  selected.id,
                  values:  values.map((x, i) => i === idx ? v : x),
                  intensity: current?.intensity ?? selected.intensity / 10,
                };
                const merged = saveStance(next);
                setStances(merged);
              };
              return (
                <div style={{
                  padding: "8px 10px", borderRadius: 4, marginBottom: 10,
                  border: `1px solid ${activeTopic.color}44`,
                  background: `${activeTopic.color}0e`,
                }}>
                  <div style={{ fontSize: 9, color: activeTopic.color, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
                    עמדה · {activeTopic.title}
                  </div>
                  {activeTopic.axes.map((ax, i) => (
                    <div key={ax.key} style={{ marginBottom: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#8bb8cc", marginBottom: 2 }}>
                        <span>{ax.left}</span>
                        <b style={{ color: "#e0f2fe" }}>{(values[i] ?? 0).toFixed(2)}</b>
                        <span>{ax.right}</span>
                      </div>
                      <input
                        type="range" min={-1} max={1} step={0.05}
                        value={values[i] ?? 0}
                        onChange={e => setVal(i, Number(e.target.value))}
                        style={{ width: "100%", accentColor: activeTopic.color }}
                      />
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* CONNECTIONS */}
            {selectedConnections.length > 0 && (
              <>
                <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6, marginTop: 4 }}>
                  Connections · {selectedConnections.length}
                </div>
                {selectedConnections.map(({ link, other }) => (
                  <div
                    key={link.source + link.target}
                    onClick={() => setSelectedLink(link)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "6px 8px", marginBottom: 4,
                      border: `1px solid ${LINK_COLOR[link.type]}44`,
                      background: `${LINK_COLOR[link.type]}0e`,
                      borderRadius: 4, cursor: "pointer", fontSize: 10,
                    }}
                  >
                    <span style={{ width: 8, height: 8, background: LINK_COLOR[link.type], borderRadius: 2 }} />
                    <span style={{ flex: 1, color: "#e0f2fe" }}>
                      {link.directional && link.source === selected.id && "→ "}
                      {link.directional && link.target === selected.id && "← "}
                      {other.name}
                    </span>
                    <span style={{ color: LINK_COLOR[link.type], fontSize: 9 }}>
                      {LINK_LABEL[link.type]}
                    </span>
                    <b style={{ color: "#38bdf8", fontSize: 10 }}>{link.strength.toFixed(2)}</b>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* RANKED LIST */}
        <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", margin: "6px 0 8px" }}>
          Ranked
        </div>
        {ranked.map(n => {
          const isTop = topIds.has(n.id);
          return (
            <div
              key={n.id}
              onClick={() => { setSelected(n); setSelectedLink(null); }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px",
                border: `1px solid ${isTop ? FORCE_COLOR[n.dominantForce] + "aa" : "#0a2a4a"}`,
                borderRadius: 6, marginBottom: 5, cursor: "pointer",
                background: selected?.id === n.id ? "#0a2a4a" : isTop ? "#061628" : "#040e1c",
                boxShadow: isTop ? `0 0 10px ${FORCE_COLOR[n.dominantForce]}44` : "none",
                opacity: isTop ? 1 : 0.75,
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: 4,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 700,
                color: isTop ? "#020d1a" : "#8bb8cc",
                background: isTop ? FORCE_COLOR[n.dominantForce] : "transparent",
                border: isTop ? "none" : "1px solid #0a2a4a",
              }}>
                {n.rank}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "#caf0f8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {n.name}
                </div>
                <div style={{ fontSize: 9, color: "#1e4060" }}>
                  {FORCE_LABEL[n.dominantForce]} · {CONTEXT_LABEL[n.context]} · int {n.intensity}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: isTop ? "#fbbf24" : "#38bdf8", fontWeight: 700 }}>
                  {n.score.toFixed(1)}
                </div>
                <div style={{ fontSize: 8, color: "#1e4060" }}>score</div>
              </div>
            </div>
          );
        })}

        <div style={{ marginTop: 16, display: "flex", gap: 6 }}>
          <a href="/" style={{
            flex: 1, textAlign: "center",
            padding: "10px 12px", fontSize: 11, letterSpacing: 2,
            color: "#020d1a", fontWeight: 700,
            background: "linear-gradient(135deg,#00f5d4,#38bdf8)",
            borderRadius: 6, textDecoration: "none",
          }}>
            ניתוח חדש
          </a>
          <button
            onClick={() => {
              if (confirm("למחוק את כל הנודים?")) {
                clearNodes();
                setAllNodes([]);
                setSelected(null);
                setSelectedLink(null);
              }
            }}
            style={{
              padding: "10px 12px", fontSize: 10,
              background: "transparent", color: "#8bb8cc",
              border: "1px solid #0a2a4a", borderRadius: 6, cursor: "pointer",
            }}
          >
            נקה
          </button>
        </div>

        <button
          onClick={() => {
            const seeds = generateSeedNodes();
            seeds.forEach(n => saveNode(n));
            setAllNodes(loadNodes());
          }}
          style={{
            width: "100%", marginTop: 8,
            padding: "8px 10px", fontSize: 10, letterSpacing: 2,
            color: "#a78bfa", background: "transparent",
            border: "1px dashed #a78bfa66", borderRadius: 6,
            cursor: "pointer",
          }}
        >
          + זרע דמו (10 משתמשים, 4 סוגי קווים)
        </button>
        </div>
        )}
      </div>
    </div>
  );
}

function OppCard({ opp, compact = false }: { opp: RealOpportunity; compact?: boolean }) {
  const col = OPPORTUNITY_TYPE_COLOR[opp.type];
  return (
    <div style={{
      padding: compact ? "7px 9px" : "10px 12px",
      marginBottom: 6, borderRadius: 6,
      border: `1px solid ${col}44`,
      background: col + "08",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <span style={{
          fontSize: 9, padding: "1px 7px", borderRadius: 3, fontWeight: 700,
          background: col + "22", color: col,
        }}>
          {OPPORTUNITY_TYPE_LABEL[opp.type]}
        </span>
        <span style={{ flex: 1, fontSize: compact ? 10 : 11, color: "#caf0f8", fontWeight: 600 }}>
          {opp.provider.name}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: opp.score >= 70 ? "#34d399" : opp.score >= 40 ? "#fbbf24" : "#8bb8cc" }}>
          {opp.score}%
        </span>
      </div>
      {!compact && (
        <div style={{ fontSize: 10, color: "#8bb8cc", marginBottom: 5 }}>{opp.reason}</div>
      )}
      <div style={{ display: "flex", gap: 10, fontSize: 9, color: "#8bb8cc", marginBottom: compact ? 0 : 5 }}>
        <span>צריך: <b style={{ color: "#f87171" }}>{opp.matchedNeeds.map(n => NEED_LABEL[n]).join(", ")}</b></span>
        <span>מציע: <b style={{ color: "#34d399" }}>{opp.matchedOffers.map(n => NEED_LABEL[n]).join(", ")}</b></span>
      </div>
      {!compact && (
        <div style={{ display: "flex", gap: 8, fontSize: 9, color: "#1e4060", marginBottom: 5 }}>
          <span>אמון: <b style={{ color: "#38bdf8" }}>{opp.avgTrust}</b></span>
          {opp.bidirectional && <span style={{ color: "#fbbf24" }}>⇌ הדדי</span>}
          {opp.contextMatch  && <span style={{ color: "#34d399" }}>◉ אותו הקשר</span>}
        </div>
      )}
      {!compact && (
        <div style={{ fontSize: 9, padding: "4px 7px", background: "#020d1a", borderRadius: 4, color: "#00f5d4" }}>
          → {opp.suggestedAction}
        </div>
      )}
    </div>
  );
}

function SmallCard({ label, text, color }: { label: string; text: string; color: string }) {
  return (
    <div style={{ padding: "5px 7px", borderRadius: 4, border: `1px solid ${color}22`, background: color + "08" }}>
      <div style={{ fontSize: 8, color, letterSpacing: 0.5, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 9, color: "#8bb8cc" }}>{text}</div>
    </div>
  );
}

/* ---------- evolution map ------------------------------------------ */

const EVOLUTION_MAP: Record<string, {
  balance: string; next: string | null;
  action: string; risk: string; opportunity: string;
}> = {
  id:        { balance: "superego",  next: "physical",  action: "הגדר צורך אחד קונקרטי לפני שאתה פועל",      risk: "כאוס ללא כיוון",      opportunity: "כוח גולמי לכל כיוון"     },
  physical:  { balance: "emotional", next: "emotional", action: "הקשב לגוף — הוא אומר משהו שהמחשבה לא יכולה", risk: "תלות גופנית",          opportunity: "עיגון ונוכחות ממשית"      },
  emotional: { balance: "rational",  next: "rational",  action: "שתף אדם אחד — תצא מהכלוב הפנימי",           risk: "הצפה רגשית",           opportunity: "חיבור עמוק ואמפתיה"      },
  rational:  { balance: "emotional", next: "social",    action: "תרגם תובנה אחת לצעד קטן מחר",               risk: "ניתוח ללא פעולה",      opportunity: "בהירות וסדר"             },
  social:    { balance: "ego",       next: "ego",       action: "תרום משהו ספציפי — לא רק נוכחות",            risk: "ביטול עצמי",           opportunity: "ערך קולקטיבי וחיבור"     },
  ego:       { balance: "social",    next: "superego",  action: "השתמש בכוח שלך לטובת מישהו אחר",             risk: "אינפלציה",             opportunity: "מנהיגות וזהות"           },
  superego:  { balance: "id",        next: null,        action: "בחר ערך אחד ופעל לפיו — בלי תנאים מושלמים", risk: "שיתוק מוסרי",          opportunity: "משמעות ותכלית עמוקה"     },
};

/* ---------- semantic link color ------------------------------------ */

export const SEMANTIC_LEGEND: Array<{ color: string; label: string }> = [
  { color: SEMANTIC_C.green,  label: "ערך"     },
  { color: SEMANTIC_C.yellow, label: "ניטרלי"  },
  { color: SEMANTIC_C.orange, label: "מתח"     },
  { color: SEMANTIC_C.red,    label: "סיכון"   },
  { color: SEMANTIC_C.blue,   label: "בהירות"  },
  { color: SEMANTIC_C.purple, label: "יצירה"   },
];

function getLinkSemanticColor(link: Link, s: UserNode, t: UserNode): string {
  const hasConflict = !!(s.conflict || t.conflict);
  const isBackward  = s.direction === "backward" || t.direction === "backward";
  const highRisk    =
    (s.direction === "backward" && s.intensity >= 7) ||
    (t.direction === "backward" && t.intensity >= 7);

  if (highRisk)                    return SEMANTIC_C.red;
  if (hasConflict && isBackward)   return SEMANTIC_C.red;
  if (hasConflict || isBackward)   return SEMANTIC_C.orange;

  const bothForward = s.direction === "forward" && t.direction === "forward";
  const isSocial    = s.dominantForce === "social" || t.dominantForce === "social";
  const avgTrust    = (s.trustScore + t.trustScore) / 2;

  if (bothForward && (isSocial || link.strength > 0.6 || avgTrust > 40)) return SEMANTIC_C.green;
  if (bothForward && link.type === "alignment")                            return SEMANTIC_C.green;

  if (s.dominantForce === "rational" || t.dominantForce === "rational")    return SEMANTIC_C.blue;

  const deepForces = ["ego", "superego"] as DominantForce[];
  if (deepForces.includes(s.dominantForce) || deepForces.includes(t.dominantForce)) return SEMANTIC_C.purple;

  return SEMANTIC_C.yellow;
}

/* ---------- small components ---------- */

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#8bb8cc", marginBottom: 3 }}>
      <span>{k}</span>
      <b style={{ color: "#e0f2fe" }}>{v}</b>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 9, color: "#8bb8cc", letterSpacing: 1, marginBottom: 4 }}>
      {children}
    </div>
  );
}

function MiniChip({
  children, active, onClick, color,
}: { children: React.ReactNode; active: boolean; onClick: () => void; color: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "6px 4px", fontSize: 10,
        borderRadius: 4,
        border: `1px solid ${active ? color : "#0a2a4a"}`,
        background: active ? `${color}22` : "transparent",
        color: active ? color : "#8bb8cc",
        cursor: "pointer", fontWeight: active ? 700 : 400,
      }}
    >
      {children}
    </button>
  );
}

function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{
      fontSize: 9, padding: "2px 6px", borderRadius: 10,
      background: `${color}22`, color,
      border: `1px solid ${color}55`,
    }}>
      {children}
    </span>
  );
}

function MetaBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: "6px 8px", borderRadius: 4,
      border: `1px solid ${color}44`, background: `${color}0e`,
    }}>
      <div style={{ fontSize: 8, color: "#8bb8cc", letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 12, color, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / 10) * 100));
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#8bb8cc", marginBottom: 2 }}>
        <span>{label}</span>
        <b style={{ color }}>{value.toFixed(1)}</b>
      </div>
      <div style={{ height: 4, background: "#0a2a4a", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color }} />
      </div>
    </div>
  );
}

function NeedPill({ tag, dir }: { tag: NeedTag; dir: "in" | "out" }) {
  const col = NEED_COLOR[tag];
  const arrow = dir === "in" ? "←" : "→";
  return (
    <span style={{
      fontSize: 9, padding: "2px 6px", borderRadius: 8,
      background: `${col}1a`, color: col,
      border: `1px solid ${col}55`,
      letterSpacing: 0.3, whiteSpace: "nowrap",
    }}>
      {arrow} {NEED_LABEL[tag]}
    </span>
  );
}

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}
