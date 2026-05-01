---
description: "Rockbros outreach — direct Sonnet execution, inline code, no sub-agents. Usage: /rockbros-run [tab_num]"
model: sonnet
---

# Rockbros Outreach — Direct Sonnet Execution

You are running the Impact Rockbros US affiliate outreach loop directly. NO sub-agents. NO `filename` parameter. ONLY inline `code` to `mcp__playwright-impact-rockbros-us__browser_run_code`.

## Why direct execution

The previous Haiku-per-tab architecture broke because the Agent tool cannot pass inline code to MCPs, and the `filename` parameter on this MCP loads the wrong file (template, not substituted). The only reliable path is: Sonnet reads the pre-built tab script as a string, then passes it as the `code` argument inline.

## Pre-flight assumptions

- Browser session `mcp__playwright-impact-rockbros-us__` is logged in.
- Pre-built tab scripts exist at `/Users/xiaozuo/.claude/skills/impact-rockbros-us-outreach/scripts/tab{1..6}_ready.js`. They have all `%%` tokens already substituted.
- Ledger lives at `/Users/xiaozuo/Documents/Obsidian Vault/01-Projects/Impact-Rockbros-US-Outreach-Ledger.md`.

## Tab map

| N | businessModels | Description       |
|---|----------------|-------------------|
| 1 | CONTENT_REVIEWS | Content & Reviews |
| 2 | DEAL_COUPON     | Deal & Coupon     |
| 3 | EMAIL_NEWSLETTER| Email & Newsletter|
| 4 | LOYALTY_REWARDS | Loyalty & Rewards |
| 5 | NETWORK         | Network           |
| 6 | (none = home)   | All Partners      |

## Execution loop (per tab)

For tab N starting from `$ARGUMENTS` (default 1) through 6:

### Step 1 — Read the tab script as a STRING

Use the Read tool on `/Users/xiaozuo/.claude/skills/impact-rockbros-us-outreach/scripts/tab{N}_ready.js`. Capture the full file content.

### Step 2 — Invoke browser_run_code with INLINE code

Call `mcp__playwright-impact-rockbros-us__browser_run_code` with parameter `code` = the entire file content as a string. DO NOT pass `filename`. DO NOT pass any other parameters.

The script returns `{ total, target, sent: [...], errors: [...], seen_count }`.

### Step 3 — Append `sent` rows to the ledger

For each entry in `sent[]`, append a markdown table row:

```
| {name} | impact-50132-{partner_id} | {contact_email or ""} | {term} | {contract_date} | {sent_at} |
```

Use the Edit tool (read ledger first, then add rows under the existing table). If the ledger lacks a table header, write one.

### Step 4 — Log summary

Print: `Tab {N}: sent {total}/{target}, errors {len(errors)}, top errors: {first 3 reasons}`.

### Step 5 — Move to next tab

Repeat steps 1–4 for tab N+1 until tab 6 done OR cumulative `sent` count this session reaches a stop condition (set by user input).

### Step 6 — Opus supervision every 50 sent

After every 50 cumulative `sent` proposals across tabs in this session, spawn `Agent(model:"opus")` with this brief:

> Review the last 50 proposals appended to `/Users/xiaozuo/Documents/Obsidian Vault/01-Projects/Impact-Rockbros-US-Outreach-Ledger.md`. Spot-check 5 entries: confirm partner_id is non-empty, contact_email looks valid (or empty), term is "Public Terms" or similar, sent_at is today. Flag duplicates, malformed rows, or systematic errors. Return a one-paragraph health check.

Wait for the supervisor reply before continuing. If supervisor flags a problem, STOP and surface to the user.

## Failure handling

- If `total` is 0 for a tab and `errors[]` shows a repeated `step` (e.g., all `no-iframe`), STOP. Do not advance. Surface to user with the error array.
- If `total` < target/2 with mostly `meta: no-partner-id` errors, the dedup list may be polluting good cards — STOP and inspect.
- 3 consecutive tabs with `total` < 5 → STOP, architectural problem.

## Rebuilding tab scripts mid-run

If the user updates the master `bulk-proposal.js` or wants the dedup list refreshed, re-run the Python tab-builder (it lives in the original task brief / setup skill). The builder reads ledger names with `grep impact-50132` and bakes them into each tab's `ALREADY` array.

## Output

At the end of the session, report:
- Total proposals sent this session
- Per-tab breakdown (sent/target/errors)
- Cumulative ledger size (count of `impact-50132` rows)
- Any STOP conditions hit
