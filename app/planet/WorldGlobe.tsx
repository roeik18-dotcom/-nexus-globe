"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- react-globe.gl accessors
   receive untyped datum objects; the library's own prop types force `any` here. */

/**
 * WorldGlobe — the Philos globe, drawn from the canonical event log and nothing
 * else.
 *
 * Every point is a node the projection produced (a value group, a person, or a
 * transfer recipient) and every line is an event it recorded. The HUD reports
 * only what is on screen: no ontology counts, no live indicator, no time scrub —
 * those described data this screen does not have, which the blueprint's header
 * rule calls a defect rather than a style choice.
 *
 * Depth is layered: starfield → atmosphere → globe → arcs → HUD. The starfield
 * is the one piece of pure decoration left, and it asserts nothing.
 *
 * **UX depth slice 1 (this pass):** a Purpose line sits under the existing
 * brand label (still small, still HUD-scale — this is a full-viewport 3D
 * visualization, not a document page, so the primary view keeps priority).
 * The Selected-Context panel (built last slice) is redesigned into the same
 * hero/chip/explanation/action-bar shape `DynamicsView.tsx` now uses — same
 * `Chip`/`ActionPill` visual language, same `persistedDerivedColor`/
 * `claimedVerifiedColor` functions from `systemContext.ts`, so the two
 * screens visibly share one system, not two prototypes. It renders ONLY when
 * a `?ctx=` resolves — the default (no ctx) view is pixel-identical to
 * before this slice.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import VerifiedRelationInventory from "@/app/lib/philos/shell/VerifiedRelationInventory";
import type { GlobeArc, GlobeNode } from "@/app/lib/philos/projectGlobeGraph";
import { SystemShell, type ShellIdentityLink } from "@/app/lib/philos/shell/SystemShell";
import { REAL_CURRENT_SUBJECT } from "@/app/lib/philos/subjectRegistry";
import type { PersonContext } from "@/app/lib/philos/person/personContext";
import EntityContextPanel from "@/app/lib/philos/shell/EntityContextPanel";
import { linksByRelation, linksForEntity, otherEnd, type EntityLink } from "@/app/lib/philos/bridge/entityLink";
import type { ActionRecord } from "@/app/lib/philos/canon/actionStore";
import type { EffectRecord } from "@/app/lib/philos/canon/effectStore";
import type { NeedRecord } from "@/app/lib/philos/canon/needStore";
import type { OfferRecord } from "@/app/lib/philos/canon/offerStore";
import { isEffectVerified } from "@/app/lib/philos/canon/effect";
import { COLOR, FS, RADIUS, STATUS, TYPE } from "@/app/lib/philos/shell/designTokens";
import SocialPrimaryStage, { type SocialPrimaryContext } from "@/app/lib/philos/shell/SocialPrimaryStage";
import {
  buildContextActions,
  claimedVerifiedColor,
  encodeSystemContextRef,
  persistedDerivedColor,
  type ContextAction,
  type SelectedContext,
} from "@/app/lib/systemContext";

// ── shared visual primitives (same language as DynamicsView.tsx) ──────────

function Chip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: FS.tag, letterSpacing: 1, color: "#5a76a3", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: color ?? "#dbe6f6", display: "inline-flex", alignItems: "center", gap: 5 }}>
        {color ? <span style={{ width: 6, height: 6, borderRadius: 3, background: color, display: "inline-block" }} /> : null}
        {value}
      </span>
    </div>
  );
}

function ActionPill({ action }: { action: ContextAction }) {
  const base = { fontSize: 10, padding: "5px 10px", borderRadius: 20, border: "1px solid", display: "inline-block" };
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

/**
 * Context Inspector — the drawer answering "what am I looking at / why is it
 * here / where did it come from / what's connected / what's unknown / where
 * next" for a resolved `?ctx=`. A pure function of `selected`, same discipline
 * as the rest of this file: nothing here is fetched or derived a second time,
 * only displayed. Absent (`"none"`) renders nothing — the globe underneath is
 * unchanged from before this slice existed.
 */
