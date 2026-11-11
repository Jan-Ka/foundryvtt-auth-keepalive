#!/bin/sh
# Registers the Claude Code MCP servers github and context7 for this project.
#
# The registration holds no token: it names `task mcp:headers` as the headers
# helper, which Claude Code runs on every connection with the project directory
# as working directory, and which reads the token from .env.mcp at that moment
# (scripts/mcp-headers.sh). Claude Code stores the registration in its
# project-local config under the user profile, not in this repository, and the
# command it stores is relative, so no clone path is baked in either.
set -eu

cd "$(dirname "$0")/.."

# Claude Code and the MCP tokens are both optional: building and testing the
# module needs neither, so `task setup` must not fail on a clone without them.
if ! command -v claude >/dev/null 2>&1; then
  echo "⏭ claude is not installed; MCP registration skipped. Install Claude Code and run: task setup:mcp"
  exit 0
fi

if [ ! -f .env.mcp ]; then
  echo "⏭ .env.mcp not found; MCP registration skipped. Run: task setup:secrets (or copy .env.mcp.example to .env.mcp and fill it in)"
  exit 0
fi

# Remove an existing registration first: an older one may still hold static
# headers with a token in them. `claude mcp remove` exits non-zero when the
# server is absent; ignore that.
claude mcp remove github   >/dev/null 2>&1 || true
claude mcp remove context7 >/dev/null 2>&1 || true

helper="task mcp:headers"

claude mcp add-json github   "{\"type\":\"http\",\"url\":\"https://api.githubcopilot.com/mcp\",\"headersHelper\":\"${helper}\"}"
echo "✓ MCP server github registered"

claude mcp add-json context7 "{\"type\":\"http\",\"url\":\"https://mcp.context7.com/mcp\",\"headersHelper\":\"${helper}\"}"
echo "✓ MCP server context7 registered"

echo ""
echo "MCP servers registered for this project; tokens stay in .env.mcp. Restart claude to connect."
