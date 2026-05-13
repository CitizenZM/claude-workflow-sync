---
name: greenhouse-job-application
description: Greenhouse.io job application automation. Three-phase design — Sonnet for setup + job queue, Sonnet for JD-tailored resume/CL generation + form fill + submit, Haiku for report. Naming convention: Greenhouse Job Application [MonthDDYYYY].
tags: [job-application, greenhouse, automation, playwright, resume, cover-letter]
---

# Greenhouse Job Application April152026

## Architecture

Three commands, two models:
- `/greenhouse-setup` (Sonnet) — login, search, filter, build job queue. Run once per session.
- `/greenhouse-apply` (Sonnet) — per-job loop: extract JD, generate tailored resume+CL, fill form, upload, submit.
- `/greenhouse-report` (Haiku) — generate Obsidian report from ledger.

JS scripts live in `~/.claude/skills/greenhouse-apply/scripts/`:
- `login.js` — navigate and login
- `search-jobs.js` — keyword search + salary filter
- `extract-job-list.js` — scrape job cards from results
- `extract-jd.js` — extract full JD from detail page
- `fill-application-form.js` — fill all form fields
- `upload-file.js` — remove existing file + prep input selector
- `submit-application.js` — submit + verify
- `next-job-page.js` — pagination

Python scripts:
- `generate-resume.py` — template-based .docx generation via python-docx

## Configuration

| Key | Value |
|-----|-------|
| BASE_URL | `https://my.greenhouse.io` |
| SEARCH_KEYWORDS | `["marketing", "growth"]` |
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
| RESUME_DIR | `~/Downloads/resumeandcoverletter/` |
| RESUME_TEMPLATE | `Barron_Zuo_Resume_Dialpad_HeadOfGrowth.docx` |
| OBSIDIAN_PATH | `/Volumes/workssd/ObsidianVault/01-Projects/` |
| LEDGER_FILE | `Greenhouse-Application-Ledger.md` |

## DOM Selectors (to be mapped on first run)

```
LOGIN_EMAIL     = input[type="email"], input[name="email"], input[name="user[email]"]
LOGIN_PASSWORD  = input[type="password"], input[name="user[password]"]
LOGIN_SUBMIT    = button[type="submit"], input[type="submit"]
SEARCH_INPUT    = input[type="search"], input[placeholder*="Search"], input[name="query"]
JOB_CARDS       = .job-listing, .job-row, [data-testid="job-card"], .job-post
VIEW_JOB_BTN    = a:has-text("View"), button:has-text("View")
APPLY_BTN       = a:has-text("Apply"), button:has-text("Apply")
FORM_INPUTS     = form input, form select, form textarea
FILE_UPLOAD     = input[type="file"]
FILE_REMOVE     = button[aria-label="Remove"], .remove-file, button.remove, [title="Remove"]
SUBMIT_BTN      = button[type="submit"]:has-text("Submit"), button:has-text("Submit Application")
NEXT_PAGE       = [aria-label="Next"], .pagination-next, a:has-text("Next")
SALARY_FILTER   = [data-filter="salary"], select[name="salary"], input[name*="salary"]
```

## Resume Template Structure

Styles used: `Normal`, `Heading 1`, `List Bullet`
Margins: top=0.4", bottom=0.4", left=0.5", right=0.5"
Page width: 8.5"

Sections in order:
1. Name (Normal, bold, 16pt)
2. Contact line (Normal)
3. EXECUTIVE SUMMARY (Heading 1) + paragraph (Normal)
4. CORE COMPETENCIES (Heading 1) + table (2 cols x 4 rows)
5. PROFESSIONAL EXPERIENCE (Heading 1)
   - Company line (Normal) + Role line (Normal) + bullets (List Bullet)
   - Repeat for each role
6. EDUCATION (Heading 1) + bullets (List Bullet)

## Resume Generation Instructions (CRITICAL)

**Model**: Always use Sonnet for resume and cover letter drafting and format layout design.

For EACH job application, generate tailored resume and cover letter:

### Step 1: Deep JD Analysis
- Extract ALL requirements, highlighted capabilities, required experience, tech stack, leadership style, North Star metrics
- Identify every keyword and phrase that appears in "Requirements", "What you'll do", "What we're looking for" sections
- Map each requirement to a specific Barron experience that can be built/expanded to match

