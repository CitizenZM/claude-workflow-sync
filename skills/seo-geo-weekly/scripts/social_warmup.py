"""Social warmup execution script — DRY-RUN default.

Daily cron-fireable. Reads today's queue from Obsidian vault, can post via browser-harness
with human-like delays. Defaults to DRY-RUN (logs plan, doesn't post) for safety.

CRITICAL: This script is opt-in. Set DRY_RUN=False and pass --execute to actually post.
First 14 days post-setup: keep DRY_RUN=True. Post manually from phone instead.
"""
import json
import random
import subprocess
import sys
import time
import datetime as dt
from pathlib import Path

VAULT = Path("/Users/xiaozuo/Documents/Obsidian/01-Projects/Dark-Fantasy-SEO-GEO-Weekly")
QUEUE_DIR = VAULT / "Social" / "Queue"
WORKLOG = VAULT / "Worklog.md"
DRY_RUN_DEFAULT = True

# Human-like delays (seconds)
DELAY_BETWEEN_PLATFORMS = (300, 900)  # 5-15 min
DELAY_BEFORE_ACTION = (45, 180)        # 45s-3min
DELAY_BETWEEN_ACTIONS = (90, 240)      # 90s-4min


def human_sleep(low: int, high: int):
    """Sleep a random duration with jitter to mimic human."""
    d = random.uniform(low, high)
    time.sleep(d)
    return d


def load_today_queue() -> dict:
    """Read today's posts from the queue. Each platform has its own file."""
    today = dt.date.today().isoformat()
    queue = {}
    for plat in ("pinterest", "tiktok", "reddit"):
        f = QUEUE_DIR / f"{plat}-{today}.json"
        if f.exists():
            queue[plat] = json.loads(f.read_text())
    return queue


def log_to_worklog(entry: str):
    """Append entry to Worklog.md."""
    ts = dt.datetime.now().isoformat()
    line = f"\n- {ts} [warmup] {entry}"
    with WORKLOG.open("a") as f:
        f.write(line)


def safety_check(platform: str) -> tuple[bool, str]:
    """Pre-flight: verify platform is healthy before posting.
    Returns (ok, reason). If not ok, skip platform today.
    """
    # Check for captcha indicators via browser-harness
    if platform == "pinterest":
        url = "https://www.pinterest.com/"
    elif platform == "tiktok":
        url = "https://www.tiktok.com/foryou"
    elif platform == "reddit":
        url = "https://www.reddit.com/"
    else:
        return False, f"unknown platform {platform}"

    try:
        r = subprocess.run(
            ["browser-harness", "-c", f"""
new_tab('{url}')
wait_for_load()
import time
time.sleep(3)
info = page_info()
title = info.get('title', '')
body_sample = js("return document.body.innerText.slice(0, 800);")
result = {{'title': title, 'has_captcha': 'captcha' in body_sample.lower() or 'verify' in body_sample.lower() or 'are you human' in body_sample.lower(), 'logged_in': 'log in' not in body_sample.lower()[:200]}}
print(result)
"""],
            capture_output=True, text=True, timeout=60,
        )
        out = r.stdout
        if "has_captcha" in out and "True" in out:
            return False, "captcha detected"
        if "logged_in" in out and "False" in out:
            return False, "not logged in"
        return True, "ok"
    except Exception as e:
        return False, f"check failed: {e}"


def execute_pinterest_pin(item: dict, dry_run: bool = True) -> dict:
    """Schedule a pin or post one. Returns {ok, action_taken, message}."""
    if dry_run:
        return {
            "ok": True,
            "action_taken": "dry-run",
            "message": f"Would post pin: {item.get('title')[:60]}",
        }
    # Real posting: open Pinterest create-pin page, fill, submit
    # Per platform-safety rules: human delays between each action
    raise NotImplementedError("Live posting not enabled. Set DRY_RUN=False explicitly.")


def execute_reddit_comment(item: dict, dry_run: bool = True) -> dict:
    if dry_run:
        return {
            "ok": True,
            "action_taken": "dry-run",
            "message": f"Would comment on {item.get('target_url')}: {item.get('comment_text')[:80]}",
        }
    raise NotImplementedError("Live commenting not enabled.")


def execute_tiktok_upload(item: dict, dry_run: bool = True) -> dict:
    """TikTok requires browser upload via tiktok.com/upload. Heavy automation = ban risk.
    Default: prepare the asset, DRY_RUN logs the plan, user uploads manually from phone."""
    if dry_run:
        return {
            "ok": True,
            "action_taken": "dry-run (manual-required)",
            "message": f"User to upload video: {item.get('asset_path')}. Caption ready in queue file.",
        }
    raise NotImplementedError("TikTok automated upload not supported by design.")


def run(dry_run: bool = DRY_RUN_DEFAULT):
    queue = load_today_queue()
    if not queue:
        log_to_worklog("no queue for today — skipping")
        return {"status": "empty", "platforms_run": []}

    print(f"[warmup] starting daily warmup, dry_run={dry_run}, platforms: {list(queue.keys())}")
    results = {}

    # Randomize platform order to avoid pattern
    platforms = list(queue.keys())
    random.shuffle(platforms)

    for i, plat in enumerate(platforms):
        items = queue[plat]
        print(f"\n[warmup] === {plat} ({len(items)} items) ===")

        ok, reason = safety_check(plat)
        if not ok:
            print(f"  ✋ skipping {plat}: {reason}")
            log_to_worklog(f"{plat} skipped — {reason}")
            results[plat] = {"status": "skipped", "reason": reason}
            continue

        # Add inter-platform delay
        if i > 0:
            d = human_sleep(*DELAY_BETWEEN_PLATFORMS)
            print(f"  ⏳ inter-platform delay: {d:.0f}s")

        plat_results = []
        for item in items:
            d = human_sleep(*DELAY_BEFORE_ACTION)
            print(f"  ⏳ pre-action delay: {d:.0f}s")
            if plat == "pinterest":
                r = execute_pinterest_pin(item, dry_run)
            elif plat == "tiktok":
                r = execute_tiktok_upload(item, dry_run)
            elif plat == "reddit":
                r = execute_reddit_comment(item, dry_run)
            else:
                r = {"ok": False, "message": f"unknown platform {plat}"}
            plat_results.append(r)
            print(f"  → {r['message']}")
            log_to_worklog(f"{plat} action: {r['message']}")
            # Inter-action delay
            d = human_sleep(*DELAY_BETWEEN_ACTIONS)

        results[plat] = {"status": "done", "actions": plat_results}

    summary = f"daily warmup complete. dry_run={dry_run}. " + ", ".join(
        f"{p}={len(r.get('actions',[]))} actions" if r.get("status") == "done" else f"{p}=skipped"
        for p, r in results.items()
    )
    print(f"\n[warmup] {summary}")
    log_to_worklog(summary)
    return results


if __name__ == "__main__":
    dry_run = True
    if "--execute" in sys.argv:
        dry_run = False
        print("⚠️  LIVE EXECUTION MODE — will post to platforms")
    run(dry_run=dry_run)
