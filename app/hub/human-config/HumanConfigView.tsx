import type { CollisionAuditRecord } from "@/app/lib/philos/humanConfig/masterUnitsSource";
import type {
  CanonicalConcept,
  DimensionCoverage,
  DomainGroup,
  HumanConfigSummary,
  MappingStatus,
  ParameterDetail,
  ParameterFilterKey,
  SemanticConceptType,
} from "@/app/lib/philos/humanConfig/humanConfigHierarchy";
import { buildSemanticTypeCounts, classifySemanticType, filterConceptsByStatus, PARAMETER_FILTER_KEYS } from "@/app/lib/philos/humanConfig/humanConfigHierarchy";
import { buildUnknownTemperamentReadings } from "@/app/lib/philos/humanConfig/temperamentDimensions";
import DimensionExplorer from "./DimensionExplorer";

const STATUS_LABEL: Record<MappingStatus, string> = { mapped: "MAPPED", unmapped: "UNMAPPED", review_required: "REVIEW_REQUIRED" };
const STATUS_COLOR: Record<MappingStatus, string> = { mapped: "#34d399", unmapped: "#5a76a3", review_required: "#fbbf24" };
const FILTER_LABEL: Record<ParameterFilterKey, string> = {
  known: "KNOWN", unknown: "UNKNOWN", conflict: "CONFLICT", review_required: "REVIEW_REQUIRED",
  has_evidence: "HAS_EVIDENCE", no_evidence: "NO_EVIDENCE", changed: "CHANGED", stable: "STABLE",
  has_open_questions: "HAS_OPEN_QUESTIONS",
};
const SEMANTIC_TYPE_LABEL: Record<SemanticConceptType, string> = {
  MEASURABLE_PARAMETER: "MEASURABLE_PARAMETER", MECHANISM: "MECHANISM", PROCESS: "PROCESS",
  THEORY: "THEORY", SUBJECT_DECLARATION: "SUBJECT_DECLARATION (source author's own insight — not the current subject)",
  REFERENCE: "REFERENCE", OTHER: "OTHER",
};
const SEMANTIC_TYPE_COLOR: Record<SemanticConceptType, string> = {
  MEASURABLE_PARAMETER: "#34d399", MECHANISM: "#5b9cf6", PROCESS: "#5b9cf6",
  THEORY: "#8fa3c9", SUBJECT_DECLARATION: "#fbbf24", REFERENCE: "#5a76a3", OTHER: "#5a76a3",
};
const SECTION_COLORS = ["#5b9cf6", "#34d399", "#fbbf24", "#f2635c", "#a78bfa", "#f472b6", "#22d3ee", "#94a3b8", "#fb923c", "#84cc16"];

export default function HumanConfigView({
  subjectId, sourceFileName, summary, hierarchy, concepts, reviewQueueCount, collisionAudit,
  selectedSection, selectedHeading, filter, selectedParameterId, selectedParameterDetail, dimensionCoverage,
}: {
  subjectId: string;
  sourceFileName: string;
  summary: HumanConfigSummary;
  hierarchy: DomainGroup[];
  concepts: CanonicalConcept[];
  reviewQueueCount: number;
  collisionAudit: CollisionAuditRecord[];
  selectedSection?: string;
  selectedHeading?: string;
  filter?: string;
  selectedParameterId?: string;
  selectedParameterDetail?: ParameterDetail;
  dimensionCoverage: DimensionCoverage[];
}) {
  const temperamentReadings = buildUnknownTemperamentReadings();
  const measurableCount = temperamentReadings.length;
  const showingExplorer = !selectedParameterId && !selectedSection && !filter;

  return (
    <div dir="rtl" style={{ padding: "16px 20px 40px", color: "#e6ebf5", fontFamily: "system-ui" }}>
      <Hero subjectId={subjectId} />
      <StatStrip known={0} unknown={measurableCount} evidence={0} dimensions={summary.navigableDimensionCount} sections={summary.sectionCount} concepts={summary.canonicalConceptCount} />

      <ModelCoverageGraph hierarchy={hierarchy} totalUnits={summary.humanDomainUnits} />
      <SemanticCompositionBar concepts={concepts} />
      <CurrentPersonPanel readings={temperamentReadings} />
      <ReviewQueueCompact humanReviewRequired={summary.reviewRequired} reviewQueueCount={reviewQueueCount} />

      <div style={S.sectionDivider}>HUMAN MODEL — {summary.sectionCount} Section · {summary.navigableDimensionCount} Dimension · {summary.canonicalConceptCount} concepts</div>

      <DimensionExplorer dimensions={dimensionCoverage} />

      <FilterBar active={filter} />

      {selectedParameterId ? (
        selectedParameterDetail ? (
          <ParameterInspector detail={selectedParameterDetail} backSection={selectedSection} backHeading={selectedHeading} />
        ) : (
          <div style={S.note}>Parameter "{selectedParameterId}" לא נמצא — ייתכן שאינו שייך ל-Human domain (ראה חריגת "תאוריה מוזיקלית", §27).</div>
        )
      ) : filter?.startsWith("semantic:") ? (
        <SemanticFilteredList type={filter.slice("semantic:".length) as SemanticConceptType} concepts={concepts} />
      ) : filter && PARAMETER_FILTER_KEYS.includes(filter as ParameterFilterKey) ? (
        <FilteredConceptList filter={filter as ParameterFilterKey} concepts={concepts} />
      ) : selectedHeading && selectedSection ? (
        <ConceptList section={selectedSection} heading={selectedHeading} concepts={concepts.filter((c) => c.section === selectedSection && c.heading === selectedHeading)} />
      ) : selectedSection ? (
        <HeadingList section={selectedSection} dimensions={hierarchy.find((d) => d.section === selectedSection)?.dimensions ?? []} />
      ) : (
        <SectionMap hierarchy={hierarchy} totalUnits={summary.humanDomainUnits} />
      )}

      {showingExplorer ? null : <div style={{ height: 4 }} />}

      <SourceAndAudit
        sourceFileName={sourceFileName}
        summary={summary}
        reviewQueueCount={reviewQueueCount}
        collisionAudit={collisionAudit}
        dimensionCoverage={dimensionCoverage}
      />
    </div>
  );
}

