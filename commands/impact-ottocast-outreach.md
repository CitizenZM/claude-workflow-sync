---
description: "Impact Ottocast US Affiliate Outreach April162026 — outreach loop (Haiku). 300/run limit + Obsidian report. Run /impact-ottocast-setup first."
model: haiku
---

## Pre-flight (autonomous — aborts, never prompts)
- Model: **haiku** only. Session limit 300 proposals. Report written to Obsidian + console after completion.
- MCP: `mcp__playwright-impact-ottocast__*` exclusively (profile `~/.claude/browser-profiles/impact-ottocast`, port 9304). Fallback to generic `mcp__playwright__*` = forbidden.
- Supervisor: provided by `/impact-ottocast-setup`. If missing this session, spawn via `~/.claude/skills/_shared/outreach-supervisor-prompt.md` before any batches. Full contract: `~/.claude/skills/_shared/outreach-isolation.md`.
- Checkpoint `/tmp/outreach-impact-ottocast-checkpoint.json`: every 10 confirmed proposals → batch-write ledger → write checkpoint with full scraped rows (`n|e|p`) + `sent, errors_count, skipped_count, next_start, tab, error_samples, local_signal` → message supervisor → apply verdict autonomously (continue | pause=apply fix+retry once | halt=write reason+exit). Print a non-blocking 2-line status (10 names+emails). Never wait for user input.

## ⚠️ ACCOUNT GATE — MUST be program 49590 EXACTLY (CARTIZAN CORPORATION 6924145)

**Program 47964 is a DIFFERENT Ottocast program and MUST NEVER be used.** A label containing "ottocast" is NOT sufficient proof — the gate must verify program ID **49590 specifically** via cookies, URL params, and/or DOM data attributes.

### Gate (hard-match 49590 — abort if 47964 or any other ID)
```js
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function findInShadow(root, sel, depth=0) {
    if (depth>8) return null;
    const el = root.querySelector(sel); if (el) return el;
    let found=null; root.querySelectorAll('*').forEach(e => { if(e.shadowRoot && !found) found=findInShadow(e.shadowRoot,sel,depth+1); }); return found;
  }
  function getActiveProgramId() {
    // Source 1: IR_AUTH cookie (Impact stores activeProgramId here)
    const ck = document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('IR_activeProgramId=') || c.startsWith('activeProgramId='));
    if (ck) return ck.split('=')[1];
    // Source 2: URL query/fragment
    const m = (location.href).match(/[?&#](?:programId|activeProgramId|p)=(\d+)/i);
    if (m) return m[1];
    // Source 3: shadow DOM data attribute on the nav account button
    function walk(root, depth=0) {
      if (depth>8) return null;
      const el = root.querySelector('[data-program-id], [data-active-program-id], [data-testid*="acctswitcher-program-"]');
      if (el) {
        return el.getAttribute('data-program-id')
          || el.getAttribute('data-active-program-id')
          || (el.getAttribute('data-testid')||'').match(/acctswitcher-program-(\d+)/)?.[1];
      }
      let r=null; root.querySelectorAll('*').forEach(e=>{ if(e.shadowRoot && !r) r=walk(e.shadowRoot,depth+1); }); return r;
    }
    return walk(document);
  }

  const activeId = getActiveProgramId();
  if (activeId === '49590') return 'GATE_OK:49590';

  // Not 49590 — attempt switch
  const btn = findInShadow(document, '[class*="nav-account-btn"]');
  if (!btn) return `GATE_FAIL:no-switcher|active=${activeId||'unknown'}`;
  btn.click(); await sleep(1500);
  const cartizan = findInShadow(document, '[data-testid="acctswitcher-account-6924145"]');
  if (!cartizan) return `GATE_FAIL:cartizan-not-found|active=${activeId||'unknown'}`;
  cartizan.click(); await sleep(1500);
  const otto = findInShadow(document, '[data-testid="acctswitcher-program-49590"]');
  if (!otto) return `GATE_FAIL:program-49590-not-found|active=${activeId||'unknown'}`;
  otto.click(); await sleep(4000);

  // Re-verify AFTER switch
  const postId = getActiveProgramId();
  if (postId === '49590') return 'GATE_OK:49590-after-switch';
  return `GATE_FAIL:post-switch-mismatch|active=${postId||'unknown'}`;
}
```

**HARD RULE**: The outreach loop MUST NOT proceed unless the gate returns a string starting with `GATE_OK:49590`. Any `GATE_FAIL:*` response must abort the entire run and surface the error. Specifically: if `active=47964` appears anywhere in the response, STOP immediately and report to the operator — do not attempt to auto-switch silently.

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

## Per-Batch Script (10 cards per evaluate — supervisor verdict after each batch)

