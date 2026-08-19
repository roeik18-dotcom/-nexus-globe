"use client";

/**
 * CanonGlobeMarkers — the first real-canon-data surface on the Nexus Globe
 * screen (systemic-integration-audit, Globe slice 1).
 *
 * Deliberately NOT plotted as lat/lng points on the 3D sphere. Two reasons:
 *   1. `projectCanonDynamics`'s `CanonObservationMark` carries no location —
 *      canon's `Observation` schema has no location field at all — so any
 *      lat/lng would be invented. "No fabricated geographic relationships"
 *      and "UNKNOWN stays UNKNOWN" are explicit requirements for this slice;
 *      this panel states that plainly instead of guessing a position.
 *   2. The existing `<Globe pointsData=.../>` in `page.tsx` is one large,
 *      tightly-coupled prop web already driving the demo/local nodes
 *      (`GlobeLiveLayer`, community stars, arcs). Merging into it would risk
 *      the existing (already-fabricated, Fork-B-audited) mock layer and is
 *      not the smallest safe slice. This component is a fully independent
 *      sibling overlay instead — same compositional pattern `GlobeLiveLayer`
 *      itself already uses next to `<Globe>` — reading its own data, touching
 *      no shared state, no `pointsData`/`labelsData`/`arcsData` prop.
 *
 * Read-only: fetches once via `loadCanonForGlobeAction` (a Server Action that
 * only calls `projectCanonDynamics`, itself read-only). No polling, no write.
 */

import { useEffect, useState } from "react";
import { loadCanonForGlobeAction } from "./canonGlobeAction";
import type { CanonDynamicsGraph } from "@/app/lib/philos/canon/projectCanonDynamics";
import { encodeSystemContextRef } from "@/app/lib/systemContext";

const DOMAIN_LABEL: Record<string, string> = { G: "physical", E: "emotional", C: "cognitive" };
const FRAME_LABEL: Record<string, string> = { I: "individual", R: "relational", S: "systemic" };

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "loaded"; graph: CanonDynamicsGraph };

export default function CanonGlobeMarkers() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadCanonForGlobeAction()
      .then((graph) => {
        if (!cancelled) setState({ status: "loaded", graph });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        right: 356,
        zIndex: 6,
        maxWidth: 240,
        background: "rgba(2,13,26,0.86)",
        backdropFilter: "blur(10px)",
        border: "1px solid #38bdf855",
        borderRadius: 8,
        padding: "10px 12px",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontSize: 8,
          color: "#38bdf8",
          letterSpacing: 2,
          textTransform: "uppercase",
          marginBottom: 5,
        }}
      >
        PHILOS canon — real Observations
      </div>

      {state.status === "error" ? (
        <div style={{ fontSize: 10, color: "#8bb8cc" }}>read failed — canon store unavailable</div>
      ) : state.graph.nodes.length === 0 ? (
        <div style={{ fontSize: 10, color: "#8bb8cc" }}>no Observations in the canon store</div>
      ) : (
        <>
          <div style={{ fontSize: 9, color: "#8bb8cc", marginBottom: 6 }}>
            {state.graph.summary.node_count} persisted · physical {state.graph.summary.domains.G} ·
            emotional {state.graph.summary.domains.E} · cognitive {state.graph.summary.domains.C}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 160, overflowY: "auto" }}>
            {state.graph.nodes.map((n) => (
              <div
                key={n.id}
                style={{
                  fontSize: 9,
                  color: "#caf0f8",
                  borderTop: "1px solid #0a2a4a",
                  paddingTop: 4,
                }}
                title={n.tooltip}
              >
                {DOMAIN_LABEL[n.domain]} / {FRAME_LABEL[n.frame]} · {n.context}
                <br />
                <span style={{ color: "#5b7488" }}>
                  level {n.level} · stability {n.stability} · persisted · self_reported
                </span>
                <br />
                <a
                  href={`/dynamics?ctx=${encodeURIComponent(
                    encodeSystemContextRef({ kind: "canon_observation", canon_event_id: n.canon_event_id }),
                  )}`}
                  style={{ color: "#38bdf8", pointerEvents: "auto" }}
                >
                  view in Dynamics →
                </a>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 8, color: "#5b7488", marginTop: 6 }}>
            location: UNKNOWN — canon carries no location field, none is plotted here
          </div>
        </>
      )}
    </div>
  );
}
