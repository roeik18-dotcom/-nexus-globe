import type { Mission } from "../lib/mission/schema";
import type { Gap } from "../lib/gap/schema";
import type { ValueCapabilityRelation } from "../lib/value-capability-relation/schema";
import type { ProviderCapabilityRelation } from "../lib/provider-capability-relation/schema";

// ── Output shape ──────────────────────────────────────────────────────────────
//
// All coefficients are copied verbatim from WorldView.tsx — no new weights.
// missionHealthPct = graphIntegrityPct * 0.55 + (validationPass ? 40 : 0) + (activeProvIds.size > 0 ? 5 : 0)

export interface CoverageMetrics {
  // Traversal intermediates — consumed by WorldView for graph rendering and opacity helpers
  activeValueIds:    Set<string>;
  contextualVcrs:    ValueCapabilityRelation[];   // required_for, mission-scoped
  modeVcrs:          ValueCapabilityRelation[];   // mode-aware: same as contextualVcrs in contextual; can_address in taxonomic
  activeCapIds:      Set<string>;
  activeProvIds:     Set<string>;
  cascadeVcrs:       ValueCapabilityRelation[];   // active subset for edge rendering
  cascadePcrs:       ProviderCapabilityRelation[];
  capsWithProvider:  Set<string>;
  // Coverage metrics
  coveredCapCount:   number;
  uncoveredCapCount: number;
  coveragePct:       number;
  missionGapIds:     Set<string>;
  gapsWithRF:        Set<string | undefined>;
  graphIntegrityPct: number;
  validationPass:    boolean;
  missionHealthPct:  number;
  missionStage:      "Contextual Qualification" | "Initialization";
  evidenceCount:     number;
}

const EMPTY: CoverageMetrics = {
  activeValueIds:    new Set(),
  contextualVcrs:    [],
  modeVcrs:          [],
  activeCapIds:      new Set(),
  activeProvIds:     new Set(),
  cascadeVcrs:       [],
  cascadePcrs:       [],
  capsWithProvider:  new Set(),
  coveredCapCount:   0,
  uncoveredCapCount: 0,
  coveragePct:       0,
  missionGapIds:     new Set(),
  gapsWithRF:        new Set(),
  graphIntegrityPct: 0,
  validationPass:    false,
  missionHealthPct:  0,
  missionStage:      "Initialization",
  evidenceCount:     0,
};

export function computeCoverageMetrics(
  mission:     Pick<Mission, "id" | "gaps"> | null | undefined,
  gapById:     Map<string, Pick<Gap, "requiredValues">>,
  vcRelations: ValueCapabilityRelation[],
  pcRelations: ProviderCapabilityRelation[],
  viewMode:    "contextual" | "taxonomic" = "contextual",
): CoverageMetrics {
  if (!mission) return EMPTY;

  // Active value IDs: Mission.gaps → Gap.requiredValues → Value
  const activeValueIds = new Set<string>(
    (mission.gaps ?? [])
      .flatMap(ref => gapById.get(ref.gapId)?.requiredValues ?? [])
      .map(r => r.valueId)
  );

  // Contextual VCRs: required_for, scoped to this mission
  const contextualVcrs = vcRelations.filter(
    r => r.relationType === "required_for" && r.missionId === mission.id
  );

  // Mode-aware VCR source (contextual vs. taxonomic)
  const modeVcrs = viewMode === "contextual"
    ? contextualVcrs
    : vcRelations.filter(r => r.relationType === "can_address");

  // Active capability and provider sets
  const activeCapIds = new Set<string>(
    modeVcrs.filter(r => activeValueIds.has(r.valueId)).map(r => r.capabilityId)
  );
  const activeProvIds = new Set<string>(
    pcRelations.filter(r => activeCapIds.has(r.capabilityId)).map(r => r.providerId)
  );

  // Edge subsets for graph rendering
  const cascadeVcrs = modeVcrs.filter(
    r => activeValueIds.has(r.valueId) && activeCapIds.has(r.capabilityId)
  );
  const cascadePcrs = pcRelations.filter(
    r => activeCapIds.has(r.capabilityId) && activeProvIds.has(r.providerId)
  );

  // Coverage: active capabilities with at least one provider in PCR
  const capsWithProvider  = new Set(pcRelations.map(r => r.capabilityId));
  const coveredCapCount   = [...activeCapIds].filter(id => capsWithProvider.has(id)).length;
  const uncoveredCapCount = activeCapIds.size - coveredCapCount;
  const coveragePct       = activeCapIds.size > 0
    ? Math.round((coveredCapCount / activeCapIds.size) * 100)
    : 0;

  // Mission integrity: gaps with at least one required_for VCR
  const missionGapIds     = new Set((mission.gaps ?? []).map(r => r.gapId));
  const gapsWithRF        = new Set(contextualVcrs.map(r => r.gapId));
  const graphIntegrityPct = missionGapIds.size > 0
    ? Math.round((gapsWithRF.size / missionGapIds.size) * 100)
    : 0;

  const validationPass   = graphIntegrityPct === 100 && contextualVcrs.length > 0;
  const missionHealthPct = Math.round(
    graphIntegrityPct * 0.55 + (validationPass ? 40 : 0) + (activeProvIds.size > 0 ? 5 : 0)
  );

  const missionStage  = contextualVcrs.length > 0 ? "Contextual Qualification" as const : "Initialization" as const;
  const evidenceCount = contextualVcrs.reduce(
    (n, r) => n + (r.evidence ?? []).filter(e => e.signal !== "Intent").length, 0
  );

  return {
    activeValueIds, contextualVcrs, modeVcrs, activeCapIds, activeProvIds,
    cascadeVcrs, cascadePcrs, capsWithProvider,
    coveredCapCount, uncoveredCapCount, coveragePct,
    missionGapIds, gapsWithRF, graphIntegrityPct, validationPass,
    missionHealthPct, missionStage, evidenceCount,
  };
}
