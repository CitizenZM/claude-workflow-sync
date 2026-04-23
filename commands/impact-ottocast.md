---
description: "Impact Ottocast US — Full workflow. Sonnet login+setup+tab-loop → pre-built Haiku per tab (Option A). Usage: /impact-ottocast [count]"
model: sonnet
---

# Impact Ottocast US — Unified Outreach Workflow (Option A)

**Harness**: Sonnet owns login + helper inject + tab loop. Fresh Haiku per tab — pre-built script, 1 tool call.
**MCP**: `mcp__playwright-impact-ottocast__` for ALL browser calls
**Fully autonomous**: no stops, no model-switch prompts, no user questions

---

## CONFIG
```
program        : Ottocast US (Impact)
count          : $ARGUMENTS (default 300)
target_per_tab : 25
login          : affiliate@celldigital.co / Celldigital2024*
ledger         : ~/Library/Mobile Documents/iCloud~md~obsidian/Documents/ObsidianVault/01-Projects/Impact-Ottocast-US-Outreach-Ledger.md
msg            : "This is Bob Zabel from Ottocast US affiliate team. We are excited to work with you on Amazon affiliate promotion. We will offer 10+10%CPAi commission and additional sample/Content review opportunities. We offer ultra high commission for dedicated publishers with a full creative library, product data feeds, and exclusive promotional offers for our partners."
```

---

## PHASE 1 — SETUP (Sonnet)

### Step 1: Login
1. `mcp__playwright-impact-ottocast__browser_navigate` → `https://app.impact.com`
2. `mcp__playwright-impact-ottocast__browser_snapshot` ONCE for login form
3. Fill credentials via `browser_evaluate`:
```js
async () => {
  const email = document.querySelector('input[name="username"],input[type="email"],#username');
  const pass = document.querySelector('input[name="password"],input[type="password"],#password');
  if (email) { const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(email,'affiliate@celldigital.co'); email.dispatchEvent(new Event('input',{bubbles:true})); }
  if (pass) { const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(pass,'Celldigital2024*'); pass.dispatchEvent(new Event('input',{bubbles:true})); }
  const btn = Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Sign In');
  if (btn) btn.click();
  return email ? 'submitted' : 'no-form';
}
```
4. If Google account chooser: click "Cell Affiliate Team affiliate@celldigital.co" → wait for `app.impact.com/secure`

### Step 2: Navigate to Discover
`mcp__playwright-impact-ottocast__browser_navigate` →
`https://app.impact.com/secure/advertiser/discover/radius/fr/partner_discover.ihtml?page=marketplace&slideout_id_type=partner#businessModels=CONTENT_REVIEWS&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC`
Wait 3s.

### Step 3: Inject window.__otto_fill helper (ONE evaluate)
```js
() => {
  window.__otto_fill = async (cardIdx) => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const cards = document.querySelectorAll('.discovery-card');
    const card = cards[cardIdx];
    const btn = Array.from(card.querySelectorAll('button')).find(b=>b.textContent.trim()==='Send Proposal');
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
    const term = portal ? Array.from(portal.querySelectorAll('li')).find(o=>o.textContent.includes('公开条款')||o.textContent.includes('Public')) : null;
    if (!term) return `${cardIdx}:no-term`;
    term.click(); await sleep(500);
    const db = doc.querySelector('button[class*="input-wrap"]');
    if (db) { db.click(); await sleep(800); const today=new Date().getDate().toString(); const cp=Array.from(doc.body.querySelectorAll('div')).find(d=>window.getComputedStyle(d).position==='fixed'&&d.innerText?.includes(new Date().getFullYear().toString())); if(cp){const day=Array.from(cp.querySelectorAll('td,button,span')).find(c=>c.textContent.trim()===today);if(day){day.click();await sleep(500);}} }
    const ta = doc.querySelector('textarea');
    if (ta) { const msg="This is Bob Zabel from Ottocast US affiliate team. We are excited to work with you on Amazon affiliate promotion. We will offer 10+10%CPAi commission and additional sample/Content review opportunities. We offer ultra high commission for dedicated publishers with a full creative library, product data feeds, and exclusive promotional offers for our partners."; const ns=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set; ns.call(ta,msg); ta.dispatchEvent(new Event('input',{bubbles:true})); ta.dispatchEvent(new Event('change',{bubbles:true})); }
    await sleep(300);
    const sub = Array.from(doc.querySelectorAll('button')).find(b=>b.textContent.trim()==='Send Proposal');
    if (!sub) return `${cardIdx}:no-submit`;
    sub.style.display='inline-block'; sub.click(); await sleep(2000);
    const confirm = Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='I understand')||Array.from(doc.querySelectorAll('button')).find(b=>b.textContent.trim()==='I understand');
    if (confirm) { confirm.click(); await sleep(500); }
    const closeBtn = document.querySelector('button[aria-label="close"],button[aria-label="Close"],[class*="close-btn"]');
    if (closeBtn) { closeBtn.click(); await sleep(300); }
    const name = card.querySelector('[class*="name"]')?.textContent.trim()||String(cardIdx);
    const email = card.querySelector('[href^="mailto:"]')?.href?.replace('mailto:','')||'';
    return `OK|${name}|${email}`;
  };
  return 'otto helper injected';
}
```

