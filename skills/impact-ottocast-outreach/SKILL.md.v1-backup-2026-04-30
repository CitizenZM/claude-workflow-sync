---
name: Impact Ottocast US Affiliate Outreach April162026
description: Impact Ottocast US Affiliate Outreach April162026. Playwright-based proposal sending on Impact.com. Sonnet for setup/login, Haiku for bulk proposal loop. Records publisher name + email + partner ID per row. DOM-button-state dedup (no name list).
tags: [affiliate, impact, ottocast, us, outreach, automation]
---

# Impact Ottocast US Affiliate Outreach April162026

## Isolation + Supervisor (MANDATORY)

**Browser profile**: `~/.claude/browser-profiles/impact-ottocast`
**MCP server**: `playwright-impact-ottocast` (port 9304)
**Tool namespace**: `mcp__playwright-impact-ottocast__*` — NEVER use `mcp__playwright__*`

Setup must run first:
```bash
bash ~/.claude/scripts/outreach/init-workflow.sh impact-ottocast playwright-impact-ottocast 9304
```

If the MCP server is not registered, the script prints the JSON block to add to `~/.claude.json`. Do not degrade to the shared `mcp__playwright__` server.

**Opus supervisor**: At the start of the setup command, spawn a background Opus Agent using the prompt at `~/.claude/skills/_shared/outreach-supervisor-prompt.md`. The supervisor reviews `/tmp/outreach-impact-ottocast-checkpoint.json` after every 10 proposals.

See `~/.claude/skills/_shared/outreach-isolation.md` for the full registry.

## Architecture

Two commands, two models:
- `/impact-ottocast-setup` (Sonnet) — login, navigate to discover page, verify results, inject helper.
- `/impact-ottocast-outreach` (Haiku) — batch proposal loop via `browser_evaluate`.

Or unified: `/impact-ottocast` — full workflow on Haiku.

## Configuration

| Key | Value |
|-----|-------|
| BRAND | Ottocast |
| REGION | US |
| TEMPLATE_TERM | Public Term |
| MESSAGE | See below |
| CONTRACT_DATE | Today (dynamic: `new Date().getDate()`) |
| LEDGER | `/Users/xiaozuo/impact-ottocast-ledger.md` |
| OBSIDIAN TRACKER | `/Volumes/workssd/ObsidianVault/06-Publishers/impact-ottocast-tracker.md` |
| SESSION LIMIT | 300 proposals |

## Proposal Message

```
This is Bob Zabel from Ottocast US affiliate team. We are excited to work with you on Amazon affiliate promotion. We will offer 10+10%CPAi commission and additional sample/Content review opportunities. We offer ultra high commission for dedicated publishers with a full creative library, product data feeds, and exclusive promotional offers for our partners.
```

## Tab Strategy

Start URL hash: `#businessModels=CONTENT_REVIEWS&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC`

Change tabs by setting `window.location.hash` directly. Filters persist within session; helper persists across hash changes (SPA navigation).

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
- **"Review Terms" button = already in network → skip (DOM-state dedup, no name list)**

## Deduplication Strategy (v4 — REVISED)

**The rule: trust the DOM.**

Impact's marketplace renders a different button per card based on the relationship state:
- `Send Proposal` → prospecting publisher, we can pitch them
- `Review Terms` → already in our network, do not pitch again
- (neither / other) → non-actionable card, skip

The per-tab loop simply checks `btns.includes('Send Proposal')`. If false, increment `no_send_proposal` and skip. **No name-list cross-check.**

**Why we removed the `contacted` Set:**
- Name matching is brittle: whitespace, encoding, truncation, or trailing status badges all break equality
- The Set scaled linearly with ledger size — every tab had to re-read the ledger and paste names into the evaluate payload
- It was redundant with the DOM state — Impact ALREADY hides "Send Proposal" for publishers we've contacted
- It did nothing for true in-session duplicates (same publisher across two tabs) — the DOM handles that too, because once a proposal is sent the card's button state changes

**Remaining dedup source of truth**: the ledger file at `/Users/xiaozuo/impact-ottocast-ledger.md`. It is append-only. Duplicates across sessions are prevented by Impact's own state (next session's DOM will show "Review Terms" on those cards).

