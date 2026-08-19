/**
 * PersonNowPanel — Phase 8, Hub's primary above-the-fold product surface.
 *
 * Replaces developer/audit-style canonical inventory (still real, still
 * available, just demoted to `CanonicalSlicePanel` inside the collapsed
 * "MORE" section) with a product-shaped summary: PERSON NOW / ACTIVE
 * VALUE-DOMAIN / WHAT CHANGED / OPEN TENSIONS / OPEN NEEDS / NEXT ACTIONS /
 * EVIDENCE / VALUE GROUPS.
 *
 * Every field is read from already-real, already-computed data — this
 * component performs exactly one read of its own
 * (`findDomainStatesForSubject`, the same accessor `CanonicalSlicePanel`
 * already uses) and otherwise composes `buildPersonInstance`/
 * `buildValueDomainInstance`/`buildBrainDerivation` (Phase 4/5, reused
 * verbatim) plus `tensions`/`knownNeeds`/`lifecycle`/`valueGroups` — all
 * passed down from `page.tsx`, which already computed every one of them
 * for the (now secondary) sections below. No second derivation, no new
 * store, no fabricated field.
 *
 * Canonical refs (Human base + each registered domain slot) are shown as
 * resolved, concise semantic
 * summaries (`resolveCanonicalRef` → label + type/function + provenance) —
 * never the raw `SOURCE_TEXT`, matching Phase 4's own structural guarantee
 * that no runtime instance ever carries it.
 */
import { findDomainStatesForSubject } from "@/app/lib/philos/canon/domainStateStoreAccessor";
import { buildPersonInstance, buildValueDomainInstance } from "@/app/lib/philos/canonical/personInstance";
import { buildBrainDerivation } from "@/app/lib/philos/canonical/brainDerivation";
import { resolveCanonicalRef } from "@/app/lib/philos/canonical/canonicalRef";
import { HUMAN_CANON_DOMAIN_ID } from "./CanonicalSlicePanel";
import type { ActionLifecycleSummary } from "@/app/lib/philos/canon/actionLifecycle";
import type { TensionItem } from "@/app/lib/philos/tension";
import type { KnownNeedResult } from "@/app/lib/systemContext";
import type { ValueGroupView } from "@/app/lib/philos/projectValueGroup";
import type { CarryForwardState, ClosingQuestion } from "@/app/lib/philos/dayClosingFusion";
import { STATUS, COLOR, TYPE } from "@/app/lib/philos/shell/designTokens";
import { ProvenanceBadge as ProvBadge, type Provenance } from "@/app/lib/philos/shell/provenance";
import { buildActivePersonRefs, type ActiveConfigSet } from "@/app/lib/philos/canonical/activeConfig";
import { availableDomainConfigs } from "@/app/lib/philos/canonical/domainConfigRegistry";

/**
 * PRIORITIES — an ORDERED reading of the same real backlog already on this
 * panel, under the same priority rule the Next-Action CTA uses everywhere
 * else in this codebase (pending Need > open-loop Action > Tension by
 * severity). It is a RULE over CANON records, not a stored ranking, so it
 * is badged STATIC and each row names the real record it stands for. No
 * new store, no invented ordering key.
 */
function buildPriorities(
  knownNeeds: KnownNeedResult,
  lifecycle: ActionLifecycleSummary,
  tensions: TensionItem[],
): { key: string; label: string; why: string }[] {
  const openLoops = lifecycle.actions.filter((a) => a.verification_state === "no_effect_recorded");
  const bySeverity = [...tensions].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1));
  return [
    ...knownNeeds.needs.map((n) => ({
      key: `need:${n.need.need_id}`,
      label: n.need.desired_change,
      why: `Need פתוח · ${n.need.provenance}`,
    })),
    ...openLoops.map((a) => ({
      key: `action:${a.action.action.action_id}`,
      label: `סגור לולאה: ${a.action.action.type}`,
      why: "Action ללא Effect רשום",
    })),
    ...bySeverity.map((t) => ({
      key: `tension:${t.id}`,
      label: `בדוק Tension: ${t.label}`,
      why: `severity ${t.severity} · ${t.evidence_source}`,
    })),
  ];
}


