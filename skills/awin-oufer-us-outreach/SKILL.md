---
name: awin-oufer-us-affiliate-outreach
description: Awin Oufer US Affiliate Outreach April152026. Two-phase design — Sonnet for setup, Haiku for bulk invites. JS scripts externalized to scripts/ directory.
tags: [affiliate, awin, oufer, us, outreach, automation, playwright]
---

# Awin Oufer US Affiliate Outreach April152026

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

## Filter IDs (verified 2026-04-23)

| ID | Label | Relevance for Oufer |
|----|-------|---------------------|
| 21 | Content Creators & Influencers | ★★★ body art, beauty, fashion influencers |
| 20 | Editorial Content | ★★★ lifestyle/fashion editorial blogs |
| 23 | Communities & User-Generated Content | ★★★ body modification, piercing communities |
| 29 | Newsletters | ★★ fashion/lifestyle newsletter publishers |
| 14 | Social Traffic | ★★ social media traffic publishers |
| 19 | Shopping Directory | ★★ jewelry/accessories shopping sites |
| 26 | Coupon Code | ★ deal/promo sites (volume) |
| 24 | Cashback | ★ cashback platforms (volume) |
| 25 | Loyalty | ✗ wrong — was incorrectly used as "Content Creators" |
| 15 | Mobile Traffic | ✗ wrong — was incorrectly used as "Editorial" |
| 22 | Media Content | ✗ wrong — was incorrectly used as "Newsletters" |

## Tier Strategy (setup-filters.js auto-selects)

| Tier | IDs Applied | Triggers When |
|------|-------------|---------------|
| T1-Premium | 21, 20, 23, 29 | ≥5 publishers with 50+ partnerships |
| T2-Broad | 21, 20, 23, 29, 14, 19 | ≥3 publishers with 50+ partnerships |
| T3-Volume | 21, 20, 23, 29, 14, 19, 26, 24 | ≥1 publisher with 50+ partnerships |
| T4-NoFilter | (none) | Always succeeds — full directory |

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
