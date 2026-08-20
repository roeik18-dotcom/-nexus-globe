"use client";

/**
 * BrainV2 — information-architecture rebuild (rejection baseline: obsolete
 * "?" placeholders, flat concentric-ring composition, dead space, clipped
 * content, Action/Effect/Learning appended as a disconnected footer).
 *
 * **Layout choice (engine audit, this pass):** CSS grid/flex for the macro
 * spatial arrangement (Reality | Human | Agency columns; stacked zoom-level
 * sections), inline SVG only where a literal loop/flow shape carries
 * meaning (the Action→Effect→Learning loop, Level 4). `/planet` already
 * owns the one real WebGL/3D primitive in this codebase (`react-globe.gl`,
 * for an actual geographic sphere — not reusable for an abstract human
 * diagram); `/dynamics`/`/nexus` use plain SVG. Introducing a THIRD engine
 * (raw three.js) for Brain would be exactly the "replace technology based
 * on aesthetics alone" this pass's own instruction forbids — CSS grid
 * guarantees no clipping/scaling-driven tiny text at any viewport, which is
 * what the rejection actually named as broken, not the absence of 3D.
 *
 * **Semantic zoom (Level 0–5), one level rendered at a time — never all six
 * simultaneously:**
 *   L0  Human between REALITY (left) and AGENCY (right).
 *   L1  Body/Emotion/Cognition (real, canon-backed) + Id/Ego/Superego
 *       (interpretive layer, no live data source — stated, not hidden).
 *   L2  3 contextual fields + the 6 named vectors (only drawn when real
 *       source/target data exists; the rest are a labeled, honest legend).
 *   L3  State / Gap / Need — Gap ≠ Need; a real Need is shown only when one
 *       is actually persisted for this subject.
 *   L4  The full Action/Effect/Learning loop, spatial and clickable —
 *       replaces the old footer entirely.
 *   L5  The PHILOS_INTERPRETIVE_LENS (10 principles × 2 expressions) — a
 *       reference table, never auto-attached to a real Action (no
 *       classification function exists anywhere in this codebase).
 *
 * Every real record shown here traces to `actionLifecycle.ts`/
 * `orientationCore.ts`/`sharedContext.ts` — this component computes no new
 * fact, it only lays one out spatially.
 */
import { useState } from "react";
import type { OrientationCore } from "@/app/lib/philos/orientationCore";
import type { ActionLifecycleSummary, ActionLifecycleEntry } from "@/app/lib/philos/canon/actionLifecycle";
import type { KnownNeedResult } from "@/app/lib/systemContext";
import type { RealityNode, KnowledgeNode } from "@/app/lib/philos/brainGraph";
import { buildHumanTensions, sortTensions } from "@/app/lib/philos/tension";
import type { NeedRecord } from "@/app/lib/philos/canon/needStore";
import { COLOR, RADIUS, STATUS, TYPE } from "@/app/lib/philos/shell/designTokens";
import {
  HUMAN_DOMAINS,
  REGULATORY_LAYER,
  CONTEXTUAL_FIELDS,
  VECTOR_DEFINITIONS,
  PHILOS_PRINCIPLES,
  PHILOS_INTERPRETIVE_LENS_PROVENANCE,
  PHILOS_LOOP_HE,
  PHILOS_EVALUATION_QUESTIONS_HE,
} from "@/app/lib/philos/brainGraph";

type Level = 0 | 1 | 2 | 3 | 4 | 5 | 6;
const LEVEL_LABEL: Record<Level, string> = {
  0: "L0 · אדם בין מציאות לאפשרות",
  1: "L1 · גוף/רגש/שכל + איד/אגו/סופר־אגו",
  2: "L2 · שדות הקשר + וקטורים",
  3: "L3 · מצב / פער / צורך",
  4: "L4 · Action → Effect → Learning",
  5: "L5 · 10 עקרונות · 20 ביטויים",
  6: "L6 · ערכים · קבוצות ערך",
};

/** Mission B, B5 — real Value/Value-Group context for this subject,
 *  reached ONLY via the real `identityLink.status ===
 *  "VERIFIED_SAME_PERSON"` bridge computed in `page.tsx`. `verified:
 *  false` is the honest, expected state for most canon subjects today —
 *  never backfilled with a guess. */
export interface ValueContext {
  verified: boolean;
  memberships: { group_name: string; central_value: string; status: "REAL" | "DEMO"; member_count: number; verified_effects: number }[];
  tensions?: { id: string; label: string; severity: string }[];
  totalRuntimeValues?: number;
}

