---
description: "Awin Oufer US login + filter setup (Sonnet). Run before /awin-oufer-us-outreach.
  Usage: /awin-oufer-us-setup [merchant_id] [filter_ids]
  Default: /awin-oufer-us-setup 91941 25,15,22"
model: sonnet
---

## MODEL GATE — MANDATORY FIRST CHECK
This command REQUIRES model: **sonnet**. Before doing ANY work, check your current model. If you are running on Opus, STOP IMMEDIATELY and tell the user: "⛔ Wrong model. This command requires Sonnet. Run `/model sonnet` then re-run `/awin-oufer-us-setup`." Do NOT proceed on Opus — it wastes 5-10x credits for a login/setup task.

## BROWSER MCP: playwright-awin (port 3100)
ALL browser tool calls MUST use the `playwright-awin` MCP server.
Tool prefix: `mcp__playwright-awin__` (e.g., `mcp__playwright-awin__browser_navigate`, `mcp__playwright-awin__browser_snapshot`, `mcp__playwright-awin__browser_click`, `mcp__playwright-awin__browser_type`, `mcp__playwright-awin__browser_evaluate`).
Do NOT use the default `playwright` or any other playwright server — each workflow has its own isolated browser.

# Awin Oufer US Affiliate Outreach — Setup (Sonnet)

Login to Awin and configure filters for Oufer Body Jewelry. Run this once, then use `/awin-oufer-us-outreach` for the invite loop on Haiku.

## Parameters (from $ARGUMENTS or defaults)

- merchant_id: `91941`
- filter_ids: `25,15,22`
- Email: `affiliate@celldigital.co`
- Password: `Celldigital2024*`

## Step 1: Navigate + Login

1. `browser_navigate` to `https://ui.awin.com/awin/merchant/{merchant_id}/affiliate-directory/index/tab/notInvited`
2. `browser_snapshot` ONCE to see login form
3. `browser_type` email, `browser_click` Continue, `browser_type` password, `browser_click` Sign In

## Step 2: Apply Filters + Sort

Run setup in ONE `browser_evaluate` call:
1. Set 40/page, wait 6s
2. Sort by Accepted Partnerships — click once, wait 4s, check if desc (first row >= 50). If not, click again.

## Step 3: Verify

Confirm: sort verified, 40/page, invite buttons > 0.
Report: "Oufer US Setup complete. Run `/awin-oufer-us-outreach 91941 25,15,22 {count}`."
