#!/usr/bin/env bash
# Remove Merlin LaunchAgent.
set -uo pipefail

LABEL="com.merlin.voice"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
GUI_DOMAIN="gui/$(id -u)"

if [[ -f "$PLIST" ]]; then
  launchctl bootout "$GUI_DOMAIN" "$PLIST" 2>/dev/null || \
    launchctl unload "$PLIST" 2>/dev/null || true
  rm "$PLIST"
  echo "Merlin uninstalled."
else
  echo "Nothing to remove (plist not found at $PLIST)."
fi
