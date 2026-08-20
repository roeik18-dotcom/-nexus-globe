/**
 * CommunityFlow — Community's primary visual (BATCH 3, Product Experience
 * Rebuild). A real connected node chain — VALUES → GROUPS → NEEDS ↔
 * RESOURCES → ACTIONS → IMPACT — same visual grammar as Dynamics'
 * `CausalChainFlow.tsx` and Marketplace's `MarketplaceFlow.tsx` (same
 * node/arrow shapes, same `designTokens.ts` source), so a viewer who has
 * seen either of those recognizes this immediately as the same product.
 * Real counts only, already computed by `Overview`'s own caller — no new
 * fact, no new store.
 */
import { COLOR, RADIUS, STATUS, TYPE } from "@/app/lib/philos/shell/designTokens";

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

  return (
    <div dir="ltr" style={{ overflowX: "auto", padding: "8px 20px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 0, minWidth: "fit-content" }}>
        <FlowNode {...nodes[0]} />
        <Arrow active={nodes[1].count > 0} />
        <FlowNode {...nodes[1]} />
        <Arrow active={nodes[2].count > 0 || nodes[3].count > 0} />
        <FlowNode {...nodes[2]} />
        <Merge />
        <FlowNode {...nodes[3]} />
        <Arrow active={nodes[4].count > 0} />
        <FlowNode {...nodes[4]} />
        <Arrow active={nodes[5].count > 0} />
        <FlowNode {...nodes[5]} />
      </div>
    </div>
  );
}

function FlowNode({ label, count, href }: { label: string; count: number; href: string }) {
  const active = count > 0;
  const s = active ? STATUS.real : STATUS.unknown;
  return (
    <a
      href={href}
      style={{
        width: 122, minHeight: 70, borderRadius: RADIUS.md, textDecoration: "none",
        background: active ? s.bg : "rgba(90,111,150,0.05)", border: `1px solid ${active ? s.border : COLOR.border}`,
        padding: "8px 10px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 3,
      }}
    >
      <div style={{ ...TYPE.micro, color: active ? s.text : COLOR.textFaint }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color: COLOR.text }}>{count}</div>
    </a>
  );
}

function Arrow({ active }: { active: boolean }) {
  return (
    <div style={{ width: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span style={{ fontSize: 15, color: active ? STATUS.real.text : COLOR.textFaint }}>→</span>
    </div>
  );
}

function Merge() {
  return (
    <div style={{ width: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span style={{ fontSize: 15, color: COLOR.textFaint }}>↔</span>
    </div>
  );
}
