"use client";

/**
 * MarketplacePrototype — VISUAL CHECKPOINT, iteration 2, at
 * `/marketplace?view=prototype`. Production `/marketplace` unchanged.
 *
 * This pass wires the drawer to the REAL evaluator
 * (`evaluateMatchForCurrentUser` → `evaluateMatch`, `matchEvalAction.ts`)
 * — same function `EvaluateMatchForm.tsx` calls, imported and invoked
 * directly (the standard way a Next.js Server Action is called from a
 * client component), never reimplemented. Match evaluation stays exactly
 * what it already was: derived live, never persisted (see
 * `matchEvalAction.ts`'s own header on why — a deliberate §21 anti-
 * reputation-signal decision, not an oversight).
 *
 * VALUE/GROUP context: canon `Need`/`Offer` carry no `group_id`/
 * `value_context` field (the same gap documented across every other
 * surface this session — Community/Brain/Dynamics/World). This
 * component does NOT claim the real Need/Offer are scoped to the
 * viewer's real group; it shows the real group (via the real identity
 * link) for orientation only, with that gap stated plainly, not hidden.
 *
 * ARCHITECTURE GAP (verified, not bypassed): `createActionForCurrentUserCore`
 * (`actionFormAction.ts`) has NO field or server-side check requiring a
 * prior "permitted" match evaluation — `inputs` accepts any real Need/
 * Offer id the subject owns, freely, regardless of match outcome. Since
 * match results are never persisted, Action creation structurally COULD
 * NOT check this even if it wanted to. This component surfaces that gap
 * explicitly after a passing match rather than pretending a real
 * Match→Action link exists.
 */
import { useState } from "react";
import { evaluateMatchForCurrentUser, type EvaluateMatchResult } from "@/app/lib/philos/canon/matchEvalAction";
import { PhilosFlow, PhilosNode, PhilosEdge, type PhilosFlowStep } from "@/app/lib/philos/visual/PhilosPrimitives";

interface RealNeed {
  need_id: string;
  desired_change: string;
  domain: string;
  subject: string;
}
interface RealOffer {
  offer_id: string;
  available_resource: string;
  resource_type: string;
  amount_or_capacity: string | number;
  source: string;
}

const GATES = ["CAN", "WANTS", "ALLOWED", "APPROPRIATE", "AVAILABLE", "CONSENT"] as const;
type Gate = (typeof GATES)[number];
type GateAnswer = "UNKNOWN" | "YES" | "NO";

const GATE_COPY: Record<Gate, { title: string; question: string }> = {
  CAN: { title: "יכולת", question: "האם המשאב באמת יכול לעזור לצורך?" },
  WANTS: { title: "רצון", question: "האם אתה רוצה להשתמש בהתאמה הזו?" },
  ALLOWED: { title: "הרשאה", question: "האם אין כלל או מגבלה שמונעים אותה?" },
  APPROPRIATE: { title: "התאמה למצב", question: "האם זה מתאים למצב הספציפי?" },
  AVAILABLE: { title: "זמינות", question: "האם המשאב באמת זמין עכשיו?" },
  CONSENT: { title: "הסכמה", question: "האם אתה מסכים להתקדם עם ההתאמה?" },
};

