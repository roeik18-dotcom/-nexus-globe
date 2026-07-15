"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import ForceGraph, { type GraphNode, type GraphEdge } from "@/app/world/ForceGraph";
import type { Mission } from "@/app/lib/mission/schema";
import type { Gap } from "@/app/lib/gap/schema";
import type { Value } from "@/app/lib/value/schema";
import type { Capability } from "@/app/lib/capability/schema";
import type { ValueCapabilityRelation } from "@/app/lib/value-capability-relation/schema";
import type { Provider } from "@/app/lib/provider/schema";
import type { ProviderCapabilityRelation } from "@/app/lib/provider-capability-relation/schema";

const VALUES = [
  { id: "knowledge",   label: "Knowledge",   angle: 0   },
  { id: "trust",       label: "Trust",       angle: 30  },
  { id: "health",      label: "Health",      angle: 60  },
  { id: "capital",     label: "Capital",     angle: 90  },
  { id: "justice",     label: "Justice",     angle: 120 },
  { id: "creativity",  label: "Creativity",  angle: 150 },
  { id: "community",   label: "Community",   angle: 180 },
  { id: "growth",      label: "Growth",      angle: 210 },
  { id: "learning",    label: "Learning",    angle: 240 },
  { id: "security",    label: "Security",    angle: 270 },
  { id: "execution",   label: "Execution",   angle: 300 },
  { id: "care",        label: "Care",        angle: 330 },
];

const DOMAINS = [
  { label: "Education",      valueId: "knowledge"  },
  { label: "Media",          valueId: "knowledge"  },
  { label: "Research",       valueId: "learning"   },
  { label: "Academia",       valueId: "learning"   },
  { label: "Finance",        valueId: "capital"    },
  { label: "Investment",     valueId: "capital"    },
  { label: "Healthcare",     valueId: "health"     },
  { label: "Wellness",       valueId: "health"     },
  { label: "Legal",          valueId: "justice"    },
  { label: "Policy",         valueId: "justice"    },
  { label: "Security",       valueId: "security"   },
  { label: "Infrastructure", valueId: "security"   },
  { label: "Design",         valueId: "creativity" },
  { label: "Arts",           valueId: "creativity" },
  { label: "Social Impact",  valueId: "community"  },
  { label: "Civic",          valueId: "community"  },
  { label: "Startups",       valueId: "growth"     },
  { label: "Commerce",       valueId: "growth"     },
  { label: "Operations",     valueId: "execution"  },
  { label: "Engineering",    valueId: "execution"  },
  { label: "Networks",       valueId: "trust"      },
  { label: "Governance",     valueId: "trust"      },
  { label: "Caregiving",     valueId: "care"       },
  { label: "Support",        valueId: "care"       },
];

const USERS = [
  { label: "Founder",         values: ["growth", "execution", "capital"]      },
  { label: "Researcher",      values: ["knowledge", "learning", "trust"]      },
  { label: "Policy Maker",    values: ["justice", "community", "security"]    },
  { label: "Investor",        values: ["capital", "growth", "trust"]          },
  { label: "Doctor",          values: ["health", "care", "knowledge"]         },
  { label: "Educator",        values: ["knowledge", "learning", "community"]  },
  { label: "Artist",          values: ["creativity", "community", "trust"]    },
  { label: "Engineer",        values: ["execution", "knowledge", "growth"]    },
  { label: "Activist",        values: ["justice", "community", "care"]        },
  { label: "Entrepreneur",    values: ["growth", "creativity", "execution"]   },
  { label: "Caregiver",       values: ["care", "health", "community"]         },
  { label: "Analyst",         values: ["knowledge", "trust", "capital"]       },
  { label: "Designer",        values: ["creativity", "execution", "community"]},
  { label: "Journalist",      values: ["knowledge", "trust", "justice"]       },
  { label: "Scientist",       values: ["knowledge", "learning", "health"]     },
];


const CX = 500;
const CY = 480;
const VALUE_R  = 195;
const CAP_R    = 242;
const DOMAIN_R = 295;
const PROV_R   = 348;
const USER_R   = 395;
const CORE_R   = 65;

const VALUE_COLOR: Record<string, string> = {
  knowledge:  "#5B8CFF",
  trust:      "#2DA890",
  health:     "#4ADE80",
  capital:    "#FFB84D",
  justice:    "#A371F7",
  creativity: "#F472B6",
  community:  "#22D3EE",
  growth:     "#34D399",
  learning:   "#60A5FA",
  security:   "#F87171",
  execution:  "#FBBF24",
  care:       "#E879F9",
};

function degToRad(deg: number): number {
  return (deg - 90) * (Math.PI / 180);
}

