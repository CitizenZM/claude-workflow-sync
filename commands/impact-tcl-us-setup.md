---
description: "Impact TCL US login + filter setup (Sonnet). Run before /impact-tcl-us-outreach. Usage: /impact-tcl-us-setup"
model: sonnet
---

## MODEL GATE — MANDATORY FIRST CHECK
This command REQUIRES model: **sonnet**. If you are running on Opus, STOP: "⛔ Wrong model. Run `/model sonnet` then re-run `/impact-tcl-us-setup`." Do NOT proceed on Opus.

## BROWSER MCP: playwright-impact (port 3102)
ALL browser tool calls MUST use the `playwright-impact` MCP server.
Tool prefix: `mcp__playwright-impact__` (e.g., `mcp__playwright-impact__browser_navigate`, `mcp__playwright-impact__browser_snapshot`, `mcp__playwright-impact__browser_click`, `mcp__playwright-impact__browser_type`, `mcp__playwright-impact__browser_evaluate`).
Do NOT use the default `playwright` or any other playwright server — each workflow has its own isolated browser.

## Step 1: Login
1. `browser_navigate` to `https://app.impact.com`
2. `browser_snapshot` ONCE for login form
3. Fill email `affiliate@celldigital.co` and password `Celldigital2024*` via `browser_evaluate`
4. Click Sign In. If Google account chooser appears, click "Cell Affiliate Team affiliate@celldigital.co" then "Continue"
5. Wait for dashboard to load

## Step 2: Navigate to Discover (Content/Reviews tab)
```
browser_navigate → https://app.impact.com/secure/advertiser/discover/radius/fr/partner_discover.ihtml?page=marketplace&slideout_id_type=partner#businessModels=home&locationCountryCode=US&sortBy=reachRating&sortOrder=DESC
```
Wait 3s, then click the "Content / Reviews" tab button (do NOT navigate by URL — the app redirects tab hashes to home on fresh load).

## Step 3: Apply All Filters in One evaluate

```js
// browser_evaluate — apply Status, Partner Size, Categories, Promotional Areas
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

## Step 4: Inject the Proposal Helper

Immediately after filters are set, inject `window.__tcl_fill` so it's ready for the outreach loop:

```js
// browser_evaluate — inject helper once
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

## Step 5: Verify
```js
// browser_evaluate
() => {
  const cards = document.querySelectorAll('.discovery-card');
  const sendBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.trim() === 'Send Proposal');
  return `${cards.length} cards, ${sendBtns.length} Send Proposal btns, helper=${typeof window.__tcl_fill}`;
}
```

Report: "Impact TCL US Setup complete. {N} publishers on Content/Reviews tab. Helper injected. Run `/impact-tcl-us-outreach` to start."
