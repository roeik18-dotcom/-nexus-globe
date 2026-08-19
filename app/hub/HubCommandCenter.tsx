/**
 * HubCommandCenter — Hub's operational orientation layer (Global Design
 * System redesign pass, on top of the A012/05B structural rebuild). Same
 * composed synthesis over data `HubPage` already computes — `core`
 * (`orientationCore.ts`), `knownNeeds`/`actionSpace` (`sharedContext.ts`),
 * `lifecycle` (`actionLifecycle.ts`) — never a second derivation.
 *
 * Visual order, top to bottom (A001's NOW/ATTENTION/OPTIONS/NEXT ACTION/
 * RECENT RESULT, in that priority) — unchanged from the structural pass;
 * this pass rebuilds ONLY the visual language on `designTokens.ts`: a
 * real display-scale title (was 17px, now the shared `TYPE.display`
 * scale), an elevated primary card (`cardStyle("primary")` — colored
 * left accent + real shadow, not a flat 1px border), and `statusBadgeStyle`
 * for every ATTENTION row instead of ad-hoc inline colors, so the same
 * REAL/BLOCKED/NEEDS_ATTENTION vocabulary reads identically here as on
 * every other redesigned surface.
 */
import type { OrientationCore } from "@/app/lib/philos/orientationCore";
import type { ActionLifecycleSummary } from "@/app/lib/philos/canon/actionLifecycle";
import { needsRequiringAction } from "@/app/lib/philos/sharedContext";
import { buildHumanTensions, sortTensions } from "@/app/lib/philos/tension";
import { encodeSystemContextRef, type ActionSpaceSummary, type KnownNeedResult } from "@/app/lib/systemContext";
import { cardStyle, COLOR, RADIUS, SPACE, statusBadgeStyle, STATUS, TYPE } from "@/app/lib/philos/shell/designTokens";

const DOMAIN_WORD: Record<"G" | "E" | "C", string> = { G: "גוף", E: "רגש", C: "שכל" };
const DOMAINS: ("G" | "E" | "C")[] = ["G", "E", "C"];

function levelState(level: number): { label: string; color: string } {
  if (level < 0) return { label: "גירעון", color: STATUS.blocked.text };
  if (level > 0) return { label: "עודף", color: STATUS.verified.text };
  return { label: "שיווי משקל", color: STATUS.claimed.text };
}

function mostRecentMark(core: OrientationCore) {
  const marks = DOMAINS.map((d) => core[d]).filter((m): m is NonNullable<typeof m> => !!m);
  if (marks.length === 0) return undefined;
  return [...marks].sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0];
}

/** Mission B, B8 — "VALUES RELEVANT NOW / GROUPS RELEVANT NOW", reached
 *  ONLY via the real `identityLink.status === "VERIFIED_SAME_PERSON"`
 *  bridge (computed in `page.tsx`, the SAME join Brain's L6 uses).
 *  `verified: false` is the honest default for most viewers today. */
export interface HubValueContext {
  verified: boolean;
  memberships: { group_name: string; central_value: string; provenance: "REAL" | "DEMO"; openTensions: number }[];
}

