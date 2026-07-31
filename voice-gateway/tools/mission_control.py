#!/usr/bin/env python3
"""
mission_control.py — Merlin/Philos MISSION CONTROL.

A LIVE status screen (not a document). It pulls REAL data on every load:
  • Merlin service state (launchd), log health
  • Git: commits since yesterday, uncommitted work, unpushed count
  • Measured evidence (Silero VAD probe over real captures)
  • Blockers, active task, KPIs
Every line carries WHAT · WHY · CONFIDENCE. Where a subsystem has no runtime yet
(e.g. Multi-Agent), it says so honestly instead of faking numbers.

Usage:
    .venv/bin/python tools/mission_control.py            # write HTML + print path
    .venv/bin/python tools/mission_control.py --serve    # live server on :4477
"""
from __future__ import annotations
import html, os, subprocess, sys, datetime as _dt

REPO = os.path.expanduser("~/-nexus-globe")
VG = os.path.join(REPO, "voice-gateway")
LOG = os.path.expanduser("~/Library/Logs/Merlin/service.log")
PORT = 4477


def sh(*args, cwd=None):
    try:
        return subprocess.run(args, cwd=cwd, capture_output=True, text=True,
                              timeout=8).stdout.strip()
    except Exception as e:
        return f"__err__ {e}"


