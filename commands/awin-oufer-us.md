---
description: "Awin Oufer US — Full workflow. Sonnet login+setup+page-loop → fresh Haiku per page (Option A: window.__DEDUP). Usage: /awin-oufer-us [count]"
model: sonnet
---

# Awin Oufer US — Unified Outreach Workflow (Option A)

**Harness**: Sonnet owns setup + page loop. Fresh Haiku per page — zero context accumulation.
**MCP**: `mcp__playwright-awin-oufer-us__` for ALL browser calls
**Fully autonomous**: no stops, no model-switch prompts, no user questions

---

## CONFIG
```
merchant_id : 91941
filters     : auto-tiered (setup-filters.js selects T1→T4 by partnership quality)
count       : $ARGUMENTS (default 500)
commission  : 20.0
min_part    : 5
target_pp   : 25
login       : affiliate@celldigital.co / Celldigital2024*
scripts     : ~/.claude/skills/awin-oufer-us-outreach/scripts/
ledger      : ~/Library/Mobile Documents/iCloud~md~obsidian/Documents/ObsidianVault/01-Projects/Awin-Oufer-US-Outreach-Ledger.md
report      : ~/Library/Mobile Documents/iCloud~md~obsidian/Documents/ObsidianVault/01-Projects/Awin-Oufer-US-Outreach-Report-2026-04-15.md
msg         : "Hi, this is Bob Zabel, reaching out from Oufer Body Jewelry, the NO.1 Piercing Body Jewelry you MUST see. We are offering 10-20% ultra high commission with limited time deal offer, Reply here or to affiliate@celldigital.co to chat in details and get the sample. REPLY now for limited time offer."
```

---

## PHASE 1 — SETUP (Sonnet)

### Step 1: Navigate + Login
1. `mcp__playwright-awin-oufer-us__browser_navigate` → `https://ui.awin.com/awin/merchant/91941/affiliate-directory/index/tab/notInvited`
2. `mcp__playwright-awin-oufer-us__browser_snapshot` ONCE — detect login form vs directory
3. If login form: `browser_type` email → click Continue → `browser_type` password → click Sign In
4. Wait for directory page to load

### Step 2: Filter + Sort (ONE evaluate)
Read `~/.claude/skills/awin-oufer-us-outreach/scripts/setup-filters.js` verbatim (no placeholder replacement needed — fully self-contained).
Run via `mcp__playwright-awin-oufer-us__browser_evaluate`.
Returns `{tier, filters:[{id,label}], perPage, rows, sortVerified, firstPartnership, above50}`.
Verify: perPage=40, rows>0, sortVerified=true. Log which tier was selected.
If sortVerified=false: reload + retry Step 2 once.

### Step 3: Preflight
Print: `"✓ Oufer US ready: {rows} publishers, first={firstPartnership} partnerships. Starting Option A loop..."`

---

## PHASE 2 — SONNET PAGE LOOP (Option A)

**Do NOT spawn one big Haiku. Sonnet runs this loop — fresh Haiku per page.**

### Loop Init
```
COUNT       = $ARGUMENTS or 500
session_sent = 0
page_num     = 1
```

### Per-Page Sequence (repeat until session_sent >= COUNT or no next page):

**A. Build dedup — Sonnet reads ledger:**
```
Read ledger file, extract all names where merchant_id=91941.
Build JSON array: DEDUP_JSON = ["Name One","Name Two",...]
```

**B. Inject into window.__DEDUP — ONE tiny evaluate:**
Read `~/.claude/skills/awin-oufer-us-outreach/scripts/dedup-inject.js`.
Replace `DEDUP_ARRAY` with actual DEDUP_JSON array literal.
Run via `mcp__playwright-awin-oufer-us__browser_evaluate`.
Expected: `{ok:true, count:N}` — confirms window.__DEDUP is live.

**C. Spawn fresh Haiku for this page:**
Invoke Agent tool:
- `model`: `"haiku"`
- `description`: `"Oufer US page {page_num} — up to 25 invites"`
- `prompt`: the PER-PAGE HAIKU PROMPT below with `{page_num}` filled in

**D. Parse Haiku result:**
Haiku returns JSON: `{total, publishers:[{name,type,partnerships}], skippedLowQuality}`.
- If skippedLowQuality > total*2 on page 1: sort failed — reload, re-run Step 2, restart loop.
- Append each publisher to ledger: `name||YYYY-MM-DD|91941`
- `session_sent += total`

**E. Next page — ONE evaluate:**
Read `~/.claude/skills/awin-oufer-us-outreach/scripts/next-page.js`.
Run via `mcp__playwright-awin-oufer-us__browser_evaluate`.
- If `{ok:false}`: no more pages → go to FINAL REPORT.
- If `{ok:true}`: `page_num++`, continue loop.

---

## PER-PAGE HAIKU PROMPT (fill {page_num} before spawning)

```
You are the Awin Oufer US per-page invite agent (page {page_num}). Running on Haiku.
Browser is already logged in on MCP: mcp__playwright-awin-oufer-us__
The dedup list is already set in window.__DEDUP by Sonnet — do NOT re-read the ledger.

TASK: Invite up to 25 publishers from the current page only. Then return.

STEP 1 — Run invite script (ONE browser_evaluate):
Read file: ~/.claude/skills/awin-oufer-us-outreach/scripts/bulk-invite-opt-a.js
Replace these placeholders before running:
  %%MSG%%              → "Hi, this is Bob Zabel, reaching out from Oufer Body Jewelry, the NO.1 Piercing Body Jewelry you MUST see. We are offering 10-20% ultra high commission with limited time deal offer, Reply here or to affiliate@celldigital.co to chat in details and get the sample. REPLY now for limited time offer."
  %%COMM%%             → "20.0"
  %%TARGET%%           → 25
  %%MIN_PARTNERSHIPS%% → 5
Run via mcp__playwright-awin-oufer-us__browser_evaluate.

STEP 2 — Return result:
Parse the JSON returned by the evaluate. Output it directly as your final message:
{"page":{page_num},"total":<n>,"publishers":[...],"skippedLowQuality":<n>}

RULES:
- ONE browser_evaluate call only
- NO browser_snapshot
- NO ledger reads or writes (Sonnet handles ledger)
- FULLY AUTONOMOUS — complete and return immediately
```

---

## FINAL REPORT (Sonnet prints after loop ends)

```
=== Awin Oufer US — Session Complete (Option A) ===
Model:    haiku per-page / sonnet loop
Merchant: 91941
Pages:    {page_num}
Sent:     {session_sent} invites this session
Ledger:   {grand_total} total all-time
Next run: /awin-oufer-us (ledger deduplicates automatically)
===================================================
```

## AUTO-RECOVERY
If `browser_evaluate` fails 2× on any step: spawn Agent(model:"opus") to diagnose and fix (re-login, re-navigate, re-sort), then resume loop at current page. Never stop. Always recover.

## RULES
1. NEVER snapshot except login (Step 1)
2. window.__DEDUP injected fresh before EVERY page's Haiku spawn
3. Ledger written by Sonnet after each Haiku returns (not by Haiku)
4. Each Haiku: exactly 1 evaluate + 0 Bash calls — lean context, zero thrashing
5. FULLY AUTONOMOUS — no permission prompts, no user questions
