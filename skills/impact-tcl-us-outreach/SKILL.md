---
name: impact-tcl-us-affiliate-outreach
description: Impact TCL US Affiliate Outreach April152026. Playwright-based proposal sending on Impact.com. Sonnet for setup/login, Haiku for bulk proposal loop. Records publisher name + email per row.
tags: [affiliate, impact, tcl, us, outreach, automation, playwright]
---

# Impact TCL US Affiliate Outreach April152026

## Architecture

Two commands, two models:
- `/impact-tcl-us-setup` (Sonnet) — login, navigate to discover page, set filters, verify results.
- `/impact-tcl-us-outreach` (Haiku) — batch proposal loop via `browser_evaluate`.

## Configuration

| Key | Value |
|-----|-------|
| PROGRAM_ID | `48321` |
| BRAND | TCL |
| REGION | US |
| TEMPLATE_TERM | TCL US Standard Publisher Terms (5%) |
| LEDGER | `/Users/xiaozuo/impact-tcl-us-ledger.md` |

## Required Filters (set during /impact-tcl-us-setup)

### Status
- **Active** + **New**

### Partner Size
- **Medium**, **Large**, **Extra Large**

### Categories
- Consumer Electronics
- Computers & Electronics
- Mobile Services & Telecommunications
- Movie & TV
- Gaming

### Promotional Areas
- **United States**

### Location
- Country: **US** (`locationCountryCode=US` in hash)

### Sort Strategy
- **Primary**: `sortBy=reachRating&sortOrder=DESC`
- **Fallback**: `sortBy=epc&sortOrder=DESC` — when reachRating pool exhausted

### Business Model Tab Order + Confirmed Hash Values

| Tab | Hash Value (confirmed working) |
|-----|-------------------------------|
| Content / Reviews | `CONTENT_REVIEWS` |
| Deal / Coupons | `DEAL_COUPON` |
| Email / Newsletter | `EMAIL_NEWSLETTER` |
| Loyalty / Rewards | `LOYALTY_REWARDS` |
| Network | `NETWORK` |
| All Partners | click "All Partners" button (hash becomes `all`) |

Navigate by setting `window.location.hash` directly. Filters persist across tab changes within the session.

## Publisher Data to Capture

For each publisher, capture and log to ledger:
- **Name**: `card.querySelector('[class*="name"]')?.textContent.trim()`
- **Email**: `card.querySelector('[href^="mailto:"]')?.href?.replace('mailto:','') || ''`

Log immediately after all cards on a tab are processed.

## Proposal Form Architecture (CRITICAL)

The "Send Proposal" flow uses an **iframe**, NOT a modal in the main document:
1. Clicking "Send Proposal" opens `iframe[src*="send-proposal"]`
2. ALL form elements live inside `iframe.contentDocument`
3. The term dropdown renders as a **fixed-position portal** inside the iframe's `<body>`

### Card Interaction
- "Send Proposal" buttons are CSS `display:none` by default → force `btn.style.display='inline-block'` before clicking
- Card selector: `.discovery-card`
- "Review Terms" button = already in network → skip

## Token-Efficient Outreach Pattern (CRITICAL — ONE evaluate per tab)

**Inject the helper once, then call it per-tab in a single evaluate. Never re-declare the function.**

### Step 1 — Inject helper (once per session)
```js
// browser_evaluate: inject fillAndSubmit onto window
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
  return 'helper injected';
}
```

### Step 2 — Per-tab: scan + send all in ONE evaluate

```js
// browser_evaluate: process entire tab
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // Build ledger set from known contacted names (pass as inline set)
  const contacted = new Set([/* paste current ledger names here */]);
  const cards = document.querySelectorAll('.discovery-card');
  const results = [];
  for (let i = 0; i < cards.length; i++) {
    const name = cards[i].querySelector('[class*="name"]')?.textContent.trim() || '';
    const btns = Array.from(cards[i].querySelectorAll('button')).map(b => b.textContent.trim());
    if (contacted.has(name) || !btns.includes('Send Proposal')) {
      results.push(`${i}:${name}:skipped`); continue;
    }
    const r = await window.__tcl_fill(i);
    results.push(`${i}:${r}`);
    await sleep(500);
  }
  return results.join('\n');
}
```

This pattern reduces a 25-card tab from **15+ tool calls** to **2 tool calls** (inject + run).

## Ledger Format

File: `/Users/xiaozuo/impact-tcl-us-ledger.md`

```markdown
| Publisher Name | Email | Date Contacted |
|---|---|---|
| Example Publisher | contact@example.com | 2026-04-17 |
```

- Log all new rows in a **single Edit call** after each tab completes
- If email not found on card, write `""` — never skip the row

## Token Rules

1. **NEVER `browser_snapshot`** during outreach phase — zero exceptions
2. **Inject `window.__tcl_fill` ONCE** per browser session, reuse across all tabs
3. **ONE evaluate per tab** — scan + send all cards in the same script
4. **ONE Edit per tab** — batch all new ledger rows into a single file edit
5. React SPA: wait for `iframe.contentDocument.readyState === 'complete'` inside the helper (already handled)
6. Filters persist within session — no need to reapply when switching tabs via hash
