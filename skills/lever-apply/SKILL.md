# Lever Job Application Skill

## Lever URL Patterns

| Pattern | Type |
|---------|------|
| `jobs.lever.co/{company}/{uuid}` | Job detail page |
| `jobs.lever.co/{company}/{uuid}/apply` | Direct apply form |
| `jobs.lever.co/{company}/{uuid}/apply?lever-source=...` | Apply form with source tracking |

**UUID extraction**: Same UUID pattern as Ashby — `[0-9a-f]{8}-[0-9a-f]{4}-...`
**Dedup key**: UUID from URL path

## Lever Public API

Lever provides a public job postings API — use it to extract JD without browser:
```
GET https://api.lever.co/v0/postings/{company}/{uuid}
```
Returns JSON: `{ text, categories, descriptionPlain, lists, additional, applyUrl, ... }`

## Form Structure (Lever-specific)

Lever apply forms at `{job_url}/apply`. Standard fields:

| Field | Selector | Notes |
|-------|----------|-------|
| Full Name | `input[name="name"]` | Single field |
| Email | `input[name="email"]` | Standard |
| Phone | `input[name="phone"]` | Standard |
| Current Company | `input[name="org"]` | "Alibaba INC" |
| LinkedIn | `input[name="urls[LinkedIn]"]` | Bracketed name |
| Twitter | `input[name="urls[Twitter]"]` | Optional, skip |
| GitHub | `input[name="urls[GitHub]"]` | Optional, skip |
| Website | `input[name="urls[Other]"]` | barronzuo.com |
| Resume | `input[type="file"]` | File upload |
| Cover Letter | `textarea[name="comments"]` | Plain text box (NOT file upload) |
| EEO | Various select dropdowns | Standard EEO |
| Submit | `button[type="submit"]` | Text: "Submit application" |

## Cover Letter in Lever

**Critical**: Lever uses a `<textarea name="comments">` for cover letter — it is plain text, NOT a file upload. Paste the cover letter text directly into this field.

## EEO Fields in Lever

Standard Lever EEO uses native `<select>` elements (not React Select):
```javascript
const setSelect = (name, value) => {
  const sel = document.querySelector(`select[name="${name}"]`);
  if (!sel) return false;
  const opt = Array.from(sel.options).find(o => o.text.toLowerCase().includes(value.toLowerCase()));
  if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); return true; }
  return false;
};
setSelect('eeo[gender]', 'Male');
setSelect('eeo[race]', 'Asian');
setSelect('eeo[veteran]', 'not a veteran');
setSelect('eeo[disability]', 'No');
```

## Configuration

Reuses all greenhouse-apply config values:
| Key | Value |
|-----|-------|
| FULL_NAME | `Barron Zuo` |
| EMAIL | `xz429@cornell.edu` |
| PHONE | `9094132840` |
| CURRENT_COMPANY | `Alibaba INC` |
| LINKEDIN | `https://www.linkedin.com/in/barron-z-15226126a/` |
| WEBSITE | `barronzuo.com` |
| MIN_SALARY | `160000` |
| LEDGER_FILE | `/Volumes/workssd/ObsidianVault/01-Projects/Lever-Application-Ledger.md` |

## Dedup Ledger

File: `/Volumes/workssd/ObsidianVault/01-Projects/Lever-Application-Ledger.md`
Format: `company|job_title|job_uuid|YYYY-MM-DD|status|resume_file|cl_pasted`

## Resume & Cover Letter Generation

Reuse ALL templates from greenhouse-apply skill. Same `generate-resume.py` script.
Cover letter: generate JSON → extract `paragraphs` array → join as plain text → paste into `textarea[name="comments"]`.

## Token Rules

Same as ashby-apply: no `browser_snapshot`, `browser_run_code` only, max 2 per run.

## Error Recovery

| Error | Action |
|-------|--------|
| API 404 | Fall back to page scrape |
| File upload fails | Use `setInputFiles` directly |
| Cover letter textarea missing | Check for `[data-field="comments"]` fallback |
| Submit validation error | Read error, fix, retry once |
| CAPTCHA | STOP |
