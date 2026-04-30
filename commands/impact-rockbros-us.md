---
description: "Impact Rockbros US — Full workflow. Sonnet login+setup+tab-loop → pre-built Haiku per tab. Usage: /impact-rockbros-us [count]"
model: sonnet
---

# Impact Rockbros US — Unified Outreach Workflow

**Harness**: Sonnet owns login + filter setup + tab loop. Fresh Haiku per tab — pre-built script, 1 tool call per tab.
**MCP**: `mcp__playwright-impact-rockbros-us__` for ALL browser calls
**Fully autonomous**: no stops, no model-switch prompts, no user questions

---

## CONFIG
```
program_id     : 50132
count          : $ARGUMENTS (default 500)
target_per_tab : 20
template_term  : Rockbros USA Performance (highest-commission term)
login          : affiliate@celldigital.co / Celldigital2024*
scripts        : ~/.claude/skills/impact-rockbros-us-outreach/scripts/
ledger         : /Volumes/workssd/ObsidianVault/01-Projects/Impact-Rockbros-US-Outreach-Ledger.md
intel_db       : /Volumes/workssd/ObsidianVault/01-Projects/Impact-Rockbros-US-Publisher-Intel.md
report         : /Volumes/workssd/ObsidianVault/01-Projects/Impact-Rockbros-US-Outreach-Report-DYNAMIC_DATE.md
obsidian       : /Volumes/workssd/ObsidianVault/01-Projects/Impact-Rockbros-US-Outreach.md
msg            : "Hi, this is Bob Zabel, reaching out from Rockbros, the NO.1 sports accessory you must see. We are offering 10–20% ultra-high commission with a limited-time deal offer. Reply here or email affiliate@celldigital.co to chat in detail and get a sample."
contract_date  : DYNAMIC — new Date(Date.now()+86400000).toISOString().slice(0,10)
```

---

## PHASE 1 — SETUP (Sonnet)

### Step 0: Init isolation
```
bash ~/.claude/scripts/outreach/init-workflow.sh impact-rockbros-us playwright-impact-rockbros-us 9306
```
If exit code 2, STOP and show the printed JSON for `~/.claude.json`.

### Step 1: Login
1. `mcp__playwright-impact-rockbros-us__browser_navigate` → `https://app.impact.com`
2. `mcp__playwright-impact-rockbros-us__browser_snapshot` ONCE for login form
3. Fill credentials via `browser_evaluate`:
```js
async () => {
  const email = document.querySelector('input[name="username"],input[type="email"]');
  const pass = document.querySelector('input[name="password"],input[type="password"]');
  if (email) { const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(email,'affiliate@celldigital.co'); email.dispatchEvent(new Event('input',{bubbles:true})); }
  if (pass) { const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(pass,'Celldigital2024*'); pass.dispatchEvent(new Event('input',{bubbles:true})); }
  Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Sign In')?.click();
  return 'submitted';
}
```
4. If Google account chooser appears: click "Cell Affiliate Team affiliate@celldigital.co" → "Continue"

### Step 2: Navigate to Discover + Apply Filters
Navigate: `https://app.impact.com/secure/advertiser/discover/radius/fr/partner_discover.ihtml?page=marketplace&slideout_id_type=partner#businessModels=home&locationCountryCode=US&sortBy=reachRating&sortOrder=DESC`

