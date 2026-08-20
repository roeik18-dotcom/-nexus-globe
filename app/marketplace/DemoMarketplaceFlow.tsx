/**
 * DemoMarketplaceFlow — the full NEED ↔ RESOURCE/OFFER → MATCH → ACTION →
 * EFFECT chain, rendered from `demoMarketplaceScenario.ts` (real canon
 * schemas, real canon functions, never persisted — see that file's own
 * header). Clearly labeled DEMO throughout; never presented as a real
 * match for a real subject.
 *
 * Demonstrates what would close the SAME real, still-open DEMO community
 * gap (`demo_alloc_compost`, `[DEMO] קרן חדשנות ירוקה`, still `"voting"` in
 * `demoCommunities.ts` — untouched) — this component does not claim that
 * gap is now resolved; it shows the mechanism that could resolve it.
 */
import {
  COMMITMENT_STAGE_LABEL,
  DEMO_EFFECT,
  DEMO_NEED,
  DEMO_OFFER,
  DEMO_SCENARIO_COMMUNITY_ID,
  DEMO_SCENARIO_RELATED_ALLOCATION,
  DEMO_TRANSFER,
  buildDemoDelta,
  buildDemoLearning,
  buildDemoMatchResult,
  deriveCommitmentStage,
} from "@/app/lib/philos/canon/demoMarketplaceScenario";
import { buildDemoMarketplaceLinks } from "@/app/lib/philos/bridge/linkRegistry";
import { buildDemoMarketplaceSpatialLinks, spatialContextForCommunity } from "@/app/lib/philos/bridge/spatialContext";
import { projectValueGroup } from "@/app/lib/philos/projectValueGroup";
import { DEMO_GREEN_INNOVATION_EVENTS, DEMO_GREEN_INNOVATION_ID, DEMO_GREEN_INNOVATION_TODAY } from "@/app/lib/philos/demoCommunities";

export default function DemoMarketplaceFlow() {
  const match = buildDemoMatchResult();
  const learning = buildDemoLearning();
  const delta = buildDemoDelta();
  const commitmentStage = deriveCommitmentStage();
  const bridgeLinks = buildDemoMarketplaceLinks();
  const greenInnovation = projectValueGroup(DEMO_GREEN_INNOVATION_EVENTS, DEMO_GREEN_INNOVATION_ID, DEMO_GREEN_INNOVATION_TODAY)!;
  const spatialLinks = buildDemoMarketplaceSpatialLinks(greenInnovation);
  const regionCtx = spatialContextForCommunity(greenInnovation, "DEMO");

  return (
    <section dir="rtl" style={S.card}>
      <div style={S.head}>
        <span style={S.badge}>DEMO</span>
        <h2 style={S.title}>מסלול מלא — Need ↔ Offer → Match → Action → Effect</h2>
        {/* Community <-> Marketplace connectivity, completed both directions:
            Community already links here (CommunityCommandTerminal.tsx); this
            is the real link back, using the SAME imported community id — no
            hardcoded string, no drift risk between the two files. */}
        <a href={`/hub/community?community=${DEMO_SCENARIO_COMMUNITY_ID}`} style={S.communityLink}>← חזרה לקהילה</a>
      </div>
      <div style={S.note}>
        מדגים איך היה נסגר הצורך האמיתי (עדיין פתוח) של הקצאת "{DEMO_SCENARIO_RELATED_ALLOCATION}" ב-[DEMO] קרן חדשנות ירוקה —
        לא טוען שהוא נסגר בפועל. כל שדה כאן עובר דרך הפונקציות הקנוניות האמיתיות (evaluateMatch, validateTransferAgainstMatch,
        deriveLearning, computeStateDelta) — ולא נכתב לאף מאגר אמיתי.
      </div>

      {/* COMMITMENT — a match does not automatically become an Action. This
          status is read, not asserted: it reports the furthest real stage
          this scenario's own objects (match/transfer/effect/learning)
          actually reached (see deriveCommitmentStage's own comment on why
          "agreed"/"resource_committed" aren't independently observable
          without a canon Agreement primitive that doesn't exist yet). */}
      <div style={S.commitmentRow}>
        <span style={S.commitmentLabel}>COMMITMENT</span>
        <span style={S.commitmentValue}>{COMMITMENT_STAGE_LABEL[commitmentStage]}</span>
      </div>

      {/* BRIDGE — the SAME typed relations the Canonical Cross-Entity Link
          Registry exposes to Community/Planet, read here directly from
          demoMarketplaceScenario's own real object graph (see
          buildDemoMarketplaceLinks) — not a separate description. */}
      <div style={S.bridgeStrip}>
        {bridgeLinks.map((l) => (
          <span key={l.link_id} style={S.bridgeChip}>{l.relation}</span>
        ))}
        {regionCtx ? <span style={S.regionChip}>📍 {regionCtx.label} (DEMO)</span> : null}
      </div>
      {/* Spatial foundation: NEED/OFFER/ACTION/EFFECT placed in the SAME
          region as demo_vg_green_innovation itself (spatialContext.ts) —
          location is one matching dimension, never a required field: the
          match above already succeeded using CAN/WANTS/ALLOWED/APPROPRIATE/
          AVAILABLE/CONSENT alone, with no spatial criterion involved. */}
      <div style={S.bridgeStrip}>
        {spatialLinks.map((l) => (
          <span key={l.link_id} style={S.bridgeChip}>{l.relation}</span>
        ))}
      </div>

      <div style={S.chain}>
        <Stage label="NEED" color="#fbbf24">
          <div>{DEMO_NEED.desired_change}</div>
          <Meta>{DEMO_NEED.subject} · {DEMO_NEED.need_id}</Meta>
        </Stage>
        <Arrow />
        <Stage label="OFFER" color="#5b9cf6">
          <div>{DEMO_OFFER.available_resource}</div>
          <Meta>{DEMO_OFFER.source} · resource_type: {DEMO_OFFER.resource_type}</Meta>
        </Stage>
        <Arrow />
        <Stage label="MATCH" color={match.decision === "permitted" ? "#34d399" : "#f2635c"}>
          <div>{match.decision}</div>
          <Meta>{match.rejection_reasons.length > 0 ? match.rejection_reasons.join(", ") : "כל השערים עברו"}</Meta>
        </Stage>
        <Arrow />
        <Stage label="ACTION" color="#f2635c">
          <div>{DEMO_TRANSFER.resource}</div>
          <Meta>{DEMO_TRANSFER.action_id} · {DEMO_TRANSFER.mechanism_scope}</Meta>
        </Stage>
        <Arrow />
        <Stage label="EFFECT" color="#34d399">
          <div>{DEMO_EFFECT.verified_outcome?.statement}</div>
          <Meta>verified_outcome · {DEMO_EFFECT.verified_outcome?.verifier_type}</Meta>
        </Stage>
        <Arrow />
        <Stage label="LEARNING" color={learning.result.kind === "state_prime" ? "#34d399" : "#6c86b5"}>
          <div>{learning.result.kind}</div>
          <Meta>{delta ? `Δ level +${delta.level_delta} · Δ stability +${delta.stability_delta.toFixed(2)}` : "—"}</Meta>
        </Stage>
      </div>

      <div style={S.note}>
        זהו תרחיש DEMO עצמאי — לא נכתב ל-actions.jsonl/effects.jsonl האמיתיים, ולכן אינו מופיע (עדיין) כ-Effect אמיתי ב-
        <a href={`/dynamics?community=${DEMO_SCENARIO_COMMUNITY_ID}`} style={{ color: "#5b9cf6" }}> Dynamics של הקהילה</a>,
        שם ההקצאה עדיין מוצגת בכנות כ"לא ידוע — אין Effect רשום". זהו בדיוק ה-honest gap שהמסלול הזה מדגים איך אפשר לסגור.
      </div>
    </section>
  );
}

