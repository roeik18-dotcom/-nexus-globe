import path from "path";
import { readJsonStore } from "@/app/lib/json-store";
import type { Mission } from "@/app/lib/mission/schema";
import type { Gap } from "@/app/lib/gap/schema";
import type { Value } from "@/app/lib/value/schema";
import type { Capability } from "@/app/lib/capability/schema";
import type { ValueCapabilityRelation } from "@/app/lib/value-capability-relation/schema";
import type { Provider } from "@/app/lib/provider/schema";
import type { ProviderCapabilityRelation } from "@/app/lib/provider-capability-relation/schema";
import LivingPlanet, { type PNode, type PEdge } from "./LivingPlanet";

export const metadata = { title: "Philos — Living Planet" };

const DATA = path.join(process.cwd(), "data");
const rid = (r: unknown): string | null =>
  typeof r === "string" ? r
    : r && typeof r === "object"
      ? ((r as Record<string, string>).id ?? (r as Record<string, string>).gapId
        ?? (r as Record<string, string>).valueId ?? null)
      : null;
const short = (s: string, n = 46) => (s && s.length > n ? s.slice(0, n) + "…" : s || "");

export default function PlanetPage() {
  const missions     = readJsonStore<Mission>                    (path.join(DATA, "missions.json"));
  const gaps         = readJsonStore<Gap>                        (path.join(DATA, "gaps.json"));
  const values       = readJsonStore<Value>                      (path.join(DATA, "values.json"));
  const capabilities = readJsonStore<Capability>                 (path.join(DATA, "capabilities.json"));
  const vcr          = readJsonStore<ValueCapabilityRelation>   (path.join(DATA, "value-capability-relations.json"));
  const providers    = readJsonStore<Provider>                   (path.join(DATA, "providers.json"));
  const pcr          = readJsonStore<ProviderCapabilityRelation>(path.join(DATA, "provider-capability-relations.json"));

  const nodes: PNode[] = [
    ...missions.map(m => ({ id: m.id, type: "mission", label: short(m.context?.statement ?? m.id) })),
    ...gaps.map(g => ({ id: g.id, type: "gap", label: short(g.context?.description ?? g.id) })),
    ...values.map(v => ({ id: v.id, type: "value", label: v.context?.label ?? v.id })),
    ...capabilities.map(c => ({ id: c.id, type: "capability", label: c.context?.label ?? c.id })),
    ...providers.map(p => ({ id: p.id, type: "provider", label: p.context?.label ?? p.id })),
  ];

  const edges: PEdge[] = [];
  for (const m of missions) for (const g of (m.gaps ?? [])) { const t = rid(g); if (t) edges.push({ s: m.id, t }); }
  for (const g of gaps) for (const v of (g.requiredValues ?? [])) { const t = rid(v); if (t) edges.push({ s: g.id, t }); }
  for (const r of vcr) edges.push({ s: r.valueId, t: r.capabilityId });
  for (const r of pcr) edges.push({ s: r.providerId, t: r.capabilityId });

  const domains = new Set<string>();
  for (const e of [...missions, ...gaps, ...values, ...capabilities, ...providers])
    if ((e as { context?: { domain?: string } }).context?.domain) domains.add((e as { context: { domain: string } }).context.domain);

  const counts = {
    entities: nodes.length,
    missions: missions.filter(m => (m.state?.status ?? "active") === "active").length,
    relationships: edges.length,
    communities: domains.size,
  };

  const sampleEvents = [
    ...missions.slice(0, 4).map(m => `Mission active · ${short(m.context?.statement ?? m.id, 40)}`),
    ...providers.slice(0, 4).map(p => `Provider · ${p.context?.label ?? p.id}`),
    ...vcr.slice(0, 4).map(r => {
      const v = values.find(x => x.id === r.valueId)?.context?.label ?? "value";
      const c = capabilities.find(x => x.id === r.capabilityId)?.context?.label ?? "capability";
      return `Relationship · ${v} ↔ ${c}`;
    }),
    ...gaps.slice(0, 3).map(g => `Gap · ${short(g.context?.description ?? g.id, 40)}`),
  ].filter(Boolean);

  if (nodes.length === 0) return <div style={{ padding: 40, fontFamily: "system-ui" }}>No world data.</div>;

  return <LivingPlanet nodes={nodes} edges={edges} counts={counts} sampleEvents={sampleEvents} />;
}
