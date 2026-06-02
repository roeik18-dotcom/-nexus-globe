"use client";

import { useEffect, useMemo, useState } from "react";
import { loadNodes, saveNode, FORCE_COLOR, FORCE_LABEL, CONTEXT_LABEL, type UserNode, type NodeContext } from "../lib/philos";
import { loadProfile } from "../lib/profile";
import {
  loadProofs, OPPORTUNITY_DEFS,
  type ProofItem,
} from "../lib/proof";
import { deriveNeeds, NEED_LABEL } from "../lib/need";
import { generateSeedNodes } from "../lib/seed";

const DAY_MS = 86_400_000;

// ─── Helpers ─────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000)    return "עכשיו";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}ד'`;
  if (diff < DAY_MS)    return `${Math.floor(diff / 3_600_000)}ש'`;
  return `${Math.floor(diff / DAY_MS)}י'`;
}

function proofTrust(userId: string, allProofs: ProofItem[]): number {
  const up = allProofs.filter(p => p.userId === userId);
  if (!up.length) return 0;
  return Math.min(up.reduce((s, p) => s + p.weight, 0), 100);
}

// ─── Component ───────────────────────────────────────────────────────

export default function LiveFeed() {
  const [nodes,    setNodes]    = useState<UserNode[]>([]);
  const [proofs,   setProofs]   = useState<ProofItem[]>([]);
  const [profile,  setProfile]  = useState<ReturnType<typeof loadProfile>>(null);
  const [isDemo,   setIsDemo]   = useState(false);

  const load = () => {
    const real = loadNodes();
    if (real.length > 0) {
      setNodes(real);
      setIsDemo(false);
    } else {
      setNodes(generateSeedNodes());
      setIsDemo(true);
    }
    setProofs(loadProofs());
    setProfile(loadProfile());
  };

  const seedAndLoad = () => {
    const seeds = generateSeedNodes();
    seeds.forEach(n => saveNode(n));
    load();
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  // ── Section data ──────────────────────────────────────────────────

  // 1. Leaders Today — sorted by effective trust (proof-based > original)
  const leaders = useMemo(() =>
    [...nodes]
      .map(n => ({ n, trust: proofTrust(n.name, proofs) || n.trustScore }))
      .sort((a, b) => b.trust - a.trust)
      .slice(0, 5),
    [nodes, proofs]
  );

  // 2. New Proofs — last 24h
  const newProofs = useMemo(() =>
    [...proofs]
      .filter(p => Date.now() - p.createdAt < DAY_MS)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5),
    [proofs]
  );

  // 3. New Trust — nodes where proof-trust > original trustScore
  const trustGains = useMemo(() =>
    nodes
      .map(n => ({ n, pt: proofTrust(n.name, proofs) }))
      .filter(x => x.pt > x.n.trustScore)
      .sort((a, b) => (b.pt - b.n.trustScore) - (a.pt - a.n.trustScore))
      .slice(0, 4),
    [nodes, proofs]
  );

  // 4. New Opportunities — nodes closest to next threshold
  const opportunities = useMemo(() => {
    // Show: unlocked opps AND nodes nearest to next threshold
    const out: Array<{ name: string; opp: string; trust: number; unlocked: boolean }> = [];
    nodes.forEach(n => {
      const trust = proofTrust(n.name, proofs) || n.trustScore;
      OPPORTUNITY_DEFS.forEach(o => {
        if (trust >= o.threshold) {
          out.push({ name: n.name, opp: o.name, trust, unlocked: true });
        } else if (o.threshold - trust <= 15) {
          // within 15 points of unlocking
          out.push({ name: n.name, opp: o.name, trust, unlocked: false });
        }
      });
    });
    return out.sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || b.trust - a.trust).slice(0, 6);
  }, [nodes, proofs]);

  // 5. Value by Domain
  const byDomain = useMemo(() => {
    const acc: Record<string, { count: number; totalIntensity: number; forward: number }> = {};
    nodes.forEach(n => {
      if (!acc[n.context]) acc[n.context] = { count: 0, totalIntensity: 0, forward: 0 };
      acc[n.context].count++;
      acc[n.context].totalIntensity += n.intensity;
      if (n.direction === "forward") acc[n.context].forward++;
    });
    return Object.entries(acc)
      .map(([ctx, v]) => ({ ctx: ctx as NodeContext, ...v, avg: v.totalIntensity / v.count }))
      .sort((a, b) => b.count - a.count);
  }, [nodes]);

  // 6. For You — match profile needs to nodes' offers
  const forYou = useMemo(() => {
    if (!profile) return [];
    const profileNode = nodes.find(n => n.name === profile.name);
    if (!profileNode) return [];
    const myNeeds = deriveNeeds(profileNode).needs;
    if (!myNeeds.length) return [];
    return nodes
      .filter(n => n.name !== profile.name)
      .map(n => {
        const offers = deriveNeeds(n).offers;
        const match = myNeeds.filter(need => offers.includes(need));
        return { n, match };
      })
      .filter(x => x.match.length > 0)
      .sort((a, b) => b.match.length - a.match.length)
      .slice(0, 4);
  }, [nodes, profile]);

  const S: Record<string, React.CSSProperties> = {
    section:   { marginBottom: 16 },
    heading:   { fontSize: 9, letterSpacing: 2.5, color: "#1e4060", textTransform: "uppercase", marginBottom: 7 },
    item:      { display: "flex", alignItems: "center", gap: 7, padding: "6px 0", borderBottom: "1px solid #0a2a4a" },
    tag:       { fontSize: 9, padding: "1px 6px", borderRadius: 3, fontWeight: 600 },
    dot:       { width: 6, height: 6, borderRadius: "50%", flexShrink: 0 },
  };

  const PROOF_COLOR: Record<string, string> = {
    claimed: "#fbbf24", verified: "#34d399", rejected: "#f87171",
  };

  return (
    <div style={{ overflowY: "auto", height: "100%", padding: "12px 14px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isDemo ? 6 : 14 }}>
        <div style={{ fontSize: 10, letterSpacing: 3, color: "#38bdf8", fontWeight: 700 }}>LIVE FEED</div>
        <div style={{ fontSize: 9, color: "#1e4060" }}>מתעדכן כל 30ש'</div>
      </div>

      {/* Demo banner */}
      {isDemo && (
        <div style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #fbbf2444", background: "#fbbf2408", marginBottom: 12 }}>
          <div style={{ fontSize: 9, color: "#fbbf24", marginBottom: 5 }}>
            ⚠ מצב הדגמה — אין נתונים אמיתיים עדיין
          </div>
          <button
            onClick={seedAndLoad}
            style={{ fontSize: 9, padding: "3px 10px", borderRadius: 4, border: "1px solid #fbbf2466", background: "transparent", color: "#fbbf24", cursor: "pointer" }}
          >
            ← טען 10 משתמשי demo לגלובוס
          </button>
        </div>
      )}

      {/* 1. Leaders Today */}
      <div style={S.section}>
        <div style={S.heading}>🏆 מובילים היום</div>
        {leaders.length === 0
          ? <div style={{ fontSize: 10, color: "#1e4060" }}>—</div>
          : leaders.map(({ n, trust }) => (
            <div key={n.id} style={S.item}>
              <div style={{ ...S.dot, background: FORCE_COLOR[n.dominantForce] }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "#caf0f8" }}>{n.name}</div>
                <div style={{ fontSize: 9, color: "#1e4060" }}>{FORCE_LABEL[n.dominantForce]} · {CONTEXT_LABEL[n.context]}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: trust > 50 ? "#34d399" : trust > 20 ? "#fbbf24" : "#8bb8cc" }}>
                  {trust}
                </div>
                <div style={{ fontSize: 8, color: "#1e4060" }}>trust</div>
              </div>
            </div>
          ))
        }
      </div>

      {/* 2. New Proofs */}
      <div style={S.section}>
        <div style={S.heading}>✓ הוכחות חדשות</div>
        {newProofs.length === 0
          ? <div style={{ fontSize: 10, color: "#1e4060" }}>לא הוגשו הוכחות ב-24 שעות האחרונות</div>
          : newProofs.map(p => (
            <div key={p.id} style={S.item}>
              <span style={{ ...S.tag, background: PROOF_COLOR[p.status] + "22", color: PROOF_COLOR[p.status] }}>
                {p.status === "verified" ? "מאומת" : p.status === "claimed" ? "טענה" : "נדחה"}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, color: "#caf0f8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.claim}
                </div>
                <div style={{ fontSize: 9, color: "#1e4060" }}>{p.userId}</div>
              </div>
              <div style={{ fontSize: 9, color: "#1e4060", flexShrink: 0 }}>{timeAgo(p.createdAt)}</div>
            </div>
          ))
        }
      </div>

      {/* 3. New Trust */}
      <div style={S.section}>
        <div style={S.heading}>⬡ אמון חדש</div>
        {trustGains.length === 0
          ? <div style={{ fontSize: 10, color: "#1e4060" }}>—</div>
          : trustGains.map(({ n, pt }) => (
            <div key={n.id} style={S.item}>
              <div style={{ ...S.dot, background: FORCE_COLOR[n.dominantForce] }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "#caf0f8" }}>{n.name}</div>
                <div style={{ fontSize: 9, color: "#1e4060" }}>proof trust</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                <span style={{ color: "#8bb8cc" }}>{n.trustScore}</span>
                <span style={{ color: "#1e4060" }}>→</span>
                <span style={{ color: "#34d399", fontWeight: 700 }}>{pt}</span>
                <span style={{ fontSize: 9, color: "#34d399" }}>+{pt - n.trustScore}</span>
              </div>
            </div>
          ))
        }
      </div>

      {/* 4. New Opportunities */}
      <div style={S.section}>
        <div style={S.heading}>★ הזדמנויות פתוחות</div>
        {opportunities.length === 0
          ? <div style={{ fontSize: 10, color: "#1e4060" }}>—</div>
          : opportunities.map((o, i) => (
            <div key={i} style={S.item}>
              <span style={{ ...S.tag, background: o.unlocked ? "#064e3b" : "#1a2a1a", color: o.unlocked ? "#34d399" : "#fbbf24" }}>
                {o.unlocked ? "פתוח" : "קרוב"}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "#caf0f8" }}>{o.opp}</div>
                <div style={{ fontSize: 9, color: "#1e4060" }}>{o.name}</div>
              </div>
              <div style={{ fontSize: 10, color: o.unlocked ? "#34d399" : "#fbbf24", fontWeight: 600 }}>{o.trust}</div>
            </div>
          ))
        }
      </div>

      {/* 5. Value by Domain */}
      <div style={S.section}>
        <div style={S.heading}>◈ ערך לפי תחום</div>
        {byDomain.length === 0
          ? <div style={{ fontSize: 10, color: "#1e4060" }}>—</div>
          : byDomain.map(d => {
            const fwd = Math.round((d.forward / d.count) * 100);
            return (
              <div key={d.ctx} style={{ ...S.item, flexDirection: "column", alignItems: "stretch", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 10, color: "#caf0f8" }}>{CONTEXT_LABEL[d.ctx]}</span>
                  <span style={{ fontSize: 9, color: "#8bb8cc" }}>{d.count} nodes · avg {d.avg.toFixed(1)}</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: "#0a2a4a", overflow: "hidden" }}>
                  <div style={{ width: `${fwd}%`, height: "100%", background: fwd > 60 ? "#34d399" : fwd > 30 ? "#fbbf24" : "#f87171", borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 8, color: "#1e4060" }}>{fwd}% קדימה</div>
              </div>
            );
          })
        }
      </div>

      {/* 6. For You */}
      <div style={S.section}>
        <div style={S.heading}>◉ בשבילך</div>
        {!profile
          ? <div style={{ fontSize: 10, color: "#1e4060" }}>
              <a href="/profile" style={{ color: "#fbbf24" }}>צור פרופיל</a> לקבל המלצות
            </div>
          : forYou.length === 0
            ? <div style={{ fontSize: 10, color: "#1e4060" }}>הוסף נקודות לגלובוס לקבל המלצות</div>
            : forYou.map(({ n, match }) => (
              <div key={n.id} style={S.item}>
                <div style={{ ...S.dot, background: FORCE_COLOR[n.dominantForce] }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "#caf0f8" }}>{n.name}</div>
                  <div style={{ display: "flex", gap: 3, marginTop: 2, flexWrap: "wrap" }}>
                    {match.map(need => (
                      <span key={need} style={{ fontSize: 8, padding: "1px 5px", borderRadius: 8, background: "#34d39922", color: "#34d399" }}>
                        {NEED_LABEL[need]}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: 8, color: "#34d399" }}>מציע {match.length}</div>
              </div>
            ))
        }
      </div>

    </div>
  );
}
