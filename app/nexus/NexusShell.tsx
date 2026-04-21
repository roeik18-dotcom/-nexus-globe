"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import useGraphData from "../graph/useGraphData";
import type { GraphNode, GraphLink } from "../graph/types";

const GlobeView = dynamic(() => import("../globe/GlobeView"), { ssr:false });

const ROLE_COLOR: Record<string,string> = {
  Designer:"#00f5d4", Engineer:"#38bdf8", Analyst:"#a78bfa",
  Researcher:"#f472b6", Director:"#fb923c", default:"#00f5d4"
};

const ROLE_ICON: Record<string,string> = {
  Designer:"✦", Engineer:"⬡", Analyst:"◈", Researcher:"◉", Director:"★"
};

export default function NexusShell() {
  const data       = useGraphData();
  const [selected, setSelected] = useState<string|null>(null);
  const [tipIdx,   setTipIdx]   = useState(0);

  const nodeById: Record<string,GraphNode> = {};
  data.nodes.forEach(n => { nodeById[n.id]=n; });

  const selectedNode = selected ? nodeById[selected] : null;
  const connectedLinks = selected
    ? data.links.filter(l => l.source===selected||l.target===selected)
    : [];
  const connectedNodes = connectedLinks.map(l =>
    nodeById[l.source===selected ? l.target : l.source]
  ).filter(Boolean) as GraphNode[];

  // Network stats
  const totalLinks  = data.links.length;
  const roles       = [...new Set(data.nodes.map(n=>n.role))];
  const maxValue    = Math.max(...data.nodes.map(n=>n.value), 1);
  const topNode     = data.nodes.reduce((a,b)=>a.value>b.value?a:b, data.nodes[0]);

  // Guide tips
  const tips = selectedNode ? [
    `${selectedNode.name} — ${selectedNode.role}`,
    `${connectedNodes.length} קשרים ישירים ברשת`,
    `ערך השפעה: ${selectedNode.value} / ${maxValue}`,
    connectedNodes.length > 0 ? `מחובר/ת ל: ${connectedNodes.map(n=>n.name.split(" ")[0]).join(", ")}` : "אין קשרים ידועים",
  ] : [
    `${data.nodes.length} אנשים ברשת`,
    `${totalLinks} קשרים פעילים`,
    `${roles.length} תפקידים שונים`,
    `המשפיע/ה ביותר: ${topNode?.name ?? "—"}`,
  ];

  useEffect(() => {
    const t = setInterval(()=>setTipIdx(i=>(i+1)%tips.length), 3500);
    return ()=>clearInterval(t);
  }, [selected, tips.length]);

  const S: Record<string,React.CSSProperties> = {
    root:{ width:"100vw", height:"100vh", background:"#020d1a", display:"flex", flexDirection:"column", overflow:"hidden", fontFamily:"'Inter',system-ui,sans-serif" },
    header:{ height:44, flexShrink:0, display:"flex", alignItems:"center", padding:"0 20px", borderBottom:"1px solid #0a2a4a", background:"#020d1a", zIndex:20 },
    main:{ flex:1, display:"flex", overflow:"hidden" },
    globe:{ flex:1, position:"relative" as const, overflow:"hidden" },
    leftPanel:{ width:220, background:"#030f1e", borderRight:"1px solid #0a2a4a", display:"flex", flexDirection:"column", overflow:"hidden" },
    rightPanel:{ width:240, background:"#030f1e", borderLeft:"1px solid #0a2a4a", display:"flex", flexDirection:"column", overflow:"hidden" },
    sectionLabel:{ padding:"10px 14px 4px", fontSize:9, letterSpacing:2.5, color:"#1e4060", textTransform:"uppercase" as const },
    card:{ margin:"4px 8px", padding:"8px 10px", borderRadius:6, border:"1px solid #0a2a4a", background:"#040e1c" },
    nodeRow:{ display:"flex", alignItems:"center", gap:8, padding:"6px 8px", margin:"1px 6px", borderRadius:5, cursor:"pointer", transition:"all .15s" },
    dot:{ width:7, height:7, borderRadius:"50%", flexShrink:0 as const },
    bar:{ height:4, borderRadius:2, background:"#0a2a4a", overflow:"hidden" as const, flex:1 },
  };

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.header}>
        <span style={{ fontSize:13, fontWeight:700, letterSpacing:4, color:"#38bdf8" }}>NEXUS</span>
        <span style={{ fontSize:10, color:"#1e4060", marginLeft:12 }}>
          {data.nodes.length} nodes · {totalLinks} links
        </span>
        {selected && (
          <button onClick={()=>setSelected(null)}
            style={{ marginLeft:"auto", background:"none", border:"1px solid #1e4060", color:"#38bdf8", padding:"2px 10px", borderRadius:3, cursor:"pointer", fontSize:10 }}>
            ✕ clear
          </button>
        )}
      </div>

      <div style={S.main}>
        {/* ── Left panel: network stats ── */}
        <div style={S.leftPanel}>
          <div style={S.sectionLabel}>Network</div>

          {/* Stats cards */}
          <div style={{ ...S.card, display:"flex", justifyContent:"space-between" }}>
            <Stat label="Nodes"  val={String(data.nodes.length)} />
            <Stat label="Links"  val={String(totalLinks)} />
            <Stat label="Roles"  val={String(roles.length)} />
          </div>

          {/* Role breakdown */}
          <div style={S.sectionLabel}>Roles</div>
          {roles.map(r => {
            const count = data.nodes.filter(n=>n.role===r).length;
            return (
              <div key={r} style={{ ...S.card, display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ color: ROLE_COLOR[r]??ROLE_COLOR.default, fontSize:12 }}>
                  {ROLE_ICON[r] ?? "•"}
                </span>
                <span style={{ fontSize:10, color:"#8bb8cc", flex:1 }}>{r}</span>
                <span style={{ fontSize:10, color:"#38bdf8" }}>{count}</span>
              </div>
            );
          })}

          {/* Influence ranking */}
          <div style={S.sectionLabel}>Influence</div>
          <div style={{ overflowY:"auto", flex:1 }}>
            {[...data.nodes].sort((a,b)=>b.value-a.value).map(n=>(
              <div key={n.id} style={{ ...S.nodeRow,
                background: selected===n.id ? "#0a2a4a" : "transparent",
              }} onClick={()=>setSelected(selected===n.id?null:n.id)}>
                <div style={{ ...S.dot, background: ROLE_COLOR[n.role]??ROLE_COLOR.default }} />
                <span style={{ fontSize:10, color:"#8bb8cc", flex:1 }}>{n.name.split(" ")[0]}</span>
                <div style={{ ...S.bar, width:50 }}>
                  <div style={{ height:"100%", width:`${(n.value/maxValue)*100}%`, background: ROLE_COLOR[n.role]??ROLE_COLOR.default }} />
                </div>
                <span style={{ fontSize:9, color:"#38bdf8", width:24, textAlign:"right" as const }}>{n.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Globe ── */}
        <div style={S.globe}>
          <GlobeView data={data} />
          {/* Hover hint */}
          {!selected && (
            <div style={{ position:"absolute", bottom:20, left:"50%", transform:"translateX(-50%)", fontSize:10, color:"#1e4060", pointerEvents:"none" }}>
              לחץ על נקודה לבחירה
            </div>
          )}
        </div>

        {/* ── Right panel: node detail + guide ── */}
        <div style={S.rightPanel}>
          {/* Guide block */}
          <div style={{ padding:"12px 12px 8px", borderBottom:"1px solid #0a2a4a" }}>
            <div style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
              <div style={{ width:28, height:28, borderRadius:6, background:"linear-gradient(135deg,#0ea5e9,#00f5d4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>
                ◈
              </div>
              <div style={{ background:"#040e1c", borderRadius:"0 6px 6px 6px", padding:"7px 9px", fontSize:10, color:"#8bb8cc", lineHeight:1.55, border:"1px solid #0a2a4a", minHeight:38 }}>
                {tips[tipIdx % tips.length]}
              </div>
            </div>
          </div>

          {/* Node detail */}
          {selectedNode ? (
            <>
              <div style={S.sectionLabel}>Selected</div>
              <div style={{ ...S.card, borderColor: ROLE_COLOR[selectedNode.role]+"44" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                  <div style={{ width:10, height:10, borderRadius:"50%", background: ROLE_COLOR[selectedNode.role]??ROLE_COLOR.default }} />
                  <span style={{ fontSize:13, color:"#e0f2fe", fontWeight:600 }}>{selectedNode.name}</span>
                </div>
                <div style={{ fontSize:10, color:"#38bdf8", marginBottom:2 }}>{selectedNode.role}</div>
                <div style={{ fontSize:9, color:"#1e4060" }}>
                  {selectedNode.lat.toFixed(2)}°, {selectedNode.lng.toFixed(2)}°
                </div>
                <div style={{ marginTop:8, display:"flex", justifyContent:"space-between" }}>
                  <div style={{ textAlign:"center" as const }}>
                    <div style={{ fontSize:14, color:"#00f5d4", fontWeight:700 }}>{selectedNode.value}</div>
                    <div style={{ fontSize:8, color:"#1e4060" }}>influence</div>
                  </div>
                  <div style={{ textAlign:"center" as const }}>
                    <div style={{ fontSize:14, color:"#38bdf8", fontWeight:700 }}>{connectedNodes.length}</div>
                    <div style={{ fontSize:8, color:"#1e4060" }}>links</div>
                  </div>
                  <div style={{ textAlign:"center" as const }}>
                    <div style={{ fontSize:14, color:"#a78bfa", fontWeight:700 }}>
                      {((selectedNode.value/maxValue)*100).toFixed(0)}%
                    </div>
                    <div style={{ fontSize:8, color:"#1e4060" }}>rank</div>
                  </div>
                </div>
              </div>

              <div style={S.sectionLabel}>Connections</div>
              <div style={{ overflowY:"auto", flex:1 }}>
                {connectedNodes.map(n=>(
                  <div key={n.id} style={{ ...S.nodeRow }}
                    onClick={()=>setSelected(n.id)}>
                    <div style={{ ...S.dot, background: ROLE_COLOR[n.role]??ROLE_COLOR.default }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, color:"#caf0f8" }}>{n.name}</div>
                      <div style={{ fontSize:9, color:"#1e4060" }}>{n.role}</div>
                    </div>
                    <span style={{ fontSize:9, color:"#38bdf8" }}>→</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={S.sectionLabel}>All Nodes</div>
              <div style={{ overflowY:"auto", flex:1 }}>
                {data.nodes.map(n=>(
                  <div key={n.id} style={{ ...S.nodeRow }}
                    onClick={()=>setSelected(n.id)}>
                    <div style={{ ...S.dot, background: ROLE_COLOR[n.role]??ROLE_COLOR.default }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, color:"#caf0f8" }}>{n.name}</div>
                      <div style={{ fontSize:9, color:"#1e4060" }}>{n.role}</div>
                    </div>
                    <div style={{ fontSize:10, color:"#38bdf8" }}>{n.value}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Bottom: active links */}
          <div style={{ borderTop:"1px solid #0a2a4a", padding:"8px 10px" }}>
            <div style={{ fontSize:9, color:"#1e4060", letterSpacing:2, textTransform:"uppercase" as const, marginBottom:6 }}>Active Links</div>
            {(selected ? connectedLinks : data.links.slice(0,5)).map((l,i)=>{
              const src = nodeById[l.source];
              const tgt = nodeById[l.target];
              if (!src||!tgt) return null;
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:4, marginBottom:3 }}>
                  <span style={{ fontSize:9, color: ROLE_COLOR[src.role]??ROLE_COLOR.default }}>{src.name.split(" ")[0]}</span>
                  <span style={{ fontSize:9, color:"#1e4060" }}>──</span>
                  <span style={{ fontSize:9, color: ROLE_COLOR[tgt.role]??ROLE_COLOR.default }}>{tgt.name.split(" ")[0]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, val }: { label:string; val:string }) {
  return (
    <div style={{ textAlign:"center" as const }}>
      <div style={{ fontSize:16, color:"#38bdf8", fontWeight:700 }}>{val}</div>
      <div style={{ fontSize:8, color:"#1e4060", letterSpacing:1 }}>{label.toUpperCase()}</div>
    </div>
  );
}
