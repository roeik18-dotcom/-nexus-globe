"use client";

import { useEffect, useRef, useState } from "react";
import { useClientNow } from "./useClientNow";
import type { PNode, PEdge, Counts } from "./LivingPlanet";
import { clamp, smoothstep, hash32, rand01, fbm, curl, rgba, commColor } from "./visual";

/**
 * LivingField — the visual identity of Philos.
 *
 * Not a graph on a background: a place. Space itself moves (a curl-noise field
 * stirred into vortices by each community), relations carry visible energy
 * downstream, territories breathe as organic membranes, and the camera behaves
 * like a camera — it pushes in on arrival, drifts, and glides to what just
 * happened. Zoom is world-scale: pull back far enough and the civilisation
 * resolves into luminous territories seen from orbit.
 *
 * Everything drawn is real data — entities, relations, communities, birth
 * times. The field, bloom and drift are atmosphere, never presented as data.
 */

const NODE_COLOR: Record<string, string> = {
  mission: "#b18cff", gap: "#ff9d4d", value: "#4cc9ff",
  capability: "#ff6fc2", provider: "#4fdc86", entity: "#22d3ee",
};
const LAYERS = [
  { key: "mission", label: "Missions", color: NODE_COLOR.mission },
  { key: "value", label: "Values", color: NODE_COLOR.value },
  { key: "gap", label: "Gaps", color: NODE_COLOR.gap },
  { key: "capability", label: "Capabilities", color: NODE_COLOR.capability },
  { key: "provider", label: "Providers", color: NODE_COLOR.provider },
];

type Body = PNode & {
  x: number; y: number; vx: number; vy: number;
  deg: number; color: string; comm: string; rad: number;
  a: number;      // eased presence — births, layer toggles and time-scrub all fade
  hot: number;    // eased hover/selection highlight
  dep: number;    // parallax depth of its territory — near clusters ride bigger and move more
  sx: number; sy: number;   // screen position, resolved once per frame
};
type Link = { s: Body; t: Body; born: number; bow: number; phase: number; speed: number; a: number; charge: number };
type Ripple = { x: number; y: number; at: number; color: string; dep: number };
type Mote = { x: number; y: number; px: number; py: number; life: number; max: number; col: string };

