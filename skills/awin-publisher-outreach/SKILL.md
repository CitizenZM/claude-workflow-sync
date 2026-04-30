---
name: awin-rockbros-us-affiliate-outreach
description: Awin Rockbros US Affiliate Outreach. Two-phase design — Sonnet for setup, Haiku for bulk invites. JS scripts externalized to scripts/ directory. Naming convention for all outreach workflows: [Platform] [Brand] [Region] Affiliate Outreach [DateMMDDYYYY].
tags: [affiliate, awin, rockbros, outreach, automation, playwright]
---

# Awin Rockbros US Affiliate Outreach April152026

## Architecture

Two commands, two models:
- `/awin-setup` (Sonnet) — login, filters, verify page. Run once per session.
- `/awin-outreach` (Haiku) — bulk invite loop. Assumes browser is already on directory page.

JS scripts live in `~/.claude/skills/awin-publisher-outreach/scripts/`:
- `setup-filters.js` — cookie accept, 40/page, filter checkboxes, sort desc
- `bulk-invite.js` — invite loop with dedup, returns JSON results
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
| MESSAGE | Hi, this is Bob Zabel, reaching out from Rockbros, the NO.1 sports accessory you must see. We are offering 10-20% ultra-high commission with a limited-time deal offer. Reply here or email affiliate@celldigital.co to chat in detail and get a sample. |
| OBSIDIAN_PATH | `/Volumes/workssd/ObsidianVault/01-Projects/` |
| LEDGER_FILE | `Awin-Outreach-Ledger.md` |
| REPORT_FILE | `Awin-Rockbros-Publisher-Outreach.md` |

## DOM Selectors

```
EMAIL_INPUT    = input[type="email"], input[name="username"]
PASSWORD_INPUT = input[type="password"]
CONTINUE_BTN   = button[type="submit"]
SIGNIN_BTN     = button:has-text("Sign in")
COOKIE_BTN     = button:has-text("Accept all")
PAGE_LENGTH    = #pageLength
INVITE_BTN     = [title="Invite Publisher"], [data-original-title="Invite Publisher"]
NEXT_PAGE_BTN  = .paginationNext, [class*="next"]
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

File: `/Volumes/workssd/ObsidianVault/01-Projects/Awin-Outreach-Ledger.md`
Format: `publisher_name|contact_email|YYYY-MM-DD|merchant_id`

Read before inviting. Append after each page. The "Not Invited" tab is primary dedup; ledger is secondary safety net + reporting.

## Quality Rules

1. **MANDATORY sort**: Always sort by Accepted Partnerships descending BEFORE inviting. Verify first row has 50+ partnerships.
2. **Min partnerships gate**: Only invite publishers with 50+ accepted partnerships. Skip and remove low-quality rows.
3. **Sort after page-length change**: Wait 4s after setting 40/page, THEN sort. Sort resets when page reloads.

## Token Rules

1. NEVER `browser_snapshot` except ONE time for login page
2. Use `browser_evaluate` for all DOM work
3. Read JS files from scripts/ on-demand — do NOT load all upfront
4. Every 20 invites: save to ledger, re-read ledger only
