#!/bin/sh
# Prints the HTTP headers for one MCP server as a JSON object.
#
# Claude Code runs `task mcp:headers` each time it connects to a server, and
# again after a 401 or 403 response, passing the server name in
# CLAUDE_CODE_MCP_SERVER_NAME. Task loads .env.mcp into the environment of that
# one task before this script runs. So no Claude Code config holds a token, and
# a rotated token takes effect on the next connection.
#
# For a manual check, run: task mcp:headers -- github
# It prints the token, so agents are denied it (scripts/setup-claude.sh).
# Errors go to stderr. Only the JSON goes to stdout.
set -eu

cd "$(dirname "$0")/.."

server="${CLAUDE_CODE_MCP_SERVER_NAME:-${MCP_SERVER:-}}"

if [ -z "$server" ]; then
  echo "mcp-headers: no server name. Set CLAUDE_CODE_MCP_SERVER_NAME or pass one after --" >&2
  exit 2
fi

if [ ! -f .env.mcp ]; then
  echo "mcp-headers: .env.mcp not found. Run: task setup:secrets (or copy .env.mcp.example to .env.mcp and fill it in)" >&2
  exit 1
fi

# The value goes into a JSON string without escaping. A quote or a backslash
# would break the JSON. Real tokens never contain them.
check_value() {
  if [ -z "$2" ]; then
    echo "mcp-headers: $1 is missing from .env.mcp. Add it, or run: task setup:secrets" >&2
    exit 1
  fi
  case "$2" in
    *\"*|*\\*)
      echo "mcp-headers: $1 contains a quote or a backslash. Refusing to build the JSON." >&2
      exit 1
      ;;
  esac
}

case "$server" in
  github)
    check_value GITHUB_PAT "${GITHUB_PAT:-}"
    printf '{"Authorization":"Bearer %s"}\n' "$GITHUB_PAT"
    ;;
  context7)
    check_value CONTEXT7_API_KEY "${CONTEXT7_API_KEY:-}"
    printf '{"CONTEXT7_API_KEY":"%s"}\n' "$CONTEXT7_API_KEY"
    ;;
  *)
    echo "mcp-headers: unknown server '$server'. Known servers: github, context7" >&2
    exit 2
    ;;
esac
