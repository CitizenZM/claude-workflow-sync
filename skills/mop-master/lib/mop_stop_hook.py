#!/usr/bin/env python3
"""
MOP Stop Hook — runs after every Claude response.
Appends one telemetry line to the active run's token ledger.
Zero model tokens. Pure bash-level measurement.
"""
import sys, json, os, time
from datetime import datetime
from pathlib import Path

LOG_DIR = Path.home() / ".claude" / "mop"
LEDGER = LOG_DIR / "session-telemetry.jsonl"
LOG_DIR.mkdir(exist_ok=True)

raw = sys.stdin.buffer.read().decode('utf-8', errors='replace')
if not raw.strip():
    sys.stdout.write(raw or '{}')
    sys.exit(0)

try:
    data = json.loads(raw)
except Exception:
    sys.stdout.write(raw)
    sys.exit(0)

# Extract measurable signals from hook payload
tool_calls = []
tool_names = []
files_written = []

# Claude Code Stop hook provides: session_id, transcript_path, tool_uses
tool_uses = data.get('tool_uses', [])
for t in tool_uses:
    name = t.get('name', '')
    tool_names.append(name)
    if name in ('Write', 'Edit'):
        inp = t.get('input', {})
        fp = inp.get('file_path', inp.get('path', ''))
        if fp:
            files_written.append(fp)

# Session file size as context proxy
history = Path.home() / ".claude" / "history.jsonl"
session_kb = round(history.stat().st_size / 1024) if history.exists() else 0

record = {
    "ts": datetime.utcnow().isoformat(),
    "tools": len(tool_uses),
    "tool_names": list(set(tool_names))[:8],
    "files_written": len(files_written),
    "session_kb": session_kb,
}

with open(LEDGER, 'a') as f:
    f.write(json.dumps(record) + '\n')

sys.stdout.write(raw)
sys.exit(0)