function Stage({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ ...S.stage, borderColor: color, background: `${color}12` }}>
      <div style={{ ...S.stageLabel, color }}>{label}</div>
      <div style={S.stageBody}>{children}</div>
    </div>
  );
}

function Arrow() {
  return <div style={S.arrow}>→</div>;
}

function Meta({ children }: { children: React.ReactNode }) {
  return <div style={S.meta}>{children}</div>;
}

const S: Record<string, React.CSSProperties> = {
  card: { background: "rgba(18,24,38,0.7)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 16, padding: "16px 18px", margin: "16px 20px" },
  head: { display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" },
  communityLink: { marginRight: "auto", fontSize: 13, color: "#fbbf24", textDecoration: "none" },
  badge: { fontSize: 12, fontWeight: 800, padding: "2px 8px", borderRadius: 6, border: "1px solid #fbbf2455", color: "#fbbf24", fontFamily: "ui-monospace, monospace" },
  title: { fontSize: 14, fontWeight: 700, margin: 0, color: "#f0f4fc" },
  note: { fontSize: 13, color: "#8fa3c9", lineHeight: 1.7, marginBottom: 12, maxWidth: 900 },
  commitmentRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "6px 10px", borderRadius: 8, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)", width: "fit-content" },
  commitmentLabel: { fontSize: 12, fontWeight: 800, letterSpacing: 1, color: "#6c86b5" },
  commitmentValue: { fontSize: 13, fontWeight: 700, color: "#34d399" },
  bridgeStrip: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  bridgeChip: { fontSize: 12, fontWeight: 700, letterSpacing: 0.3, padding: "3px 8px", borderRadius: 5, color: "#a78bfa", border: "1px solid rgba(167,139,250,0.35)", background: "rgba(167,139,250,0.06)" },

  chain: { display: "flex", alignItems: "stretch", gap: 4, overflowX: "auto", paddingBottom: 4 },
  stage: { border: "1px solid", borderRadius: 10, padding: "8px 12px", minWidth: 150, flex: "0 0 auto" },
  stageLabel: { fontSize: 12, fontWeight: 800, letterSpacing: 1 },
  stageBody: { fontSize: 13, color: "#dbe6f6", marginTop: 4, lineHeight: 1.4 },
  meta: { fontSize: 12, color: "#6c86b5", marginTop: 4 },
  arrow: { display: "flex", alignItems: "center", color: "#6c86b5", fontSize: 16, padding: "0 2px" },
};
