#!/usr/bin/env bash
# Read the user TCC database and print all microphone entries.
#
# Requires Terminal (or iTerm2) to have Full Disk Access:
#   System Settings → Privacy & Security → Full Disk Access → add Terminal → restart
#
# Usage:
#   ./launch/check_tcc.sh

set -uo pipefail

TCC_DB="$HOME/Library/Application Support/com.apple.TCC/TCC.db"

echo "=== TCC microphone entries ==="
echo "DB: $TCC_DB"
echo ""

if [[ ! -f "$TCC_DB" ]]; then
    echo "TCC.db not found at expected path."
    exit 1
fi

sqlite3 "$TCC_DB" \
    ".mode column" \
    ".headers on" \
    ".width 50 12 12 50 12" \
    "SELECT client, client_type, auth_value, responsible_client, responsible_client_type
     FROM access
     WHERE service = 'kTCCServiceMicrophone'
     ORDER BY auth_value DESC;" \
2>&1 || {
    echo ""
    echo "FAILED to read TCC.db."
    echo ""
    echo "Grant Terminal Full Disk Access, then re-run:"
    echo "  System Settings → Privacy & Security → Full Disk Access → + → Terminal"
    echo "  Restart Terminal → ./launch/check_tcc.sh"
    exit 1
}

echo ""
echo "auth_value: 0=denied  2=allowed  3=limited"
echo "client_type: 0=bundle-id  1=absolute-path"
