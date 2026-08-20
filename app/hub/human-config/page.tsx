/**
 * Real Human Config browser — CONFIG FAMILY (Human) → DOMAIN (real Section)
 * → DIMENSION (real Heading) → PARAMETER (real Canonical_ID) → SOURCE
 * ITEMS, read live from the real Dropbox master workbook via
 * `masterUnitsSource.ts`. See that module's own header for the full
 * read-only/no-copy discipline.
 *
 * The structure browser below shows STRUCTURE only, still — no canon
 * Observation ties to a Canonical_ID, and this page cannot read the
 * DomainState backbone's live parameter *state* into its own hierarchy
 * without conflating "what could be measured" with "what was measured"
 * (SOURCE STRUCTURE ≠ ANSWER ≠ OBSERVATION ≠ LIVE STATE,
 * PHILOS-PRODUCT-MASTER-LEDGER.md §23).
 *
 * State-fusion backbone pass: the two forms above the structure browser
 * are the real acquisition path this page was previously missing — see
 * `CreateHumanDomainStateForm.tsx`/`CreateValueDomainStateForm.tsx` and
 * `app/lib/philos/canon/domainStateFormAction.ts`. Real state now exists
 * where a real human input creates it; the structure browser's own
 * "UNKNOWN for every real subject" framing stays accurate for every
 * parameter that has never had a real reading recorded.
 */
import { connection } from "next/server";
import { resolveViewerContextSemantics } from "@/app/lib/philos/context/resolveViewerContextSemantics";
import SignOutButton from "@/app/signin/SignOutButton";
import { loadHumanConfigSource } from "@/app/lib/philos/humanConfig/masterUnitsSource";
import {
  buildCanonicalConcepts,
  buildDimensionCoverage,
  buildHumanConfigHierarchy,
  buildHumanConfigSummary,
  buildParameterDetail,
  classifyUnits,
  humanDomainUnits,
} from "@/app/lib/philos/humanConfig/humanConfigHierarchy";
import { SystemShell } from "@/app/lib/philos/shell/SystemShell";
import { resolveViewerContext } from "@/app/lib/philos/identity/viewerContext";
import { resolveShellIdentityLink } from "@/app/lib/philos/community/resolveShellIdentityLink";
import HumanConfigView from "./HumanConfigView";
import CreateHumanDomainStateForm from "./CreateHumanDomainStateForm";
import CreateValueDomainStateForm from "./CreateValueDomainStateForm";
import CreateDomainStateLearningForm, { type DomainStateParameterOption } from "./CreateDomainStateLearningForm";
import HumanConfigPrototype from "./HumanConfigPrototype";
import { HUMAN_TEMPERAMENT_DOMAIN_ID } from "./CreateHumanDomainStateForm";
import { findDomainStatesForSubject } from "@/app/lib/philos/canon/domainStateStoreAccessor";
import { buildDomainStateTimeline } from "@/app/lib/philos/canon/domainStateQuery";
import { loadActions } from "@/app/lib/philos/canon/actionStoreAccessor";
import { loadEffects } from "@/app/lib/philos/canon/effectStoreAccessor";
import { TEMPERAMENT_DIMENSIONS } from "@/app/lib/philos/humanConfig/temperamentDimensions";

export const metadata = { title: "Philos — Human Config" };