## Token-Efficient Pattern (ONE evaluate per tab)

### Step 1 — Inject helper once (done in /impact-ottocast-setup)

```js
() => {
  window.__otto_fill = async (cardIdx) => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const cards = document.querySelectorAll('.discovery-card');
    const card = cards[cardIdx];
    if (!card) return `${cardIdx}:no-card||`;

    const name = card.querySelector('[class*="name"]')?.textContent.trim() || String(cardIdx);
    let publisherEmail = '', publisherName = name, partnerId = '';

    // Step A: Fetch publisher profile page to extract email + partner ID
    const profileLink = card.querySelector('a[href*="partner_profile"], a[href*="partnerProfile"], a[href*="partner-profile"]');
    if (profileLink?.href) {
      try {
        const pidMatch = profileLink.href.match(/[?&]p=(\d+)/);
        if (pidMatch) partnerId = pidMatch[1];
        const resp = await fetch(profileLink.href, { credentials: 'include' });
        const html = await resp.text();
        const emailMatch = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
        publisherEmail = emailMatch?.[0] || '';
      } catch(_) {}
    }

    // Step B: Click Send Proposal
    const btn = Array.from(card.querySelectorAll('button')).find(b => b.textContent.trim() === 'Send Proposal');
    if (!btn) return `${cardIdx}:skip||${name}`;
    btn.style.display = 'inline-block'; btn.click();
    await sleep(3500);

    const iframe = document.querySelector('iframe[src*="send-proposal"], iframe[src*="proposal"]');
    if (!iframe) return `${cardIdx}:no-iframe|${name}|`;

    // Fallback: extract from iframe.src if profile fetch didn't yield results
    try {
      const u = new URL(iframe.src);
      if (!publisherEmail) publisherEmail = u.searchParams.get('email') || '';
      publisherName = u.searchParams.get('name') || name;
      if (!partnerId) partnerId = u.searchParams.get('p') || '';
    } catch(_) {}

    const doc = iframe.contentDocument;
    let t = 0; while (doc.readyState !== 'complete' && t < 12) { await sleep(500); t++; }

    // ── Term Selection v17 — inner div target + full PointerEvent chain ─────────
    // v9-v14 bug: querySelectorAll('li') picks time-picker digit LIs (always in DOM, never new)
    // v15-v16 bug: [role="option"] click fires on outer LI wrapper — Vue component listens
    //              on inner div, so click is ignored
    // v17 fix: target [data-testid="uicl-select-item"] inner div (Vue component target),
    //          dispatch full PointerEvent chain, verify by termTrigger.textContent change
    const PLACEHOLDER_RX = /^(select|请选择|选择|选择条款|--|-|choose|placeholder)?$/i;
    const isVisible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };

    const allIuiBtns = Array.from(doc.querySelectorAll('button')).filter(b =>
      (b.className||'').includes('iui-multi-select-input-button')
    );
    const termTrigger = allIuiBtns[0];

    const termAlreadySet = termTrigger && termTrigger.textContent.trim() !== 'Select' && !PLACEHOLDER_RX.test(termTrigger.textContent.trim());
    let termOk = termAlreadySet;

    if (!termOk && termTrigger) {
      for (let attempt = 0; attempt < 3; attempt++) {
        termTrigger.click();
        await sleep(1000);

        let selectItems = Array.from(doc.querySelectorAll('[data-testid="uicl-select-item"]')).filter(isVisible);
        const publicItem = selectItems.find(el => {
          const t = (el.textContent||'').trim();
          return t.includes('公开条款') || t.toLowerCase().includes('public');
        }) || selectItems.find(el => {
          const t = (el.textContent||'').trim();
          return t && !PLACEHOLDER_RX.test(t);
        });

        if (publicItem) {
          const rect = publicItem.getBoundingClientRect();
          const evtInit = { bubbles: true, cancelable: true, view: doc.defaultView, clientX: rect.left + 10, clientY: rect.top + 10 };
          ['pointerover','mouseover','pointerdown','mousedown','pointerup','mouseup','click'].forEach(type => {
            publicItem.dispatchEvent(new PointerEvent(type, evtInit));
          });
          await sleep(800);
          const newText = (termTrigger.textContent||'').trim();
          if (newText && newText !== 'Select' && !PLACEHOLDER_RX.test(newText)) {
            termOk = true;
            break;
          }
        }
        await sleep(400);
      }
    }

    if (!termOk) return `${cardIdx}:no-term-confirmed|${publisherName}|${publisherEmail}`;
    // ── end term selection v17 ──────────────────────────────────────────────────

    // Step D: Date picker
    const db = doc.querySelector('button[class*="input-wrap"]');
    if (db) {
      db.click(); await sleep(900);
      const today = new Date().getDate().toString();
      const cp = Array.from(doc.body.querySelectorAll('div')).find(d =>
        window.getComputedStyle(d).position === 'fixed' && d.innerText?.includes(new Date().getFullYear().toString())
      );
      if (cp) { const day = Array.from(cp.querySelectorAll('td,button,span')).find(c => c.textContent.trim() === today); if (day) { day.click(); await sleep(500); } }
    }

    // Step E: Message
    const ta = doc.querySelector('textarea');
    if (ta) {
      const msg = "This is Bob Zabel from Ottocast US affiliate team. We are excited to work with you on Amazon affiliate promotion. We will offer 10+10%CPAi commission and additional sample/Content review opportunities. We offer ultra high commission for dedicated publishers with a full creative library, product data feeds, and exclusive promotional offers for our partners.";
      const ns = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      ns.call(ta, msg); ta.dispatchEvent(new Event('input',{bubbles:true})); ta.dispatchEvent(new Event('change',{bubbles:true}));
    }
    await sleep(400);

    // Step F: Submit
    const sub = Array.from(doc.querySelectorAll('button')).find(b => b.textContent.trim() === 'Send Proposal');
    if (!sub) return `${cardIdx}:no-submit|${publisherName}|${publisherEmail}`;
    sub.style.display = 'inline-block'; sub.click();
    await sleep(2500);

    const confirm = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'I understand')
      || Array.from(doc.querySelectorAll('button')).find(b => b.textContent.trim() === 'I understand');
    if (confirm) { confirm.click(); await sleep(600); }
    const closers = Array.from(document.querySelectorAll('button')).filter(b =>
      b.getAttribute('aria-label')?.toLowerCase().includes('close') || b.className?.toLowerCase().includes('close') ||
      b.textContent.trim() === '×' || b.textContent.trim() === '✕'
    );
    for (const c of closers) { c.click(); await sleep(200); }

    return `OK|${publisherName}|${publisherEmail}|${partnerId}`;
  };
  return 'otto helper v17 injected';
}
```

