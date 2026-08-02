/**
 * The globe route.
 *
 * PHILOS-SYSTEM-BLUEPRINT §13 — "no line exists until it represents a real
 * event" — and the header rule extends that to every node, metric and status.
 *
 * This route used to render two populations at once: arcs projected from the
 * canonical event log, and ~61 ontology entities read from `data/*.json` whose
 * coordinates came from hashing an id and whose counts were reported in the HUD.
 * The second population could not name an event, so half the screen failed the
 * traceability rule while sitting beside the half that passed it — the "chain is
 * not yet exclusive" debt recorded in §0.
 *
 * The ontology read is gone. `projectGlobeGraph` is now the only source that
 * reaches this page: what the globe draws is exactly what the projection
 * returns, and every node and line on it names the event behind it.
 */

import { projectGlobeGraph } from "@/app/lib/philos/projectGlobeGraph";
import { GROUP_ID, VALUE_GROUP_EVENTS } from "@/app/lib/philos/valueGroupLog";
import WorldGlobe from "./WorldGlobe";

export const metadata = { title: "Philos — Globe" };

export default function PlanetPage() {
  const { nodes, arcs } = projectGlobeGraph(VALUE_GROUP_EVENTS, GROUP_ID);

  // An empty projection means the log holds nothing placeable. Saying so is the
  // honest state: the previous fallback ("No world data.") described the
  // ontology files, which this route no longer reads.
  if (nodes.length === 0) {
    return (
      <div style={{ padding: 40, fontFamily: "system-ui" }}>
        No event-backed entities to draw.
      </div>
    );
  }

  return <WorldGlobe nodes={nodes} arcs={arcs} />;
}
