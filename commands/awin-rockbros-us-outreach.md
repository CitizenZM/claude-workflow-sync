---
description: "Awin Rockbros US bulk invite (Haiku). Run /awin-rockbros-us-setup first."
model: haiku
---

## MODEL GATE — MANDATORY FIRST CHECK
This command REQUIRES model: **haiku**. Before doing ANY work, check your current model. If you are running on Opus or Sonnet, STOP IMMEDIATELY and tell the user: "⛔ Wrong model. This command requires Haiku. Run `/model haiku` then re-run `/awin-rockbros-us-outreach`." Do NOT proceed on the wrong model — it wastes 10-20x credits for identical work.

merchant_id=58007 | filters=25,15,22 | count=500 | commission=20.0 | min_partnerships=50 | target_per_page=25
login: affiliate@celldigital.co / Celldigital2024*
scripts: ~/.claude/skills/awin-publisher-outreach/scripts/
ledger: /Volumes/workssd/ObsidianVault/01-Projects/Awin-Outreach-Ledger.md
report: /Volumes/workssd/ObsidianVault/01-Projects/Awin-Rockbros-Publisher-Outreach.md
msg: "Hi, this is Bob Zabel, reaching out from Rockbros, the NO.1 sports accessory you must see. We are offering 10-20% ultra-high commission with a limited-time deal offer. Reply here or email affiliate@celldigital.co to chat in detail and get a sample."

## Step 0: Browser Check (START HERE)
`browser_evaluate`: `() => document.title` — confirm on Awin.
If not: navigate to `https://ui.awin.com/awin/merchant/58007/affiliate-directory/index/tab/notInvited`, snapshot once for login, run `setup-filters.js`.

## Step 1: Dedup + Invite
1a. Read ledger, parse names for this merchant_id into dedup array.
1b. Read `bulk-invite.js`. Replace `%%PLACEHOLDER%%` markers inline before `browser_evaluate` (isolated scope — no globals):
%%MSG%%→msg | %%COMM%%→"20.0" | %%ALREADY%%→dedup JSON array | %%TARGET%%→25 | %%MIN_PARTNERSHIPS%%→50
Returns: `{total, skippedLowQuality, publishers: [{name,type,partnerships,publisherId}]}`
If skippedLowQuality>0 on first batch → sort failed, reload+re-sort.

## Step 2: Save
2a. Append to ledger: `name|email|YYYY-MM-DD|58007`
2b. Append to report (write-only, never read).

## Step 3: Next Page
Run `next-page.js`. If `{ok:false}` → done.

## Step 4: Every 20 invites — save, re-read ledger, rebuild dedup array.

## Step 5: Repeat Step 1b until count reached or no pages.

## Step 6: Final Report → report file: totals, publisher list, errors.

## Auto-Recovery (on any failure)
If browser_evaluate fails 2x or workflow gets stuck: spawn Agent(model:"opus") to diagnose, fix the issue (re-login, re-navigate, re-sort), then continue the invite loop. Never stop — always recover and resume.

## Rules
1. NEVER snapshot except login | 2. Dedup before invite | 3. Record every invite | 4. Read JS on-demand | 5. FULLY AUTONOMOUS — no permission prompts, no user questions, no stopping
