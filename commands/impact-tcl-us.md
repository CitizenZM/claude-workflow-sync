---
description: "Impact TCL US — Full workflow. Sonnet login+filter+inject → Haiku bulk proposal loop. No manual model switch. Usage: /impact-tcl-us [count]"
model: sonnet
---

# Impact TCL US — Unified Outreach Workflow

**Harness**: Sonnet (Phase 1: login + filters + helper inject) → Haiku subagent (Phase 2: bulk proposal loop)
**MCP**: `mcp__playwright-impact-tcl-us__` for ALL browser calls
**Fully autonomous**: no stops, no model-switch prompts, no user questions

---

## CONFIG
```
program_id     : 48321
count          : $ARGUMENTS (default 500)
target_pp      : 20
template_term  : TCL US Standard Publisher Terms (5%)
contract_date  : 2026-04-16
login          : affiliate@celldigital.co / Celldigital2024*
scripts        : ~/.claude/skills/impact-tcl-us-outreach/scripts/
ledger         : /Volumes/workssd/ObsidianVault/01-Projects/Impact-TCL-US-Outreach-Ledger.md
report         : /Volumes/workssd/ObsidianVault/01-Projects/Impact-TCL-US-Outreach-Report-2026-04-16.md
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
  const email = document.querySelector('input[name="username"], input[type="email"]');
  const pass = document.querySelector('input[name="password"], input[type="password"]');
  if (email) { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(email,'affiliate@celldigital.co'); email.dispatchEvent(new Event('input',{bubbles:true})); }
  if (pass) { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(pass,'Celldigital2024*'); pass.dispatchEvent(new Event('input',{bubbles:true})); }
  Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Sign In')?.click();
  return 'submitted';
}
```
4. If Google account chooser: click "Cell Affiliate Team affiliate@celldigital.co" → "Continue"

### Step 2: Navigate to Discover
`mcp__playwright-impact-tcl-us__browser_navigate` →
`https://app.impact.com/secure/advertiser/discover/radius/fr/partner_discover.ihtml?page=marketplace&slideout_id_type=partner#businessModels=home&locationCountryCode=US&sortBy=reachRating&sortOrder=DESC`
Wait 3s, then click "Content / Reviews" tab button.

### Step 3: Apply Filters (ONE evaluate)
```js
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clickOpts = async (btnText, opts) => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === btnText);
    if (!btn) return `no ${btnText}`;
    btn.click(); await sleep(1000);
    for (const opt of opts) {
      const el = Array.from(document.querySelectorAll('li, label, [class*="option"], [class*="item"]')).find(e => e.textContent.trim() === opt || e.textContent.trim().includes(opt));
      if (el) { el.click(); await sleep(300); }
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(400);
  };
  await clickOpts('Status', ['Active', 'New']);
  await clickOpts('Partner Size', ['Medium', 'Large', 'Extra Large']);
  await clickOpts('Categories', ['Consumer Electronics', 'Computers & Electronics', 'Mobile Services & Telecommunications', 'Movie & TV', 'Gaming']);
  await clickOpts('Promotional Areas', ['United States']);
  return 'filters applied';
}
```

### Step 4: Inject Helper (ONE evaluate)
```js
() => {
  window.__tcl_fill = async (cardIdx) => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const cards = document.querySelectorAll('.discovery-card');
    const card = cards[cardIdx];
    const btn = Array.from(card.querySelectorAll('button')).find(b => b.textContent.trim() === 'Send Proposal');
    if (!btn) return `${cardIdx}:skip(${Array.from(card.querySelectorAll('button')).map(b=>b.textContent.trim())[0]})`;
    btn.style.display = 'inline-block'; btn.click();
    await sleep(3000);
    const iframe = document.querySelector('iframe[src*="send-proposal"], iframe[src*="proposal"]');
    if (!iframe) return `${cardIdx}:no-iframe`;
    const doc = iframe.contentDocument;
    let t = 0; while (doc.readyState !== 'complete' && t < 10) { await sleep(500); t++; }
    const sel = Array.from(doc.querySelectorAll('button')).find(b => b.textContent.trim() === 'Select');
    if (!sel) return `${cardIdx}:no-Select`;
    sel.click(); await sleep(800);
    const portal = Array.from(doc.body.querySelectorAll('div')).find(d => window.getComputedStyle(d).position === 'fixed' && d.querySelectorAll('li').length > 0);
    const term = portal ? Array.from(portal.querySelectorAll('li')).find(o => o.textContent.includes('Standard') || o.textContent.includes('5%')) : null;
    if (!term) return `${cardIdx}:no-term`;
    term.click(); await sleep(500);
    const db = doc.querySelector('button[class*="input-wrap"]');
    if (db) { db.click(); await sleep(800); const cp = Array.from(doc.body.querySelectorAll('div')).find(d => window.getComputedStyle(d).position === 'fixed' && d.innerText?.includes('2026')); if (cp) { const day = Array.from(cp.querySelectorAll('td,button,span')).find(c => c.textContent.trim() === '18'); if (day) { day.click(); await sleep(500); } } }
    const ta = doc.querySelector('textarea');
    if (ta) { const msg = "Hi! We're reaching out on behalf of TCL, a leading global brand in consumer electronics — TVs, smartphones, tablets, and soundbars. We'd love to partner with you through our affiliate program (5% commission). If you're interested, please review the proposal and feel free to reach out with any questions. Looking forward to working together!"; const ns = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set; ns.call(ta,msg); ta.dispatchEvent(new Event('input',{bubbles:true})); ta.dispatchEvent(new Event('change',{bubbles:true})); }
    await sleep(300);
    const sub = Array.from(doc.querySelectorAll('button')).find(b => b.textContent.trim() === 'Send Proposal');
    if (!sub) return `${cardIdx}:no-submit`;
    sub.style.display='inline-block'; sub.click();
    await sleep(2000);
    const confirm = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'I understand') || Array.from(doc.querySelectorAll('button')).find(b => b.textContent.trim() === 'I understand');
    if (confirm) { confirm.click(); await sleep(500); }
    const name = card.querySelector('[class*="name"]')?.textContent.trim() || String(cardIdx);
    const email = card.querySelector('[href^="mailto:"]')?.href?.replace('mailto:','') || '';
    return `OK|${name}|${email}`;
  };
  return 'tcl helper injected';
}
```

