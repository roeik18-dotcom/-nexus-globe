/**
 * HubNowPanel — Hub's primary product surface: a compact responsive
 * dashboard of the seven regions a person actually scans, in order.
 *
 *   A PERSON NOW · B ATTENTION · C VALUE / GROUP · D OPEN NEED ·
 *   E WHAT CHANGED · F NEXT ACTION · G RECENT EVIDENCE
 *
 * ACTIVE DOMAIN / PROJECT is deliberately NOT one of the seven cards. Both
 * are UNKNOWN until something real is recorded, and a large primary block
 * that says UNKNOWN twice reads as a defect rather than as information — so
 * it renders as one compact status line in the header, where it states the
 * same fact without claiming a card's worth of the screen.
 *
 * LAYOUT. A 12-column grid at desktop width (three cards across, then
 * four), collapsing to two columns on tablet and one on mobile through the
 * `<style>` block below — the page is a server component, so the breakpoints
 * live in real CSS rather than in a client-side measurement. The point is
 * the acceptance criterion: on a wide screen the primary state uses the
 * width instead of stacking into one narrow column with the rest of the
 * screen empty.
 *
 * DATA. This component is PURE and performs no reads. Every value was
 * already computed by `app/hub/page.tsx` for the sections it already had —
 * `buildMeasuredStateSpace` (Domain rollup), `buildHumanTensions`, `findKnownNeeds`,
 * `buildActionLifecycleSummary` → `buildBrainDerivation`,
 * `deriveObservationReading` / `classifyObservationText` over the SAME canon
 * mark the page already projected, and the SAME verified value-group
 * memberships. No new store, no new derivation, no second next-action rule.
 * This pass changed layout only: not one field's meaning, source, or
 * fallback moved.
 *
 * Where nothing real exists the panel says UNKNOWN. Three of those are
 * structural rather than incidental, and are load-bearing:
 *
 *   ACTIVE DOMAIN  UNKNOWN until a real `DomainState` has been recorded.
 *                  An activated Music/Human CONFIG is a description of what
 *                  is KNOWN about the person, not an observation that the
 *                  domain is currently active — so a config is never
 *                  promoted into this slot.
 *   PROJECT        UNKNOWN, always, today: no store in this repo records a
 *                  current project, and it is never inferred from a domain,
 *                  a value, a group, or an Action.
 *   GROUP RELATION the membership shown is real and verified. Whether the
 *                  group has anything to do with the OBSERVATION above it is
 *                  a separate join (`observationReading.ts`'s own
 *                  "GENERAL VALUE ≠ VALUE GROUP" rule); this panel states
 *                  that relation as UNRESOLVED rather than letting adjacency
 *                  imply it.
 */
import { Fragment } from "react";
import { ALL_CELL_KEYS, CELL_DOMAINS, CELL_FRAMES, cellKey, type MeasuredStateSpace } from "@/app/lib/philos/orientationCore";
import type { TensionItem } from "@/app/lib/philos/tension";
import { DOMAIN_WORD } from "@/app/lib/philos/tension";
import type { KnownNeedResult } from "@/app/lib/systemContext";
import type { ObservationReading } from "@/app/lib/philos/canon/observationReading";
import type { ContradictionMatch, ContradictionType } from "@/app/lib/philos/valueSystem/classifier";
import type { BrainDerivation } from "@/app/lib/philos/canonical/brainDerivation";
import type { ValueGroupView } from "@/app/lib/philos/projectValueGroup";
import { COLOR, RADIUS, SPACE, TYPE } from "@/app/lib/philos/shell/designTokens";
import { ProvenanceBadge, type Provenance } from "@/app/lib/philos/shell/provenance";
import { buildAttentionChain, type EpistemicStatus } from "@/app/lib/philos/attentionChain";
import { Epistemic, EvidenceRow, ScopedNextAction } from "@/app/lib/philos/shell/epistemics";
import { SystemDrawer } from "@/app/lib/philos/shell/SystemDrawer";

/** The two-sided reading of each typed contradiction, in the SAME domain
 *  words `tension.ts` already uses. Presentation of a real classifier
 *  result — no new detection, no new pair. */