export default function BrainV2({
  subject,
  core,
  knownNeeds,
  lifecycle,
  worldEvents,
  knowledge,
  bridgeLinkCount,
  pendingNeeds,
  valueContext,
}: {
  subject: string | undefined;
  core: OrientationCore | undefined;
  knownNeeds: KnownNeedResult;
  lifecycle: ActionLifecycleSummary;
  valueContext: ValueContext;
  /** BATCH 15 — computed server-side in `page.tsx` via the SAME
   *  `needsRequiringAction` (`sharedContext.ts`) Hub/Dynamics already use
   *  for their own NEXT ACTION CTA — never recomputed here, since that
   *  module touches `node:fs` (real store reads) and cannot be imported
   *  into this `"use client"` component. */
  pendingNeeds: NeedRecord[];
  /** Real, system-wide Observations — the LEFT/REALITY column's real "world
   *  event" population when no single subject is selected, or as the wider
   *  backdrop even when one is. */
  worldEvents: RealityNode[];
  knowledge: KnowledgeNode[];
  /** Canonical Cross-Entity Link Registry: real count of typed links found
   *  for this subject (see `app/brain/page.tsx`). Expected to be 0 for a
   *  canon-sourced subject today — canon subjects and legacy Community/
   *  Planet ids are separate id spaces with no real bridge yet. */
  bridgeLinkCount: number;
}) {
  const [level, setLevel] = useState<Level>(0);
  const [focusedActionId, setFocusedActionId] = useState<string | null>(null);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);

  // BATCH 15 — real dead-end fix: Brain showed real orientation/tension/
  // need state on every level but offered zero next-action affordance
  // anywhere. Same computed-CTA logic already established on Hub/
  // Dynamics (priority: pending Need > open-loop Action > Tension > "no
  // Observation yet" > honest "nothing justified") — reused, not
  // reinvented, over the SAME `core`/`lifecycle`/`pendingNeeds` this
  // component already received (`pendingNeeds` computed server-side).
  const openLoopActions = lifecycle.actions.filter((a) => a.verification_state === "no_effect_recorded");
  const tensions = core ? sortTensions(buildHumanTensions(core)) : [];
  const hasAnyObservation = !!(core && (core.G || core.E || core.C));
  const nextAction = pendingNeeds.length > 0
    ? { label: `טפל בצורך: ${pendingNeeds[0].need.desired_change}`, href: "/hub#action-outcomes" }
    : openLoopActions.length > 0
      ? { label: `רשום Effect ל-Action: ${openLoopActions[0].action.action.type}`, href: "/marketplace" }
      : tensions.length > 0
        ? { label: `בדוק Tension: ${tensions[0].label}`, href: subject ? `/dynamics?subject=${encodeURIComponent(subject)}` : "/dynamics" }
        : !hasAnyObservation
          ? { label: "רשום תצפית עצמית ראשונה", href: "/hub#record-observation" }
          : null;

  return (
    <div dir="rtl" style={S.root}>
      <div style={S.topBar}>
        <div style={S.levelTabs}>
          {([0, 1, 2, 3, 4, 5, 6] as Level[]).map((l) => (
            <button key={l} onClick={() => setLevel(l)} style={{ ...S.levelTab, ...(level === l ? S.levelTabActive : {}) }}>
              {LEVEL_LABEL[l]}
            </button>
          ))}
        </div>
        <div style={S.subjectLine}>
          נושא: {subject ?? "לא ידוע — אין Observation אמיתי כלשהו במאגר"}
          <button onClick={() => setKnowledgeOpen((o) => !o)} style={S.knowledgeToggle}>ידע · מקורות</button>
        </div>
        {nextAction ? (
          <a href={nextAction.href} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#02101f", background: `linear-gradient(135deg, ${COLOR.accent}, #34d399)`, textDecoration: "none", borderRadius: RADIUS.pill, padding: "6px 14px" }}>
            <span style={TYPE.micro}>NEXT ACTION</span> {nextAction.label} →
          </a>
        ) : (
          <span style={{ fontSize: 13, color: COLOR.textFaint, fontStyle: "italic" }}>אין פעולה הבאה מוצדקת כרגע.</span>
        )}
      </div>

      {level === 0 && <LevelZero subject={subject} core={core} worldEvents={worldEvents} lifecycle={lifecycle} bridgeLinkCount={bridgeLinkCount} />}
      {level === 1 && <LevelOne core={core} />}
      {level === 2 && <LevelTwo lifecycle={lifecycle} />}
      {level === 3 && <LevelThree core={core} knownNeeds={knownNeeds} />}
      {level === 4 && (
        <LevelFour lifecycle={lifecycle} focusedActionId={focusedActionId} onFocusAction={setFocusedActionId} />
      )}
      {level === 5 && <LevelFive lifecycle={lifecycle} />}
      {level === 6 && <LevelSix valueContext={valueContext} />}

      {knowledgeOpen ? <KnowledgeDrawer knowledge={knowledge} onClose={() => setKnowledgeOpen(false)} /> : null}
    </div>
  );
}

