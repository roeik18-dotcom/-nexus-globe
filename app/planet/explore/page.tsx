/**
 * WORLD EXPLORER, standalone — the globe with nothing else competing for the
 * page.
 *
 * Kept after it served as the isolation probe that found the blank-canvas
 * defect: `/planet` stacks this above the legacy `WorldGlobe`, and a surface
 * whose subject is a map is easier to read when it is the only map. Both
 * routes render the same component over the same loader.
 */
import WorldExplorer from "../WorldExplorer";
import { loadWorldView } from "@/app/lib/philos/geo/loadWorldView";
import { SELECTED_GROUP_PARAM } from "@/app/lib/philos/community/selectedGroupContext";

export default async function ExploreProbe({ searchParams }: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const world = await loadWorldView({ requestedGroup: params[SELECTED_GROUP_PARAM] });
  return (
    <div dir="rtl" style={{ background: "#0a0e17", minHeight: "100vh", padding: 20 }}>
      <WorldExplorer
        global={world.global}
        byContinent={world.byContinent}
        byCountry={world.byCountry}
        searchIndex={world.search}
        resolver={world.resolverCoverage}
        initialGroup={world.group.selected.status === "selected" ? world.group.selected.group_id : null}
        groups={world.located.map((g) => ({
          group_id: g.entry.group.group_id,
          name: g.entry.group.name,
          provenance: g.entry.group.provenance,
          mine: (world.group.overlay.relationOf(g.entry.group.group_id) ?? "NONE") !== "NONE",
          members: g.state && g.state.channels.members === "MEASURED"
            ? g.state.members.filter((m) => m.active).length
            : g.entry.group.members.length,
          precision: g.geo.precision,
          raw_label: g.geo.raw_label,
          country_code: g.geo.country_code,
          country_name: g.geo.country_name,
          continent: g.geo.continent,
          resolver: g.geo.resolver,
          confidence: g.geo.confidence,
          because: g.geo.because,
        }))}
      />
    </div>
  );
}
