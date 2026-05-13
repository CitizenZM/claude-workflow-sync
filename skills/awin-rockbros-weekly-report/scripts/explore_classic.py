#!/usr/bin/env python3
"""Probe Awin reports for week/month GMV + channel-mix data sources."""
import re, time
from pathlib import Path
from playwright.sync_api import sync_playwright
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from awin_helpers import load_creds, login, dismiss_cookies, safe_eval

SKILL = Path(__file__).resolve().parent.parent
OUT = SKILL / "output" / "explore"
OUT.mkdir(parents=True, exist_ok=True)
PROFILE = Path.home() / ".cache" / "awin-isolated-profile"
MID = "58007"

def dump(page, name):
    body = safe_eval(page, "() => (document.body.innerText||'')", "")
    links = safe_eval(page, """() => [...document.querySelectorAll('a[href]')]
            .map(a => ({text:(a.textContent||'').trim().slice(0,80), href:a.href}))
            .filter(x => x.text && x.href)
            .slice(0, 200)""", [])
    (OUT / f"{name}.txt").write_text(
        f"URL: {page.url}\n\n=== BODY ===\n{body[:8000]}\n\n=== LINKS ===\n"
        + "\n".join(f"{l['text']}\t{l['href']}" for l in links))
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=True)
    print(f"[dump] {name} | url={page.url} | bodyLen={len(body)} | links={len(links)}", flush=True)
    return body, links

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
        if not login(page, creds["email"], creds["password"]):
            print("[ABORT] login failed", flush=True)
            ctx.close()
            return

        # Go to new UI home
        page.goto(f"https://app.awin.com/en/awin/advertiser/{MID}/home",
                  wait_until="domcontentloaded", timeout=60000)
        time.sleep(8)
        dismiss_cookies(page)
        body, links = dump(page, "01_new_home")

        # Capture URL that opens when clicking "Switch to Awin Classic"
        classic_href = safe_eval(page, """() => {
            const el = [...document.querySelectorAll('a, button, span, [role=button]')]
                .find(x => /switch to awin classic/i.test(x.textContent||''));
            if (!el) return null;
            // anchor: take href; otherwise find nearest anchor ancestor
            let a = el.tagName === 'A' ? el : el.closest('a');
            if (a && a.href) return a.href;
            // intercept click navigation
            return 'NEED_CLICK';
        }""", None)
        print(f"[classic] href detection: {classic_href}", flush=True)

        if classic_href == "NEED_CLICK":
            print("[classic] clicking element (may open popup)", flush=True)
            try:
                with ctx.expect_page(timeout=15000) as new_page_info:
                    safe_eval(page, """() => {
                        const el = [...document.querySelectorAll('a, button, span, [role=button]')]
                            .find(x => /switch to awin classic/i.test(x.textContent||''));
                        if (el) el.click();
                    }""")
                new_page = new_page_info.value
                time.sleep(8)
                page = new_page  # switch to popup
                classic_url = page.url
                print(f"[classic] popup opened: {classic_url}", flush=True)
            except Exception as e:
                print(f"[classic] no popup, checking same-tab nav: {e}", flush=True)
                time.sleep(5)
                classic_url = page.url
            classic_link = {"text": "Switch to Awin Classic", "href": classic_url}
        elif classic_href:
            classic_link = {"text": "Switch to Awin Classic", "href": classic_href}
        else:
            classic_link = None

        if not classic_link:
            print("[WARN] no Awin Classic link found", flush=True)
        else:
            print(f"[classic] {classic_link['href']}", flush=True)
            page.goto(classic_link["href"], wait_until="domcontentloaded", timeout=60000)
            time.sleep(10)
            dismiss_cookies(page)
            body2, links2 = dump(page, "02_classic_landing")

            # Walk all report links visible on classic
            report_links = [l for l in links2 if "report" in (l["text"] + l["href"]).lower()]
            seen = set()
            uniq = []
            for r in report_links:
                if r["href"] in seen: continue
                seen.add(r["href"])
                uniq.append(r)
            print(f"[classic] {len(uniq)} unique report links", flush=True)
            (OUT / "_report_links.txt").write_text("\n".join(f"{l['text']}\t{l['href']}" for l in uniq))

            for i, rl in enumerate(uniq[:25]):
                slug = re.sub(r"[^a-z0-9]+", "_", rl["text"].lower())[:30] or f"r{i}"
                try:
                    page.goto(rl["href"], wait_until="domcontentloaded", timeout=45000)
                    time.sleep(6)
                    dismiss_cookies(page)
                    time.sleep(4)
                    dump(page, f"03_{i:02d}_{slug}")
                except Exception as e:
                    print(f"  ERROR {rl['href']}: {e}", flush=True)

        ctx.close()

if __name__ == "__main__":
    main()
