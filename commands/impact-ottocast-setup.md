---
description: "Impact Ottocast US Affiliate Outreach April162026 — setup (Sonnet). Login + navigate + inject helper. Run before /impact-ottocast-outreach."
model: sonnet
---

## MODEL GATE
This command runs on **Sonnet** (auto-assigned). Handles login edge cases and SSO.
After this command completes, outreach switches to **Haiku** automatically via `/impact-ottocast-outreach`.

## MCP SERVER — MANDATORY
All browser tool calls MUST use `mcp__playwright-impact-ottocast__*` exclusively.
Profile: `~/.claude/browser-profiles/impact-ottocast` — port 9304.
NEVER use `mcp__playwright__`, `mcp__playwright-impact__`, or any other namespace — concurrent workflows will collide.

## Step 0: Isolation + Supervisor (MANDATORY — run first)

### 0a. Initialize workflow isolation
```
bash ~/.claude/scripts/outreach/init-workflow.sh impact-ottocast playwright-impact-ottocast 9304
```
If exit code 2, STOP and show the printed JSON for `~/.claude.json`.

### 0b. Spawn Opus supervisor (background)
Call Agent with `subagent_type: general-purpose`, `model: opus`, `run_in_background: true`. Load prompt from `~/.claude/skills/_shared/outreach-supervisor-prompt.md` with bindings:
- workflow: `impact-ottocast`
- target_total: (from $ARGUMENTS or default 2000)
- ledger_path: `/Users/xiaozuo/impact-ottocast-ledger.md`
- checkpoint_path: `/tmp/outreach-impact-ottocast-checkpoint.json`
- mcp_namespace: `mcp__playwright-impact-ottocast__`

## Step 1: Login
1. `browser_navigate` to `https://app.impact.com`
2. `browser_snapshot` ONCE for login form (the ONLY snapshot allowed in the entire workflow)
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
4. If Google account chooser appears → click "Cell Affiliate Team affiliate@celldigital.co" listitem → wait for redirect to any Impact dashboard page

## Step 2: Switch to Ottocast Amazon Account (program 49590 under CARTIZAN CORPORATION 6924145)
After landing on any Impact dashboard page, switch to the correct account via the shadow DOM account switcher:

```js
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  
  // Helper to search shadow DOM
  function findInShadow(root, sel, depth = 0) {
    if (depth > 8) return null;
    const el = root.querySelector(sel);
    if (el) return el;
    let found = null;
    root.querySelectorAll('*').forEach(e => {
      if (e.shadowRoot && !found) found = findInShadow(e.shadowRoot, sel, depth+1);
    });
    return found;
  }
  
  // Step A: Open the account switcher dropdown
  const btn = findInShadow(document, '[class*="nav-account-btn"]');
  if (!btn) return 'ERR: account switcher button not found';
  btn.click();
  await sleep(1500);
  
  // Step B: Click CARTIZAN CORPORATION (account 6924145)
  const cartizanEl = findInShadow(document, '[data-testid="acctswitcher-account-6924145"]');
  if (!cartizanEl) return 'ERR: CARTIZAN account not found in switcher';
  cartizanEl.click();
  await sleep(1500);
  
  // Step C: Click Ottocast-Amazon seller-USA (program 49590)
  const ottoProg = findInShadow(document, '[data-testid="acctswitcher-program-49590"]');
  if (!ottoProg) return 'ERR: Ottocast program 49590 not found';
  ottoProg.click();
  await sleep(3000);
  
  return 'switched to Ottocast-Amazon seller-USA (49590) under CARTIZAN CORPORATION (6924145)';
}
```

Wait for page to reload. Verify top-left header shows "Ottocast-Amazon Seller" before proceeding.

## Step 3: Navigate to Discover
```
browser_navigate → https://app.impact.com/secure/advertiser/discover/radius/fr/partner_discover.ihtml?page=marketplace&slideout_id_type=partner#businessModels=CONTENT_REVIEWS&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC
```
Wait 3s.

## Step 4: Inject Helper (canonical `window.__otto_fill` — v9)

**v9 changes vs v8**:
- **Trigger-tracking term selection**: the proposal modal contains multiple custom dropdowns (time pickers for hours/minutes/AM-PM) that are ALWAYS rendered as positioned `iui-list` ULs in the DOM even when "closed" — v8's `isTermConfirmed()` always found an "open dropdown" and returned false. v9 instead tracks the term trigger button's text directly. The first `Select` button in the DOM is the Template Term trigger; after picking an option, verify the trigger text is no longer `Select`.
- **Language-agnostic option match**: prefers LIs containing `公开条款` or `Public Term`/`Public`, falls back to first non-placeholder LI.
- Submit-confirmed gate unchanged from v8.