// ── L0 — Human between Reality (left) and Agency (right) ───────────────────

function LevelZero({
  subject, core, worldEvents, lifecycle, bridgeLinkCount,
}: { subject: string | undefined; core: OrientationCore | undefined; worldEvents: RealityNode[]; lifecycle: ActionLifecycleSummary; bridgeLinkCount: number }) {
  const recentWorld = [...worldEvents].sort((a, b) => b.observed_at.localeCompare(a.observed_at)).slice(0, 4);
  const recentActions = [...lifecycle.actions].sort((a, b) => b.action.recorded_at.localeCompare(a.action.recorded_at)).slice(0, 4);

  return (
    <div style={S.threeCol}>
      <Column title="מציאות · REALITY / WORLD" accent="#7f97c2" note="אירועים/מדידות אמיתיים שכבר קרו — Observation קנוני, לא נבחר על ידי האדם.">
        {recentWorld.length === 0 ? (
          <Empty>אין Observation אמיתי במאגר.</Empty>
        ) : (
          recentWorld.map((n) => (
            <Card key={n.id} border="#7f97c2">
              <CardLine label={n.domain} value={`level ${n.level}`} />
              <CardMeta>{n.subject} · {n.observed_at.slice(0, 10)}</CardMeta>
            </Card>
          ))
        )}
        <FlowNote>WORLD EVENT → תפיסה → אדם → אוריינטציה → תגובה מגולמת → השפעה</FlowNote>
      </Column>

      <Column title="אדם · HUMAN" accent="#5b9cf6" center>
        <div style={S.humanCore}>
          <div style={S.humanCircle}>אדם</div>
          <div style={S.humanSub}>{subject ?? "לא נבחר"}</div>
        </div>
        <FlowNote>MOTIVE → ORIENTATION → CHOICE → BODY → ACTION IN REALITY</FlowNote>
        <div style={S.motiveNote}>
          המניע עשוי לנבוע בעיקר מרגש / שכל / איד / אגו / סופר־אגו, או שילוב משוקלל — לא משויך כאן ללא ראיה (ראה L1).
        </div>
        {/* BRIDGE — real, checked: canon subjects and legacy Community/
            Planet person ids are separate id spaces (no shared key), so
            this is expected to read 0 for a canon subject today. Shown as
            an honest check, not hidden. */}
        <div style={S.motiveNote}>
          גשר · קישורים אמיתיים ל-{subject ?? "—"}: {bridgeLinkCount > 0 ? bridgeLinkCount : "0 — canon subjects וזיהויי Community/Planet הם מרחבי מזהים נפרדים"}
        </div>
      </Column>

      <Column title="אפשרות · AGENCY / POSSIBILITY" accent="#f2635c" note="בחירות/פעולות אמיתיות שהאדם ביצע — Action קנוני, בעל consent מפורש.">
        {recentActions.length === 0 ? (
          <Empty>אין Action אמיתי רשום לנושא זה.</Empty>
        ) : (
          recentActions.map((a) => (
            <Card key={a.action.action.action_id} border="#f2635c">
              <CardLine label={a.action.action.type} value={a.action.action.mechanism_scope} />
              <CardMeta>{a.action.action.time.slice(0, 10)} · {a.verification_state}</CardMeta>
            </Card>
          ))
        )}
        <FlowNote>need → רגש/שכל → idea → decision → embodied action → effect</FlowNote>
      </Column>
    </div>
  );
}

// ── L1 — Body/Emotion/Cognition + Id/Ego/Superego ───────────────────────────