export default async function HumanConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const viewer = await resolveViewerContext();
  /* THE ONE semantic context — at component scope so both render branches
     use the same result. */
  const semanticContext = await resolveViewerContextSemantics(viewer);
  await connection();
  const params = await searchParams;
  const section = typeof params.section === "string" ? params.section : undefined;
  const heading = typeof params.heading === "string" ? params.heading : undefined;
  const filter = typeof params.filter === "string" ? params.filter : undefined;
  const parameter = typeof params.parameter === "string" ? params.parameter : undefined;
  const view = typeof params.view === "string" ? params.view : undefined;

  const identityLink = await resolveShellIdentityLink();

  // Visual-checkpoint prototype only — production view below (no `view`
  // param) is completely unaffected by this branch. See
  // `HumanConfigPrototype.tsx`'s own header.
  if (view === "prototype") {
    const myDomainStates = await findDomainStatesForSubject(viewer.subject_id);
    const parameters = TEMPERAMENT_DIMENSIONS.map((dimension) => {
      const timeline = buildDomainStateTimeline(myDomainStates, viewer.subject_id, HUMAN_TEMPERAMENT_DOMAIN_ID, dimension.parameter_id);
      const latest = timeline[timeline.length - 1] ?? null;
      const evidenceCount = timeline.filter((t) => t.evidence && t.evidence.trim().length > 0).length;
      return { dimension, latest, evidenceCount, changed: timeline.length > 1 };
    });
  return (
      <div style={{ minHeight: "100vh", background: "#0b0f1a" }}>
        <div style={{ padding: "12px 20px 0" }}>
          <SystemShell
          viewerContext={semanticContext}
          signOut={<SignOutButton />} surface="hub" purpose="Human Config — prototype תצוגה ראשונה" subject={viewer.subject_id} identityLink={identityLink} />
        </div>
        <HumanConfigPrototype subjectId={viewer.subject_id} parameters={parameters} />
      </div>
    );
  }

  const source = await loadHumanConfigSource();

  // State-fusion backbone — the real Learning trigger's three real
  // option lists. `parameterOptions` intentionally only includes
  // (domain_id, parameter_id) pairs with an ALREADY-REAL prior
  // DomainState for this subject — "select ONLY legitimate compatible
  // records," honored by construction, not a client-side re-check of
  // the real server-side gate.
  const myDomainStates = await findDomainStatesForSubject(viewer.subject_id);
  const latestByKey = new Map<string, (typeof myDomainStates)[number]>();
  for (const r of myDomainStates) {
    const key = `${r.state.domain_id}::${r.state.parameter_id}`;
    const existing = latestByKey.get(key);
    if (!existing || r.state.observed_at > existing.state.observed_at) latestByKey.set(key, r);
  }
  const temperamentLabel = new Map(TEMPERAMENT_DIMENSIONS.map((d) => [d.parameter_id, d.label_he]));
  const parameterOptions: DomainStateParameterOption[] = [...latestByKey.values()].map((r) => ({
    domain_id: r.state.domain_id,
    parameter_id: r.state.parameter_id,
    label: `${r.state.domain_id === "human_temperament" ? (temperamentLabel.get(r.state.parameter_id) ?? r.state.parameter_id) : r.state.parameter_id} (${r.state.domain_id})`,
    current_level: r.state.level,
    current_observed_at: r.state.observed_at,
  }));

  const [myActions, myEffects] = await Promise.all([loadActions().catch(() => []), loadEffects().catch(() => [])]);
  const actionOptions = myActions
    .filter((a) => a.action.owner === viewer.subject_id)
    .map((a) => ({ action_id: a.action.action_id, label: `${a.action.type} · ${a.action.reversibility} (${a.action.action_id.slice(0, 8)}…)` }));
  const effectOptions = myEffects
    .filter((e) => e.effect.subject === viewer.subject_id)
    .map((e) => ({ effect_id: e.effect.effect_id, label: `${e.effect.claimed_outcome.statement} (${e.effect.effect_id.slice(0, 8)}…)` }));

  return (
    <div style={{ minHeight: "100vh", background: "#0b0f1a" }}>
      <div style={{ padding: "12px 20px 0" }}>
        <SystemShell
          viewerContext={semanticContext}
          signOut={<SignOutButton />} surface="hub" purpose="Human Config אמיתי — מבנה מקור, לא מצב חי." subject={viewer.subject_id} identityLink={identityLink} />
      </div>
      <div dir="rtl" style={{ padding: "0 20px" }}>
        <CreateHumanDomainStateForm />
        <CreateValueDomainStateForm />
        <CreateDomainStateLearningForm parameterOptions={parameterOptions} actionOptions={actionOptions} effectOptions={effectOptions} />
      </div>
      {!source ? (
        <div dir="rtl" style={{ padding: 24, color: "#e6ebf5" }}>
          <h1 style={{ fontSize: 16 }}>Human Config — לא זמין</h1>
          <p style={{ color: "#8fa3c9", maxWidth: 640, lineHeight: 1.7 }}>
            קובץ המקור האמיתי (MASTER-PRODUCTION xlsx) לא נמצא במיקום הדרופבוקס הצפוי. לא הומצא תוכן חלופי.
          </p>
        </div>
      ) : (
        (() => {
          const humanUnits = humanDomainUnits(source.units);
          const classified = classifyUnits(humanUnits, source.reviewQueue);
          const hierarchy = buildHumanConfigHierarchy(classified);
          const summary = buildHumanConfigSummary({
            allUnits: source.units,
            classifiedHuman: classified,
            collisionAudit: source.collisionAudit,
            coverage: source.coverage,
          });
          const concepts = buildCanonicalConcepts(classified);
          const dimensionCoverage = buildDimensionCoverage(hierarchy);
          const selectedParameterDetail = parameter
            ? (() => {
                const concept = concepts.find((c) => c.canonicalId === parameter);
                return concept ? buildParameterDetail(concept, source.sourceFileName) : undefined;
              })()
            : undefined;
          return (
            <HumanConfigView
              subjectId={viewer.subject_id}
              sourceFileName={source.sourceFileName}
              summary={summary}
              hierarchy={hierarchy}
              concepts={concepts}
              reviewQueueCount={source.reviewQueue.length}
              collisionAudit={source.collisionAudit}
              selectedSection={section}
              selectedHeading={heading}
              filter={filter}
              selectedParameterId={parameter}
              selectedParameterDetail={selectedParameterDetail}
              dimensionCoverage={dimensionCoverage}
            />
          );
        })()
      )}
    </div>
  );
}
