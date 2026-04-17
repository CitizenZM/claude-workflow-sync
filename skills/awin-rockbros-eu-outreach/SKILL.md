---
name: awin-rockbros-eu-affiliate-outreach
description: Awin Rockbros EU Affiliate Outreach April152026. Two-phase design — Sonnet for setup, Haiku for bulk invites. JS scripts externalized to scripts/ directory. German-language outreach message.
tags: [affiliate, awin, rockbros, eu, outreach, automation, playwright]
---

# Awin Rockbros EU Affiliate Outreach April152026

## Architecture

Two commands, two models:
- `/awin-eu-setup` (Sonnet) — login, filters, verify page. Run once per session.
- `/awin-eu-outreach` (Haiku) — bulk invite loop. Assumes browser is already on directory page.

JS scripts live in `~/.claude/skills/awin-rockbros-eu-outreach/scripts/`:
- `setup-filters.js` — cookie accept, 40/page, filter checkboxes, sort desc (reused from US skill)
- `bulk-invite.js` — invite loop with dedup + quality gate (min 50 partnerships)
- `next-page.js` — click next, return row count

## Configuration

| Key | Value |
|-----|-------|
| MERCHANT_ID | `122456` |
| EMAIL | `affiliate@celldigital.co` |
| PASSWORD | `Celldigital2024*` |
| FILTER_IDS | `['25','15','22']` |
| COMMISSION | `20.0` |
| MIN_PARTNERSHIPS | `50` |
| MESSAGE | Hallo, hier ist Bob Zabel von Rockbros – der Nr. 1 Sportmarke, die Sie unbedingt kennen sollten. Wir bieten eine besonders hohe Provision von 10–20 % im Rahmen eines zeitlich begrenzten Angebots. Antworten Sie hier oder schreiben Sie an affiliate@celldigital.co, um Details zu besprechen und ein Muster zu erhalten. Dieses Angebot gilt nur für Top-Performer unter den Publishern. JETZT ANTWORTEN. |
| OBSIDIAN_PATH | `/Volumes/workssd/ObsidianVault/01-Projects/` |
| LEDGER_FILE | `Awin-Rockbros-EU-Outreach-Ledger.md` |
| REPORT_FILE | `Awin-Rockbros-EU-Outreach-Report-2026-04-15.md` |

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

File: `/Volumes/workssd/ObsidianVault/01-Projects/Awin-Rockbros-EU-Outreach-Ledger.md`
Format: `publisher_name|contact_email|YYYY-MM-DD|merchant_id`

Separate ledger from US — EU merchant ID 122456, US merchant ID 58007.

## Quality Rules

1. **MANDATORY sort**: Always sort by Accepted Partnerships descending BEFORE inviting. Verify first row has 50+ partnerships.
2. **Min partnerships gate**: Only invite publishers with 50+ accepted partnerships. Skip and remove low-quality rows.
3. **Sort after page-length change**: Wait 4s after setting 40/page, THEN sort. Sort resets when page reloads.

## Token Rules

1. NEVER `browser_snapshot` except ONE time for login page
2. Use `browser_evaluate` for all DOM work
3. Read JS files from scripts/ on-demand — do NOT load all upfront
4. Every 20 invites: save to ledger, re-read ledger only

## Key Differences from US Workflow

| | US (58007) | EU (122456) |
|--|-----------|-------------|
| Merchant ID | 58007 | 122456 |
| Message language | English | German |
| Login URL tab | notInvited | all |
| Ledger file | Awin-Outreach-Ledger.md | Awin-Rockbros-EU-Outreach-Ledger.md |
| Report file | Awin-Rockbros-Outreach-Report-*.md | Awin-Rockbros-EU-Outreach-Report-*.md |
