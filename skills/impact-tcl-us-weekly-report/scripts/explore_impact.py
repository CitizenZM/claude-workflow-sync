#!/usr/bin/env python3
"""Explore Impact.com dashboard for TCL reporting — find all data URLs.

Uses the EXISTING impact-tcl-us browser profile (already logged in from outreach).
Report profile: separate dir ~/.cache/impact-report-profile to avoid session collision.

Key discoveries from outreach skill:
  - Login: https://app.impact.com (root)
  - Auth: affiliate@celldigital.co / Celldigital2024*
  - Impact is React SPA — page.mouse.click() needed for interactive elements
  - Secure advertiser paths: https://app.impact.com/secure/advertiser/...
  - Program ID: 48321 (TCL US)
"""
import json, re, time, subprocess, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent.parent / "output" / "explore_impact"
OUT.mkdir(parents=True, exist_ok=True)

# Use existing logged-in outreach profile — read-only, no session conflict
PROFILE_OUTREACH = Path.home() / ".claude" / "browser-profiles" / "impact-tcl-us"
# Fresh isolated profile for report workflow (will login fresh)
PROFILE_REPORT = Path.home() / ".cache" / "impact-report-profile"
PROFILE_REPORT.mkdir(parents=True, exist_ok=True)

PROGRAM_ID = "48321"
EMAIL = "affiliate@celldigital.co"
PASSWORD = "Celldigital2024*"

def safe_eval(page, expr, default=""):
    for _ in range(3):
        try: return page.evaluate(expr)
        except: time.sleep(1)
    return default

def dump(page, name, label=""):
    body = safe_eval(page, "() => document.body.innerText || ''", "")
    links = safe_eval(page, """() => [...document.querySelectorAll('a[href]')]
        .map(a => ({text:(a.textContent||'').trim().slice(0,80), href:a.href}))
        .filter(x => x.text && x.href).slice(0,300)""", [])
    (OUT / f"{name}.txt").write_text(
        f"URL: {page.url}\nLABEL: {label}\n\n=== BODY (first 8000) ===\n{body[:8000]}\n\n=== LINKS ===\n" +
        "\n".join(f"{l['text']}\t{l['href']}" for l in links))
    page.set_viewport_size({"width": 1600, "height": 2400})
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=True)
    page.set_viewport_size({"width": 1600, "height": 1000})
    print(f"[dump] {name} | url={page.url[-80:]} | bodyLen={len(body)} | links={len(links)}", flush=True)
    return body, links

def login(page):
    page.goto("https://app.impact.com", wait_until="domcontentloaded", timeout=60000)
    time.sleep(4)
    body = safe_eval(page, "() => document.body.innerText || ''", "")
    if any(m in body for m in ["Dashboard","Performance","Partners","Reporting","My Programs"]):
        print("[login] session already active", flush=True); return True
    # Fill login form
    for sel in ['input[type="email"]','input[name="email"]','input[placeholder*="email" i]']:
        try: page.fill(sel, EMAIL, timeout=5000); break
        except: continue
    time.sleep(0.5)
    page.evaluate("""() => {
        const b=[...document.querySelectorAll('button,input[type=submit]')]
            .find(x=>/next|continue|sign.*in|log.*in/i.test((x.textContent||x.value||'')));
        if(b) b.click();
    }""")
    time.sleep(4)
    for sel in ['input[type="password"]','input[name="password"]']:
        try: page.fill(sel, PASSWORD, timeout=5000); break
        except: continue
    time.sleep(0.5)
    page.evaluate("""() => {
        const b=[...document.querySelectorAll('button,input[type=submit]')]
            .find(x=>/sign.*in|log.*in|submit|continue/i.test((x.textContent||x.value||'')));
        if(b) b.click();
    }""")
    for i in range(90):
        time.sleep(1)
        body = safe_eval(page, "() => document.body.innerText || ''", "")
        if any(m in body for m in ["Dashboard","Performance","Partners","Reporting","My Programs"]):
            print(f"[login] OK after {i}s", flush=True); return True
    print(f"[login] FAILED url={page.url}", flush=True); return False

