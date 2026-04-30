---
name: impact-rockbros-us-affiliate-outreach
description: Impact Rockbros USA Affiliate Outreach. Full publisher intelligence scrape (contact name, email, address, categories, web metrics) + proposal sending. Supabase COALESCE upsert — email/contact never overwritten. Obsidian mirror. browser_run_code + page.locator().boundingBox() for a11y-tree tab switching.
tags: [affiliate, impact, rockbros, us, outreach, automation, playwright, supabase]
---

# Impact Rockbros USA Affiliate Outreach

## Isolation

**Browser profile**: `~/.claude/browser-profiles/impact-rockbros-us`
**MCP server**: `playwright-impact-rockbros-us` (port 9306)
**Tool namespace**: `mcp__playwright-impact-rockbros-us__*` — NEVER `mcp__playwright__*`

Init:
```bash
bash ~/.claude/scripts/outreach/init-workflow.sh impact-rockbros-us playwright-impact-rockbros-us 9306
```

## Architecture

| Phase | Model | Role |
|-------|-------|------|
| Setup | Sonnet | Login, filters, Opus supervisor spawn |
| Outreach | Haiku | `browser_run_code` — scrape + propose per tab |
| Supervisor | Opus (background) | Quality check every 10 proposals |

## Configuration

| Key | Value |
|-----|-------|
| PROGRAM_ID | `50132` |
| DB program_id | `5` (in pf.programs) |
| BRAND | Rockbros |
| REGION | US |
| TERM | Rockbros USA Performance (highest commission) |
| LEDGER | `/Volumes/workssd/ObsidianVault/01-Projects/Impact-Rockbros-US-Outreach-Ledger.md` |
| INTEL_DB | `/Volumes/workssd/ObsidianVault/01-Projects/Impact-Rockbros-US-Publisher-Intel.md` |
| OBSIDIAN | `/Volumes/workssd/ObsidianVault/01-Projects/Impact-Rockbros-US-Outreach.md` |
| CONTRACT_DATE | `new Date(Date.now()+86400000).toISOString().slice(0,10)` |
| MSG | "Hi, this is Bob Zabel, reaching out from Rockbros, the NO.1 sports accessory you must see. We are offering 10–20% ultra-high commission with a limited-time deal offer. Reply here or email affiliate@celldigital.co to chat in detail and get a sample." |

## Filters

- Status: Active + New
- Partner Size: Medium, Large, Extra Large
- Categories: Sports, Health & Fitness, Outdoors & Nature, Consumer Electronics, Cycling
- Promotional Areas: United States
- Sort: `sortBy=reachRating&sortOrder=DESC`

## Critical Architecture: a11y-Tree-Only Slideout

**Confirmed 2026-04-29:** The publisher slideout renders ONLY in Playwright's accessibility tree.

| Access method | Result |
|---------------|--------|
| `document.querySelectorAll('*')` | ❌ empty |
| `getBoundingClientRect()` | ❌ returns 0 |
| Shadow DOM piercing | ❌ not there |
| `page.locator().boundingBox()` | ✅ real coordinates |
| `page.getByText()` / `page.getByRole()` | ✅ works |

**Consequence**: `browser_run_code` is mandatory. `browser_evaluate` cannot reach slideout content.

### Tab Switching (CRITICAL FIX)

