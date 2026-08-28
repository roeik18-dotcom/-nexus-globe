"use client";

/**
 * RealMarketplace — the real, primary `/marketplace` first viewport
 * (Marketplace Legacy Convergence pass). Consumes ONLY the real PHILOS
 * canonical spine — canon `Need` (`needStoreAccessor.ts`), the new canon
 * `Offer` persistence (`offerStoreAccessor.ts`, built this pass), real
 * `Action`/`Effect` (`actionStoreAccessor.ts`/`effectStoreAccessor.ts`) —
 * never the PUDM/Fashion dataset (`MarketplaceView.tsx`, demoted to
 * LEGACY/Details by `page.tsx`) and never the DEMO compost scenario
 * (`DemoMarketplaceFlow.tsx`, demoted to explicit DEMO by `page.tsx`).
 *
 * REAL_MATCHES is honestly, structurally always 0 here — not a bug.
 * `matching.ts::evaluateMatch` requires an explicit, human-supplied
 * `MatchAttempt` (6 boolean gates: CAN/WANTS/ALLOWED/APPROPRIATE/
 * AVAILABLE/CONSENT) for a specific Need×Offer pair; nothing may
 * auto-generate those gates without fabricating a judgment nobody made
 * (matching.ts's own header: "Need is sovereign; Offer does not
 * auto-create a match"). No MatchAttempt-creation UI exists yet — a real,
 * separate, human-judgment design task, stated as a TRUE_BLOCKER, not
 * built here.
 *
 * REAL_COMMITMENTS maps to real canon Actions with `type === "transfer"`
 * (Transfer ⊂ Action, canon §11/§13) — the closest real canonical concept
 * to "commitment"; canon defines no separate Commitment object.
 */
import { useState, useTransition } from "react";
import type { NeedRecord } from "@/app/lib/philos/canon/needStore";
import type { OfferRecord } from "@/app/lib/philos/canon/offerStore";
import type { ActionRecord } from "@/app/lib/philos/canon/actionStore";
import type { EffectRecord } from "@/app/lib/philos/canon/effectStore";
import type { ShellIdentityLink } from "@/app/lib/philos/shell/SystemShell";
import { registerNeedAction, registerOfferAction, type RegisterActionResult } from "./actions";
import MarketplaceFlow, { type FlowStage } from "./MarketplaceFlow";

type ActivityItem = { time: string; kind: "need" | "offer" | "action" | "effect"; text: string; ctx?: string };

