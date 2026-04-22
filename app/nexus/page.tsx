"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

/* ---------- PHILOS palette ---------- */

const FORCE_COLOR: Record<string, string> = {
  emotion: "#f472b6", // pink
  logic:   "#38bdf8", // cyan
  fear:    "#fb923c", // orange
  desire:  "#a78bfa", // violet
  duty:    "#00f5d4", // teal
};

const FORCE_HE: Record<string, string> = {
  emotion: "רגש",
  logic:   "היגיון",
  fear:    "פחד",
  desire:  "תשוקה",
  duty:    "חובה",
};

const CATEGORY_ATMOSPHERE: Record<string, string> = {
  anxiety:          "#fb923c",
  frustration:      "#ef4444",
  low_state:        "#64748b",
  decision:         "#38bdf8",
  career_friction:  "#a78bfa",
  relational:       "#f472b6",
  crisis:           "#dc2626",
  uncertainty:      "#38bdf8",
};

/* ---------- canonical node set (the 5 forces + Self + Event + Action) ---------- */

type PhilosNode = {
  id: string;
  kind: "self" | "force" | "event" | "action";
  force?: keyof typeof FORCE_COLOR;
  name: string;
  sub: string;
  lat: number;
  lng: number;
  base: number; // baseline weight
};

const BASE_NODES: PhilosNode[] = [
  { id: "self",    kind: "self",   name: "את/ה",     sub: "SELF",       lat:  32.08, lng:  34.78, base: 8 },
  { id: "emotion", kind: "force",  force: "emotion", name: "רגש",      sub: "EMOTION",   lat:   5,    lng:  20,   base: 5 },
  { id: "logic",   kind: "force",  force: "logic",   name: "היגיון",   sub: "LOGIC",     lat:  55,    lng: 100,   base: 5 },
  { id: "fear",    kind: "force",  force: "fear",    name: "פחד",      sub: "FEAR",      lat: -25,    lng: -65,   base: 5 },
  { id: "desire",  kind: "force",  force: "desire",  name: "תשוקה",    sub: "DESIRE",    lat:  15,    lng: 130,   base: 5 },
  { id: "duty",    kind: "force",  force: "duty",    name: "חובה",     sub: "DUTY",      lat:  60,    lng:  10,   base: 5 },
  { id: "event",   kind: "event",  name: "אירוע",   sub: "EVENT",      lat: -10,    lng:  45,   base: 4 },
  { id: "action",  kind: "action", name: "פעולה",   sub: "ACTION",     lat:  40,    lng: -30,   base: 6 },
];

/* ---------- types ---------- */

type LastResult = {
  category?: string;
  dominantForce?: string;
  conflict?: string;
  action?: string;
  echo?: { event?: string; intensity?: number; context?: string };
};

type RenderNode = PhilosNode & {
  value: number;
  color: string;
  highlight: boolean;
  altitude: number;
  radius: number;
};

type RenderArc = {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string[];
  stroke: number;
  altitude: number;
  dashTime: number;
  kind: "force" | "event" | "action" | "conflict";
};

/* ---------- conflict → pair of forces to highlight ---------- */

const CONFLICT_PAIR: Record<string, [string, string]> = {
  avoidance:         ["self", "fear"],
  blocked_expression:["self", "emotion"],
  disengagement:     ["self", "desire"],
  tradeoff:          ["logic", "desire"],
  role_vs_self:      ["duty", "desire"],
  expectation_gap:   ["duty", "emotion"],
  overload:          ["self", "duty"],
  hesitation:        ["logic", "fear"],
};

/* ---------- page ---------- */