Wait 3s. Click "Content / Reviews" tab. Then apply filters:
```js
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clickOpts = async (btnText, opts) => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === btnText);
    if (!btn) return;
    btn.click(); await sleep(1000);
    for (const opt of opts) {
      const el = Array.from(document.querySelectorAll('li,label,[class*="option"],[class*="item"]')).find(e => e.textContent.trim() === opt || e.textContent.trim().includes(opt));
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

### Step 3: Verify + Preflight
```js
() => ({ cards: document.querySelectorAll('.discovery-card').length, url: location.href })
```
If cards=0: re-apply filters. Print: `"✓ Rockbros US ready: {N} cards. Starting tab loop..."`

---

## PHASE 2 — SONNET TAB LOOP

**Tab order (6 tabs):**
| # | Tab | Hash fragment |
|---|-----|---------------|
| 1 | Content / Reviews | `businessModels=CONTENT_REVIEWS` |
| 2 | Deal / Coupons | `businessModels=DEAL_COUPON` |
| 3 | Email / Newsletter | `businessModels=EMAIL_NEWSLETTER` |
| 4 | Loyalty / Rewards | `businessModels=LOYALTY_REWARDS` |
| 5 | Network | `businessModels=NETWORK` |
| 6 | All Partners | click "All Partners" button |

**Loop init:** `COUNT = $ARGUMENTS or 500 | session_sent = 0 | tab_num = 1`

### Per-Tab Sequence:

**A. Build dedup — Sonnet reads ledger:**
Parse names from ledger where row ends with `impact-50132` → `DEDUP_JSON = ["name1","name2",...]`
If ledger missing, use `[]`.

**B. Calculate contract date (Sonnet, at runtime):**
`CONTRACT_DATE = new Date(Date.now()+86400000).toISOString().slice(0,10)`

**C. Get current tab URL:**
`DISCOVER_URL = current page URL including hash` — read via:
```js
() => location.href
```

**D. Pre-build proposal script + spawn Haiku:**
Sonnet reads `~/.claude/skills/impact-rockbros-us-outreach/scripts/bulk-proposal.js` then replaces all placeholders inline:
- `%%MSG%%` → the msg from CONFIG (exact string, no escaping changes)
- `%%CONTRACT_DATE%%` → CONTRACT_DATE computed above
- `%%ALREADY%%` → `JSON.stringify(DEDUP_JSON)`
- `%%TARGET%%` → `Math.min(20, COUNT - session_sent)`
- `%%DISCOVER_URL%%` → DISCOVER_URL from above

Invoke Agent tool:
- `model`: `"haiku"`
- `description`: `"Rockbros US tab {tab_num} — up to 20 proposals"`
- `prompt`: PER-TAB HAIKU PROMPT below with `{tab_num}` and `{SCRIPT}` filled in

**E. Parse Haiku result + Save ALL intel (3 writes per batch):**
Haiku returns full publisher objects (20 fields each). Sonnet writes THREE files per tab — all in a single pass:

**Ledger** (dedup key, ONE Edit):
```
name|contact_email|YYYY-MM-DD|impact-50132|partner_id|status|partner_size|website|contact_name
```

**Publisher Intel DB** (`intel_db`, ONE Edit) — full block per publisher:
```markdown
## [name] — [YYYY-MM-DD]
- **Partner ID**: [partner_id] | **Status**: [status] | **Size**: [partner_size] | **Model**: [business_model]
- **Contact**: [contact_name] · [contact_role] · [contact_email]
- **Address**: [corporate_address] | **Language**: [language] | **Currency**: [currency]
- **Website**: [website] | **Verified**: [verified]
- **Description**: [description — first 200 chars]
- **Legacy Categories**: [legacy_categories joined ", "]
- **Tags**: [tags joined ", "]
- **Media Kits**: [media_kit_urls names]
- **Social Properties**: [social_properties urls]
- **Promo Areas**: [promotional_areas or "None"]
- **Term**: [termText] ✓[termVerified] | **Date**: ✓[dateVerified]
---
```

**Report** (`report`, ONE Edit) — pipe table row per publisher:
```
| name | contact_email | contact_name | partner_id | status | partner_size | website | tags | YYYY-MM-DD |
```

`session_sent += total`

**F. Next tab:**
Navigate to next tab hash. Wait 3s.
`tab_num++`, continue loop.

Stop when `session_sent >= COUNT` or all 6 tabs exhausted.

---

## PER-TAB HAIKU PROMPT

```
You are the Impact Rockbros US per-tab proposal agent (tab {tab_num}).
MCP: mcp__playwright-impact-rockbros-us__
Browser is already logged in and on the Rockbros discover page.

TASK: Call browser_run_code EXACTLY ONCE with the script below. Return the full JSON. Stop.

Call mcp__playwright-impact-rockbros-us__browser_run_code with:
code: {SCRIPT}

Output the complete raw JSON as your ONLY message:
{
  "tab": {tab_num},
  "total": <n>,
  "errorCount": <n>,
  "publishers": [{
    "name":"...", "partner_id":"...", "status":"...", "partner_size":"...", "business_model":"...",
    "description":"...", "contact_name":"...", "contact_role":"...", "contact_email":"...",
    "language":"...", "promotional_areas":[], "corporate_address":"...",
    "content_categories":[], "legacy_categories":[], "tags":[],
    "media_kit_urls":[], "currency":"...",
    "website":"...", "learn_more_url":"...", "social_properties":[], "verified":null,
    "scraped_at":"...", "termVerified":true, "termText":"...", "dateVerified":true, "proposal_sent":true
  }],
  "errors": []
}

HARD RULES:
- EXACTLY 1 tool call — browser_run_code only. Zero others.
- Do NOT read files. Do NOT snapshot. Do NOT navigate. Do NOT browser_evaluate.
- The script scrapes ALL publisher intel AND sends proposals. It is self-contained.
- Return the COMPLETE JSON including all 20+ fields per publisher.
- If browser_run_code errors: {"tab":{tab_num},"total":0,"errorCount":1,"publishers":[],"errors":["run_code_failed"]}
```

---

## FINAL REPORT + OBSIDIAN SYNC

After all tabs complete, Sonnet writes:

**Console summary:**
```
=== Impact Rockbros US — Session Complete ===
Program  : 50132
Tabs     : {tab_num}
Sent     : {session_sent} proposals this session
Errors   : {total_errors}
Ledger   : {grand_total_rows} rows total
=============================================
```

**Obsidian sync** — append to `obsidian` path:
```markdown
## Session YYYY-MM-DD
- Proposals sent: {session_sent}
- Intel captured: {publishers_with_email}/{session_sent} emails, {publishers_with_website}/{session_sent} websites
- Intel fields avg: {avg_non_null_fields}/20 per publisher
- Tabs covered: {tab_num}
- Emails captured: {emails_found}/{session_sent}
- Term verified: {term_ok_count}% | Date verified: {date_ok_count}%
- Errors: {total_errors}
- Top publishers: [name1, name2, name3, name4, name5]
```

---

## AUTO-RECOVERY
If Haiku agent fails or returns `total=0` with errors: Sonnet spawns `Agent(model:"opus")` to diagnose and retry that tab once. Never stop the outer loop.

## RULES
1. NEVER snapshot except login
2. ALL browser calls use `mcp__playwright-impact-rockbros-us__` — no other namespace
3. Ledger written by Sonnet after each Haiku returns — ONE Edit per tab
4. Each Haiku: exactly 1 `browser_run_code` call
5. FULLY AUTONOMOUS — no permission prompts, no user questions
6. Contract date always calculated fresh at runtime (never hardcoded)
7. termVerified must be true to count as success