export default function RealMarketplace({
  needs,
  offers,
  actions,
  effects,
  identityLink,
  realGroup,
  groupRelations,
  realGroupOps,
  verifiedEffectIds = [],
}: {
  needs: NeedRecord[];
  offers: OfferRecord[];
  actions: ActionRecord[];
  /** Effects an independent person verified — from the one shared read, not
   *  from `effect.verified_outcome`, which the reporter could once set. */
  verifiedEffectIds?: readonly string[];
  effects: EffectRecord[];
  identityLink: ShellIdentityLink;
  /** The REAL Value Group's name/central value — page.tsx already projects
   *  it for the group join; passed through for flow-band ownership only. */
  realGroup?: { name: string; central_value: string };
  /** Person↔group relations from the ONE shared Value Group resolver —
   *  real records only (MEMBER_OF/CONTRIBUTES_TO/…), computed in page.tsx. */
  groupRelations?: string[];
  /** Operational facts about the REAL group (members, verified effects,
   *  linked actions) — group CONTEXT for the flow; explicitly not
   *  transaction relevance. */
  realGroupOps?: { group_id: string; members: number; verifiedEffects: number; bridgeActions: number; opened_at: string };
}) {
  const commitments = actions.filter((a) => a.action.type === "transfer");

  const activity: ActivityItem[] = [
    ...needs.map((n) => ({ time: n.recorded_at, kind: "need" as const, text: n.need.desired_change })),
    ...offers.map((o) => ({ time: o.recorded_at, kind: "offer" as const, text: o.offer.available_resource })),
    ...actions.map((a) => ({ time: a.recorded_at, kind: "action" as const, text: `${a.action.type} · ${a.action.owner}`, ctx: `action:${a.action.action_id}` })),
    ...effects.map((e) => ({ time: e.recorded_at, kind: "effect" as const, text: e.effect.claimed_outcome.statement, ctx: `effect:${e.effect.effect_id}` })),
  ].sort((a, b) => b.time.localeCompare(a.time));

  // ── Flow-stage data (Visual Delivery pass) — pure folds over the four
  // canon stores this component already receives. `last` = most recently
  // RECORDED, the same recorded_at sort the activity feed above uses. ──────
  const last = <T,>(rows: T[], time: (r: T) => string): T | null =>
    rows.length === 0 ? null : [...rows].sort((a, b) => time(b).localeCompare(time(a)))[0];
  const lastNeed = last(needs, (n) => n.recorded_at);
  const lastOffer = last(offers, (o) => o.recorded_at);
  const lastAction = last(actions, (a) => a.recorded_at);
  const lastEffect = last(effects, (e) => e.recorded_at);
  // REALIZED matches — the real, mechanical trace: an Action whose inputs
  // reference BOTH a stored Need and a stored Offer. MatchPermit itself is
  // derived-not-persisted by design (`matchPermit.ts`), so this join over
  // real records is the only honest non-zero MATCH count possible.
  const needIds = new Set(needs.map((n) => n.need.need_id));
  const offerIds = new Set(offers.map((o) => o.offer.offer_id));
  const realizedMatches = actions.filter((a) =>
    a.action.inputs.some((id) => needIds.has(id)) && a.action.inputs.some((id) => offerIds.has(id)));
  const lastMatch = last(realizedMatches, (a) => a.recorded_at);
  const evidence = effects.filter((e) => verifiedEffectIds.includes(e.effect.effect_id));
  const lastEvidence = last(evidence, (e) => e.recorded_at);

  const flowStages: FlowStage[] = [
    // VALUE GROUP — the operational group as flow CONTEXT (its own real
    // members/effects/linked actions). Never transaction relevance:
    // the Need node's owner stays the person, and membership certifies
    // nothing about the transaction.
    ...(realGroup && realGroupOps ? [{
      key: "group", label: "קבוצת ערך", gloss: "ההקשר הקבוצתי", count: realGroupOps.members, href: "/hub/community?mode=groups&community=" + encodeURIComponent(realGroupOps.group_id),
      sub: `${realGroupOps.verifiedEffects} verified effects · ${realGroupOps.bridgeActions} linked actions`,
      latest: { text: `${realGroup.name} · ${realGroup.central_value}`, owner: realGroupOps.group_id, time: realGroupOps.opened_at },
      provenance: "REAL" as const,
      note: "קבוצה תפעולית כהקשר — Need שייך לאדם; חברות אינה רלוונטיות עסקה",
    } satisfies FlowStage] : []),
    {
      key: "need", label: "צורך", gloss: "מה חסר", count: needs.length, href: "#need",
      latest: lastNeed ? { text: lastNeed.need.desired_change, owner: lastNeed.need.subject, time: lastNeed.recorded_at } : null,
      provenance: "CANON", note: lastNeed ? undefined : "לא נרשם Need אמיתי",
    },
    {
      key: "offer", label: "הצעה", gloss: "מה זמין", count: offers.length, href: "#offer",
      latest: lastOffer ? { text: lastOffer.offer.available_resource, owner: lastOffer.offer.source, time: lastOffer.recorded_at } : null,
      provenance: "CANON", note: lastOffer ? undefined : "לא נרשם Offer אמיתי",
    },
    {
      key: "match", label: "התאמה", gloss: "מה חובר", count: realizedMatches.length, href: "#match",
      latest: lastMatch ? { text: `${lastMatch.action.type} על Need+Offer אמיתיים`, owner: lastMatch.action.owner, time: lastMatch.recorded_at } : null,
      provenance: "STATIC",
      note: lastMatch
        ? "נגזר מ-inputs של Action — permit אינו נשמר בכוונה"
        : "אין Action שמחבר Need+Offer; MatchPermit נגזר ולא נשמר — לא מומצא כאן",
    },
    {
      key: "action", label: "פעולה", gloss: "מה נעשה", count: actions.length, href: "#action",
      sub: `${actions.filter((a) => a.action.type === "transfer").length} transfers`,
      latest: lastAction ? { text: `${lastAction.action.type} · ${lastAction.action.mechanism_scope}`, owner: lastAction.action.owner, time: lastAction.recorded_at } : null,
      provenance: "CANON", note: lastAction ? undefined : "לא נרשמה Action אמיתית",
    },
    {
      key: "effect", label: "תוצאה", gloss: "מה נטען שקרה", count: effects.length, href: "#result",
      latest: lastEffect ? { text: lastEffect.effect.claimed_outcome.statement, owner: lastEffect.effect.subject, time: lastEffect.recorded_at } : null,
      provenance: "CANON", note: lastEffect ? undefined : "לא נרשם Effect",
    },
    {
      key: "evidence", label: "ראיה", gloss: "מה מאומת", count: evidence.length, href: "#result",
      sub: `מתוך ${effects.length} claims`,
      latest: lastEvidence
        ? { text: lastEvidence.effect.claimed_outcome.statement, owner: `אומת בנפרד · ${lastEvidence.effect.subject}`, time: lastEvidence.recorded_at }
        : null,
      provenance: "CANON",
      note: lastEvidence ? undefined : effects.length > 0 ? "תוצאות דווחו בלבד — אף אחת לא אומתה בידי אדם אחר" : "אין Effect לאמת",
    },
  ];

  return (
    <div dir="rtl" style={S.wrap}>
      {/* THE SEVEN-CARD FLOW BAND, DEMOTED — not deleted.
          `MarketMatchView` above this component now draws the same pipeline
          as a sized chain, where the asymmetry (one Need, nine members, zero
          verified evidence) is the visible thing. Seven equal-width cards
          erased exactly that, and clipped horizontally at 1440px.

          It stays one disclosure down because it carries per-stage detail the
          drawing deliberately does not: each stage's own id, timestamp and
          provenance chip. That is a REFERENCE view of the same records, and
          it is the right form for checking one stage — just not for reading
          the pipeline. */}
      <details style={S.flowDetails}>
        <summary style={S.flowSummary}>
          שלבי הזרימה, כרטיס לכל שלב
          <span style={S.flowCount}>{flowStages.length} שלבים</span>
        </summary>
        <div style={{ marginTop: 10 }}>
          <MarketplaceFlow
            stages={flowStages}
            person={identityLink.status === "VERIFIED_SAME_PERSON" ? identityLink.person_id : undefined}
            valueGroup={identityLink.status === "VERIFIED_SAME_PERSON" && realGroup ? { ...realGroup, provenance: "REAL" } : undefined}
          />
        </div>
      </details>
      {groupRelations && groupRelations.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, margin: "0 0 10px", fontSize: 12 }}>
          <span style={{ fontWeight: 800, letterSpacing: 0.6, color: "#8fa3c9" }}>PERSON↔GROUP (הקשר אישי — לא רלוונטיות עסקה):</span>
          {groupRelations.map((r) => (
            <span key={r} style={{ border: "1px solid rgba(52,211,153,0.35)", color: "#6fe3b4", borderRadius: 999, padding: "2px 8px", fontFamily: "ui-monospace, monospace" }}>{r}</span>
          ))}
        </div>
      ) : null}

      {/* WHAT I NEED — leads, real form immediately available */}
      <Section id="need" title={`מה אני צריך · WHAT I NEED (${needs.length})`}>
        {needs.length === 0 ? <Empty>עדיין לא נרשם Need אמיתי — רשמו אחד למטה.</Empty> : (
          <div style={S.list}>
            {needs.map((n) => (
              <div key={n.need.need_id} style={S.listRow}>
                <span style={S.listTitle}>{n.need.desired_change}</span>
                <span style={S.listMeta}>{n.need.subject} · {n.need.scope.kind === "domain" ? n.need.scope.domain : "cells"} · עד {n.need.expiry.slice(0, 10)}</span>
              </div>
            ))}
          </div>
        )}
        <RegisterNeedForm identityLink={identityLink} />
      </Section>

      {/* WHAT I CAN OFFER */}
      <Section id="offer" title={`מה אני יכול להציע · WHAT I CAN OFFER (${offers.length})`}>
        {offers.length === 0 ? <Empty>עדיין לא נרשם Offer אמיתי — רשמו אחד למטה.</Empty> : (
          <div style={S.list}>
            {offers.map((o) => (
              <div key={o.offer.offer_id} style={S.listRow}>
                <span style={S.listTitle}>{o.offer.available_resource}</span>
                <span style={S.listMeta}>{o.offer.source} · {o.offer.resource_type} · {o.offer.amount_or_capacity}</span>
              </div>
            ))}
          </div>
        )}
        <RegisterOfferForm identityLink={identityLink} />
      </Section>

      {/* POSSIBLE MATCHES — honest 0, structural (no MatchAttempt exists
          without an explicit human judgment on all 6 gates) */}
      <Section id="match" title="התאמות אפשריות · POSSIBLE MATCHES (0)">
        <Empty>
          דורש MatchAttempt אמיתי עם שישה שערי בוליאני (CAN/WANTS/ALLOWED/APPROPRIATE/AVAILABLE/CONSENT) —
          איש לא קבע עדיין לאף זוג Need×Offer. לא מוצג ניחוש אוטומטי.
        </Empty>
      </Section>

      {/* ACTIVE COMMITMENTS — real canon Transfer actions */}
      <Section id="commitment" title={`מחויבויות פעילות · ACTIVE COMMITMENTS (${commitments.length})`}>
        {commitments.length === 0 ? <Empty>אין עדיין Commitment (Transfer Action) אמיתי.</Empty> : (
          <div style={S.list}>
            {commitments.map((c) => (
              <a key={c.action.action_id} href={`?ctx=${encodeURIComponent(`action:${c.action.action_id}`)}`} style={{ ...S.listRow, textDecoration: "none", color: "inherit" }}>
                <span style={S.listTitle}>{c.action.owner}</span>
                <span style={S.listMeta}>{c.action.mechanism_scope}</span>
              </a>
            ))}
          </div>
        )}
      </Section>

      {/* RESULTS — realized Effects */}
      <Section id="result" title={`תוצאות · RESULTS (${effects.length})`}>
        {effects.length === 0 ? <Empty>0 REAL EFFECTS — אין Effect קנוני אמיתי רשום כרגע.</Empty> : (
          <div style={S.list}>
            {effects.map((e) => (
              <a key={e.effect.effect_id} href={`?ctx=${encodeURIComponent(`effect:${e.effect.effect_id}`)}`} style={{ ...S.listRow, textDecoration: "none", color: "inherit" }}>
                <span style={S.listTitle}>{e.effect.claimed_outcome.statement}</span>
                <span style={{ ...S.listMeta, color: verifiedEffectIds.includes(e.effect.effect_id) ? "#34d399" : "#6c86b5" }}>
                  {verifiedEffectIds.includes(e.effect.effect_id) ? "VERIFIED" : "claimed only"}
                </span>
              </a>
            ))}
          </div>
        )}
      </Section>

      <details style={{ margin: "12px 20px" }}>
        <summary style={{ cursor: "pointer", fontSize: 13, letterSpacing: 1, color: "#6c86b5", padding: "4px 0" }}>
          פעילות שוק גולמית אחרונה
        </summary>
        <div style={{ marginTop: 8 }}>
          {activity.length === 0 ? (
            <Empty>אין עדיין פעילות שוק אמיתית רשומה.</Empty>
          ) : (
            <div style={S.feed}>
              {activity.slice(0, 12).map((a, i) =>
                a.ctx ? (
                  <a key={i} href={`?ctx=${encodeURIComponent(a.ctx)}`} style={{ ...S.feedRow, textDecoration: "none", color: "inherit" }}>
                    <span style={{ ...S.feedKind, color: KIND_COLOR[a.kind] }}>{a.kind.toUpperCase()}</span>
                    <span style={S.feedText}>{a.text}</span>
                    <span style={S.feedTime}>{a.time.slice(0, 16).replace("T", " ")}</span>
                  </a>
                ) : (
                  <div key={i} style={S.feedRow}>
                    <span style={{ ...S.feedKind, color: KIND_COLOR[a.kind] }}>{a.kind.toUpperCase()}</span>
                    <span style={S.feedText}>{a.text}</span>
                    <span style={S.feedTime}>{a.time.slice(0, 16).replace("T", " ")}</span>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

function RegisterNeedForm({ identityLink }: { identityLink: ShellIdentityLink }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RegisterActionResult | null>(null);
  const [text, setText] = useState("");

  const submit = () => {
    setResult(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("desired_change", text);
      fd.set("domain", "E");
      const r = await registerNeedAction(fd);
      setResult(r);
      if (r.ok) setText("");
    });
  };

  return (
    <div style={S.form}>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`רישום Need אמיתי עבור ${identityLink.person_id}…`} style={S.input} />
      <button disabled={pending || !text.trim()} onClick={submit} style={S.button}>{pending ? "…" : "רשום Need"}</button>
      {result && !result.ok ? <div style={S.error}>{result.message}</div> : null}
    </div>
  );
}

function RegisterOfferForm({ identityLink }: { identityLink: ShellIdentityLink }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RegisterActionResult | null>(null);
  const [resource, setResource] = useState("");
  const [type, setType] = useState("");
  const [amount, setAmount] = useState("");
  const [willingness, setWillingness] = useState(false);
  const [consent, setConsent] = useState(false);

  const submit = () => {
    setResult(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("available_resource", resource);
      fd.set("resource_type", type);
      fd.set("amount_or_capacity", amount);
      fd.set("domain", "E");
      if (willingness) fd.set("willingness", "on");
      if (consent) fd.set("consent", "on");
      const r = await registerOfferAction(fd);
      setResult(r);
      if (r.ok) { setResource(""); setType(""); setAmount(""); setWillingness(false); setConsent(false); }
    });
  };

  return (
    <div style={S.form}>
      <input value={resource} onChange={(e) => setResource(e.target.value)} placeholder="משאב זמין (למשל: שעת ייעוץ)" style={S.input} />
      <input value={type} onChange={(e) => setType(e.target.value)} placeholder="סוג (knowledge/time/attention…)" style={{ ...S.input, maxWidth: 160 }} />
      <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="כמות/יכולת" style={{ ...S.input, maxWidth: 120 }} />
      <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
        <input type="checkbox" checked={willingness} onChange={(e) => setWillingness(e.target.checked)} /> willingness
      </label>
      <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> consent
      </label>
      <button disabled={pending || !resource.trim() || !type.trim() || !amount.trim() || !willingness || !consent} onClick={submit} style={S.button}>
        {pending ? "…" : `רשום Offer עבור ${identityLink.person_id}`}
      </button>
      {result && !result.ok ? <div style={S.error}>{result.message}</div> : null}
    </div>
  );
}

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} style={S.section}>
      <div style={S.sectionTitle}>{title}</div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={S.empty}>{children}</div>;
}

