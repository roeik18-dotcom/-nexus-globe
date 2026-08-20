/**
 * ActionSpacePanel — the Marketplace/Action-Space projection of a real
 * `SystemContextRef` (systemic-integration-audit, Marketplace slice).
 *
 * Renders ABOVE the existing `<MarketplaceView>`, which is completely
 * untouched — this is an additive layer, not a rewrite. Required flow:
 * Selected Context → known Need/Value → known Resource/Opportunity →
 * admissibility gate → Action entry point. Every stage states what is real
 * (there is one: the selected context itself) and what is honestly absent —
 * never a fabricated offer, price, or provider link.
 */
import type { ReactNode } from "react";
import type { KnownResourceResult, ValueDimensionStatus } from "./resolveActionSpace";
import type { ActionLifecycleSummary } from "@/app/lib/philos/canon/actionLifecycle";
import ValueFlowField from "./ValueFlowField";
import EntityContextPanel from "@/app/lib/philos/shell/EntityContextPanel";
import {
  buildContextActions,
  claimedVerifiedColor,
  persistedDerivedColor,
  PHILOS_STATE_COLOR,
  type ActionSpaceSummary,
  type ContextAction,
  type KnownNeedResult,
  type SelectedContext,
} from "@/app/lib/systemContext";

function Chip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 100 }}>
      <span style={{ fontSize: 12, letterSpacing: 1, color: "#6c86b5", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: color ?? "#dbe6f6", display: "inline-flex", alignItems: "center", gap: 5 }}>
        {color ? <span style={{ width: 7, height: 7, borderRadius: 4, background: color, display: "inline-block" }} /> : null}
        {value}
      </span>
    </div>
  );
}

function ActionPill({ action }: { action: ContextAction }) {
  const base = { fontSize: 13, padding: "6px 12px", borderRadius: 20, border: "1px solid", display: "inline-block" };
  if (action.state === "live" && action.href) {
    return (
      <a href={action.href} style={{ ...base, color: "#0b0f1a", background: "#38bdf8", borderColor: "#38bdf8", fontWeight: 600, textDecoration: "none" }}>
        {action.label} →
      </a>
    );
  }
  if (action.state === "here") {
    return <span style={{ ...base, color: "#38bdf8", borderColor: "#2a3f66", background: "transparent" }}>{action.label} · you are here</span>;
  }
  return <span style={{ ...base, color: "#4a5a78", borderColor: "#1e2740", background: "transparent" }}>{action.label} · not connected yet</span>;
}

const sectionHead = { fontSize: 12, letterSpacing: 1.5, color: "#5aa6ff", marginTop: 18, marginBottom: 8 } as const;

const EMPTY_KNOWN_NEEDS: KnownNeedResult = { needs: [], checked: false, reason: "not computed" };
const EMPTY_ACTION_SPACE: ActionSpaceSummary = { admissible: false, blockers: [] };