```js
() => {
  window.__otto_fill = async (cardIdx) => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const cards = document.querySelectorAll('.discovery-card');
    const card = cards[cardIdx];
    if (!card) return `${cardIdx}:no-card||`;

    const name = card.querySelector('[class*="name"]')?.textContent.trim() || String(cardIdx);
    let publisherEmail = '', publisherName = name, partnerId = '';

    // Step A: Fetch publisher detail page to extract email + partner ID
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

    // Step B: Click Send Proposal
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

    // ── Term Selection (v9 — trigger-tracking approach) ──────────────
    // The modal has time-picker ULs always in the DOM.
    // Instead of checking for "open dropdown", track the trigger button's text.
    const PLACEHOLDER_RX = /^(select|请选择|选择|选择条款|--|-|choose|placeholder)?$/i;

    const allSelectBtns = Array.from(doc.querySelectorAll('button')).filter(b => b.textContent.trim() === 'Select');
    // First "Select" button = Template Term trigger
    const termTrigger = allSelectBtns[0];

    let termOk = false;

    if (termTrigger) {
      for (let attempt = 0; attempt < 3; attempt++) {
        termTrigger.click();
        await sleep(1500);

        // Find the term LI — look for 公开条款 or "Public" in any visible LI
        const lis = Array.from(doc.querySelectorAll('li'));
        const termLi = lis.find(li => {
          const t = li.textContent?.trim() || '';
          return t.includes('公开条款') || t.toLowerCase().includes('public term') || t.toLowerCase().includes('public');
        }) || lis.find(li => {
          const t = li.textContent?.trim() || '';
          return t !== '' && !PLACEHOLDER_RX.test(t);
        });

        if (termLi) {
          termLi.click();
          await sleep(800);
          // Verify: trigger button should no longer say "Select"
          const newText = termTrigger.textContent?.trim() || '';
          if (newText !== '' && newText !== 'Select' && !PLACEHOLDER_RX.test(newText)) {
            termOk = true;
            break;
          }
        }
        await sleep(500);
      }
    }

    if (!termOk) {
      // Cancel and skip
      const cancel = Array.from(doc.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancel');
      if (cancel) { cancel.click(); await sleep(500); }
      const closers = Array.from(document.querySelectorAll('button')).filter(b =>
        b.getAttribute('aria-label')?.toLowerCase().includes('close') || b.textContent.trim() === '×' || b.textContent.trim() === '✕'
      );
      for (const c of closers) { c.click(); await sleep(200); }
      return `${cardIdx}:no-term-confirmed|${publisherName}|${publisherEmail}`;
    }
    // ── end term selection ──────────────────────────────────────────

    // Step D: Date picker v12 — select TOMORROW (confirmed working via live DOM test)
    // Calendar found via class-hint (/calendar|datepicker|picker/i). Start date = buttonWraps[0] (first BUTTON.input-wrap).
    const MONTHS_D = ['January','February','March','April','May','June','July','August','September','October','November','December'];
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

    // Step E: Message
    const ta = doc.querySelector('textarea');
    if (ta) {
      const msg = "This is Bob Zabel from Ottocast US affiliate team. We are excited to work with you on Amazon affiliate promotion. We will offer 10+10%CPAi commission and additional sample/Content review opportunities. We offer ultra high commission for dedicated publishers with a full creative library, product data feeds, and exclusive promotional offers for our partners.";
      const ns = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      ns.call(ta, msg); ta.dispatchEvent(new Event('input',{bubbles:true})); ta.dispatchEvent(new Event('change',{bubbles:true}));
    }
    await sleep(400);

    // ───────── Step F: Submit (v8 — with SUBMIT CONFIRMATION GATE) ─────────
    const sub = Array.from(doc.querySelectorAll('button')).find(b => b.textContent.trim() === 'Send Proposal');
    if (!sub) return `${cardIdx}:no-submit|${publisherName}|${publisherEmail}`;
    // Record pre-submit state for later comparison
    const iframeStillThere = () => !!document.querySelector('iframe[src*="send-proposal"], iframe[src*="proposal"]');
    sub.style.display = 'inline-block'; sub.click();
    await sleep(1500);

    // Confirm "I understand" popup (if shown)
    const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'I understand')
      || Array.from(doc.querySelectorAll('button')).find(b => b.textContent.trim() === 'I understand');
    if (confirmBtn) { confirmBtn.click(); await sleep(800); }

    // Poll for confirmation signals (up to 6s)
    const SUCCESS_RX = /(proposal\s+sent|successfully|sent successfully|成功|已发送|发送成功|invitation sent)/i;
    const ERROR_RX = /(required|please select|missing|error|invalid|失败|必填|请选择)/i;
    let confirmed = false, errorSeen = false, elapsed = 0;
    while (elapsed < 6000) {
      await sleep(500); elapsed += 500;
      // Signal 1: toast / banner in main doc
      const toastText = Array.from(document.querySelectorAll('[class*="toast"], [class*="notification"], [class*="banner"], [role="status"], [role="alert"]'))
        .map(e => (e.textContent||'').trim()).join(' | ');
      if (SUCCESS_RX.test(toastText)) { confirmed = true; break; }
      if (ERROR_RX.test(toastText)) { errorSeen = true; break; }
      // Signal 2: iframe disappeared (modal closed by successful submit)
      if (!iframeStillThere()) { confirmed = true; break; }
      // Signal 3: toast inside iframe (for some locales)
      try {
        const innerToast = Array.from(doc.querySelectorAll('[class*="toast"], [class*="notification"], [role="status"], [role="alert"]'))
          .map(e => (e.textContent||'').trim()).join(' | ');
        if (SUCCESS_RX.test(innerToast)) { confirmed = true; break; }
        if (ERROR_RX.test(innerToast)) { errorSeen = true; break; }
      } catch(_) {}
    }

    // Best-effort close (only if still open)
    const closers = Array.from(document.querySelectorAll('button')).filter(b =>
      b.getAttribute('aria-label')?.toLowerCase().includes('close') || b.className?.toLowerCase().includes('close') ||
      b.textContent.trim() === '×' || b.textContent.trim() === '✕'
    );
    for (const c of closers) { c.click(); await sleep(200); }

    if (errorSeen) return `${cardIdx}:submit-error|${publisherName}|${publisherEmail}`;
    if (!confirmed) return `${cardIdx}:submit-not-confirmed|${publisherName}|${publisherEmail}`;
    return `OK|${publisherName}|${publisherEmail}|${partnerId}`;
  };
  return 'otto helper v9 injected';
}
```

