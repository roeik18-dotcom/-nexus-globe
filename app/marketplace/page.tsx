import path from "path";
import { readJsonStore } from "@/app/lib/json-store";
import type { Mission } from "@/app/lib/mission/schema";
import type { Gap, GapSeverity } from "@/app/lib/gap/schema";
import type { Value } from "@/app/lib/value/schema";
import type { Capability } from "@/app/lib/capability/schema";
import type { ValueCapabilityRelation } from "@/app/lib/value-capability-relation/schema";
import type { Provider } from "@/app/lib/provider/schema";
import type { ProviderCapabilityRelation } from "@/app/lib/provider-capability-relation/schema";

export const metadata = { title: "Marketplace — Philos" };

const DATA = path.join(process.cwd(), "data");

const SEVERITY: Record<GapSeverity, { label: string; bg: string; text: string; border: string }> = {
  critical:    { label: "critical",    bg: "#DA363318", text: "#F85149", border: "#DA363330" },
  significant: { label: "significant", bg: "#D2992218", text: "#E3B341", border: "#D2992230" },
  moderate:    { label: "moderate",    bg: "#58A6FF18", text: "#58A6FF", border: "#58A6FF30" },
  minor:       { label: "minor",       bg: "#30363D",   text: "#7D8590", border: "#30363D"   },
};

const DOMAIN_COLOR: Record<string, string> = {
  Finance:    "#D29922",
  Operations: "#388BFD",
  Marketing:  "#3FB950",
  Design:     "#F472B6",
  Social:     "#9E6EE6",
  Epistemic:  "#79C0FF",
};

