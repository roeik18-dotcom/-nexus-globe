/**
 * CanonicalBrainPanel — Brain's PRIMARY product surface (Visual Delivery
 * pass; Phase 5 originally).
 *
 * Renders Brain's own derived narrative over the SAME shared Person/Value
 * runtime state Hub and Dynamics resolve — same `subject`, same
 * `findDomainStatesForSubject` records, same `buildPersonInstance`/
 * `buildValueDomainInstance`, same `ActionLifecycleSummary` handed down by
 * `page.tsx`. Phase 5's acceptance ("Brain resolves the exact same state
 * version as Hub + Dynamics") is why this component takes `lifecycle` as a
 * prop instead of re-reading it: one state, three readings of it.
 *
 * Six sections, in the order a reader actually needs them:
 *
 *   WHAT CHANGED   real Actions this subject owns, and their real state
 *   WHY / HYPOTHESES   two columns that never merge — `why_it_changed`
 *                  holds only verified causal statements; `hypotheses`
 *                  holds only markers traced to a real CanonicalRef whose
 *                  own `mapping_basis` says INFERRED or whose
 *                  `conflict_status` is OPEN. A hypothesis is never
 *                  promoted to a reason by proximity, and the two are
 *                  visually and structurally distinct here for exactly
 *                  that reason (`brainDerivation.ts`'s own contract).
 *   EVIDENCE       only VERIFIED/CLAIMED OutcomeVerification statements
 *   UNKNOWN        the real gaps, stated — never rendered as an empty
 *                  success and never omitted because it is unflattering
 *   LEARNING       real Learning records reached ONLY through
 *                  `effect.learnings` (never chronology), split by
 *                  `state_prime` vs `no_update` with the real reason
 *   NEXT ACTION    the rule's output over the above, badged STATIC
 *
 * Every section carries a provenance badge from the one shared vocabulary
 * (`shell/provenance.tsx`). A section with no real rows badges UNKNOWN
 * rather than CANON — "we looked and canon has nothing" and "canon has
 * something" must not look alike.
 *
 * This component performs exactly one read of its own (the
 * `findDomainStatesForSubject` that `CanonicalSlicePanel` already needs)
 * plus the pure derivation fold. No Brain-only store.
 */
import { findDomainStatesForSubject } from "@/app/lib/philos/canon/domainStateStoreAccessor";
import type { ActionLifecycleSummary } from "@/app/lib/philos/canon/actionLifecycle";
import { buildBrainDerivation } from "@/app/lib/philos/canonical/brainDerivation";
import { buildPersonInstance, buildValueDomainInstance } from "@/app/lib/philos/canonical/personInstance";
import { buildActivePersonRefs, buildActiveMusicRefs } from "@/app/lib/philos/canonical/activeConfig";
import { MUSIC_CANON_DOMAIN_ID } from "@/app/lib/philos/canonical/musicMasterLoader";
import { HUMAN_CANON_DOMAIN_ID } from "@/app/hub/CanonicalSlicePanel";
import CanonicalSlicePanel from "@/app/hub/CanonicalSlicePanel";
import { ProvenanceBadge, type Provenance } from "@/app/lib/philos/shell/provenance";
import { COLOR, RADIUS, SPACE, TYPE } from "@/app/lib/philos/shell/designTokens";

interface LearningRow {
  key: string;
  label: string;
  meta: string;
  realized: boolean;
}

/**
 * Real Learning rows, reached ONLY through the Effect each Learning
 * actually references (`effect.learnings`) — never "the Learning nearest
 * in time". `state_prime` means the GATE ACCEPTED a caller-proposed
 * candidate — it does NOT mean the loop closed, and no State(t+1) is
 * reached, stored or implied by it (`canon/STATE-TRANSITION-BOUNDARY.md`;
 * `realized` below drives colour only, never a claim of a reached state).
 * `no_update` carries canon's own machine reason for why the gate refused,
 * which is shown verbatim rather than softened.
 */
function learningRows(lifecycle: ActionLifecycleSummary): LearningRow[] {
  return lifecycle.actions.flatMap((a) =>
    a.effects.flatMap((e) =>
      e.learnings.map((l) => ({
        key: l.learning.learning_id,
        label: l.learning.result.kind === "state_prime"
          ? `state_prime — מועמד התקבל בשער מתוך Effect ${e.effect.effect.effect_id} (מועמד בלבד, לא State(t+1))`
          : `no_update — ${l.learning.result.reason}`,
        meta: `${l.learning.update_method} · confidence ${l.learning.confidence.toFixed(2)} · ${l.learning.time.slice(0, 10)}`,
        realized: l.learning.result.kind === "state_prime",
      })),
    ),
  );
}

