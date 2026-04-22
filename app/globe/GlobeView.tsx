"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { GraphData, GraphNode } from "../graph/types";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

const ROLE_COLOR: Record<string, string> = {
  Designer:   "#00f5d4",
  Engineer:   "#38bdf8",
  Analyst:    "#a78bfa",
  Researcher: "#f472b6",
  Director:   "#fb923c",
};

type Props = {
  data: GraphData;
  onSelect?: (node: GraphNode) => void;
};

export default function GlobeView({ data, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Size the globe to its parent, responsively.
  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const maxValue = Math.max(...data.nodes.map(n => n.value), 1);

  // Build arcs from links so relationships are visible on the globe.
  const nodeById: Record<string, GraphNode> = {};
  data.nodes.forEach(n => { nodeById[n.id] = n; });
  const arcs = data.links
    .map(l => {
      const s = nodeById[l.source];
      const t = nodeById[l.target];
      if (!s || !t) return null;
      return {
        startLat: s.lat, startLng: s.lng,
        endLat:   t.lat, endLng:   t.lng,
        color: [
          ROLE_COLOR[s.role] ?? "#38bdf8",
          ROLE_COLOR[t.role] ?? "#38bdf8",
        ],
      };
    })
    .filter(Boolean) as any[];

  return (
    <div ref={wrapRef} style={{ width: "100%", height: "100%" }}>
      {size.w > 0 && (
        <Globe
          width={size.w}
          height={size.h}
          globeImageUrl="https://unpkg.com/three-globe/example/img/earth-dark.jpg"
          backgroundColor="#020d1a"
          atmosphereColor="#38bdf8"
          atmosphereAltitude={0.18}
          pointsData={data.nodes}
          pointLat={(d: any) => d.lat}
          pointLng={(d: any) => d.lng}
          pointColor={(d: any) => ROLE_COLOR[d.role] ?? "#38bdf8"}
          pointAltitude={(d: any) => 0.02 + (d.value / maxValue) * 0.25}
          pointRadius={(d: any) => 0.4 + (d.value / maxValue) * 0.6}
          pointLabel={(d: any) => `<b>${d.name}</b><br/>${d.role} · ${d.value}`}
          onPointClick={(p: any) => onSelect && onSelect(p)}
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
  );
}
