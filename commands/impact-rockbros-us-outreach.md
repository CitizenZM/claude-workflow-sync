---
description: "Impact Rockbros US proposal sending (Haiku). Run /impact-rockbros-us-setup first.
  Usage: /impact-rockbros-us-outreach [count]
  Default: /impact-rockbros-us-outreach 500"
model: haiku
---

## Pre-flight (autonomous — aborts, never prompts)
- Model: **haiku** only. If Opus/Sonnet → print `⛔ Wrong model — run /model haiku then re-run /impact-rockbros-us-outreach` and exit.
- MCP: `mcp__playwright-impact-rockbros-us__*` exclusively (profile `~/.claude/browser-profiles/impact-rockbros-us`, port 9306). Fallback to generic `mcp__playwright__*` = forbidden.
- Supervisor: provided by `/impact-rockbros-us-setup`. If missing this session, spawn via `~/.claude/skills/_shared/outreach-supervisor-prompt.md` before Step 0.
- Checkpoint `/tmp/outreach-impact-rockbros-us-checkpoint.json`: every 10 confirmed proposals → batch-write all data → write checkpoint → message supervisor → apply verdict autonomously. Never wait for user input.

program_id=50132 | count=500 | target_per_page=20
login: affiliate@celldigital.co / Celldigital2024*
scripts: ~/.claude/skills/impact-rockbros-us-outreach/scripts/
ledger: /Volumes/workssd/ObsidianVault/01-Projects/Impact-Rockbros-US-Outreach-Ledger.md
intel_db: /Volumes/workssd/ObsidianVault/01-Projects/Impact-Rockbros-US-Publisher-Intel.md
report: /Volumes/workssd/ObsidianVault/01-Projects/Impact-Rockbros-US-Outreach-Report-DYNAMIC_DATE.md
obsidian_workflow: /Volumes/workssd/ObsidianVault/01-Projects/Impact-Rockbros-US-Outreach.md
template_term: Rockbros USA Performance (highest-commission term available)
contract_date: DYNAMIC — always use tomorrow's date: `new Date(Date.now()+86400000).toISOString().slice(0,10)`
msg: "Hi, this is Bob Zabel, reaching out from Rockbros, the NO.1 sports accessory you must see. We are offering 10–20% ultra-high commission with a limited-time deal offer. Reply here or email affiliate@celldigital.co to chat in detail and get a sample."

## Step 0: Browser Check (START HERE)
`mcp__playwright-impact-rockbros-us__browser_evaluate`: `() => document.title` — confirm on Impact.
If not on Impact: navigate to discover URL, snapshot once for login.

## Step 1: Dedup + Propose (browser_run_code — NOT browser_evaluate)

**CRITICAL**: `browser_run_code` only — the v5 script uses `page.locator()` for a11y-tree slideout scraping and `page.mouse.click()` for proposal iframe. Neither works with `browser_evaluate`.

1a. Read ledger (create if missing), parse names into dedup array from rows containing `impact-50132`.

1b. Calculate CONTRACT_DATE: `new Date(Date.now()+86400000).toISOString().slice(0,10)`

1c. Calculate REPORT_DATE: `new Date().toISOString().slice(0,10)`

1d. Get DISCOVER_URL via `browser_evaluate: () => location.href`

