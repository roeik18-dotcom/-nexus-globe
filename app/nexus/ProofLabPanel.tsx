"use client";
import { useState, useEffect, useCallback } from "react";
import {
  classifyAction, makeAction, calcTrustScore, calcValueContribution,
  getOpportunities, loadProofUser, saveProofUser,
  ACTION_LABELS,
  type ProofUser, type ProofAction,
} from "../lib/proof";

const TYPE_COLOR: Record<string, string> = {
  help: "#38bdf8", resolve: "#fbbf24", coordinate: "#34d399",
  report: "#a78bfa", unknown: "#475569",
};

export default function ProofLabPanel({ userName }: { userName: string }) {
  const [user, setUser] = useState<ProofUser>({ name: userName, actions: [] });
  const [text, setText] = useState("");
  const [valueNote, setValueNote] = useState("");
  const [preview, setPreview] = useState<{ type: string; pts: number } | null>(null);

  useEffect(() => {
    setUser(loadProofUser(userName));
  }, [userName]);

  const trust = calcTrustScore(user.actions);
  const value = calcValueContribution(user.actions);
  const opps  = getOpportunities(trust);

  const handleTextChange = useCallback((v: string) => {
    setText(v);
    if (!v.trim()) { setPreview(null); return; }
    const { type } = classifyAction(v);
    const pts = type === "help" ? 3 : type === "resolve" ? 4 : type === "coordinate" ? 2 : 1;
    setPreview({ type, pts });
  }, []);

  const submit = () => {
    if (!text.trim()) return;
    const action = makeAction(text.trim(), valueNote.trim());
    const updated: ProofUser = { ...user, actions: [...user.actions, action] };
    setUser(updated);
    saveProofUser(updated);
    setText("");
    setValueNote("");
    setPreview(null);
  };

  const S: Record<string, React.CSSProperties> = {
    root:    { display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" },
    section: { padding: "10px 14px 4px", fontSize: 9, letterSpacing: 2.5, color: "#1e4060", textTransform: "uppercase" },
    card:    { margin: "4px 8px", padding: "8px 10px", borderRadius: 6, border: "1px solid #0a2a4a", background: "#040e1c" },
    input:   {
      width: "100%", background: "#020d1a", border: "1px solid #0a2a4a",
      borderRadius: 4, color: "#caf0f8", padding: "6px 8px", fontSize: 11,
      fontFamily: "inherit", direction: "rtl", resize: "none" as const, outline: "none",
    },
    btn: {
      width: "100%", marginTop: 6, padding: "6px 0", border: "none",
      borderRadius: 4, background: "#0ea5e9", color: "#fff",
      fontSize: 11, fontWeight: 600, cursor: "pointer",
    },
    logItem: {
      display: "flex", alignItems: "flex-start", gap: 6,
      padding: "6px 0", borderBottom: "1px solid #0a2a4a",
    },
    badge: { padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700, flexShrink: 0 },
  };

  return (
    <div style={S.root}>
      {/* ── Metrics ── */}
      <div style={S.section}>Proof Lab</div>
      <div style={{ ...S.card, display: "flex", justifyContent: "space-between" }}>
        <Metric label="Trust"  val={trust}  color="#38bdf8" max={100} />
        <Metric label="Value"  val={value}  color="#34d399" />
        <Metric label="Opps"   val={opps.filter(o => o.unlocked).length} color="#fbbf24" />
      </div>

      {/* ── Trust bar ── */}
      <div style={{ margin: "2px 8px 0", padding: "6px 10px", borderRadius: 6, border: "1px solid #0a2a4a", background: "#040e1c" }}>
        <div style={{ height: 4, borderRadius: 2, background: "#0a2a4a", overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 2,
            background: "linear-gradient(90deg,#0ea5e9,#00f5d4)",
            width: `${trust}%`, transition: "width .4s ease",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: 8, color: "#1e4060" }}>
          <span>0</span><span>25</span><span>60</span><span>100</span>
        </div>
      </div>

      {/* ── Opportunities ── */}
      <div style={S.section}>הזדמנויות</div>
      <div style={{ margin: "0 8px", display: "flex", flexDirection: "column", gap: 3 }}>
        {opps.map(o => (
          <div key={o.id} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "5px 10px", borderRadius: 4,
            border: `1px solid ${o.unlocked ? "#00f5d444" : "#0a2a4a"}`,
            background: o.unlocked ? "#00f5d408" : "#040e1c",
          }}>
            <span style={{ fontSize: 10, color: o.unlocked ? "#00f5d4" : "#1e4060" }}>{o.name}</span>
            <span style={{
              fontSize: 9, padding: "1px 6px", borderRadius: 3,
              background: o.unlocked ? "#064e3b" : "#0a1929",
              color: o.unlocked ? "#34d399" : "#1e4060",
            }}>
              {o.unlocked ? "פתוח" : `${o.threshold}`}
            </span>
          </div>
        ))}
      </div>

      {/* ── Submit action ── */}
      <div style={S.section}>רשום פעולה</div>
      <div style={{ margin: "0 8px" }}>
        <textarea
          value={text}
          onChange={e => handleTextChange(e.target.value)}
          placeholder="למשל: עזרתי ללקוח..."
          rows={2}
          style={S.input}
          onKeyDown={e => { if (e.key === "Enter" && e.metaKey) submit(); }}
        />
        <input
          value={valueNote}
          onChange={e => setValueNote(e.target.value)}
          placeholder="ערך שנוצר (אופציונלי)"
          style={{ ...S.input, marginTop: 4 }}
        />
        {preview && (
          <div style={{ fontSize: 10, color: TYPE_COLOR[preview.type] ?? "#38bdf8", marginTop: 4 }}>
            → {ACTION_LABELS[preview.type as keyof typeof ACTION_LABELS]} · +{preview.pts} pts
          </div>
        )}
        <button style={S.btn} onClick={submit}>▸ רשום</button>
      </div>

      {/* ── Action log ── */}
      <div style={S.section}>יומן פעולות</div>
      <div style={{ overflowY: "auto", flex: 1, padding: "0 8px 8px" }}>
        {user.actions.length === 0 ? (
          <div style={{ fontSize: 10, color: "#1e4060", textAlign: "center", padding: 12 }}>
            אין פעולות עדיין
          </div>
        ) : (
          [...user.actions].reverse().map((a: ProofAction) => (
            <div key={a.id} style={S.logItem}>
              <span style={{ ...S.badge, background: TYPE_COLOR[a.type] + "22", color: TYPE_COLOR[a.type] }}>
                {ACTION_LABELS[a.type]}
              </span>
              <div style={{ flex: 1, fontSize: 10, color: "#8bb8cc", lineHeight: 1.4 }}>
                {a.text}
                {a.valueNote && <div style={{ color: "#1e4060", fontSize: 9 }}>{a.valueNote}</div>}
              </div>
              <span style={{ fontSize: 10, color: "#34d399", fontWeight: 700, flexShrink: 0 }}>
                +{a.points}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Metric({ label, val, color, max }: { label: string; val: number; color: string; max?: number }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 16, color, fontWeight: 700 }}>{val}{max ? `/${max}` : ""}</div>
      <div style={{ fontSize: 8, color: "#1e4060", letterSpacing: 1 }}>{label.toUpperCase()}</div>
    </div>
  );
}
