---
description: "Wellfound per-job application loop (Sonnet). JD extraction → tailored resume/CL → form fill → submit. Max 2 jobs per run. Usage: /wellfound-apply"
model: sonnet
---

## MODEL GATE — MANDATORY FIRST CHECK
This command REQUIRES model: **sonnet**. If on Opus, STOP and tell user: "Wrong model. Run `/model sonnet` then `/wellfound-apply`."

## BROWSER ISOLATION
Use `mcp__playwright-wellfound__*` tools (dedicated Wellfound browser, port 9306). NOT the default `mcp__playwright__*`.

# Wellfound Apply Loop — Max 2 Jobs Per Invocation

Read `~/.claude/skills/wellfound-apply/SKILL.md` and `~/.claude/skills/wellfound-apply/data/answer-bank.md` first.

## Context Refresh Check
At start, verify session is active: `browser_evaluate` → `window.location.href`
If not on wellfound.com or session expired: run `/wellfound-setup` first silently.

## Job Loop (repeat for each job, max 2 total)

### Phase A — Select Next Job
1. Navigate to saved jobs or jobs listing
2. `browser_evaluate` with `~/.claude/skills/wellfound-apply/scripts/next-job.js`
3. Check ledger: skip if already applied (grep `Wellfound-Application-Ledger.md`)
4. Click "Learn More" link to open job detail page

### Phase B — Extract JD
1. `browser_evaluate` with `~/.claude/skills/wellfound-apply/scripts/extract-jd.js`
2. Parse: company, role, location, comp, full description, requirements list
3. Salary gate: if max comp < $160,000 AND comp is shown → skip + mark `skipped_salary`

### Phase C — Generate Tailored Resume + Cover Letter (Sonnet)
1. Read `~/.claude/skills/wellfound-apply/templates/resume-prompt.md`
2. Substitute {{COMPANY}}, {{ROLE}}, {{LOCATION}}, {{COMP}}, {{JD_TEXT}}
3. Generate resume content (all bullets must mirror JD requirements)
4. Run `python3 ~/.claude/skills/greenhouse-apply/scripts/generate-resume.py` with generated content
   - Save to `/Users/xiaozuo/Downloads/resumeandcoverletter/Barron_Zuo_{Company}_{Role}_Resume.docx`
5. Verify file exists: `ls /Users/xiaozuo/Downloads/resumeandcoverletter/Barron_Zuo_{Company}_{Role}_Resume.docx`
6. Generate cover letter using `~/.claude/skills/wellfound-apply/templates/cover-letter-prompt.md`
7. Save to `/Users/xiaozuo/Downloads/resumeandcoverletter/Barron_Zuo_{Company}_{Role}_Cover_Letter.docx`

### Phase D — Open Application
1. Navigate to job URL, find Apply button
2. `browser_click` Apply → wait for application form/modal
3. If redirects off-site (Greenhouse/Lever/etc.): use standard selectors for that ATS, proceed same way

### Phase E — Fill Form (Haiku-level tasks — deterministic field mapping)
1. `browser_evaluate` with `~/.claude/skills/wellfound-apply/scripts/fill-application-form.js`
2. For ANY unknown field (returned in `unknowns` array):
   - Read `~/.claude/skills/wellfound-apply/data/learned-answers.md` — check for prior answer
   - If not found: generate answer using `~/.claude/skills/wellfound-apply/templates/novel-answer-prompt.md`
   - Fill the field, then append Q&A to `learned-answers.md`
3. Handle EEO/demographic questions with values from SKILL.md config
4. Handle radio/select questions: match to career-db values

### Phase F — Upload Resume
1. `browser_evaluate` with `~/.claude/skills/wellfound-apply/scripts/upload-resume.js` to get file input selector
2. `browser_file_upload` with the .docx path (or .pdf if site rejects .docx)
3. Verify upload: check filename appears in UI

### Phase G — Submit
1. `browser_evaluate` with `~/.claude/skills/wellfound-apply/scripts/submit-application.js`
2. `browser_wait_for` up to 10s for success banner
3. Verify: check for success text or URL change
4. If validation error: read error messages, fix fields, retry once

### Phase H — Log to Ledger
Append to `/Users/xiaozuo/Library/Mobile Documents/iCloud~md~obsidian/Documents/Openclaw/Wellfound-Application-Ledger.md`:
```
| {date} | {company} | {role} | {location} | {job_url} | {comp} | submitted | {resume_file} | {cover_letter_file} | {notes} |
```

## After 2 Jobs — MANDATORY CONTEXT REFRESH
Output: "Batch complete. Applied to: [company1, company2]. Context refresh needed. Run `/wellfound-apply` to continue with next batch."
STOP. Do not process a 3rd job.

## Error Handling
- Any error after 2 retries → auto-switch to Opus for diagnosis
- CAPTCHA → STOP, screenshot, wait for user
- Rate limit (429) → sleep 5 min, retry once

## Token Rules
- NO `browser_snapshot` — use `browser_evaluate` only
- Drop JD text and resume content from context after each job