export default function MarketplacePage() {
  const missions    = readJsonStore<Mission>                   (path.join(DATA, "missions.json"));
  const gaps        = readJsonStore<Gap>                       (path.join(DATA, "gaps.json"));
  const values      = readJsonStore<Value>                     (path.join(DATA, "values.json"));
  const capabilities = readJsonStore<Capability>               (path.join(DATA, "capabilities.json"));
  const vcRelations  = readJsonStore<ValueCapabilityRelation>  (path.join(DATA, "value-capability-relations.json"));
  const providers    = readJsonStore<Provider>                 (path.join(DATA, "providers.json"));
  const pcRelations  = readJsonStore<ProviderCapabilityRelation>(path.join(DATA, "provider-capability-relations.json"));

  // ── Lookup maps ─────────────────────────────────────────────────────────────
  const gapById        = new Map(gaps.map        (g => [g.id, g]));
  const valueById      = new Map(values.map      (v => [v.id, v]));
  const capabilityById = new Map(capabilities.map(c => [c.id, c]));
  const providerById   = new Map(providers.map   (p => [p.id, p]));

  // value → capability IDs
  const capIdsByValueId = new Map<string, string[]>();
  for (const vcr of vcRelations) {
    const arr = capIdsByValueId.get(vcr.valueId) ?? [];
    if (!arr.includes(vcr.capabilityId)) arr.push(vcr.capabilityId);
    capIdsByValueId.set(vcr.valueId, arr);
  }

  // capability → providers (deduped)
  const provsByCapId = new Map<string, Provider[]>();
  for (const pcr of pcRelations) {
    const prov = providerById.get(pcr.providerId);
    if (!prov) continue;
    const arr = provsByCapId.get(pcr.capabilityId) ?? [];
    if (!arr.some(p => p.id === prov.id)) arr.push(prov);
    provsByCapId.set(pcr.capabilityId, arr);
  }

  // For a gap: unique capabilities (deduplicated) + which required values address each
  function gapCoverage(gap: Gap) {
    const reqValueIds = gap.requiredValues.map(r => r.valueId);
    const seen = new Set<string>();
    const items: Array<{
      capability:      Capability;
      coveredByValues: Value[];
      providers:       Provider[];
    }> = [];
    for (const vid of reqValueIds) {
      for (const capId of capIdsByValueId.get(vid) ?? []) {
        if (seen.has(capId)) {
          // append this value to the existing item
          const item = items.find(i => i.capability.id === capId);
          const val  = valueById.get(vid);
          if (item && val && !item.coveredByValues.some(v => v.id === vid)) {
            item.coveredByValues.push(val);
          }
          continue;
        }
        seen.add(capId);
        const cap = capabilityById.get(capId);
        if (!cap) continue;
        const val = valueById.get(vid);
        items.push({
          capability:      cap,
          coveredByValues: val ? [val] : [],
          providers:       provsByCapId.get(capId) ?? [],
        });
      }
    }
    return items;
  }

  const mission = missions[0];
  if (!mission) return <div style={{ padding: 40 }}>No mission data.</div>;

  const missionGaps = mission.gaps
    .map(ref => gapById.get(ref.gapId))
    .filter((g): g is Gap => g !== undefined);

  const coveredCapIds = new Set(pcRelations.map(r => r.capabilityId));
  const selectedForCount = pcRelations.filter(r => r.relationType === "selected_for").length;

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
      `}</style>

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
        </div>

        {/* ── Header ── */}
        <header style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.4px", margin: 0 }}>
              Marketplace
            </h1>
            <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--muted)" }}>
              taxonomic coverage · read-only · no write-path
            </span>
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
            <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Mission
            </span>
            <span style={{
              fontSize: 10, padding: "1px 6px", borderRadius: 3,
              background: "#3FB95015", color: "#3FB950", border: "1px solid #3FB95028",
            }}>
              {mission.state.status}
            </span>
            <span style={{ fontSize: 10, color: "var(--muted)" }}>{mission.context.domain}</span>
          </div>
          <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 14px", lineHeight: 1.6, maxWidth: 720 }}>
            {mission.context.statement}
          </p>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {[
              { n: missionGaps.length,       label: "Gaps",              color: "#D29922"        },
              { n: coveredCapIds.size,        label: `/ ${capabilities.length} Capabilities`,
                                                                          color: "#F472B6"        },
              { n: providers.length,          label: "Example Providers", color: "#FB923C"        },
              { n: selectedForCount,          label: "selected_for",      color: "var(--muted)"  },
            ].map(s => (
              <div key={s.label} style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.n}</span>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Chain header ── */}
        <div style={{
          marginBottom: 16, display: "flex", alignItems: "center", gap: 6,
          fontSize: 11, fontFamily: "monospace",
        }}>
          {["Mission", "Gap", "Value", "Capability", "Provider"].map((node, i, arr) => (
            <span key={node} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "var(--text)" }}>{node}</span>
              {i < arr.length - 1 && <span style={{ color: "var(--muted)" }}>→</span>}
            </span>
          ))}
          <span style={{
            marginLeft: "auto", fontSize: 10, color: "#3FB950",
            padding: "1px 6px", borderRadius: 3,
            background: "#3FB95012", border: "1px solid #3FB95025",
          }}>
            live
          </span>
        </div>

        {/* ── Gap sections ── */}
        <div style={{ display: "grid", gap: 12 }}>
          {missionGaps.map(gap => {
            const sev    = gap.state.severity ?? "moderate";
            const sevCfg = SEVERITY[sev];
            const domCol = DOMAIN_COLOR[gap.context.domain ?? ""] ?? "#7D8590";
            const items  = gapCoverage(gap);

            return (
              <section key={gap.id} style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 8, overflow: "hidden",
              }}>

                {/* Gap header */}
                <div style={{
                  padding: "12px 18px 10px",
                  borderBottom: "1px solid var(--border)",
                  background: "var(--surface-2)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                    <span style={{
                      fontSize: 10, padding: "2px 7px", borderRadius: 3, fontFamily: "monospace",
                      background: sevCfg.bg, color: sevCfg.text, border: `1px solid ${sevCfg.border}`,
                    }}>
                      {sevCfg.label}
                    </span>
                    <span style={{
                      fontSize: 10, padding: "2px 7px", borderRadius: 3,
                      background: `${domCol}15`, color: domCol, border: `1px solid ${domCol}28`,
                    }}>
                      {gap.context.domain}
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

                {/* Coverage rows */}
                <div style={{ padding: "14px 18px", display: "grid", gap: 10 }}>
                  {items.length === 0
                    ? <span style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>No capability coverage mapped.</span>
                    : items.map(item => (
                      <div key={item.capability.id} style={{
                        display: "grid",
                        gridTemplateColumns: "160px 16px minmax(140px,1fr) 16px minmax(160px,1fr)",
                        gap: 0, alignItems: "start",
                      }}>

                        {/* Values column */}
                        <div style={{ paddingRight: 8 }}>
                          <div style={{ fontSize: 9, color: "var(--muted)", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
                            values
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {item.coveredByValues.map(v => (
                              <span key={v.id} style={{
                                fontSize: 10, padding: "2px 7px", borderRadius: 3,
                                background: "#3FB95015", color: "#3FB950", border: "1px solid #3FB95028",
                              }}>
                                {v.context.label}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Arrow */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 18, color: "var(--muted)", fontSize: 11 }}>→</div>

                        {/* Capability column */}
                        <div style={{ paddingRight: 8 }}>
                          <div style={{ fontSize: 9, color: "var(--muted)", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>
                            capability
                          </div>
                          <span style={{
                            display: "inline-block", fontSize: 11, padding: "3px 9px", borderRadius: 4,
                            fontWeight: 500,
                            background: "#F472B615", color: "#F472B6", border: "1px solid #F472B628",
                          }}>
                            {item.capability.context.label}
                          </span>
                          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
                            {item.capability.context.domain}
                            {item.capability.context.maturity ? ` · ${item.capability.context.maturity}` : ""}
                          </div>
                        </div>

                        {/* Arrow */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 18, color: "var(--muted)", fontSize: 11 }}>→</div>

                        {/* Providers column */}
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                            <span style={{ fontSize: 9, color: "var(--muted)", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                              example providers
                            </span>
                            <span style={{
                              fontSize: 8, padding: "1px 5px", borderRadius: 2, fontFamily: "monospace",
                              background: "#30363D", color: "var(--muted)",
                            }}>
                              can_deliver
                            </span>
                          </div>
                          {item.providers.length === 0
                            ? <span style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>—</span>
                            : (
                              <>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                  {item.providers.map(prov => (
                                    <span key={prov.id} style={{
                                      fontSize: 11, padding: "3px 9px", borderRadius: 4, fontWeight: 500,
                                      background: "#FB923C15", color: "#FB923C", border: "1px solid #FB923C28",
                                    }}>
                                      {prov.context.label}
                                    </span>
                                  ))}
                                </div>
                                <div style={{ fontSize: 9, color: "var(--muted)", fontStyle: "italic", marginTop: 4 }}>
                                  No selection made · not engaged · not evaluated
                                </div>
                              </>
                            )
                          }
                        </div>

                      </div>
                    ))
                  }
                </div>

              </section>
            );
          })}
        </div>

        {/* ── Footer ── */}
        <div style={{
          marginTop: 36, padding: "10px 16px",
          background: "var(--surface-2)", borderRadius: 6,
          fontSize: 11, color: "var(--muted)", fontFamily: "monospace", lineHeight: 1.6,
        }}>
          Live · data/missions.json · data/gaps.json · data/values.json · data/capabilities.json
          &nbsp;· data/value-capability-relations.json · data/providers.json · data/provider-capability-relations.json
          <br />
          Relation type: <code>can_deliver</code> only · <code>selected_for</code>: 0 · write-path: not enabled
        </div>

      </main>
    </>
  );
}