### Step 2 — Per-tab: self-heal + pagination + scan + send in ONE evaluate

```js
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const SESSION_REMAINING = 300; // ← UPDATE before each tab (300 - sent_so_far)

  // --- Self-heal: re-inject helper if missing ---
  if (typeof window.__otto_fill === 'undefined') {
    return 'ERR_HELPER_MISSING_REINJECT_REQUIRED';
  }

  // --- Pagination: try to load more cards once ---
  const loadMore = Array.from(document.querySelectorAll('button,a')).find(b => {
    const t = (b.textContent || '').trim().toLowerCase();
    return t === 'load more' || t === 'show more' || t.includes('load more');
  });
  if (loadMore) { loadMore.click(); await sleep(2500); }

  const cards = document.querySelectorAll('.discovery-card');
  const total_cards = cards.length;

  let sent = 0;
  let no_send_proposal = 0;
  let errors_count = 0;
  let skipped_count = 0;
  const rows = [];           // [{n, e, p}] — written straight to ledger
  const error_samples = [];  // first 5 non-OK return strings for diagnosis

  for (let i = 0; i < total_cards; i++) {
    if (sent >= SESSION_REMAINING) { skipped_count++; break; }

    const btns = Array.from(cards[i].querySelectorAll('button')).map(b => b.textContent.trim());
    if (!btns.includes('Send Proposal')) { no_send_proposal++; continue; }

    try {
      const r = await window.__otto_fill(i);
      if (typeof r === 'string' && r.startsWith('OK|')) {
        const parts = r.split('|');
        rows.push({ n: parts[1] || '', e: parts[2] || '', p: parts[3] || '' });
        sent++;
      } else {
        skipped_count++;
        if (error_samples.length < 5) error_samples.push(String(r).slice(0, 80));
      }
    } catch(e) {
      const cb = document.querySelector('button[aria-label="close"], button[aria-label="Close"]');
      if (cb) cb.click();
      errors_count++;
      if (error_samples.length < 5) error_samples.push(`${i}:${(e.message||'').slice(0,60)}`);
    }
    await sleep(500);
  }

  return JSON.stringify({
    total_cards,
    sent,
    no_send_proposal,
    errors_count,
    skipped_count,
    rows,
    error_samples
  });
}
```

