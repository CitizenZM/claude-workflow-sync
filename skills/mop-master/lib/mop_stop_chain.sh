#!/usr/bin/env bash
# MOP v4.5 Stop hook chain — runs all post-response work in order
# 1. Telemetry (fast, synchronous — must complete before Claude exits)
# 2. Autosync (slow, detached — runs in background, doesn't block)

# Read stdin once, share with both
INPUT=$(cat)

# 1. Telemetry — synchronous (fast)
echo "$INPUT" | python3 /Users/xiaozuo/.claude/mop/mop_stop_hook.py >/dev/null 2>&1

# 2. Autosync — detached (no wait, no output)
nohup python3 /Users/xiaozuo/.claude/mop/mop_autosync.py </dev/null >/dev/null 2>&1 &
disown 2>/dev/null || true

# Pass stdin through to anything downstream
echo "$INPUT"
exit 0
