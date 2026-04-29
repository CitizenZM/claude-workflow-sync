---
description: "Impact Ottocast US Affiliate Outreach April162026 — full workflow (Haiku). Login + outreach + report, 1000 max/run. Usage: /impact-ottocast"
model: haiku
---

# Impact Ottocast Amazon Affiliate Outreach — Full Workflow

**Model**: haiku (auto-assigned by this command)
**Limit**: 1000 proposals max per session (configurable via SESSION_LIMIT)
**On completion**: Write Obsidian tracker + session report

## MCP SERVER — MANDATORY
All browser tool calls MUST use `mcp__playwright-impact-ottocast__*` namespace exclusively.
Profile: `~/.claude/browser-profiles/impact-ottocast` — port 9304.
NEVER use `mcp__playwright__`, `mcp__playwright-impact__`, or any other namespace — concurrent workflows will collide.

## Step 0: Isolation + Supervisor (MANDATORY — run FIRST)

### 0a. Initialize workflow isolation
```
bash ~/.claude/scripts/outreach/init-workflow.sh impact-ottocast playwright-impact-ottocast 9304
```
If exit code 2, STOP and show the printed JSON for `~/.claude.json`.

### 0b. Spawn Opus supervisor (background)
Call Agent with `subagent_type: general-purpose`, `model: opus`, `run_in_background: true`. Load prompt from `~/.claude/skills/_shared/outreach-supervisor-prompt.md` with bindings:
- workflow: `impact-ottocast`
- target_total: 1000
- ledger_path: `/Users/xiaozuo/impact-ottocast-ledger.md`
- checkpoint_path: `/tmp/outreach-impact-ottocast-checkpoint.json`
- mcp_namespace: `mcp__playwright-impact-ottocast__`

Record the agent id/name — every 10 confirmed proposals, write the checkpoint file and message the supervisor for verdict (continue/pause/halt). Display 2-line status with the 10 publisher names + emails before continuing.

---

## PHASE 1 — Login & Setup (Steps 1–4)

### Step 1: Navigate & Login
```js
// browser_navigate → https://app.impact.com
```
Take ONE `browser_snapshot` for login form (the ONLY snapshot allowed in the entire workflow). Fill and submit:
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

### Step 1.5: Switch to Ottocast Amazon Account (program 49590 / CARTIZAN CORPORATION 6924145)
**CRITICAL**: Program **47964 is a DIFFERENT Ottocast program and MUST NEVER be used.** The gate below hard-matches program ID `49590` via cookie/URL/DOM — a label containing "ottocast" is NOT sufficient proof.
```js
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function findInShadow(root, sel, depth=0) {
    if (depth>8) return null;
    const el = root.querySelector(sel); if (el) return el;
    let found=null; root.querySelectorAll('*').forEach(e => { if(e.shadowRoot&&!found) found=findInShadow(e.shadowRoot,sel,depth+1); }); return found;
  }
  function getActiveProgramId() {
    const ck = (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('IR_activeProgramId=')||c.startsWith('activeProgramId='))||'').split('=')[1] || '';
    if (ck) return ck;
    const m = (location.href).match(/[?&#](?:programId|activeProgramId|p)=(\d+)/i);
    if (m) return m[1];
    function walk(root, depth=0) {
      if (depth>8) return null;
      const el = root.querySelector('[data-program-id], [data-active-program-id], [data-testid*="acctswitcher-program-"]');
      if (el) return el.getAttribute('data-program-id') || el.getAttribute('data-active-program-id') || (el.getAttribute('data-testid')||'').match(/acctswitcher-program-(\d+)/)?.[1];
      let r=null; root.querySelectorAll('*').forEach(e=>{ if(e.shadowRoot && !r) r=walk(e.shadowRoot,depth+1); }); return r;
    }
    return walk(document);
  }
  if (getActiveProgramId() === '49590') return 'GATE_OK:49590';
  const btn = findInShadow(document, '[class*="nav-account-btn"]');
  if (!btn) return 'GATE_FAIL:no-switcher';
  btn.click(); await sleep(1500);
  const cartizan = findInShadow(document, '[data-testid="acctswitcher-account-6924145"]');
  if (!cartizan) return 'GATE_FAIL:cartizan-not-found';
  cartizan.click(); await sleep(1500);
  const otto = findInShadow(document, '[data-testid="acctswitcher-program-49590"]');
  if (!otto) return 'GATE_FAIL:program-49590-not-found';
  otto.click(); await sleep(4000);
  const postId = getActiveProgramId();
  return postId === '49590' ? 'GATE_OK:49590-after-switch' : `GATE_FAIL:post-switch-mismatch|active=${postId||'unknown'}`;
}
```
**HARD STOP**: Do NOT proceed unless the response starts with `GATE_OK:49590`. If it returns `active=47964` or any other ID, abort and surface to operator.

