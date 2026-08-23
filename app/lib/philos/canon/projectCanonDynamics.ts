/**
 * Canon → Dynamics — additive bridge (systemic-integration-audit slice 1).
 *
 * Turns the ONE persisted canon primitive (`Observation`, read through
 * `CanonEventStore.load()`) into a small graph of marks the `/dynamics` screen
 * can render ALONGSIDE the existing legacy Value-Group causal graph — never
 * merged into it.
 *
 * **Why NOT `DynamicsNode`/`DynamicsEdge` (`../projectDynamics.ts`), read this
 * before adding a field**: those types are closed to the legacy taxonomy —
 * `Domain = "people"|"community"|"activity"|"resources"|"impact"`,
 * `EntityType`/`EventType` are 5/16-value closed unions (`../events.ts`).
 * `canonEvent.ts`'s own header already documents the `Domain` collision this
 * would create. None of the five legacy domains, and none of the sixteen
 * legacy event types, is an honest description of a canon Observation
 * (domain `G`|`E`|`C`, no `caused_by`-shaped causal history). Forcing a fit
 * would fabricate a category the evidence doesn't support — exactly what the
 * integration audit flagged. This module defines its OWN small, honest type
 * instead, read verbatim off `Observation`, and changes nothing about
 * `DynamicsGraph`/`DynamicsViewModel`.
 *
 * **No edges.** Canon has no cross-Observation causal link today — no
 * `caused_by` analog, no join-key allow-list. An edge here would be invented,
 * not derived, so this module produces nodes only. A future slice may add
 * edges once a real linkage (e.g. two Observations for the same subject
 * chained through explicit `reference`) is designed with its own
 * evidence/confidence machinery — not assumed here.
 *
 * **Persisted vs derived, stated not implied**: `Observation` is the only
 * persisted canon primitive (`PERSISTENCE_POLICY.md`); every mark this module
 * returns is `persisted_or_derived: "persisted"` for that reason, not left
 * for the reader to infer.
 *
 * **Provenance preserved, not collapsed**: `provenance` is copied verbatim
 * from `Observation.provenance` (`"self_reported"` for every Observation
 * Merlin's two self-report gates can produce) — never re-labeled as the
 * legacy `edge_origin`/`evidence_level` pair, which measures a different
 * thing (causal-link honesty, not measurement honesty).
 *
 * **Read-only, no write path, no duplicate ingestion**: `store.load()` is the
 * only store call in this file. `.append()` is never imported or called.
 * Nothing here mints an id — `canon_event_id`, already a stable, deterministic
 * hash minted at ingestion time, is reused verbatim as this module's own node
 * id, so re-rendering the same store twice yields byte-identical ids.
 */

import type { CanonEvent } from "./canonEvent";
import type { CanonEventStore } from "./canonEventStore";
import { canonEventStore } from "./canonEventStoreAccessor";
import type { Domain as CanonDomain, Frame as CanonFrame, Observation } from "./observation";

export interface CanonObservationMark {
  /** Stable across renders — the real, persisted `canon_event_id`, never re-derived. */
  id: string;
  canon_event_id: string;
  subject: string;
  domain: CanonDomain;
  frame: CanonFrame;
  level: number;
  stability: number;
  /** Verbatim from `Observation.deficitType` — canon §5 (RELATIVE/OBJECTIVE), never inferred. */
  deficitType: Observation["deficitType"];
  context: string;
  reference: string;
  /** `Observation.time` — when the measurement is OF, not when it was written. */
  observed_at: string;
  /** `CanonEvent.recorded_at` — when the record was appended to the store. */
  recorded_at: string;
  /** Verbatim from `Observation.provenance` — canon's own honesty field. */
  provenance: Observation["provenance"];
  /** Verbatim from `Observation.confidence` (LOOP A005/A006) — measurement
   *  metadata, never part of the human's value (canon §6), surfaced here
   *  so BEFORE/AFTER views can show it without a second read. Optional so
   *  every pre-existing hand-built test fixture across this codebase stays
   *  valid — the real `projectCanonDynamics` below always populates it. */
  confidence?: number;
  /** Always "persisted" — Observation is canon's one persisted primitive. */
  persisted_or_derived: "persisted";
  label: string;
  tooltip: string;
}

export interface CanonDynamicsGraph {
  source: "canon";
  nodes: CanonObservationMark[];
  summary: {
    node_count: number;
    persisted_count: number;
    domains: Record<CanonDomain, number>;
  };
}

function labelOf(o: Observation): string {
  return `PHILOS canon Observation — ${o.domain}/${o.frame} (${o.context})`;
}