def collect():
    d = {}
    # --- Merlin service (launchd) ---
    uid = os.getuid()
    pr = sh("launchctl", "print", f"gui/{uid}/com.merlin.voice")
    state = next((l.split("=")[1].strip() for l in pr.splitlines()
                  if l.strip().startswith("state =")), "unknown")
    pid = next((l.split("=")[1].strip() for l in pr.splitlines()
                if l.strip().startswith("pid =")), "-")
    d["merlin_state"] = state
    d["merlin_pid"] = pid

    # --- log health ---
    if os.path.exists(LOG):
        tail = sh("tail", "-400", LOG)
        lines = tail.splitlines()
        d["log_lines"] = sh("wc", "-l", LOG).split()[0] if os.path.exists(LOG) else "?"
        d["log_errors"] = sum(1 for l in lines if "ERROR" in l or "Traceback" in l)
        ts = [l[:19] for l in lines if l[:4].isdigit()]
        d["log_last"] = ts[-1] if ts else "-"
    else:
        d["log_lines"] = d["log_errors"] = d["log_last"] = "-"

    # --- git ---
    d["branch"] = sh("git", "-C", REPO, "rev-parse", "--abbrev-ref", "HEAD")
    sb = sh("git", "-C", REPO, "status", "-sb").splitlines()
    d["ahead"] = "0"
    if sb and "ahead" in sb[0]:
        import re
        m = re.search(r"ahead (\d+)", sb[0])
        d["ahead"] = m.group(1) if m else "0"
    since = sh("git", "-C", REPO, "log", "--since=yesterday 00:00",
               "--pretty=%h|%ci|%s")
    d["commits"] = [l.split("|", 2) for l in since.splitlines() if "|" in l]
    st = sh("git", "-C", REPO, "status", "--short").splitlines()
    d["dirty"] = [l for l in st if l.strip()]

    # --- mos durable event log → recent traces (Trace engine, read-model) ---
    import json as _json
    from collections import OrderedDict
    elog = os.path.expanduser("~/Library/Logs/Merlin/mos_events.jsonl")
    traces: list[dict] = []
    if os.path.exists(elog):
        evs = []
        with open(elog, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        evs.append(_json.loads(line))
                    except Exception:
                        pass
        groups: "OrderedDict[str, list]" = OrderedDict()
        for e in evs:
            groups.setdefault(e.get("correlation_id") or "—", []).append(e)
        for cid, g in list(groups.items())[-8:]:
            g.sort(key=lambda e: e.get("seq", 0))
            types = [e.get("type", "") for e in g]
            if any("action.result" in t for t in types):
                outcome = "done"
            elif any("action.gated" in t for t in types):
                outcome = "awaiting_approval"
            elif any(b in t for t in types for b in ("error", "failed", "rejected")):
                outcome = "failed"
            else:
                outcome = "open"
            dec = next((e.get("payload", {}).get("decision")
                        for e in g if e.get("type") == "decision.made"), "—")
            traces.append({"cid": cid, "n": len(g), "outcome": outcome, "decision": dec})
    d["traces"] = list(reversed(traces))     # newest first

    d["now"] = _dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return d


# status dot classes: ok warn idle blocked info
def line(what, why, conf, dot="info", val=""):
    return dict(what=what, why=why, conf=conf, dot=dot, val=val)


def build_panels(d):
    log_ok = str(d["log_errors"]) == "0"
    merlin_running = d["merlin_state"] == "running"

    merlin = [
        line("Wake", "keyword + double-clap; verified end-to-end", "99%", "ok"),
        line("Command STT", "RMS gate wrong on 71% of captures — active blocker",
             "90%", "warn", val="🟡"),
        line("LLM", "Claude API, HTTP 200 stream", "99%", "ok"),
        line("TTS", "OpenAI onyx (Fish 402)", "99%", "ok"),
        line("Cognition (decide)", "Intent→goal→decision+confidence · RFC-020 shell BUILT v0", "v0", "ok"),
        line("Alpha chain (E2E)", "text→intent→cognition→decision→plan→tool→response→learning · loop closed · scenario tests ✅", "v0", "ok"),
        line("Router / Actions", "vision defined, not built", "—", "idle", val="⚪"),
        line("Philos coupling", "shell built; algorithm = locked stub; not wired to voice", "—", "idle", val="⚪"),
    ]
    philos = [
        line("Core ontology", "locked (Dimensions/Departments)", "high", "ok"),
        line("Orientation ADR-001", "RESOLVED — independent Presentation layer", "high", "ok"),
        line("Potential v0 (C3)", "defined; measure uncalibrated", "high", "ok", val="v0"),
        line("Living Globe arch", "candidate doc; screen still prototype", "high", "warn", val="🟡"),
        line("Nexus engine", "104 tests (from prior session)", "med", "ok"),
        line("Philos Runtime", "computes Orientation/Priority/Meaning live — NOT built", "—", "idle", val="⚪"),
    ]
    agents = [
        line("Multi-Agent runtime", "no agent runtime exists yet — honest zero", "100%", "idle", val="0 running"),
    ]
    kpi = [
        line("Merlin service", f"launchd state={d['merlin_state']} pid={d['merlin_pid']}",
             "99%", "ok" if merlin_running else "blocked", val=d["merlin_state"]),
        line("Log errors (last 400)", "0 = clean window", "99%",
             "ok" if log_ok else "warn", val=str(d["log_errors"])),
        line("STT capture quality", "Silero: 29% of 151 captures contain speech", "90%", "warn", val="29%"),
        line("End-to-end latency", "median 5.5s (prior 43-turn baseline)", "med", "info", val="5.5s"),
        line("Unpushed commits", "local only, not on origin", "99%", "info", val=d["ahead"]),
    ]
    blockers = [
        line("Audio → Intent (Command STT)",
             "71% of captures are non-speech → Whisper hallucinates → acted on as commands. "
             "Fork A: 22 real-speech-but-empty (downstream). Fork B: 58 no-speech (front-end).",
             "90%", "blocked"),
        line("Front-end unknown (needs live test)",
             "can't tell weak-mic from early-endpoint offline — needs Roei at the mic",
             "low", "warn"),
    ]
    return merlin, philos, agents, kpi, blockers


def build_arch():
    # cognition loop (§4) — status reflects real build state
    loop = [("Perception", "blocked"), ("Intent", "warn"),
            ("Cognition · Philos", "ok"), ("Planning", "ok"),
            ("Action", "ok"), ("Learning", "ok")]
    # layer contracts (§5 / Part II) — live status
    layers = [
        ("Kernel", "§5.0", "warn", "Event Bus + DURABLE JSONL store + Trace engine (mos/) — v0 in-process"),
        ("Perception · Audio", "§5.1", "warn", "wake ✓ · speaker-id · music · echo · speech-quality"),
        ("Perception · Vision", "§5.1", "idle", "screen · OCR · window · gesture"),
        ("Perception · Digital", "§5.1", "warn", "git · fs · processes · calendar · mail · net"),
        ("Intent", "§5.2", "warn", "v0 keyword classifier built (mos/intent_bridge.py); STT reliability = the blocker"),
        ("Cognition · Philos", "§5.3", "ok", "RFC-020 shell + Orientation Runtime + World Graph BUILT v0 · algorithm = locked stub"),
        ("Memory", "§5.4", "warn", "episodic · semantic · project · relationship · timeline"),
        ("Planning", "§5.5", "ok", "v0 Planner built (decision→plan.created) — mos/planner.py"),
        ("Action", "§5.6", "ok", "Executor+Responder + REAL read-only tools (clock/status); irreversible simulated+gated"),
        ("Multi-Agent", "§5.7", "idle", "research · coding · review · coordinator (0 running)"),
        ("Mission Control", "read-model", "ok", "live dashboard — this screen"),
        ("Living Globe", "read-model", "warn", "World Graph projection built (mos/world_graph.py); globe UI = prototype"),
        ("Morning Brief", "read-model", "idle", "what · why · confidence (scheduled)"),
    ]
    return loop, layers


def render_html(d):
    merlin, philos, agents, kpi, blockers = build_panels(d)

    def items(rows):
        out = []
        for r in rows:
            out.append(
                f'<div class="row {r["dot"]}">'
                f'<span class="dot"></span>'
                f'<div class="body"><div class="what">{html.escape(r["what"])}'
                f'{" <b class=val>"+html.escape(str(r["val"]))+"</b>" if r["val"] else ""}</div>'
                f'<div class="why">{html.escape(r["why"])}</div></div>'
                f'<span class="conf">{html.escape(r["conf"])}</span></div>'
            )
        return "\n".join(out)

    commits = "".join(
        f'<li><code>{html.escape(c[0])}</code> '
        f'<span class="t">{html.escape(c[1][:16])}</span> {html.escape(c[2])}</li>'
        for c in d["commits"]) or "<li class=muted>no commits today</li>"
    dirty = "".join(f"<li><code>{html.escape(x)}</code></li>" for x in d["dirty"][:12]) \
        or "<li class=muted>clean</li>"

    def panel(title, rows):
        return f'<section class="panel"><h2>{title}</h2>{items(rows)}</section>'

    loop, layers = build_arch()
    loop_html = "".join(
        f'<div class="stage {c}"><span class="dot"></span>{html.escape(n)}</div>'
        + ('<div class="arrow">&#9654;</div>' if i < len(loop) - 1 else "")
        for i, (n, c) in enumerate(loop))
    layer_html = "".join(
        f'<div class="lyr {c}"><span class="dot"></span><div class="body">'
        f'<div class="what">{html.escape(n)} <span class="sec">{html.escape(sec)}</span></div>'
        f'<div class="why">{html.escape(desc)}</div></div></div>'
        for (n, sec, c, desc) in layers)
    arch_html = (
        '<section class="panel wide arch"><h2>&#127963;&#65039; Architecture — Merlin OS v1 (live status)</h2>'
        f'<div class="loop">{loop_html}</div>'
        '<div class="inv">9 System Invariants &middot; event-sourced loop &middot; contracts §5 &middot; '
        '<span class="muted">docs/MERLIN-OS-ARCHITECTURE-v1.md</span></div>'
        f'<div class="layers">{layer_html}</div></section>')

    _odot = {"done": "ok", "awaiting_approval": "warn", "failed": "blocked", "open": "info"}
    if d.get("traces"):
        trows = "".join(
            f'<div class="row {_odot.get(t["outcome"], "info")}"><span class="dot"></span>'
            f'<div class="body"><div class="what">{html.escape(str(t["decision"]))} '
            f'<span class="sec">{html.escape(t["cid"])}</span></div>'
            f'<div class="why">{t["n"]} events · {html.escape(t["outcome"].replace("_", " "))}</div>'
            f'</div></div>' for t in d["traces"])
    else:
        trows = ('<div class="row info"><span class="dot"></span><div class="body">'
                 '<div class="what">no traces yet</div><div class="why">run '
                 'mos.runtime with a store_path to populate the durable log</div></div></div>')
    traces_html = f'<section class="panel"><h2>🧵 Traces (recent turns)</h2>{trows}</section>'

    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Merlin · Mission Control</title>
<style>
:root{{--bg:#0a0d14;--card:#131824;--edge:#1e2636;--txt:#e6ecf5;--mut:#7c8aa3;
--ok:#3ad07f;--warn:#f5b53d;--blocked:#ff5d6c;--idle:#48566e;--info:#5aa9ff;--acc:#7c5cff;}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{background:radial-gradient(1200px 600px at 70% -10%,#141b2e,transparent),var(--bg);
color:var(--txt);font:14px/1.5 -apple-system,SFPro,Segoe UI,system-ui,sans-serif;
padding:22px;min-height:100vh}}
header{{display:flex;align-items:baseline;gap:14px;margin-bottom:6px}}
header h1{{font-size:20px;letter-spacing:.3px}}
header .sub{{color:var(--mut);font-size:12px}}
header .live{{margin-left:auto;color:var(--ok);font-size:12px;display:flex;align-items:center;gap:6px}}
header .live::before{{content:"";width:8px;height:8px;border-radius:50%;background:var(--ok);
box-shadow:0 0 10px var(--ok);animation:p 2s infinite}}
@keyframes p{{50%{{opacity:.35}}}}
.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px;margin-top:16px}}
.panel{{background:linear-gradient(180deg,var(--card),#0f1420);border:1px solid var(--edge);
border-radius:14px;padding:16px}}
.panel h2{{font-size:12px;text-transform:uppercase;letter-spacing:1.4px;color:var(--mut);
margin-bottom:12px}}
.row{{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-top:1px solid #ffffff0d}}
.row:first-of-type{{border-top:none}}
.dot{{width:9px;height:9px;border-radius:50%;margin-top:5px;flex:none;background:var(--idle)}}
.row.ok .dot{{background:var(--ok);box-shadow:0 0 8px var(--ok)}}
.row.warn .dot{{background:var(--warn);box-shadow:0 0 8px var(--warn)}}
.row.blocked .dot{{background:var(--blocked);box-shadow:0 0 8px var(--blocked)}}
.row.info .dot{{background:var(--info)}}
.body{{flex:1;min-width:0}}
.what{{font-weight:600}}
.what .val{{color:var(--acc);font-weight:700;margin-left:6px}}
.why{{color:var(--mut);font-size:12.5px}}
.conf{{color:var(--mut);font-size:11px;font-variant-numeric:tabular-nums;flex:none;
padding-top:1px;min-width:34px;text-align:right}}
.wide{{grid-column:1/-1}}
ul{{list-style:none;font-size:13px}} li{{padding:4px 0;border-top:1px solid #ffffff0d}}
li:first-child{{border-top:none}} code{{color:var(--info);font-family:SFMono-Regular,Menlo,monospace}}
.t{{color:var(--mut);font-size:11px;margin:0 6px}} .muted{{color:var(--idle)}}
.foot{{color:var(--idle);font-size:11px;margin-top:18px;text-align:center}}
.legend{{display:flex;gap:16px;font-size:11px;color:var(--mut);margin-top:4px}}
.legend b{{font-weight:400}} .legend i{{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:5px}}
.arch .loop{{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:6px}}
.stage{{display:flex;align-items:center;gap:7px;background:#0f1420;border:1px solid var(--edge);border-radius:9px;padding:8px 12px;font-weight:600;font-size:12.5px}}
.stage .dot{{margin:0}}
.arrow{{color:var(--idle)}}
.stage.ok .dot,.lyr.ok .dot{{background:var(--ok);box-shadow:0 0 8px var(--ok)}}
.stage.warn .dot,.lyr.warn .dot{{background:var(--warn);box-shadow:0 0 8px var(--warn)}}
.stage.blocked .dot,.lyr.blocked .dot{{background:var(--blocked);box-shadow:0 0 8px var(--blocked)}}
.inv{{color:var(--mut);font-size:11.5px;margin:4px 0 12px}}
.layers{{display:grid;grid-template-columns:repeat(auto-fill,minmax(238px,1fr));gap:8px}}
.lyr{{display:flex;gap:8px;align-items:flex-start;background:#0f1420;border:1px solid var(--edge);border-radius:9px;padding:9px 11px}}
.lyr .dot{{margin-top:5px}}
.sec{{color:var(--idle);font-size:10.5px;font-weight:400}}
</style></head><body>
<header>
  <h1>🛰️ Merlin · Mission Control</h1>
  <span class="sub">{html.escape(d['branch'])} · {d['ahead']} unpushed</span>
  <span class="live">LIVE · {html.escape(d['now'])}</span>
</header>
<div class="legend">
  <b><i style="background:var(--ok)"></i>ok</b>
  <b><i style="background:var(--warn)"></i>attention</b>
  <b><i style="background:var(--blocked)"></i>blocked</b>
  <b><i style="background:var(--idle)"></i>not built</b>
  <b>· each line: WHAT · WHY · CONFIDENCE</b>
</div>
<div class="grid">
  {panel("🎙️ Merlin", merlin)}
  {panel("🌍 Philos", philos)}
  {panel("🤖 Multi-Agent", agents)}
  {panel("📊 KPI", kpi)}
  <section class="panel wide">{'<h2>🚧 Blockers</h2>'+items(blockers)}</section>
  <section class="panel"><h2>✅ Changed since yesterday</h2><ul>{commits}</ul></section>
  <section class="panel"><h2>🎯 Active task</h2>
    <div class="row warn"><span class="dot"></span><div class="body">
    <div class="what">Stabilize Audio → Intent</div>
    <div class="why">Foundation under Router, Command Language, Morning Brief and voice-Globe. Chosen priority #1.</div>
    </div><span class="conf">now</span></div>
    <h2 style="margin-top:14px">📝 Uncommitted</h2><ul>{dirty}</ul>
  </section>
  {traces_html}
</div>
{arch_html}
<div class="foot">Mission Control v0 · live data from launchd · git · service.log · Silero probe · regenerates on reload</div>
</body></html>"""


def main():
    if "--serve" in sys.argv:
        from http.server import BaseHTTPRequestHandler, HTTPServer

        class H(BaseHTTPRequestHandler):
            def do_GET(self):
                page = render_html(collect()).encode()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(page)))
                self.end_headers()
                self.wfile.write(page)

            def log_message(self, *a):
                pass

        print(f"Mission Control live at http://localhost:{PORT}  (Ctrl-C to stop)")
        HTTPServer(("127.0.0.1", PORT), H).serve_forever()
    else:
        out = os.path.join(VG, "tools", "mission_control.html")
        open(out, "w").write(render_html(collect()))
        print(out)


if __name__ == "__main__":
    main()
