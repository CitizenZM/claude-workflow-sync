---
description: "Awin Oufer US bulk invite (Haiku). Run /awin-oufer-us-setup first."
model: haiku
---

## MODEL GATE — MANDATORY FIRST CHECK
This command REQUIRES model: **haiku**. Before doing ANY work, check your current model. If you are running on Opus or Sonnet, STOP IMMEDIATELY and tell the user: "⛔ Wrong model. This command requires Haiku. Run `/model haiku` then re-run `/awin-oufer-us-outreach`." Do NOT proceed on the wrong model — it wastes 10-20x credits for identical work.

## BROWSER MCP: playwright-awin (port 3100)
ALL browser tool calls MUST use the `playwright-awin` MCP server.
Tool prefix: `mcp__playwright-awin__` (e.g., `mcp__playwright-awin__browser_navigate`, `mcp__playwright-awin__browser_snapshot`, `mcp__playwright-awin__browser_evaluate`).
Do NOT use the default `playwright` or any other playwright server — each workflow has its own isolated browser.

merchant_id=91941 | filters=25,15,22 | count=500 | commission=20.0 | min_partnerships=50 | target_per_page=25
login: affiliate@celldigital.co / Celldigital2024*
scripts: ~/.claude/skills/awin-oufer-us-outreach/scripts/
ledger: /Volumes/workssd/ObsidianVault/01-Projects/Awin-Oufer-US-Outreach-Ledger.md
report: /Volumes/workssd/ObsidianVault/01-Projects/Awin-Oufer-US-Outreach-Report-2026-04-15.md
msg: "Hi, this is Bob Zabel, reaching out from Oufer Body Jewelry, the NO.1 Piercing Body Jewelry you MUST see. We are offering 10-20% ultra high commission with limited time deal offer, Reply here or to affiliate@celldigital.co to chat in details and get the sample. REPLY now for limited time offer."

## Step 0: Browser Check (START HERE)
`browser_evaluate`: `() => document.title` — confirm on Awin.
If not: navigate to `https://ui.awin.com/awin/merchant/91941/affiliate-directory/index/tab/notInvited`, snapshot once for login.

## Step 1: Setup (SEPARATE evaluate call)
40/page (wait 6s) + sort desc (click, wait 4s, verify first row>=50, click again if needed).

## Step 2: Dedup + Invite (SEPARATE evaluate call)
2a. Read ledger (create if missing), parse names into dedup array.
2b. Read `bulk-invite.js`. Replace `%%PLACEHOLDER%%` markers inline before `browser_evaluate` (isolated scope — no globals):
%%MSG%%→msg | %%COMM%%→"20.0" | %%ALREADY%%→dedup JSON array | %%TARGET%%→25 | %%MIN_PARTNERSHIPS%%→50
Returns: `{total, skippedLowQuality, publishers: [{name,type,partnerships,publisherId}]}`
If skippedLowQuality>0 on first batch → sort failed, reload+re-sort.

## Step 3: Save
3a. Append to ledger: `name|email|YYYY-MM-DD|91941`
3b. Append to report (write-only, never read).

## Step 4: Reload, re-run Step 1+2 until count reached.

## Step 5: Final Report → report file: totals, publisher list, errors.

## Auto-Recovery (on any failure)
If browser_evaluate fails 2x or workflow gets stuck: spawn Agent(model:"opus") to diagnose, fix the issue (re-login, re-navigate, re-sort), then continue the invite loop. Never stop — always recover and resume.

## Rules
1. NEVER snapshot except login | 2. Dedup before invite | 3. Record every invite | 4. Sort desc before inviting | 5. ALWAYS split setup+invite into separate evaluate calls | 6. FULLY AUTONOMOUS — no permission prompts, no user questions, no stopping
