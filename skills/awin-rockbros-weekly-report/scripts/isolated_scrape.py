#!/usr/bin/env python3
"""Isolated Awin scraper — runs its own Chromium instance (separate user-data-dir)
so it does not conflict with the active MCP browser session.

Outputs per region:
  output/{us|eu}_home.json
  output/{us|eu}_home.png
  output/{us|eu}_publishers_full.png
  output/{us|eu}_partnerships.json
  output/{us|eu}_partnerships.png
"""
import json, os, sys, time, subprocess, traceback
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

SKILL_DIR = Path(__file__).resolve().parent.parent
OUT = SKILL_DIR / "output"
OUT.mkdir(exist_ok=True)
PROFILE_DIR = Path.home() / ".cache" / "awin-isolated-profile"
PROFILE_DIR.mkdir(parents=True, exist_ok=True)

REGIONS = {
    "us": {"mid": "58007"},
    "eu": {"mid": "122456"},
}

def load_creds():
    out = subprocess.run(
        ["node", "-e",
         "const {decrypt}=require(process.env.HOME+'/.claude/setup-credentials.js');"
         "const fs=require('fs');"
         "const d=JSON.parse(fs.readFileSync(process.env.HOME+'/.claude/credentials.json'));"
         "const a=JSON.parse(decrypt(d.awin));"
         "process.stdout.write(JSON.stringify({email:a.email,password:a.password}));"],
        capture_output=True, text=True, check=True)
    return json.loads(out.stdout)

def login(page, email, password):
    page.goto("https://app.awin.com/login", wait_until="domcontentloaded", timeout=60000)
    time.sleep(2)
    # cookie banner
    try:
        page.evaluate("""() => {
            const b = [...document.querySelectorAll('button')].find(x => /accept all/i.test(x.textContent));
            if (b) b.click();
        }""")
        time.sleep(1)
    except Exception: pass
    # email
    try:
        page.fill('input[type="email"], input[name="username"]', email, timeout=15000)
    except PWTimeout:
        pass
    time.sleep(0.5)
    page.evaluate("""() => {
        const b = [...document.querySelectorAll('button')].find(x => /continue/i.test(x.textContent));
        if (b) b.click();
    }""")
    time.sleep(3)
    try:
        page.fill('input[type="password"]', password, timeout=15000)
    except PWTimeout:
        pass
    time.sleep(0.5)
    page.evaluate("""() => {
        const b = [...document.querySelectorAll('button')].find(x => /sign in|log in|submit/i.test(x.textContent));
        if (b) b.click();
    }""")
    # wait for dashboard — Awin's /id.awin.com redirect keeps "/login" in URL briefly
    # so detect by visible content instead
    for i in range(60):
        time.sleep(1)
        try:
            body = page.evaluate("() => document.body.innerText || ''")
            if any(m in body for m in ["Manage Accounts", "Advertiser Reports", "Your Accounts", "Dashboard"]):
                print(f"[login] dashboard detected after {i}s", flush=True)
                break
        except Exception:
            pass
    print(f"[login] url={page.url}", flush=True)

def extract_home(page):
    js = r"""
    async () => {
      await new Promise(r => setTimeout(r, 1500));
      const tiles = [];
      document.querySelectorAll('h1,h2,h3,h4,h5,strong,b,[class*=value],[class*=amount],[class*=number]').forEach(el => {
        const t = (el.textContent||'').trim();
        if (!t || t.length > 80) return;
        if (!/[\d£$€]/.test(t)) return;
        const sib = el.previousElementSibling || el.parentElement?.previousElementSibling;
        const label = (sib?.textContent || el.parentElement?.textContent || '').trim().slice(0,80);
        tiles.push({label, value:t});
      });
      const tables = [];
      document.querySelectorAll('table').forEach(tbl => {
        const headers = [...tbl.querySelectorAll('thead th, tr:first-child th')].map(h => (h.textContent||'').trim());
        const rows = [...tbl.querySelectorAll('tbody tr')].slice(0,30).map(r => [...r.querySelectorAll('td,th')].map(c => (c.textContent||'').trim()));
        if (rows.length) tables.push({headers, rows});
      });
      return JSON.stringify({
        url: location.href, title: document.title,
        tiles: tiles.slice(0,80), tables,
        rawText: (document.body.innerText||'').slice(0,6000)
      });
    }
    """
    return json.loads(page.evaluate(js))

def dismiss_cookies(page):
    try:
        page.evaluate("""() => {
            const b = [...document.querySelectorAll('button')].find(x => /accept all/i.test(x.textContent||''));
            if (b) b.click();
        }""")
        time.sleep(1)
    except Exception:
        pass