const CONTRADICTION_PAIR: Record<ContradictionType, string> = {
  INTERNAL_VS_EXTERNAL: "פנימי ↔ חיצוני",
  PHYSICAL_VS_EMOTIONAL: "גוף ↔ רגש",
  EMOTIONAL_VS_COGNITIVE: "רגש ↔ שכל",
  COGNITIVE_VS_PHYSICAL_ACTION: "שכל ↔ פעולה פיזית",
  DECLARED_VALUE_VS_ACTION: "ערך מוצהר ↔ דחף לפעולה",
};

/**
 * Canon §4 defines Level as a SIGNED deficit ← equilibrium → surplus, so
 * the sign of a real recorded level is a direct reading of the record, not
 * a threshold this file invented. No magnitude wording beyond the sign is
 * claimed.
 */
function levelWord(level: number): string {
  if (level < 0) return "דורש תשומת לב";
  if (level === 0) return "שיווי משקל";
  return "עודף";
}

/** Frame (canon §3): I individual · R relational · S systemic. Hebrew-first
 *  per `PHILOS-SYSTEM-LANGUAGE.md` §9; the letter stays as the technical label. */
const FRAME_WORD: Record<"I" | "R" | "S", string> = { I: "אישי", R: "יחסי", S: "מערכתי" };

const CSS = `
.hn-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 12px;
}
.hn-a, .hn-b, .hn-c { grid-column: span 4; }
.hn-d, .hn-e, .hn-f, .hn-g { grid-column: span 3; }
@media (max-width: 1100px) {
  .hn-a, .hn-b, .hn-c { grid-column: span 6; }
  .hn-d, .hn-e, .hn-f, .hn-g { grid-column: span 6; }
}
@media (max-width: 680px) {
  .hn-a, .hn-b, .hn-c, .hn-d, .hn-e, .hn-f, .hn-g { grid-column: span 12; }
}
.hn-domains { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.hn-cells { display: grid; grid-template-columns: auto repeat(3, 1fr); gap: 4px; align-items: stretch; }
.hn-cellhead { font: 600 9px/1.3 system-ui; letter-spacing: .6px; text-transform: uppercase; text-align: center; padding: 2px 0; }
.hn-rowhead { font: 700 10.5px/1 system-ui; display: flex; align-items: center; justify-content: flex-end; padding-inline-end: 6px; white-space: nowrap; }
`;

