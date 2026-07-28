#!/usr/bin/env bash
# Install Merlin as a macOS LaunchAgent and verify it is running.
#
# Usage:
#   cd voice-gateway
#   ./launch/install.sh
#
# To uninstall:
#   ./launch/uninstall.sh

set -uo pipefail   # no -e so we can print diagnostics on failure

VOICE_GATEWAY="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="com.merlin.voice"
PLIST_DEST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/Merlin"
LOG_FILE="$LOG_DIR/service.log"
SERVICE="$VOICE_GATEWAY/service/merlin_service.py"
GUI_DOMAIN="gui/$(id -u)"

PASS="✓"
FAIL="✗"

step() { echo; echo "── $1"; }
ok()   { echo "  $PASS  $1"; }
err()  { echo "  $FAIL  $1" >&2; }
die()  { err "$1"; exit 1; }


# ── Step 1: Find Python ───────────────────────────────────────────────────────

step "Step 1 — Python"

PYTHON=""
for candidate in \
    "$VOICE_GATEWAY/.venv/bin/python3" \
    "/opt/homebrew/bin/python3" \
    "/usr/local/bin/python3" \
    "$(command -v python3 2>/dev/null || true)"; do
  if [[ -n "$candidate" && -x "$candidate" ]]; then
    PYTHON="$candidate"
    break
  fi
done

[[ -n "$PYTHON" ]] || die "Python 3 not found. Install via: brew install python"
ok "Python: $PYTHON ($("$PYTHON" --version 2>&1))"


# ── Step 2: Check .env ────────────────────────────────────────────────────────

step "Step 2 — .env"

if [[ ! -f "$VOICE_GATEWAY/.env" ]]; then
  die ".env not found. Run from voice-gateway/:
    cp .env.example .env
    nano .env   # fill in ANTHROPIC_API_KEY and OPENAI_API_KEY"
fi
ok ".env present at $VOICE_GATEWAY/.env"

# Warn about missing keys (don't abort — service logs its own errors)
if ! grep -qE '^OPENAI_API_KEY=.+' "$VOICE_GATEWAY/.env"; then
  err "OPENAI_API_KEY not set in .env — keyword ('Hi Merlin') detection will be disabled"
fi
if ! grep -qE '^ANTHROPIC_API_KEY=.+' "$VOICE_GATEWAY/.env"; then
  err "ANTHROPIC_API_KEY not set in .env — conversation will not work"
fi


# ── Step 3: Check dependencies ────────────────────────────────────────────────

step "Step 3 — Python dependencies"

if ! "$PYTHON" -c "import sounddevice, anthropic, openai, numpy, scipy" 2>/dev/null; then
  echo "  Missing packages. Run from voice-gateway/:"
  echo "    pip install -r requirements.txt"
  echo "    pip install -r requirements-service.txt"
  echo "  If sounddevice fails:  brew install portaudio && pip install sounddevice"
  # Run again to show which package is missing
  "$PYTHON" -c "import sounddevice, anthropic, openai, numpy, scipy" 2>&1 | sed 's/^/    /'
  exit 1
fi
ok "sounddevice, anthropic, openai, numpy, scipy all importable"


# ── Step 4: Create log directory ──────────────────────────────────────────────

step "Step 4 — Log directory"

mkdir -p "$LOG_DIR"
ok "Log directory: $LOG_DIR"


# ── Step 5: Write plist ───────────────────────────────────────────────────────

step "Step 5 — LaunchAgent plist"

mkdir -p "$HOME/Library/LaunchAgents"

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

    <key>ProcessType</key>
    <string>Interactive</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>ThrottleInterval</key>
    <integer>5</integer>

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

ok "Plist written to $PLIST_DEST"


# ── Step 6: Bootstrap the agent ───────────────────────────────────────────────

step "Step 6 — LaunchAgent registration"

# Bootout any stale registration first (ignore errors — it may not be loaded)
launchctl bootout "$GUI_DOMAIN" "$PLIST_DEST" 2>/dev/null || true
sleep 1

