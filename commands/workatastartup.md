---
description: "Workatastartup.com job application harness — scrape marketing jobs (fulltime + contract), generate tailored pitch, Quick Apply, sync all data to Obsidian. Usage: /workatastartup [count=50]"
model: sonnet
---

# Workatastartup.com Job Application Harness

**Model**: sonnet | **Default count**: 50

## CONTEXT DISCIPLINE (enforced every step)
- NEVER hold full JD text in conversation — scrape-job.js writes it to `/tmp/watas-jd.txt`, read it only when writing the Obsidian note, then discard
- NEVER echo script file contents to conversation — pass script path to browser_run_code, not the content
- After each job: keep only `{company, title, status}` in working state — all other per-job data is discarded
- Do NOT accumulate tool results — summarize inline as one line per job

## CONSTANTS
```
COUNT      = args[0] || 50
SCRIPTS    = /Users/xiaozuo/Projects/workatastartup-apply/scripts
PROFILE    = /Users/xiaozuo/Projects/workatastartup-apply/data/barron-profile.md
OBSIDIAN   = /Volumes/workssd/ObsidianVault/01-Projects/Workatastartup
LEDGER     = /Volumes/workssd/ObsidianVault/01-Projects/Workatastartup/_Ledger.md
CHECKPOINT = /tmp/workatastartup-checkpoint.json
JD_TEMP    = /tmp/watas-jd.txt
TODAY      = new Date().toISOString().slice(0,10)  [calculate once, reuse]
```

---

## PHASE 0 — Pre-flight

**0a. Model gate**: If on Haiku or Opus → print `⛔ Wrong model — /model sonnet then re-run` and STOP.

**0b. Mount check**:
```bash
ls /Volumes/workssd/ObsidianVault/01-Projects/Workatastartup/ 2>/dev/null && echo "OK" || echo "FAIL"
```
If FAIL → print `⛔ Obsidian SSD not mounted` and STOP.

**0c. Load Barron's profile** — Read `PROFILE` ONCE. Hold as `BARRON` in context. Do NOT re-read per job.

**0d. Load dedup set** — Read `LEDGER`. Parse pipe-delimited lines (skip `#`). Extract field 3 (job_url) into `DEDUP_SET` (a plain list of URLs). Discard everything else from ledger content.

**0e. Write initial checkpoint**:
```bash
echo '{"session":"TODAY","applied":0,"skipped":0,"errors":0}' > /tmp/workatastartup-checkpoint.json
```

---

## PHASE 1 — Login Check

Navigate to `https://www.workatastartup.com`.

```js
// mcp__playwright__browser_evaluate
() => {
  const loggedIn = !!(
    document.querySelector('[class*="avatar"]') ||
    document.querySelector('a[href*="/account"]') ||
    document.querySelector('a[href*="/dashboard"]')
  );
  const needsLogin = document.body.innerText.includes('Sign in') || document.body.innerText.includes('Log in');
  return { loggedIn: loggedIn && !needsLogin };
}
```

- If `loggedIn: true` → print `✅ Session active` and continue.
- If `loggedIn: false` → print `⏳ Waiting for login (90s)...` then poll every 8s up to 90s. If still false after 90s → print `⛔ Login not detected — log in and re-run` and STOP.

---

## PHASE 2 — Load or Scrape Job Queue

**First**: check if a saved queue exists from a prior session:
```bash
test -f /tmp/watas-queue-remaining.json && echo "QUEUE_EXISTS" || echo "NO_QUEUE"
```

**If QUEUE_EXISTS**: Load `/tmp/watas-queue-remaining.json` directly. Print `📂 Resuming saved queue ({N} jobs)`. Skip scraping.

**If NO_QUEUE**: Scrape fresh via browser_run_code:
```
1. Read /Users/xiaozuo/Projects/workatastartup-apply/scripts/scrape-queue.js
2. Pass content to mcp__playwright__browser_run_code
3. Receive result: { jobs: [...], total: N }
4. Immediately DISCARD the script content from context after the call
```

**Either path** — filter against `DEDUP_SET` (Obsidian ledger URLs):
- Remove any job.url already in `DEDUP_SET`
- `WORK_QUEUE = remaining jobs, capped at COUNT`

Print: `📋 {WORK_QUEUE.length} new jobs queued ({skipped} already in ledger, skipping)`

If empty → print `✅ All jobs applied — nothing to do` and jump to Phase 4.

Write checkpoint: `{"total_queued": WORK_QUEUE.length, ...}`

**Discard full jobs array from context** — keep only `WORK_QUEUE` as a list of `{company, title, url, jobType, batch, location}`.

---

## PHASE 3 — Apply Loop

`applied=0 | skipped=0 | errors=[]`

For each `job` in `WORK_QUEUE`:

### 3.1 Navigate
```js
// mcp__playwright__browser_navigate  url: job.url
```