### Step 4: Verify + Preflight
```js
() => ({ cards: document.querySelectorAll('.discovery-card').length, helper: typeof window.__otto_fill })
```
If cards=0: re-run Step 2. If helper=undefined: re-run Step 3.
Print: `"✓ Ottocast US ready: {N} cards, helper injected. Starting Option A tab loop..."`

---

## PHASE 2 — SONNET TAB LOOP (Option A)

**Tab order (5 tabs):**
| # | Tab | Hash |
|---|-----|------|
| 1 | Content / Reviews | `businessModels=CONTENT_REVIEWS` |
| 2 | Deal / Coupons | `businessModels=DEAL_COUPON` |
| 3 | Email / Newsletter | `businessModels=EMAIL_NEWSLETTER` |
| 4 | Loyalty / Rewards | `businessModels=LOYALTY_REWARDS` |
| 5 | Network | `businessModels=NETWORK` |

**Base URL:** `https://app.impact.com/secure/advertiser/discover/radius/fr/partner_discover.ihtml?page=marketplace&slideout_id_type=partner#partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC&`

**Loop Init:** `COUNT = $ARGUMENTS or 300 | session_sent = 0 | tab_num = 1`

### Per-Tab Sequence:

**A. Build dedup — Sonnet reads ledger:**
Extract all names from ledger → `DEDUP_JSON = [...]`

**B. Pre-build proposal script + spawn Haiku:**
Inline script (no file reads needed — script is short enough to embed):

```
Sonnet builds this exact function with {DEDUP_JSON} and {TAB_TARGET} substituted:

async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  window.__DEDUP = {DEDUP_JSON};
  const TARGET = {TAB_TARGET};
  const alreadySet = new Set(window.__DEDUP.map(n => n.toLowerCase()));
  const invited = [], skipped = [], errors = [];
  const seen = new Set();
  const cards = document.querySelectorAll('.discovery-card');
  for (let i = 0; i < cards.length; i++) {
    if (invited.length >= TARGET) break;
    const name = cards[i].querySelector('[class*="name"]')?.textContent?.trim() || String(i);
    if (alreadySet.has(name.toLowerCase()) || seen.has(name.toLowerCase())) { skipped.push(name+':dup'); continue; }
    const btns = Array.from(cards[i].querySelectorAll('button')).map(b=>b.textContent.trim());
    if (!btns.includes('Send Proposal')) { skipped.push(name+':no_btn'); continue; }
    seen.add(name.toLowerCase()); alreadySet.add(name.toLowerCase()); window.__DEDUP.push(name);
    try {
      const r = await window.__otto_fill(i);
      if (r && r.startsWith('OK|')) { const p=r.split('|'); invited.push({name:p[1]||name,email:p[2]||''}); }
      else skipped.push(name+':'+(r||'err'));
    } catch(e) {
      const cb=document.querySelector('button[aria-label="close"],button[aria-label="Close"]'); if(cb)cb.click();
      errors.push(name+':'+e.message.slice(0,40));
    }
    await sleep(500);
  }
  return JSON.stringify({total:invited.length,skipped:skipped.length,errors:errors.length,publishers:invited,errorList:errors.slice(0,3)});
}
```

Invoke Agent tool:
- `model`: `"haiku"`
- `description`: `"Ottocast tab {tab_num} — up to 25 proposals"`
- `prompt`: PER-TAB HAIKU PROMPT below with `{tab_num}` and `{SCRIPT}` filled in

**C. Parse Haiku result:**
Append each publisher to ledger: `name|email|YYYY-MM-DD|impact-ottocast`
`session_sent += total`

**D. Next tab:**
Navigate to next tab hash. Wait 3s. Verify `typeof window.__otto_fill` via evaluate.
If undefined: re-inject helper (Step 3). `tab_num++`, continue.

Stop when `session_sent >= COUNT` or all 5 tabs done.

---

## PER-TAB HAIKU PROMPT

```
You are the Impact Ottocast US per-tab proposal agent (tab {tab_num}).
MCP: mcp__playwright-impact-ottocast__
Browser is logged in. window.__otto_fill and window.__DEDUP are pre-injected.

TASK: Call browser_evaluate EXACTLY ONCE with the function below. Output JSON result. Stop.

Call mcp__playwright-impact-ottocast__browser_evaluate with:
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
=== Impact Ottocast US — Session Complete (Option A) ===
Model:    haiku per-tab / sonnet loop
Tabs:     {tab_num} / 5
Sent:     {session_sent} proposals this session
Ledger:   {grand_total} total all-time
Next run: /impact-ottocast
========================================================
```

## AUTO-RECOVERY
If `browser_evaluate` fails 2×: spawn Agent(model:"opus") to diagnose+fix. Never stop.

## RULES
1. NEVER snapshot except login
2. window.__otto_fill injected ONCE by Sonnet — re-inject only if tab navigation resets page
3. Ledger written by Sonnet after each Haiku returns (not by Haiku)
4. Each Haiku: exactly 1 evaluate call — pre-built script with dedup inline
5. FULLY AUTONOMOUS — 300 hard limit
