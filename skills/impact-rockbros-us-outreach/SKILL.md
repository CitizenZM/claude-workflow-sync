---
name: impact-rockbros-us-affiliate-outreach
description: Impact Rockbros USA Affiliate Outreach. Playwright browser_run_code with page.mouse.click() for term selection (evaluate clicks don't trigger React in iframe). Sonnet for setup/login, Haiku for bulk proposal loop. Opus supervises every 10 proposals. Records publisher name + email per row. Syncs to Obsidian on completion.
tags: [affiliate, impact, rockbros, us, outreach, automation, playwright]
---

# Impact Rockbros USA Affiliate Outreach

## Isolation + Supervisor (MANDATORY)

**Browser profile**: `~/.claude/browser-profiles/impact-rockbros-us`
**MCP server**: `playwright-impact-rockbros-us` (port 9306)
**Tool namespace**: `mcp__playwright-impact-rockbros-us__*` — NEVER use `mcp__playwright__*`

Setup must run first:
```bash
bash ~/.claude/scripts/outreach/init-workflow.sh impact-rockbros-us playwright-impact-rockbros-us 9306
```

If the MCP server is not registered, the script prints the JSON block to add to `~/.claude.json`. Do not degrade to the shared `mcp__playwright__` server.

**Opus supervisor**: At the start of the setup command, spawn a background Opus Agent using the prompt at `~/.claude/skills/_shared/outreach-supervisor-prompt.md`. The supervisor reviews `/tmp/outreach-impact-rockbros-us-checkpoint.json` after every 10 proposals.

See `~/.claude/skills/_shared/outreach-isolation.md` for the full registry.

## Architecture

Two commands, two models + Opus supervisor:
- `/impact-rockbros-us-setup` (Sonnet) — login, navigate to discover page, set filters, verify card count.
- `/impact-rockbros-us-outreach` (Haiku) — batch proposal loop via `browser_run_code` (NOT evaluate).
- Opus Agent — spawned every 10 proposals to diagnose failures and verify quality.

**Browser**: `mcp__playwright-impact-rockbros-us__*` — dedicated port 9306, profile `~/.claude/browser-profiles/impact-rockbros-us`

## Configuration

| Key | Value |
|-----|-------|
| PROGRAM_ID | `50132` |
| BRAND | Rockbros |
| REGION | US |
| TEMPLATE_TERM | Rockbros USA Performance |
| LEDGER | `/Volumes/workssd/ObsidianVault/01-Projects/Impact-Rockbros-US-Outreach-Ledger.md` |
| REPORT | `/Volumes/workssd/ObsidianVault/01-Projects/Impact-Rockbros-US-Outreach-Report-[DATE].md` |
| OBSIDIAN_WORKFLOW | `/Volumes/workssd/ObsidianVault/01-Projects/Impact-Rockbros-US-Outreach.md` |
| CONTRACT_DATE | Dynamic: `new Date(Date.now()+86400000).toISOString().slice(0,10)` (always tomorrow) |
| MSG | "Hi, this is Bob Zabel, reaching out from Rockbros, the NO.1 sports accessory you must see. We are offering 10–20% ultra-high commission with a limited-time deal offer. Reply here or email affiliate@celldigital.co to chat in detail and get a sample." |

## Required Filters (set during /impact-rockbros-us-setup)

### Status
- **Active** + **New**

### Partner Size
- **Medium**, **Large**, **Extra Large**

### Categories
- Sports
- Health & Fitness
- Outdoors & Nature
- Consumer Electronics
- Cycling

### Promotional Areas
- **United States**

### Location
- Country: **US** (`locationCountryCode=US` in hash)

### Sort Strategy
- **Primary**: `sortBy=reachRating&sortOrder=DESC`
- **Fallback**: `sortBy=epc&sortOrder=DESC` — when reachRating pool exhausted

### Business Model Tab Order + Confirmed Hash Values

| Tab | Hash Value (confirmed working) |
|-----|-------------------------------|
| Content / Reviews | `CONTENT_REVIEWS` |
| Deal / Coupons | `DEAL_COUPON` |
| Email / Newsletter | `EMAIL_NEWSLETTER` |
| Loyalty / Rewards | `LOYALTY_REWARDS` |
| Network | `NETWORK` |
| All Partners | click "All Partners" button (hash becomes `all`) |

Navigate by setting `window.location.hash` directly. Filters persist across tab changes within the session.

## Publisher Data to Capture

For each publisher, capture and log to ledger:
- **Name**: `card.querySelector('[class*="name"]')?.textContent.trim()`
- **Email**: `card.querySelector('[href^="mailto:"]')?.href?.replace('mailto:','') || 'email_missing'`

Log immediately after all cards on a tab are processed.

## Proposal Form Architecture (CRITICAL)

The "Send Proposal" flow uses an **iframe**, NOT a modal in the main document:
1. Clicking "Send Proposal" opens `iframe[src*="send-proposal"]`
2. ALL form elements live inside the iframe — access via `page.frames().find(f => f.url().includes('send-proposal'))`
3. The term dropdown `li[role="option"]` elements are **always in the DOM** (even when dropdown is closed) — use `getBoundingClientRect()` to find visible ones

### Why `browser_run_code` is Required (NOT `browser_evaluate`)

React synthetic event system inside iframes does NOT respond to:
- `element.click()` from evaluate
- `new iframe.contentWindow.MouseEvent(...)`
- Native Playwright `propFrame.locator().click()`

**Only `page.mouse.click(absX, absY)` triggers React state correctly.** This requires `page` access, which only `browser_run_code` provides.

### Absolute Coordinate Formula

```js
const iRect = await page.evaluate(() => {
  const iframe = document.querySelector('iframe[src*="send-proposal"], iframe[src*="proposal"]');
  const r = iframe.getBoundingClientRect();
  return { x: r.x, y: r.y };
});

const liCoords = await propFrame.evaluate(() => {
  const li = ...; // find the target li
  const r = li.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});

await page.mouse.click(Math.round(iRect.x + liCoords.x), Math.round(iRect.y + liCoords.y));
```

### Term Selection (CRITICAL)

Target term: **Rockbros USA Performance** (the highest-commission term available)

Selection logic — pick the term containing the highest commission rate (10–20%):
```js
// Open dropdown
await propFrame.evaluate(() => {
  const trigger = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Select');
  if (trigger) trigger.click();
});
await sleep(1200);

// Find the best available term (highest commission, prefer "Performance" or highest %)
const liCoords = await propFrame.evaluate(() => {
  const isVis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const opts = Array.from(document.querySelectorAll('li[role="option"]')).filter(isVis);
  // Prefer "Performance" term; fallback to highest % number visible
  const perf = opts.find(l => l.textContent.toLowerCase().includes('performance'));
  const best = perf || opts.find(l => /\d+%/.test(l.textContent)) || opts[1];
  if (!best) return null;
  const r = best.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: best.textContent.trim() };
}).catch(() => null);

await page.mouse.click(Math.round(iRect.x + liCoords.x), Math.round(iRect.y + liCoords.y));
```

### "I Understand" Nav-Catch Pattern

Clicking "I understand" in the proposal iframe causes **full page navigation** to the "Proposals Sent" page. This is the success signal:

```js
let proposalSent = false;
try {
  await propFrame.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'I understand');
    if (btn) btn.click();
  });
  await sleep(2500);
  const gone = await page.evaluate(() => !document.querySelector('iframe[src*="send-proposal"], iframe[src*="proposal"]'));
  proposalSent = gone;
} catch (_navError) {
  proposalSent = true;
  await sleep(1500);
  await page.goto(DISCOVER_URL).catch(() => {});
  await sleep(3000);
}
```

### Card Lookup Robustness

After each navigation+reload, re-query cards **by name** (not index):
```js
cards = await page.evaluate(() =>
  Array.from(document.querySelectorAll('.discovery-card')).map((c, idx) => ({
    i: idx, name: c.querySelector('[class*="name"]')?.textContent.trim() || `card_${idx}`,
    hasBtn: Array.from(c.querySelectorAll('button')).some(b => b.textContent.trim() === 'Send Proposal')
  }))
);
const freshCard = cards.find(c => c.name === name);
```

## Critical Architecture: a11y-Tree-Only DOM

**Confirmed via live DOM exploration (2026-04-29):** The slideout panel renders exclusively in Playwright's accessibility tree. All standard DOM access returns nothing:
- `document.querySelectorAll('*')` — ❌ cannot find slideout content
- Shadow DOM piercing — ❌ slideout is not in any shadow root
- `window.frames` / iframes — ❌ all iframes are empty/cross-origin blocked
- `getBoundingClientRect()` — ❌ elements return off-screen coordinates

**Only `page.locator()`, `page.getByText()`, `page.getByRole()` work** because they target the a11y tree directly. This is why `browser_run_code` is mandatory — it provides `page` with full Playwright locator API.

### Confirmed Slideout Content Map
```
Properties tab (default):
  Header: partner_id (7-digit number), status chip, size chip, business_model chip
  Description: large text block (~200-500 chars)
  Contacts section: contact_name (First Last), contact_role ("Marketplace Contact"), contact_email
  Personal information: language (table row)
  Promotional areas: list or "No promotional areas"
  Corporate address: "City, STATE United States of America"
  Content Categories: chips or "No Categories"
  Legacy Categories: chip list with "+N more" overflow button
  Tags: chip list with "+N more" overflow button
  Media Kits: PDF links via page.getByRole('link').filter({hasText:/\.pdf/i})
  Currency: "USD" / "EUR" text
  Partner ID: same as header number

Details tab (click to activate):
  Website: external link (https://...) — e.g. https://voyagertribe.com/
  "Learn more" text label near website link
  Social property cards: each has link + auth status
  Verified / "Not verified" status badge
```

## Bulk Proposal Script

Script location: `/Users/xiaozuo/.claude/skills/impact-rockbros-us-outreach/scripts/bulk-proposal.js`

Run via `mcp__playwright-impact-rockbros-us__browser_run_code` (NOT evaluate). Placeholders replaced before execution:

| Placeholder | Value |
|-------------|-------|
| `%%DISCOVER_URL%%` | Full discover page URL with hash filters |
| `%%MSG%%` | Proposal message text |
| `%%CONTRACT_DATE%%` | Tomorrow's date (calculated at runtime) |
| `%%ALREADY%%` | `JSON.stringify(dedup array from ledger)` |
| `%%TARGET%%` | Number of proposals to send (e.g. 20) |

Returns: `{total, errorCount, publishers: [{name, email, termVerified, termText, dateVerified}], errors}`

## Ledger Format

File: `/Volumes/workssd/ObsidianVault/01-Projects/Impact-Rockbros-US-Outreach-Ledger.md`

```
publisher_name|email|date|impact-50132
```

- Pipe-delimited, no header row
- Append new rows after each batch via single Edit call
- `email_missing` if email not found — never leave blank

## Opus Supervisor Pattern

Every 10 proposals, spawn:
```js
Agent({
  subagent_type: "general-purpose",
  model: "opus",
  prompt: "Supervise last 10 Impact Rockbros US proposals. Results: [batch_results]. Check: term_verified rate (should be 100%), date_verified rate, error patterns. Return PASS or DIAGNOSE with fix. Max 5 sentences."
})
```
- PASS → continue loop
- DIAGNOSE → apply fix, retry up to 2x, then surface to user

## Obsidian Sync (on workflow complete)

Append to `/Volumes/workssd/ObsidianVault/01-Projects/Impact-Rockbros-US-Outreach.md`:
```markdown
## Session [YYYY-MM-DD]
- Proposals sent: N | Emails captured: N/N | Term verified: N% | Date verified: N%
- Errors: N | Top publishers: [name1, name2, name3]
```

## Token Rules

1. **NEVER `browser_snapshot`** during outreach phase — zero exceptions
2. **Use `browser_run_code`** for proposals — never `browser_evaluate` (no `page` access)
3. **ONE `browser_run_code` call per batch** — process up to TARGET cards per call
4. **ONE Edit per batch** — append all new ledger rows in a single file edit
5. **Contract date always = tomorrow** — never hardcode; calculate at runtime
6. **Term verification is mandatory** — termVerified must be true before logging success