export default function MarketplacePrototype({
  needs, offers, actionsCount, effectsCount, identityLinked, realGroupName, realGroupCentralValue,
}: {
  needs: RealNeed[];
  offers: RealOffer[];
  actionsCount: number;
  effectsCount: number;
  identityLinked: boolean;
  realGroupName?: string;
  realGroupCentralValue?: string;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [context, setContext] = useState("");
  const [answers, setAnswers] = useState<Record<Gate, GateAnswer>>({ CAN: "UNKNOWN", WANTS: "UNKNOWN", ALLOWED: "UNKNOWN", APPROPRIATE: "UNKNOWN", AVAILABLE: "UNKNOWN", CONSENT: "UNKNOWN" });
  const [result, setResult] = useState<EvaluateMatchResult | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  const need = needs[0];
  const offer = offers[0];
  const hasCandidate = !!need && !!offer;
  const answeredCount = GATES.filter((g) => answers[g] !== "UNKNOWN").length;
  const allAnswered = answeredCount === 6;

  const nextAction = !need
    ? { label: "רשום Need · RECORD NEED" }
    : !offer
      ? { label: "רשום Offer · RECORD OFFER" }
      : actionsCount === 0
        ? { label: "הערך התאמה · EVALUATE MATCH" }
        : effectsCount === 0
          ? { label: "רשום Effect · RECORD EFFECT" }
          : { label: "סקור השפעה · REVIEW IMPACT" };

  async function runEvaluation(nextAnswers: Record<Gate, GateAnswer>, nextContext: string) {
    if (!need || !offer) return;
    if (!nextContext.trim()) return;
    if (GATES.some((g) => nextAnswers[g] === "UNKNOWN")) return;
    setEvaluating(true);
    const fd = new FormData();
    fd.set("need_id", need.need_id);
    fd.set("offer_id", offer.offer_id);
    fd.set("context", nextContext.trim());
    for (const g of GATES) if (nextAnswers[g] === "YES") fd.set(g, "on");
    const r = await evaluateMatchForCurrentUser(fd);
    setResult(r);
    setEvaluating(false);
  }

  function setAnswer(g: Gate, a: GateAnswer) {
    const next = { ...answers, [g]: a };
    setAnswers(next);
    setResult(null);
    if (GATES.every((gg) => next[gg] !== "UNKNOWN") && context.trim()) void runEvaluation(next, context);
  }

  function onContextBlur() {
    if (GATES.every((g) => answers[g] !== "UNKNOWN") && context.trim()) void runEvaluation(answers, context);
  }

  // Same real-data proxies the original strip used (match/action share
  // actionsCount because match outcomes are never persisted, §21) —
  // just recomputed as "first unresolved real stage" so the flow
  // primitive can make the current edge dominate visually. LEARNING is
  // honestly always "pending" here: this component has no real
  // learnings signal wired to it, never fabricated as done.
  const stageDone = [needs.length > 0, offers.length > 0, actionsCount > 0, actionsCount > 0, effectsCount > 0, false];
  const firstUnresolved = stageDone.findIndex((d) => !d);
  const stageState = (i: number): PhilosFlowStep["state"] => (firstUnresolved === -1 || i < firstUnresolved ? "done" : i === firstUnresolved ? "current" : "pending");
  const lifecycleSteps: PhilosFlowStep[] = [
    { key: "need", label: "צורך", labelEn: "NEED", state: stageState(0) },
    { key: "resource", label: "משאב", labelEn: "RESOURCE", state: stageState(1) },
    { key: "match", label: "התאמה", labelEn: "MATCH", state: stageState(2) },
    { key: "action", label: "פעולה", labelEn: "ACTION", state: stageState(3) },
    { key: "effect", label: "השפעה", labelEn: "EFFECT", state: stageState(4) },
    { key: "learning", label: "למידה", labelEn: "LEARNING", state: stageState(5) },
  ];

  return (
    <div dir="rtl" style={S.wrap}>
      <div style={S.protoBadge}>PROTOTYPE ITERATION 2 — real evaluator wired, decision derived not persisted</div>

      <div style={S.header}>
        <div style={S.title}>PHILOS MARKETPLACE</div>
        <a href="/marketplace" style={S.auditLink}>← production Marketplace</a>
      </div>

      {/* FLOW primitive — shared grammar with Human Config / Community */}
      <div style={S.lifecycleStrip}>
        <PhilosFlow steps={lifecycleSteps} />
      </div>

      {/* VALUE → VALUE GROUP context — real where supported, honest gap otherwise */}
      <div style={S.contextStrip}>
        {identityLinked && realGroupName ? (
          <>
            <span style={S.contextChip}>קבוצה אמיתית: {realGroupName} ({realGroupCentralValue})</span>
            <span style={S.contextGap}>Need/Offer אינם נושאים group_id/value_context ב-canon — לא ניתן להוכיח שהם שייכים מבנית לקבוצה זו. מוצג להתמצאות בלבד.</span>
          </>
        ) : (
          <span style={S.contextGap}>אין קישור זהות — אין הקשר קבוצה/ערך אמיתי להציג.</span>
        )}
      </div>

      {/* MAIN COMPOSITION — NODE ↔ EDGE ↔ NODE, shared grammar */}
      <div style={S.cardsRow}>
        <div style={S.nodeSlot}>
          {need ? (
            <PhilosNode label="צורך" labelEn={`NEED · ${need.domain}`} status="real" meta={<>{need.desired_change}<br />owner: {need.subject}</>} />
          ) : (
            <div style={S.cardEmpty}>0 — אין Need אמיתי כרגע.</div>
          )}
        </div>

        <div style={S.connector}>
          <PhilosEdge label="MATCH CANDIDATE" />
          <div style={{ ...S.connectorStatus, color: hasCandidate ? "#fbbf24" : "#6c86b5" }}>
            {hasCandidate ? "AWAITING HUMAN DECISION" : "0 — no candidate pair yet"}
          </div>
          {hasCandidate && actionsCount === 0 ? (
            <button onClick={() => setDrawerOpen(true)} style={S.ctaBtn}>{nextAction.label} →</button>
          ) : null}
        </div>

        <div style={S.nodeSlot}>
          {offer ? (
            <PhilosNode label="משאב" labelEn={`RESOURCE · ${offer.resource_type}`} status="real" meta={<>{offer.available_resource}<br />capacity: {offer.amount_or_capacity} · provider: {offer.source}</>} />
          ) : (
            <div style={S.cardEmpty}>0 — אין Offer אמיתי כרגע.</div>
          )}
        </div>
      </div>

      {actionsCount > 0 || effectsCount > 0 || (!hasCandidate) ? (
        <div style={S.nextStepBelow}>
          <span style={S.stateLabel}>NEXT STEP</span> — {nextAction.label}
        </div>
      ) : null}

      {drawerOpen && need && offer ? (
        <>
          <div style={S.scrim} onClick={() => setDrawerOpen(false)} />
          <div style={S.drawer}>
            <button onClick={() => setDrawerOpen(false)} style={S.drawerClose}>✕ סגור</button>
            <div style={S.drawerTitle}>הערכת התאמה</div>
            <div style={S.drawerSub}>{need.desired_change} ↔ {offer.available_resource}</div>

            <div style={S.drawerSection}>
              <label style={S.fieldLabel}>הקשר</label>
              <div style={S.fieldSubLabel}>באיזה מצב ההתאמה הזו אמורה לקרות?</div>
              <input
                type="text" value={context}
                onChange={(e) => { setContext(e.target.value); setResult(null); }}
                onBlur={onContextBlur}
                style={S.fieldInput}
              />
            </div>

            <div style={S.drawerSection}>
              {GATES.map((g) => (
                <div key={g} style={S.gateCard}>
                  <div style={S.gateHeadRow}>
                    <span style={S.gateTitle}>{GATE_COPY[g].title}</span>
                    <span style={S.gateInternal}>{g}</span>
                  </div>
                  <div style={S.gateQuestion}>{GATE_COPY[g].question}</div>
                  <div style={S.gateButtons}>
                    <button onClick={() => setAnswer(g, "NO")} style={{ ...S.gateBtn, ...(answers[g] === "NO" ? S.gateBtnNoActive : {}) }}>לא</button>
                    <button onClick={() => setAnswer(g, "YES")} style={{ ...S.gateBtn, ...(answers[g] === "YES" ? S.gateBtnYesActive : {}) }}>כן</button>
                  </div>
                </div>
              ))}
            </div>

            <div style={S.resultBox}>
              {evaluating ? (
                <div style={S.resultPending}>מעריך…</div>
              ) : !result ? (
                <>
                  <div style={S.resultPending}>לא ניתן להעריך עדיין</div>
                  <div style={S.resultProgress}>{answeredCount} מתוך 6 החלטות התקבלו</div>
                </>
              ) : !result.ok ? (
                <div style={S.resultBlocked}>{result.message}</div>
              ) : result.result.decision === "permitted" ? (
                <>
                  <div style={S.resultPermitted}>התאמה אפשרית</div>
                  <div style={S.resultProgress}>6/6 שערים עברו</div>
                  <div style={S.nextValidStep}>NEXT: CREATE / RECORD ACTION → <a href="/marketplace#action" style={{ color: "#5b9cf6" }}>/marketplace</a></div>
                  <div style={S.architectureGapNote}>
                    פער ארכיטקטורה: תוצאת ההתאמה אינה נשמרת (canon §21) — יצירת Action אינה דורשת/יכולה לאמת שההתאמה הזו עברה. הקישור בין Match ל-Action אינו נאכף מבנית.
                  </div>
                </>
              ) : (
                <>
                  <div style={S.resultBlockedTitle}>ההתאמה חסומה</div>
                  <div style={S.failedGates}>
                    {GATES.filter((g) => (result.result.rejection_reasons as string[]).includes(`${g}_false`)).map((g) => (
                      <span key={g} style={S.failedGateChip}>{GATE_COPY[g].title} ({g})</span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { fontFamily: "system-ui", color: "#e6ebf5", background: "#0b0f1a", minHeight: "100vh", paddingBottom: 60 },
  protoBadge: { textAlign: "center", fontSize: 13, fontWeight: 700, color: "#0b0f1a", background: "#fbbf24", padding: "4px 0" },
  header: { display: "flex", alignItems: "center", justifyContent: "center", gap: 16, padding: "22px 20px 4px", position: "relative" },
  title: { fontSize: 28, fontWeight: 800, letterSpacing: 2, color: "#f2f6fc" },
  auditLink: { position: "absolute", insetInlineEnd: 20, fontSize: 13, color: "#6c86b5", textDecoration: "none" },

  lifecycleStrip: { display: "flex", justifyContent: "center", alignItems: "center", maxWidth: 760, margin: "18px auto 0" },

  contextStrip: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, maxWidth: 700, margin: "16px auto 0", textAlign: "center" },
  contextChip: { fontSize: 13, fontWeight: 700, color: "#34d399" },
  contextGap: { fontSize: 12, color: "#6c86b5", lineHeight: 1.5 },

  cardsRow: { display: "flex", alignItems: "stretch", justifyContent: "center", gap: 0, maxWidth: 1200, margin: "22px auto 0", flexWrap: "wrap" },
  nodeSlot: { flex: "1 1 360px", maxWidth: 420, margin: "0 14px", display: "flex", alignItems: "stretch" },
  cardEmpty: { fontSize: 13, color: "#7b8ca6", fontStyle: "italic" },

  connector: { flex: "0 1 220px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 12px", minWidth: 180, gap: 6 },
  connectorStatus: { fontSize: 13, fontWeight: 700, textAlign: "center" },

  ctaBtn: { marginTop: 10, fontSize: 15, fontWeight: 700, color: "#0b0f1a", background: "#5b9cf6", padding: "10px 20px", borderRadius: 10, border: "none", cursor: "pointer" },
  nextStepBelow: { textAlign: "center", fontSize: 13, color: "#9fb0d0", marginTop: 20 },
  stateLabel: { fontSize: 13, fontWeight: 700, letterSpacing: 1, color: "#5b9cf6" },

  scrim: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 40 },
  drawer: { position: "fixed", top: 0, bottom: 0, insetInlineEnd: 0, width: "min(460px, 94vw)", background: "#0f1522", borderInlineStart: "1px solid rgba(90,120,180,0.25)", zIndex: 41, overflowY: "auto", padding: 22 },
  drawerClose: { fontSize: 13, color: "#8fa3c9", background: "transparent", border: "none", cursor: "pointer", padding: 0, marginBottom: 12 },
  drawerTitle: { fontSize: 17, fontWeight: 800, color: "#f2f6fc" },
  drawerSub: { fontSize: 13, color: "#9fb0d0", marginTop: 4, marginBottom: 16 },
  drawerSection: { marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 },
  fieldLabel: { fontSize: 13, fontWeight: 700, color: "#dbe6f6", display: "block" },
  fieldSubLabel: { fontSize: 13, color: "#8fa3c9", marginBottom: 5 },
  fieldInput: { fontSize: 13, padding: "9px 11px", borderRadius: 8, border: "1px solid rgba(90,120,180,0.3)", background: "rgba(11,15,26,0.6)", color: "#e6ebf5", width: "100%" },

  gateCard: { background: "rgba(90,120,180,0.06)", borderRadius: 10, padding: "10px 12px" },
  gateHeadRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline" },
  gateTitle: { fontSize: 15, fontWeight: 700, color: "#f2f6fc" },
  gateInternal: { fontSize: 12, color: "#6c86b5", fontFamily: "ui-monospace, monospace" },
  gateQuestion: { fontSize: 13, color: "#9fb0d0", marginTop: 3, marginBottom: 8 },
  gateButtons: { display: "flex", gap: 6 },
  gateBtn: { flex: 1, fontSize: 13, fontWeight: 600, padding: "6px 0", borderRadius: 6, border: "1px solid rgba(90,120,180,0.3)", background: "transparent", color: "#8fa3c9", cursor: "pointer" },
  gateBtnYesActive: { background: "#34d399", color: "#0b0f1a", borderColor: "#34d399" },
  gateBtnNoActive: { background: "#f2635c", color: "#0b0f1a", borderColor: "#f2635c" },

  resultBox: { marginTop: 4, padding: "12px 14px", borderRadius: 10, background: "rgba(90,120,180,0.08)" },
  resultPending: { fontSize: 13, color: "#8fa3c9" },
  resultProgress: { fontSize: 13, color: "#6c86b5", marginTop: 4 },
  resultBlocked: { fontSize: 13, color: "#f2635c" },
  resultPermitted: { fontSize: 14, fontWeight: 800, color: "#34d399" },
  resultBlockedTitle: { fontSize: 14, fontWeight: 800, color: "#f2635c" },
  failedGates: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 },
  failedGateChip: { fontSize: 13, padding: "4px 9px", borderRadius: 8, background: "rgba(242,99,92,0.15)", color: "#f2635c", border: "1px solid rgba(242,99,92,0.4)" },
  nextValidStep: { fontSize: 13, color: "#dbe6f6", marginTop: 8 },
  architectureGapNote: { fontSize: 12, color: "#fbbf24", marginTop: 10, lineHeight: 1.6 },
};