export default function HubNowPanel({
  subject,
  displayName,
  displayNameRecorded,
  core,
  tensions,
  contradictions,
  reading,
  knownNeeds,
  brain,
  valueGroups,
  activeDomainId,
}: {
  subject: string;
  /** The viewer's real display name. */
  displayName: string;
  /** `false` = no registration event records a name; the id is shown
   *  instead, and a name is never derived from the subject id. */
  displayNameRecorded: boolean;
  /** The measured state space — all nine canon cells plus the Domain rollup.
   *  PERSON ≠ 9 CELLS: this is what has been MEASURED, never who someone is
   *  (`PHILOS-PERSON-CONTRACT.md` §4). */
  core: MeasuredStateSpace | null;
  tensions: TensionItem[];
  /** `classifyObservationText(...).contradictions` over the SAME observation
   *  `reading` is of. Empty = genuinely none detected. */
  contradictions: ContradictionMatch[];
  /** `deriveObservationReading` over the most recent real Observation for
   *  this subject. `null` = no real Observation exists. */
  reading: ObservationReading | null;
  knownNeeds: KnownNeedResult;
  brain: BrainDerivation | null;
  /** Real, VERIFIED memberships only (the page resolves them through the
   *  identity-link bridge). */
  valueGroups: { view: ValueGroupView; provenance: "REAL" | "DEMO" }[];
  /** The real `domain_id` of the most recent recorded `DomainState`
   *  (`resolveValueDomainParam`). `undefined` = none recorded — rendered
   *  UNKNOWN, never filled from an activated config. */
  activeDomainId?: string;
}) {
  const who = displayNameRecorded ? displayName : subject;
  const openNeeds = knownNeeds.checked ? knownNeeds.needs : [];
  const changes = brain?.changes.filter((c) => c.what_changed) ?? [];
  const evidence = brain?.evidence ?? [];
  // Structured citations (`BrainEvidenceRecord`) carry the real
  // verifier_type/confidence/method/time the string form drops. Preferred
  // whenever present; the string list still backs any evidence that has no
  // OutcomeVerification of its own (DomainState-instance evidence), which is
  // rendered without inventing fields for it.
  const evidenceRecords = brain?.evidence_records ?? [];
  const evidenceStringsOnly = evidence.filter(
    (e) => !evidenceRecords.some((r) => e.includes(r.statement)),
  );
  const realGroups = valueGroups.filter((g) => g.provenance === "REAL");
  // ATTENTION is a CHAIN, not a list. Each link states its own epistemic
  // status, so a measured deficit and a regex hit over the observation's
  // text can no longer render as the same kind of claim.
  const attentionChain = buildAttentionChain({ tensions, reading, verifiedGroups: realGroups });
  const hasCore = !!(core && (core.G || core.E || core.C));
  const attentionCount = tensions.length + contradictions.length;

  return (
    <section dir="rtl" style={S.root}>
      {/* Folded by default. Everything below is counts, sources and
          status tokens — the system describing itself. Kept whole,
          one click away, but no longer ahead of the material. */}
      <SystemDrawer id="hub-now" title="מצב נוכחי · פירוט מערכת" note="ספירות, מקורות וסטטוסים">
      <style>{CSS}</style>

      <header style={S.head}>
        <div style={S.headMain}>
          <h2 style={S.title}>
            {who} <span style={S.titleDim}>· עכשיו</span>
          </h2>
          {!displayNameRecorded ? (
            <span style={S.nameNote} title="אין אירוע רישום ששומר שם תצוגה — לא נגזר שם מזהה הנושא">
              שם תצוגה לא רשום — מוצג מזהה
            </span>
          ) : null}
        </div>

        {/* ACTIVE DOMAIN / PROJECT — one compact status line, not a card.
            See the module header for why. */}
        <div style={S.statusLine}>
          <StatusChip label="ACTIVE DOMAIN" value={activeDomainId ?? "UNKNOWN"} known={!!activeDomainId} />
          <StatusChip
            label="PROJECT"
            value="UNKNOWN"
            known={false}
            title="אין מקור שרושם פרויקט נוכחי — לא נגזר מדומיין, מערך או מקבוצה"
          />
        </div>
      </header>

      <div className="hn-grid">
        {/* ── A · PERSON NOW ── */}
        <Card
          className="hn-a"
          title="PERSON NOW · מרחב המדידה"
          p={hasCore ? "CANON" : "UNKNOWN"}
          count={core ? core.observed_count : undefined}
          countSuffix="/9"
        >
          {/* The canon 3×3 — Domain (G/E/C) × Frame (I/R/S) = nine cells
              (canon §3, `cellState.ts::ALL_CELLS`). Rendering only the three
              Domains would drop the Frame axis and make one measurement of one
              cell read as a whole Body/Emotion/Cognition person model.
              PERSON ≠ 9 CELLS — this is what was MEASURED, not who someone is. */}
          <div className="hn-cells">
            <div />
            {CELL_FRAMES.map((f) => (
              <div key={f} className="hn-cellhead" style={{ color: COLOR.textFaint }}>
                {FRAME_WORD[f]} · {f}
              </div>
            ))}
            {CELL_DOMAINS.map((d) => (
              <Fragment key={d}>
                <div className="hn-rowhead" style={{ color: COLOR.textDim }}>{DOMAIN_WORD[d]} · {d}</div>
                {CELL_FRAMES.map((f) => {
                  const cell = core?.cells[cellKey(d, f)];
                  const observed = cell?.status === "OBSERVED";
                  const deficit = observed && (cell.level ?? 0) < 0;
                  return (
                    <div
                      key={f}
                      title={observed
                        ? `${cell.canon_event_id} · ${cell.provenance} · conf ${cell.confidence ?? "UNKNOWN"} · ref ${cell.reference ?? "UNKNOWN"}`
                        : "אין תצפית אמיתית לתא הזה"}
                      style={{
                        ...S.cell,
                        borderColor: deficit ? "rgba(242,99,92,0.45)" : observed ? "rgba(52,211,153,0.35)" : COLOR.border,
                        background: observed ? COLOR.bgRaised : "transparent",
                      }}
                    >
                      <span style={{
                        ...S.cellValue,
                        color: !observed ? "#6c86b5" : deficit ? "#fc8a84" : "#6fe3b4",
                      }}>
                        {observed ? cell.level : "—"}
                      </span>
                      {observed ? (
                        <span style={{ ...S.cellNote, color: deficit ? "#fc8a84" : COLOR.textDim }}>
                          {levelWord(cell.level ?? 0)}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
          <div style={S.cellLegend}>
            {/* The numerals are bidi-isolated. Without isolation an RTL
                paragraph reorders adjacent Latin digits on COPY: the DOM says
                "1 מתוך 9" but pasting it yields "1 מתוך 10". A coverage count
                that changes when quoted is not an honesty anchor. */}
            {core ? (
              <>
                <span style={S.num}>{core.observed_count}</span>
                {" מתוך "}
                <span style={S.num}>{ALL_CELL_KEYS.length}</span>
                {" תאים נמדדו — השאר UNKNOWN, לא אופסו"}
              </>
            ) : "אין מרחב מדידה"}
          </div>
        </Card>

        {/* ── B · ATTENTION CHAIN ──
               Six links, each with its OWN epistemic status. Previously
               these were concatenated into one bulleted list under a single
               count, which made a measured deficit and a token match over
               free text look like the same kind of finding. */}
        <Card
          className="hn-b"
          title="ATTENTION"
          p={attentionChain.counts.MEASURED > 0 ? "CANON" : "UNKNOWN"}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
            {(Object.entries(attentionChain.counts) as [EpistemicStatus, number][])
              .filter(([, n]) => n > 0)
              .map(([st, n]) => <StatusChipMini key={st} status={st} n={n} />)}
            {Object.values(attentionChain.counts).every((n) => n === 0)
              ? <span style={{ ...TYPE.micro, color: COLOR.textFaint }}>אין ממצא בשום חוליה</span>
              : null}
          </div>
          {attentionChain.links.map((l, i) => (
            <AttentionLinkRow key={l.key} link={l} index={i + 1} />
          ))}
          <div style={{ ...TYPE.micro, fontSize: 12, color: COLOR.textFaint, marginTop: 4, lineHeight: 1.5 }}>
            רצף אינו סיבתיות — כל חוליה נגזרת מהחומר של הקודמת, ואינה מוסברת על ידה
          </div>
        </Card>

        {/* ── C · VALUE / GROUP ── */}
        <Card className="hn-c" title="VALUE / GROUP" p={reading?.general_value || realGroups.length > 0 ? "STATIC" : "UNKNOWN"}>
          {!reading ? (
            <Epistemic state="UNKNOWN" reason="אין Observation קנונית לנושא הזה" />
          ) : !reading.general_value ? (
            <Epistemic state="UNKNOWN" reason="הטקסט אינו מכיל הצהרת ערך מפורשת" />
          ) : (
            <>
              <Line label="ערך" value={reading.general_value.claimed_phrase} tone="plain" />
              <Line
                label="ביקום"
                value={
                  reading.general_value.matched_subvalue?.name_he
                  ?? reading.general_value.matched_family?.name_he
                  ?? "UNRESOLVED — אין התאמה"
                }
                tone={reading.general_value.matched_subvalue || reading.general_value.matched_family ? "plain" : "unknown"}
              />
            </>
          )}

          <div style={S.divider} />

          {realGroups.length === 0 ? (
            <Epistemic state="UNKNOWN" reason="אין קישור זהות לחבר בקבוצה" />
          ) : (
            realGroups.slice(0, 2).map(({ view }) => (
              <Line key={view.group_id} label="קבוצה" value={view.name} tone="plain" note="Member of" />
            ))
          )}
          <div style={{ marginTop: 2 }}>
            <Epistemic
              state="UNRESOLVED"
              reason="חברות בקבוצה אינה קשר מאומת לתצפית — הקבוצה אינה מוצגת כאילו היא קשורה אליה"
            />
          </div>
        </Card>

        {/* ── D · OPEN NEED ── */}
        <Card className="hn-d" title="OPEN NEED" p={openNeeds.length > 0 ? "CANON" : "UNKNOWN"} count={openNeeds.length || undefined}>
          {!knownNeeds.checked ? (
            <Epistemic state="UNKNOWN" reason={`לא נבדק: ${knownNeeds.reason}`} />
          ) : openNeeds.length === 0 ? (
            <Epistemic state="UNKNOWN" reason="נבדק — אין Need פתוח לנושא הזה" />
          ) : (
            openNeeds.slice(0, 2).map((n) => (
              <Line key={n.need.need_id} label="" value={n.need.desired_change} tone="plain" note={n.need.provenance} clamp />
            ))
          )}
        </Card>

        {/* ── E · WHAT CHANGED ── */}
        <Card className="hn-e" title="WHAT CHANGED" p={changes.length > 0 ? "CANON" : "UNKNOWN"} count={changes.length || undefined}>
          {changes.length === 0 ? (
            <Epistemic state="UNKNOWN" reason="אין Action עם what_changed רשום" />
          ) : (
            // PRIMARY = the readable statement; the raw action_id and the
            // full ISO timestamp are the CITATION and render below it at
            // secondary weight. Demoted, not hidden: the record's existence
            // and its real time both stay on screen.
            changes.slice(0, 2).map((c) => (
              <Fragment key={c.action_id}>
                <Line label="" value={c.what_changed_label} tone="plain" note={c.verification_state} clamp />
                <div dir="ltr" style={{ fontSize: 12, fontFamily: "ui-monospace, monospace", color: COLOR.textFaint, marginTop: -2, marginBottom: 3 }}>
                  {c.action_id} · {c.recorded_at.slice(0, 16).replace("T", " ")}
                </div>
              </Fragment>
            ))
          )}
        </Card>

        {/* ── F · NEXT ACTION — the SAME `brain.next_action` every other
               surface reads; never a second priority rule. ── */}
        <Card className="hn-f" title="NEXT ACTION" p={brain?.next_action ? "STATIC" : "UNKNOWN"}>
          {brain?.next_action ? (
            // `scope` is mandatory — an unlabelled next action may not render
            // (`PHILOS-EVIDENCE-NEXTACTION-CONTRACT.md` B4). SUBJECT = "for
            // you, now", which is what `buildNextAction` computes: it reads
            // this subject's pending Needs and open Action/Effect loops.
            <ScopedNextAction
              scope="SUBJECT"
              label={brain.next_action.label}
              reason={brain.next_action.reason}
            />
          ) : (
            <Epistemic state="UNKNOWN" reason="אין Need פתוח, לולאת Action פתוחה או Effect לא מאומת המצדיקים צעד" />
          )}
        </Card>

        {/* ── G · RECENT EVIDENCE ── */}
        <Card className="hn-g" title="RECENT EVIDENCE" p={evidence.length > 0 ? "CANON" : "UNKNOWN"} count={evidence.length || undefined}>
          {evidence.length === 0 ? (
            <Epistemic state="UNKNOWN" reason="אין Effect עם claimed/verified outcome רשום" />
          ) : (
            <>
              {/* Structured citations first: `stance`, `verifier_type`,
                  `confidence`, `method` and `time` all come verbatim off the
                  ONE `OutcomeVerification` the record cites. These used to
                  render as "VERIFIER UNKNOWN · conf UNKNOWN" over Effects
                  that carry real values on disk, because the derivation
                  flattened them into a display string first. */}
              {evidenceRecords.slice(0, 2).map((r) => (
                <EvidenceRow
                  key={r.effect_id}
                  statement={r.statement}
                  stance={r.stance}
                  origin="CANON"
                  verifierType={r.verifier_type}
                  confidence={r.confidence}
                  time={r.time}
                  sourceId={r.effect_id}
                />
              ))}
              {/* Evidence with no OutcomeVerification of its own (DomainState
                  instance evidence) — shown as-is, never padded with
                  fabricated verifier/confidence values. */}
              {evidenceStringsOnly.slice(0, Math.max(0, 2 - evidenceRecords.length)).map((e, i) => (
                <EvidenceRow
                  key={`s${i}`}
                  statement={e.replace(/^\[(VERIFIED|CLAIMED)\]\s*/, "")}
                  stance={e.startsWith("[VERIFIED]") ? "VERIFIED" : e.startsWith("[CLAIMED]") ? "CLAIMED" : "UNVERIFIABLE"}
                  origin="CANON"
                />
              ))}
            </>
          )}
        </Card>
      </div>
      </SystemDrawer>
    </section>
  );
}

function Card({ className, title, p, count, countSuffix, children }: {
  className: string;
  title: string;
  p: Provenance;
  count?: number;
  countSuffix?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className} style={S.card}>
      <div style={S.cardHead}>
        <span style={S.cardTitle}>
          {title}
          {count !== undefined ? <span style={S.cardCount}> ({count}{countSuffix ?? ""})</span> : null}
        </span>
        <ProvenanceBadge p={p} />
      </div>
      <div style={S.cardBody}>{children}</div>
    </div>
  );
}

function StatusChip({ label, value, known, title }: { label: string; value: string; known: boolean; title?: string }) {
  return (
    <span style={S.chip} title={title}>
      <span style={S.chipLabel}>{label}</span>
      <span style={{ ...S.chipValue, color: known ? COLOR.text : "#8798b8" }}>{value}</span>
    </span>
  );
}


function Line({ label, value, tone, note, clamp }: {
  label: string;
  value: string | number;
  tone: "plain" | "warn" | "unknown" | "accent";
  note?: string;
  clamp?: boolean;
}) {
  const color =
    tone === "warn" ? "#fc8a84" :
    tone === "unknown" ? "#8798b8" :
    tone === "accent" ? COLOR.accent : COLOR.text;
  return (
    <div style={S.line}>
      <div style={S.lineMain}>
        {label ? <span style={S.lineLabel}>{label}</span> : null}
        <span style={{ ...S.lineValue, color, ...(clamp ? S.clamp : null) }}>{value}</span>
      </div>
      {note ? <div style={S.lineNote}>{note}</div> : null}
    </div>
  );
}

/** Per-status colour. Display hierarchy only — never a score, never
 *  compared or summed across statuses. */
const STATUS_TONE: Record<EpistemicStatus, string> = {
  MEASURED: "#34d399",     // a real measurement — highest weight
  VERIFIED: "#6fe3b4",     // a real durable record
  INTERPRETED: "#fbbf24",  // a token match over free text — a MENTION
  CANDIDATE: "#a78bfa",    // a proposed join, not asserted
  UNRESOLVED: "#8798b8",   // checked, nothing found
};

function StatusChipMini({ status, n }: { status: EpistemicStatus; n: number }) {
  return (
    <span
      title={`${n} פריט בסטטוס ${status}`}
      style={{
        ...TYPE.micro, fontSize: 12, letterSpacing: 0.4,
        color: STATUS_TONE[status], border: `1px solid ${STATUS_TONE[status]}55`,
        borderRadius: RADIUS.pill, padding: "1px 6px", whiteSpace: "nowrap",
      }}
    >
      {status} {n}
    </span>
  );
}

/**
 * One link. The status chip is always rendered — including for an empty
 * link — because "checked and found nothing" and "not part of the model"
 * are different statements and the chain must keep them apart.
 */
function AttentionLinkRow({ link, index }: { link: import("@/app/lib/philos/attentionChain").AttentionLink; index: number }) {
  const tone = STATUS_TONE[link.status];
  const has = link.items.length > 0;
  return (
    <div
      title={`${link.derived_from}\n\nלא משתמע: ${link.not_implied}`}
      style={{
        borderInlineStart: `2px solid ${has ? tone : "rgba(90,111,150,0.3)"}`,
        paddingInlineStart: 7, marginBottom: 5, opacity: has ? 1 : 0.72,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
        <span style={{ ...TYPE.micro, fontSize: 12, color: COLOR.textFaint }}>{index}</span>
        <span style={{ ...TYPE.micro, fontSize: 12, color: tone, letterSpacing: 0.4 }}>{link.label}</span>
        <span style={{ fontSize: 12, color: COLOR.textFaint }}>{link.gloss}</span>
      </div>
      {has ? (
        link.items.slice(0, 2).map((it, i) => (
          <div key={i} style={{ fontSize: 13, color: COLOR.text, lineHeight: 1.4 }}>
            {it.text}
            {it.detail ? <span style={{ color: COLOR.textFaint, fontSize: 12 }}> · {it.detail}</span> : null}
          </div>
        ))
      ) : (
        <div style={{ fontSize: 12, color: "#8798b8", fontStyle: "italic", lineHeight: 1.4 }}>{link.empty}</div>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  root: { marginBottom: SPACE.md },
  head: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: SPACE.md, flexWrap: "wrap", marginBottom: SPACE.md,
  },
  headMain: { display: "flex", alignItems: "baseline", gap: SPACE.sm, flexWrap: "wrap" },
  title: { ...TYPE.title, color: COLOR.text, margin: 0 },
  titleDim: { color: COLOR.textFaint, fontWeight: 500 },
  nameNote: { ...TYPE.micro, color: COLOR.textFaint },
  statusLine: { display: "flex", alignItems: "center", gap: SPACE.sm, flexWrap: "wrap" },
  chip: {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "3px 10px", borderRadius: RADIUS.pill,
    background: COLOR.bgRaised, border: `1px solid ${COLOR.border}`,
  },
  chipLabel: { ...TYPE.micro, color: COLOR.textFaint },
  chipValue: { fontSize: 13, fontWeight: 700, fontFamily: "ui-monospace, monospace" },

  card: {
    background: COLOR.bgCard,
    border: `1px solid ${COLOR.border}`,
    borderRadius: RADIUS.md,
    padding: `10px 14px 12px`,
    minWidth: 0,
  },
  cardHead: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: SPACE.sm, marginBottom: SPACE.sm,
    borderBottom: `1px solid ${COLOR.border}`, paddingBottom: 6,
  },
  cardTitle: { ...TYPE.micro, color: COLOR.textDim },
  cardCount: { color: COLOR.textFaint },
  cardBody: { display: "flex", flexDirection: "column", gap: 4 },

  tile: {
    border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.sm,
    padding: "8px 6px", textAlign: "center", background: COLOR.bgRaised,
  },
  cell: {
    border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.sm,
    padding: "6px 4px", textAlign: "center", display: "flex",
    flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 46,
  },
  // `direction: ltr` is load-bearing: inside the RTL panel a signed canon
  // Level like `-1` renders as `1-`, which reads as a different number.
  cellValue: { fontSize: 17, fontWeight: 800, lineHeight: 1.1, fontFamily: "ui-monospace, monospace", direction: "ltr", unicodeBidi: "isolate" },
  cellNote: { fontSize: 12, lineHeight: 1.3, marginTop: 1 },
  num: { direction: "ltr", unicodeBidi: "isolate", display: "inline-block" } as React.CSSProperties,
  cellLegend: { fontSize: 12, color: COLOR.textFaint, marginTop: 6, lineHeight: 1.4 },
  tileLabel: { ...TYPE.micro, color: COLOR.textFaint },
  // `direction: ltr` + bidi isolation is required, not cosmetic: inside the
  // RTL panel a signed level like `-1` renders as `1-`, which reads as a
  // different number. The value is a signed canon Level (§4), so its sign
  // must stay on the left of the digit.
  tileValue: { fontSize: 22, fontWeight: 800, lineHeight: 1.2, fontFamily: "ui-monospace, monospace", direction: "ltr", unicodeBidi: "isolate" },
  tileNote: { fontSize: 12, lineHeight: 1.35 },

  divider: { borderTop: `1px solid ${COLOR.border}`, margin: "6px 0 2px" },
  empty: { fontSize: 13, color: "#8798b8", fontStyle: "italic", lineHeight: 1.5 },
  line: { padding: "1px 0" },
  lineMain: { display: "flex", alignItems: "baseline", gap: SPACE.sm },
  lineLabel: { fontSize: 13, color: COLOR.textFaint, whiteSpace: "nowrap" },
  lineValue: { fontSize: 13, fontWeight: 600, lineHeight: 1.5, minWidth: 0 },
  lineNote: { fontSize: 12, color: COLOR.textFaint, marginTop: 1, lineHeight: 1.45 },
  clamp: { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties,
};
