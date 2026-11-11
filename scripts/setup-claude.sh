#!/bin/sh
# Write the per-clone .claude/settings.json. .claude/ is gitignored, so these
# settings are generated rather than committed:
#
#   attribution.commit/.pr = ""  suppresses the AI trailers (Co-Authored-By on
#                            commits, the "Generated with" line on PR bodies) at
#                            generation time. The commit-msg hook rejects them
#                            anyway; this stops them being written at all.
#   permissions.deny         keeps agents out of .env.mcp and .env.1password,
#                            and out of `task mcp:headers` (the MCP headers
#                            helper, which prints a token to stdout by design).
#
# The MCP servers themselves are registered per user by `task setup:mcp`
# (claude mcp add-json), not through a project .mcp.json.
#
# The deny list is a guardrail against an agent reading a secret in passing,
# not a boundary: rules match the command string, so they can only cover
# spellings written down here.
#
# Run standalone or via `task setup:claude`. Refuses to clobber an existing
# file; delete it to regenerate. Says so when the existing file differs from
# what it would write, because a clone set up before a rule was added keeps the
# older list and would otherwise never hear about it.
set -eu

cd "$(dirname "$0")/.."

OUT=.claude/settings.json

WANT=$(mktemp)
trap 'rm -f "$WANT"' EXIT

cat > "$WANT" <<'JSON'
{
  "permissions": {
    "deny": [
      "Read(./.env)",
      "Read(./.env.local)",
      "Read(./.env.1password)",
      "Read(./.env.mcp)",
      "Bash(cat .env*)",
      "Bash(cat ./.env*)",
      "Bash(head .env*)",
      "Bash(tail .env*)",
      "Bash(less .env*)",
      "Bash(more .env*)",
      "Bash(source .env*)",
      "Bash(. .env*)",
      "Bash(task mcp:headers*)",
      "Bash(sh scripts/mcp-headers.sh*)",
      "Bash(sh ./scripts/mcp-headers.sh*)",
      "Bash(scripts/mcp-headers.sh*)",
      "Bash(./scripts/mcp-headers.sh*)",
      "Bash(. scripts/mcp-headers.sh*)"
    ]
  },
  "attribution": {
    "commit": "",
    "pr": ""
  }
}
JSON

if [ -f "$OUT" ]; then
  if cmp -s "$WANT" "$OUT"; then
    echo "⏭ $OUT already exists and is up to date"
  else
    echo "⚠ $OUT differs from what this script writes."
    echo "  If you edited it yourself, ignore this. If it predates a rule added"
    echo "  since, delete it and re-run 'task setup:claude' to pick the rule up."
  fi
  exit 0
fi

mkdir -p .claude
cp "$WANT" "$OUT"
echo "✓ $OUT written (attribution suppressed; .env* and the MCP headers helper denied)"
