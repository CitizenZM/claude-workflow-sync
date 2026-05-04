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

## AUTO-RECOVERY — OPUS SUPERVISOR (FULLY AUTONOMOUS, NO PAUSING)

Opus is the always-on supervisor. It fires automatically on ANY of these triggers. Never stops the outer loop — always continues after fixing.

### Trigger 1: browser_run_code fails (Haiku returns total=0 + error)
Sonnet spawns Opus immediately:
```
Agent(model:"opus", description:"Rockbros bug fix — tab {tab_num}", prompt:
"You are the Rockbros auto-recovery supervisor. browser_run_code failed on tab {tab_num}.
MCP: mcp__playwright-impact-rockbros-us__
Error: {error_message}

Fix autonomously — no questions, no pausing:
1. Run bash ~/.claude/scripts/outreach/init-workflow.sh impact-rockbros-us playwright-impact-rockbros-us 9306
2. browser_navigate to: {DISCOVER_URL}
3. Wait 3s, check cards: browser_evaluate → () => document.querySelectorAll('.iui-card').length
4. If cards > 0: re-run browser_run_code with tab_current.js content
5. Return result JSON or {\"total\":0,\"error\":\"opus_recovery_failed\",\"sent\":[],\"errors\":[\"unfixable\"]}
")
```
Use Opus result as the tab result. If Opus also returns 0: skip tab, continue to next.

### Trigger 2: MCP server disconnected (tool calls fail with connection error)
Sonnet runs directly (no agent spawn needed):
```bash
bash ~/.claude/scripts/outreach/init-workflow.sh impact-rockbros-us playwright-impact-rockbros-us 9306
```
Wait 5s. Re-navigate to current tab URL. Retry Haiku for that tab.

### Trigger 3: tab_current.js has remaining %% placeholders
Sonnet re-builds the script from bulk-proposal.js before spawning Haiku.
Never pass a script with unresolved placeholders to Haiku.

### Trigger 4: 2 consecutive Haiku failures on same tab
Spawn Opus with full diagnostic authority:
```
Agent(model:"opus", description:"Rockbros tab {tab_num} — 2 consecutive failures", prompt:
"Two consecutive Haiku failures on tab {tab_num} ({tab_name}). Diagnose and fix end-to-end.
MCP: mcp__playwright-impact-rockbros-us__
Steps:
1. browser_snapshot to see current page state
2. Check for stuck modals: browser_evaluate → document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))
3. Navigate to {DISCOVER_URL}, wait 3s
4. Verify .iui-card count > 0
5. Read tab_current.js, verify no %% placeholders
6. Run browser_run_code with the script
7. Return result JSON
No permission prompts. Fix whatever is broken and return results.")
```

### Trigger 5: All 6 tabs return 0 proposals (session total = 0)
Opus diagnoses session-level issue:
```
Agent(model:"opus", description:"Rockbros — zero proposals all tabs", prompt:
"Zero proposals sent across all 6 tabs. Diagnose.
MCP: mcp__playwright-impact-rockbros-us__
1. browser_navigate https://app.impact.com — check if still logged in
2. If login page: re-authenticate (affiliate@celldigital.co / Celldigital2024*)
3. Navigate to Content/Reviews tab, verify cards load
4. Run browser_run_code with tab_current.js
5. Report what was wrong and how many proposals sent")
```

## RULES
1. NEVER snapshot except during Opus diagnostic recovery
2. ALL browser calls use `mcp__playwright-impact-rockbros-us__` — no other namespace
3. Ledger + intel_db + report written by Sonnet after each Haiku returns
4. Each Haiku: exactly 2 tool calls (Read + browser_run_code)
5. FULLY AUTONOMOUS — zero permission prompts, zero user questions, zero model confirmations
6. Contract date always calculated fresh at runtime (never hardcoded)
7. Dedup by publisher NAME (lowercase) from ledger col 1 — not by email
8. TARGET per tab = remaining count (COUNT - session_sent), not capped
9. Opus only for bug recovery — never supervision of successful runs (saves tokens)
10. Sonnet loops continuously until COUNT reached or all 6 tabs exhausted — no exit until done
