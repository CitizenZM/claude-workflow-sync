## MODEL GATE
This command REQUIRES model: **sonnet**. If on Opus, STOP: "⛔ Wrong model. Run `/model sonnet` then re-run `/lever-url-apply`."

# Lever URL Apply

Apply to Lever jobs from a direct URL list. Same resume/CL generation as greenhouse-apply. Max 2 per run, then context refresh.

## Pre-Loop Setup

1. Read `~/.claude/skills/lever-apply/SKILL.md`
2. Read `~/.claude/skills/greenhouse-apply/data/answer-bank.md`
3. Read `~/.claude/skills/greenhouse-apply/data/barron-experience-bank.md`
4. Read `/Volumes/workssd/ObsidianVault/01-Projects/Lever-Application-Ledger.md` for dedup
5. Parse ``: same rules as `/ashby-url-apply` — whitespace-separated tokens or `--file`

## URL Normalization

- Extract UUID: `[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`
- Normalize apply URL: `https://jobs.lever.co/{company}/{uuid}/apply`
- Strip `?lever-source=`, `?utm_source=` etc.
- Non-Lever URLs → log "Unrecognized URL format", skip

## For Each URL

### Step 1: Fast Dedup
UUID already in Lever ledger → SKIP.

### Step 2: Fetch JD via Lever API
```
GET https://api.lever.co/v0/postings/{company}/{uuid}
```
Parse: `text` (title), `categories.location`, `descriptionPlain`, `lists` (requirements/responsibilities), `additional`.
Company: second path segment from URL (e.g. `whoop` → `WHOOP`).

Fallback: navigate to `https://jobs.lever.co/{company}/{uuid}` and scrape page.

### Step 3: Salary Gate
Lever rarely shows salary in API. Check `descriptionPlain` for salary mentions. If < $160K → SKIP. Unknown → PROCEED.

### Step 4: Dedup by company+title

### Step 5–6: Generate Tailored Resume + Cover Letter
Same process as `/greenhouse-url-apply`. Cover letter JSON → extract paragraphs as plain text for the textarea.

### Step 7: Navigate to Apply Form
```javascript
await page.goto(`https://jobs.lever.co/${company}/${uuid}/apply`);
await page.waitForTimeout(2000);
```

### Step 8: Fill Form
```javascript
// Standard fields
await page.locator('input[name="name"]').fill('Barron Zuo');
await page.locator('input[name="email"]').fill('xz429@cornell.edu');
await page.locator('input[name="phone"]').fill('9094132840');
await page.locator('input[name="org"]').fill('Alibaba INC');
await page.locator('input[name="urls[LinkedIn]"]').fill('https://www.linkedin.com/in/barron-z-15226126a/');
await page.locator('input[name="urls[Other]"]').fill('barronzuo.com');

// Cover letter in textarea
const clText = [paragraphs joined with \n\n];
await page.locator('textarea[name="comments"]').fill(clText);

// EEO selects (native <select> — no React)
const setSelect = async (name, text) => {
  const sel = page.locator(`select[name="${name}"]`);
  if (await sel.count()) await sel.selectOption({ label: text }).catch(() => sel.selectOption({ value: text }));
};
await setSelect('eeo[gender]', 'Male');
await setSelect('eeo[race]', 'Asian (not Hispanic or Latino)');
await setSelect('eeo[veteran]', 'I am not a protected veteran');
await setSelect('eeo[disability]', 'No, I don\'t have a disability');
```

### Step 9: Upload Resume
```javascript
const resumeInput = page.locator('input[type="file"]').first();
await resumeInput.setInputFiles('/path/to/resume.docx');
await page.waitForTimeout(1500);
```

### Step 10: Submit
```javascript
await page.locator('button[type="submit"]').first().click({ force: true });
await page.waitForTimeout(7000);
// Success: "Application submitted" / "Thank you" / URL changes to /confirmation
```

### Step 11: Record to Ledger
```
{company}|{job_title}|{uuid}|{YYYY-MM-DD}|submitted|{resume_filename}|cl_pasted
```

## Context Refresh Rule
After every **2 submitted applications**: "Context refresh needed. Run `/lever-url-apply` with remaining URLs."

## Error Recovery

| Error | Action |
|-------|--------|
| API 404 | Scrape job detail page |
| Cover letter textarea missing | Try `[data-field="comments"], textarea` |
| EEO select not found | Skip EEO, log, proceed to submit |
| Submit validation error | Read error, fix, retry once |
| CAPTCHA | STOP |
| 3+ failures | Switch to Opus |