1e. Read `bulk-proposal.js`. Replace ALL placeholders inline before passing to browser_run_code:
  - `"%%DISCOVER_URL%%"` → `"<current URL>"`
  - `"%%MSG%%"` → `"<msg string>"`
  - `"%%CONTRACT_DATE%%"` → `"<tomorrow>"`
  - `%%ALREADY%%` → `JSON.stringify(dedup array)` (no quotes — it's an array literal)
  - `%%TARGET%%` → `20`

Run via `mcp__playwright-impact-rockbros-us__browser_run_code`.

**Returns full publisher intel:**
```json
{
  "total": N,
  "errorCount": N,
  "publishers": [{
    "name": "...",
    "partner_id": "...",
    "status": "Active|New|Pending",
    "partner_size": "Extra Large|Large|Medium|Small",
    "business_model": "Network|Content|...",
    "description": "...",
    "contact_name": "...",
    "contact_role": "Marketplace Contact",
    "contact_email": "...",
    "language": "English",
    "promotional_areas": [],
    "corporate_address": "City, STATE United States of America",
    "content_categories": [],
    "legacy_categories": ["Apparel...", ...],
    "tags": ["gaming", ...],
    "media_kit_urls": [{"name":"...", "url":"..."}],
    "currency": "USD",
    "website": "https://...",
    "learn_more_url": "https://...",
    "social_properties": [{"url":"...", "text":"..."}],
    "verified": false,
    "scraped_at": "YYYY-MM-DD",
    "termVerified": true,
    "termText": "...",
    "dateVerified": true,
    "proposal_sent": true
  }],
  "errors": []
}
```

## Step 2: Save All Data (ONE batch write per page — never per-row)

### 2a. Ledger row (dedup key — pipe-delimited)
Append to `ledger` in a SINGLE Edit, one row per publisher:
```
name|contact_email|YYYY-MM-DD|impact-50132|partner_id|status|partner_size|website|contact_name
```
- `contact_email` → use `email_missing` if null, never blank
- `partner_id` → use `id_missing` if null

### 2b. Publisher Intel Database
Append to `intel_db` in a SINGLE Edit. Each publisher gets a full block:
```markdown
## [name] — [YYYY-MM-DD]
- **Partner ID**: [partner_id]
- **Status**: [status] | **Size**: [partner_size] | **Model**: [business_model]
- **Contact**: [contact_name] · [contact_role] · [contact_email]
- **Address**: [corporate_address]
- **Language**: [language] | **Currency**: [currency]
- **Website**: [website]
- **Verified**: [verified]
- **Description**: [description — first 200 chars]
- **Legacy Categories**: [legacy_categories joined with ", "]
- **Tags**: [tags joined with ", "]
- **Media Kits**: [media_kit_urls — names only]
- **Social Properties**: [social_properties — urls]
- **Promo Areas**: [promotional_areas joined with ", " or "None"]
- **Term**: [termText] (verified: [termVerified]) | **Date verified**: [dateVerified]
---
```

### 2c. Report row
Append to `report` (pipe table) in a SINGLE Edit:
```
| name | contact_email | contact_name | partner_id | status | partner_size | website | tags | date |
```

### 2d. Checkpoint (every 10)
Write `/tmp/outreach-impact-rockbros-us-checkpoint.json`:
```json
{
  "batch_n": N,
  "total": N,
  "errorCount": N,
  "rows": [...full publisher objects...],
  "error_samples": [...],
  "local_signal": "OK|DEGRADED"
}
```
→ message supervisor → apply verdict autonomously.

## Step 3: Next Page + Loop
Run `next-page.js` via `mcp__playwright-impact-rockbros-us__browser_evaluate`.
- `{ok:true}` → re-run Step 1+2 until count reached
- `{ok:false}` → done, go to Step 4

## Step 4: Final Report + Obsidian Sync
4a. Write final report with: totals, term_verified rate, date_verified rate, intel capture rate, full table.

4b. **Obsidian Workflow Sync** — append to `obsidian_workflow`:
```markdown
## Session YYYY-MM-DD
- Proposals sent: [N] | Errors: [errorCount]
- Emails captured: [N]/[N] | Websites captured: [N]/[N]
- Term verified: [N]% | Date verified: [N]%
- Intel fields avg: [avg non-null fields per publisher]/20
- Top publishers: [name · size · model · website for top 5]
```

4c. Verify ledger row count matches `total` sent this session.

## Auto-Recovery
If browser_run_code fails 2×: write checkpoint with `local_signal: "DEGRADED"`, request supervisor verdict, apply fix once. Do NOT spawn second Opus agent.

## Rules
1. NEVER snapshot except login
2. ALWAYS browser_run_code (NOT browser_evaluate) for proposals — v5 uses page.locator() which requires page access
3. Save ALL 20 intel fields per publisher — not just name/email
4. ONE Edit per batch for ledger, ONE Edit per batch for intel_db, ONE Edit per batch for report
5. FULLY AUTONOMOUS — no stops, no prompts, no questions
6. termVerified must be true to count as success
7. Contract date always = tomorrow, calculated fresh at runtime