export default function ActionSpacePanel({
  selected,
  knownResource,
  valueDimensions,
}: {
  selected: SelectedContext;
  knownResource: KnownResourceResult;
  valueDimensions: ValueDimensionStatus[];
}) {
  if (selected.status === "none") return null;

  const shell = {
    margin: "20px 20px 28px",
    padding: "16px 20px",
    background: "#0f1a2e",
    border: "1px solid #2a3f66",
    borderRadius: 8,
    fontFamily: "system-ui",
    color: "#e6ebf5",
  } as const;
  const kicker = { fontSize: 12, letterSpacing: 2, color: "#5aa6ff", marginBottom: 8 } as const;

  if (selected.status === "unknown" || selected.status === "not_found") {
    const src =
      selected.status === "unknown"
        ? selected.raw
        : selected.ref.kind === "canon_observation"
          ? `canon:${selected.ref.canon_event_id}`
          : selected.ref.kind === "legacy_event"
            ? `event:${selected.ref.event_id}`
            : selected.ref.kind === "action"
              ? `action:${selected.ref.action_id}`
              : selected.ref.kind === "effect"
                ? `effect:${selected.ref.effect_id}`
                : selected.ref.raw;
    return (
      <div style={{ ...shell, borderColor: "#5a4a2a" }} dir="rtl">
        <div style={kicker}>מה אני מסתכל עליו?</div>
        <div style={{ fontSize: 15 }}>
          {src} — {selected.status === "unknown" ? "לא זוהה כמזהה תקין. לא ידוע." : "לא נמצאה רשומה תואמת. לא ידוע."}
        </div>
      </div>
    );
  }

  // LOOP 0054 — a resolved canon Action/Effect entity renders via the
  // shared `EntityContextPanel`, never through the Need/Resource-space
  // code below (which stays completely unreached for `found_entity`).
  if (selected.status === "found_entity") {
    return <EntityContextPanel selected={selected} here="marketplace" style={shell} />;
  }

  const persistedColor = persistedDerivedColor(selected.persisted_or_derived);
  const claimedColor = claimedVerifiedColor(selected.claimed_or_verified);
  const actions = buildContextActions(selected.ref, "marketplace");
  const knownNeeds = selected.knownNeeds ?? EMPTY_KNOWN_NEEDS;
  const actionSpace = selected.actionSpace ?? EMPTY_ACTION_SPACE;

  return (
    <div style={{ ...shell, borderLeft: `3px solid ${claimedColor}` }}>
      <div dir="rtl" style={{ textAlign: "right" }}>
        <div style={{ fontSize: 12, letterSpacing: 1, color: "#5aa6ff" }}>הקשר נבחר — מרחב פעולה</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#f2f6fc", marginTop: 4 }}>{selected.label}</div>
        {selected.subject ? <div style={{ fontSize: 13, color: "#7f97c2", marginTop: 2 }}>נושא: {selected.subject}</div> : null}
      </div>

      {/* PHILOS-native language pass (marketplace semantics): lead with the
          real human questions the request itself named — "what do I need,
          why, who can help" — not PUDM/ontology vocabulary. The technical
          Mission/Gap/Capability/Provider terms stay in the diagnostic
          <details> block below, never the primary read. */}
      <div dir="rtl" style={{ textAlign: "right", fontSize: 13, color: "#8fa3c9", marginTop: 4, lineHeight: 1.7 }}>
        מה אני צריך? · למה זה חשוב? · מי/מה יכול לעזור? · אפשר לפעול כרגע?
      </div>

      {/* PRIMARY VISUAL — the real spatial value-transformation field, not a
          row of cards. See ValueFlowField.tsx. */}
      <ValueFlowField knownNeeds={knownNeeds} knownResource={knownResource} actionSpace={actionSpace} />

      {/* ACTION → EFFECT → STATE UPDATE (Action/Effect/Learning integration
          pass) — completes the Need → Capacity → Match → Consent → Action →
          Effect → State Update lifecycle past the admissibility gate above.
          `selected.actionLifecycle` is the SAME real per-subject read Hub/
          Dynamics/Brain already show — attached once by
          `sharedContext.ts::resolveSharedContext`, never recomputed here. */}
      {selected.system === "canon" ? <MarketplaceActionOutcome lifecycle={selected.actionLifecycle} /> : null}

      {/* VALUE DIMENSIONS — six distinct pills, never collapsed into one score */}
      <div dir="rtl" style={{ textAlign: "right", ...sectionHead }}>מה יש להרוויח, ובאיזה מחיר · ממדים נפרדים, לא ציון אחד</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {valueDimensions.map((d) => (
          <div
            key={d.label}
            title={d.note}
            style={{
              fontSize: 13,
              padding: "6px 10px",
              borderRadius: 6,
              background: "#111726",
              border: `1px solid ${d.status === "not_computed" ? "#1e2740" : PHILOS_STATE_COLOR.claimed}`,
              minWidth: 130,
            }}
          >
            <div style={{ fontWeight: 600 }}>{d.label}</div>
            <div style={{ color: d.status === "not_computed" ? PHILOS_STATE_COLOR.unknown : PHILOS_STATE_COLOR.claimed, fontSize: 12, letterSpacing: 0.5, marginTop: 2 }}>
              {d.status === "not_computed" ? "לא ידוע — אין עדיין נתון" : "חלקי — יש נתון עקיף"}
            </div>
          </div>
        ))}
      </div>
      <div dir="rtl" style={{ textAlign: "right", fontSize: 12, color: "#6c86b5", marginTop: 6 }}>
        לעולם לא מקובצים לציון משוקלל אחד — §21 אוסר ערך גלובלי מאוחד (NO_GLOBAL_PERSON_SCORE, NO_GLOBAL_HUMAN_OPTIMIZER).
      </div>

      <details style={{ marginTop: 14 }}>
        <summary style={{ cursor: "pointer", fontSize: 12, letterSpacing: 1.5, color: "#6c86b5" }}>
          אבחון טכני (diagnostic detail)
        </summary>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginTop: 10 }}>
          <Chip label="Domain" value={selected.domain} />
          {selected.frame ? <Chip label="Frame" value={selected.frame} /> : null}
          <Chip label="Provenance" value={selected.provenance} />
          <Chip label="Persisted / derived" value={selected.persisted_or_derived} color={persistedColor} />
          <Chip label="Claimed / verified" value={selected.claimed_or_verified} color={claimedColor} />
          <Chip label="System · id" value={`${selected.system === "canon" ? "canon" : "legacy"} · ${selected.matched_id}`} />
        </div>
      </details>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
        {actions.map((a) => (
          <ActionPill key={a.label} action={a} />
        ))}
      </div>
    </div>
  );
}

