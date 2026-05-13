---
name: wellfound-job-application
description: Wellfound job application automation. Three-phase design — Sonnet for setup + job queue, Sonnet for JD-tailored resume/CL generation + form fill + submit, Haiku for report. Naming convention: Wellfound Job Application [MonthDDYYYY].
tags: [job-application, wellfound, automation, playwright, resume, cover-letter]
---

# Wellfound Job Application April192026

## Architecture

Four commands, two models:
- `/wellfound-setup` (Sonnet) — login, apply filters (Growth Hacker + Marketing × LA/SF/NY), scroll listings, save jobs, build queue. Run once per session.
- `/wellfound-apply` (Sonnet) — per-job loop: extract JD, generate tailored resume+CL, fill form, upload, submit. Max 2 jobs per invocation.
- `/wellfound-report` (Haiku) — generate Obsidian report from ledger.
- `/wellfound` (Sonnet) — umbrella: runs setup → apply → report.

JS scripts live in `~/.claude/skills/wellfound-apply/scripts/`:
- `login.js` — navigate and login
- `apply-filters.js` — role + location filter chips
- `collect-jobs.js` — scroll and enumerate job cards
- `save-job.js` — click bookmark/save icon per card
- `extract-jd.js` — extract full JD from detail page
- `fill-application-form.js` — fill all application fields
- `upload-resume.js` — file input handler
- `submit-application.js` — submit + verify success banner
- `next-job.js` — advance to next job in queue

Python scripts:
- `generate-resume.py` — template-based .docx generation via python-docx (same as greenhouse-apply)

## Configuration

| Key | Value |
|-----|-------|
| BASE_URL | `https://wellfound.com/jobs` |
| LOGIN_URL | `https://wellfound.com/login` |
| ROLES | `["Growth Hacker", "Marketing"]` |
| LOCATIONS | `["Los Angeles", "San Francisco", "New York"]` |
| MIN_SALARY | `160000` |
| FIRST_NAME | `Barron` |
| LAST_NAME | `Zuo` |
| LEGAL_FIRST_NAME | `Xiao` |
| EMAIL | `xz429@cornell.edu` |
| PHONE | `+1 9094132840` |
| LOCATION | `San Francisco` |
| LINKEDIN | `https://www.linkedin.com/in/barron-z-15226126a/` |
| WEBSITE | `barronzuo.com` |
| CURRENT_COMPANY | `Alibaba INC` |
| AUTHORIZED | `YES` |
| SPONSORSHIP | `NO` |
| PREVIOUSLY_WORKED | `NO` |
| ONSITE_3DAYS | `YES` |
| RELOCATE | `YES` |
| SUBJECT_TO_AGREEMENT | `NO` |
| RECEIVE_UPDATES | `YES` |
| HEAR_ABOUT_US | `LinkedIn` |
| RECEIVE_COMMUNICATION | `YES` |
| GENDER | `Man` |
| GENDER_IDENTITY | `Straight` |
| RACE | `East Asian` |
| SEXUAL_ORIENTATION | `Asexual` |
| TRANSGENDER | `NO` |
| DISABILITY | `NO` |
| VETERAN | `NO` |
| RESUME_DIR | `/Users/xiaozuo/Downloads/resumeandcoverletter/` |
| RESUME_TEMPLATE | `Barron_Zuo_Growth_Final_Resume.docx` |
| OBSIDIAN_PATH | `/Users/xiaozuo/Library/Mobile Documents/iCloud~md~obsidian/Documents/Openclaw/` |
| LEDGER_FILE | `Wellfound-Application-Ledger.md` |
| CAREER_DB | `~/.claude/skills/wellfound-apply/data/career-db.json` |

## DOM Selectors (to be mapped on first setup run)

```
LOGIN_EMAIL      = input[type="email"], input[name="email"]
LOGIN_PASSWORD   = input[type="password"], input[name="password"]
LOGIN_SUBMIT     = button[type="submit"]
ROLE_FILTER      = input[placeholder*="Role"], input[placeholder*="Job title"], [data-filter="role"]
LOCATION_FILTER  = input[placeholder*="Location"], [data-filter="location"]
JOB_CARDS        = [data-test="StartupResult"], .styles_component__*, [data-test="JobResult"], article
SAVE_BTN         = button[aria-label*="save" i], button[aria-label*="bookmark" i], .save-job, [data-test="save-button"]
LEARN_MORE_BTN   = a:has-text("Learn More"), a[href*="/jobs/"], [data-test="learn-more"]
APPLY_BTN        = a:has-text("Apply"), button:has-text("Apply Now"), [data-test="apply-button"]
FORM_INPUTS      = form input, form select, form textarea
FILE_UPLOAD      = input[type="file"]
SUBMIT_BTN       = button[type="submit"]:has-text("Submit"), button:has-text("Apply")
SUCCESS_BANNER   = [data-test="success"], .application-submitted, :has-text("Application submitted")
```

