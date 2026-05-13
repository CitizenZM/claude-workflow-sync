---
description: "Greenhouse.io Jobs — One-command full workflow (setup + apply + report). Sonnet end-to-end. Max 2 jobs per run, then context refresh. Usage: /greenhouse [job_title_filter]"
model: sonnet
---

## MODEL GATE — MANDATORY FIRST CHECK
This command REQUIRES model: **sonnet**. Before doing ANY work, check your current model. If you are running on Opus, STOP IMMEDIATELY and tell the user: "Wrong model. This command requires Sonnet. Run `/model sonnet` then re-run `/greenhouse`." Do NOT proceed on Opus — it wastes 5-10x credits.

# Greenhouse — Unified One-Command Workflow

Single autonomous run: login + queue build + apply (max 2 jobs) + report. No separate `/greenhouse-setup` then `/greenhouse-apply` step. Fully autonomous — no confirmation prompts, no model-switch prompts, no user questions (except CAPTCHA).

**Execution mode**: All Playwright MCP tools (`browser_navigate`, `browser_evaluate`, `browser_click`, `browser_type`, `browser_file_upload`, `browser_snapshot`) are pre-authorized. Token rule: NEVER use `browser_snapshot` except ONCE during initial selector discovery on login.

---

## CONFIG (canonical source: `~/.claude/skills/greenhouse-apply/SKILL.md`)

```
filter            : $ARGUMENTS (optional job title keyword, e.g. "Marketing Manager")
BASE_URL          : https://my.greenhouse.io
SEARCH_KEYWORDS   : ["marketing", "growth"]   (use $ARGUMENTS if provided)
MIN_SALARY        : 160000
MAX_PER_RUN       : 2
LEDGER            : /Volumes/workssd/ObsidianVault/01-Projects/Greenhouse-Application-Ledger.md
RESUME_DIR        : ~/Downloads/resumeandcoverletter/
RESUME_TEMPLATE   : Barron_Zuo_Resume_Dialpad_HeadOfGrowth.docx
SCRIPTS           : ~/.claude/skills/greenhouse-apply/scripts/
```

Personal info, identity questions (gender/race/auth/sponsorship/etc.), and DOM selectors come from `~/.claude/skills/greenhouse-apply/SKILL.md`. Read that file ONCE at start.

---

## PHASE 1 — SETUP (Login + Search + Queue)

### Step 1: Read skill config
Read `~/.claude/skills/greenhouse-apply/SKILL.md` to load all config values, identity answers, and DOM selectors.

### Step 2: Login
1. `browser_navigate` to `https://my.greenhouse.io`
2. ONE `browser_snapshot` allowed here for selector discovery if selectors fail
3. `browser_type` email, `browser_click` continue, password as needed
4. `browser_evaluate` to verify: `document.title` and `window.location.href`

### Step 3: Search jobs
1. Use `SEARCH_KEYWORDS` (or `$ARGUMENTS` if provided)
2. Read and run `~/.claude/skills/greenhouse-apply/scripts/search-jobs.js` via `browser_evaluate`
3. Apply salary filter if UI exists; otherwise filter post-collection

### Step 4: Build queue
1. Read and run `~/.claude/skills/greenhouse-apply/scripts/extract-job-list.js` via `browser_evaluate`
2. Paginate with `next-job-page.js` until 50 jobs collected or no more pages
3. Drop jobs with visible salary < $160,000; keep jobs with no salary listed
4. Read ledger at `LEDGER`; drop jobs whose `company|job_title` is already present
5. Truncate queue to `MAX_PER_RUN` (2)

Print: `"Queue ready: {N} new jobs (capped at 2). Beginning apply loop..."`

---

## PHASE 2 — APPLY LOOP (max 2 jobs)

For each job in the truncated queue:

### Step A: Extract JD
1. `browser_navigate` to job URL
2. Read and run `~/.claude/skills/greenhouse-apply/scripts/extract-jd.js` via `browser_evaluate`
3. Capture: title, company, salary, location, full JD text
4. If salary visible and < $160,000, SKIP and log

