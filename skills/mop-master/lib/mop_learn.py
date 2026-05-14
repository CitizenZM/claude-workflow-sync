#!/usr/bin/env python3
"""
MOP Learn — reads run retrospectives, extracts patterns, updates SKILL.md approach ladder.

Usage:
  python3 mop_learn.py          # analyze last 10 runs
  python3 mop_learn.py --dry    # show what would change, don't write
  python3 mop_learn.py --n 20   # analyze last N runs
"""
import json, os, sys, re, argparse
from pathlib import Path
from datetime import datetime
from collections import Counter, defaultdict

VAULT = Path.home() / "Documents" / "Obsidian" / "30-Operations" / "MOP"
ARCHIVE = VAULT / "_archive"
SKILL_MD = Path.home() / "Documents" / "Claude" / "config" / "skills" / "mop-master" / "SKILL.md"
TELEMETRY = Path.home() / ".claude" / "mop" / "session-telemetry.jsonl"
LEARN_LOG = Path.home() / ".claude" / "mop" / "learn.log"

def log(msg):
    ts = datetime.utcnow().isoformat()
    with open(LEARN_LOG, 'a') as f:
        f.write(f"[{ts}] {msg}\n")
    print(msg)

def load_retrospectives(n=10):
    """Find all Run-Retrospective.md files in archive."""
    retros = []
    if not ARCHIVE.exists():
        return retros
    for retro_file in sorted(ARCHIVE.rglob("Run-Retrospective.md"), reverse=True)[:n]:
        try:
            content = retro_file.read_text()
            retros.append({"path": str(retro_file), "content": content})
        except Exception:
            pass
    return retros

def load_telemetry(n=50):
    """Load last N telemetry records."""
    if not TELEMETRY.exists():
        return []
    lines = TELEMETRY.read_text().strip().split('\n')
    records = []
    for line in lines[-n:]:
        try:
            records.append(json.loads(line))
        except Exception:
            pass
    return records

def extract_patterns(retros):
    """Extract failure patterns and approach switches from retrospectives."""
    failure_patterns = Counter()
    approach_switches = Counter()
    slow_domains = Counter()
    successful_alts = Counter()

    for r in retros:
        text = r['content'].lower()
        # Failure patterns
        if 'b1' in text or 'wrong output shape' in text:
            failure_patterns['wrong_output_shape'] += 1
        if 'b2' in text or 'validator fail' in text:
            failure_patterns['validator_fail'] += 1
        if 's1' in text or 'stall' in text:
            failure_patterns['silent_stall'] += 1
        if 's2' in text or 'tool loop' in text:
            failure_patterns['tool_loop'] += 1
        if 's4' in text or 'waiting on user' in text or 'asked user' in text:
            failure_patterns['asked_user_midtask'] += 1
        if 'credential' in text or '401' in text or '403' in text:
            failure_patterns['missing_credentials'] += 1
        if 'rate limit' in text or '429' in text:
            failure_patterns['rate_limited'] += 1
        if 'dependency' in text or 'import error' in text or 'not found' in text:
            failure_patterns['missing_dependency'] += 1

        # Approach switches
        if 'switched to alt' in text or 'alt_1' in text:
            approach_switches['switched_to_alt'] += 1
        if 'alt_2' in text or 'minimal version' in text:
            approach_switches['needed_alt_2'] += 1

        # Successful alternatives (learn from these)
        for match in re.findall(r'alt[_\s]?(\w+)\s+(?:worked|succeeded|passed)', text):
            successful_alts[match] += 1

    return failure_patterns, approach_switches, successful_alts

def compute_telemetry_stats(records):
    """Compute efficiency stats from telemetry."""
    if not records:
        return {}
    avg_tools = sum(r.get('tools', 0) for r in records) / len(records)
    avg_kb = sum(r.get('session_kb', 0) for r in records) / len(records)
    avg_files = sum(r.get('files_written', 0) for r in records) / len(records)
    tool_freq = Counter()
    for r in records:
        for t in r.get('tool_names', []):
            tool_freq[t] += 1
    return {
        "avg_tools_per_response": round(avg_tools, 1),
        "avg_session_kb": round(avg_kb, 1),
        "avg_files_per_response": round(avg_files, 1),
        "top_tools": tool_freq.most_common(5),
        "n_records": len(records),
    }