export default function LivingField({ nodes, edges, counts, sampleEvents }: {
  nodes: PNode[]; edges: PEdge[]; counts: Counts; sampleEvents: string[];
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [sel, setSel] = useState<Body | null>(null);
  const selRef = useRef<Body | null>(null);
  const [feed, setFeed] = useState<string[]>([]);
  const [ai, setAi] = useState("Listening…");
  const [zoomUi, setZoomUi] = useState(1);
  const reactRef = useRef<{ id: string; at: number } | null>(null);

  const [active, setActive] = useState<Set<string>>(() => new Set(LAYERS.map(l => l.key)));
  const activeRef = useRef(active);
  const toggleLayer = (k: string) => setActive(s => {
    const n = new Set(s);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });
  // the render loop reads these from a ref; sync after commit, never during render
  useEffect(() => { selRef.current = sel; }, [sel]);
  useEffect(() => { activeRef.current = active; }, [active]);

  // ── time axis ─────────────────────────────────────────────────────────────
  const bornVals = nodes.map(n => n.born).filter(b => b > 0);
  const minBorn = bornVals.length ? Math.min(...bornVals) : 0;
  const maxBorn = bornVals.length ? Math.max(...bornVals) : 0;
  const nowMs = useClientNow();
  const [playT, setPlayT] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const timeRef = useRef(0);
  const forecastEnd = (nowMs || maxBorn) + 30 * 86_400_000;
  const curT = playT ?? maxBorn;
  // fixed locale: the server and the client must agree on this string
  const fmtDate = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  useEffect(() => { timeRef.current = curT; }, [curT]);
  useEffect(() => {
    if (!playing) return; let raf = 0; const s = performance.now(), d = 9000;
    const step = (ts: number) => {
      const k = Math.min(1, (ts - s) / d);
      setPlayT(minBorn + (maxBorn - minBorn) * k);
      if (k < 1) raf = requestAnimationFrame(step); else setPlaying(false);
    };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [playing, minBorn, maxBorn]);

  const forces = [
    { key: "purpose", label: "Purpose", color: NODE_COLOR.mission, v: nodes.filter(n => n.type === "mission").length },
    { key: "trust", label: "Trust", color: NODE_COLOR.value, v: edges.length },
    { key: "knowledge", label: "Knowledge", color: NODE_COLOR.capability, v: nodes.filter(n => n.type === "capability").length },
    { key: "opportunity", label: "Opportunity", color: NODE_COLOR.provider, v: nodes.filter(n => n.type === "provider").length },
    { key: "tension", label: "Tension", color: NODE_COLOR.gap, v: nodes.filter(n => n.type === "gap").length },
  ];
  const maxF = Math.max(...forces.map(f => f.v), 1);

  useEffect(() => {
    if (!sampleEvents.length) return; let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % sampleEvents.length;
      const reasoning = i % 3 === 0;
      setFeed(f => [reasoning ? `⟳ Merlin · orientation → decision · Knowledge +${1 + Math.floor(Math.random() * 3)}` : sampleEvents[i], ...f].slice(0, 5));
      if (nodes.length) reactRef.current = { id: nodes[Math.floor(Math.random() * nodes.length)].id, at: performance.now() };
    }, 2400);
    return () => clearInterval(id);
  }, [sampleEvents, nodes]);
  useEffect(() => {
    const s = ["Listening…", "Thinking…", "Searching World…", "Comparing Missions…", "Found."];
    let i = 0; const id = setInterval(() => { i = (i + 1) % s.length; setAi(s[i]); }, 2600);
    return () => clearInterval(id);
  }, []);

  // ── renderer ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0, raf = 0, t = 0, last = performance.now(), reportedZ = -1;
    const born0 = performance.now();

    // bloom buffer — bright things are drawn here, blurred, added back
    const glow = document.createElement("canvas");
    const gctx = glow.getContext("2d")!;
    const GS = 0.5;

    // ── bodies ──
    const deg = new Map<string, number>();
    edges.forEach(e => { deg.set(e.s, (deg.get(e.s) || 0) + 1); deg.set(e.t, (deg.get(e.t) || 0) + 1); });
    const maxDeg = Math.max(1, ...deg.values());
    const comms = Array.from(new Set(nodes.map(n => n.community || "general")));
    // communities seeded onto a golden-angle spiral — even, non-repeating, organic
    const seed = new Map(comms.map((c, i) => {
      const ang = i * 2.399963 + rand01("a:" + c) * 0.5;
      const rad = 300 + Math.sqrt(i + 0.6) * 250;
      return [c, { x: Math.cos(ang) * rad, y: Math.sin(ang) * rad * 0.84 }];
    }));
    const commDep = new Map(comms.map(c => [c, 0.86 + rand01("dep:" + c) * 0.30]));

    const B: Body[] = nodes.map(n => {
      const c = n.community || "general"; const s = seed.get(c)!;
      const d = deg.get(n.id) || 0;
      const j = rand01(n.id) * Math.PI * 2, jr = 20 + rand01("r:" + n.id) * 90;
      return {
        ...n, comm: c, deg: d, color: NODE_COLOR[n.type] || NODE_COLOR.entity,
        rad: 3 + (d / maxDeg) ** 0.65 * 11,
        x: s.x + Math.cos(j) * jr, y: s.y + Math.sin(j) * jr,
        vx: 0, vy: 0, a: 0, hot: 0, dep: commDep.get(c)!, sx: 0, sy: 0,
      };
    });
    const byId = new Map(B.map(b => [b.id, b]));
    const L: Link[] = edges.flatMap((e, i) => {
      const s = byId.get(e.s), tb = byId.get(e.t);
      if (!s || !tb || s === tb) return [];
      const k = `${e.s}>${e.t}:${i}`;
      return [{ s, t: tb, born: e.born, bow: (rand01(k) - 0.5) * 0.34,
        phase: rand01("p:" + k), speed: 0.09 + rand01("s:" + k) * 0.07, a: 0, charge: 0 }];
    });
    const hubIds = new Set([...B].sort((a, b) => b.deg - a.deg).slice(0, 8).map(b => b.id));
    const nbr = new Map<string, Set<string>>();
    for (const l of L) {
      if (!nbr.has(l.s.id)) nbr.set(l.s.id, new Set());
      if (!nbr.has(l.t.id)) nbr.set(l.t.id, new Set());
      nbr.get(l.s.id)!.add(l.t.id); nbr.get(l.t.id)!.add(l.s.id);
    }

    // ── physics — clusters that form, breathe and never quite settle ──
    type Cen = { x: number; y: number; n: number; col: string; dep: number };
    let cenList: (Cen & { name: string })[] = [];
    function physics(live: Body[], warm: number) {
      const cen = new Map<string, Cen>();
      for (const b of live) {
        const c = cen.get(b.comm) || { x: 0, y: 0, n: 0, col: commColor(b.comm), dep: b.dep };
        c.x += b.x; c.y += b.y; c.n++; cen.set(b.comm, c);
      }
      cen.forEach(c => { c.x /= c.n; c.y /= c.n; });
      for (let i = 0; i < live.length; i++) {
        const a = live[i];
        for (let j = i + 1; j < live.length; j++) {
          const b = live[j];
          let dx = a.x - b.x, dy = a.y - b.y;
          let d2 = dx * dx + dy * dy; if (d2 < 4) { d2 = 4; dx = 1; dy = 0.3; }
          if (d2 > 62500) continue;
          const d = Math.sqrt(d2);
          let f = 1500 / d2;
          const touch = (a.rad + b.rad) * 2.4;          // hard-ish collision: nodes never merge
          if (d < touch) f += (touch - d) * 0.42;
          const fx = (dx / d) * f, fy = (dy / d) * f;
          a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
        }
        const c = cen.get(a.comm)!;
        a.vx += (c.x - a.x) * 0.014; a.vy += (c.y - a.y) * 0.014;   // belong to your community
        // slow orbit around the community core — motion without jitter
        a.vx += -(a.y - c.y) * 0.0016 * warm; a.vy += (a.x - c.x) * 0.0016 * warm;
        a.vx += -a.x * 0.0011; a.vy += -a.y * 0.0011;               // the world holds together
      }
      const liveSet = new Set(live);
      for (const l of L) {
        if (l.born > timeRef.current) continue;
        if (!liveSet.has(l.s) || !liveSet.has(l.t)) continue;
        const dx = l.t.x - l.s.x, dy = l.t.y - l.s.y;
        const d = Math.hypot(dx, dy) || 1;
        const rest = l.s.comm === l.t.comm ? 84 : 320;   // cross-community ties stretch, keeping territories apart
        const k = l.s.comm === l.t.comm ? 0.012 : 0.0032;
        const f = (d - rest) * k, fx = (dx / d) * f, fy = (dy / d) * f;
        l.s.vx += fx; l.s.vy += fy; l.t.vx -= fx; l.t.vy -= fy;
      }
      for (const b of live) { b.vx *= 0.87; b.vy *= 0.87; b.x += b.vx; b.y += b.vy; }
      cenList = Array.from(cen, ([name, c]) => ({ name, ...c })).sort((p, q) => q.n - p.n);
    }
    // settle before the curtain goes up: the world opens already organised
    for (let i = 0; i < 320; i++) physics(B, 0);
    { // recentre so the world sits in the middle of the frame
      let mx = 0, my = 0;
      for (const b of B) { mx += b.x; my += b.y; }
      mx /= B.length || 1; my /= B.length || 1;
      for (const b of B) { b.x -= mx; b.y -= my; }
      physics(B, 0);   // refresh centroids in the recentred frame
    }
    // radius that holds most of the world — one far-flung community shouldn't shrink everything
    const radii = B.map(b => Math.hypot(b.x, b.y)).sort((a, b) => a - b);
    const worldR = Math.max(340, (radii[Math.floor(radii.length * 0.92)] || 340) + 120);

    // ── camera ──
    const cam = { x: 0, y: 0, z: 0.26, tx: 0, ty: 0, tz: 1, vx: 0, vy: 0, vz: 0 };
    const fitZ = () => clamp(Math.min(W, H) / (worldR * 1.82), 0.3, 1.4);
    let lastInput = 0, tourAt = born0 + 12000, tourHold = 0, shiftX = 0;
    const drag = { on: false, px: 0, py: 0 };
    const mouse = { x: -1e5, y: -1e5 };
    let hover: Body | null = null;
    const ripples: Ripple[] = [];

    // ── ambience ──
    const stars = Array.from({ length: 460 }, (_, i) => ({
      x: rand01("sx" + i), y: rand01("sy" + i), r: 0.25 + rand01("sr" + i) * 1.15,
      tw: rand01("st" + i) * 7, par: 0.02 + (i % 3) * 0.055,
    }));
    const nebula = Array.from({ length: 6 }, (_, i) => ({
      a: rand01("na" + i) * Math.PI * 2, r: 0.35 + rand01("nr" + i) * 0.55,
      col: commColor("neb" + i), sp: 0.03 + rand01("ns" + i) * 0.05,
    }));
    const MOTES = reduce ? 0 : 1500;
    const motes: Mote[] = [];
    // motes are born inside the inhabited world, not in the void around it
    const spawnMote = (m: Mote) => {
      const c = cenList.length ? cenList[(Math.random() * cenList.length) | 0] : null;
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (c ? 260 : worldR);
      m.x = m.px = (c?.x ?? 0) + Math.cos(a) * r;
      m.y = m.py = (c?.y ?? 0) + Math.sin(a) * r;
      m.max = 90 + Math.random() * 200; m.life = m.max * Math.random(); m.col = "#4a86d8";
      return m;
    };
    for (let i = 0; i < MOTES; i++) motes.push(spawnMote({ x: 0, y: 0, px: 0, py: 0, life: 0, max: 1, col: "#3f7fd8" }));

    // film grain — 64px tile, drawn with a wandering offset
    const grain = document.createElement("canvas"); grain.width = grain.height = 64;
    { const g = grain.getContext("2d")!; const im = g.createImageData(64, 64);
      for (let i = 0; i < 64 * 64; i++) { const v = (hash32("g" + i) % 255); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = 255; im.data[i * 4 + 3] = v > 218 ? 26 : 0; }
      g.putImageData(im, 0, 0); }
    const grainPat = ctx.createPattern(grain, "repeat")!;

    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      cv!.width = W * dpr; cv!.height = H * dpr;
      cv!.style.width = W + "px"; cv!.style.height = H + "px";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      glow.width = Math.max(1, Math.round(W * GS)); glow.height = Math.max(1, Math.round(H * GS));
      cam.tz = Math.max(cam.tz, 0.001);
    }

    // world → screen
    let SX = 0, SY = 0, Z = 1;
    // depth d scales a point's offset from the camera: near territories are larger
    // and sweep further as the camera moves — parallax, so the field has volume.
    const px = (x: number, d = 1) => SX + (x - cam.x) * Z * d;
    const py = (y: number, d = 1) => SY + (y - cam.y) * Z * d;
    const bezx = (a: number, c: number, b: number, u: number) => (1 - u) * (1 - u) * a + 2 * (1 - u) * u * c + u * u * b;

    type Lab = { text: string; x: number; y: number; a: number; size: number; col: string; pri: number; track?: string };
    const boxes: number[][] = [];
    function placeLabel(ctx2: CanvasRenderingContext2D, l: Lab) {
      ctx2.letterSpacing = l.track ?? "0px";
      ctx2.font = `${l.size >= 12 ? 600 : 500} ${l.size}px var(--font-geist-sans), system-ui, sans-serif`;
      const w = ctx2.measureText(l.text).width, h = l.size + 4;
      const x0 = l.x - w / 2 - 3, y0 = l.y - h, x1 = l.x + w / 2 + 3, y1 = l.y + 3;
      for (const b of boxes) if (x0 < b[2] && x1 > b[0] && y0 < b[3] && y1 > b[1]) return false;
      boxes.push([x0, y0, x1, y1]);
      ctx2.fillStyle = l.col.startsWith("#") ? rgba(l.col, l.a) : l.col;
      ctx2.fillText(l.text, l.x, l.y);
      return true;
    }

    function frame() {
      const now = performance.now();
      const dt = clamp((now - last) / 16.667, 0.2, 3); last = now;
      if (!reduce) t += dt * 0.016;
      const pt = timeRef.current, layers = activeRef.current;
      const intro = smoothstep(0, 1, (now - born0) / 1800);

      // presence easing — nothing pops into or out of the world
      const live: Body[] = [];
      for (const b of B) {
        const target = b.born <= pt && layers.has(b.type) ? 1 : 0;
        b.a += (target - b.a) * 0.085 * dt;
        if (target) live.push(b);
      }
      if (!reduce) physics(live, 1); else if (!cenList.length) physics(live, 0);

      // ── camera: spring + drift + auto-tour ──
      const selB = selRef.current;
      if (selB) { cam.tx = selB.x; cam.ty = selB.y; }
      else if (now > tourAt && now - lastInput > 7000 && cenList.length) {
        const c = cenList[Math.floor(rand01("tour" + Math.round(now / 1000)) * cenList.length)];
        cam.tx = c.x; cam.ty = c.y; cam.tz = clamp(fitZ() * 2.1, 0.8, 2.2);
        tourHold = now + 7000; tourAt = now + 22000;
      } else if (tourHold && now > tourHold && now - lastInput > 7000) {
        cam.tx = 0; cam.ty = 0; cam.tz = fitZ(); tourHold = 0;
      }
      const kz = 0.055 * dt, kd = Math.pow(0.84, dt);
      cam.vz += (cam.tz - cam.z) * kz; cam.vz *= kd; cam.z += cam.vz;
      cam.vx += (cam.tx - cam.x) * kz; cam.vx *= kd; cam.x += cam.vx;
      cam.vy += (cam.ty - cam.y) * kz; cam.vy *= kd; cam.y += cam.vy;
      Z = cam.z;
      if (Math.abs(Z - reportedZ) > 0.06) { reportedZ = Z; setZoomUi(Z); }
      // breath — the frame is never perfectly still
      const bx = reduce ? 0 : Math.sin(t * 0.11) * 16 + Math.sin(t * 0.043) * 10;
      const by = reduce ? 0 : Math.cos(t * 0.087) * 12 + Math.sin(t * 0.031) * 8;
      // when the detail panel opens, the world slides left so the subject stays visible
      shiftX += ((selB ? -142 : 0) - shiftX) * 0.07 * dt;
      SX = W / 2 + bx + shiftX; SY = H / 2 + by;
      if (!reduce) Z *= 1 + 0.010 * Math.sin(t * 0.062);   // the lens breathes too
      for (const b of B) { b.sx = px(b.x, b.dep); b.sy = py(b.y, b.dep); }

      // level of detail — one world, three scales
      const far = 1 - smoothstep(0.34, 0.62, Z);      // orbit: territories only
      const mid = smoothstep(0.36, 0.66, Z);          // nodes and flows
      const near = smoothstep(0.95, 1.6, Z);          // every label, every ring

      gctx.setTransform(GS, 0, 0, GS, 0, 0);
      gctx.clearRect(0, 0, W, H);
      gctx.globalCompositeOperation = "lighter";

      // ── deep space ──
      const bg = ctx!.createRadialGradient(SX, SY, 0, SX, SY, Math.max(W, H) * 0.85);
      bg.addColorStop(0, "#070d1c"); bg.addColorStop(0.45, "#040814"); bg.addColorStop(1, "#01030a");
      ctx!.fillStyle = bg; ctx!.fillRect(0, 0, W, H);

      ctx!.globalCompositeOperation = "lighter";
      for (let i = 0; i < nebula.length; i++) {
        const n = nebula[i];
        const dx = fbm(t * n.sp + i * 3.1, 1.7) * 180, dy = fbm(4.2, t * n.sp + i * 2.3) * 150;
        const gx = SX + (Math.cos(n.a) * worldR * n.r - cam.x * 0.35) * Z + dx * Z;
        const gy = SY + (Math.sin(n.a) * worldR * n.r - cam.y * 0.35) * Z + dy * Z;
        const gr = worldR * (0.5 + n.r) * Z;
        const g = ctx!.createRadialGradient(gx, gy, 0, gx, gy, gr);
        g.addColorStop(0, rgba(n.col, 0.115 * intro)); g.addColorStop(0.5, rgba(n.col, 0.038 * intro)); g.addColorStop(1, rgba(n.col, 0));
        ctx!.fillStyle = g; ctx!.beginPath(); ctx!.arc(gx, gy, gr, 0, 7); ctx!.fill();
      }
      ctx!.globalCompositeOperation = "source-over";

      for (const s of stars) {
        const sx = (s.x * W - cam.x * s.par * Z + W * 4) % W, sy = (s.y * H - cam.y * s.par * Z + H * 4) % H;
        ctx!.globalAlpha = (0.12 + 0.5 * Math.abs(Math.sin(t * 0.9 + s.tw))) * intro;
        ctx!.fillStyle = "#dbe9fb";
        ctx!.beginPath(); ctx!.arc(sx, sy, s.r, 0, 7); ctx!.fill();
      }
      ctx!.globalAlpha = 1;

      // ── territories: organic membranes around each community ──
      const rWorld = new Map<string, number>();
      for (const b of live) {
        const c = cenList.find(q => q.name === b.comm); if (!c) continue;
        const d = Math.hypot(b.x - c.x, b.y - c.y) + b.rad * 3;
        rWorld.set(b.comm, Math.max(rWorld.get(b.comm) || 90, d));
      }
      ctx!.globalCompositeOperation = "lighter";
      for (const c of cenList) {
        const R = (rWorld.get(c.name) || 90) * (1.06 - far * 0.30);   // territories draw apart from orbit
        const cxp = px(c.x, c.dep), cyp = py(c.y, c.dep), Rp = R * Z * c.dep;
        if (cxp < -Rp * 2 || cxp > W + Rp * 2 || cyp < -Rp * 2 || cyp > H + Rp * 2) continue;
        const seedN = hash32(c.name) % 40;
        ctx!.beginPath();
        for (let i = 0; i <= 48; i++) {
          const a = (i / 48) * Math.PI * 2;
          // membrane, not circle: the outline is warped by noise that drifts with time
          const wob = 1 + 0.26 * fbm(Math.cos(a) * 1.9 + seedN, Math.sin(a) * 1.9 + t * 0.14);
          const r = Rp * wob;
          const x = cxp + Math.cos(a) * r, y = cyp + Math.sin(a) * r * 0.88;
          i ? ctx!.lineTo(x, y) : ctx!.moveTo(x, y);
        }
        ctx!.closePath();
        const g = ctx!.createRadialGradient(cxp, cyp, 0, cxp, cyp, Rp * 1.25);
        const str = (0.30 + 0.16 * far) * intro * (0.75 + (c.dep - 0.86) * 1.1);
        g.addColorStop(0, rgba(c.col, str)); g.addColorStop(0.4, rgba(c.col, str * 0.45)); g.addColorStop(1, rgba(c.col, 0));
        ctx!.fillStyle = g; ctx!.fill();
      }
      ctx!.globalCompositeOperation = "source-over";

      // ── the field itself moves: curl flow, stirred into vortices by communities ──
      if (MOTES) {
        gctx.lineWidth = 1.05; gctx.lineCap = "round";
        const lim = worldR * 1.4;
        for (const m of motes) {
          // the medium itself flows: curl noise, wound into a vortex by every community
          const c = curl(m.x * 0.0060 + t * 0.05, m.y * 0.0060 - t * 0.035);
          let vx = c.x * 3.4, vy = c.y * 3.4;
          let best = 1e9, bcol = "#4a86d8", grip = 0;
          for (const cc of cenList) {
            const dx = m.x - cc.x, dy = m.y - cc.y, d2 = dx * dx + dy * dy;
            if (d2 < best) { best = d2; bcol = cc.col; }
            const R = (rWorld.get(cc.name) || 120) * 2.2;
            if (d2 > R * R || d2 < 9) continue;
            const d = Math.sqrt(d2), pull = 1 - d / R;
            grip = Math.max(grip, pull);
            vx += (-dy / d) * pull * 2.4 - (dx / d) * pull * 0.55;   // swirl + gentle intake
            vy += (dx / d) * pull * 2.4 - (dy / d) * pull * 0.55;
          }
          m.px = m.x; m.py = m.y;
          m.x += vx * dt; m.y += vy * dt; m.life -= dt;
          if (m.life <= 0 || Math.abs(m.x) > lim || Math.abs(m.y) > lim) { spawnMote(m); continue; }
          m.col = bcol;
          const x1 = px(m.x), y1 = py(m.y);
          if (x1 < -80 || x1 > W + 80 || y1 < -80 || y1 > H + 80) continue;
          const k = Math.min(1, (m.life / m.max) * 4) * Math.min(1, (m.max - m.life) / 26);
          // the current is only visible where a community grips it — the void stays void
          const A = 0.62 * k * intro * grip * (0.3 + 0.7 * grip) * (0.6 + far * 0.6);
          if (A < 0.006) continue;
          gctx.strokeStyle = rgba(m.col, A);
          gctx.beginPath();
          gctx.moveTo(px(m.x - vx * 5), py(m.y - vy * 5));   // streak along the current, cheap motion blur
          gctx.lineTo(x1, y1); gctx.stroke();
        }
      }

      // ── world boundary: an orbital ring, visible when you pull back ──
      if (far > 0.02) {
        ctx!.save(); ctx!.globalAlpha = far * 0.5 * intro;
        ctx!.setLineDash([2, 16]); ctx!.lineDashOffset = -t * 22;
        ctx!.strokeStyle = "#3d6fa8"; ctx!.lineWidth = 1;
        ctx!.beginPath(); ctx!.ellipse(px(0), py(0), worldR * 1.3 * Z, worldR * 1.18 * Z, 0, 0, 7); ctx!.stroke();
        ctx!.setLineDash([]); ctx!.globalAlpha = far * 0.22 * intro;
        ctx!.beginPath(); ctx!.ellipse(px(0), py(0), worldR * 1.62 * Z, worldR * 1.47 * Z, 0, 0, 7); ctx!.stroke();
        ctx!.restore();
      }

      // ── relations: energy travelling downstream ──
      const focus = selB ? nbr.get(selB.id) : null;
      const dimOthers = (id: string) => (!focus ? 1 : id === selB!.id || focus.has(id) ? 1 : 0.16);
      if (mid > 0.01) {
        for (const l of L) {
          const tgt = l.born <= pt && layers.has(l.s.type) && layers.has(l.t.type) ? 1 : 0;
          l.a += (tgt - l.a) * 0.08 * dt;
          l.charge *= Math.pow(0.985, dt);
          if (l.a < 0.02) continue;
          const ax = l.s.sx, ay = l.s.sy, bx2 = l.t.sx, by2 = l.t.sy;
          if (Math.max(ax, bx2) < -80 || Math.min(ax, bx2) > W + 80) continue;
          if (Math.max(ay, by2) < -80 || Math.min(ay, by2) > H + 80) continue;
          const dx = bx2 - ax, dy = by2 - ay, len = Math.hypot(dx, dy) || 1;
          const cx2 = (ax + bx2) / 2 + (-dy / len) * len * l.bow;
          const cy2 = (ay + by2) / 2 + (dx / len) * len * l.bow;
          const dim = Math.min(dimOthers(l.s.id), dimOthers(l.t.id));
          const heat = l.charge + Math.max(l.s.hot, l.t.hot);
          const A = l.a * mid * intro * dim * l.s.a * l.t.a;

          // long ties between territories read as faint threads; local ties are the visible weave
          const reach = l.s.comm === l.t.comm ? 1 : 0.34;
          const grad = ctx!.createLinearGradient(ax, ay, bx2, by2);
          grad.addColorStop(0, rgba(l.s.color, 0.44 * A * reach * (0.5 + heat)));
          grad.addColorStop(1, rgba(l.t.color, 0.44 * A * reach * (0.5 + heat)));
          ctx!.strokeStyle = grad; ctx!.lineWidth = 1 + heat * 1.5;
          ctx!.beginPath(); ctx!.moveTo(ax, ay); ctx!.quadraticCurveTo(cx2, cy2, bx2, by2); ctx!.stroke();

          // travelling packets — the relation is a current, not a line
          const n = l.s.deg + l.t.deg >= 6 ? 2 : 1;
          const spd = l.speed * (1 + l.charge * 1.6);
          for (let k = 0; k < n; k++) {
            const u0 = ((t * spd + l.phase + k / n) % 1);
            gctx.lineCap = "round";
            for (let s2 = 0; s2 < 5; s2++) {
              const u1 = u0 - s2 * 0.022, u2 = u0 - (s2 + 1) * 0.022;
              if (u2 < 0) break;
              const fadeK = (1 - s2 / 5);
              gctx.strokeStyle = rgba(s2 < 2 ? "#eaf4ff" : l.s.color, 0.8 * fadeK * A * reach * (0.75 + heat * 0.9));
              gctx.lineWidth = (3 - s2 * 0.45) * clamp(Z, 0.55, 1.8);
              gctx.beginPath();
              gctx.moveTo(bezx(ax, cx2, bx2, u1), bezx(ay, cy2, by2, u1));
              gctx.lineTo(bezx(ax, cx2, bx2, u2), bezx(ay, cy2, by2, u2));
              gctx.stroke();
            }
          }
        }
      }

      // ── nodes ──
      const labels: Lab[] = [];
      let hoverPick: Body | null = null; let hoverD = 26;
      for (const b of B) {
        if (b.a < 0.01) continue;
        const x = b.sx, y = b.sy;
        if (x < -60 || x > W + 60 || y < -60 || y > H + 60) { b.hot += (0 - b.hot) * 0.2; continue; }
        const isSel = selB?.id === b.id;
        const d = Math.hypot(mouse.x - x, mouse.y - y);
        const rs = b.rad * Z * b.dep * (0.55 + mid * 0.45);
        if (d < Math.max(hoverD, rs + 10)) { hoverD = d; hoverPick = b; }
        const wantHot = isSel ? 1 : hover?.id === b.id ? 0.8 : focus?.has(b.id) ? 0.45 : 0;
        b.hot += (wantHot - b.hot) * 0.12 * dt;
        const pulse = reduce ? 1 : 1 + 0.09 * Math.sin(t * 1.8 + b.x * 0.02 + b.y * 0.013);
        const dim = dimOthers(b.id);
        const depA = 0.70 + (b.dep - 0.86) * 1.25;   // atmospheric perspective: far territories sit back
        const A = b.a * intro * dim * depA;
        const r = rs * pulse * (1 + b.hot * 0.4);

        const gr = r * (4.2 + b.hot * 2.2);
        const g = gctx.createRadialGradient(x, y, 0, x, y, gr);
        g.addColorStop(0, rgba(b.color, 0.72 * A));
        g.addColorStop(0.32, rgba(b.color, 0.24 * A));
        g.addColorStop(1, rgba(b.color, 0));
        gctx.fillStyle = g; gctx.beginPath(); gctx.arc(x, y, gr, 0, 7); gctx.fill();

        // missions are the suns of this world — they throw an anamorphic flare
        if (b.type === "mission") {
          const fl = r * (7 + b.hot * 6);
          const fg = gctx.createLinearGradient(x - fl, y, x + fl, y);
          fg.addColorStop(0, rgba(b.color, 0)); fg.addColorStop(0.5, rgba(b.color, 0.5 * A)); fg.addColorStop(1, rgba(b.color, 0));
          gctx.fillStyle = fg; gctx.fillRect(x - fl, y - r * 0.32, fl * 2, r * 0.64);
          const fv = gctx.createLinearGradient(x, y - fl * 0.6, x, y + fl * 0.6);
          fv.addColorStop(0, rgba(b.color, 0)); fv.addColorStop(0.5, rgba(b.color, 0.4 * A)); fv.addColorStop(1, rgba(b.color, 0));
          gctx.fillStyle = fv; gctx.fillRect(x - r * 0.3, y - fl * 0.6, r * 0.6, fl * 1.2);
        }

        ctx!.globalAlpha = A * (0.35 + mid * 0.65);
        if (b.type === "gap") {
          // a gap is an absence: a hollow ring, dark at its centre
          ctx!.strokeStyle = b.color; ctx!.lineWidth = Math.max(1, r * 0.42);
          ctx!.beginPath(); ctx!.arc(x, y, r * 0.92, 0, 7); ctx!.stroke();
          ctx!.globalAlpha = A * 0.5;
          ctx!.fillStyle = "#f2f8ff";
          ctx!.beginPath(); ctx!.arc(x, y, r * 0.22, 0, 7); ctx!.fill();
        } else if (b.type === "provider") {
          // providers are cut stones — a rotated square catches the light differently
          ctx!.fillStyle = b.color;
          ctx!.beginPath();
          ctx!.moveTo(x, y - r * 1.15); ctx!.lineTo(x + r * 1.15, y);
          ctx!.lineTo(x, y + r * 1.15); ctx!.lineTo(x - r * 1.15, y);
          ctx!.closePath(); ctx!.fill();
          ctx!.fillStyle = "#f2f8ff";
          ctx!.beginPath(); ctx!.arc(x, y, r * 0.34, 0, 7); ctx!.fill();
        } else {
          ctx!.fillStyle = b.color;
          ctx!.beginPath(); ctx!.arc(x, y, r, 0, 7); ctx!.fill();
          ctx!.fillStyle = "#f2f8ff";
          ctx!.beginPath(); ctx!.arc(x, y, r * (0.42 + b.hot * 0.12), 0, 7); ctx!.fill();
        }
        // hubs wear a slowly turning ring once you are close enough to read them
        if (b.deg >= 4 && near > 0.02) {
          ctx!.globalAlpha = A * near * (0.3 + b.hot * 0.6);
          ctx!.strokeStyle = b.color; ctx!.lineWidth = 1;
          const a0 = t * 0.5 + rand01(b.id) * 7;
          ctx!.beginPath(); ctx!.arc(x, y, r * 2.4, a0, a0 + 2.1); ctx!.stroke();
          ctx!.beginPath(); ctx!.arc(x, y, r * 2.4, a0 + Math.PI, a0 + Math.PI + 2.1); ctx!.stroke();
        }
        if (isSel) {
          ctx!.globalAlpha = A * (0.5 + 0.4 * Math.sin(t * 3));
          ctx!.strokeStyle = "#eaf4ff"; ctx!.lineWidth = 1.4;
          ctx!.beginPath(); ctx!.arc(x, y, r * 3.4, 0, 7); ctx!.stroke();
        }
        ctx!.globalAlpha = 1;

        // landmarks are named at every scale; the rest of the world names itself as you approach
        const want = isSel ? 3 : b.hot > 0.3 ? 2 : hubIds.has(b.id) ? 1 : 0;
        const la = want >= 2 ? A : want === 1 ? A * (0.55 + 0.45 * near) : A * near * 0.8;
        // with something in focus, only the focused neighbourhood is named
        const named = !focus || b.id === selB!.id || focus.has(b.id);
        if (named && (want > 0 || near > 0.35) && la > 0.07)
          labels.push({ text: b.label.slice(0, 28), x, y: y - r - 10, a: Math.min(1, la * 1.5), size: want >= 2 ? 12 : 10.5, col: want >= 2 ? "#f0f6ff" : "#c2d8f0", pri: want * 10 + b.deg });
      }
      hover = hoverPick;

      // ── world-scale: territories resolve into orbs as you pull away ──
      if (far > 0.01) {
        for (const c of cenList) {
          const x = px(c.x, c.dep), y = py(c.y, c.dep);
          const R = clamp(14 + c.n * 2.2, 14, 38) * (0.7 + far * 0.5) * c.dep;
          const g = gctx.createRadialGradient(x, y, 0, x, y, R * 2.2);
          g.addColorStop(0, rgba(c.col, 0.30 * far)); g.addColorStop(0.4, rgba(c.col, 0.10 * far)); g.addColorStop(1, rgba(c.col, 0));
          gctx.fillStyle = g; gctx.beginPath(); gctx.arc(x, y, R * 2.2, 0, 7); gctx.fill();
          const g2 = ctx!.createRadialGradient(x - R * 0.35, y - R * 0.4, R * 0.1, x, y, R);
          g2.addColorStop(0, rgba(c.col, 0.42 * far)); g2.addColorStop(1, rgba(c.col, 0.04 * far));
          ctx!.fillStyle = g2; ctx!.beginPath(); ctx!.arc(x, y, R, 0, 7); ctx!.fill();
        }
      }

      // ── events ripple outward through the world ──
      const rc = reactRef.current;
      if (rc && !reduce) {
        const b = byId.get(rc.id);
        if (b && rc.at > (ripples.at(-1)?.at ?? -1)) {
          ripples.push({ x: b.x, y: b.y, at: rc.at, color: b.color, dep: b.dep });
          for (const l of L) if (l.s.id === rc.id || l.t.id === rc.id) l.charge = 1;
          if (ripples.length > 5) ripples.shift();
        }
      }
      for (const rp of ripples) {
        const el = now - rp.at; if (el > 2200) continue;
        const k = el / 2200, x = px(rp.x, rp.dep), y = py(rp.y, rp.dep);
        gctx.strokeStyle = rgba(rp.color, (1 - k) * 0.55 * intro);
        gctx.lineWidth = 2.5 * (1 - k) + 0.5;
        gctx.beginPath(); gctx.arc(x, y, (8 + k * 190) * Z * 0.6, 0, 7); gctx.stroke();
      }

      // ── bloom: wide halo then a tight core, added over the scene ──
      ctx!.globalCompositeOperation = "lighter";
      ctx!.filter = `blur(${Math.round(10 * dpr)}px)`;
      ctx!.globalAlpha = 0.62; ctx!.drawImage(glow, 0, 0, W, H);
      ctx!.filter = `blur(${Math.round(2 * dpr)}px)`;
      ctx!.globalAlpha = 0.84; ctx!.drawImage(glow, 0, 0, W, H);
      ctx!.filter = "none"; ctx!.globalAlpha = 1;
      ctx!.globalCompositeOperation = "source-over";

      // ── names ──
      // the chrome claims its space first, so a name never lands under a panel
      boxes.length = 0;
      boxes.push([0, 0, 252, 430], [W - 292, 78, W, 340], [0, H - 96, 500, H],
        [W - 340, H - 58, W, H], [W / 2 - 300, H - 150, W / 2 + 300, H - 62],
        [W / 2 - 220, 18, W / 2 + 220, 72]);
      if (selB) boxes.push([W - 330, H / 2 - 150, W, H / 2 + 150]);
      ctx!.textAlign = "center"; ctx!.textBaseline = "alphabetic";
      for (const c of cenList) {
        if (c.n < 2) continue;
        const R = (rWorld.get(c.name) || 90) * 1.06 * Z * c.dep;
        placeLabel(ctx!, {
          text: c.name.toUpperCase(),
          x: clamp(px(c.x, c.dep), 130, W - 130),
          y: clamp(py(c.y, c.dep) - (far > 0.5 ? 34 * c.dep : R * 0.95 + 8), 78, H - 60),
          // territory names belong to the wide view; they recede as you walk in
          a: (0.5 + far * 0.42) * (1 - near * 0.8) * intro, size: 9.5 + far * 4.5,
          col: "#a8c6e6", pri: 100, track: "2.6px",
        });
      }
      ctx!.shadowColor = "#020610"; ctx!.shadowBlur = 6;
      for (const l of labels.sort((a, b2) => b2.pri - a.pri)) placeLabel(ctx!, l);
      ctx!.shadowBlur = 0;

      // ── film: grain + vignette ──
      if (!reduce) {
        ctx!.save();
        ctx!.globalAlpha = 0.5;
        ctx!.translate(Math.floor(Math.sin(t * 31) * 32), Math.floor(Math.cos(t * 27) * 32));
        ctx!.fillStyle = grainPat; ctx!.fillRect(-64, -64, W + 128, H + 128);
        ctx!.restore();
      }
      const v = ctx!.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.78);
      v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(0.7, "rgba(0,2,8,0.42)"); v.addColorStop(1, "rgba(0,1,5,0.88)");
      ctx!.fillStyle = v; ctx!.fillRect(0, 0, W, H);
      if (intro < 1) { ctx!.fillStyle = `rgba(1,3,10,${1 - intro})`; ctx!.fillRect(0, 0, W, H); }

      cv!.style.cursor = drag.on ? "grabbing" : hover ? "pointer" : "grab";
      raf = requestAnimationFrame(frame);
    }

    // ── input ──
    const mark = () => { lastInput = performance.now(); tourHold = 0; tourAt = lastInput + 16000; };
    const onWheel = (e: WheelEvent) => {
      mark();
      const wx = cam.x + (e.clientX - SX) / Z, wy = cam.y + (e.clientY - SY) / Z;
      const nz = clamp(cam.tz * Math.pow(1.0016, -e.deltaY), 0.2, 4.2);
      cam.tz = nz; cam.tx = wx - (e.clientX - SX) / nz; cam.ty = wy - (e.clientY - SY) / nz;
    };
    const onDown = (e: PointerEvent) => { mark(); drag.on = true; drag.px = e.clientX; drag.py = e.clientY; };
    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX; mouse.y = e.clientY;
      if (!drag.on) return;
      const dx = (e.clientX - drag.px) / Z, dy = (e.clientY - drag.py) / Z;
      if (Math.hypot(e.clientX - drag.px, e.clientY - drag.py) > 2) { mark(); setSel(s => (s ? null : s)); }
      cam.tx -= dx; cam.ty -= dy; cam.x -= dx; cam.y -= dy;
      drag.px = e.clientX; drag.py = e.clientY;
    };
    const onUp = () => { drag.on = false; };
    const onClick = (e: MouseEvent) => {
      mark();
      let best: Body | null = null, bd = 26;
      for (const b of B) {
        if (b.a < 0.4) continue;
        const d = Math.hypot(b.sx - e.clientX, b.sy - e.clientY);
        if (d < Math.max(bd, b.rad * Z * b.dep + 10)) { bd = d; best = b; }
      }
      setSel(best);
      if (best) cam.tz = clamp(Math.max(cam.tz, 1.7), 1.7, 3);
      else { cam.tx = 0; cam.ty = 0; cam.tz = fitZ(); }
    };
    const onLeave = () => { mouse.x = mouse.y = -1e5; drag.on = false; };

    resize(); window.addEventListener("resize", resize);
    cam.tz = fitZ(); cam.z = fitZ() * 0.26;   // arrival: the camera pushes in
    cv.addEventListener("wheel", onWheel, { passive: true });
    cv.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    cv.addEventListener("click", onClick);
    cv.addEventListener("pointerleave", onLeave);
    frame();
    return () => {
      cancelAnimationFrame(raf); window.removeEventListener("resize", resize);
      cv.removeEventListener("wheel", onWheel); cv.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp);
      cv.removeEventListener("click", onClick); cv.removeEventListener("pointerleave", onLeave);
    };
  }, [nodes, edges]);

  const rels = sel ? edges.filter(e => e.s === sel.id || e.t === sel.id).length : 0;
  const scale = zoomUi < 0.45 ? "orbit" : zoomUi < 1.15 ? "world" : zoomUi < 2.2 ? "region" : "close";

  return (
    <div ref={wrapRef} style={S.root}>
      <canvas ref={ref} style={{ position: "absolute", inset: 0 }} />

      {/* masthead */}
      <div style={{ ...S.tl, ...S.rise(0.15) }}>
        <div style={S.kicker}>Philos</div>
        <h1 style={S.title}>Living World</h1>
        <div style={S.sub}>{counts.entities} entities · {counts.communities} communities · one world</div>
        <div style={S.hint}>drag to move · scroll for world scale · click to enter</div>
      </div>

      {/* lenses */}
      <nav style={{ ...S.lenses, ...S.rise(0.5) }}>
        {[["world", "World"], ["marketplace", "Market"], ["pudm", "PUDM"], ["nexus", "Nexus"], ["lab", "Lab"], ["essence", "Essence"]].map(([h, l]) => (
          <a key={h} href={`/${h}`} style={S.lens}>{l}</a>
        ))}
      </nav>

      {/* layers */}
      <div style={{ ...S.layers, ...S.rise(0.3) }}>
        {LAYERS.map(l => {
          const on = active.has(l.key);
          return (
            <button key={l.key} onClick={() => toggleLayer(l.key)} style={{
              ...S.chip,
              background: on ? rgbaHex(l.color, 0.13) : "rgba(255,255,255,0.02)",
              color: on ? l.color : "#42597a",
              borderColor: on ? rgbaHex(l.color, 0.45) : "#182a41",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 9, background: on ? l.color : "#243b57", boxShadow: on ? `0 0 9px ${l.color}` : "none" }} />
              {l.label}
            </button>
          );
        })}
      </div>

      {/* forces */}
      <div style={{ ...S.forces, ...S.rise(0.45) }}>
        <div style={S.eyebrow}>Living Forces</div>
        {forces.map(f => (
          <div key={f.key} style={{ marginBottom: 9 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "#7f9bbb", marginBottom: 4, letterSpacing: ".3px" }}>
              <span>{f.label}</span><span style={{ color: f.color, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{f.v}</span>
            </div>
            <div style={{ height: 3, borderRadius: 3, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.max(5, (f.v / maxF) * 100)}%`, background: f.color, boxShadow: `0 0 8px ${f.color}`, borderRadius: 3, transition: "width .8s cubic-bezier(.2,.8,.2,1)" }} />
            </div>
          </div>
        ))}
      </div>

      {/* stream */}
      <div style={{ ...S.stream, ...S.rise(0.6) }}>
        <div style={S.eyebrow}>Live · streaming</div>
        {feed.map((f, i) => (
          <div key={f + i} style={{ fontSize: 11.5, lineHeight: 1.45, color: `rgba(200,223,245,${0.95 - i * 0.17})`, padding: "5px 0", borderTop: i ? "1px solid rgba(255,255,255,0.05)" : "none", animation: i === 0 ? "lfslide .5s cubic-bezier(.2,.8,.2,1)" : undefined }}>{f}</div>
        ))}
      </div>

      {/* scale + stats */}
      <div style={{ ...S.stats, ...S.rise(0.75) }}>
        {([[counts.entities, "entities"], [counts.missions, "active missions"], [counts.relationships, "relationships"], [counts.communities, "communities"]] as const).map(([n, l]) => (
          <div key={l} style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 21, fontWeight: 600, color: "#e8f0fa", lineHeight: 1.1, letterSpacing: "-.5px", fontVariantNumeric: "tabular-nums" }}>{n.toLocaleString()}</span>
            <span style={S.statLabel}>{l}</span>
          </div>
        ))}
      </div>

      <div style={{ ...S.presence, ...S.rise(0.8) }}>
        <span style={S.scalePill}>{scale} scale</span>
        <span style={{ width: 7, height: 7, borderRadius: 9, background: "#4fdc86", boxShadow: "0 0 12px #4fdc86", animation: "lfpulse 1.8s infinite" }} />
        <span style={{ fontSize: 12.5, color: "#cfe3f7" }}>Merlin · {ai}</span>
      </div>

      {/* time */}
      {maxBorn > 0 && (
        <div style={{ ...S.time, ...S.rise(0.9) }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 7 }}>
            <button onClick={() => setPlaying(p => !p)} style={S.play}>{playing ? "❚❚ pause" : "▶ replay growth"}</button>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#e8f0fa", minWidth: 86, textAlign: "center", letterSpacing: ".3px" }}>
              {curT >= (nowMs || maxBorn) ? "Today" : fmtDate(curT)}
            </span>
          </div>
          <input type="range" min={minBorn} max={forecastEnd} value={curT}
            onChange={e => { setPlaying(false); setPlayT(Number(e.target.value)); }} style={S.range} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, letterSpacing: "1.4px", textTransform: "uppercase", color: "#39506e", marginTop: 4 }}>
            <span>{fmtDate(minBorn)} · first values</span><span>Today</span><span>Forecast →</span>
          </div>
        </div>
      )}

      {/* entity */}
      {sel && (
        <div key={sel.id} style={{ ...S.panel, borderColor: rgbaHex(sel.color, 0.35), animation: "lfpanel .45s cubic-bezier(.2,.8,.2,1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
            <span style={{ width: 7, height: 7, borderRadius: 9, background: sel.color, boxShadow: `0 0 10px ${sel.color}` }} />
            <span style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: "1.8px", color: sel.color }}>{sel.type}</span>
            <span style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: "1.2px", color: "#4a648a", marginLeft: "auto" }}>{sel.comm}</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#eef4fc", marginBottom: 14, lineHeight: 1.35, letterSpacing: "-.2px" }}>{sel.label}</div>
          {([["Relationships", String(rels)], ["Influence", String(sel.deg)], ["Standing", sel.deg >= 5 ? "hub" : sel.deg >= 2 ? "connector" : "leaf"]] as const).map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, padding: "6px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ color: "#5f7a9b" }}>{k}</span><span style={{ color: "#e8f0fa", fontWeight: 600 }}>{v}</span>
            </div>
          ))}
          <button onClick={() => setSel(null)} style={S.close}>← back to the world</button>
        </div>
      )}

      <style>{`
        @keyframes lfpulse{50%{opacity:.3}}
        @keyframes lfslide{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
        @keyframes lfrise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        @keyframes lfpanel{from{opacity:0;transform:translate(14px,-50%)}to{opacity:1;transform:translate(0,-50%)}}
        a:hover{color:#cfe3f7 !important;border-color:#2a527c !important}
        button:hover{filter:brightness(1.25)}
        input[type=range]{-webkit-appearance:none;appearance:none;background:transparent;height:16px}
        input[type=range]::-webkit-slider-runnable-track{height:2px;border-radius:2px;background:#1d3b5a}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:11px;height:11px;border-radius:50%;background:#7cc4ff;box-shadow:0 0 12px #7cc4ff;margin-top:-4.5px;cursor:pointer}
        @media (prefers-reduced-motion: reduce){*{animation:none !important}}
      `}</style>
    </div>
  );
}

const rgbaHex = (hex: string, a: number) => rgba(hex, a);

const S = {
  root: { position: "fixed", inset: 0, overflow: "hidden", background: "#01030a", color: "#e8f0fa",
    fontFamily: "var(--font-geist-sans), system-ui, sans-serif", WebkitFontSmoothing: "antialiased" } as React.CSSProperties,
  rise: (d: number): React.CSSProperties => ({ animation: `lfrise .9s cubic-bezier(.2,.8,.2,1) ${d}s both` }),
  tl: { position: "absolute", top: 30, left: 34, zIndex: 2, pointerEvents: "none" } as React.CSSProperties,
  kicker: { fontSize: 10, letterSpacing: "6px", color: "#4a648a", textTransform: "uppercase" } as React.CSSProperties,
  title: { fontSize: 33, fontWeight: 600, color: "#eef4fc", letterSpacing: "-.6px", margin: "3px 0 5px" } as React.CSSProperties,
  sub: { fontSize: 11, color: "#6b87a8", letterSpacing: ".2px" } as React.CSSProperties,
  hint: { fontSize: 10.5, color: "#3d5878", marginTop: 3, letterSpacing: ".2px" } as React.CSSProperties,
  lenses: { position: "absolute", top: 30, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 5, zIndex: 4 } as React.CSSProperties,
  lens: { fontSize: 10.5, color: "#7099c4", textDecoration: "none", padding: "6px 13px", borderRadius: 20,
    border: "1px solid rgba(120,180,255,0.13)", background: "rgba(6,12,24,0.5)", backdropFilter: "blur(10px)",
    transition: "all .2s ease", letterSpacing: ".3px" } as React.CSSProperties,
  layers: { position: "absolute", top: 138, left: 34, display: "flex", gap: 6, flexWrap: "wrap", maxWidth: 250, zIndex: 3 } as React.CSSProperties,
  chip: { fontSize: 9.5, padding: "5px 10px", borderRadius: 20, cursor: "pointer", borderWidth: 1, borderStyle: "solid",
    fontWeight: 600, display: "flex", alignItems: "center", gap: 6, letterSpacing: ".4px", transition: "all .25s ease",
    backdropFilter: "blur(8px)" } as React.CSSProperties,
  forces: { position: "absolute", top: 212, left: 34, width: 186, zIndex: 3, pointerEvents: "none" } as React.CSSProperties,
  eyebrow: { fontSize: 9, letterSpacing: "2.4px", textTransform: "uppercase", color: "#4a648a", marginBottom: 11 } as React.CSSProperties,
  stream: { position: "absolute", top: 92, right: 34, width: 244, zIndex: 2, pointerEvents: "none" } as React.CSSProperties,
  stats: { position: "absolute", bottom: 30, left: 34, display: "flex", gap: 30, zIndex: 2, pointerEvents: "none" } as React.CSSProperties,
  statLabel: { fontSize: 8.5, textTransform: "uppercase", letterSpacing: "1.6px", color: "#4a648a", marginTop: 3 } as React.CSSProperties,
  presence: { position: "absolute", bottom: 30, right: 34, display: "flex", alignItems: "center", gap: 10, zIndex: 2, pointerEvents: "none" } as React.CSSProperties,
  scalePill: { fontSize: 9, letterSpacing: "1.6px", textTransform: "uppercase", color: "#4a648a",
    border: "1px solid rgba(120,180,255,0.13)", borderRadius: 20, padding: "3px 9px", marginRight: 4 } as React.CSSProperties,
  time: { position: "absolute", bottom: 88, left: "50%", transform: "translateX(-50%)", width: "min(520px, 54vw)", zIndex: 3 } as React.CSSProperties,
  play: { fontSize: 11, color: "#7cc4ff", background: "rgba(6,12,24,0.6)", border: "1px solid rgba(120,180,255,0.18)",
    borderRadius: 20, padding: "5px 14px", cursor: "pointer", backdropFilter: "blur(10px)", letterSpacing: ".3px" } as React.CSSProperties,
  range: { width: "100%", accentColor: "#7cc4ff", cursor: "pointer" } as React.CSSProperties,
  panel: { position: "absolute", top: "50%", right: 34, transform: "translateY(-50%)", width: 272, zIndex: 5,
    background: "rgba(5,10,20,0.72)", backdropFilter: "blur(18px)", borderWidth: 1, borderStyle: "solid",
    borderRadius: 16, padding: 18 } as React.CSSProperties,
  close: { marginTop: 14, fontSize: 10.5, color: "#6b87a8", background: "transparent",
    border: "1px solid rgba(120,180,255,0.15)", borderRadius: 8, padding: "6px 11px", cursor: "pointer", width: "100%" } as React.CSSProperties,
};
