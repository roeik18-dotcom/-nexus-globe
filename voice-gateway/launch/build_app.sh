#!/usr/bin/env bash
# Build Merlin.app — a minimal macOS app bundle that owns the microphone TCC grant.
#
# WHY THIS EXISTS
# ───────────────
# macOS TCC (Transparency, Consent, and Control) grants microphone access per
# *responsible process*.  When launchd spawns python3 directly there is no bundle
# ID in the process ancestry, so CoreAudio delivers silence regardless of
# ProcessType.  An app bundle with CFBundleIdentifier + NSMicrophoneUsageDescription
# causes macOS to prompt the user for microphone permission on first launch.  That
# grant is then stored in TCC.db for the bundle ID and applies to every subsequent
# launch — including from the LaunchAgent.
#
# WHAT IT BUILDS
# ──────────────
#   ~/Applications/Merlin.app/
#     Contents/
#       Info.plist             — bundle metadata + mic permission string
#       MacOS/
#         Merlin               — executable: sets PATH/HOME then execs python3 service
#       Resources/             — (empty, required by macOS)
#
# USAGE
# ─────
#   cd voice-gateway
#   ./launch/build_app.sh          # builds the app
#   open ~/Applications/Merlin.app # FIRST TIME: grant mic access in the dialog
#                                  # then Ctrl+C once dialog is done
#   ./launch/app_install.sh        # reinstalls LaunchAgent pointing at the app

set -uo pipefail

VOICE_GATEWAY="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$HOME/Applications/Merlin.app"
CONTENTS="$APP_DIR/Contents"
BUNDLE_ID="com.merlin.voice"
SERVICE="$VOICE_GATEWAY/service/merlin_service.py"

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


# ── Step 2: Create bundle skeleton ───────────────────────────────────────────

step "Step 2 — App bundle skeleton"

mkdir -p "$CONTENTS/MacOS" "$CONTENTS/Resources"
ok "Created $APP_DIR"


# ── Step 3: Write Info.plist ─────────────────────────────────────────────────

step "Step 3 — Info.plist"

cat > "$CONTENTS/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleIdentifier</key>
    <string>${BUNDLE_ID}</string>

    <key>CFBundleName</key>
    <string>Merlin</string>

    <key>CFBundleVersion</key>
    <string>1.0</string>

    <key>CFBundlePackageType</key>
    <string>APPL</string>

    <key>CFBundleExecutable</key>
    <string>Merlin</string>

    <!-- background-only app: no Dock icon, no menu bar -->
    <key>LSUIElement</key>
    <true/>

    <!-- required key that triggers the macOS microphone permission dialog -->
    <key>NSMicrophoneUsageDescription</key>
    <string>Merlin needs microphone access to listen for the wake word "Hi Merlin".</string>
</dict>
</plist>
PLIST

ok "Info.plist written (bundle ID: $BUNDLE_ID)"


# ── Step 4: Write executable ─────────────────────────────────────────────────

step "Step 4 — Executable"

EXEC="$CONTENTS/MacOS/Merlin"

cat > "$EXEC" << SCRIPT
#!/usr/bin/env bash
# Merlin.app launcher — runs inside the bundle's process context so macOS
# assigns com.merlin.voice as the responsible client for TCC checks.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
export HOME="${HOME}"
exec "${PYTHON}" "${SERVICE}"
SCRIPT

chmod +x "$EXEC"
ok "Executable written: $EXEC"


# ── Step 5: Ad-hoc code signing ──────────────────────────────────────────────

step "Step 5 — Code signing"

if command -v codesign &>/dev/null; then
  if codesign --sign - --force --deep "$APP_DIR" 2>&1; then
    ok "Ad-hoc signed: $APP_DIR"
  else
    err "codesign returned non-zero — continuing anyway (may still work on older macOS)"
  fi
else
  err "codesign not found — skipping signing (will only work if SIP is disabled)"
fi


# ── Step 6: Quarantine removal ───────────────────────────────────────────────

step "Step 6 — Remove quarantine attribute"

xattr -rd com.apple.quarantine "$APP_DIR" 2>/dev/null || true
ok "Quarantine attribute cleared"


# ── Done ─────────────────────────────────────────────────────────────────────

echo
echo "══════════════════════════════════════════════════════════════"
echo "  Merlin.app built at: $APP_DIR"
echo
echo "  NEXT STEPS:"
echo
echo "  1. Run the app ONCE to trigger the microphone permission prompt:"
echo "       open \"$APP_DIR\""
echo "     Click ALLOW in the macOS dialog."
echo "     The app will start the voice service — press Ctrl+C after granting."
echo
echo "  2. Verify the TCC grant was stored:"
echo "       $VOICE_GATEWAY/launch/check_tcc.sh"
echo "     You should see $BUNDLE_ID with auth_value=2 (allowed)."
echo
echo "  3. Install the LaunchAgent pointing at this app:"
echo "       cd $VOICE_GATEWAY && ./launch/app_install.sh"
echo
echo "  Say 'Hi Merlin' or double-clap to wake."
echo "══════════════════════════════════════════════════════════════"
