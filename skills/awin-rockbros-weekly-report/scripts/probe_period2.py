#!/usr/bin/env python3
"""Debug — find the actual button for 'Last Month' + verify EU URL."""
import time, json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent))
from awin_helpers import load_creds, login, dismiss_cookies, safe_eval

PROFILE = Path.home() / ".cache" / "awin-isolated-profile"

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

        # Probe US first — list ALL buttons
        page.goto("https://ui.awin.com/detailed-reports/us/awin/advertiser/58007/performance-over-time/default",
                  wait_until="domcontentloaded", timeout=60000)
        time.sleep(12)
        dismiss_cookies(page)
        time.sleep(5)

        all_btns = safe_eval(page, """() => [...document.querySelectorAll('button')]
            .map(b => ({text:(b.textContent||'').trim().slice(0,40), cls:b.className.slice(0,80), type:b.type}))
            .filter(b => b.text.length > 0 && b.text.length < 40)""", [])
        print(f"=== US Performance Over Time: {len(all_btns)} buttons ===")
        for b in all_btns:
            print(f"  text={b['text']!r}  cls={b['cls']!r}  type={b['type']}")

        # Try clicking "Last Month" with a stricter selector via Playwright (not safe_eval)
        print("\n=== Try Playwright .get_by_text('Last Month').click() ===")
        try:
            page.get_by_role("button", name="Last Month").first.click(timeout=5000)
            time.sleep(3)
            page.get_by_role("button", name="Generate Report").first.click(timeout=5000)
            time.sleep(10)
            body = safe_eval(page, "() => (document.body.innerText||'').slice(0,2000)", "")
            print("after click — body snippet:")
            print(body[:1500])
        except Exception as e:
            print(f"Playwright role click failed: {e}")

        # Probe EU region segment
        print("\n=== Probe EU region segments ===")
        for seg in ("eu","uk","de","gb","at","es","fr","it","nl","pl","se","ie","au"):
            try:
                page.goto(f"https://ui.awin.com/detailed-reports/{seg}/awin/advertiser/122456/performance-over-time/default",
                          wait_until="domcontentloaded", timeout=30000)
                time.sleep(4)
                final = page.url
                err = "error" in final
                body = safe_eval(page, "() => (document.body.innerText||'').slice(0,300)", "")
                marker = "Performance Over Time" in body
                print(f"  /{seg}/ → final={final[:80]} err={err} hasPerfReport={marker}")
                if marker:
                    print(f"    ✓ WORKING SEG: {seg}")
                    break
            except Exception as e:
                print(f"  /{seg}/ ERROR: {e}")

        ctx.close()

if __name__ == "__main__":
    main()
