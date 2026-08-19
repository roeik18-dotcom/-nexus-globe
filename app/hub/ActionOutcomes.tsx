/**
 * ActionOutcomes — Hub's compact ORIENTATION → ACTION → OUTCOME section
 * (Action/Effect/Learning integration pass). A real, checked read only:
 * every row below comes verbatim from `knownNeeds` (already resolved by
 * `HubPage`, same store `sharedContext.ts::findKnownNeeds` uses) and
 * `lifecycle` (`actionLifecycle.ts::buildActionLifecycleSummary`, unmodified),
 * never a second derivation of either.
 *
 * Three real buckets, not a debug dump:
 *   "מה דורש פעולה"   — real, stored Needs for this subject that no stored
 *                        Action's `inputs` references by id (an explicit,
 *                        checked string-containment query — never inferred
 *                        from proximity or subject alone).
 *   "מה בוצע"         — every real, stored Action for this subject.
 *   "מה חזר מהפעולות" — each of those Actions' own honest
 *                        `verification_state` (`no_effect_recorded` /
 *                        `effect_claimed_only` / `effect_verified`) —
 *                        `no_effect_recorded` renders literally as UNKNOWN,
 *                        never hidden and never silently treated as "no
 *                        effect happened".
 */
import type { ActionLifecycleSummary } from "@/app/lib/philos/canon/actionLifecycle";
import type { KnownNeedResult } from "@/app/lib/systemContext";
import { needsRequiringAction } from "@/app/lib/philos/sharedContext";

const VERIFICATION_LABEL: Record<ActionLifecycleSummary["actions"][number]["verification_state"], { label: string; color: string }> = {
  no_effect_recorded: { label: "לא ידוע — לא נרשמה השפעה", color: "#7b8ca6" },
  effect_claimed_only: { label: "נטען — לא אומת", color: "#fbbf24" },
  effect_verified: { label: "אומת", color: "#34d399" },
};

export default function ActionOutcomes({
  knownNeeds,
  lifecycle,
}: {
  knownNeeds: KnownNeedResult;
  lifecycle: ActionLifecycleSummary;
}) {
  const needsPendingAction = needsRequiringAction(knownNeeds, lifecycle);

  return (
    <section dir="rtl" style={S.card}>
      <div style={S.cardHead}>
        <h2 style={S.cardTitle}>מחזור פעולה — Action / Effect / Learning</h2>
        <span style={S.hint}>נושא: {lifecycle.subject || "לא ידוע"}</span>
      </div>

      <Bucket title="מה דורש פעולה">
        {!knownNeeds.checked ? (
          <div style={S.emptyRow}>לא ניתן לבדוק — קריאת מאגר הצרכים נכשלה</div>
        ) : needsPendingAction.length === 0 ? (
          <div style={S.emptyRow}>נבדק — אין צורך שלא מקושר לפעולה כלשהי</div>
        ) : (
          needsPendingAction.map((n) => (
            <div key={n.need.need_id} style={S.row}>
              <span style={S.rowLabel}>{n.need.desired_change}</span>
              <span style={S.rowMeta}>{n.need.need_id}</span>
            </div>
          ))
        )}
      </Bucket>

      <Bucket title="מה בוצע">
        {lifecycle.actions.length === 0 ? (
          <div style={S.emptyRow}>אין Action רשום עבור נושא זה</div>
        ) : (
          lifecycle.actions.map((entry) => (
            <div key={entry.action.action.action_id} style={S.row}>
              <span style={S.rowLabel}>{entry.action.action.type}</span>
              <span style={S.rowMeta}>{entry.action.action.time}</span>
            </div>
          ))
        )}
      </Bucket>

      <Bucket title="מה חזר מהפעולות">
        {lifecycle.actions.length === 0 ? (
          <div style={S.emptyRow}>—</div>
        ) : (
          lifecycle.actions.map((entry) => {
            const v = VERIFICATION_LABEL[entry.verification_state];
            return (
              <div key={entry.action.action.action_id} style={S.row}>
                <span style={S.rowLabel}>{entry.action.action.action_id}</span>
                <span style={{ ...S.badge, color: v.color, borderColor: `${v.color}55` }}>{v.label}</span>
              </div>
            );
          })
        )}
      </Bucket>

      <div style={S.counts}>
        {lifecycle.counts.actions_total} Actions ·{" "}
        {lifecycle.counts.no_effect_recorded} לא ידוע ·{" "}
        {lifecycle.counts.effect_claimed_only} נטען ·{" "}
        {lifecycle.counts.effect_verified} אומת ·{" "}
        {/* `learnings_with_state_prime` counts Learning records whose GATE
            accepted a caller-proposed candidate — never state updates. */}
        {lifecycle.counts.learnings_with_state_prime} מועמדי state_prime (לא עדכוני מצב)
      </div>
    </section>
  );
}

function Bucket({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={S.bucket}>
      <div style={S.bucketTitle}>{title}</div>
      <div style={S.bucketBody}>{children}</div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  card: { background: "rgba(18,24,38,0.7)", border: "1px solid rgba(90,120,180,0.14)", borderRadius: 16, padding: "16px 18px", marginTop: 16 },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: 700, margin: 0, color: "#f0f4fc" },
  hint: { fontSize: 10, color: "#5f7aa6" },

  bucket: { marginTop: 10 },
  bucketTitle: { fontSize: 11, fontWeight: 700, color: "#8fa3c9", marginBottom: 6 },
  bucketBody: { display: "flex", flexDirection: "column", gap: 4 },

  row: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: "rgba(90,120,180,0.06)", border: "1px solid rgba(90,120,180,0.1)" },
  rowLabel: { fontSize: 12.5, color: "#e8edf6" },
  rowMeta: { fontSize: 10.5, color: "#5f7aa6", fontFamily: "ui-monospace, monospace" },
  emptyRow: { fontSize: 12, color: "#7b8ca6", fontStyle: "italic", padding: "4px 2px" },

  badge: { fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 6, border: "1px solid", fontFamily: "ui-monospace, monospace" },

  counts: { marginTop: 12, fontSize: 10.5, color: "#5f7aa6", borderTop: "1px solid rgba(90,120,180,0.14)", paddingTop: 8 },
};
