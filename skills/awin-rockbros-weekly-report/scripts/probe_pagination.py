#!/usr/bin/env python3
"""Test if rowsPerPage/limit param + pagination works on affiliate-performance."""
import time, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent))
from awin_helpers import load_creds, login, dismiss_cookies, safe_eval

PROFILE = Path.home() / ".cache" / "awin-isolated-profile"

CANDIDATES = [
    "https://ui.awin.com/merchant/58007/report/affiliate-performance/index/network/awin/dateRange/lastMonth/rowsPerPage/400",
    "https://ui.awin.com/merchant/58007/report/affiliate-performance/index/network/awin/dateRange/lastMonth/limit/400",
    "https://ui.awin.com/merchant/58007/report/affiliate-performance/index/network/awin/dateRange/lastMonth?rowsPerPage=400",
    "https://ui.awin.com/merchant/58007/report/affiliate-performance/index/network/awin/dateRange/lastMonth/perPage/400",
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
        for url in CANDIDATES:
            page.goto(url, wait_until="domcontentloaded", timeout=45000)
            time.sleep(8)
            dismiss_cookies(page)
            time.sleep(3)
            b = safe_eval(page, "() => document.body.innerText || ''", "")
            import re
            m = re.search(r"Showing 1 - (\d+) of (\d+)", b)
            invalid = "Invalid url" in b
            print(f"{url[-60:]}: invalid={invalid} | {m.group(0) if m else 'no count'}")

        # Also try clicking "400" rows-per-page option then re-scrape
        print("\n=== Try clicking '400' rows per page ===")
        page.goto("https://ui.awin.com/merchant/58007/report/affiliate-performance/index/network/awin/dateRange/lastMonth",
                  wait_until="domcontentloaded", timeout=45000)
        time.sleep(8)
        dismiss_cookies(page)
        time.sleep(3)
        # Find the select for rows-per-page
        info = safe_eval(page, """() => {
            const selects = [...document.querySelectorAll('select')];
            return selects.map(s => ({
                name: s.name || '',
                opts: [...s.options].map(o => o.value + ':' + o.textContent.trim())
            }));
        }""", [])
        print(info)
        # Choose 400
        clicked = safe_eval(page, """() => {
            const selects = [...document.querySelectorAll('select')];
            for (const s of selects) {
                const opt = [...s.options].find(o => o.textContent.trim() === '400');
                if (opt) {
                    s.value = opt.value;
                    s.dispatchEvent(new Event('change', {bubbles:true}));
                    return 'changed:' + s.name;
                }
            }
            return null;
        }""", None)
        print(f"changed: {clicked}")
        time.sleep(10)
        b = safe_eval(page, "() => document.body.innerText || ''", "")
        import re
        m = re.search(r"Showing 1 - (\d+) of (\d+)", b)
        print(f"after change: {m.group(0) if m else 'no count'}")

        ctx.close()
