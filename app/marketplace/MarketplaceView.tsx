"use client";

import { useState } from "react";
import type { Mission } from "@/app/lib/mission/schema";
import type { Gap } from "@/app/lib/gap/schema";
import type { Value } from "@/app/lib/value/schema";
import type { Capability } from "@/app/lib/capability/schema";
import type { ValueCapabilityRelation } from "@/app/lib/value-capability-relation/schema";
import type { Provider } from "@/app/lib/provider/schema";
import type { ProviderCapabilityRelation } from "@/app/lib/provider-capability-relation/schema";

// ── Types ──────────────────────────────────────────────────────────────────────

type InspectedItem =
  | { kind: "value";      id: string }
  | { kind: "capability"; id: string }
  | { kind: "provider";   id: string }
  | { kind: "vcr";        id: string }
  | { kind: "pcr";        id: string };

export interface MarketplaceViewProps {
  mission:      Mission;
  missionGaps:  Gap[];
  values:       Value[];
  capabilities: Capability[];
  providers:    Provider[];
  vcRelations:  ValueCapabilityRelation[];
  pcRelations:  ProviderCapabilityRelation[];
}

// ── Design tokens ──────────────────────────────────────────────────────────────

const SEVERITY: Record<string, { label: string; bg: string; text: string; border: string }> = {
  critical:    { label: "critical",    bg: "#DA363318", text: "#F85149", border: "#DA363330" },
  significant: { label: "significant", bg: "#D2992218", text: "#E3B341", border: "#D2992230" },
  moderate:    { label: "moderate",    bg: "#58A6FF18", text: "#58A6FF", border: "#58A6FF30" },
  minor:       { label: "minor",       bg: "#30363D",   text: "#7D8590", border: "#30363D"   },
};

const DOMAIN_COLOR: Record<string, string> = {
  Finance: "#D29922", Operations: "#388BFD", Marketing: "#3FB950",
  Design: "#F472B6", Social: "#9E6EE6", Epistemic: "#79C0FF",
};

const GRADE_COLOR: Record<string, string> = {
  "Frozen": "#3FB950", "Candidate": "#D29922",
  "Placeholder": "#58A6FF", "Not established": "#6E7681",
};

// ── Inspector layout helpers (module-level, no hooks) ─────────────────────────

function IRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
      <span style={{
        fontSize: 10, fontFamily: "monospace", color: "var(--muted)",
        textTransform: "uppercase" as const, letterSpacing: "0.05em",
        minWidth: 106, paddingTop: 1, flexShrink: 0,
      }}>
        {label}
      </span>
      <span style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.5, wordBreak: "break-word" as const, flex: 1 }}>
        {children}
      </span>
    </div>
  );
}

function ISection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 9, fontFamily: "monospace", color: "var(--muted)",
        textTransform: "uppercase" as const, letterSpacing: "0.08em",
        marginBottom: 8, paddingBottom: 4, borderBottom: "1px solid var(--border)",
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function EvidenceBlock({ signal, note, source, accentColor }: {
  signal: string; note: string; source: string | null; accentColor: string;
}) {
  return (
    <div style={{
      marginBottom: 8, padding: "6px 10px", borderRadius: 4,
      background: "var(--surface-2)", border: "1px solid var(--border)",
    }}>
      <div style={{ fontSize: 10, color: accentColor, marginBottom: 3 }}>{signal}</div>
      <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.55 }}>{note}</div>
      {source && <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 3, fontStyle: "italic" }}>src: {source}</div>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

const INSPECTOR_W = 360;

