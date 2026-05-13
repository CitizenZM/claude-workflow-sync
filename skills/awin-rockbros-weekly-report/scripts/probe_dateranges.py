#!/usr/bin/env python3
"""Probe which dateRange/<X> values are valid in the legacy URL pattern.
Works for BOTH US (58007) and EU (122456) merchant IDs.
"""
import time, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent))
from awin_helpers import load_creds, login, dismiss_cookies, safe_eval

PROFILE = Path.home() / ".cache" / "awin-isolated-profile"
OUT = Path(__file__).resolve().parent.parent / "output" / "explore"

# Candidate dateRange tokens — Awin's classic URL accepts these strings
CANDIDATES = [
    "today", "yesterday", "last7Days", "thisWeek", "lastWeek",
    "thisMonth", "lastMonth", "last28Days", "quarterToDate",
    "lastQuarter", "yearToDate", "lastYear",
]

def probe(page, mid, label):
    print(f"\n--- {label} (mid={mid}) ---")
    for dr in CANDIDATES:
        url = f"https://ui.awin.com/merchant/{mid}/report/performance-over-time/index/network/awin/dateRange/{dr}"
        page.goto(url, wait_until="domcontentloaded", timeout=45000)
        time.sleep(6)
        dismiss_cookies(page)
        body = safe_eval(page, "() => document.body.innerText || ''", "")
        # try to extract totals
        m = body.find("Grand Totals")
        snip = body[max(0, m-200):m+300] if m > 0 else body[:300]
        has_data = "No data can be found" not in body
        print(f"  {dr}: data={has_data}")
        if has_data:
            # try grabbing a number near "Amount"
            import re
            mm = re.search(r"Amount\s*\n\s*([\d,\.\-]+)", body)
            print(f"    amount sample: {mm.group(1) if mm else '?'}")
            # full text capture for one example each region
            if dr in ("lastMonth", "thisMonth", "last7Days"):
                (OUT / f"daterange_{mid}_{dr}.txt").write_text(body)

if __name__ == "__main__":
    creds = load_creds()
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE),
            headless=True,
            viewport={"width": 1600, "height": 1000},
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
        )
        page = ctx.new_page()
        login(page, creds["email"], creds["password"])
        probe(page, "58007", "US")
        probe(page, "122456", "EU")
        ctx.close()