# Bootstrap (modern macOS way — works on Catalina through Sonoma)
if launchctl bootstrap "$GUI_DOMAIN" "$PLIST_DEST"; then
  ok "Bootstrapped $LABEL"
else
  # Fall back to deprecated load for very old macOS
  echo "  bootstrap failed — trying legacy launchctl load"
  launchctl load "$PLIST_DEST" || die "launchctl load also failed — check plist at $PLIST_DEST"
  ok "Loaded $LABEL (legacy)"
fi


# ── Step 7: Wait for process to appear ────────────────────────────────────────

step "Step 7 — Process startup"

echo "  Waiting for service to start (up to 15 s)…"
pid=""
for i in $(seq 1 15); do
  sleep 1
  pid=$(launchctl list "$LABEL" 2>/dev/null | awk '/"PID"/ {gsub(/[^0-9]/,"",$3); print $3}')
  if [[ -n "$pid" && "$pid" != "0" ]]; then
    break
  fi
  printf "  [%d/15]\r" "$i"
done

if [[ -n "$pid" && "$pid" != "0" ]]; then
  ok "Process running — PID $pid"
else
  echo
  err "Service did not start within 15 s"
  echo "  Last launchctl status:"
  launchctl list "$LABEL" 2>&1 | sed 's/^/    /' || true
  echo "  Check the log for errors (step 8 below)"
fi


# ── Step 8: Verify log file ───────────────────────────────────────────────────

step "Step 8 — Log file"

echo "  Waiting for log file (up to 10 s)…"
for i in $(seq 1 10); do
  if [[ -s "$LOG_FILE" ]]; then
    break
  fi
  sleep 1
  printf "  [%d/10]\r" "$i"
done
echo

if [[ -s "$LOG_FILE" ]]; then
  ok "Log file exists: $LOG_FILE"
  echo
  echo "  ── Last 30 log lines ──────────────────────────────────────"
  tail -30 "$LOG_FILE" | sed 's/^/  /'
  echo "  ────────────────────────────────────────────────────────────"
else
  err "Log file empty or missing after 10 s — likely a crash on startup"
  echo "  Try running manually to see the error:"
  echo "    $PYTHON $SERVICE"
fi


# ── Step 9: Verify wake mode in log ──────────────────────────────────────────

step "Step 9 — Wake mode confirmation"

sleep 2  # give service another moment to log startup

if grep -q "Wake mode" "$LOG_FILE" 2>/dev/null; then
  wake_line=$(grep "Wake mode" "$LOG_FILE" | tail -1)
  ok "$wake_line"
else
  err "No 'Wake mode' line in log yet — keyword detection may not have started"
  echo "  Wait a few seconds, then run:"
  echo "    grep 'Wake mode' $LOG_FILE"
fi


# ── Step 10: Microphone stream (best-effort check) ───────────────────────────

step "Step 10 — Microphone"

echo "  Listening for 'sounddevice' references in log…"
if grep -qi "sounddevice\|portaudio\|mic\|stream" "$LOG_FILE" 2>/dev/null; then
  err "sounddevice error in log — see Step 8 output above"
else
  ok "No sounddevice errors in log"
fi

echo
echo "  ⚠  macOS microphone permission note:"
echo "  If 'Hi Merlin' produces nothing, grant mic access once from Terminal:"
echo "    $PYTHON $SERVICE"
echo "  Allow the macOS prompt, then Ctrl+C. The LaunchAgent will inherit permission."
echo


# ── Done ─────────────────────────────────────────────────────────────────────

echo "══════════════════════════════════════════════════════════════"
echo "  Merlin is installed."
echo
echo "  Say 'Hi Merlin' or double-clap to wake."
echo
echo "  Monitor:  tail -f $LOG_FILE"
echo "  Status:   launchctl list $LABEL"
echo "  Restart:  launchctl kickstart -k $GUI_DOMAIN/$LABEL"
echo "  Remove:   $VOICE_GATEWAY/launch/uninstall.sh"
echo "══════════════════════════════════════════════════════════════"
