/**
 * DayCycle — PHILOS-native Day Opening / Day Closing (System-Wide Build,
 * continued). Deliberately NOT Merlin's Day Opening ritual
 * (`voice-gateway/service/day_opening_*.py`, which reads real personal
 * Human/Music Config Excel data and stays out of scope — see
 * `PHILOS-PRODUCT-MASTER-LEDGER.md` §6/§7/§9 for why). This is a new,
 * separate, PHILOS-web-app-native view built entirely from data this
 * product already has: `core` (`orientationCore.ts`), `tensions`
 * (`tension.ts` — the SAME shared shape Hub's command center and Community
 * already use, not a second computation), and `lifecycle`
 * (`actionLifecycle.ts`).
 *
 * **Continuity, honestly.** "Day Closing(N) → Day Opening(N+1)" is not
 * implemented as a snapshot/diff mechanism (that would require inventing a
 * persistence format canon doesn't define). Instead: `tensions` is LIVE
 * state, computed fresh every render from the real stores — so whatever is
 * still open when Day Closing renders is, by construction, exactly what
 * Day Opening shows tomorrow. The continuity IS the shared data model, not
 * a fabricated carry-forward record. Stated explicitly in the UI, not
 * implied.
 */
import type { OrientationCore } from "@/app/lib/philos/orientationCore";
import type { ActionLifecycleSummary } from "@/app/lib/philos/canon/actionLifecycle";
import type { TensionItem } from "@/app/lib/philos/tension";
import type { KnownNeedResult } from "@/app/lib/systemContext";
import type { EntityLink } from "@/app/lib/philos/bridge/entityLink";
import { needsRequiringAction } from "@/app/lib/philos/sharedContext";
import {
  buildDayClosingQuestions,
  buildCarryForward,
  buildNextDayOpening,
} from "@/app/lib/philos/dayClosingFusion";
import DayClosingFusion from "./DayClosingFusion";

const DOMAIN_WORD: Record<"G" | "E" | "C", string> = { G: "גוף", E: "רגש", C: "שכל" };
const SEVERITY_COLOR: Record<TensionItem["severity"], string> = { high: "#f2635c", medium: "#fbbf24", low: "#8aa0c8", unknown: "#6c86b5" };
const RECON_LABEL: Record<string, string> = {
  not_executed: "לא בוצע",
  executed: "בוצע — Effect ממתין",
  effect_pending: "Effect נטען — לא אומת",
  effect_observed: "Effect אומת",
};
const RECON_COLOR: Record<string, string> = {
  not_executed: "#f2635c",
  executed: "#5b9cf6",
  effect_pending: "#fbbf24",
  effect_observed: "#34d399",
};

