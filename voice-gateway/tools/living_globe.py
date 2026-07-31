#!/usr/bin/env python3
"""
living_globe.py — Living Globe: a VIEW onto the Merlin OS platform (mos).

Not new computation — it renders what mos already produces (the principle from
docs/nexus-globe-living-system.md). Reads the durable event log and shows:
  • a globe dominating the screen (atmosphere glow, starfield) — the right-hand base
  • world-graph entities as nodes on the globe (actors/intents/decisions/tools),
    event pulses, clickable node detail (relationships / potential / recommended action)
  • a live HUD from real data: Current Goal · Decision · Confidence · Active Trace ·
    Learning · Latency · Health

Self-contained (inline JS/CSS, canvas 2D — no CDN). Serves like Mission Control.

Usage:
    .venv/bin/python tools/living_globe.py            # write HTML
    .venv/bin/python tools/living_globe.py --serve    # live server on :4478
"""
from __future__ import annotations

import hashlib
import html
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # → voice-gateway

from mos.latency import stage_latencies
from mos.learning import Priors
from mos.store import JsonlEventStore
from mos.trace import correlations, summarize
from mos.world_graph import WorldGraph

LOG = os.path.expanduser("~/Library/Logs/Merlin/mos_events.jsonl")
PORT = 4478

_KIND_COLOR = {"actor": "#5aa9ff", "intent": "#7c5cff", "decision": "#3ad07f",
               "tool": "#f5b53d", "priors": "#ff8fab", "user": "#e6ecf5",
               "world": "#8892b0", "entity": "#48e0d0"}


def _latlon(node_id: str) -> tuple[float, float]:
    h = hashlib.md5(node_id.encode()).digest()
    lat = (h[0] / 255.0 - 0.5) * math.pi            # -90..90
    lon = (h[1] / 255.0) * 2 * math.pi              # 0..360
    return round(lat, 4), round(lon, 4)


def collect() -> dict:
    events = JsonlEventStore(LOG).load() if os.path.exists(LOG) else []
    g = WorldGraph.from_events(events)
    priors = Priors.from_events(events)

    nodes = []
    for n in g.nodes.values():
        lat, lon = _latlon(n.id)
        label = n.id.split(":", 1)[-1] if ":" in n.id else n.id
        rels = [f"{e.rel} → {e.dst.split(':',1)[-1]}" for e in g.edges if e.src == n.id][:6]
        rels += [f"{e.src.split(':',1)[-1]} → {e.rel}" for e in g.edges if e.dst == n.id][:6]
        nodes.append({"id": n.id, "kind": n.kind, "label": label,
                      "lat": lat, "lon": lon,
                      "color": _KIND_COLOR.get(n.kind, "#48e0d0"),
                      "attrs": n.attrs, "rels": rels[:8]})

    # HUD from the latest turn
    cors = correlations(events)
    last = cors[-1] if cors else None
    hud = {"goal": "—", "decision": "—", "confidence": "—", "trace": last or "—",
           "latency_ms": "—", "status": "—"}
    if last:
        turn = [e for e in events if e.correlation_id == last]
        dm = next((e for e in reversed(turn) if e.type == "decision.made"), None)
        if dm:
            hud["decision"] = dm.payload.get("decision", "—")
            hud["goal"] = dm.payload.get("goal") or "—"
            hud["confidence"] = dm.payload.get("confidence", "—")
        hud["latency_ms"] = stage_latencies(events, last).get("total_ms", "—")
        hud["status"] = summarize(events, last).outcome

    errors = sum(1 for e in events if "error" in e.type or "failed" in e.type)
    hud["health"] = "ok" if errors == 0 else f"{errors} errors"
    hud["learning"] = priors.snapshot()
    hud["n_events"] = len(events)
    hud["pulses"] = [e.subject for e in events[-12:]]     # recent activity
    return {"nodes": nodes, "hud": hud}