Properties / Details tabs require `page.mouse.click()` at exact coordinates.  
`browser_click` via ref and `getByTestId` do NOT work (React doesn't respond).

**Correct method** (v7 scraper):
```js
// Use page.locator().boundingBox() — reads a11y tree coordinates
const box = await page.getByText('Properties', { exact: true }).first()
              .boundingBox({ timeout: 600 });
// Then click at those coordinates
await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
```

**Wrong methods** (do NOT use):
```js
page.getByTestId('...')  // wrong element, React ignores
browser_click ref=e865   // triggers wrong selector
getBoundingClientRect()  // returns 0 for a11y-only elements
```

### Slideout Content Map

**Properties tab** (must click to activate — NOT always default):
```
Header:   partner_id (7-digit), status, partner_size, business_model
Body:     description (60-600 chars)
Contacts: contact_name ("Firstname Lastname"), contact_role ("Marketplace Contact"),
          contact_email ("name@domain.com")
          [multiple contacts possible — all in all_contacts[]]
Personal: language
Address:  corporate_address ("City, STATE United States")
Promo:    promotional_areas[]
Cats:     content_categories[] (click "+N more" to expand)
Legacy:   legacy_categories[] → legacy_categories_full[] after expand
Tags:     tags[] → tags_full[] after expand
Media:    media_kit_urls [{name, url}]
Currency: "USD" / "EUR"
```

**Details tab** (click to activate):
```
Properties: website URL, learn_more_url
Metrics:    semrush_global_rank, monthly_visitors, moz_spam_score, moz_domain_authority
            (only present when publisher property is authenticated/verified)
Status:     "Verified" / "Not verified"
Multiple:   social_properties [] — one card per authenticated web property
```

## Bulk Proposal Script (v7)

`~/.claude/skills/impact-rockbros-us-outreach/scripts/bulk-proposal.js`

**Run via `browser_run_code` only.** Placeholders replaced before execution:

| Placeholder | Value |
|-------------|-------|
| `"%%DISCOVER_URL%%"` | Full URL with hash filters |
| `"%%MSG%%"` | Proposal message |
| `"%%CONTRACT_DATE%%"` | Tomorrow's date |
| `%%ALREADY%%` | `JSON.stringify(dedup array)` — no quotes |
| `%%TARGET%%` | Integer (e.g. 20) |

**Returns per publisher:**
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
  "all_contacts": [{"name":"Joshua Kopac","role":"Marketplace Contact","email":"jkopac@me.com","initials":"JK"}],
  "language": "English",
  "promotional_areas": [],
  "corporate_address": "Wilton, CONNECTICUT United States of America",
  "content_categories": [],
  "legacy_categories": ["Apparel...", "Women's Apparel"],
  "legacy_categories_full": ["Apparel...", "Women's Apparel"],
  "tags": ["banking","finance"],
  "tags_full": ["banking","finance"],
  "media_kit_urls": [{"name":"BKU Sheet.pdf","url":"https://cdn..."}],
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

## Data Save Pipeline (3 targets)

### 1. Supabase (PRIMARY — run first)

Script: `~/.claude/skills/impact-rockbros-us-outreach/scripts/ingest-supabase.js`

```bash
node --input-type=module \
  ~/.claude/skills/impact-rockbros-us-outreach/scripts/ingest-supabase.js \
  '<JSON_ARRAY>' '50132' '<TAB_HASH>'
```

**Tables written:**
- `pf.publishers` — COALESCE upsert via `pf.upsert_publisher(jsonb)`
  - Key: `publisher_id = "impact-{partner_id}"`
  - `email` ← `contact_email` (NEVER overwritten with null)
  - `contact_name`, `contact_role` (NEVER overwritten with null)
  - Arrays/JSON: only overwrite if new value non-empty
- `pf.program_publishers` — upsert on `(program_id=5, publisher_id)`
- `pf.publisher_intel` — INSERT new row per event (full snapshot)

**COALESCE rule** (verified in DB 2026-04-30):
Running upsert with `contact_email=null` preserves existing `jkopac@me.com`. ✓

### 2. Obsidian Ledger (dedup key)

File: `LEDGER`
Format (pipe-delimited, ONE Edit per batch):
```
{name}|{contact_email or "email_missing"}|{YYYY-MM-DD}|impact-50132|{partner_id}|{status}|{partner_size}|{website}|{contact_name}
```

### 3. Obsidian Publisher Intel

File: `INTEL_DB`
Format (ONE Edit per batch, one block per publisher):
```markdown
## {name} — {YYYY-MM-DD}
- **Publisher ID**: impact-{partner_id} | **Network ID**: {partner_id}
- **Status**: {status} | **Size**: {partner_size} | **Model**: {business_model}
- **Contact Name**: {contact_name or "name_missing"}
- **Contact Role**: {contact_role}
- **Contact Email**: {contact_email or "email_missing"}
- **All Contacts**: {JSON of all_contacts}
- **Address**: {corporate_address}
- **Language**: {language} | **Currency**: {currency}
- **Website**: {website} | **Verified**: {verified}
- **Semrush**: {semrush_global_rank} | **Visitors/mo**: {monthly_visitors}
- **Moz DA**: {moz_domain_authority} | **Moz Spam**: {moz_spam_score}
- **Description**: {first 300 chars}
- **Categories**: {legacy_categories_full joined ", "}
- **Tags**: {tags_full joined ", "}
- **Media Kits**: {media_kit_urls names}
- **Social**: {social_properties urls}
- **Term**: {termText} ✓{termVerified} | **Date**: ✓{dateVerified}
---
```

## Proposal Form Architecture

Proposal uses an **iframe** (`iframe[src*="send-proposal"]`). All form elements inside iframe.

- Term selection: `page.mouse.click()` at absolute coords — only method that triggers React
- Date selection: same pattern
- Submit: `page.mouse.click()`
- Success signal: "I understand" click causes page navigation (nav-catch pattern)

## Token Rules

1. **NEVER `browser_snapshot`** during outreach — zero exceptions
2. **ALWAYS `browser_run_code`** — never `browser_evaluate` (no `page` access)
3. **ONE `browser_run_code` per batch** — up to TARGET cards
4. **Supabase FIRST**, then Obsidian
5. **COALESCE** — never write null over existing email/contact
6. **Contract date = tomorrow** — always dynamic
