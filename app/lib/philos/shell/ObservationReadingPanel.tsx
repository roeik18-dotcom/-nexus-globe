/**
 * ObservationReadingPanel — the ONE shared surface for "what does the most
 * recent real Observation say" (7-terminal propagation pass). Hub,
 * Dynamics, Brain, Community, World and Planet all render THIS component;
 * none of them restates the observation text or re-derives its structure.
 * Add/change an Observation through the one real write path and every
 * terminal that renders this panel changes together — that propagation IS
 * the feature.
 *
 * Data path, all pre-existing:
 *   projectCanonDynamics()            → the real persisted Observation log
 *   deriveObservationReading()        → the shared deterministic reading
 *   buildActionLifecycleSummary()     → honest Effect/Learning linkage scan
 *   projectValueGroup + DEMO views    → real group central_values for the
 *                                       Value-Group relation join
 *
 * The panel's three zones keep the epistemics visibly separate:
 *   EVIDENCE (CANON)        the record itself, verbatim
 *   INTERPRETATION (STATIC) deterministic token detections over that text
 *   UNKNOWN                 what nothing real answers yet — stated
 * A Value-Group relation that no real join supports renders UNRESOLVED —
 * never a fabricated link. No geography, no external event, no Effect or
 * Learning is invented anywhere here.
 */
import { projectCanonDynamics } from "@/app/lib/philos/canon/projectCanonDynamics";
import { buildViewerLinkRegistry } from "@/app/lib/philos/bridge/viewerLinkRegistry";
import { resolveViewerGroupView } from "@/app/lib/philos/community/viewerGroupView";
import { deriveObservationReading, type ObservationReading } from "@/app/lib/philos/canon/observationReading";
import { classifyObservationText, type ObservationClassification, type OperationalGroupInput } from "@/app/lib/philos/valueSystem/classifier";
import { resolveValueGroups, type ValueGroupResolverResult, type ResolverGroupInput } from "@/app/lib/philos/valueSystem/groupResolver";
import { buildDefaultLinkRegistry } from "@/app/lib/philos/bridge/linkRegistry";
import { linksByRelation } from "@/app/lib/philos/bridge/entityLink";
import { buildCommunityTensions, sortTensions } from "@/app/lib/philos/tension";
import { resolveShellIdentityLink } from "@/app/lib/philos/community/resolveShellIdentityLink";
import { buildActionLifecycleSummary } from "@/app/lib/philos/canon/actionLifecycle";
import { RAW_FAMILIES, SUBVALUES } from "@/app/lib/philos/community/valueUniverse328";
import { loadPhilosEvents } from "@/app/lib/philos-event-store";
import { systemClock, todayIn } from "@/app/lib/philos/eventStore";
import { projectValueGroup, type ValueGroupView } from "@/app/lib/philos/projectValueGroup";
import { DEMO_COMMUNITIES } from "@/app/lib/philos/demoCommunities";
import { ProvenanceBadge } from "./provenance";
import { Epistemic, Measurement, Stance } from "./epistemics";
import { FS, COLOR, RADIUS, SPACE, TYPE } from "./designTokens";

const DIMENSION_WORD: Record<string, string> = { PHYSICAL: "גופני", EMOTIONAL: "רגשי", COGNITIVE: "שכלי" };
const ORIENTATION_WORD: Record<string, string> = { INTERNAL: "פנימי", EXTERNAL: "חיצוני" };

/** Contract §8 color glyphs — semantic routing metadata only. */
const COLOR_GLYPH: Record<string, string> = { RED: "🔴", ORANGE: "🟠", YELLOW: "🟡", GREEN: "🟢", BLUE: "🔵", PURPLE: "🟣", WHITE: "⚪" };

