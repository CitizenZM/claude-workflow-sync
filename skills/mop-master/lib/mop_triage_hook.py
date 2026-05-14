#!/usr/bin/env python3
import sys, json, os
from datetime import datetime

LOG = os.path.expanduser("~/.claude/mop/hook.log")

def log(msg):
    with open(LOG, "a") as f:
        f.write(f"[{datetime.utcnow().isoformat()}] {msg}\n")

raw = sys.stdin.buffer.read().decode('utf-8', errors='replace')
log(f"FIRED. stdin_len={len(raw)}")

if not raw.strip():
    raw = os.environ.get('CLAUDE_HOOK_INPUT', '{}')

try:
    data = json.loads(raw)
except Exception as e:
    log(f"JSON parse failed: {e}")
    sys.stdout.write(raw)
    sys.exit(0)

prompt = data.get('prompt', '')
words = prompt.split()

if len(words) < 6 or '--mop-off' in prompt or '--class S' in prompt:
    log("BYPASS")
    sys.stdout.write(json.dumps(data))
    sys.exit(0)

prefix = (
    '[SYSTEM RULE — MOP v4.5]: You MUST output the [MOP T v4.5] triage block as your FIRST output. '
    'Format:\n'
    '[MOP T v4.5]\n'
    'Run:    mop_<YYYYMMDDTHHMMSSZ>_<class>_<4hash>\n'
    'Class:  <S/M/L/XL>  Mode: <Bypass/Quick/Standard/Deep>\n'
    'Window: <n>%  Target:<40%  Hard:<70%\n'
    'Skills: mop-master, <others>\n'
    'Est:    ~<Ktok> tok, ~<min> min, <N> agents\n'
    'Vault:  30-Operations/MOP/_active/<run-id>/\n'
    'Lock:   ~/.claude/mop/.lock  Owner: <hostname>\n'
    'Approach: <primary> | fallback: <alt1>, <alt2>\n\n'
    'PRIME DIRECTIVE: Never pause mid-task. Pre-plan 2 fallback approaches before starting. '
    'If blocked, switch approach — never ask user mid-task. '
    'See ~/.claude/skills/mop-master/SKILL.md §0 and §10 for harness patterns.\n\n'
)

data['prompt'] = prefix + prompt
log(f"INJECTED v4.5 prefix")
sys.stdout.write(json.dumps(data))
sys.exit(0)