def render_html(d: dict) -> str:
    data = json.dumps(d)
    return """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Philos · Living Globe</title>
<style>
:root{--txt:#e6ecf5;--mut:#8892b0;--edge:#1b2635;}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden;background:#05070d;color:#e6ecf5;
font:13px/1.5 -apple-system,SFPro,system-ui,sans-serif}
#globe{position:fixed;inset:0;display:block}
.hud{position:fixed;top:20px;left:20px;width:250px;background:rgba(12,16,26,.72);
backdrop-filter:blur(8px);border:1px solid #1e2636;border-radius:14px;padding:16px;z-index:5}
.hud h1{font-size:14px;letter-spacing:.5px;margin-bottom:2px}
.hud .sub{color:#8892b0;font-size:11px;margin-bottom:12px}
.row{display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-top:1px solid #ffffff0d;font-size:12px}
.row:first-of-type{border-top:none}
.row .k{color:#8892b0}.row .v{font-weight:600;text-align:right}
.v.ok{color:#3ad07f}.v.awaiting_approval{color:#f5b53d}.v.failed{color:#ff5d6c}
.detail{position:fixed;top:20px;right:20px;width:270px;background:rgba(12,16,26,.72);
backdrop-filter:blur(8px);border:1px solid #1e2636;border-radius:14px;padding:16px;z-index:5;display:none}
.detail h2{font-size:13px;margin-bottom:2px}.detail .kind{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#8892b0;margin-bottom:10px}
.detail ul{list-style:none;font-size:12px}.detail li{padding:3px 0;color:#c3ccdb}
.detail .sec{color:#8892b0;font-size:10px;text-transform:uppercase;letter-spacing:1px;margin:10px 0 4px}
.legend{position:fixed;bottom:16px;left:20px;display:flex;gap:14px;font-size:11px;color:#8892b0;z-index:5}
.legend i{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:5px;vertical-align:middle}
.foot{position:fixed;bottom:16px;right:20px;color:#3a4560;font-size:10px;z-index:5}
</style></head><body>
<canvas id="globe"></canvas>
<div class="hud">
  <h1>🌍 Philos · Living World</h1>
  <div class="sub" id="hsub"></div>
  <div class="row"><span class="k">Current Goal</span><span class="v" id="hgoal"></span></div>
  <div class="row"><span class="k">Decision</span><span class="v" id="hdec"></span></div>
  <div class="row"><span class="k">Confidence</span><span class="v" id="hconf"></span></div>
  <div class="row"><span class="k">Active Trace</span><span class="v" id="htrace"></span></div>
  <div class="row"><span class="k">Status</span><span class="v" id="hstatus"></span></div>
  <div class="row"><span class="k">Latency</span><span class="v" id="hlat"></span></div>
  <div class="row"><span class="k">Learning</span><span class="v" id="hlearn"></span></div>
  <div class="row"><span class="k">Health</span><span class="v" id="hhealth"></span></div>
</div>
<div class="detail" id="detail"></div>
<div class="legend" id="legend"></div>
<div class="foot">Living Globe v0 · a view onto mos · click a node</div>
<script>
const DATA = __DATA__;
const cv = document.getElementById('globe'), ctx = cv.getContext('2d');
let W,H,CX,CY,R, rot=0;
function resize(){W=cv.width=innerWidth;H=cv.height=innerHeight;CX=W/2;CY=H/2;R=Math.min(W,H)*0.38;}
addEventListener('resize',resize); resize();
// starfield
const stars=[]; for(let i=0;i<220;i++)stars.push({x:Math.random()*1,y:Math.random()*1,r:Math.random()*1.3});
function project(lat,lon){
  const x=Math.cos(lat)*Math.sin(lon+rot), y=Math.sin(lat), z=Math.cos(lat)*Math.cos(lon+rot);
  return {sx:CX+x*R, sy:CY-y*R, z};
}
let last=null;
function draw(){
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#05070d'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#9fb0d0';
  for(const s of stars){ctx.globalAlpha=0.3+s.r*0.4;ctx.beginPath();ctx.arc(s.x*W,s.y*H,s.r,0,7);ctx.fill();}
  ctx.globalAlpha=1;
  // atmosphere glow
  let ga=ctx.createRadialGradient(CX,CY,R*0.6,CX,CY,R*1.5);
  ga.addColorStop(0,'rgba(60,120,255,0.18)');ga.addColorStop(1,'rgba(60,120,255,0)');
  ctx.fillStyle=ga;ctx.beginPath();ctx.arc(CX,CY,R*1.5,0,7);ctx.fill();
  // globe body
  let gb=ctx.createRadialGradient(CX-R*0.3,CY-R*0.3,R*0.1,CX,CY,R);
  gb.addColorStop(0,'#16233f');gb.addColorStop(1,'#0a1120');
  ctx.fillStyle=gb;ctx.beginPath();ctx.arc(CX,CY,R,0,7);ctx.fill();
  ctx.strokeStyle='rgba(90,169,255,0.35)';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(CX,CY,R,0,7);ctx.stroke();
  // nodes (sorted back-to-front)
  const ns=DATA.nodes.map(n=>({...n,...project(n.lat,n.lon)})).sort((a,b)=>a.z-b.z);
  window._front=[];
  for(const n of ns){
    const front=n.z>0, sz=front?4.5:2.5, op=front?0.95:0.25;
    ctx.globalAlpha=op;ctx.fillStyle=n.color;
    ctx.beginPath();ctx.arc(n.sx,n.sy,sz,0,7);ctx.fill();
    if(front){ctx.globalAlpha=0.15;ctx.beginPath();ctx.arc(n.sx,n.sy,sz*2.4,0,7);ctx.fill();window._front.push(n);}
  }
  ctx.globalAlpha=1;
  rot+=0.0016; requestAnimationFrame(draw);
}
draw();
// HUD
const h=DATA.hud;
hsub.textContent=h.n_events+' events · '+DATA.nodes.length+' entities';
hgoal.textContent=h.goal; hdec.textContent=h.decision; hconf.textContent=h.confidence;
htrace.textContent=h.trace; hlat.textContent=h.latency_ms+'ms';
hstatus.textContent=(h.status||'—').replace('_',' '); hstatus.className='v '+(h.status||'');
hhealth.textContent=h.health; hhealth.className='v '+(h.health==='ok'?'ok':'failed');
const lo=h.learning&&h.learning.outcomes||{};
hlearn.textContent=Object.entries(lo).map(([k,v])=>k[0].toUpperCase()+':'+v).join(' ')||'—';
// legend
const kinds={};DATA.nodes.forEach(n=>kinds[n.kind]=n.color);
legend.innerHTML=Object.entries(kinds).map(([k,c])=>`<span><i style="background:${c}"></i>${k}</span>`).join('');
// click → node detail
cv.addEventListener('click',ev=>{
  let best=null,bd=18;
  for(const n of (window._front||[])){const d=Math.hypot(n.sx-ev.clientX,n.sy-ev.clientY);if(d<bd){bd=d;best=n;}}
  const el=document.getElementById('detail');
  if(!best){el.style.display='none';return;}
  const a=best.attrs||{};
  let extra='';
  if(a.decision)extra+=`<div class="sec">Decision</div><ul><li>${a.decision} (conf ${a.confidence})</li></ul>`;
  el.innerHTML=`<h2>${best.label}</h2><div class="kind" style="color:${best.color}">${best.kind}</div>`+
    extra+
    `<div class="sec">Relationships</div><ul>${(best.rels||[]).map(r=>`<li>${r}</li>`).join('')||'<li>—</li>'}</ul>`+
    `<div class="sec">Potential · Recommended Action</div><ul><li>${a.decision?'act: '+a.decision:'(from Orientation Runtime — v0)'}</li></ul>`;
  el.style.display='block';
});
</script></body></html>""".replace("__DATA__", data)


def main():
    if "--serve" in sys.argv:
        from http.server import BaseHTTPRequestHandler, HTTPServer

        class Hd(BaseHTTPRequestHandler):
            def do_GET(self):
                page = render_html(collect()).encode()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(page)))
                self.end_headers()
                self.wfile.write(page)

            def log_message(self, *a):
                pass

        print(f"Living Globe live at http://localhost:{PORT}")
        HTTPServer(("127.0.0.1", PORT), Hd).serve_forever()
    else:
        out = os.path.join(os.path.dirname(__file__), "living_globe.html")
        open(out, "w").write(render_html(collect()))
        print(out)


if __name__ == "__main__":
    main()