### Step 3 — After each tab: write, discard, advance

1. Parse the JSON. Log `Tab N: total=X, sent=Y, already_in_network=Z, errors=E`.
2. **If the result is the sentinel string `ERR_HELPER_MISSING_REINJECT_REQUIRED`**: re-run the helper inject evaluate, then re-run this tab.
3. **Write `rows` straight to the ledger** in a single Edit call. Schema: `| {n} | {e} | {p} | {today} |`.
4. **Append `rows`** to the Obsidian tracker in a single Edit call.
5. **Discard** the JSON payload from working memory. Keep only counts + running `session_total`.
6. If `session_total >= 300`: stop iteration, go to report phase.
7. Set `window.location.hash = <next tab hash>`, wait 3s, continue.

## Email Extraction (v5 — revised April 2026)

Email is extracted via **two-tier approach**:

**Tier 1 (preferred)**: Fetch the publisher's profile page *before* opening the proposal modal.
The card contains a profile link (`a[href*="partner_profile"]`). Fetch that URL with `credentials: 'include'`, parse the HTML, and extract the first email address via regex. Also extracts `partnerId` from the URL `?p=` param.

```js
const profileLink = card.querySelector('a[href*="partner_profile"], a[href*="partnerProfile"], a[href*="partner-profile"]');
if (profileLink?.href) {
  const pidMatch = profileLink.href.match(/[?&]p=(\d+)/);
  if (pidMatch) partnerId = pidMatch[1];
  const resp = await fetch(profileLink.href, { credentials: 'include' });
  const html = await resp.text();
  const emailMatch = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  publisherEmail = emailMatch?.[0] || '';
}
```

**Tier 2 (fallback)**: If profile fetch yields no email, fall back to `iframe.src` URL params after the modal opens:
```
iframe.src → ?email=contact@publisher.com&name=Contact+Name&p=398844
```

Return format: `OK|publisherName|publisherEmail|partnerId`

**Ledger schema**: `| Publisher Name | Email | Partner ID | Date Contacted |`

## Ledger Format

File: `/Users/xiaozuo/impact-ottocast-ledger.md`

```markdown
| Publisher Name | Email | Partner ID | Date Contacted |
|---|---|---|---|
| Example Publisher | contact@publisher.com | 398844 | 2026-04-16 |
```

The ledger is an internal artifact and may contain emails. Per global feedback rule (`feedback_publisher_email_privacy.md`), **do NOT export emails to external Word/PDF/HTML reports**. The Obsidian tracker and console summary should only list publisher name + tab + date; mask or omit emails.

## Diagnostic Reporting (NEW in v4)

Each per-tab evaluate returns a structured diagnostic object. This directly answers the question "why did tab 1 only send 22 of 50?":

| Field | Meaning |
|-------|---------|
| `total_cards` | How many `.discovery-card` nodes existed (after pagination click) |
| `sent` | Proposals successfully submitted on this tab |
| `no_send_proposal` | Cards skipped because they showed "Review Terms" or no actionable button — i.e. already in network |
| `errors_count` | Cards that threw during `__otto_fill` (modal closed + counter incremented) |
| `skipped_count` | Cards where `__otto_fill` returned a non-OK string (no-iframe, no-Select, no-portal, no-term, no-submit, LIMIT_REACHED, etc.) |
| `rows` | Array of `{n, e, p}` for newly-sent proposals — written straight to ledger |
| `error_samples` | First 5 non-OK return strings, for post-run diagnosis without flooding context |

Invariant: `total_cards == sent + no_send_proposal + errors_count + skipped_count` (±1 for the early-break LIMIT_REACHED increment).

