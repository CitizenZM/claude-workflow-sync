---
description: "Impact Ottocast US Affiliate Outreach April162026 — outreach loop (Haiku). 300/run limit + Obsidian report. Run /impact-ottocast-setup first."
model: haiku
---

## MODEL: haiku (auto-assigned)
**Session limit**: 300 proposals. **Report**: written to Obsidian + console after completion.

## Pre-flight
```js
() => `helper=${typeof window.__otto_fill}, cards=${document.querySelectorAll('.discovery-card').length}`
```
If `helper=undefined` → run `/impact-ottocast-setup` first (Sonnet handles SSO).

## Tab Order

| # | Tab | Hash |
|---|-----|------|
| 1 | Content / Reviews | `businessModels=CONTENT_REVIEWS&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |
| 2 | Deal / Coupons | `businessModels=DEAL_COUPON&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |
| 3 | Email / Newsletter | `businessModels=EMAIL_NEWSLETTER&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |
| 4 | Loyalty / Rewards | `businessModels=LOYALTY_REWARDS&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |
| 5 | Network | `businessModels=NETWORK&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |

Switch tab: `() => { window.location.hash = '{HASH}'; return 'navigated'; }` — wait 3s.

## Per-Tab Script

Set `SESSION_REMAINING = 300 - sent_so_far` before each tab.

```js
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const SESSION_REMAINING = 300; // ← update per tab
  const contacted = new Set([/* current ledger names */]);
  const cards = document.querySelectorAll('.discovery-card');
  let sent = 0;
  const ok = [], skipped = [], errors = [];
  for (let i = 0; i < cards.length; i++) {
    if (sent >= SESSION_REMAINING) break;
    const name = cards[i].querySelector('[class*="name"]')?.textContent.trim() || '';
    const btns = Array.from(cards[i].querySelectorAll('button')).map(b => b.textContent.trim());
    if (contacted.has(name) || !btns.includes('Send Proposal')) { skipped.push(name); continue; }
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
  return JSON.stringify({ sent, ok, errors_count: errors.length });
}
```

## After Each Tab — Context Compaction Protocol

1. Parse JSON result → extract `sent` + `ok` array
2. **ONE Edit** → append new rows to `/Users/xiaozuo/impact-ottocast-ledger.md`
3. **ONE Edit** → append new rows to Obsidian tracker (see Report section)
4. **Discard** raw result — only keep counts in working memory
5. Add `sent` to `session_total`; if `session_total >= 300` → stop, go to Report
6. Move to next tab

## Report (run after all tabs or 300 limit)

### A. Obsidian Tracker — append to `/Volumes/workssd/ObsidianVault/06-Publishers/impact-ottocast-tracker.md`

```markdown
### {YYYY-MM-DD} — Session {N} | Sent: {total} | Model: haiku

| Publisher Name | Tab | Date |
|---|---|---|
| {name} | {tab} | {date} |
```

### B. Console Summary
```
=== Ottocast Impact Outreach — Session Complete ===
Date:         {today}
Model:        haiku (setup: sonnet)
Sent:         {session_total} / 300
Tabs:         {completed_tabs}
Ledger total: {grand_total}
Obsidian:     /Volumes/workssd/ObsidianVault/06-Publishers/impact-ottocast-tracker.md
Next run:     /impact-ottocast-outreach  (ledger deduplicates automatically)
=================================================
```

## Rules
1. NEVER `browser_snapshot`
2. ONE evaluate per tab — 300 hard limit across all tabs
3. ONE Edit per tab for both ledger + Obsidian (batch all rows)
4. Compact context: return JSON summary only, discard raw strings after writing
5. On ANY error: close modal, continue — never abort
6. Nonstop through all tabs — no pausing, no questions
