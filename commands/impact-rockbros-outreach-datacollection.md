---
description: "Impact Rockbros US — Outreach + full publisher data collection. Sonnet login+setup+tab-loop → pre-built Haiku per tab. Usage: /impact-rockbros-outreach-datacollection [count]"
model: sonnet
---

# Impact Rockbros US — Outreach + Data Collection Workflow

**Harness**: Sonnet owns login + filter setup + tab loop. Fresh Haiku per tab — pre-built script, 1 `browser_run_code` call per tab.
**MCP**: `mcp__playwright-impact-rockbros-us__` for ALL browser calls
**Fully autonomous**: no stops, no permission prompts, no user questions, no model-switch confirmations

---

## CONFIG
```
program_id     : 50132
count          : $ARGUMENTS (default 500)
target_per_tab : COUNT (full count per tab, not capped at 20)
mcp            : mcp__playwright-impact-rockbros-us__
login          : affiliate@celldigital.co / Celldigital2024*
scripts_dir    : ~/.claude/skills/impact-rockbros-us-outreach/scripts/
ledger         : ~/Documents/Obsidian Vault/01-Projects/Impact-Rockbros-US-Outreach-Ledger.md
intel_db       : ~/Documents/Obsidian Vault/01-Projects/Impact-Rockbros-US-Publisher-Intel.md
report         : ~/Documents/Obsidian Vault/01-Projects/Impact-Rockbros-US-Outreach-Report-DYNAMIC_DATE.md
obsidian       : ~/Documents/Obsidian Vault/01-Projects/Impact-Rockbros-US-Outreach.md
msg            : "Hi, this is Bob Zabel, reaching out from Rockbros, the NO.1 sports accessory you must see. We are offering 10–20% ultra-high commission with a limited-time deal offer. Reply here or email affiliate@celldigital.co to chat in detail and get a sample."
contract_date  : DYNAMIC — new Date(Date.now()+86400000).toISOString().slice(0,10)
```

---

## PHASE 1 — SETUP (Sonnet)

### Step 0: Init isolation
```bash
bash ~/.claude/scripts/outreach/init-workflow.sh impact-rockbros-us playwright-impact-rockbros-us 9306
```
- Exit 0 or 1 → continue
- Exit 2 → STOP, print the JSON error from `~/.claude.json`

### Step 1: Check login state
Navigate: `mcp__playwright-impact-rockbros-us__browser_navigate` → `https://app.impact.com`

Check URL after navigation:
- If URL contains `impact.com/secure/` → already logged in, skip to Step 2
- If URL contains `login` or `accounts.google.com` → proceed with login:
  1. Snapshot ONCE to detect form type
  2. If Impact login form: fill via `browser_evaluate`:
     ```js
     async () => {
       const email = document.querySelector('input[name="username"],input[type="email"]');
       const pass = document.querySelector('input[name="password"],input[type="password"]');
       const ns = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
       if (email) { ns.call(email,'affiliate@celldigital.co'); email.dispatchEvent(new Event('input',{bubbles:true})); }
       if (pass) { ns.call(pass,'Celldigital2024*'); pass.dispatchEvent(new Event('input',{bubbles:true})); }
       Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Sign In')?.click();
       return 'submitted';
     }
     ```
  3. If Google account chooser appears: click "Cell Affiliate Team affiliate@celldigital.co" → "Continue"

### Step 2: Navigate to Discover page
Navigate: `https://app.impact.com/secure/advertiser/discover/radius/fr/partner_discover.ihtml?page=marketplace&slideout_id_type=partner#businessModels=CONTENT_REVIEWS&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC`

Wait 3s. Verify cards loaded:
```js
() => ({ cards: document.querySelectorAll('.iui-card').length, url: location.href })
```
If cards=0: wait 3s and check again. Print: `"✓ Rockbros US ready: {N} cards. Starting tab loop..."`

---

## PHASE 2 — SONNET TAB LOOP

**Tab order (6 tabs):**
| # | Tab name | URL hash |
|---|----------|----------|
| 1 | Content / Reviews | `#businessModels=CONTENT_REVIEWS&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |
| 2 | Deal / Coupons | `#businessModels=DEAL_COUPON&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |
| 3 | Email / Newsletter | `#businessModels=EMAIL_NEWSLETTER&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |
| 4 | Loyalty / Rewards | `#businessModels=LOYALTY_REWARDS&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |
| 5 | Network | `#businessModels=NETWORK&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |
| 6 | All Partners | `#businessModels=home&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC` |