## Token Rules (v4 — updated from session 2026-04-16 learnings)

**These waste tokens — avoid:**

1. **`browser_snapshot` during outreach** — floods context with full DOM tree. ONLY allowed for the login form in Step 1 of setup.
2. **Passing a `contacted` name Set** into the per-tab evaluate — removed entirely. DOM button state is the source of truth.
3. **Reading the ledger between tabs** to recompute a contacted list — unnecessary under DOM dedup. Write after each tab; never read between tabs.
4. **Returning raw per-card pipe strings** — use the compact `rows: [{n,e,p}]` + counters shape.
5. **Re-injecting the helper before every tab** — inject ONCE in setup. Each tab's script self-heals only on sentinel.
6. **Holding raw evaluate results across tabs** — parse, write, discard. Only keep counts.
7. **Running multi-step confirmation dialogs between tabs** — autonomous mode; no "proceed?" prompts.

**These are cheap / encouraged:**

1. **ONE evaluate per tab** — scan + loop + send all cards in a single script.
2. **ONE Edit per tab** — batch all rows into a single ledger append.
3. **Compact diagnostic object**: `{ total_cards, sent, no_send_proposal, errors_count, skipped_count, rows, error_samples }`.
4. **`no_send_proposal` counter** — tells us how many cards were already in network, no name list needed.
5. **On ANY error**: close modal, increment counter, continue — never abort the loop.
6. **Hard 300 limit** — stop immediately when reached, still generate report.
7. **Self-heal on sentinel only** — cheap `typeof` check on helper per tab, re-inject only when truly missing.

## Known Limitations (captured 2026-04-16 session)

These are issues we have accepted or consciously deferred. Document here so they do not get rediscovered.

1. **Tab 1 throughput cap (22 / 50 observed)** — when the filter view has many cards that are already in our network, the `sent` count is much lower than `total_cards`. This is **not a bug**; the diagnostic `no_send_proposal` field now makes this visible. Expected behavior on mature accounts.

2. **Pagination is best-effort** — we attempt ONE "Load More" click per tab. Impact.com may have virtualized pagination that doesn't respond to a single click; we do not loop the click. Acceptable trade-off vs. infinite scroll complexity.

3. **Helper loss on full-page navigation** — `window.__otto_fill` is lost if the session redirects (e.g., SSO re-auth, session expiry). Mitigation: each tab's evaluate returns `ERR_HELPER_MISSING_REINJECT_REQUIRED` as a sentinel so the orchestrator can re-inject and re-run. Hash-based tab switches do NOT lose the helper.

4. **User permission denial aborts a tab** — if the user denies `browser_evaluate` mid-run (as happened on Tab 2 Deal/Coupons in the 2026-04-16 session), that tab's entire batch is lost. No auto-recovery; the orchestrator should surface the denial clearly and stop, not silently skip.

5. **No in-session duplicate prevention across tabs for the same publisher** — if the same publisher appears on two different tab filters, we will attempt the second one. In practice Impact updates the button state after the first send, so the second attempt shows "Review Terms" and falls into `no_send_proposal`. Acceptable.

6. **Term selection hard-codes "Public Term"** — if the advertiser's term library doesn't have a Public Term, the helper returns `no-term(<available terms>)` and the card is skipped. Not auto-resolvable; update the term name in the helper if Ottocast's terms change.

7. **Date picker targets today by `new Date().getDate()`** — if the sessions straddles midnight UTC vs local, the calendar may show a different month. Low-risk given session length (<30 min).

8. **`error_samples` is capped at 5** — deeper diagnosis requires running with a smaller batch or logging to a file instead. Intentional context-cost trade-off.

9. **The ledger is append-only, never deduplicated** — if you manually re-run a tab after writing its rows, you'll get duplicate rows in the ledger. Impact itself won't re-send (button state flips), so this is a cosmetic issue. Clean the ledger manually if needed.

## Opus Checkpoint Protocol

Opus supervises every 10 proposals. Checkpoint rules:

