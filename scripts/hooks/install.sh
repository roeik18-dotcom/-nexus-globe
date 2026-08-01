#!/bin/sh
# Point git at the tracked hooks directory, so the guard is version-controlled
# and every clone can enable it with one command:
#     sh scripts/hooks/install.sh
set -e
root="$(git rev-parse --show-toplevel)"
git -C "$root" config core.hooksPath scripts/hooks
chmod +x "$root/scripts/hooks/pre-commit" "$root/scripts/hooks/profile_guard.py"
echo "core.hooksPath = $(git -C "$root" config core.hooksPath)"
echo "profile guard installed."
