import { saveFeedback, computeExecutionImpact } from "./lib/feedback";
"use client";

import { useState } from "react";
import GlobeView from "./globe/GlobeView";
import { useGraphData } from "./graph/useGraphData";

export default function Page() {
  const data = useGraphData();

  const [event, setEvent] = useState("");
  const [intensity, setIntensity] = useState(5);
  const [context, setContext] = useState("");
  const [result, setResult] = useState<any>(null);

  async function analyze() {
    const res = await fetch("/api/analyze", { method: "POST" });
    const json = await res.json();
    setResult(json);
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ width: "100%", height: 400 }}>
        <GlobeView data={data} />
      </div>

      <h1>Analyze</h1>

      <input placeholder="event" onChange={(e)=>setEvent(e.target.value)} />
      <input type="number" defaultValue={5} onChange={(e)=>setIntensity(Number(e.target.value))} />
      <input placeholder="context" onChange={(e)=>setContext(e.target.value)} />

      

<button onClick={analyze}>Analyze</button>
<div style={{marginTop:10}}>
  <button onClick={()=>saveFeedback({did:true, helped:"yes", ts:Date.now()})}>Yes</button>
  <button onClick={()=>saveFeedback({did:true, helped:"no", ts:Date.now()})}>No</button>
  <button onClick={()=>saveFeedback({did:true, helped:"partial", ts:Date.now()})}>Partial</button>
</div>
<div style={{marginTop:10}}>
  {(()=>{ const m=computeExecutionImpact(); return m.rate===undefined?null:<b>Execution × Impact: {m.rate}% ({m.succeeded}/{m.total})</b>; })()}
</div>
<div style={{marginTop:10}}>
  <button onClick={()=>saveFeedback({did:true, helped:"yes", ts:Date.now()})}>Did it help? Yes</button>
  <button onClick={()=>saveFeedback({did:true, helped:"no", ts:Date.now()})}>Did it help? No</button>
  <button onClick={()=>saveFeedback({did:true, helped:"partial", ts:Date.now()})}>Partial</button>
</div>
<div style={{marginTop:10}}>
  {(()=>{ const m=computeExecutionImpact(); return m.rate===undefined?null:<b>Execution × Impact: {m.rate}% ({m.succeeded}/{m.total})</b>; })()}
</div>

      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}