function LevelOne({ core }: { core: OrientationCore | undefined }) {
  return (
    <div style={S.stack}>
      <SectionHead>גוף · רגש · שכל — תחומים פונקציונליים (מדידה אמיתית, canon Domain G/E/C)</SectionHead>
      <div style={S.rowWrap}>
        {HUMAN_DOMAINS.map((d) => {
          const mark = core?.[d.canonDomain];
          return (
            <Card key={d.key} border={d.color} wide>
              <CardTitle color={d.color}>{d.label}</CardTitle>
              <div style={{ fontSize: 13, color: "#9fb0d0" }}>{d.detail}</div>
              {mark ? (
                <CardLine label="מדידה אמיתית" value={`level ${mark.level} · stability ${mark.stability}`} />
              ) : (
                <Empty>אין Observation אמיתי לתחום זה.</Empty>
              )}
              <CardMeta>{d.source}</CardMeta>
            </Card>
          );
        })}
      </div>

      <SectionHead>איד · אגו · סופר־אגו — שכבה רגולטורית/פרשנית (פועלת על פני שלושת התחומים, לא תחום נוסף)</SectionHead>
      <div style={S.rowWrap}>
        {REGULATORY_LAYER.map((r) => (
          <Card key={r.key} border={r.color} dashed wide>
            <CardTitle color={r.color}>{r.label}</CardTitle>
            <div style={{ fontSize: 13, color: "#9fb0d0" }}>{r.detail}</div>
            <Empty>{r.source}</Empty>
            {r.humanConfigSection && r.humanConfigHeading ? (
              <a
                href={`/hub/human-config?section=${encodeURIComponent(r.humanConfigSection)}&heading=${encodeURIComponent(r.humanConfigHeading)}`}
                style={{ display: "block", fontSize: 12, color: r.color, marginTop: 4, textDecoration: "none" }}
              >
                → Human Config מקור: {r.humanConfigHeading}
              </a>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── L2 — Contextual fields + vectors ────────────────────────────────────────

function LevelTwo({ lifecycle }: { lifecycle: ActionLifecycleSummary }) {
  const hasStateMovement = lifecycle.counts.learnings_with_state_prime > 0;
  return (
    <div style={S.stack}>
      <SectionHead>3 שדות הקשר (לא תחום, לא וקטור)</SectionHead>
      <div style={S.rowWrap}>
        {CONTEXTUAL_FIELDS.map((f) => (
          <Card key={f.key} border={f.color} wide>
            <CardTitle color={f.color}>{f.label}</CardTitle>
            <div style={{ fontSize: 13, color: "#9fb0d0" }}>{f.detail}</div>
          </Card>
        ))}
      </div>

      <SectionHead>וקטורים — קשתות/זרימה, לעולם לא צמתים</SectionHead>
      <div style={S.rowWrap}>
        {VECTOR_DEFINITIONS.map((v) => {
          const observed = v.key === "v1" || v.key === "v5" ? hasStateMovement : false;
          return (
            <Card key={v.key} border={observed ? "#34d399" : "#3a4d70"} dashed={!observed} wide>
              <CardTitle color={observed ? "#34d399" : "#6c86b5"}>{v.label}</CardTitle>
              <div style={{ fontSize: 13, color: "#9fb0d0" }}>{v.detail}</div>
              <CardMeta>{observed ? "נצפה — יש state_prime אמיתי במאגר" : "UNKNOWN — לא נצפה עדיין"}</CardMeta>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── L3 — State / Gap / Need ──────────────────────────────────────────────────

function LevelThree({ core, knownNeeds }: { core: OrientationCore | undefined; knownNeeds: KnownNeedResult }) {
  // The SAME shared Tension/Priority shape Hub/Community/Dynamics already
  // use (`tension.ts`) — never a Brain-specific deficit computation.
  const tensions = core ? sortTensions(buildHumanTensions(core)) : [];

  return (
    <div style={S.stack}>
      <SectionHead>מצב נוכחי לפי תחום</SectionHead>
      <div style={S.rowWrap}>
        {(["G", "E", "C"] as const).map((d) => {
          const mark = core?.[d];
          return (
            <Card key={d} border="#5b9cf6" wide>
              <CardTitle color="#5b9cf6">{d}</CardTitle>
              {mark ? <CardLine label="level" value={`${mark.level} · stability ${mark.stability}`} /> : <Empty>לא ידוע</Empty>}
            </Card>
          );
        })}
      </div>

      <SectionHead>Tension · אותו אובייקט Hub/Dynamics/Community</SectionHead>
      {tensions.length === 0 ? (
        <Empty>נבדק — אין Tension פתוח.</Empty>
      ) : (
        <div style={S.rowWrap}>
          {tensions.map((t) => (
            <Card key={t.id} border={t.severity === "high" ? "#f2635c" : t.severity === "medium" ? "#fbbf24" : "#8aa0c8"} wide>
              <CardTitle color={t.severity === "high" ? "#f2635c" : "#fbbf24"}>{t.label}</CardTitle>
              <CardLine label="מצב" value={t.current_state} />
              <CardMeta>{t.id}</CardMeta>
            </Card>
          ))}
        </div>
      )}

      <SectionHead>Gap → פרשנות → Need אפשרי (Gap אינו שווה אוטומטית ל-Need)</SectionHead>
      {!knownNeeds.checked ? (
        <Empty>לא ניתן לבדוק — קריאת מאגר הצרכים נכשלה.</Empty>
      ) : knownNeeds.needs.length === 0 ? (
        <Empty>נבדק — אין Need רשום עבור נושא זה. Gap עצמו אינו נמדד ישירות בcanon כיום — אין שדה "Matter/Gap/Time" מפורש, רק Domain/Frame/Level.</Empty>
      ) : (
        <div style={S.rowWrap}>
          {knownNeeds.needs.map((n) => (
            <Card key={n.need.need_id} border="#fbbf24" wide>
              <CardTitle color="#fbbf24">{n.need.desired_change}</CardTitle>
              <CardMeta>{n.need.need_id} · {n.status}</CardMeta>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── L4 — the Action/Effect/Learning loop, spatial + clickable ──────────────

function LevelFour({
  lifecycle, focusedActionId, onFocusAction,
}: { lifecycle: ActionLifecycleSummary; focusedActionId: string | null; onFocusAction: (id: string | null) => void }) {
  const focused = lifecycle.actions.find((a) => a.action.action.action_id === focusedActionId) ?? null;

  return (
    <div style={S.stack}>
      <SectionHead>{PHILOS_LOOP_HE}</SectionHead>
      <div style={S.provenanceNote}>מקור: PHILOS_10_Principles_20_Expressions_HE.docx §2</div>
      {lifecycle.actions.length === 0 ? (
        <Empty>אין Action רשום — הלולאה לא ידועה עבור נושא זה.</Empty>
      ) : (
        <div style={S.loopList}>
          {lifecycle.actions.map((entry) => (
            <LoopRow key={entry.action.action.action_id} entry={entry} focused={focusedActionId === entry.action.action.action_id} onClick={() => onFocusAction(focusedActionId === entry.action.action.action_id ? null : entry.action.action.action_id)} />
          ))}
        </div>
      )}

      {focused ? <ActionDetailPanel entry={focused} /> : <Empty>לחץ על Action כדי להאיר את המסלול המלא ולראות פרטים.</Empty>}
    </div>
  );
}

function LoopRow({ entry, focused, onClick }: { entry: ActionLifecycleEntry; focused: boolean; onClick: () => void }) {
  const effect = entry.effects[0];
  const learning = effect?.learnings[0];
  const stageColor = entry.verification_state === "effect_verified" ? "#34d399" : entry.verification_state === "effect_claimed_only" ? "#fbbf24" : "#6c86b5";
  return (
    <div onClick={onClick} style={{ ...S.loopRow, borderColor: focused ? "#5b9cf6" : "rgba(90,120,180,0.18)", opacity: focused ? 1 : 0.85, cursor: "pointer" }}>
      <LoopStage label="ACTION" value={entry.action.action.type} known color="#f2635c" />
      <LoopArrow open />
      <LoopStage label="EFFECT" value={effect ? "רשום" : "לא ידוע"} known={!!effect} color="#f2a154" />
      <LoopArrow open={!!effect} />
      <LoopStage label="EVIDENCE" value={entry.verification_state === "no_effect_recorded" ? "לא ידוע" : entry.verification_state === "effect_claimed_only" ? "נטען" : "אומת"} known={entry.verification_state !== "no_effect_recorded"} color={stageColor} />
      <LoopArrow open={!!learning} />
      <LoopStage label="LEARNING" value={learning ? (learning.learning.result.kind === "state_prime" ? "state_prime" : "no_update") : "לא ידוע"} known={!!learning} color={learning?.learning.result.kind === "state_prime" ? "#34d399" : "#6c86b5"} />
    </div>
  );
}

function LoopStage({ label, value, known, color }: { label: string; value: string; known: boolean; color: string }) {
  return (
    <div style={{ ...S.loopStage, borderColor: known ? color : "#2a3f66", background: known ? `${color}14` : "transparent", opacity: known ? 1 : 0.6 }}>
      <div style={S.loopStageLabel}>{label}</div>
      <div style={S.loopStageValue}>{value}</div>
    </div>
  );
}

function LoopArrow({ open }: { open: boolean }) {
  return <div style={{ color: open ? "#6c86b5" : "#1e2740", fontSize: 16, padding: "0 2px" }}>→</div>;
}

function ActionDetailPanel({ entry }: { entry: ActionLifecycleEntry }) {
  const effect = entry.effects[0];
  const learning = effect?.learnings[0];
  return (
    <div style={S.detailPanel}>
      <DetailRow label="Action" value={`${entry.action.action.type} · ${entry.action.action.mechanism_scope} · ${entry.action.action.time}`} />
      <DetailRow label="Effect" value={effect ? `${effect.effect.effect.claimed_outcome.statement} (${effect.effect.effect.time})` : "לא ידוע — אין Effect רשום"} />
      <DetailRow label="Affected subject" value={effect?.effect.effect.subject ?? "לא ידוע"} />
      <DetailRow label="Affected relationship/group/system" value="לא ידוע — Effect קנוני אינו נושא group_id/relationship_id" />
      <DetailRow label="Evidence" value={entry.verification_state === "effect_verified" ? "אומת" : entry.verification_state === "effect_claimed_only" ? "נטען בלבד" : "לא ידוע"} />
      <DetailRow label="Principles affected" value="UNKNOWN — לא קיימת פונקציית סיווג עקרונות אמיתית (ראה L5)" />
      <DetailRow label="Learning" value={learning ? (learning.learning.result.kind === "state_prime" ? `state_prime — Δ level ${learning.delta?.level_delta ?? "—"}` : `no_update (${(learning.learning.result as { reason: string }).reason})`) : "לא ידוע"} />
    </div>
  );
}

// ── L5 — 10 principles / 20 expressions ─────────────────────────────────────

// ── L6 — Value / Value-Group context (Mission B, B5) ────────────────────────

function LevelSix({ valueContext }: { valueContext: ValueContext }) {
  if (!valueContext.verified) {
    return (
      <div style={S.stack}>
        <SectionHead>ערכים · קבוצות ערך — PERSON ↔ VALUE ↔ GROUP</SectionHead>
        <Empty>
          אין גשר מאומת (VERIFIED_SAME_PERSON) בין נושא-canon זה למרחב הזהות של Community/Value-Group כיום — לא מוצג קישור מומצא. עבור אל /hub/community לקישור זהות מפורש.
        </Empty>
      </div>
    );
  }
  return (
    <div style={S.stack}>
      <SectionHead>ערכים · קבוצות ערך — {valueContext.memberships.length} חברויות אמיתיות (זהות מאומתת)</SectionHead>
      {valueContext.memberships.length === 0 ? (
        <Empty>0 — זהות מאומתת, אך 0 חברויות קבוצה אמיתיות/DEMO כרגע.</Empty>
      ) : (
        <div style={S.rowWrap}>
          {valueContext.memberships.map((m) => (
            <Card key={m.group_name} border={m.status === "REAL" ? "#34d399" : "#fbbf24"} wide>
              <CardTitle color={m.status === "REAL" ? "#34d399" : "#fbbf24"}>{m.group_name}</CardTitle>
              <CardLine label="central_value" value={m.central_value} />
              <CardMeta>{m.status} · {m.member_count} חברים · {m.verified_effects} Effect מאומת</CardMeta>
            </Card>
          ))}
        </div>
      )}
      <SectionHead>Tension בקבוצות אלה</SectionHead>
      {!valueContext.tensions || valueContext.tensions.length === 0 ? (
        <Empty>0 — אין Tension פתוח בקבוצות אלה כרגע.</Empty>
      ) : (
        <div style={S.rowWrap}>
          {valueContext.tensions.map((t) => (
            <Card key={t.id} border={t.severity === "high" ? "#f2635c" : t.severity === "medium" ? "#fbbf24" : "#8aa0c8"} wide>
              <CardTitle color={t.severity === "high" ? "#f2635c" : "#fbbf24"}>{t.label}</CardTitle>
              <CardMeta>{t.id}</CardMeta>
            </Card>
          ))}
        </div>
      )}
      <div style={{ fontSize: 13, color: "#6c86b5", marginTop: 6 }}>
        {valueContext.totalRuntimeValues ?? 0} ערכים רשומים כיום ביקום הערכים המלא — <a href="/hub/community?mode=universe" style={{ color: "#5b9cf6" }}>צפה ב-VALUE UNIVERSE המלא →</a>
      </div>
    </div>
  );
}

function LevelFive({ lifecycle }: { lifecycle: ActionLifecycleSummary }) {
  return (
    <div style={S.stack}>
      <SectionHead>PHILOS_INTERPRETIVE_LENS — עשרה ממדים אובייקטיביים</SectionHead>
      <div style={S.provenanceNote}>{PHILOS_INTERPRETIVE_LENS_PROVENANCE}</div>
      <div style={S.principleGrid}>
        {PHILOS_PRINCIPLES.map((p) => (
          <Card key={p.key} border="#a78bfa" wide>
            <CardTitle color="#a78bfa">{p.label}</CardTitle>
            <CardLine label="constructive" value={p.constructive} />
            <CardLine label="constrained" value={p.constrained} />
            {/* Historical source term — kept per the terminology-correction
                rule (never delete source wording), but only ever shown
                inside this explicitly labeled lens, never as the live
                label above. */}
            <div style={S.sourceLensNote}>EXTERNAL / INTERPRETIVE SOURCE LENS: {p.sourceLensTerm}</div>
          </Card>
        ))}
      </div>
      <SectionHead>שאלות ההערכה (מקור: §5 של אותו מסמך)</SectionHead>
      <ul style={S.evalList}>
        {PHILOS_EVALUATION_QUESTIONS_HE.map((q) => (
          <li key={q} style={S.evalItem}>{q}</li>
        ))}
      </ul>

      <div style={S.provenanceNote}>
        {lifecycle.actions.length} Action(s) אמיתיים רשומים — לאף אחד מהם אין שיוך עקרון אוטומטי; שיוך כזה הוא UNKNOWN עד שתיבנה פונקציית סיווג אמיתית.
      </div>
    </div>
  );
}

// ── shared primitives ────────────────────────────────────────────────────────

function Column({ title, accent, note, center, children }: { title: string; accent: string; note?: string; center?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ ...S.column, ...(center ? { alignItems: "center", textAlign: "center" } : {}) }}>
      <div style={{ ...S.columnTitle, color: accent }}>{title}</div>
      {note ? <div style={S.columnNote}>{note}</div> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>{children}</div>
    </div>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return <div style={S.sectionHead}>{children}</div>;
}

function Card({ children, border, wide, dashed }: { children: React.ReactNode; border: string; wide?: boolean; dashed?: boolean }) {
  return <div style={{ ...S.card, borderColor: border, ...(wide ? { flex: "1 1 220px" } : {}), ...(dashed ? { borderStyle: "dashed" } : {}) }}>{children}</div>;
}

function CardTitle({ children, color }: { children: React.ReactNode; color: string }) {
  return <div style={{ fontSize: 13.5, fontWeight: 700, color }}>{children}</div>;
}

function CardLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ fontSize: 13, color: "#dbe6f6", marginTop: 4 }}>
      <span style={{ color: "#6c86b5" }}>{label}: </span>{value}
    </div>
  );
}

function CardMeta({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, color: "#6c86b5", marginTop: 4, fontFamily: "ui-monospace, monospace" }}>{children}</div>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, color: "#7b8ca6", fontStyle: "italic" }}>{children}</div>;
}

function FlowNote({ children }: { children: React.ReactNode }) {
  return <div style={S.flowNote}>{children}</div>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 8, fontSize: 13, padding: "4px 0", borderBottom: "1px solid rgba(90,120,180,0.1)" }}>
      <span style={{ color: "#6c86b5", minWidth: 160 }}>{label}</span>
      <span style={{ color: "#e8edf6" }}>{value}</span>
    </div>
  );
}

function KnowledgeDrawer({ knowledge, onClose }: { knowledge: KnowledgeNode[]; onClose: () => void }) {
  return (
    <div style={S.drawer}>
      <div style={S.drawerHead}>
        <span>שכבת ידע — מקורות ומודלים</span>
        <button onClick={onClose} style={S.drawerClose}>סגור</button>
      </div>
      {knowledge.filter((n) => n.kind === "model" || n.kind === "taxonomy").map((n) => (
        <div key={n.id} style={S.drawerItem}>
          <div style={{ fontWeight: 700 }}>{n.label}</div>
          {n.detail ? <div style={{ fontSize: 13, color: "#9fb0d0", marginTop: 2 }}>{n.detail}</div> : null}
          {n.source ? <div style={{ fontSize: 12, color: "#f2d34a", marginTop: 4 }}>מקור: {n.source}</div> : null}
        </div>
      ))}
      {knowledge.filter((n) => n.kind === "category").map((n) => (
        <div key={n.id} style={{ fontSize: 13, color: "#9fb0d0", padding: "3px 8px" }}>· {n.label}</div>
      ))}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  root: { fontFamily: "system-ui", background: COLOR.bg, color: COLOR.text, minHeight: "100%", padding: "14px 20px 32px", position: "relative" },
  topBar: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 },
  levelTabs: { display: "flex", gap: 6, flexWrap: "wrap" },
  levelTab: { fontSize: 13, fontWeight: 500, padding: "7px 14px", borderRadius: RADIUS.md, border: "none", background: COLOR.bgRaised, color: COLOR.textDim, cursor: "pointer" },
  levelTabActive: { color: "#02101f", background: COLOR.accent, fontWeight: 700 },
  subjectLine: { fontSize: 13, color: "#7f97c2", display: "flex", alignItems: "center", gap: 10 },
  knowledgeToggle: { fontSize: 13, padding: "3px 10px", borderRadius: 10, border: "1px solid #2a3f66", background: "transparent", color: "#9fb0d0", cursor: "pointer" },

  threeCol: { display: "grid", gridTemplateColumns: "1fr 1.1fr 1fr", gap: 20, alignItems: "start" },
  column: { display: "flex", flexDirection: "column", gap: 8, minWidth: 0 },
  columnTitle: { fontSize: 13, fontWeight: 700, letterSpacing: 0.5 },
  columnNote: { fontSize: 13, color: "#6c86b5", lineHeight: 1.5 },

  humanCore: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "18px 0" },
  humanCircle: { width: 116, height: 116, borderRadius: "50%", border: `3px solid ${COLOR.accent}`, background: "radial-gradient(circle, rgba(91,156,246,0.3), rgba(52,211,153,0.08) 70%, transparent 100%)", boxShadow: "0 0 32px -8px rgba(91,156,246,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: COLOR.text },
  humanSub: { fontSize: 13, color: COLOR.textDim, fontWeight: 600 },
  motiveNote: { fontSize: 13, color: "#6c86b5", textAlign: "center", lineHeight: 1.6, marginTop: 4 },

  stack: { display: "flex", flexDirection: "column", gap: 10 },
  rowWrap: { display: "flex", flexWrap: "wrap", gap: 10 },
  sectionHead: { fontSize: 13, fontWeight: 700, color: "#5aa6ff", letterSpacing: 0.5, marginTop: 6 },

  card: { border: "1px solid", borderRadius: 10, padding: "10px 14px", background: "rgba(17,23,38,0.7)", minWidth: 160 },
  flowNote: { fontSize: 13, color: "#6c86b5", textAlign: "center", marginTop: 8, lineHeight: 1.5 },

  loopList: { display: "flex", flexDirection: "column", gap: 8 },
  loopRow: { display: "flex", alignItems: "stretch", gap: 4, border: "1px solid", borderRadius: 10, padding: 8, overflowX: "auto" },
  loopStage: { border: "1px solid", borderRadius: 8, padding: "6px 10px", minWidth: 110, flex: "0 0 auto" },
  loopStageLabel: { fontSize: 12, letterSpacing: 1, color: "#6c86b5" },
  loopStageValue: { fontSize: 13, color: "#f2f6fc", marginTop: 2 },

  detailPanel: { background: "#111726", border: "1px solid #2a3f66", borderRadius: 10, padding: "12px 16px", marginTop: 6 },

  principleGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 },
  provenanceNote: { fontSize: 13, color: "#6c86b5", lineHeight: 1.6, maxWidth: 900 },
  sourceLensNote: { fontSize: 12, color: "#6c86b5", marginTop: 6, paddingTop: 4, borderTop: "1px dashed rgba(90,120,180,0.25)", fontStyle: "italic" },
  evalList: { display: "flex", flexDirection: "column", gap: 4, margin: 0, padding: "0 20px 0 0", listStyle: "disc" },
  evalItem: { fontSize: 13, color: "#cfe0f5", lineHeight: 1.6 },

  drawer: { position: "absolute", top: 0, left: 0, bottom: 0, width: 300, background: "#0b0f1acc", backdropFilter: "blur(6px)", borderLeft: "1px solid #2a3f66", padding: 14, overflowY: "auto", zIndex: 5 },
  drawerHead: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "#b592e8", marginBottom: 10 },
  drawerClose: { fontSize: 12, padding: "3px 8px", borderRadius: 8, border: "1px solid #2a3f66", background: "transparent", color: "#9fb0d0", cursor: "pointer" },
  drawerItem: { fontSize: 13, padding: "8px 10px", marginBottom: 6, borderRadius: 6, border: "1px solid #1e2740" },
};
