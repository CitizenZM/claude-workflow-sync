---
description: "Impact Ottocast full workflow — login + outreach + report (Haiku). Single command, auto model, 300 max/run. Usage: /impact-ottocast"
model: haiku
---

# Impact Ottocast Amazon Affiliate Outreach — Full Workflow

**Model**: haiku (auto-assigned by this command)  
**Limit**: 300 proposals max per session  
**On completion**: Write Obsidian tracker + session report  

---

## PHASE 1 — Login & Setup (Steps 1–4)

### Step 1: Navigate & Login
```js
// browser_navigate → https://app.impact.com
```
Take ONE `browser_snapshot` for login form. Fill and submit:
```js
// browser_evaluate
async () => {
  const email = document.querySelector('input[name="username"], input[type="email"], #username');
  const pass = document.querySelector('input[name="password"], input[type="password"], #password');
  if (email) { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(email,'affiliate@celldigital.co'); email.dispatchEvent(new Event('input',{bubbles:true})); }
  if (pass) { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(pass,'Celldigital2024*'); pass.dispatchEvent(new Event('input',{bubbles:true})); }
  const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Sign In');
  if (btn) btn.click();
  return email ? 'submitted' : 'no-form';
}
```
If Google account chooser appears → click "Cell Affiliate Team affiliate@celldigital.co" listitem → wait for redirect to `app.impact.com/secure`.

### Step 2: Navigate to Discover
```
browser_navigate → https://app.impact.com/secure/advertiser/discover/radius/fr/partner_discover.ihtml?page=marketplace&slideout_id_type=partner#businessModels=CONTENT_REVIEWS&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC
```
Wait 3s.

### Step 3: Inject Helper (once per session)
```js
// browser_evaluate
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

### Step 4: Verify
```js
// browser_evaluate
() => {
  const cards = document.querySelectorAll('.discovery-card');
  return `${cards.length} cards, helper=${typeof window.__otto_fill}`;
}
```
If cards=0 or helper=undefined → retry Step 2 before continuing.

---

## PHASE 2 — Outreach Loop (Steps 5–9)

**SESSION LIMIT: 300 proposals total. Track running count across all tabs.**

### Tab Order & Hashes

| # | Tab | Hash |
|---|-----|------|
| 1 | Content / Reviews | `businessModels=CONTENT_REVIEWS&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |
| 2 | Deal / Coupons | `businessModels=DEAL_COUPON&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |
| 3 | Email / Newsletter | `businessModels=EMAIL_NEWSLETTER&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |
| 4 | Loyalty / Rewards | `businessModels=LOYALTY_REWARDS&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |
| 5 | Network | `businessModels=NETWORK&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |

### Per-Tab Script (ONE evaluate per tab)

Replace `SESSION_REMAINING` with `300 - sent_so_far` before each tab run.

```js
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const SESSION_REMAINING = 300; // ← UPDATE before each tab
  const contacted = new Set([/* current ledger names */]);
  const cards = document.querySelectorAll('.discovery-card');
  let sent = 0;
  const ok = [], skipped = [], errors = [];
  for (let i = 0; i < cards.length; i++) {
    if (sent >= SESSION_REMAINING) { skipped.push(`LIMIT_REACHED at card ${i}`); break; }
    const name = cards[i].querySelector('[class*="name"]')?.textContent.trim() || '';
    const btns = Array.from(cards[i].querySelectorAll('button')).map(b => b.textContent.trim());
    if (contacted.has(name) || !btns.includes('Send Proposal')) { skipped.push(`${name}:dup_or_no_btn`); continue; }
    try {
      const r = await window.__otto_fill(i);
      if (r.startsWith('OK|')) { ok.push(r); sent++; } else { skipped.push(r); }
    } catch(e) {
      const cb = document.querySelector('button[aria-label="close"], button[aria-label="Close"]');
      if (cb) cb.click();
      errors.push(`${i}:${e.message.slice(0,40)}`);
    }
    await sleep(500);
  }
  // Return compact summary only — keep context lean
  return JSON.stringify({ sent, ok, errors_count: errors.length, skipped_count: skipped.length });
}
```

### After Each Tab — Context Compaction Protocol

1. Parse JSON result: extract `sent` count and `ok` array (`OK|name|email` lines)
2. **Immediately write all new rows** to ledger (`/Users/xiaozuo/impact-ottocast-ledger.md`) in ONE Edit
3. **Immediately append** new rows to Obsidian tracker (see Phase 3 format)
4. **Discard** the raw evaluate result from your working memory — only keep the counts
5. Add `sent` to running `session_total`
6. If `session_total >= 300`: skip remaining tabs, go to Phase 3
7. Switch hash to next tab, wait 3s

---

## PHASE 3 — Report Generation

After all tabs complete (or 300 limit reached), write two outputs:

### A. Update Obsidian Tracker
File: `/Volumes/workssd/ObsidianVault/06-Publishers/impact-ottocast-tracker.md`

Append a new session block:
```markdown
### {DATE} — Session {N} | Sent: {total} | Model: haiku

| Publisher Name | Tab | Date |
|---|---|---|
| {name} | {tab} | {date} |
```

### B. Console Report
Print this summary at end:
```
=== Ottocast Impact Outreach — Session Complete ===
Date:          {today}
Model:         haiku
Total Sent:    {total} / 300
Tabs Covered:  {list}
New in Ledger: {count}
Ledger Total:  {grand_total}
Obsidian:      /Volumes/workssd/ObsidianVault/06-Publishers/impact-ottocast-tracker.md
=====================================
Next run:      /impact-ottocast  (picks up where left off — ledger deduplicates)
```

---

## Token & Context Rules

1. **NEVER `browser_snapshot`** during outreach — zero exceptions
2. **Inject helper ONCE** — never re-inject mid-session
3. **ONE evaluate per tab** — all 25 cards in one script
4. **ONE Edit per tab** — batch all ledger rows together
5. **Compact evaluate results** — only store JSON summary, discard raw card strings
6. **Discard tab results after writing** — prevents context bloat across 5 tabs
7. **300 limit is hard** — stop immediately when reached, still generate report
8. **On ANY error**: close modal, push to errors array, continue — never abort loop
