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

export interface ValueGroupWorld {
  registry: ValueGroupRegistry;
  universe: ValueGroupUniverse;
  overlay: ViewerGroupOverlay;
  selected: SelectedGroupContext;
  relations: readonly GroupRelation[];
  /** Ingest lines that failed to parse. Surfaced, never swallowed. */
  ingestRejected: readonly { line: number; because: string }[];
  events: readonly PhilosEvent[];
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
  return {
    registry,
    universe: buildValueGroupUniverse(registry),
    overlay: buildViewerGroupOverlay(viewer, registry, events),
    selected: resolveSelectedGroup(registry, opts?.requestedGroup),
    relations: buildGroupRelations(registry, events),
    ingestRejected: ingest.rejected,
    events,
  };
}
