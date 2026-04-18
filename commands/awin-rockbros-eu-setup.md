---
description: "Awin Rockbros EU login + filter setup (Sonnet). Run before /awin-rockbros-eu-outreach.
  Usage: /awin-rockbros-eu-setup [merchant_id] [filter_ids]
  Default: /awin-rockbros-eu-setup 122456 25,15,22"
model: sonnet
---

## MODEL GATE — MANDATORY FIRST CHECK
This command REQUIRES model: **sonnet**. Before doing ANY work, check your current model. If you are running on Opus, STOP IMMEDIATELY and tell the user: "⛔ Wrong model. This command requires Sonnet. Run `/model sonnet` then re-run `/awin-rockbros-eu-setup`." Do NOT proceed on Opus — it wastes 5-10x credits for a login/setup task.

## BROWSER MCP: playwright-awin (port 3100)
ALL browser tool calls MUST use the `playwright-awin` MCP server.
Tool prefix: `mcp__playwright-awin__` (e.g., `mcp__playwright-awin__browser_navigate`, `mcp__playwright-awin__browser_snapshot`, `mcp__playwright-awin__browser_click`, `mcp__playwright-awin__browser_type`, `mcp__playwright-awin__browser_evaluate`).
Do NOT use the default `playwright` or any other playwright server — each workflow has its own isolated browser.

# Awin Rockbros EU Affiliate Outreach — Setup (Sonnet)

Login to Awin EU and configure filters. Run this once, then use `/awin-rockbros-eu-outreach` for the invite loop on Haiku.

## Parameters (from $ARGUMENTS or defaults)

- merchant_id: `122456`
- filter_ids: `25,15,22`
- Email: `affiliate@celldigital.co`
- Password: `Celldigital2024*`

## Step 1: Navigate + Login

1. `browser_navigate` to `https://ui.awin.com/awin/merchant/{merchant_id}/affiliate-directory/index/tab/notInvited`
2. `browser_snapshot` ONCE to see login form
3. `browser_type` email into the email field
4. `browser_click` Continue/Submit button
5. `browser_type` password into password field
6. `browser_click` Sign In button
7. Wait for directory page to load

## Step 2: Apply Filters

Read the filter setup script from `~/.claude/skills/awin-rockbros-eu-outreach/scripts/setup-filters.js`.
Run it via `browser_evaluate`, replacing `FILTER_IDS` with the actual array.

## Step 3: Verify

Confirm: filters applied, 40/page, sort verified (first row 50+ partnerships), rows > 0.

Report: "EU Setup complete. {rows} publishers on first page. Run `/awin-rockbros-eu-outreach 122456 25,15,22 {count}` to start inviting."

## Error Recovery

- If login fails: retry once with fresh navigate
- If filters don't apply: try clicking parent hitareas (#types_3, #types_5) manually first
- If page shows 0 rows: check if correct tab (all) is selected — EU uses /tab/notInvited not /tab/notInvited
