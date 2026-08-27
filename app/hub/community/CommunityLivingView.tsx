/**
 * CommunityLivingView — the real, primary `/hub/community` first
 * viewport (ledger §38). Renders ONLY real data already produced by
 * `projectValueGroup.ts`/`buildActivityFeed`/`buildContributorRanking`/
 * `findNeedsForSubject` — no new fact, no new model, no invented number.
 *
 * Replaces the previous default view, which led with identity-link debug
 * prose, a treasury report, and long implementation notes before any
 * human-legible sense of "what is this community, what is happening in
 * it, who is in it." Everything that view showed is preserved verbatim —
 * `CommunityCommandTerminal`/`CommunityComparison` still render, just
 * demoted under a collapsed Details/Audit toggle by the caller
 * (`page.tsx`), not deleted.
 */
import type { ValueGroupView, ActivityFeedItem, ContributorRankingEntry } from "@/app/lib/philos/projectValueGroup";
import type { ShellIdentityLink } from "@/app/lib/philos/shell/SystemShell";
import {
  ASSURANCE_LABEL, ASSURANCE_TONE, NO_INDEPENDENT_VERIFICATION,
  shortAssurance, isLinkedTier,
} from "@/app/lib/philos/community/identityAssuranceVocabulary";

export type Provenance = "REAL" | "DEMO";

const KIND_ICON: Record<string, string> = {
  need: "🆘", post: "📝", event: "📅", join: "👋", money: "💸", vote: "🗳️", impact: "✅",
};
const KIND_LABEL: Record<string, string> = {
  need: "בקשה", post: "עדכון", event: "מפגש", join: "הצטרפות", money: "תנועת כסף", vote: "הצבעה/הקצאה", impact: "השפעה",
};

