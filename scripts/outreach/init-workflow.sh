#!/usr/bin/env bash
# Outreach workflow isolation init.
#
# ARCHITECTURE (v3 — canonical):
#   Each outreach workflow has:
#     1. A dedicated playwright MCP server named "playwright-<slug>" (registered in ~/.claude.json)
#        Tools exposed as mcp__playwright-<slug>__*
#     2. A dedicated Chrome profile at ~/.claude/browser-profiles/<slug>
#     3. A fixed CDP port that both Chrome and the MCP server agree on
#   This script ensures Chrome is up on the expected port with the expected profile,
#   then the already-registered MCP server connects to it via --cdp-endpoint.
#
# Usage: init-workflow.sh <workflow-slug> <mcp-name> <port>
# Example: init-workflow.sh awin-oufer-us playwright-awin-oufer-us 9303
set -euo pipefail

SLUG="${1:?workflow slug required}"
MCP_NAME="${2:?mcp server name required}"
PORT="${3:?port required}"

# Canonical registry lives alongside the shared supervisor prompt.
REGISTRY="$HOME/.claude/skills/_shared/workflow-registry.json"
PROFILE_DIR="$HOME/.claude/browser-profiles/$SLUG"
MCP_JSON="$HOME/.claude.json"
CDP_PORT="$PORT"

# 1. Verify arguments match canonical registry
if command -v jq >/dev/null 2>&1 && [ -f "$REGISTRY" ]; then
  REG_MCP=$(jq -r --arg s "$SLUG" '.workflows[$s].mcp // empty' "$REGISTRY")
  REG_PORT=$(jq -r --arg s "$SLUG" '.workflows[$s].port // empty' "$REGISTRY")
  if [ -z "$REG_MCP" ]; then
    echo "[init] ❌ workflow '$SLUG' not in registry: $REGISTRY" >&2
    echo "[init]    Add it to workflow-registry.json, then restart Claude Code once." >&2
    exit 3
  fi
  if [ "$REG_MCP" != "$MCP_NAME" ] || [ "$REG_PORT" != "$PORT" ]; then
    echo "[init] ❌ caller mismatch with registry:" >&2
    echo "[init]    caller: mcp='$MCP_NAME' port='$PORT'" >&2
    echo "[init]    canon:  mcp='$REG_MCP' port='$REG_PORT'" >&2
    exit 4
  fi
fi

# 2. Verify the workflow-specific MCP server is registered in ~/.claude.json
if command -v jq >/dev/null 2>&1 && [ -f "$MCP_JSON" ]; then
  MCP_EXISTS=$(jq -r --arg m "$MCP_NAME" '.mcpServers[$m] // empty' "$MCP_JSON" 2>/dev/null || true)
  if [ -z "$MCP_EXISTS" ]; then
    echo "[init] ❌ MCP server '$MCP_NAME' not registered in ~/.claude.json" >&2
    echo "[init]    Add this block under mcpServers and restart Claude Code ONCE:" >&2
    cat >&2 <<EOF
    "$MCP_NAME": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@0.0.41", "--cdp-endpoint", "http://localhost:$PORT"],
      "env": {}
    }
EOF
    exit 2
  fi
fi

# 3. Ensure profile dir exists
mkdir -p "$PROFILE_DIR"

# 4. Check if Chrome is already running and healthy on the CDP port.
# If it is, DO NOT kill it — it may have in-memory cookies (e.g. cf_clearance) not yet flushed to disk.
CHROME_ALREADY_RUNNING=false
if command -v curl >/dev/null 2>&1; then
  CDP_CHECK=$(curl -s --max-time 2 "http://localhost:$CDP_PORT/json/version" 2>/dev/null | grep -c '"Browser"' || true)
  if [ "$CDP_CHECK" -gt 0 ]; then
    CHROME_ALREADY_RUNNING=true
    echo "[init] Chrome already running on :$CDP_PORT — reusing existing session (preserving in-memory cookies)"
  fi