## Step 5: Verify
```js
() => {
  const cards = document.querySelectorAll('.discovery-card');
  return `${cards.length} cards, helper=${typeof window.__otto_fill}`;
}
```

Expected: `"25 cards, helper=function"` (or higher if pagination had already loaded).

If the helper is ever lost later (e.g. after a login redirect or a full page load), the per-tab evaluate script self-heals by returning `ERR_HELPER_MISSING_REINJECT_REQUIRED`; in that case re-run this step and re-run the tab.

## Step 5.1: Programmatic Account Gate (replaces human "verify top-left" instruction)
**REQUIRED before proceeding to outreach.** Run this — the outreach phase MUST see program 49590 and nothing else:
```js
() => {
  const ck = (document.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('IR_activeProgramId=')||c.startsWith('activeProgramId='))||'').split('=')[1] || '';
  const urlId = (location.href.match(/[?&#](?:programId|activeProgramId|p)=(\d+)/i)||[])[1] || '';
  const activeId = ck || urlId || 'unknown';
  return activeId === '49590' ? 'GATE_OK:49590' : `GATE_FAIL:active=${activeId}`;
}
```
**Must return `GATE_OK:49590`.** If it returns `GATE_FAIL:active=47964` or anything else, DO NOT proceed — re-run Step 2 (account switcher) first.

## AUTO-PROCEED
Setup is complete. **Do NOT wait for user input.** Immediately continue with the outreach phase:
- Model switches to **Haiku** for outreach (run `/impact-ottocast-outreach` OR proceed inline if already running in a unified session)
- Report: "✓ Setup complete — {N} cards on Content/Reviews. Switching to Haiku outreach phase..."
- If this command was invoked standalone, tell user: "Run `/impact-ottocast-outreach` to start (Haiku auto-assigned)."
- If this command was invoked as part of `/impact-ottocast`, continue directly to Phase 2.
