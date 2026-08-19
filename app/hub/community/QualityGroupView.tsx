/**
 * QUALITY GROUPS (Mission B, B11) — the standalone directory view for a
 * layer that already existed nested inside each Value's own detail page
 * (`CommunityUniverse.tsx`'s "BATCH 7" section). This makes it a real,
 * navigable top-level surface, per the mission's own primary-nav list.
 *
 * STRICT, per the mission and this module's own source data: VALUE GROUP
 * ≠ QUALITY GROUP. Membership, popularity, money, religion, and event
 * count are never read as quality signals here — `QUALITY_GROUP_MODEL`'s
 * own notes state the source explicitly deferred a scoring formula, so
 * none is invented. No Global Human Score, no per-group quality score:
 * only the real criteria/axes/measurement-approach citations themselves.
 */
import {
  QUALITY_GROUP_MODEL, RUNTIME_QUALITY_GROUP_CRITERIA, GROUP_HIERARCHY_AXES,
  type RuntimeStatus,
} from "@/app/lib/philos/community/sourceValueModel";
import type { GroupRegistryEntry } from "@/app/lib/philos/community/groupRegistry";
import { S, DetailRow } from "./CommunityUniverse";
import { PROMOTION_STATUS_COLOR } from "./colors";

// Mission B, B13 — shared with every other surface, see `./colors.ts`.
const RUNTIME_STATUS_COLOR: Record<RuntimeStatus, string> = PROMOTION_STATUS_COLOR as Record<RuntimeStatus, string>;

export default function QualityGroupView({ groupRegistry }: { groupRegistry: GroupRegistryEntry[] }) {
  return (
    <>
      <div style={S.section}>
        <div style={S.sectionTitle}>קבוצות איכות · QUALITY GROUPS — {QUALITY_GROUP_MODEL.status}</div>
        <div style={{ ...S.note, marginBottom: 8, color: "#f2635c" }}>
          VALUE GROUP ≠ QUALITY GROUP. חברות ≠ איכות. פופולריות ≠ איכות. כסף ≠ איכות. דת ≠ איכות. מספר אירועים ≠ איכות. אין Global Human Score — לעולם לא ציון פר-אדם/פר-קבוצה גלובלי.
        </div>
        <div style={S.detailGrid}>
          <DetailRow label="STATUS" value={QUALITY_GROUP_MODEL.status} />
          <DetailRow label="CRITERIA COUNT (real, source-extracted)" value={String(QUALITY_GROUP_MODEL.criteria_count)} />
          <DetailRow label="NOTES" value={QUALITY_GROUP_MODEL.notes} />
        </div>
      </div>

      <div style={S.section}>
        <div style={S.sectionTitle}>VALUE → STANDARD → CRITERIA → EVIDENCE → QUALIFICATION</div>
        <div style={S.note}>
          {RUNTIME_QUALITY_GROUP_CRITERIA.length} קריטריונים אמיתיים ({"CANONICAL_RUNTIME"}, מתוך המקור) — אין נוסחת "הסמכה" מלאה; אלה הקריטריונים עצמם, לא ציון מחושב.
        </div>
        {RUNTIME_QUALITY_GROUP_CRITERIA.length === 0 ? (
          <Empty>0</Empty>
        ) : (
          <div style={S.list}>
            {RUNTIME_QUALITY_GROUP_CRITERIA.map((c) => (
              <div key={c.canonical_id} style={S.listRow}>
                <span style={S.listTitle}>{c.normalized_label}</span>
                <span style={S.listMeta}>{c.definition}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={S.section}>
        <div style={S.sectionTitle}>צירי היררכיית קבוצה · GROUP HIERARCHY AXES (3, כל אחד עם STATUS נפרד)</div>
        <div style={S.note}>3 צירים נפרדים, לעולם לא ממוזגים לסולם אחד — המקור עצמו לא מחבר ביניהם.</div>
        <div style={S.list}>
          {GROUP_HIERARCHY_AXES.map((a) => (
            <div key={a.axis_id} style={S.listRow}>
              <span style={S.listTitle}>{a.label_he} · {a.label_en}</span>
              <span style={{ ...S.listMeta, color: RUNTIME_STATUS_COLOR[a.runtime_status] }}>
                {a.runtime_status} · {a.levels.map((l) => l.label_he).join(" → ")}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={S.section}>
        <div style={S.sectionTitle}>קבוצות אמיתיות — ראיה זמינה (לא ציון איכות)</div>
        <div style={S.note}>
          לכל קבוצה: החברים, ה-Effect המאומתים, וה-Tension הפתוחים — הראיה היחידה הזמינה כיום. אף אחד מאלה אינו "ציון איכות" פורמלי.
        </div>
        {groupRegistry.length === 0 ? (
          <Empty>0</Empty>
        ) : (
          <div style={S.list}>
            {groupRegistry.map((g) => (
              <a key={g.group_id} href={`?mode=groups&community=${encodeURIComponent(g.group_id)}`} style={{ ...S.listRow, textDecoration: "none" }}>
                <span style={S.listTitle}>{g.name}</span>
                <span style={S.listMeta}>{g.status} · {g.member_count} חברים · {g.verified_effects} Effect מאומת — ראיה, לא ציון</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={S.empty}>{children}</div>;
}
