---
name: browser-stealth-recovery
description: "Recovery playbook for browser-automation failures Barron's outreach/apply workflows actually hit: Cloudflare Turnstile after Chrome restart (Impact.com every ~6hr), Google OAuth A/B DOM drift, CAPTCHA hard-stops (Levanta), Chrome WebSocket exhaustion, port/profile lock conflicts. Use when any Playwright/CDP workflow throws CF_TIMEOUT, setup-blocked.flag, ERR_HELPER_MISSING_REINJECT_REQUIRED, FATAL: no Chrome, or unexpected 401/403/503 from authenticated sites. Recommends patchright as default Playwright replacement, FlareSolverr for HTTP-only CF, camoufox as escalation engine. Does NOT bulk-replace existing infrastructure — provides decision tree the supervisor agent follows on failure."
version: "1.0"
status: "ACTIVE"
last_updated: "2026-05-14"
---

# Browser Stealth & Recovery Playbook

> When an outreach/apply workflow fails at auth, CAPTCHA, or browser layer — read this skill BEFORE attempting fixes. The recovery is decision-tree based, not trial-and-error.

---

## §1. When to invoke this skill

Trigger conditions (any one matches → use this playbook):

| Signal | Source | Failure class |
|--------|--------|---------------|
| `CF_TIMEOUT: Cloudflare not cleared after 120s` | rockbros-runner.mjs L1065 | Cloudflare-1 |
| Page title contains "moment" / "请稍候" / "Checking" >30s | Impact.com after Chrome restart | Cloudflare-1 |
| 403 / 503 from non-browser HTTP scrape | browser-harness http_get | Cloudflare-2 |
| `setup-blocked.flag` written by skill | levanta-ottocast-setup | CAPTCHA |
| User reply needed for "manual checkbox" | Impact.com Turnstile | CAPTCHA-soft |
| `ERR_HELPER_MISSING_REINJECT_REQUIRED` | impact-ottocast-outreach SKILL L396 | Browser-1 |
| `FATAL: no Chrome` after 5 connect retries | rockbros-runner.mjs L1054 | Browser-2 |
| Port already in use error on init-workflow.sh | _shared/outreach-isolation.md | Browser-3 |
| Google "this browser may not be secure" wall | Any Google OAuth flow | Auth-1 |
| 4-state account chooser DOM mismatch | impact-login.js L102 | Auth-2 |

---

## §2. Decision tree (supervisor reads this on failure)

```
Failure detected
    ↓
Classify (see §1 table)
    ↓
┌─────────────────────────────────────────────────────────┐
│ Cloudflare-1 (Turnstile in browser, post Chrome restart)│
│   1. wait_for_cf_clear() up to 120s                      │
│   2. If timeout: surface to user with "click checkbox"   │
│      [current behavior — keep]                           │
│   3. RECOMMENDED ESCALATION:                             │
│      → install techinz/playwright-captcha                │
│      → swap to patchright (CRITICAL fix, §3)             │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ Cloudflare-2 (HTTP scrape blocked, no browser)          │
│   1. Try via FlareSolverr proxy on localhost:8191        │
│      (Docker container, §4)                              │
│   2. If FlareSolverr unavailable: route through browser  │
│      session that already has cf_clearance cookie        │
│   3. Last resort: skip target, note in result.md         │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ CAPTCHA (hard / Levanta-style)                          │
│   1. DO NOT loop — captcha solving wastes budget         │
│   2. Write state/setup-blocked.flag                      │
│   3. Surface to user via osascript notification          │
│   4. Resume queue from cursor when user reports cleared  │
│      [current behavior — keep, no auto-bypass attempt]   │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ Browser-1 (helper lost after full-page nav)             │
│   1. Sentinel ERR_HELPER_MISSING_REINJECT_REQUIRED       │
│   2. Re-inject window.__helper                           │
│   3. Re-run last action                                  │
│      [current behavior — keep, well-engineered]          │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ Browser-2 (Chrome WS exhausted ~6hr)                    │
│   1. Detect via 5x connect-retry failure                 │
│   2. Restart Chrome with documented flags                │
│   3. Runner auto-reconnects                              │
│   4. Trigger Cloudflare-1 path (CF challenge expected)   │
│      [current behavior — keep]                           │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ Browser-3 (port/profile lock conflict)                  │
│   1. Check workflow-registry.json for port assignment    │
│   2. Run init-workflow.sh <slug> <mcp> <port>            │
│   3. If still conflict: see §5 port allocation map       │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ Auth-1 (Google "browser may not be secure")             │
│   1. NEVER attempt headless re-login                     │
│   2. Open browser visibly to user                        │
│   3. User logs in manually once                          │
│   4. Profile cookies persist; future runs reuse          │
│   5. Alternative: extract cf_clearance + LSID/SID via    │
│      browser_cookie3 from real Chrome profile            │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ Auth-2 (Google chooser A/B drift, <li> vs <section>)    │
│   1. Use existing impact-login.js text-matching fallback │
│   2. Try both selectors in sequence                      │
│   3. If both fail: screenshot + drop into Auth-1 path    │
└─────────────────────────────────────────────────────────┘
```

---

## §3. Recommended infrastructure changes (priority ordered)

### CRITICAL — Swap `playwright` → `patchright` (drop-in)

Vanilla Playwright leaks `Runtime.enable` which Cloudflare/Impact fingerprint. Patchright is API-identical but patches this leak.

