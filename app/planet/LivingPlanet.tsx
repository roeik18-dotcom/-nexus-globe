"use client";

import { useEffect, useRef, useState } from "react";

/**
 * LivingPlanet — entering Philos as a PLACE. A rotating planet of the real World
 * Graph: real entities as nodes sized by influence (degree = hierarchy), real
 * relations as flowing energy arcs, thousands of ambient particles for depth/life,
 * atmosphere + bloom + starfield, live event stream, ambient AI presence. Scroll to
 * zoom (camera). Click a node to focus. Real counts only; the ambient field is
 * atmosphere, never presented as data.
 */
export type PNode = { id: string; type: string; label: string; born: number };
export type PEdge = { s: string; t: string; born: number };
export type Counts = { entities: number; missions: number; relationships: number; communities: number };

const COLOR: Record<string, string> = {
  mission: "#a78bfa", gap: "#fb923c", value: "#38bdf8", capability: "#f472b6",
  provider: "#3fb950", person: "#e6ecf5", entity: "#22d3ee",
};

type Placed = PNode & { lat: number; lon: number; color: string; deg: number };

export default function LivingPlanet({ nodes, edges, counts, sampleEvents }: {
  nodes: PNode[]; edges: PEdge[]; counts: Counts; sampleEvents: string[];
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const zoomRef = useRef(1);
  const frontRef = useRef<{ n: Placed; sx: number; sy: number; r: number }[]>([]);
  const [sel, setSel] = useState<Placed | null>(null);
  const [feed, setFeed] = useState<string[]>([]);
  const [ai, setAi] = useState("Listening…");

  // ── Time axis: the world was born over a week; scrub to watch it grow ──
  const timeRef = useRef<number>(0);
  const bornVals = nodes.map(n => n.born).filter(b => b > 0);
  const minBorn = bornVals.length ? Math.min(...bornVals) : 0;
  const maxBorn = bornVals.length ? Math.max(...bornVals) : 0;
  const [nowMs, setNowMs] = useState(0);
  const [playT, setPlayT] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const forecastEnd = (nowMs || maxBorn) + 30 * 86_400_000;
  const curT = playT ?? maxBorn;
  timeRef.current = curT;

  useEffect(() => { setNowMs(Date.now()); setPlayT(maxBorn); }, [maxBorn]);
  useEffect(() => {
    if (!playing) return;
    let raf = 0; const start = performance.now(), dur = 8000;
    const step = (ts: number) => {
      const k = Math.min(1, (ts - start) / dur);
      setPlayT(minBorn + (maxBorn - minBorn) * k);
      if (k < 1) raf = requestAnimationFrame(step); else setPlaying(false);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, minBorn, maxBorn]);
  const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  useEffect(() => {
    if (!sampleEvents.length) return;
    let i = 0;
    const id = setInterval(() => { i = (i + 1) % sampleEvents.length; setFeed(f => [sampleEvents[i], ...f].slice(0, 6)); }, 2000);
    return () => clearInterval(id);
  }, [sampleEvents]);
  useEffect(() => {
    const s = ["Listening…", "Thinking…", "Searching World…", "Comparing Missions…", "Found."];
    let i = 0; const id = setInterval(() => { i = (i + 1) % s.length; setAi(s[i]); }, 2500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0, H = 0, raf = 0, t = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const deg = new Map<string, number>();
    edges.forEach(e => { deg.set(e.s, (deg.get(e.s) || 0) + 1); deg.set(e.t, (deg.get(e.t) || 0) + 1); });
    const maxDeg = Math.max(1, ...deg.values());

    const P: Placed[] = nodes.map((n, i) => {
      let h = 2166136261; for (let k = 0; k < n.id.length; k++) { h ^= n.id.charCodeAt(k); h = Math.imul(h, 16777619); }
      const lat = (((h >>> 0) % 1000) / 1000 - 0.5) * Math.PI;
      const lon = (((h >>> 10) % 1000) / 1000) * Math.PI * 2 + i * 1e-4;
      return { ...n, lat, lon, color: COLOR[n.type] || COLOR.entity, deg: deg.get(n.id) || 0 };
    });
    const pos = new Map(P.map(p => [p.id, p]));
    // hierarchy: nodes drawn small→large so hubs sit on top; labels only for top hubs
    const byDeg = [...P].sort((a, b) => b.deg - a.deg);
    const hubIds = new Set(byDeg.slice(0, 7).map(p => p.id));

    const stars = Array.from({ length: 300 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.3, tw: Math.random() * 6 }));
    // ambient life — thousands of faint drifting motes (atmosphere, not data)
    const amb = Array.from({ length: 1800 }, () => ({ a: Math.random() * Math.PI * 2, rr: 0.4 + Math.random() * 1.15, sp: 0.2 + Math.random() * 0.8, r: Math.random() * 1.1, c: Math.random() < 0.5 ? "#2a4a7a" : "#1e5a6a" }));

    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      cv!.width = W * dpr; cv!.height = H * dpr; cv!.style.width = W + "px"; cv!.style.height = H + "px";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const proj = (lat: number, lon: number, R: number, cx: number, cy: number) => {
      const x = Math.cos(lat) * Math.sin(lon + t), y = Math.sin(lat), z = Math.cos(lat) * Math.cos(lon + t);
      return { sx: cx + x * R, sy: cy - y * R, z };
    };
    const bez = (p0: number, p1: number, p2: number, u: number) => (1 - u) * (1 - u) * p0 + 2 * (1 - u) * u * p1 + u * u * p2;

    function frame() {
      t += reduce ? 0 : 0.0011;
      const pt = timeRef.current;   // time playhead — only born-by-now entities exist
      const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.33 * zoomRef.current;
      const bg = ctx!.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#03070f"); bg.addColorStop(1, "#01030a");
      ctx!.fillStyle = bg; ctx!.fillRect(0, 0, W, H);
      // starfield
      ctx!.fillStyle = "#cfe6f5";
      for (const s of stars) { ctx!.globalAlpha = 0.18 + 0.55 * Math.abs(Math.sin(t * 4 + s.tw)); ctx!.beginPath(); ctx!.arc(s.x * W, s.y * H, s.r, 0, 7); ctx!.fill(); }
      // ambient motes (depth halo around planet)
      for (const m of amb) {
        const ang = m.a + (reduce ? 0 : t * m.sp);
        const rr = R * (1.05 + m.rr * 0.5);
        const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr * 0.62;
        ctx!.globalAlpha = 0.18; ctx!.fillStyle = m.c;
        ctx!.beginPath(); ctx!.arc(x, y, m.r, 0, 7); ctx!.fill();
      }
      ctx!.globalAlpha = 1;
      // atmosphere
      const at = ctx!.createRadialGradient(cx, cy, R * 0.72, cx, cy, R * 1.65);
      at.addColorStop(0, "rgba(56,160,248,0.18)"); at.addColorStop(1, "rgba(56,160,248,0)");
      ctx!.fillStyle = at; ctx!.beginPath(); ctx!.arc(cx, cy, R * 1.65, 0, 7); ctx!.fill();
      // body
      const gb = ctx!.createRadialGradient(cx - R * 0.38, cy - R * 0.38, R * 0.1, cx, cy, R);
      gb.addColorStop(0, "#14223e"); gb.addColorStop(1, "#050b16");
      ctx!.fillStyle = gb; ctx!.beginPath(); ctx!.arc(cx, cy, R, 0, 7); ctx!.fill();

      // energy arcs (real relations) with a flowing pulse
      let drawn = 0;
      for (let i = 0; i < edges.length; i++) {
        if (edges[i].born > pt) continue;   // relation not yet born at playhead
        const a = pos.get(edges[i].s), b = pos.get(edges[i].t); if (!a || !b) continue;
        const pa = proj(a.lat, a.lon, R, cx, cy), pb = proj(b.lat, b.lon, R, cx, cy);
        if (pa.z < 0 && pb.z < 0) continue;
        drawn++;
        const mx = (pa.sx + pb.sx) / 2, my = (pa.sy + pb.sy) / 2 - R * 0.14;
        ctx!.strokeStyle = "rgba(80,150,240,0.10)"; ctx!.lineWidth = 1;
        ctx!.beginPath(); ctx!.moveTo(pa.sx, pa.sy); ctx!.quadraticCurveTo(mx, my, pb.sx, pb.sy); ctx!.stroke();
        // flowing energy dot
        const u = ((t * 0.6 + i * 0.13) % 1);
        const fx = bez(pa.sx, mx, pb.sx, u), fy = bez(pa.sy, my, pb.sy, u);
        ctx!.globalAlpha = 0.8; ctx!.fillStyle = "#7cc4ff";
        ctx!.beginPath(); ctx!.arc(fx, fy, 1.4, 0, 7); ctx!.fill(); ctx!.globalAlpha = 1;
      }

      // nodes — small→large (hierarchy), hubs glow + label
      const projected = P.map(p => ({ p, ...proj(p.lat, p.lon, R, cx, cy) }))
        .sort((u, v) => (u.p.deg - v.p.deg) || (u.z - v.z));
      const front: typeof frontRef.current = [];
      for (const { p, sx, sy, z } of projected) {
        if (p.born > pt) continue;   // entity not yet born at the playhead
        const front0 = z > 0;
        const scale = (1 + (p.deg / maxDeg) * 3.2) * Math.max(zoomRef.current * 0.85, 0.7);
        const rad = (front0 ? 2 : 1.1) * scale;
        ctx!.globalAlpha = front0 ? 1 : 0.2;
        if (front0) {
          const g = ctx!.createRadialGradient(sx, sy, 0, sx, sy, rad * 4.5);
          g.addColorStop(0, p.color); g.addColorStop(0.5, p.color + "55"); g.addColorStop(1, p.color + "00");
          ctx!.fillStyle = g; ctx!.beginPath(); ctx!.arc(sx, sy, rad * 4.5, 0, 7); ctx!.fill();
          front.push({ n: p, sx, sy, r: rad });
        }
        ctx!.fillStyle = front0 ? "#eef4ff" : p.color;
        ctx!.beginPath(); ctx!.arc(sx, sy, rad, 0, 7); ctx!.fill();
        ctx!.beginPath(); ctx!.arc(sx, sy, rad * 0.6, 0, 7); ctx!.fillStyle = p.color; ctx!.fill();
        if (front0 && hubIds.has(p.id) && zoomRef.current > 0.85) {
          ctx!.globalAlpha = 0.9; ctx!.fillStyle = "#cfe6f5";
          ctx!.font = "600 10px var(--font-geist-sans), system-ui, sans-serif"; ctx!.textAlign = "center";
          ctx!.fillText(p.label.slice(0, 26), sx, sy - rad - 6);
        }
        ctx!.globalAlpha = 1;
      }
      frontRef.current = front;
      // vignette
      const v = ctx!.createRadialGradient(cx, cy, Math.min(W, H) * 0.25, cx, cy, Math.max(W, H) * 0.7);
      v.addColorStop(0, "#00000000"); v.addColorStop(1, "#00030acc");
      ctx!.fillStyle = v; ctx!.fillRect(0, 0, W, H);
      if (!reduce) raf = requestAnimationFrame(frame);
    }
    resize(); window.addEventListener("resize", resize);
    const onWheel = (e: WheelEvent) => { zoomRef.current = Math.min(2.6, Math.max(0.6, zoomRef.current - e.deltaY * 0.0013)); };
    const onClick = (e: MouseEvent) => {
      let best: Placed | null = null, bd = 22;
      for (const f of frontRef.current) { const d = Math.hypot(f.sx - e.clientX, f.sy - e.clientY); if (d < Math.max(bd, f.r + 8)) { bd = d; best = f.n; } }
      setSel(best);
    };
    cv.addEventListener("wheel", onWheel, { passive: true });
    cv.addEventListener("click", onClick);
    if (reduce) resize(); frame();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); cv.removeEventListener("wheel", onWheel); cv.removeEventListener("click", onClick); };
  }, [nodes, edges]);

  const rels = sel ? edges.filter(e => e.s === sel.id || e.t === sel.id).length : 0;
  const stat = (n: number, l: string) => (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: 22, fontWeight: 700, color: "#e6ecf5", lineHeight: 1.1 }}>{n.toLocaleString()}</span>
      <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "1.5px", color: "#5f7a9b" }}>{l}</span>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#01030a", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
      <canvas ref={ref} style={{ position: "absolute", inset: 0, cursor: "grab" }} />

      <div style={{ position: "absolute", top: 28, left: 32, zIndex: 2, pointerEvents: "none" }}>
        <div style={{ fontSize: 11, letterSpacing: "5px", color: "#5f7a9b", textTransform: "uppercase" }}>Philos</div>
        <div style={{ fontSize: 32, fontWeight: 700, color: "#e6ecf5", letterSpacing: "1px" }}>Living Planet</div>
        <div style={{ fontSize: 11, color: "#5f7a9b", marginTop: 2 }}>scroll to zoom · click a node · you are entering the world</div>
      </div>

      <div style={{ position: "absolute", bottom: 28, left: 32, display: "flex", gap: 34, zIndex: 2, pointerEvents: "none" }}>
        {stat(counts.entities, "entities")}{stat(counts.missions, "active missions")}
        {stat(counts.relationships, "relationships")}{stat(counts.communities, "communities")}
      </div>

      <div style={{ position: "absolute", top: 28, right: 32, width: 250, zIndex: 2, pointerEvents: "none" }}>
        <div style={{ fontSize: 10, letterSpacing: "2px", textTransform: "uppercase", color: "#5f7a9b", marginBottom: 8 }}>Live · streaming</div>
        {feed.map((f, i) => (<div key={i} style={{ fontSize: 12, color: `rgba(207,230,245,${1 - i * 0.14})`, padding: "3px 0", borderTop: i ? "1px solid #ffffff0d" : "none" }}>{f}</div>))}
      </div>

      <div style={{ position: "absolute", bottom: 28, right: 32, display: "flex", alignItems: "center", gap: 9, zIndex: 2, pointerEvents: "none" }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#3fb950", boxShadow: "0 0 12px #3fb950", animation: "pplanetpulse 1.6s infinite" }} />
        <span style={{ fontSize: 13, color: "#cfe6f5" }}>Merlin · {ai}</span>
      </div>

      {/* Time axis — scrub Past → Today → Forecast; the world grows */}
      {maxBorn > 0 && (
        <div style={{ position: "absolute", bottom: 84, left: "50%", transform: "translateX(-50%)", width: "min(600px, 62vw)", zIndex: 3 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 6 }}>
            <button onClick={() => setPlaying(p => !p)} title="Replay the world's growth"
              style={{ fontSize: 12, color: "#7cc4ff", background: "rgba(8,16,28,0.7)", border: "1px solid #1e4060", borderRadius: 20, padding: "4px 14px", cursor: "pointer", backdropFilter: "blur(6px)" }}>
              {playing ? "❚❚ pause" : "▶ replay growth"}
            </button>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#e6ecf5", minWidth: 92, textAlign: "center" }}>
              {curT >= (nowMs || maxBorn) ? "Today" : fmtDate(curT)}
            </span>
          </div>
          <input type="range" min={minBorn} max={forecastEnd} value={curT}
            onChange={e => { setPlaying(false); setPlayT(Number(e.target.value)); }}
            style={{ width: "100%", accentColor: "#38bdf8", cursor: "pointer" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, letterSpacing: "1px", textTransform: "uppercase", color: "#3a4f6b", marginTop: 2 }}>
            <span>{fmtDate(minBorn)} · first values</span>
            <span>Today</span>
            <span>Forecast →</span>
          </div>
        </div>
      )}

      {sel && (
        <div style={{ position: "absolute", top: "50%", right: 32, transform: "translateY(-50%)", width: 280, zIndex: 3, background: "rgba(6,12,22,0.82)", backdropFilter: "blur(10px)", border: `1px solid ${sel.color}55`, borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "1.5px", color: sel.color, marginBottom: 4 }}>{sel.type}</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#e6ecf5", marginBottom: 12 }}>{sel.label}</div>
          <Row k="Relationships" v={String(rels)} /><Row k="Influence (degree)" v={String(sel.deg)} />
          <Row k="Rank" v={sel.deg >= 4 ? "hub" : sel.deg >= 2 ? "connector" : "leaf"} />
          <div style={{ fontSize: 10, color: "#3a4f6b", marginTop: 12 }}>zoom · orbit · history · forecast — coming next</div>
          <button onClick={() => setSel(null)} style={{ marginTop: 12, fontSize: 11, color: "#5f7a9b", background: "transparent", border: "1px solid #1e3550", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>close</button>
        </div>
      )}
      <style>{`@keyframes pplanetpulse{50%{opacity:.35}}`}</style>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderTop: "1px solid #ffffff0d" }}>
      <span style={{ color: "#5f7a9b" }}>{k}</span><span style={{ color: "#e6ecf5", fontWeight: 600 }}>{v}</span>
    </div>
  );
}
