---
name: awin-oufer-us-affiliate-outreach
description: Awin Oufer US Affiliate Outreach April152026. Two-phase design — Sonnet for setup, Haiku for bulk invites. JS scripts externalized to scripts/ directory.
tags: [affiliate, awin, oufer, us, outreach, automation, playwright]
---

# Awin Oufer US Affiliate Outreach April152026

## Isolation + Supervisor (MANDATORY)

**Browser profile**: `~/.claude/browser-profiles/awin-oufer-us`
**MCP server**: `playwright-awin-oufer-us` (port 9303)
**Tool namespace**: `mcp__playwright-awin-oufer-us__*` — NEVER use `mcp__playwright__*`

Setup must run first:
```bash
bash ~/.claude/scripts/outreach/init-workflow.sh awin-oufer-us playwright-awin-oufer-us 9303
```

If the MCP server is not registered, the script prints the JSON block to add to `~/.claude.json`. Do not degrade to the shared `mcp__playwright__` server.

**Opus supervisor**: At the start of the setup command, spawn a background Opus Agent using the prompt at `~/.claude/skills/_shared/outreach-supervisor-prompt.md`. The supervisor reviews `/tmp/outreach-awin-oufer-us-checkpoint.json` after every 10 invites.

See `~/.claude/skills/_shared/outreach-isolation.md` for the full registry.

## Architecture

Two commands, two models:
- `/awin-oufer-us-setup` (Sonnet) — login, filters, verify page. Run once per session.
- `/awin-oufer-us-outreach` (Haiku) — bulk invite loop. Assumes browser is already on directory page.

JS scripts live in `~/.claude/skills/awin-oufer-us-outreach/scripts/`:
- `setup-filters.js` — cookie accept, 40/page, filter checkboxes, sort desc
- `bulk-invite.js` — invite loop with dedup + quality gate (min 50 partnerships)
- `next-page.js` — click next, return row count

## Configuration

| Key | Value |
|-----|-------|
| MERCHANT_ID | `91941` |
| EMAIL | `affiliate@celldigital.co` |
| PASSWORD | `Celldigital2024*` |
| FILTER_IDS | `['25','15','22']` |
| COMMISSION | `20.0` |
| MIN_PARTNERSHIPS | `50` |
| MESSAGE | Hi, this is Bob Zabel, reaching out from Oufer Body Jewelry, the NO.1 Piercing Body Jewelry you MUST see. We are offering 10-20% ultra high commission with limited time deal offer, Reply here or to affiliate@celldigital.co to chat in details and get the sample. REPLY now for limited time offer. |
| OBSIDIAN_PATH | `/Volumes/workssd/ObsidianVault/01-Projects/` |
| LEDGER_FILE | `Awin-Oufer-US-Outreach-Ledger.md` |
| REPORT_FILE | `Awin-Oufer-US-Outreach-Report-2026-04-15.md` |

## DOM Selectors

```
EMAIL_INPUT    = input[type="email"], input[name="username"]
PASSWORD_INPUT = input[type="password"]
CONTINUE_BTN   = button[type="submit"]
SIGNIN_BTN     = button:has-text("Sign in")
COOKIE_BTN     = button:has-text("Accept all")
PAGE_LENGTH    = #pageLength
INVITE_BTN     = [title="Invite Publisher"], [data-original-title="Invite Publisher"]
NEXT_PAGE_BTN  = #nextPage
```

## Filter IDs

| ID | Name |
|----|------|
| 3 | Content (parent — expand first) |
| 5 | Email (parent — expand first) |
| 25 | Content Creators |
| 15 | Editorial |
| 22 | Newsletters |
| 19 | Coupon |
| 24 | Cashback |

## Dedup Ledger

File: `/Volumes/workssd/ObsidianVault/01-Projects/Awin-Oufer-US-Outreach-Ledger.md`
Format: `publisher_name|contact_email|YYYY-MM-DD|merchant_id`

## Quality Rules

1. **MANDATORY sort**: Always sort by Accepted Partnerships descending BEFORE inviting. Verify first row has 50+ partnerships.
2. **Min partnerships gate**: Only invite publishers with 50+ accepted partnerships. Skip and remove low-quality rows.
3. **Sort after page-length change**: Wait 4s after setting 40/page, THEN sort. Sort resets when page reloads.
4. **Separate setup and invite**: Run setup (40/page + sort) in one evaluate call, verify sort worked, then run invite loop in a second call.

## Token Rules

1. NEVER `browser_snapshot` except ONE time for login page
2. Use `browser_evaluate` for all DOM work
3. Read JS files from scripts/ on-demand — do NOT load all upfront
4. Every 20 invites: save to ledger, re-read ledger only
