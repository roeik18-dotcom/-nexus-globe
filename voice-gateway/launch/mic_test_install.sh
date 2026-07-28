#!/usr/bin/env bash
# Install a minimal LaunchAgent that only runs the sounddevice mic sanity test.
#
# Purpose: confirm whether *any* LaunchAgent on this machine receives mic audio,
# independent of Merlin code.
#
# Usage:
#   cd voice-gateway
#   ./launch/mic_test_install.sh [--interactive]
#
# --interactive  adds ProcessType=Interactive to the plist (the suspected fix).
#                Omit to reproduce the current Merlin plist exactly (no ProcessType).
#
# After 30 s the script exits and you can compare:
#   grep 'max=' ~/Library/Logs/Merlin/mic-test.log

set -uo pipefail

VOICE_GATEWAY="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="com.merlin.mic-test"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/Merlin"
LOG_FILE="$LOG_DIR/mic-test.log"
SCRIPT="$VOICE_GATEWAY/launch/mic_test.py"
GUI_DOMAIN="gui/$(id -u)"

# ── Python ──────────────────────────────────────────────────────────────────
PYTHON=""
for candidate in \
    "$VOICE_GATEWAY/.venv/bin/python3" \
    "/opt/homebrew/bin/python3" \
    "/usr/local/bin/python3" \
    "$(command -v python3 2>/dev/null || true)"; do
  if [[ -n "$candidate" && -x "$candidate" ]]; then
    PYTHON="$candidate"; break
  fi
done
[[ -n "$PYTHON" ]] || { echo "Python 3 not found."; exit 1; }

# ── ProcessType flag ─────────────────────────────────────────────────────────
PROCESS_TYPE_BLOCK=""
if [[ "${1:-}" == "--interactive" ]]; then
  PROCESS_TYPE_BLOCK="
    <key>ProcessType</key>
    <string>Interactive</string>
"
  echo "Mode: ProcessType=Interactive"
else
  echo "Mode: no ProcessType (Standard — reproduces current Merlin plist)"
fi

mkdir -p "$LOG_DIR" "$HOME/Library/LaunchAgents"
: > "$LOG_FILE"   # truncate log

# ── Write plist ──────────────────────────────────────────────────────────────
cat > "$PLIST" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LABEL}</string>

    <key>ProgramArguments</key>
    <array>
        <string>${PYTHON}</string>
        <string>${SCRIPT}</string>
    </array>

    <key>WorkingDirectory</key>
    <string>${VOICE_GATEWAY}</string>
    ${PROCESS_TYPE_BLOCK}
    <key>RunAtLoad</key>
    <true/>

    <key>StandardOutPath</key>
    <string>${LOG_FILE}</string>

    <key>StandardErrorPath</key>
    <string>${LOG_FILE}</string>

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

echo "Plist: $PLIST"
echo "Log:   $LOG_FILE"

# ── Boot ─────────────────────────────────────────────────────────────────────
launchctl bootout "$GUI_DOMAIN" "$PLIST" 2>/dev/null || true
sleep 1
launchctl bootstrap "$GUI_DOMAIN" "$PLIST"
echo "Launched — waiting 35 s for 30 s test to complete…"
sleep 35

# ── Results ──────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════"
echo "  mic_test results (grep max=)"
echo "══════════════════════════════════════════════════════"
grep "max=" "$LOG_FILE" | tail -20

echo ""
echo "══════════════════════════════════════════════════════"
echo "  Full log:"
echo "  cat $LOG_FILE"
echo ""
echo "  Uninstall:"
echo "  launchctl bootout $GUI_DOMAIN $PLIST && rm $PLIST"
echo "══════════════════════════════════════════════════════"
