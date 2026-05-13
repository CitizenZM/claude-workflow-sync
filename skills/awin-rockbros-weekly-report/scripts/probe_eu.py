#!/usr/bin/env python3
"""Find the right way to access EU advertiser 122456 reports."""
import time, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent))
from awin_helpers import load_creds, login, dismiss_cookies, safe_eval

PROFILE = Path.home() / ".cache" / "awin-isolated-profile"
OUT = Path(__file__).resolve().parent.parent / "output" / "explore"

def main():
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

        # Approach 1: visit EU new UI home FIRST to set merchant context
        print("\n=== Approach 1: new UI home first ===")
        page.goto("https://app.awin.com/en/awin/advertiser/122456/home",
                  wait_until="domcontentloaded", timeout=60000)
        time.sleep(8)
        dismiss_cookies(page)
        body = safe_eval(page, "() => (document.body.innerText||'')", "")
        print(f"  home body len: {len(body)}")
        print(f"  body[:200]: {body[:200]!r}")

        # Now click "Switch to Awin Classic" to get the right base URL
        with ctx.expect_page(timeout=15000) as np:
            safe_eval(page, """() => {
                const el = [...document.querySelectorAll('a, button, span, [role=button]')]
                    .find(x => /switch to awin classic/i.test(x.textContent||''));
                if (el) el.click();
            }""")
        page2 = np.value
        time.sleep(8)
        print(f"  classic URL: {page2.url}")
        page2.screenshot(path=str(OUT / "eu_classic_landing.png"), full_page=True)
        body2 = safe_eval(page2, "() => (document.body.innerText||'').slice(0,2000)", "")
        print(f"  classic body[:400]: {body2[:400]!r}")

        # Navigate to performance over time from this context — try links
        links = safe_eval(page2, """() => [...document.querySelectorAll('a[href]')]
            .map(a => ({text:(a.textContent||'').trim().slice(0,60), href:a.href}))
            .filter(x => x.text && /performance|report/i.test(x.text + x.href))
            .slice(0, 30)""", [])
        print(f"  {len(links)} report-related links found:")
        for l in links[:15]:
            print(f"    {l['text']!r} → {l['href']}")

        # Try the legacy URL on EU
        for url in [
            "https://ui.awin.com/merchant/122456/report/performance-over-time/index/network/awin/dateRange/today",
            "https://ui.awin.com/detailed-reports/awin/advertiser/122456/performance-over-time/default",
        ]:
            print(f"\n  try {url}")
            page2.goto(url, wait_until="domcontentloaded", timeout=45000)
            time.sleep(8)
            dismiss_cookies(page2)
            time.sleep(3)
            b = safe_eval(page2, "() => (document.body.innerText||'').slice(0,500)", "")
            print(f"    final: {page2.url}")
            print(f"    body[:400]: {b[:400]!r}")
            page2.screenshot(path=str(OUT / f"eu_try_{url.split('/')[-3]}.png"), full_page=True)

        ctx.close()

if __name__ == "__main__":
    main()
