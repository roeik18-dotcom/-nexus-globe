#!/usr/bin/env bash
# Install (or reinstall) the Merlin LaunchAgent pointing at Merlin.app.
#
# WHY NOT install.sh?
# ───────────────────
# install.sh sets ProgramArguments to [python3, merlin_service.py].
# When launchd spawns python3 directly, TCC has no bundle ID in the
# responsible-process chain → CoreAudio delivers silence.
#
# This script sets ProgramArguments to [Merlin.app/Contents/MacOS/Merlin].
# macOS attributes the process to CFBundleIdentifier=com.merlin.voice, which
# was granted microphone access when you ran `open Merlin.app` and clicked Allow.
# The compiled launcher reads MERLIN_PYTHON and MERLIN_SERVICE from env vars
# (set in EnvironmentVariables below) and execs python3.
#
# PREREQUISITES — run in order:
#   1. ./launch/build_app.sh
#   2. open ~/Applications/Merlin.app   → click Allow
#   3. ./launch/check_tcc.sh            → confirm auth_value=2
#   4. ./launch/app_install.sh          (this script)
#
# USAGE
#   cd voice-gateway && ./launch/app_install.sh

set -uo pipefail

VOICE_GATEWAY="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$HOME/Applications/Merlin.app"
EXEC="$APP_DIR/Contents/MacOS/Merlin"
SERVICE="$VOICE_GATEWAY/service/merlin_service.py"
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


# ── Step 1: Verify Merlin.app ─────────────────────────────────────────────────

step "Step 1 — Merlin.app"

[[ -x "$EXEC" ]] || die "Merlin.app not found at $APP_DIR.
Run first:  $VOICE_GATEWAY/launch/build_app.sh"
ok "Merlin.app found: $EXEC"


# ── Step 2: Find Python ───────────────────────────────────────────────────────

step "Step 2 — Python"

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

[[ -n "$PYTHON" ]] || die "Python 3 not found."
ok "Python: $PYTHON"


# ── Step 3: Check .env ────────────────────────────────────────────────────────

step "Step 3 — .env"

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


# ── Step 4: Log directory ─────────────────────────────────────────────────────

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

    <!--
      ProgramArguments points at the compiled Mach-O inside the app bundle.
      macOS attributes the process to com.merlin.voice (the TCC-granted bundle).
      The C launcher reads MERLIN_PYTHON and MERLIN_SERVICE from env and execs python3.
    -->
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
        <!-- consumed by the compiled C launcher in Merlin.app/Contents/MacOS/Merlin -->
        <key>MERLIN_PYTHON</key>
        <string>${PYTHON}</string>
        <key>MERLIN_SERVICE</key>
        <string>${SERVICE}</string>
    </dict>
</dict>
</plist>
PLIST

ok "Plist written: $PLIST_DEST"
ok "ProgramArguments → $EXEC"
ok "MERLIN_PYTHON → $PYTHON"
ok "MERLIN_SERVICE → $SERVICE"


# ── Step 6: (Re)register the agent ───────────────────────────────────────────

step "Step 6 — LaunchAgent registration"

launchctl bootout "$GUI_DOMAIN" "$PLIST_DEST" 2>/dev/null || true
sleep 1

if launchctl bootstrap "$GUI_DOMAIN" "$PLIST_DEST"; then
  ok "Bootstrapped $LABEL"
else
  echo "  bootstrap failed — trying legacy launchctl load"
  launchctl load "$PLIST_DEST" || die "launchctl load also failed"
  ok "Loaded $LABEL (legacy)"
fi


# ── Step 7: Wait for process ──────────────────────────────────────────────────

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
  launchctl list "$LABEL" 2>&1 | sed 's/^/    /' || true
fi


# ── Step 8: Audio sanity in log ───────────────────────────────────────────────

step "Step 8 — Audio sanity (wait up to 20 s for [sanity] lines)"

for i in $(seq 1 20); do
  if grep -q '\[sanity\] max=' "$LOG_FILE" 2>/dev/null; then
    break
  fi
  sleep 1
  printf "  [%d/20]\r" "$i"
done
echo

if grep -q '\[sanity\] max=' "$LOG_FILE" 2>/dev/null; then
  echo "  Recent [sanity] max= lines:"
  grep '\[sanity\] max=' "$LOG_FILE" | tail -5 | sed 's/^/    /'
  # Check if any sample is non-zero
  if grep '\[sanity\] max=' "$LOG_FILE" | grep -qv 'max=0.000000'; then
    ok "Audio received — TCC grant is working!"
  else
    err "Audio is still zero"
    echo
    echo "  Possible causes:"
    echo "  a) You did not click Allow when you ran: open \"$APP_DIR\""
    echo "     Fix: open \"$APP_DIR\" and click Allow, then: launchctl kickstart -k $GUI_DOMAIN/$LABEL"
    echo
    echo "  b) TCC grant was not saved — verify:"
    echo "     $VOICE_GATEWAY/launch/check_tcc.sh"
    echo
    echo "  c) The build used the shell-script fallback (clang was missing):"
    echo "     file \"$EXEC\""
    echo "     If it says 'shell script', install Xcode CLT: xcode-select --install"
    echo "     Then rebuild: ./launch/build_app.sh"
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
echo "  LaunchAgent reinstalled → Merlin.app"
echo
echo "  Monitor:  tail -f $LOG_FILE"
echo "  Status:   launchctl list $LABEL"
echo "  Restart:  launchctl kickstart -k $GUI_DOMAIN/$LABEL"
echo "  Remove:   $VOICE_GATEWAY/launch/uninstall.sh"
echo "══════════════════════════════════════════════════════════════"