export default function CommunityLivingView({
  group,
  activity,
  contributors,
  identityLink,
  provenance,
  realNeedsCount,
  realOffersCount,
  valueFamilyLabel,
}: {
  group: ValueGroupView;
  activity: ActivityFeedItem[];
  contributors: ContributorRankingEntry[];
  identityLink: ShellIdentityLink;
  provenance: Provenance;
  /** Mission B, continuation — the reciprocal of the Value detail page's
   *  FAMILY/SUBVALUES row (B2): which 328-universe Value Family this
   *  group's own real `central_value` matched, if any. Computed in
   *  `page.tsx` via the SAME `universeSubvalues` join, never re-derived
   *  here. `undefined` = no real match (never forced). */
  valueFamilyLabel?: string;
  /** Real canon `findNeedsForSubject` count for the identity-linked
   *  person — 0 today (checked, not fabricated). */
  realNeedsCount: number;
  /** Real canon Offer count — 0 today, no Offer persistence exists yet
   *  (stated honestly rather than silently omitted). */
  realOffersCount: number;
}) {
  const badgeColor = provenance === "DEMO" ? "#fbbf24" : "#34d399";
  const verifiedEffects = group.impact.filter((i) => i.verified);
  const activeCount = new Set(contributors.filter((c) => c.event_count > 0).map((c) => c.person_id)).size;

  // The one real founding story this community's own log carries — the
  // SAME real fields CommunityCommandTerminal/valueGroupLog.ts already
  // expose, just assembled into one visible chain instead of scattered
  // across sections. See module header.
  const elderAllocation = group.allocations.find((a) => a.title.includes("קשיש"));
  const elderTransfer = group.transfers.find((t) => t.purpose.includes("קשיש"));
  const elderImpact = group.impact.find((i) => i.allocation_id === elderAllocation?.allocation_id) ?? group.impact.find((i) => i.statement.includes("קשיש"));

  return (
    <div dir="rtl" style={S.wrap}>
      {/* HERO — the 5 numbers that matter, first, nothing else. */}
      <div style={S.hero}>
        <div style={S.heroTop}>
          <span style={{ ...S.badge, color: badgeColor, borderColor: `${badgeColor}55` }}>{provenance}</span>
          <h1 style={S.heroTitle}>{group.name}</h1>
          <span style={S.heroRegion}>{group.region}</span>
          <IdentityBadge identityLink={identityLink} />
        </div>
        <div style={S.heroStats}>
          <HeroStat value={group.members.length} label="PEOPLE" />
          <HeroStat value={`₪${group.budget.available.toLocaleString()}`} label="AVAILABLE" />
          <HeroStat value={group.allocations.length} label="INITIATIVES" />
          <HeroStat value={group.event_count} label="EVENTS" />
          <HeroStat value={verifiedEffects.length} label="VERIFIED EFFECT" color="#34d399" />
        </div>
      </div>

      {/* Quick nav — plain in-page anchors, no client JS needed. */}
      <nav style={S.quickNav}>
        {[["#live", "LIVE NOW"], ["#people", "PEOPLE"], ["#values", "VALUES"], ["#needs", "NEEDS"], ["#capital", "CAPITAL"], ["#story", "ACTIONS → EFFECTS"]].map(([href, label]) => (
          <a key={href} href={href} style={S.quickNavLink}>{label}</a>
        ))}
      </nav>

      {/* LIVE NOW */}
      <Section id="live" title="עכשיו ברשת · LIVE NOW">
        {activity.length === 0 ? (
          <Empty>אין פעילות רשומה.</Empty>
        ) : (
          <div style={S.feed}>
            {activity.map((a) => (
              <div key={a.event_id} style={S.feedRow}>
                <span style={S.feedIcon}>{KIND_ICON[a.kind] ?? "•"}</span>
                <span style={S.feedText}>
                  <b style={S.feedActor}>{a.actor_name}</b> · {KIND_LABEL[a.kind] ?? a.kind}
                  {a.text ? <span style={S.feedDetail}> — {a.text}</span> : null}
                </span>
                <span style={S.feedTime}>{a.date} {a.time}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* PEOPLE */}
      <Section id="people" title={`אנשים · PEOPLE (${group.members.length})`}>
        <div style={S.peopleGrid}>
          {group.members.map((m) => {
            const leader = group.leaders.find((l) => l.person_id === m.person_id);
            const activityCount = contributors.find((c) => c.person_id === m.person_id)?.event_count ?? 0;
            return (
              <div key={m.person_id} style={S.personCard}>
                <div style={S.personName}>{m.display_name}</div>
                <div style={S.personMeta}>{activityCount} פעולות רשומות</div>
                {leader ? <div style={S.personRole}>{leader.role_label}</div> : null}
              </div>
            );
          })}
        </div>
        <div style={S.note}>{activeCount} מתוך {group.members.length} יצרו לפחות אירוע אמיתי אחד.</div>
      </Section>

      {/* VALUES */}
      <Section id="values" title="ערכים · VALUES">
        <div style={S.valueChip}>{group.central_value}</div>
        {valueFamilyLabel ? (
          <div style={{ ...S.note, color: "#34d399" }}>משפחת ערך (328 Board reconciliation): {valueFamilyLabel}</div>
        ) : (
          <div style={S.note}>0 — אין משפחת ערך תואמת ביקום ה-328 עבור central_value זה.</div>
        )}
        <div style={S.note}>
          ערך ידוע יחיד לקהילה זו. תשתית ליחסים בין ערכים (ALIGNMENT / OPPOSITION / OVERLAP / COMMON_GROUND / TENSION)
          קיימת אך לא מאוכלסת — אין עוד ערך שני אמיתי לקהילה זו להשוואה, ולא הומצא אחד.
        </div>
      </Section>

      {/* NEEDS / RESOURCES */}
      <Section id="needs" title="צרכים ומשאבים · NEEDS / RESOURCES">
        <div style={S.needsGrid}>
          <NeedsCell label="OPEN NEEDS (canon)" value={realNeedsCount} />
          <NeedsCell label="AVAILABLE RESOURCES (canon Offer)" value={realOffersCount} />
          <NeedsCell label="CAPABILITIES" value={0} />
          <NeedsCell label="CONSTRAINTS" value={0} />
        </div>
      </Section>

      {/* CAPITAL */}
      <Section id="capital" title="הון · CAPITAL">
        <div style={S.capitalFlow}>
          <CapitalNode label="RECEIVED" value={group.budget.received} color="#34d399" />
          <FlowArrow />
          <CapitalNode label="DEPLOYED" value={group.budget.spent} color="#f2635c" />
          <FlowArrow />
          <CapitalNode label="COMMITTED" value={group.budget.committed} color="#fbbf24" />
          <FlowArrow />
          <CapitalNode label="AVAILABLE" value={group.budget.available} color="#5b9cf6" />
        </div>
        {group.allocations.length > 0 ? (
          <div style={S.allocList}>
            {group.allocations.map((a) => (
              <div key={a.allocation_id} style={S.allocRow}>
                <span style={S.allocTitle}>{a.title}</span>
                <span style={S.allocMeta}>₪{a.amount.toLocaleString()} · {a.people_affected_estimate} אנשים · {a.votes_for}/{a.votes_required} קולות</span>
                <span style={{ ...S.allocState, color: ALLOC_COLOR[a.state] }}>{ALLOC_LABEL[a.state]}</span>
              </div>
            ))}
          </div>
        ) : null}
      </Section>

      {/* ACTIONS → EFFECTS — the one real, evidenced chain this
          community's log actually supports. */}
      <Section id="story" title="מהבעיה לתוצאה · NEED → ACTION → EFFECT">
        <div style={S.chain}>
          <ChainNode label="PROBLEM" status="known" text={group.creation_reason} />
          <ChainArrow />
          <ChainNode label="NEED (canon)" status={realNeedsCount > 0 ? "known" : "gap"} text={realNeedsCount > 0 ? `${realNeedsCount} רשומ(ות) Need קנוני` : "NOT REGISTERED — אין Need קנוני מקושר לסיפור זה"} />
          <ChainArrow />
          <ChainNode
            label="PROPOSAL / CAPITAL"
            status={elderAllocation ? "known" : "gap"}
            text={elderAllocation ? `${elderAllocation.title} · ₪${elderAllocation.amount.toLocaleString()}` : "לא נמצאה הצעת הקצאה תואמת"}
          />
          <ChainArrow />
          <ChainNode
            label="DECISION"
            status={elderAllocation ? "known" : "gap"}
            text={elderAllocation ? `${elderAllocation.votes_for}/${elderAllocation.votes_required} קולות · ${ALLOC_LABEL[elderAllocation.state]}` : "לא ידוע"}
          />
          <ChainArrow />
          <ChainNode
            label="ACTION"
            status={elderTransfer ? "partial" : "gap"}
            text={
              elderTransfer
                ? `Transfer מוצג-מוגן (legacy): ₪${elderTransfer.amount.toLocaleString()} → ${elderTransfer.recipient} · canon Action: לא ידוע (אין group_id על Action קנוני)`
                : "UNKNOWN — אין Transfer תואם"
            }
          />
          <ChainArrow />
          <ChainNode
            label="EFFECT"
            status={elderImpact?.verified ? "known" : elderImpact ? "partial" : "gap"}
            text={elderImpact ? `${elderImpact.statement}${elderImpact.verified ? " — VERIFIED" : ` — ${elderImpact.verification_level}`}` : "אין Effect רשום"}
          />
          <ChainArrow />
          <ChainNode
            label="EVIDENCE"
            status={elderImpact?.verification ? "known" : "gap"}
            text={elderImpact?.verification ? `${elderImpact.verification.method} · ${elderImpact.verification.verifier_name}${elderImpact.verification.notes ? ` — "${elderImpact.verification.notes}"` : ""}` : "אין רשומת אימות"}
          />
        </div>
      </Section>
    </div>
  );
}

/** Exported as a test seam: this badge is the identity conclusion a person
 *  reads on the community screen, and it is asserted directly. */
export function IdentityBadge({ identityLink }: { identityLink: ShellIdentityLink }) {
  /* The TIER decides the badge, not the stored status. This printed
     `identityLink.status` verbatim, so a two-step self-report appeared as
     the word VERIFIED on a community screen. */
  const color = identityLink.status === "CONFLICT"
    ? "#f2635c" : ASSURANCE_TONE[identityLink.assurance];
  return (
    <span style={{ ...S.identityBadge, color, borderColor: `${color}55` }} title={`${identityLink.person_id} ↔ ${identityLink.community_member_id}`}>
      ⚭ {shortAssurance(identityLink.assurance)}
    </span>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={S.section}>
      <div style={S.sectionTitle}>{title}</div>
      {children}
    </section>
  );
}

function HeroStat({ value, label, color }: { value: number | string; label: string; color?: string }) {
  return (
    <div style={S.heroStat}>
      <div style={{ ...S.heroStatValue, color: color ?? "#f0f4fc" }}>{value}</div>
      <div style={S.heroStatLabel}>{label}</div>
    </div>
  );
}

function NeedsCell({ label, value }: { label: string; value: number }) {
  return (
    <div style={S.needsCell}>
      <div style={{ ...S.needsCellValue, color: value > 0 ? "#34d399" : "#6c86b5" }}>{value > 0 ? value : "NOT YET REGISTERED"}</div>
      <div style={S.needsCellLabel}>{label}</div>
    </div>
  );
}

function CapitalNode({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={S.capitalNode}>
      <div style={{ ...S.capitalNodeValue, color }}>₪{value.toLocaleString()}</div>
      <div style={S.capitalNodeLabel}>{label}</div>
    </div>
  );
}

function FlowArrow() {
  return <div style={S.flowArrow}>→</div>;
}

const CHAIN_STATUS_COLOR: Record<"known" | "partial" | "gap", string> = { known: "#34d399", partial: "#fbbf24", gap: "#6c86b5" };

function ChainNode({ label, status, text }: { label: string; status: "known" | "partial" | "gap"; text: string }) {
  return (
    <div style={{ ...S.chainNode, borderColor: `${CHAIN_STATUS_COLOR[status]}55` }}>
      <div style={{ ...S.chainNodeLabel, color: CHAIN_STATUS_COLOR[status] }}>{label}</div>
      <div style={S.chainNodeText}>{text}</div>
    </div>
  );
}

function ChainArrow() {
  return <div style={S.chainArrow}>↓</div>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={S.emptyRow}>{children}</div>;
}

const ALLOC_LABEL: Record<string, string> = { voting: "בהצבעה", approved: "אושר", transferred: "הועבר" };
const ALLOC_COLOR: Record<string, string> = { voting: "#fbbf24", approved: "#5b9cf6", transferred: "#34d399" };

const S: Record<string, React.CSSProperties> = {
  wrap: { fontFamily: "system-ui", color: "#e6ebf5" },

  hero: { background: "linear-gradient(135deg, rgba(52,211,153,0.08), rgba(91,156,246,0.05))", border: "1px solid rgba(52,211,153,0.25)", borderRadius: 16, padding: "18px 20px", margin: "16px 20px 0" },
  heroTop: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  badge: { fontSize: 12, fontWeight: 800, padding: "2px 8px", borderRadius: 6, border: "1px solid", fontFamily: "ui-monospace, monospace" },
  heroTitle: { fontSize: 22, fontWeight: 800, margin: 0, color: "#f0f4fc" },
  heroRegion: { fontSize: 13, color: "#8fa3c9" },
  identityBadge: { fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 10, border: "1px solid", fontFamily: "ui-monospace, monospace", marginRight: "auto" },
  heroStats: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10, marginTop: 16 },
  heroStat: { textAlign: "center" },
  heroStatValue: { fontSize: 24, fontWeight: 800 },
  heroStatLabel: { fontSize: 12, color: "#8fa3c9", letterSpacing: 0.5, marginTop: 2 },

  quickNav: { display: "flex", flexWrap: "wrap", gap: 6, margin: "12px 20px" },
  quickNavLink: { fontSize: 13, padding: "4px 10px", borderRadius: 12, border: "1px solid rgba(90,120,180,0.3)", color: "#8fa3c9", textDecoration: "none" },

  section: { margin: "0 20px 16px", padding: "14px 16px", background: "rgba(18,24,38,0.6)", border: "1px solid rgba(90,120,180,0.16)", borderRadius: 14 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: "#5aa6ff", letterSpacing: 0.5, marginBottom: 10 },

  feed: { display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflowY: "auto" },
  feedRow: { display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 6, background: "rgba(90,120,180,0.05)", fontSize: 13 },
  feedIcon: { fontSize: 15 },
  feedText: { flex: 1, color: "#dbe6f6" },
  feedActor: { color: "#f0f4fc" },
  feedDetail: { color: "#8fa3c9" },
  feedTime: { fontSize: 12, color: "#6c86b5", whiteSpace: "nowrap" },

  peopleGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 },
  personCard: { border: "1px solid rgba(90,120,180,0.2)", borderRadius: 10, padding: "8px 10px", background: "rgba(90,120,180,0.04)" },
  personName: { fontSize: 13, fontWeight: 700, color: "#dbe6f6" },
  personMeta: { fontSize: 12, color: "#8aa0c8", marginTop: 3 },
  personRole: { fontSize: 12, color: "#a78bfa", marginTop: 2 },

  valueChip: { display: "inline-block", fontSize: 15, fontWeight: 700, padding: "5px 14px", borderRadius: 14, background: "rgba(91,156,246,0.12)", color: "#5b9cf6", marginBottom: 8 },

  needsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 },
  needsCell: { border: "1px solid rgba(90,120,180,0.2)", borderRadius: 10, padding: "10px 12px" },
  needsCellValue: { fontSize: 15, fontWeight: 800 },
  needsCellLabel: { fontSize: 12, color: "#8aa0c8", marginTop: 3 },

  capitalFlow: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 10 },
  capitalNode: { textAlign: "center", minWidth: 90 },
  capitalNodeValue: { fontSize: 16, fontWeight: 800 },
  capitalNodeLabel: { fontSize: 12, color: "#8aa0c8", letterSpacing: 0.5, marginTop: 2 },
  flowArrow: { color: "#6c86b5", fontSize: 14 },

  allocList: { display: "flex", flexDirection: "column", gap: 4 },
  allocRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: "rgba(90,120,180,0.06)", flexWrap: "wrap" },
  allocTitle: { fontSize: 13, color: "#e8edf6" },
  allocMeta: { fontSize: 12, color: "#8aa0c8" },
  allocState: { fontSize: 13, fontWeight: 700 },

  chain: { display: "flex", flexDirection: "column", alignItems: "stretch", gap: 2 },
  chainNode: { border: "1px solid", borderRadius: 10, padding: "8px 12px", background: "rgba(90,120,180,0.04)" },
  chainNodeLabel: { fontSize: 12, fontWeight: 800, letterSpacing: 0.5 },
  chainNodeText: { fontSize: 13, color: "#dbe6f6", marginTop: 3, lineHeight: 1.5 },
  chainArrow: { textAlign: "center", color: "#6c86b5", fontSize: 13 },

  note: { fontSize: 13, color: "#6c86b5", marginTop: 8, lineHeight: 1.6 },
  emptyRow: { fontSize: 13, color: "#7b8ca6", fontStyle: "italic", padding: "4px 2px" },
};
