---
name: Levanta Ottocast US Affiliate Outreach 05132026
description: Levanta.io affiliate outreach for Ottocast US. Daily 50-invite loop via browser-harness (CDP). Login affiliate@celldigital.co → Ottocast workspace → /seller/partners/discover. Priority: Deal Sites → Publishers → Loyalty Platforms → Media Buyers → Affiliate Networks → Social Influencers. Scrapes intro+name+email per card, sends invitation with Bob Zabel CPAi 20% message, records to Obsidian tracker + ledger, persists progress JSON for daily resume.
tags: [affiliate, levanta, ottocast, us, outreach, automation, daily, cron]
---

# Levanta Ottocast US Affiliate Outreach 05132026

## Overview

Daily outreach loop on `app.levanta.io` for Ottocast US. Sends 50 partnership invitations per run, resumes from where the previous run left off, records data in Obsidian.

## Commands

| Command | Model | Purpose | Tokens / run |
|---------|-------|---------|-------------|
| `/levanta-ottocast-setup` | **Haiku 4.5** | Login + select Ottocast + navigate + inject helper | ~5K |
| `/levanta-ottocast-outreach` | **none (Python)** | Bulk invite loop runs as pure Python via `browser_harness` import — **zero LLM tokens** | 0 |
| `/levanta-ottocast` | Haiku 4.5 → Python | Setup (Haiku, ~5K) → outreach loop (Python, 0 tokens) | ~5K |
| Daily launchd cron | **none (Python)** | `daily-runner.sh` calls `run-outreach.py` directly — never touches Claude | 0 |

**Token budget**: ≤5K/day (only when manual setup is needed). The daily cron is **$0** — pure Python + CDP, no model calls.

## Configuration

| Key | Value |
|-----|-------|
| BRAND | Ottocast |
| REGION | US |
| LOGIN_EMAIL | `affiliate@celldigital.co` |
| LOGIN_PASSWORD | `Celldigital2024*` |
| LOGIN_FALLBACK | Google auth (same address) |
| ACCOUNT | Ottocast (select if multi-workspace) |
| DISCOVER_URL | `https://app.levanta.io/seller/partners/discover` |
| SESSION_LIMIT | 50 invites |
| PROGRESS_JSON | `~/Projects/levanta-ottocast/state/progress.json` |
| TRACKER | `~/Documents/Obsidian/30-Operations/Levanta-Ottocast-US-Affiliate-Outreach-05132026/Tracker.md` |
| LEDGER | `~/Documents/Obsidian/30-Operations/Levanta-Ottocast-US-Affiliate-Outreach-05132026/Ledger.md` |
| RUNLOG | `~/Documents/Obsidian/30-Operations/Levanta-Ottocast-US-Affiliate-Outreach-05132026/RUNLOG.md` |

## Invitation Message (exact)

```
This is Bob Zabel from Ottocast US affiliate team. We are excited to work with you on exclusive 20% CPAi promotion. Please reach out to me affiliate@celldigital.co for CPAi and sample/Content review opportunities. We offer ultra high commission on limited time. Look forward to hear from you.
```

> Per Identity Hard Rule: signature is "Bob Zabel from Ottocast US affiliate team". Never use Barron's name. Inbound contact goes to affiliate@celldigital.co.

## Category Priority

Process in this order. Move to the next category only after the previous one is exhausted (no more uncontacted prospecting cards) or after `SESSION_LIMIT` is reached.

1. **Deal Sites**
2. **Publishers**
3. **Loyalty Platforms**
4. **Media Buyers**
5. **Affiliate Networks**
6. **Social Influencers**

The exact filter labels on Levanta's discover page may differ slightly. Setup phase maps each priority category to the closest UI filter and records the mapping in `state/category_map.json`.

## Browser-Harness Pattern