Base URL: `https://app.impact.com/secure/advertiser/discover/radius/fr/partner_discover.ihtml?page=marketplace&slideout_id_type=partner`

**Loop init:** `COUNT = $ARGUMENTS or 500 | session_sent = 0 | tab_num = 1`

### Per-Tab Sequence:

**A. Build dedup from ledger (Sonnet, Bash):**
```bash
grep 'impact-50132' ~/Documents/Obsidian\ Vault/01-Projects/Impact-Rockbros-US-Outreach-Ledger.md \
  | awk -F'|' '{print $1}' | sed 's/^ *//' | python3 -c "
import sys, json
names = [l.strip().lower() for l in sys.stdin if l.strip()]
print(json.dumps(names))
"
```
Result = `DEDUP_JSON` (array of lowercase names already sent).
If ledger missing or empty, use `[]`.

**B. Calculate contract date:**
```bash
node -e "process.stdout.write(new Date(Date.now()+86400000).toISOString().slice(0,10))"
```
Result = `CONTRACT_DATE`

**C. Navigate to tab URL:**
Navigate to: `BASE_URL + tab_hash`
Wait 3s. Get current URL:
```js
() => location.href
```
Result = `DISCOVER_URL`

**D. Build script by substituting placeholders in bulk-proposal.js:**
Read `~/.claude/skills/impact-rockbros-us-outreach/scripts/bulk-proposal.js`
Replace all placeholders:
- `%%MSG%%` → exact msg string from CONFIG
- `%%CONTRACT_DATE%%` → CONTRACT_DATE
- `%%ALREADY%%` → DEDUP_JSON (raw JSON array, no extra quotes)
- `%%TARGET%%` → `COUNT - session_sent` (remaining target, not capped)
- `%%DISCOVER_URL%%` → DISCOVER_URL

Write result to `/Users/xiaozuo/.claude/skills/impact-rockbros-us-outreach/scripts/tab_current.js`

Verify no remaining `%%` placeholders:
```bash
grep -c '%%' ~/.claude/skills/impact-rockbros-us-outreach/scripts/tab_current.js
```
Must return 0. If not 0, re-read and re-substitute.

**E. Spawn Haiku agent:**

Invoke Agent tool:
- `model`: `"haiku"`
- `description`: `"Rockbros tab {tab_num} ({tab_name}) — {COUNT - session_sent} proposals"`
- `prompt`: PER-TAB HAIKU PROMPT below with `{tab_num}`, `{tab_name}`, `{COUNT - session_sent}` filled in

**F. Parse Haiku result + Write Obsidian (3 files, 1 pass):**

From Haiku JSON, extract `publishers` array. For each publisher object:

**Ledger** — append to ledger file (one line per publisher):
```
{name}|{contact_email}|{YYYY-MM-DD}|impact-50132|{partner_id}|{status}|{partner_size}|{website}|{contact_name}
```

**Intel DB** — append to intel_db file:
```markdown
## {name} — {YYYY-MM-DD}
- **Partner ID**: {partner_id} | **Status**: {status} | **Size**: {partner_size} | **Model**: {business_model}
- **Contact**: {contact_name} · {contact_role} · {contact_email}
- **Address**: {corporate_address} | **Language**: {language} | **Currency**: {currency}
- **Website**: {website} | **Verified**: {verified}
- **Description**: {description — first 200 chars}
- **Legacy Categories**: {legacy_categories_full joined ", "}
- **Tags**: {tags_full joined ", "}
- **Media Kits**: {media_kit_urls joined ", "} (count: {media_kit_count})
- **Social Properties**: {social_properties joined ", "}
- **Promo Areas**: {promotional_areas joined ", " or "None"}
- **All Contacts**: {all_contacts as "name (role) email"}
- **Term**: {termText} ✓{termVerified} | **Date**: ✓{dateVerified}
---
```

**Report** — append to report file (create header first if file missing):
Header: `# Rockbros US Outreach Report — {YYYY-MM-DD}\n\n| Name | Email | Contact | Partner ID | Status | Size | Website | Tags | Date |\n|---|---|---|---|---|---|---|---|---|\n`
Rows: `| {name} | {contact_email} | {contact_name} | {partner_id} | {status} | {partner_size} | {website} | {tags joined ", "} | {YYYY-MM-DD} |`