function tooltipOf(event: CanonEvent): string {
  const o = event.payload;
  return (
    `subject=${o.subject} level=${o.level} stability=${o.stability} ` +
    `deficitType=${o.deficitType} reference=${o.reference} recorded_at=${event.recorded_at}`
  );
}

/**
 * Pure over its input (given the same store contents, same output — no
 * clock, no random). Deterministic order: `observed_at` ascending, tied by
 * `canon_event_id` — mirrors `projectDynamics.ts`'s own "no clock, no
 * random" discipline and `inCanonOrder`'s own tie-break shape.
 */
/**
 * VIEWER SCOPE. A canon Observation is a PERSONAL record: it carries a
 * subject, a level, a deficit type and the person's own words in `context`.
 * This projection loaded every observation in the store and emitted all of
 * them with `subject=…` and the raw context text in the label — with no viewer
 * parameter at all. Seven production callers inherited that, and User B's
 * Dynamics page carried Roei's own observation text in a tooltip. Measured,
 * not theorised.
 *
 * The projection is now scoped by construction and FAILS CLOSED: no resolvable
 * viewer means no nodes, never "all nodes". A caller that genuinely needs the
 * whole store — a test, or an audit surface that is not viewer-facing — has to
 * name `projectCanonDynamicsUnscoped` and thereby say out loud that it is
 * asking for unscoped data.
 */
export interface CanonViewerScope {
  subject_id?: string;
  person_id?: string;
}

/** The one value that opens the gate for everything. Not a viewer id — a
 *  named, greppable declaration that a call site is deliberately unscoped. */
export const UNSCOPED: CanonViewerScope = { subject_id: "__UNSCOPED__", person_id: "__UNSCOPED__" };

/** Pure gate, exported so the rule is testable without a store or a session. */
export function observationVisibleTo(subject: string, viewer: CanonViewerScope | null): boolean {
  if (!viewer) return false;
  if (viewer === UNSCOPED) return true;
  return (
    (viewer.subject_id !== undefined && subject === viewer.subject_id) ||
    (viewer.person_id !== undefined && subject === viewer.person_id)
  );
}

export async function projectCanonDynamics(
  store: CanonEventStore = canonEventStore(),
  /** Explicit scope. Omitted = resolved from the session. */
  viewer?: CanonViewerScope,
): Promise<CanonDynamicsGraph> {
  const scope = viewer ?? await (async (): Promise<CanonViewerScope | null> => {
    try {
      const { resolveViewerContext } = await import("../identity/viewerContext");
      const ctx = await resolveViewerContext();
      return { subject_id: ctx.subject_id, person_id: ctx.person_id };
    } catch {
      // No session, no scope, no data. The safe direction.
      return null;
    }
  })();

  const all = await store.load();
  const events = all.filter((e) =>
    e.canon_type !== "observation" || observationVisibleTo(e.payload.subject, scope ?? null));
  const observations = events.filter((e) => e.canon_type === "observation");

  const nodes: CanonObservationMark[] = observations.map((event) => ({
    id: event.canon_event_id,
    canon_event_id: event.canon_event_id,
    subject: event.payload.subject,
    domain: event.payload.domain,
    frame: event.payload.frame,
    level: event.payload.level,
    stability: event.payload.stability,
    deficitType: event.payload.deficitType,
    context: event.payload.context,
    reference: event.payload.reference,
    observed_at: event.payload.time,
    recorded_at: event.recorded_at,
    provenance: event.payload.provenance,
    confidence: event.payload.confidence,
    persisted_or_derived: "persisted",
    label: labelOf(event.payload),
    tooltip: tooltipOf(event),
  }));

  nodes.sort(
    (a, b) => a.observed_at.localeCompare(b.observed_at) || a.canon_event_id.localeCompare(b.canon_event_id),
  );

  const domains: Record<CanonDomain, number> = { G: 0, E: 0, C: 0 };
  for (const n of nodes) domains[n.domain] += 1;

  return {
    source: "canon",
    nodes,
    summary: { node_count: nodes.length, persisted_count: nodes.length, domains },
  };
}

/**
 * THE UNSCOPED DOOR — every observation in the store, for callers that are
 * genuinely not viewer-facing (tests, and audit tooling that states it is
 * unscoped). It delegates rather than duplicating the projection, so the two
 * doors can never drift; only the gate differs. Named so that reading the call
 * site is enough to know personal records are crossing it. Never call this
 * from a rendered surface.
 */
export async function projectCanonDynamicsUnscoped(
  store: CanonEventStore = canonEventStore(),
): Promise<CanonDynamicsGraph> {
  return projectCanonDynamics(store, UNSCOPED);
}
