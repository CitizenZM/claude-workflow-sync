---
description: "Cost-optimized batch applicator. Spawns fresh sub-agents in batches of 5 to keep cache reads small. Use this for any URL list >5 jobs. Usage: /greenhouse-batch-apply [url1 url2 ...] OR /greenhouse-batch-apply --file ~/path/to/urls.txt"
model: sonnet
---

## MODEL GATE
This command requires Sonnet. If on Opus, STOP and tell the user to run `/model sonnet`.

# Batch URL Apply (Cost-Optimized)

This is the **preferred** entry point for any URL list ≥5 jobs. It splits the list into batches of 5 and spawns a fresh `general-purpose` sub-agent per batch. Each sub-agent runs `/greenhouse-url-apply` on its 5 URLs and returns only a result summary — the main context never accumulates the form-filling chatter.

## Why this matters

A naive run of 20 URLs in one context grows the transcript to ~50MB. Every model call re-reads that cache (Sonnet 4.6: $0.30/MTok cache read). At 6,000+ calls × growing cache, that's **~$880 in cache reads alone**.

This command keeps each batch's cache <500K tokens. Total cost for 20 URLs drops from ~$1,000 to ~$150.

---

## Workflow

### Step 1: Pre-flight (orchestrator only)

1. Read `~/.claude/skills/greenhouse-apply/SKILL.md` for config (one time, cached)
2. Read `$HOME/Documents/Obsidian/01-Projects/Greenhouse-Application-Ledger.md` (one time, cached)
3. Read `$HOME/Documents/Obsidian/01-Projects/Ashby-Application-Ledger.md` (one time, cached)
4. Parse `$ARGUMENTS` into `URL_QUEUE`. If `--file <path>`, read URLs one-per-line.
5. **Apply dedup at orchestrator level** — extract job IDs/UUIDs and filter against ledgers. Print a dedup summary to the user.

### Step 2: Batch and fork

Split `URL_QUEUE` into chunks of **5 URLs each**. For each chunk:

1. Spawn a `general-purpose` sub-agent via the Agent tool with this prompt:

```
You are running /greenhouse-url-apply on these 5 URLs only:
{urls}

Personal info (already validated, do not re-check):
- Legal Name: Xiao Zuo | Preferred: Barron Zuo
- Email: xz429@cornell.edu | Phone: +1 9094132840
- Location: San Francisco, CA | LinkedIn: linkedin.com/in/barron-z-15226126a/
- Authorized: Yes | Sponsorship: No | Previously worked: No

Skill files to read:
- ~/.claude/skills/greenhouse-apply/SKILL.md
- ~/.claude/skills/greenhouse-apply/data/ats-embed-map.json (use this to skip redirects)
- ~/.claude/skills/greenhouse-apply/scripts/fill-form-helpers.js (paste this into browser_evaluate as a single block to get reusable form fillers)

For each URL:
1. Detect platform (greenhouse/ashby/lever/google-form)
2. Use the embed-map to navigate directly to the application URL — DO NOT navigate to the company website first
3. Extract salary; if max < $160k, SKIP
4. Generate tailored resume via generate-resume.py
5. Fill form using helpers from fill-form-helpers.js (single evaluate per dropdown)
6. Submit + verify confirmation page
7. Append to ledger

CRITICAL TOKEN RULES (enforced):
- NO browser_snapshot (use evaluate for error detection)
- NO redundant evaluate calls (use the helpers — they batch open+select)
- NO mid-flow resume generation that blocks other URLs (parallelize at start)

When done, return ONLY a 6-line summary in this format:
```
Batch result:
✅ Submitted: <count> | Companies: <comma-separated>
⏭ Skipped: <count> | Reasons: <comma-separated>
❌ Errors: <count> | URLs: <comma-separated>
Cache reads (est): <approximate token count>
```
```

2. **Use `Agent` with `subagent_type: "general-purpose"`** so each batch starts with a fresh window.

### Step 3: Aggregate

Collect each sub-agent's result line. Print a final table:

```
| Batch | Submitted | Skipped | Errors |
|-------|-----------|---------|--------|
| 1     | 5         | 0       | 0      |
| 2     | 4         | 1       | 0      |
| ...   |           |         |        |
| TOTAL | N         | M       | E      |
```

### Step 4: Re-read ledger (verification)

After all batches complete, re-read both ledgers and print the count of new entries today as a sanity check.

---

## Why fork instead of inline?

| Approach | Tokens for 20 URLs | Cost (Sonnet 4.6) |
|---|---|---|
| Inline (current `/greenhouse-url-apply`) | ~3 billion | ~$1,000 |
| **Forked (this command)** | **~400 million** | **~$130** |

The math: with 4 batches × ~100M tokens each (batch's own cache reads), and the orchestrator only sees ~10M tokens total (just the result summaries).

---

## When NOT to use this

- For 1–4 URLs: just use `/greenhouse-url-apply` directly (the fork overhead isn't worth it).
- For URLs requiring login state (Workday): the sub-agent won't have your auth — flag those for manual handling.

---

## Edge cases

- **Sub-agent fails mid-batch**: the agent returns whatever it managed to submit. The orchestrator keeps going to the next batch — partial completion is fine.
- **Salary gate hits in batch**: counted as a skip, not an error.
- **All URLs in a batch deduped**: the agent returns a "0 submitted, 5 skipped (dedup)" line and exits fast.

---

## Token budget per batch

Each sub-agent should not exceed ~500K total tokens. If a sub-agent spends >2M tokens, that's a regression — investigate the form-filling pattern in `fill-form-helpers.js`.