`session_sent += haiku_result.total`

**G. Tab exhausted check:**
If `haiku_result.total == 0` for 2 consecutive attempts on same tab → move to next tab.

**H. Next tab:**
tab_num++. If `session_sent >= COUNT` → stop loop. If all 6 tabs exhausted → stop.

---

## PER-TAB HAIKU PROMPT

```
You are the Impact Rockbros US per-tab proposal agent (tab {tab_num}: {tab_name}).
MCP: mcp__playwright-impact-rockbros-us__
Browser is already logged in on the Rockbros discover page, tab: {tab_name}.
Target: {remaining} proposals this tab.

TASK: Read the script file, then call browser_run_code ONCE. Return the full JSON. Stop.

Step 1 — Read the script:
Read file: /Users/xiaozuo/.claude/skills/impact-rockbros-us-outreach/scripts/tab_current.js

Step 2 — Call browser_run_code:
mcp__playwright-impact-rockbros-us__browser_run_code with:
  code: <full content of tab_current.js>

Return ONLY the raw JSON result from browser_run_code. No preamble, no explanation.

Expected shape:
{
  "total": <n>,
  "target": <n>,
  "sent": [{"name":"...","partner_id":"...","psi":"...","contact_name":"...","contact_email":"...","term":"...","contract_date":"...","sent_at":"..."}],
  "errors": [...],
  "seen_count": <n>
}

HARD RULES:
- Exactly 2 tool calls total: Read (file) + browser_run_code. Zero others.
- Do NOT snapshot. Do NOT navigate. Do NOT browser_evaluate separately.
- The script handles all proposals, scrolling, and data collection internally.
- If browser_run_code errors: {"total":0,"target":{remaining},"sent":[],"errors":["run_code_failed: <msg>"],"seen_count":0}
```

---

## FINAL REPORT + OBSIDIAN SYNC

After all tabs complete, append to obsidian summary file:
```markdown
## Session {YYYY-MM-DD}
- Proposals sent: {session_sent}
- Publishers with email: {count_with_email}/{session_sent}
- Publishers with website: {count_with_website}/{session_sent}
- Tabs covered: {tabs_completed}/6
- Errors: {total_errors}
- Ledger total: {grep -c 'impact-50132' ledger} rows
- Top 5: {top 5 names by size}
```

Print console summary:
```
=== Impact Rockbros US — Session Complete ===
Program  : 50132
Date     : {YYYY-MM-DD}
Tabs     : {tabs_completed}/6
Sent     : {session_sent} proposals
Errors   : {total_errors}
Ledger   : {total_rows} rows total
=============================================
```

---

## AUTO-RECOVERY (NO PAUSING)

- Haiku returns `total=0` with `errors` containing "run_code_failed":
  → Spawn `Agent(model:"opus")` with: "Diagnose why browser_run_code failed for Rockbros US tab {tab_num}. MCP: mcp__playwright-impact-rockbros-us__. Check: (1) Is the MCP server running? (2) Is the browser still on the discover page? (3) Read the script at /Users/xiaozuo/.claude/skills/impact-rockbros-us-outreach/scripts/tab_current.js and check for syntax errors. Fix the issue and re-run browser_run_code once. Return the same JSON shape."
  → Use Opus result. If still fails, skip tab and continue.

- `tab_current.js` has remaining `%%` placeholders:
  → Re-read `bulk-proposal.js` and redo substitution. Never pass a script with unresolved placeholders to Haiku.

- MCP server disconnected:
  → Run `bash ~/.claude/scripts/outreach/init-workflow.sh impact-rockbros-us playwright-impact-rockbros-us 9306`
  → Wait 5s. Retry current tab.

## RULES
1. NEVER snapshot except to diagnose a broken state
2. ALL browser calls use `mcp__playwright-impact-rockbros-us__` — no other namespace
3. Ledger + intel_db + report written by Sonnet after each Haiku returns
4. Each Haiku: exactly 2 tool calls (Read + browser_run_code)
5. FULLY AUTONOMOUS — no permission prompts, no user questions, no model confirmations
6. Contract date always calculated fresh at runtime (never hardcoded)
7. Dedup by publisher NAME (lowercase) from ledger col 1 — not by email
8. TARGET per tab = remaining count (COUNT - session_sent), not capped at 20
9. Opus only for bug recovery, never for supervision of successful runs
