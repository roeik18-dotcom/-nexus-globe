/**
 * CommunityFlow — Community's primary visual (BATCH 3, Product Experience
 * Rebuild). A real connected node chain — VALUES → GROUPS → NEEDS ↔
 * RESOURCES → ACTIONS → IMPACT — same visual grammar as Dynamics'
 * `CausalChainFlow.tsx` and Marketplace's `MarketplaceFlow.tsx` (same
 * node/arrow shapes, same `designTokens.ts` source), so a viewer who has
 * seen either of those recognizes this immediately as the same product.
 * Real counts only, already computed by `Overview`'s own caller — no new
 * fact, no new store.
 *
 * ── CONNECTED SEGMENT RULE ─────────────────────────────────────────────
 * A run of ADJACENT active stages renders as ONE continuous green
 * container, never as N green boxes standing in a row. The run's wrapper
 * owns the background, the border and the radius; the stages inside it own
 * none of the three and carry no margin, so the band reads as one
 * uninterrupted shape with the connectors running through it rather than
 * as a fence of repeated chips.
 *
 * An inactive stage is not green, so it ENDS the run and stands on its own
 * box — the green never paints behind a stage that has no records, and no
 * empty cell is manufactured to keep the row even.
 *
 * This applies here and not to the two sibling flows on purpose: their
 * cards are coloured per PROVENANCE / epistemic weight, where visually
 * separating one card from the next is the whole point. Community's stages
 * are uniformly green when active, which is what makes them a sequence.
 */
import { Fragment } from "react";
import { COLOR, RADIUS, STATUS, TYPE } from "@/app/lib/philos/shell/designTokens";

type ConnectorKind = "arrow" | "merge";

/** Connector `i` joins stage `i` to stage `i + 1`. NEEDS ↔ RESOURCES is the
 *  one bidirectional link in the chain; every other link is directional. */
const CONNECTORS: ConnectorKind[] = ["arrow", "arrow", "merge", "arrow", "arrow"];

export default function CommunityFlow({
  valueCount, groupCount, needCount, resourceCount, actionCount, impactCount,
}: {
  valueCount: number; groupCount: number; needCount: number;
  resourceCount: number; actionCount: number; impactCount: number;
}) {
  const nodes = [
    { key: "values", label: "VALUES", count: valueCount, href: "?mode=values" },
    { key: "groups", label: "GROUPS", count: groupCount, href: "?mode=groups" },
    { key: "needs", label: "NEEDS", count: needCount, href: "?mode=needs" },
    { key: "resources", label: "RESOURCES", count: resourceCount, href: "?mode=resources" },
    { key: "actions", label: "ACTIONS", count: actionCount, href: "?mode=activity" },
    { key: "impact", label: "VERIFIED IMPACT", count: impactCount, href: "?mode=impact" },
  ];

  // Runs of adjacent active stages. An inactive stage never joins a run, so
  // it always opens a segment of its own.
  const segments: { active: boolean; items: number[] }[] = [];
  nodes.forEach((n, i) => {
    const active = n.count > 0;
    const last = segments[segments.length - 1];
    if (active && last?.active) last.items.push(i);
    else segments.push({ active, items: [i] });
  });

  return (
    <div dir="ltr" style={{ overflowX: "auto", padding: "8px 20px 16px" }}>
      <div style={{ display: "flex", alignItems: "stretch", gap: 0, minWidth: "fit-content" }}>
        {segments.map((seg, si) => {
          const prev = segments[si - 1];
          return (
            <Fragment key={nodes[seg.items[0]].key}>
              {/* The connector BETWEEN two segments stays outside both, so no
                  green is painted across the break. Two active segments can
                  never be adjacent (they would have merged), so this link
                  lights only for the stage it points into. */}
              {prev ? (
                <Connector
                  kind={CONNECTORS[prev.items[prev.items.length - 1]]}
                  active={seg.active}
                />
              ) : null}

              {seg.active ? (
                <div style={S.group}>
                  {seg.items.map((idx, k) => {
                    /* `key` is React's, not FlowNode's. Spreading the whole
                       node object passed it through as a prop, which React
                       warns about because a spread key is invisible to the
                       reconciler. Extract it, spread the rest. */
                    const { key, ...nodeProps } = nodes[idx];
                    return (
                      <Fragment key={key}>
                        {/* Inside a run both sides are active by construction. */}
                        {k > 0 ? <Connector kind={CONNECTORS[idx - 1]} active /> : null}
                        <FlowNode {...nodeProps} connected />
                      </Fragment>
                    );
                  })}
                </div>
              ) : (
                <FlowNode {...stripKey(nodes[seg.items[0]])} />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

/** Drop React's `key` before spreading — it is the reconciler's, not a prop. */
function stripKey<T extends { key: string }>(node: T): Omit<T, "key"> {
  const rest: Partial<T> = { ...node };
  delete rest.key;
  return rest as Omit<T, "key">;
}

/**
 * One stage. `connected` = this stage sits inside a green run, so the run's
 * wrapper draws the surface and the stage draws none of it: no background,
 * no border (nothing between connected siblings), no radius of its own, no
 * margin. Standalone stages keep the full box treatment.
 */
function FlowNode({
  label, count, href, connected = false,
}: { label: string; count: number; href: string; connected?: boolean }) {
  const active = count > 0;
  const s = active ? STATUS.real : STATUS.unknown;
  return (
    <a
      href={href}
      style={{
        width: 122, minHeight: 70, boxSizing: "border-box", flexShrink: 0,
        textDecoration: "none", margin: 0,
        padding: "8px 10px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 3,
        ...(connected
          ? { background: "transparent", border: 0, borderRadius: 0 }
          : {
              background: active ? s.bg : "rgba(90,111,150,0.05)",
              border: `1px solid ${active ? s.border : COLOR.border}`,
              borderRadius: RADIUS.md,
            }),
      }}
    >
      <div style={{ ...TYPE.micro, color: active ? s.text : COLOR.textFaint }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color: COLOR.text }}>{count}</div>
    </a>
  );
}

function Connector({ kind, active }: { kind: ConnectorKind; active: boolean }) {
  const merge = kind === "merge";
  return (
    <div style={{ width: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {/* ↔ stays neutral by design: it marks a bidirectional relation, not a
          direction of travel, and never signals activity. */}
      <span style={{ fontSize: 15, color: !merge && active ? STATUS.real.text : COLOR.textFaint }}>
        {merge ? "↔" : "→"}
      </span>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  /** The run wrapper — the ONLY owner of the green surface and its shape.
   *  `overflow: hidden` means the outer radius clips the children, so no
   *  child ever needs a corner radius of its own. */
  group: {
    display: "flex", alignItems: "stretch", gap: 0,
    flexShrink: 0, minWidth: "fit-content",
    background: STATUS.real.bg,
    border: `1px solid ${STATUS.real.border}`,
    borderRadius: RADIUS.md,
    overflow: "hidden",
  },
};
