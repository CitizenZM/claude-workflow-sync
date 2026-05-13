---
description: "Awin Rockbros EU bulk invite (Haiku). Run /awin-rockbros-eu-setup first."
model: haiku
---

## Pre-flight (autonomous — aborts, never prompts)
- Model: **haiku** only. If Opus/Sonnet → print `⛔ Wrong model — run /model haiku then re-run /awin-rockbros-eu-outreach` and exit.
- MCP: `mcp__playwright-awin-rockbros-eu__*` exclusively (profile `~/.claude/browser-profiles/awin-rockbros-eu`, port 9302). Fallback to generic `mcp__playwright__*` = forbidden.
- Supervisor: provided by `/awin-rockbros-eu-setup`. If missing this session, spawn via `~/.claude/skills/_shared/outreach-supervisor-prompt.md` before Step 0. Full contract: `~/.claude/skills/_shared/outreach-isolation.md`.
- Checkpoint `/tmp/outreach-awin-rockbros-eu-checkpoint.json`: every 10 confirmed invites → batch-write ledger+report → write checkpoint with full scraped rows (`name|email|type|partnerships|publisherId`) + `error_samples` + `local_signal` → message supervisor → apply verdict autonomously (continue | pause=apply fix+retry once | halt=write reason+exit). Print a non-blocking 2-line status (10 names+emails). Never wait for user input.

merchant_id=122456 | filters=25,15,22 | count=500 | commission=20.0 | min_partnerships=50 | target_per_page=25
login: affiliate@celldigital.co / Celldigital2024*
scripts: ~/.claude/skills/awin-rockbros-eu-outreach/scripts/
ledger: /Volumes/workssd/ObsidianVault/01-Projects/Awin-Rockbros-EU-Outreach-Ledger.md
report: /Volumes/workssd/ObsidianVault/01-Projects/Awin-Rockbros-EU-Outreach-Report-2026-04-15.md
msg: "Hallo, hier ist Bob Zabel von Rockbros – der Nr. 1 Sportmarke, die Sie unbedingt kennen sollten. Wir bieten eine besonders hohe Provision von 10–20 % im Rahmen eines zeitlich begrenzten Angebots. Antworten Sie hier oder schreiben Sie an affiliate@celldigital.co, um Details zu besprechen und ein Muster zu erhalten. Dieses Angebot gilt nur für Top-Performer unter den Publishern. JETZT ANTWORTEN."

## Step 0: Browser Check (START HERE)
`browser_evaluate`: `() => document.title` — confirm on Awin.
If not: navigate to `https://ui.awin.com/awin/merchant/122456/affiliate-directory/index/tab/notInvited`, snapshot once for login, run `setup-filters.js`.

## Step 1: Dedup + Invite
1a. Read ledger (create if missing), parse names into dedup array.
1b. Read `bulk-invite.js`. Replace `%%PLACEHOLDER%%` markers inline before `browser_evaluate` (isolated scope — no globals):
%%MSG%%→msg | %%COMM%%→"20.0" | %%ALREADY%%→dedup JSON array | %%TARGET%%→25 | %%MIN_PARTNERSHIPS%%→50
Returns: `{total, skippedLowQuality, publishers: [{name,type,partnerships,publisherId}]}`
If skippedLowQuality>0 on first batch → sort failed, reload+re-sort.

## Step 2: Batch Save (ONE Edit per page — never per-row)
2a. Build the full rows block from `publishers[]` in memory, then append all rows in a SINGLE Edit to `ledger` as `name|email|YYYY-MM-DD|122456`.
2b. Append the same rows in a SINGLE Edit to `report` (write-only, never read).
2c. Every 10 cumulative invites: write checkpoint with `{batch_n, total_so_far, page, rows, error_samples, local_signal}` → message supervisor → apply verdict autonomously.

## Step 3: Next Page
Run `next-page.js`. If `{ok:false}` → done.

## Step 4: Dedup refresh — re-read ledger + rebuild dedup array after every page (ledger is the deduplication source of truth).

## Step 5: Repeat Step 1b until count reached or no pages.

## Step 6: Final Report → report file: totals, publisher list, errors.

## Auto-Recovery (on any failure)
If browser_evaluate fails 2x or workflow gets stuck: write the current state to the checkpoint file (with `local_signal: "DEGRADED"` + `error_samples`) and request a verdict from the background supervisor spawned by `/awin-rockbros-eu-setup`. Apply the supervisor's `fix` once, then resume the invite loop. Do NOT spawn a second Opus agent — the supervisor is already running.

## Rules
1. NEVER snapshot except login | 2. Dedup before invite | 3. Record every invite | 4. Read JS on-demand | 5. Sort by partnerships desc | 6. FULLY AUTONOMOUS — no permission prompts, no user questions, no stopping
