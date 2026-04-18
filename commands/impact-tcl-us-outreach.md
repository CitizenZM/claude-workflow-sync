---
description: "Impact TCL US proposal sending (Haiku). Run /impact-tcl-us-setup first.
  Usage: /impact-tcl-us-outreach [count]
  Default: /impact-tcl-us-outreach 500"
model: haiku
---

## MODEL GATE — MANDATORY FIRST CHECK
This command REQUIRES model: **haiku**. Before doing ANY work, check your current model. If you are running on Opus or Sonnet, STOP IMMEDIATELY and tell the user: "⛔ Wrong model. This command requires Haiku. Run `/model haiku` then re-run `/impact-tcl-us-outreach`." Do NOT proceed on the wrong model — it wastes 10-20x credits for identical work.

## BROWSER MCP: playwright-impact (port 3102)
ALL browser tool calls MUST use the `playwright-impact` MCP server.
Tool prefix: `mcp__playwright-impact__` (e.g., `mcp__playwright-impact__browser_navigate`, `mcp__playwright-impact__browser_snapshot`, `mcp__playwright-impact__browser_evaluate`).
Do NOT use the default `playwright` or any other playwright server — each workflow has its own isolated browser.

program_id=48321 | count=500 | target_per_page=20
login: affiliate@celldigital.co / Celldigital2024*
scripts: ~/.claude/skills/impact-tcl-us-outreach/scripts/
ledger: /Volumes/workssd/ObsidianVault/01-Projects/Impact-TCL-US-Outreach-Ledger.md
report: /Volumes/workssd/ObsidianVault/01-Projects/Impact-TCL-US-Outreach-Report-2026-04-16.md
template_term: TCL US Standard Publisher Terms (5%)
contract_date: 2026-04-16
msg: "Welcome! TCL is a global top-NO.1 TV brand and one of the fastest-growing names in smartphones, tablets, and smart home. Our program on Impact (Program ID: 48321) offers a 5% commission, CPAi upto 10% on all sales, dedicated affiliate manager support, a full creative library, product data feeds, and exclusive promotional offers for our partners."

## Step 0: Browser Check (START HERE)
`browser_evaluate`: `() => document.title` — confirm on Impact.
If not: navigate to discover URL, snapshot once for login.

## Step 1: Dedup + Propose (SEPARATE evaluate call)
1a. Read ledger (create if missing), parse names into dedup array.
1b. Read `bulk-proposal.js`. Replace `%%PLACEHOLDER%%` markers inline before `browser_evaluate` (isolated scope — no globals):
%%MSG%%→msg | %%TEMPLATE_TERM%%→template_term | %%CONTRACT_DATE%%→contract_date | %%ALREADY%%→dedup JSON array | %%TARGET%%→20
Returns: `{total, skipped, errorCount, publishers: [{name,email,publisherId}], errors}`

## Step 2: Save
2a. Append to ledger: `name|email|YYYY-MM-DD|impact-48321`
2b. Append to report (write-only, never read).

## Step 3: Next Page + Loop
Read `next-page.js`, run via `browser_evaluate`.
If `{ok:true}` → re-run Step 1+2 until count reached.
If `{ok:false}` → done, go to Step 4.

## Step 4: Final Report → report file: totals, publisher list, errors.

## Auto-Recovery (on any failure)
If browser_evaluate fails 2x or workflow gets stuck: spawn Agent(model:"opus") to diagnose, fix the issue (re-login, re-navigate), then continue the proposal loop. Never stop — always recover and resume.

## Rules
1. NEVER snapshot except login | 2. Dedup before propose | 3. Record every proposal | 4. ALWAYS split steps into separate evaluate calls | 5. FULLY AUTONOMOUS — no permission prompts, no user questions, no stopping