const KIND_COLOR: Record<ActivityItem["kind"], string> = { need: "#f2635c", offer: "#34d399", action: "#5b9cf6", effect: "#a78bfa" };

const S: Record<string, React.CSSProperties> = {
  flowDetails: { background: "rgba(0,0,0,0.22)", borderRadius: 10, padding: "6px 12px", marginBottom: 12, opacity: 0.85 },
  flowSummary: { cursor: "pointer", fontSize: 13, letterSpacing: 1, color: "#6c86b5", display: "flex", gap: 12, alignItems: "baseline" },
  flowCount: { fontSize: 12, color: "#6c86b5", marginInlineStart: "auto" },
  wrap: { fontFamily: "system-ui", color: "#e6ebf5" },
  compactHero: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "16px 20px 0", padding: "10px 16px", background: "rgba(91,156,246,0.06)", border: "1px solid rgba(91,156,246,0.2)", borderRadius: 10 },
  badge: { fontSize: 12, fontWeight: 800, padding: "2px 8px", borderRadius: 6, border: "1px solid #34d39955", color: "#34d399", fontFamily: "ui-monospace, monospace" },
  heroTitleSmall: { fontSize: 15, fontWeight: 800, color: "#f0f4fc" },
  compactStats: { fontSize: 13, color: "#8fa3c9", marginRight: "auto" },

  section: { margin: "0 20px 16px", padding: "14px 16px", background: "rgba(18,24,38,0.6)", border: "1px solid rgba(90,120,180,0.16)", borderRadius: 14 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: "#5aa6ff", letterSpacing: 0.5, marginBottom: 10 },

  feed: { display: "flex", flexDirection: "column", gap: 4 },
  feedRow: { display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 6, background: "rgba(90,120,180,0.05)", fontSize: 13 },
  feedKind: { fontSize: 12, fontWeight: 800, minWidth: 50, fontFamily: "ui-monospace, monospace" },
  feedText: { flex: 1, color: "#dbe6f6" },
  feedTime: { fontSize: 12, color: "#6c86b5" },

  list: { display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 },
  listRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: "rgba(90,120,180,0.06)", flexWrap: "wrap" },
  listTitle: { fontSize: 13, color: "#e8edf6" },
  listMeta: { fontSize: 12, color: "#8aa0c8" },

  form: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 },
  input: { flex: 1, minWidth: 140, background: "rgba(18,24,38,0.7)", border: "1px solid rgba(90,120,180,0.3)", borderRadius: 8, padding: "6px 10px", color: "#e6ebf5", fontSize: 13 },
  button: { fontSize: 13, fontWeight: 700, padding: "6px 14px", borderRadius: 8, border: "none", background: "#5b9cf6", color: "#0b0f1a", cursor: "pointer" },
  error: { width: "100%", fontSize: 13, color: "#f2635c", marginTop: 4 },

  empty: { fontSize: 13, color: "#7b8ca6", fontStyle: "italic", padding: "4px 2px", lineHeight: 1.6 },
};