function polar(r: number, angleDeg: number): { x: number; y: number } {
  const rad = degToRad(angleDeg);
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

type CascadeStep = 0 | 1 | 2 | 3 | 4;


interface Props {
  missions: Mission[];
  gaps: Gap[];
  values: Value[];
  capabilities: Capability[];
  vcRelations: ValueCapabilityRelation[];
  providers: Provider[];
  pcRelations: ProviderCapabilityRelation[];
}

export default function WorldView({
  missions,
  gaps,
  values,
  capabilities,
  vcRelations,
  providers,
  pcRelations,
}: Props) {
  const [selectedMissionId, setSelectedMissionId] = useState<string>(missions[0]?.id ?? "");
  const [cascadeStep, setCascadeStep] = useState<CascadeStep>(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [viewMode, setViewMode] = useState<"contextual" | "taxonomic">("contextual");
  const [inspectedNode, setInspectedNode] = useState<GraphNode | null>(null);
  const [inspectedEdge, setInspectedEdge] = useState<GraphEdge | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 480);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mq.matches;
    setReducedMotion(mq.matches);
    const listener = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
      setReducedMotion(e.matches);
    };
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  useEffect(() => {
    if (missions.length === 0) return;
    if (reducedMotionRef.current) {
      setCascadeStep(4);
    } else {
      setCascadeStep(1);
      const t2 = setTimeout(() => setCascadeStep(2), 300);
      const t3 = setTimeout(() => setCascadeStep(3), 700);
      const t4 = setTimeout(() => setCascadeStep(4), 1400);
      timers.current = [t2, t3, t4];
    }
    return () => { timers.current.forEach(clearTimeout); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startCascade(missionId: string) {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setSelectedMissionId(missionId);
    setInspectedNode(null);
    setInspectedEdge(null);
    if (reducedMotionRef.current) {
      setCascadeStep(4);
      return;
    }
    setCascadeStep(1);
    const t2 = setTimeout(() => setCascadeStep(2), 300);
    const t3 = setTimeout(() => setCascadeStep(3), 700);
    const t4 = setTimeout(() => setCascadeStep(4), 1400);
    timers.current = [t2, t3, t4];
  }

  // ─── Static node positions ────────────────────────────────────────────────────

  const valueNodes = VALUES.map(v => ({ ...v, ...polar(VALUE_R, v.angle) }));
  const valueMap   = new Map(valueNodes.map(v => [v.id, v]));

  const domainNodes = DOMAINS.map((d, i) => {
    const sameGroup  = DOMAINS.filter(x => x.valueId === d.valueId);
    const idx        = sameGroup.indexOf(d);
    const parentV    = VALUES.find(v => v.id === d.valueId)!;
    const offsetAngle = parentV.angle + (idx === 0 ? -14 : 14);
    return { ...d, i, ...polar(DOMAIN_R, offsetAngle) };
  });

  const userNodes = USERS.map((u, i) => ({
    ...u, i, ...polar(USER_R, (i / USERS.length) * 360),
  }));

  // Primary value per capability — first VCR match determines color + sort angle
  const capPrimaryValId = new Map<string, string>();
  for (const vcr of vcRelations) {
    if (!capPrimaryValId.has(vcr.capabilityId)) capPrimaryValId.set(vcr.capabilityId, vcr.valueId);
  }

  const sortedCaps = [...capabilities].sort((a, b) => {
    const aAngle = VALUES.find(v => v.id === capPrimaryValId.get(a.id))?.angle ?? 180;
    const bAngle = VALUES.find(v => v.id === capPrimaryValId.get(b.id))?.angle ?? 180;
    return aAngle - bAngle;
  });
  const capNodes = sortedCaps.map((cap, i) => ({
    ...cap, ...polar(CAP_R, (i / sortedCaps.length) * 360),
  }));
  const capMap = new Map(capNodes.map(c => [c.id, c]));

  // Primary value per provider — via first PCR → capPrimaryValId chain
  const provPrimaryValId = new Map<string, string>();
  for (const pcr of pcRelations) {
    if (!provPrimaryValId.has(pcr.providerId)) {
      const vid = capPrimaryValId.get(pcr.capabilityId);
      if (vid) provPrimaryValId.set(pcr.providerId, vid);
    }
  }

  const sortedProvs = [...providers].sort((a, b) => {
    const aAngle = VALUES.find(v => v.id === provPrimaryValId.get(a.id))?.angle ?? 180;
    const bAngle = VALUES.find(v => v.id === provPrimaryValId.get(b.id))?.angle ?? 180;
    return aAngle - bAngle;
  });
  const provNodes = sortedProvs.map((prov, i) => ({
    ...prov, ...polar(PROV_R, (i / sortedProvs.length) * 360),
  }));
  const provMap = new Map(provNodes.map(p => [p.id, p]));

  // ─── Mission-scoped active sets ───────────────────────────────────────────────

  const selectedMission = missions.find(m => m.id === selectedMissionId) ?? missions[0];

  // Correct PUDM chain: Mission.gaps → Gap.requiredValues → Value
  // Gap is the authoritative source of required values — Mission holds only GapRef pointers
  const gapById = new Map(gaps.map(g => [g.id, g]));
  const activeValueIds = new Set<string>(
    (selectedMission?.gaps ?? [])
      .flatMap(ref => gapById.get(ref.gapId)?.requiredValues ?? [])
      .map(r => r.valueId)
  );
  // Mode-aware VCR source
  const contextualVcrs = vcRelations.filter(
    r => r.relationType === "required_for" && r.missionId === selectedMission?.id
  );
  const modeVcrs = viewMode === "contextual"
    ? contextualVcrs
    : vcRelations.filter(r => r.relationType === "can_address");

  const activeCapIds = new Set<string>(
    modeVcrs.filter(r => activeValueIds.has(r.valueId)).map(r => r.capabilityId)
  );
  const activeProvIds = new Set<string>(
    pcRelations.filter(r => activeCapIds.has(r.capabilityId)).map(r => r.providerId)
  );

  // All-missions live value set — preserved base layer, also via Gap chain
  const allLiveValueIds = new Set<string>(
    missions
      .flatMap(m => (m.gaps ?? []))
      .flatMap(ref => gapById.get(ref.gapId)?.requiredValues ?? [])
      .map(r => r.valueId)
  );

  // Active cascade edges
  const cascadeVcrs = modeVcrs.filter(
    r => activeValueIds.has(r.valueId) && activeCapIds.has(r.capabilityId)
  );
  const cascadePcrs = pcRelations.filter(
    r => activeCapIds.has(r.capabilityId) && activeProvIds.has(r.providerId)
  );

  // ─── Opacity helpers ──────────────────────────────────────────────────────────

  function valueStrokeOpacity(vId: string): number {
    if (cascadeStep < 2) return 0.6;
    return activeValueIds.has(vId) ? 1 : 0.12;
  }

  function valueLabelOpacity(vId: string): number {
    if (cascadeStep < 2) return 0.85;
    return activeValueIds.has(vId) ? 1 : 0.25;
  }

  function capGroupOpacity(capId: string): number {
    if (cascadeStep === 0) return 0.18;
    if (cascadeStep < 3)   return 0.22;
    return activeCapIds.has(capId) ? 1 : 0.1;
  }

  function provGroupOpacity(provId: string): number {
    if (cascadeStep === 0) return 0.12;
    if (cascadeStep < 4)   return 0.18;
    return activeProvIds.has(provId) ? 1 : 0.07;
  }

  // ─── UI helpers ───────────────────────────────────────────────────────────────

  function missionLabel(m: Mission): string {
    return (
      m.context.domain ??
      m.id.replace(/^mission_/, "").replace(/_\d+$/, "").replace(/_/g, " ")
    );
  }

  const cascadeStatusText = [
    "── IDLE ──",
    "── CORE ACTIVATED ──",
    `── VALUES: ${activeValueIds.size} active ──`,
    `── CAPABILITIES: ${activeCapIds.size} reachable ──`,
    `── PROVIDERS: ${activeProvIds.size} reachable ──`,
  ][cascadeStep];

  // ─── Live Decision Engine — Insights ────────────────────────────────────────

  const STAGE_NAMES = ["Idle", "Core Activated", "Values Lit", "Capabilities Lit", "Providers Reached"];

  // Dominant value: which value appears across the most gaps for this mission
  const valGapCount = new Map<string, number>();
  (selectedMission?.gaps ?? []).forEach(ref => {
    const gap = gapById.get(ref.gapId);
    (gap?.requiredValues ?? []).forEach(rv => {
      valGapCount.set(rv.valueId, (valGapCount.get(rv.valueId) ?? 0) + 1);
    });
  });
  const dominantValId = [...valGapCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const dominantVal   = VALUES.find(v => v.id === dominantValId) ?? null;

  // Most connected active value: highest number of VCR edges (mode-scoped)
  const valVcrCount = new Map<string, number>();
  for (const vcr of modeVcrs) {
    if (activeValueIds.has(vcr.valueId)) {
      valVcrCount.set(vcr.valueId, (valVcrCount.get(vcr.valueId) ?? 0) + 1);
    }
  }
  const topConnectedValId    = [...valVcrCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const topConnectedVal      = VALUES.find(v => v.id === topConnectedValId) ?? null;
  const topConnectedVcrCount = topConnectedValId ? (valVcrCount.get(topConnectedValId) ?? 0) : 0;

  // Coverage: active capabilities with at least one provider in PCR
  const capsWithProvider  = new Set(pcRelations.map(r => r.capabilityId));
  const coveredCapCount   = [...activeCapIds].filter(id => capsWithProvider.has(id)).length;
  const uncoveredCapCount = activeCapIds.size - coveredCapCount;
  const coveragePct       = activeCapIds.size > 0 ? Math.round((coveredCapCount / activeCapIds.size) * 100) : 0;

  // Mission Health metrics
  const missionGapIds       = new Set((selectedMission?.gaps ?? []).map(r => r.gapId));
  const gapsWithRF          = new Set(contextualVcrs.map(r => r.gapId));
  const graphIntegrityPct   = missionGapIds.size > 0
    ? Math.round((gapsWithRF.size / missionGapIds.size) * 100)
    : 0;
  const validationPass      = graphIntegrityPct === 100 && contextualVcrs.length > 0;
  const missionHealthPct    = Math.round(
    graphIntegrityPct * 0.55 + (validationPass ? 40 : 0) + (activeProvIds.size > 0 ? 5 : 0)
  );
  const missionStage        = contextualVcrs.length > 0
    ? "Contextual Qualification"
    : "Initialization";
  const evidenceCount       = contextualVcrs.reduce(
    (n, r) => n + (r.evidence ?? []).filter(e => e.signal !== "Intent").length, 0
  );

  // ─── Force Graph data (Rendering Layer — no data layer changes) ───────────────

  const missionById = useMemo(() => new Map(missions.map(m => [m.id, m])), [missions]);
  const valueById   = useMemo(() => new Map(values.map(v => [v.id, v])), [values]);
  const capById     = useMemo(() => new Map(capabilities.map(c => [c.id, c])), [capabilities]);
  const provById    = useMemo(() => new Map(providers.map(p => [p.id, p])), [providers]);
  const vcrById     = useMemo(() => new Map(vcRelations.map(r => [r.id, r])), [vcRelations]);
  const pcrById     = useMemo(() => new Map(pcRelations.map(r => [r.id, r])), [pcRelations]);

  function gapNodeLabel(gapId: string): string {
    return gapId
      .replace(/^gap_/, "")
      .replace(/_\d+$/, "")
      .split("_")
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { graphNodes, graphEdges } = useMemo(() => {
    if (!selectedMission) return { graphNodes: [], graphEdges: [] };

    const gnodes: GraphNode[] = [];
    const gedges: GraphEdge[] = [];
    const seen = new Set<string>();
    const addN = (n: GraphNode) => { if (!seen.has(n.id)) { seen.add(n.id); gnodes.push(n); } };

    addN({ id: selectedMission.id, type: "mission", label: missionLabel(selectedMission) });

    for (const gapRef of selectedMission.gaps ?? []) {
      const gap = gapById.get(gapRef.gapId);
      if (!gap) continue;

      const g = gap as unknown as { id: string; context?: { description?: string }; requiredValues?: Array<{ valueId: string }> };
      addN({ id: g.id, type: "gap", label: gapNodeLabel(g.id), sublabel: g.context?.description?.slice(0, 70) });
      gedges.push({ id: `m-g-${g.id}`, source: selectedMission.id, target: g.id, type: "mission_gap" });

      for (const vRef of g.requiredValues ?? []) {
        const val = valueById.get(vRef.valueId) as unknown as { id: string; context?: { label?: string; domain?: string } } | undefined;
        if (!val) continue;

        addN({ id: vRef.valueId, type: "value", label: val.context?.label ?? vRef.valueId, sublabel: val.context?.domain });
        gedges.push({ id: `g-v-${g.id}-${vRef.valueId}`, source: g.id, target: vRef.valueId, type: "gap_value" });

        const relevantVcrs = viewMode === "contextual"
          ? contextualVcrs.filter(r => r.valueId === vRef.valueId)
          : vcRelations.filter(r => r.relationType === "can_address" && r.valueId === vRef.valueId);

        for (const vcr of relevantVcrs) {
          const cap = capById.get(vcr.capabilityId) as unknown as { id: string; context?: { label?: string; domain?: string } } | undefined;
          if (!cap) continue;

          addN({ id: vcr.capabilityId, type: "capability", label: cap.context?.label ?? vcr.capabilityId, sublabel: cap.context?.domain });
          gedges.push({ id: vcr.id, source: vRef.valueId, target: vcr.capabilityId, type: viewMode === "contextual" ? "required_for" : "can_address" });

          for (const pcr of pcRelations.filter(r => r.capabilityId === vcr.capabilityId)) {
            const prov = provById.get(pcr.providerId) as unknown as { id: string; context?: { label?: string; providerType?: string } } | undefined;
            if (!prov) continue;

            addN({ id: pcr.providerId, type: "provider", label: prov.context?.label ?? pcr.providerId, sublabel: prov.context?.providerType });
            gedges.push({ id: pcr.id, source: vcr.capabilityId, target: pcr.providerId, type: "can_deliver" });
          }
        }
      }
    }

    return { graphNodes: gnodes, graphEdges: gedges };
  }, [selectedMission, viewMode, contextualVcrs, vcRelations, gapById, valueById, capById, provById, pcRelations]);

  const handleNodeClick = useCallback((node: GraphNode | null) => {
    setInspectedNode(node);
    setInspectedEdge(null);
  }, []);

  const handleEdgeClick = useCallback((edge: GraphEdge | null) => {
    setInspectedEdge(edge);
    setInspectedNode(null);
  }, []);

  // ─── Rich Inspector — fixed overlay panel ────────────────────────────────────

  const INSP_C: Record<string, string> = {
    mission: "#A371F7", gap: "#5B8CFF", value: "#22D3EE",
    capability: "#FFB84D", provider: "#34D399",
    mission_gap: "#5B8CFF", gap_value: "#22D3EE",
    required_for: "#FFB84D", can_address: "#22D3EE", can_deliver: "#34D399",
  };
  const STATUS_C: Record<string, string> = {
    active: "#34D399", candidate: "#FFB84D", open: "#5B8CFF",
    closed: "#6E7681", rejected: "#F87171", historical: "#6E7681",
    deferred: "#FFB84D", completed: "#34D399", abandoned: "#F87171", paused: "#FFB84D",
  };
  const MATURITY_C: Record<string, string> = {
    emerging: "#FFB84D", established: "#22D3EE", proven: "#34D399",
  };
  const SEVERITY_C: Record<string, string> = {
    critical: "#F87171", significant: "#FFB84D", moderate: "#22D3EE", minor: "#6E7681",
  };

  function inlChip(label: string, color: string) {
    return (
      <span key={label} style={{
        display: "inline-block", fontSize: 8, fontWeight: 600,
        padding: "2px 6px", borderRadius: 3, marginRight: 4, marginBottom: 3,
        background: `${color}18`, color, border: `1px solid ${color}30`,
        letterSpacing: "0.4px", textTransform: "uppercase" as const,
      }}>{label}</span>
    );
  }
  function inlRow(label: string, value: string, color = "#2a5a8a") {
    return (
      <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 9.5, color: "#1a3550", flexShrink: 0 }}>{label}</span>
        <span style={{ fontSize: 9.5, color, textAlign: "right" as const, fontWeight: 500 }}>{value}</span>
      </div>
    );
  }
  function inlDesc(text: string, color: string) {
    return (
      <p style={{ fontSize: 10, color: `${color}bb`, lineHeight: 1.55, margin: "8px 0 10px", fontStyle: "italic" as const }}>
        {text.length > 180 ? text.slice(0, 178) + "…" : text}
      </p>
    );
  }

  const inspectorOpen = inspectedNode !== null || inspectedEdge !== null;
  const inspColor = inspectedNode
    ? (INSP_C[inspectedNode.type] ?? "#6E7681")
    : inspectedEdge
      ? (INSP_C[inspectedEdge.type] ?? "#6E7681")
      : "#6E7681";

  let inspTypeLabel = "";
  let inspTitle     = "";
  let inspSubtitle  = "";
  let inspContent: React.ReactNode = null;

  if (inspectedNode) {
    inspTypeLabel = inspectedNode.type;
    inspTitle     = inspectedNode.label;

    if (inspectedNode.type === "mission") {
      const m = missionById.get(inspectedNode.id);
      inspSubtitle = m?.context?.domain ?? "";
      inspContent = m ? (
        <div>
          <div style={{ marginBottom: 8 }}>
            {inlChip(m.state.status, STATUS_C[m.state.status] ?? "#6E7681")}
            {inlChip(m.state.horizon, "#8B7DCC")}
          </div>
          {m.context.statement && inlDesc(m.context.statement, inspColor)}
          <div style={{ borderTop: `1px solid ${inspColor}15`, paddingTop: 8 }}>
            {inlRow("Gaps", String(m.gaps.length), "#5B8CFF")}
            {inlRow("Required values", String(m.requiredValues.length), "#22D3EE")}
            {inlRow("Evidence records", String(m.evidence.length), "#6E7681")}
            {inlRow("Evidence grade", m.evidenceGrade, "#A371F7")}
          </div>
          {m.context.actor && (
            <div style={{ marginTop: 8, fontSize: 9, color: "#1a3550" }}>
              Actor · <span style={{ color: "#3a5a80" }}>{m.context.actor.type}</span>
            </div>
          )}
        </div>
      ) : null;

    } else if (inspectedNode.type === "gap") {
      const g = gapById.get(inspectedNode.id);
      inspSubtitle = (g as unknown as { context?: { domain?: string } })?.context?.domain ?? "";
      const gTyped = g as unknown as {
        state?: { status?: string; severity?: string };
        context?: { description?: string };
        requiredValues?: Array<{ valueId: string }>;
        evidence?: unknown[];
        evidenceGrade?: string;
      };
      const gStatus   = gTyped?.state?.status ?? "";
      const gSeverity = gTyped?.state?.severity ?? "";
      const gDesc     = gTyped?.context?.description ?? "";
      const gVals     = gTyped?.requiredValues ?? [];
      inspContent = g ? (
        <div>
          <div style={{ marginBottom: 8 }}>
            {gSeverity && inlChip(gSeverity, SEVERITY_C[gSeverity] ?? "#6E7681")}
            {gStatus   && inlChip(gStatus,   STATUS_C[gStatus]     ?? "#6E7681")}
          </div>
          {gDesc && inlDesc(gDesc, inspColor)}
          {gVals.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: "#1a3550", marginBottom: 4 }}>Required values</div>
              <div>
                {gVals.map(rv => {
                  const v = valueById.get(rv.valueId) as unknown as { context?: { label?: string } } | undefined;
                  const lbl = v?.context?.label ?? rv.valueId;
                  return inlChip(lbl, "#22D3EE");
                })}
              </div>
            </div>
          )}
          <div style={{ borderTop: `1px solid ${inspColor}15`, paddingTop: 8 }}>
            {inlRow("Evidence grade", gTyped?.evidenceGrade ?? "—", "#A371F7")}
            {inlRow("Evidence records", String(gTyped?.evidence?.length ?? 0), "#6E7681")}
          </div>
        </div>
      ) : null;

    } else if (inspectedNode.type === "value") {
      const v = valueById.get(inspectedNode.id) as unknown as {
        context?: { label?: string; description?: string; domain?: string };
        evidenceGrade?: string;
        evidence?: unknown[];
      } | undefined;
      inspSubtitle = v?.context?.domain ?? "";
      const vDesc = v?.context?.description ?? "";
      const gapRefs   = graphEdges.filter(e => e.target === inspectedNode.id && e.type === "gap_value").length;
      const rfCount   = vcRelations.filter(r => r.valueId === inspectedNode.id && r.relationType === "required_for").length;
      const caCount   = vcRelations.filter(r => r.valueId === inspectedNode.id && r.relationType === "can_address").length;
      inspContent = (
        <div>
          {vDesc && inlDesc(vDesc, inspColor)}
          <div style={{ borderTop: `1px solid ${inspColor}15`, paddingTop: 8 }}>
            {inlRow("In graph (gaps)", String(gapRefs), "#5B8CFF")}
            {inlRow("required_for", `${rfCount} capabilities`, "#FFB84D")}
            {inlRow("can_address", `${caCount} capabilities`, "#22D3EE")}
            {inlRow("Evidence grade", v?.evidenceGrade ?? "—", "#A371F7")}
          </div>
        </div>
      );

    } else if (inspectedNode.type === "capability") {
      const c = capById.get(inspectedNode.id) as unknown as {
        context?: { label?: string; description?: string; domain?: string; maturity?: string };
        evidenceGrade?: string;
        evidence?: unknown[];
      } | undefined;
      inspSubtitle = c?.context?.domain ?? "";
      const cDesc     = c?.context?.description ?? "";
      const cMaturity = c?.context?.maturity ?? "";
      const valuesCap = vcRelations
        .filter(r => r.capabilityId === inspectedNode.id)
        .map(r => {
          const v = valueById.get(r.valueId) as unknown as { context?: { label?: string } } | undefined;
          return v?.context?.label ?? r.valueId;
        });
      const provsCap = pcRelations
        .filter(r => r.capabilityId === inspectedNode.id)
        .map(r => {
          const p = provById.get(r.providerId) as unknown as { context?: { label?: string } } | undefined;
          return p?.context?.label ?? r.providerId;
        });
      const covered = capsWithProvider.has(inspectedNode.id);
      inspContent = (
        <div>
          <div style={{ marginBottom: 8 }}>
            {cMaturity && inlChip(cMaturity, MATURITY_C[cMaturity] ?? "#6E7681")}
          </div>
          {cDesc && inlDesc(cDesc, inspColor)}
          {valuesCap.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: "#1a3550", marginBottom: 4 }}>Addresses values</div>
              <div>{valuesCap.map(l => inlChip(l, "#22D3EE"))}</div>
            </div>
          )}
          {provsCap.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: "#1a3550", marginBottom: 4 }}>Providers</div>
              <div>{provsCap.map(l => inlChip(l, "#34D399"))}</div>
            </div>
          )}
          <div style={{ borderTop: `1px solid ${inspColor}15`, paddingTop: 8 }}>
            {inlRow("Coverage", covered ? "✓ covered" : "✗ no provider", covered ? "#34D399" : "#F87171")}
            {inlRow("Evidence grade", c?.evidenceGrade ?? "—", "#A371F7")}
          </div>
        </div>
      );

    } else if (inspectedNode.type === "provider") {
      const p = provById.get(inspectedNode.id) as unknown as {
        context?: { label?: string; description?: string; domain?: string; providerType?: string; website?: string | null };
        evidenceGrade?: string;
        evidence?: unknown[];
      } | undefined;
      inspSubtitle = p?.context?.domain ?? "";
      const pDesc  = p?.context?.description ?? "";
      const pType  = p?.context?.providerType ?? "";
      const pWeb   = p?.context?.website ?? null;
      const capsProv = pcRelations
        .filter(r => r.providerId === inspectedNode.id)
        .map(r => {
          const cap = capById.get(r.capabilityId) as unknown as { context?: { label?: string } } | undefined;
          return cap?.context?.label ?? r.capabilityId;
        });
      inspContent = (
        <div>
          <div style={{ marginBottom: 8 }}>
            {pType && inlChip(pType, "#34D399")}
          </div>
          {pDesc && inlDesc(pDesc, inspColor)}
          {pWeb && (
            <div style={{ marginBottom: 10, fontSize: 9.5, color: "#22D3EE", wordBreak: "break-all" as const }}>
              {pWeb.startsWith("http") ? (
                <a href={pWeb} target="_blank" rel="noopener noreferrer" style={{ color: "#22D3EE" }}>{pWeb}</a>
              ) : pWeb}
            </div>
          )}
          {capsProv.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: "#1a3550", marginBottom: 4 }}>Capabilities delivered</div>
              <div>{capsProv.map(l => inlChip(l, "#FFB84D"))}</div>
            </div>
          )}
          <div style={{ borderTop: `1px solid ${inspColor}15`, paddingTop: 8 }}>
            {inlRow("Evidence grade", p?.evidenceGrade ?? "—", "#A371F7")}
          </div>
        </div>
      );
    }

  } else if (inspectedEdge) {
    inspTypeLabel = inspectedEdge.type.replace(/_/g, " ");

    if (inspectedEdge.type === "required_for" || inspectedEdge.type === "can_address") {
      const vcr = vcrById.get(inspectedEdge.id);
      const val = valueById.get(vcr?.valueId ?? "") as unknown as { context?: { label?: string } } | undefined;
      const cap = capById.get(vcr?.capabilityId ?? "") as unknown as { context?: { label?: string } } | undefined;
      const mLabel = vcr?.missionId ? (missionById.get(vcr.missionId)?.context?.domain ?? vcr.missionId) : null;
      const gLabel = vcr?.gapId ? gapNodeLabel(vcr.gapId) : null;
      inspTitle    = `${val?.context?.label ?? vcr?.valueId ?? "?"} → ${cap?.context?.label ?? vcr?.capabilityId ?? "?"}`;
      inspContent = vcr ? (
        <div>
          <div style={{ marginBottom: 8 }}>
            {inlChip(vcr.relationType, inspColor)}
            {inlChip(vcr.status, STATUS_C[vcr.status] ?? "#6E7681")}
          </div>
          {mLabel && inlRow("Mission", mLabel, "#A371F7")}
          {gLabel && inlRow("Gap", gLabel, "#5B8CFF")}
          <div style={{ borderTop: `1px solid ${inspColor}15`, paddingTop: 8, marginTop: 4 }}>
            {inlRow("Evidence grade", vcr.evidenceGrade, "#A371F7")}
            {inlRow("Evidence records", String(vcr.evidence.length), "#6E7681")}
          </div>
        </div>
      ) : null;

    } else if (inspectedEdge.type === "can_deliver") {
      const pcr = pcrById.get(inspectedEdge.id);
      const prov = provById.get(pcr?.providerId ?? "") as unknown as { context?: { label?: string } } | undefined;
      const cap  = capById.get(pcr?.capabilityId ?? "") as unknown as { context?: { label?: string } } | undefined;
      inspTitle   = `${prov?.context?.label ?? pcr?.providerId ?? "?"} → ${cap?.context?.label ?? pcr?.capabilityId ?? "?"}`;
      inspContent = pcr ? (
        <div>
          <div style={{ marginBottom: 8 }}>
            {inlChip(pcr.relationType, inspColor)}
            {inlChip(pcr.status, STATUS_C[pcr.status] ?? "#6E7681")}
          </div>
          <div style={{ borderTop: `1px solid ${inspColor}15`, paddingTop: 8, marginTop: 4 }}>
            {inlRow("Evidence grade", pcr.evidenceGrade, "#A371F7")}
            {inlRow("Evidence records", String(pcr.evidence.length), "#6E7681")}
          </div>
        </div>
      ) : null;

    } else {
      // Synthetic structural edges (mission_gap, gap_value)
      const srcNode = graphNodes.find(n => n.id === inspectedEdge.source);
      const tgtNode = graphNodes.find(n => n.id === inspectedEdge.target);
      inspTitle   = `${srcNode?.label ?? inspectedEdge.source} → ${tgtNode?.label ?? inspectedEdge.target}`;
      inspContent = (
        <div style={{ fontSize: 9.5, color: "#1a3550", lineHeight: 1.6 }}>
          Structural edge — not a stored relation.
        </div>
      );
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#020d1a",
        color: "#cfe6f5",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        padding: "32px 16px 80px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <header style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <span style={{
                display: "inline-block",
                background: "rgba(255,107,107,0.10)",
                border: "1px solid rgba(255,107,107,0.22)",
                borderRadius: 4, padding: "2px 9px",
                fontSize: 10, fontWeight: 700, letterSpacing: "1.5px",
                textTransform: "uppercase" as const, color: "#ff6b6b",
              }}>Potential Map</span>
              <span style={{
                display: "inline-block",
                background: "rgba(52,211,153,0.10)",
                border: "1px solid rgba(52,211,153,0.25)",
                borderRadius: 4, padding: "2px 9px",
                fontSize: 10, fontWeight: 700, letterSpacing: "1.5px",
                textTransform: "uppercase" as const, color: "#34D399",
              }}>Live · {missions.length}M {gaps.length}G {values.length}V {capabilities.length}C {providers.length}P</span>
              <span style={{
                display: "inline-block",
                background: "rgba(164,113,247,0.10)",
                border: "1px solid rgba(164,113,247,0.22)",
                borderRadius: 4, padding: "2px 9px",
                fontSize: 10, fontWeight: 700, letterSpacing: "1.5px",
                textTransform: "uppercase" as const, color: "#A371F7",
              }}>Live PUDM Cascade</span>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.3px", color: "#e0f0ff", marginBottom: 6 }}>
              Living World
            </h1>
            <p style={{ fontSize: 12.5, color: "#3a5a78", maxWidth: 500, lineHeight: 1.65 }}>
              Potential layer (dashed) shows the architecture&apos;s design space.
              Cascade layer (solid) animates the full Value → Capability → Provider chain for a real mission.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <a href="/lab" style={{ fontSize: 11, color: "#1a3a5a", textDecoration: "none" }}>← Lab</a>
            <a href="/" style={{ fontSize: 11, color: "#1a3a5a", textDecoration: "none" }}>← App</a>
          </div>
        </header>

        {/* Mission selector */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" as const, color: "#1a3550", marginBottom: 8 }}>
            Select Mission — cascade replays on each click
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {missions.map(m => {
              const isActive = m.id === selectedMissionId;
              return (
                <button
                  key={m.id}
                  onClick={() => startCascade(m.id)}
                  style={{
                    fontSize: 11, padding: "5px 12px", borderRadius: 4,
                    cursor: "pointer", fontWeight: isActive ? 700 : 400,
                    background: isActive ? "#A371F7" : "transparent",
                    color: isActive ? "#fff" : "#2a4a6a",
                    border: `1px solid ${isActive ? "#A371F7" : "#0c2040"}`,
                    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                    transition: "background 0.15s ease, color 0.15s ease, border-color 0.15s ease",
                  }}
                >
                  {missionLabel(m)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cascade disclaimer */}
        <div style={{
          background: "rgba(164,113,247,0.05)",
          border: "1px solid rgba(164,113,247,0.15)",
          borderRadius: 5, padding: "9px 14px", marginBottom: viewMode === "contextual" && activeCapIds.size === 0 ? 8 : 14,
          fontSize: 11, color: "#6a4a8a", lineHeight: 1.6,
        }}>
          <strong style={{ color: "#A371F7" }}>Live Reference Cascade</strong> — repository-backed, not observed flow.
          &nbsp;·&nbsp;
          {viewMode === "contextual" ? (
            <>Showing <strong style={{ color: "#A371F7" }}>Contextual</strong> chain via{" "}
            <code style={{ fontSize: 10, color: "#7a5aaa", background: "rgba(164,113,247,0.1)", padding: "1px 4px", borderRadius: 2 }}>required_for</code>
            {" "}— what is required for this specific mission.</>
          ) : (
            <>Showing <strong style={{ color: "#FFB84D" }}>Explore Taxonomy</strong> chain via{" "}
            <code style={{ fontSize: 10, color: "#9a7030", background: "rgba(255,184,77,0.08)", padding: "1px 4px", borderRadius: 2 }}>can_address</code>
            {" "}— what can address these values in general.</>
          )}
        </div>

        {/* Empty state — contextual mode with no required_for VCRs for this mission */}
        {viewMode === "contextual" && activeCapIds.size === 0 && (
          <div style={{
            background: "rgba(248,113,113,0.05)",
            border: "1px solid rgba(248,113,113,0.2)",
            borderRadius: 5, padding: "9px 14px", marginBottom: 14,
            fontSize: 11, color: "#7a3030", lineHeight: 1.6,
          }}>
            <strong style={{ color: "#F87171" }}>No contextual qualification exists for this mission</strong>
            {" "}— switch to <strong>Explore Taxonomy</strong> to see general capability coverage.
          </div>
        )}

        {/* Caveat */}
        <div style={{
          background: "rgba(255,184,77,0.06)",
          border: "1px solid rgba(255,184,77,0.18)",
          borderRadius: 5, padding: "9px 14px", marginBottom: 28,
          fontSize: 11.5, color: "#9a7030", lineHeight: 1.6,
        }}>
          <strong style={{ color: "#FFB84D" }}>Potential Layer</strong> — dashed lines show the architecture&apos;s full design space.
          &nbsp;·&nbsp;
          <strong style={{ color: "#34D399" }}>Live Reference Layer</strong> — solid lines show values referenced by real records. Not observed flow.
        </div>

        <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>

          {/* Force Graph */}
          <div style={{ flex: "1 1 600px", minWidth: 320, height: 560, position: "relative" }}>
            <ForceGraph
              nodes={graphNodes}
              edges={graphEdges}
              selectedNodeId={inspectedNode?.id ?? null}
              selectedEdgeId={inspectedEdge?.id ?? null}
              cascadeStep={cascadeStep}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
              reducedMotion={reducedMotion}
            />
          </div>

          {/* Sidebar — Live Decision Engine */}
          <div style={{ flex: "0 0 240px", minWidth: 200, display: "flex", flexDirection: "column" as const, gap: 14 }}>

            {/* 1. MISSION */}
            <div style={{
              background: "rgba(164,113,247,0.07)",
              border: "1px solid rgba(164,113,247,0.2)",
              borderRadius: 6, padding: "12px 14px",
            }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" as const, color: "#5a3a90", marginBottom: 8 }}>
                Mission
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#c0a0ff", lineHeight: 1.4, marginBottom: 4 }}>
                {selectedMission ? missionLabel(selectedMission) : "—"}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <div style={{ fontSize: 9, color: "#7a5aaa", fontStyle: "italic" }}>
                  {missionStage}
                </div>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#A371F7", fontVariantNumeric: "tabular-nums" }}>
                  {cascadeStep >= 3 ? `${coveragePct}%` : "—"}
                </div>
              </div>
              <div style={{ background: "rgba(164,113,247,0.12)", borderRadius: 2, height: 3, overflow: "hidden" as const }}>
                <div style={{
                  height: "100%", borderRadius: 2,
                  background: "linear-gradient(90deg, #A371F7, #7a50c0)",
                  width: `${cascadeStep >= 3 ? coveragePct : (cascadeStep / 4) * 100}%`,
                  transition: "width 0.5s ease",
                }} />
              </div>
              <div style={{ fontSize: 8, color: "#4a2a7a", marginTop: 5, fontFamily: "var(--font-geist-mono), monospace" }}>
                {cascadeStep < 4
                  ? `Step ${cascadeStep}/4 · ${STAGE_NAMES[cascadeStep]}`
                  : <span style={{ color: "#34D399" }}>Chain complete</span>
                }
              </div>
            </div>

            {/* 2. LIVE FLOW */}
            <div style={{
              background: "#030c18",
              border: "1px solid #0a1e30",
              borderRadius: 6, padding: "12px 14px",
            }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" as const, color: "#1a3550", marginBottom: 10 }}>
                Live Flow
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const }}>
                {([
                  { label: "Mission",      activeFrom: 1, color: "#A371F7", count: null },
                  { label: "Gap",          activeFrom: 1, color: "#8a60d0", count: selectedMission?.gaps.length ?? 0 },
                  { label: "Values",       activeFrom: 2, color: "#5B8CFF", count: activeValueIds.size },
                  { label: "Capabilities", activeFrom: 3, color: "#FFB84D", count: activeCapIds.size },
                  { label: "Providers",    activeFrom: 4, color: "#34D399", count: activeProvIds.size },
                ] as { label: string; activeFrom: number; color: string; count: number | null }[]).map((node, idx, arr) => {
                  const isActive  = cascadeStep >= node.activeFrom;
                  const isGlowing = cascadeStep === node.activeFrom;
                  return (
                    <div key={node.label}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                          background: isActive ? node.color : "transparent",
                          border: `1.5px solid ${isActive ? node.color : "#0a2040"}`,
                          boxShadow: isGlowing ? `0 0 7px ${node.color}` : "none",
                          transition: "background 0.3s ease, box-shadow 0.3s ease",
                        }} />
                        <span style={{
                          fontSize: 10.5, flex: 1,
                          color: isActive ? node.color : "#1a3550",
                          fontWeight: isActive ? 600 : 400,
                          transition: "color 0.3s ease",
                        }}>
                          {node.label}
                        </span>
                        {node.count !== null && (
                          <span style={{
                            fontSize: 9.5, fontWeight: 600, fontVariantNumeric: "tabular-nums",
                            color: isActive ? node.color : "#0a1e30",
                          }}>
                            {isActive ? node.count : "—"}
                          </span>
                        )}
                      </div>
                      {idx < arr.length - 1 && (
                        <div style={{
                          marginLeft: 3.5, width: 1, height: 8,
                          background: cascadeStep > node.activeFrom ? node.color : "#0a2040",
                          opacity: cascadeStep > node.activeFrom ? 0.45 : 0.2,
                          transition: "background 0.3s ease, opacity 0.3s ease",
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. SYSTEM STATE */}
            <div style={{
              background: "#030c18",
              border: "1px solid #081828",
              borderRadius: 6, padding: "12px 14px",
            }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" as const, color: "#1a3550", marginBottom: 10 }}>
                System State
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 5 }}>
                {/* Mode toggle */}
                <div style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 9, color: "#1a3550", marginBottom: 3, letterSpacing: "0.5px", textTransform: "uppercase" as const }}>Mode</div>
                  <div style={{ display: "flex", gap: 3 }}>
                    {(["contextual", "taxonomic"] as const).map(mode => {
                      const on     = viewMode === mode;
                      const accent = mode === "contextual" ? "#A371F7" : "#FFB84D";
                      return (
                        <button
                          key={mode}
                          onClick={() => setViewMode(mode)}
                          style={{
                            flex: 1, fontSize: 8, fontWeight: on ? 700 : 400,
                            padding: "3px 4px", borderRadius: 3, cursor: "pointer",
                            background: on ? `${accent}22` : "transparent",
                            color: on ? accent : "#1a3550",
                            border: `1px solid ${on ? `${accent}44` : "#071420"}`,
                            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                            letterSpacing: "0.3px",
                            transition: "background 0.12s ease, color 0.12s ease",
                          }}
                        >
                          {mode === "contextual" ? "Contextual" : "Explore Taxonomy"}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ borderTop: "1px solid #071420", paddingTop: 6, display: "flex", flexDirection: "column" as const, gap: 5 }}>
                  {([
                    { label: "Values",       value: cascadeStep >= 2 ? String(activeValueIds.size) : "—",         color: "#5B8CFF" },
                    { label: "Capabilities", value: cascadeStep >= 3 ? String(activeCapIds.size)   : "—",         color: "#FFB84D" },
                    { label: "Providers",    value: cascadeStep >= 4 ? String(activeProvIds.size)  : "—",         color: "#34D399" },
                    { label: "Coverage",     value: cascadeStep >= 3 ? `${coveragePct}%`           : "—",         color: "#22D3EE" },
                    { label: "Evidence",     value: String(evidenceCount),                                         color: "#6E7681" },
                  ] as { label: string; value: string; color: string }[]).map(row => (
                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: "#1a3550" }}>{row.label}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: row.color, fontVariantNumeric: "tabular-nums" }}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. TOP INSIGHTS */}
            <div style={{
              background: "#030c18",
              border: "1px solid #081828",
              borderRadius: 6, padding: "12px 14px",
            }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" as const, color: "#1a3550", marginBottom: 10 }}>
                Top Insights
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
                {dominantVal && (
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: VALUE_COLOR[dominantVal.id], marginTop: 3, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: VALUE_COLOR[dominantVal.id], marginBottom: 1 }}>
                        Dominant value
                      </div>
                      <div style={{ fontSize: 9, color: "#1a4a6a", lineHeight: 1.45 }}>
                        <strong style={{ color: "#3a6a9a" }}>{dominantVal.label}</strong>
                        {" "}in {valGapCount.get(dominantVal.id)}/{selectedMission?.gaps.length ?? 0} gaps
                      </div>
                    </div>
                  </div>
                )}
                {topConnectedVal && (
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: VALUE_COLOR[topConnectedVal.id], marginTop: 3, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: VALUE_COLOR[topConnectedVal.id], marginBottom: 1 }}>
                        Most connected
                      </div>
                      <div style={{ fontSize: 9, color: "#1a4a6a", lineHeight: 1.45 }}>
                        <strong style={{ color: "#3a6a9a" }}>{topConnectedVal.label}</strong>
                        {" "}→ {topConnectedVcrCount} capabilities
                      </div>
                    </div>
                  </div>
                )}
                {cascadeStep >= 3 && uncoveredCapCount > 0 && (
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#F87171", marginTop: 3, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: "#F87171", marginBottom: 1 }}>
                        Coverage gap
                      </div>
                      <div style={{ fontSize: 9, color: "#3a2020", lineHeight: 1.45 }}>
                        {uncoveredCapCount} {uncoveredCapCount !== 1 ? "capabilities" : "capability"} with no provider
                      </div>
                    </div>
                  </div>
                )}
                {cascadeStep >= 3 && uncoveredCapCount === 0 && activeCapIds.size > 0 && (
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34D399", marginTop: 3, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: "#34D399", marginBottom: 1 }}>
                        Full coverage
                      </div>
                      <div style={{ fontSize: 9, color: "#1a4a3a", lineHeight: 1.45 }}>
                        All {activeCapIds.size} capabilities have providers
                      </div>
                    </div>
                  </div>
                )}
                {cascadeStep < 3 && (
                  <div style={{ fontSize: 9, color: "#0f2030", lineHeight: 1.45 }}>
                    Waiting for cascade to reach Capabilities…
                  </div>
                )}
              </div>
            </div>

            {/* 5. NEXT ACTION */}
            <div style={{
              background: "#030c18",
              border: "1px solid #081828",
              borderRadius: 6, padding: "12px 14px",
            }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" as const, color: "#1a3550", marginBottom: 10 }}>
                Next Action
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                {([
                  {
                    label:  "required_for",
                    status: validationPass ? "✓ Complete" : "Partial",
                    color:  validationPass ? "#34D399" : "#FFB84D",
                    note:   validationPass
                      ? `${contextualVcrs.length} contextual relations — all gaps covered`
                      : `${gapsWithRF.size}/${missionGapIds.size} gaps qualified`,
                  },
                  { label: "selected_for", status: "Pending",  color: "#FFB84D", note: "Write-path not yet enabled (Phase 1)" },
                  { label: "Evidence",     status: "Waiting",  color: "#6E7681", note: "Intent-grade only · real signals: 0"  },
                ] as { label: string; status: string; color: string; note: string }[]).map(action => (
                  <div key={action.label} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ width: 1, alignSelf: "stretch", background: action.color, opacity: 0.3, marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                        <code style={{
                          fontSize: 8.5, color: action.color,
                          background: `${action.color}0f`,
                          padding: "1px 4px", borderRadius: 2,
                        }}>
                          {action.label}
                        </code>
                        <span style={{ fontSize: 8.5, color: action.color, opacity: 0.8 }}>{action.status}</span>
                      </div>
                      <div style={{ fontSize: 9, color: "#0f2030", lineHeight: 1.45 }}>{action.note}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 6. MISSION HEALTH */}
            <div style={{
              background: "#020a15",
              border: "1px solid #071420",
              borderRadius: 6, padding: "12px 14px",
            }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" as const, color: "#1a3550", marginBottom: 10 }}>
                Mission Health
              </div>

              {/* Health score bar */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: "#1a3550" }}>Health score</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: missionHealthPct >= 80 ? "#34D399" : missionHealthPct >= 50 ? "#FFB84D" : "#F87171", fontVariantNumeric: "tabular-nums" }}>
                    {missionHealthPct}%
                  </span>
                </div>
                <div style={{ background: "#071420", borderRadius: 2, height: 3, overflow: "hidden" as const }}>
                  <div style={{
                    height: "100%", borderRadius: 2,
                    background: missionHealthPct >= 80
                      ? "linear-gradient(90deg, #34D399, #22c07a)"
                      : missionHealthPct >= 50
                        ? "linear-gradient(90deg, #FFB84D, #e09030)"
                        : "#F87171",
                    width: `${missionHealthPct}%`,
                    transition: "width 0.5s ease",
                  }} />
                </div>
              </div>

              {/* Health detail rows */}
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 5 }}>
                {([
                  {
                    label: "Graph Integrity",
                    value: `${graphIntegrityPct}%`,
                    color: graphIntegrityPct === 100 ? "#34D399" : "#FFB84D",
                  },
                  {
                    label: "Relation Validation",
                    value: validationPass ? "PASS" : "PARTIAL",
                    color: validationPass ? "#34D399" : "#FFB84D",
                  },
                  {
                    label: "Read Layer",
                    value: "LIVE",
                    color: "#34D399",
                  },
                  {
                    label: "Write Layer",
                    value: "LOCKED",
                    color: "#6E7681",
                  },
                ] as { label: string; value: string; color: string }[]).map(row => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 9.5, color: "#1a3550" }}>{row.label}</span>
                    <span style={{
                      fontSize: 8, fontWeight: 700, letterSpacing: "0.8px",
                      color: row.color,
                      fontFamily: "var(--font-geist-mono), monospace",
                    }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <footer style={{
          borderTop: "1px solid #0a1e30",
          marginTop: 48, paddingTop: 16,
          display: "flex", justifyContent: "space-between", flexWrap: "wrap" as const, gap: 8,
        }}>
          <span style={{ fontSize: 11, color: "#102030", fontFamily: "var(--font-geist-mono), monospace" }}>
            /world · Potential + Live Layer + PUDM Cascade · {missions.length}M {gaps.length}G {values.length}V {capabilities.length}C {providers.length}P
          </span>
          <span style={{ fontSize: 11, color: "#0d1e2e" }}>
            Values: Candidate grade — designed, not validated
          </span>
        </footer>
      </div>

      {/* ── Fixed Inspector Panel ───────────────────────────────────────────── */}
      {inspectorOpen && (
        <aside style={isMobile ? {
          position:     "fixed",
          bottom:       0, left: 0, right: 0,
          width:        "100%",
          height:       "45vh",
          overflow:     "auto",
          background:   "#030e1c",
          borderTop:    `1px solid ${inspColor}28`,
          zIndex:       200,
          display:      "flex",
          flexDirection: "column" as const,
          padding:      "14px 16px 32px",
          boxSizing:    "border-box" as const,
        } : {
          position:      "fixed",
          right:         0, top: 0,
          width:         300,
          height:        "100dvh",
          overflow:      "auto",
          background:    "#030e1c",
          borderLeft:    `1px solid ${inspColor}28`,
          zIndex:        200,
          display:       "flex",
          flexDirection: "column" as const,
          padding:       "20px 16px 48px",
          boxSizing:     "border-box" as const,
        }}>
          {/* Header row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{
              fontSize: 8, fontWeight: 700, letterSpacing: "2.5px",
              textTransform: "uppercase" as const,
              color: `${inspColor}cc`, background: `${inspColor}12`,
              padding: "3px 8px", borderRadius: 3,
              border: `1px solid ${inspColor}22`,
            }}>
              {inspTypeLabel}
            </span>
            <button
              onClick={() => { setInspectedNode(null); setInspectedEdge(null); }}
              aria-label="Close inspector"
              style={{
                fontSize: 13, lineHeight: 1,
                color: `${inspColor}88`, background: "none",
                border: "none", cursor: "pointer", padding: "2px 4px",
              }}
            >✕</button>
          </div>

          {/* Title */}
          <div style={{ fontSize: 14, fontWeight: 700, color: inspColor, lineHeight: 1.35, marginBottom: 4 }}>
            {inspTitle}
          </div>

          {/* Subtitle / domain */}
          {inspSubtitle && (
            <div style={{ fontSize: 10, color: `${inspColor}66`, marginBottom: 12 }}>
              {inspSubtitle}
            </div>
          )}

          {/* Divider */}
          <div style={{ borderTop: `1px solid ${inspColor}15`, marginBottom: 12 }} />

          {/* Entity-specific content */}
          {inspContent}

          {/* ID footer */}
          <div style={{ marginTop: "auto", paddingTop: 16 }}>
            <div style={{
              fontSize: 8, fontFamily: "var(--font-geist-mono), monospace",
              color: "#0f2030", wordBreak: "break-all" as const,
            }}>
              {inspectedNode
                ? inspectedNode.id
                : inspectedEdge?.id ?? ""}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
