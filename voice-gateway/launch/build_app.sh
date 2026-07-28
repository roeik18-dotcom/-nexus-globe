#!/usr/bin/env bash
# Build Merlin.app — a minimal macOS app bundle that owns the microphone TCC grant.
#
# WHY THIS EXISTS
# ───────────────
# macOS TCC grants microphone access per *responsible process*.  When launchd
# spawns python3 directly there is no bundle ID in the process ancestry, so
# CoreAudio delivers silence.  A compiled Mach-O inside an app bundle lets
# macOS attribute the mic request to CFBundleIdentifier=com.merlin.voice.
# That grant persists across all future launches — including from the LaunchAgent.
#
# WHAT IT BUILDS
# ──────────────
#   ~/Applications/Merlin.app/
#     Contents/
#       Info.plist       — bundle metadata + NSMicrophoneUsageDescription
#       MacOS/
#         Merlin         — compiled Mach-O launcher (reads env vars, execs python3)
#       Resources/
#
# USAGE
# ─────
#   cd voice-gateway
#   ./launch/build_app.sh
#   open ~/Applications/Merlin.app   # triggers mic permission dialog → click Allow
#   ./launch/check_tcc.sh            # confirm com.merlin.voice auth_value=2
#   ./launch/app_install.sh          # reinstall LaunchAgent pointing at the app

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

    <!-- triggers the macOS microphone permission dialog on first launch -->
    <key>NSMicrophoneUsageDescription</key>
    <string>Merlin needs microphone access to listen for the wake word "Hi Merlin".</string>
</dict>
</plist>
PLIST

ok "Info.plist written (bundle ID: $BUNDLE_ID)"


# ── Step 4: Compiled launcher ─────────────────────────────────────────────────
#
# A compiled Mach-O binary is definitively attributed to the app bundle by the
# macOS kernel.  A shell script is ambiguous.  We compile a tiny C launcher
# that reads MERLIN_PYTHON and MERLIN_SERVICE from the environment (set by the
# LaunchAgent plist) and execs python3 with those arguments.

step "Step 4 — Launcher binary"

EXEC="$CONTENTS/MacOS/Merlin"
C_SRC="$CONTENTS/MacOS/launcher.c"

cat > "$C_SRC" << 'C'
#include <stdlib.h>
#include <stdio.h>
#include <unistd.h>

int main(void) {
    const char *py  = getenv("MERLIN_PYTHON");
    const char *svc = getenv("MERLIN_SERVICE");
    if (!py || !svc) {
        fprintf(stderr, "[Merlin] MERLIN_PYTHON and MERLIN_SERVICE must be set\n");
        return 1;
    }
    char *argv[] = {(char *)py, (char *)svc, (char *)0};
    execv(py, argv);
    perror("[Merlin] execv failed");
    return 1;
}
C

COMPILED=0
if command -v clang &>/dev/null; then
    if clang -O2 -o "$EXEC" "$C_SRC" 2>&1; then
        rm -f "$C_SRC"
        ok "Compiled Mach-O launcher: $EXEC"
        COMPILED=1
    else
        err "clang compile failed — falling back to shell script"
    fi
else
    err "clang not found (install Xcode Command Line Tools: xcode-select --install)"
    err "Falling back to shell script launcher (less reliable for TCC attribution)"
fi

if [[ "$COMPILED" -eq 0 ]]; then
    rm -f "$C_SRC"
    cat > "$EXEC" << SCRIPT
#!/usr/bin/env bash
exec "\${MERLIN_PYTHON}" "\${MERLIN_SERVICE}"
SCRIPT
    ok "Shell script launcher written (fallback): $EXEC"
fi

chmod +x "$EXEC"


# ── Step 5: Ad-hoc code signing ──────────────────────────────────────────────

step "Step 5 — Code signing"

if command -v codesign &>/dev/null; then
    if codesign --sign - --force --deep "$APP_DIR" 2>&1; then
        ok "Ad-hoc signed: $APP_DIR"
    else
        err "codesign returned non-zero — continuing anyway"
    fi
else
    err "codesign not found"
fi


# ── Step 6: Remove quarantine ─────────────────────────────────────────────────

step "Step 6 — Remove quarantine attribute"

xattr -rd com.apple.quarantine "$APP_DIR" 2>/dev/null || true
ok "Quarantine cleared"


# ── Done ─────────────────────────────────────────────────────────────────────

echo
echo "══════════════════════════════════════════════════════════════"
echo "  Merlin.app built at: $APP_DIR"
echo
echo "  NEXT STEPS — run in order:"
echo
echo "  1. Launch the app ONCE to trigger the mic permission dialog:"
echo "       open \"$APP_DIR\""
echo "     macOS will ask: 'Merlin wants to access the microphone' → click ALLOW."
echo "     The service will start in the background."
echo
echo "  2. Verify the TCC grant was stored:"
echo "       $VOICE_GATEWAY/launch/check_tcc.sh"
echo "     Look for: com.merlin.voice  auth_value=2"
echo
echo "  3. Reinstall the LaunchAgent pointing at this app:"
echo "       cd $VOICE_GATEWAY && ./launch/app_install.sh"
echo "══════════════════════════════════════════════════════════════"