- If `skipped_count / (sent + skipped_count) > 0.8` AND `error_samples` contain `no-term-confirmed`: STOP, re-inject v17 helper, and re-run batch before continuing
- If `ERR_HELPER_MISSING_REINJECT_REQUIRED` sentinel returned: re-inject helper and re-run the tab
- If 3+ consecutive tabs return sent=0 with non-zero total_cards: STOP and surface as architectural issue (per global 3-fix rule)
- If helper version string reported by setup is < v17: force re-inject before resuming loop

## Session History

- **2026-04-16 (v3 → v4)** — Root cause analysis of idle-spinning session. Identified: (a) `contacted` Set was bloating evaluate payloads and was redundant with DOM button state, (b) no diagnostic reporting made low sent-count appear as a bug when it was actually "already in network" cards, (c) full pipe-string returns flooded context, (d) no self-heal on helper loss. Upgraded to v4: DOM-only dedup, compact diagnostic object with `no_send_proposal` counter, self-healing helper check, pagination attempt, `rows: [{n,e,p}]` write-straight-to-ledger shape.

- **2026-04-17 (v4 → v5b)** — Two user-reported issues fixed: (a) email: v5 now fetches the publisher profile page (`a[href*="partner_profile"]`) before clicking Send Proposal, extracts email via regex from HTML, uses iframe.src params only as fallback — confirmed working (e.g. `jjones@forbes.com`); (b) term selection: root cause identified — the open dropdown is a **direct `doc.body` child** with `position:fixed` and class `iui-dropdown`, NOT found by scanning all body descendants. Fix: `Array.from(doc.body.children).find(c => position==='fixed' && cls.includes('iui-dropdown'))`, then click the matching `li` inside it. Confirmed: "clicked: Public Term". Old portal search (`querySelectorAll('div,ul')`) was iterating 200+ elements and timing out before the fixed child was added.

- **2026-04-20 (v5b → v15)** — Live DOM inspection revealed term selection was skipped entirely on every publisher. Root cause: the `termAlreadySet` heuristic matched Button[12] ("another Template Term" — the continuation-clause field, a different input) via a `/term/i` text regex, returning `true` and bypassing the main Template Term trigger at Button[0]. Secondary bug: after clicking the trigger, the LI fallback selected "0" from the always-mounted time-picker (digits 0–9, 00–07) instead of a real term option. Fix: (a) scope `termAlreadySet` to the FIRST `iui-multi-select-input-button` only — if its text is still "Select", the term is not set regardless of any other button on the modal; (b) filter LI candidates through `DIGIT_ONLY_RX` and `NOISE_RX` (AM/PM/Ongoing/Cancel/Select/Clear/0/00) with a lisBefore/lisAfter diff to prefer freshly-rendered options; (c) confirm success by re-reading `termTrigger.textContent` after clicking the LI and retry up to 3 times; (d) return `no-term-confirmed` sentinel on failure so the supervisor can detect batch-wide breakage. Added Opus Checkpoint rule: skipped/(sent+skipped) > 0.8 with `no-term-confirmed` in samples → stop + re-inject v15.

- **2026-04-20 (v15/v16 → v17)** — Term selection still broken despite v15 scoping fix. Root cause discovered via live browser inspection: the term dropdown's LI has this structure — `<li role="option"><div data-testid="uicl-select-item">...<div class="text-ellipsis">公开条款</div></div></li>`. v9–v14 clicked `querySelectorAll('li')` matches but picked always-mounted time-picker digit LIs (0–9, 00–07). v15 scoped the trigger correctly but still clicked the outer LI or `[role="option"]`; **the Vue component registers its click listener on the inner `[data-testid="uicl-select-item"]` div, so clicks on the wrapper LI were silently ignored**. v17 fix: (a) target `[data-testid="uicl-select-item"]` inner div directly as the click target; (b) dispatch the full PointerEvent chain `pointerover → mouseover → pointerdown → mousedown → pointerup → mouseup → click` with real `clientX`/`clientY` computed from `getBoundingClientRect()` — Vue's synthetic event system demands the complete sequence to register a "real" click; (c) verify success by checking `termTrigger.textContent.trim() !== 'Select'` after dispatch; retry up to 3 times. **Confirmed working in live browser session.** Version string → `'otto helper v17 injected'`. Helper-version gate in Opus Checkpoint raised from v15 to v17.
