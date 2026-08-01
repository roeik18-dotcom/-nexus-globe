"use client";

/**
 * ValueHub — one value community, understood in 10 seconds: who opened it and
 * why, who leads it, what happened today, how much money there is, where it can
 * go, and what actually changed.
 *
 * Every figure on this screen is projected from the canonical event log
 * (app/lib/philos). There are no example numbers here: if a value is not
 * derivable from an event it is not shown. Figures that can mislead — money,
 * allocations, transfers, impact — carry their source event count and
 * verification status inline, per PHILOS-SYSTEM-BLUEPRINT §0 and §10.
 */

import Link from "next/link";
import { useMemo, useState } from "react";

import type { PhilosEvent } from "@/app/lib/philos/events";
import {
  joinEvent,
  projectValueGroup,
  type AllocationView,
  type ImpactView,
  type TransferView,
  type VerificationLevel,
} from "@/app/lib/philos/projectValueGroup";

const TERMINALS = [
  ["WORLD", "עולם"], ["PEOPLE", "אנשים"], ["VALUES", "ערכים"],
  ["ACTIVITY", "פעילות"], ["RESOURCES", "משאבים"], ["IMPACT", "השפעה"],
] as const;

const nis = (n: number) => n.toLocaleString("he-IL") + " ₪";

const DOT: Record<string, string> = {
  need: "#fb923c", join: "#34d399", money: "#facc15",
  post: "#7dd3fc", vote: "#a78bfa", event: "#f472b6", impact: "#34d399",
};

/** §10 — the six evidence levels, shown as written. Never collapsed. */
const STATUS_LABEL: Record<string, string> = {
  claim: "טענה בלבד",
  self_report: "דיווח עצמי",
  evidence: "מתועד",
  community_verified: "אומת בקהילה",
  external_verified: "אומת חיצונית",
  system_inference: "הסקה של המערכת",
};

// Verification level is its own axis, separate from the evidence status above.
// `partial` gets its own label and colour precisely so it can never be read as
// verified — the count it belongs to is impact_totals.partial, not .verified.
//
// These are typed `Record<VerificationLevel, …>`, NOT Record<string, …>. When
// `under_review` was added to the domain the loose typing let the badge render
// blank — no mark, no label, no colour — which reads as "nothing to say about
// this claim" rather than "someone has asked for it to be checked". Exhaustive
// typing makes the next added level a compile error instead of a silent gap.
export const LEVEL_LABEL: Record<VerificationLevel, string> = {
  unverified: "לא אומת",
  under_review: "בבדיקה",
  verified: "אומת",
  partial: "אומת חלקית",
  inferred: "הסקה בלבד",
  rejected: "נדחה באימות",
  inconclusive: "לא הוכרע",
};
export const LEVEL_MARK: Record<VerificationLevel, string> = {
  unverified: "◦", under_review: "⟳", verified: "✓", partial: "◐",
  inferred: "≈", rejected: "✕", inconclusive: "?",
};
export const LEVEL_STYLE: Record<VerificationLevel, React.CSSProperties> = {
  unverified: { background: "rgba(250,204,21,0.10)", color: "#facc15" },
  // amber-violet, distinct from both verified green and unverified yellow:
  // being checked is its own state, not a weaker kind of verified.
  under_review: { background: "rgba(167,139,250,0.12)", color: "#a78bfa" },
  verified: { background: "rgba(52,211,153,0.12)", color: "#6ee7b7" },
  partial: { background: "rgba(125,211,252,0.10)", color: "#7dd3fc" },
  inferred: { background: "rgba(148,163,184,0.12)", color: "#94a3b8" },
  rejected: { background: "rgba(248,113,113,0.10)", color: "#f87171" },
  inconclusive: { background: "rgba(148,163,184,0.12)", color: "#94a3b8" },
};

function Provenance({ events, extra }: { events: number; extra?: string }) {
  return (
    <span style={S.prov}>
      מקור: {events} אירועים{extra ? ` · ${extra}` : ""}
    </span>
  );
}

