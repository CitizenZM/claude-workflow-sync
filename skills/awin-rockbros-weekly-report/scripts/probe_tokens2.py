#!/usr/bin/env python3
"""Find correct last-7-days token + correct publisher-performance URL."""
import time, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent))
from awin_helpers import load_creds, login, dismiss_cookies, safe_eval

PROFILE = Path.home() / ".cache" / "awin-isolated-profile"

CANDIDATES_7D = ["last7days", "lastSevenDays", "previous7Days", "previousSevenDays",
                 "past7Days", "rolling7Days", "weekToDate", "wtd"]

CANDIDATES_PUB_URL = [
    "https://ui.awin.com/merchant/58007/report/publisher-performance/index/network/awin/dateRange/thisWeek",
    "https://ui.awin.com/merchant/58007/report/affiliate-performance/index/network/awin/dateRange/thisWeek",
    "https://ui.awin.com/merchant/58007/report/publisher/index/network/awin/dateRange/thisWeek",
    # New URL pattern from earlier discovery
    "https://ui.awin.com/detailed-reports/us/awin/advertiser/58007/publisher-performance/default",
]

if __name__ == "__main__":
    creds = load_creds()
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE), headless=True,
            viewport={"width": 1600, "height": 1000},
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"])
        page = ctx.new_page()
        login(page, creds["email"], creds["password"])

        print("=== 7-day tokens ===")
        for t in CANDIDATES_7D:
            url = f"https://ui.awin.com/merchant/58007/report/performance-over-time/index/network/awin/dateRange/{t}"
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            time.sleep(5)
            b = safe_eval(page, "() => document.body.innerText || ''", "")
            err = "Invalid url" in b
            has_perf = "Total Amount" in b
            print(f"  {t}: invalid={err}  hasPerf={has_perf}")

        print("\n=== Publisher URL candidates ===")
        for url in CANDIDATES_PUB_URL:
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            time.sleep(8)
            dismiss_cookies(page)
            time.sleep(3)
            b = safe_eval(page, "() => document.body.innerText || ''", "")
            err = "Invalid url" in b or "error" in page.url
            has_pub = "Publisher Performance" in b or "Active Publishers" in b
            has_grand = "Grand Totals" in b
            print(f"  {url[:90]}... → err={err} hasPubPerf={has_pub} hasGrand={has_grand}")
            if has_pub and not err:
                # save for parsing
                from pathlib import Path
                OUT = Path(__file__).resolve().parent.parent / "output" / "explore"
                slug = url.replace("/", "_").replace(":", "")[:50]
                (OUT / f"pubperf_{slug}.txt").write_text(b[:8000])

        ctx.close()
