---
description: "Impact Ottocast US Affiliate Outreach April162026 — setup (Sonnet). Login + navigate + inject helper. Run before /impact-ottocast-outreach."
model: sonnet
---

## MODEL GATE
This command runs on **Sonnet** (auto-assigned). Handles login edge cases and SSO.  
After this command completes, outreach switches to **Haiku** automatically via `/impact-ottocast-outreach`.

## Step 1: Login
1. `browser_navigate` to `https://app.impact.com`
2. `browser_snapshot` ONCE for login form
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
4. If Google account chooser appears → click "Cell Affiliate Team affiliate@celldigital.co" listitem → wait for redirect

## Step 2: Navigate to Discover
```
browser_navigate → https://app.impact.com/secure/advertiser/discover/radius/fr/partner_discover.ihtml?page=marketplace&slideout_id_type=partner#businessModels=CONTENT_REVIEWS&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC
```
Wait 3s.

## Step 3: Inject Helper
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
() => {
  const cards = document.querySelectorAll('.discovery-card');
  return `${cards.length} cards, helper=${typeof window.__otto_fill}`;
}
```

## AUTO-PROCEED
Setup is complete. **Do NOT wait for user input.** Immediately continue with the outreach phase:
- Model switches to **Haiku** for outreach (run `/impact-ottocast-outreach` OR proceed inline if already running in a unified session)
- Report: "✓ Setup complete — {N} cards on Content/Reviews. Switching to Haiku outreach phase..."
- If this command was invoked standalone, tell user: "Run `/impact-ottocast-outreach` to start (Haiku auto-assigned)."
- If this command was invoked as part of `/impact-ottocast`, continue directly to Phase 2.
