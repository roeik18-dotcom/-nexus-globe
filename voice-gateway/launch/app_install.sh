#!/usr/bin/env bash
# Install (or reinstall) the Merlin LaunchAgent pointing at Merlin.app.
#
# WHY NOT install.sh?
# ───────────────────
# install.sh sets ProgramArguments to [python3, merlin_service.py].
# When launchd spawns python3 directly, macOS TCC sees no bundle ID in the
# responsible-process chain and delivers silence from CoreAudio.
#
# This script sets ProgramArguments to [Merlin.app/Contents/MacOS/Merlin],
# so macOS assigns CFBundleIdentifier=com.merlin.voice as the responsible
# client — the same bundle that received the microphone grant when you ran
# `open Merlin.app` and clicked Allow.
#
# PREREQUISITES
# ─────────────
#   1. build_app.sh  — builds ~/Applications/Merlin.app
#   2. open ~/Applications/Merlin.app  — user clicks Allow in TCC dialog
#   3. check_tcc.sh  — confirms com.merlin.voice has auth_value=2
#
# USAGE
# ─────
#   cd voice-gateway
#   ./launch/app_install.sh

set -uo pipefail

VOICE_GATEWAY="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$HOME/Applications/Merlin.app"
EXEC="$APP_DIR/Contents/MacOS/Merlin"
LABEL="com.merlin.voice"
PLIST_DEST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/Merlin"
LOG_FILE="$LOG_DIR/service.log"
GUI_DOMAIN="gui/$(id -u)"

PASS="✓"
FAIL="✗"

step() { echo; echo "── $1"; }
ok()   { echo "  $PASS  $1"; }
err()  { echo "  $FAIL  $1" >&2; }
die()  { err "$1"; exit 1; }


# ── Step 1: Verify Merlin.app exists ─────────────────────────────────────────

step "Step 1 — Merlin.app"

[[ -x "$EXEC" ]] || die "Merlin.app not found at $APP_DIR.
Run first:  $VOICE_GATEWAY/launch/build_app.sh"
ok "Merlin.app found: $EXEC"


# ── Step 2: Check .env ────────────────────────────────────────────────────────

step "Step 2 — .env"

if [[ ! -f "$VOICE_GATEWAY/.env" ]]; then
  die ".env not found. Run from voice-gateway/:
    cp .env.example .env
    nano .env   # fill in ANTHROPIC_API_KEY and OPENAI_API_KEY"
fi
ok ".env present"

if ! grep -qE '^OPENAI_API_KEY=.+' "$VOICE_GATEWAY/.env"; then
  err "OPENAI_API_KEY not set — keyword detection will be disabled"
fi
if ! grep -qE '^ANTHROPIC_API_KEY=.+' "$VOICE_GATEWAY/.env"; then
  err "ANTHROPIC_API_KEY not set — conversation will not work"
fi


# ── Step 3: Create log directory ──────────────────────────────────────────────

step "Step 3 — Log directory"

mkdir -p "$LOG_DIR"
ok "Log directory: $LOG_DIR"


# ── Step 4: Write plist ───────────────────────────────────────────────────────

step "Step 4 — LaunchAgent plist"

mkdir -p "$HOME/Library/LaunchAgents"

# ProgramArguments points at the app bundle executable, NOT python3 directly.
# This is what makes macOS assign com.merlin.voice as the TCC responsible client.
cat > "$PLIST_DEST" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LABEL}</string>

    <key>ProgramArguments</key>
    <array>
        <string>${EXEC}</string>
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

ok "Plist written: $PLIST_DEST"
ok "ProgramArguments → $EXEC"


# ── Step 5: (Re)register the agent ───────────────────────────────────────────

step "Step 5 — LaunchAgent registration"

launchctl bootout "$GUI_DOMAIN" "$PLIST_DEST" 2>/dev/null || true
sleep 1

if launchctl bootstrap "$GUI_DOMAIN" "$PLIST_DEST"; then
  ok "Bootstrapped $LABEL"
else
  echo "  bootstrap failed — trying legacy launchctl load"
  launchctl load "$PLIST_DEST" || die "launchctl load also failed"
  ok "Loaded $LABEL (legacy)"
fi


# ── Step 6: Wait for process ──────────────────────────────────────────────────

step "Step 6 — Process startup"

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
  launchctl list "$LABEL" 2>&1 | sed 's/^/    /' || true
fi


# ── Step 7: Verify audio in log ──────────────────────────────────────────────

step "Step 7 — Audio sanity (wait up to 15 s for [sanity] lines)"

for i in $(seq 1 15); do
  if grep -q '\[sanity\]' "$LOG_FILE" 2>/dev/null; then
    break
  fi
  sleep 1
  printf "  [%d/15]\r" "$i"
done
echo

if grep -q '\[sanity\] max=' "$LOG_FILE" 2>/dev/null; then
  echo "  Recent [sanity] max= lines:"
  grep '\[sanity\] max=' "$LOG_FILE" | tail -5 | sed 's/^/    /'
  peak=$(grep '\[sanity\] max=' "$LOG_FILE" | awk -F'max=' '{print $2}' | sort -rn | head -1)
  if [[ "${peak%%.*}" -gt 0 ]] 2>/dev/null; then
    ok "Audio received! peak=$peak — TCC grant is working"
  else
    err "Audio is still zero (peak=$peak)"
    echo "  Check that you have run: open \"$APP_DIR\" and clicked Allow"
    echo "  Then verify: $VOICE_GATEWAY/launch/check_tcc.sh"
  fi
else
  err "No [sanity] lines in log yet — check $LOG_FILE manually"
fi

echo
echo "  Last 20 log lines:"
tail -20 "$LOG_FILE" 2>/dev/null | sed 's/^/  /' || true


# ── Done ─────────────────────────────────────────────────────────────────────

echo
echo "══════════════════════════════════════════════════════════════"
echo "  LaunchAgent reinstalled (ProgramArguments → Merlin.app)."
echo
echo "  Monitor:  tail -f $LOG_FILE"
echo "  Status:   launchctl list $LABEL"
echo "  Restart:  launchctl kickstart -k $GUI_DOMAIN/$LABEL"
echo "  Remove:   $VOICE_GATEWAY/launch/uninstall.sh"
echo "══════════════════════════════════════════════════════════════"