// ── Hero / status ────────────────────────────────────────────────────────

function Hero({ subjectId }: { subjectId: string }) {
  return (
    <div style={S.hero}>
      <div style={S.heroKicker}>CURRENT PERSON · {subjectId} · <span style={{ color: "#34d399" }}>REAL</span></div>
      <h1 style={S.heroTitle}>HUMAN CONFIGURATION</h1>
    </div>
  );
}

function StatStrip({ known, unknown, evidence, dimensions, sections, concepts }: { known: number; unknown: number; evidence: number; dimensions: number; sections: number; concepts: number }) {
  return (
    <div style={S.statStrip}>
      <StatCell label="WHAT WE KNOW" value={`${known} evidence-backed`} color="#34d399" />
      <StatCell label="WHAT WE DON'T KNOW" value={`${unknown} measurable unresolved`} color="#5a76a3" />
      <StatCell label="EVIDENCE" value={String(evidence)} color="#5a76a3" />
      <StatCell label="MODEL" value={`${sections} Sections · ${dimensions} Dimensions · ${concepts} concepts`} color="#5aa6ff" />
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={S.statCell}>
      <div style={{ ...S.statValue, color }}>{value}</div>
      <div style={S.statLabel}>{label}</div>
    </div>
  );
}

// ── Model coverage graph (proportional, by Section) ─────────────────────

