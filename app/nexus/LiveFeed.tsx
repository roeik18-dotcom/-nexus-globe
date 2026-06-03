"use client";

import { useEffect, useMemo, useState } from "react";
import {
  loadNodes, saveNode, buildLinks,
  FORCE_COLOR, FORCE_LABEL, CONTEXT_LABEL,
  type UserNode, type NodeContext,
} from "../lib/philos";
import { loadProfile } from "../lib/profile";
import {
  loadProofs, computeReputation, OPPORTUNITY_DEFS,
  REPUTATION_LEVEL_LABEL, REPUTATION_LEVEL_COLOR,
  type ProofItem,
} from "../lib/proof";
import { deriveNeeds, NEED_LABEL } from "../lib/need";
import { generateSeedNodes } from "../lib/seed";

const DAY_MS = 86_400_000;

// ─── Helpers ─────────────────────────────────────────────────────────

function nodeProofTrust(userId: string, allProofs: ProofItem[]): number {
  const up = allProofs.filter(p => p.userId === userId);
  if (!up.length) return 0;
  return Math.min(up.reduce((s, p) => s + p.weight, 0), 100);
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000)    return "עכשיו";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}ד'`;
  if (diff < DAY_MS)    return `${Math.floor(diff / 3_600_000)}ש'`;
  return `${Math.floor(diff / DAY_MS)}י'`;
}

const DIR_ARROW: Record<string, string> = { forward: "↑", stuck: "→", backward: "↓" };
const DIR_COL:   Record<string, string> = { forward: "#34d399", stuck: "#fbbf24", backward: "#f87171" };

// ─── Component ───────────────────────────────────────────────────────