## Resume Template Structure

Same as `greenhouse-apply` SKILL.md — reuse `generate-resume.py` directly.

Styles: `Normal`, `Heading 1`, `List Bullet`
Margins: top=0.4", bottom=0.4", left=0.5", right=0.5"
Page width: 8.5"

## Resume Generation Instructions (CRITICAL — IDENTICAL TO GREENHOUSE)

**Model**: Always use Sonnet for resume and cover letter generation.

For EACH job application, generate tailored resume and cover letter:

### Step 1: Deep JD Analysis
- Extract ALL requirements, capabilities, required experience, tech stack, leadership style, North Star metrics
- Map each requirement to a specific Barron experience that directly matches

### Step 2: Content Rules
1. Every JD requirement MUST appear in the resume
2. Executive Summary mirrors JD language — different per job, never generic
3. Expand Alibaba and Next2Market with project details that match the JD
4. Power verbs: Orchestrated, Catalyzed, Engineered, Spearheaded, Architected
5. Lead with metrics: GMV, ROAS, CTR, CVR, ARR, retention
6. Resume: EXACTLY 2 full pages
7. Cover letter: EXACTLY 1 full page

### Step 3: Location Rules (MANDATORY)
- **NO China locations** — never mention Hangzhou, Shanghai, Beijing, any Chinese city
- Alibaba location: `San Francisco, CA` only
- Replace any Zhejiang University reference with `National University of Singapore — Bachelor of Arts in Economics (International)`

### Step 4: Output
- Save .docx to `RESUME_DIR`

## File Output Rules (MANDATORY)

| File | Naming Convention | Save Path |
|------|-------------------|-----------|
| Resume | `Barron_Zuo_{Company}_{JobTitle}_Resume.docx` | `/Users/xiaozuo/Downloads/resumeandcoverletter/` |
| Cover Letter | `Barron_Zuo_{Company}_{JobTitle}_Cover_Letter.docx` | `/Users/xiaozuo/Downloads/resumeandcoverletter/` |

- NEVER upload directly from memory — always write to disk first
- Verify file exists before uploading

## Dedup Ledger

File: `/Users/xiaozuo/Library/Mobile Documents/iCloud~md~obsidian/Documents/Openclaw/Wellfound-Application-Ledger.md`

Format (pipe-delimited markdown table):
```
| date | company | role | location | job_url | comp_range | status | resume_file | cover_letter_file | notes |
```

Status enum: `queued` → `saved` → `jd_extracted` → `generating` → `form_filled` → `submitted` → `confirmed`
Exception: `already_applied`, `manual_review`, `stale`, `skipped_salary`, `failed_submit`

Read before applying. Append after each submission.

## Quality Rules

1. **MANDATORY JD analysis** before generating resume
2. **Salary gate**: skip jobs with max comp < $160,000 (only if salary is shown)
3. **Dedup**: never apply to same company+role twice — check ledger
4. **Save before apply**: always click Save/bookmark FIRST, then Learn More

## Token Rules

1. **NEVER `browser_snapshot`** except during FIRST setup run (one-time selector mapping)
2. All DOM work via `browser_evaluate`
3. Read JS files from `scripts/` on-demand
4. After each job: drop JD text and resume content from context
5. **CONTEXT REFRESH (MANDATORY)**: After every 2 jobs, STOP and tell user: "Context refresh needed. Run `/wellfound-apply` to continue with next batch."
6. Max 2 jobs per `/wellfound-apply` invocation

## Execution Mode (MANDATORY)

- **Fully autonomous**: No confirmation at any step except CAPTCHA
- **No confirmation loops**: execute navigate/fill/upload/submit without pausing
- **Auto-recovery with Opus**: On errors that fail after 2 retries, auto-switch to Opus to diagnose, then back to Sonnet
- **Never stop for user input** unless CAPTCHA requires manual interaction

## Error Recovery

| Error | Action |
|-------|--------|
| Login fails | Retry once, then Opus debug |
| 0 jobs after filter | Try broader keywords, report if still 0 |
| Save button not found | Fallback `[aria-label*="save" i]`, log + continue |
| JD extraction empty | Fallback `browser_snapshot` once, then Opus |
| Form field not found | Try alternate selectors, log to answer-bank, proceed |
| File upload fails | Retry alternate selector, then Opus |
| Submit validation error | Read error, fix fields, retry once, then Opus |
| python-docx missing | `pip3 install python-docx`, retry |
| CAPTCHA/anti-bot | STOP immediately, surface screenshot for human |
| Rate limit | Sleep 5 min, retry once |
| Session expired | Re-run `/wellfound-setup`, resume queue |
| 3+ consecutive failures | STOP, auto-switch to Opus for diagnosis |