function ContextInspector({ selected, registry }: { selected: SelectedContext; registry: EntityLink[] }) {
  if (selected.status === "none") return null;

  const box = {
    position: "absolute",
    right: 24,
    top: 64,
    zIndex: 12,
    width: 320,
    background: "rgba(4,10,22,0.94)",
    backdropFilter: "blur(10px)",
    border: "1px solid #2a3f66",
    borderRadius: 8,
    padding: "14px 16px",
    fontSize: 11,
    color: "#cfe0f5",
  } as const;
  const kicker = { fontSize: 10, letterSpacing: 2, color: "#5aa6ff", marginBottom: 8 } as const;
  const q = { fontSize: FS.tag, letterSpacing: 0.5, color: "#5a76a3", marginTop: 10 } as const;

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
      <div style={{ ...box, borderColor: "#5a4a2a" }}>
        <div style={kicker}>SELECTED CONTEXT</div>
        <div>
          {src} —{" "}
          {selected.status === "unknown"
            ? "not a recognized identifier shape. UNKNOWN."
            : "a real identifier shape, but no matching record on this globe. UNKNOWN."}
        </div>
      </div>
    );
  }

  // LOOP 0054 — a resolved canon Action/Effect entity renders via the
  // shared `EntityContextPanel`, occupying the same right-side HUD slot
  // this inspector uses; the canon-Observation/legacy-event code below
  // stays completely unreached for `found_entity`.
  if (selected.status === "found_entity") {
    return <EntityContextPanel selected={selected} here="globe" style={{ position: "absolute", right: 24, top: 64, zIndex: 12, width: 320, maxHeight: 530, overflowY: "auto" }} />;
  }

  const persistedColor = persistedDerivedColor(selected.persisted_or_derived);
  const claimedColor = claimedVerifiedColor(selected.claimed_or_verified);
  const actions = buildContextActions(selected.ref, "globe");
  const locationUnknownReason =
    selected.system === "canon"
      ? "canon Observations carry no location field; none is plotted on the sphere."
      : "this globe's point positions are deterministic layout, not geography (see legend).";

  return (
    <div style={{ ...box, borderLeft: `3px solid ${claimedColor}` }}>
      <div style={kicker}>SELECTED CONTEXT</div>

      <div style={{ fontSize: FS.tag, letterSpacing: 0.5, color: "#5a76a3" }}>WHAT AM I LOOKING AT?</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#f2f6fc", marginTop: 3 }}>{selected.label}</div>
      <div style={{ fontSize: 10, color: "#7f97c2", marginTop: 2 }}>
        {selected.system === "canon" ? "canon Observation" : "legacy event"} · {selected.matched_id}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 12 }}>
        <Chip label="Domain" value={selected.domain} />
        {selected.frame ? <Chip label="Frame" value={selected.frame} /> : null}
        <Chip label="Provenance" value={selected.provenance} />
        <Chip label="Persisted/derived" value={selected.persisted_or_derived} color={persistedColor} />
        <Chip label="Claimed/verified" value={selected.claimed_or_verified} color={claimedColor} />
      </div>

      <div style={q}>WHY DOES IT MATTER?</div>
      <div style={{ marginTop: 4 }}>
        PHILOS does not rank or score this item — no combined significance value exists by design
        (canon's anti-ranking rule). Shown as recorded.
      </div>

      <div style={q}>WHAT IS CONNECTED?</div>
      <div style={{ marginTop: 4 }}>
        {selected.related ? selected.related.description : "No verified relationship edge exists yet."}
      </div>

      {/* Canonical Cross-Entity Link Registry (bridge layer): real, typed
          relations for this entity's own id — never fabricated. `subject`
          is `PhilosEvent.actor_id` for legacy events, the SAME id space
          `PERSON_MEMBER_OF_COMMUNITY` links use, so this is a genuine
          lookup, not a coincidental match. Canon subjects (this globe shows
          none directly, but a future ctx could) currently return `[]` here
          honestly — canon subjects and legacy ids are separate id spaces
          with no real bridge yet (see PHILOS-PRODUCT-MASTER-LEDGER.md §13). */}
      {selected.subject ? (
        <BridgeSection subject={selected.subject} registry={registry} />
      ) : null}

      <div style={q}>WHAT IS STILL UNKNOWN?</div>
      <div style={{ marginTop: 4 }}>
        spatial location: UNKNOWN — {locationUnknownReason}
        {selected.system === "canon" ? (
          <>
            {" "}Action/Effect location: UNKNOWN — canon's Action/Effect (`action.ts`/`effect.ts`) carry no
            geographic or systemic-location field either; none is plotted on the sphere — only the real
            per-subject lifecycle numbers are shown below.
          </>
        ) : null}
      </div>

      {/* Same shared knownNeeds/actionSpace Dynamics and Marketplace show —
          compact here, since Globe's emphasis is system/relationship/location. */}
      <div style={{ fontSize: 10, color: "#5a76a3", marginTop: 10, lineHeight: 1.6 }}>
        need:{" "}
        {!selected.knownNeeds
          ? "not computed"
          : !selected.knownNeeds.checked
            ? "could not check"
            : selected.knownNeeds.needs.length > 0
              ? `${selected.knownNeeds.needs.length} real Need(s)`
              : "UNKNOWN — none persisted"}
        {" · action: "}
        {!selected.actionSpace
          ? "not computed"
          : selected.actionSpace.admissible
            ? "admissible"
            : `missing ${selected.actionSpace.blockers.join(", ")}`}
        {selected.system === "canon" ? (
          <>
            {" · lifecycle: "}
            {!selected.actionLifecycle
              ? "not computed"
              : selected.actionLifecycle.actions.length === 0
                ? "UNKNOWN — no Action recorded"
                : `${selected.actionLifecycle.actions.length} Action(s), ${selected.actionLifecycle.actions.filter((a) => a.verification_state === "effect_verified").length} verified`}
          </>
        ) : null}
      </div>

      <div style={q}>WHERE CAN I GO NEXT?</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
        {actions.map((a) => (
          <ActionPill key={a.label} action={a} />
        ))}
      </div>
    </div>
  );
}

/**
 * Real, typed cross-entity links for one legacy id — checks both `person`
 * and `community` entity types, since `subject` may be either (an
 * `actor_id` is usually a person, a `group_id` occasionally appears where
 * the event's own actor is the group). Renders nothing but an honest
 * "no linked entity found" when the lookup is genuinely empty.
 */