export default function HubCommandCenter({
  subject, core, knownNeeds, actionSpace, lifecycle, today, valueContext,
}: {
  subject: string;
  core: OrientationCore;
  knownNeeds: KnownNeedResult;
  actionSpace: ActionSpaceSummary;
  lifecycle: ActionLifecycleSummary;
  today: string;
  valueContext: HubValueContext;
}) {
  const pendingNeeds = needsRequiringAction(knownNeeds, lifecycle);
  const openLoopActions = lifecycle.actions.filter((a) => a.verification_state === "no_effect_recorded");
  const tensions = sortTensions(buildHumanTensions(core));
  const anchor = mostRecentMark(core);
  const ctx = anchor ? encodeURIComponent(encodeSystemContextRef({ kind: "canon_observation", canon_event_id: anchor.canon_event_id })) : null;
  const hasAnyObservation = !!(core.G || core.E || core.C);
  const attentionCount = tensions.length + pendingNeeds.length + openLoopActions.length;

  // NEXT ACTION — one real, computed CTA. Priority order only reflects
  // what's genuinely checked to exist; no urgency is invented when nothing
  // applies (A023).
  const primaryCTA = pendingNeeds.length > 0
    ? { label: `טפל בצורך: ${pendingNeeds[0].need.desired_change}`, href: "#action-outcomes" }
    : openLoopActions.length > 0
      ? { label: `רשום Effect ל-Action: ${openLoopActions[0].action.action.type}`, href: "#action-outcomes" }
      : tensions.length > 0
        ? { label: `בדוק Tension: ${tensions[0].label}`, href: ctx ? `/dynamics?ctx=${ctx}` : "/dynamics" }
        : !hasAnyObservation
          ? { label: "רשום תצפית עצמית ראשונה", href: "#record-observation" }
          : null;

  return (
    <section dir="rtl" style={S.card}>
      <div style={S.head}>
        <h1 style={S.title}>מרכז תפעול</h1>
        <span style={S.subject}>נושא: {subject}</span>
        <span style={S.time}>{today}</span>
        <a href={ctx ? `/dynamics?ctx=${ctx}` : "/dynamics"} style={S.dynamicsBadge}>
          Dynamics — היסטוריה מלאה ↗
        </a>
      </div>

      {/* NOW — merged current state + delta, one row per domain */}
      <Panel title="NOW · מה קורה עכשיו" accent={COLOR.accent}>
        {DOMAINS.map((d) => {
          const mark = core[d];
          const prior = d === "G" ? core.priorG : d === "E" ? core.priorE : core.priorC;
          const delta = mark && prior ? mark.level - prior.level : null;
          const linkCtx = mark ? encodeURIComponent(encodeSystemContextRef({ kind: "canon_observation", canon_event_id: mark.canon_event_id })) : null;
          return (
            <Row key={d} href={linkCtx ? `/dynamics?ctx=${linkCtx}` : undefined}>
              <span style={S.rowLabel}>{DOMAIN_WORD[d]}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {mark ? (
                  <span style={{ ...S.rowValue, color: levelState(mark.level).color }}>
                    {levelState(mark.level).label} (level {mark.level})
                  </span>
                ) : (
                  <span style={statusBadgeStyle("unknown")}>UNKNOWN</span>
                )}
                {delta !== null ? (
                  <span style={{ fontSize: 10.5, color: delta >= 0 ? STATUS.verified.text : STATUS.blocked.text }}>
                    {delta >= 0 ? "▲" : "▼"} {delta.toFixed(2)}
                  </span>
                ) : null}
              </span>
            </Row>
          );
        })}
      </Panel>

      {/* ATTENTION — merged tensions + pending Needs + no-Effect Actions */}
      <Panel title={`ATTENTION · דורש תשומת לב (${attentionCount})`} accent={attentionCount > 0 ? STATUS.needs_attention.text : STATUS.unknown.text} emphasize={attentionCount > 0}>
        {attentionCount === 0 ? (
          <Empty>נבדק — אין Tension פתוח, אין צורך ללא Action, ואין Action ללא Effect כרגע.</Empty>
        ) : (
          <>
            {tensions.map((t) => (
              <Row key={t.id} href={ctx ? `/dynamics?ctx=${ctx}` : undefined}>
                <span style={S.rowLabel}>{t.label}</span>
                <span style={statusBadgeStyle(t.severity === "high" ? "needs_attention" : t.severity === "medium" ? "claimed" : "unknown")}>
                  {t.current_state} · {t.severity}
                </span>
              </Row>
            ))}
            {pendingNeeds.map((n) => (
              <Row key={n.need.need_id} href="#action-outcomes">
                <span style={S.rowLabel}>{n.need.desired_change}</span>
                <span style={statusBadgeStyle("blocked")}>אין Action מקושר</span>
              </Row>
            ))}
            {openLoopActions.map((a) => (
              <Row key={a.action.action.action_id} href="#action-outcomes">
                <span style={S.rowLabel}>{a.action.action.type}</span>
                <span style={statusBadgeStyle("blocked")}>Action ללא Effect</span>
              </Row>
            ))}
          </>
        )}
      </Panel>

      {/* VALUES / GROUPS RELEVANT NOW — Mission B, B8. Only THIS viewer's
          own real memberships, never a dump of the full Value Universe. */}
      <Panel title="ערכים · קבוצות רלוונטיות עכשיו · VALUES/GROUPS RELEVANT NOW" accent={COLOR.accent}>
        {!valueContext.verified ? (
          <Empty>אין גשר זהות מאומת (VERIFIED_SAME_PERSON) — לא מוצג קישור מומצא. <a href="/hub/community" style={{ color: COLOR.accent }}>קישור זהות מפורש →</a></Empty>
        ) : valueContext.memberships.length === 0 ? (
          <Empty>זהות מאומתת, אך 0 חברויות קבוצה אמיתיות/DEMO כרגע.</Empty>
        ) : (
          valueContext.memberships.map((m) => (
            <Row key={m.group_name} href="/hub/community?mode=groups">
              <span style={S.rowLabel}>{m.group_name} · {m.central_value}</span>
              <span style={statusBadgeStyle(m.openTensions > 0 ? "needs_attention" : "verified")}>
                {m.provenance} · {m.openTensions > 0 ? `${m.openTensions} Tension פתוח` : "אין Tension"}
              </span>
            </Row>
          ))
        )}
      </Panel>

      {/* NEXT ACTION — one real, primary CTA */}
      <div style={S.ctaWrap}>
        {primaryCTA ? (
          <a href={primaryCTA.href} style={S.ctaButton}>{primaryCTA.label} →</a>
        ) : (
          <div style={S.ctaNone}>אין פעולה הבאה מוצדקת כרגע — הכל נבדק ותקין.</div>
        )}
      </div>

      {/* RECENT RESULT — one compact summary line */}
      <a href="#action-outcomes" style={S.recentResult}>
        <span style={S.recentResultLabel}>RECENT RESULT</span>
        <span style={S.recentResultBody}>
          {lifecycle.counts.actions_total} Actions · <span style={{ color: STATUS.verified.text }}>{lifecycle.counts.effect_verified} Effect אומת</span> ·{" "}
          <span style={{ color: STATUS.verified.text }}>{lifecycle.counts.learnings_with_state_prime} Learning אמיתי</span>
        </span>
      </a>

      {/* OPTIONS — cross-surface links, demoted below the primary flow */}
      <div style={S.nextHead}>לאן להמשיך</div>
      <div style={S.nextRow}>
        <NextLink href={`/brain?subject=${encodeURIComponent(subject)}`} label="Brain" />
        <NextLink href={ctx ? `/dynamics?ctx=${ctx}` : "/dynamics"} label="Dynamics" />
        <NextLink href="/hub/community" label="Community" />
        <NextLink href={ctx ? `/marketplace?ctx=${ctx}` : "/marketplace"} label="Marketplace" />
        <NextLink href={ctx ? `/planet?ctx=${ctx}` : "/planet"} label="Planet" />
      </div>

      <details style={{ marginTop: 14 }}>
        <summary style={{ cursor: "pointer", ...TYPE.micro, color: COLOR.textFaint }}>
          DETAILS / AUDIT — מה לא ידוע / לא נתמך במודל הקנוני
        </summary>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {actionSpace.blockers.map((b) => (
            <Row key={b}>
              <span style={S.rowLabel}>{b}</span>
              <span style={statusBadgeStyle("unknown")}>חוסם — אין נתון אמיתי</span>
            </Row>
          ))}
          <Row>
            <span style={S.rowLabel}>קבוצה/קהילה על Action</span>
            <span style={statusBadgeStyle("unknown")}>Action קנוני אינו נושא group_id</span>
          </Row>
          <Row>
            <span style={S.rowLabel}>Gap כממד עצמאי</span>
            <span style={statusBadgeStyle("unknown")}>אינו נמדד ישירות ב-canon — רק Domain/Frame/Level</span>
          </Row>
        </div>
      </details>
    </section>
  );
}

