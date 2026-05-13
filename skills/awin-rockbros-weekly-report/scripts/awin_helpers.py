"""Shared Awin login + utility helpers, hardened against navigation races."""
import json, time, subprocess
from pathlib import Path

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

def safe_eval(page, expr, default=""):
    """Evaluate but tolerate mid-navigation execution-context destruction."""
    for _ in range(3):
        try:
            return page.evaluate(expr)
        except Exception:
            time.sleep(1)
    return default

def dismiss_cookies(page):
    safe_eval(page, """() => {
        const b = [...document.querySelectorAll('button')].find(x => /accept all/i.test(x.textContent||''));
        if (b) b.click();
    }""")
    time.sleep(1)

def is_logged_in(page):
    body = safe_eval(page, "() => document.body.innerText || ''", "")
    return any(m in body for m in ["Your Accounts", "Manage Accounts", "Advertiser Reports", "Switch to Awin Classic"])

def login(page, email, password):
    """Full login flow; safe to call when already logged in (it'll detect and skip)."""
    page.goto("https://app.awin.com/login", wait_until="domcontentloaded", timeout=60000)
    time.sleep(3)
    if is_logged_in(page):
        print("[login] already authenticated", flush=True)
        return True
    dismiss_cookies(page)
    # email
    try:
        page.fill('input[type="email"], input[name="username"]', email, timeout=15000)
    except Exception:
        pass
    time.sleep(0.5)
    safe_eval(page, """() => { const b=[...document.querySelectorAll('button')].find(x=>/continue/i.test(x.textContent)); if(b) b.click(); }""")
    time.sleep(4)
    # password
    try:
        page.fill('input[type="password"]', password, timeout=15000)
    except Exception:
        pass
    time.sleep(0.5)
    safe_eval(page, """() => { const b=[...document.querySelectorAll('button')].find(x=>/sign in|log in|submit/i.test(x.textContent)); if(b) b.click(); }""")
    # wait for dashboard markers — tolerate exec-context destruction
    for i in range(60):
        time.sleep(1)
        if is_logged_in(page):
            print(f"[login] OK after {i}s", flush=True)
            return True
    print("[login] FAILED", flush=True)
    return False

def goto_safe(page, url, wait_text=None, max_wait=30):
    """Navigate + wait for body text marker if given."""
    page.goto(url, wait_until="domcontentloaded", timeout=60000)
    time.sleep(2)
    dismiss_cookies(page)
    if wait_text:
        for _ in range(max_wait):
            body = safe_eval(page, "() => document.body.innerText || ''", "")
            if any(t in body for t in wait_text):
                return True
            time.sleep(1)
    else:
        time.sleep(5)
    return True
