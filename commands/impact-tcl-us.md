---
description: "Impact TCL US — Full workflow. Sonnet login+setup+tab-loop → pre-built Haiku per tab (Option A). Usage: /impact-tcl-us [count]"
model: sonnet
---

# Impact TCL US — Unified Outreach Workflow (Option A)

**Harness**: Sonnet owns login + helper inject + tab loop. Fresh Haiku per tab — pre-built script, 1 tool call.
**MCP**: `mcp__playwright-impact-tcl-us__` for ALL browser calls
**Fully autonomous**: no stops, no model-switch prompts, no user questions

---

## CONFIG
```
program_id     : 48321
count          : $ARGUMENTS (default 500)
target_per_tab : 20
template_term  : TCL US Standard Publisher Terms (5%)
login          : affiliate@celldigital.co / Celldigital2024*
scripts        : ~/.claude/skills/impact-tcl-us-outreach/scripts/
ledger         : ~/Library/Mobile Documents/iCloud~md~obsidian/Documents/ObsidianVault/01-Projects/Impact-TCL-US-Outreach-Ledger.md
report         : ~/Library/Mobile Documents/iCloud~md~obsidian/Documents/ObsidianVault/01-Projects/Impact-TCL-US-Outreach-Report-2026-04-16.md
msg            : "Hi! We're reaching out on behalf of TCL, a leading global brand in consumer electronics — TVs, smartphones, tablets, and soundbars. We'd love to partner with you through our affiliate program (5% commission). If you're interested, please review the proposal and feel free to reach out with any questions. Looking forward to working together!"
```

---

## PHASE 1 — SETUP (Sonnet)

### Step 1: Login
1. `mcp__playwright-impact-tcl-us__browser_navigate` → `https://app.impact.com`
2. `mcp__playwright-impact-tcl-us__browser_snapshot` ONCE for login form
3. Fill credentials via `browser_evaluate`:
```js
async () => {
  const email = document.querySelector('input[name="username"],input[type="email"]');
  const pass = document.querySelector('input[name="password"],input[type="password"]');
  if (email) { const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(email,'affiliate@celldigital.co'); email.dispatchEvent(new Event('input',{bubbles:true})); }
  if (pass) { const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(pass,'Celldigital2024*'); pass.dispatchEvent(new Event('input',{bubbles:true})); }
  Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Sign In')?.click();
  return 'submitted';
}
```
4. If Google account chooser: click "Cell Affiliate Team affiliate@celldigital.co" → "Continue"

### Step 2: Navigate to Discover + Apply Filters
Navigate: `https://app.impact.com/secure/advertiser/discover/radius/fr/partner_discover.ihtml?page=marketplace&slideout_id_type=partner#businessModels=home&locationCountryCode=US&sortBy=reachRating&sortOrder=DESC`
Wait 3s. Click "Content / Reviews" tab. Then run filters evaluate:
```js
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clickOpts = async (btnText, opts) => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === btnText);
    if (!btn) return;
    btn.click(); await sleep(1000);
    for (const opt of opts) {
      const el = Array.from(document.querySelectorAll('li,label,[class*="option"],[class*="item"]')).find(e => e.textContent.trim() === opt || e.textContent.trim().includes(opt));
      if (el) { el.click(); await sleep(300); }
    }
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); await sleep(400);
  };
  await clickOpts('Status',['Active','New']);
  await clickOpts('Partner Size',['Medium','Large','Extra Large']);
  await clickOpts('Categories',['Consumer Electronics','Computers & Electronics','Mobile Services & Telecommunications','Movie & TV','Gaming']);
  await clickOpts('Promotional Areas',['United States']);
  return 'filters applied';
}
```

### Step 3: Inject window.__tcl_fill helper (ONE evaluate)
```js
() => {
  window.__tcl_fill = async (cardIdx) => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const cards = document.querySelectorAll('.discovery-card');
    const card = cards[cardIdx];
    const btn = Array.from(card.querySelectorAll('button')).find(b => b.textContent.trim() === 'Send Proposal');
    if (!btn) return `${cardIdx}:skip(${Array.from(card.querySelectorAll('button')).map(b=>b.textContent.trim())[0]})`;
    btn.style.display='inline-block'; btn.click(); await sleep(3000);
    const iframe = document.querySelector('iframe[src*="send-proposal"],iframe[src*="proposal"]');
    if (!iframe) return `${cardIdx}:no-iframe`;
    const doc = iframe.contentDocument;
    let t=0; while(doc.readyState!=='complete'&&t<10){await sleep(500);t++;}
    const sel = Array.from(doc.querySelectorAll('button')).find(b=>b.textContent.trim()==='Select');
    if (!sel) return `${cardIdx}:no-Select`;
    sel.click(); await sleep(800);
    const portal = Array.from(doc.body.querySelectorAll('div')).find(d=>window.getComputedStyle(d).position==='fixed'&&d.querySelectorAll('li').length>0);
    const term = portal ? Array.from(portal.querySelectorAll('li')).find(o=>o.textContent.includes('Standard')||o.textContent.includes('5%')) : null;
    if (!term) return `${cardIdx}:no-term`;
    term.click(); await sleep(500);
    const db = doc.querySelector('button[class*="input-wrap"]');
    if (db) { db.click(); await sleep(800); const cp=Array.from(doc.body.querySelectorAll('div')).find(d=>window.getComputedStyle(d).position==='fixed'&&d.innerText?.includes('2026')); if(cp){const day=Array.from(cp.querySelectorAll('td,button,span')).find(c=>c.textContent.trim()==='18');if(day){day.click();await sleep(500);}} }
    const ta = doc.querySelector('textarea');
    if (ta) { const msg="Hi! We're reaching out on behalf of TCL, a leading global brand in consumer electronics — TVs, smartphones, tablets, and soundbars. We'd love to partner with you through our affiliate program (5% commission). If you're interested, please review the proposal and feel free to reach out with any questions. Looking forward to working together!"; const ns=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set; ns.call(ta,msg); ta.dispatchEvent(new Event('input',{bubbles:true})); ta.dispatchEvent(new Event('change',{bubbles:true})); }
    await sleep(300);
    const sub = Array.from(doc.querySelectorAll('button')).find(b=>b.textContent.trim()==='Send Proposal');
    if (!sub) return `${cardIdx}:no-submit`;
    sub.style.display='inline-block'; sub.click(); await sleep(2000);
    const confirm = Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='I understand')||Array.from(doc.querySelectorAll('button')).find(b=>b.textContent.trim()==='I understand');
    if (confirm) { confirm.click(); await sleep(500); }
    const name = card.querySelector('[class*="name"]')?.textContent.trim()||String(cardIdx);
    const email = card.querySelector('[href^="mailto:"]')?.href?.replace('mailto:','')||'';
    return `OK|${name}|${email}`;
  };
  return 'tcl helper injected';
}
```