def wait_loaded(page, region, label, must_have_text=None, max_wait=45):
    """Poll body until skeleton placeholders are gone or specific markers appear."""
    for i in range(max_wait):
        time.sleep(1)
        try:
            info = page.evaluate("""() => {
                const skel = document.querySelectorAll('[class*=skeleton],[class*=Skeleton],[class*=placeholder]').length;
                const txt = (document.body.innerText||'');
                return { skel, len: txt.length, sample: txt.slice(0, 300) };
            }""")
        except Exception:
            continue
        if must_have_text and any(m in info.get("sample", "") for m in must_have_text):
            print(f"[{region}] {label} loaded@{i}s skel={info['skel']} len={info['len']}", flush=True)
            return
        if info["skel"] < 5 and info["len"] > 800:
            print(f"[{region}] {label} settled@{i}s skel={info['skel']} len={info['len']}", flush=True)
            return
    print(f"[{region}] {label} TIMEOUT — proceeding anyway", flush=True)

def scroll_full(page):
    page.evaluate("""async () => {
        await new Promise(r => setTimeout(r, 300));
        const h = document.documentElement.scrollHeight;
        for (let y = 0; y < h; y += 600) {
            window.scrollTo(0, y);
            await new Promise(r => setTimeout(r, 250));
        }
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 500));
    }""")

def scrape_region(page, region, mid):
    print(f"[{region}] === START mid={mid} ===", flush=True)
    page.set_viewport_size({"width": 1600, "height": 1000})

    # HOME
    page.goto(f"https://app.awin.com/en/awin/advertiser/{mid}/home",
              wait_until="domcontentloaded", timeout=60000)
    dismiss_cookies(page)
    wait_loaded(page, region, "home", must_have_text=["Sales", "Commission", "Clicks", "Performance", "Transactions"])
    scroll_full(page)
    page.set_viewport_size({"width": 1600, "height": 2400})
    time.sleep(2)
    page.screenshot(path=str(OUT / f"{region}_home.png"), full_page=True)
    home = extract_home(page)
    (OUT / f"{region}_home.json").write_text(json.dumps(home, ensure_ascii=False, indent=2))
    print(f"[{region}] home tiles={len(home.get('tiles',[]))} tables={len(home.get('tables',[]))} rawLen={len(home.get('rawText',''))}", flush=True)

    # PUBLISHERS
    page.set_viewport_size({"width": 1600, "height": 1000})
    page.goto(f"https://app.awin.com/en/awin/advertiser/{mid}/reports/publisher-performance",
              wait_until="domcontentloaded", timeout=60000)
    dismiss_cookies(page)
    wait_loaded(page, region, "publishers", must_have_text=["Publisher", "Commission", "Clicks"])
    scroll_full(page)
    page.set_viewport_size({"width": 1600, "height": 2400})
    time.sleep(2)
    page.screenshot(path=str(OUT / f"{region}_publishers_full.png"), full_page=True)
    pub = extract_home(page)
    (OUT / f"{region}_publishers.json").write_text(json.dumps(pub, ensure_ascii=False, indent=2))
    print(f"[{region}] publishers tiles={len(pub.get('tiles',[]))} tables={len(pub.get('tables',[]))} rawLen={len(pub.get('rawText',''))}", flush=True)

    # PARTNERSHIPS
    page.set_viewport_size({"width": 1600, "height": 1000})
    page.goto(f"https://app.awin.com/en/awin/advertiser/{mid}/partnerships/all",
              wait_until="domcontentloaded", timeout=60000)
    dismiss_cookies(page)
    wait_loaded(page, region, "partnerships", must_have_text=["Joined", "Publisher", "Partnership"])
    scroll_full(page)
    page.set_viewport_size({"width": 1600, "height": 2400})
    time.sleep(2)
    page.screenshot(path=str(OUT / f"{region}_partnerships.png"), full_page=True)
    part = extract_home(page)
    (OUT / f"{region}_partnerships.json").write_text(json.dumps(part, ensure_ascii=False, indent=2))
    print(f"[{region}] partnerships tiles={len(part.get('tiles',[]))} rawLen={len(part.get('rawText',''))}", flush=True)
    print(f"[{region}] === DONE ===", flush=True)

def main():
    creds = load_creds()
    print(f"[creds] email={creds['email']}", flush=True)
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE_DIR),
            headless=True,
            viewport={"width": 1600, "height": 1000},
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
        )
        page = ctx.new_page()
        try:
            login(page, creds["email"], creds["password"])
            body = page.evaluate("() => document.body.innerText || ''")
            if not any(m in body for m in ["Manage Accounts", "Your Accounts", "Advertiser Reports"]):
                page.screenshot(path=str(OUT / "_login_fail.png"), full_page=True)
                print("[login] dashboard not visible — credentials/2FA may have failed", flush=True)
                ctx.close()
                sys.exit(2)
            print("[login] OK — proceeding to scrape", flush=True)
            for region, cfg in REGIONS.items():
                try:
                    scrape_region(page, region, cfg["mid"])
                except Exception as e:
                    print(f"[{region}] ERROR: {e}", flush=True)
                    traceback.print_exc()
        finally:
            ctx.close()

if __name__ == "__main__":
    main()
