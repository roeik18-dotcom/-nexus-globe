import type { Mission } from "@/app/lib/mission/schema";
import type { Gap } from "@/app/lib/gap/schema";
import type { Value } from "@/app/lib/value/schema";
import type { Capability } from "@/app/lib/capability/schema";
import type { Provider } from "@/app/lib/provider/schema";
import type { ValueCapabilityRelation } from "@/app/lib/value-capability-relation/schema";
import type { ProviderCapabilityRelation } from "@/app/lib/provider-capability-relation/schema";

export type ExplainStep =
  | { kind: "mission_gap";         mission: Mission;    gap: Gap }
  | { kind: "gap_value";           gap: Gap;            value: Value }
  | { kind: "value_capability";    value: Value;        vcr: ValueCapabilityRelation;        capability: Capability }
  | { kind: "capability_provider"; capability: Capability; pcr: ProviderCapabilityRelation; provider: Provider };

export type ExplainPath = ExplainStep[];

/**
 * Pure traversal: all canonical chains from `mission` to a target Capability or Provider.
 *
 * Determinism contract: given the same input arrays in the same order, this function
 * always returns the same paths in the same order. Ordering follows array iteration
 * (Gap index in mission.gaps[], Value index in gap.requiredValues[], VCR position in
 * vcRelations[], PCR position in pcRelations[]) — no Map iteration controls output order.
 *
 * Both VCR relationType values (can_address, required_for) are included; each path
 * carries the canonical relationType so callers can display it without filtering.
 */
export function computeExplainPaths(
  mission: Mission,
  targetId: string,
  targetKind: "capability" | "provider",
  gaps: Gap[],
  values: Value[],
  capabilities: Capability[],
  providers: Provider[],
  vcRelations: ValueCapabilityRelation[],
  pcRelations: ProviderCapabilityRelation[],
): ExplainPath[] {
  // Lookup Maps — for O(1) resolution only. Output order is governed by the
  // for-loops below, not by Map iteration.
  const gapById        = new Map(gaps.map(g        => [g.id, g]));
  const valueById      = new Map(values.map(v      => [v.id, v]));
  const capabilityById = new Map(capabilities.map(c => [c.id, c]));
  const providerById   = new Map(providers.map(p   => [p.id, p]));

  // Index VCRs and PCRs by their left-hand key, preserving array insertion order.
  const vcrsByValueId = new Map<string, ValueCapabilityRelation[]>();
  for (const vcr of vcRelations) {
    const list = vcrsByValueId.get(vcr.valueId) ?? [];
    list.push(vcr);
    vcrsByValueId.set(vcr.valueId, list);
  }

  const pcrsByCapId = new Map<string, ProviderCapabilityRelation[]>();
  for (const pcr of pcRelations) {
    const list = pcrsByCapId.get(pcr.capabilityId) ?? [];
    list.push(pcr);
    pcrsByCapId.set(pcr.capabilityId, list);
  }

  const paths: ExplainPath[] = [];

  for (const gapRef of mission.gaps) {
    const gap = gapById.get(gapRef.gapId);
    if (!gap) continue;

    for (const valueRef of gap.requiredValues) {
      const value = valueById.get(valueRef.valueId);
      if (!value) continue;

      for (const vcr of (vcrsByValueId.get(value.id) ?? [])) {
        const capability = capabilityById.get(vcr.capabilityId);
        if (!capability) continue;

        if (targetKind === "capability") {
          if (capability.id !== targetId) continue;
          paths.push([
            { kind: "mission_gap",      mission,             gap },
            { kind: "gap_value",        gap,                 value },
            { kind: "value_capability", value, vcr,          capability },
          ]);
        } else {
          for (const pcr of (pcrsByCapId.get(capability.id) ?? [])) {
            const provider = providerById.get(pcr.providerId);
            if (!provider || provider.id !== targetId) continue;
            paths.push([
              { kind: "mission_gap",         mission,    gap },
              { kind: "gap_value",           gap,        value },
              { kind: "value_capability",    value, vcr, capability },
              { kind: "capability_provider", capability, pcr, provider },
            ]);
          }
        }
      }
    }
  }

  return paths;
}