export default function ValueHub({
  seedEvents,
  groupId,
  today,
}: {
  seedEvents: PhilosEvent[];
  groupId: string;
  today: string;
}) {
  const [tab, setTab] = useState<string>("ACTIVITY");
  const [extra, setExtra] = useState<PhilosEvent[]>([]);
  const [joined, setJoined] = useState(false);

  const view = useMemo(
    () => projectValueGroup([...seedEvents, ...extra], groupId, today),
    [seedEvents, extra, groupId, today],
  );

  if (!view) return <div style={S.root}><main style={S.page}>קבוצה לא נמצאה.</main></div>;

  const join = () => {
    setExtra(joinEvent(groupId, "p_you", "את/ה", `${today}T20:00:00+03:00`));
    setJoined(true);
    setTab("ACTIVITY");
  };

  return (
    <div dir="rtl" style={S.root}>
      <header style={S.nav}>
        <div style={S.brand}><span style={S.mark} /> PHILOS</div>
        <nav style={S.terminals}>
          {TERMINALS.map(([en, he]) => (
            <button
              key={en}
              onClick={() => setTab(en)}
              aria-current={tab === en ? "page" : undefined}
              style={{ ...S.term, ...(tab === en ? S.termActive : {}) }}
            >
              <span style={S.termHe}>{he}</span><span style={S.termEn}>{en}</span>
            </button>
          ))}
        </nav>
        <Link href="/hub" style={S.back}>← היום</Link>
      </header>

      <main style={S.page}>
        {/* ── understand: who opened it, why, and where it stands ── */}
        <section style={S.identity}>
          <div style={S.idMain}>
            <div style={S.idTop}>
              <span style={S.valueChip}>ערך: {view.central_value}</span>
              <span style={S.statusChip}>● {view.status === "active" ? "פעילה" : view.status}</span>
            </div>
            <h1 style={S.idName}>{view.name}</h1>
            <div style={S.idMeta}>
              נפתחה על ידי <b style={S.strong}>{view.founder.display_name}</b> · {view.opened_at} ·{" "}
              {view.region} · <b style={S.strong}>{view.members.length}</b> חברים
            </div>
            <div style={S.reason}>
              <span style={S.goalLabel}>למה נפתחה</span>
              <span style={S.reasonText}>{view.creation_reason}</span>
            </div>
            <div style={S.goal}><span style={S.goalLabel}>מטרה נוכחית</span> {view.goal}</div>
          </div>
          <div style={S.idSide}>
            <div style={S.idStat}>
              <div style={S.idStatN}>{nis(view.budget.available)}</div>
              <div style={S.idStatL}>זמין להקצאה</div>
            </div>
            <button onClick={join} disabled={joined} style={{ ...S.join, ...(joined ? S.joined : {}) }}>
              {joined ? "✓ הצטרפת לקבוצה" : "הצטרף/י לקבוצה"}
            </button>
            {joined && <div style={S.joinNote}>ההצטרפות נרשמה כאירוע ומופיעה בפעילות היום.</div>}
          </div>
        </section>

        {tab === "ACTIVITY" && (
          <section style={S.card}>
            <div style={S.cardHead}>
              <h2 style={S.cardTitle}>פעילות היום</h2>
              <Provenance events={view.today.length} extra={today} />
            </div>
            {view.today.length === 0 ? (
              <div style={S.empty}>לא נרשמו אירועים בתאריך הזה.</div>
            ) : (
              <div style={S.feed}>
                {view.today.map((t) => (
                  <div key={t.event_id} style={S.feedRow}>
                    <span style={S.feedTime}>{t.time}</span>
                    <span style={{ ...S.feedDot, background: DOT[t.kind] ?? "#7dd3fc" }} />
                    <span style={S.feedText}>{t.text}</span>
                    <span style={S.feedActor}>{t.actor_name}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "PEOPLE" && (
          <div style={S.grid2}>
            <section style={S.card}>
              <div style={S.cardHead}><h2 style={S.cardTitle}>מובילי ערך</h2><span style={S.cardHint}>תפקידים, לא מנהלים</span></div>
              {view.leaders.map((l) => (
                <div key={l.person_id} style={S.leader}>
                  <div style={S.avatar}>{l.display_name[0]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={S.leaderName}>{l.display_name}</div>
                    <div style={S.leaderRole}>{l.role_label} · {l.area}</div>
                    <div style={S.leaderMeta}>מונה על ידי {l.appointed_by_name} · {l.since}</div>
                  </div>
                </div>
              ))}
            </section>
            <section style={S.card}>
              <div style={S.cardHead}>
                <h2 style={S.cardTitle}>משתתפים</h2>
                <Provenance events={view.members.length} />
              </div>
              <div style={S.people}>
                {view.members.map((m) => (
                  <span key={m.person_id} style={S.person}>{m.display_name}</span>
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === "RESOURCES" && (
          <div style={S.grid2}>
            <section style={S.card}>
              <div style={S.cardHead}>
                <h2 style={S.cardTitle}>תקציב</h2>
                <Provenance
                  events={view.budget.provenance.sample_size}
                  extra={STATUS_LABEL[view.budget.provenance.verification_status]}
                />
              </div>
              <div style={S.budgetRow}>
                <div><div style={S.budgetN}>{nis(view.budget.received)}</div><div style={S.budgetL}>התקבלו</div></div>
                <div><div style={{ ...S.budgetN, color: "#9fb0c8" }}>{nis(view.budget.spent)}</div><div style={S.budgetL}>הוצאו</div></div>
                <div><div style={{ ...S.budgetN, color: "#facc15" }}>{nis(view.budget.committed)}</div><div style={S.budgetL}>מחויבים</div></div>
                <div><div style={{ ...S.budgetN, color: "#34d399" }}>{nis(view.budget.available)}</div><div style={S.budgetL}>זמינים</div></div>
              </div>

              <h3 style={S.sub}>העברה שבוצעה</h3>
              {view.transfers.map((t: TransferView) => (
                <div key={t.transfer_id} style={S.txn}>
                  <span style={S.txnAmt}>−{nis(t.amount)}</span>
                  <span style={S.txnWho}>{t.recipient}</span>
                  <span style={S.txnReason}>{t.purpose}</span>
                  <span style={S.txnStatus}>
                    {t.state === "completed" ? `הושלם ${t.completed_at}` : "אושר, טרם בוצע"}
                    {" · "}אישור {t.tier} · {t.approvals.length} מאשרים
                  </span>
                </div>
              ))}
            </section>

            <section style={S.card}>
              <div style={S.cardHead}><h2 style={S.cardTitle}>הקצאות</h2><span style={S.cardHint}>מה אפשר לעשות עם הכסף</span></div>
              {view.allocations.map((a: AllocationView) => (
                <div key={a.allocation_id} style={S.alloc}>
                  <div style={{ flex: 1 }}>
                    <div style={S.allocTitle}>{a.title} <span style={S.allocValue}>מחזק: {a.value_tag}</span></div>
                    <div style={S.allocMeta}>
                      הציע/ה {a.proposed_by_name} · {a.people_affected_estimate} אנשים · הצבעה {a.votes_for}/{a.votes_required}
                    </div>
                  </div>
                  <div style={S.allocRight}>
                    <div style={S.allocAmt}>{nis(a.amount)}</div>
                    <div style={{
                      ...S.allocStatus,
                      ...(a.state === "transferred" ? S.stOk : a.state === "approved" ? S.stNear : {}),
                    }}>
                      {a.state === "transferred" ? "הועבר" : a.state === "approved" ? "אושר" : "בהצבעה"}
                    </div>
                  </div>
                </div>
              ))}
            </section>
          </div>
        )}

        {tab === "IMPACT" && (
          <section style={S.card}>
            <div style={S.cardHead}><h2 style={S.cardTitle}>מה באמת השתנה</h2><span style={S.cardHint}>כל מספר עם סטטוס אימות</span></div>
            {view.impact.map((i: ImpactView) => (
              <div key={i.impact_id} style={S.impactBlock}>
                <div style={S.impactStatement}>{i.statement}</div>
                <div style={S.impactRow}>
                  <span style={S.impactStat}><b style={S.impactN}>{i.people_affected}</b> אנשים הושפעו</span>
                  <span style={S.impactStat}><b style={S.impactN}>{nis(i.resources_invested)}</b> הושקעו</span>
                </div>
                {/* Seven distinct states, never a verified/not-verified binary:
                    partial, rejected and under_review each say what they are, so
                    a partly supported, refuted or still-being-checked claim can
                    never read as a verified one. */}
                <div style={{ ...S.verify, ...LEVEL_STYLE[i.verification_level] }}>
                  {LEVEL_MARK[i.verification_level]} {LEVEL_LABEL[i.verification_level]}
                  {" · "}{STATUS_LABEL[i.verification_status]}
                  {i.verified_fraction !== undefined &&
                    ` · אומת ${Math.round(i.verified_fraction * 100)}% מהטענה`}
                  {i.verified_by_count > 0 && ` · ${i.verified_by_count} מאמתים`}
                  {i.confidence !== undefined && ` · ביטחון ${Math.round(i.confidence * 100)}%`}
                </div>
                {/* An open request is context, not a result: it says who asked,
                    why, and which role was asked — never that the claim holds. */}
                {i.review_request && (
                  <div style={S.review}>
                    ביקש/ה בדיקה: {i.review_request.requester_name} ·{" "}
                    {i.review_request.requested_at.slice(0, 10)} · נדרש אימות מ־
                    {i.review_request.requested_verifier_role}
                    <div style={S.reviewReason}>{i.review_request.reason}</div>
                  </div>
                )}
                {i.verification && (
                  <div style={S.evidence}>
                    {i.verification.verifier_name} · {i.verification.verified_at.slice(0, 10)}
                    {i.verification.notes ? ` · ${i.verification.notes}` : ""}
                  </div>
                )}
                <div style={S.evidence}>ראיות: {i.evidence.join(" · ")}</div>
              </div>
            ))}
          </section>
        )}

        {tab === "VALUES" && (
          <section style={S.card}>
            <div style={S.cardHead}><h2 style={S.cardTitle}>ערכים</h2><span style={S.cardHint}>הערך המרכזי וההקצאות שמחזקות אותו</span></div>
            <div style={S.valueLead}>{view.central_value}</div>
            <div style={S.people}>
              {Array.from(new Set(view.allocations.map((a) => a.value_tag).filter(Boolean))).map((v) => (
                <span key={v} style={S.person}>{v}</span>
              ))}
            </div>
          </section>
        )}

        {tab === "WORLD" && (
          <section style={S.card}>
            <div style={S.cardHead}><h2 style={S.cardTitle}>עולם</h2><span style={S.cardHint}>שכבת התצוגה האחרונה, לא הראשונה</span></div>
            <div style={S.empty}>
              שכבת העולם נגזרת מאותו יומן אירועים. כרגע קיימת קבוצה אחת עם {view.event_count} אירועים —
              לא מספיק כדי להציג מפה או גלובוס שמייצגים משהו אמיתי.
            </div>
            <Link href="/planet" style={S.secondary}>לתצוגת הגלובוס הקיימת ←</Link>
          </section>
        )}
      </main>
    </div>
  );
}

const card: React.CSSProperties = { background: "rgba(18,24,38,0.7)", border: "1px solid rgba(90,120,180,0.14)", borderRadius: 16, padding: "18px 20px" };
const S: Record<string, React.CSSProperties> = {
  root: { minHeight: "100vh", background: "radial-gradient(120% 80% at 50% -10%, #0e1626 0%, #070b14 60%, #04060c 100%)", color: "#e8edf6", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
  nav: { display: "flex", alignItems: "center", gap: 28, padding: "16px 32px", borderBottom: "1px solid rgba(90,120,180,0.12)", position: "sticky", top: 0, background: "rgba(7,11,20,0.85)", backdropFilter: "blur(10px)", zIndex: 20 },
  brand: { display: "flex", alignItems: "center", gap: 9, fontSize: 15, fontWeight: 700, letterSpacing: "3px", color: "#eaf1ff" },
  mark: { width: 20, height: 20, borderRadius: "50%", background: "radial-gradient(circle at 50% 40%, #ffd477, #e08a2b 55%, transparent 75%)", boxShadow: "0 0 14px 2px rgba(255,180,80,0.5)" },
  terminals: { display: "flex", gap: 4, flex: 1, flexWrap: "wrap" },
  term: { display: "flex", flexDirection: "column", alignItems: "center", gap: 1, padding: "6px 16px", borderRadius: 10, background: "none", border: "1px solid transparent", color: "#7f93b5", cursor: "pointer", font: "inherit" },
  termActive: { color: "#eaf1ff", background: "rgba(70,120,200,0.14)", border: "1px solid rgba(110,160,240,0.3)" },
  termHe: { fontSize: 13, fontWeight: 600 }, termEn: { fontSize: 7.5, letterSpacing: "1.5px", opacity: 0.6 },
  back: { color: "#8aa0c8", fontSize: 13, textDecoration: "none" },

  page: { maxWidth: 1180, margin: "0 auto", padding: "24px 30px 46px", display: "grid", gap: 16 },

  identity: { ...card, display: "grid", gridTemplateColumns: "minmax(0,1fr) 240px", gap: 24 },
  idMain: { minWidth: 0 },
  idTop: { display: "flex", gap: 8, marginBottom: 8 },
  valueChip: { fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "rgba(70,120,200,0.18)", color: "#bcd2f5" },
  statusChip: { fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "rgba(52,211,153,0.14)", color: "#6ee7b7" },
  idName: { fontSize: 26, fontWeight: 800, margin: "0 0 6px", color: "#f4f8ff" },
  idMeta: { fontSize: 13, color: "#8aa0c8", marginBottom: 12 },
  strong: { color: "#e8edf6" },
  reason: { display: "grid", gap: 4, marginBottom: 10 },
  reasonText: { fontSize: 14, lineHeight: 1.6, color: "#cdd8ec" },
  goal: { fontSize: 14, color: "#cdd8ec" },
  goalLabel: { fontSize: 10, letterSpacing: "1px", color: "#5f7aa6", display: "block" },
  idSide: { display: "grid", gap: 10, alignContent: "start" },
  idStat: { textAlign: "center", padding: "12px 8px", borderRadius: 12, background: "rgba(90,120,180,0.10)" },
  idStatN: { fontSize: 20, fontWeight: 800, color: "#34d399" },
  idStatL: { fontSize: 10.5, color: "#6a83ad", marginTop: 3 },
  join: { padding: "11px 14px", borderRadius: 12, border: "1px solid rgba(110,160,240,0.3)", background: "rgba(70,120,200,0.2)", color: "#eaf1ff", fontSize: 14, fontWeight: 600, cursor: "pointer", font: "inherit" },
  joined: { background: "rgba(52,211,153,0.14)", borderColor: "rgba(52,211,153,0.35)", color: "#6ee7b7", cursor: "default" },
  joinNote: { fontSize: 10.5, color: "#6a83ad", lineHeight: 1.4 },

  grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 },
  card,
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: 700, margin: 0, color: "#f0f4fc" },
  cardHint: { fontSize: 10, color: "#5f7aa6" },
  prov: { fontSize: 10, color: "#5f7aa6" },
  empty: { fontSize: 13, color: "#7f93b5", lineHeight: 1.6 },
  sub: { fontSize: 12, color: "#8aa0c8", margin: "16px 0 8px", fontWeight: 600 },

  feed: { display: "grid", gap: 8 },
  feedRow: { display: "flex", alignItems: "center", gap: 10 },
  feedTime: { fontSize: 12, color: "#6a83ad", width: 42, fontVariantNumeric: "tabular-nums" },
  feedDot: { width: 7, height: 7, borderRadius: "50%", flexShrink: 0 },
  feedText: { fontSize: 13.5, color: "#cdd8ec", flex: 1 },
  feedActor: { fontSize: 11, color: "#5f7aa6" },

  leader: { display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(90,120,180,0.07)" },
  avatar: { width: 34, height: 34, borderRadius: "50%", background: "rgba(90,120,180,0.18)", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 700, color: "#cdd8ec" },
  leaderName: { fontSize: 14, fontWeight: 700, color: "#eaf1ff" },
  leaderRole: { fontSize: 12, color: "#8aa0c8" },
  leaderMeta: { fontSize: 10.5, color: "#5f7aa6", marginTop: 2 },

  people: { display: "flex", flexWrap: "wrap", gap: 8 },
  person: { fontSize: 12.5, padding: "5px 12px", borderRadius: 20, background: "rgba(90,120,180,0.12)", color: "#cdd8ec" },

  budgetRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 12 },
  budgetN: { fontSize: 17, fontWeight: 800, color: "#e8edf6", fontVariantNumeric: "tabular-nums" },
  budgetL: { fontSize: 10.5, color: "#6a83ad", marginTop: 2 },

  txn: { display: "grid", gap: 2, padding: "10px 0", borderTop: "1px solid rgba(90,120,180,0.07)" },
  txnAmt: { fontSize: 15, fontWeight: 700, color: "#e8edf6" },
  txnWho: { fontSize: 13, color: "#cdd8ec" },
  txnReason: { fontSize: 12, color: "#8aa0c8" },
  txnStatus: { fontSize: 10.5, color: "#5f7aa6" },

  alloc: { display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: "1px solid rgba(90,120,180,0.07)" },
  allocTitle: { fontSize: 13.5, color: "#eaf1ff", fontWeight: 600 },
  allocValue: { fontSize: 10.5, color: "#7f93b5", fontWeight: 400 },
  allocMeta: { fontSize: 11, color: "#7f93b5", marginTop: 3 },
  allocRight: { textAlign: "left" },
  allocAmt: { fontSize: 14, fontWeight: 700, color: "#e8edf6" },
  allocStatus: { fontSize: 10.5, color: "#8aa0c8", marginTop: 3 },
  stOk: { color: "#34d399" },
  stNear: { color: "#facc15" },

  impactBlock: { display: "grid", gap: 10 },
  impactStatement: { fontSize: 16, lineHeight: 1.6, color: "#eaf1ff", fontWeight: 500 },
  impactRow: { display: "flex", gap: 22, flexWrap: "wrap" },
  impactStat: { fontSize: 12.5, color: "#8aa0c8" },
  impactN: { fontSize: 18, color: "#f4f8ff" },
  verify: { fontSize: 12, padding: "7px 12px", borderRadius: 10, display: "inline-block", justifySelf: "start" },
  verifyOk: { background: "rgba(52,211,153,0.12)", color: "#6ee7b7" },
  verifyWeak: { background: "rgba(250,204,21,0.10)", color: "#facc15" },
  verifyPartial: { background: "rgba(125,211,252,0.10)", color: "#7dd3fc" },
  verifyBad: { background: "rgba(248,113,113,0.10)", color: "#f87171" },
  evidence: { fontSize: 10.5, color: "#5f7aa6" },
  review: { fontSize: 11, color: "#a78bfa", lineHeight: 1.5 },
  reviewReason: { fontSize: 10.5, color: "#8aa0c8", marginTop: 2 },

  valueLead: { fontSize: 22, fontWeight: 800, color: "#f4f8ff", marginBottom: 10 },
  secondary: { display: "inline-block", marginTop: 12, fontSize: 12.5, color: "#8aa0c8", textDecoration: "none" },
};