export default async function PersonNowPanel({
  subject, asOf, tensions, knownNeeds, lifecycle, valueGroups, closingQuestions, carryForward, today,
  pendingNeedsForBrain, hasRealObservation,
}: {
  subject: string;
  asOf: string;
  tensions: TensionItem[];
  knownNeeds: KnownNeedResult;
  lifecycle: ActionLifecycleSummary;
  valueGroups: { view: ValueGroupView; provenance: "REAL" | "DEMO" }[];
  /** The SAME `buildDayClosingQuestions` output `DayCycle` already renders,
   *  computed once in `page.tsx` and passed to both — never a second
   *  question engine. Absent = not computed, stated as UNKNOWN. */
  closingQuestions?: ClosingQuestion[];
  /** The SAME `buildCarryForward` object `DayCycle`/`MissionPicture`
   *  already consume. Absent = not computed, stated as UNKNOWN. */
  carryForward?: CarryForwardState;
  today?: string;
  /** Next-action truth (2026-08-17): the SAME pending needs + observation
   *  existence the Hub CTA uses, so brain.next_action can never go stale. */
  pendingNeedsForBrain?: { need_id: string; desired_change: string }[];
  hasRealObservation?: boolean;
}) {
  const domainStates = await findDomainStatesForSubject(subject);
  // Person + DOMAIN config ACTIVATION — the same mechanical folds every
  // other instance-building call site now uses. Refs only: the config
  // section below renders WHO/WHAT IS KNOWN; `current_state` stays whatever
  // was really observed (UNKNOWN otherwise), never filled from the config.
  const activePerson = buildActivePersonRefs();
  // The domain axis comes from the registry, so this panel names no domain.
  // One card per AVAILABLE slot; each is labelled by its own slot label.
  const domainSlots = availableDomainConfigs();
  const human = buildPersonInstance({ subject_id: subject, domain_id: HUMAN_CANON_DOMAIN_ID, records: domainStates, source_kind: "CANON", source_refs: activePerson.refObjects, asOf });
  const domainViews = domainSlots.map((slot) => ({
    slot,
    config: slot.activeConfig(),
    instance: buildValueDomainInstance({
      subject_id: subject, domain_id: slot.domain_id, records: domainStates,
      source_kind: "CANON", source_refs: slot.activeConfig().refObjects, asOf,
    }),
  }));
  const brain = buildBrainDerivation({
    subject_id: subject, lifecycle, instances: [human, ...domainViews.map((d) => d.instance)],
    pendingNeeds: pendingNeedsForBrain ?? [], hasRealObservation: hasRealObservation ?? false,
  });

  const realGroups = valueGroups.filter((g) => g.provenance === "REAL");
  const demoGroups = valueGroups.filter((g) => g.provenance === "DEMO");
  const priorities = buildPriorities(knownNeeds, lifecycle, tensions);

  return (
    <section dir="rtl" style={S.hero}>
      <div style={S.heroHead}>
        <span style={STATUS_BADGE("real")}>CANON</span>
        <h2 style={S.heroTitle}>Person Now — {subject}</h2>
      </div>

      <div style={S.grid2}>
        <StateCard title="PERSON NOW · Human" instance={human} config={activePerson} configGloss="פרופיל, ממדים ופרמטרים זמינים" />
        {domainViews.map((d) => (
          <StateCard
            key={d.slot.domain_id}
            title={`AVAILABLE DOMAIN · ${d.slot.label_he}`}
            instance={d.instance}
            config={d.config}
            configGloss="קונפיג דומיין — זמין, לא נבחר; אינו מצב חי"
          />
        ))}
      </div>

      <div style={S.sectionRow}>
        <Section provenance="CANON" title={`WHAT CHANGED (${brain.changes.filter((c) => c.what_changed).length + [human, ...domainViews.map((d) => d.instance)].filter((i) => i.changed).length})`}>
          {[human, ...domainViews.map((d) => d.instance)].some((i) => i.changed) || brain.changes.length > 0 ? (
            <>
              {[human, ...domainViews.map((d) => d.instance)].filter((i) => i.changed).map((i) => (
                // A DomainState instance changing means a new READING was
                // recorded — not that a canonical State′ transition occurred
                // (`canon/STATE-TRANSITION-BOUNDARY.md`). The row says so.
                <Row key={i.domain_id} left={`${i.domain_id === HUMAN_CANON_DOMAIN_ID ? "Human" : (availableDomainConfigs().find((d) => d.domain_id === i.domain_id)?.label_he ?? i.domain_id)} — נרשמה קריאת DomainState`} right={i.timestamp} />
              ))}
              {brain.changes.slice(0, 3).map((c) => (
                <Row key={c.action_id} left={c.what_changed_label} right={`${c.verification_state} · ${c.recorded_at.slice(0, 10)}`} />
              ))}
            </>
          ) : (
            <Empty text="לא נצפה שינוי אמיתי מאז הקריאה האחרונה" />
          )}
        </Section>

        <Section provenance="CANON" title={`OPEN TENSIONS (${tensions.length})`}>
          {tensions.length === 0 ? <Empty text="אין Tension פתוח" /> : tensions.slice(0, 4).map((t) => (
            <Row key={t.id} left={t.label} right={t.severity} color={t.severity === "high" ? "#f2635c" : undefined} />
          ))}
        </Section>
      </div>

      <div style={S.sectionRow}>
        <Section provenance="CANON" title={`OPEN NEEDS (${knownNeeds.needs.length})`}>
          {!knownNeeds.checked ? (
            <Empty text={`UNKNOWN — לא נבדק: ${knownNeeds.reason}`} />
          ) : knownNeeds.needs.length === 0 ? (
            <Empty text="אין Need פתוח" />
          ) : knownNeeds.needs.slice(0, 4).map((n) => (
            <Row key={n.need.need_id} left={n.need.desired_change} right={n.need.provenance} />
          ))}
        </Section>

        <Section provenance={brain.next_action ? "STATIC" : "UNKNOWN"} title="NEXT ACTIONS">
          {brain.next_action ? (
            <Row left={brain.next_action.label} right={brain.next_action.reason} color={COLOR.accent} />
          ) : (
            <Empty text="אין פעולה דחופה מזוהה כרגע" />
          )}
        </Section>
      </div>

      {/* PRIORITIES — the ordered reading of the SAME needs/open loops/
          tensions above, under the shared priority rule. STATIC because the
          ORDER is a rule, while every row is a real CANON record. */}
      <Section provenance={priorities.length > 0 ? "STATIC" : "UNKNOWN"} title={`PRIORITIES (${priorities.length})`}>
        {priorities.length === 0 ? (
          <Empty text="אין עדיפות פתוחה — אין Need, לולאה פתוחה או Tension" />
        ) : (
          priorities.slice(0, 5).map((p, i) => (
            <Row key={p.key} left={`${i + 1}. ${p.label}`} right={p.why} color={i === 0 ? COLOR.accent : undefined} />
          ))
        )}
      </Section>

      <Section provenance="CANON" title={`EVIDENCE (${brain.evidence.length})`}>
        {brain.evidence.length === 0 ? <Empty text="אין ראיה עדיין" /> : brain.evidence.slice(0, 3).map((e, i) => (
          <Row key={i} left={e} right="" />
        ))}
        {brain.hypotheses.length > 0 ? (
          <div style={{ marginTop: 6 }}>
            <div style={{ ...TYPE.micro, color: "#fbbf24" }}>HYPOTHESES (לא ראיה)</div>
            {brain.hypotheses.map((h, i) => <Row key={i} left={h} right="" color="#fbbf24" />)}
          </div>
        ) : null}
      </Section>

      {/* DAY CLOSING — the SAME `buildDayClosingQuestions` output `DayCycle`
          renders in full below; here only the count-by-status headline and
          the first open questions, so closing the day is visible without
          opening the audit section. `blocked` questions are counted
          separately, never mixed in with answerable ones. */}
      <Section provenance={closingQuestions ? "STATIC" : "UNKNOWN"} title={`DAY CLOSING${today ? ` · ${today}` : ""}`}>
        {!closingQuestions ? (
          <Empty text="UNKNOWN — לא חושבו שאלות סגירת יום" />
        ) : (
          <>
            <Row
              left={`${closingQuestions.filter((q) => q.status === "open").length} שאלות פתוחות · ${closingQuestions.filter((q) => q.status === "blocked").length} חסומות`}
              right={carryForward ? `${carryForward.open_loop_actions.length} לולאות פתוחות · ${carryForward.reconciliation.length} התאמות` : "carry-forward UNKNOWN"}
            />
            {closingQuestions.filter((q) => q.status === "open").slice(0, 3).map((q) => (
              <Row key={q.id} left={q.text} right={q.question_class} />
            ))}
            {closingQuestions.filter((q) => q.status === "open").length === 0 ? (
              <Empty text="אין שאלה פתוחה לסגירת היום" />
            ) : null}
          </>
        )}
      </Section>

      <Section provenance={valueGroups.length > 0 ? "CANON" : "UNKNOWN"} title={`VALUE GROUPS (${valueGroups.length})`}>
        {valueGroups.length === 0 ? (
          <Empty text="אין חברות בקבוצת ערך מאומתת כרגע" />
        ) : (
          <div style={S.grid2}>
            {realGroups.map(({ view }) => <ValueGroupCard key={view.group_id} view={view} provenance="REAL" openNeeds={knownNeeds.needs.length} openTensions={tensions.length} nextActionLabel={brain.next_action?.label ?? null} />)}
            {demoGroups.map(({ view }) => <ValueGroupCard key={view.group_id} view={view} provenance="DEMO" openNeeds={0} openTensions={0} nextActionLabel={null} />)}
          </div>
        )}
      </Section>
    </section>
  );
}

