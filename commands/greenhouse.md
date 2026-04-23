---
description: "Greenhouse.io Jobs — Full workflow. Sonnet login+queue → Sonnet apply loop → Haiku report. No manual model switch. Usage: /greenhouse [job_title_filter]"
model: sonnet
---

# Greenhouse — Unified Job Application Workflow

**Harness**: Sonnet (Phase 1: login + queue) → Sonnet subagent (Phase 2: apply loop) → Haiku subagent (Phase 3: report)
**Fully autonomous**: no stops, no model-switch prompts, no user questions

---

## CONFIG
```
filter    : $ARGUMENTS (optional job title keyword, e.g. "Marketing Manager")
ledger    : ~/greenhouse-ledger.md (create if missing)
resume    : read from ~/.claude/skills/greenhouse-apply/resume/ or ask once
scripts   : ~/.claude/skills/greenhouse-apply/scripts/
```

---

## PHASE 1 — LOGIN + QUEUE BUILD (Sonnet)

### Step 1: Read Skills
Read `~/.claude/skills/greenhouse-apply/` to understand available resume templates and apply scripts.

### Step 2: Login
Follow `~/.claude/skills/greenhouse-apply/` setup instructions exactly — navigate to Greenhouse, authenticate, land on job listings.

### Step 3: Build Job Queue
Search for jobs matching filter (or "all" if no $ARGUMENTS).
Build QUEUE = array of `{title, company, url, jobId}` objects for jobs not already in ledger.
Print: `"✓ Queue: {N} new jobs to apply. Starting apply loop..."`

---

## PHASE TRANSITION → Apply Loop

**Immediately after Step 3 — do NOT pause.** Read ledger for dedup:
```
Read ~/greenhouse-ledger.md → ALREADY_APPLIED_IDS
```

Invoke Agent tool:
- `model`: `"sonnet"`
- `description`: `"Greenhouse apply loop — {N} jobs"`
- `prompt`: PHASE 2 SUBAGENT PROMPT below with QUEUE and ALREADY_APPLIED_IDS filled in

---

## PHASE 2 SUBAGENT PROMPT

```
You are the Greenhouse job application agent running on Sonnet.
Apply to each job in the queue with a tailored resume and cover letter.

QUEUE={QUEUE_JSON}
already_applied={ALREADY_APPLIED_IDS}
ledger=~/greenhouse-ledger.md
scripts=~/.claude/skills/greenhouse-apply/scripts/

## FOR EACH JOB in QUEUE:
1. Navigate to job URL
2. Read job description carefully
3. Tailor resume and cover letter to match JD keywords and requirements
4. Fill application form using ~/.claude/skills/greenhouse-apply/ apply instructions
5. Submit application
6. Append to ledger: jobId|company|title|YYYY-MM-DD|applied
7. Print: "✓ Applied: {title} at {company}"

## After all jobs complete, return a JSON summary:
{
  "applied": [{title, company, jobId, date}],
  "skipped": [{title, company, reason}],
  "errors": [{title, company, error}]
}

## RULES
1. Tailor every application — no generic submissions
2. Record every attempt to ledger (success or fail)
3. FULLY AUTONOMOUS — no stops, no questions
```

---

## PHASE TRANSITION → Report

After Phase 2 subagent returns, immediately invoke Agent tool:
- `model`: `"haiku"`
- `description`: `"Greenhouse application report"`
- `prompt`: PHASE 3 SUBAGENT PROMPT below with Phase 2 results filled in

---

## PHASE 3 SUBAGENT PROMPT

```
You are the Greenhouse report agent running on Haiku.
Generate a clean application session report.

SESSION_RESULTS={PHASE2_RESULT_JSON}
ledger=~/greenhouse-ledger.md

## Read ledger, count total all-time applications.

## Generate report:

=== Greenhouse — Session Complete ===
Date:       {today}
Model:      sonnet (apply) → haiku (report)
Applied:    {applied_count} jobs
Skipped:    {skipped_count}
Errors:     {error_count}
Ledger:     {grand_total} total all-time

Applied this session:
{table: title | company | date}

Next run: /greenhouse [filter]
=====================================
```

---

## POST-SUBAGENT (Sonnet)
Print Phase 3 report verbatim.
