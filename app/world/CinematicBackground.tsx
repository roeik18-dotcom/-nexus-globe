"use client";

import { useEffect, useRef } from "react";

/**
 * CinematicBackground — a full-viewport animated backdrop (deep space nebula +
 * starfield + drifting luminous particles). Pure canvas, fixed behind content,
 * pointer-events:none. Raises the visual bar of the lens without touching its
 * data/graph logic. Respects prefers-reduced-motion.
 */
export default function CinematicBackground() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let W = 0, H = 0, raf = 0, t = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    let stars: { x: number; y: number; r: number; tw: number }[] = [];
    let motes: { x: number; y: number; vx: number; vy: number; r: number; c: string }[] = [];
    const MOTE_COLORS = ["#38bdf8", "#a78bfa", "#22d3ee", "#3fb950"];

    function seed() {
      stars = Array.from({ length: Math.round((W * H) / 6000) }, () => ({
        x: Math.random() * W, y: Math.random() * H, r: rnd(0.3, 1.4), tw: rnd(0, Math.PI * 2),
      }));
      motes = Array.from({ length: 46 }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: rnd(-0.12, 0.12), vy: rnd(-0.12, 0.12), r: rnd(0.8, 2.4),
        c: MOTE_COLORS[Math.floor(Math.random() * MOTE_COLORS.length)],
      }));
    }
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      cv!.width = W * dpr; cv!.height = H * dpr;
      cv!.style.width = W + "px"; cv!.style.height = H + "px";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function nebula(cx: number, cy: number, r: number, color: string, a: number) {
      const g = ctx!.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, color + Math.round(a * 255).toString(16).padStart(2, "0"));
      g.addColorStop(1, color + "00");
      ctx!.fillStyle = g;
      ctx!.beginPath(); ctx!.arc(cx, cy, r, 0, Math.PI * 2); ctx!.fill();
    }

    function frame() {
      t += reduce ? 0 : 0.004;
      // base
      const base = ctx!.createLinearGradient(0, 0, 0, H);
      base.addColorStop(0, "#030913"); base.addColorStop(0.55, "#04101f"); base.addColorStop(1, "#020a14");
      ctx!.fillStyle = base; ctx!.fillRect(0, 0, W, H);
      // drifting nebulae
      nebula(W * (0.28 + 0.05 * Math.sin(t)), H * (0.30 + 0.04 * Math.cos(t * 0.8)), Math.max(W, H) * 0.42, "#3b2d8f", 0.18);
      nebula(W * (0.75 + 0.05 * Math.cos(t * 0.7)), H * (0.68 + 0.05 * Math.sin(t)), Math.max(W, H) * 0.38, "#0e5a7a", 0.16);
      nebula(W * 0.55, H * (0.1 + 0.03 * Math.sin(t * 1.2)), Math.max(W, H) * 0.3, "#7a2f6a", 0.10);
      // stars
      for (const s of stars) {
        const tw = reduce ? 0.7 : 0.5 + 0.5 * Math.sin(t * 6 + s.tw);
        ctx!.globalAlpha = 0.25 + tw * 0.6;
        ctx!.fillStyle = "#cfe6f5";
        ctx!.beginPath(); ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx!.fill();
      }
      // luminous motes
      for (const m of motes) {
        if (!reduce) { m.x += m.vx; m.y += m.vy; }
        if (m.x < 0) m.x = W; if (m.x > W) m.x = 0;
        if (m.y < 0) m.y = H; if (m.y > H) m.y = 0;
        ctx!.globalAlpha = 0.5;
        const g = ctx!.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 6);
        g.addColorStop(0, m.c); g.addColorStop(1, m.c + "00");
        ctx!.fillStyle = g;
        ctx!.beginPath(); ctx!.arc(m.x, m.y, m.r * 6, 0, Math.PI * 2); ctx!.fill();
      }
      ctx!.globalAlpha = 1;
      // vignette
      const v = ctx!.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
      v.addColorStop(0, "#00000000"); v.addColorStop(1, "#000814aa");
      ctx!.fillStyle = v; ctx!.fillRect(0, 0, W, H);

      if (!reduce) raf = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener("resize", resize);
    frame();
    if (reduce) frame(); // single static paint
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}
    />
  );
}