### Step 2: Navigate to Discover
```
browser_navigate → https://app.impact.com/secure/advertiser/discover/radius/fr/partner_discover.ihtml?page=marketplace&slideout_id_type=partner#businessModels=CONTENT_REVIEWS&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC
```
Wait 3s.

### Step 3: Inject Helper (once per session — v12)

**v12**: Fixes term selection by using `[data-testid="uicl-select-item"]` as the primary item selector (mentioned in Opus prompt as the working selector) plus full pointer event sequence (pointerdown→mousedown→pointerup→mouseup→click) to properly trigger the Vue/React component's event handlers. v9–v11 used generic `li` + bare `click()` which found the correct element but didn't register the selection because the component requires the full mouse event sequence starting with mousedown/pointerdown.

```js
// browser_evaluate — canonical window.__otto_fill v12
() => {
  window.__otto_fill = async (cardIdx) => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const cards = document.querySelectorAll('.discovery-card');
    const card = cards[cardIdx];
    if (!card) return `${cardIdx}:no-card||`;

    const name = card.querySelector('[class*="name"]')?.textContent.trim() || String(cardIdx);
    let publisherEmail = '', publisherName = name, partnerId = '';

    const profileLink = card.querySelector('a[href*="partner_profile"], a[href*="partnerProfile"], a[href*="partner-profile"], a[href*="publisher"]');
    if (profileLink?.href) {
      try {
        const pidMatch = profileLink.href.match(/[?&](?:p|publisher[_-]?id)=(\d+)/i);
        if (pidMatch) partnerId = pidMatch[1];
        const resp = await fetch(profileLink.href, { credentials: 'include' });
        const html = await resp.text();
        const emailMatch = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) publisherEmail = emailMatch[0];
      } catch(_) {}
    }

    const btn = Array.from(card.querySelectorAll('button')).find(b => b.textContent.trim() === 'Send Proposal');
    if (!btn) return `${cardIdx}:skip||${name}`;
    btn.style.display = 'inline-block'; btn.click();
    await sleep(3500);

    const iframe = document.querySelector('iframe[src*="send-proposal"], iframe[src*="proposal"]');
    if (!iframe) return `${cardIdx}:no-iframe|${name}|`;

    try {
      const u = new URL(iframe.src);
      if (!publisherEmail) publisherEmail = u.searchParams.get('email') || '';
      publisherName = u.searchParams.get('name') || name;
      if (!partnerId) partnerId = u.searchParams.get('p') || '';
    } catch(_) {}

    const doc = iframe.contentDocument;
    let t = 0; while (doc.readyState !== 'complete' && t < 16) { await sleep(500); t++; }

    // ── Term Selection (v12 — uicl-select-item + full pointer event sequence) ──
    // Root cause of v9-v11 failure: bare click() on LI doesn't trigger the
    // component's mousedown-based selection handler. Fix: full pointer event chain.
    // Primary selector: [data-testid="uicl-select-item"] (known working in Opus prompt).
    const PLACEHOLDER_RX = /^(select|请选择|选择|选择条款|--|-|choose|placeholder)?$/i;

    const fireClick = (el) => {
      el.scrollIntoView({ block: 'center' });
      el.focus();
      el.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, cancelable: true, pointerType: 'mouse' }));
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse', button: 0 }));
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse', button: 0 }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }));
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    };

    const allSelectBtns = Array.from(doc.querySelectorAll('button')).filter(b => b.textContent.trim() === 'Select');
    const termTrigger = allSelectBtns[0];

    let termOk = false;

    if (termTrigger) {
      for (let attempt = 0; attempt < 3; attempt++) {
        fireClick(termTrigger);
        await sleep(1500);

        // Primary: [data-testid="uicl-select-item"] — the component's known selector
        let termItem = Array.from(doc.querySelectorAll('[data-testid="uicl-select-item"]')).find(el => {
          const t = el.textContent?.trim() || '';
          return t.includes('公开条款') || t.toLowerCase().includes('public');
        }) || doc.querySelector('[data-testid="uicl-select-item"]');

        // Fallback: li text match if data-testid not present
        if (!termItem) {
          const lis = Array.from(doc.querySelectorAll('li'));
          termItem = lis.find(li => {
            const t = li.textContent?.trim() || '';
            return t.includes('公开条款') || t.toLowerCase().includes('public term');
          }) || lis.find(li => {
            const t = li.textContent?.trim() || '';
            return t !== '' && !PLACEHOLDER_RX.test(t) && t.length < 80;
          });
        }

        if (termItem) {
          fireClick(termItem);
          await sleep(1500);
          const newText = termTrigger.textContent?.trim() || '';
          if (newText !== '' && newText !== 'Select' && !PLACEHOLDER_RX.test(newText)) {
            termOk = true; break;
          }
          // Also accept if aria-selected appears on item
          if (termItem.getAttribute('aria-selected') === 'true' || termItem.classList.contains('selected') || termItem.classList.contains('active')) {
            termOk = true; break;
          }
        }
        await sleep(500);
      }
    }

    if (!termOk) {
      const cancel = Array.from(doc.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancel');
      if (cancel) { cancel.click(); await sleep(500); }
      const closers = Array.from(document.querySelectorAll('button')).filter(b =>
        b.getAttribute('aria-label')?.toLowerCase().includes('close') || b.textContent.trim() === '×' || b.textContent.trim() === '✕'
      );
      for (const c of closers) { c.click(); await sleep(200); }
      return `${cardIdx}:no-term-confirmed|${publisherName}|${publisherEmail}`;
    }
    // ── end term selection v12 ──────────────────────────────────────

    // Step D — Date picker v12 — select TOMORROW (confirmed working via live DOM test)
    // Calendar found via class-hint (/calendar|datepicker|picker/i). Start date = buttonWraps[0].
    const now2 = new Date();
    const tomorrow = new Date(now2.getFullYear(), now2.getMonth(), now2.getDate() + 1);
    const targetDay = tomorrow.getDate();
    const monthChanged = tomorrow.getMonth() !== now2.getMonth();
    const isVisibleD = el => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const cs = (el.ownerDocument.defaultView || window).getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
    };
    const buttonWraps = Array.from(doc.querySelectorAll('button[class*="input-wrap"]'));
    let startBtn = buttonWraps.find(b => !(b.textContent||'').trim()) || buttonWraps[0];
    if (/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test((startBtn.textContent||'').trim())) startBtn = buttonWraps[0];
    if (startBtn) {
      const preClickNodes = new Set(Array.from(doc.body.querySelectorAll('*')));
      startBtn.scrollIntoView({ block: 'center' }); startBtn.focus(); startBtn.click();
      startBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      startBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      await sleep(800);
      const findCalendar = () => Array.from(doc.body.querySelectorAll('*')).find(el => {
        if (!isVisibleD(el) || preClickNodes.has(el)) return false;
        const c = (el.className && el.className.baseVal) || el.className || '';
        return typeof c === 'string' && /calendar|datepicker|date-picker|month-view|day-picker|picker/i.test(c);
      });
      let cp = findCalendar(); if (!cp) { await sleep(500); cp = findCalendar(); }
      if (cp) {
        if (monthChanged) {
          const nextBtn = cp.querySelector('[class*="next"], button[aria-label*="next" i]') ||
            Array.from(cp.querySelectorAll('button')).find(b => /^[>›»]$/.test((b.textContent||'').trim()));
          if (nextBtn) { nextBtn.click(); await sleep(300); }
        }
        const day = Array.from(cp.querySelectorAll('button, [role="gridcell"], td, span, div')).find(el => {
          if (!isVisibleD(el) || (el.textContent||'').trim() !== String(targetDay)) return false;
          if (el.hasAttribute('disabled') || (el.getAttribute('aria-disabled')||'').toLowerCase() === 'true') return false;
          const cls = (el.className && el.className.baseVal) || el.className || '';
          if (typeof cls === 'string' && /(disabled|outside|other-month|muted|faded|inactive|greyed|prev-month|next-month)/i.test(cls)) return false;
          return el.querySelectorAll('*').length <= 3;
        });
        if (day) { day.click(); await sleep(400); }
      }
    }

    // Step E — Message
    const ta = doc.querySelector('textarea');
    if (ta) {
      const msg = "This is Bob Zabel from Ottocast US affiliate team. We are excited to work with you on Amazon affiliate promotion. We will offer 10+10%CPAi commission and additional sample/Content review opportunities. We offer ultra high commission for dedicated publishers with a full creative library, product data feeds, and exclusive promotional offers for our partners.";
      const ns = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      ns.call(ta, msg); ta.dispatchEvent(new Event('input',{bubbles:true})); ta.dispatchEvent(new Event('change',{bubbles:true}));
    }
    await sleep(400);

    // Step F — Submit with SUBMIT CONFIRMATION GATE
    const sub = Array.from(doc.querySelectorAll('button')).find(b => b.textContent.trim() === 'Send Proposal');
    if (!sub) return `${cardIdx}:no-submit|${publisherName}|${publisherEmail}`;
    const iframeStillThere = () => !!document.querySelector('iframe[src*="send-proposal"], iframe[src*="proposal"]');
    sub.style.display = 'inline-block'; sub.click();
    await sleep(1500);

    const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'I understand')
      || Array.from(doc.querySelectorAll('button')).find(b => b.textContent.trim() === 'I understand');
    if (confirmBtn) { confirmBtn.click(); await sleep(800); }

    const SUCCESS_RX = /(proposal\s+sent|successfully|sent successfully|成功|已发送|发送成功|invitation sent)/i;
    const ERROR_RX = /(required|please select|missing|error|invalid|失败|必填|请选择)/i;
    let confirmed = false, errorSeen = false, elapsed = 0;
    while (elapsed < 6000) {
      await sleep(500); elapsed += 500;
      const toastText = Array.from(document.querySelectorAll('[class*="toast"], [class*="notification"], [class*="banner"], [role="status"], [role="alert"]'))
        .map(e => (e.textContent||'').trim()).join(' | ');
      if (SUCCESS_RX.test(toastText)) { confirmed = true; break; }
      if (ERROR_RX.test(toastText)) { errorSeen = true; break; }
      if (!iframeStillThere()) { confirmed = true; break; }
      try {
        const innerToast = Array.from(doc.querySelectorAll('[class*="toast"], [class*="notification"], [role="status"], [role="alert"]'))
          .map(e => (e.textContent||'').trim()).join(' | ');
        if (SUCCESS_RX.test(innerToast)) { confirmed = true; break; }
        if (ERROR_RX.test(innerToast)) { errorSeen = true; break; }
      } catch(_) {}
    }

    const closers = Array.from(document.querySelectorAll('button')).filter(b =>
      b.getAttribute('aria-label')?.toLowerCase().includes('close') || b.className?.toLowerCase().includes('close') ||
      b.textContent.trim() === '×' || b.textContent.trim() === '✕'
    );
    for (const c of closers) { c.click(); await sleep(200); }

    if (errorSeen) return `${cardIdx}:submit-error|${publisherName}|${publisherEmail}`;
    if (!confirmed) return `${cardIdx}:submit-not-confirmed|${publisherName}|${publisherEmail}`;
    return `OK|${publisherName}|${publisherEmail}|${partnerId}`;
  };
  return 'otto helper v12 injected';
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

**SESSION LIMIT: 1000 proposals total. Track running count across all tabs and cycles.**

### Tab Order & Hashes

| # | Tab | Hash |
|---|-----|------|
| 1 | Content / Reviews | `businessModels=CONTENT_REVIEWS&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |
| 2 | Deal / Coupons | `businessModels=DEAL_COUPON&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |
| 3 | Email / Newsletter | `businessModels=EMAIL_NEWSLETTER&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |
| 4 | Loyalty / Rewards | `businessModels=LOYALTY_REWARDS&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |
| 5 | Network | `businessModels=NETWORK&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |

