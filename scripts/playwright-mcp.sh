#!/usr/bin/env bash
# playwright-mcp.sh — launches Playwright MCP with a free port + isolated profile per session
# Each Claude Code session gets its own port and browser state — zero interference.

set -euo pipefail

# Pick a free port between 9200–9999
FREE_PORT=$(python3 -c "
import socket, random
for _ in range(50):
    p = random.randint(9200, 9999)
    try:
        s = socket.socket()
        s.bind(('127.0.0.1', p))
        s.close()
        print(p)
        break
    except OSError:
        pass
")

# Unique profile dir per session (cleaned up on exit)
SESSION_ID="$$-$(date +%s)"
PROFILE_DIR="/tmp/playwright-mcp-$SESSION_ID"
mkdir -p "$PROFILE_DIR"

cleanup() {
    rm -rf "$PROFILE_DIR"
}
trap cleanup EXIT

exec npx @playwright/mcp@latest \
    --port "$FREE_PORT" \
    --user-data-dir "$PROFILE_DIR" \
    --isolated \
    "$@"
