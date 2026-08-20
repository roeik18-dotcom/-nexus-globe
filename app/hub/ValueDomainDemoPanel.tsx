/**
 * ValueDomainDemoPanel — visible-product proof of the generic Value-Domain
 * Config engine (`valueDomainConfig.ts`), using the DEMO Music reference
 * instance (`demoMusicDomain.ts`). Always renders, independent of the
 * real selected subject — same pattern as `DemoMarketplaceFlow.tsx` on
 * `/marketplace`: a self-contained, clearly-labeled DEMO demonstration
 * sitting alongside the real (subject-scoped) Day Cycle content above it,
 * never merged into it.
 */
import { buildCarryForward, buildNextDayOpening } from "@/app/lib/philos/dayClosingFusion";
import { buildDemoMusicConfig, DEMO_MUSIC_SUBJECT } from "@/app/lib/philos/valueDomain/demoMusicDomain";
import { buildHypothesisHumanValueRelation } from "@/app/lib/philos/mission/demoMissionValues";
import { buildUnknownTemperamentReadings } from "@/app/lib/philos/humanConfig/temperamentDimensions";
import type { OrientationCore } from "@/app/lib/philos/orientationCore";

const EMPTY_LIFECYCLE = { subject: DEMO_MUSIC_SUBJECT, actions: [], counts: { actions_total: 0, no_effect_recorded: 0, effect_claimed_only: 0, effect_verified: 0, learnings_with_state_prime: 0 } };

