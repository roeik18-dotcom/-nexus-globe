"""CLI — build/refresh the index and query it from the shell.

  python -m project_knowledge.cli reindex [--root PATH] [--force]
  python -m project_knowledge.cli search "מה מצב Philos" [--project ...] [--limit 8]
  python -m project_knowledge.cli projects
  python -m project_knowledge.cli sources "Merlin / voice-gateway"
  python -m project_knowledge.cli stats
"""
from __future__ import annotations
import argparse
import json

from . import api, observability
from .indexer import reindex


def main(argv=None):
    ap = argparse.ArgumentParser(prog="project_knowledge")
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("reindex"); r.add_argument("--root"); r.add_argument("--force", action="store_true")
    s = sub.add_parser("search"); s.add_argument("query"); s.add_argument("--project"); s.add_argument("--limit", type=int, default=8)
    sub.add_parser("projects")
    so = sub.add_parser("sources"); so.add_argument("project")
    sub.add_parser("stats")
    a = ap.parse_args(argv)

    if a.cmd == "reindex":
        print(json.dumps(reindex(root=a.root, force=a.force), ensure_ascii=False, indent=2))
    elif a.cmd == "search":
        env = api.answer_context(a.query, project=a.project, limit=a.limit)
        print(f"status={env['status']}  latency_ms={env['latency_ms']}")
        for i, s_ in enumerate(env["sources"], 1):
            print(f"  {i}. score={s_['score']}  {s_['path']}:{s_['line_start']}-{s_['line_end']}  «{s_['heading'][:50]}»")
        if env["status"] == "UNKNOWN":
            print("  ->", env["instruction"])
    elif a.cmd == "projects":
        print(json.dumps(api.projects(), ensure_ascii=False, indent=2))
    elif a.cmd == "sources":
        rows = api.sources(a.project)
        print(f"{len(rows)} sources in «{a.project}»")
        for r in rows[:200]:
            print(f"  {r['path']}")
    elif a.cmd == "stats":
        print(json.dumps(observability.stats(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