export default async function ObservationReadingPanel({
  subject,
  surface,
}: {
  subject: string;
  /** Which terminal is rendering — display context only, never data. */
  surface: string;
}) {
  let reading: ObservationReading | null = null;
  let classification: ObservationClassification | null = null;
  let groupResolution: ValueGroupResolverResult | null = null;
  let measuredLevel: number | null = null;
  let learningLinked = false;
  let effectLinked = false;
  let groups: { view: ValueGroupView; provenance: "REAL" | "DEMO" }[] = [];
  try {
    const canon = await projectCanonDynamics();
    const marks = canon.nodes
      .filter((n) => n.subject === subject)
      .sort((a, b) => b.observed_at.localeCompare(a.observed_at));
    const latest = marks[0];
    if (latest) {
      measuredLevel = latest.level;
      reading = deriveObservationReading(latest, { subvalues: SUBVALUES, families: RAW_FAMILIES });
      // Honest linkage scan: `Learning.prior_state_ref` is the ONE schema
      // field that can name an Observation (Effect references Actions only,
      // canon §17 — so an Effect is "linked" to an Observation only through
      // a Learning that names both). No match = stated absence.
      const lifecycle = await buildActionLifecycleSummary(subject);
      for (const a of lifecycle.actions) {
        for (const e of a.effects) {
          for (const l of e.learnings) {
            if (l.learning.prior_state_ref === latest.canon_event_id) {
              learningLinked = true;
              effectLinked = true; // linked THROUGH this Learning's own effect_ref
            }
          }
        }
      }
      const events = await loadPhilosEvents();
      const real = (await resolveViewerGroupView({ events })).view;
      const demos = DEMO_COMMUNITIES
        .map((c) => projectValueGroup(c.events, c.group_id, c.today))
        .filter((v): v is ValueGroupView => v !== null);
      groups = [
        ...(real ? [{ view: real, provenance: "REAL" as const }] : []),
        ...demos.map((view) => ({ view, provenance: "DEMO" as const })),
      ];

      // Generic classification engine (value-system pass) — the ONE
      // classifier every terminal consumes. Group operationality is read
      // off the projection's own real fields: transfers = real Transfer
      // Actions, impact = real Effect claims. No group-scoped canon
      // Needs/Offers exist, so those honestly stay 0.
      const operationalGroups: OperationalGroupInput[] = groups.map(({ view, provenance }) => ({
        group_id: view.group_id,
        name: view.name,
        central_value: view.central_value,
        provenance,
        member_count: view.members.length,
        operational_links: { needs: 0, offers: 0, actions: view.transfers.length, effects: view.impact.length },
      }));
      classification = classifyObservationText(latest.context, operationalGroups);

      // Value Group RESOLVER (operationalization pass) — the ONE resolver
      // every terminal consumes. All inputs are the same real reads this
      // codebase already performs: identity link, bridge registry,
      // community tensions, the group projections above.
      const identityLink = await resolveShellIdentityLink();
      const bridgeLinks = await buildViewerLinkRegistry({ events });
      const resolverGroups: ResolverGroupInput[] = groups.map(({ view, provenance }) => ({
        group_id: view.group_id,
        name: view.name,
        central_value: view.central_value,
        provenance,
        member_ids: view.members.map((m) => m.person_id),
        transfers: view.transfers.filter((t) => t.state === "completed").map((t) => ({ transfer_id: t.transfer_id, recipient: t.recipient })),
        effects: view.impact.map((i) => ({ id: i.impact_id, verified: i.verified })),
        tension_ids: sortTensions(buildCommunityTensions(view, provenance)).map((t) => t.id),
        bridge_action_ids: linksByRelation(bridgeLinks, "ACTION_AFFECTS_COMMUNITY")
          .filter((l) => l.target.canonical_id === view.group_id).map((l) => l.source.canonical_id),
        bridge_effect_ids: identityLink.status === "VERIFIED_SAME_PERSON"
          ? linksByRelation(bridgeLinks, "EFFECT_AFFECTS_PERSON")
              .filter((l) => l.target.canonical_id === identityLink.community_member_id).map((l) => l.source.canonical_id)
          : [],
      }));
      groupResolution = resolveValueGroups({
        familyMatches: classification.value_family_matches,
        generalValueMatches: classification.general_value_matches,
        baseValueMatches: classification.base_value_matches,
        groups: resolverGroups,
        viewer: identityLink.status === "VERIFIED_SAME_PERSON"
          ? { linked: true, community_member_id: identityLink.community_member_id }
          : { linked: false },
      });
    }
  } catch {
    reading = null;
    classification = null;
    groupResolution = null;
  }

  if (!reading) {
    return (
      <section dir="rtl" style={S.band}>
        <div style={S.headRow}>
          <span style={S.eyebrow}>קריאת התצפית האחרונה · LATEST OBSERVATION READING</span>
          <ProvenanceBadge p="UNKNOWN" />
        </div>
        <div style={S.emptyLine}>
          <Epistemic state="UNKNOWN" reason={`אין Observation קנונית עבור ${subject} — אין מה לקרוא, ולא מומצא`} />
        </div>
      </section>
    );
  }

  return (
    <section dir="rtl" style={S.band}>
      <div style={S.headRow}>
        <span style={S.eyebrow}>קריאת התצפית האחרונה · LATEST OBSERVATION READING — {surface}</span>
        <span style={S.idChip}>{reading.canon_event_id.slice(0, 14)}…</span>
      </div>

      {/* EVIDENCE — the record itself */}
      <div style={S.zone}>
        <div style={S.zoneHead}>
          <span style={S.zoneTitle}>ראיה · EVIDENCE — הרשומה עצמה</span>
          <ProvenanceBadge p="CANON" />
          {/* An Observation is a recorded MEASUREMENT. Canon's claimed/
              verified axis (§17) belongs to Effect/OutcomeVerification, not
              to Observation — so the honest stance here is UNVERIFIABLE:
              this schema has no verification axis at all. Rendering it as
              CLAIMED would assert a claim the record never makes. */}
          <Stance stance="UNVERIFIABLE" title="Observation היא מדידה רשומה — לסכמה שלה אין ציר claimed/verified (הוא שייך ל-Effect, קנון §17)" />
        </div>
        <div style={S.contextBox}>{reading.context}</div>
        <div style={S.metaLine}>
          subject: {reading.subject} · תא רשום (Cell): {reading.recorded_cell.domain}/{reading.recorded_cell.frame} ·
          {" "}{reading.observed_at.slice(0, 16).replace("T", " ")} · {reading.provenance}
          {reading.confidence !== undefined ? ` · confidence ${reading.confidence}` : ""}
        </div>
      </div>

      {/* INTERPRETATION — deterministic reading of that text */}
      <div style={S.zone}>
        <div style={S.zoneHead}>
          <span style={S.zoneTitle}>פרשנות · INTERPRETATION — זיהוי טקסט דטרמיניסטי, לא ראיה</span>
          <ProvenanceBadge p="STATIC" />
        </div>

        {classification ? (
          <>
            <div style={S.gridWrap}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}></th>
                    {(["INTERNAL", "EXTERNAL"] as const).map((o) => (
                      <th key={o} style={S.th}>{ORIENTATION_WORD[o]} · {o}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(["PHYSICAL", "EMOTIONAL", "COGNITIVE"] as const).map((d) => (
                    <tr key={d}>
                      <td style={{ ...S.td, fontWeight: 700, color: COLOR.textDim }}>{DIMENSION_WORD[d]} · {d}</td>
                      {(["INTERNAL", "EXTERNAL"] as const).map((o) => {
                        const cell = classification!.six_class_reading.find((c) => c.class === `${d}_${o}`)!;
                        // This grid reports MENTIONS ONLY — never a measurement.
                        //
                        // It previously marked a cell MEASURED by mapping the
                        // canon Frame onto this axis (`I → INTERNAL`,
                        // `S → EXTERNAL`). That is forbidden:
                        // `PHILOS-PERSON-CONTRACT.md` §6 rule 2 — "INTERNAL /
                        // EXTERNAL must NOT be mapped to Frame I / R / S. Two
                        // values against three, and no source document maps
                        // them." The old mapping also silently dropped
                        // `frame === "R"` entirely, so a relational
                        // observation showed MEASURED in no cell at all.
                        //
                        // The real measured cell is stated on its own line
                        // below, with its own real (Domain, Frame).
                        return (
                          <td key={o} style={{ ...S.td, color: cell.mentioned ? "#fbbf24" : COLOR.textFaint, fontStyle: cell.mentioned ? "normal" : "italic" }}>
                            {cell.mentioned ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                                <Measurement kind="MENTIONED" />
                                <span>{cell.tokens.slice(0, 2).join(" × ")}</span>
                              </span>
                            ) : (
                              "לא הוזכר"
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={S.noteLine}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                <Measurement kind="MEASURED" />
                <span style={{ fontWeight: 700, color: "#34d399" }}>
                  התא הנמדד בפועל: {reading.recorded_cell.domain}/{reading.recorded_cell.frame} · level {measuredLevel ?? "UNKNOWN"}
                </span>
              </span>
              <div>
                הגריד למעלה הוא שכבת <b>פרשנות</b> — 3 ממדים × 2 אוריינטציות = 6 אזכורים אפשריים בטקסט.
                המדידה הקנונית חיה בציר אחר לגמרי: Domain × Frame (G/E/C × I/R/S) = 9 תאים.
                <b> אסור למפות INTERNAL/EXTERNAL ל-Frame I/R/S</b> — שני ערכים מול שלושה, ואף מקור אינו ממפה ביניהם;
                היחס בין שני המודלים נשאר UNRESOLVED. אזכור מילולי לעולם אינו הופך למצב תא.
              </div>
            </div>

            <Row
              label="ערכי בסיס · BASE VALUES"
              value={classification.base_value_matches.length === 0
                ? "לא זוהה ערך בסיס מתוך רישום ה-65"
                : classification.base_value_matches.map((m) =>
                    `${m.label} (${m.ref} · ${m.tier}${m.conditional ? " · מותנה" : ""})`).join(" · ")}
              good={classification.base_value_matches.some((m) => !m.conditional)}
            />

            <Row
              label="משפחת ערך · VALUE FAMILY (candidate, REVIEW_REQUIRED)"
              value={classification.value_family_matches.length === 0
                ? "אין משפחה — אין ערך בסיס שממופה"
                : classification.value_family_matches.slice(0, 3).map((f) =>
                    `${f.ref} "${f.label}" (${f.tier} · via ${f.via_base_values.length} ערכי בסיס)`).join(" · ")}
              good={classification.value_family_matches.some((f) => f.tier === "CLAIMED")}
            />

            <Row
              label="ערך כללי · GENERAL VALUE (אונטולוגיה נפרדת — לא משפחה)"
              value={classification.general_value_matches.length === 0
                ? "הטקסט לא הצהיר ערך כללי"
                : classification.general_value_matches.map((g) =>
                    `"${g.claimed_phrase}" · ${g.status}`).join(" · ")}
              good={classification.general_value_matches.length > 0}
            />

            <Row
              label={`ניגודים · CONTRADICTIONS (${classification.contradictions.length})`}
              value={classification.contradictions.length === 0
                ? "לא זוהה ניגוד בטקסט"
                : classification.contradictions.map((c) => `${c.ref}: ${c.reason}`).join(" | ")}
              good={classification.contradictions.length > 0}
            />

            {/* VALUE GROUP RESOLVER — the ONE resolver every terminal
                consumes. Person-level relations come from real records
                only; value-level relations are labeled interpretation;
                unmatched families stay visibly UNRESOLVED. */}
            {groupResolution ? (
              <div style={{ borderTop: `1px solid ${COLOR.border}`, marginTop: 6, paddingTop: 6 }}>
                {/* GRAPH 1 — OBSERVATION ↔ VALUE GROUP. The ONLY headline
                    for "does this observation relate to a group". Person
                    membership plays no part here. */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                  <span style={{ ...TYPE.micro, color: "#8fa3c9" }}>תצפית ↔ קבוצת ערך · OBSERVATION↔GROUP — {groupResolution.observation_overall}</span>
                  <ProvenanceBadge p={groupResolution.observation_overall === "MATCHED" ? "REAL" : "UNKNOWN"} />
                </div>
                {groupResolution.observation_group_relations.length === 0 ? (
                  <div style={{ padding: "3px 0" }}>
                    {/* UNRESOLVED, not UNKNOWN: both sides genuinely exist —
                        the observation named values, and real groups exist —
                        but no verified join connects them. Naming the failed
                        join is the locked rule; an empty row is not allowed. */}
                    <Epistemic
                      state="UNRESOLVED"
                      reason="אף ערך שזוהה בתצפית אינו מצטלב עם central_value של קבוצה קיימת; חברות אישית אינה מאשרת רלוונטיות תצפית"
                    />
                  </div>
                ) : (
                  groupResolution.observation_group_relations.map((rel, i) => (
                    <Row key={`${rel.group_id}-${rel.relation_type}-${i}`}
                      label={`${rel.group_name} — ${rel.relation_type}${rel.family_ref ? ` [${rel.family_ref}]` : ""}`}
                      value={`${rel.match_reason}${rel.operational_evidence.length > 0 ? ` · ראיות: ${rel.operational_evidence.slice(0, 2).join(", ")}` : ""}`}
                      good={true}
                    />
                  ))
                )}
                {groupResolution.unresolved_families.map((f) => (
                  <Row key={f.family_ref}
                    label={`משפחה ללא קבוצה · ${f.family_ref} ${f.label}`}
                    value={f.reason}
                    good={false}
                  />
                ))}

                {/* GRAPH 2 — PERSON ↔ GROUP. Real, but explicitly NOT about
                    this observation. */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, margin: "8px 0 4px" }}>
                  <span style={{ ...TYPE.micro, color: "#8fa3c9" }}>אדם ↔ קבוצה (לא קשור לתצפית) · PERSON↔GROUP — {groupResolution.subject_overall}</span>
                  <ProvenanceBadge p={groupResolution.subject_overall === "MATCHED" ? "REAL" : "UNKNOWN"} />
                </div>
                {groupResolution.subject_group_relations.length === 0 ? (
                  <Row label="PERSON↔GROUP" value="אין קשר אמיתי בין האדם לקבוצה כלשהי" good={false} />
                ) : (
                  groupResolution.subject_group_relations.map((rel, i) => (
                    <Row key={`${rel.group_id}-${rel.relation_type}-${i}`}
                      label={`${rel.group_name} — ${rel.relation_type}`}
                      value={`${rel.match_reason}${rel.operational_evidence.length > 0 ? ` · ראיות: ${rel.operational_evidence.slice(0, 2).join(", ")}` : ""} · קשר אישי — אינו מאשר רלוונטיות של התצפית לקבוצה`}
                      good={rel.provenance !== "VALUE_JOIN"}
                    />
                  ))
                )}
              </div>
            ) : (
              <Row
                label={`קבוצת ערך · VALUE GROUP — ${classification.value_group_match.state}`}
                value={classification.value_group_match.reason}
                good={classification.value_group_match.state === "MATCHED"}
              />
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "4px 8px", alignItems: "center" }}>
              <span style={{ ...TYPE.micro, color: "#8fa3c9" }}>COLOR ROLES (routing metadata · Cell_ID ≠ Color_ID)</span>
              {classification.color_roles.map((r) => (
                <span key={r.role} title={r.reason} style={{ fontSize: FS.meta, border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.pill, padding: "2px 8px", color: COLOR.textDim }}>
                  {COLOR_GLYPH[r.role]} {r.meaning}
                </span>
              ))}
            </div>
          </>
        ) : null}

        {reading.principle ? (
          <div style={S.principleBox}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ ...TYPE.micro, color: "#a78bfa" }}>עיקרון כללי · GENERAL PRINCIPLE (פרשנות, לא איסור)</span>
              <ProvenanceBadge p="STATIC" />
            </div>
            <div style={{ fontSize: FS.read, fontWeight: 700, color: COLOR.text, marginTop: 4 }}>{reading.principle.text}</div>
            <div style={{ fontSize: FS.meta, color: "#fbbf24", marginTop: 3 }}>{reading.principle.qualifier}</div>
          </div>
        ) : null}
      </div>

      {/* UNKNOWN — what nothing real answers yet */}
      <div style={S.zone}>
        <div style={S.zoneHead}>
          <span style={S.zoneTitle}>לא ידוע · UNKNOWN</span>
          <ProvenanceBadge p="UNKNOWN" />
        </div>
        <Row label="Effect" value={effectLinked ? "Effect מקושר לתצפית דרך Learning" : "אין Effect מקושר (Effect מפנה ל-Action בלבד; קישור לתצפית עובר רק דרך Learning) — לא מומצא"} good={effectLinked} />
        <Row label="Learning" value={learningLinked ? "קיים Learning ש-prior_state_ref שלו מפנה לתצפית זו" : "אין Learning שנגזר מהתצפית — לא מומצא"} good={learningLinked} />
        <Row label="מדידות בתאים אחרים" value={`רק ${reading.recorded_cell.domain}/${reading.recorded_cell.frame} נמדד; שאר התאים ללא level — UNKNOWN`} good={false} />
      </div>
    </section>
  );
}

function Row({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div style={S.row}>
      <span style={{ ...TYPE.micro, color: "#8fa3c9", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: FS.read, color: good ? COLOR.text : "#8798b8", fontStyle: good ? "normal" : "italic", textAlign: "left" }}>{value}</span>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  band: {
    background: "linear-gradient(180deg, rgba(167,139,250,0.06), rgba(11,15,26,0.9))",
    border: "1px solid rgba(167,139,250,0.3)",
    borderRadius: 18,
    padding: `${SPACE.md}px ${SPACE.lg}px`,
    margin: `${SPACE.md}px 0`,
  },
  headRow: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 },
  eyebrow: { ...TYPE.micro, color: "#a78bfa" },
  idChip: { fontSize: FS.base, fontWeight: 700, color: COLOR.textDim, border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.pill, padding: "2px 9px", fontFamily: "ui-monospace, monospace", direction: "ltr" },
  zone: { border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.md, padding: "8px 12px", marginBottom: 8, background: "rgba(10,14,23,0.45)" },
  zoneHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 },
  zoneTitle: { fontSize: FS.meta, fontWeight: 800, letterSpacing: 0.6, color: "#8fa3c9" },
  contextBox: { fontSize: FS.read, color: COLOR.text, lineHeight: 1.7, background: "rgba(90,120,180,0.07)", borderRadius: RADIUS.sm, padding: "8px 10px" },
  metaLine: { fontSize: FS.meta, color: COLOR.textDim, marginTop: 5, fontFamily: "ui-monospace, monospace", direction: "ltr", textAlign: "right" },
  gridWrap: { overflowX: "auto", marginBottom: 6 },
  table: { borderCollapse: "collapse", width: "100%", minWidth: 420 },
  th: { ...TYPE.micro, color: COLOR.textFaint, textAlign: "right", padding: "4px 8px", borderBottom: `1px solid ${COLOR.border}` },
  td: { fontSize: FS.meta, padding: "5px 8px", borderBottom: `1px solid rgba(120,150,220,0.08)` },
  noteLine: { fontSize: FS.base, color: COLOR.textFaint, marginBottom: 6, lineHeight: 1.5 },
  row: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "4px 8px", borderRadius: RADIUS.sm, background: "rgba(90,120,180,0.05)", marginBottom: 3 },
  principleBox: { border: "1px solid rgba(167,139,250,0.35)", borderRadius: RADIUS.md, padding: "8px 12px", marginTop: 6, background: "rgba(167,139,250,0.07)" },
  emptyLine: { fontSize: FS.read, fontStyle: "italic", color: "#8798b8" },
};