function ModelCoverageGraph({ hierarchy, totalUnits }: { hierarchy: DomainGroup[]; totalUnits: number }) {
  return (
    <div style={S.graphWrap}>
      <div style={S.graphHead}>MODEL COVERAGE — {totalUnits} units by Section</div>
      <div style={S.graphBar}>
        {hierarchy.map((d, i) => (
          <a
            key={d.section}
            href={`?section=${encodeURIComponent(d.section)}`}
            style={{ width: `${(d.unitCount / totalUnits) * 100}%`, background: SECTION_COLORS[i % SECTION_COLORS.length] }}
            title={`${d.section}: ${d.unitCount} units`}
          />
        ))}
      </div>
      <div style={S.graphLegend}>
        {hierarchy.map((d, i) => (
          <a key={d.section} href={`?section=${encodeURIComponent(d.section)}`} style={{ ...S.graphLegendItem, color: SECTION_COLORS[i % SECTION_COLORS.length] }}>
            ■ {d.section} <span style={S.meta}>{d.unitCount}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Semantic composition (proportional, by real Type-derived category) ──

function SemanticCompositionBar({ concepts }: { concepts: CanonicalConcept[] }) {
  const counts = buildSemanticTypeCounts(concepts);
  const total = concepts.length;
  const measurable = counts.find((c) => c.type === "MEASURABLE_PARAMETER")?.count ?? 0;
  return (
    <div style={S.graphWrap}>
      <div style={S.graphHead}>SEMANTIC COMPOSITION — {total} concepts, {measurable} verified MEASURABLE_PARAMETER</div>
      <div style={S.graphBar}>
        {counts.map((c) => (
          <a key={c.type} href={`?filter=semantic:${c.type}`} style={{ width: `${(c.count / total) * 100}%`, background: SEMANTIC_TYPE_COLOR[c.type] }} title={`${c.type}: ${c.count}`} />
        ))}
      </div>
      <div style={S.graphLegend}>
        {counts.map((c) => (
          <a key={c.type} href={`?filter=semantic:${c.type}`} style={{ ...S.graphLegendItem, color: SEMANTIC_TYPE_COLOR[c.type] }}>
            ■ {c.type} <span style={S.meta}>{c.count}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Current Person — 7 measurable parameters as compact range rows ──────

function CurrentPersonPanel({ readings }: { readings: ReturnType<typeof buildUnknownTemperamentReadings> }) {
  return (
    <div style={S.personWrap}>
      <div style={S.graphHead}>CURRENT PERSON — {readings.length} measurable parameters, 0 resolved</div>
      <div style={S.personGrid}>
        {readings.map((r) => (
          <a
            key={r.range.parameter_id}
            href={`?section=${encodeURIComponent(r.range.section)}&heading=${encodeURIComponent(r.range.heading)}&parameter=${encodeURIComponent(r.range.canonical_id)}`}
            style={S.personRow}
          >
            <div style={S.personLabel}>{r.range.label}</div>
            <div style={S.personRange}>
              <span style={S.personEnd}>{r.range.low}</span>
              <span style={S.personTrack}><span style={S.personUnknownDot}>?</span></span>
              <span style={S.personEnd}>{r.range.high}</span>
            </div>
            <div style={S.personMeta}>evidence 0 · history 0</div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Review queue — compact secondary line, not a wall of prose ──────────

function ReviewQueueCompact({ humanReviewRequired, reviewQueueCount }: { humanReviewRequired: number; reviewQueueCount: number }) {
  return (
    <a href="?filter=review_required" style={S.reviewCompact}>
      <span style={S.reviewCompactCount}>{humanReviewRequired}</span> REVIEW_REQUIRED בתוך Human Config
      <span style={S.meta}> · {reviewQueueCount} סה״כ בכל ה-Domain-ים</span>
    </a>
  );
}

// ── Section map — large, explorable tiles (the primary visual) ──────────

function SectionMap({ hierarchy, totalUnits }: { hierarchy: DomainGroup[]; totalUnits: number }) {
  return (
    <div style={S.mapGrid}>
      {hierarchy.map((d, i) => (
        <a key={d.section} href={`?section=${encodeURIComponent(d.section)}`} style={S.mapCard}>
          <div style={{ ...S.mapCardBar, width: `${(d.unitCount / totalUnits) * 100}%`, background: SECTION_COLORS[i % SECTION_COLORS.length] }} />
          <div style={S.mapCardTitle}>{d.section}</div>
          <div style={S.mapCardMeta}>{d.unitCount} units · {d.dimensions.length} Heading</div>
        </a>
      ))}
    </div>
  );
}

function FilterBar({ active }: { active?: string }) {
  return (
    <div style={S.filterBar}>
      <span style={S.filterBarLabel}>Parameter filters:</span>
      {PARAMETER_FILTER_KEYS.map((key) => (
        <a key={key} href={`?filter=${key}`} style={{ ...S.filterChip, ...(active === key ? S.filterChipActive : {}) }}>{FILTER_LABEL[key]}</a>
      ))}
      {active ? <a href="/hub/human-config" style={S.filterClear}>נקה סינון ×</a> : null}
    </div>
  );
}

function SemanticFilteredList({ type, concepts }: { type: SemanticConceptType; concepts: CanonicalConcept[] }) {
  const filtered = concepts.filter((c) => classifySemanticType(c) === type);
  return (
    <>
      <a href="/hub/human-config" style={S.back}>← כל ה-Section</a>
      <div style={S.subHead}>{SEMANTIC_TYPE_LABEL[type]} — {filtered.length} concepts</div>
      {filtered.map((c) => <ConceptCard key={c.canonicalId} concept={c} />)}
    </>
  );
}

function FilteredConceptList({ filter, concepts }: { filter: ParameterFilterKey; concepts: CanonicalConcept[] }) {
  const filtered = filterConceptsByStatus(concepts, filter);
  return (
    <>
      <div style={S.subHead}>{FILTER_LABEL[filter]} — {filtered.length} Parameter</div>
      {filtered.length === 0 ? (
        <div style={S.note}>
          0 תוצאות — {["known", "has_evidence", "changed", "stable"].includes(filter)
            ? "אמיתי: אין מצב חי/עדות/היסטוריה לאף Parameter כרגע, לא באג."
            : "conflict: אין join אמין ל-Canonical_ID ברמת TAXONOMY_COLLISION_AUDIT — לא מוצג ניחוש."}
        </div>
      ) : (
        filtered.map((c) => <ConceptCard key={c.canonicalId} concept={c} />)
      )}
    </>
  );
}

function ParameterInspector({ detail, backSection, backHeading }: { detail: ParameterDetail; backSection?: string; backHeading?: string }) {
  return (
    <div style={S.inspector}>
      <a href={backSection && backHeading ? `?section=${encodeURIComponent(backSection)}&heading=${encodeURIComponent(backHeading)}` : "/hub/human-config"} style={S.back}>← חזרה</a>
      <div style={S.inspectorTitle}>{detail.name}</div>
      <div style={{ ...S.semanticTag, color: SEMANTIC_TYPE_COLOR[detail.semanticType] }}>{SEMANTIC_TYPE_LABEL[detail.semanticType]}</div>
      <div style={S.inspectorMeta}>{detail.parameterId} · Config Family: {detail.configFamily} · Domain: {detail.domain} · Dimension: {detail.dimension}</div>
      <div style={S.row}><span>OPERATIONAL MEANING</span><span style={S.meta}>{detail.operationalMeaning.value} ({detail.operationalMeaning.evidence})</span></div>

      {detail.semanticType !== "MEASURABLE_PARAMETER" ? (
        <div style={S.note}>
          <b>זהו {SEMANTIC_TYPE_LABEL[detail.semanticType]}, לא MEASURABLE_PARAMETER.</b> שדות CURRENT/BASELINE/Δ/DIRECTION/STABILITY
          למטה מוצגים מבנית לאחידות סכימה בלבד — אין להם משמעות מדידה עבור תוכן מסוג זה. רק פרמטרים תחת Heading
          "{"ממדי מזג — פרמטרים לאבחון"}" (Temperament) מסווגים כ-MEASURABLE_PARAMETER אמיתי במקור זה כרגע.
        </div>
      ) : null}

      <div style={S.stateGrid}>
        <StateCell label="CURRENT STATE" d={detail.currentState} />
        <StateCell label="BASELINE" d={detail.baseline} />
        <StateCell label="DELTA" d={detail.delta} />
        <StateCell label="DIRECTION" d={detail.direction} />
        <StateCell label="STABILITY" d={detail.stability} />
        <StateCell label="CONTRADICTION" d={detail.contradiction} />
        <StateCell label="LAST UPDATE" d={detail.lastUpdate} />
      </div>
      <div style={S.row}><span>EPISTEMIC STATUS</span><span style={S.meta}>{detail.epistemicStatus.value} — {detail.epistemicStatus.evidence}</span></div>
      <div style={S.row}><span>EVIDENCE</span><span style={S.meta}>{detail.evidenceCount} רשומות</span></div>
      <div style={S.row}><span>OBSERVATIONS</span><span style={S.meta}>{detail.observationCount}</span></div>
      <div style={S.row}><span>OPEN QUESTIONS (REVIEW_REQUIRED)</span><span style={S.meta}>{detail.openReviewCount}</span></div>
      <div style={S.row}><span>HISTORY</span><span style={S.meta}>{detail.history.status} — {detail.history.reason}</span></div>

      <div style={S.subHead}>SOURCE STATEMENTS — {detail.sourceStatements.length} (אין "שאלות מקור" פורמליות במקור זה — ראה Source & Audit)</div>
      {detail.sourceStatements.map((it) => (
        <div key={it.record.Atomic_ID} style={S.sourceRow}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ ...S.statusTag, color: STATUS_COLOR[it.status] }}>{STATUS_LABEL[it.status]}</span>
            <span style={S.meta}>{it.record.Type} · {it.record.Atomic_ID} · Source_ID {it.record.Source_ID} · Document_ID {it.record.Document_ID}</span>
          </div>
          <div style={S.originalText}>{it.record.Original_Text}</div>
          {it.reviewReason ? <div style={S.reviewReason}>Reason_Open (מה נותר לא ידוע): {it.reviewReason}</div> : null}
          <div style={S.meta}>
            Provenance: {detail.sourceFileName} · Sheet: MASTER_UNITS · Line {it.record.Source_Line_Start}–{it.record.Source_Line_End} ·
            Version {it.record.Version} · Confidence {it.record.Confidence} · Status: {it.record.Status}
          </div>
        </div>
      ))}
    </div>
  );
}

function StateCell({ label, d }: { label: string; d: { value: string | null; status: string } }) {
  return (
    <div style={S.stateCell}>
      <div style={S.stateLabel}>{label}</div>
      <div style={{ ...S.stateValue, color: d.status === "unknown" ? "#5a76a3" : "#dbe6f6" }}>{d.value ?? "לא ידוע"}</div>
    </div>
  );
}

function HeadingList({ section, dimensions }: { section: string; dimensions: DomainGroup["dimensions"] }) {
  return (
    <>
      <a href="/hub/human-config" style={S.back}>← כל ה-Section</a>
      <div style={S.subHead}>{section} — Heading (Dimension), {dimensions.length}</div>
      <div style={S.grid}>
        {dimensions.map((h) => (
          <a key={h.heading} href={`?section=${encodeURIComponent(section)}&heading=${encodeURIComponent(h.heading)}`} style={S.card}>
            <div style={S.cardTitle}>{h.heading}</div>
            <div style={S.cardMeta}>{h.units.length} units · {h.canonicalConceptCount} Canonical concept</div>
          </a>
        ))}
      </div>
    </>
  );
}

function ConceptList({ section, heading, concepts }: { section: string; heading: string; concepts: CanonicalConcept[] }) {
  return (
    <>
      <a href={`?section=${encodeURIComponent(section)}`} style={S.back}>← {section}</a>
      <div style={S.subHead}>{heading} — Canonical concepts (Parameter), {concepts.length}</div>
      {concepts.map((c) => <ConceptCard key={c.canonicalId} concept={c} />)}
    </>
  );
}

function ConceptCard({ concept, onlyStatus }: { concept: CanonicalConcept; onlyStatus?: MappingStatus }) {
  const items = onlyStatus ? concept.sourceItems.filter((i) => i.status === onlyStatus) : concept.sourceItems;
  if (items.length === 0) return null;
  return (
    <div style={S.conceptCard}>
      <a href={`?section=${encodeURIComponent(concept.section)}&heading=${encodeURIComponent(concept.heading)}&parameter=${encodeURIComponent(concept.canonicalId)}`} style={S.conceptTitleLink}>
        {concept.canonicalText} →
      </a>
      <span style={{ ...S.semanticTag, color: SEMANTIC_TYPE_COLOR[classifySemanticType(concept)] }}>{classifySemanticType(concept)}</span>
      <div style={S.conceptMeta}>{concept.canonicalId} · {concept.section} → {concept.heading}</div>
      <div style={S.list}>
        {items.map((it) => (
          <div key={it.record.Atomic_ID} style={S.sourceRow}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ ...S.statusTag, color: STATUS_COLOR[it.status] }}>{STATUS_LABEL[it.status]}</span>
              <span style={S.meta}>{it.record.Atomic_ID} · {it.record.Source_ID} · v{it.record.Version} · confidence {it.record.Confidence}</span>
            </div>
            <div style={S.originalText}>{it.record.Original_Text}</div>
            {it.reviewReason ? <div style={S.reviewReason}>Reason_Open: {it.reviewReason}</div> : null}
            {it.record.Editor_Note ? <div style={S.meta}>Editor_Note: {it.record.Editor_Note}</div> : null}
            {it.record.Validation_Note ? <div style={S.meta}>Validation_Note: {it.record.Validation_Note}</div> : null}
            {it.record.Duplicate_Group ? <div style={S.meta}>Duplicate_Group: {it.record.Duplicate_Group}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Source & Audit — everything below is real, verified, and deliberately
//    demoted out of the primary view (moved, never deleted). ─────────────

function SourceAndAudit({
  sourceFileName, summary, reviewQueueCount, collisionAudit, dimensionCoverage,
}: {
  sourceFileName: string;
  summary: HumanConfigSummary;
  reviewQueueCount: number;
  collisionAudit: CollisionAuditRecord[];
  dimensionCoverage: DimensionCoverage[];
}) {
  return (
    <details style={S.auditDetails}>
      <summary style={S.auditSummary}>SOURCE & AUDIT — מקור, מדדי ביקורת, והסברי התאמה מלאים</summary>
      <div style={{ marginTop: 10 }}>
        <div style={S.sourceLine}>
          מקור: {sourceFileName} · MASTER_UNITS · Domain = "אדם", בניכוי Section/Heading לא-אנושיים שנמצאו בביקורת (§27/§30/§31: תאוריה מוזיקלית, פטנטים, מיוצגים — Domain=אדם אינו מספיק הוכחה לשייכות ל-Human Config)
        </div>

        <div style={S.summaryGrid}>
          <Metric label="Units (סה״כ קובץ)" value={summary.totalUnits} />
          <Metric label="Human domain units" value={summary.humanDomainUnits} />
          <Metric label="MAPPED" value={summary.mapped} color={STATUS_COLOR.mapped} />
          <Metric label="UNMAPPED" value={summary.unmapped} color={STATUS_COLOR.unmapped} />
          <Metric label="REVIEW_REQUIRED" value={summary.reviewRequired} color={STATUS_COLOR.review_required} />
          <Metric label="Sections (Domain רמת-מוצר)" value={summary.sectionCount} />
          <Metric label="Unique Heading text" value={summary.uniqueHeadingTextCount} />
          <Metric label="Navigable Dimensions (Section×Heading)" value={summary.navigableDimensionCount} />
          <Metric label="Canonical concepts (Parameter)" value={summary.canonicalConceptCount} />
        </div>

        <div style={S.note}>
          <b>MODEL COVERAGE לעומת SUBJECT COVERAGE — שתי מדידות נפרדות.</b> MODEL COVERAGE = גודל הטקסונומיה עצמה
          ({summary.canonicalConceptCount} Canonical concepts תחת {summary.navigableDimensionCount} Dimension, {summary.sectionCount} Section) — קיים תמיד, בלי תלות ב-subject.
          SUBJECT COVERAGE = כמה מהם ידועים ל-subject נוכחי ספציפי — <span style={{ color: "#5a76a3" }}>0 כרגע</span>, לכל subject אמיתי, כי אין עדיין Observation
          קנוני המקושר לאף Canonical_ID. מודל גדול + subject לא ידוע הם שני דברים אמיתיים ושונים — לא סתירה, ולא מודל "ריק".
        </div>

        <div style={S.note}>
          <b>שני מספרי Heading אמיתיים, לא סתירה:</b> UNIQUE_CANONICAL_HEADINGS = {summary.uniqueHeadingTextCount} (שמות Heading ייחודיים,
          ללא תלות ב-Section) · HUMAN_PRODUCT_HEADINGS (נווט בפועל, Section×Heading) = {summary.navigableDimensionCount}.
          27 שמות Heading אמיתיים חוזרים תחת יותר מ-Section אחד (למשל "תאוריית הדחף" מופיע תחת 3 Section שונים) —
          לכן המספר השני גבוה יותר, ומייצג את מבנה הניווט האמיתי.
        </div>

        <div style={S.note}>
          <b>Person → Human Config נפרד מ-Person → Selected Value Domain.</b> Section "תאוריה מוזיקלית"
          הוחרג במפורש ממסך זה — במקור עצמו 30 רשומות תחת אותה Section מתויגות Domain="אדם", אך תוכנן שייך
          ל-Value Domain (מוזיקה), לא לאדם באופן כללי. חוסר עקביות תיוג אמיתי במקור, לא בקוד — תוקן ב-humanDomainUnits(),
          עם בדיקת רגרסיה אוטומטית שאין תוכן מוזיקלי ב-Human Config.
        </div>

        <div style={S.note}>
          <b>אין מטריצת 9 תאים (PHYSICAL/EMOTIONAL/COGNITIVE × PERSONAL/SOCIAL/SYSTEMIC) במקור האמיתי.</b>{" "}
          נבדק ישירות מול הקובץ: לעמודת Domain 4 ערכים בלבד (אדם/מוזיקה/מבנה/משותף), לעמודת Section 11 ערכים —
          אף אחת מהן אינה יוצרת רשת 3×3. המבנה האמיתי המוצג למעלה (Section → Heading → Canonical_ID) הוא המבנה שהמקור עצמו מכיל.
        </div>

        <div style={S.note}>
          <b>מבנה מקור ≠ תשובה ≠ תצפית ≠ מצב חי.</b> אף Canonical_ID כאן אינו מקושר לתצפית canon אמיתית לשום subject —
          המצב החי של כל פרמטר הוא <span style={{ color: "#5a76a3" }}>לא ידוע</span>, במפורש, לא מוסתר.
        </div>

        <div style={S.coverageGrid}>
          {summary.sourceCoverage.map((c) => (
            <div key={c.Check} style={S.coverageRow}><span>{c.Check}</span><span style={S.meta}>{c.Value}</span></div>
          ))}
        </div>

        <div style={S.note}>
          לשם השוואה: SEMANTIC_REVIEW_QUEUE במקור מכיל {reviewQueueCount} רשומות בסה״כ, על פני כל ה-Domain-ים (אדם/מוזיקה/מבנה/משותף) —
          לא רק Human Config. שני מספרים אמיתיים, אוכלוסיות שונות, לא סתירה.
        </div>

        {collisionAudit.length > 0 ? (
          <>
            <div style={S.subHead}>TAXONOMY_COLLISION_AUDIT — {collisionAudit.length} רשומות ביקורת (כבר נפתרו במקור)</div>
            <div style={S.list}>
              {collisionAudit.map((c, i) => (
                <div key={`${c.Heading_ID}_${i}`} style={S.row}>
                  <span>{c.Exact_Text || c.Heading_ID}</span>
                  <span style={S.meta}>{c.Verdict}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}

        <div style={S.subHead}>Source Coverage by Dimension — {dimensionCoverage.length} Heading (raw table)</div>
        <div style={S.scroll}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.thLabel}>Section → Heading</th>
                <th style={S.th}>Units</th>
                <th style={S.th}>MAPPED</th>
                <th style={S.th}>UNMAPPED</th>
                <th style={S.th}>REVIEW</th>
                <th style={S.th}>Parameters</th>
              </tr>
            </thead>
            <tbody>
              {dimensionCoverage.map((d) => (
                <tr key={`${d.section}_${d.heading}`}>
                  <td style={S.tdLabel}>
                    <a href={`?section=${encodeURIComponent(d.section)}&heading=${encodeURIComponent(d.heading)}`} style={S.tableLink}>{d.section} → {d.heading}</a>
                  </td>
                  <td style={S.td}>{d.unitCount}</td>
                  <td style={{ ...S.td, color: STATUS_COLOR.mapped }}>{d.mapped}</td>
                  <td style={{ ...S.td, color: STATUS_COLOR.unmapped }}>{d.unmapped}</td>
                  <td style={{ ...S.td, color: STATUS_COLOR.review_required }}>{d.reviewRequired}</td>
                  <td style={S.td}>{d.canonicalConceptCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

function Metric({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={S.metric}>
      <div style={{ ...S.metricValue, color: color ?? "#dbe6f6" }}>{value}</div>
      <div style={S.metricLabel}>{label}</div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  hero: { marginBottom: 10 },
  heroKicker: { fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: "#8fa3c9" },
  heroTitle: { fontSize: 22, fontWeight: 800, margin: "2px 0 0" },

  statStrip: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, margin: "12px 0 16px" },
  statCell: { background: "rgba(18,24,38,0.7)", border: "1px solid rgba(90,120,180,0.16)", borderRadius: 10, padding: "9px 12px" },
  statValue: { fontSize: 14, fontWeight: 800 },
  statLabel: { fontSize: 9, color: "#8fa3c9", marginTop: 3, letterSpacing: 0.4 },

  graphWrap: { marginBottom: 16 },
  graphHead: { fontSize: 11, fontWeight: 700, color: "#8fa3c9", marginBottom: 5 },
  graphBar: { display: "flex", height: 16, borderRadius: 5, overflow: "hidden", background: "rgba(90,120,180,0.1)" },
  graphLegend: { display: "flex", flexWrap: "wrap", gap: 12, fontSize: 10, marginTop: 6 },
  graphLegendItem: { textDecoration: "none" },

  personWrap: { marginBottom: 16 },
  personGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 8, marginTop: 6 },
  personRow: { display: "block", border: "1px solid rgba(90,120,180,0.2)", borderRadius: 10, padding: "9px 12px", textDecoration: "none", color: "inherit", background: "rgba(18,24,38,0.5)" },
  personLabel: { fontSize: 11.5, fontWeight: 700, color: "#dbe6f6" },
  personRange: { display: "flex", alignItems: "center", gap: 6, marginTop: 6 },
  personEnd: { fontSize: 9, color: "#5a76a3", fontWeight: 700, whiteSpace: "nowrap" },
  personTrack: { flex: 1, height: 3, background: "rgba(90,120,180,0.25)", borderRadius: 2, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" },
  personUnknownDot: { fontSize: 9, color: "#5a76a3", background: "#0b0f1a", padding: "0 4px" },
  personMeta: { fontSize: 9, color: "#5a76a3", marginTop: 5 },

  reviewCompact: { display: "block", fontSize: 11, color: "#fbbf24", textDecoration: "none", marginBottom: 16, padding: "8px 12px", background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 8 },
  reviewCompactCount: { fontWeight: 800 },

  sectionDivider: { fontSize: 11, fontWeight: 700, color: "#5aa6ff", margin: "18px 0 8px", paddingTop: 10, borderTop: "1px solid rgba(90,120,180,0.15)" },

  mapGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 },
  mapCard: { display: "block", border: "1px solid rgba(90,120,180,0.25)", borderRadius: 12, padding: "14px 16px", textDecoration: "none", color: "inherit", background: "rgba(18,24,38,0.6)", overflow: "hidden", position: "relative" },
  mapCardBar: { height: 3, borderRadius: 2, marginBottom: 10 },
  mapCardTitle: { fontSize: 14.5, fontWeight: 800, color: "#f0f4fc" },
  mapCardMeta: { fontSize: 10.5, color: "#8aa0c8", marginTop: 5 },

  sourceLine: { fontSize: 10.5, color: "#5a76a3", marginBottom: 14 },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 14 },
  metric: { background: "rgba(18,24,38,0.7)", border: "1px solid rgba(90,120,180,0.14)", borderRadius: 10, padding: "8px 10px" },
  metricValue: { fontSize: 18, fontWeight: 800 },
  metricLabel: { fontSize: 9.5, color: "#8fa3c9", marginTop: 2 },

  auditDetails: { marginTop: 20, borderTop: "1px solid rgba(90,120,180,0.15)", paddingTop: 12 },
  auditSummary: { cursor: "pointer", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: "#5a76a3" },

  coverageGrid: { display: "flex", flexDirection: "column", gap: 3, marginTop: 8, marginBottom: 14, maxWidth: 500 },
  coverageRow: { display: "flex", justifyContent: "space-between", fontSize: 11, padding: "3px 8px", background: "rgba(90,120,180,0.05)", borderRadius: 5 },

  note: { fontSize: 11, color: "#8fa3c9", lineHeight: 1.8, marginBottom: 10, maxWidth: 900, padding: "8px 10px", background: "rgba(90,120,180,0.05)", borderRadius: 8 },

  subHead: { fontSize: 12, fontWeight: 700, color: "#5aa6ff", marginTop: 10, marginBottom: 8 },
  back: { display: "inline-block", fontSize: 11, color: "#5b9cf6", textDecoration: "none", marginBottom: 10 },

  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 8 },
  card: { display: "block", border: "1px solid rgba(90,120,180,0.2)", borderRadius: 10, padding: "10px 12px", textDecoration: "none", color: "inherit", background: "rgba(18,24,38,0.5)" },
  cardTitle: { fontSize: 12.5, fontWeight: 700, color: "#dbe6f6" },
  cardMeta: { fontSize: 10, color: "#8aa0c8", marginTop: 3 },

  conceptCard: { border: "1px solid rgba(90,120,180,0.2)", borderRadius: 10, padding: "10px 12px", marginBottom: 10 },
  conceptTitleLink: { fontSize: 13, fontWeight: 700, color: "#5b9cf6", textDecoration: "none" },
  conceptMeta: { fontSize: 10, color: "#5a76a3", marginBottom: 6 },
  list: { display: "flex", flexDirection: "column", gap: 6 },
  sourceRow: { borderTop: "1px solid rgba(90,120,180,0.1)", paddingTop: 6, marginBottom: 6 },
  statusTag: { fontSize: 9, fontWeight: 800, letterSpacing: 0.5 },
  semanticTag: { display: "inline-block", fontSize: 9, fontWeight: 800, letterSpacing: 0.3, marginTop: 3, marginBottom: 3 },
  originalText: { fontSize: 12, color: "#e6ebf5", marginTop: 3, lineHeight: 1.6 },
  reviewReason: { fontSize: 10, color: "#fbbf24", marginTop: 2 },
  meta: { fontSize: 10, color: "#8aa0c8" },
  row: { display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 8px", borderRadius: 6, background: "rgba(90,120,180,0.05)", fontSize: 11, marginBottom: 3 },

  filterBar: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, margin: "4px 0 14px" },
  filterBarLabel: { fontSize: 10, color: "#5a76a3", marginLeft: 4 },
  filterChip: { fontSize: 10, padding: "3px 9px", borderRadius: 12, border: "1px solid rgba(90,120,180,0.3)", color: "#8fa3c9", textDecoration: "none" },
  filterChipActive: { color: "#0b0f1a", background: "#5b9cf6", borderColor: "#5b9cf6", fontWeight: 700 },
  filterClear: { fontSize: 10, color: "#f2635c", textDecoration: "none" },

  scroll: { overflowX: "auto", border: "1px solid rgba(90,120,180,0.2)", borderRadius: 8, marginTop: 8 },
  table: { borderCollapse: "collapse", width: "100%", fontSize: 10.5 },
  th: { padding: "6px 8px", color: "#8fa3c9", fontWeight: 700, textAlign: "center", borderBottom: "1px solid rgba(90,120,180,0.2)" },
  thLabel: { padding: "6px 8px", color: "#8fa3c9", fontWeight: 700, textAlign: "right", borderBottom: "1px solid rgba(90,120,180,0.2)" },
  td: { padding: "5px 8px", textAlign: "center", borderBottom: "1px solid rgba(90,120,180,0.08)" },
  tdLabel: { padding: "5px 8px", textAlign: "right", borderBottom: "1px solid rgba(90,120,180,0.08)" },
  tableLink: { color: "#5b9cf6", textDecoration: "none" },

  inspector: { border: "1px solid rgba(91,156,246,0.3)", borderRadius: 12, padding: "14px 16px", marginTop: 8 },
  inspectorTitle: { fontSize: 15, fontWeight: 800, color: "#f0f4fc" },
  inspectorMeta: { fontSize: 10.5, color: "#5a76a3", marginBottom: 10 },
  stateGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 6, marginBottom: 8 },
  stateCell: { padding: "6px 8px", borderRadius: 6, background: "rgba(90,120,180,0.05)" },
  stateLabel: { fontSize: 8.5, color: "#5a76a3" },
  stateValue: { fontSize: 11.5, fontWeight: 600, marginTop: 2 },
};