/**
 * ACTION → EFFECT → STATE UPDATE — the real tail of the lifecycle, past
 * Need/Capacity/Match/Consent (already shown above via `ValueFlowField`/
 * `actionSpace`). Genuinely absent (`undefined`) when this canon subject has
 * recorded nothing yet, or when `resolveSharedContext`'s own bridge read
 * failed — rendered as an honest "not computed" state, never hidden and
 * never a fabricated zero.
 */
function MarketplaceActionOutcome({ lifecycle }: { lifecycle: ActionLifecycleSummary | undefined }) {
  return (
    <div dir="rtl" style={{ textAlign: "right" }}>
      <div style={sectionHead}>Action → Effect → State Update</div>
      {!lifecycle ? (
        <div style={{ fontSize: 13, color: "#7b8ca6", fontStyle: "italic" }}>לא חושב — אין מסלול Action/Effect זמין להקשר זה.</div>
      ) : lifecycle.actions.length === 0 ? (
        <div style={{ fontSize: 13, color: "#7b8ca6", fontStyle: "italic" }}>נבדק — אין Action רשום לנושא זה.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {lifecycle.actions.map((entry) => {
            const color = entry.verification_state === "effect_verified" ? "#34d399" : entry.verification_state === "effect_claimed_only" ? "#fbbf24" : "#7b8ca6";
            const label = entry.verification_state === "effect_verified" ? "אומת" : entry.verification_state === "effect_claimed_only" ? "נטען — לא אומת" : "לא ידוע — אין Effect רשום";
            return (
              <div key={entry.action.action.action_id} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#dbe6f6" }}>{entry.action.action.type}</span>
                <span style={{ color: "#6c86b5" }}>→</span>
                <span style={{ color }}>{label}</span>
              </div>
            );
          })}
          <div style={{ fontSize: 12, color: "#6c86b5", marginTop: 4 }}>
            {lifecycle.counts.actions_total} Actions · {lifecycle.counts.effect_verified} Effect מאומתים · {lifecycle.counts.learnings_with_state_prime} מועמדי state_prime (לא עדכוני מצב)
          </div>
        </div>
      )}
    </div>
  );
}