def main():
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE_REPORT), headless=True,
            viewport={"width":1600,"height":1000},
            args=["--disable-blink-features=AutomationControlled","--no-sandbox"])
        page = ctx.new_page()

        if not login(page):
            page.screenshot(path=str(OUT / "_login_fail.png"))
            ctx.close(); sys.exit(2)

        # 1. Dump dashboard
        page.goto("https://app.impact.com", wait_until="domcontentloaded", timeout=60000)
        time.sleep(8)
        body, links = dump(page, "01_dashboard", "Impact dashboard root")
        print(f"  body preview: {body[:400]!r}", flush=True)

        # 2. Probe secure/advertiser report URLs
        REPORT_URLS = [
            ("perf_overview",      "https://app.impact.com/secure/advertiser/reporting/performance/overview.ihtml"),
            ("perf_trend",         "https://app.impact.com/secure/advertiser/reporting/performance/trend.ihtml"),
            ("publisher_report",   "https://app.impact.com/secure/advertiser/reporting/partner/overview.ihtml"),
            ("new_publisher",      "https://app.impact.com/secure/advertiser/reporting/partner/new-partners.ihtml"),
            ("click_report",       "https://app.impact.com/secure/advertiser/reporting/performance/clicks.ihtml"),
            ("conversion_report",  "https://app.impact.com/secure/advertiser/reporting/performance/conversions.ihtml"),
            ("action_report",      "https://app.impact.com/secure/advertiser/reporting/action/overview.ihtml"),
            ("partner_manage",     "https://app.impact.com/secure/advertiser/radius/fr/partnerManage.ihtml"),
            ("partner_discover",   "https://app.impact.com/secure/advertiser/discover/radius/fr/partner_discover.ihtml"),
        ]
        working = []
        for name, url in REPORT_URLS:
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=30000)
                time.sleep(6)
                b = safe_eval(page, "() => document.body.innerText || ''", "")
                has_data = len(b) > 500 and "Page Not Found" not in b and "404" not in b[:200]
                print(f"  {name}: has_data={has_data} url={page.url[-60:]}", flush=True)
                if has_data:
                    dump(page, f"02_{name}", url)
                    working.append({"name": name, "url": url, "final_url": page.url, "body_len": len(b)})
            except Exception as e:
                print(f"  {name}: ERROR {e}", flush=True)

        # 3. Navigate via dashboard nav links to find report section
        page.goto("https://app.impact.com", wait_until="domcontentloaded", timeout=60000)
        time.sleep(8)
        nav = safe_eval(page, """() => [...document.querySelectorAll('a[href]')]
            .map(a => ({text:(a.textContent||'').trim().slice(0,60), href:a.href}))
            .filter(x => x.text && x.href && x.text.length > 1)
            .slice(0, 100)""", [])
        report_nav = [l for l in nav if any(k in l["href"].lower() or k in l["text"].lower()
                      for k in ["report","performance","partner","analytic","overview","click","action"])]
        print(f"\n[nav] {len(report_nav)} report-related nav links:", flush=True)
        for l in report_nav[:20]: print(f"  {l['text']!r} → {l['href']}", flush=True)

        # 4. Try clicking Reporting nav item
        clicked = safe_eval(page, """() => {
            const links = [...document.querySelectorAll('a,button,[role=menuitem]')];
            const r = links.find(x => /^reporting$/i.test((x.textContent||'').trim()));
            if (r) { r.click(); return 'clicked'; }
            return 'not found';
        }""", "")
        print(f"[nav] click Reporting: {clicked}", flush=True)
        time.sleep(5)
        dump(page, "03_after_reporting_click", "After clicking Reporting nav")

        # 5. Save working URLs
        (OUT / "_working_urls.json").write_text(json.dumps(working, indent=2))
        print(f"\n[DONE] {len(working)} working report URLs found", flush=True)
        for w in working:
            print(f"  {w['name']}: {w['final_url']}", flush=True)

        ctx.close()

if __name__ == "__main__":
    main()
