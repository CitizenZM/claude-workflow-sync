---
description: "Awin Rockbros US — Full workflow. Sonnet loop + pre-built Haiku per page (Option A). Usage: /awin-rockbros-us [count]"
model: sonnet
---

# Awin Rockbros US — Unified Outreach Workflow (Option A)

**Harness**: Sonnet owns setup + page loop. Fresh Haiku per page — zero context accumulation.
**MCP**: `mcp__playwright-awin-rockbros-us__` for ALL browser calls
**Fully autonomous**: no stops, no model-switch prompts, no user questions

---

## CONFIG
```
merchant_id : 58007
filters     : auto-tiered (setup-filters.js selects T1→T4 by partnership quality)
count       : $ARGUMENTS (default 500)
commission  : 20.0
min_part    : 5
target_pp   : 25
login       : affiliate@celldigital.co / Celldigital2024*
scripts     : ~/.claude/skills/awin-publisher-outreach/scripts/
ledger      : ~/Library/Mobile Documents/iCloud~md~obsidian/Documents/ObsidianVault/01-Projects/Awin-Outreach-Ledger.md
report      : ~/Library/Mobile Documents/iCloud~md~obsidian/Documents/ObsidianVault/01-Projects/Awin-Rockbros-Publisher-Outreach.md
msg         : "Hi, this is Bob Zabel, reaching out from Rockbros, the NO.1 sports accessory you must see. We are offering 10-20% ultra-high commission with a limited-time deal offer. Reply here or email affiliate@celldigital.co to chat in detail and get a sample."
```

---

## PHASE 1 — SETUP (Sonnet)

### Step 1: Navigate + Login
1. `mcp__playwright-awin-rockbros-us__browser_navigate` → `https://ui.awin.com/awin/merchant/58007/affiliate-directory/index/tab/notInvited`
2. `mcp__playwright-awin-rockbros-us__browser_snapshot` ONCE — detect login form vs directory
3. If login form: `browser_type` email → click Continue → `browser_type` password → click Sign In
4. Wait for directory page to load

### Step 2: Filter + Sort (ONE evaluate)
Read `~/.claude/skills/awin-publisher-outreach/scripts/setup-filters.js` verbatim.
Run via `mcp__playwright-awin-rockbros-us__browser_evaluate`.
Returns `{tier, filters:[{id,label}], perPage, rows, sortVerified, firstPartnership, above50}`.
Verify: perPage=40, rows>0, sortVerified=true. Log tier selected.
If sortVerified=false: reload + retry once.

### Step 3: Preflight
Print: `"✓ Rockbros US ready: {rows} publishers, tier={tier}, first={firstPartnership}. Starting Option A loop..."`

---

## PHASE 2 — SONNET PAGE LOOP (Option A)

**Sonnet runs this loop. Fresh Haiku per page — pre-built script, exactly 1 tool call.**

### Loop Init
```
COUNT        = $ARGUMENTS or 500
session_sent = 0
page_num     = 1
```

### Per-Page Sequence:

**A. Build dedup — Sonnet reads ledger:**
Extract names where merchant_id=58007 → `DEDUP_JSON = [...]`

**B. Pre-build script + spawn Haiku:**
Sonnet builds complete async function string:
1. Inline `window.__DEDUP = {DEDUP_JSON}` at top
2. Replace `%%MSG%%` → message | `%%COMM%%` → `"20.0"` | `%%TARGET%%` → `25` | `%%MIN_PARTNERSHIPS%%` → `5`
Source: `~/.claude/skills/awin-publisher-outreach/scripts/bulk-invite-opt-a.js`

Invoke Agent tool:
- `model`: `"haiku"`
- `description`: `"Rockbros US page {page_num} — up to 25 invites"`
- `prompt`: PER-PAGE HAIKU PROMPT below with `{page_num}` and `{SCRIPT}` filled in

**C. Parse Haiku result:**
Haiku returns `{total, publishers:[{name,type,partnerships}], skippedLowQuality}`.
Append each publisher to ledger: `name||YYYY-MM-DD|58007`
`session_sent += total`

**D. Next page:**
Run `~/.claude/skills/awin-publisher-outreach/scripts/next-page.js` via `mcp__playwright-awin-rockbros-us__browser_evaluate`.
`{ok:false}` → FINAL REPORT. `{ok:true}` → `page_num++`, continue.

Repeat until `session_sent >= COUNT` or no next page.

---

## PER-PAGE HAIKU PROMPT

```
You are the Awin Rockbros US per-page invite agent (page {page_num}).
MCP: mcp__playwright-awin-rockbros-us__
Browser is logged in, correct page, dedup pre-injected in script.

TASK: Call browser_evaluate EXACTLY ONCE with the function below. Output JSON result. Stop.

Call mcp__playwright-awin-rockbros-us__browser_evaluate with:
function: {SCRIPT}

Output the JSON result as your final message:
{"page":{page_num},"total":<n>,"publishers":[...],"skippedLowQuality":<n>}

HARD RULES:
- EXACTLY 1 tool call. Zero others.
- Do NOT read files. Do NOT snapshot. Do NOT navigate. Do NOT verify anything.
- Trust the script. Run it. Return the result.
```

---

## FINAL REPORT

```
=== Awin Rockbros US — Session Complete (Option A) ===
Model:    haiku per-page / sonnet loop
Merchant: 58007
Pages:    {page_num}
Sent:     {session_sent} invites this session
Ledger:   {grand_total} total all-time
Next run: /awin-rockbros-us
======================================================
```

## AUTO-RECOVERY
If `browser_evaluate` fails 2×: spawn Agent(model:"opus") to diagnose+fix, then resume. Never stop.

## RULES
1. NEVER snapshot except login
2. Ledger written by Sonnet after each Haiku returns
3. Each Haiku: exactly 1 evaluate call — pre-built script with dedup inline
4. FULLY AUTONOMOUS
