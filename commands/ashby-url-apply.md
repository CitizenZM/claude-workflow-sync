## MODEL GATE — MANDATORY FIRST CHECK
This command REQUIRES model: **sonnet**. If on Opus, STOP and tell the user: "⛔ Wrong model. Run `/model sonnet` then re-run `/ashby-url-apply`."

# Ashby URL Apply

Apply to Ashby jobs from a direct URL list. Identical resume/CL generation logic to `/greenhouse-url-apply`. Max 2 per run, then context refresh.

## Pre-Loop Setup

1. Read `~/.claude/skills/ashby-apply/SKILL.md` for config and selectors
2. Read `~/.claude/skills/greenhouse-apply/data/answer-bank.md` for form answers
3. Read `~/.claude/skills/greenhouse-apply/data/barron-experience-bank.md` for resume content
4. Read `/Volumes/workssd/ObsidianVault/01-Projects/Ashby-Application-Ledger.md` for dedup (create if missing)
5. Parse ``:
   - If `--file <path>` → read URLs one-per-line
   - Otherwise treat each whitespace-separated token as a URL
   - If no arguments → STOP: "Usage: /ashby-url-apply [url1 url2 ...] OR /ashby-url-apply --file ~/path/to/urls.txt"

## URL Normalization

- Extract UUID: regex `[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}` from URL path
- Extract company slug: first path segment after `jobs.ashbyhq.com/`
- Normalize apply URL: `https://jobs.ashbyhq.com/{slug}/{uuid}/application`
- Strip tracking params (`?src=`, `?utm_source=`, etc.)
- Non-Ashby URLs → log "Unrecognized URL format — skipping: {url}", continue

## For Each URL in Queue

### Step 1: Fast Dedup
Extract UUID from URL. If UUID already in Ashby ledger → SKIP.

### Step 2: Fetch JD via Ashby API (preferred — no browser needed)
```
GET https://api.ashbyhq.com/posting-api/job-posting/{uuid}?includeCompensation=true
```
Navigate browser to this URL and parse JSON response:
- `title`, `locationName`, `descriptionHtml` (strip tags for clean text), `compensationTierSummary`
- Company: use slug from URL, prettified (e.g. `hims-and-hers` → `Hims & Hers`)

Fallback if API 404: navigate to job detail page and run `~/.claude/skills/ashby-apply/scripts/extract-jd.js`.

### Step 3: Salary Gate
- Visible salary < $160,000 → SKIP with log
- No salary or equity-only → PROCEED

### Step 4: Dedup Check (company + title)
Build key: `company.toLowerCase()|title.toLowerCase()`. Check against ledger. If match → SKIP.

### Step 5: Generate Tailored Resume
Follow the full Phase 1–6 process from `~/.claude/skills/greenhouse-apply/templates/resume-prompt.md`.
Generate JSON → run:
```bash
python3 ~/.claude/skills/greenhouse-apply/scripts/generate-resume.py \
  --type resume \
  --template ~/Downloads/resumeandcoverletter/Barron_Zuo_Resume_Dialpad_HeadOfGrowth.docx \
  --content '<resume_json>' \
  --output ~/Downloads/resumeandcoverletter/Barron_Zuo_{Company}_{Title}_Resume.docx
```

### Step 6: Generate Tailored Cover Letter
Follow `~/.claude/skills/greenhouse-apply/templates/cover-letter-prompt.md`.
```bash
python3 ~/.claude/skills/greenhouse-apply/scripts/generate-resume.py \
  --type cover_letter \
  --template ~/Downloads/resumeandcoverletter/Barron_Zuo_Cover_Letter_Dialpad_HeadOfGrowth.docx \
  --content '<cl_json>' \
  --output ~/Downloads/resumeandcoverletter/Barron_Zuo_{Company}_{Title}_Cover_Letter.docx
```

### Step 7: Navigate to Application Form
```javascript
await page.goto(`https://jobs.ashbyhq.com/${slug}/${uuid}/application`);
await page.waitForTimeout(2000);
```

### Step 8: Fill Form
Run `~/.claude/skills/ashby-apply/scripts/fill-form.js` via `browser_run_code`.

For any `unknown` fields returned:
- Check answer-bank.md for match
- If no match: generate answer from Barron's profile + JD context
- Fill using `browser_run_code` with targeted locators

### Step 9: Upload Files
Use `browser_run_code`:
```javascript
// Resume
await page.locator('#_systemfield_resume').setInputFiles('/path/to/resume.docx');
await page.waitForTimeout(1500);
// Cover letter (if field present)
const clInput = page.locator('input[type="file"]:not(#_systemfield_resume)').first();
if (await clInput.count() > 0) await clInput.setInputFiles('/path/to/cl.docx');
```

### Step 10: Submit
```javascript
await page.locator('button[type="submit"]').filter({ hasText: /submit/i }).first().click({ force: true });
await page.waitForTimeout(8000);
// Check for success: "Thank you" / "application received" / "we'll be in touch"
```

### Step 11: Record to Ledger
Append to `/Volumes/workssd/ObsidianVault/01-Projects/Ashby-Application-Ledger.md`:
```
{company}|{job_title}|{uuid}|{YYYY-MM-DD}|submitted|{resume_filename}|{cover_letter_filename}
```

### Step 12: Context Cleanup
Forget JD text and resume/CL content. Retain ledger state + remaining URL queue.

## End of Loop

After processing all URLs, print summary table:

| URL | Company | Role | Status | Resume | Cover Letter |
|-----|---------|------|--------|--------|-------------|
| ... | ... | ... | submitted / skipped-dedup / skipped-salary / error | ... | ... |

## Context Refresh Rule
After every **2 submitted applications**, STOP:
> "Context refresh needed. Run `/ashby-url-apply` with remaining URLs to continue."

## Error Recovery

| Error | Action |
|-------|--------|
| API 404 | Fall back to page scrape |
| Job closed / 404 page | Log "Job no longer available", skip |
| Location combobox no options | Try "San Francisco" without ", CA" |
| File upload fails | Retry `setInputFiles` on `#_systemfield_resume` directly |
| Submit validation error | Read error text, fix field, retry once |
| CAPTCHA | STOP, flag for manual intervention |
| 3+ consecutive failures | Switch to Opus for diagnosis |
