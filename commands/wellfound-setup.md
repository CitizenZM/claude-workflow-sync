---
description: "Wellfound login + filter + job queue builder (Sonnet). Run once per session before /wellfound-apply. Usage: /wellfound-setup"
model: sonnet
---

## MODEL GATE — MANDATORY FIRST CHECK
This command REQUIRES model: **sonnet**. If on Opus, STOP and tell the user: "Wrong model. Run `/model sonnet` then re-run `/wellfound-setup`."

## BROWSER ISOLATION — USE DEDICATED PORT
This workflow uses the **wellfound-dedicated** Playwright browser (isolated Chrome profile, port 9306).
All browser commands must use `mcp__playwright-wellfound__*` tools, NOT `mcp__playwright__*`.
This prevents interference with other open browser sessions.

# Wellfound Setup — Wellfound Job Application April192026

Read `~/.claude/skills/wellfound-apply/SKILL.md` first for all config and selector values.

## Step 1: Navigate to Login
1. `mcp__playwright-wellfound__browser_navigate` → `https://wellfound.com/login`
2. ONE `browser_snapshot` to map login form selectors (update SKILL.md DOM Selectors section)

## Step 2: Login
1. `browser_evaluate` with `~/.claude/skills/wellfound-apply/scripts/login.js`
2. `browser_click` the submit button
3. `browser_wait_for` until URL changes away from /login
4. Verify: `browser_evaluate` → `({ url: window.location.href, title: document.title })`
5. If still on /login: retry once with `browser_type` approach, then Opus debug

## Step 3: Navigate to Jobs
1. `browser_navigate` → `https://wellfound.com/jobs`
2. `browser_wait_for` → wait for job cards to appear

## Step 4: Apply Filters — Role
1. `browser_evaluate` with `~/.claude/skills/wellfound-apply/scripts/apply-filters.js` to map selectors
2. `browser_click` or `browser_type` into role filter → type "Growth Hacker"
3. Wait for dropdown suggestions → click "Growth Hacker" option
4. Also add "Marketing" filter if available (check for multi-select chip UI)

## Step 5: Apply Filters — Location (repeat for all 3)
1. Click location filter → type "Los Angeles" → select
2. Click location filter → type "San Francisco" → select
3. Click location filter → type "New York" → select
(Wellfound supports multi-city — add all 3 as separate chips)

## Step 6: Scroll and Collect Jobs
1. `browser_evaluate` with `~/.claude/skills/wellfound-apply/scripts/collect-jobs.js`
2. Scroll down, repeat collect-jobs.js up to 5 times to load lazy content
3. Deduplicate by jobId
4. Apply salary gate: if comp shown and max < $160,000 → skip

## Step 7: Dedup Against Ledger
1. Read `/Users/xiaozuo/Library/Mobile Documents/iCloud~md~obsidian/Documents/Openclaw/Wellfound-Application-Ledger.md` (if exists)
2. Filter out jobs already in ledger with status = submitted/confirmed/already_applied

## Step 8: Save Jobs (click bookmark on each)
For each job card found:
1. `browser_click` on the Save/bookmark icon (selector from SKILL.md)
2. Verify icon state changed (pressed/filled)
3. Mark as `saved` in local queue

## Step 9: Output
Report: "Setup complete. {N} jobs saved. Run `/wellfound-apply` to begin applications."
List first 10 jobs: company | role | location | comp

## Token Rules
- ONE `browser_snapshot` during login only
- All other DOM work via `browser_evaluate`