### Step 4: Verify + Preflight
```js
() => ({ cards: document.querySelectorAll('.discovery-card').length, helper: typeof window.__tcl_fill })
```
If cards=0: re-navigate Step 2. If helper=undefined: re-run Step 3.
Print: `"✓ TCL US ready: {N} cards, helper injected. Starting Option A tab loop..."`

---

## PHASE 2 — SONNET TAB LOOP (Option A)

**Tab order (5 tabs):**
| Tab | Hash fragment |
|-----|---------------|
| Content / Reviews | `businessModels=CONTENT_REVIEWS` |
| Deal / Coupons | `businessModels=DEAL_COUPON` |
| Email / Newsletter | `businessModels=EMAIL_NEWSLETTER` |
| Loyalty / Rewards | `businessModels=LOYALTY_REWARDS` |
| Network | `businessModels=NETWORK` |

**Loop Init:** `COUNT = $ARGUMENTS or 500 | session_sent = 0 | tab_num = 1`

### Per-Tab Sequence:

**A. Build dedup — Sonnet reads ledger:**
Extract names where program=impact-48321 → `DEDUP_JSON = [...]`

**B. Pre-build proposal script + spawn Haiku:**
Sonnet builds complete async function string:
1. Inline `window.__DEDUP = {DEDUP_JSON}` at top (helper already in window)
2. Replace `%%TARGET%%` → remaining count (min of 20 and COUNT-session_sent)
Source: `~/.claude/skills/impact-tcl-us-outreach/scripts/bulk-proposal-opt-a.js`

Invoke Agent tool:
- `model`: `"haiku"`
- `description`: `"TCL US tab {tab_num} — up to 20 proposals"`
- `prompt`: PER-TAB HAIKU PROMPT below with `{tab_num}` and `{SCRIPT}` filled in

**C. Parse Haiku result:**
Haiku returns `{total, publishers:[{name,email}], skipped, errors}`.
Append each publisher to ledger: `name|email|YYYY-MM-DD|impact-48321`
`session_sent += total`

**D. Next tab:**
Navigate to next tab hash. Wait 3s. Verify helper: `() => typeof window.__tcl_fill`.
If undefined: re-inject helper (Step 3). `tab_num++`, continue.

Stop when `session_sent >= COUNT` or all 5 tabs done.

---

## PER-TAB HAIKU PROMPT

```
You are the Impact TCL US per-tab proposal agent (tab {tab_num}).
MCP: mcp__playwright-impact-tcl-us__
Browser is logged in. window.__tcl_fill and window.__DEDUP are pre-injected.

TASK: Call browser_evaluate EXACTLY ONCE with the function below. Output JSON result. Stop.

Call mcp__playwright-impact-tcl-us__browser_evaluate with:
function: {SCRIPT}

Output the JSON result as your final message:
{"tab":{tab_num},"total":<n>,"publishers":[...],"skipped":<n>,"errors":<n>}

HARD RULES:
- EXACTLY 1 tool call. Zero others.
- Do NOT read files. Do NOT snapshot. Do NOT navigate. Do NOT re-inject helper.
- Trust the script. Run it. Return the result.
```

---

## FINAL REPORT

```
=== Impact TCL US — Session Complete (Option A) ===
Model:    haiku per-tab / sonnet loop
Program:  48321
Tabs:     {tab_num}
Sent:     {session_sent} proposals this session
Ledger:   {grand_total} total all-time
Next run: /impact-tcl-us
===================================================
```

## AUTO-RECOVERY
If `browser_evaluate` fails 2×: spawn Agent(model:"opus") to diagnose+fix. Never stop.

## RULES
1. NEVER snapshot except login
2. window.__tcl_fill injected ONCE by Sonnet — re-inject only if navigation resets page
3. Ledger written by Sonnet after each Haiku returns
4. Each Haiku: exactly 1 evaluate call
5. FULLY AUTONOMOUS
