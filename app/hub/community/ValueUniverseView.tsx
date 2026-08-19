/**
 * VALUE UNIVERSE — the 328-entry Board reconciliation
 * (`valueUniverse328.ts`/`valueUniverseClassification.ts`), made visible
 * and navigable (Mission B, batch B1/B2). FAMILY → SUBVALUES → VALUE
 * DETAIL hierarchy — never a flat wall of 251 identical chips.
 *
 * This is a DIFFERENT population from `ValueLandscape`'s `valueRegistry`
 * (the live runtime Value registry, ~15-45 entries derived from real
 * Value-Group `central_value`s + PUDM candidates). The two connect at
 * exactly one real, checkable point: a subvalue's `status ===
 * "CANONICAL_RUNTIME"` means its name matched a live runtime Value —
 * shown here as a real link into `?mode=values&value=...`, never a
 * separate, disconnected fact.
 */
import type { RawFamily, RawSourceEntry } from "@/app/lib/philos/community/valueUniverse328";
import type { ClassifiedSubvalue, SubvalueStatus } from "@/app/lib/philos/community/valueUniverseClassification";
import type { ValueScope } from "@/app/lib/philos/community/valueRegistry";
import { S, DetailRow } from "./CommunityUniverse";
import { SCOPE_COLOR, PROMOTION_STATUS_COLOR } from "./colors";

export interface UniverseSubvalueView extends ClassifiedSubvalue {
  /** Real, derived from the matched live runtime Value's own `scope` —
   *  only ever set when `status === "CANONICAL_RUNTIME"`. Every other
   *  subvalue has no live group membership to derive a scope from, so
   *  this stays `undefined` — a designed gap, not a guessed value. */
  scope?: ValueScope;
  /** Runtime `value_id`, when this subvalue matched a real live Value —
   *  lets the UI link directly into `?mode=values&value=...`. */
  matched_runtime_value_id?: string;
}

// Mission B, B13 — shared with every other surface, see
// `CommunityUniverse.tsx::PROMOTION_STATUS_COLOR`/`SCOPE_COLOR`.
const STATUS_COLOR: Record<SubvalueStatus, string> = PROMOTION_STATUS_COLOR as Record<SubvalueStatus, string>;

export type UniverseProvenanceFilter = "RUNTIME" | "SOURCE_ONLY";

export interface UniverseFilters {
  search?: string;
  familyId?: string;
  scope?: ValueScope;
  status?: SubvalueStatus;
  provenance?: UniverseProvenanceFilter;
  subvalueId?: string;
}

function subvalueMatchesFilters(sv: UniverseSubvalueView, f: UniverseFilters): boolean {
  if (f.search && !sv.name_he.includes(f.search)) return false;
  if (f.scope && sv.scope !== f.scope) return false;
  if (f.status && sv.status !== f.status) return false;
  if (f.provenance === "RUNTIME" && sv.status !== "CANONICAL_RUNTIME") return false;
  if (f.provenance === "SOURCE_ONLY" && sv.status === "CANONICAL_RUNTIME") return false;
  return true;
}

function buildQuery(base: UniverseFilters, override: Partial<UniverseFilters>): string {
  const merged: UniverseFilters = { ...base, ...override };
  const parts: string[] = ["mode=universe"];
  if (merged.familyId) parts.push(`family=${encodeURIComponent(merged.familyId)}`);
  if (merged.subvalueId) parts.push(`subvalue=${encodeURIComponent(merged.subvalueId)}`);
  if (merged.search) parts.push(`search=${encodeURIComponent(merged.search)}`);
  if (merged.scope) parts.push(`uscope=${merged.scope}`);
  if (merged.status) parts.push(`ustatus=${merged.status}`);
  if (merged.provenance) parts.push(`uprov=${merged.provenance}`);
  return `?${parts.join("&")}`;
}

