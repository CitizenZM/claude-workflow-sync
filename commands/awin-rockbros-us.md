---
description: "Awin Rockbros US — Full workflow. Sonnet login+setup → Haiku bulk invite loop. No manual model switch. Usage: /awin-rockbros-us [count]"
model: sonnet
---

# Awin Rockbros US — Unified Outreach Workflow

**Harness**: Sonnet (Phase 1: login + filter + sort) → Haiku subagent (Phase 2: bulk invite loop)
**MCP**: `mcp__playwright-awin-rockbros-us__` for ALL browser calls
**Fully autonomous**: no stops, no model-switch prompts, no user questions

---

## CONFIG
```
merchant_id : 58007
filters     : 25,15,22
count       : $ARGUMENTS (default 500)
commission  : 20.0
min_part    : 50
target_pp   : 25
login       : affiliate@celldigital.co / Celldigital2024*
scripts     : ~/.claude/skills/awin-publisher-outreach/scripts/
ledger      : /Volumes/workssd/ObsidianVault/01-Projects/Awin-Outreach-Ledger.md
report      : /Volumes/workssd/ObsidianVault/01-Projects/Awin-Rockbros-Publisher-Outreach.md
msg         : "Hi, this is Bob Zabel, reaching out from Rockbros, the NO.1 sports accessory you must see. We are offering 10-20% ultra-high commission with a limited-time deal offer. Reply here or email affiliate@celldigital.co to chat in detail and get a sample."
```

---

## PHASE 1 — SETUP (Sonnet)

### Step 1: Navigate + Login
1. `mcp__playwright-awin-rockbros-us__browser_navigate` → `https://ui.awin.com/awin/merchant/58007/affiliate-directory/index/tab/notInvited`
2. `mcp__playwright-awin-rockbros-us__browser_snapshot` ONCE — detect login form vs directory
3. If login form: `browser_type` email → click Continue → `browser_type` password → click Sign In
4. Wait for directory page

### Step 2: Filter + Sort (ONE evaluate)
Read `~/.claude/skills/awin-publisher-outreach/scripts/setup-filters.js`, replace `FILTER_IDS` → `['25','15','22']`, run via `mcp__playwright-awin-rockbros-us__browser_evaluate`.
Returns `{filters, perPage, rows}`. Verify: perPage=40, rows>0.

### Step 3: Sort Verify (ONE evaluate)
```js
() => {
  const rows = document.querySelectorAll('tr[data-publisher-id]');
  const first = rows[0]?.querySelector('td:nth-child(3)')?.textContent?.trim();
  return { rows: rows.length, firstPartnership: first };
}
```
If first < 50: click sort header, wait 4s, re-check. If still fails: reload + re-run Step 2.

### Step 4: Preflight Report
Print: `"✓ Rockbros US setup: {rows} publishers, sort verified (first={firstPartnership}). Spawning Haiku outreach loop..."`

---

## PHASE TRANSITION — Spawn Haiku Subagent

**Immediately after Step 4 — do NOT pause.** Read ledger for dedup:
```
Read /Volumes/workssd/ObsidianVault/01-Projects/Awin-Outreach-Ledger.md
Extract names where merchant_id=58007 → DEDUP_JSON
Resolve COUNT from $ARGUMENTS (default 500)
```

Invoke Agent tool:
- `model`: `"haiku"`
- `description`: `"Awin Rockbros US bulk invite — {COUNT} target"`
- `prompt`: PHASE 2 SUBAGENT PROMPT below with `{COUNT}` and `{DEDUP_JSON}` filled in

---

## PHASE 2 SUBAGENT PROMPT

```
You are the Awin Rockbros US bulk invite agent running on Haiku.
Browser is already logged in on MCP: mcp__playwright-awin-rockbros-us__
Page is at the Awin Affiliate Directory for merchant 58007.

CONFIG:
merchant_id=58007 | commission=20.0 | min_partnerships=50 | target_per_page=25
session_target={COUNT}
scripts=~/.claude/skills/awin-publisher-outreach/scripts/
ledger=/Volumes/workssd/ObsidianVault/01-Projects/Awin-Outreach-Ledger.md
report=/Volumes/workssd/ObsidianVault/01-Projects/Awin-Rockbros-Publisher-Outreach.md
msg="Hi, this is Bob Zabel, reaching out from Rockbros, the NO.1 sports accessory you must see. We are offering 10-20% ultra-high commission with a limited-time deal offer. Reply here or email affiliate@celldigital.co to chat in detail and get a sample."
already_contacted={DEDUP_JSON}

MCP prefix for ALL browser calls: mcp__playwright-awin-rockbros-us__

## STEP 0: Browser Check
browser_evaluate: `() => document.title` — confirm on Awin.
If not: navigate to https://ui.awin.com/awin/merchant/58007/affiliate-directory/index/tab/notInvited, snapshot once for login.

## STEP 1: Dedup + Invite (SEPARATE evaluate call)
1a. Read ledger, parse names for merchant_id=58007 → merge with already_contacted.
1b. Read bulk-invite.js. Replace placeholders inline:
    %%MSG%% → msg | %%COMM%% → "20.0" | %%ALREADY%% → dedup JSON | %%TARGET%% → 25 | %%MIN_PARTNERSHIPS%% → 50
Returns: {total, skippedLowQuality, publishers:[{name,type,partnerships,publisherId}]}
If skippedLowQuality > 0 → sort failed, reload+re-sort.

## STEP 2: Save
2a. Append to ledger: name|email|YYYY-MM-DD|58007
2b. Append to report (write-only).

## STEP 3: Next Page
Run next-page.js. If {ok:false} → go to REPORT.

## STEP 4: Every 20 invites — re-read ledger, rebuild dedup.

## STEP 5: Repeat until session_target reached or no pages.

## REPORT
=== Awin Rockbros US — Session Complete ===
Model:    haiku (setup: sonnet)
Merchant: 58007
Sent:     {session_total} invites
Ledger:   {grand_total} total
Next run: /awin-rockbros-us
==========================================

## AUTO-RECOVERY
If browser_evaluate fails 2x: spawn Agent(model:"opus") to diagnose+fix, then resume.

## RULES
1. NEVER snapshot except login | 2. Dedup before invite | 3. Record every invite | 4. Separate setup+invite evaluates | 5. FULLY AUTONOMOUS
```

---

## POST-SUBAGENT (Sonnet)
Print subagent summary verbatim. Ledger and report already updated by subagent.