### Step 2: Resume Content Rules
1. **JD-to-Resume Translation (MANDATORY)**: Every requirement in the JD MUST be reflected in the resume. Build and expand Alibaba, Next2Market, Indiegogo experience with specific, detailed project examples that directly mirror JD requirements. Create partial career experience with strong relevancy to each requirement.
2. **Executive Summary**: MUST highlight the specific capabilities and experience the JD requires. Mirror the JD's language. Not generic — every summary must be different per job.
3. **Experience Expansion**: Expand Alibaba and Next2Market sections with MORE content associated with the specific JD. Add project details, initiative names, team sizes, systems built, processes created. Switch to product/growth/marketing focus as needed to match the role.
4. **Power verbs**: Orchestrated, Catalyzed, Engineered, Spearheaded, Architected
5. **Lead with metrics**: GMV, ROAS, CTR, conversion, ARR, retention rates — match the metrics language from the JD
6. **Resume length: EXACTLY 2 full pages** — professional margins, never sparse, never 1.5 pages. Fill with relevant, detailed content.
7. **Cover letter length: EXACTLY 1 full page** — dense, specific, every paragraph maps to a JD requirement.

### Step 3: Location & Education Rules (MANDATORY)
- **NO China locations**: Never mention Hangzhou, Shanghai, Beijing, or any Chinese city
- **NO Zhejiang University**: Replace undergraduate with "National University of Singapore — Bachelor of Arts in Economics (International)"
- Alibaba location: Use "San Francisco, CA" only (or "San Francisco, CA / Singapore" if APAC experience needed)
- All locations must be US or international (non-China)

### Step 4: Output
- Save as `.docx` to `RESUME_DIR` (`/Users/xiaozuo/Downloads/resumeandcoverletter/`)

## File Output Rules (MANDATORY)

All generated resume and cover letter files MUST be saved as `.docx` to the local directory before uploading:

| File | Naming Convention | Save Path |
|------|-------------------|-----------|
| Resume | `Barron_Zuo_{Company}_{JobTitle}_Resume.docx` | `/Users/xiaozuo/Downloads/resumeandcoverletter/` |
| Cover Letter | `Barron_Zuo_{Company}_{JobTitle}_Cover_Letter.docx` | `/Users/xiaozuo/Downloads/resumeandcoverletter/` |

- **Company**: PascalCase, no spaces (e.g., `Duolingo`, `ZoomInfo`, `SharkNinja`)
- **JobTitle**: PascalCase, abbreviated if long (e.g., `Growth_Marketing_Lead`, `VP_Marketing`, `Head_Perf_Marketing`)
- **NEVER upload directly from memory** — always write to disk first via `generate-resume.py`, then upload the saved file
- **Verify file exists** before uploading: `ls` the output path
- After submission, record the exact filenames in the ledger

## Dedup Ledger

File: `/Volumes/workssd/ObsidianVault/01-Projects/Greenhouse-Application-Ledger.md`
Format: `company|job_title|job_id|YYYY-MM-DD|status|resume_file|cover_letter_file`

Read before applying. Append after each submission.

## Quality Rules

1. **MANDATORY JD analysis**: Always extract keywords and requirements BEFORE generating resume
2. **Salary gate**: Only apply to jobs with $160,000+ salary
3. **Dedup**: Never apply to same job twice — check ledger
4. **Resume quality**: Every bullet must have quantified impact and mirror JD keywords

## Token Rules

1. NEVER `browser_snapshot` except during first setup run for selector mapping
2. Use `browser_evaluate` for all DOM work
3. Read JS files from scripts/ on-demand — do NOT load all upfront
4. After each job: forget JD text and resume content, only retain ledger state
5. **CONTEXT REFRESH (MANDATORY)**: After every 2 job applications, STOP and tell the user to start a fresh `/greenhouse-apply` session. This prevents context bloat from accumulated JD text, resume content, and form interaction history. Output: "Context refresh needed. Run `/greenhouse-apply` to continue with next batch."
6. Process max 2 jobs per `/greenhouse-apply` invocation, then refresh

## Execution Mode (MANDATORY)

- **Fully autonomous**: Do NOT ask for permission at any step. All permissions are pre-granted.
- **No confirmation loops**: Execute every step (navigate, fill, upload, submit) without pausing.
- **Auto-recovery with Opus**: When stuck, blocked, or encountering an error that fails after 2 retries at Sonnet level, automatically switch to Opus model to diagnose and fix the issue, then switch back to Sonnet and continue the workflow.
- **Never stop for user input** unless CAPTCHA requires manual human interaction.

## Error Recovery

| Error | Action |
|-------|--------|
| Login fails | Retry once, then auto-switch to Opus to debug |
| 0 search results | Try alternate keyword, report if still 0 |
| JD extraction empty | Fallback browser_snapshot once, if still empty switch to Opus |
| Form field not found | Try alternate selectors, log to unknowns, proceed |
| File upload fails | Retry with alternate selector, if fails switch to Opus |
| Submit validation error | Read error, fix fields, retry once, if fails switch to Opus |
| python-docx missing | `pip3 install python-docx`, retry |
| CAPTCHA/rate limit | STOP, flag for manual intervention (only exception) |
| Browser locked/stale | Kill MCP Chrome process, relaunch, continue |
| Dropdown not found | Try browser_run_code with Playwright API, if fails switch to Opus |
| Any 3+ consecutive failures | Auto-switch to Opus for deep diagnosis before continuing |
