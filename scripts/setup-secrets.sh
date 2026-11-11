#!/bin/sh
# Writes .env.mcp (the MCP tokens and nothing else) from .env.1password. The
# 1Password CLI resolves every op:// value; literal values pass through.
#
# Only `task mcp:headers`, the Claude Code headers helper, loads .env.mcp. The
# module itself has no runtime env, so there is no .env here at all.
#
# Every run rewrites .env.mcp from the vault, so re-running
# `task setup:secrets` picks up a rotated token.
#
# All of this is optional. Without .env.1password an existing hand-written
# .env.mcp is kept, and with neither file the step is skipped: building and
# testing the module needs no token.
#
# Set SETUP_VERBOSE=1 to see the raw 1Password error when a lookup fails. The
# default output hides it, because the error repeats the vault and item name.
set -eu

cd "$(dirname "$0")/.."

CONTRACT=.env.1password
OUT=.env.mcp
TEMPLATE=.env.mcp.example

# Only the current user may read .env.mcp and the partial file.
umask 077

if [ ! -f "$CONTRACT" ]; then
  if [ -f "$OUT" ]; then
    chmod 600 "$OUT"
    echo "⏭ $OUT found; 1Password is not used"
    exit 0
  fi
  echo "⏭ neither $OUT nor $CONTRACT exists; MCP secrets skipped. To set them up:"
  echo "  - by hand: copy $TEMPLATE to $OUT and fill in the values"
  echo "  - with 1Password: copy $TEMPLATE to $CONTRACT, give each key an"
  echo "    op://<vault>/<item>/<field> reference, and run this task again"
  exit 0
fi

if ! command -v op >/dev/null 2>&1; then
  echo "✗ $CONTRACT exists, but the 1Password CLI (op) is not installed"
  echo "  Install it (brew install 1password-cli), or write $OUT by hand from $TEMPLATE"
  exit 1
fi
# Checks for an account, not a session, on purpose: with the desktop app
# integration `op whoami` reports "not signed in" while `op read` still works,
# because the app authorizes each read. A read failure below prints the hint.
if ! op account list >/dev/null 2>&1; then
  echo "✗ the 1Password CLI has no account on this device. Run: op signin"
  exit 1
fi

partial="$OUT.partial"
rm -f "$partial"
trap 'rm -f "$partial"' EXIT
: > "$partial"

CR=$(printf '\r')

while IFS= read -r line || [ -n "$line" ]; do
  line=${line%"$CR"}
  case "$line" in
    ""|\#*) continue ;;
  esac
  k=${line%%=*}
  v=${line#*=}
  v=${v#\"}; v=${v%\"}; v=${v#\'}; v=${v%\'}
  case "$v" in
    op://*)
      if [ "${SETUP_VERBOSE:-0}" = "1" ]; then
        resolved=$(op read "$v") || resolved=""
      else
        resolved=$(op read "$v" 2>/dev/null) || resolved=""
      fi
      if [ -z "$resolved" ]; then
        echo "✗ failed to resolve $k"
        echo "  Check that its op:// reference in $CONTRACT points to an existing item, and"
        echo "  that you are signed in to the right 1Password account (op signin)."
        echo "  Run with SETUP_VERBOSE=1 to see the 1Password error."
        exit 1
      fi
      printf '%s=%s\n' "$k" "$resolved" >> "$partial"
      echo "✓ $k (resolved from 1Password)"
      ;;
    *)
      printf '%s=%s\n' "$k" "$v" >> "$partial"
      echo "✓ $k (literal)"
      ;;
  esac
done < "$CONTRACT"

mv "$partial" "$OUT"
echo "✓ $OUT written"
