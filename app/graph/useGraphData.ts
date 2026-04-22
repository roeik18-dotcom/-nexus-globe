"use client";

import { useEffect, useState } from "react";
import type { GraphData, GraphNode, GraphLink } from "./types";

const MOCK_NODES: GraphNode[] = [
  { id: "1", name: "Roei Kattan",     lat: 32.0853, lng: 34.7818,  value: 9, role: "Director"   },
  { id: "2", name: "Sarah Chen",      lat: 40.7128, lng: -74.0060, value: 7, role: "Engineer"   },
  { id: "3", name: "James Whitaker",  lat: 51.5074, lng: -0.1278,  value: 5, role: "Designer"   },
  { id: "4", name: "Yuki Tanaka",     lat: 35.6895, lng: 139.6917, value: 6, role: "Researcher" },
  { id: "5", name: "Marie Dubois",    lat: 48.8566, lng: 2.3522,   value: 4, role: "Analyst"    },
  { id: "6", name: "Ahmed Karimi",    lat: 25.2048, lng: 55.2708,  value: 5, role: "Engineer"   },
  { id: "7", name: "Luca Rossi",      lat: 41.9028, lng: 12.4964,  value: 3, role: "Designer"   },
  { id: "8", name: "Priya Sharma",    lat: 19.0760, lng: 72.8777,  value: 6, role: "Analyst"    },
];

const MOCK_LINKS: GraphLink[] = [
  { source: "1", target: "2" },
  { source: "1", target: "3" },
  { source: "1", target: "4" },
  { source: "2", target: "5" },
  { source: "2", target: "6" },
  { source: "3", target: "7" },
  { source: "4", target: "8" },
  { source: "5", target: "6" },
  { source: "6", target: "8" },
];

/**
 * Returns the network graph.
 * If `/api/analyze` has written a `lastResult` into localStorage, merges its
 * action text into the first node's name so it surfaces in the UI.
 */
export default function useGraphData(): GraphData {
  const [data, setData] = useState<GraphData>({ nodes: MOCK_NODES, links: MOCK_LINKS });

  useEffect(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem("lastResult") : null;
      if (!saved) return;
      const r = JSON.parse(saved);
      if (!r?.action) return;
      setData(prev => ({
        ...prev,
        nodes: prev.nodes.map((n, i) =>
          i === 0 ? { ...n, name: `${n.name} — ${r.action}` } : n
        ),
      }));
    } catch {
      // ignore parse errors
    }
  }, []);

  return data;
}

// named export kept for any legacy imports
export { useGraphData };
