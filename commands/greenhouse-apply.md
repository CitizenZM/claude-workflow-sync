---
description: "Greenhouse job application loop with tailored resume/CL generation (Sonnet). Run /greenhouse-setup first. Usage: /greenhouse-apply [max_applications]. Default: 5"
model: sonnet
---

# Greenhouse Apply

You are applying to jobs on Greenhouse.io with tailored resumes and cover letters. Follow these steps for EACH job.

## Pre-Loop Setup
1. Read `~/.claude/skills/greenhouse-apply/SKILL.md` for config, selectors, personal info
2. Read `~/.claude/skills/greenhouse-apply/data/answer-bank.md` for form answers
3. Read `/Volumes/workssd/ObsidianVault/01-Projects/Greenhouse-Application-Ledger.md` for dedup
4. Parse $ARGUMENTS for max_applications (default: 5)

## For Each Job in Queue:

### Step 1: Navigate to Job Detail
1. `browser_navigate` to the job URL
2. Read and run `~/.claude/skills/greenhouse-apply/scripts/extract-jd.js` via `browser_evaluate`
3. Capture: title, company, salary, location, full JD text

### Step 2: Verify Salary
- If salary is visible and < $160,000, SKIP this job
- Log: "Skipped {company} - {title}: salary below threshold"

### Step 3: Generate Tailored Resume
Read `~/.claude/skills/greenhouse-apply/templates/resume-prompt.md` for the full prompt.

**CRITICAL resume generation process:**
1. **Analyze JD**: Extract top keywords, required skills, North Star metrics, tech stack, leadership style
2. **Tailor Executive Summary**: Position Barron as the exact candidate. Mirror JD language. Lead with most relevant achievement.
3. **Tailor Core Competencies**: Map directly to JD requirements using exact JD terminology
4. **Rewrite Experience** — especially these three roles:
   - **Alibaba**: Emphasize aspects most relevant to JD. Scale: $180M ARR, 5M+ users, viral loops, AI automation, cross-functional leadership
   - **Next2Market**: Emphasize aspects most relevant to JD. Scale: 50+ B2B SaaS clients, $7M+ budgets, experimentation, stakeholder influence
   - **Indiegogo**: Emphasize aspects most relevant to JD. Scale: 44% pipeline increase, behavioral engines, international growth
5. **Expand bullets**: Each must have power verb + quantified result + JD keyword alignment
6. **Exactly 2 pages**: Dense but readable

Output the resume as JSON matching the format in resume-prompt.md.

### Step 4: Generate Tailored Cover Letter
Read `~/.claude/skills/greenhouse-apply/templates/cover-letter-prompt.md` for the full prompt.

1. **Opening hook**: Reference specific company achievement/product/mission
2. **Body 1**: Map Alibaba experience to primary JD requirement with metrics
3. **Body 2**: Map Next2Market/Indiegogo to secondary requirements
4. **Closing**: Express enthusiasm, mention 2-week availability

Output as JSON matching the format in cover-letter-prompt.md.

### Step 5: Generate .docx Files
Run the Python generator:
```bash
python3 ~/.claude/skills/greenhouse-apply/scripts/generate-resume.py \
  --type resume \
  --template ~/Downloads/resumeandcoverletter/Barron_Zuo_Resume_Dialpad_HeadOfGrowth.docx \
  --content '<resume_json>' \
  --output ~/Downloads/resumeandcoverletter/Barron_Zuo_<RoleTitle>_<Company>_Resume.docx
```

```bash
python3 ~/.claude/skills/greenhouse-apply/scripts/generate-resume.py \
  --type cover_letter \
  --template ~/Downloads/resumeandcoverletter/Barron_Zuo_Cover_Letter_Dialpad_HeadOfGrowth.docx \
  --content '<cover_letter_json>' \
  --output ~/Downloads/resumeandcoverletter/Barron_Zuo_<RoleTitle>_<Company>_Cover_Letter.docx
```

### Step 6: Click Apply
1. `browser_navigate` to the apply URL (or click Apply button on the job detail page)
2. Wait for the application form to load

### Step 7: Fill Application Form
1. Read and run `~/.claude/skills/greenhouse-apply/scripts/fill-application-form.js` via `browser_evaluate`
   - Inject PERSONAL_INFO with all fields from SKILL.md config
2. Review the `unknown` fields returned
3. For unknown required fields:
   - Check answer-bank.md for matches
   - If no match, use reasoning to generate an appropriate answer based on Barron's profile and the JD
   - Use `browser_type` or `browser_evaluate` to fill remaining fields
   - Log new Q&A pairs for future answer bank updates

### Step 8: Upload Resume
1. Read and run `~/.claude/skills/greenhouse-apply/scripts/upload-file.js` via `browser_evaluate` with `FILE_TYPE = 'resume'`
2. If existing file found, the script removes it
3. Use `browser_file_upload` with the generated resume .docx path and the returned selector

### Step 9: Upload Cover Letter
1. Run `upload-file.js` again with `FILE_TYPE = 'cover_letter'`
2. Use `browser_file_upload` with the generated cover letter .docx path

### Step 10: Final Review and Submit
1. Read and run `~/.claude/skills/greenhouse-apply/scripts/submit-application.js` via `browser_evaluate`
2. If validation errors found, fix the fields and retry once
3. If submission succeeds, capture confirmation

### Step 11: Record to Ledger
Append to `/Volumes/workssd/ObsidianVault/01-Projects/Greenhouse-Application-Ledger.md`:
```
{company}|{job_title}|{job_id}|{YYYY-MM-DD}|submitted|{resume_filename}|{cover_letter_filename}
```

### Step 12: Context Cleanup
After recording, forget the JD text and resume/CL content. Only retain:
- Ledger state (for dedup)
- Job queue (remaining jobs)
- Session counters

## End of Loop
After processing all jobs (or reaching max_applications):
1. Report total applications submitted
2. Report any skipped jobs (salary, errors)
3. Report any unknown fields encountered
4. Update answer-bank.md with any new Q&A pairs discovered

## Error Recovery
- Form field not found → log and continue with other fields
- File upload fails → retry once with alternate selector, then flag
- Submit validation error → read error, fix fields, retry once
- Submit completely fails → skip job, log error, continue to next
- CAPTCHA or rate limit → STOP immediately, report progress
