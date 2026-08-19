/**
 * EntityContextPanel — LOOP 0054's shared render for a resolved canon
 * Action/Effect entity (`SelectedContext` with `status: "found_entity"`).
 * One implementation, reused by every surface that resolves `?ctx=` —
 * Dynamics, Globe, Marketplace, Community, Hub — so the same real fields
 * (`matched_id`, `owner_or_subject`, `provenance`, `claimed_or_verified`,
 * `relationships`) render identically everywhere, instead of five
 * hand-maintained copies drifting apart.
 *
 * Deliberately narrower than the canon-Observation/legacy-event inspector
 * each surface already has (`ContextInspector` in `WorldGlobe.tsx`/
 * `DynamicsView.tsx`, the detail branch in `ActionSpacePanel.tsx`) — this
 * never touches or extends those, so their existing canon/legacy behavior
 * is completely unaffected by this addition (`status: "found_entity"` is
 * a new, separate `SelectedContext` member those functions never match).
 */
import {
  buildContextActions,
  claimedVerifiedColor,
  type ContextAction,
  type ContextSurface,
  type SelectedContext,
} from "@/app/lib/systemContext";

type FoundEntityContext = Extract<SelectedContext, { status: "found_entity" }>;

function Chip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 100 }}>
      <span style={{ fontSize: 9, letterSpacing: 1, color: "#5a76a3", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: color ?? "#dbe6f6", display: "inline-flex", alignItems: "center", gap: 5 }}>
        {color ? <span style={{ width: 7, height: 7, borderRadius: 4, background: color, display: "inline-block" }} /> : null}
        {value}
      </span>
    </div>
  );
}

function ActionPill({ action }: { action: ContextAction }) {
  const base = { fontSize: 11, padding: "6px 12px", borderRadius: 20, border: "1px solid", display: "inline-block" };
  if (action.state === "live" && action.href) {
    return (
      <a href={action.href} style={{ ...base, color: "#02101f", background: "#38bdf8", borderColor: "#38bdf8", fontWeight: 600, textDecoration: "none" }}>
        {action.label} →
      </a>
    );
  }
  if (action.state === "here") {
    return <span style={{ ...base, color: "#38bdf8", borderColor: "#2a3f66" }}>{action.label} · you are here</span>;
  }
  return <span style={{ ...base, color: "#4a5a78", borderColor: "#1e2740" }}>{action.label} · not connected yet</span>;
}

export default function EntityContextPanel({
  selected,
  here,
  style,
}: {
  selected: FoundEntityContext;
  here: ContextSurface;
  /** Layout override — Globe positions this absolutely over the sphere;
   *  every other surface renders it inline in normal document flow. */
  style?: React.CSSProperties;
}) {
  const claimedColor = claimedVerifiedColor(selected.claimed_or_verified);
  const actions = buildContextActions(selected.ref, here);
  const kindLabel = selected.entity_kind === "action" ? "ACTION" : "EFFECT";

  return (
    <div
      dir="rtl"
      style={{
        background: "rgba(4,10,22,0.94)",
        backdropFilter: "blur(10px)",
        border: "1px solid #2a3f66",
        borderLeft: `3px solid ${claimedColor}`,
        borderRadius: 8,
        padding: "14px 16px",
        fontSize: 11,
        color: "#cfe0f5",
        fontFamily: "system-ui",
        ...style,
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: 2, color: "#5aa6ff", marginBottom: 8 }}>ENTITY CONTEXT · CANON {kindLabel}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#f2f6fc" }}>{selected.label}</div>
      <div style={{ fontSize: 10.5, color: "#7f97c2", marginTop: 2 }}>
        canon {selected.entity_kind} · {selected.matched_id}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 10 }}>
        <Chip label="Owner / subject" value={selected.owner_or_subject} />
        <Chip label="Provenance" value={selected.provenance} />
        <Chip label="Claimed / verified" value={selected.claimed_or_verified} color={claimedColor} />
        <Chip label="Time" value={selected.timestamp.slice(0, 16).replace("T", " ")} />
      </div>

      {/* BATCH 12 — Contextual Trust, the smallest honest slice: naming
          what a verified Effect ALREADY structurally answers (WHO/FOR
          WHAT/BASED ON WHICH ACTION/EVIDENCE/WHEN — every field below was
          already computed above and in `relationships`, none new) rather
          than building a second, parallel trust subsystem. Deliberately
          NEVER a single number — no aggregation across multiple signals
          exists anywhere in this file. */}
      {selected.entity_kind === "effect" && selected.claimed_or_verified === "verified" ? (
        <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 6, background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)" }}>
          <div style={{ fontSize: 8.5, letterSpacing: 0.5, color: "#34d399" }}>CONTEXTUAL TRUST SIGNAL — לא ציון גלובלי, אות אחד בהקשר אחד</div>
          <div style={{ fontSize: 10.5, marginTop: 4, lineHeight: 1.6 }}>
            WHO: {selected.owner_or_subject} · FOR WHAT: {selected.label} · BASED ON: {selected.relationships.find((r) => r.direction === "incoming")?.other_label ?? "לא ידוע"} ·
            EVIDENCE: {selected.provenance} · WHEN: {selected.timestamp.slice(0, 10)}
          </div>
        </div>
      ) : null}

      <div style={{ fontSize: 8.5, letterSpacing: 0.5, color: "#5a76a3", marginTop: 10 }}>WHAT IS CONNECTED?</div>
      <div style={{ marginTop: 4 }}>
        {selected.relationships.length === 0 ? (
          "No verified relationship edge exists yet."
        ) : (
          selected.relationships.map((r) => (
            <div key={`${r.direction}:${r.other_id}`} style={{ marginTop: 3 }}>
              {r.direction === "outgoing" ? "→" : "←"} {r.other_label} ({r.relation_label})
            </div>
          ))
        )}
      </div>

      {selected.actionSpace ? (
        <div style={{ fontSize: 10, color: "#5a76a3", marginTop: 10 }}>
          Action space: {selected.actionSpace.admissible ? "admissible" : `blocked — ${selected.actionSpace.blockers.join(", ")}`}
        </div>
      ) : null}

      <div style={{ fontSize: 8.5, letterSpacing: 0.5, color: "#5a76a3", marginTop: 10 }}>NEXT ACTION</div>
      <div style={{ marginTop: 4 }}>
        {selected.nextAction ? (
          <a href={selected.nextAction.href} style={{ display: "inline-block", fontSize: 11.5, fontWeight: 600, color: "#02101f", background: "#5b9cf6", textDecoration: "none", borderRadius: 8, padding: "6px 12px" }}>
            {selected.nextAction.label} →
          </a>
        ) : (
          <span style={{ fontSize: 11, color: "#7b8ca6", fontStyle: "italic" }}>אין פעולה הבאה מוצדקת — הכל נבדק ותקין.</span>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
        {actions.map((a) => (
          <ActionPill key={a.label} action={a} />
        ))}
      </div>
    </div>
  );
}
