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

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

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

  useEffect(() => {
    if (!wrap.current) return;
    const el = wrap.current;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setAllNodes(loadNodes());
    setProfile(loadProfile());
  }, []);

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
        const col = LINK_COLOR[l.type];
        const hot = topIds.has(s.id) || topIds.has(t.id);
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

  const matches: Match[] = useMemo(
    () => computeMatches(visible, profile).slice(0, 5),
    [visible, profile],
  );

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

        {/* LAST ACTION OVERLAY */}
        {last && (
          <div
            style={{
              position: "absolute", top: 20, left: 20, right: 340, zIndex: 5,
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
            קווים
          </div>
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
          <div style={{ marginTop: 8, fontSize: 9, color: "#8bb8cc" }}>
            min strength: <b style={{ color: "#38bdf8" }}>{minStrength.toFixed(2)}</b>
          </div>
          <input
            type="range" min={0} max={1} step={0.05}
            value={minStrength}
            onChange={e => setMinStrength(Number(e.target.value))}
            style={{ width: 180, accentColor: "#38bdf8" }}
          />
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
            pointColor={(d: any) => d._anchor ? d.color : FORCE_COLOR[d.dominantForce as DominantForce]}
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
            arcsData={arcs}
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
              const l: Link = d._link;
              return `<div style="font-family:system-ui;padding:4px 2px">
                <b style="color:${LINK_COLOR[l.type]}">${LINK_LABEL[l.type]}</b><br/>
                ${escapeHtml(l.reason)}<br/>
                <span style="color:#8bb8cc">strength ${l.strength.toFixed(2)}</span>
              </div>`;
            }}
            onArcClick={(d: any) => {
              setSelectedLink(d._link);
            }}
          />
        )}
      </div>

      {/* SIDE PANEL */}
      <div style={{ width: 320, background: "#030f1e", borderLeft: "1px solid #0a2a4a", padding: 20, overflowY: "auto" }}>
        <div style={{ fontSize: 13, letterSpacing: 4, color: "#38bdf8", fontWeight: 700, marginBottom: 4 }}>
          PHILOS · NEXUS
        </div>
        <div style={{ fontSize: 10, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 18 }}>
          {visible.length} / {allNodes.length} nodes · {filteredLinks.length} links · top {Math.min(TOP_N, ranked.length)}
        </div>

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

        {/* SYSTEM SUMMARY */}
        {summary && (
          <div style={{ padding: 12, border: "1px solid #0a2a4a", borderRadius: 6, background: "#040e1c", marginBottom: 16 }}>
            <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
              System
            </div>
            <Row k="total" v={String(summary.totalNodes)} />
            <Row k="avg intensity" v={summary.avgIntensity.toFixed(1)} />
            <Row k="conflicts" v={String(summary.activeConflicts)} />
            <Row k="forward" v={`${Math.round(summary.forwardMovementRatio * 100)}%`} />
            <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
              {Object.entries(summary.forceDist).map(([f, c]) => (
                <div key={f} style={{
                  fontSize: 9, padding: "2px 6px", borderRadius: 10,
                  background: `${FORCE_COLOR[f as DominantForce]}22`,
                  color: FORCE_COLOR[f as DominantForce],
                  border: `1px solid ${FORCE_COLOR[f as DominantForce]}55`,
                }}>
                  {FORCE_LABEL[f as DominantForce]} · {c as number}
                </div>
              ))}
            </div>
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
              <MetaBox label="trust" value={String(selected.trustScore)} color="#38bdf8" />
              <MetaBox label="impact" value={selected.impact} color="#e0f2fe" />
            </div>

            {selected.conflict && (
              <div style={{
                fontSize: 10, color: "#ef4444", padding: "6px 8px",
                border: "1px solid #ef444455", background: "#ef444411",
                borderRadius: 4, marginBottom: 10,
              }}>
                ⚠ conflict: {selected.conflict}
              </div>
            )}

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
      </div>
    </div>
  );
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

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}