fi

if [ "$CHROME_ALREADY_RUNNING" = "false" ]; then
  # Kill any stale Chrome using this profile before relaunching
  pkill -f "user-data-dir=$PROFILE_DIR" 2>/dev/null || true
  pkill -f "user-data-dir $PROFILE_DIR" 2>/dev/null || true
  sleep 1

  # Kill any process on the CDP port
  if command -v lsof >/dev/null 2>&1; then
    PORT_PID=$(lsof -ti tcp:"$CDP_PORT" 2>/dev/null || true)
    if [ -n "$PORT_PID" ]; then
      kill "$PORT_PID" 2>/dev/null || true
      echo "[init] killed stale process on :$CDP_PORT (pid $PORT_PID)"
      sleep 1
    fi
  fi
fi

# 6. Launch Chrome with workflow profile + remote debugging (skip if already running)
if [ "$CHROME_ALREADY_RUNNING" = "true" ]; then
  echo "[init] Skipping Chrome launch — already healthy on :$CDP_PORT"
fi

CHROME_BIN=""
for candidate in \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Chromium.app/Contents/MacOS/Chromium" \
  "$(which google-chrome 2>/dev/null)" \
  "$(which chromium 2>/dev/null)"; do
  if [ -n "$candidate" ] && [ -x "$candidate" ]; then
    CHROME_BIN="$candidate"
    break
  fi
done

if [ "$CHROME_ALREADY_RUNNING" = "true" ]; then
  : # already running — skip launch
elif [ -z "$CHROME_BIN" ]; then
  echo "[init] ⚠️  Chrome not found — MCP server can still launch its own browser, but sessions won't persist." >&2
else
  "$CHROME_BIN" \
    --user-data-dir="$PROFILE_DIR" \
    --remote-debugging-port="$CDP_PORT" \
    --remote-allow-origins="*" \
    --no-first-run \
    --no-default-browser-check \
    --disable-popup-blocking \
    --disable-blink-features=AutomationControlled \
    --start-maximized \
    > /tmp/chrome-"$SLUG".log 2>&1 &
  CHROME_PID=$!
  disown "$CHROME_PID" 2>/dev/null || true

  # Wait up to 15s for CDP to be healthy — retry loop instead of fixed sleep
  CDP_READY=false
  for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    sleep 1
    CDP_OK=$(curl -s --max-time 2 "http://localhost:$CDP_PORT/json/version" 2>/dev/null | grep -c '"Browser"' || true)
    if [ "$CDP_OK" -gt 0 ]; then
      CDP_READY=true
      break
    fi
  done

  if [ "$CDP_READY" = "true" ]; then
    echo "[init] Chrome launched with profile '$SLUG' on CDP :$CDP_PORT (pid $CHROME_PID)"
  else
    echo "[init] ❌ Chrome started but CDP not responding after 15s on :$CDP_PORT" >&2
    echo "[init]    Check /tmp/chrome-$SLUG.log for errors" >&2
    exit 5
  fi
fi

# Final sanity check: confirm CDP is still responding before handing off to MCP
CDP_FINAL=$(curl -s --max-time 3 "http://localhost:$CDP_PORT/json/version" 2>/dev/null | grep -c '"Browser"' || true)
if [ "$CDP_FINAL" -eq 0 ]; then
  echo "[init] ❌ CDP endpoint :$CDP_PORT not responding at handoff — aborting" >&2
  exit 6
fi

echo "[init] MCP '$MCP_NAME' ✓ registered (port=$CDP_PORT profile=$SLUG)"
echo "[init] CDP :$CDP_PORT ✓ healthy — MCP server will connect immediately"
echo "[init] ready — tools: mcp__${MCP_NAME}__<fn>"
echo ""
echo "[init] RULE: Use ONLY mcp__${MCP_NAME}__<fn> tools in this workflow."
echo "[init]       Never fall back to mcp__playwright__<fn> — that would collide with other workflows."
