"use client";
/**
 * THE DISCOVERY SURFACE — two coordinated views over one canonical model.
 *
 * Selection lives here, once, and both views read it. That is what makes them
 * COORDINATED rather than two widgets: clicking a sub-value in the Value Map
 * narrows the Group Network to the groups on that leaf, and clicking a node in
 * the Network selects the same group object the map is highlighting. There is
 * no second data model and no second copy of a group.
 *
 * Selection is mirrored into the URL (`?group=`, `?family=`, `?subvalue=`) via
 * `history.replaceState` rather than a router push: the state must survive a
 * hop to Network / Marketplace / Dynamics and back, and it must not add a
 * history entry per click or re-run the server render for a pure highlight.
 * `?group=` is the same parameter `SelectedGroupContext` resolves server-side,
 * so the deep view and every other terminal read one name for one meaning.
 *
 * WHAT THIS DOES NOT DO: it never writes. Inspecting is not joining, and
 * nothing here can create a membership, a value, or a relation.
 */
import { useCallback, useEffect, useState } from "react";
import { COLOR, FS, RADIUS, SPACE } from "@/app/lib/philos/shell/designTokens";
import ValueSpectrumMap, { type SpectrumGroupRef } from "./ValueSpectrumMap";
import GroupNetworkView from "./GroupNetworkView";
import GroupDeepView from "./GroupDeepView";
import DataQualityPanel, { type QualityInput } from "./DataQualityPanel";
import type { ValueGroupUniverse } from "@/app/lib/philos/community/valueGroupUniverse";
import type { RegistryEntry } from "@/app/lib/philos/community/valueGroupRegistry";
import type { GroupRelation } from "@/app/lib/philos/community/groupRelations";
import type { ViewerGroupRelation } from "@/app/lib/philos/community/viewerGroupOverlay";
import type { GroupOperationalState } from "@/app/lib/philos/community/groupOperationalState";

export interface DiscoveryProps {
  universe: ValueGroupUniverse;
  entries: readonly RegistryEntry[];
  relations: readonly GroupRelation[];
  overlay: Record<string, ViewerGroupRelation>;
  initialGroup: string | null;
  quality: QualityInput;
  /** The operational spine, keyed by group_id. Serialised from the server. */
  operational: Record<string, GroupOperationalState>;
  /** Every id that IS the reader — second person is applied against these. */
  viewerIds: (string | undefined)[];
  /**
   * `member.joined` count for the selected entity, from the shared projection.
   * Passed straight through to `GroupDeepView` so the roster row can state the
   * 9-vs-6 split with the SAME authority the spine above uses.
   */
  joinEvents?: { group_id: string; count: number };
}