### 3.2 Scrape job (compact return only)
```
1. Read SCRIPTS/scrape-job.js
2. Run via mcp__playwright__browser_run_code
3. Result includes fullJd — immediately write it to temp file via Bash:
   printf '%s' "$FULL_JD" > /tmp/watas-jd.txt
4. Discard fullJd and script content from context; keep only jdSnippet + metadata
```

**If `isExternal: true`**: skip → `status=external_apply`, go to 3.5
**If `hasQuickApply: false`**: skip → `status=no_quick_apply`, go to 3.5

### 3.3 Generate pitch (inline — no API call)
Using `BARRON` (already in context) + `jdSnippet` + `requirements` from step 3.2:

Generate a `PITCH` (max 150 words, 5 sentences):
- Sentence 1: ONE specific JD signal matched to Barron's direct experience
- Sentence 2–3: quantified result relevant to the role (40% engagement, 25% retention, 8-figure budget, 44% pipeline growth)
- Sentence 4: 0→1 instinct if early-stage, OR cross-functional scale if growth-stage
- Sentence 5: why this company's specific mission resonates
- No buzzwords. No "I am passionate about". First person only.

**Immediately after generating PITCH**: discard `jdSnippet` and `requirements` from working context — they are no longer needed.

### 3.4 Submit application
```
1. Read SCRIPTS/fill-apply.js
2. Replace %%PITCH%% with PITCH (escape backticks: replace ` with \`)
3. Run via mcp__playwright__browser_run_code
4. Result: { status, detail }
5. Discard script content and PITCH from context
```

### 3.5 Write Obsidian note
`noteFile = {company}-{title} sanitized to lowercase-hyphens, max 60 chars + ".md"`

```
1. Read /tmp/watas-jd.txt  ← full JD written by scrape-job.js
2. Write OBSIDIAN/{noteFile}:
```

```markdown
---
company: {company}
title: {title}
url: {job.url}
applied: {TODAY}
status: {result.status}
job_type: {job.jobType}
yc_batch: {batch}
team_size: {teamSize}
stage: {stage}
website: {website}
---

## Company
**YC Batch**: {batch} | **Stage**: {stage} | **Team**: {teamSize} | **Website**: {website}
**Location**: {job.location}

## Job Description
{contents of /tmp/watas-jd.txt}

## Requirements
{requirements from 3.2, or "(see JD above)"}

## Pitch Submitted
{PITCH — read from context before discarding}

## Application
- Submitted: {TODAY}
- Status: {result.status}
- Detail: {result.detail}
```

**After writing note**: discard full JD temp file content from context.

### 3.6 Append to ledger (immediate, one Edit per job)
```
{company}|{title}|{job.url}|{job.jobType}|{TODAY}|{result.status}|{noteFile}
```

### 3.7 Update counters + print
- `submitted` → `applied++` → print `✅ [N] {company} — {title}`
- `external_apply` / `no_quick_apply` → `skipped++` → print `⏭ {company} — {title}: {status}`
- anything else → `errors.push({company, title, status})` → print `⚠️ {company} — {title}: {status}`

Delay: 1.5s before next job.

**Working context after each job = one summary line only**: `[N] company — title → status`

### 3.8 Checkpoint every 10 jobs
```bash
echo '{"applied":N,"skipped":N,"errors":N,"last":"{company}"}' > /tmp/workatastartup-checkpoint.json
```
Print: `[Batch] Applied: {applied} | Skipped: {skipped} | Errors: {errors.length}`

---

## PHASE 4 — Final Report

Write `OBSIDIAN/_Report-{TODAY}.md`:

```markdown
# Workatastartup Session — {TODAY}

| Applied | Skipped | Errors | Queued |
|---------|---------|--------|--------|
| {applied} | {skipped} | {errors.length} | {WORK_QUEUE.length} |

## Applied
{each submitted job: - [company](url) — title (jobType, batch)}

## Skipped
{each skipped: - company — title: reason}

## Errors
{each error: - company — title: status — detail}
```

**Queue file management**:
- If all jobs in WORK_QUEUE were processed → delete `/tmp/watas-queue-remaining.json`
- If weekly limit hit mid-run → save unprocessed jobs back to `/tmp/watas-queue-remaining.json` for next week

Print final:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Done  Applied:{applied}  Skipped:{skipped}  Errors:{errors.length}
   Notes: /Volumes/workssd/ObsidianVault/01-Projects/Workatastartup/
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## RULES
1. **Context discipline**: never hold full JD, script bodies, or raw tool results in conversation beyond immediate use
2. **No snapshots**: use browser_evaluate / browser_run_code only; snapshot only if login evaluate fails
3. **Dedup first**: check DEDUP_SET before every apply
4. **Note for every job**: written regardless of apply outcome
5. **Ledger immediately**: append after each job — crash-safe
6. **Checkpoint every 10 jobs**
7. **1.5s delay** between jobs
8. **3 consecutive errors**: write checkpoint + print diagnostic, then continue
9. **browser_run_code fails 2×** on same job: mark `script_error`, skip
10. **Fully autonomous**: no prompts, no questions, no pausing for user
