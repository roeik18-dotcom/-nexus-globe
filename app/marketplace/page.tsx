import path from "path";
import { readJsonStore } from "@/app/lib/json-store";
import type { Mission } from "@/app/lib/mission/schema";
import type { Gap } from "@/app/lib/gap/schema";
import type { Value } from "@/app/lib/value/schema";
import type { Capability } from "@/app/lib/capability/schema";
import type { ValueCapabilityRelation } from "@/app/lib/value-capability-relation/schema";
import type { Provider } from "@/app/lib/provider/schema";
import type { ProviderCapabilityRelation } from "@/app/lib/provider-capability-relation/schema";
import MarketplaceView from "./MarketplaceView";

export const metadata = { title: "Marketplace — Philos" };

const DATA = path.join(process.cwd(), "data");

export default function MarketplacePage() {
  const missions     = readJsonStore<Mission>                    (path.join(DATA, "missions.json"));
  const gaps         = readJsonStore<Gap>                        (path.join(DATA, "gaps.json"));
  const values       = readJsonStore<Value>                      (path.join(DATA, "values.json"));
  const capabilities = readJsonStore<Capability>                 (path.join(DATA, "capabilities.json"));
  const vcRelations  = readJsonStore<ValueCapabilityRelation>   (path.join(DATA, "value-capability-relations.json"));
  const providers    = readJsonStore<Provider>                   (path.join(DATA, "providers.json"));
  const pcRelations  = readJsonStore<ProviderCapabilityRelation>(path.join(DATA, "provider-capability-relations.json"));

  const mission = missions[0];
  if (!mission) {
    return <div style={{ padding: 40, fontFamily: "system-ui" }}>No mission data.</div>;
  }

  const gapById = new Map(gaps.map(g => [g.id, g]));
  const missionGaps = mission.gaps
    .map(ref => gapById.get(ref.gapId))
    .filter((g): g is Gap => g !== undefined);

  return (
    <MarketplaceView
      mission={mission}
      missionGaps={missionGaps}
      values={values}
      capabilities={capabilities}
      providers={providers}
      vcRelations={vcRelations}
      pcRelations={pcRelations}
    />
  );
}