export default function ValueUniverseView({
  families, subvalues, sourceEntries, filters,
}: {
  families: RawFamily[];
  subvalues: UniverseSubvalueView[];
  sourceEntries: RawSourceEntry[];
  filters: UniverseFilters;
}) {
  const entryById = new Map(sourceEntries.map((e) => [e.id, e]));
  const selectedSubvalue = filters.subvalueId ? subvalues.find((s) => s.subvalue_id === filters.subvalueId) : undefined;
  const selectedFamily = filters.familyId ? families.find((f) => f.id === filters.familyId) : undefined;

  if (selectedSubvalue) {
    return (
      <SubvalueDetail
        subvalue={selectedSubvalue}
        family={selectedSubvalue.family_id ? families.find((f) => f.id === selectedSubvalue.family_id) : undefined}
        sourceEntries={selectedSubvalue.source_entry_ids.map((id) => entryById.get(id)!).filter(Boolean)}
        backHref={buildQuery(filters, { subvalueId: undefined })}
      />
    );
  }

  const filtered = subvalues.filter((sv) => subvalueMatchesFilters(sv, filters));

  return (
    <>
      <FilterBar filters={filters} counts={{ total: subvalues.length, filtered: filtered.length }} />
      {selectedFamily ? (
        <FamilySubvalues family={selectedFamily} subvalues={filtered.filter((sv) => sv.family_id === selectedFamily.id)} filters={filters} />
      ) : filters.search || filters.scope || filters.status || filters.provenance ? (
        <SearchResults subvalues={filtered} families={families} filters={filters} />
      ) : (
        <FamilyGrid families={families} subvalues={subvalues} />
      )}
    </>
  );
}

