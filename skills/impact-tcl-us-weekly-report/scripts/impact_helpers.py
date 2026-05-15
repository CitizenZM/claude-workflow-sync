"""Shared Impact.com helpers — login, safe_eval, navigation.

Completely isolated from Awin helpers — different platform, different DOM,
different auth flow, different browser profile.

Profile:  ~/.cache/impact-report-profile
(Never shares state with impact-tcl-us outreach at port 9305)
"""
import json, subprocess, time
from pathlib import Path

PROFILE = Path.home() / ".cache" / "impact-report-profile"

def load_creds():
    r = subprocess.run(["node", "-e", """
const {decrypt}=require(process.env.HOME+'/.claude/setup-credentials.js');
const fs=require('fs');
const d=JSON.parse(fs.readFileSync(process.env.HOME+'/.claude/credentials.json'));
const imp=JSON.parse(decrypt(d.impact));
process.stdout.write(JSON.stringify({email:imp.email,password:imp.password}));
"""], capture_output=True, text=True, check=True)
    return json.loads(r.stdout)

def safe_eval(page, expr, default=""):
    for _ in range(3):
        try: return page.evaluate(expr)
        except Exception: time.sleep(1)
    return default

def dismiss_any_overlay(page):
    """Dismiss cookie banners, tour popups, welcome modals on Impact."""
    safe_eval(page, """() => {
        // Close modal / welcome dialogs
        const closers = [...document.querySelectorAll('[aria-label="Close"],[aria-label="close"],button.close,.modal-close,.dialog-close')]
            .concat([...document.querySelectorAll('button')].filter(b => /^(close|dismiss|skip|got it|ok)$/i.test((b.textContent||'').trim())));
        closers.forEach(b => { try { b.click(); } catch {} });
    }""")
    time.sleep(0.5)

def is_authenticated(page):
    body = safe_eval(page, "() => document.body.innerText || ''", "")
    return any(m in body for m in [
        "Dashboard", "Performance", "Partners", "Reports",
        "Revenue", "Clicks", "Conversion", "My Programs",
    ])

def login(page, email, password, timeout_s=90):
    """Login to Impact.com. Impact uses a two-step auth (email → password)
    with SPA routing — detect success by visible dashboard content, not URL."""
    page.goto("https://app.impact.com/login", wait_until="domcontentloaded", timeout=60000)
    time.sleep(3)
    if is_authenticated(page):
        print("[impact login] session already active", flush=True)
        return True
    dismiss_any_overlay(page)
    # Step 1: email
    for sel in ['input[type="email"]', 'input[name="email"]', 'input[placeholder*="email" i]', 'input[id*="email" i]']:
        try: page.fill(sel, email, timeout=5000); break
        except: continue
    time.sleep(0.5)
    # Click Next / Continue / Sign In
    safe_eval(page, """() => {
        const b = [...document.querySelectorAll('button,input[type=submit]')]
            .find(x => /next|continue|sign.*in|log.*in/i.test((x.textContent||x.value||'')));
        if (b) b.click();
    }""")
    time.sleep(4)
    # Step 2: password
    for sel in ['input[type="password"]', 'input[name="password"]', 'input[id*="password" i]']:
        try: page.fill(sel, password, timeout=5000); break
        except: continue
    time.sleep(0.5)
    safe_eval(page, """() => {
        const b = [...document.querySelectorAll('button,input[type=submit]')]
            .find(x => /sign.*in|log.*in|submit|continue/i.test((x.textContent||x.value||'')));
        if (b) b.click();
    }""")
    for i in range(timeout_s):
        time.sleep(1)
        if is_authenticated(page):
            print(f"[impact login] OK after {i}s", flush=True)
            return True
    print(f"[impact login] FAILED — url={page.url}", flush=True)
    return False

def goto_safe(page, url, wait_markers=None, timeout_s=20):
    """Navigate + wait for content markers."""
    page.goto(url, wait_until="domcontentloaded", timeout=60000)
    time.sleep(4)
    dismiss_any_overlay(page)
    if wait_markers:
        for _ in range(timeout_s):
            body = safe_eval(page, "() => document.body.innerText || ''", "")
            if any(m in body for m in wait_markers):
                return True
            time.sleep(1)
    else:
        time.sleep(6)
    return True