export default function LiveFeed() {
  const [nodes,   setNodes]   = useState<UserNode[]>([]);
  const [proofs,  setProofs]  = useState<ProofItem[]>([]);
  const [profile, setProfile] = useState<ReturnType<typeof loadProfile>>(null);
  const [isDemo,  setIsDemo]  = useState(false);

  const load = () => {
    const real = loadNodes();
    if (real.length > 0) { setNodes(real); setIsDemo(false); }
    else                  { setNodes(generateSeedNodes()); setIsDemo(true); }
    setProofs(loadProofs());
    setProfile(loadProfile());
  };
  const seedAndLoad = () => { generateSeedNodes().forEach(n => saveNode(n)); load(); };

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  // ── Derived data ──────────────────────────────────────────────────

  const allLinks = useMemo(() => buildLinks(nodes), [nodes]);

  const enrichedNodes = useMemo(() =>
    nodes.map(n => {
      const pt        = nodeProofTrust(n.name, proofs) || n.trustScore;
      const nodeProofs= proofs.filter(p => p.userId === n.name);
      const verified  = nodeProofs.filter(p => p.status === "verified");
      const conns     = allLinks.filter(l => l.source === n.id || l.target === n.id).length;
      const rep       = computeReputation(verified, []);
      return { n, pt, verified, conns, rep };
    }),
    [nodes, proofs, allLinks]
  );

  // 0. PULSE
  const pulse = useMemo(() => {
    if (!nodes.length) return null;
    const energy   = Math.round(nodes.reduce((s, n) => s + n.intensity, 0) / nodes.length * 10);
    const trust    = Math.round(enrichedNodes.reduce((s, e) => s + e.pt, 0) / nodes.length);
    const stressed = nodes.filter(n => n.conflict || n.direction === "backward").length;
    const stress   = Math.round((stressed / nodes.length) * 100);
    const active   = nodes.filter(n => Date.now() - n.createdAt < DAY_MS).length;
    const activity = active > 0 ? Math.round((active / nodes.length) * 100) : 12; // demo fallback

    const forceDist: Record<string, number> = {};
    nodes.forEach(n => { forceDist[n.dominantForce] = (forceDist[n.dominantForce] || 0) + 1; });
    const sorted = Object.entries(forceDist).sort((a, b) => b[1] - a[1]);
    const dominant = sorted[0]?.[0] ?? "social";

    return { energy, trust, stress, activity, dominant, forceDist, total: nodes.length };
  }, [nodes, enrichedNodes]);

  // 1. Leaders (top 5 by trust)
  const leaders = useMemo(() =>
    [...enrichedNodes].sort((a, b) => b.pt - a.pt).slice(0, 5),
    [enrichedNodes]
  );

  // 2. New Proofs (last 24h)
  const newProofs = useMemo(() =>
    [...proofs].filter(p => Date.now() - p.createdAt < DAY_MS)
      .sort((a, b) => b.createdAt - a.createdAt).slice(0, 4),
    [proofs]
  );

  // 3. Trust gains
  const trustGains = useMemo(() =>
    enrichedNodes
      .filter(e => e.pt > e.n.trustScore)
      .sort((a, b) => (b.pt - b.n.trustScore) - (a.pt - a.n.trustScore))
      .slice(0, 3),
    [enrichedNodes]
  );

  // 4. Opportunities
  const opportunities = useMemo(() => {
    const out: Array<{ n: UserNode; oppName: string; threshold: number; trust: number; rep: any; unlocked: boolean }> = [];
    enrichedNodes.forEach(({ n, pt, rep }) => {
      OPPORTUNITY_DEFS.forEach(o => {
        const unlocked = pt >= o.threshold;
        const near     = !unlocked && o.threshold - pt <= 15;
        if (unlocked || near) out.push({ n, oppName: o.name, threshold: o.threshold, trust: pt, rep, unlocked });
      });
    });
    return out.sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || b.trust - a.trust).slice(0, 5);
  }, [enrichedNodes]);

  // 5. Value by Domain
  const byDomain = useMemo(() => {
    const acc: Record<string, { count: number; totalI: number; fwd: number; stuck: number; back: number }> = {};
    nodes.forEach(n => {
      if (!acc[n.context]) acc[n.context] = { count: 0, totalI: 0, fwd: 0, stuck: 0, back: 0 };
      acc[n.context].count++;
      acc[n.context].totalI += n.intensity;
      if (n.direction === "forward")  acc[n.context].fwd++;
      if (n.direction === "stuck")    acc[n.context].stuck++;
      if (n.direction === "backward") acc[n.context].back++;
    });
    return Object.entries(acc)
      .map(([ctx, v]) => ({
        ctx: ctx as NodeContext,
        count: v.count,
        avg: v.totalI / v.count,
        fwdPct: Math.round((v.fwd / v.count) * 100),
        trend: v.fwd > v.back ? "↑" : v.back > v.fwd ? "↓" : "→",
        trendColor: v.fwd > v.back ? "#34d399" : v.back > v.fwd ? "#f87171" : "#fbbf24",
      }))
      .sort((a, b) => b.count - a.count);
  }, [nodes]);

  // 6. For You
  const forYou = useMemo(() => {
    if (!profile) return [];
    const me = nodes.find(n => n.name === profile.name);
    if (!me) return [];
    const myNeeds = deriveNeeds(me).needs;
    if (!myNeeds.length) return [];
    return enrichedNodes
      .filter(e => e.n.name !== profile.name)
      .map(e => ({ ...e, match: myNeeds.filter(need => deriveNeeds(e.n).offers.includes(need)) }))
      .filter(e => e.match.length > 0)
      .sort((a, b) => b.match.length - a.match.length)
      .slice(0, 3);
  }, [nodes, enrichedNodes, profile]);

  // ── Styles ────────────────────────────────────────────────────────

  const sHead: React.CSSProperties = { fontSize: 9, letterSpacing: 2, color: "#1e4060", textTransform: "uppercase", marginBottom: 7 };
  const sItem: React.CSSProperties = { padding: "7px 0", borderBottom: "1px solid #0a2a4a" };
  const PTAG  = (color: string): React.CSSProperties => ({ fontSize: 9, padding: "1px 6px", borderRadius: 3, fontWeight: 600, background: color + "22", color });

  return (
    <div style={{ overflowY: "auto", height: "100%", padding: "10px 14px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isDemo ? 5 : 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 3, color: "#38bdf8", fontWeight: 700 }}>LIVE FEED</div>
        <div style={{ fontSize: 9, color: "#1e4060" }}>30ש' ↺</div>
      </div>

      {/* Demo banner */}
      {isDemo && (
        <div style={{ padding: "7px 10px", borderRadius: 5, border: "1px solid #fbbf2444", background: "#fbbf2406", marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: "#fbbf24", marginBottom: 4 }}>⚠ מצב הדגמה — אין נתונים אמיתיים עדיין</div>
          <button onClick={seedAndLoad} style={{ fontSize: 9, padding: "3px 10px", borderRadius: 4, border: "1px solid #fbbf2466", background: "transparent", color: "#fbbf24", cursor: "pointer" }}>
            ← טען 10 משתמשי demo לגלובוס
          </button>
        </div>
      )}

      {/* ── 0. PULSE ── */}
      {pulse && (
        <div style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #0ea5e933", background: "#0ea5e908", marginBottom: 14 }}>
          <div style={{ fontSize: 9, letterSpacing: 2.5, color: "#38bdf8", textTransform: "uppercase", marginBottom: 9 }}>⚡ Pulse</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 10 }}>
            {[
              { label: "אנרגיה", val: pulse.energy, color: "#fbbf24" },
              { label: "אמון",   val: pulse.trust,  color: "#34d399" },
              { label: "מתח",    val: pulse.stress,  color: "#f87171" },
              { label: "פעילות", val: pulse.activity,color: "#38bdf8" },
            ].map(m => (
              <div key={m.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: m.color }}>{m.val}</div>
                <div style={{ fontSize: 8, color: "#1e4060" }}>{m.label}</div>
              </div>
            ))}
          </div>
          {/* Force distribution */}
          <div style={{ fontSize: 8, color: "#1e4060", marginBottom: 5 }}>
            כוח דומיננטי: <b style={{ color: FORCE_COLOR[pulse.dominant as keyof typeof FORCE_COLOR] ?? "#38bdf8" }}>
              {FORCE_LABEL[pulse.dominant as keyof typeof FORCE_LABEL] ?? pulse.dominant}
            </b>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {Object.entries(pulse.forceDist)
              .sort((a, b) => b[1] - a[1])
              .map(([f, c]) => {
                const pct = Math.round((c / pulse.total) * 100);
                const col = FORCE_COLOR[f as keyof typeof FORCE_COLOR] ?? "#38bdf8";
                return (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ fontSize: 9, color: col, width: 50, textAlign: "right", flexShrink: 0 }}>
                      {FORCE_LABEL[f as keyof typeof FORCE_LABEL] ?? f}
                    </div>
                    <div style={{ flex: 1, height: 4, borderRadius: 2, background: "#0a2a4a", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: col, borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: 9, color: col, width: 24, flexShrink: 0 }}>{pct}%</div>
                  </div>
                );
              })
            }
          </div>
        </div>
      )}

      {/* ── 1. Leaders ── */}
      <div style={{ marginBottom: 14 }}>
        <div style={sHead}>🏆 מובילים היום</div>
        {leaders.map(({ n, pt, verified, conns }) => (
          <div key={n.id} style={sItem}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: FORCE_COLOR[n.dominantForce], flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 11, color: "#caf0f8", fontWeight: 600 }}>{n.name}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: pt > 60 ? "#34d399" : pt > 20 ? "#fbbf24" : "#8bb8cc" }}>{pt}</div>
            </div>
            <div style={{ display: "flex", gap: 8, fontSize: 9, color: "#8bb8cc", paddingRight: 12 }}>
              {verified.length > 0 && <span style={{ color: "#34d399" }}>✓ {verified.length} מאומת</span>}
              {conns > 0 && <span>⟶ {conns} קשרים</span>}
              <span style={{ color: DIR_COL[n.direction] }}>{DIR_ARROW[n.direction]} {n.direction === "forward" ? "קדימה" : n.direction === "stuck" ? "תקוע" : "אחורה"}</span>
              <span style={{ color: FORCE_COLOR[n.dominantForce] }}>{FORCE_LABEL[n.dominantForce]}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── 2. New Proofs ── */}
      <div style={{ marginBottom: 14 }}>
        <div style={sHead}>✓ הוכחות חדשות</div>
        {newProofs.length === 0
          ? <div style={{ fontSize: 10, color: "#1e4060" }}>לא הוגשו הוכחות ב-24 שעות האחרונות</div>
          : newProofs.map(p => {
            const col = p.status === "verified" ? "#34d399" : p.status === "claimed" ? "#fbbf24" : "#f87171";
            return (
              <div key={p.id} style={{ ...sItem, display: "flex", alignItems: "flex-start", gap: 7 }}>
                <span style={PTAG(col)}>{p.status === "verified" ? "מאומת" : "טענה"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: "#caf0f8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.claim}</div>
                  <div style={{ fontSize: 9, color: "#1e4060" }}>{p.userId} · +{p.weight}</div>
                </div>
                <div style={{ fontSize: 9, color: "#1e4060", flexShrink: 0 }}>{timeAgo(p.createdAt)}</div>
              </div>
            );
          })
        }
      </div>

      {/* ── 3. Trust Gains ── */}
      {trustGains.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={sHead}>⬡ אמון חדש</div>
          {trustGains.map(({ n, pt }) => (
            <div key={n.id} style={{ ...sItem, display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: FORCE_COLOR[n.dominantForce], flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 11, color: "#caf0f8" }}>{n.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                <span style={{ color: "#8bb8cc" }}>{n.trustScore}</span>
                <span style={{ color: "#1e4060" }}>→</span>
                <span style={{ color: "#34d399", fontWeight: 700 }}>{pt}</span>
                <span style={{ fontSize: 9, color: "#34d399" }}>+{pt - n.trustScore}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 4. Opportunities ── */}
      <div style={{ marginBottom: 14 }}>
        <div style={sHead}>★ הזדמנויות</div>
        {opportunities.length === 0
          ? <div style={{ fontSize: 10, color: "#1e4060" }}>—</div>
          : opportunities.map((o, i) => (
            <div key={i} style={{ ...sItem, padding: "8px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={PTAG(o.unlocked ? "#34d399" : "#fbbf24")}>{o.unlocked ? "פתוח" : "קרוב"}</span>
                <div style={{ flex: 1, fontSize: 11, color: "#caf0f8", fontWeight: 600 }}>{o.oppName}</div>
              </div>
              <div style={{ display: "flex", gap: 10, fontSize: 9, color: "#8bb8cc", paddingRight: 4 }}>
                <span>Trust: <b style={{ color: o.trust > 60 ? "#34d399" : "#fbbf24" }}>{o.trust}</b></span>
                <span>Rep: <b style={{ color: REPUTATION_LEVEL_COLOR[o.rep.level as keyof typeof REPUTATION_LEVEL_COLOR] }}>{REPUTATION_LEVEL_LABEL[o.rep.level as keyof typeof REPUTATION_LEVEL_LABEL]}</b></span>
                <span style={{ color: FORCE_COLOR[o.n.dominantForce] }}>{FORCE_LABEL[o.n.dominantForce]}</span>
                {!o.unlocked && <span style={{ color: "#1e4060" }}>עוד {o.threshold - o.trust}</span>}
              </div>
              <div style={{ fontSize: 9, color: "#1e4060", paddingRight: 4, marginTop: 2 }}>{o.n.name}</div>
            </div>
          ))
        }
      </div>

      {/* ── 5. Value by Domain ── */}
      <div style={{ marginBottom: 14 }}>
        <div style={sHead}>◈ ערך לפי תחום</div>
        {byDomain.map(d => (
          <div key={d.ctx} style={{ ...sItem, padding: "6px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, color: d.trendColor, fontWeight: 700 }}>{d.trend}</span>
                <span style={{ fontSize: 11, color: "#caf0f8" }}>{CONTEXT_LABEL[d.ctx]}</span>
              </div>
              <span style={{ fontSize: 9, color: "#8bb8cc" }}>{d.count} nodes · avg {d.avg.toFixed(1)}</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: "#0a2a4a", overflow: "hidden" }}>
              <div style={{ width: `${d.fwdPct}%`, height: "100%", background: d.trendColor, borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 8, color: "#1e4060", marginTop: 2 }}>{d.fwdPct}% קדימה</div>
          </div>
        ))}
      </div>

      {/* ── 6. For You ── */}
      <div style={{ marginBottom: 14 }}>
        <div style={sHead}>◉ בשבילך</div>
        {!profile
          ? <div style={{ fontSize: 10, color: "#1e4060" }}><a href="/profile" style={{ color: "#fbbf24" }}>צור פרופיל</a> לקבל המלצות</div>
          : forYou.length === 0
            ? <div style={{ fontSize: 10, color: "#1e4060" }}>הוסף נקודות לגלובוס</div>
            : forYou.map(e => (
              <div key={e.n.id} style={{ ...sItem, display: "flex", alignItems: "flex-start", gap: 7 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: FORCE_COLOR[e.n.dominantForce], flexShrink: 0, marginTop: 4 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "#caf0f8", marginBottom: 3 }}>{e.n.name}</div>
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                    {e.match.map(need => (
                      <span key={need} style={{ fontSize: 8, padding: "1px 5px", borderRadius: 8, background: "#34d39922", color: "#34d399" }}>
                        {NEED_LABEL[need]}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: 8, color: "#34d399" }}>מציע {e.match.length}</div>
              </div>
            ))
        }
      </div>

    </div>
  );
}