export default function MarketplaceView({
  mission, missionGaps, values, capabilities, providers, vcRelations, pcRelations,
}: MarketplaceViewProps) {
  const [inspected,       setInspected]       = useState<InspectedItem | null>(null);
  const [filterGapId,     setFilterGapId]     = useState<string>("");
  const [filterValueId,   setFilterValueId]   = useState<string>("");
  const [filterCapDomain, setFilterCapDomain] = useState<string>("");
  const [filterProviderId,setFilterProviderId]= useState<string>("");
  const [filterCoverage,  setFilterCoverage]  = useState<"all"|"covered"|"uncovered">("all");
  const [filterRelType,   setFilterRelType]   = useState<string>("");
  const [filterGrade,     setFilterGrade]     = useState<string>("");

  // ── Lookup maps ────────────────────────────────────────────────────────────
  const valueById      = new Map(values.map     (v => [v.id, v]));
  const capabilityById = new Map(capabilities.map(c => [c.id, c]));
  const providerById   = new Map(providers.map  (p => [p.id, p]));
  const vcrById        = new Map(vcRelations.map (r => [r.id, r]));
  const pcrById        = new Map(pcRelations.map (r => [r.id, r]));

  const capIdsByValueId = new Map<string, string[]>();
  for (const vcr of vcRelations) {
    const arr = capIdsByValueId.get(vcr.valueId) ?? [];
    if (!arr.includes(vcr.capabilityId)) arr.push(vcr.capabilityId);
    capIdsByValueId.set(vcr.valueId, arr);
  }

  const provsByCapId = new Map<string, Provider[]>();
  for (const pcr of pcRelations) {
    const prov = providerById.get(pcr.providerId);
    if (!prov) continue;
    const arr = provsByCapId.get(pcr.capabilityId) ?? [];
    if (!arr.some(p => p.id === prov.id)) arr.push(prov);
    provsByCapId.set(pcr.capabilityId, arr);
  }

  const vcrsByValueId = new Map<string, ValueCapabilityRelation[]>();
  const vcrsByCapId   = new Map<string, ValueCapabilityRelation[]>();
  for (const vcr of vcRelations) {
    const a = vcrsByValueId.get(vcr.valueId)      ?? []; a.push(vcr); vcrsByValueId.set(vcr.valueId, a);
    const b = vcrsByCapId  .get(vcr.capabilityId) ?? []; b.push(vcr); vcrsByCapId.set(vcr.capabilityId, b);
  }

  const pcrsByCapId      = new Map<string, ProviderCapabilityRelation[]>();
  const pcrsByProviderId = new Map<string, ProviderCapabilityRelation[]>();
  for (const pcr of pcRelations) {
    const a = pcrsByCapId     .get(pcr.capabilityId) ?? []; a.push(pcr); pcrsByCapId.set(pcr.capabilityId, a);
    const b = pcrsByProviderId.get(pcr.providerId)   ?? []; b.push(pcr); pcrsByProviderId.set(pcr.providerId, b);
  }

  const gapsByValueId = new Map<string, Gap[]>();
  for (const gap of missionGaps) {
    for (const ref of gap.requiredValues ?? []) {
      const arr = gapsByValueId.get(ref.valueId) ?? []; arr.push(gap); gapsByValueId.set(ref.valueId, arr);
    }
  }

  const selectedForCount = pcRelations.filter(r => r.relationType === "selected_for").length;
  const coveredCapIds    = new Set(pcRelations.map(r => r.capabilityId));

  // ── Filter option sets ─────────────────────────────────────────────────────
  const allCapDomains = [...new Set(capabilities.map(c => c.context.domain).filter(Boolean) as string[])].sort();
  const allRelTypes   = [...new Set([...vcRelations.map(r => r.relationType), ...pcRelations.map(r => r.relationType)])].sort();
  const allGrades     = ["Frozen", "Candidate", "Placeholder", "Not established"].filter(g =>
    capabilities.some(c => c.evidenceGrade === g) ||
    vcRelations.some(r => r.evidenceGrade === g)   ||
    pcRelations.some(r => r.evidenceGrade === g)
  );

  const anyFilterActive = !!(filterGapId || filterValueId || filterCapDomain || filterProviderId
    || filterCoverage !== "all" || filterRelType || filterGrade);

  const visibleGaps = filterGapId ? missionGaps.filter(g => g.id === filterGapId) : missionGaps;

  function clearFilters() {
    setFilterGapId(""); setFilterValueId(""); setFilterCapDomain("");
    setFilterProviderId(""); setFilterCoverage("all"); setFilterRelType(""); setFilterGrade("");
  }

  // ── Gap coverage computation ───────────────────────────────────────────────
  function gapCoverage(gap: Gap) {
    const reqValueIds = gap.requiredValues.map(r => r.valueId);
    const seen = new Set<string>();
    const items: Array<{
      capability:      Capability;
      coveredByValues: Value[];
      vcrIds:          string[];
      providers:       Provider[];
    }> = [];

    for (const vid of reqValueIds) {
      for (const capId of capIdsByValueId.get(vid) ?? []) {
        if (seen.has(capId)) {
          const item = items.find(i => i.capability.id === capId);
          const val  = valueById.get(vid);
          if (item && val && !item.coveredByValues.some(v => v.id === vid)) {
            item.coveredByValues.push(val);
            const vcr = vcRelations.find(r => r.valueId === vid && r.capabilityId === capId);
            if (vcr && !item.vcrIds.includes(vcr.id)) item.vcrIds.push(vcr.id);
          }
          continue;
        }
        seen.add(capId);
        const cap = capabilityById.get(capId);
        if (!cap) continue;
        const val = valueById.get(vid);
        const vcr = vcRelations.find(r => r.valueId === vid && r.capabilityId === capId);
        items.push({
          capability:      cap,
          coveredByValues: val ? [val] : [],
          vcrIds:          vcr ? [vcr.id] : [],
          providers:       provsByCapId.get(capId) ?? [],
        });
      }
    }
    return items;
  }

  // ── Filtered items per gap ────────────────────────────────────────────────
  function filteredItems(gap: Gap) {
    let items = gapCoverage(gap);
    if (filterValueId)
      items = items.filter(i => i.coveredByValues.some(v => v.id === filterValueId));
    if (filterCapDomain)
      items = items.filter(i => i.capability.context.domain === filterCapDomain);
    if (filterProviderId)
      items = items.filter(i => i.providers.some(p => p.id === filterProviderId));
    if (filterCoverage === "covered")
      items = items.filter(i => i.providers.length > 0);
    if (filterCoverage === "uncovered")
      items = items.filter(i => i.providers.length === 0);
    if (filterRelType)
      items = items.filter(i =>
        i.vcrIds.some(id => vcrById.get(id)?.relationType === filterRelType) ||
        (pcrsByCapId.get(i.capability.id) ?? []).some(r => r.relationType === filterRelType)
      );
    if (filterGrade)
      items = items.filter(i => i.capability.evidenceGrade === filterGrade);
    return items;
  }

  // ── Inspection state helpers ───────────────────────────────────────────────
  function inspect(item: InspectedItem) {
    setInspected(prev =>
      prev?.kind === item.kind && prev.id === item.id ? null : item
    );
  }

  function active(item: InspectedItem) {
    return inspected?.kind === item.kind && inspected.id === item.id;
  }

  // ── Chip / badge render functions (called as functions, not JSX components) ─

  function chipValue(v: Value) {
    const on = active({ kind: "value", id: v.id });
    return (
      <button key={v.id} onClick={() => inspect({ kind: "value", id: v.id })} style={{
        fontSize: 10, padding: "2px 7px", borderRadius: 3, cursor: "pointer",
        background: on ? "#3FB950"  : "#3FB95015",
        color:      on ? "#0D1117"  : "#3FB950",
        border:    `1px solid ${on ? "#3FB950" : "#3FB95028"}`,
        fontWeight: on ? 700 : 500, fontFamily: "inherit",
      }}>
        {v.context.label}
      </button>
    );
  }

  function chipCap(cap: Capability) {
    const on = active({ kind: "capability", id: cap.id });
    return (
      <button key={cap.id} onClick={() => inspect({ kind: "capability", id: cap.id })} style={{
        display: "inline-block", fontSize: 11, padding: "3px 9px", borderRadius: 4,
        cursor: "pointer", fontWeight: on ? 700 : 500,
        background: on ? "#F472B6"  : "#F472B615",
        color:      on ? "#0D1117"  : "#F472B6",
        border:    `1px solid ${on ? "#F472B6" : "#F472B628"}`,
        fontFamily: "inherit",
      }}>
        {cap.context.label}
      </button>
    );
  }

  function chipProv(prov: Provider) {
    const on = active({ kind: "provider", id: prov.id });
    return (
      <button key={prov.id} onClick={() => inspect({ kind: "provider", id: prov.id })} style={{
        fontSize: 11, padding: "3px 9px", borderRadius: 4, cursor: "pointer",
        fontWeight: on ? 700 : 500,
        background: on ? "#FB923C"  : "#FB923C15",
        color:      on ? "#0D1117"  : "#FB923C",
        border:    `1px solid ${on ? "#FB923C" : "#FB923C28"}`,
        fontFamily: "inherit",
      }}>
        {prov.context.label}
      </button>
    );
  }

  function badgeVcr(vcrId: string) {
    const on = active({ kind: "vcr", id: vcrId });
    return (
      <button key={vcrId} onClick={() => inspect({ kind: "vcr", id: vcrId })} title="Inspect relation"
        style={{
          fontSize: 8, padding: "1px 4px", borderRadius: 2, cursor: "pointer",
          background: on ? "#58A6FF"  : "#58A6FF12",
          color:      on ? "#0D1117"  : "#58A6FF",
          border:    `1px solid ${on ? "#58A6FF" : "#58A6FF28"}`,
          fontFamily: "monospace", fontWeight: 600, letterSpacing: "0.04em",
        }}>
        vcr
      </button>
    );
  }

  function badgePcr(pcrId: string) {
    const on = active({ kind: "pcr", id: pcrId });
    return (
      <button key={pcrId} onClick={() => inspect({ kind: "pcr", id: pcrId })} title="Inspect relation"
        style={{
          fontSize: 8, padding: "1px 4px", borderRadius: 2, cursor: "pointer",
          background: on ? "#9E6EE6"  : "#9E6EE612",
          color:      on ? "#0D1117"  : "#9E6EE6",
          border:    `1px solid ${on ? "#9E6EE6" : "#9E6EE628"}`,
          fontFamily: "monospace", fontWeight: 600, letterSpacing: "0.04em",
        }}>
        pcr
      </button>
    );
  }

  // small navigate-link inside inspector
  function navBtn(label: string, item: InspectedItem, color: string) {
    return (
      <button onClick={() => inspect(item)} style={{
        display: "inline-block", marginTop: 3, fontSize: 10, padding: "2px 6px",
        borderRadius: 3, cursor: "pointer",
        background: `${color}12`, color, border: `1px solid ${color}25`,
        fontFamily: "inherit",
      }}>
        {label}
      </button>
    );
  }

  // ── Inspector panel content ────────────────────────────────────────────────
  function renderInspectorBody() {
    if (!inspected) return null;

    if (inspected.kind === "value") {
      const v = valueById.get(inspected.id);
      if (!v) return <div style={{ color: "var(--muted)", padding: 4, fontSize: 12 }}>Not found.</div>;
      const connGaps = gapsByValueId.get(v.id) ?? [];
      const connVcrs = vcrsByValueId.get(v.id) ?? [];
      const connCapIds = [...new Set(connVcrs.map(r => r.capabilityId))];
      return (
        <>
          <ISection title="Identity">
            <IRow label="id"><code style={{ fontSize: 10, color: "var(--muted)", wordBreak: "break-all" }}>{v.id}</code></IRow>
            <IRow label="type"><code style={{ fontSize: 10 }}>Value</code></IRow>
            <IRow label="grade"><span style={{ color: GRADE_COLOR[v.evidenceGrade] ?? "#6E7681" }}>{v.evidenceGrade}</span></IRow>
          </ISection>
          <ISection title="Context">
            {v.context.domain && <IRow label="domain">{v.context.domain}</IRow>}
            <IRow label="description"><span style={{ color: "var(--muted)", lineHeight: 1.6 }}>{v.context.description}</span></IRow>
          </ISection>
          <ISection title="Connections">
            <IRow label="gaps">
              {connGaps.length === 0
                ? <span style={{ color: "var(--muted)", fontStyle: "italic" }}>none</span>
                : <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {connGaps.map(g => <code key={g.id} style={{ fontSize: 10, color: "#D29922" }}>{g.id}</code>)}
                  </div>
              }
            </IRow>
            <IRow label="capabilities">
              {connCapIds.length === 0
                ? <span style={{ color: "var(--muted)", fontStyle: "italic" }}>none</span>
                : <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {connCapIds.map(cid => {
                      const cap = capabilityById.get(cid);
                      return cap ? navBtn(cap.context.label, { kind: "capability", id: cid }, "#F472B6") : null;
                    })}
                  </div>
              }
            </IRow>
            <IRow label="vcr count">{connVcrs.length}</IRow>
          </ISection>
          {connVcrs.length > 0 && (
            <ISection title="Relations">
              {connVcrs.map(vcr => (
                <button key={vcr.id} onClick={() => inspect({ kind: "vcr", id: vcr.id })} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  width: "100%", marginBottom: 5, padding: "5px 8px", borderRadius: 4, cursor: "pointer",
                  background: "#58A6FF0A", border: "1px solid #58A6FF20",
                  fontFamily: "inherit", textAlign: "left",
                }}>
                  <code style={{ fontSize: 9, color: "#58A6FF" }}>{vcr.id.slice(-24)}</code>
                  <span style={{ fontSize: 9, color: "var(--muted)" }}>{vcr.relationType}</span>
                </button>
              ))}
            </ISection>
          )}
        </>
      );
    }

    if (inspected.kind === "capability") {
      const cap = capabilityById.get(inspected.id);
      if (!cap) return <div style={{ color: "var(--muted)", padding: 4, fontSize: 12 }}>Not found.</div>;
      const connVcrs = vcrsByCapId.get(cap.id) ?? [];
      const connPcrs = pcrsByCapId.get(cap.id) ?? [];
      const connValueIds = [...new Set(connVcrs.map(r => r.valueId))];
      const connProvIds  = [...new Set(connPcrs.map(r => r.providerId))];
      return (
        <>
          <ISection title="Identity">
            <IRow label="id"><code style={{ fontSize: 10, color: "var(--muted)", wordBreak: "break-all" }}>{cap.id}</code></IRow>
            <IRow label="type"><code style={{ fontSize: 10 }}>Capability</code></IRow>
            <IRow label="grade"><span style={{ color: GRADE_COLOR[cap.evidenceGrade] ?? "#6E7681" }}>{cap.evidenceGrade}</span></IRow>
          </ISection>
          <ISection title="Context">
            {cap.context.domain    && <IRow label="domain">{cap.context.domain}</IRow>}
            {cap.context.maturity  && <IRow label="maturity">{cap.context.maturity}</IRow>}
            <IRow label="description"><span style={{ color: "var(--muted)", lineHeight: 1.6 }}>{cap.context.description}</span></IRow>
          </ISection>
          <ISection title="Connections">
            <IRow label="values">
              {connValueIds.length === 0
                ? <span style={{ color: "var(--muted)", fontStyle: "italic" }}>none</span>
                : <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {connValueIds.map(vid => {
                      const v = valueById.get(vid);
                      return v ? navBtn(v.context.label, { kind: "value", id: vid }, "#3FB950") : null;
                    })}
                  </div>
              }
            </IRow>
            <IRow label="providers">
              {connProvIds.length === 0
                ? <span style={{ color: "var(--muted)", fontStyle: "italic" }}>none</span>
                : <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {connProvIds.map(pid => {
                      const p = providerById.get(pid);
                      return p ? navBtn(p.context.label, { kind: "provider", id: pid }, "#FB923C") : null;
                    })}
                  </div>
              }
            </IRow>
            <IRow label="vcr count">{connVcrs.length}</IRow>
            <IRow label="pcr count">{connPcrs.length}</IRow>
          </ISection>
          {connVcrs.length > 0 && (
            <ISection title="ValueCapabilityRelations">
              {connVcrs.map(vcr => (
                <button key={vcr.id} onClick={() => inspect({ kind: "vcr", id: vcr.id })} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  width: "100%", marginBottom: 5, padding: "5px 8px", borderRadius: 4, cursor: "pointer",
                  background: "#58A6FF0A", border: "1px solid #58A6FF20",
                  fontFamily: "inherit", textAlign: "left",
                }}>
                  <code style={{ fontSize: 9, color: "#58A6FF" }}>{vcr.id.slice(-24)}</code>
                  <span style={{ fontSize: 9, color: "var(--muted)" }}>{vcr.relationType}</span>
                </button>
              ))}
            </ISection>
          )}
          {connPcrs.length > 0 && (
            <ISection title="ProviderCapabilityRelations">
              {connPcrs.map(pcr => (
                <button key={pcr.id} onClick={() => inspect({ kind: "pcr", id: pcr.id })} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  width: "100%", marginBottom: 5, padding: "5px 8px", borderRadius: 4, cursor: "pointer",
                  background: "#9E6EE60A", border: "1px solid #9E6EE620",
                  fontFamily: "inherit", textAlign: "left",
                }}>
                  <code style={{ fontSize: 9, color: "#9E6EE6" }}>{pcr.id.slice(-24)}</code>
                  <span style={{ fontSize: 9, color: "var(--muted)" }}>{pcr.relationType}</span>
                </button>
              ))}
            </ISection>
          )}
        </>
      );
    }

    if (inspected.kind === "provider") {
      const prov = providerById.get(inspected.id);
      if (!prov) return <div style={{ color: "var(--muted)", padding: 4, fontSize: 12 }}>Not found.</div>;
      const connPcrs    = pcrsByProviderId.get(prov.id) ?? [];
      const connCapIds  = [...new Set(connPcrs.map(r => r.capabilityId))];
      return (
        <>
          <ISection title="Identity">
            <IRow label="id"><code style={{ fontSize: 10, color: "var(--muted)", wordBreak: "break-all" }}>{prov.id}</code></IRow>
            <IRow label="type"><code style={{ fontSize: 10 }}>Provider</code></IRow>
            <IRow label="grade"><span style={{ color: GRADE_COLOR[prov.evidenceGrade] ?? "#6E7681" }}>{prov.evidenceGrade}</span></IRow>
            <IRow label="provider type">{prov.context.providerType}</IRow>
          </ISection>
          <ISection title="Context">
            {prov.context.domain && <IRow label="domain">{prov.context.domain}</IRow>}
            <IRow label="description"><span style={{ color: "var(--muted)", lineHeight: 1.6 }}>{prov.context.description}</span></IRow>
          </ISection>
          <ISection title="Status">
            <div style={{
              padding: "6px 10px", borderRadius: 4,
              background: "#FB923C08", border: "1px solid #FB923C20",
              fontSize: 10, color: "var(--muted)", fontStyle: "italic", lineHeight: 1.6,
            }}>
              No selection made · not engaged · not evaluated
            </div>
            <div style={{ marginTop: 6, fontSize: 9, color: "var(--muted)", fontStyle: "italic" }}>
              Example provider — no affiliation, availability, recommendation, selection, or delivery implied.
            </div>
          </ISection>
          <ISection title="Connections">
            <IRow label="capabilities">
              {connCapIds.length === 0
                ? <span style={{ color: "var(--muted)", fontStyle: "italic" }}>none</span>
                : <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {connCapIds.map(cid => {
                      const cap = capabilityById.get(cid);
                      return cap ? navBtn(cap.context.label, { kind: "capability", id: cid }, "#F472B6") : null;
                    })}
                  </div>
              }
            </IRow>
            <IRow label="pcr count">{connPcrs.length}</IRow>
          </ISection>
          {connPcrs.length > 0 && (
            <ISection title="ProviderCapabilityRelations">
              {connPcrs.map(pcr => (
                <button key={pcr.id} onClick={() => inspect({ kind: "pcr", id: pcr.id })} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  width: "100%", marginBottom: 5, padding: "5px 8px", borderRadius: 4, cursor: "pointer",
                  background: "#9E6EE60A", border: "1px solid #9E6EE620",
                  fontFamily: "inherit", textAlign: "left",
                }}>
                  <code style={{ fontSize: 9, color: "#9E6EE6" }}>{pcr.id.slice(-24)}</code>
                  <span style={{ fontSize: 9, color: "var(--muted)" }}>{pcr.relationType}</span>
                </button>
              ))}
            </ISection>
          )}
        </>
      );
    }

    if (inspected.kind === "vcr") {
      const vcr = vcrById.get(inspected.id);
      if (!vcr) return <div style={{ color: "var(--muted)", padding: 4, fontSize: 12 }}>Not found.</div>;
      const val = valueById.get(vcr.valueId);
      const cap = capabilityById.get(vcr.capabilityId);
      return (
        <>
          <ISection title="Identity">
            <IRow label="id"><code style={{ fontSize: 10, color: "var(--muted)", wordBreak: "break-all" }}>{vcr.id}</code></IRow>
            <IRow label="type"><code style={{ fontSize: 10 }}>ValueCapabilityRelation</code></IRow>
            <IRow label="relationType"><code style={{ fontSize: 11, color: "#58A6FF" }}>{vcr.relationType}</code></IRow>
            <IRow label="status">{vcr.status}</IRow>
            <IRow label="grade"><span style={{ color: GRADE_COLOR[vcr.evidenceGrade] ?? "#6E7681" }}>{vcr.evidenceGrade}</span></IRow>
            <IRow label="scope">
              <span style={{ color: "#3FB950", fontStyle: "italic" }}>
                {vcr.relationType === "can_address" ? "taxonomic — no mission/gap required" : "contextual or execution"}
              </span>
            </IRow>
          </ISection>
          <ISection title="Endpoints">
            <IRow label="valueId">
              <div>
                <code style={{ fontSize: 10, color: "var(--muted)" }}>{vcr.valueId}</code>
                {val && navBtn(val.context.label, { kind: "value", id: vcr.valueId }, "#3FB950")}
              </div>
            </IRow>
            <IRow label="capabilityId">
              <div>
                <code style={{ fontSize: 10, color: "var(--muted)" }}>{vcr.capabilityId}</code>
                {cap && navBtn(cap.context.label, { kind: "capability", id: vcr.capabilityId }, "#F472B6")}
              </div>
            </IRow>
            {vcr.missionId && <IRow label="missionId"><code style={{ fontSize: 10, color: "var(--muted)" }}>{vcr.missionId}</code></IRow>}
            {vcr.gapId     && <IRow label="gapId">    <code style={{ fontSize: 10, color: "var(--muted)" }}>{vcr.gapId}</code></IRow>}
          </ISection>
          {vcr.evidence.length > 0 && (
            <ISection title="Evidence">
              {vcr.evidence.map((ev, i) => (
                <EvidenceBlock key={i} signal={ev.signal} note={ev.note} source={ev.source} accentColor="#58A6FF" />
              ))}
            </ISection>
          )}
        </>
      );
    }

    if (inspected.kind === "pcr") {
      const pcr = pcrById.get(inspected.id);
      if (!pcr) return <div style={{ color: "var(--muted)", padding: 4, fontSize: 12 }}>Not found.</div>;
      const prov = providerById.get(pcr.providerId);
      const cap  = capabilityById.get(pcr.capabilityId);
      return (
        <>
          <ISection title="Identity">
            <IRow label="id"><code style={{ fontSize: 10, color: "var(--muted)", wordBreak: "break-all" }}>{pcr.id}</code></IRow>
            <IRow label="type"><code style={{ fontSize: 10 }}>ProviderCapabilityRelation</code></IRow>
            <IRow label="relationType"><code style={{ fontSize: 11, color: "#9E6EE6" }}>{pcr.relationType}</code></IRow>
            <IRow label="status">{pcr.status}</IRow>
            <IRow label="grade"><span style={{ color: GRADE_COLOR[pcr.evidenceGrade] ?? "#6E7681" }}>{pcr.evidenceGrade}</span></IRow>
            <IRow label="scope">
              <span style={{ color: "#3FB950", fontStyle: "italic" }}>
                {pcr.relationType === "can_deliver" ? "taxonomic — no mission/gap required" : "execution — mission/gap required"}
              </span>
            </IRow>
          </ISection>
          <ISection title="Endpoints">
            <IRow label="providerId">
              <div>
                <code style={{ fontSize: 10, color: "var(--muted)" }}>{pcr.providerId}</code>
                {prov && navBtn(prov.context.label, { kind: "provider", id: pcr.providerId }, "#FB923C")}
              </div>
            </IRow>
            <IRow label="capabilityId">
              <div>
                <code style={{ fontSize: 10, color: "var(--muted)" }}>{pcr.capabilityId}</code>
                {cap && navBtn(cap.context.label, { kind: "capability", id: pcr.capabilityId }, "#F472B6")}
              </div>
            </IRow>
            {pcr.missionId && <IRow label="missionId"><code style={{ fontSize: 10, color: "var(--muted)" }}>{pcr.missionId}</code></IRow>}
            {pcr.gapId     && <IRow label="gapId">    <code style={{ fontSize: 10, color: "var(--muted)" }}>{pcr.gapId}</code></IRow>}
          </ISection>
          {pcr.evidence.length > 0 && (
            <ISection title="Evidence">
              {pcr.evidence.map((ev, i) => (
                <EvidenceBlock key={i} signal={ev.signal} note={ev.note} source={ev.source} accentColor="#9E6EE6" />
              ))}
            </ISection>
          )}
          {pcr.relationType === "can_deliver" && (
            <div style={{
              marginTop: 4, padding: "6px 10px", borderRadius: 4,
              background: "#FB923C08", border: "1px solid #FB923C20",
              fontSize: 9, color: "var(--muted)", fontStyle: "italic", lineHeight: 1.6,
            }}>
              No selection made · not engaged · not evaluated
            </div>
          )}
        </>
      );
    }

    return null;
  }

  // ── Inspector kind label ───────────────────────────────────────────────────
  function inspectorHeader(): { kindLabel: string; title: string } {
    if (!inspected) return { kindLabel: "", title: "" };
    if (inspected.kind === "value") {
      const v = valueById.get(inspected.id);
      return { kindLabel: "Value · Node", title: v?.context.label ?? inspected.id };
    }
    if (inspected.kind === "capability") {
      const cap = capabilityById.get(inspected.id);
      return { kindLabel: "Capability · Node", title: cap?.context.label ?? inspected.id };
    }
    if (inspected.kind === "provider") {
      const prov = providerById.get(inspected.id);
      return { kindLabel: "Provider · Node", title: prov?.context.label ?? inspected.id };
    }
    if (inspected.kind === "vcr") return { kindLabel: "ValueCapabilityRelation · Relation", title: "VCR" };
    if (inspected.kind === "pcr") return { kindLabel: "ProviderCapabilityRelation · Relation", title: "PCR" };
    return { kindLabel: "", title: "" };
  }

  const { kindLabel, title } = inspectorHeader();

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        :root {
          --bg: #0D1117; --surface: #161B22; --surface-2: #21262D;
          --border: #30363D; --text: #E6EDF3; --muted: #7D8590;
        }
        @media (prefers-color-scheme: light) { :root {
          --bg: #F6F8FA; --surface: #FFFFFF; --surface-2: #F0F2F4;
          --border: #D0D7DE; --text: #1F2328; --muted: #656D76;
        }}
        :root[data-theme="light"] {
          --bg: #F6F8FA; --surface: #FFFFFF; --surface-2: #F0F2F4;
          --border: #D0D7DE; --text: #1F2328; --muted: #656D76;
        }
        :root[data-theme="dark"] {
          --bg: #0D1117; --surface: #161B22; --surface-2: #21262D;
          --border: #30363D; --text: #E6EDF3; --muted: #7D8590;
        }
        *, *::before, *::after { box-sizing: border-box; }
        button { font-family: inherit; }
        .filter-select {
          font-size: 10px; font-family: monospace;
          padding: 3px 20px 3px 7px; border-radius: 3px;
          border: 1px solid var(--border); background: var(--surface-2);
          color: var(--text); cursor: pointer; outline: none;
          appearance: none; -webkit-appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%237D8590'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 6px center;
        }
        .filter-select:focus { border-color: #58A6FF80; }
        @media (max-width: 700px) {
          .filter-select { font-size: 11px; padding: 5px 20px 5px 8px; }
          .inspector-panel {
            width: 100vw !important;
            height: 56vh !important;
            top: auto !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            border-left: none !important;
            border-top: 1px solid var(--border);
          }
          .inspector-push { margin-right: 0 !important; }
        }
      `}</style>

      <div className="inspector-push" style={{ marginRight: inspected ? INSPECTOR_W : 0, transition: "margin-right 0.15s ease" }}>
        <main style={{
          maxWidth: 1040, margin: "0 auto",
          padding: "32px 24px 96px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: "var(--text)", background: "var(--bg)", minHeight: "100vh",
        }}>

          {/* ── Disclaimer ── */}
          <div style={{
            marginBottom: 20, padding: "8px 14px",
            background: "#FB923C0A", border: "1px solid #FB923C25",
            borderRadius: 5, fontSize: 11, color: "#FB923C",
            fontFamily: "monospace", lineHeight: 1.6,
          }}>
            Example providers only — no affiliation, availability, recommendation, selection, or delivery implied.
            &nbsp;·&nbsp;Taxonomic coverage view.
            &nbsp;·&nbsp;No <code>selected_for</code> relations exist.
            &nbsp;·&nbsp;<span style={{ color: "var(--muted)" }}>Click any chip to inspect.</span>
          </div>

          {/* ── Header ── */}
          <header style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.4px", margin: 0 }}>Marketplace</h1>
              <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--muted)" }}>
                taxonomic coverage · read-only · no write-path
              </span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <a href="/world" style={{
                  fontSize: 10, fontFamily: "monospace", color: "#58A6FF",
                  textDecoration: "none", padding: "2px 8px", borderRadius: 3,
                  background: "#58A6FF12", border: "1px solid #58A6FF28",
                }}>→ world</a>
                <a href="/pudm" style={{
                  fontSize: 10, fontFamily: "monospace", color: "#9E6EE6",
                  textDecoration: "none", padding: "2px 8px", borderRadius: 3,
                  background: "#9E6EE612", border: "1px solid #9E6EE628",
                }}>→ pudm</a>
              </div>
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
              What the PUDM knows about provider coverage for each Gap. No provider has been selected, contacted, or engaged.
            </p>
          </header>

          {/* ── Mission card ── */}
          <div style={{
            marginBottom: 28, padding: "16px 20px",
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
          }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Mission</span>
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: "#3FB95015", color: "#3FB950", border: "1px solid #3FB95028" }}>
                {mission.state.status}
              </span>
              <span style={{ fontSize: 10, color: "var(--muted)" }}>{mission.context.domain}</span>
            </div>
            <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 14px", lineHeight: 1.6, maxWidth: 720 }}>
              {mission.context.statement}
            </p>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {[
                { n: missionGaps.length,    label: "Gaps",              color: "#D29922"       },
                { n: coveredCapIds.size,    label: `/ ${capabilities.length} Capabilities`, color: "#F472B6" },
                { n: providers.length,      label: "Example Providers", color: "#FB923C"       },
                { n: selectedForCount,      label: "selected_for",      color: "var(--muted)"  },
              ].map(s => (
                <div key={s.label} style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.n}</span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Chain header ── */}
          <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontFamily: "monospace" }}>
            {["Mission", "Gap", "Value", "Capability", "Provider"].map((node, i, arr) => (
              <span key={node} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "var(--text)" }}>{node}</span>
                {i < arr.length - 1 && <span style={{ color: "var(--muted)" }}>→</span>}
              </span>
            ))}
            <span style={{ marginLeft: "auto", fontSize: 10, color: "#3FB950", padding: "1px 6px", borderRadius: 3, background: "#3FB95012", border: "1px solid #3FB95025" }}>
              live
            </span>
          </div>

          {/* ── Filter bar ── */}
          <div style={{
            marginBottom: 14, padding: "10px 14px",
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 6, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center",
          }}>
            <span style={{ fontSize: 9, fontFamily: "monospace", color: "var(--muted)", textTransform: "uppercase" as const, letterSpacing: "0.08em", flexShrink: 0 }}>
              Filter
            </span>

            <select value={filterGapId} onChange={e => setFilterGapId(e.target.value)} className="filter-select" title="Gap">
              <option value="">All gaps</option>
              {missionGaps.map(g => (
                <option key={g.id} value={g.id}>
                  {g.id.replace(/^gap_/, "").replace(/_\d+$/, "").replace(/_/g, " ")}
                </option>
              ))}
            </select>

            <select value={filterValueId} onChange={e => setFilterValueId(e.target.value)} className="filter-select" title="Value">
              <option value="">All values</option>
              {values.map(v => <option key={v.id} value={v.id}>{v.context.label}</option>)}
            </select>

            <select value={filterCapDomain} onChange={e => setFilterCapDomain(e.target.value)} className="filter-select" title="Capability domain">
              <option value="">All domains</option>
              {allCapDomains.map(d => <option key={d} value={d}>{d}</option>)}
            </select>

            <select value={filterCoverage} onChange={e => setFilterCoverage(e.target.value as "all"|"covered"|"uncovered")} className="filter-select" title="Coverage">
              <option value="all">All coverage</option>
              <option value="covered">Covered</option>
              <option value="uncovered">Uncovered</option>
            </select>

            <select value={filterRelType} onChange={e => setFilterRelType(e.target.value)} className="filter-select" title="Relation type">
              <option value="">All types</option>
              {allRelTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} className="filter-select" title="Evidence grade">
              <option value="">All grades</option>
              {allGrades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>

            <select value={filterProviderId} onChange={e => setFilterProviderId(e.target.value)} className="filter-select" title="Provider">
              <option value="">All providers</option>
              {providers.map(p => <option key={p.id} value={p.id}>{p.context.label}</option>)}
            </select>

            {anyFilterActive && (
              <button onClick={clearFilters} style={{
                fontSize: 9, padding: "2px 8px", borderRadius: 3, cursor: "pointer",
                background: "#DA363318", color: "#F85149", border: "1px solid #DA363330",
                fontFamily: "monospace", marginLeft: "auto",
              }}>clear ✕</button>
            )}
          </div>

          {/* ── Visible gap count ── */}
          {anyFilterActive && (
            <div style={{ marginBottom: 8, fontSize: 11, color: "var(--muted)", fontFamily: "monospace" }}>
              {visibleGaps.length} / {missionGaps.length} gaps · {
                visibleGaps.reduce((n, g) => n + filteredItems(g).length, 0)
              } capability rows
            </div>
          )}

          {/* ── Gap sections ── */}
          <div style={{ display: "grid", gap: 12 }}>
            {visibleGaps.map(gap => {
              const sev    = (gap.state as { severity?: string }).severity ?? "moderate";
              const sevCfg = SEVERITY[sev] ?? SEVERITY.moderate;
              const domCol = DOMAIN_COLOR[(gap.context as { domain?: string }).domain ?? ""] ?? "#7D8590";
              const items  = filteredItems(gap);

              return (
                <section key={gap.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ padding: "12px 18px 10px", borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 3, fontFamily: "monospace", background: sevCfg.bg, color: sevCfg.text, border: `1px solid ${sevCfg.border}` }}>
                        {sevCfg.label}
                      </span>
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 3, background: `${domCol}15`, color: domCol, border: `1px solid ${domCol}28` }}>
                        {(gap.context as { domain?: string }).domain}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>
                        {gap.id.replace(/^gap_/, "").replace(/_\d+$/, "").replace(/_/g, " ")}
                      </span>
                      <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--muted)", fontFamily: "monospace" }}>
                        {gap.state.status}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: "var(--muted)", margin: 0, lineHeight: 1.55, maxWidth: 820 }}>
                      {gap.context.description}
                    </p>
                  </div>

                  <div style={{ padding: "14px 18px", display: "grid", gap: 10 }}>
                    {items.length === 0
                      ? <span style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>No capability coverage mapped.</span>
                      : items.map(item => {
                          const capPcrs = pcrsByCapId.get(item.capability.id) ?? [];
                          return (
                            <div key={item.capability.id} style={{
                              display: "grid",
                              gridTemplateColumns: "160px 24px minmax(140px,1fr) 24px minmax(160px,1fr)",
                              gap: 0, alignItems: "start",
                            }}>
                              {/* Values */}
                              <div style={{ paddingRight: 8 }}>
                                <div style={{ fontSize: 9, color: "var(--muted)", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>values</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                  {item.coveredByValues.map(v => chipValue(v))}
                                </div>
                                {item.vcrIds.length > 0 && (
                                  <div style={{ display: "flex", gap: 3, marginTop: 4, flexWrap: "wrap" }}>
                                    {item.vcrIds.map(id => badgeVcr(id))}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 16, color: "var(--muted)", fontSize: 11 }}>→</div>
                              {/* Capability */}
                              <div style={{ paddingRight: 8 }}>
                                <div style={{ fontSize: 9, color: "var(--muted)", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>capability</div>
                                {chipCap(item.capability)}
                                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
                                  {item.capability.context.domain}
                                  {item.capability.context.maturity ? ` · ${item.capability.context.maturity}` : ""}
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 16, color: "var(--muted)", fontSize: 11 }}>→</div>
                              {/* Providers */}
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                                  <span style={{ fontSize: 9, color: "var(--muted)", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.06em" }}>example providers</span>
                                  <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 2, fontFamily: "monospace", background: "#30363D", color: "var(--muted)" }}>can_deliver</span>
                                </div>
                                {item.providers.length === 0
                                  ? <span style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>—</span>
                                  : <>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                        {item.providers.map(prov => {
                                          const pcr = capPcrs.find(r => r.providerId === prov.id);
                                          return (
                                            <div key={prov.id} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                              {chipProv(prov)}
                                              {pcr && badgePcr(pcr.id)}
                                            </div>
                                          );
                                        })}
                                      </div>
                                      <div style={{ fontSize: 9, color: "var(--muted)", fontStyle: "italic", marginTop: 4 }}>
                                        No selection made · not engaged · not evaluated
                                      </div>
                                    </>
                                }
                              </div>
                            </div>
                          );
                        })
                    }
                  </div>
                </section>
              );
            })}
          </div>

          {/* ── Footer ── */}
          <div style={{ marginTop: 36, padding: "10px 16px", background: "var(--surface-2)", borderRadius: 6, fontSize: 11, color: "var(--muted)", fontFamily: "monospace", lineHeight: 1.6 }}>
            Live · data/missions.json · data/gaps.json · data/values.json · data/capabilities.json
            &nbsp;· data/value-capability-relations.json · data/providers.json · data/provider-capability-relations.json
            <br />
            Relation type: <code>can_deliver</code> only · <code>selected_for</code>: 0 · write-path: not enabled
          </div>

        </main>
      </div>

      {/* ── Inspector panel ── */}
      {inspected && (
        <aside className="inspector-panel" style={{
          position: "fixed", top: 0, right: 0,
          width: INSPECTOR_W, height: "100vh",
          background: "var(--surface)", borderLeft: "1px solid var(--border)",
          zIndex: 200, display: "flex", flexDirection: "column",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}>
          <div style={{
            display: "flex", alignItems: "flex-start", justifyContent: "space-between",
            padding: "14px 16px 12px", borderBottom: "1px solid var(--border)",
            background: "var(--surface-2)",
          }}>
            <div>
              <div style={{ fontSize: 9, fontFamily: "monospace", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                {kindLabel} · Inspector
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>{title}</div>
            </div>
            <button onClick={() => setInspected(null)} style={{
              fontSize: 15, color: "var(--muted)", background: "none", border: "none",
              cursor: "pointer", padding: "2px 6px", borderRadius: 3, lineHeight: 1,
              flexShrink: 0, marginLeft: 8,
            }}>✕</button>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "14px 16px" }}>
            {renderInspectorBody()}
          </div>
        </aside>
      )}
    </>
  );
}
