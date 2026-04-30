---
description: "Impact Rockbros US proposal sending (Haiku). Run /impact-rockbros-us-setup first.
  Usage: /impact-rockbros-us-outreach [count]
  Default: /impact-rockbros-us-outreach 500"
model: haiku
---

## Pre-flight (autonomous — aborts, never prompts)
- Model: **haiku** only. If Opus/Sonnet → `⛔ Wrong model — run /model haiku` and exit.
- MCP: `mcp__playwright-impact-rockbros-us__*` exclusively (port 9306). No fallback.
- Checkpoint `/tmp/outreach-impact-rockbros-us-checkpoint.json`: every 10 proposals.

```
program_id=50132 | count=500 | target_per_page=20
login: affiliate@celldigital.co / Celldigital2024*
scripts: ~/.claude/skills/impact-rockbros-us-outreach/scripts/
ledger:       /Volumes/workssd/ObsidianVault/01-Projects/Impact-Rockbros-US-Outreach-Ledger.md
intel_db:     /Volumes/workssd/ObsidianVault/01-Projects/Impact-Rockbros-US-Publisher-Intel.md
obsidian:     /Volumes/workssd/ObsidianVault/01-Projects/Impact-Rockbros-US-Outreach.md
contract_date: DYNAMIC — new Date(Date.now()+86400000).toISOString().slice(0,10)
msg: "Hi, this is Bob Zabel, reaching out from Rockbros, the NO.1 sports accessory you must see. We are offering 10–20% ultra-high commission with a limited-time deal offer. Reply here or email affiliate@celldigital.co to chat in detail and get a sample."
```

## Step 0: Browser Check
`mcp__playwright-impact-rockbros-us__browser_evaluate`: `() => document.title`
If not on Impact: navigate to discover URL, snapshot once for login.

## Step 1: Build Script + Run (browser_run_code ONLY)

1a. Read ledger, parse names ending in `impact-50132` → dedup array  
1b. `CONTRACT_DATE = new Date(Date.now()+86400000).toISOString().slice(0,10)`  
1c. `DISCOVER_URL = await browser_evaluate: () => location.href`  
1d. Read `bulk-proposal.js`, replace ALL placeholders, call `browser_run_code`

**Script returns per publisher (exact field names):**
```json
{
  "name": "Be Kept Up, LLC",
  "partner_id": "1448331",
  "status": "Active",
  "partner_size": "Extra Large",
  "business_model": "Network",
  "description": "Performance-Based Publisher Agency...",
  "contact_name": "Joshua Kopac",
  "contact_role": "Marketplace Contact",
  "contact_email": "jkopac@me.com",
  "language": "English",
  "promotional_areas": [],
  "corporate_address": "Wilton, CONNECTICUT United States of America",
  "content_categories": [],
  "legacy_categories": ["Apparel...", "Women's Apparel", "..."],
  "legacy_categories_full": ["Apparel...", "..."],
  "tags": ["banking", "finance", "..."],
  "tags_full": ["banking", "finance", "..."],
  "all_contacts": [{"name":"Joshua Kopac","role":"Marketplace Contact","email":"jkopac@me.com","initials":"JK"}],
  "media_kit_urls": [{"name":"Be Kept Up 1-Sheet.pdf","url":"https://cdn..."}],
  "media_kit_count": 2,
  "currency": "USD",
  "website": "https://voyagertribe.com/",
  "learn_more_url": "https://voyagertribe.com/",
  "social_properties": [{"url":"https://voyagertribe.com/","text":"https://voyagertribe.com/"}],
  "verified": false,
  "semrush_global_rank": null,
  "monthly_visitors": null,
  "moz_spam_score": null,
  "moz_domain_authority": null,
  "scraped_at": "2026-04-30",
  "termVerified": true,
  "termText": "Rockbros USA Performance",
  "dateVerified": true,
  "proposal_sent": true
}
```

## Step 2: Save — THREE targets, ONE batch per page

### 2a. Supabase (FIRST — primary database)
```bash
node --input-type=module \
  ~/.claude/skills/impact-rockbros-us-outreach/scripts/ingest-supabase.js \
  '<JSON.stringify(publishers_array)>' \
  '50132' \
  '<CURRENT_TAB_HASH>'
```
Returns `{ok, updated, intelRows, errors}`. Log errors, never block.

**What gets written:**
- `pf.publishers` — COALESCE upsert keyed on `publisher_id = "impact-{partner_id}"`
  - `email` ← `contact_email` (NEVER overwritten with null if already set)
  - `contact_name`, `contact_role` (NEVER overwritten with null)
  - All other fields: only overwrite if new value is non-null/non-empty
- `pf.program_publishers` — upsert on `(program_id=5, publisher_id)`
- `pf.publisher_intel` — INSERT new row (full snapshot including `contact_email`, `contact_name`, `contact_role`)

### 2b. Ledger (Obsidian dedup key)
Append to `ledger` in ONE Edit:
```
{name}|{contact_email or "email_missing"}|{YYYY-MM-DD}|impact-50132|{partner_id or "id_missing"}|{status}|{partner_size}|{website or ""}|{contact_name or ""}
```
**FIELD MAPPING**: `contact_email` from script → ledger column 2. `contact_name` → column 9.

### 2c. Publisher Intel (Obsidian full profile)
Append to `intel_db` in ONE Edit per batch:
```markdown
## {name} — {YYYY-MM-DD}
- **Publisher ID**: impact-{partner_id} | **Network ID**: {partner_id}
- **Status**: {status} | **Size**: {partner_size} | **Model**: {business_model}
- **Contact Name**: {contact_name}
- **Contact Role**: {contact_role}
- **Contact Email**: {contact_email}
- **All Contacts**: {all_contacts — JSON}
- **Address**: {corporate_address}
- **Language**: {language} | **Currency**: {currency}
- **Website**: {website} | **Verified**: {verified}
- **Semrush Rank**: {semrush_global_rank} | **Monthly Visitors**: {monthly_visitors}
- **Moz DA**: {moz_domain_authority} | **Moz Spam**: {moz_spam_score}
- **Description**: {description — first 300 chars}
- **Legacy Categories**: {legacy_categories_full joined ", "}
- **Tags**: {tags_full joined ", "}
- **Media Kits**: {media_kit_urls — names only}
- **Social Properties**: {social_properties — urls}
- **Term**: {termText} ✓{termVerified} | **Date**: ✓{dateVerified}
---
```

## Step 3: Next Page + Loop
Run `next-page.js` via `browser_evaluate`. `{ok:true}` → repeat. `{ok:false}` → Step 4.

## Step 4: Final Report + Obsidian Session Sync
Append to `obsidian`:
```markdown
## Session YYYY-MM-DD
- Proposals sent: {N} | Errors: {errorCount}
- Email captured: {emails}/{N} ({pct}%) | Contact name: {names}/{N}
- Websites: {websites}/{N} | Verified: {verified}/{N}
- DB rows written: publishers={updated} intel={intelRows}
- Top 5: [{name} · {contact_email} · {website}]
```

## Rules
1. NEVER snapshot except login
2. browser_run_code ONLY for proposals — page.locator() needs page access
3. contact_email is REQUIRED — write `email_missing` in ledger if null, never skip
4. contact_name is REQUIRED in intel block — write `name_missing` if null
5. Supabase FIRST, Obsidian SECOND — DB is primary
6. COALESCE upsert: existing email/contact never overwritten with null
7. FULLY AUTONOMOUS — no stops, no prompts
