/**
 * StateDiffPanel — LOOP A005/A006's shared BEFORE→AFTER render for a
 * resolved canon Observation (`SelectedContext` with `status: "found"`,
 * `system: "canon"`). Renders the exact same real `priorState`/
 * `currentState`/`delta` fields `DynamicsView.tsx::StateAndTime` already
 * shows — not a re-derivation, the identical computed values from
 * `sharedContext.ts::resolveCoreContext` — so Hub/Brain/Dynamics show the
 * SAME result for the SAME `canon_event_id`, never three different
 * answers to the same question.
 */
import type { SelectedContext } from "@/app/lib/systemContext";

type FoundContext = Extract<SelectedContext, { status: "found" }>;

export default function StateDiffPanel({ selected }: { selected: FoundContext }) {
  const box = { background: "#111726", border: "1px solid #1e2740", borderRadius: 6, padding: "8px 12px", flex: "1 1 200px" } as const;
  const wrap = { fontSize: 11, color: "#cfe0f5", background: "rgba(90,120,180,0.06)", border: "1px solid #2a3f66", borderRadius: 8, padding: "10px 14px", marginBottom: 12 } as const;

  if (selected.priorState === undefined) {
    return (
      <div dir="rtl" style={wrap}>
        <div style={{ fontSize: 10, letterSpacing: 1.5, color: "#5aa6ff", marginBottom: 4 }}>STATE BEFORE → AFTER</div>
        <div style={{ color: "#5a76a3" }}>
          לא רלוונטי — {selected.system === "legacy" ? "אירוע legacy" : "רשומה"} הוא עובדה בודדת, לא מדידה חוזרת של מצב, אין ערך קודם להשוואה.
        </div>
      </div>
    );
  }

  if (selected.priorState === null) {
    return (
      <div dir="rtl" style={wrap}>
        <div style={{ fontSize: 10, letterSpacing: 1.5, color: "#5aa6ff", marginBottom: 4 }}>STATE BEFORE → AFTER</div>
        <div style={{ color: "#5a76a3" }}>
          אין שינוי מצב מוצדק קנונית: אין Observation קודמת אמיתית לתא ({selected.domain}{selected.frame ? `/${selected.frame}` : ""}) — זוהי המדידה הראשונה שנרשמה עבורו.
        </div>
      </div>
    );
  }

  const prior = selected.priorState;
  const current = selected.currentState;
  const delta = selected.delta;

  return (
    <div dir="rtl" style={wrap}>
      <div style={{ fontSize: 10, letterSpacing: 1.5, color: "#5aa6ff", marginBottom: 4 }}>STATE BEFORE → AFTER</div>
      <div style={{ fontSize: 10, color: "#7b8ca6", marginBottom: 8 }}>
        entity id: {selected.matched_id} · dimension: {selected.domain}{selected.frame ? `/${selected.frame}` : ""}
      </div>
      <div style={{ display: "flex", alignItems: "stretch", gap: 10, flexWrap: "wrap" }}>
        <div style={box}>
          <div style={{ fontSize: 9, letterSpacing: 1, color: "#5a76a3" }}>BEFORE · {prior.observed_at.slice(0, 16).replace("T", " ")}</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>level {prior.level} · stability {prior.stability}</div>
        </div>
        <div style={box}>
          <div style={{ fontSize: 9, letterSpacing: 1, color: "#5a76a3" }}>AFTER · {selected.timestamp?.slice(0, 16).replace("T", " ") ?? ""}</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            {current ? `level ${current.level} · stability ${current.stability}` : "not available"}
          </div>
        </div>
        {delta ? (
          <div style={{ ...box, borderColor: "#5a4a2a" }}>
            <div style={{ fontSize: 9, letterSpacing: 1, color: "#fbbf24" }}>Δ CHANGE</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              {delta.level !== undefined ? `Δ level ${delta.level >= 0 ? "+" : ""}${delta.level.toFixed(2)}` : null}
              {delta.stability !== undefined ? ` · Δ stability ${delta.stability >= 0 ? "+" : ""}${delta.stability.toFixed(2)}` : null}
            </div>
          </div>
        ) : null}
      </div>
      <div style={{ fontSize: 9, color: "#5a76a3", marginTop: 8 }}>
        confidence: {current?.confidence ?? "not tracked"}
      </div>
    </div>
  );
}