function FilterBar({ filters, counts }: { filters: UniverseFilters; counts: { total: number; filtered: number } }) {
  const statuses: SubvalueStatus[] = ["CANONICAL_RUNTIME", "REVIEW_REQUIRED", "REFERENCE_ONLY", "UNSUPPORTED"];
  const scopes: ValueScope[] = ["INDIVIDUAL", "GROUP", "COMMON"];
  return (
    <div style={S.section}>
      <div style={S.sectionTitle}>יקום הערכים · VALUE UNIVERSE — 28 FAMILIES · 223 SUBVALUES</div>
      <form method="GET" style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input type="hidden" name="mode" value="universe" />
        {filters.familyId ? <input type="hidden" name="family" value={filters.familyId} /> : null}
        <input
          type="text" name="search" defaultValue={filters.search ?? ""} placeholder="חיפוש ערך…"
          style={{ flex: 1, fontSize: 12, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(90,120,180,0.3)", background: "rgba(18,24,38,0.6)", color: "#e6ebf5" }}
        />
        <button type="submit" style={{ ...S.actionBtn, border: "none", cursor: "pointer" }}>חיפוש</button>
      </form>
      <div style={{ ...S.groupChips, marginBottom: 6 }}>
        <span style={S.detailLabel}>STATUS:</span>
        <a href={buildQuery(filters, { status: undefined })} style={{ ...S.groupChip, borderColor: !filters.status ? "#5b9cf6" : "rgba(90,120,180,0.3)", color: !filters.status ? "#5b9cf6" : "#8fa3c9" }}>ALL</a>
        {statuses.map((st) => (
          <a key={st} href={buildQuery(filters, { status: filters.status === st ? undefined : st })} style={{ ...S.groupChip, borderColor: `${STATUS_COLOR[st]}66`, color: filters.status === st ? STATUS_COLOR[st] : "#8fa3c9", background: filters.status === st ? `${STATUS_COLOR[st]}18` : undefined }}>{st}</a>
        ))}
      </div>
      <div style={{ ...S.groupChips, marginBottom: 6 }}>
        <span style={S.detailLabel}>SCOPE:</span>
        <a href={buildQuery(filters, { scope: undefined })} style={{ ...S.groupChip, borderColor: !filters.scope ? "#5b9cf6" : "rgba(90,120,180,0.3)", color: !filters.scope ? "#5b9cf6" : "#8fa3c9" }}>ALL</a>
        {scopes.map((sc) => (
          <a key={sc} href={buildQuery(filters, { scope: filters.scope === sc ? undefined : sc })} style={{ ...S.groupChip, borderColor: `${SCOPE_COLOR[sc]}66`, color: filters.scope === sc ? SCOPE_COLOR[sc] : "#8fa3c9", background: filters.scope === sc ? `${SCOPE_COLOR[sc]}18` : undefined }}>{sc}</a>
        ))}
      </div>
      <div style={S.groupChips}>
        <span style={S.detailLabel}>PROVENANCE:</span>
        <a href={buildQuery(filters, { provenance: undefined })} style={{ ...S.groupChip, borderColor: !filters.provenance ? "#5b9cf6" : "rgba(90,120,180,0.3)", color: !filters.provenance ? "#5b9cf6" : "#8fa3c9" }}>ALL</a>
        <a href={buildQuery(filters, { provenance: filters.provenance === "RUNTIME" ? undefined : "RUNTIME" })} style={{ ...S.groupChip, borderColor: "#34d39966", color: filters.provenance === "RUNTIME" ? "#34d399" : "#8fa3c9" }}>RUNTIME (live Value)</a>
        <a href={buildQuery(filters, { provenance: filters.provenance === "SOURCE_ONLY" ? undefined : "SOURCE_ONLY" })} style={{ ...S.groupChip, borderColor: "#8fa3c966", color: filters.provenance === "SOURCE_ONLY" ? "#8fa3c9" : "#5a76a3" }}>SOURCE-ONLY (328 doc)</a>
      </div>
      {filters.search || filters.scope || filters.status || filters.provenance ? (
        <div style={{ ...S.note, marginTop: 8, marginBottom: 0 }}>{counts.filtered} / {counts.total} תואמים לסינון</div>
      ) : null}
    </div>
  );
}

function FamilyGrid({ families, subvalues }: { families: RawFamily[]; subvalues: UniverseSubvalueView[] }) {
  const byFamily = new Map<string, UniverseSubvalueView[]>();
  const crossFamily: UniverseSubvalueView[] = [];
  for (const sv of subvalues) {
    if (sv.family_id) {
      const arr = byFamily.get(sv.family_id) ?? [];
      arr.push(sv);
      byFamily.set(sv.family_id, arr);
    } else {
      crossFamily.push(sv);
    }
  }
  return (
    <div style={S.section}>
      <div style={S.sectionTitle}>28 משפחות ערך · PHILOS CANDIDATE VALUE FAMILIES</div>
      <div style={S.grid}>
        {families.map((f) => {
          const svs = byFamily.get(f.id) ?? [];
          const canonical = svs.filter((s) => s.status === "CANONICAL_RUNTIME").length;
          const review = svs.filter((s) => s.status === "REVIEW_REQUIRED").length;
          return (
            <a key={f.id} href={`?mode=universe&family=${f.id}`} style={{ ...S.valueCard, borderColor: canonical > 0 ? "#34d39966" : "rgba(90,120,180,0.3)" }}>
              <div style={{ ...S.valueCardTitle, color: canonical > 0 ? "#34d399" : "#dbe6f6" }}>{f.name_he}</div>
              <div style={S.valueCardMeta}>{svs.length} תת-ערכים{canonical > 0 ? ` · ${canonical} CANONICAL_RUNTIME` : ""}{review > 0 ? ` · ${review} REVIEW_REQUIRED` : ""}</div>
            </a>
          );
        })}
        {crossFamily.length > 0 ? (
          <a href="?mode=universe&search=&family=" style={{ ...S.valueCard, borderColor: "rgba(90,120,180,0.3)", opacity: 0.8 }}>
            <div style={S.valueCardTitle}>ללא משפחה משויכת · CROSS-FAMILY</div>
            <div style={S.valueCardMeta}>{crossFamily.length} תת-ערכים — דורש סקירת Board (אין התאמת מילות-מפתח אמינה)</div>
          </a>
        ) : null}
      </div>
    </div>
  );
}

function FamilySubvalues({ family, subvalues, filters }: { family: RawFamily; subvalues: UniverseSubvalueView[]; filters: UniverseFilters }) {
  return (
    <div style={S.section}>
      <a href={buildQuery(filters, { familyId: undefined })} style={S.back}>← כל המשפחות</a>
      <div style={S.sectionTitle}>{family.name_he}</div>
      <div style={S.note}>{family.content_he}</div>
      {subvalues.length === 0 ? (
        <Empty>0 תת-ערכים תואמים לסינון הנוכחי במשפחה זו.</Empty>
      ) : (
        <div style={S.list}>
          {subvalues.sort((a, b) => b.source_count - a.source_count).map((sv) => (
            <a key={sv.subvalue_id} href={buildQuery(filters, { subvalueId: sv.subvalue_id })} style={{ ...S.listRow, textDecoration: "none" }}>
              <span style={S.listTitle}>{sv.name_he}</span>
              <span style={S.listMeta}>
                <span style={{ color: STATUS_COLOR[sv.status] }}>{sv.status}</span> · {sv.source_count} ציטוט(ים)
                {sv.scope ? <> · <span style={{ color: SCOPE_COLOR[sv.scope] }}>{sv.scope}</span></> : null}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchResults({ subvalues, families, filters }: { subvalues: UniverseSubvalueView[]; families: RawFamily[]; filters: UniverseFilters }) {
  const famById = new Map(families.map((f) => [f.id, f]));
  return (
    <div style={S.section}>
      <div style={S.sectionTitle}>תוצאות סינון · {subvalues.length} תת-ערכים</div>
      {subvalues.length === 0 ? (
        <Empty>0 תוצאות — נסה סינון אחר.</Empty>
      ) : (
        <div style={S.list}>
          {subvalues.slice(0, 100).map((sv) => (
            <a key={sv.subvalue_id} href={buildQuery(filters, { subvalueId: sv.subvalue_id })} style={{ ...S.listRow, textDecoration: "none" }}>
              <span style={S.listTitle}>{sv.name_he}</span>
              <span style={S.listMeta}>
                {sv.family_id ? famById.get(sv.family_id)?.name_he : "ללא משפחה"} ·{" "}
                <span style={{ color: STATUS_COLOR[sv.status] }}>{sv.status}</span> · {sv.source_count} ציטוט(ים)
              </span>
            </a>
          ))}
          {subvalues.length > 100 ? <div style={S.note}>מוצגות 100 תוצאות ראשונות מתוך {subvalues.length} — צמצם סינון לתוצאות מדויקות יותר.</div> : null}
        </div>
      )}
    </div>
  );
}

function SubvalueDetail({
  subvalue, family, sourceEntries, backHref,
}: {
  subvalue: UniverseSubvalueView;
  family?: RawFamily;
  sourceEntries: RawSourceEntry[];
  backHref: string;
}) {
  return (
    <Section title={`תת-ערך · SUBVALUE — ${subvalue.name_he}`}>
      <a href={backHref} style={S.back}>← חזרה</a>
      <div style={S.detailGrid}>
        <DetailRow label="FAMILY" value={family ? family.name_he : "ללא משפחה משויכת — דורש סקירת Board"} />
        <DetailRow
          label="STATUS"
          value={<span style={{ color: STATUS_COLOR[subvalue.status] }}>{subvalue.status} — {subvalue.status_reason}</span>}
        />
        {subvalue.scope ? (
          <DetailRow label="SCOPE — INDIVIDUAL → GROUP → COMMON" value={<span style={{ color: SCOPE_COLOR[subvalue.scope] }}>{subvalue.scope}</span>} />
        ) : (
          <DetailRow label="SCOPE" value="לא זמין — אינו Value רץ בזמן אמת (אין קבוצות אמיתיות המחזיקות בו כ-central_value)" />
        )}
        {subvalue.matched_runtime_value_id ? (
          <DetailRow label="RUNTIME VALUE" value={<a href={`?mode=values&value=${encodeURIComponent(subvalue.matched_runtime_value_id)}`} style={{ color: "#5b9cf6" }}>{subvalue.matched_runtime_value_names.join(", ")} →</a>} />
        ) : null}
        <DetailRow label="SOURCE CITATIONS" value={`${subvalue.source_count} מקור/ות מסמך ה-328`} />
      </div>
      {sourceEntries.length > 0 ? (
        <>
          <div style={S.subHead}>פרשנויות מקור · SOURCE INTERPRETATIONS ({sourceEntries.length})</div>
          <div style={S.list}>
            {sourceEntries.map((e) => (
              <div key={e.id} style={S.listRow}>
                <span style={S.listTitle}>{e.interpretation_he}</span>
                <span style={S.listMeta}>{e.proposed_family_he}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
      <div style={{ ...S.note, marginTop: 12 }}>
        VALUE GROUPS · QUALITY GROUPS · PEOPLE · NEEDS · CAPABILITIES · RESOURCES · ACTIONS · EFFECTS · EVIDENCE —
        {" "}0 מקושרים אמיתית לתת-ערך זה כרגע. פער מתועד, לא בדוי: תת-הערכים ממסמך ה-328 עדיין לא מקושרים ל-Need/Offer/Action ברמת per-subvalue.
        {subvalue.status === "CANONICAL_RUNTIME" ? " עבור הערך הרץ המקושר, ראה את דף הערך המלא." : ""}
      </div>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={S.section}>
      <div style={S.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={S.empty}>{children}</div>;
}
