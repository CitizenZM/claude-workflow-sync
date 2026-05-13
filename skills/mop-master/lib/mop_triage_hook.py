#!/usr/bin/env python3
import sys, json, os
from datetime import datetime

LOG = os.path.expanduser("~/.claude/mop/hook.log")

def log(msg):
    with open(LOG, "a") as f:
        f.write(f"[{datetime.utcnow().isoformat()}] {msg}\n")

raw = sys.stdin.buffer.read().decode('utf-8', errors='replace')
log(f"FIRED. stdin_len={len(raw)} env_CLAUDE_HOOK_INPUT_len={len(os.environ.get('CLAUDE_HOOK_INPUT',''))}")

if not raw.strip():
    # Claude Code may pass via env var instead
    raw = os.environ.get('CLAUDE_HOOK_INPUT', '{}')
    log(f"Using env var fallback, len={len(raw)}")

try:
    data = json.loads(raw)
except Exception as e:
    log(f"JSON parse failed: {e}, raw[:100]={repr(raw[:100])}")
    sys.stdout.write(raw)
    sys.exit(0)

prompt = data.get('prompt', '')
log(f"prompt[:80]={repr(prompt[:80])}")

words = prompt.split()
if len(words) < 6 or '--mop-off' in prompt or '--class S' in prompt:
    log("BYPASS (trivial or suppressed)")
    sys.stdout.write(json.dumps(data))
    sys.exit(0)

prefix = (
    '[SYSTEM RULE — MOP v4.0]: Your FIRST output MUST be the [MOP T v4] triage block. '
    'Format exactly:\n'
    '[MOP T v4]\n'
    'Run:    mop_<utcYYYYMMDDTHHMMSSZ>_<L>_<hash>\n'
    'Class:  <S/M/L/XL>  Mode: <Bypass/Quick/Standard/Deep>\n'
    'Window: <n>%  Target: <40%  Hard: <70%\n'
    'Skills: mop-master, <others>\n'
    'Est:    <Ktok>, <min>, <N> subagents\n'
    'Vault:  30-Operations/MOP/_active/<run-id>/\n'
    'Lock:   ~/.claude/mop/.lock  Owner: xiaos-mac-studio\n\n'
    'Output this block as the FIRST thing you write. Then proceed.\n\n'
)

data['prompt'] = prefix + prompt
log(f"INJECTED prefix. new prompt[:80]={repr(data['prompt'][:80])}")
sys.stdout.write(json.dumps(data))
sys.exit(0)
