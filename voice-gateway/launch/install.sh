#!/usr/bin/env bash
# Install Merlin as a macOS LaunchAgent.
# Merlin starts automatically at login, runs in the background, no terminal.
#
# Usage:
#   cd voice-gateway
#   ./launch/install.sh
#
# To uninstall:
#   ./launch/uninstall.sh

set -euo pipefail

VOICE_GATEWAY="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="com.merlin.voice"
PLIST_DEST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/Merlin"
SERVICE="$VOICE_GATEWAY/service/merlin_service.py"

# ── Find Python ───────────────────────────────────────────────────────────────
# Prefer virtualenv, then homebrew, then system.
PYTHON=""
for candidate in \
    "$VOICE_GATEWAY/.venv/bin/python3" \
    "/opt/homebrew/bin/python3" \
    "/usr/local/bin/python3" \
    "$(command -v python3 2>/dev/null)"; do
  if [[ -x "$candidate" ]]; then
    PYTHON="$candidate"
    break
  fi
done

if [[ -z "$PYTHON" ]]; then
  echo "Python 3 not found. Install via: brew install python"
  exit 1
fi
echo "Using Python: $PYTHON"

# ── Check .env ────────────────────────────────────────────────────────────────
if [[ ! -f "$VOICE_GATEWAY/.env" ]]; then
  echo ""
  echo "  No .env found. Run from voice-gateway/:"
  echo "    cp .env.example .env"
  echo "    nano .env   # fill in ANTHROPIC_API_KEY and OPENAI_API_KEY"
  echo ""
  exit 1
fi

# ── Check dependencies ────────────────────────────────────────────────────────
if ! "$PYTHON" -c "import sounddevice, anthropic, openai" 2>/dev/null; then
  echo ""
  echo "  Missing dependencies. Run from voice-gateway/:"
  echo "    pip install -r requirements.txt"
  echo "    pip install -r requirements-service.txt"
  echo "  On macOS, if sounddevice fails: brew install portaudio"
  echo ""
  exit 1
fi

# ── Microphone permission check ───────────────────────────────────────────────
echo ""
echo "  ⚠  macOS microphone permission:"
echo "  On first run, macOS may block microphone access for background services."
echo "  If Merlin doesn't hear you, run this ONCE from a terminal:"
echo "    $PYTHON $SERVICE"
echo "  macOS will prompt for microphone access. Allow it, then Ctrl+C."
echo "  After that, the LaunchAgent will have permission."
echo ""

# ── Create log directory ──────────────────────────────────────────────────────
mkdir -p "$LOG_DIR"

# ── Unload existing agent if present ──────────────────────────────────────────
if [[ -f "$PLIST_DEST" ]]; then
  launchctl unload "$PLIST_DEST" 2>/dev/null || true
fi

# ── Write plist ───────────────────────────────────────────────────────────────
cat > "$PLIST_DEST" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LABEL}</string>

    <key>ProgramArguments</key>
    <array>
        <string>${PYTHON}</string>
        <string>${SERVICE}</string>
    </array>

    <key>WorkingDirectory</key>
    <string>${VOICE_GATEWAY}</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>ThrottleInterval</key>
    <integer>5</integer>

    <key>StandardOutPath</key>
    <string>${LOG_DIR}/service.log</string>

    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/service.log</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
        <key>HOME</key>
        <string>${HOME}</string>
    </dict>
</dict>
</plist>
PLIST

# ── Load the agent ────────────────────────────────────────────────────────────
launchctl load "$PLIST_DEST"

echo "  ✓  Merlin installed and running."
echo ""
echo "  Logs:     tail -f $LOG_DIR/service.log"
echo "  Status:   launchctl list | grep merlin"
echo "  Stop:     launchctl unload $PLIST_DEST"
echo "  Remove:   $VOICE_GATEWAY/launch/uninstall.sh"
echo ""