export default function ValueDomainDemoPanel({ today }: { today: string }) {
  const config = buildDemoMusicConfig(today);
  const core: OrientationCore = { subject: DEMO_MUSIC_SUBJECT };
  const carryForward = buildCarryForward({
    subject: DEMO_MUSIC_SUBJECT, today, core, lifecycle: EMPTY_LIFECYCLE,
    pendingNeeds: [], tensions: [], todaysActions: [], realizedLearningsToday: 0, bridgeRegistry: [],
    valueDomain: { config, subject: DEMO_MUSIC_SUBJECT },
  });
  const opening = buildNextDayOpening(carryForward);
  if (carryForward.value_domain_state === "unknown_blocked") return null;
  const state = carryForward.value_domain_state;
  const relation = buildHypothesisHumanValueRelation();
  const temperament = buildUnknownTemperamentReadings();

  return (
    <section dir="rtl" style={S.card}>
      <div style={S.head}>
        <span style={S.badge}>DEMO</span>
        <h3 style={S.title}>Value Domain — מנוע Config גנרי (מדגים עם {state.domain.label})</h3>
      </div>
      <div style={S.note}>
        מדגים את החוזה הגנרי — DOMAIN → PARAMETER → STATE/GAP/CAPABILITY → ACTION → RESULT → EVIDENCE → UPDATED STATE — עם מוזיקה כמופע ייחוס יחיד, בר-החלפה. אף שדה כאן אינו אמיתי לשום אדם.
      </div>

      <div style={S.grid}>
        {state.summary.map((p) => (
          <div key={p.parameter_id} style={S.paramCard}>
            <div style={S.paramLabel}>{p.parameter_label}</div>
            <div style={S.paramLevel}>{p.current_level === null ? "לא ידוע" : `level ${p.current_level}`}</div>
            {p.capabilities.map((c) => (
              <div key={c.capability_id} style={S.tag}>Capability: {c.label} · {c.status}</div>
            ))}
            {p.gaps.map((g) => (
              <div key={g.gap_id} style={{ ...S.tag, color: "#f2635c" }}>Gap: {g.label}</div>
            ))}
          </div>
        ))}
      </div>

      {config.needs && config.needs.length > 0 ? (
        <>
          <div style={S.subHead}>NEED — {config.needs.length} (canon Need מלא, ראה valueDomainConfig.ts)</div>
          {config.needs.map((n) => (
            <div key={n.need.need_id} style={S.row}>
              <span>{n.need.desired_change}</span>
              <span style={S.meta}>{n.need.provenance} · expiry {n.need.expiry}</span>
            </div>
          ))}
        </>
      ) : null}

      {config.constraints && config.constraints.length > 0 ? (
        <>
          <div style={S.subHead}>CONSTRAINT — {config.constraints.length}</div>
          {config.constraints.map((c) => (
            <div key={c.constraint_id} style={S.row}>
              <span>{c.statement}</span>
            </div>
          ))}
        </>
      ) : null}

      <div style={S.subHead}>תוצאות Action היום ({config.actionResults.length})</div>
      {config.actionResults.map((r) => (
        <div key={r.result_id} style={S.row}>
          <span>{r.expected_result}</span>
          <span style={S.meta}>{r.observed_result ?? "טרם נצפה"}</span>
          <span style={{ color: r.accepted ? "#34d399" : "#6c86b5" }}>{r.accepted ? "התקבל" : "לא ידוע"}</span>
        </div>
      ))}

      <div style={S.subHead}>Day Opening (N+1) — נוצר מ-Carry-Forward הזה</div>
      <div style={S.row}><span>מה השתנה ב-Value Domain?</span><span style={S.meta}>{opening.what_changed_in_value_domain}</span></div>
      <div style={S.row}><span>Gap פעיל</span><span style={S.meta}>{opening.active_domain_gap}</span></div>
      <div style={S.row}><span>שינוי Capability</span><span style={S.meta}>{opening.capability_change}</span></div>

      {/* TEMPERAMENT DIMENSIONS — 7 real parameters, real Canonical_ID
          each (§23 workbook, Section "תודעה, הכרה ואדם"), objective
          LOW↔HIGH-style ranges. Position is genuinely unknown for EVERY
          subject — no real Observation exists for any of these
          Canonical_IDs yet. Same Parameter IDs Dynamics renders below
          (same shared component, not a second model). */}
      <div style={S.subHead}>ממדי מזג — Temperament Dimensions (מקור אמיתי, מצב לא ידוע)</div>
      <div style={S.grid}>
        {temperament.map((t) => (
          <div key={t.range.parameter_id} style={S.paramCard}>
            <div style={S.paramLabel}>{t.range.label} · {t.range.label_he}</div>
            <div style={S.tag}>{t.range.low} ↔ {t.range.high}</div>
            <a href={`/hub/human-config?section=${encodeURIComponent(t.range.section)}&heading=${encodeURIComponent(t.range.heading)}`} style={S.sourceLink}>
              {t.range.canonical_id} · position: לא ידוע →
            </a>
          </div>
        ))}
      </div>

      <div style={S.subHead}>Human × Value — קשר טיפוסי יחיד ({relation.type.toUpperCase()}, DEMO, hypothesis — לא מוסק)</div>
      <div style={S.row}>
        <span>{relation.human_parameter_label} ↔ {state.domain.label}</span>
        <span style={S.meta}>{relation.statement}</span>
      </div>
      <div style={S.note}>{relation.evidence}</div>
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  card: { background: "rgba(18,24,38,0.7)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 16, padding: "16px 18px", marginTop: 16 },
  head: { display: "flex", alignItems: "center", gap: 10, marginBottom: 6 },
  badge: { fontSize: 12, fontWeight: 800, padding: "2px 8px", borderRadius: 6, border: "1px solid #fbbf2455", color: "#fbbf24", fontFamily: "ui-monospace, monospace" },
  title: { fontSize: 13.5, fontWeight: 700, margin: 0, color: "#f0f4fc" },
  note: { fontSize: 13, color: "#8fa3c9", lineHeight: 1.7, marginBottom: 10, maxWidth: 900 },
  subHead: { fontSize: 13, fontWeight: 700, color: "#8fa3c9", marginTop: 10, marginBottom: 4 },

  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 8 },
  paramCard: { border: "1px solid rgba(90,120,180,0.2)", borderRadius: 8, padding: "8px 10px" },
  paramLabel: { fontSize: 13, fontWeight: 700, color: "#dbe6f6" },
  paramLevel: { fontSize: 13, color: "#5aa6ff", marginTop: 2 },
  tag: { fontSize: 12, color: "#8fa3c9", marginTop: 4 },
  sourceLink: { display: "block", fontSize: 12, color: "#5b9cf6", textDecoration: "none", marginTop: 4 },

  row: { display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 8px", borderRadius: 6, background: "rgba(90,120,180,0.05)", fontSize: 13, marginBottom: 3 },
  meta: { color: "#8aa0c8" },
};
