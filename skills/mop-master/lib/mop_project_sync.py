#!/usr/bin/env python3
"""
MOP Per-Project Auto-Sync — discovers git repos under ~/Projects/ and syncs them
to GitHub when they accumulate ≥3 changes. Complements mop_autosync.py (which only
covers config + vault).

Usage:
  python3 mop_project_sync.py             # respects 3-change threshold
  python3 mop_project_sync.py --force     # commit + push regardless of count
  python3 mop_project_sync.py --daily     # cron mode (no threshold)
  python3 mop_project_sync.py --list      # list discovered projects, don't sync
"""
import os, sys, json, time, subprocess
from datetime import datetime
from pathlib import Path

PROJECTS_ROOT = Path.home() / "Projects"
LOG = Path.home() / ".claude" / "mop" / "project-sync.log"
THROTTLE = Path.home() / ".claude" / "mop" / "project-sync.throttle"
MIN_CHANGES = 3
MIN_INTERVAL = 300  # 5 minutes between pushes per project

def log(msg):
    ts = datetime.utcnow().isoformat(timespec='seconds')
    LOG.parent.mkdir(exist_ok=True)
    with open(LOG, 'a') as f:
        f.write(f"[{ts}] {msg}\n")

def discover_projects():
    """Find all git repos directly under PROJECTS_ROOT (depth 1 only)."""
    if not PROJECTS_ROOT.exists():
        return []
    return [p for p in PROJECTS_ROOT.iterdir() if p.is_dir() and (p / ".git").exists()]

def throttled(project_path):
    if not THROTTLE.exists():
        return False
    try:
        data = json.loads(THROTTLE.read_text())
    except Exception:
        return False
    return (time.time() - data.get(str(project_path), 0)) < MIN_INTERVAL

def mark_pushed(project_path):
    data = {}
    if THROTTLE.exists():
        try:
            data = json.loads(THROTTLE.read_text())
        except Exception:
            pass
    data[str(project_path)] = time.time()
    THROTTLE.write_text(json.dumps(data))

def run(cmd, cwd, timeout=30):
    try:
        r = subprocess.run(cmd, cwd=str(cwd), capture_output=True, text=True, timeout=timeout)
        return r.returncode, r.stdout.strip(), r.stderr.strip()
    except Exception as e:
        return -1, "", str(e)

def has_remote(project_path):
    rc, out, _ = run(["git", "remote"], project_path)
    return rc == 0 and out.strip()

def sync_project(project_path, force=False):
    name = project_path.name
    stats = {"project": name, "skipped": False, "committed": False, "pushed": False, "files": 0, "reason": ""}

    if throttled(project_path) and not force:
        stats["skipped"] = True
        stats["reason"] = "throttled"
        return stats

    if not has_remote(project_path):
        stats["skipped"] = True
        stats["reason"] = "no remote configured"
        return stats

    rc, out, err = run(["git", "status", "--porcelain"], project_path)
    if rc != 0:
        stats["skipped"] = True
        stats["reason"] = f"status failed: {err[:80]}"
        return stats

    if not out.strip():
        stats["skipped"] = True
        stats["reason"] = "no changes"
        return stats

    changed = [line[2:].lstrip() for line in out.split('\n') if line.strip()]
    stats["files"] = len(changed)

    if not force and len(changed) < MIN_CHANGES:
        stats["skipped"] = True
        stats["reason"] = f"below threshold ({len(changed)}/{MIN_CHANGES})"
        return stats

    rc, _, err = run(["git", "add", "-A"], project_path)
    if rc != 0:
        stats["reason"] = f"add failed: {err[:80]}"
        return stats

    host = subprocess.run(["scutil", "--get", "LocalHostName"], capture_output=True, text=True).stdout.strip() or "mac"
    summary = f"{len(changed)} files" if len(changed) > 1 else changed[0]
    msg = f"auto-sync: {summary} [{host}]"

    rc, _, err = run(["git", "commit", "-m", msg, "--no-verify"], project_path)
    if rc != 0:
        if "nothing to commit" in err.lower():
            stats["skipped"] = True
            stats["reason"] = "nothing to commit"
        else:
            stats["reason"] = f"commit failed: {err[:80]}"
        return stats

    stats["committed"] = True

    # Pull-rebase then push
    run(["git", "pull", "--rebase", "--autostash"], project_path, timeout=60)
    rc, _, err = run(["git", "push"], project_path, timeout=60)
    if rc == 0:
        stats["pushed"] = True
        mark_pushed(project_path)
    else:
        stats["reason"] = f"push failed: {err[:120]}"

    return stats

def main():
    force = "--force" in sys.argv or "--daily" in sys.argv
    list_only = "--list" in sys.argv

    projects = discover_projects()
    if list_only:
        print(f"Discovered {len(projects)} git projects under {PROJECTS_ROOT}:")
        for p in projects:
            remote = has_remote(p)
            print(f"  {'✓' if remote else '✗'} {p.name}  ({'remote' if remote else 'NO REMOTE'})")
        return

    if not projects:
        log("No projects found")
        return

    for p in projects:
        result = sync_project(p, force=force)
        if not result["skipped"]:
            log(f"{result['project']}: committed={result['committed']} pushed={result['pushed']} files={result['files']} reason={result['reason']}")
        elif result["reason"] not in ("no changes", "throttled", "no remote configured") and not result["reason"].startswith("below threshold"):
            log(f"{result['project']}: SKIPPED {result['reason']}")

if __name__ == "__main__":
    main()
