---
name: awin-rockbros-us-affiliate-outreach
description: Awin Rockbros US Affiliate Outreach April152026. Two-phase design — Sonnet for setup, Haiku for bulk invites. JS scripts externalized to scripts/ directory. English-language outreach message.
tags: [affiliate, awin, rockbros, us, outreach, automation, playwright]
---

# Awin Rockbros US Affiliate Outreach April152026

## Isolation + Supervisor (MANDATORY)

**Browser profile**: `~/.claude/browser-profiles/awin-rockbros-us`
**MCP server**: `playwright-awin-rockbros-us` (port 9301)
**Tool namespace**: `mcp__playwright-awin-rockbros-us__*` — NEVER use `mcp__playwright__*`

Setup must run first:
```bash
bash ~/.claude/scripts/outreach/init-workflow.sh awin-rockbros-us playwright-awin-rockbros-us 9301
```

If the MCP server is not registered, the script prints the JSON block to add to `~/.claude.json`. Do not degrade to the shared `mcp__playwright__` server — it causes collisions when multiple workflows run concurrently.

**Opus supervisor**: At the start of the setup command, spawn a background Opus Agent using the prompt at `~/.claude/skills/_shared/outreach-supervisor-prompt.md`. The supervisor reviews `/tmp/outreach-awin-rockbros-us-checkpoint.json` after every 10 invites, validates quality/dedup, survives browser crashes, and halts on systemic bugs.

See `~/.claude/skills/_shared/outreach-isolation.md` for the full registry.

## Architecture

Two commands, two models:
- `/awin-us-setup` (Sonnet) — login, switch to Awin Classic, navigate to directory, apply filters. Run once per session.
- `/awin-us-outreach` (Haiku) — bulk invite loop. Assumes browser is already on directory page.

**CRITICAL — Login flow for US merchant 58007:**
1. Login at `https://id.awin.com` → lands on `https://app.awin.com` (new Awin UI)
2. MUST click "Switch to Awin Classic" button → opens classic tab at `ui.awin.com`
3. Navigate classic tab to publisher directory: `https://ui.awin.com/awin/merchant/58007/affiliate-directory/index/tab/all`
4. Do NOT use `/merchant/58007/publisher-directory` — that URL returns 404 for US accounts

JS scripts live in `~/.claude/skills/awin-rockbros-us-outreach/scripts/`:
- `setup-filters.js` — cookie accept, 40/page, filter checkboxes, sort desc (reused from EU skill)
- `bulk-invite.js` — invite loop with dedup + quality gate (min 50 partnerships)
- `next-page.js` — click next, return row count

## Configuration

| Key | Value |
|-----|-------|
| MERCHANT_ID | `58007` |
| EMAIL | `affiliate@celldigital.co` |
| PASSWORD | `Celldigital2024*` |
| FILTER_IDS | `['25','15','22']` |
| COMMISSION | `20.0` |
| MIN_PARTNERSHIPS | `50` |
| MESSAGE | Hi, this is Bob Zabel, reaching out from Rockbros – the NO.1 Sportmarke that you MUST see. We are offering 10-20% ultra high commission with limited time deal offer. Reply here or to affiliate@celldigital.co to chat in details and get the sample. REPLY now for limited time offer. |
| OBSIDIAN_PATH | `/Volumes/workssd/ObsidianVault/01-Projects/` |
| LEDGER_FILE | `Awin-Rockbros-US-Outreach-Ledger.md` |
| REPORT_FILE | `Awin-Rockbros-US-Outreach-Report-2026-04-15.md` |

## Publisher Directory URL (US-specific)

```
DIRECTORY_URL  = https://ui.awin.com/awin/merchant/58007/affiliate-directory/index/tab/notInvited
DIRECTORY_ALL  = https://ui.awin.com/awin/merchant/58007/affiliate-directory/index/tab/all
TABS           = Recommended | All | Not Invited | Invited  (all use JS click — same base URL with anchor)
```

> NOTE: `/merchant/58007/publisher-directory` returns 404 for US accounts.
> The correct path is `/awin/merchant/58007/affiliate-directory/index/tab/all`

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

> **US vs EU difference**: Filter IDs map to DIFFERENT categories in the US directory vs EU.
> Verified US mappings (from `/tab/notInvited`):

| ID | US Name | EU Name |
|----|---------|---------|
| 25 | Loyalty | Content Creators |
| 15 | Mobile Traffic | Editorial |
| 22 | Media Content | Newsletters |
| 19 | Coupon | Coupon |
| 24 | Cashback | Cashback |

> After applying IDs 25+15+22 on US notInvited tab: mostly <50 partnerships — low yield.
> Consider using IDs 19+24 (Coupon+Cashback) or no filter for higher-volume US outreach.
> The "Not Invited" tab (`/tab/notInvited`) sorts by Accepted Partnerships DESC correctly.

## Dedup Ledger

File: `/Volumes/workssd/ObsidianVault/01-Projects/Awin-Rockbros-US-Outreach-Ledger.md`
Format: `publisher_name|contact_email|YYYY-MM-DD|merchant_id`

Separate ledger from EU — EU merchant ID 122456, US merchant ID 58007.

## Quality Rules

1. **MANDATORY sort**: Always sort by Accepted Partnerships descending BEFORE inviting. Verify first row has 50+ partnerships.
2. **Min partnerships gate**: Only invite publishers with 50+ accepted partnerships. Skip and remove low-quality rows.
3. **Sort after page-length change**: Wait 4s after setting 40/page, THEN sort. Sort resets when page reloads.

## Token Rules

1. NEVER `browser_snapshot` except ONE time for login page
2. Use `browser_evaluate` for all DOM work
3. Read JS files from scripts/ on-demand — do NOT load all upfront
4. Every 20 invites: save to ledger, re-read ledger only

## Key Differences from EU Workflow

| | EU (122456) | US (58007) |
|--|-----------|-----------|
| Merchant ID | 122456 | 58007 |
| Message language | German | English |
| Ledger file | Awin-Rockbros-EU-Outreach-Ledger.md | Awin-Rockbros-US-Outreach-Ledger.md |
| Report file | Awin-Rockbros-EU-Outreach-Report-*.md | Awin-Rockbros-US-Outreach-Report-*.md |
