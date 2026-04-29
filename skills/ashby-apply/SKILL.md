# Ashby Job Application Skill

## Architecture

Two commands, same model:
- `/ashby-url-apply [url1 url2 ...]` (Sonnet) — per-job loop: extract JD, generate tailored resume+CL, fill form, upload, submit. Max 2 per run then context refresh.
- `/ashby-report` (Haiku) — generate report from ledger.

Reuses all templates and data from greenhouse-apply skill.

## Ashby URL Patterns

| Pattern | Type |
|---------|------|
| `jobs.ashbyhq.com/{company}/{uuid}` | Job detail page |
| `jobs.ashbyhq.com/{company}/{uuid}/application` | Direct apply form |
| `jobs.ashbyhq.com/{company}/{uuid}/application?src=...` | Apply form with tracking |

**Normalization rule**: Strip `?src=`, `?utm_source=` etc. Keep UUID. Append `/application` if not present.

**Job UUID extraction**: The UUID is the path segment after the company slug.
```
https://jobs.ashbyhq.com/hims-and-hers/628282ac-35f0-49d8-84e0-afc90bdf8d0a
                                         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                         This is the job UUID (dedup key)
```

## JD Extraction

Ashby job pages render full JD in the DOM. Use this selector chain:
```javascript
// Primary: structured job data
const jdEl = document.querySelector('[class*="ashby-job-posting"], [class*="jobPosting"], main');

// Salary: shown prominently on detail page
const salary = document.querySelector('[class*="compensation"], [class*="Compensation"]')?.textContent;

// Title
const title = document.querySelector('h1')?.textContent?.trim();

// Company (from URL slug or page)
const company = window.location.pathname.split('/')[1]; // e.g. "hims-and-hers"
```

**Ashby Public API** (faster, no browser needed for JD):
```
GET https://api.ashbyhq.com/posting-api/job-posting/{uuid}?includeCompensation=true
```
Returns structured JSON with title, description, compensation, location.

## Form Structure (Ashby-specific)

Ashby forms are at `{job_url}/application`. Key fields:

| Field | Selector | Notes |
|-------|----------|-------|
| Full Name | `#_systemfield_name` | Single field — "Barron Zuo" |
| Email | `#_systemfield_email` | Standard |
| Phone | `input[type="tel"]` | UUID-named, use type selector |
| Location | `input[role="combobox"]` | Type + select from dropdown |
| LinkedIn | `input[placeholder*="linkedin" i], input[id*="linkedin" i]` | UUID-named |
| Website | `input[placeholder*="website" i], input[placeholder*="portfolio" i]` | UUID-named, optional |
| Resume | `#_systemfield_resume` | File input |
| Cover Letter | `input[type="file"]:not(#_systemfield_resume)` | First file input if present |
| Yes/No Questions | `input[type="checkbox"][name*="-"]` | UUID-named checkboxes |
| Submit | `button[type="submit"]` | Text: "Submit Application" |

## Yes/No Checkbox Pattern

Ashby renders Yes/No questions as **radio-style checkboxes**. Each question has 2 inputs with the same `name` (UUID) but different values:

```javascript
// Find all Yes/No question groups
const yesNoGroups = {};
document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
  const name = cb.name;
  const container = cb.closest('[class*="field"], [class*="question"], div[class]');
  const questionText = container?.querySelector('[class*="label"], label, p')?.textContent?.trim();
  const optionLabel = cb.closest('label')?.textContent?.trim() || cb.nextElementSibling?.textContent?.trim();
  if (!yesNoGroups[name]) yesNoGroups[name] = { question: questionText, options: [] };
  yesNoGroups[name].options.push({ cb, label: optionLabel, value: cb.value });
});

// Select "Yes" or "No" based on answer bank
for (const [name, group] of Object.entries(yesNoGroups)) {
  const answer = resolveAnswer(group.question); // "Yes" or "No"
  const target = group.options.find(o => o.label?.toLowerCase().includes(answer.toLowerCase()));
  if (target) { target.cb.checked = true; target.cb.dispatchEvent(new Event('change', { bubbles: true })); }
}
```

## Location Combobox Pattern

Ashby location field is a combobox with autocomplete:
```javascript
const locationInput = document.querySelector('input[role="combobox"]');
locationInput.focus();
locationInput.value = 'San Francisco';
locationInput.dispatchEvent(new Event('input', { bubbles: true }));
// Wait 800ms for dropdown, then click first option
await sleep(800);
document.querySelector('[role="option"], [class*="suggestion"], [class*="option"]')?.click();
```

Using Playwright:
```javascript
const loc = page.locator('input[role="combobox"]').first();
await loc.fill('San Francisco, CA');
await page.waitForTimeout(800);
await page.getByRole('option').first().click({ force: true });
```