### Step 5: Verify
```js
() => {
  const cards = document.querySelectorAll('.discovery-card');
  return `${cards.length} cards, helper=${typeof window.__tcl_fill}`;
}
```
If cards=0 or helper=undefined → retry Step 2 then Step 4 before proceeding.

Print: `"✓ TCL US setup: {N} cards, helper injected, filters applied. Spawning Haiku proposal loop..."`

---

## PHASE TRANSITION — Spawn Haiku Subagent

**Immediately after Step 5 — do NOT pause.** Read ledger for dedup:
```
Read ledger, extract names for program 48321 → DEDUP_JSON
Resolve COUNT from $ARGUMENTS (default 500)
```

Invoke Agent tool:
- `model`: `"haiku"`
- `description`: `"Impact TCL US bulk proposal — {COUNT} target"`
- `prompt`: PHASE 2 SUBAGENT PROMPT below with `{COUNT}` and `{DEDUP_JSON}` filled in

---

## PHASE 2 SUBAGENT PROMPT

```
You are the Impact TCL US bulk proposal agent running on Haiku.
Browser is already logged in, filters applied, helper __tcl_fill injected.
MCP: mcp__playwright-impact-tcl-us__

CONFIG:
program_id=48321 | target_per_page=20 | session_target={COUNT}
scripts=~/.claude/skills/impact-tcl-us-outreach/scripts/
ledger=/Volumes/workssd/ObsidianVault/01-Projects/Impact-TCL-US-Outreach-Ledger.md
report=/Volumes/workssd/ObsidianVault/01-Projects/Impact-TCL-US-Outreach-Report-2026-04-16.md
template_term=TCL US Standard Publisher Terms (5%)
contract_date=2026-04-16
msg="Hi! We're reaching out on behalf of TCL, a leading global brand in consumer electronics — TVs, smartphones, tablets, and soundbars. We'd love to partner with you through our affiliate program (5% commission). If you're interested, please review the proposal and feel free to reach out with any questions. Looking forward to working together!"
already_contacted={DEDUP_JSON}

MCP prefix for ALL browser calls: mcp__playwright-impact-tcl-us__

## STEP 0: Browser Check
browser_evaluate: `() => ({ title: document.title, helper: typeof window.__tcl_fill, cards: document.querySelectorAll('.discovery-card').length })`
If helper=undefined → re-inject __tcl_fill (see setup step 4 above for the function body).
If cards=0 → navigate back to discover URL and click Content/Reviews tab.

## STEP 1: Dedup + Propose (SEPARATE evaluate call)
1a. Read ledger, parse names → merge with already_contacted.
1b. Read bulk-proposal.js. Replace placeholders inline:
    %%MSG%% → msg | %%TEMPLATE_TERM%% → template_term | %%CONTRACT_DATE%% → contract_date | %%ALREADY%% → dedup JSON | %%TARGET%% → 20
Returns: {total, skipped, errorCount, publishers:[{name,email,publisherId}], errors}

## STEP 2: Save
2a. Append to ledger: name|email|YYYY-MM-DD|impact-48321
2b. Append to report (write-only).

## STEP 3: Next Page
Read next-page.js, run via browser_evaluate. If {ok:true} → re-run STEP 1+2. If {ok:false} → go to REPORT.

## STEP 4: Repeat until session_target reached or no pages.

## REPORT
=== Impact TCL US — Session Complete ===
Model:    haiku (setup: sonnet)
Program:  48321
Sent:     {session_total} proposals
Ledger:   {grand_total} total
Next run: /impact-tcl-us
========================================

## AUTO-RECOVERY
If browser_evaluate fails 2x: spawn Agent(model:"opus") to diagnose+fix, then resume.

## RULES
1. NEVER snapshot except login | 2. Dedup before propose | 3. Record every proposal | 4. Separate evaluate calls | 5. FULLY AUTONOMOUS
```

---

## POST-SUBAGENT (Sonnet)
Print subagent summary verbatim. Ledger and report already updated.
