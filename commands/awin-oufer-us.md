---
description: "Awin Oufer US — Full workflow. Sonnet login+setup → Haiku bulk invite loop. No manual model switch. Usage: /awin-oufer-us [count]"
model: sonnet
---

# Awin Oufer US — Unified Outreach Workflow

**Harness**: Sonnet (Phase 1: login + filter + sort) → Haiku subagent (Phase 2: bulk invite loop)
**MCP**: `mcp__playwright-awin-oufer-us__` for ALL browser calls
**Fully autonomous**: no stops, no model-switch prompts, no user questions

---

## CONFIG
```
merchant_id : 91941
filters     : 25,15,22
count       : $ARGUMENTS (default 500)
commission  : 20.0
min_part    : 50
target_pp   : 25
login       : affiliate@celldigital.co / Celldigital2024*
scripts     : ~/.claude/skills/awin-oufer-us-outreach/scripts/
ledger      : /Volumes/workssd/ObsidianVault/01-Projects/Awin-Oufer-US-Outreach-Ledger.md
report      : /Volumes/workssd/ObsidianVault/01-Projects/Awin-Oufer-US-Outreach-Report-2026-04-15.md
msg         : "Hi, this is Bob Zabel, reaching out from Oufer Body Jewelry, the NO.1 Piercing Body Jewelry you MUST see. We are offering 10-20% ultra high commission with limited time deal offer, Reply here or to affiliate@celldigital.co to chat in details and get the sample. REPLY now for limited time offer."
```

---

## PHASE 1 — SETUP (Sonnet)

### Step 1: Navigate + Login
1. `mcp__playwright-awin-oufer-us__browser_navigate` → `https://ui.awin.com/awin/merchant/91941/affiliate-directory/index/tab/notInvited`
2. `mcp__playwright-awin-oufer-us__browser_snapshot` ONCE — detect login form vs directory
3. If login form: `browser_type` email → click Continue → `browser_type` password → click Sign In
4. Wait for directory page to load (title contains "Affiliate Directory")

### Step 2: Filter + Sort (ONE evaluate)
Read `~/.claude/skills/awin-oufer-us-outreach/scripts/setup-filters.js`, replace `FILTER_IDS` → `['25','15','22']`, run via `mcp__playwright-awin-oufer-us__browser_evaluate`.
Returns `{filters, perPage, rows}`. Verify: perPage=40, rows>0.

### Step 3: Sort Verify (ONE evaluate)
```js
() => {
  const rows = document.querySelectorAll('tr[data-publisher-id]');
  const first = rows[0]?.querySelector('td:nth-child(3)')?.textContent?.trim();
  return { rows: rows.length, firstPartnership: first };
}
```
If first partnership < 50: click sort header once, wait 4s, re-check. If still fails, reload + re-run Step 2.

### Step 4: Preflight Report
Print: `"✓ Oufer US setup: {rows} publishers, sort verified (first={firstPartnership}). Spawning Haiku outreach loop..."`

---

## PHASE TRANSITION — Spawn Haiku Subagent

**Immediately after Step 4 — do NOT pause.** Count ledger lines for dedup:
```
Read ledger, extract names for merchant_id 91941 into JSON array → DEDUP_JSON
Resolve COUNT from $ARGUMENTS (default 500)
```

Then invoke the Agent tool:
- `model`: `"haiku"`
- `description`: `"Awin Oufer US bulk invite — {COUNT} target"`
- `prompt`: the PHASE 2 SUBAGENT PROMPT below with `{COUNT}` and `{DEDUP_JSON}` filled in

---

## PHASE 2 SUBAGENT PROMPT (fill values before spawning)

```
You are the Awin Oufer US bulk invite agent running on Haiku.
The browser is already logged in and ready on MCP: mcp__playwright-awin-oufer-us__
Page is at the Awin Affiliate Directory for merchant 91941.

CONFIG:
merchant_id=91941 | commission=20.0 | min_partnerships=50 | target_per_page=25
session_target={COUNT}
scripts=~/.claude/skills/awin-oufer-us-outreach/scripts/
ledger=/Volumes/workssd/ObsidianVault/01-Projects/Awin-Oufer-US-Outreach-Ledger.md
report=/Volumes/workssd/ObsidianVault/01-Projects/Awin-Oufer-US-Outreach-Report-2026-04-15.md
msg="Hi, this is Bob Zabel, reaching out from Oufer Body Jewelry, the NO.1 Piercing Body Jewelry you MUST see. We are offering 10-20% ultra high commission with limited time deal offer, Reply here or to affiliate@celldigital.co to chat in details and get the sample. REPLY now for limited time offer."
already_contacted={DEDUP_JSON}

MCP prefix for ALL browser calls: mcp__playwright-awin-oufer-us__

## STEP 0: Browser Check
browser_evaluate: `() => document.title` — confirm on Awin.
If not: navigate to https://ui.awin.com/awin/merchant/91941/affiliate-directory/index/tab/notInvited, snapshot once for login.

## STEP 1: Dedup + Invite (SEPARATE evaluate call)
1a. Read ledger, parse names for merchant_id=91941 into dedup array (merge with already_contacted above).
1b. Read bulk-invite.js. Replace placeholders inline before browser_evaluate (isolated scope — no globals):
    %%MSG%% → msg | %%COMM%% → "20.0" | %%ALREADY%% → dedup JSON | %%TARGET%% → 25 | %%MIN_PARTNERSHIPS%% → 50
Returns: {total, skippedLowQuality, publishers:[{name,type,partnerships,publisherId}]}
If skippedLowQuality > 0 on first batch → sort failed, reload+re-sort before continuing.

## STEP 2: Save
2a. Append to ledger: name|email|YYYY-MM-DD|91941
2b. Append to report (write-only, never read back).

## STEP 3: Next Page
Run next-page.js via browser_evaluate. If {ok:false} → done, go to REPORT.

## STEP 4: Every 20 invites — re-read ledger, rebuild dedup array.

## STEP 5: Repeat STEP 1→4 until session_target reached or no pages.

## REPORT: print this summary
=== Awin Oufer US — Session Complete ===
Model:    haiku (setup: sonnet)
Merchant: 91941
Sent:     {session_total} invites this session
Ledger:   {grand_total} total all-time
Next run: /awin-oufer-us (ledger deduplicates automatically)
=========================================

## AUTO-RECOVERY
If browser_evaluate fails 2x or workflow stuck: spawn Agent(model:"opus") to diagnose+fix (re-login, re-navigate, re-sort), then resume loop. Never stop. Always recover.

## RULES
1. NEVER snapshot except login
2. Dedup before every invite batch
3. Record every invite to ledger immediately
4. ALWAYS split setup+invite into separate evaluate calls
5. FULLY AUTONOMOUS — no permission prompts, no user questions, no stopping
```

---

## POST-SUBAGENT (Sonnet)

After the Haiku subagent returns, print its summary verbatim. No further action needed — ledger and report are updated by the subagent.
