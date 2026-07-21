"use client";

import { useState, useMemo } from "react";
import { computeCoverageMetrics } from "@/app/graph/computeCoverageMetrics";
import type { Mission } from "@/app/lib/mission/schema";
import type { Gap } from "@/app/lib/gap/schema";
import type { Capability } from "@/app/lib/capability/schema";
import type { ValueCapabilityRelation } from "@/app/lib/value-capability-relation/schema";
import type { ProviderCapabilityRelation } from "@/app/lib/provider-capability-relation/schema";

// ── Types ─────────────────────────────────────────────────────────────────────

type ExplorerMode = "remove" | "add";

interface Patch {
  mode:     ExplorerMode;
  // add mode
  addGapId:  string;
  addCapId:  string;
  // remove mode
  removeVcrId: string;
}

interface DeltaRowProps {
  label:  string;
  before: number | string;
  after:  number | string;
  unit?:  string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDelta(before: number, after: number, unit = "") {
  const d = after - before;
  if (d === 0) return { text: "—", color: "#4a6a8a" };
  const sign = d > 0 ? "+" : "";
  return { text: `${sign}${d}${unit}`, color: d > 0 ? "#34D399" : "#F87171" };
}

function DeltaRow({ label, before, after, unit = "" }: DeltaRowProps) {
  const numBefore = typeof before === "number" ? before : NaN;
  const numAfter  = typeof after  === "number" ? after  : NaN;
  const delta     = !isNaN(numBefore) && !isNaN(numAfter)
    ? formatDelta(numBefore, numAfter, unit)
    : { text: "—", color: "#4a6a8a" };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 52px 52px 60px", gap: 4, alignItems: "center", padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span style={{ fontSize: 10, color: "#4a6a8a" }}>{label}</span>
      <span style={{ fontSize: 10, fontWeight: 600, color: "#22D3EE", textAlign: "right" as const, fontVariantNumeric: "tabular-nums" }}>
        {before}{unit}
      </span>
      <span style={{ fontSize: 10, fontWeight: 600, color: "#5B8CFF", textAlign: "right" as const, fontVariantNumeric: "tabular-nums" }}>
        {after}{unit}
      </span>
      <span style={{ fontSize: 10, fontWeight: 700, color: delta.color, textAlign: "right" as const, fontVariantNumeric: "tabular-nums" }}>
        {delta.text}
      </span>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  mission:       Mission;
  gaps:          Gap[];
  capabilities:  Capability[];
  vcRelations:   ValueCapabilityRelation[];
  pcRelations:   ProviderCapabilityRelation[];
  contextualVcrs: ValueCapabilityRelation[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CoverageDeltaExplorer({
  mission,
  gaps,
  capabilities,
  vcRelations,
  pcRelations,
  contextualVcrs,
}: Props) {
  const [explorerMode, setExplorerMode] = useState<ExplorerMode>("remove");
  const [patch, setPatch] = useState<Patch>({
    mode:         "remove",
    addGapId:     "",
    addCapId:     "",
    removeVcrId:  "",
  });

  const gapById  = useMemo(() => new Map(gaps.map(g => [g.id, g])), [gaps]);
  const capById  = useMemo(() => new Map(capabilities.map(c => [c.id, c])), [capabilities]);

  // Gaps in this mission that appear in gapById
  const missionGaps = useMemo(
    () => (mission.gaps ?? []).map(ref => gapById.get(ref.gapId)).filter(Boolean) as Gap[],
    [mission, gapById]
  );

  // Available caps for "add" mode: not already linked via required_for for the selected gap+mission
  const addGap = gapById.get(patch.addGapId);
  const addGapFirstValueId = addGap?.requiredValues?.[0]?.valueId ?? "";
  const availableCaps = useMemo(() => {
    if (!patch.addGapId || !addGapFirstValueId) return capabilities;
    const alreadyLinked = new Set(
      contextualVcrs
        .filter(r => r.gapId === patch.addGapId && r.valueId === addGapFirstValueId)
        .map(r => r.capabilityId)
    );
    return capabilities.filter(c => !alreadyLinked.has(c.id));
  }, [patch.addGapId, addGapFirstValueId, contextualVcrs, capabilities]);

  // Before metrics (live data)
  const beforeMetrics = useMemo(
    () => computeCoverageMetrics(mission, gapById, vcRelations, pcRelations, "contextual"),
    [mission, gapById, vcRelations, pcRelations]
  );

  // Patch validity
  const patchReady = explorerMode === "remove"
    ? !!patch.removeVcrId
    : !!(patch.addGapId && patch.addCapId && addGapFirstValueId);

  // After metrics (sandboxed — no JSON mutation)
  const afterMetrics = useMemo(() => {
    if (!patchReady) return null;
    let sandboxVcrs: ValueCapabilityRelation[];
    if (explorerMode === "remove") {
      sandboxVcrs = vcRelations.filter(r => r.id !== patch.removeVcrId);
    } else {
      const synthetic: ValueCapabilityRelation = {
        id:            "__delta_add__",
        type:          "ValueCapabilityRelation",
        valueId:       addGapFirstValueId,
        capabilityId:  patch.addCapId,
        missionId:     mission.id,
        gapId:         patch.addGapId,
        relationType:  "required_for",
        status:        "candidate",
        evidenceGrade: "Candidate",
        createdAt:     "",
        updatedAt:     "",
        evidence:      [],
      };
      sandboxVcrs = [...vcRelations, synthetic];
    }
    return computeCoverageMetrics(mission, gapById, sandboxVcrs, pcRelations, "contextual");
  }, [patchReady, explorerMode, patch, vcRelations, pcRelations, mission, gapById, addGapFirstValueId]);

  // VCR label helper
  function vcrLabel(vcr: ValueCapabilityRelation): string {
    const capLabel = capById.get(vcr.capabilityId)?.context?.label ?? vcr.capabilityId;
    return `${vcr.valueId} → ${capLabel} (gap: ${vcr.gapId ?? "—"})`;
  }

  const SELECT_STYLE: React.CSSProperties = {
    fontSize: 10, padding: "3px 6px", borderRadius: 3,
    background: "#071420", color: "#8ab8d8",
    border: "1px solid #0c2040", fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
    width: "100%", marginTop: 3,
  };

  return (
    <div style={{
      marginTop: 16,
      background: "rgba(34,211,238,0.04)",
      border: "1px solid rgba(34,211,238,0.15)",
      borderRadius: 6, padding: "12px 14px",
    }}>
      {/* Mode toggle */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {(["remove", "add"] as ExplorerMode[]).map(m => {
          const active = explorerMode === m;
          return (
            <button
              key={m}
              onClick={() => { setExplorerMode(m); setPatch(p => ({ ...p, mode: m })); }}
              style={{
                flex: 1, fontSize: 9, padding: "4px 6px", borderRadius: 3, cursor: "pointer",
                fontWeight: active ? 700 : 400,
                background: active ? "rgba(34,211,238,0.15)" : "transparent",
                color: active ? "#22D3EE" : "#4a6a8a",
                border: `1px solid ${active ? "rgba(34,211,238,0.4)" : "#0c2040"}`,
                fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                transition: "background 0.1s, color 0.1s",
              }}
            >
              {m === "remove" ? "Remove link" : "Add link"}
            </button>
          );
        })}
      </div>

      {/* Selectors */}
      {explorerMode === "remove" && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 9, color: "#4a6a8a", marginBottom: 2 }}>Select required_for link to remove</div>
          {contextualVcrs.length === 0 ? (
            <div style={{ fontSize: 9, color: "#F87171", marginTop: 4 }}>No required_for links for this mission.</div>
          ) : (
            <select
              value={patch.removeVcrId}
              onChange={e => setPatch(p => ({ ...p, removeVcrId: e.target.value }))}
              style={SELECT_STYLE}
            >
              <option value="">— select —</option>
              {contextualVcrs.map(vcr => (
                <option key={vcr.id} value={vcr.id}>{vcrLabel(vcr)}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {explorerMode === "add" && (
        <div style={{ marginBottom: 12, display: "flex", flexDirection: "column" as const, gap: 8 }}>
          <div>
            <div style={{ fontSize: 9, color: "#4a6a8a" }}>Gap</div>
            <select
              value={patch.addGapId}
              onChange={e => setPatch(p => ({ ...p, addGapId: e.target.value, addCapId: "" }))}
              style={SELECT_STYLE}
            >
              <option value="">— select gap —</option>
              {missionGaps.map(g => (
                <option key={g.id} value={g.id}>{g.context?.description?.slice(0, 60) ?? g.id}</option>
              ))}
            </select>
          </div>
          {patch.addGapId && (
            <div>
              <div style={{ fontSize: 9, color: "#4a6a8a" }}>Capability to link</div>
              <select
                value={patch.addCapId}
                onChange={e => setPatch(p => ({ ...p, addCapId: e.target.value }))}
                style={SELECT_STYLE}
              >
                <option value="">— select capability —</option>
                {availableCaps.map(c => (
                  <option key={c.id} value={c.id}>{c.context.label}</option>
                ))}
              </select>
            </div>
          )}
          {patch.addGapId && !addGapFirstValueId && (
            <div style={{ fontSize: 9, color: "#F87171" }}>Selected gap has no requiredValues — cannot form a VCR.</div>
          )}
        </div>
      )}

      {/* Before / After / Delta table */}
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 52px 52px 60px", gap: 4, marginBottom: 4 }}>
          <span style={{ fontSize: 8, color: "#1a3550", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" as const }}>Metric</span>
          <span style={{ fontSize: 8, color: "#22D3EE", fontWeight: 700, textAlign: "right" as const }}>Before</span>
          <span style={{ fontSize: 8, color: "#5B8CFF", fontWeight: 700, textAlign: "right" as const }}>After</span>
          <span style={{ fontSize: 8, color: "#4a6a8a", fontWeight: 700, textAlign: "right" as const }}>Δ</span>
        </div>
        <DeltaRow label="Coverage"         before={beforeMetrics.coveragePct}       after={afterMetrics?.coveragePct       ?? beforeMetrics.coveragePct}       unit="%" />
        <DeltaRow label="Graph Integrity"  before={beforeMetrics.graphIntegrityPct}  after={afterMetrics?.graphIntegrityPct  ?? beforeMetrics.graphIntegrityPct}  unit="%" />
        <DeltaRow label="Mission Health"   before={beforeMetrics.missionHealthPct}   after={afterMetrics?.missionHealthPct   ?? beforeMetrics.missionHealthPct}   unit="%" />
        <DeltaRow label="Active Caps"      before={beforeMetrics.activeCapIds.size}  after={afterMetrics?.activeCapIds.size  ?? beforeMetrics.activeCapIds.size} />
        <DeltaRow label="Active Providers" before={beforeMetrics.activeProvIds.size} after={afterMetrics?.activeProvIds.size ?? beforeMetrics.activeProvIds.size} />
      </div>

      {!patchReady && (
        <div style={{ marginTop: 8, fontSize: 9, color: "#1a3550", fontStyle: "italic" }}>
          Select a link above to see the delta.
        </div>
      )}

      {/* Disclaimer */}
      <div style={{
        marginTop: 12, paddingTop: 10,
        borderTop: "1px solid rgba(34,211,238,0.08)",
        fontSize: 8.5, color: "#1a3550", lineHeight: 1.5,
      }}>
        Structural coverage calculation only — not a behavioral or causal prediction.
      </div>
    </div>
  );
}
