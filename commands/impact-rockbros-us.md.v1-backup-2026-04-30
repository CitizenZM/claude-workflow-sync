---
description: "Impact Rockbros US — Full workflow. Sonnet login+setup+tab-loop → pre-built Haiku per tab. Usage: /impact-rockbros-us [count]"
model: sonnet
---

# Impact Rockbros US — Unified Outreach Workflow

**Architecture**: Sonnet owns login + filter setup + tab loop. Fresh Haiku per tab — 1 `browser_run_code` call.
**MCP**: `mcp__playwright-impact-rockbros-us__` for ALL browser calls (port 9306).
**Fully autonomous**: no stops, no prompts.

---

## CONFIG
```
program_id     : 50132
db_program_id  : 5
count          : $ARGUMENTS (default 500)
target_per_tab : 20
login          : affiliate@celldigital.co / Celldigital2024*
scripts        : ~/.claude/skills/impact-rockbros-us-outreach/scripts/
ledger         : /Volumes/workssd/ObsidianVault/01-Projects/Impact-Rockbros-US-Outreach-Ledger.md
intel_db       : /Volumes/workssd/ObsidianVault/01-Projects/Impact-Rockbros-US-Publisher-Intel.md
obsidian       : /Volumes/workssd/ObsidianVault/01-Projects/Impact-Rockbros-US-Outreach.md
msg            : "Hi, this is Bob Zabel, reaching out from Rockbros, the NO.1 sports accessory you must see. We are offering 10–20% ultra-high commission with a limited-time deal offer. Reply here or email affiliate@celldigital.co to chat in detail and get a sample."
contract_date  : DYNAMIC — new Date(Date.now()+86400000).toISOString().slice(0,10)
```

---

## PHASE 1 — SETUP (Sonnet)

### Step 0: Init isolation
```bash
bash ~/.claude/scripts/outreach/init-workflow.sh impact-rockbros-us playwright-impact-rockbros-us 9306
```
If exit code 2: stop and show JSON for `~/.claude.json`.

### Step 1: Login
1. `browser_navigate` → `https://app.impact.com`
2. `browser_snapshot` ONCE for login form
3. Fill credentials via `browser_evaluate`, click Sign In
4. If Google chooser: click "Cell Affiliate Team affiliate@celldigital.co" → "Continue"

### Step 2: Navigate + Filters
Navigate to:
```
https://app.impact.com/secure/advertiser/discover/radius/fr/partner_discover.ihtml?page=marketplace&slideout_id_type=partner#businessModels=home&locationCountryCode=US&sortBy=reachRating&sortOrder=DESC
```
Wait 3s, click "Content / Reviews" tab, then apply filters:
```js
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clickOpts = async (btnText, opts) => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === btnText);
    if (!btn) return; btn.click(); await sleep(1000);
    for (const opt of opts) {
      const el = Array.from(document.querySelectorAll('li,label,[class*="option"],[class*="item"]'))
        .find(e => e.textContent.trim() === opt || e.textContent.trim().includes(opt));
      if (el) { el.click(); await sleep(300); }
    }
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); await sleep(400);
  };
  await clickOpts('Status',['Active','New']);
  await clickOpts('Partner Size',['Medium','Large','Extra Large']);
  await clickOpts('Categories',['Sports','Health & Fitness','Outdoors & Nature','Consumer Electronics','Cycling']);
  await clickOpts('Promotional Areas',['United States']);
  return 'filters applied';
}
```

### Step 3: Preflight check
```js
() => ({ cards: document.querySelectorAll('.discovery-card').length, url: location.href })
```
If cards=0: re-apply filters. Print: `"✓ Rockbros US ready: {N} cards"`

---

## PHASE 2 — TAB LOOP (Sonnet orchestrates, Haiku executes)

**Tab order (6 tabs):**
| # | Tab | Hash |
|---|-----|------|
| 1 | Content / Reviews | `CONTENT_REVIEWS` |
| 2 | Deal / Coupons | `DEAL_COUPON` |
| 3 | Email / Newsletter | `EMAIL_NEWSLETTER` |
| 4 | Loyalty / Rewards | `LOYALTY_REWARDS` |
| 5 | Network | `NETWORK` |
| 6 | All Partners | click "All Partners" button |

**Loop init:** `COUNT = $ARGUMENTS or 500 | session_sent = 0 | tab_num = 1`

### Per-Tab Sequence:

**A. Build dedup**
Read `ledger`, parse names from rows containing `impact-50132` → `DEDUP_JSON = [...]`

**B. Calculate dates**
```js
CONTRACT_DATE = new Date(Date.now()+86400000).toISOString().slice(0,10)
REPORT_DATE   = new Date().toISOString().slice(0,10)
```

**C. Get DISCOVER_URL**
```js
() => location.href
```

