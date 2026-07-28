#!/usr/bin/env bash
# Remove Merlin LaunchAgent.
set -euo pipefail
LABEL="com.merlin.voice"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
if [[ -f "$PLIST" ]]; then
  launchctl unload "$PLIST" 2>/dev/null || true
  rm "$PLIST"
  echo "Merlin uninstalled."
else
  echo "Nothing to remove (plist not found at $PLIST)."
fi
