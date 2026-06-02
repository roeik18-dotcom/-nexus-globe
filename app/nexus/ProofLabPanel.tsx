"use client";
import { useState, useEffect, useCallback } from "react";
import {
  classifyAction, makeAction, calcValueContribution,
  calcTrustFromProofs, getOpportunities,
  loadProofUser, saveProofUser,
  addProof, verifyProof, rejectProof, loadProofs,
  ACTION_LABELS, PROOF_STATUS_LABEL, PROOF_STATUS_COLOR,
  type ProofUser, type ProofAction, type ProofItem, type EvidenceType,
} from "../lib/proof";

const USERS = [
  "דנה כהן", "יוסי לוי", "מיכל אבד", "אבי גרין", "שרה מזרחי",
  "נועם בן-דוד", "תמר שפירא", "אלון ברק", "רונית כץ", "גיל מור",
];

const TYPE_COLOR: Record<string, string> = {
  help: "#38bdf8", resolve: "#fbbf24", coordinate: "#34d399",
  report: "#a78bfa", unknown: "#475569",
};

type Tab = "actions" | "proof" | "verify";

export default function ProofLabPanel({ userName }: { userName: string }) {
  const [user,      setUser]      = useState<ProofUser>({ name: userName, actions: [] });
  const [text,      setText]      = useState("");
  const [valueNote, setValueNote] = useState("");
  const [preview,   setPreview]   = useState<{ type: string; pts: number } | null>(null);
  const [tab,       setTab]       = useState<Tab>("actions");

  // proof form
  const [proofClaim,    setProofClaim]    = useState("");
  const [proofEvType,   setProofEvType]   = useState<EvidenceType>("text");
  const [proofEvidence, setProofEvidence] = useState("");
  const [proofActionId, setProofActionId] = useState("");

  // live data
  const [myProofs,      setMyProofs]      = useState<ProofItem[]>([]);
  const [pendingProofs, setPendingProofs] = useState<ProofItem[]>([]);

  const reload = useCallback(() => {
    const u = loadProofUser(userName);
    setUser(u);
    setMyProofs(loadProofs(userName));
    // pending = other users' claimed proofs that I haven't verified
    const all = loadProofs();
    setPendingProofs(
      all.filter(p => p.userId !== userName && p.status === "claimed")
    );
  }, [userName]);

  useEffect(() => { reload(); }, [reload]);

  const trust = calcTrustFromProofs(userName, user.actions);
  const value = calcValueContribution(user.actions);
  const opps  = getOpportunities(trust);

  // ── Action submit ─────────────────────────────────────────────────
  const handleTextChange = useCallback((v: string) => {
    setText(v);
    if (!v.trim()) { setPreview(null); return; }
    const { type } = classifyAction(v);
    const pts = type === "help" ? 3 : type === "resolve" ? 4 : type === "coordinate" ? 2 : 1;
    setPreview({ type, pts });
  }, []);

  const submitAction = () => {
    if (!text.trim()) return;
    const action = makeAction(text.trim(), valueNote.trim());
    const updated: ProofUser = { ...user, actions: [...user.actions, action] };
    saveProofUser(updated);
    setText(""); setValueNote(""); setPreview(null);
    reload();
  };

  // ── Proof submit ──────────────────────────────────────────────────
  const submitProof = () => {
    if (!proofClaim.trim() || !proofEvidence.trim()) return;
    const targetAction = proofActionId || (user.actions[user.actions.length - 1]?.id ?? "free");
    addProof(userName, targetAction, proofClaim.trim(), proofEvType, proofEvidence.trim());
    setProofClaim(""); setProofEvidence(""); setProofActionId("");
    reload();
  };

  // ── Peer verify ───────────────────────────────────────────────────
  const doVerify = (id: string) => { verifyProof(id, userName); reload(); };
  const doReject = (id: string) => { rejectProof(id, userName);  reload(); };

  // ── Styles ───────────────────────────────────────────────────────
  const S: Record<string, React.CSSProperties> = {
    root:    { display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" },
    section: { padding: "8px 14px 3px", fontSize: 9, letterSpacing: 2.5, color: "#1e4060", textTransform: "uppercase" },
    card:    { margin: "3px 8px", padding: "7px 10px", borderRadius: 6, border: "1px solid #0a2a4a", background: "#040e1c" },
    input:   { width: "100%", background: "#020d1a", border: "1px solid #0a2a4a", borderRadius: 4, color: "#caf0f8", padding: "5px 8px", fontSize: 11, fontFamily: "inherit", direction: "rtl", resize: "none" as const, outline: "none" },
    btn:     { padding: "5px 10px", border: "none", borderRadius: 4, background: "#0ea5e9", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" },
    btnGhost:{ padding: "4px 8px", border: "1px solid #0a2a4a", borderRadius: 4, background: "transparent", color: "#8bb8cc", fontSize: 10, cursor: "pointer" },
    badge:   { padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 700, flexShrink: 0 as const },
    logItem: { display: "flex", alignItems: "flex-start", gap: 6, padding: "5px 0", borderBottom: "1px solid #0a2a4a" },
    tabs:    { display: "flex", gap: 2, padding: "6px 8px 0", borderBottom: "1px solid #0a2a4a" },
    tab:     { padding: "5px 10px", fontSize: 10, borderRadius: "4px 4px 0 0", border: "none", cursor: "pointer", fontFamily: "inherit" },
  };

  const tabStyle = (t: Tab): React.CSSProperties => ({
    ...S.tab,
    background: tab === t ? "#0a2a4a" : "transparent",
    color: tab === t ? "#38bdf8" : "#1e4060",
    fontWeight: tab === t ? 700 : 400,
  });

  return (
    <div style={S.root}>
      {/* ── Metrics ── */}
      <div style={S.section}>Proof Lab</div>
      <div style={{ ...S.card, display: "flex", justifyContent: "space-between" }}>
        <Metric label="Trust"  val={trust}  color="#38bdf8" max={100} />
        <Metric label="Value"  val={value}  color="#34d399" />
        <Metric label="Proofs" val={myProofs.filter(p => p.status === "verified").length} color="#fbbf24" />
        <Metric label="Opps"   val={opps.filter(o => o.unlocked).length} color="#a78bfa" />
      </div>

      {/* Trust bar */}
      <div style={{ margin: "2px 8px 0", padding: "5px 10px", borderRadius: 6, border: "1px solid #0a2a4a", background: "#040e1c" }}>
        <div style={{ height: 4, borderRadius: 2, background: "#0a2a4a", overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 2, background: "linear-gradient(90deg,#0ea5e9,#00f5d4)", width: `${trust}%`, transition: "width .4s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: 8, color: "#1e4060" }}>
          <span>0</span><span>claimed=1</span><span>verified=3</span><span>repeat=5</span>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={S.tabs}>
        <button style={tabStyle("actions")} onClick={() => setTab("actions")}>פעולות</button>
        <button style={tabStyle("proof")}   onClick={() => setTab("proof")}>
          הוכחות {myProofs.length > 0 && <span style={{ color: "#fbbf24" }}>{myProofs.length}</span>}
        </button>
        <button style={tabStyle("verify")}  onClick={() => setTab("verify")}>
          אמת {pendingProofs.length > 0 && <span style={{ color: "#34d399" }}>{pendingProofs.length}</span>}
        </button>
      </div>

      {/* ── Tab: Actions ── */}
      {tab === "actions" && (
        <div style={{ overflowY: "auto", flex: 1 }}>
          {/* Opportunities */}
          <div style={S.section}>הזדמנויות</div>
          <div style={{ margin: "0 8px", display: "flex", flexDirection: "column", gap: 3 }}>
            {opps.map(o => (
              <div key={o.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 10px", borderRadius: 4, border: `1px solid ${o.unlocked ? "#00f5d444" : "#0a2a4a"}`, background: o.unlocked ? "#00f5d408" : "#040e1c" }}>
                <span style={{ fontSize: 10, color: o.unlocked ? "#00f5d4" : "#1e4060" }}>{o.name}</span>
                <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: o.unlocked ? "#064e3b" : "#0a1929", color: o.unlocked ? "#34d399" : "#1e4060" }}>
                  {o.unlocked ? "פתוח" : `${o.threshold}`}
                </span>
              </div>
            ))}
          </div>

          {/* Submit action */}
          <div style={S.section}>רשום פעולה</div>
          <div style={{ margin: "0 8px" }}>
            <textarea value={text} onChange={e => handleTextChange(e.target.value)} placeholder="למשל: עזרתי ללקוח..." rows={2} style={S.input} />
            <input value={valueNote} onChange={e => setValueNote(e.target.value)} placeholder="ערך שנוצר" style={{ ...S.input, marginTop: 4 }} />
            {preview && <div style={{ fontSize: 10, color: TYPE_COLOR[preview.type] ?? "#38bdf8", marginTop: 3 }}>→ {ACTION_LABELS[preview.type as keyof typeof ACTION_LABELS]} · +{preview.pts}</div>}
            <button style={{ ...S.btn, marginTop: 5, width: "100%" }} onClick={submitAction}>▸ רשום</button>
          </div>

          {/* Action log */}
          <div style={S.section}>יומן פעולות</div>
          <div style={{ padding: "0 8px 8px" }}>
            {user.actions.length === 0
              ? <div style={{ fontSize: 10, color: "#1e4060", textAlign: "center", padding: 10 }}>אין פעולות עדיין</div>
              : [...user.actions].reverse().map((a: ProofAction) => (
                <div key={a.id} style={S.logItem}>
                  <span style={{ ...S.badge, background: (TYPE_COLOR[a.type] ?? "#475569") + "22", color: TYPE_COLOR[a.type] ?? "#475569" }}>
                    {ACTION_LABELS[a.type]}
                  </span>
                  <div style={{ flex: 1, fontSize: 10, color: "#8bb8cc", lineHeight: 1.4 }}>
                    {a.text}
                    {a.valueNote && <div style={{ color: "#1e4060", fontSize: 9 }}>{a.valueNote}</div>}
                  </div>
                  <span style={{ fontSize: 10, color: "#34d399", fontWeight: 700 }}>+{a.points}</span>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* ── Tab: My Proofs ── */}
      {tab === "proof" && (
        <div style={{ overflowY: "auto", flex: 1 }}>
          {/* Submit proof */}
          <div style={S.section}>הגש הוכחה</div>
          <div style={{ margin: "0 8px 8px" }}>
            <textarea
              value={proofClaim}
              onChange={e => setProofClaim(e.target.value)}
              placeholder="מה עשית? (טענה)"
              rows={2}
              style={S.input}
            />
            <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
              {(["text", "link", "peer"] as EvidenceType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setProofEvType(t)}
                  style={{ ...S.btnGhost, flex: 1, color: proofEvType === t ? "#38bdf8" : "#1e4060", borderColor: proofEvType === t ? "#38bdf8" : "#0a2a4a" }}
                >
                  {t === "text" ? "טקסט" : t === "link" ? "קישור" : "עמית"}
                </button>
              ))}
            </div>
            <input
              value={proofEvidence}
              onChange={e => setProofEvidence(e.target.value)}
              placeholder={proofEvType === "link" ? "https://..." : proofEvType === "peer" ? "שם מאשר..." : "תיאור ראיה..."}
              style={{ ...S.input, marginTop: 4 }}
            />
            {user.actions.length > 0 && (
              <select
                value={proofActionId}
                onChange={e => setProofActionId(e.target.value)}
                style={{ ...S.input, marginTop: 4 }}
              >
                <option value="">— קשר לפעולה (אופציונלי) —</option>
                {[...user.actions].reverse().map(a => (
                  <option key={a.id} value={a.id}>{a.text.slice(0, 40)}</option>
                ))}
              </select>
            )}
            <button style={{ ...S.btn, marginTop: 5, width: "100%" }} onClick={submitProof}>
              ▸ הגש הוכחה
            </button>
          </div>

          {/* My proof list */}
          <div style={S.section}>ההוכחות שלי</div>
          <div style={{ padding: "0 8px 8px" }}>
            {myProofs.length === 0
              ? <div style={{ fontSize: 10, color: "#1e4060", textAlign: "center", padding: 10 }}>אין הוכחות עדיין</div>
              : [...myProofs].reverse().map(p => (
                <div key={p.id} style={{ ...S.logItem, flexDirection: "column", gap: 3 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ ...S.badge, background: PROOF_STATUS_COLOR[p.status] + "22", color: PROOF_STATUS_COLOR[p.status] }}>
                      {PROOF_STATUS_LABEL[p.status]}
                    </span>
                    <span style={{ fontSize: 10, color: "#caf0f8", flex: 1 }}>{p.claim}</span>
                    <span style={{ fontSize: 10, color: "#34d399", fontWeight: 700 }}>+{p.weight}</span>
                  </div>
                  <div style={{ fontSize: 9, color: "#1e4060", paddingRight: 4 }}>
                    {p.evidenceType === "link" ? "🔗" : p.evidenceType === "peer" ? "👤" : "📝"} {p.evidence}
                    {p.verifiedBy && <span style={{ color: "#34d399", marginRight: 6 }}> · אומת על ידי {p.verifiedBy}</span>}
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* ── Tab: Verify Others ── */}
      {tab === "verify" && (
        <div style={{ overflowY: "auto", flex: 1 }}>
          <div style={S.section}>הוכחות ממתינות לאימות</div>
          <div style={{ padding: "0 8px 8px" }}>
            {pendingProofs.length === 0
              ? <div style={{ fontSize: 10, color: "#1e4060", textAlign: "center", padding: 10 }}>אין הוכחות ממתינות</div>
              : pendingProofs.map(p => (
                <div key={p.id} style={{ ...S.card, marginBottom: 6 }}>
                  <div style={{ fontSize: 10, color: "#38bdf8", fontWeight: 600, marginBottom: 4 }}>{p.userId}</div>
                  <div style={{ fontSize: 11, color: "#caf0f8", marginBottom: 4 }}>{p.claim}</div>
                  <div style={{ fontSize: 9, color: "#1e4060", marginBottom: 6 }}>
                    {p.evidenceType === "link" ? "🔗" : p.evidenceType === "peer" ? "👤" : "📝"} {p.evidence}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => doVerify(p.id)}
                      style={{ ...S.btn, flex: 1, background: "#064e3b", color: "#34d399" }}
                    >
                      ✓ אמת
                    </button>
                    <button
                      onClick={() => doReject(p.id)}
                      style={{ ...S.btn, flex: 1, background: "#3b1414", color: "#f87171" }}
                    >
                      ✗ דחה
                    </button>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, val, color, max }: { label: string; val: number; color: string; max?: number }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 15, color, fontWeight: 700 }}>{val}{max ? `/${max}` : ""}</div>
      <div style={{ fontSize: 8, color: "#1e4060", letterSpacing: 1 }}>{label.toUpperCase()}</div>
    </div>
  );
}