**D. Build script + spawn Haiku**
Sonnet reads `bulk-proposal.js`, replaces ALL placeholders inline:
- `"%%DISCOVER_URL%%"` → `"<current URL>"`
- `"%%MSG%%"` → `"<msg string>"`
- `"%%CONTRACT_DATE%%"` → `"<tomorrow>"`
- `%%ALREADY%%` → `JSON.stringify(DEDUP_JSON)` (no quotes — it's an array)
- `%%TARGET%%` → `Math.min(20, COUNT - session_sent)`

Invoke Agent:
- `model`: `"haiku"`
- `description`: `"Rockbros US tab {tab_num}"`
- `prompt`: PER-TAB HAIKU PROMPT below

**E. Save all intel (4 targets, ONE pass per tab)**

Haiku returns full publisher objects. Sonnet writes:

**E1 — Supabase (FIRST, PRIMARY):**
```bash
node --input-type=module \
  ~/.claude/skills/impact-rockbros-us-outreach/scripts/ingest-supabase.js \
  '<JSON.stringify(publishers)>' '50132' '<TAB_HASH>'
```
- `pf.publishers` — COALESCE upsert: `email`/`contact_name`/`contact_role` NEVER overwritten with null
- `pf.program_publishers` — outreach event upsert
- `pf.publisher_intel` — full snapshot INSERT

**E2 — Ledger (dedup key, ONE Edit):**
```
{name}|{contact_email or "email_missing"}|{YYYY-MM-DD}|impact-50132|{partner_id}|{status}|{partner_size}|{website}|{contact_name}
```

**E3 — Publisher Intel DB (ONE Edit):**
```markdown
## {name} — {YYYY-MM-DD}
- **Publisher ID**: impact-{partner_id} | **Network ID**: {partner_id}
- **Status**: {status} | **Size**: {partner_size} | **Model**: {business_model}
- **Contact Name**: {contact_name or "name_missing"}
- **Contact Role**: {contact_role}
- **Contact Email**: {contact_email or "email_missing"}
- **All Contacts**: {JSON all_contacts}
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

`session_sent += total`

**F. Next tab:** Navigate to next hash. Wait 3s. `tab_num++`.

Stop when `session_sent >= COUNT` or all 6 tabs exhausted.

---

## PER-TAB HAIKU PROMPT

```
You are the Impact Rockbros US per-tab proposal agent (tab {tab_num}).
MCP: mcp__playwright-impact-rockbros-us__
Browser is logged in and on the Rockbros discover page.

TASK: Call browser_run_code EXACTLY ONCE with the script below. Return complete JSON. Stop.

Call mcp__playwright-impact-rockbros-us__browser_run_code with:
code: {SCRIPT}

Output the complete raw JSON as your ONLY message:
{
  "tab": {tab_num},
  "total": <n>,
  "errorCount": <n>,
  "publishers": [{
    "name":"...", "partner_id":"...", "status":"...", "partner_size":"...", "business_model":"...",
    "description":"...",
    "contact_name":"...", "contact_role":"Marketplace Contact", "contact_email":"...",
    "all_contacts":[{"name":"...","role":"...","email":"...","initials":"..."}],
    "language":"...", "promotional_areas":[], "corporate_address":"...",
    "content_categories":[], "legacy_categories":[], "legacy_categories_full":[],
    "tags":[], "tags_full":[],
    "media_kit_urls":[{"name":"...","url":"..."}], "media_kit_count":0,
    "currency":"...", "website":"...", "learn_more_url":"...",
    "social_properties":[{"url":"...","text":"..."}], "verified":null,
    "semrush_global_rank":null, "monthly_visitors":null,
    "moz_spam_score":null, "moz_domain_authority":null,
    "scraped_at":"...", "termVerified":true, "termText":"...", "dateVerified":true, "proposal_sent":true
  }],
  "errors": []
}

HARD RULES:
- EXACTLY 1 tool call — browser_run_code only.
- Do NOT snapshot. Do NOT navigate. Do NOT browser_evaluate.
- Return ALL fields including contact_name, contact_email, all_contacts.
- contact_email = null if Properties tab failed to load — never omit the field.
- If errors: {"tab":{tab_num},"total":0,"errorCount":1,"publishers":[],"errors":["run_code_failed"]}
```

---

## FINAL REPORT + OBSIDIAN SYNC

Console summary:
```
=== Impact Rockbros US — Session Complete ===
Program  : 50132
Tabs     : {tab_num}
Sent     : {session_sent}
Emails   : {emails_captured}/{session_sent} ({pct}%)
Contacts : {contacts_captured}/{session_sent}
DB rows  : publishers={updated} intel={intelRows}
Errors   : {total_errors}
=============================================
```

Append to `obsidian`:
```markdown
## Session YYYY-MM-DD
- Proposals: {session_sent} | Errors: {total_errors}
- Email captured: {emails}/{session_sent} | Contact name: {names}/{session_sent}
- Websites: {websites}/{session_sent} | Verified: {verified}/{session_sent}
- DB: publishers={updated} intel={intelRows}
- Top 5: [{name} · {contact_email} · {website}]
```

---

## AUTO-RECOVERY
If Haiku returns `total=0` with errors: Sonnet spawns `Agent(model:"opus")` to diagnose + retry once.

## RULES
1. NEVER snapshot except login
2. ALL browser calls: `mcp__playwright-impact-rockbros-us__`
3. Supabase FIRST, Obsidian SECOND
4. contact_email + contact_name REQUIRED in every record — write "email_missing"/"name_missing" never blank
5. COALESCE — existing email/contact never overwritten with null
6. ONE `browser_run_code` per tab, ONE Supabase call per tab, ONE Edit per file per tab
7. FULLY AUTONOMOUS