/**
 * StateCard — the CONFIG-vs-NOW split the activation pass is for. Two
 * visually separate zones so a reader can always distinguish:
 *   CONFIG (ידוע)  — the activated canonical reference set: who/what this
 *                    person/domain IS per the Source Lock. CANON badge,
 *                    grouped by the lock's own TYPE words, sample labels
 *                    resolved via `resolveCanonicalRef` (SOURCE_TEXT-free).
 *   NOW (עכשיו)    — only real observed DomainState. UNKNOWN when none
 *                    exists — NEVER filled from the config zone above.
 */
function StateCard({ title, instance, config, configGloss }: {
  title: string;
  instance: { current_state: { parameter_id: string; level: number; confidence: number; observed_at: string }[]; changed: boolean; confidence: number; timestamp: string; source_refs: string[] };
  config: ActiveConfigSet;
  configGloss: string;
}) {
  return (
    <div style={S.stateCard}>
      <div style={{ ...S.stateCardTitle, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span>{title}</span>
        <ProvBadge p={instance.current_state.length > 0 ? "CANON" : "UNKNOWN"} />
      </div>

      {/* zone 1 — WHO/CONFIG IS KNOWN */}
      <div style={S.zoneHead}>
        <span style={S.zoneLabel}>מוכר · CONFIG ({config.refs.length} refs)</span>
        <ProvBadge p={config.refs.length > 0 ? "CANON" : "UNKNOWN"} />
      </div>
      <div style={S.zoneGloss}>{configGloss}</div>
      {config.refs.length === 0 ? (
        <Empty text="לא הופעלו הפניות קנוניות" />
      ) : (
        Object.entries(config.by_type).map(([type, refs]) => {
          const first = resolveCanonicalRef(refs[0]);
          return (
            <div key={type} style={S.row}>
              <span>{type} ({refs.length})</span>
              <span style={S.meta}>
                {first.status === "resolved" ? first.label : refs[0]}
                {refs.length > 1 ? ` · +${refs.length - 1}` : ""}
              </span>
            </div>
          );
        })
      )}

      {/* zone 2 — WHAT IS HAPPENING NOW (real observation only) */}
      <div style={{ ...S.zoneHead, marginTop: 8 }}>
        <span style={S.zoneLabel}>עכשיו · CURRENT STATE</span>
        <ProvBadge p={instance.current_state.length > 0 ? "CANON" : "UNKNOWN"} />
      </div>
      {instance.current_state.length === 0 ? (
        <Empty text="UNKNOWN — אין תצפית אמיתית; הקונפיג למעלה אינו הופך למצב נוכחי" />
      ) : (
        instance.current_state.map((s) => (
          <div key={s.parameter_id} style={S.row}>
            <span>{s.parameter_id}</span>
            <span style={S.meta}>level {s.level} · confidence {s.confidence}</span>
          </div>
        ))
      )}
      <div style={{ ...TYPE.micro, color: COLOR.textFaint, marginTop: 6 }}>
        changed: {String(instance.changed)} · {instance.timestamp}
      </div>
    </div>
  );
}

function ValueGroupCard({ view, provenance, openNeeds, openTensions, nextActionLabel }: {
  view: ValueGroupView; provenance: "REAL" | "DEMO";
  openNeeds?: number; openTensions?: number; nextActionLabel?: string | null;
}) {
  const lastVerified = view.impact.find((i) => i.verified);
  return (
    <div style={{ ...S.stateCard, opacity: provenance === "DEMO" ? 0.72 : 1 }}>
      <div style={S.stateCardTitle}>
        {view.name} <span style={STATUS_BADGE(provenance === "REAL" ? "real" : "demo")}>{provenance}</span>
      </div>
      {/* GROUP-NOW (operational-groups pass): why relevant, open need,
          tension, latest verified effect, next action — this viewer's
          groups only (page.tsx already filters by real membership). */}
      <div style={S.row}><span>למה רלוונטי עכשיו</span><span style={S.meta}>חברות אמיתית · MEMBER_OF{provenance === "DEMO" ? " (DEMO)" : ""}</span></div>
      <div style={S.row}><span>Need פתוח</span><span style={S.meta}>{openNeeds ?? 0}</span></div>
      <div style={S.row}><span>Tension פתוח</span><span style={S.meta}>{openTensions ?? 0}</span></div>
      <div style={S.row}><span>Effect אחרון מאומת</span><span style={S.meta}>{lastVerified ? lastVerified.statement.slice(0, 46) : "אין — UNKNOWN"}</span></div>
      <div style={S.row}><span>פעולה הבאה</span><span style={S.meta}>{nextActionLabel ?? "אין פעולה נגזרת"}</span></div>
      <div style={S.row}><span>ערך מרכזי</span><span style={S.meta}>{view.central_value}</span></div>
      <div style={S.row}><span>חברים</span><span style={S.meta}>{view.members.length}</span></div>
      <div style={S.row}><span>תקציב זמין</span><span style={S.meta}>{view.budget.available}</span></div>
      <div style={S.row}><span>Impact מאומת</span><span style={S.meta}>{view.impact.filter((i) => i.verified).length} / {view.impact.length}</span></div>
      <div style={S.row}><span>פעילות היום</span><span style={S.meta}>{view.today.length}</span></div>
    </div>
  );
}

function Section({ title, provenance, children }: { title: string; provenance: Provenance; children: React.ReactNode }) {
  return (
    <div style={S.section}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <span style={{ ...S.sectionTitle, marginBottom: 0 }}>{title}</span>
        <ProvBadge p={provenance} />
      </div>
      {children}
    </div>
  );
}

function Row({ left, right, color }: { left: string; right: string; color?: string }) {
  return (
    <div style={{ ...S.row, color: color ?? undefined }}>
      <span style={{ flex: 1 }}>{left}</span>
      {right ? <span style={S.meta}>{right}</span> : null}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ ...S.row, fontStyle: "italic", color: COLOR.textFaint }}>{text}</div>;
}

function STATUS_BADGE(kind: "real" | "demo"): React.CSSProperties {
  const s = STATUS[kind];
  return { fontSize: 9.5, fontWeight: 800, padding: "1px 7px", borderRadius: 999, background: s.bg, border: `1px solid ${s.border}`, color: s.text, marginInlineStart: 8 };
}

const S: Record<string, React.CSSProperties> = {
  hero: { background: "linear-gradient(180deg, rgba(52,211,153,0.06), rgba(18,24,38,0.85))", border: "1px solid rgba(52,211,153,0.35)", borderRadius: 18, padding: "18px 20px", marginBottom: 16 },
  heroHead: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 },
  heroTitle: { fontSize: 18, fontWeight: 800, margin: 0, color: "#f2f6fc" },
  grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 },
  sectionRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginTop: 12 },
  section: { border: "1px solid rgba(90,120,180,0.18)", borderRadius: 12, padding: "10px 12px", marginTop: 12 },
  sectionTitle: { fontSize: 10.5, fontWeight: 800, letterSpacing: 1, color: "#8fa3c9", marginBottom: 6, textTransform: "uppercase" },
  stateCard: { border: "1px solid rgba(90,120,180,0.22)", borderRadius: 12, padding: "10px 12px", background: "rgba(10,14,23,0.4)" },
  stateCardTitle: { fontSize: 12.5, fontWeight: 700, color: "#dbe6f6", marginBottom: 6 },
  refChip: { fontSize: 9.5, color: "#8fa3c9", border: "1px solid rgba(90,120,180,0.25)", borderRadius: 999, padding: "2px 8px" },
  zoneHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4, paddingTop: 6, borderTop: "1px solid rgba(120,150,220,0.16)" },
  zoneLabel: { fontSize: 10, fontWeight: 800, letterSpacing: 0.8, color: "#8fa3c9", textTransform: "uppercase" as const },
  zoneGloss: { fontSize: 9.5, color: "#5a6f96", marginBottom: 3 },
  row: { display: "flex", justifyContent: "space-between", gap: 8, padding: "3px 0", fontSize: 12 },
  meta: { color: "#8aa0c8", fontSize: 11 },
};
