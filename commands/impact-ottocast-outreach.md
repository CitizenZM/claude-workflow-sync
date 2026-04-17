---
description: "Impact Ottocast proposal sending (Haiku). Run /impact-ottocast-setup first. Usage: /impact-ottocast-outreach"
model: haiku
---

## MODEL GATE — MANDATORY FIRST CHECK
This command REQUIRES model: **haiku**. If you are running on Sonnet or Opus, STOP: "⛔ Wrong model. Run `/model haiku` then re-run `/impact-ottocast-outreach`."

## Pre-flight Check
Before starting, verify helper is injected:
```js
// browser_evaluate
() => `helper=${typeof window.__otto_fill}, cards=${document.querySelectorAll('.discovery-card').length}`
```
If `helper=undefined`, tell user to run `/impact-ottocast-setup` first.

## Tab Order

Process tabs in this order. Switch tab by setting hash:
```js
// browser_evaluate
() => { window.location.hash = 'businessModels=CONTENT_REVIEWS&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC'; return 'navigated'; }
```

| # | Tab | Hash value |
|---|-----|-----------|
| 1 | Content / Reviews | `businessModels=CONTENT_REVIEWS&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |
| 2 | Deal / Coupons | `businessModels=DEAL_COUPON&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |
| 3 | Email / Newsletter | `businessModels=EMAIL_NEWSLETTER&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |
| 4 | Loyalty / Rewards | `businessModels=LOYALTY_REWARDS&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |
| 5 | Network | `businessModels=NETWORK&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |

Wait 3s after each hash change for the page to reload.

## Per-Tab: Send All Proposals in ONE evaluate

Load the current ledger names into the `contacted` set before running.

```js
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const contacted = new Set([/* paste current ledger Publisher Name values here, comma-separated quoted strings */]);
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
      const closeBtn = document.querySelector('button[aria-label="close"], button[aria-label="Close"]');
      if (closeBtn) closeBtn.click();
      results.push(`${i}:error(${e.message})`);
    }
    await sleep(500);
  }
  return results.join('\n');
}
```

## After Each Tab

1. Parse all `OK|name|email` lines from the result
2. Add ALL new rows to ledger in a **single Edit call**:

```markdown
| Publisher Name | | 2026-04-16 |
```

3. Add skipped (Review Terms / no proposal) to the Skipped section
4. Switch hash to next tab, wait 3s, run again

## Ledger File

`/Users/xiaozuo/impact-ottocast-ledger.md`

## Rules

1. NEVER `browser_snapshot` — zero exceptions
2. ONE evaluate per tab
3. ONE Edit per tab for ledger updates
4. On ANY error inside the loop: close modal, continue — NEVER abort
5. Work nonstop through all 5 tabs without pausing or asking questions