export default async function CanonicalBrainPanel({ subject, asOf, lifecycle, pendingNeedsForBrain, hasRealObservation }: {
  subject: string; asOf: string; lifecycle: ActionLifecycleSummary;
  pendingNeedsForBrain?: { need_id: string; desired_change: string }[];
  hasRealObservation?: boolean;
}) {
  const domainStates = await findDomainStatesForSubject(subject);
  const personInstance = buildPersonInstance({ subject_id: subject, domain_id: HUMAN_CANON_DOMAIN_ID, records: domainStates, source_kind: "CANON", source_refs: buildActivePersonRefs().refObjects, asOf });
  const musicInstance = buildValueDomainInstance({ subject_id: subject, domain_id: MUSIC_CANON_DOMAIN_ID, records: domainStates, source_kind: "CANON", source_refs: buildActiveMusicRefs().refObjects, asOf });
  const derivation = buildBrainDerivation({
    subject_id: subject, lifecycle, instances: [personInstance, musicInstance],
    pendingNeeds: pendingNeedsForBrain ?? [], hasRealObservation: hasRealObservation ?? false,
  });
  const learnings = learningRows(lifecycle);

  return (
    <section dir="rtl" style={S.band}>
      <header style={S.head}>
        <div>
          <div style={S.eyebrow}>הנגזרת · BRAIN DERIVATION</div>
          <h2 style={S.title}>
            WHAT CHANGED → WHY / HYPOTHESES → EVIDENCE → UNKNOWN → LEARNING → NEXT ACTION
          </h2>
        </div>
        <div style={S.headMeta}>
          <span style={S.chip}>{subject}</span>
          <span style={S.chip}>{asOf.slice(0, 10)}</span>
          <span style={S.chip}>{lifecycle.counts.actions_total} Actions · {lifecycle.counts.effect_verified} מאומתים</span>
        </div>
      </header>

      <div style={S.grid}>
        <Block
          title="WHAT CHANGED"
          provenance={derivation.changes.length > 0 ? "CANON" : "UNKNOWN"}
          // PRIMARY = readable statement; the raw id + real timestamp move to
          // the row's `meta` (secondary weight) rather than leading the line.
          rows={derivation.changes.map((c) => ({
            key: c.action_id,
            text: c.what_changed_label,
            meta: `${c.verification_state} · ${c.action_id} · ${c.recorded_at.slice(0, 16).replace("T", " ")}`,
          }))}
          empty="לא נצפה שינוי אמיתי עדיין"
        />

        {/* WHY and HYPOTHESES share one card ONLY as layout — they are two
            separate lists from two separate fields, with two separate
            provenance badges, and nothing moves between them. */}
        <div style={S.block}>
          <BlockHead title="WHY IT CHANGED" count={derivation.why_it_changed.length} provenance={derivation.why_it_changed.length > 0 ? "CANON" : "UNKNOWN"} />
          {derivation.why_it_changed.length === 0 ? (
            <Empty text="אין סיבה מאומתת עדיין" />
          ) : (
            derivation.why_it_changed.map((w, i) => <Row key={i} text={w} />)
          )}

          <div style={S.divider} />

          {/* RUNTIME hypotheses only (semantic-integrity repair): config
              INFERRED_REVIEW markers are provenance metadata, not claims
              about the subject — they live in CONFIG REVIEW / AUDIT below.
              No mechanism derives a runtime hypothesis from current
              evidence yet, so 0 is the honest count. */}
          <BlockHead title="HYPOTHESES — לא ראיה" count={derivation.hypotheses.length} provenance={derivation.hypotheses.length > 0 ? "STATIC" : "UNKNOWN"} />
          {derivation.hypotheses.length === 0 ? (
            <Empty text="0 — אין השערת ריצה הנגזרת מראיות/מצב נוכחיים; סמני קונפיג אינם השערות (ראה CONFIG REVIEW)" />
          ) : (
            derivation.hypotheses.map((h, i) => <Row key={i} text={h} color="#fbbf24" />)
          )}
        </div>

        <Block
          title="EVIDENCE"
          provenance={derivation.evidence.length > 0 ? "CANON" : "UNKNOWN"}
          rows={derivation.evidence.map((e, i) => ({ key: String(i), text: e }))}
          empty="אין ראיה עדיין"
        />

        <Block
          title="UNKNOWN"
          provenance="UNKNOWN"
          rows={derivation.unknown.map((u, i) => ({ key: String(i), text: u }))}
          empty="אין פערים ידועים"
          color="#8798b8"
        />

        <Block
          title="LEARNING"
          provenance={learnings.length > 0 ? "CANON" : "UNKNOWN"}
          rows={learnings.map((l) => ({ key: l.key, text: l.label, meta: l.meta, color: l.realized ? "#34d399" : "#fbbf24" }))}
          empty={lifecycle.counts.actions_total === 0 ? "אין Action — ולכן אין Learning" : "לא נגזר Learning מאף Effect"}
        />

        <div style={S.block}>
          <BlockHead title="NEXT ACTION" count={derivation.next_action ? 1 : 0} provenance={derivation.next_action ? "STATIC" : "UNKNOWN"} />
          {derivation.next_action ? (
            <>
              <Row text={derivation.next_action.label} color={COLOR.accent} />
              <div style={S.meta}>{derivation.next_action.reason}</div>
            </>
          ) : (
            <Empty text="אין פעולה נדרשת כרגע" />
          )}
        </div>
      </div>

      {/* CONFIG REVIEW / AUDIT — the activated refs' own Source-Lock review
          markers (INFERRED mapping bases, OPEN conflicts). Provenance
          bookkeeping about the CONFIG, never hypotheses about the person. */}
      <details style={{ marginTop: SPACE.md }}>
        <summary style={S.summary}>
          CONFIG REVIEW / AUDIT — סמני provenance של הפניות הקונפיג ({derivation.config_review.length})
        </summary>
        <div style={{ marginTop: 8 }}>
          {derivation.config_review.length === 0 ? (
            <Empty text="אין סמני review על ההפניות המופעלות" />
          ) : (
            derivation.config_review.map((c, i) => <Row key={i} text={c} color="#8798b8" />)
          )}
        </div>
      </details>

      <details style={{ marginTop: SPACE.sm }}>
        <summary style={S.summary}>
          DETAILS / AUDIT — Shared Person/Value state (זהה ל-Hub/Dynamics)
        </summary>
        <div style={{ marginTop: 8 }}>
          <CanonicalSlicePanel subject={subject} asOf={asOf} />
        </div>
      </details>
    </section>
  );
}

