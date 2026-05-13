---
description: "Impact TCL US proposal sending (Haiku). Run /impact-tcl-us-setup first.
  Usage: /impact-tcl-us-outreach [count]
  Default: /impact-tcl-us-outreach 500"
model: haiku
---

## Pre-flight (autonomous — aborts, never prompts)
- Model: **haiku** only. If Opus/Sonnet → print `⛔ Wrong model — run /model haiku then re-run /impact-tcl-us-outreach` and exit.
- MCP: `mcp__playwright-impact-tcl-us__*` exclusively (profile `~/.claude/browser-profiles/impact-tcl-us`, port 9305). Fallback to generic `mcp__playwright__*` = forbidden.
- Supervisor: provided by `/impact-tcl-us-setup`. If missing this session, spawn via `~/.claude/skills/_shared/outreach-supervisor-prompt.md` before Step 0. Full contract: `~/.claude/skills/_shared/outreach-isolation.md`.
- Checkpoint `/tmp/outreach-impact-tcl-us-checkpoint.json`: every 10 confirmed proposals → batch-write ledger+report → write checkpoint with full scraped rows (`name, email, termVerified, termText, dateVerified`) + `errorCount` + `error_samples` + `local_signal` → message supervisor → apply verdict autonomously (continue | pause=apply fix+retry once | halt=write reason+exit). Print a non-blocking 2-line status (10 names+emails). Never wait for user input.

program_id=48321 | count=500 | target_per_page=20
login: affiliate@celldigital.co / Celldigital2024*
scripts: ~/.claude/skills/impact-tcl-us-outreach/scripts/
ledger: /Volumes/workssd/ObsidianVault/01-Projects/Impact-TCL-US-Outreach-Ledger.md
report: /Volumes/workssd/ObsidianVault/01-Projects/Impact-TCL-US-Outreach-Report-2026-04-19.md
obsidian_workflow: /Volumes/workssd/ObsidianVault/01-Projects/Impact-TCL-US-Outreach.md
template_term: TCL US Standard Term 8%
contract_date: DYNAMIC — always use tomorrow's date. Calculate at runtime: `new Date(Date.now()+86400000).toISOString().slice(0,10)` (e.g. if today is 2026-04-20, use 2026-04-21)
msg: "Welcome! TCL is a global top-NO.1 TV brand and one of the fastest-growing names in smartphones, tablets, and smart home. Our program on Impact (Program ID: 48321) offers an 8% CPA commission on all sales, dedicated affiliate manager support, a full creative library, product data feeds, and exclusive promotional offers for our partners. REPLY for limited time offer!"

## Step 0: Browser Check (START HERE)
`mcp__playwright-impact-tcl-us__browser_evaluate`: `() => document.title` — confirm on Impact.
If not: navigate to discover URL, snapshot once for login.

## Step 1: Dedup + Propose (browser_run_code — NOT browser_evaluate)

**CRITICAL**: Use `browser_run_code` (not `browser_evaluate`) — the script uses `page.mouse.click()` for term selection which requires `page` access. Evaluate-only clicks do NOT trigger React state in the proposal iframe.

1a. Read ledger (create if missing), parse names into dedup array.

1b. Calculate CONTRACT_DATE dynamically: `new Date(Date.now()+86400000).toISOString().slice(0,10)`

1c. Determine DISCOVER_URL — the current page URL including hash filters (e.g. `https://app.impact.com/secure/advertiser/discover/radius/fr/partner_discover.ihtml?page=marketplace&slideout_id_type=partner#businessModels=CONTENT_REVIEWS&locationCountryCode=US&sortBy=reachRating&sortOrder=DESC`). Get it via `browser_evaluate: () => location.href`.

1d. Read `bulk-proposal.js`. Replace `%%PLACEHOLDER%%` markers inline, then call `browser_run_code` with the modified code string (filename NOT used — pass code directly):
  - `%%MSG%%` → msg
  - `%%CONTRACT_DATE%%` → CONTRACT_DATE
  - `%%ALREADY%%` → `JSON.stringify(dedup array from ledger)`
  - `%%TARGET%%` → 20
  - `%%DISCOVER_URL%%` → current discover page URL

Returns: `{total, errorCount, publishers: [{name, email, termVerified, termText, dateVerified}], errors}`

## Step 1e: Term + Date Verification (CRITICAL)
After each proposal form opens, the script verifies before submitting:
- **Term selected**: confirms rendered term value contains "Standard" and NOT "coupon/cashback". termVerified=true in result means correct term was clicked via page.mouse.click().
- **Contract date**: confirms date field shows tomorrow's date (CONTRACT_DATE). dateVerified=true means calendar day was clicked.
- If termVerified=false for any publisher, do NOT log as success — log as error and diagnose.

## Step 2: Batch Save (ONE Edit per page — never per-row)
2a. Build the full rows block from `publishers[]` in memory, then append all rows in a SINGLE Edit to `ledger` as `name|email|YYYY-MM-DD|impact-48321`.
   - Email field is REQUIRED — write `email_missing` if not found, never leave blank.
2b. Append the same rows in a SINGLE Edit to `report`: `Publisher Name | Email | Date | Status | Term Verified | Date Verified` (write-only, never read).
2c. Every 10 cumulative proposals: write checkpoint with `{batch_n, total, errorCount, rows (with termVerified + dateVerified), error_samples, local_signal}` → message supervisor → apply verdict autonomously.

## Step 3: Next Page + Loop
Read `next-page.js`, run via `mcp__playwright-impact-tcl-us__browser_evaluate`.
If `{ok:true}` → re-run Step 1+2 until count reached. (Supervisor verdict already gates continuation per the shared contract above.)
If `{ok:false}` → done, go to Step 4.

## Step 4: Final Report + Obsidian Sync
4a. Write final report to `report` path: totals, full publisher list with emails, errors, term_verified rate, date_verified rate.
4b. **Obsidian Workflow Sync**: Read `obsidian_workflow` file. Append or update a `## Session YYYY-MM-DD` section:
```
## Session [DATE]
- Proposals sent: [N]
- Publishers contacted: [N]
- Emails captured: [N] / [N] (rate)
- Term verified: [N]% | Date verified: [N]%
- Errors: [errorCount]
- Top publishers: [list top 5 by name]
```
5c. **Ledger sync**: Verify ledger at `ledger` path has all new rows. Confirm row count matches `total` sent this session.

## Auto-Recovery (on any failure)
If browser_run_code fails 2x or workflow gets stuck: write the current state to the checkpoint file (with `local_signal: "DEGRADED"` + `error_samples`) and request a verdict from the background supervisor spawned by `/impact-tcl-us-setup`. Apply the supervisor's `fix` once, then resume the proposal loop. Do NOT spawn a second Opus agent — the supervisor is already running.

## Rules
1. NEVER snapshot except login | 2. Dedup before propose | 3. Record every proposal WITH email | 4. ALWAYS use browser_run_code (NOT browser_evaluate) for proposals | 5. FULLY AUTONOMOUS — no permission prompts, no user questions, no stopping | 6. Supervisor (shared contract) verdicts gate continuation every 10 proposals | 7. Always use tomorrow's date for contract_date | 8. Verify term AND date before each submit | 9. termVerified must be true — wrong term = do not count as success
