---
description: "Impact TCL US login + filter setup (Sonnet). Run before /impact-tcl-us-outreach. Usage: /impact-tcl-us-setup"
model: sonnet
---

## MODEL GATE — MANDATORY FIRST CHECK
This command REQUIRES model: **sonnet**. If you are running on Opus, STOP: "⛔ Wrong model. Run `/model sonnet` then re-run `/impact-tcl-us-setup`." Do NOT proceed on Opus.

## MCP SERVER — MANDATORY
All browser tool calls MUST use `mcp__playwright-impact-tcl-us__*` exclusively.
Profile: `~/.claude/browser-profiles/impact-tcl-us` — port 9305.
NEVER use `mcp__playwright__`, `mcp__playwright-impact__`, or any other namespace — concurrent workflows will collide.

## Step 0: Isolation + Supervisor (MANDATORY — run first)

### 0a. Initialize workflow isolation
```
bash ~/.claude/scripts/outreach/init-workflow.sh impact-tcl-us playwright-impact-tcl-us 9305
```
If exit code 2, STOP and show the printed JSON for `~/.claude.json`.

### 0b. Spawn Opus supervisor (background)
Call Agent with `subagent_type: general-purpose`, `model: opus`, `run_in_background: true`. Load prompt from `~/.claude/skills/_shared/outreach-supervisor-prompt.md` with bindings:
- workflow: `impact-tcl-us`
- target_total: (from $ARGUMENTS or default 2000)
- ledger_path: `/Volumes/workssd/ObsidianVault/01-Projects/Impact-TCL-US-Outreach-Ledger.md`
- checkpoint_path: `/tmp/outreach-impact-tcl-us-checkpoint.json`
- mcp_namespace: `mcp__playwright-impact-tcl-us__`

Record the returned agent id/name — the outreach command pings it every 10 proposals.

## Step 1: Login
1. `mcp__playwright-impact-tcl-us__browser_navigate` to `https://app.impact.com`
2. `browser_snapshot` ONCE for login form
3. Fill email `affiliate@celldigital.co` and password `Celldigital2024*` via `browser_evaluate`
4. Click Sign In. If Google account chooser appears, click "Cell Affiliate Team affiliate@celldigital.co" then "Continue"
5. Wait for dashboard to load

## Step 2: Navigate to Discover (Content/Reviews tab)
```
browser_navigate → https://app.impact.com/secure/advertiser/discover/radius/fr/partner_discover.ihtml?page=marketplace&slideout_id_type=partner#businessModels=home&locationCountryCode=US&sortBy=reachRating&sortOrder=DESC
```
Wait 3s, then click the "Content / Reviews" tab button (do NOT navigate by URL — the app redirects tab hashes to home on fresh load).

## Step 3: Apply All Filters in One evaluate

```js
// browser_evaluate — apply Status, Partner Size, Categories, Promotional Areas
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clickOpts = async (btnText, opts) => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === btnText);
    if (!btn) return `no ${btnText}`;
    btn.click(); await sleep(1000);
    for (const opt of opts) {
      const el = Array.from(document.querySelectorAll('li, label, [class*="option"], [class*="item"]')).find(e => e.textContent.trim() === opt || e.textContent.trim().includes(opt));
      if (el) { el.click(); await sleep(300); }
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(400);
  };
  await clickOpts('Status', ['Active', 'New']);
  await clickOpts('Partner Size', ['Medium', 'Large', 'Extra Large']);
  await clickOpts('Categories', ['Consumer Electronics', 'Computers & Electronics', 'Mobile Services & Telecommunications', 'Movie & TV', 'Gaming']);
  await clickOpts('Promotional Areas', ['United States']);
  return 'filters applied';
}
```

## Step 4: Verify Cards Ready

After filters load, verify card count. No helper injection needed — outreach uses `browser_run_code` with `page.mouse.click()` for term selection (evaluate-only clicks don't trigger React events inside the proposal iframe).

```js
// browser_evaluate — verify cards
() => {
  const cards = document.querySelectorAll('.discovery-card');
  const sendBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.trim() === 'Send Proposal');
  return `${cards.length} cards, ${sendBtns.length} Send Proposal btns`;
}
```

Report: "Impact TCL US Setup complete. {N} publishers on Content/Reviews tab. Run `/impact-tcl-us-outreach` to start."
