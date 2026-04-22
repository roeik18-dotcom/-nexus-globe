"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

const ROLE_COLOR: Record<string, string> = {
  Designer: "#00f5d4", Engineer: "#38bdf8", Analyst: "#a78bfa",
  Researcher: "#f472b6", Director: "#fb923c",
};

const NODES = [
  { id: "1", name: "Roei Kattan",    lat: 32.0853, lng: 34.7818,  value: 9, role: "Director" },
  { id: "2", name: "Sarah Chen",     lat: 40.7128, lng: -74.0060, value: 7, role: "Engineer" },
  { id: "3", name: "James Whitaker", lat: 51.5074, lng: -0.1278,  value: 5, role: "Designer" },
  { id: "4", name: "Yuki Tanaka",    lat: 35.6895, lng: 139.6917, value: 6, role: "Researcher" },
  { id: "5", name: "Marie Dubois",   lat: 48.8566, lng: 2.3522,   value: 4, role: "Analyst" },
  { id: "6", name: "Ahmed Karimi",   lat: 25.2048, lng: 55.2708,  value: 5, role: "Engineer" },
  { id: "7", name: "Luca Rossi",     lat: 41.9028, lng: 12.4964,  value: 3, role: "Designer" },
  { id: "8", name: "Priya Sharma",   lat: 19.0760, lng: 72.8777,  value: 6, role: "Analyst" },
];

const LINKS = [
  { s: "1", t: "2" }, { s: "1", t: "3" }, { s: "1", t: "4" },
  { s: "2", t: "5" }, { s: "2", t: "6" }, { s: "3", t: "7" },
  { s: "4", t: "8" }, { s: "5", t: "6" }, { s: "6", t: "8" },
];

type LastResult = {
  category?: string;
  dominantForce?: string;
  conflict?: string;
  action?: string;
  echo?: { event?: string; intensity?: number; context?: string };
};

export default function Page() {
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [selected, setSelected] = useState<typeof NODES[0] | null>(null);
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

  const byId: Record<string, typeof NODES[0]> = {};
  NODES.forEach(n => (byId[n.id] = n));
  const maxVal = Math.max(...NODES.map(n => n.value));

  const arcs = LINKS.map(l => {
    const s = byId[l.s], t = byId[l.t];
    return {
      startLat: s.lat, startLng: s.lng,
      endLat: t.lat, endLng: t.lng,
      color: [ROLE_COLOR[s.role], ROLE_COLOR[t.role]],
    };
  });

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", background: "#020d1a", color: "#e0f2fe", fontFamily: "system-ui, sans-serif" }}>
      <div ref={wrap} style={{ flex: 1, position: "relative" }}>
        {/* Personal analysis overlay */}
        {last?.action && (
          <div
            style={{
              position: "absolute",
              top: 20,
              left: 20,
              right: 20,
              zIndex: 5,
              background: "rgba(3,15,30,0.85)",
              border: "1px solid #0a2a4a",
              backdropFilter: "blur(8px)",
              borderRadius: 8,
              padding: "14px 18px",
              pointerEvents: "none",
              maxWidth: 520,
            }}
          >
            <div style={{ fontSize: 9, letterSpacing: 3, color: "#38bdf8", textTransform: "uppercase", marginBottom: 6 }}>
              Your orientation
            </div>
            <div style={{ fontSize: 16, color: "#00f5d4", fontWeight: 700, marginBottom: 8 }}>
              {last.action}
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 10, color: "#8bb8cc" }}>
              {last.category && <span>category: <b style={{ color: "#e0f2fe" }}>{last.category}</b></span>}
              {last.conflict && <span>conflict: <b style={{ color: "#e0f2fe" }}>{last.conflict}</b></span>}
              {last.dominantForce && <span>force: <b style={{ color: "#e0f2fe" }}>{last.dominantForce}</b></span>}
            </div>
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
            pointsData={NODES}
            pointLat={(d: any) => d.lat}
            pointLng={(d: any) => d.lng}
            pointColor={(d: any) => ROLE_COLOR[d.role]}
            pointAltitude={(d: any) => 0.02 + (d.value / maxVal) * 0.25}
            pointRadius={(d: any) => 0.4 + (d.value / maxVal) * 0.6}
            pointLabel={(d: any) => `<b>${d.name}</b><br/>${d.role} · ${d.value}`}
            onPointClick={(p: any) => setSelected(p)}
            arcsData={arcs}
            arcStartLat={(d: any) => d.startLat}
            arcStartLng={(d: any) => d.startLng}
            arcEndLat={(d: any) => d.endLat}
            arcEndLng={(d: any) => d.endLng}
            arcColor={(d: any) => d.color}
            arcStroke={0.3}
            arcAltitude={0.25}
            arcDashLength={0.4}
            arcDashGap={0.2}
            arcDashAnimateTime={2500}
          />
        )}
      </div>

      <div style={{ width: 260, background: "#030f1e", borderLeft: "1px solid #0a2a4a", padding: 20, overflowY: "auto" }}>
        <div style={{ fontSize: 13, letterSpacing: 4, color: "#38bdf8", fontWeight: 700, marginBottom: 4 }}>NEXUS</div>
        <div style={{ fontSize: 10, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 18 }}>
          {NODES.length} nodes · {LINKS.length} links
        </div>

        {selected ? (
          <div style={{ padding: 14, border: "1px solid #0a2a4a", borderRadius: 6, background: "#040e1c" }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{selected.name}</div>
            <div style={{ fontSize: 11, color: ROLE_COLOR[selected.role], marginBottom: 10 }}>{selected.role}</div>
            <div style={{ display: "flex", gap: 14 }}>
              <div>
                <div style={{ fontSize: 16, color: "#00f5d4", fontWeight: 700 }}>{selected.value}</div>
                <div style={{ fontSize: 9, color: "#1e4060" }}>INFLUENCE</div>
              </div>
              <div>
                <div style={{ fontSize: 16, color: "#38bdf8", fontWeight: 700 }}>
                  {Math.round((selected.value / maxVal) * 100)}%
                </div>
                <div style={{ fontSize: 9, color: "#1e4060" }}>RANK</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: "#1e4060" }}>Click a point on the globe</div>
        )}

        <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", margin: "20px 0 8px" }}>
          All nodes
        </div>
        {[...NODES].sort((a, b) => b.value - a.value).map(n => (
          <div
            key={n.id}
            onClick={() => setSelected(n)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 10px", border: "1px solid #0a2a4a",
              borderRadius: 6, marginBottom: 5, cursor: "pointer",
              background: selected?.id === n.id ? "#0a2a4a" : "#040e1c",
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: ROLE_COLOR[n.role] }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "#caf0f8" }}>{n.name}</div>
              <div style={{ fontSize: 9, color: "#1e4060" }}>{n.role}</div>
            </div>
            <div style={{ fontSize: 10, color: "#38bdf8", fontWeight: 700 }}>{n.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