function BridgeSection({ subject, registry }: { subject: string; registry: EntityLink[] }) {
  const links = [
    ...linksForEntity(registry, "person", subject),
    ...linksForEntity(registry, "community", subject),
  ];
  return (
    <>
      <div style={{ fontSize: FS.tag, letterSpacing: 0.5, color: "#5a76a3", marginTop: 10 }}>BRIDGE — TYPED CROSS-ENTITY LINKS</div>
      <div style={{ marginTop: 4 }}>
        {links.length === 0 ? (
          <span style={{ color: "#5a76a3", fontStyle: "italic" }}>לא נמצא קישור אמיתי או DEMO ל-{subject}.</span>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {links.map((l) => {
              const target = otherEnd(l, l.source.canonical_id === subject ? l.source.type : l.target.type, subject);
              return (
                <div key={l.link_id} style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                  <span style={{ color: "#dbe6f6" }}>{l.relation}</span>
                  <span style={{ color: l.provenance === "DEMO" ? "#fbbf24" : "#34d399" }}>{target.type}:{target.canonical_id}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

/**
 * LOOP 0053 — the default Globe activity summary, visible WITHOUT any
 * `?ctx=` selection. Occupies the same right-side slot `ContextInspector`
 * uses once a context IS selected (see the render call below) — the two
 * never show at once. Sourced directly from `actionStore`/`effectStore`
 * (same `action_id`/`effect_id` as `/marketplace`, `/dynamics`, and the
 * Community canon bridge, LOOP 0052) — never merged into the sphere's own
 * `nodes`/`arcs` population, and no coordinate is invented for any of it:
 * "RELATED REGIONS / CONTEXT" lists each record's own real `context`/
 * `provenance` text, explicitly labeled as system context, not geography
 * (same "layout, not geography" discipline as the sphere itself). No
 * click-through to `?ctx=` exists yet for Action/Effect ids specifically
 * (only canon Observations/legacy events resolve today) — rather than
 * fabricate a dead link, none is added; this is a real, stated limitation,
 * not silently glossed over.
 */
/** One inspector row. Fixed key column so the seven fields align. */
function Row({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8, fontSize: FS.meta, padding: "2px 0", alignItems: "baseline" }}>
      <span style={{ ...TYPE.micro, fontSize: FS.tag, color: "#7f97c2", width: 76, flexShrink: 0 }}>{k}</span>
      <span style={{
        color: "#dbe6f6", flex: 1, minWidth: 0, wordBreak: "break-word",
        fontFamily: mono ? "ui-monospace, monospace" : undefined,
        fontSize: mono ? FS.base : FS.meta,
      }}>{v}</span>
    </div>
  );
}

/* `HudLane` and `Tally` stood here. They were this surface's own answer to
   "what is selected / what is its provenance" — a good answer, and the third
   one in the product. `SocialPrimaryStage` answers it for all three scales
   now, so they are DELETED rather than left as a second way to say the same
   thing. Dead shared-looking code is how duplicated grammar grows back. */

export function CanonActivityPanel({ canonActions, canonEffects, canonNeeds, canonOffers }: { canonActions: ActionRecord[]; canonEffects: EffectRecord[]; canonNeeds: NeedRecord[]; canonOffers: OfferRecord[] }) {
  const box = {
    position: "absolute", right: 24, top: 168, zIndex: 12, width: 300,
    /* Height-capped so this panel cannot grow down the right column and bury
       the EVENTS-ON-SCREEN rail beneath it (`styles.rightRail`, top 620). */
    maxHeight: 430, overflowY: "auto",
    background: "rgba(4,10,22,0.94)", backdropFilter: "blur(10px)",
    border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.md, padding: "14px 16px",
    fontSize: 11, color: COLOR.textDim,
  } as const;
  const kicker = { ...TYPE.meta, color: COLOR.accent, marginBottom: 8 } as const;
  const q = { ...TYPE.micro, color: COLOR.textFaint, marginTop: 10 } as const;

  if (canonActions.length === 0 && canonEffects.length === 0 && canonNeeds.length === 0 && canonOffers.length === 0) {
    return (
      <div style={box}>
        <div style={kicker}>CANON ACTIVITY</div>
        <div>אין עדיין Need, Offer, Action או Effect קנוני אמיתי רשום.</div>
      </div>
    );
  }

  const verifiedEffects = canonEffects.filter((e) => isEffectVerified(e.effect));
  const relatedPeople = [...new Set([
    ...canonActions.map((a) => a.action.owner),
    ...canonEffects.map((e) => e.effect.subject),
    ...canonNeeds.map((n) => n.need.subject),
    ...canonOffers.map((o) => o.offer.source),
  ])];
  const contexts = [...new Set([...canonActions.map((a) => a.action.provenance), ...canonEffects.map((e) => e.effect.context)])];

  return (
    <div style={box}>
      <div style={kicker}>CANON ACTIVITY · פעילות קנונית</div>

      {/* BATCH 3 — entity-type badges use the shared STATUS vocabulary
          (same shape/treatment as every other redesigned surface) instead
          of ad-hoc per-panel colors, so PERSON/NEED/RESOURCE/ACTION/EFFECT
          read identically here as on Hub/Dynamics/Marketplace/Community. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <EntityBadge label="Needs" value={canonNeeds.length} kind={canonNeeds.length > 0 ? "real" : "unknown"} />
        <EntityBadge label="Resources" value={canonOffers.length} kind={canonOffers.length > 0 ? "real" : "unknown"} />
        <EntityBadge label="Actions" value={canonActions.length} kind={canonActions.length > 0 ? "active" : "unknown"} />
        <EntityBadge label="Effects" value={canonEffects.length} kind={verifiedEffects.length > 0 ? "verified" : canonEffects.length > 0 ? "claimed" : "unknown"} />
      </div>

      <div style={q}>RELATED PEOPLE</div>
      <div style={{ marginTop: 4, color: COLOR.text }}>{relatedPeople.join(", ")}</div>

      <div style={q}>RELATED GROUPS</div>
      <div style={{ marginTop: 4, color: COLOR.textFaint }}>
        לא ידוע — Action קנוני אינו נושא group_id, אין ייחוס קבוצתי מומצא (ראה Community → ACTIVITY → CANON).
      </div>

      <div style={q}>RELATED REGIONS / CONTEXT · SYSTEM LAYOUT, NOT GEOGRAPHY</div>
      <div style={{ marginTop: 4, color: COLOR.textFaint }}>
        אין קואורדינטות אמיתיות — הקשר מערכת (system context) בלבד, לא מפה:
      </div>
      {contexts.slice(0, 5).map((c) => (
        <div key={c} style={{ marginTop: 3, fontSize: FS.meta, color: COLOR.textDim }}>· {c}</div>
      ))}
    </div>
  );
}

function EntityBadge({ label, value, kind }: { label: string; value: number; kind: "real" | "active" | "verified" | "claimed" | "unknown" }) {
  const s = STATUS[kind];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "5px 10px", borderRadius: RADIUS.sm, background: s.bg, border: `1px solid ${s.border}`, minWidth: 62 }}>
      <span style={{ ...TYPE.micro, color: s.text }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 800, color: COLOR.text }}>{value}</span>
    </div>
  );
}

/**
 * REGION layer — a real Planet "layer/filter" (spatial-foundation pass):
 * groups every `COMMUNITY_LOCATED_IN_REGION` link in the registry by its
 * region, and lists which needs/actions/effects the bridge also places in
 * that same region. Not a map/choropleth (no real coordinates exist to
 * plot one on) — a real, queried grouping over the SAME registry the
 * inspector drawer above already uses. Communities link out to
 * `/hub/community?community=`, preserving the same real/DEMO id.
 */
export function RegionLayerPanel({ registry }: { registry: EntityLink[] }) {
  const regionLinks = linksByRelation(registry, "COMMUNITY_LOCATED_IN_REGION");
  if (regionLinks.length === 0) return null;

  const byRegion = new Map<string, { label: string; provenance: string; communities: EntityLink[] }>();
  for (const l of regionLinks) {
    const key = l.target.canonical_id;
    if (!byRegion.has(key)) byRegion.set(key, { label: key, provenance: l.provenance, communities: [] });
    byRegion.get(key)!.communities.push(l);
  }

  return (
    <div dir="rtl" style={{ position: "absolute", left: 24, top: 168, zIndex: 10, width: 220, background: "rgba(4,10,22,0.85)", backdropFilter: "blur(8px)", border: "1px solid #2a3f66", borderRadius: 8, padding: "10px 12px", fontSize: FS.meta, color: "#9fb2d6" }}>
      <div style={{ fontSize: FS.tag, letterSpacing: 2, color: "#5aa6ff", marginBottom: 6 }}>REGIONS · שכבת מרחב (בגשר)</div>
      {[...byRegion.entries()].map(([regionId, r]) => (
        <div key={regionId} style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#dbe6f6" }}>{r.communities[0].source.type === "community" ? r.communities[0].target.canonical_id : regionId}</span>
            <span style={{ fontSize: FS.tag, fontWeight: 800, padding: "1px 5px", borderRadius: 4, color: r.provenance === "DEMO" ? "#fbbf24" : "#34d399", border: `1px solid ${r.provenance === "DEMO" ? "#fbbf24" : "#34d399"}55` }}>{r.provenance}</span>
          </div>
          {r.communities.map((c) => (
            <a key={c.link_id} href={`/hub/community?community=${c.source.canonical_id}`} style={{ display: "block", fontSize: 10, color: "#5b9cf6", textDecoration: "none", marginTop: 2 }}>
              → {c.source.canonical_id}
            </a>
          ))}
        </div>
      ))}
      <div style={{ fontSize: FS.tag, color: "#5a76a3", marginTop: 4 }}>
        אין קואורדינטות אמיתיות — קיבוץ לפי group.region בלבד, לא מפה.
      </div>
    </div>
  );
}

/**
 * One cool accent, one warm. The warm one marks a transfer recipient and the
 * transfer arcs that reach it — money leaving the group reads as one movement,
 * end to end. Node type comes from the projection, so colouring by it states a
 * fact the events carry rather than a category invented here.
 */
const GROUP = "#cfe4ff";
const PERSON = "#8fd0ff";
const RECIPIENT = "#ffce8a";
/** Mission B, B9 — the group's own real `central_value`, visually
 *  distinct (green, matching the CANONICAL_RUNTIME/verified color this
 *  codebase uses everywhere else — Community/Brain/Dynamics all use
 *  #34d399 for "real, live value"). */
const VALUE = "#34d399";

const NODE_COLOR: Record<GlobeNode["type"], string> = {
  value_group: GROUP,
  person: PERSON,
  recipient: RECIPIENT,
  value: VALUE,
};
const NODE_RADIUS: Record<GlobeNode["type"], number> = {
  value_group: 0.52,
  person: 0.32,
  recipient: 0.42,
  value: 0.38,
};

function seeded(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function fibSphere(n: number) { const o: { lat: number; lng: number }[] = []; const g = Math.PI * (3 - Math.sqrt(5)); for (let i = 0; i < n; i++) { const y = 1 - (i / Math.max(1, n - 1)) * 2, r = Math.sqrt(Math.max(0, 1 - y * y)), t = g * i; o.push({ lat: Math.asin(y) * 180 / Math.PI, lng: Math.atan2(Math.sin(t) * r, Math.cos(t) * r) * 180 / Math.PI }); } return o; }

// one-element CSS starfield: a pile of box-shadow dots
function starShadows(n: number, seed: number) {
  const r = seeded(seed); const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(`${Math.floor(r() * 2000)}px ${Math.floor(r() * 1200)}px rgba(200,220,255,${(0.25 + r() * 0.6).toFixed(2)})`);
  return out.join(",");
}

export default function WorldGlobe({ nodes, arcs: eventArcs, selected, registry, identityLink, personContext, canonActions, canonEffects, canonNeeds, canonOffers, canonicalSlice, observationStrip, personFrameSlot, bridgeLinks, gate, socialSelection, primaryCtx }: {
  nodes: GlobeNode[]; arcs: GlobeArc[]; selected?: SelectedContext; registry?: EntityLink[]; identityLink?: ShellIdentityLink;
  /** STEP 2 — the frame this screen's readings are relative to (canon §19). */
  personContext?: PersonContext;
  /** LOOP 0053/V05 — real canon Need/Offer/Action/Effect stores,
   *  unfiltered, for the default `CanonActivityPanel` (shown only when no
   *  `?ctx=` is selected). */
  canonActions?: ActionRecord[]; canonEffects?: EffectRecord[];
  canonNeeds?: NeedRecord[]; canonOffers?: OfferRecord[];
  /** Phase 6B — the SAME shared Person/Value runtime state Hub/Dynamics/
   *  Brain/Community/Marketplace already render (`CanonicalSlicePanel`,
   *  unmodified), rendered server-side in `page.tsx` and passed down as a
   *  slot — this component is `"use client"`, so it cannot import an async
   *  Server Component itself. Never given a coordinate, never merged into
   *  `nodes`/`arcs` (the sphere's own real entity population, untouched) —
   *  same "inspector/HUD only, never spatial" rule `CanonActivityPanel`
   *  already established. */
  /** The shared PERSON-IN-CONTEXT frame, rendered server-side in page.tsx
   *  and passed as a slot — same reason as `canonicalSlice` below: this
   *  component is `"use client"` and cannot import an async Server
   *  Component. The frame is REFERENCE and may contextualise what is shown;
   *  it never becomes a node or an arc, and never a coordinate. */
  personFrameSlot?: ReactNode;
  /** EntityLink rows surfaced beside the drawn arcs — provenance preserved. */
  bridgeLinks?: { relation: string; link_id: string; provenance: "REAL" | "DEMO"; derived?: boolean }[];
  /** The SHARED social selection — the same record_id Community and World
   *  use. Globe resolves it to real geometry that already exists, or reports
   *  NOT_APPLICABLE. It never creates a node or a coordinate for it. */
  socialSelection?: {
    record_id: string;
    kind: string;
    at: string;
    verification: "VERIFIED" | "CLAIMED" | "UNKNOWN";
    provenance: string;
    network_present: boolean;
    absent_reason?: string;
    roles: { role: string; because: string }[];
    source_record_ids: string[];
  };
  /** The SHARED primary composition context — built by
   *  `buildSocialPrimaryContext` in `page.tsx`, identical in shape and
   *  derivation to the one GROUP and SYSTEM pass. */
  primaryCtx: SocialPrimaryContext;
  /** Verdict from the network truth gate over every candidate edge. */
  gate?: {
    candidates: number; passed: number; rejected: number;
    real: number; derived: number; demo: number;
    verified: number; claimed: number; unknown: number;
    reasons: { reason: string; count: number }[];
  };
  canonicalSlice?: ReactNode;
  /** 7-terminal propagation — a compact, always-VISIBLE strip for the
   *  latest real Observation's value/group relation, server-rendered in
   *  `page.tsx` from the SAME shared reading derivation. HUD only, never
   *  spatial: the record has no coordinate and none is invented. */
  observationStrip?: ReactNode;
}) {
  // The shared `?sel=` record joins the EXISTING highlight path by event_id.
  // No second selection mechanism, and no geometry is created for it: if no
  // arc carries this event_id, nothing lights up and the inspector says why.
  const highlightedEventId = selected?.status === "found" && selected.system === "legacy"
    ? selected.matched_id
    : socialSelection?.record_id;
  const wrapRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [Globe, setGlobe] = useState<any>(null);
  const stars = useMemo(() => starShadows(160, 7), []);

  useEffect(() => { let ok = true; import("react-globe.gl").then(m => { if (ok) setGlobe(() => m.default); }); return () => { ok = false; }; }, []);
  useEffect(() => { const el = wrapRef.current; if (!el) return; const u = () => setSize({ w: el.clientWidth, h: el.clientHeight }); u(); const ro = new ResizeObserver(u); ro.observe(el); return () => ro.disconnect(); }, []);

  // cinematic camera drift — slow, continuous, never still
  useEffect(() => {
    let raf = 0, t0 = 0;
    const drift = (t: number) => {
      if (!t0) t0 = t; const e = (t - t0) / 1000; const g = globeRef.current;
      if (g && g.pointOfView) g.pointOfView({ lat: 10 + Math.sin(e / 14) * 10, lng: (e * 1.5) % 360, altitude: 1.72 + Math.sin(e / 9) * 0.08 }, 0);
      raf = requestAnimationFrame(drift);
    };
    if (Globe) raf = requestAnimationFrame(drift);
    return () => cancelAnimationFrame(raf);
  }, [Globe]);

  const { points, arcs } = useMemo(() => {
    // Layout, not geography. The log records no coordinates, so giving a node a
    // place would be inventing data. Each node instead takes a slot on an evenly
    // spaced sphere, in the projection's own deterministic order: the same
    // events always draw the same picture, and no position reads as a location.
    //
    // Anchoring by community lived here while the globe also drew ontology
    // domains. Every node of one value group shares one community, which
    // collapsed the anchor onto a single point — so the spread is over all nodes
    // until a second group exists to separate.
    const slots = fibSphere(nodes.length);
    const pos = new Map<string, { lat: number; lng: number }>();
    // Endpoints of the highlighted arc — read from the arc's own source/target
    // ids, never from proximity or from what "looks related".
    const selectedArcRaw = highlightedEventId
      ? eventArcs.find((a) => a.event_id === highlightedEventId)
      : undefined;
    const endpointIds = new Set<string>(
      selectedArcRaw ? [selectedArcRaw.source_id, selectedArcRaw.target_id] : [],
    );

    const entityPts = nodes.map((n, i) => {
      const { lat, lng } = slots[i];
      pos.set(n.id, { lat, lng });
      const isEndpoint = endpointIds.has(n.id);
      return {
        lat, lng,
        color: isEndpoint ? "#ffd88a" : NODE_COLOR[n.type],
        r: isEndpoint ? NODE_RADIUS[n.type] * 2.1 : NODE_RADIUS[n.type],
        alt: n.type === "value_group" ? 0.04 : 0.015,
        label: n.label, type: n.type, isEndpoint,
      };
    });
    // Every line is an event. An arc whose endpoints are not both placeable is
    // DROPPED rather than drawn at a guessed position — blueprint §13.
    const arcs = eventArcs.map(a => {
      const s = pos.get(a.source_id), t = pos.get(a.target_id);
      if (!s || !t) return null;
      return {
        startLat: s.lat, startLng: s.lng, endLat: t.lat, endLng: t.lng,
        // provenance travels with the line, so the globe can answer "why is this here?"
        source_id: a.source_id, target_id: a.target_id, relation: a.relation,
        event_id: a.event_id, timestamp: a.timestamp,
        verification_status: a.verification_status, text: a.label,
        amount: a.amount, currency: a.currency, resource_type: a.resource_type,
        value_tags: a.value_tags, transfer_status: a.transfer_status,
        // resource movements read differently from membership: one is money
        // leaving the group, the other is a person joining it
        isTransfer: a.relation === "transfer.completed",
        // Selected System Context (Globe slice): true only when this arc's
        // OWN real event_id matches a resolved ?ctx= — never a guess.
        isSelected: a.event_id === highlightedEventId,
      };
    }).filter(Boolean) as any[];

    // Selected-context FOCUS (product-pass slice): the real systemic
    // neighborhood of the selected arc — every other arc sharing its exact
    // source_id/target_id, read straight off the same real data, never a
    // fabricated grouping. Everything else dims.
    const selectedArc = arcs.find((a) => a.isSelected);
    for (const a of arcs) {
      a.isNeighbor =
        !!selectedArc &&
        !a.isSelected &&
        (a.source_id === selectedArc.source_id ||
          a.source_id === selectedArc.target_id ||
          a.target_id === selectedArc.source_id ||
          a.target_id === selectedArc.target_id);
      a.isDimmed = !!selectedArc && !a.isSelected && !a.isNeighbor;
    }

    return { points: entityPts, arcs };
  }, [nodes, eventArcs, highlightedEventId]);

  const onReady = () => { const g = globeRef.current; if (!g) return; const c = g.controls(); c.autoRotate = true; c.autoRotateSpeed = 0.35; c.enableZoom = true; c.minDistance = 160; c.maxDistance = 460; };

  // The last few arcs, newest last — every one of them is a line you can see.
  const recentArcs = eventArcs.slice(-4);

  // Counts of what is ACTUALLY DRAWN, measured off the render arrays rather than
  // the inputs. The bar previously reported 61 ontology entities and 147 PUDM
  // relations while 8 lines were on screen — figures that described a data set
  // the viewer was not looking at.
  const drawn: [string, number][] = [
    ["nodes", points.length],
    ["arcs", arcs.length],
    ["relation types", new Set(arcs.map(a => a.relation)).size],
  ];

  return (
    <div style={S.root}>
      <style>{`@keyframes breathe{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:.85;transform:scale(1.04)}}@keyframes tw{0%,100%{opacity:.5}50%{opacity:.9}}`}</style>

      {/* layer 1 — starfield */}
      <div style={{ ...S.stars, boxShadow: stars, animation: "tw 6s ease-in-out infinite" }} />
      {/* layer 2 — breathing glow behind the globe */}
      <div style={{ ...S.breathe, animation: "breathe 7s ease-in-out infinite" }} />

      {/* layer 3+4 — the globe (THE object) */}
      <div ref={wrapRef} style={S.stage}>
        {Globe && size.w > 0 && (
          <Globe
            ref={globeRef} width={size.w} height={size.h}
            backgroundColor="rgba(0,0,0,0)"
            globeImageUrl="/globe/earth-night.jpg"
            atmosphereColor="#5aa6ff" atmosphereAltitude={0.3}
            onGlobeReady={onReady}
            pointsData={points}
            pointLat={(d: any) => d.lat} pointLng={(d: any) => d.lng}
            pointColor={(d: any) => d.color} pointAltitude={(d: any) => d.alt} pointRadius={(d: any) => d.r} pointResolution={5}
            pointLabel={(d: any) => d.label ? `<div style="font:600 12px system-ui;color:#fff">${d.label}</div><div style="font:11px system-ui;color:${d.color}">${d.type}</div>` : ""}
            arcsData={arcs}
            arcStartLat={(d: any) => d.startLat} arcStartLng={(d: any) => d.startLng} arcEndLat={(d: any) => d.endLat} arcEndLng={(d: any) => d.endLng}
            // A resource movement is a different KIND of line from a membership
            // one, so it reads differently. Colour only — no extra motion.
            // A resolved ?ctx= match (isSelected) overrides both to one bright,
            // unambiguous highlight colour — real selection, never decoration.
            arcColor={(d: any) => d.isSelected
              ? ["rgba(255,255,255,0.15)", "rgba(255,255,255,0.98)"]
              : d.isNeighbor
              ? ["rgba(255,255,255,0.08)", "rgba(255,255,255,0.6)"]
              : d.isTransfer
              ? [`rgba(255,206,138,${d.isDimmed ? 0.02 : 0.06})`, `rgba(255,206,138,${d.isDimmed ? 0.25 : 0.92})`]
              : [`rgba(120,180,255,${d.isDimmed ? 0.01 : 0.05})`, `rgba(150,210,255,${d.isDimmed ? 0.18 : 0.85})`]}
            arcStroke={(d: any) => (d.isSelected ? 0.55 : d.isNeighbor ? 0.4 : (d.isTransfer ? 0.32 : 0.18) * (d.isDimmed ? 0.4 : 1))} arcAltitude={0.18}
            arcDashLength={0.4} arcDashGap={0.25} arcDashAnimateTime={3200}
            // Hovering a line states its provenance. Not decoration: without this
            // a viewer cannot ask why a line exists and get an answer (§13).
            // Amount/currency/value appear ONLY when the event carried them.
            arcLabel={(d: any) => `<div style="font:600 12px system-ui;color:#fff">${d.text}</div>`
              + `<div style="font:11px system-ui;color:${d.isTransfer ? "#ffce8a" : "#8fd0ff"}">${d.relation} · ${d.timestamp.slice(0, 10)}</div>`
              + (d.amount !== undefined
                  ? `<div style="font:600 12px system-ui;color:#ffce8a">${d.amount.toLocaleString("he-IL")}${d.currency ? ` ${d.currency}` : ""}`
                    + `${d.resource_type ? ` · ${d.resource_type}` : ""}</div>`
                  : (d.isTransfer ? `<div style="font:11px system-ui;color:#7b8ca6">amount not recorded</div>` : ""))
              + (d.value_tags?.length ? `<div style="font:11px system-ui;color:#cdd8ec">value: ${d.value_tags.join(" · ")}</div>` : "")
              + `<div style="font:10px system-ui;color:#7b8ca6">${d.source_id} → ${d.target_id}</div>`
              + `<div style="font:10px system-ui;color:#7b8ca6">event ${d.event_id}`
              + `${d.transfer_status ? ` · ${d.transfer_status}` : ""}`
              + `${d.verification_status ? ` · ${d.verification_status}` : ""}</div>`}
            // Click-to-select: navigates to this arc's OWN real event_id as a
            // ?ctx=, the same self-link pattern as Dynamics' CanonPanel rows —
            // the entry point into the cross-linked Dynamics/Globe/Marketplace
            // loop. Nodes are entity-keyed (no SystemContextRef kind exists for
            // that id space), so only arcs are click-to-select here.
            onArcClick={(d: any) => {
              window.location.href = `/planet?ctx=${encodeURIComponent(encodeSystemContextRef({ kind: "legacy_event", event_id: d.event_id }))}`;
            }}
          />
        )}
        {!Globe && <div style={S.loading}>initializing globe…</div>}
      </div>

      {/* layer 5 — HUD that WRAPS the globe (thin, edge-hugging, no boxes).
          The green pulsing dot that sat here was a static "live" indicator with
          nothing streaming behind it — named in the blueprint header as a defect
          by example, so it is gone rather than restyled.
          The shared SystemShell replaces the old bespoke "PHILOS · GLOBE"
          brand label — same nav/identity strip Dynamics and Marketplace show.
          Shell-navigation pass: this box used to be a 340px-wide floating
          card at top-left, which wrapped the 7-item nav onto several lines
          and let `RegionLayerPanel` (left: 24, top: 64) paint straight
          across it — Globe was the one terminal where the shared navigation
          was there but unusable. It is now a full-width top bar, the same
          single-row nav every other terminal shows; the two side panels
          below start beneath it instead of inside it. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          background: "linear-gradient(180deg, rgba(4,10,22,0.92) 0%, rgba(4,10,22,0.78) 70%, rgba(4,10,22,0) 100%)",
          backdropFilter: "blur(6px)",
          padding: "10px 20px 12px",
          /* HARD CAP — REGRESSION GUARD.
             This band is absolutely positioned at zIndex 20 over the globe
             canvas. Anything rendered inside it therefore OCCLUDES the sphere
             rather than pushing it down. A previous change put the full
             person/value frame in here; the band grew to 1113px over a 900px
             viewport and hid the globe completely. The cap plus its own scroll
             container means the band can never again cover the primary
             content, whatever is placed inside it. */
          maxHeight: "34vh",
          overflowY: "auto",
          pointerEvents: "none",
        }}
      >
        <div style={{ pointerEvents: "auto" }}>
        <SystemShell
          surface="globe"
          purpose="Where this exists in the system, and what flows between whom — layout, not geography, until location is real."
          selected={selected}
          personContext={personContext}
          subject={selected?.status === "found" && selected.subject ? selected.subject : REAL_CURRENT_SUBJECT}
          identityLink={identityLink}
        />
        {/* The shared frame is REFERENCE / AUDIT content, not the primary
            content of this surface. On Globe the primary content is the
            sphere itself, so the frame ships COLLAPSED: the band keeps one
            summary row, and the panels open into their own capped, scrolling
            container instead of growing the band over the canvas.
            Nothing is removed — PersonFrame, Social-Value Spine, internal
            RED/WHITE roles and the source spine are all still here, one
            click away. */}
        {personFrameSlot ? (
          <details style={{ marginTop: 8 }}>
            <summary
              style={{
                cursor: "pointer",
                fontSize: FS.meta,
                letterSpacing: 1.2,
                color: "#5a76a3",
                padding: "3px 0",
              }}
            >
              מסגרת אדם · ערך · תפקידים · מקורות (reference frame)
            </summary>
            <div dir="rtl" style={{ maxHeight: "26vh", overflowY: "auto", marginTop: 6 }}>
              {personFrameSlot}
            </div>
          </details>
        ) : null}
        </div>
      </div>

      {/* Only the SELECTED-entity inspector still floats, because it belongs
          to the sphere interaction: it answers "what did I just click".
          CANON ACTIVITY and REGIONS/RELATED moved into the shared frame's
          AUDIT lane — they were a second grammar competing with the frame,
          answering questions the frame's own lanes already answer. */}
      {selected && selected.status !== "none" ? (
        <ContextInspector selected={selected} registry={registry ?? []} />
      ) : null}

      {/* ── SHARED PRIMARY COMPOSITION CONTRACT, hud density ───────────────
            NETWORK renders the SAME `SocialPrimaryStage` as GROUP and SYSTEM:
            the same header, the same six context cells in the same fixed
            order, the same audit entry, fed from the same
            `buildSocialPrimaryContext`. `density: "hud"` gives it an opaque
            backdrop and a two-column rail because it floats over a moving
            canvas — it does not change which primitives render or what they
            are called.

            DELETED, not restyled: the bespoke NETWORK lane, the bespoke
            OBJECT lane, the bottom-centre stats block and the two loose
            <details>. Every one of them answered a question the stage now
            answers for all three scales. That is what
            `DUPLICATED_PRIMARY_GRAMMAR = 0` costs.

            The sphere is NETWORK's representation medium — it is the canvas
            this column floats on, not a child of it — so the stage's
            representation slot carries the readout OF that drawing plus the
            legend that decodes it. Both are facts about the picture, and
            neither exists at the other two scales. */}
      <div style={S.hudColumn}>
        <SocialPrimaryStage ctx={primaryCtx}>
          {/* NETWORK_UNIQUE_ONLY — what the sphere actually drew, measured off
              the render arrays rather than the inputs. The bar once reported
              61 ontology entities and 147 PUDM relations while 8 lines were on
              screen: figures describing a data set the viewer was not
              looking at. */}
          <div style={S.drawn}>
            {drawn.map(([l, v]) => (
              <span key={l} style={S.drawnItem}>
                <span style={S.drawnNum}>{v}</span>
                <span style={S.drawnLabel}>{l}</span>
              </span>
            ))}
          </div>

          {/* NETWORK_UNIQUE_ONLY — blueprint §13: a line the viewer cannot
              decode is not information. */}
          <details>
            <summary style={{ ...S.hudSummary, listStyle: "none" }}>LEGEND</summary>
            <div style={S.legend}>
              <div style={S.legendRow}>
                <span style={{ ...S.legendLine, background: "linear-gradient(90deg,rgba(255,206,138,0.1),#ffce8a)", height: 2 }} />
                <span style={S.legendText}>resource transfer — amount · value · event</span>
              </div>
              <div style={S.legendRow}>
                <span style={{ ...S.legendLine, background: "linear-gradient(90deg,rgba(150,210,255,0.1),#96d2ff)" }} />
                <span style={S.legendText}>membership / appointment — from the event log</span>
              </div>
              <div style={S.legendRow}>
                <span style={{ ...S.legendLine, background: "#fff", height: 2 }} />
                <span style={S.legendText}>selected context — from a real ?ctx=</span>
              </div>
              <div style={S.legendRow}>
                <span style={{ ...S.legendDot, background: GROUP }} />
                <span style={S.legendText}>value group</span>
              </div>
              <div style={S.legendRow}>
                <span style={{ ...S.legendDot, background: VALUE }} />
                <span style={S.legendText}>value — the group&apos;s own real central_value</span>
              </div>
              <div style={S.legendRow}>
                <span style={{ ...S.legendDot, background: PERSON }} />
                <span style={S.legendText}>person — registered in the log</span>
              </div>
              <div style={S.legendRow}>
                <span style={{ ...S.legendDot, background: RECIPIENT }} />
                <span style={S.legendText}>recipient — named by an approved transfer</span>
              </div>
              <div style={S.legendNote}>
                Every point and line comes from an event and names it on hover.
                Point positions are layout, not geography.
              </div>
            </div>
          </details>
        </SocialPrimaryStage>
      </div>

      {/* EVENTS ON SCREEN removed: it listed the same records the shared
          TIME lane already lists, in Globe's own layout. One timeline, one
          place. The graph's own readout (nodes/arcs/relation types) stays,
          because that is a fact about the DRAWING, not about the records. */}

      {/* SCALE — real semantic zoom: what's real at each level on THIS
          globe, stated honestly rather than fabricating Community/System/
          World entities that don't exist as real data here. */}
      {/* Scale note moved out of PRIMARY: explanatory prose belongs in
          SECONDARY/AUDIT, not floating over the sphere. */}

      {/* The bottom-centre stats block that stood here is DELETED. Its three
          figures are the stage's representation slot now — one readout, in the
          shared column, instead of a second HUD grammar parked under the
          sphere. */}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  /* PRIMARY_STAGE, not the viewport.
     This was `position: fixed; inset: 0` — the surface owned the window, so
     it could never be nested inside the shared frame without painting over
     the navigation. Everything inside it is already `position: absolute`, so
     those overlays now anchor to THIS box instead of the screen, and the
     canvas needed no change at all: it has always measured its parent through
     a ResizeObserver rather than reading `window.innerWidth`.
     `isolation: isolate` seals the z-order — the band at zIndex 20 and the
     panels at 10-14 now sort only against each other, never against the shell.
     Height is ASKED FOR, not taken. `min-height: 100vh` on a relative element
     is not the bug `position: fixed` was: it is a request the parent can
     override, and everything still positions against this box. On /planet the
     shell renders INSIDE this stage (the nav band sits at zIndex 20 over the
     canvas by design), so the stage wants the full viewport; nested in a
     smaller container it simply gets less and the canvas follows, because the
     canvas measures its parent. */
  root: {
    position: "relative",
    width: "100%",
    minHeight: "100vh",
    overflow: "hidden",
    isolation: "isolate",
    background: "radial-gradient(120% 90% at 50% 42%, #071120 0%, #03060e 48%, #010206 100%)",
    color: "#9fb2d6",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  stars: { position: "absolute", top: 0, left: 0, width: 1, height: 1, borderRadius: "50%", background: "transparent", zIndex: 0 },
  breathe: { position: "absolute", left: "50%", top: "50%", width: "76vmin", height: "76vmin", transform: "translate(-50%,-50%)", borderRadius: "50%", background: "radial-gradient(circle, rgba(70,140,255,0.22) 0%, rgba(50,110,230,0.06) 45%, transparent 66%)", zIndex: 0, pointerEvents: "none" },
  stage: { position: "absolute", inset: 0, zIndex: 1 },
  loading: { position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#4f6a99", letterSpacing: "3px", fontSize: 12 },

  topCenter: { position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 10, fontSize: 11, letterSpacing: "3px", color: "#c3d5f2", textAlign: "center" },
  purposeLine: { fontSize: FS.tag, letterSpacing: "0.3px", color: "#6f89b6", marginTop: 5, maxWidth: 360, textTransform: "none" },

  /* ONE anchor for everything in this corner. Nothing inside it is
     positioned; the column lays out in flow, so no two panels here can ever
     be given conflicting offsets again. Capped + self-scrolling, so the
     column can never occlude the sphere however much it holds. */
  hudColumn: {
    position: "absolute", left: 14, bottom: 14, zIndex: 14,
    width: 392, maxWidth: "32vw", maxHeight: "62vh", overflowY: "auto",
    display: "flex", flexDirection: "column", gap: 6,
  },
  /* One disclosure style for every collapsed panel on this surface — the
     legend used `railHead`, the audit stack used two inline objects. */
  hudSummary: { cursor: "pointer", fontSize: FS.meta, letterSpacing: 1, color: "#5a76a3", padding: "4px 2px" },

  /* NETWORK_UNIQUE_ONLY — the drawing's own counts, inside the shared stage's
     representation slot. */
  drawn: {
    display: "flex", alignItems: "baseline", gap: 18, flexWrap: "wrap",
    padding: "8px 11px", border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.md,
    background: "rgba(4,10,22,0.97)", backdropFilter: "blur(10px)",
  },
  drawnItem: { display: "inline-flex", alignItems: "baseline", gap: 6 },
  drawnNum: { fontSize: 18, fontWeight: 700, color: "#eaf1ff", lineHeight: 1, fontVariantNumeric: "tabular-nums" },
  drawnLabel: { fontSize: FS.tag, textTransform: "uppercase", letterSpacing: 1.4, color: "#5a76a3" },

  legend: { display: "flex", flexDirection: "column", gap: 5, maxWidth: 260, padding: "4px 2px 2px" },
  legendRow: { display: "flex", alignItems: "center", gap: 9 },
  legendLine: { width: 26, height: 1.5, borderRadius: 2, flexShrink: 0 },
  legendDot: { width: 6, height: 6, borderRadius: "50%", flexShrink: 0, marginLeft: 10, marginRight: 10 },
  /* 10px floor — these were 9.5 and 8.5, the last two sub-floor sizes on
     this surface. A legend nobody can read is not a legend. */
  legendText: { fontSize: FS.tag, color: "#7f97c2", lineHeight: 1.5 },
  legendNote: { fontSize: FS.tag, color: "#5a76a3", lineHeight: 1.55, marginTop: 5 },
  /* Pinned BELOW the right-hand context panel rather than vertically centred:
     centred, it sat at 394-506 and was completely covered by CANON ACTIVITY
     (168-630, zIndex 12) — the rail rendered but was never visible. */
  rightRail: { position: "absolute", right: 24, top: 620, zIndex: 10, width: 190, display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" },
  railHead: { fontSize: FS.tag, letterSpacing: "2.5px", color: "#3e587f", marginBottom: 8 },
  streamRow: { fontSize: 10, lineHeight: 1.5, color: "#7f97c2", textAlign: "right" },
  streamId: { color: "#3e587f" },

};
