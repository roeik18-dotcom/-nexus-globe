"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- react-globe.gl accessors
   receive untyped datum objects; the library's own prop types force `any` here. */

/**
 * WorldGlobe — Philos "World" built as an operating system, not a dashboard.
 * The globe is THE object (≈70% of viewport); everything else is a thin HUD that
 * wraps it. Depth is layered: starfield → atmosphere → globe → flows → HUD.
 * Palette is deliberately near-monochrome (black + blue) so focus stays on the
 * globe. Motion is continuous: auto-rotate, animated arcs, breathing glow, and a
 * slow cinematic camera drift.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { PNode } from "./LivingPlanet";
import type { GlobeArc } from "@/app/lib/philos/projectGlobeGraph";

type Counts = { entities: number; missions: number; relationships: number; communities: number };

// restrained palette: one cool accent, one warm accent — nothing else
const ENTITY = "#8fd0ff";
const MISSION = "#ffce8a";

function seeded(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function hash01(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100000) / 100000; }
function fibSphere(n: number) { const o: { lat: number; lng: number }[] = []; const g = Math.PI * (3 - Math.sqrt(5)); for (let i = 0; i < n; i++) { const y = 1 - (i / Math.max(1, n - 1)) * 2, r = Math.sqrt(Math.max(0, 1 - y * y)), t = g * i; o.push({ lat: Math.asin(y) * 180 / Math.PI, lng: Math.atan2(Math.sin(t) * r, Math.cos(t) * r) * 180 / Math.PI }); } return o; }

// one-element CSS starfield: a pile of box-shadow dots
function starShadows(n: number, seed: number) {
  const r = seeded(seed); const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(`${Math.floor(r() * 2000)}px ${Math.floor(r() * 1200)}px rgba(200,220,255,${(0.25 + r() * 0.6).toFixed(2)})`);
  return out.join(",");
}

export default function WorldGlobe({ nodes, arcs: eventArcs, counts, sampleEvents }: {
  nodes: PNode[]; arcs: GlobeArc[]; counts: Counts; sampleEvents: string[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [Globe, setGlobe] = useState<any>(null);
  const [tick, setTick] = useState(0);
  const stars = useMemo(() => starShadows(160, 7), []);

  useEffect(() => { let ok = true; import("react-globe.gl").then(m => { if (ok) setGlobe(() => m.default); }); return () => { ok = false; }; }, []);
  useEffect(() => { const el = wrapRef.current; if (!el) return; const u = () => setSize({ w: el.clientWidth, h: el.clientHeight }); u(); const ro = new ResizeObserver(u); ro.observe(el); return () => ro.disconnect(); }, []);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 2600); return () => clearInterval(id); }, []);

  // cinematic camera drift — slow, continuous, never still
  useEffect(() => {
    let raf = 0, t0 = 0;
    const drift = (t: number) => {
      if (!t0) t0 = t; const e = (t - t0) / 1000; const g = globeRef.current;
      if (g && g.pointOfView) g.pointOfView({ lat: 10 + Math.sin(e / 14) * 10, lng: (e * 1.5) % 360, altitude: 1.72 + Math.sin(e / 9) * 0.08 }, 0);
      raf = requestAnimationFrame(drift);
    };
    if (Globe) raf = requestAnimationFrame(drift);
    return () => cancelAnimationFrame(raf);
  }, [Globe]);

  const { points, arcs } = useMemo(() => {
    const comms = Array.from(new Set(nodes.map(n => n.community || "general")));
    const anchorOf = new Map(comms.map((c, i) => [c, fibSphere(comms.length)[i]]));
    const pos = new Map<string, { lat: number; lng: number }>();
    const entityPts = nodes.map(n => {
      const a = anchorOf.get(n.community || "general")!;
      const lat = Math.max(-84, Math.min(84, a.lat + (hash01(n.id) - 0.5) * 18));
      const lng = a.lng + (hash01(n.id + "g") - 0.5) * 18;
      pos.set(n.id, { lat, lng });
      const mission = n.type === "mission";
      return { lat, lng, color: mission ? MISSION : ENTITY, label: n.label, type: n.type, alt: 0.01 + (mission ? 0.04 : 0.015), r: mission ? 0.5 : 0.34 };
    });
    const r = seeded(9173);
    const swarm = Array.from({ length: 720 }, () => ({ lat: Math.asin(r() * 2 - 1) * 180 / Math.PI, lng: r() * 360 - 180, color: `rgba(140,190,255,${(0.14 + r() * 0.32).toFixed(2)})`, alt: 0.01 + r() * 0.24, r: 0.1 + r() * 0.1, label: "", type: "" }));
    // Every line is an event. An arc whose endpoints are not both placeable is
    // DROPPED rather than drawn at a guessed position — blueprint §13.
    const arcs = eventArcs.map(a => {
      const s = pos.get(a.source_id), t = pos.get(a.target_id);
      if (!s || !t) return null;
      return {
        startLat: s.lat, startLng: s.lng, endLat: t.lat, endLng: t.lng,
        // provenance travels with the line, so the globe can answer "why is this here?"
        source_id: a.source_id, target_id: a.target_id, relation: a.relation,
        event_id: a.event_id, timestamp: a.timestamp,
        verification_status: a.verification_status, text: a.label,
        amount: a.amount, currency: a.currency, resource_type: a.resource_type,
        value_tags: a.value_tags, transfer_status: a.transfer_status,
        // resource movements read differently from membership: one is money
        // leaving the group, the other is a person joining it
        isTransfer: a.relation === "transfer.completed",
      };
    }).filter(Boolean) as any[];
    return { points: [...swarm, ...entityPts], arcs };
  }, [nodes, eventArcs]);

  const onReady = () => { const g = globeRef.current; if (!g) return; const c = g.controls(); c.autoRotate = true; c.autoRotateSpeed = 0.35; c.enableZoom = true; c.minDistance = 160; c.maxDistance = 460; };

  const forces: [string, number][] = [["PURPOSE", counts.missions], ["TRUST", counts.relationships], ["KNOWLEDGE", counts.communities], ["TENSION", nodes.filter(n => n.type === "gap").length]];
  const stream = sampleEvents.length ? Array.from({ length: 3 }, (_, i) => sampleEvents[(tick + i) % sampleEvents.length]) : [];

  return (
    <div style={S.root}>
      <style>{`@keyframes breathe{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:.85;transform:scale(1.04)}}@keyframes tw{0%,100%{opacity:.5}50%{opacity:.9}}`}</style>

      {/* layer 1 — starfield */}
      <div style={{ ...S.stars, boxShadow: stars, animation: "tw 6s ease-in-out infinite" }} />
      {/* layer 2 — breathing glow behind the globe */}
      <div style={{ ...S.breathe, animation: "breathe 7s ease-in-out infinite" }} />

      {/* layer 3+4 — the globe (THE object) */}
      <div ref={wrapRef} style={S.stage}>
        {Globe && size.w > 0 && (
          <Globe
            ref={globeRef} width={size.w} height={size.h}
            backgroundColor="rgba(0,0,0,0)"
            globeImageUrl="https://unpkg.com/three-globe/example/img/earth-night.jpg"
            atmosphereColor="#5aa6ff" atmosphereAltitude={0.3}
            onGlobeReady={onReady}
            pointsData={points}
            pointLat={(d: any) => d.lat} pointLng={(d: any) => d.lng}
            pointColor={(d: any) => d.color} pointAltitude={(d: any) => d.alt} pointRadius={(d: any) => d.r} pointResolution={5}
            pointLabel={(d: any) => d.label ? `<div style="font:600 12px system-ui;color:#fff">${d.label}</div><div style="font:11px system-ui;color:${d.color}">${d.type}</div>` : ""}
            arcsData={arcs}
            arcStartLat={(d: any) => d.startLat} arcStartLng={(d: any) => d.startLng} arcEndLat={(d: any) => d.endLat} arcEndLng={(d: any) => d.endLng}
            // A resource movement is a different KIND of line from a membership
            // one, so it reads differently. Colour only — no extra motion.
            arcColor={(d: any) => d.isTransfer
              ? ["rgba(255,206,138,0.06)", "rgba(255,206,138,0.92)"]
              : ["rgba(120,180,255,0.05)", "rgba(150,210,255,0.85)"]}
            arcStroke={(d: any) => (d.isTransfer ? 0.32 : 0.18)} arcAltitude={0.18}
            arcDashLength={0.4} arcDashGap={0.25} arcDashAnimateTime={3200}
            // Hovering a line states its provenance. Not decoration: without this
            // a viewer cannot ask why a line exists and get an answer (§13).
            // Amount/currency/value appear ONLY when the event carried them.
            arcLabel={(d: any) => `<div style="font:600 12px system-ui;color:#fff">${d.text}</div>`
              + `<div style="font:11px system-ui;color:${d.isTransfer ? "#ffce8a" : "#8fd0ff"}">${d.relation} · ${d.timestamp.slice(0, 10)}</div>`
              + (d.amount !== undefined
                  ? `<div style="font:600 12px system-ui;color:#ffce8a">${d.amount.toLocaleString("he-IL")}${d.currency ? ` ${d.currency}` : ""}`
                    + `${d.resource_type ? ` · ${d.resource_type}` : ""}</div>`
                  : (d.isTransfer ? `<div style="font:11px system-ui;color:#7b8ca6">amount not recorded</div>` : ""))
              + (d.value_tags?.length ? `<div style="font:11px system-ui;color:#cdd8ec">value: ${d.value_tags.join(" · ")}</div>` : "")
              + `<div style="font:10px system-ui;color:#7b8ca6">${d.source_id} → ${d.target_id}</div>`
              + `<div style="font:10px system-ui;color:#7b8ca6">event ${d.event_id}`
              + `${d.transfer_status ? ` · ${d.transfer_status}` : ""}`
              + `${d.verification_status ? ` · ${d.verification_status}` : ""}</div>`}
          />
        )}
        {!Globe && <div style={S.loading}>initializing world…</div>}
      </div>

      {/* layer 5 — HUD that WRAPS the globe (thin, edge-hugging, no boxes) */}
      <div style={S.topCenter}><span style={S.liveDot} /> PHILOS · WORLD — GLOBAL FIELD</div>
      <div style={S.tl}>ORBIT · OPTIMAL</div>
      <div style={S.tr}>SYNC · REALTIME</div>

      {/* Legend — blueprint §13: a line the viewer cannot decode is not
          information. Lists only what is actually drawn, and says plainly which
          parts are event-backed and which are not. */}
      <div style={S.legend}>
        <div style={S.railHead}>LEGEND</div>
        <div style={S.legendRow}>
          <span style={{ ...S.legendLine, background: "linear-gradient(90deg,rgba(255,206,138,0.1),#ffce8a)", height: 2 }} />
          <span style={S.legendText}>resource transfer — amount · value · event</span>
        </div>
        <div style={S.legendRow}>
          <span style={{ ...S.legendLine, background: "linear-gradient(90deg,rgba(150,210,255,0.1),#96d2ff)" }} />
          <span style={S.legendText}>membership / appointment — from the event log</span>
        </div>
        <div style={S.legendRow}>
          <span style={{ ...S.legendDot, background: MISSION }} />
          <span style={S.legendText}>mission</span>
        </div>
        <div style={S.legendRow}>
          <span style={{ ...S.legendDot, background: ENTITY }} />
          <span style={S.legendText}>entity · person · group · recipient</span>
        </div>
        <div style={S.legendNote}>
          Lines come from events and name the event on hover. Point positions are
          layout, not geography.
        </div>
      </div>

      <div style={S.leftRail}>
        <div style={S.railHead}>LIVING FORCES</div>
        {forces.map(([l, v]) => (<div key={l} style={S.railRow}><span style={S.railL}>{l}</span><span style={S.railV}>{v}</span></div>))}
      </div>

      <div style={S.rightRail}>
        <div style={{ ...S.railHead, textAlign: "right" }}>LIVE STREAM</div>
        {stream.map((e, i) => (<div key={i} style={{ ...S.streamRow, opacity: 0.9 - i * 0.28 }}>{e}</div>))}
      </div>

      <div style={S.bottom}>
        <div style={S.stats}>
          {([["entities", counts.entities], ["missions", counts.missions], ["relations", counts.relationships], ["communities", counts.communities]] as [string, number][])
            .map(([l, v], i) => (<div key={l} style={S.stat}><span style={S.statNum}>{v}</span><span style={S.statLabel}>{l}</span>{i < 3 && <span style={S.statSep} />}</div>))}
        </div>
        <div style={S.scrub}><div style={S.scrubFill} /></div>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  root: { position: "fixed", inset: 0, background: "radial-gradient(120% 90% at 50% 42%, #071120 0%, #03060e 48%, #010206 100%)", color: "#9fb2d6", fontFamily: "system-ui, -apple-system, sans-serif", overflow: "hidden" },
  stars: { position: "absolute", top: 0, left: 0, width: 1, height: 1, borderRadius: "50%", background: "transparent", zIndex: 0 },
  breathe: { position: "absolute", left: "50%", top: "50%", width: "76vmin", height: "76vmin", transform: "translate(-50%,-50%)", borderRadius: "50%", background: "radial-gradient(circle, rgba(70,140,255,0.22) 0%, rgba(50,110,230,0.06) 45%, transparent 66%)", zIndex: 0, pointerEvents: "none" },
  stage: { position: "absolute", inset: 0, zIndex: 1 },
  loading: { position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#4f6a99", letterSpacing: "3px", fontSize: 12 },

  topCenter: { position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 10, fontSize: 11, letterSpacing: "3px", color: "#c3d5f2", display: "flex", alignItems: "center", gap: 9 },
  liveDot: { width: 6, height: 6, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 10px 2px #34d399" },
  tl: { position: "absolute", top: 20, left: 22, zIndex: 10, fontSize: 9, letterSpacing: "2px", color: "#3e587f" },
  tr: { position: "absolute", top: 20, right: 22, zIndex: 10, fontSize: 9, letterSpacing: "2px", color: "#3e587f" },

  leftRail: { position: "absolute", left: 24, top: "50%", transform: "translateY(-50%)", zIndex: 10, display: "flex", flexDirection: "column", gap: 2 },
  legend: { position: "absolute", left: 24, bottom: 26, zIndex: 10, display: "flex", flexDirection: "column", gap: 5, maxWidth: 250 },
  legendRow: { display: "flex", alignItems: "center", gap: 9 },
  legendLine: { width: 26, height: 1.5, borderRadius: 2, flexShrink: 0 },
  legendDot: { width: 6, height: 6, borderRadius: "50%", flexShrink: 0, marginLeft: 10, marginRight: 10 },
  legendText: { fontSize: 9.5, color: "#6f89b6", lineHeight: 1.4 },
  legendNote: { fontSize: 8.5, color: "#3e587f", lineHeight: 1.5, marginTop: 4 },
  rightRail: { position: "absolute", right: 24, top: "50%", transform: "translateY(-50%)", zIndex: 10, width: 190, display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" },
  railHead: { fontSize: 8.5, letterSpacing: "2.5px", color: "#3e587f", marginBottom: 8 },
  railRow: { display: "flex", alignItems: "baseline", gap: 12, padding: "3px 0" },
  railL: { fontSize: 9.5, letterSpacing: "1.5px", color: "#6f89b6", width: 78 },
  railV: { fontSize: 15, fontWeight: 600, color: "#dbe7fb", fontVariantNumeric: "tabular-nums" },
  streamRow: { fontSize: 10, lineHeight: 1.5, color: "#7f97c2", textAlign: "right" },

  bottom: { position: "absolute", left: "50%", bottom: 26, transform: "translateX(-50%)", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
  stats: { display: "flex", alignItems: "center", gap: 22 },
  stat: { display: "flex", flexDirection: "column", alignItems: "center", position: "relative" },
  statNum: { fontSize: 22, fontWeight: 700, color: "#eaf1ff", lineHeight: 1, fontVariantNumeric: "tabular-nums" },
  statLabel: { fontSize: 8, textTransform: "uppercase", letterSpacing: "1.5px", color: "#43608a", marginTop: 4 },
  statSep: { position: "absolute", right: -11, top: 2, width: 1, height: 22, background: "rgba(90,130,190,0.18)" },
  scrub: { width: 320, height: 2, borderRadius: 2, background: "rgba(90,130,190,0.16)", position: "relative" },
  scrubFill: { position: "absolute", left: 0, top: 0, bottom: 0, width: "62%", background: "linear-gradient(90deg, transparent, #5aa6ff)", borderRadius: 2 },
};
