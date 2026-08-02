"use client";

/**
 * OrientationHub — the Philos landing, matching the "Orientation Lab" reference:
 * top nav, six domain cards (each with generative art), the curved Earth limb at
 * the bottom, and a status/sync footer. Entering WORLD swaps in the 3D globe.
 */

import { useEffect, useMemo, useState } from "react";
import type { PNode } from "./LivingPlanet";
import type { GlobeArc } from "@/app/lib/philos/projectGlobeGraph";
import WorldGlobe from "./WorldGlobe";

type Counts = { entities: number; missions: number; relationships: number; communities: number };

// deterministic PRNG so SVG art is stable across SSR/CSR (no hydration drift)
function seeded(seed: number) { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

const CARDS = [
  { n: "01", title: "WORLD", sub: "Global Field", color: "#6aa9e6" },
  { n: "02", title: "MARKET", sub: "Value Flows", color: "#e0a94b" },
  { n: "03", title: "PUDM", sub: "Principles Engine", color: "#a855f7" },
  { n: "04", title: "NEXUS", sub: "Living Network", color: "#34d399" },
  { n: "05", title: "LAB", sub: "Experiment & Create", color: "#38bdf8" },
  { n: "06", title: "ESSENCE", sub: "Core & Meaning", color: "#c084fc" },
] as const;

/* ── per-card generative art (SVG) ─────────────────────────────────────────── */
function Art({ kind, color }: { kind: string; color: string }) {
  const dots = useMemo(() => { const r = seeded(kind.length * 97 + 7); return Array.from({ length: 60 }, () => [r(), r(), r()]); }, [kind]);
  const box = { width: "100%", height: "100%" } as const;
  if (kind === "WORLD") return (
    <svg viewBox="0 0 200 160" style={box}>
      <defs><radialGradient id="wg" cx="42%" cy="38%" r="70%"><stop offset="0%" stopColor="#183a5c" /><stop offset="70%" stopColor="#0a1a2e" /><stop offset="100%" stopColor="#050c16" /></radialGradient></defs>
      <circle cx="100" cy="82" r="58" fill="url(#wg)" stroke={color} strokeOpacity="0.4" />
      {[0.25, 0.5, 0.75].map((f, i) => <ellipse key={i} cx="100" cy="82" rx={58} ry={58 * f} fill="none" stroke={color} strokeOpacity="0.16" />)}
      {[-40, -20, 0, 20, 40].map((o, i) => <ellipse key={i} cx="100" cy="82" rx={Math.abs(58 * Math.cos(o * Math.PI / 90))} ry="58" fill="none" stroke={color} strokeOpacity="0.12" />)}
      {dots.slice(0, 40).map(([a, b], i) => { const ang = a * Math.PI * 2, rr = Math.sqrt(b) * 54; return <circle key={i} cx={100 + Math.cos(ang) * rr} cy={82 + Math.sin(ang) * rr * 0.9} r={0.8 + b} fill="#8fd0ff" opacity={0.5 + b * 0.5} />; })}
    </svg>);
  if (kind === "MARKET") return (
    <svg viewBox="0 0 200 160" style={box}>
      {dots.slice(0, 26).map(([, b, c], i) => { const x = 14 + i * 7, h = 24 + b * 96; return <rect key={i} x={x} y={150 - h} width="5" height={h} rx="1" fill={color} opacity={0.25 + c * 0.55} />; })}
      <path d="M6 120 C 60 60, 130 100, 196 34" fill="none" stroke={color} strokeWidth="1.6" opacity="0.85" />
      <path d="M6 140 C 70 96, 120 120, 196 70" fill="none" stroke="#ffe0a0" strokeWidth="1" opacity="0.5" />
    </svg>);
  if (kind === "PUDM") { const cx = 100, cy = 80, R = 46; const hex = Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 6 + i * Math.PI / 3; return [cx + Math.cos(a) * R, cy + Math.sin(a) * R]; }); return (
    <svg viewBox="0 0 200 160" style={box}>
      <polygon points={hex.map(p => p.join(",")).join(" ")} fill="none" stroke={color} strokeOpacity="0.6" />
      {hex.map((p, i) => <line key={i} x1={cx} y1={cy} x2={p[0]} y2={p[1]} stroke={color} strokeOpacity="0.28" />)}
      <polygon points={hex.map(p => [cx + (p[0] - cx) * 0.5, cy + (p[1] - cy) * 0.5].join(",")).join(" ")} fill={color} fillOpacity="0.12" stroke={color} strokeOpacity="0.5" />
      <circle cx={cx} cy={cy} r="7" fill="#e9d5ff" opacity="0.9" />
      <circle cx={cx} cy={cy} r="16" fill="none" stroke={color} strokeOpacity="0.5" />
    </svg>); }
  if (kind === "NEXUS") { const r = seeded(41); const nodes = Array.from({ length: 9 }, () => [20 + r() * 160, 24 + r() * 112]); return (
    <svg viewBox="0 0 200 160" style={box}>
      {nodes.map((a, i) => nodes.slice(i + 1).map((b, j) => (i + j) % 2 === 0 ? <line key={`${i}-${j}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={color} strokeOpacity="0.22" /> : null))}
      {nodes.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={3 + (i % 3)} fill={color} opacity="0.9" />)}
    </svg>); }
  if (kind === "LAB") return (
    <svg viewBox="0 0 200 160" style={box}>
      <path d="M86 34 h28 v30 l24 52 a8 8 0 0 1 -7 12 h-62 a8 8 0 0 1 -7 -12 l24 -52 z" fill={color} fillOpacity="0.14" stroke={color} strokeOpacity="0.75" strokeWidth="1.4" />
      <path d="M74 104 h52 l10 22 a6 6 0 0 1 -5 9 h-62 a6 6 0 0 1 -5 -9 z" fill={color} fillOpacity="0.5" />
      {dots.slice(0, 8).map(([a, b], i) => <circle key={i} cx={82 + a * 36} cy={110 + b * 20} r={1 + b * 2} fill="#bde8ff" opacity="0.8" />)}
      <line x1="82" y1="34" x2="118" y2="34" stroke={color} strokeWidth="2" />
      <ellipse cx="100" cy="140" rx="46" ry="7" fill="none" stroke={color} strokeOpacity="0.4" />
    </svg>);
  return ( // ESSENCE — galaxy spiral
    <svg viewBox="0 0 200 160" style={box}>
      {dots.map(([a, b], i) => { const t = a * 6.5, rr = 3 + a * 52; const arm = (i % 2) * Math.PI; return <circle key={i} cx={100 + Math.cos(t + arm) * rr} cy={80 + Math.sin(t + arm) * rr * 0.62} r={0.6 + b * 1.6} fill={color} opacity={0.9 - a * 0.6} />; })}
      <circle cx="100" cy="80" r="6" fill="#f3e8ff" />
    </svg>);
}

export default function OrientationHub({ nodes, arcs, counts }: {
  nodes: PNode[]; arcs: GlobeArc[]; counts: Counts;
}) {
  const [view, setView] = useState<"hub" | "world">("hub");
  const [bars, setBars] = useState<number[]>(() => Array.from({ length: 18 }, (_, i) => 0.3 + 0.5 * Math.abs(Math.sin(i))));
  useEffect(() => { const id = setInterval(() => setBars(b => b.map((_, i) => 0.2 + 0.8 * Math.abs(Math.sin(Date.now() / 300 + i)))), 140); return () => clearInterval(id); }, []);

  if (view === "world") return (
    <div style={{ position: "fixed", inset: 0 }}>
      <button onClick={() => setView("hub")} style={S.back}>← Orientation</button>
      <WorldGlobe nodes={nodes} arcs={arcs} counts={counts} />
    </div>);

  return (
    <div style={S.root}>
      <header style={S.nav}>
        <div style={S.brand}><div style={S.mark} /><div><div style={S.brandName}>PHILOS</div><div style={S.brandSub}>ORIENTATION</div></div></div>
        <nav style={S.tabs}>{CARDS.map(c => <div key={c.title} style={S.tab}>{c.title}</div>)}</nav>
        <div style={S.live}><span style={S.liveDot} /> LIVE · STREAMING</div>
      </header>

      <main style={S.grid}>
        {CARDS.map((c, i) => (
          <button key={c.title} onClick={() => i === 0 && setView("world")} style={{ ...S.card, cursor: i === 0 ? "pointer" : "default" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = c.color; (e.currentTarget as HTMLElement).style.boxShadow = `0 0 34px ${c.color}33`; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(90,130,190,0.18)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}>
            <div style={{ ...S.cardNum, color: c.color }}>{c.n}</div>
            <div style={S.cardTitle}>{c.title}</div>
            <div style={S.cardSub}>{c.sub}</div>
            <div style={S.cardArt}><Art kind={c.title} color={c.color} /></div>
            <div style={{ ...S.enter, color: c.color }}>ENTER →</div>
          </button>
        ))}
      </main>

      <div style={S.limb} />
      <footer style={S.footer}>
        <div style={S.statusL}><span style={S.okDot} /> SYSTEM STATUS<br /><b style={{ color: "#6ee7b7" }}>OPTIMAL</b></div>
        <div style={S.copy}>PHILOS ORIENTATION LAB © 2026 · {counts.entities} entities · {counts.communities} communities</div>
        <div style={S.sync}>SYNC <b style={{ color: "#6ee7b7" }}>REALTIME</b>
          <span style={S.wave}>{bars.map((h, i) => <span key={i} style={{ width: 2, height: `${6 + h * 16}px`, background: "#34d399", borderRadius: 1 }} />)}</span>
        </div>
      </footer>
    </div>
  );
}

const glass: React.CSSProperties = { background: "rgba(10,16,28,0.5)", border: "1px solid rgba(90,130,190,0.18)", borderRadius: 16, backdropFilter: "blur(9px)" };
const S: Record<string, React.CSSProperties> = {
  root: { position: "fixed", inset: 0, background: "radial-gradient(130% 80% at 50% -20%, #0b1a2e 0%, #05070d 55%, #010208 100%)", color: "#cdd8ec", fontFamily: "system-ui, -apple-system, sans-serif", overflow: "hidden", display: "flex", flexDirection: "column" },
  nav: { margin: "14px 16px 0", height: 58, ...glass, display: "flex", alignItems: "center", padding: "0 18px", gap: 24, flexShrink: 0 },
  brand: { display: "flex", alignItems: "center", gap: 10 },
  mark: { width: 26, height: 26, borderRadius: "50%", background: "radial-gradient(circle at 50% 40%, #ffd477 0%, #e08a2b 45%, transparent 72%)", boxShadow: "0 0 18px 3px rgba(255,180,80,0.55)" },
  brandName: { fontSize: 15, fontWeight: 700, letterSpacing: "3px", color: "#eaf1ff" },
  brandSub: { fontSize: 8, letterSpacing: "4px", color: "#5f7db0" },
  tabs: { display: "flex", gap: 4, flex: 1, justifyContent: "center", flexWrap: "wrap" },
  tab: { fontSize: 11, letterSpacing: "1.5px", padding: "8px 14px", borderRadius: 9, color: "#8ea3c9" },
  live: { fontSize: 10.5, letterSpacing: "2px", color: "#6ee7b7", display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" },
  liveDot: { width: 7, height: 7, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 10px 2px #34d399" },
  grid: { flex: 1, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14, padding: "22px 16px", minHeight: 0 },
  card: { ...glass, display: "flex", flexDirection: "column", padding: "18px 16px", textAlign: "left", color: "inherit", font: "inherit", transition: "border-color .2s, box-shadow .2s", minWidth: 0 },
  cardNum: { fontSize: 13, fontWeight: 700, letterSpacing: "1px" },
  cardTitle: { fontSize: 20, fontWeight: 700, color: "#eaf1ff", marginTop: 6, letterSpacing: "1px" },
  cardSub: { fontSize: 11.5, color: "#7f95bd", marginTop: 2 },
  cardArt: { flex: 1, margin: "16px 0", minHeight: 90, display: "flex", alignItems: "center", justifyContent: "center" },
  enter: { fontSize: 12, letterSpacing: "1.5px", fontWeight: 600 },
  limb: { position: "absolute", left: "-10%", right: "-10%", bottom: -180, height: 340, borderRadius: "50%", background: "radial-gradient(60% 100% at 50% 0%, rgba(90,150,240,0.4) 0%, rgba(60,110,220,0.12) 42%, transparent 68%)", pointerEvents: "none" },
  footer: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 26px 16px", flexShrink: 0, zIndex: 2 },
  statusL: { fontSize: 9, letterSpacing: "1.5px", color: "#4a648a", lineHeight: 1.5, display: "flex", alignItems: "flex-start", gap: 8 },
  okDot: { width: 7, height: 7, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 10px 2px #34d399", marginTop: 2 },
  copy: { fontSize: 9.5, letterSpacing: "2px", color: "#3d5578", textTransform: "uppercase" },
  sync: { fontSize: 9, letterSpacing: "1.5px", color: "#4a648a", display: "flex", alignItems: "center", gap: 8 },
  wave: { display: "flex", alignItems: "flex-end", gap: 2, height: 22 },
  back: { position: "absolute", top: 84, left: 20, zIndex: 20, ...glass, color: "#cdd8ec", padding: "8px 14px", fontSize: 12, cursor: "pointer" },
};