### Per-Tab Script (full tab in one evaluate — inline health check)

Run ONE evaluate per tab. After each tab completes: write the checkpoint file and message the supervisor per the Step 0b contract (every 10 confirmed proposals, or tab boundary — whichever comes first). Inline health logic runs in-script but does NOT replace the supervisor verdict.

Parameters to update before EACH tab:
- `SESSION_REMAINING`: SESSION_LIMIT minus total sent so far (starts at 1000)
- Tab URL: navigate to the correct tab hash before running

```js
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const SESSION_REMAINING = 1000; // ← UPDATE: SESSION_LIMIT - total_sent_so_far

  // Self-heal: detect missing helper
  if (typeof window.__otto_fill === 'undefined') return 'ERR_HELPER_MISSING_REINJECT_REQUIRED';

  // ACCOUNT GATE — hard-match program 49590
  const ckId = (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('IR_activeProgramId=')||c.startsWith('activeProgramId='))||'').split('=')[1] || '';
  const urlId = (location.href.match(/[?&#](?:programId|activeProgramId|p)=(\d+)/i)||[])[1] || '';
  const lsId = (() => { try { const v = localStorage.getItem('ilsid2'); if (!v) return ''; const m = v.match(/^(\d+)-/); return m?m[1]:''; } catch(_) { return ''; } })();
  const activeProgramId = ckId || lsId || urlId;
  if (activeProgramId && activeProgramId !== '49590') {
    return JSON.stringify({ error: 'WRONG_PROGRAM', active: activeProgramId, expected: '49590', abort: true });
  }

  // Load more cards if available
  const loadMore = Array.from(document.querySelectorAll('button,a')).find(b => {
    const t = (b.textContent || '').trim().toLowerCase();
    return t === 'load more' || t === 'show more' || t.includes('load more');
  });
  if (loadMore) { loadMore.click(); await sleep(2500); }

  const cards = document.querySelectorAll('.discovery-card');
  const total_cards = cards.length;
  let sent = 0, no_send_proposal = 0, errors_count = 0, skipped_count = 0;
  const rows = [], error_samples = [];

  for (let i = 0; i < total_cards; i++) {
    if (sent >= SESSION_REMAINING) break;

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
        if (error_samples.length < 10) error_samples.push(String(r).slice(0, 120));
      }
    } catch(e) {
      const cb = document.querySelector('button[aria-label="close"], button[aria-label="Close"]');
      if (cb) cb.click();
      errors_count++;
      if (error_samples.length < 10) error_samples.push(`${i}:${(e.message||'').slice(0,80)}`);
    }
    await sleep(500);
  }

  // Inline health assessment
  const noTermErrors = error_samples.filter(s => s.includes('no-term-confirmed')).length;
  const submitErrors = error_samples.filter(s => s.includes('submit-not-confirmed') || s.includes('submit-error')).length;
  let health = 'HEALTHY';
  if (sent === 0 && total_cards > 0) health = 'DEGRADED:zero-sent';
  else if (noTermErrors > 0) health = 'DEGRADED:term-selection-failure';
  else if (submitErrors > 2) health = 'DEGRADED:submit-failure';
  else if (errors_count > sent) health = 'DEGRADED:high-error-rate';

  return JSON.stringify({ total_cards, sent, no_send_proposal, errors_count, skipped_count, rows, error_samples, health });
}
```

