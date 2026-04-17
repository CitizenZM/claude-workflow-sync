---
description: "Awin login + filter setup (Sonnet). Run before /awin-rockbros-us-outreach.
  Usage: /awin-rockbros-us-setup [merchant_id] [filter_ids]
  Default: /awin-rockbros-us-setup 58007 25,15,22"
model: sonnet
---

## MODEL GATE — MANDATORY FIRST CHECK
This command REQUIRES model: **sonnet**. Before doing ANY work, check your current model. If you are running on Opus, STOP IMMEDIATELY and tell the user: "⛔ Wrong model. This command requires Sonnet. Run `/model sonnet` then re-run `/awin-rockbros-us-setup`." Do NOT proceed on Opus — it wastes 5-10x credits for a login/setup task.

# Awin Rockbros US Affiliate Outreach — Setup (Sonnet)

Login to Awin and configure filters. Run this once, then use `/awin-rockbros-us-outreach` for the invite loop on Haiku.

## Parameters (from $ARGUMENTS or defaults)

- merchant_id: `58007`
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

Read the filter setup script from `~/.claude/skills/awin-publisher-outreach/scripts/setup-filters.js`.

Run it via `browser_evaluate`, replacing `FILTER_IDS` with the actual array, e.g. `['25','15','22']`.

## Step 3: Verify

The script returns `{ filters, perPage, rows }`. Confirm:
- filters applied correctly
- 40 per page set
- rows > 0

Report: "Setup complete. {rows} publishers on first page. Filters: {filters}. Run `/awin-rockbros-us-outreach {merchant_id} {filter_ids} {count}` to start inviting."

## Error Recovery

- If login fails: retry once with fresh navigate
- If filters don't apply: try clicking parent hitareas (#types_3, #types_5) manually first
- If page shows 0 rows: check if correct tab (notInvited) is selected
