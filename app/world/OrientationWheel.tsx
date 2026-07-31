"use client";

import { useEffect, useRef } from "react";

/**
 * OrientationWheel — the orientation field of the world: PURPOSE (up) · ACTION
 * (right) · CONSTRAINTS (down) · VALUES (left), with a luminous indicator showing
 * where the field currently pulls. `bias` (each 0..1) shapes the pull toward each
 * pole; when omitted the field breathes gently. Pure canvas, matches the cinematic
 * theme. Reduced-motion aware.
 */
type Bias = { purpose?: number; action?: number; constraints?: number; values?: number };

export default function OrientationWheel({ bias }: { bias?: Bias }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const biasRef = useRef<Bias | undefined>(bias);
  biasRef.current = bias;

  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, t = 0;
    const SIZE = 240;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = SIZE * dpr; cv.height = SIZE * dpr;
    cv.style.width = SIZE + "px"; cv.style.height = SIZE + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = SIZE / 2, cy = SIZE / 2, R = SIZE * 0.34;

    const POLES = [
      { key: "purpose", label: "PURPOSE", ax: 0, ay: -1, color: "#a78bfa" },
      { key: "action", label: "ACTION", ax: 1, ay: 0, color: "#3fb950" },
      { key: "constraints", label: "CONSTRAINTS", ax: 0, ay: 1, color: "#fb923c" },
      { key: "values", label: "VALUES", ax: -1, ay: 0, color: "#38bdf8" },
    ] as const;

    function frame() {
      t += reduce ? 0 : 0.012;
      ctx!.clearRect(0, 0, SIZE, SIZE);
      // rings
      for (let i = 3; i >= 1; i--) {
        ctx!.beginPath(); ctx!.arc(cx, cy, R * (i / 3), 0, Math.PI * 2);
        ctx!.strokeStyle = "rgba(90,169,255," + (0.05 + (3 - i) * 0.04) + ")";
        ctx!.lineWidth = 1; ctx!.stroke();
      }
      // axes
      ctx!.strokeStyle = "rgba(90,169,255,0.10)"; ctx!.lineWidth = 1;
      ctx!.beginPath(); ctx!.moveTo(cx, cy - R); ctx!.lineTo(cx, cy + R);
      ctx!.moveTo(cx - R, cy); ctx!.lineTo(cx + R, cy); ctx!.stroke();

      // pull vector
      const b = biasRef.current;
      let px = 0, py = 0;
      if (b) {
        for (const p of POLES) { const w = (b as Record<string, number>)[p.key] ?? 0; px += p.ax * w; py += p.ay * w; }
        px *= 0.7; py *= 0.7;
      } else {
        px = Math.cos(t) * 0.5; py = Math.sin(t * 0.8) * 0.5;
      }
      // gentle life
      px += Math.cos(t * 1.3) * 0.05; py += Math.sin(t * 1.1) * 0.05;
      const ix = cx + px * R, iy = cy + py * R;

      // poles
      for (const p of POLES) {
        const bx = cx + p.ax * R, by = cy + p.ay * R;
        ctx!.fillStyle = p.color; ctx!.globalAlpha = 0.9;
        ctx!.beginPath(); ctx!.arc(bx, by, 3.5, 0, Math.PI * 2); ctx!.fill();
        ctx!.globalAlpha = 0.75; ctx!.fillStyle = p.color;
        ctx!.font = "600 9px var(--font-geist-sans), system-ui, sans-serif";
        ctx!.textAlign = p.ax === 0 ? "center" : p.ax > 0 ? "right" : "left";
        ctx!.textBaseline = p.ay === 0 ? "middle" : p.ay > 0 ? "top" : "bottom";
        const lx = cx + p.ax * (R + 8), ly = cy + p.ay * (R + 12);
        ctx!.fillText(p.label, lx, ly);
      }
      ctx!.globalAlpha = 1;

      // pull line + indicator
      ctx!.strokeStyle = "rgba(207,230,245,0.35)"; ctx!.lineWidth = 1.5;
      ctx!.beginPath(); ctx!.moveTo(cx, cy); ctx!.lineTo(ix, iy); ctx!.stroke();
      const g = ctx!.createRadialGradient(ix, iy, 0, ix, iy, 16);
      g.addColorStop(0, "#e6ecf5"); g.addColorStop(0.3, "#38bdf8"); g.addColorStop(1, "#38bdf800");
      ctx!.fillStyle = g; ctx!.beginPath(); ctx!.arc(ix, iy, 16, 0, Math.PI * 2); ctx!.fill();
      ctx!.fillStyle = "#e6ecf5"; ctx!.beginPath(); ctx!.arc(ix, iy, 3.5, 0, Math.PI * 2); ctx!.fill();
      // core
      ctx!.fillStyle = "rgba(90,169,255,0.5)"; ctx!.beginPath(); ctx!.arc(cx, cy, 2, 0, Math.PI * 2); ctx!.fill();

      if (!reduce) raf = requestAnimationFrame(frame);
    }
    frame();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "#1a3550", marginBottom: 8 }}>
        Orientation Field
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <canvas ref={ref} aria-hidden />
      </div>
    </div>
  );
}