### After Each Tab — Processing Protocol

0. **FIRST check for `{"error":"WRONG_PROGRAM"}`** — if present, write `local_signal: "HALT:wrong-program"` + `active_id` to the checkpoint file, message the background supervisor, and stop the run autonomously. Do NOT auto-retry. No operator prompt.
1. Parse result: `{ sent, errors_count, skipped_count, error_samples, rows, health, total_cards }`
2. **Write rows to ledger** — `/Users/xiaozuo/impact-ottocast-ledger.md`:
   - Read the last 5 lines of the file first to get the exact last row text
   - Use that last row as the Edit anchor (single-row anchor — never multi-row)
   - Append all new rows in format: `| {n} | {e} | {p} | {date} |`
   - ONE Edit call per tab — never split into multiple Edits for one tab's rows
3. Add `sent` to `session_total`
4. **Health check** (inline — no Opus needed):
   - `health == HEALTHY` → continue to next tab
   - `health == DEGRADED:term-selection-failure` → re-inject helper (Step 3), retry tab once
   - `health == DEGRADED:zero-sent` AND `total_cards > 0` → re-inject helper, retry tab once; if still zero, skip tab and log
   - `health == DEGRADED:submit-failure` or `high-error-rate` → log warning, continue (not worth stopping)
5. **Proactive tab rotation** — after every 2 complete full-cycle (all 5 tabs), open a fresh browser tab:
   - `browser_tabs action=new`
   - Navigate to current tab URL
   - Re-inject v12 helper
   - Continue from next tab in sequence
   - This prevents OOM from ~180+ accumulated console errors
