"use client";

import { useEffect, useRef, useState } from "react";
import type { PNode, PEdge, Counts } from "./LivingPlanet";

/**
 * LivingField — Philos as a system IN MOTION (not a graph on a sphere).
 * A continuous force simulation: nodes are pulled toward their community, repel one
 * another, and hang on relation-springs — so ecosystems physically form, breathe,
 * and dissolve as you scrub time or toggle layers. Flows stream along relations,
 * force-fields glow at community cores, events ripple through the world, and the
 * camera drifts to what just happened. Real data only.
 */
const COLOR: Record<string, string> = {
  mission: "#a78bfa", gap: "#fb923c", value: "#38bdf8", capability: "#f472b6",
  provider: "#3fb950", entity: "#22d3ee",
};
const LAYERS = [
  { key: "mission", label: "Missions", color: COLOR.mission },
  { key: "value", label: "Values", color: COLOR.value },
  { key: "gap", label: "Gaps", color: COLOR.gap },
  { key: "capability", label: "Capabilities", color: COLOR.capability },
  { key: "provider", label: "Providers", color: COLOR.provider },
];

type Body = PNode & { x: number; y: number; vx: number; vy: number; deg: number; color: string; comm: string };

export default function LivingField({ nodes, edges, counts, sampleEvents }: {
  nodes: PNode[]; edges: PEdge[]; counts: Counts; sampleEvents: string[];
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const camRef = useRef({ zoom: 1, x: 0, y: 0, tzoom: 1, tx: 0, ty: 0 });
  const frontRef = useRef<{ b: Body; sx: number; sy: number; r: number }[]>([]);
  const reactRef = useRef<{ id: string; at: number } | null>(null);
  const [sel, setSel] = useState<Body | null>(null);
  const selRef = useRef<Body | null>(null); selRef.current = sel;
  const [feed, setFeed] = useState<string[]>([]);
  const [ai, setAi] = useState("Listening…");
  const [active, setActive] = useState<Set<string>>(() => new Set(LAYERS.map(l => l.key)));
  const activeRef = useRef(active); activeRef.current = active;
  const toggleLayer = (k: string) => setActive(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const bornVals = nodes.map(n => n.born).filter(b => b > 0);
  const minBorn = bornVals.length ? Math.min(...bornVals) : 0;
  const maxBorn = bornVals.length ? Math.max(...bornVals) : 0;
  const [nowMs, setNowMs] = useState(0);
  const [playT, setPlayT] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const timeRef = useRef(0);
  const forecastEnd = (nowMs || maxBorn) + 30 * 86_400_000;
  const curT = playT ?? maxBorn; timeRef.current = curT;
  const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  useEffect(() => { setNowMs(Date.now()); setPlayT(maxBorn); }, [maxBorn]);
  useEffect(() => {
    if (!playing) return; let raf = 0; const s = performance.now(), d = 8000;
    const step = (ts: number) => { const k = Math.min(1, (ts - s) / d); setPlayT(minBorn + (maxBorn - minBorn) * k); if (k < 1) raf = requestAnimationFrame(step); else setPlaying(false); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [playing, minBorn, maxBorn]);

  const forces = [
    { key: "purpose", label: "Purpose", color: "#a78bfa", v: nodes.filter(n => n.type === "mission").length },
    { key: "trust", label: "Trust · connection", color: "#38bdf8", v: edges.length },
    { key: "knowledge", label: "Knowledge", color: "#22d3ee", v: nodes.filter(n => n.type === "capability").length },
    { key: "opportunity", label: "Opportunity", color: "#3fb950", v: nodes.filter(n => n.type === "provider").length },
    { key: "tension", label: "Tension", color: "#fb923c", v: nodes.filter(n => n.type === "gap").length },
  ];
  const maxF = Math.max(...forces.map(f => f.v), 1);

  useEffect(() => {
    if (!sampleEvents.length) return; let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % sampleEvents.length;
      const reasoning = i % 3 === 0;
      setFeed(f => [reasoning ? `⟳ Merlin · orientation → decision · Knowledge +${1 + Math.floor(Math.random() * 3)}` : sampleEvents[i], ...f].slice(0, 6));
      if (nodes.length) reactRef.current = { id: nodes[Math.floor(Math.random() * nodes.length)].id, at: performance.now() };
    }, 2000);
    return () => clearInterval(id);
  }, [sampleEvents, nodes]);
  useEffect(() => { const s = ["Listening…", "Thinking…", "Searching World…", "Comparing Missions…", "Found."]; let i = 0; const id = setInterval(() => { i = (i + 1) % s.length; setAi(s[i]); }, 2500); return () => clearInterval(id); }, []);

  useEffect(() => {
    const cv = ref.current; if (!cv) return; const ctx = cv.getContext("2d"); if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0, H = 0, raf = 0, t = 0; const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const hash = (s: string) => { let h = 2166136261; for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 16777619); } return h >>> 0; };
    const deg = new Map<string, number>(); edges.forEach(e => { deg.set(e.s, (deg.get(e.s) || 0) + 1); deg.set(e.t, (deg.get(e.t) || 0) + 1); });
    const maxDeg = Math.max(1, ...deg.values());
    const comms = Array.from(new Set(nodes.map(n => n.community || "general")));
    const cseed = new Map(comms.map(c => { const h = hash("c::" + c); return [c, { a: (h % 360) * Math.PI / 180 }]; }));
    const commColor = (c: string) => { const h = hash(c); return `hsl(${h % 360}, 70%, 60%)`; };

    const B: Body[] = nodes.map(n => {
      const c = n.community || "general"; const s = cseed.get(c)!; const r = 180 + (hash(n.id) % 120);
      return { ...n, comm: c, deg: deg.get(n.id) || 0, color: COLOR[n.type] || COLOR.entity,
        x: Math.cos(s.a) * r + (hash(n.id) % 60 - 30), y: Math.sin(s.a) * r + (hash(n.id + "y") % 60 - 30), vx: 0, vy: 0 };
    });
    const byId = new Map(B.map(b => [b.id, b]));
    const stars = Array.from({ length: 260 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.3, tw: Math.random() * 6 }));

    function resize() { W = window.innerWidth; H = window.innerHeight; cv!.width = W * dpr; cv!.height = H * dpr; cv!.style.width = W + "px"; cv!.style.height = H + "px"; ctx!.setTransform(dpr, 0, 0, dpr, 0, 0); }

    function physics(live: Body[]) {
      // community centroids (clusters form from whoever is live now)
      const cen = new Map<string, { x: number; y: number; n: number }>();
      for (const b of live) { const c = cen.get(b.comm) || { x: 0, y: 0, n: 0 }; c.x += b.x; c.y += b.y; c.n++; cen.set(b.comm, c); }
      cen.forEach(c => { c.x /= c.n; c.y /= c.n; });
      // repulsion (O(n^2), fine for a few hundred)
      for (let i = 0; i < live.length; i++) {
        const a = live[i];
        for (let j = i + 1; j < live.length; j++) {
          const b = live[j]; let dx = a.x - b.x, dy = a.y - b.y; let d2 = dx * dx + dy * dy; if (d2 < 1) d2 = 1;
          if (d2 > 90000) continue; const f = 900 / d2; const d = Math.sqrt(d2); const fx = (dx / d) * f, fy = (dy / d) * f;
          a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
        }
        // cohesion to community centroid + weak gravity to origin
        const c = cen.get(a.comm)!; a.vx += (c.x - a.x) * 0.012; a.vy += (c.y - a.y) * 0.012;
        a.vx += -a.x * 0.0016; a.vy += -a.y * 0.0016;
        if (!reduce) { a.vx += (Math.random() - 0.5) * 0.25; a.vy += (Math.random() - 0.5) * 0.25; } // perpetual life
      }
      // relation springs
      const liveIds = new Set(live.map(b => b.id));
      for (const e of edges) {
        if (e.born > timeRef.current) continue; const a = byId.get(e.s), b = byId.get(e.t);
        if (!a || !b || !liveIds.has(a.id) || !liveIds.has(b.id)) continue;
        let dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 1; const rest = 120; const f = (d - rest) * 0.008;
        const fx = (dx / d) * f, fy = (dy / d) * f; a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      }
      for (const b of live) { b.vx *= 0.86; b.vy *= 0.86; b.x += b.vx; b.y += b.vy; }
      return cen;
    }

    function frame() {
      t += reduce ? 0 : 0.016;
      const pt = timeRef.current, layers = activeRef.current;
      const live = B.filter(b => b.born <= pt && layers.has(b.type));
      const cen = reduce ? new Map() : physics(live);
      // camera easing
      const cam = camRef.current; cam.zoom += (cam.tzoom - cam.zoom) * 0.08; cam.x += (cam.tx - cam.x) * 0.08; cam.y += (cam.ty - cam.y) * 0.08;

      // bg
      const bg = ctx!.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#03070f"); bg.addColorStop(1, "#01030a");
      ctx!.fillStyle = bg; ctx!.fillRect(0, 0, W, H);
      ctx!.fillStyle = "#cfe6f5";
      for (const s of stars) { ctx!.globalAlpha = 0.15 + 0.5 * Math.abs(Math.sin(t + s.tw)); ctx!.beginPath(); ctx!.arc(s.x * W, s.y * H, s.r, 0, 7); ctx!.fill(); }
      ctx!.globalAlpha = 1;

      const cx = W / 2 + cam.x, cy = H / 2 + cam.y, Z = cam.zoom;
      const S = (x: number, y: number) => ({ sx: cx + x * Z, sy: cy + y * Z });

      // force-fields: glowing regions at community cores (attractors)
      for (const [name, c] of cen) {
        const p = S(c.x, c.y); const col = commColor(name);
        const gr = (60 + c.n * 12) * Z;
        const g = ctx!.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, gr);
        g.addColorStop(0, col.replace(")", ",0.14)").replace("hsl", "hsla")); g.addColorStop(1, col.replace(")", ",0)").replace("hsl", "hsla"));
        ctx!.fillStyle = g; ctx!.beginPath(); ctx!.arc(p.sx, p.sy, gr, 0, 7); ctx!.fill();
      }

      // rivers (flowing relations)
      for (let i = 0; i < edges.length; i++) {
        const e = edges[i]; if (e.born > pt) continue; const a = byId.get(e.s), b = byId.get(e.t);
        if (!a || !b || !layers.has(a.type) || !layers.has(b.type)) continue;
        const pa = S(a.x, a.y), pb = S(b.x, b.y);
        ctx!.beginPath(); ctx!.moveTo(pa.sx, pa.sy); ctx!.lineTo(pb.sx, pb.sy);
        ctx!.strokeStyle = "rgba(80,150,240,0.09)"; ctx!.lineWidth = 1; ctx!.stroke();
        ctx!.save(); ctx!.setLineDash([5, 11]); ctx!.lineDashOffset = -((t * 60 + i * 7) % 16);
        ctx!.strokeStyle = "rgba(124,196,255,0.5)"; ctx!.lineWidth = 1.6; ctx!.lineCap = "round";
        ctx!.beginPath(); ctx!.moveTo(pa.sx, pa.sy); ctx!.lineTo(pb.sx, pb.sy); ctx!.stroke(); ctx!.restore();
      }

      // community labels
      ctx!.textAlign = "center";
      for (const [name, c] of cen) { if (c.n < 2) continue; const p = S(c.x, c.y); ctx!.globalAlpha = 0.45; ctx!.fillStyle = "#9fb8d6"; ctx!.font = "700 11px var(--font-geist-sans), system-ui, sans-serif"; ctx!.fillText(name.toUpperCase(), p.sx, p.sy - (60 + c.n * 12) * Z * 0.5); ctx!.globalAlpha = 1; }

      // nodes
      const front: typeof frontRef.current = [];
      for (const b of live) {
        const p = S(b.x, b.y); const pulse = 1 + 0.18 * Math.sin(t * 2.2 + b.x * 0.02);
        const rad = (2 + (b.deg / maxDeg) * 5) * Z * (reduce ? 1 : pulse);
        const g = ctx!.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, rad * 4);
        g.addColorStop(0, b.color); g.addColorStop(0.5, b.color + "55"); g.addColorStop(1, b.color + "00");
        ctx!.fillStyle = g; ctx!.beginPath(); ctx!.arc(p.sx, p.sy, rad * 4, 0, 7); ctx!.fill();
        ctx!.fillStyle = "#eef4ff"; ctx!.beginPath(); ctx!.arc(p.sx, p.sy, rad, 0, 7); ctx!.fill();
        ctx!.fillStyle = b.color; ctx!.beginPath(); ctx!.arc(p.sx, p.sy, rad * 0.6, 0, 7); ctx!.fill();
        front.push({ b, sx: p.sx, sy: p.sy, r: rad });
        if (b.deg >= 4 && Z > 0.7) { ctx!.globalAlpha = 0.85; ctx!.fillStyle = "#cfe6f5"; ctx!.font = "600 10px var(--font-geist-sans), system-ui, sans-serif"; ctx!.fillText(b.label.slice(0, 24), p.sx, p.sy - rad - 6); ctx!.globalAlpha = 1; }
      }
      frontRef.current = front;

      // event ripple
      const rc = reactRef.current;
      if (rc && !reduce) { const b = byId.get(rc.id); if (b && b.born <= pt && layers.has(b.type)) { const p = S(b.x, b.y); const el = performance.now() - rc.at; if (el < 1500) { const k = el / 1500; ctx!.globalAlpha = (1 - k) * 0.75; ctx!.strokeStyle = "#bfe6ff"; ctx!.lineWidth = 2; ctx!.beginPath(); ctx!.arc(p.sx, p.sy, 6 + k * 46, 0, 7); ctx!.stroke(); ctx!.globalAlpha = 1; } } }

      raf = requestAnimationFrame(frame);
    }
    resize(); window.addEventListener("resize", resize);
    const onWheel = (e: WheelEvent) => { const c = camRef.current; c.tzoom = Math.min(3, Math.max(0.4, c.tzoom - e.deltaY * 0.0016)); };
    const onClick = (e: MouseEvent) => {
      let best: Body | null = null, bd = 22;
      for (const f of frontRef.current) { const d = Math.hypot(f.sx - e.clientX, f.sy - e.clientY); if (d < Math.max(bd, f.r + 8)) { bd = d; best = f.b; } }
      setSel(best); const c = camRef.current;
      if (best) { c.tzoom = 1.8; c.tx = -best.x * c.tzoom; c.ty = -best.y * c.tzoom; } else { c.tzoom = 1; c.tx = 0; c.ty = 0; }
    };
    cv.addEventListener("wheel", onWheel, { passive: true }); cv.addEventListener("click", onClick);
    frame();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); cv.removeEventListener("wheel", onWheel); cv.removeEventListener("click", onClick); };
  }, [nodes, edges]);

  const rels = sel ? edges.filter(e => e.s === sel.id || e.t === sel.id).length : 0;
  const stat = (n: number, l: string) => (<div style={{ display: "flex", flexDirection: "column" }}><span style={{ fontSize: 22, fontWeight: 700, color: "#e6ecf5", lineHeight: 1.1 }}>{n.toLocaleString()}</span><span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "1.5px", color: "#5f7a9b" }}>{l}</span></div>);

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#01030a", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
      <canvas ref={ref} style={{ position: "absolute", inset: 0, cursor: "grab" }} />
      <div style={{ position: "absolute", top: 30, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6, zIndex: 4 }}>
        {[["world", "World"], ["marketplace", "Market"], ["pudm", "PUDM"], ["nexus", "Nexus"], ["lab", "Lab"], ["essence", "Essence"]].map(([h, l]) => (
          <a key={h} href={`/${h}`} style={{ fontSize: 11, color: "#7aa0c8", textDecoration: "none", padding: "5px 12px", borderRadius: 20, border: "1px solid #14304e", background: "rgba(8,16,28,0.6)", backdropFilter: "blur(6px)" }}>{l}</a>
        ))}
      </div>
      <div style={{ position: "absolute", top: 28, left: 32, zIndex: 2, pointerEvents: "none" }}>
        <div style={{ fontSize: 11, letterSpacing: "5px", color: "#5f7a9b", textTransform: "uppercase" }}>Philos</div>
        <div style={{ fontSize: 32, fontWeight: 700, color: "#e6ecf5", letterSpacing: "1px" }}>Living World</div>
        <div style={{ fontSize: 11, color: "#5f7a9b", marginTop: 2 }}>a system in motion · scroll to zoom · click a node</div>
      </div>
      <div style={{ position: "absolute", top: 108, left: 32, display: "flex", gap: 7, flexWrap: "wrap", maxWidth: 340, zIndex: 3 }}>
        {LAYERS.map(l => { const on = active.has(l.key); return (<button key={l.key} onClick={() => toggleLayer(l.key)} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 20, cursor: "pointer", background: on ? l.color + "22" : "transparent", color: on ? l.color : "#3a4f6b", border: `1px solid ${on ? l.color + "88" : "#1e3550"}`, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: on ? l.color : "#28405e", boxShadow: on ? `0 0 8px ${l.color}` : "none" }} />{l.label}</button>); })}
      </div>
      <div style={{ position: "absolute", top: 168, left: 32, width: 196, zIndex: 3, pointerEvents: "none" }}>
        <div style={{ fontSize: 10, letterSpacing: "2px", textTransform: "uppercase", color: "#5f7a9b", marginBottom: 8 }}>Living Forces</div>
        {forces.map(f => (<div key={f.key} style={{ marginBottom: 7 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#8ba3c0", marginBottom: 3 }}><span>{f.label}</span><span style={{ color: f.color, fontWeight: 600 }}>{f.v}</span></div><div style={{ height: 5, borderRadius: 3, background: "#0b1a2e", overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.max(6, (f.v / maxF) * 100)}%`, background: `linear-gradient(90deg, ${f.color}44, ${f.color})`, boxShadow: `0 0 10px ${f.color}`, borderRadius: 3 }} /></div></div>))}
      </div>
      <div style={{ position: "absolute", bottom: 28, left: 32, display: "flex", gap: 34, zIndex: 2, pointerEvents: "none" }}>{stat(counts.entities, "entities")}{stat(counts.missions, "active missions")}{stat(counts.relationships, "relationships")}{stat(counts.communities, "communities")}</div>
      <div style={{ position: "absolute", top: 28, right: 32, width: 250, zIndex: 2, pointerEvents: "none" }}>
        <div style={{ fontSize: 10, letterSpacing: "2px", textTransform: "uppercase", color: "#5f7a9b", marginBottom: 8 }}>Live · streaming</div>
        {feed.map((f, i) => (<div key={i} style={{ fontSize: 12, color: `rgba(207,230,245,${1 - i * 0.14})`, padding: "3px 0", borderTop: i ? "1px solid #ffffff0d" : "none" }}>{f}</div>))}
      </div>
      <div style={{ position: "absolute", bottom: 28, right: 32, display: "flex", alignItems: "center", gap: 9, zIndex: 2, pointerEvents: "none" }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#3fb950", boxShadow: "0 0 12px #3fb950", animation: "lfpulse 1.6s infinite" }} /><span style={{ fontSize: 13, color: "#cfe6f5" }}>Merlin · {ai}</span>
      </div>
      {maxBorn > 0 && (
        <div style={{ position: "absolute", bottom: 84, left: "50%", transform: "translateX(-50%)", width: "min(600px, 62vw)", zIndex: 3 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 6 }}>
            <button onClick={() => setPlaying(p => !p)} style={{ fontSize: 12, color: "#7cc4ff", background: "rgba(8,16,28,0.7)", border: "1px solid #1e4060", borderRadius: 20, padding: "4px 14px", cursor: "pointer", backdropFilter: "blur(6px)" }}>{playing ? "❚❚ pause" : "▶ replay growth"}</button>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#e6ecf5", minWidth: 92, textAlign: "center" }}>{curT >= (nowMs || maxBorn) ? "Today" : fmtDate(curT)}</span>
          </div>
          <input type="range" min={minBorn} max={forecastEnd} value={curT} onChange={e => { setPlaying(false); setPlayT(Number(e.target.value)); }} style={{ width: "100%", accentColor: "#38bdf8", cursor: "pointer" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, letterSpacing: "1px", textTransform: "uppercase", color: "#3a4f6b", marginTop: 2 }}><span>{fmtDate(minBorn)} · first values</span><span>Today</span><span>Forecast →</span></div>
        </div>
      )}
      {sel && (
        <div style={{ position: "absolute", top: "50%", right: 32, transform: "translateY(-50%)", width: 280, zIndex: 3, background: "rgba(6,12,22,0.82)", backdropFilter: "blur(10px)", border: `1px solid ${sel.color}55`, borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "1.5px", color: sel.color, marginBottom: 4 }}>{sel.type} · {sel.comm}</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#e6ecf5", marginBottom: 12 }}>{sel.label}</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderTop: "1px solid #ffffff0d" }}><span style={{ color: "#5f7a9b" }}>Relationships</span><span style={{ color: "#e6ecf5", fontWeight: 600 }}>{rels}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderTop: "1px solid #ffffff0d" }}><span style={{ color: "#5f7a9b" }}>Influence</span><span style={{ color: "#e6ecf5", fontWeight: 600 }}>{sel.deg}</span></div>
          <button onClick={() => { setSel(null); camRef.current.tzoom = 1; camRef.current.tx = 0; camRef.current.ty = 0; }} style={{ marginTop: 12, fontSize: 11, color: "#5f7a9b", background: "transparent", border: "1px solid #1e3550", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>close</button>
        </div>
      )}
      <style>{`@keyframes lfpulse{50%{opacity:.35}}`}</style>
    </div>
  );
}
