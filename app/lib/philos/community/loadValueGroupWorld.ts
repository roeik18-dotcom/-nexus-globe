/**
 * ONE LOADER for the group world: registry, universe, viewer overlay, selection.
 *
 * Every terminal calls this instead of importing a group id. That is the
 * mechanical form of the ruling — a surface can no longer name a group at
 * compile time, because the only thing it can import is a function that reads
 * what exists.
 *
 * The four results are deliberately returned SEPARATELY rather than merged into
 * one personalised object: keeping `universe` (global) and `overlay`
 * (viewer-scoped) as distinct fields is what stops a caller from accidentally
 * rendering one as the other.
 */
import { loadPhilosEvents } from "@/app/lib/philos-event-store";
import { systemClock, todayIn } from "../eventStore";
import { resolveViewerContext } from "../identity/viewerContext";
import { DEMO_COMMUNITIES } from "../demoCommunities";
import type { PhilosEvent } from "../events";
import { buildValueGroupRegistry, type ValueGroupRegistry } from "./valueGroupRegistry";
import { buildValueGroupUniverse, type ValueGroupUniverse } from "./valueGroupUniverse";
import { buildViewerGroupOverlay, type ViewerGroupOverlay } from "./viewerGroupOverlay";
import { resolveSelectedGroup, type SelectedGroupContext } from "./selectedGroupContext";
import { buildGroupRelations, type GroupRelation } from "./groupRelations";
import { loadIngestedGroups, loadValueMappingRulings } from "./valueGroupIngest";
import { loadGroupEvents } from "./groupEventStore";
import { projectAllGroupStates, type GroupOperationalState } from "./groupOperationalState";
import { deriveCandidateMatches, pendingCandidates, type CandidateMatch } from "./needResourceBridge";
import { deriveEventRelations, type EventRelation } from "./eventGroupRelations";
import type { GroupEvent } from "./groupEvent";

export interface ValueGroupWorld {
  registry: ValueGroupRegistry;
  universe: ValueGroupUniverse;
  overlay: ViewerGroupOverlay;
  selected: SelectedGroupContext;
  relations: readonly GroupRelation[];
  /** Ingest lines that failed to parse. Surfaced, never swallowed. */
  ingestRejected: readonly { line: number; because: string }[];
  events: readonly PhilosEvent[];

  /* ── the operational spine ─────────────────────────────────────────────
     One projection of the group event log, consumed by Community, Network,
     Marketplace and Dynamics alike. No terminal rebuilds group state. */
  operational: ReadonlyMap<string, GroupOperationalState>;
  groupEvents: readonly GroupEvent[];
  groupEventRejected: readonly { line: number; because: string }[];
  /** DERIVED need↔resource pairs. A candidate is not an agreement. */
  candidateMatches: readonly CandidateMatch[];
  /** Edges the HISTORY justifies, each naming its event ids. */
  eventRelations: readonly EventRelation[];
}

export async function loadValueGroupWorld(opts?: {
  /** Raw `?group=` value. Validated inside; never trusted. */
  requestedGroup?: unknown;
  events?: readonly PhilosEvent[];
  /** Include the two DEMO bundles. Off for surfaces that must show REAL only. */
  includeDemo?: boolean;
  today?: string;
}): Promise<ValueGroupWorld> {
  const events = opts?.events ?? (await loadPhilosEvents());
  const today = opts?.today ?? todayIn(systemClock);
  const ingest = loadIngestedGroups();
  const registry = buildValueGroupRegistry({
    events,
    ingested: ingest.records,
    demo: opts?.includeDemo === false ? [] : DEMO_COMMUNITIES,
    rulings: loadValueMappingRulings(),
    today,
  });
  const viewer = await resolveViewerContext();

  /* THE SPINE. Group operational events are a separate, newer log from the
     original `philos-events.jsonl`; both are append-only and neither is
     rewritten. The projection is built once here so every consumer reads the
     same state — four independent reconstructions is how Community, Network
     and System came to disagree about membership. */
  const ge = loadGroupEvents();
  const operational = projectAllGroupStates(ge.events);
  const allNeeds = [...operational.values()].flatMap((s) => s.needs);
  const allResources = [...operational.values()].flatMap((s) => s.resources);
  const allRecorded = [...operational.values()].flatMap((s) => s.matches);
  const candidateMatches = pendingCandidates(deriveCandidateMatches(allNeeds, allResources), allRecorded);
  const eventRelations = deriveEventRelations(operational, deriveCandidateMatches(allNeeds, allResources));

  return {
    registry,
    universe: buildValueGroupUniverse(registry),
    overlay: buildViewerGroupOverlay(viewer, registry, events),
    selected: resolveSelectedGroup(registry, opts?.requestedGroup),
    // Registry-supported edges plus history-supported edges. Both carry their
    // own evidence; neither is invented to fill the other's silence.
    relations: [...buildGroupRelations(registry, events), ...eventRelations],
    ingestRejected: ingest.rejected,
    events,
    operational,
    groupEvents: ge.events,
    groupEventRejected: ge.rejected.map((r) => ({ line: r.line, because: r.because })),
    candidateMatches,
    eventRelations,
  };
}
