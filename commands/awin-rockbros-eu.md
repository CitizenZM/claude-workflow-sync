---
description: "Awin Rockbros EU — Full workflow. Sonnet loop + pre-built Haiku per page (Option A). Usage: /awin-rockbros-eu [count]"
model: sonnet
---

# Awin Rockbros EU — Unified Outreach Workflow (Option A)

**Harness**: Sonnet owns setup + page loop. Fresh Haiku per page — zero context accumulation.
**MCP**: `mcp__playwright-awin-rockbros-eu__` for ALL browser calls
**Fully autonomous**: no stops, no model-switch prompts, no user questions

---

## CONFIG
```
merchant_id : 122456
filters     : auto-tiered (setup-filters.js selects T1→T4 by partnership quality)
count       : $ARGUMENTS (default 500)
commission  : 20.0
min_part    : 5
target_pp   : 25
login       : affiliate@celldigital.co / Celldigital2024*
scripts     : ~/.claude/skills/awin-rockbros-eu-outreach/scripts/
ledger      : ~/Library/Mobile Documents/iCloud~md~obsidian/Documents/ObsidianVault/01-Projects/Awin-Rockbros-EU-Outreach-Ledger.md
report      : ~/Library/Mobile Documents/iCloud~md~obsidian/Documents/ObsidianVault/01-Projects/Awin-Rockbros-EU-Outreach-Report-2026-04-15.md
msg         : "Hallo, hier ist Bob Zabel von Rockbros – der Nr. 1 Sportmarke, die Sie unbedingt kennen sollten. Wir bieten eine besonders hohe Provision von 10–20 % im Rahmen eines zeitlich begrenzten Angebots. Antworten Sie hier oder schreiben Sie an affiliate@celldigital.co, um Details zu besprechen und ein Muster zu erhalten."
```

---

## PHASE 1 — SETUP (Sonnet)

### Step 1: Navigate + Login
1. `mcp__playwright-awin-rockbros-eu__browser_navigate` → `https://ui.awin.com/awin/merchant/122456/affiliate-directory/index/tab/notInvited`
2. `mcp__playwright-awin-rockbros-eu__browser_snapshot` ONCE — detect login form vs directory
3. If login form: `browser_type` email → click Continue → `browser_type` password → click Sign In
4. Wait for directory page to load

### Step 2: Filter + Sort (ONE evaluate)
Read `~/.claude/skills/awin-rockbros-eu-outreach/scripts/setup-filters.js` verbatim.
Run via `mcp__playwright-awin-rockbros-eu__browser_evaluate`.
Returns `{tier, filters:[{id,label}], perPage, rows, sortVerified, firstPartnership, above50}`.
Verify: perPage=40, rows>0, sortVerified=true. Log tier selected.
If sortVerified=false: reload + retry once.

### Step 3: Preflight
Print: `"✓ Rockbros EU ready: {rows} publishers, tier={tier}, first={firstPartnership}. Starting Option A loop..."`

---

## PHASE 2 — SONNET PAGE LOOP (Option A)

### Loop Init
```
COUNT        = $ARGUMENTS or 500
session_sent = 0
page_num     = 1
```

### Per-Page Sequence:

**A. Build dedup — Sonnet reads ledger:**
Extract names where merchant_id=122456 → `DEDUP_JSON = [...]`

**B. Pre-build script + spawn Haiku:**
Sonnet builds complete async function string:
1. Inline `window.__DEDUP = {DEDUP_JSON}` at top
2. Replace `%%MSG%%` → German message | `%%COMM%%` → `"20.0"` | `%%TARGET%%` → `25` | `%%MIN_PARTNERSHIPS%%` → `5`
Source: `~/.claude/skills/awin-rockbros-eu-outreach/scripts/bulk-invite-opt-a.js`

Invoke Agent tool:
- `model`: `"haiku"`
- `description`: `"Rockbros EU page {page_num} — up to 25 invites"`
- `prompt`: PER-PAGE HAIKU PROMPT below with `{page_num}` and `{SCRIPT}` filled in

**C. Parse Haiku result:**
Append each publisher to ledger: `name||YYYY-MM-DD|122456`
`session_sent += total`

**D. Next page:**
Run `~/.claude/skills/awin-rockbros-eu-outreach/scripts/next-page.js` via `mcp__playwright-awin-rockbros-eu__browser_evaluate`.
`{ok:false}` → FINAL REPORT. `{ok:true}` → `page_num++`, continue.

---

## PER-PAGE HAIKU PROMPT

```
You are the Awin Rockbros EU per-page invite agent (page {page_num}).
MCP: mcp__playwright-awin-rockbros-eu__
Browser is logged in, correct page, dedup pre-injected in script.

TASK: Call browser_evaluate EXACTLY ONCE with the function below. Output JSON result. Stop.

Call mcp__playwright-awin-rockbros-eu__browser_evaluate with:
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
=== Awin Rockbros EU — Session Complete (Option A) ===
Model:    haiku per-page / sonnet loop
Merchant: 122456
Pages:    {page_num}
Sent:     {session_sent} invites this session
Ledger:   {grand_total} total all-time
Next run: /awin-rockbros-eu
======================================================
```

## AUTO-RECOVERY
If `browser_evaluate` fails 2×: spawn Agent(model:"opus") to diagnose+fix, then resume.

## RULES
1. NEVER snapshot except login
2. German message must be preserved exactly in pre-built script
3. Ledger written by Sonnet after each Haiku returns
4. Each Haiku: exactly 1 evaluate call
5. FULLY AUTONOMOUS