def generate_instinct(pattern, count, stats):
    """Convert a pattern into an instinct YAML block."""
    ts = datetime.utcnow().strftime('%Y-%m-%d')
    instinct_map = {
        'wrong_output_shape': {
            'trigger': 'when subagent returns non-JSON or malformed output',
            'action': 'immediately re-dispatch with explicit JSON schema example in spec; do not retry with identical spec',
            'confidence': min(0.5 + count * 0.1, 0.9),
        },
        'validator_fail': {
            'trigger': 'when module validator exits non-zero on critical criterion',
            'action': 'switch approach (alt_1) on second fail rather than re-running identical spec',
            'confidence': min(0.5 + count * 0.1, 0.9),
        },
        'silent_stall': {
            'trigger': 'when no file change detected in module dir for >3 poll intervals',
            'action': 'inject "STOP: switch to alt approach" then kill+redispatch; never wait longer',
            'confidence': min(0.5 + count * 0.1, 0.9),
        },
        'asked_user_midtask': {
            'trigger': 'when agent outputs a question to user mid-task',
            'action': 'PM answers with best-guess assumption, logs assumption, reinjects, continues — never escalates to user',
            'confidence': 0.9,
        },
        'missing_credentials': {
            'trigger': 'when API returns 401/403 or credential file not found',
            'action': 'write placeholder value, note in result.md, continue with remaining items — never pause',
            'confidence': 0.9,
        },
        'rate_limited': {
            'trigger': 'when API returns 429 or rate limit message',
            'action': 'backoff 5s→15s→45s, retry primary once, then switch to alt approach with different endpoint',
            'confidence': 0.85,
        },
        'missing_dependency': {
            'trigger': 'when ImportError or command-not-found detected',
            'action': 'try pip install / brew install inline; if fails within 30s, switch to approach not requiring that dependency',
            'confidence': 0.8,
        },
        'tool_loop': {
            'trigger': 'when same tool call args appear 3+ times in last 10 lines of session log',
            'action': 'inject STOP signal, force approach switch to alt_1, kill agent if loop continues after injection',
            'confidence': 0.9,
        },
    }
    if pattern not in instinct_map:
        return None
    i = instinct_map[pattern]
    return f"""---
id: mop-{pattern.replace('_', '-')}-{ts}
trigger: "{i['trigger']}"
action: "{i['action']}"
confidence: {i['confidence']}
domain: mop-execution
scope: global
observed_count: {count}
last_seen: "{ts}"
source: mop-learn-retrospective
---"""

def update_skill_md(patterns, dry=False):
    """Append new high-confidence instincts to SKILL.md as a learned-patterns section."""
    if not SKILL_MD.exists():
        log("SKILL.md not found — skipping update")
        return

    content = SKILL_MD.read_text()

    # Build the learned patterns block
    new_instincts = []
    for pattern, count in patterns.most_common():
        if count >= 2:  # only patterns seen 2+ times
            inst = generate_instinct(pattern, count, {})
            if inst:
                new_instincts.append(f"### Pattern: `{pattern}` (seen {count}x)\n{inst}")

    if not new_instincts:
        log("No patterns above threshold — SKILL.md unchanged")
        return

    block = "\n\n## §16. Learned Patterns (auto-updated by mop-learn)\n\n"
    block += f"> Last updated: {datetime.utcnow().strftime('%Y-%m-%d')}  |  "
    block += f"Patterns: {len(new_instincts)}  |  Runs analyzed: {len(patterns)}\n\n"
    block += "\n\n".join(new_instincts)
    block += "\n"

    # Remove previous §16 block if it exists
    content = re.sub(r'\n## §16\. Learned Patterns.*', '', content, flags=re.DOTALL)
    # Also remove old END marker
    content = content.rstrip()

    new_content = content + "\n" + block

    if dry:
        log(f"[DRY] Would add {len(new_instincts)} learned patterns to SKILL.md")
        print(block[:500] + "...")
    else:
        SKILL_MD.write_text(new_content)
        log(f"SKILL.md updated with {len(new_instincts)} learned patterns")