6. If `session_total >= SESSION_LIMIT (1000)`: stop, go to Phase 3
7. Tab complete → switch to next tab hash; after all 5 tabs = 1 full cycle; repeat cycles until limit

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
Date:             {today}
Model:            haiku
Total Sent:       {total} / 1000
Tabs Covered:     {list}
Tab Breakdown:    {tab: total_cards | sent | already_in_network | errors}
New in Ledger:    {count}
Ledger Total:     {grand_total}
Obsidian:         /Volumes/workssd/ObsidianVault/06-Publishers/impact-ottocast-tracker.md
=====================================
Next run:         /impact-ottocast  (picks up where left off — DOM button state deduplicates)
```

---

## Browser Crash Recovery Protocol

**Trigger**: `browser_evaluate` or `browser_navigate` returns `Target crashed` / `Page crashed` / `Execution context was destroyed`.

**Root cause**: Tabs accumulate console errors (182+) from the heavy JS evaluation loop, causing OOM in the renderer process.

**Recovery steps** (execute in order, no user confirmation needed):
1. `browser_tabs action=new` — open a fresh tab (new renderer, clean memory)
2. Navigate to the current tab's URL in the new tab
3. Re-inject the v12 helper (inject is always safe to repeat)
4. Resume from `BATCH_START` = last confirmed `next_start` before the crash
5. Continue as normal — rows sent before crash are already in the ledger

**Prevention**: After completing each full tab cycle (all 5 tabs), consider opening a new tab proactively to avoid error accumulation beyond ~150.

---

## Token & Context Rules (What Actually Wastes Tokens)

**Expensive — avoid:**
1. **`browser_snapshot` during outreach** — floods context with full DOM tree. ONLY allowed once in Step 1 for the login form.
2. **Passing a `contacted` name Set into the evaluate** — REMOVED. The DOM already tells us via the "Send Proposal" vs "Review Terms" button state. Name-string comparison is brittle and the Set itself bloats the evaluate payload proportional to ledger size.
3. **Returning raw per-card pipe strings** in a large array — use the compact `rows: [{n,e,p}]` shape instead.
4. **Reading the ledger between tabs** to compute a fresh contacted list — not needed under DOM dedup. Write rows after each tab, never read between tabs.
5. **Re-injecting the helper on every tab** — inject ONCE in Step 3; each tab's script self-heals only if the helper is genuinely missing.
6. **Keeping raw evaluate results in context across tabs** — parse, write rows, discard. Only keep counts.

**Cheap — encouraged:**
1. **ONE evaluate per tab** — scan + loop + send all cards in a single script.
2. **ONE Edit per tab** — batch all rows into a single ledger append.
3. **Compact diagnostic object**: `{ total_cards, sent, no_send_proposal, errors_count, skipped_count, rows, error_samples }`.
4. **`no_send_proposal` counter** — tells us exactly how many cards were already in network without needing a name list.
5. **On ANY error**: close modal, increment counter, continue — never abort the loop.
6. **Hard 300 limit** — stop immediately when reached, still generate report.