**Test on one skill first** (recommend `wellfound-apply` — lowest stakes, occasional runs):

```bash
# In wellfound-apply/scripts/
pip install patchright
patchright install chromium

# In login.js / fill-application-form.js — change one line:
# OLD: const { chromium } = require('playwright');
# NEW: const { chromium } = require('patchright');
```

After 5 successful runs without new auth issues → roll out to:
1. impact-ottocast-outreach (next priority, has documented CF issues)
2. impact-rockbros-us-outreach (LIVE 24/7 — schedule rollout during low-traffic window)
3. impact-tcl-us-outreach
4. All `awin-*` skills (no current CF issues, but future-proofs)

**Mac M1/M4 compatible**: yes (native wheels for Python, native binaries for Node).
**Multi-Mac sync**: package installs are per-Mac via `bootstrap.sh`. No iCloud-sync issues.

### HIGH — Add FlareSolverr Docker container (Mac Studio only)

For bulk HTTP scraping that hits 403/503 (currently: Lovehoney WAF in seo-geo-weekly, Google SERP via DuckDuckGo fallback).

```bash
docker run -d \
  --name=flaresolverr \
  --restart=unless-stopped \
  -p 8191:8191 \
  -e LOG_LEVEL=info \
  ghcr.io/flaresolverr/flaresolverr:latest
```

Then in `browser-harness/agent-workspace/agent_helpers.py`, add wrapper:

```python
def http_get_via_flaresolverr(url, timeout=60):
    """For URLs that return 403/503 from Cloudflare. Returns response body."""
    import requests
    r = requests.post("http://localhost:8191/v1", json={
        "cmd": "request.get",
        "url": url,
        "maxTimeout": timeout * 1000,
    }, timeout=timeout+5)
    return r.json()["solution"]["response"]
```

Single-Mac (Mac Studio) — no need to deploy on MacBooks since they don't run bulk scrapes.

### HIGH — Add `techinz/playwright-captcha` for Turnstile click-handler

Drop-in for Impact.com Turnstile after Chrome restart. Reduces "user must click checkbox" interruptions.

```bash
pip install playwright-captcha
```

Wire into `impact-rockbros-us-outreach/scripts/rockbros-runner.mjs` `waitForCFClear()`:
- First try the auto-click (5s timeout)
- Fall back to current manual-wait if auto-click fails

### MEDIUM — Camoufox as escalation engine (Levanta-only)

Only adopt if Levanta CAPTCHA failures persist after patchright + playwright-captcha rollout.

```bash
pip install camoufox[geoip]
python -m camoufox fetch  # downloads patched Firefox ~200MB
```

Per-Mac install (~200MB binary). **Exclude from iCloud sync**:
- Default install at `~/.cache/camoufox/` is already outside iCloud ✓

---

## §4. FlareSolverr operational notes

| Aspect | Detail |
|--------|--------|
| Port | 8191 (LAN-only by default) |
| Memory | ~200MB idle, ~500MB during solve |
| Solve time | 5-15s per challenge |
| Throughput | ~3-6 req/min sustained |
| Failure mode | Returns `{status: "error"}` — wrap in try/except, fall back to skip |
| Restart strategy | `--restart=unless-stopped` (survives reboots) |
| Conflict with browser MCP servers | None (different port range, separate Chromium instance) |

---

## §5. Canonical port allocation map

Source of truth: `~/Documents/Claude/config/skills/_shared/workflow-registry.json`

| Port | Workflow | Status |
|------|----------|--------|
| 9300 | default | Always |
| 9301 | awin-rockbros-us | On-demand |
| 9302 | awin-rockbros-eu | On-demand |
| 9303 | awin-oufer-us | On-demand |
| 9304 | impact-ottocast | On-demand |
| 9305 | impact-tcl-us | On-demand |
| 9306 | **impact-rockbros-us** | **LIVE 24/7 LOOP** — never reassign without coordinated stop |
| 9307 | greenhouse | On-demand |
| 9308 | RESERVED (impact-tcl-us-2 dual browser) | |
| 9309 | wellfound | On-demand (was 9306 — fixed conflict) |
| 9310 | levanta-ottocast | On-demand (new) |
| 8191 | FlareSolverr (Mac Studio only) | Background service |

If adding a new workflow: take the next sequential port, update registry, run init-workflow.sh.

---

## §6. Cross-references

- Failure detection signals: `_shared/outreach-isolation.md`
- Port allocation: `_shared/workflow-registry.json`
- Recovery scripts: `~/.claude/scripts/outreach/init-workflow.sh`
- External tool catalog: `skills/mop-master/lib/external-skills-index.md`
- MOP Iron Laws (§0.5) apply to recovery: state cause before fixing, verify with evidence before claiming resolved

---

## §7. What NOT to do

- ❌ Do NOT attempt headless Google login bypass — 95% failure rate, gets profiles flagged
- ❌ Do NOT install puppeteer-extra-stealth — it's increasingly detected, patchright supersedes
- ❌ Do NOT install undetected-chromedriver — author recommends nodriver instead
- ❌ Do NOT replace Playwright globally without first testing patchright on one skill
- ❌ Do NOT try to bypass Cloudflare via residential proxy services — adds cost, ToS risk, and current click-handler approach is sufficient
- ❌ Do NOT iCloud-sync `~/.cache/camoufox/` — large binary, per-Mac differences
