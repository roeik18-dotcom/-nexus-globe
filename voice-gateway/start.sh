#!/usr/bin/env bash
# Jarvis voice loop — one command to start everything.
# Usage: ./start.sh [--free]
#
# --free : use macOS `say` for TTS (no OpenAI key needed for TTS)
#
# First time:
#   cp .env.example .env
#   nano .env          # fill in ANTHROPIC_API_KEY and OPENAI_API_KEY
#   pip install -r requirements.txt
#   pip install -r requirements-client.txt
#   ./start.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Parse flags ────────────────────────────────────────────────────────────────
FREE_TTS=0
for arg in "$@"; do
  [[ "$arg" == "--free" ]] && FREE_TTS=1
done

# ── Check .env ─────────────────────────────────────────────────────────────────
if [[ ! -f .env ]]; then
  echo ""
  echo "  No .env file found."
  echo "  Run:  cp .env.example .env"
  echo "  Then fill in your API keys and run ./start.sh again."
  echo ""
  exit 1
fi

# ── Apply --free flag (macOS say, no OpenAI TTS key needed) ───────────────────
if [[ "$FREE_TTS" -eq 1 ]]; then
  echo "  Using macOS 'say' for TTS (--free mode)."
  export TTS_PROVIDER=system
fi

# ── Check Python ───────────────────────────────────────────────────────────────
if ! command -v python3 &>/dev/null && ! command -v python &>/dev/null; then
  echo "Python not found. Install Python 3.11+ first."
  exit 1
fi
PYTHON="${PYTHON:-python3}"
command -v python3 &>/dev/null && PYTHON=python3

# ── Check dependencies ─────────────────────────────────────────────────────────
if ! "$PYTHON" -c "import fastapi, anthropic, openai" 2>/dev/null; then
  echo ""
  echo "  Missing server dependencies. Run:"
  echo "    pip install -r requirements.txt"
  echo "    pip install -r requirements-client.txt"
  echo ""
  exit 1
fi
if ! "$PYTHON" -c "import sounddevice, pynput" 2>/dev/null; then
  echo ""
  echo "  Missing client dependencies. Run:"
  echo "    pip install -r requirements-client.txt"
  echo "  On macOS, if sounddevice fails: brew install portaudio"
  echo ""
  exit 1
fi

# ── Load .env for key validation ───────────────────────────────────────────────
# (uvicorn also loads it; we load here just to give a friendly error early)
set -a
# shellcheck source=/dev/null
source .env
set +a

if [[ -z "${ADAPTER:-}" || "${ADAPTER}" == "echo" ]]; then
  echo ""
  echo "  ADAPTER is 'echo' or unset in .env — Jarvis will just repeat what you say."
  echo "  Set ADAPTER=claude and fill in ANTHROPIC_API_KEY for real responses."
  echo ""
fi

# ── Start server ───────────────────────────────────────────────────────────────
echo ""
echo "  Starting Jarvis voice server…"
uvicorn app.main:app --host 127.0.0.1 --port 8765 --log-level warning &
SERVER_PID=$!

# Wait for the server to be ready (up to 10 s)
for i in {1..20}; do
  sleep 0.5
  if "$PYTHON" -c "
import urllib.request, sys
try:
    urllib.request.urlopen('http://127.0.0.1:8765/health', timeout=1)
    sys.exit(0)
except Exception:
    sys.exit(1)
" 2>/dev/null; then
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "  Server failed to start. Check the logs above."
    exit 1
  fi
done

echo "  Server ready."
echo ""
echo "  ┌─────────────────────────────────────────────┐"
echo "  │                                             │"
echo "  │   Hold SPACE to speak. Release to send.    │"
echo "  │   Press Ctrl+C to quit.                    │"
echo "  │                                             │"
echo "  └─────────────────────────────────────────────┘"
echo ""

# ── Start client (foreground) ──────────────────────────────────────────────────
trap 'kill "$SERVER_PID" 2>/dev/null; echo ""; echo "  Jarvis offline."; exit 0' INT TERM
"$PYTHON" client/push_to_talk.py
kill "$SERVER_PID" 2>/dev/null