def write_learn_report(patterns, approach_switches, successful_alts, tel_stats, n_retros):
    """Write a human-readable learn report to vault."""
    report_dir = VAULT / "_index"
    report_dir.mkdir(exist_ok=True)
    report_path = report_dir / "Learn-Report-Latest.md"

    ts = datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')
    lines = [
        f"# MOP Learn Report — {ts}",
        f"\nRuns analyzed: {n_retros}  |  Telemetry records: {tel_stats.get('n_records', 0)}",
        "\n## Failure Pattern Frequency",
        "| Pattern | Count | Action |",
        "|---------|-------|--------|",
    ]
    for p, c in patterns.most_common():
        lines.append(f"| `{p}` | {c} | {'→ instinct written' if c >= 2 else 'below threshold'} |")

    lines += [
        "\n## Approach Switch Stats",
        f"- Switched to alt_1: {approach_switches.get('switched_to_alt', 0)}x",
        f"- Needed alt_2 (minimal): {approach_switches.get('needed_alt_2', 0)}x",
        "\n## Telemetry Stats",
        f"- Avg tools/response: {tel_stats.get('avg_tools_per_response', 'n/a')}",
        f"- Avg session size: {tel_stats.get('avg_session_kb', 'n/a')} KB",
        f"- Avg files/response: {tel_stats.get('avg_files_per_response', 'n/a')}",
        f"- Top tools: {tel_stats.get('top_tools', [])}",
    ]

    report_path.write_text('\n'.join(lines))
    log(f"Learn report → {report_path}")
    return report_path

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--n', type=int, default=10, help='Number of retrospectives to analyze')
    parser.add_argument('--dry', action='store_true', help='Dry run — show changes without writing')
    args = parser.parse_args()

    log(f"=== MOP Learn starting (n={args.n}, dry={args.dry}) ===")

    retros = load_retrospectives(args.n)
    log(f"Loaded {len(retros)} retrospectives")

    telemetry = load_telemetry(50)
    tel_stats = compute_telemetry_stats(telemetry)
    log(f"Loaded {len(telemetry)} telemetry records")

    if not retros and not telemetry:
        log("No data to learn from yet. Run some MOP tasks first.")
        return

    failure_patterns, approach_switches, successful_alts = extract_patterns(retros)

    log(f"Top failure patterns: {failure_patterns.most_common(5)}")
    log(f"Approach switches: {dict(approach_switches)}")

    write_learn_report(failure_patterns, approach_switches, successful_alts, tel_stats, len(retros))

    update_skill_md(failure_patterns, dry=args.dry)

    if not args.dry:
        # Commit updated SKILL.md
        import subprocess
        result = subprocess.run(
            ['git', '-C', str(SKILL_MD.parent.parent.parent), 'add', str(SKILL_MD)],
            capture_output=True
        )
        result2 = subprocess.run(
            ['git', '-C', str(SKILL_MD.parent.parent.parent), 'commit', '-m',
             f'learn: mop-learn updated SKILL.md with {len(failure_patterns)} patterns ({datetime.utcnow().strftime("%Y-%m-%d")})'],
            capture_output=True
        )
        if result2.returncode == 0:
            log("SKILL.md committed to git")
            subprocess.run(['git', '-C', str(SKILL_MD.parent.parent.parent), 'push'],
                         capture_output=True)
            log("Pushed to GitHub")
        else:
            log("Nothing to commit or git error")

    log("=== MOP Learn complete ===")

if __name__ == '__main__':
    main()
