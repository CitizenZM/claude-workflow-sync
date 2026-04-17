---
description: "Impact Ottocast setup: login + navigate to discover + inject helper (Sonnet). Run before /impact-ottocast-outreach. Usage: /impact-ottocast-setup"
model: sonnet
---

## MODEL GATE — MANDATORY FIRST CHECK
This command REQUIRES model: **sonnet**. If you are running on Opus, STOP: "⛔ Wrong model. Run `/model sonnet` then re-run `/impact-ottocast-setup`." Do NOT proceed on Opus.

## Step 1: Login
1. `browser_navigate` to `https://app.impact.com`
2. `browser_snapshot` ONCE for login form
3. Fill email `affiliate@celldigital.co` and password `Celldigital2024*` via `browser_evaluate`
4. Click Sign In. If Google account chooser appears, click "Cell Affiliate Team affiliate@celldigital.co" then "Continue"
5. Wait for dashboard to load

## Step 2: Navigate to Discover (Content/Reviews, prospecting only)

```
browser_navigate → https://app.impact.com/secure/advertiser/discover/radius/fr/partner_discover.ihtml?page=marketplace&slideout_id_type=partner#businessModels=CONTENT_REVIEWS&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC
```

Wait 3s. If the page loads on a different tab or home, click the "Content / Reviews" tab button directly.

## Step 3: Inject the Proposal Helper

```js
// browser_evaluate — inject helper once
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
    const closeBtn = document.querySelector('button[aria-label="close"], button[aria-label="Close"], [class*="close-btn"], [class*="closeBtn"]');
    if (closeBtn) { closeBtn.click(); await sleep(300); }
    const name = card.querySelector('[class*="name"]')?.textContent.trim() || String(cardIdx);
    const email = card.querySelector('[href^="mailto:"]')?.href?.replace('mailto:','') || '';
    return `OK|${name}|${email}`;
  };
  return 'otto helper injected';
}
```

## Step 4: Verify

```js
// browser_evaluate
() => {
  const cards = document.querySelectorAll('.discovery-card');
  const sendBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.trim() === 'Send Proposal');
  return `${cards.length} cards, ${sendBtns.length} Send Proposal btns, helper=${typeof window.__otto_fill}`;
}
```

Report: "Impact Ottocast Setup complete. {N} publishers on Content/Reviews tab. Helper injected. Run `/impact-ottocast-outreach` to start."
