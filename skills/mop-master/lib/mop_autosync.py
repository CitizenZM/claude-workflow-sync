#!/usr/bin/env python3
"""
MOP Auto-Sync — runs after every Claude response (Stop hook) and daily (cron).

Strategy:
- For each tracked repo (config + vault):
  - Check if there are uncommitted changes
  - If yes: stage all, commit with auto-message, push
  - If no: skip (no API call, no commit, no push)
- Throttled: max 1 push per repo per 60s (avoids spam during rapid edits)
- Background-safe: runs detached so it doesn't block Claude's response
- Silent on success: only logs to ~/.claude/mop/autosync.log

Repos:
  ~/Documents/Claude/config        → claude-config (skills, hooks, settings)
  ~/Documents/Obsidian             → claude-obsidian-vault (project notes, runs)
"""
import os, sys, json, time, subprocess, hashlib
from datetime import datetime
from pathlib import Path

REPOS = [
    Path.home() / "Documents" / "Claude" / "config",
    Path.home() / "Documents" / "Obsidian",
]

LOG = Path.home() / ".claude" / "mop" / "autosync.log"
THROTTLE = Path.home() / ".claude" / "mop" / "autosync.throttle"
MIN_INTERVAL = 60  # seconds — minimum between pushes per repo
MIN_CHANGES = 3    # minimum file changes to trigger sync (override with --force or daily cron)
FORCE_FLAG = "--force"
DAILY_FLAG = "--daily"  # cron uses this to ignore threshold

def log(msg):
    ts = datetime.utcnow().isoformat(timespec='seconds')
    LOG.parent.mkdir(exist_ok=True)
    with open(LOG, 'a') as f:
        f.write(f"[{ts}] {msg}\n")

def throttled(repo_path):
    """Return True if this repo was pushed within MIN_INTERVAL seconds."""
    if not THROTTLE.exists():
        return False
    try:
        data = json.loads(THROTTLE.read_text())
    except Exception:
        return False
    last = data.get(str(repo_path), 0)
    return (time.time() - last) < MIN_INTERVAL

def mark_pushed(repo_path):
    data = {}
    if THROTTLE.exists():
        try:
            data = json.loads(THROTTLE.read_text())
        except Exception:
            pass
    data[str(repo_path)] = time.time()
    THROTTLE.write_text(json.dumps(data))

def run(cmd, cwd, timeout=30):
    """Run a command, return (rc, stdout, stderr)."""
    try:
        result = subprocess.run(
            cmd, cwd=str(cwd), capture_output=True, text=True,
            timeout=timeout
        )
        return result.returncode, result.stdout.strip(), result.stderr.strip()
    except subprocess.TimeoutExpired:
        return -1, "", "timeout"
    except Exception as e:
        return -2, "", str(e)

def sync_repo(repo_path, force=False):
    """Check for changes, commit, push. Returns dict with stats.
    force=True bypasses the MIN_CHANGES threshold (used by --force and --daily flags).
    """
    name = repo_path.name
    stats = {"repo": name, "skipped": False, "committed": False, "pushed": False, "files": 0, "reason": ""}

    if not (repo_path / ".git").exists():
        stats["skipped"] = True
        stats["reason"] = "not a git repo"
        return stats

    if throttled(repo_path) and not force:
        stats["skipped"] = True
        stats["reason"] = "throttled"
        return stats

    # Check for changes
    rc, out, err = run(["git", "status", "--porcelain"], repo_path)
    if rc != 0:
        stats["skipped"] = True
        stats["reason"] = f"status failed: {err}"
        return stats

    if not out.strip():
        stats["skipped"] = True
        stats["reason"] = "no changes"
        return stats

    # Parse git status --porcelain output safely.
    # Format: 'XY filename' where XY are 2 status chars + 1 space separator.
    # For renames: 'R  old -> new' — we take the new path.
    changed_files = []
    for line in out.split('\n'):
        if len(line) < 4:
            continue
        # Strip the 2-char status + at least 1 space, but tolerate extra whitespace
        path = line[2:].lstrip()
        # Handle rename: 'old -> new' — take the new path
        if ' -> ' in path:
            path = path.split(' -> ', 1)[1]
        # Strip surrounding quotes that git uses for paths with special chars
        if path.startswith('"') and path.endswith('"'):
            path = path[1:-1]
        if path:
            changed_files.append(path)
    stats["files"] = len(changed_files)

    # MIN_CHANGES threshold — defer commit until threshold reached (unless forced)
    if not force and len(changed_files) < MIN_CHANGES:
        stats["skipped"] = True
        stats["reason"] = f"below threshold ({len(changed_files)}/{MIN_CHANGES} changes)"
        return stats

    # Stage + commit
    rc, _, err = run(["git", "add", "-A"], repo_path)
    if rc != 0:
        stats["reason"] = f"add failed: {err}"
        return stats

    # Auto-commit message — summarize changes briefly
    summary = summarize_changes(changed_files)
    host = subprocess.run(["scutil", "--get", "LocalHostName"], capture_output=True, text=True).stdout.strip() or "mac"
    msg = f"auto-sync: {summary} [{host}]"

    rc, _, err = run(["git", "commit", "-m", msg, "--no-verify"], repo_path)
    if rc != 0:
        if "nothing to commit" in err.lower():
            stats["skipped"] = True
            stats["reason"] = "nothing to commit after add"
        else:
            stats["reason"] = f"commit failed: {err}"
        return stats

    stats["committed"] = True

    # Pull-rebase to avoid conflicts from other devices, then push
    rc, _, err = run(["git", "pull", "--rebase", "--autostash"], repo_path, timeout=60)
    if rc != 0:
        stats["reason"] = f"pull-rebase failed: {err}"
        log(f"{name}: pull-rebase failed, will retry push anyway")

    rc, _, err = run(["git", "push"], repo_path, timeout=60)
    if rc == 0:
        stats["pushed"] = True
        mark_pushed(repo_path)
    else:
        stats["reason"] = f"push failed: {err[:100]}"

    return stats

def summarize_changes(files):
    """One-line summary of changes."""
    if not files:
        return "no changes"
    if len(files) == 1:
        return files[0]
    # Group by top-level dir
    dirs = {}
    for f in files:
        top = f.split('/')[0] if '/' in f else 'root'
        dirs[top] = dirs.get(top, 0) + 1
    parts = [f"{d}({n})" for d, n in sorted(dirs.items(), key=lambda x: -x[1])[:3]]
    return f"{len(files)} files in {', '.join(parts)}"

def main():
    # Flags: --force ignores throttle + threshold; --daily ignores threshold (cron use)
    force = FORCE_FLAG in sys.argv or DAILY_FLAG in sys.argv

    # Check if invoked as Stop hook (stdin has JSON) or directly
    stop_hook = not sys.stdin.isatty()
    raw = sys.stdin.read() if stop_hook else ""

    results = []
    for repo in REPOS:
        result = sync_repo(repo, force=force)
        results.append(result)
        if not result["skipped"]:
            log(f"{result['repo']}: committed={result['committed']} pushed={result['pushed']} files={result['files']} reason={result['reason']}")
        elif result["reason"] not in ("no changes", "throttled") and not result["reason"].startswith("below threshold"):
            log(f"{result['repo']}: SKIPPED {result['reason']}")

    # If Stop hook, pass through the input unchanged
    if stop_hook:
        sys.stdout.write(raw)

    # Exit cleanly
    sys.exit(0)

if __name__ == "__main__":
    main()