### Step B: Generate tailored resume + cover letter (Sonnet)
Follow the resume rules in `~/.claude/skills/greenhouse-apply/SKILL.md` "Resume Generation Instructions":
- Deep JD analysis → extract every requirement, keyword, metric
- Mirror JD language in Executive Summary
- Expand Alibaba / Next2Market / Indiegogo bullets to map JD requirements (power verbs + quantified results)
- NO China locations; replace undergrad with "National University of Singapore — Bachelor of Arts in Economics (International)"
- Resume EXACTLY 2 pages; cover letter EXACTLY 1 page

Save as `.docx` via `generate-resume.py`:
```bash
python3 ~/.claude/skills/greenhouse-apply/scripts/generate-resume.py \
  --type resume \
  --template ~/Downloads/resumeandcoverletter/Barron_Zuo_Resume_Dialpad_HeadOfGrowth.docx \
  --content '<resume_json>' \
  --output ~/Downloads/resumeandcoverletter/Barron_Zuo_{Company}_{JobTitle}_Resume.docx

python3 ~/.claude/skills/greenhouse-apply/scripts/generate-resume.py \
  --type cover_letter \
  --template ~/Downloads/resumeandcoverletter/Barron_Zuo_Cover_Letter_Dialpad_HeadOfGrowth.docx \
  --content '<cover_letter_json>' \
  --output ~/Downloads/resumeandcoverletter/Barron_Zuo_{Company}_{JobTitle}_Cover_Letter.docx
```

Verify both files exist with `ls` before upload.

### Step C: Open application form
`browser_navigate` to the apply URL (or `browser_click` Apply button).

### Step D: Fill form
1. Read and run `~/.claude/skills/greenhouse-apply/scripts/fill-application-form.js` via `browser_evaluate`, injecting PERSONAL_INFO from SKILL.md
2. Review `unknown` fields; fill from identity answers in SKILL.md or reasoned defaults
3. Use `browser_type` / `browser_evaluate` for any leftover fields

### Step E: Upload resume + cover letter
1. Run `upload-file.js` with `FILE_TYPE='resume'`, then `browser_file_upload` with the generated resume path
2. Run `upload-file.js` with `FILE_TYPE='cover_letter'`, then `browser_file_upload` with the generated cover letter path

### Step F: Submit
1. Read and run `~/.claude/skills/greenhouse-apply/scripts/submit-application.js` via `browser_evaluate`
2. On validation error, fix flagged fields and retry ONCE
3. On success, capture confirmation

### Step G: Append to ledger
Append one line to `LEDGER`:
```
{company}|{job_title}|{job_id}|{YYYY-MM-DD}|submitted|{resume_filename}|{cover_letter_filename}
```

### Step H: Context cleanup
Forget JD text and resume/CL content. Retain only ledger state and remaining queue.

Print: `"Applied: {title} at {company}"`

---

## PHASE 3 — REPORT

After 2 jobs (or queue exhausted), generate inline report:

```
=== Greenhouse — Session Complete ===
Date:       {today}
Model:      sonnet (end-to-end)
Applied:    {applied_count} jobs (max 2/run)
Skipped:    {skipped_count}  (reasons: {salary | dedup | error})
Errors:     {error_count}
Ledger:     {grand_total} total all-time

Applied this session:
| Title | Company | Job ID | Date |
|-------|---------|--------|------|
| ...   | ...     | ...    | ...  |

Resume/CL files saved to: ~/Downloads/resumeandcoverletter/

Context refresh needed. Run `/greenhouse [filter]` again to continue with the next batch of 2.
=====================================
```

---

## RULES

1. **Fully autonomous**: never pause for permission. CAPTCHA is the only stop condition.
2. **Token discipline**: ONE `browser_snapshot` max (login selector discovery). Everything else via `browser_evaluate`.
3. **Hard cap 2 jobs per invocation** — prevents context bloat from accumulated JD/resume content.
4. **Tailor every application** — no generic resumes, no generic cover letters.
5. **Dedup before applying** — re-check ledger inside apply loop, not just setup.
6. **Record every attempt** to ledger (success, skip, or error).
7. **Auto-retry up to 3 times** on transient errors. After 3 consecutive failures on the same job, skip it and continue.
8. **No model switching** — Sonnet handles the entire run.