function Panel({ title, accent, children, emphasize }: { title: string; accent: string; children: React.ReactNode; emphasize?: boolean }) {
  return (
    <div style={{ ...S.panel, borderTopColor: accent, ...(emphasize ? { background: STATUS.needs_attention.bg, border: `1px solid ${STATUS.needs_attention.border}`, borderTopWidth: 2 } : {}) }}>
      <div style={{ ...TYPE.meta, color: accent, marginBottom: SPACE.sm }}>{title}</div>
      <div style={S.panelBody}>{children}</div>
    </div>
  );
}

function Row({ href, children }: { href?: string; children: React.ReactNode }) {
  const content = <div style={S.row}>{children}</div>;
  return href ? <a href={href} style={S.rowLink}>{content}</a> : content;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={S.emptyRow}>{children}</div>;
}

function NextLink({ href, label }: { href: string; label: string }) {
  return <a href={href} style={S.nextLink}>{label} →</a>;
}

const S: Record<string, React.CSSProperties> = {
  card: { ...cardStyle("primary"), marginTop: SPACE.lg },
  head: { display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: SPACE.md },
  title: { ...TYPE.display, margin: 0, color: COLOR.text },
  subject: { fontSize: 11, color: COLOR.textFaint },
  time: { fontSize: 11, color: COLOR.textFaint, fontVariantNumeric: "tabular-nums" },
  dynamicsBadge: { fontSize: 10.5, fontWeight: 700, color: "#a78bfa", textDecoration: "none", padding: "3px 10px", borderRadius: RADIUS.pill, border: "1px solid rgba(167,139,250,0.35)", marginRight: "auto" },

  panel: { borderTop: "2px solid", borderRadius: RADIUS.sm, background: COLOR.bgRaised, padding: `${SPACE.sm}px ${SPACE.md}px`, marginBottom: SPACE.sm },
  panelBody: { display: "flex", flexDirection: "column", gap: 4 },

  row: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: RADIUS.sm, background: "rgba(90,120,180,0.05)" },
  rowLink: { textDecoration: "none", color: "inherit", display: "block" },
  rowLabel: { fontSize: 12.5, color: COLOR.text },
  rowValue: { fontSize: 12.5, fontWeight: 600 },
  emptyRow: { fontSize: 11.5, color: COLOR.textFaint, fontStyle: "italic", padding: "4px 2px" },

  ctaWrap: { margin: "6px 0 10px" },
  ctaButton: { display: "block", textAlign: "center", fontSize: 14.5, fontWeight: 700, color: "#02101f", background: `linear-gradient(135deg, ${COLOR.accent}, #34d399)`, textDecoration: "none", borderRadius: RADIUS.md, padding: "13px 16px" },
  ctaNone: { textAlign: "center", fontSize: 12, color: COLOR.textFaint, fontStyle: "italic", padding: "10px 16px", border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.md },

  recentResult: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, textDecoration: "none", padding: "8px 12px", borderRadius: RADIUS.sm, background: STATUS.verified.bg, border: `1px solid ${STATUS.verified.border}`, marginBottom: SPACE.sm },
  recentResultLabel: { ...TYPE.micro, color: COLOR.textFaint },
  recentResultBody: { fontSize: 11.5, color: COLOR.text },

  nextHead: { ...TYPE.micro, color: COLOR.textFaint, marginTop: 6, marginBottom: 6 },
  nextRow: { display: "flex", flexWrap: "wrap", gap: 6 },
  nextLink: { fontSize: 11, textDecoration: "none", color: COLOR.textDim, padding: "5px 10px", borderRadius: RADIUS.sm, border: `1px solid ${COLOR.border}`, background: COLOR.bgRaised },
};