## Configuration

| Key | Value |
|-----|-------|
| FULL_NAME | `Barron Zuo` |
| EMAIL | `xz429@cornell.edu` |
| PHONE | `+1 9094132840` |
| LOCATION | `San Francisco, CA` |
| LINKEDIN | `https://www.linkedin.com/in/barron-z-15226126a/` |
| WEBSITE | `barronzuo.com` |
| AUTHORIZED | `Yes` |
| SPONSORSHIP | `No` |
| PREVIOUSLY_WORKED | `No` |
| MIN_SALARY | `160000` |
| RESUME_DIR | `~/Downloads/resumeandcoverletter/` |
| LEDGER_FILE | `/Volumes/workssd/ObsidianVault/01-Projects/Ashby-Application-Ledger.md` |

## Dedup Ledger

File: `/Volumes/workssd/ObsidianVault/01-Projects/Ashby-Application-Ledger.md`
Format: `company|job_title|job_uuid|YYYY-MM-DD|status|resume_file|cover_letter_file`

UUID is the dedup key (extracted from URL path).

## Salary Gate

- Salary visible and < $160K → SKIP
- No salary listed → PROCEED
- Salary listed as equity-only → PROCEED

## Resume & Cover Letter Generation

Reuse ALL templates and experience bank from greenhouse-apply:
- Templates: `~/.claude/skills/greenhouse-apply/templates/resume-prompt.md`
- Templates: `~/.claude/skills/greenhouse-apply/templates/cover-letter-prompt.md`
- Experience bank: `~/.claude/skills/greenhouse-apply/data/barron-experience-bank.md`
- Generator: `~/.claude/skills/greenhouse-apply/scripts/generate-resume.py`

File naming:
- `Barron_Zuo_{Company}_{JobTitle}_Resume.docx`
- `Barron_Zuo_{Company}_{JobTitle}_Cover_Letter.docx`

## Critical Field-Fill Pattern (Whatnot validated 2026-04-29)

**React fields fail silently with evaluate** — `el.value = x` doesn't persist in React state.

Correct workflow:
1. Fill standard fields (name, email, phone, linkedin) via `browser_evaluate` with `InputEvent` — these persist
2. For fields that fail validation after submit: take a **fresh `browser_snapshot`** to get current element refs
3. Use `browser_type` with snapshot refs (e.g. `e311`) — Playwright's `.fill()` properly triggers React state
4. File upload: click the **"Upload file" button** (`button[class*="_ctaButton_"]`), NOT the hidden `#_systemfield_resume` input — the input is covered by an overlay
5. Radio buttons: `evaluate` with `label.click()` or `input.click()` works correctly
6. Submit: use snapshot ref after fresh snapshot

**Full Legal Name**: Use legal first name "Xiao" + last "Zuo" — NOT preferred name "Barron"
**Preferred First/Last**: "Barron" / "Zuo" — separate fields, always required

## Token Rules

1. Use `browser_snapshot` ONCE when form fields fail validation to get fresh refs for `browser_type`
2. Otherwise all DOM work via `browser_evaluate` or `browser_run_code`
2. Use Ashby API for JD when possible (faster, no page load needed)
3. After each job: forget JD + resume content, retain ledger state + URL queue
4. Max 2 jobs per `/ashby-url-apply` invocation, then context refresh

## Error Recovery

| Error | Action |
|-------|--------|
| URL 404 / job closed | Log "Job no longer available", skip |
| JD empty from API | Fall back to page scrape |
| Location combobox no options | Try shorter city name ("San Francisco") |
| File upload fails | Retry with `setInputFiles` directly on `#_systemfield_resume` |
| Submit validation error | Read error text, fix field, retry once |
| CAPTCHA | STOP, flag for manual intervention |
| 3+ consecutive failures | Switch to Opus for diagnosis |
| Not an Ashby URL | Log warning, skip |

## Paylocity Platform Notes (Channellock run 2026-04-29)

### Key patterns
- React Widgets (`rw-dropdownlist`) — click combobox via snapshot ref, then click option via xpath `//li[@id="{fieldname}__listbox__option__{n}"]`
- Option IDs follow pattern: `{fieldId}__listbox__option__{0=blank,1=Yes/first,2=No/second}`
- `evaluate` option clicks do NOT persist React state — must use `browser_click` for both steps
- pcty-input-select (country/state) — display value visible but hidden input `.value` stays empty if filled via evaluate; needs Playwright click interaction
- Form is all-on-one-page (SPA), all steps visible simultaneously
- Work history auto-populated from resume upload
- Available-to-start, dob fields may block Next Step if required

### Recommendation
- Paylocity requires ~30+ individual browser_click operations for a full form
- Only proceed if salary is confirmed above threshold (no salary = likely below $160k for non-tech employers)