export default function Page() {
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [selected, setSelected] = useState<RenderNode | null>(null);
  const [last, setLast] = useState<LastResult | null>(null);

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
    try {
      const saved = localStorage.getItem("lastResult");
      if (saved) setLast(JSON.parse(saved));
    } catch {}
  }, []);

  const intensity = last?.echo?.intensity ?? 5;
  const dominant = (last?.dominantForce ?? "") as string;
  const conflict = (last?.conflict ?? "") as string;
  const category = (last?.category ?? "") as string;

  /* derive node values from PHILOS result */
  const nodes: RenderNode[] = useMemo(() => {
    return BASE_NODES.map(n => {
      let value = n.base;
      let highlight = false;

      if (n.kind === "force" && n.force === dominant) {
        value = 10;
        highlight = true;
      }
      if (n.kind === "self") {
        value = Math.min(10, 5 + Math.round(intensity / 2));
      }
      if (n.kind === "event") {
        value = Math.min(10, 3 + Math.round(intensity / 2));
      }
      if (n.kind === "action" && last?.action) {
        value = 9;
        highlight = true;
      }

      const color =
        n.kind === "self"   ? "#e0f2fe" :
        n.kind === "event"  ? "#ef4444" :
        n.kind === "action" ? "#00f5d4" :
        FORCE_COLOR[n.force as string];

      return {
        ...n,
        value,
        color,
        highlight,
        altitude: 0.02 + (value / 10) * 0.28,
        radius:   0.4 + (value / 10) * 0.7 + (highlight ? 0.3 : 0),
      };
    });
  }, [dominant, intensity, last?.action]);

  const byId: Record<string, RenderNode> = {};
  nodes.forEach(n => (byId[n.id] = n));

  /* arcs:
     - every force ↔ self (always)
     - event → self (if we have a result)
     - self → action (if we have an action)
     - conflict pair highlighted red
  */
  const arcs: RenderArc[] = useMemo(() => {
    const out: RenderArc[] = [];
    const self = byId.self;
    if (!self) return out;

    (["emotion","logic","fear","desire","duty"] as const).forEach(f => {
      const n = byId[f];
      if (!n) return;
      const isDom = f === dominant;
      out.push({
        startLat: self.lat, startLng: self.lng,
        endLat: n.lat,      endLng: n.lng,
        color: [self.color, n.color],
        stroke: isDom ? 0.9 : 0.25,
        altitude: 0.22,
        dashTime: isDom ? 1600 : 3200,
        kind: "force",
      });
    });

    if (last) {
      const ev = byId.event;
      if (ev) {
        out.push({
          startLat: ev.lat, startLng: ev.lng,
          endLat: self.lat, endLng: self.lng,
          color: ["#ef4444", self.color],
          stroke: 0.6,
          altitude: 0.3,
          dashTime: 1400,
          kind: "event",
        });
      }
      if (last.action) {
        const ac = byId.action;
        if (ac) {
          out.push({
            startLat: self.lat, startLng: self.lng,
            endLat: ac.lat,     endLng: ac.lng,
            color: [self.color, "#00f5d4"],
            stroke: 0.9,
            altitude: 0.35,
            dashTime: 1200,
            kind: "action",
          });
        }
      }
    }

    const pair = CONFLICT_PAIR[conflict];
    if (pair) {
      const a = byId[pair[0]], b = byId[pair[1]];
      if (a && b) {
        out.push({
          startLat: a.lat, startLng: a.lng,
          endLat: b.lat,   endLng: b.lng,
          color: ["#ef4444", "#fb923c"],
          stroke: 1.2,
          altitude: 0.5,
          dashTime: 900,
          kind: "conflict",
        });
      }
    }

    return out;
  }, [byId, dominant, conflict, last]);

  const atmosphere = CATEGORY_ATMOSPHERE[category] || "#38bdf8";

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", background: "#020d1a", color: "#e0f2fe", fontFamily: "system-ui, sans-serif" }}>
      <div ref={wrap} style={{ flex: 1, position: "relative" }}>
        {/* Personal PHILOS overlay */}
        {last && (
          <div
            style={{
              position: "absolute",
              top: 20,
              left: 20,
              right: 20,
              zIndex: 5,
              background: "rgba(3,15,30,0.85)",
              border: `1px solid ${atmosphere}55`,
              backdropFilter: "blur(8px)",
              borderRadius: 8,
              padding: "14px 18px",
              pointerEvents: "none",
              maxWidth: 560,
            }}
          >
            <div style={{ fontSize: 9, letterSpacing: 3, color: atmosphere, textTransform: "uppercase", marginBottom: 6 }}>
              Your orientation · PHILOS
            </div>
            {last.action && (
              <div style={{ fontSize: 16, color: "#00f5d4", fontWeight: 700, marginBottom: 8 }}>
                {last.action}
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 10, color: "#8bb8cc" }}>
              {last.category && <span>category: <b style={{ color: "#e0f2fe" }}>{last.category}</b></span>}
              {last.conflict && <span>conflict: <b style={{ color: "#e0f2fe" }}>{last.conflict}</b></span>}
              {last.dominantForce && (
                <span>
                  force:{" "}
                  <b style={{ color: FORCE_COLOR[last.dominantForce] ?? "#e0f2fe" }}>
                    {FORCE_HE[last.dominantForce] ?? last.dominantForce}
                  </b>
                </span>
              )}
              {typeof last.echo?.intensity === "number" && (
                <span>intensity: <b style={{ color: "#e0f2fe" }}>{last.echo.intensity}/10</b></span>
              )}
            </div>
          </div>
        )}

        {!last && (
          <div
            style={{
              position: "absolute",
              top: 20,
              left: 20,
              zIndex: 5,
              background: "rgba(3,15,30,0.75)",
              border: "1px solid #0a2a4a",
              backdropFilter: "blur(8px)",
              borderRadius: 8,
              padding: "12px 16px",
              fontSize: 11,
              color: "#8bb8cc",
            }}
          >
            מלא את הטופס ב־<a href="/" style={{ color: "#38bdf8" }}>דף הבית</a> כדי לטעון ניתוח PHILOS לגלובוס.
          </div>
        )}

        {size.w > 0 && (
          <Globe
            width={size.w}
            height={size.h}
            globeImageUrl="https://unpkg.com/three-globe/example/img/earth-dark.jpg"
            backgroundColor="#020d1a"
            atmosphereColor={atmosphere}
            atmosphereAltitude={0.14 + (intensity / 10) * 0.14}
            pointsData={nodes}
            pointLat={(d: any) => d.lat}
            pointLng={(d: any) => d.lng}
            pointColor={(d: any) => d.color}
            pointAltitude={(d: any) => d.altitude}
            pointRadius={(d: any) => d.radius}
            pointLabel={(d: any) => `<b>${d.name}</b><br/>${d.sub} · ${d.value}`}
            onPointClick={(p: any) => setSelected(p)}
            arcsData={arcs}
            arcStartLat={(d: any) => d.startLat}
            arcStartLng={(d: any) => d.startLng}
            arcEndLat={(d: any) => d.endLat}
            arcEndLng={(d: any) => d.endLng}
            arcColor={(d: any) => d.color}
            arcStroke={(d: any) => d.stroke}
            arcAltitude={(d: any) => d.altitude}
            arcDashLength={0.4}
            arcDashGap={0.2}
            arcDashAnimateTime={(d: any) => d.dashTime}
          />
        )}
      </div>

      {/* side panel */}
      <div style={{ width: 280, background: "#030f1e", borderLeft: "1px solid #0a2a4a", padding: 20, overflowY: "auto" }}>
        <div style={{ fontSize: 13, letterSpacing: 4, color: atmosphere, fontWeight: 700, marginBottom: 4 }}>
          PHILOS · NEXUS
        </div>
        <div style={{ fontSize: 10, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 18 }}>
          {nodes.length} forces · {arcs.length} links
        </div>

        {selected ? (
          <div style={{ padding: 14, border: `1px solid ${selected.color}55`, borderRadius: 6, background: "#040e1c" }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{selected.name}</div>
            <div style={{ fontSize: 11, color: selected.color, marginBottom: 10 }}>{selected.sub}</div>
            <div style={{ display: "flex", gap: 14 }}>
              <div>
                <div style={{ fontSize: 16, color: "#00f5d4", fontWeight: 700 }}>{selected.value}</div>
                <div style={{ fontSize: 9, color: "#1e4060" }}>WEIGHT</div>
              </div>
              <div>
                <div style={{ fontSize: 16, color: atmosphere, fontWeight: 700 }}>
                  {Math.round((selected.value / 10) * 100)}%
                </div>
                <div style={{ fontSize: 9, color: "#1e4060" }}>INTENSITY</div>
              </div>
            </div>
            {selected.highlight && (
              <div style={{ marginTop: 10, fontSize: 10, color: "#00f5d4" }}>
                ● כוח דומיננטי
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: "#1e4060" }}>לחץ על נקודה בגלובוס</div>
        )}

        <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", margin: "20px 0 8px" }}>
          All forces
        </div>
        {[...nodes].sort((a, b) => b.value - a.value).map(n => (
          <div
            key={n.id}
            onClick={() => setSelected(n)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 10px",
              border: `1px solid ${n.highlight ? n.color + "88" : "#0a2a4a"}`,
              borderRadius: 6, marginBottom: 5, cursor: "pointer",
              background: selected?.id === n.id ? "#0a2a4a" : "#040e1c",
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: n.color, boxShadow: n.highlight ? `0 0 8px ${n.color}` : "none" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "#caf0f8" }}>{n.name}</div>
              <div style={{ fontSize: 9, color: "#1e4060" }}>{n.sub}</div>
            </div>
            <div style={{ fontSize: 10, color: atmosphere, fontWeight: 700 }}>{n.value}</div>
          </div>
        ))}

        {last?.echo?.event && (
          <div style={{ marginTop: 20, padding: 12, border: "1px solid #0a2a4a", borderRadius: 6, background: "#040e1c" }}>
            <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
              Event
            </div>
            <div style={{ fontSize: 12, color: "#e0f2fe", lineHeight: 1.4 }}>
              {last.echo.event}
            </div>
            {last.echo.context && (
              <div style={{ fontSize: 10, color: "#8bb8cc", marginTop: 6 }}>
                context: {last.echo.context}
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <a href="/" style={{
            display: "block", textAlign: "center",
            padding: "10px 12px", fontSize: 11, letterSpacing: 2,
            color: "#020d1a", fontWeight: 700,
            background: "linear-gradient(135deg,#00f5d4,#38bdf8)",
            borderRadius: 6, textDecoration: "none",
          }}>
            ניתוח חדש
          </a>
        </div>
      </div>
    </div>
  );
}