function BlockHead({ title, count, provenance }: { title: string; count: number; provenance: Provenance }) {
  return (
    <div style={S.blockHead}>
      <span style={S.blockTitle}>{title} ({count})</span>
      <ProvenanceBadge p={provenance} />
    </div>
  );
}

function Block({
  title, provenance, rows, empty, color,
}: {
  title: string;
  provenance: Provenance;
  rows: { key: string; text: string; meta?: string; color?: string }[];
  empty: string;
  color?: string;
}) {
  return (
    <div style={S.block}>
      <BlockHead title={title} count={rows.length} provenance={provenance} />
      {rows.length === 0 ? <Empty text={empty} /> : rows.map((r) => <Row key={r.key} text={r.text} meta={r.meta} color={r.color ?? color} />)}
    </div>
  );
}

function Row({ text, meta, color }: { text: string; meta?: string; color?: string }) {
  return (
    <div style={{ ...S.row, color: color ?? COLOR.text }}>
      <span style={{ flex: 1 }}>{text}</span>
      {meta ? <span style={S.meta}>{meta}</span> : null}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ ...S.row, fontStyle: "italic", color: "#8798b8" }}>{text}</div>;
}

const S: Record<string, React.CSSProperties> = {
  band: {
    background: "linear-gradient(180deg, rgba(91,156,246,0.07), rgba(11,15,26,0.9))",
    border: `1px solid ${COLOR.borderStrong}`,
    borderRadius: 20,
    padding: `${SPACE.lg}px ${SPACE.lg}px ${SPACE.md}px`,
    marginTop: SPACE.md,
  },
  head: { display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: SPACE.sm, marginBottom: SPACE.md },
  eyebrow: { ...TYPE.micro, color: COLOR.accent, marginBottom: 4 },
  title: { fontSize: 13, fontWeight: 800, margin: 0, color: COLOR.text, direction: "ltr", textAlign: "right" },
  headMeta: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" },
  chip: { fontSize: 9.5, fontWeight: 700, color: COLOR.textDim, border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.pill, padding: "2px 9px", fontFamily: "ui-monospace, monospace" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: SPACE.md },
  block: { border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.md, padding: `${SPACE.sm}px ${SPACE.md}px`, background: "rgba(10,14,23,0.45)" },
  blockHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 },
  blockTitle: { ...TYPE.micro, color: "#8fa3c9", letterSpacing: 1 },
  divider: { borderTop: `1px solid ${COLOR.border}`, margin: `${SPACE.sm}px 0` },
  row: { display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 8px", borderRadius: RADIUS.sm, background: "rgba(90,120,180,0.05)", fontSize: 11.5, marginBottom: 3, lineHeight: 1.45 },
  meta: { color: "#8aa0c8", fontSize: 10 },
  summary: { cursor: "pointer", ...TYPE.micro, color: COLOR.textFaint, padding: "6px 0" },
};