export default function DayCycle({
  subject, core, tensions, lifecycle, today, knownNeeds, bridgeRegistry,
}: {
  subject: string;
  core: OrientationCore;
  tensions: TensionItem[];
  lifecycle: ActionLifecycleSummary;
  today: string;
  knownNeeds: KnownNeedResult;
  bridgeRegistry: EntityLink[];
}) {
  const todaysActions = lifecycle.actions.filter((a) => a.action.action.time.slice(0, 10) === today);
  const todaysLearnings = todaysActions.flatMap((a) => a.effects.flatMap((e) => e.learnings)).filter((l) => l.recorded_at.slice(0, 10) === today);
  const realizedToday = todaysLearnings.filter((l) => l.learning.result.kind === "state_prime");
  const pendingNeeds = needsRequiringAction(knownNeeds, lifecycle);
  const closingQuestions = buildDayClosingQuestions({ todaysActions, pendingNeeds, tensions, lifecycle });

  // PHILOS MASTER RUNTIME LOOP: Day Closing → State Update → Next Day
  // Opening. `carryForward` is the one canonical carry-forward object,
  // computed fresh from the SAME real data above — never a second store.
  // `nextOpening` is generated FROM `carryForward`, making the loop's
  // "next day" step real and inspectable, not just an implicit claim.
  const carryForward = buildCarryForward({
    subject, today, core, lifecycle, pendingNeeds, tensions, todaysActions,
    realizedLearningsToday: realizedToday.length,
    bridgeRegistry,
  });
  const nextOpening = buildNextDayOpening(carryForward);

  return (
    <section dir="rtl" style={S.card}>
      <div style={S.head}>
        <h2 style={S.title}>מחזור יום — Day Opening / Day Closing</h2>
        <span style={S.sub}>{today} · נושא: {subject}</span>
      </div>

      <div style={S.split}>
        <div style={S.col}>
          <div style={S.colHead}>פתיחת יום · DAY OPENING</div>
          <div style={S.note}>הבסיס להיום נגזר ישירות מהמצב הפתוח שנשאר — אין תמונת מצב נפרדת, אותו מידע חי.</div>

          <div style={S.subHead}>מצב נוכחי</div>
          <div style={S.rowWrap}>
            {(["G", "E", "C"] as const).map((d) => {
              const mark = core[d];
              return (
                <div key={d} style={S.stateChip}>
                  <span>{DOMAIN_WORD[d]}</span>
                  <span>{mark ? `level ${mark.level}` : "לא ידוע"}</span>
                </div>
              );
            })}
          </div>

          <div style={S.subHead}>לולאות פתוחות ({tensions.length})</div>
          {tensions.length === 0 ? (
            <Empty>נבדק — אין Tension פתוח.</Empty>
          ) : (
            tensions.map((t) => (
              <div key={t.id} style={S.tensionRow}>
                <span style={{ ...S.severity, color: SEVERITY_COLOR[t.severity] }}>{t.severity}</span>
                <span>{t.label}</span>
                <span style={S.meta}>{t.current_state}</span>
              </div>
            ))
          )}

          {/* NEXT DAY OPENING — generated from carryForward (the SAME
              open items above), never a second computation. Answers the
              7 questions the runtime-loop spec requires, each a real
              summary sentence, never a fabricated narrative. */}
          <div style={S.subHead}>Day Opening — נוצר מ-Carry-Forward</div>
          <OpeningRow q="איפה אני היום?" a={nextOpening.where_am_i_today} />
          <OpeningRow q="מה השתנה מאתמול?" a={nextOpening.what_changed_since_yesterday} />
          <OpeningRow q="מה נשאר פתוח?" a={nextOpening.what_remains_open} />
          <OpeningRow q="מה מוגבל?" a={nextOpening.what_is_constrained} />
          <OpeningRow q="איזו אפשרות קיימת?" a={nextOpening.what_possibility_exists} />
          <OpeningRow q="מה הכי חשוב?" a={nextOpening.what_matters_most} />
          <OpeningRow q="מה הפעולה הבאה הרלוונטית?" a={nextOpening.next_relevant_action} />
        </div>

        <div style={S.col}>
          <div style={S.colHead}>סגירת יום · DAY CLOSING</div>
          <div style={S.note}>Actions/Effects/Learning שנרשמו בפועל היום — לא תוכנית, מה שקרה.</div>

          <div style={S.subHead}>Actions היום ({todaysActions.length})</div>
          {todaysActions.length === 0 ? (
            <Empty>אין Action רשום היום.</Empty>
          ) : (
            todaysActions.map((a) => (
              <div key={a.action.action.action_id} style={S.tensionRow}>
                <span>{a.action.action.type}</span>
                <span style={S.meta}>{a.verification_state}</span>
              </div>
            ))
          )}

          <div style={S.subHead}>Learning אמיתי היום ({realizedToday.length})</div>
          {realizedToday.length === 0 ? (
            <Empty>אין עדכון מצב אמיתי (state_prime) שהתקבל היום.</Empty>
          ) : (
            realizedToday.map((l) => (
              <div key={l.learning.learning_id} style={S.tensionRow}>
                <span style={{ color: "#34d399" }}>state_prime</span>
                <span style={S.meta}>Δ level {l.delta?.level_delta ?? "—"}</span>
              </div>
            ))
          )}

          {/* RECONCILIATION — INTENT → ACTION → EXPECTED/OBSERVED EFFECT,
              classified. PLANNED is not a separate observable status here
              (see dayClosingFusion.ts's own note on why) — a pending Need
              IS the real "intended, not yet acted on" signal. */}
          <div style={S.subHead}>התאמה · RECONCILIATION ({carryForward.reconciliation.length})</div>
          {carryForward.reconciliation.length === 0 ? (
            <Empty>אין Need פתוח ואין Action היום.</Empty>
          ) : (
            carryForward.reconciliation.map((r) => (
              <div key={r.id} style={S.tensionRow}>
                <span style={{ ...S.severity, color: RECON_COLOR[r.status] }}>{RECON_LABEL[r.status]}</span>
                <span>{r.label}</span>
              </div>
            ))
          )}

          {/* COLLECTIVE PROPAGATION — real bridge links only. A private
              Action with no real ACTION_AFFECTS_COMMUNITY/EFFECT_AFFECTS_PERSON
              link never mutates Community — stated explicitly, not silently
              skipped. */}
          <div style={S.subHead}>השפעה קולקטיבית · COMMUNITY / MARKET PROPAGATION</div>
          {carryForward.collective_propagation.length === 0 ? (
            <Empty>אין Action היום עם קישור אמיתי לקהילה/שוק — פעולה פרטית, ללא השפעה קולקטיבית מתועדת.</Empty>
          ) : (
            carryForward.collective_propagation.map((l) => (
              <div key={l.link_id} style={S.tensionRow}>
                <span style={{ color: l.provenance === "DEMO" ? "#fbbf24" : "#34d399" }}>{l.provenance}</span>
                <span>{l.relation}</span>
                <span style={S.meta}>→ {l.target.canonical_id}</span>
              </div>
            ))
          )}

          {/* VALUE-DOMAIN STATE UPDATE — always stated as blocked, never
              fabricated. No ValueDomainConfig exists in this repo. */}
          <div style={S.subHead}>עדכון Value Domain</div>
          <Empty>אין עדיין תצורת Value Domain אמיתית לעדכן — לא הוגדרה עדיין עבור המשתמש.</Empty>

          <div style={S.subHead}>נשא הלאה למחר</div>
          <div style={S.note}>
            {tensions.length === 0 ? "אין לולאה פתוחה כרגע — לא ידוע מה יהיה מצב המחר." : `${tensions.length} Tension פתוח יעבור ל-Day Opening של מחר — אותו אובייקט, לא עותק.`}
          </div>
        </div>
      </div>

      <DayClosingFusion core={core} todaysActions={todaysActions} questions={closingQuestions} />
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={S.empty}>{children}</div>;
}

function OpeningRow({ q, a }: { q: string; a: string }) {
  return (
    <div style={S.openingRow}>
      <span style={S.openingQ}>{q}</span>
      <span style={S.openingA}>{a}</span>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  card: { background: "rgba(18,24,38,0.7)", border: "1px solid rgba(90,120,180,0.14)", borderRadius: 16, padding: "16px 18px", marginTop: 16 },
  head: { display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  title: { fontSize: 15, fontWeight: 700, margin: 0, color: "#f0f4fc" },
  sub: { fontSize: 13, color: "#5f7aa6" },

  split: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 },
  col: { display: "flex", flexDirection: "column", gap: 4 },
  colHead: { fontSize: 13, fontWeight: 700, color: "#5aa6ff" },
  note: { fontSize: 12, color: "#6c86b5", lineHeight: 1.6, marginBottom: 6 },
  subHead: { fontSize: 13, fontWeight: 700, color: "#8fa3c9", marginTop: 8, marginBottom: 4 },

  rowWrap: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 },
  stateChip: { display: "flex", flexDirection: "column", gap: 2, padding: "4px 10px", borderRadius: 8, background: "rgba(90,120,180,0.08)", fontSize: 13 },

  tensionRow: { display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 8px", borderRadius: 6, background: "rgba(90,120,180,0.05)", fontSize: 13, marginBottom: 3 },
  severity: { fontSize: 12, fontWeight: 800, textTransform: "uppercase", fontFamily: "ui-monospace, monospace" },
  meta: { color: "#8aa0c8" },
  empty: { fontSize: 13, color: "#7b8ca6", fontStyle: "italic", padding: "3px 2px" },

  openingRow: { display: "flex", flexDirection: "column", gap: 1, padding: "4px 8px", borderRadius: 6, background: "rgba(90,120,180,0.05)", marginBottom: 3 },
  openingQ: { fontSize: 12, fontWeight: 700, color: "#5aa6ff" },
  openingA: { fontSize: 13, color: "#dbe6f6" },
};