export default function CommunityDiscovery({ universe, entries, relations, overlay, initialGroup, quality, operational, viewerIds, joinEvents }: DiscoveryProps) {
  const [family, setFamily] = useState<string | null>(null);
  const [subvalue, setSubvalue] = useState<string | null>(null);
  const [group, setGroup] = useState<string | null>(initialGroup);
  const [relation, setRelation] = useState<string | null>(null);

  // Mirror to the URL so the selection survives leaving the surface.
  useEffect(() => {
    const u = new URL(window.location.href);
    const set = (k: string, v: string | null) => (v ? u.searchParams.set(k, v) : u.searchParams.delete(k));
    set("group", group); set("family", family); set("subvalue", subvalue);
    window.history.replaceState(null, "", u.toString());
  }, [group, family, subvalue]);

  const groupRefs: (SpectrumGroupRef & { members: number })[] = entries.map((e) => ({
    group_id: e.group.group_id,
    name: e.group.name,
    provenance: e.group.provenance,
    mine: (overlay[e.group.group_id] ?? "NONE") !== "NONE",
    mapped: Boolean(e.group.primary_subvalue_id),
    members: e.group.members.length,
  }));

  // COORDINATION: a sub-value selection narrows the network to that leaf's
  // groups. An empty leaf narrows to nothing — and says so.
  const leafGroupIds = subvalue
    ? universe.families.flatMap((f) => f.subvalues).find((s) => s.subvalue_id === subvalue)?.groups.map((g) => g.group.group_id) ?? []
    : null;
  const networkGroups = leafGroupIds ? groupRefs.filter((g) => leafGroupIds.includes(g.group_id)) : groupRefs;
  const networkRelations = leafGroupIds
    ? relations.filter((r) => leafGroupIds.includes(r.from_group_id) && leafGroupIds.includes(r.to_group_id))
    : relations;

  const selectedEntry = group ? entries.find((e) => e.group.group_id === group) ?? null : null;
  const onSelectGroup = useCallback((id: string | null) => { setGroup(id); setRelation(null); }, []);

  const mine = Object.values(overlay).filter((r) => r !== "NONE").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE.lg }}>
      {/* VIEWER POSITION. `נבחרה` was removed from this row: the shared spine
          above names the selected entity, its id and its whole chain, and a
          second "selected: X" 40px lower is the duplication the composition
          pass exists to remove. The three population counts stay — they are
          about the UNIVERSE, which the spine says nothing about. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.md, alignItems: "center", fontSize: FS.base }}>
        {[
          { k: "כל הקבוצות", v: String(entries.length), tone: COLOR.text },
          { k: "הקבוצות שלי", v: String(mine), tone: mine ? "#7fe0ab" : COLOR.textFaint },
          { k: "קשורות אליי", v: String(Object.values(overlay).filter((r) => r === "RELATED" || r === "CANDIDATE" || r === "FOLLOWING").length), tone: COLOR.textDim },
        ].map((m) => (
          <span key={m.k} style={{ display: "inline-flex", gap: SPACE.sm, alignItems: "baseline",
            padding: `4px ${SPACE.md}px`, background: COLOR.bgCard, border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.pill }}>
            <span style={{ fontSize: FS.tag, color: COLOR.textFaint }}>{m.k}</span>
            <strong style={{ color: m.tone, fontVariantNumeric: "tabular-nums" }}>{m.v}</strong>
          </span>
        ))}
      </div>

      {/* THE 223-VALUE TAXONOMY IS A FIELD TO EXPLORE, NOT A WALL TO READ.
          Rendered flat it was 223 equally loud labels above the actual
          subject — the loudest thing on a page whose subject is one group.
          It opens closed and names its own size, so a reader chooses to enter
          it rather than being made to walk past it. */}
      {/* THE SPECTRUM IS THE PRODUCT, NOT AN AUDIT DISCLOSURE.
          It was folded behind a summary to cut page height. That was the wrong
          trade: 28 families and 223 sub-values ARE Community's subject — the
          value universe a group is located inside — and hiding the subject to
          make the page shorter optimised a metric by deleting the answer. It
          opens open. Height is not a product goal. */}
      <div style={{ background: COLOR.bgCard, border: `1px solid ${COLOR.border}`,
        borderRadius: RADIUS.md, padding: SPACE.sm }}>
        <div style={{ padding: `${SPACE.xs ?? 4}px ${SPACE.sm}px ${SPACE.sm}px`,
          fontSize: FS.base, color: COLOR.text }}>
          ספקטרום הערכים המלא — {universe.coverage.family_count} משפחות · {universe.coverage.subvalue_count} תתי-ערכים
          <span style={{ color: COLOR.textFaint, fontSize: FS.tag }}>
            {"  "}· {universe.coverage.populated_subvalue_count} מאוכלסים בקבוצה
          </span>
        </div>
        <div>
      <ValueSpectrumMap
        universe={universe} groups={groupRefs}
        selectedFamily={family} selectedSubvalue={subvalue} selectedGroup={group}
        onSelectFamily={(f) => { setFamily(f); setSubvalue(null); }}
        onSelectSubvalue={setSubvalue}
        onSelectGroup={onSelectGroup} />
        </div>
      </div>

      {/* Sub-value readout — the coordination point between the two views. */}
      {subvalue ? (() => {
        const node = universe.families.flatMap((f) => f.subvalues).find((s) => s.subvalue_id === subvalue);
        return node ? (
          <div style={{ padding: SPACE.md, background: COLOR.bgCard, border: `1px solid ${COLOR.accent}`, borderRadius: RADIUS.md, fontSize: FS.base, color: COLOR.text }}>
            <strong>{node.name_he}</strong> <span style={{ color: COLOR.textFaint }}>{node.subvalue_id}</span>
            {" — "}{node.source_count} מסורות מצטטות את הערך הזה, {node.group_count === 0
              ? <span style={{ color: "#f0b45c" }}>ואף קבוצה לא התארגנה סביבו</span>
              : <span style={{ color: "#7fe0ab" }}>ו-{node.group_count} קבוצות התארגנו סביבו</span>}
            <span style={{ color: COLOR.textDim }}> · הרשת מסוננת לתת-הערך הזה</span>
          </div>
        ) : null;
      })() : null}

      {/* Two columns where they fit, ONE column where they do not. The fixed
          two-track grid never collapsed: at 511px it demanded 320+300+gap and
          pushed the page 136px sideways, which `resize_window` caught and the
          desktop view never could. `auto-fit` collapses instead of squeezing. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
        gap: SPACE.lg, alignItems: "start" }}>
        <div>
          <div style={{ fontSize: FS.section, fontWeight: 600, color: COLOR.text, marginBottom: SPACE.sm }}>
            רשת הקבוצות{leafGroupIds ? ` — מסוננת (${networkGroups.length})` : ""}
          </div>
          <GroupNetworkView groups={networkGroups} relations={networkRelations}
            selectedGroup={group} selectedRelation={relation}
            onSelectGroup={onSelectGroup} onSelectRelation={setRelation} />
        </div>
        <div>
          <div style={{ fontSize: FS.section, fontWeight: 600, color: COLOR.text, marginBottom: SPACE.sm }}>
            {selectedEntry ? "המערכת התפעולית של הקבוצה" : "פירוט קבוצה"}
          </div>
          {selectedEntry
            ? <GroupDeepView entry={selectedEntry} relation={overlay[selectedEntry.group.group_id] ?? "NONE"}
                state={operational[selectedEntry.group.group_id] ?? null} viewerIds={viewerIds}
                joinEvents={joinEvents} />
            : <div style={{ padding: SPACE.lg, background: COLOR.bgCard, border: `1px dashed ${COLOR.border}`,
                borderRadius: RADIUS.md, fontSize: FS.base, color: COLOR.textDim }}>
                לא נבחרה קבוצה. לחץ על צומת ברשת או על שבב קבוצה במפה כדי לפתוח את
                הערך, החברים, התפקידים, התקציב, תנועות הכסף, הצרכים, המשאבים, הפעולות, ההשפעות והראיות שלה.
              </div>}
        </div>
      </div>

      <DataQualityPanel input={quality} />
    </div>
  );
}