**CRITICAL**: Run in batches of 10. After each batch, write the checkpoint + message the background Opus supervisor (spawned in setup); apply its verdict autonomously. Do NOT spawn a new Opus agent per batch and do NOT stop for user input — the supervisor reply is the only gate.

Parameters to update before EACH batch call:
- `BATCH_START`: card index to start from (0 for first batch, then increment by processed count)
- `SESSION_REMAINING`: 300 minus total sent across all tabs so far

```js
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const BATCH_START = 0;        // ← UPDATE: card index to resume from
  const BATCH_SIZE = 10;        // process 10 cards per batch
  const SESSION_REMAINING = 300; // ← UPDATE: 300 - total_sent_so_far

  // Self-heal: re-inject v12 helper if missing
  if (typeof window.__otto_fill === 'undefined') return 'ERR_HELPER_MISSING_REINJECT_REQUIRED';

  // PER-BATCH ACCOUNT GATE — hard-match 49590 before every batch
  const ckId = (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('IR_activeProgramId=')||c.startsWith('activeProgramId='))||'').split('=')[1] || '';
  const urlId = (location.href.match(/[?&#](?:programId|activeProgramId|p)=(\d+)/i)||[])[1] || '';
  const activeProgramId = ckId || urlId;
  if (activeProgramId && activeProgramId !== '49590') {
    return JSON.stringify({ error: 'WRONG_PROGRAM', active: activeProgramId, expected: '49590', abort: true });
  }

  const cards = document.querySelectorAll('.discovery-card');
  const total_cards = cards.length;

  let sent = 0, no_send_proposal = 0, errors_count = 0, skipped_count = 0;
  const rows = [], error_samples = [];
  let next_start = BATCH_START;

  for (let i = BATCH_START; i < total_cards; i++) {
    if (sent >= BATCH_SIZE || sent >= SESSION_REMAINING) { next_start = i; break; }
    next_start = i + 1; // advance past this card regardless of outcome

    const btns = Array.from(cards[i].querySelectorAll('button')).map(b => b.textContent.trim());
    if (!btns.includes('Send Proposal')) { no_send_proposal++; continue; }

    try {
      const r = await window.__otto_fill(i);
      if (typeof r === 'string' && r.startsWith('OK|')) {
        const parts = r.split('|');
        rows.push({ n: parts[1]||'', e: parts[2]||'', p: parts[3]||'' });
        sent++;
      } else {
        skipped_count++;
        if (error_samples.length < 5) error_samples.push(String(r).slice(0, 100));
      }
    } catch(e) {
      const cb = document.querySelector('button[aria-label="close"], button[aria-label="Close"]');
      if (cb) cb.click();
      errors_count++;
      if (error_samples.length < 5) error_samples.push(`${i}:${(e.message||'').slice(0,60)}`);
    }
    await sleep(500);
  }

  return JSON.stringify({ total_cards, sent, no_send_proposal, errors_count, skipped_count, rows, error_samples, next_start });
}
```

## After Each Batch — Checkpoint Protocol (delegate to shared supervisor)

After every batch evaluate:

0. **FIRST check for `{"error":"WRONG_PROGRAM"}`** — if present, STOP ALL BATCHES immediately, discard any rows accumulated in this session (they went to the wrong account), and surface to operator: `active={id} expected=49590 — aborted {N} proposals sent to wrong program`. Do NOT auto-retry.
1. Parse result: `{ sent, errors_count, skipped_count, rows, error_samples, next_start }`.
2. **Write rows** to `/Users/xiaozuo/impact-ottocast-ledger.md` (ONE Edit).
3. **Add `sent`** to running `session_total` and `tab_sent`.
4. **Compute local signal** (feed this INTO the checkpoint — do NOT spawn a second agent):
   - HEALTHY: `sent > 0` and `errors_count / max(sent+skipped_count,1) < 0.5` and no `no-term-confirmed` / `submit-not-confirmed` patterns.
   - DEGRADED otherwise.
5. **Write checkpoint** `/tmp/outreach-impact-ottocast-checkpoint.json` with `{batch_n, sent, errors_count, skipped_count, rows, error_samples, next_start, tab, local_signal}`, then message the background supervisor (spawned in `/impact-ottocast-setup` Step 0b) for verdict.
6. Apply supervisor verdict:
   - `continue` → proceed to next batch.
   - `pause` → read supervisor fix payload from checkpoint reply, apply autonomously, retry current batch once (no operator input).
   - `halt` → stop, write halt reason to checkpoint, exit.
7. If `session_total >= 300` → stop all tabs, go to Report.
8. If `next_start >= total_cards` → tab complete, move to next tab.
9. Else → run next batch with `BATCH_START = next_start`.

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
