---
name: Impact Ottocast US Affiliate Outreach April162026
description: Impact Ottocast US Affiliate Outreach April162026. Playwright-based proposal sending on Impact.com. Sonnet for setup/login, Haiku for bulk proposal loop. Records publisher name + email per row.
tags: [affiliate, impact, ottocast, us, outreach, automation]
---

# Impact Ottocast US Affiliate Outreach April162026

## Architecture

Two commands, two models:
- `/impact-ottocast-setup` (Sonnet) — login, navigate to discover page, verify results, inject helper.
- `/impact-ottocast-outreach` (Haiku) — batch proposal loop via `browser_evaluate`.

## Configuration

| Key | Value |
|-----|-------|
| BRAND | Ottocast |
| REGION | US |
| TEMPLATE_TERM | 公开条款 |
| MESSAGE | See below |
| CONTRACT_DATE | Today (dynamic: `new Date().getDate()`) |
| LEDGER | `/Users/xiaozuo/impact-ottocast-ledger.md` |

## Proposal Message

```
This is Bob Zabel from Ottocast US affiliate team. We are excited to work with you on Amazon affiliate promotion. We will offer 10+10%CPAi commission and additional sample/Content review opportunities. We offer ultra high commission for dedicated publishers with a full creative library, product data feeds, and exclusive promotional offers for our partners.
```

## Tab Strategy

Start URL hash: `#businessModels=CONTENT_REVIEWS&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC`

Change tabs by setting `window.location.hash` directly. Filters persist within session.

| Tab | Hash |
|-----|------|
| Content / Reviews | `businessModels=CONTENT_REVIEWS&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |
| Deal / Coupons | `businessModels=DEAL_COUPON&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |
| Email / Newsletter | `businessModels=EMAIL_NEWSLETTER&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |
| Loyalty / Rewards | `businessModels=LOYALTY_REWARDS&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |
| Network | `businessModels=NETWORK&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |

## Proposal Form Architecture (CRITICAL — same as TCL)

- iframe-based: `iframe[src*="send-proposal"]` — ALL form elements inside `iframe.contentDocument`
- Term dropdown = fixed-position portal div inside iframe body
- "Send Proposal" buttons on cards are CSS `display:none` — force `btn.style.display='inline-block'`
- Card selector: `.discovery-card`
- "Review Terms" button = already in network → skip

## Token-Efficient Pattern (ONE evaluate per tab)

### Step 1 — Inject helper once (done in /impact-ottocast-setup)

```js
() => {
  window.__otto_fill = async (cardIdx) => {
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
    const term = portal ? Array.from(portal.querySelectorAll('li')).find(o => o.textContent.includes('公开条款') || o.textContent.includes('Public')) : null;
    if (!term) return `${cardIdx}:no-term`;
    term.click(); await sleep(500);
    const db = doc.querySelector('button[class*="input-wrap"]');
    if (db) {
      db.click(); await sleep(800);
      const today = new Date().getDate().toString();
      const cp = Array.from(doc.body.querySelectorAll('div')).find(d => window.getComputedStyle(d).position === 'fixed' && d.innerText?.includes(new Date().getFullYear().toString()));
      if (cp) { const day = Array.from(cp.querySelectorAll('td,button,span')).find(c => c.textContent.trim() === today); if (day) { day.click(); await sleep(500); } }
    }
    const ta = doc.querySelector('textarea');
    if (ta) {
      const msg = "This is Bob Zabel from Ottocast US affiliate team. We are excited to work with you on Amazon affiliate promotion. We will offer 10+10%CPAi commission and additional sample/Content review opportunities. We offer ultra high commission for dedicated publishers with a full creative library, product data feeds, and exclusive promotional offers for our partners.";
      const ns = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
      ns.call(ta, msg); ta.dispatchEvent(new Event('input',{bubbles:true})); ta.dispatchEvent(new Event('change',{bubbles:true}));
    }
    await sleep(300);
    const sub = Array.from(doc.querySelectorAll('button')).find(b => b.textContent.trim() === 'Send Proposal');
    if (!sub) return `${cardIdx}:no-submit`;
    sub.style.display='inline-block'; sub.click();
    await sleep(2000);
    const confirm = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'I understand') || Array.from(doc.querySelectorAll('button')).find(b => b.textContent.trim() === 'I understand');
    if (confirm) { confirm.click(); await sleep(500); }
    // Close any remaining modal/iframe on error
    const closeBtn = document.querySelector('button[aria-label="close"], button[aria-label="Close"], [class*="close-btn"], [class*="closeBtn"]');
    if (closeBtn) { closeBtn.click(); await sleep(300); }
    const name = card.querySelector('[class*="name"]')?.textContent.trim() || String(cardIdx);
    const email = card.querySelector('[href^="mailto:"]')?.href?.replace('mailto:','') || '';
    return `OK|${name}|${email}`;
  };
  return 'otto helper injected';
}
```

### Step 2 — Per-tab: scan + send all in ONE evaluate

```js
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const contacted = new Set([/* paste current ledger names here */]);
  const cards = document.querySelectorAll('.discovery-card');
  const results = [];
  for (let i = 0; i < cards.length; i++) {
    const name = cards[i].querySelector('[class*="name"]')?.textContent.trim() || '';
    const btns = Array.from(cards[i].querySelectorAll('button')).map(b => b.textContent.trim());
    if (contacted.has(name) || !btns.includes('Send Proposal')) {
      results.push(`${i}:${name}:skipped`); continue;
    }
    try {
      const r = await window.__otto_fill(i);
      results.push(`${i}:${r}`);
    } catch(e) {
      // Close any open modal on unexpected error and continue
      const closeBtn = document.querySelector('button[aria-label="close"], button[aria-label="Close"]');
      if (closeBtn) closeBtn.click();
      results.push(`${i}:error(${e.message})`);
    }
    await sleep(500);
  }
  return results.join('\n');
}
```

## Ledger Format

File: `/Users/xiaozuo/impact-ottocast-ledger.md`

```markdown
| Publisher Name | Email | Date Contacted |
|---|---|---|
| Example Publisher | | 2026-04-16 |
```

## Token Rules

1. **NEVER `browser_snapshot`** during outreach phase
2. **Inject `window.__otto_fill` ONCE** in setup, reuse across all tabs
3. **ONE evaluate per tab** — scan + send all cards in same script
4. **ONE Edit per tab** — batch all new ledger rows into single file edit
5. On ANY unexpected error: close modal, continue to next card (never abort the loop)
