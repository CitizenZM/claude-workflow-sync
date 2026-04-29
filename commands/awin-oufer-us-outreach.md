---
description: "Awin Oufer US bulk invite (Haiku). Run /awin-oufer-us-setup first."
model: haiku
---

## Pre-flight (autonomous — aborts, never prompts)
- Model: **haiku** only. If Opus/Sonnet → print `⛔ Wrong model — run /model haiku then re-run /awin-oufer-us-outreach` and exit.
- MCP: `mcp__playwright-awin-oufer-us__*` exclusively (profile `~/.claude/browser-profiles/awin-oufer-us`, port 9303). Fallback to generic `mcp__playwright__*` = forbidden.
- Supervisor: provided by `/awin-oufer-us-setup`. If missing this session, spawn via `~/.claude/skills/_shared/outreach-supervisor-prompt.md` before Step 0. Full contract: `~/.claude/skills/_shared/outreach-isolation.md`.
- Checkpoint `/tmp/outreach-awin-oufer-us-checkpoint.json`: every 10 confirmed invites → batch-write ledger+report → write checkpoint with full scraped rows (`name|email|type|partnerships|publisherId`) + `error_samples` + `local_signal` → message supervisor → apply verdict autonomously (continue | pause=apply fix+retry once | halt=write reason+exit). Print a non-blocking 2-line status (10 names+emails). Never wait for user input.

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

## Step 3: Batch Save (ONE Edit per page — never per-row)
3a. Build the full rows block from `publishers[]` in memory, then append all rows in a SINGLE Edit to `ledger` as `name|email|YYYY-MM-DD|91941`.
3b. Append the same rows in a SINGLE Edit to `report` (write-only, never read).
3c. Every 10 cumulative invites: write checkpoint with `{batch_n, total_so_far, page, rows, error_samples, local_signal}` → message supervisor → apply verdict autonomously.

## Step 4: Reload, re-run Step 1+2 until count reached.

## Step 5: Final Report → report file: totals, publisher list, errors.

## Auto-Recovery (on any failure)
If browser_evaluate fails 2x or workflow gets stuck: write the current state to the checkpoint file (with `local_signal: "DEGRADED"` + `error_samples`) and request a verdict from the background supervisor spawned by `/awin-oufer-us-setup`. Apply the supervisor's `fix` once, then resume the invite loop. Do NOT spawn a second Opus agent — the supervisor is already running.

## Rules
1. NEVER snapshot except login | 2. Dedup before invite | 3. Record every invite | 4. Sort desc before inviting | 5. ALWAYS split setup+invite into separate evaluate calls | 6. FULLY AUTONOMOUS — no permission prompts, no user questions, no stopping