Use `browser-harness` (CDP control of the user's Chrome). Helpers pre-imported: `new_tab`, `wait_for_load`, `page_info`, `capture_screenshot`, `click_at_xy`, `js`, `cdp`.

### Step 1 — Setup (Sonnet, `/levanta-ottocast-setup`)

```bash
browser-harness -c '
new_tab("https://app.levanta.io/login")
wait_for_load()
print(page_info())
'
```

Verify login state via screenshot. Three login paths:
1. **Already logged in** → URL contains `/seller/` → proceed to account select.
2. **Email/password** → fill `affiliate@celldigital.co` / `Celldigital2024*` → submit → screenshot to verify.
3. **Google SSO** → click "Sign in with Google" → handle OAuth (user may need to approve once).

After login, if multi-workspace prompt appears, select **Ottocast** account.

Navigate to `https://app.levanta.io/seller/partners/discover`. Take screenshot. Identify filter UI for the 6 priority categories. Write mapping to `~/Projects/levanta-ottocast/state/category_map.json`:

```json
{
  "Deal Sites":         { "filter_label": "<as shown in UI>", "filter_selector": "<css or aria>" },
  "Publishers":         { ... },
  ...
}
```

Inject the per-card extraction + invite helper (`window.__lev_invite`) — see § Helper below.

### Step 2 — Outreach Loop (Haiku, `/levanta-ottocast-outreach`)

Read `progress.json`. Determine `current_category` + `cursor`. Apply that category's filter. Run ONE evaluate per page that:

1. Scans `.publisher-card` (or actual selector discovered in setup) for prospecting (not-yet-invited) rows.
2. For each card at `cursor` onward, calls `window.__lev_invite(cardIdx)`:
   - Clicks the card → opens publisher detail panel.
   - Scrapes name, intro/bio, contact email.
   - Clicks "Invite" / "Send invitation".
   - Pastes invitation message.
   - Submits.
   - Closes detail panel.
3. Returns compact JSON: `{ category, total_cards, sent, skipped, errors, rows: [{name, intro, email}], error_samples }`.

After each page evaluate:
- Append `rows` to Tracker.md (no email) AND Ledger.md (with email) in ONE Edit each.
- Update `progress.json`: `category_state[cat].cursor`, `total_invites_sent`, `last_run_*`.
- If `session_total >= 50`: stop.
- Else: try pagination (Load more / next page); if exhausted, mark category `exhausted=true` and advance to next priority category.

### Step 3 — Report (end of run)

Append to `RUNLOG.md`:

```markdown
### Session YYYY-MM-DD HH:MM
- Category sequence: Deal Sites (X) → Publishers (Y) → …
- Sent: N/50
- Errors: E (samples: …)
- Resume next: category=<next>, cursor=<n>
```

## Helper (window.__lev_invite)

Inject during setup. Re-inject on sentinel `ERR_HELPER_MISSING_REINJECT_REQUIRED`.

```js
() => {
  window.__lev_invite = async (cardIdx) => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const cards = document.querySelectorAll('[data-testid="publisher-card"], .publisher-card, [class*="PartnerCard"], [class*="DiscoverCard"]');
    const card = cards[cardIdx];
    if (!card) return `${cardIdx}:no-card||`;

    // --- Already invited? skip ---
    const text = (card.textContent || '').toLowerCase();
    if (text.includes('invited') || text.includes('pending') || text.includes('partnered')) {
      return `${cardIdx}:already||`;
    }

    // --- Click into card ---
    card.click();
    await sleep(2500);

    // --- Scrape name + intro + email from detail panel ---
    const panel = document.querySelector('[role="dialog"], [class*="DrawerContent"], [class*="DetailPanel"], [data-testid*="detail"]') || document.body;
    const grab = (sel) => panel.querySelector(sel)?.textContent?.trim() || '';
    const name = grab('h1, h2, [class*="name"], [class*="title"]') || '';
    const intro = grab('[class*="bio"], [class*="description"], [class*="intro"], p') || '';
    const emailMatch = (panel.textContent || '').match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch?.[0] || '';

    // --- Click Invite/Send Invitation ---
    const inviteBtn = Array.from(panel.querySelectorAll('button,a')).find(b => {
      const t = (b.textContent || '').trim().toLowerCase();
      return t === 'invite' || t === 'send invitation' || t === 'send invite' || t.includes('invite');
    });
    if (!inviteBtn) {
      // close panel
      const closeBtn = panel.querySelector('[aria-label*="close" i], button[class*="close" i]');
      if (closeBtn) closeBtn.click();
      return `${cardIdx}:no-invite-btn|${name}|${email}`;
    }
    inviteBtn.click();
    await sleep(1500);

    // --- Find message textarea ---
    const ta = document.querySelector('textarea, [contenteditable="true"]');
    if (ta) {
      const msg = "This is Bob Zabel from Ottocast US affiliate team. We are excited to work with you on exclusive 20% CPAi promotion. Please reach out to me affiliate@celldigital.co for CPAi and sample/Content review opportunities. We offer ultra high commission on limited time. Look forward to hear from you.";
      if (ta.tagName === 'TEXTAREA') {
        const ns = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        ns.call(ta, msg);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        ta.focus();
        ta.textContent = msg;
        ta.dispatchEvent(new InputEvent('input', { bubbles: true, data: msg }));
      }
    }
    await sleep(500);

    // --- Submit ---
    const submit = Array.from(document.querySelectorAll('button')).find(b => {
      const t = (b.textContent || '').trim().toLowerCase();
      return t === 'send' || t === 'send invitation' || t === 'submit' || t === 'confirm';
    });
    if (!submit) {
      return `${cardIdx}:no-submit|${name}|${email}`;
    }
    submit.click();
    await sleep(2500);

    // --- Close any confirmation/modal ---
    const closers = Array.from(document.querySelectorAll('button')).filter(b => {
      const al = (b.getAttribute('aria-label') || '').toLowerCase();
      const tx = (b.textContent || '').trim().toLowerCase();
      return al.includes('close') || tx === '×' || tx === 'done' || tx === 'ok';
    });
    for (const c of closers) { c.click(); await sleep(200); }

    return `OK|${name}|${email}|${intro.slice(0, 200).replace(/\|/g,' ').replace(/\n/g,' ')}`;
  };
  return 'lev helper v1 injected';
}
```

### Per-page evaluate (token-efficient)

```js
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const SESSION_REMAINING = /* injected by caller, default 50 */ 50;

  if (typeof window.__lev_invite === 'undefined') return 'ERR_HELPER_MISSING_REINJECT_REQUIRED';

  // Load more
  const loadMore = Array.from(document.querySelectorAll('button,a')).find(b => /load more|show more|next/i.test((b.textContent||'').trim()));
  if (loadMore) { loadMore.click(); await sleep(2500); }

  const cards = document.querySelectorAll('[data-testid="publisher-card"], .publisher-card, [class*="PartnerCard"], [class*="DiscoverCard"]');
  let sent = 0, skipped = 0, errors = 0;
  const rows = [], error_samples = [];

  for (let i = 0; i < cards.length; i++) {
    if (sent >= SESSION_REMAINING) break;
    try {
      const r = await window.__lev_invite(i);
      if (typeof r === 'string' && r.startsWith('OK|')) {
        const parts = r.split('|');
        rows.push({ n: parts[1] || '', e: parts[2] || '', i: parts[3] || '' });
        sent++;
      } else {
        skipped++;
        if (error_samples.length < 5) error_samples.push(String(r).slice(0, 80));
      }
    } catch (e) {
      errors++;
      if (error_samples.length < 5) error_samples.push(`${i}:${(e.message||'').slice(0,60)}`);
    }
    await sleep(800);
  }

  return JSON.stringify({ total_cards: cards.length, sent, skipped, errors, rows, error_samples });
}
```

## Token Rules

- ONE evaluate per page. Parse, write, discard.
- Never pass arrays of names/emails INTO the evaluate. The DOM ("Invited" / "Pending" badge) is the source of truth.
- Never `browser_snapshot` during the loop — coordinates + helpers only.
- Per-page: ONE Edit on Tracker.md, ONE Edit on Ledger.md, ONE write to progress.json.

## Resume Protocol

Every run begins by reading `progress.json`:

1. `category_priority[current_category_index]` = active category.
2. Apply that filter on `/seller/partners/discover`.
3. Scroll to `category_state[cat].cursor` (or rely on Levanta's own state if cards are sorted stably).
4. Resume invite loop until 50 sent OR category exhausted.
5. If category exhausted before 50 sent → advance `current_category_index`, reset cursor, continue.
6. On stop, persist `category_state[cat].cursor`, `total_invites_sent`, `last_run_date`, `last_run_sent`.

## Daily Scheduled Task

A launchd job (`com.celldigital.levanta-ottocast.plist`) triggers `/levanta-ottocast` daily at 09:30 local time. See `~/Library/LaunchAgents/com.celldigital.levanta-ottocast.plist`.

## Privacy / Identity Rules

- Outbound message signature: "Bob Zabel from Ottocast US affiliate team".
- Inbound contact: `affiliate@celldigital.co`.
- Ledger.md (emails) is private; Tracker.md (no emails) may be shared.
- Never expose `barronzuo@gmail.com` anywhere external.

## Known Unknowns (resolve in first setup run)

- Exact DOM selectors for `.publisher-card` and detail panel.
- Whether each category appears as a filter chip, dropdown, or tab.
- Whether the invitation form is in a modal vs. side panel.
- Whether Levanta enforces a daily invite cap (mark `category.exhausted=true` if "limit reached" surfaces).

First setup run captures all of these via screenshot + DOM inspection and writes the resolved selectors to `state/category_map.json` + helper update.
