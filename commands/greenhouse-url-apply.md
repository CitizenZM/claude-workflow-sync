---
description: "Apply to jobs from a direct URL list (Sonnet). Handles Greenhouse, Ashby, Google Forms, SmartRecruiters, Workday, Paylocity + others. Deduplicates against shared Greenhouse-Application-Ledger. Usage: /greenhouse-url-apply [url1 url2 ...] OR /greenhouse-url-apply --file ~/path/to/urls.txt"
model: sonnet
---

## MODEL GATE — MANDATORY FIRST CHECK
This command REQUIRES model: **sonnet**. Before doing ANY work, check your current model. If you are running on Opus, STOP IMMEDIATELY and tell the user: "⛔ Wrong model. This command requires Sonnet. Run `/model sonnet` then re-run `/greenhouse-url-apply`." Do NOT proceed on Opus — it wastes 5-10x credits.

# Multi-Platform URL Apply

You apply to jobs from any ATS platform using a direct URL list. Resume/CL generation, salary gate, and dedup logic are shared across all platforms. Platform-specific form-filling logic is defined per-platform below.

---

## Pre-Loop Setup

1. Read `~/.claude/skills/greenhouse-apply/SKILL.md` for config, selectors, personal info
2. Read `~/.claude/skills/greenhouse-apply/data/answer-bank.md` for form answers
3. Read `/Volumes/workssd/ObsidianVault/01-Projects/Greenhouse-Application-Ledger.md` for dedup
4. Also read `/Volumes/workssd/ObsidianVault/01-Projects/Ashby-Application-Ledger.md` for dedup
5. Parse `$ARGUMENTS`:
   - If `--file <path>` → read URLs one-per-line from that file
   - Otherwise treat each whitespace-separated token as a URL
   - If no arguments → STOP and output: "Usage: /greenhouse-url-apply [url1 url2 ...] OR /greenhouse-url-apply --file ~/path/to/urls.txt"
6. Build `URL_QUEUE` from parsed list

**Personal Info (from SKILL.md config):**
- Legal Name: Xiao Zuo | Preferred: Barron Zuo
- Email: xz429@cornell.edu | Phone: +1 9094132840
- Location: San Francisco, CA | LinkedIn: linkedin.com/in/barron-z-15226126a/
- Authorized: Yes | Sponsorship: No | Previously worked: No

---

## Platform Detection

For each URL, detect platform BEFORE navigating:

```javascript
const detect = (url) => {
  if (/greenhouse\.io/.test(url)) return 'greenhouse';
  if (/ashbyhq\.com/.test(url)) return 'ashby';
  if (/myworkdayjobs\.com/.test(url)) return 'workday';
  if (/smartrecruiters\.com/.test(url)) return 'smartrecruiters';
  if (/paylocity\.com/.test(url)) return 'paylocity';
  if (/lever\.co/.test(url)) return 'lever';
  if (/forms\.gle|docs\.google\.com\/forms/.test(url)) return 'google-form';
  if (/jobs\.gusto\.com/.test(url)) return 'gusto-board';
  if (/meeboss\.com|indeed\.com|linkedin\.com\/jobs/.test(url)) return 'aggregator';
  return 'unknown';
};
```

**Platform routing:**
- `greenhouse` → full apply flow (Steps 1–13 below)
- `ashby` → Ashby handler (see Ashby section)
- `workday` → check for active session; if not authenticated, flag as "needs-auth" and skip
- `smartrecruiters` → SmartRecruiters handler
- `paylocity` → Paylocity handler (complex — only proceed if salary confirmed ≥ $160k)
- `google-form` → Google Form handler
- `gusto-board` → navigate, salary gate, then standard form
- `aggregator` / `unknown` → navigate to resolve actual ATS, re-detect, or flag for manual review

---

## Shared: Fast Dedup (Before Any Navigation)

```javascript
// Greenhouse: extract job_id from URL
const ghMatch = url.match(/\/jobs\/(\d+)/);
const ghJobId = ghMatch ? ghMatch[1] : null;

// Ashby: extract UUID from URL
const ashbyMatch = url.match(/ashbyhq\.com\/[^/]+\/([a-f0-9-]{36})/);
const ashbyUuid = ashbyMatch ? ashbyMatch[1] : null;
```

- If `ghJobId` found in Greenhouse ledger → SKIP
- If `ashbyUuid` found in Ashby ledger → SKIP

---

## Shared: JD Extraction & Salary Gate

After navigating to the job URL, extract JD using platform-appropriate selector:

```javascript
const jd = document.body.innerText.trim();
const salary = jd.match(/\$[\d,]+\s*[-–]\s*\$[\d,]+|\$[\d,]+[kK]/gi);
const title = document.querySelector('h1')?.innerText?.trim();
```

**Salary Gate:** If salary is visible and max value < $160,000 → SKIP. Log reason. No salary listed → proceed.

---

## Shared: Resume + Cover Letter Generation

Steps 5–7 are identical for ALL platforms.

### Step 5: Generate Tailored Resume
Read `~/.claude/skills/greenhouse-apply/templates/resume-prompt.md`.
- Analyze JD: keywords, North Star metric, seniority level
- Tailor all 3 roles: Alibaba ($180M ARR, AI, social commerce) · Next2Market (B2B SaaS, $7M budgets) · Indiegogo (pipeline, virality)
- Every bullet: power verb + metric + JD keyword
- Exactly 2 pages
- Output JSON per template format

### Step 6: Generate Tailored Cover Letter
Read `~/.claude/skills/greenhouse-apply/templates/cover-letter-prompt.md`.
- Company-specific opening hook + Alibaba match + Next2Market match + 90-day close
- Output JSON per template format

### Step 7: Generate .docx Files
```bash
python3 ~/.claude/skills/greenhouse-apply/scripts/generate-resume.py \
  --type resume \
  --template ~/Downloads/resumeandcoverletter/Barron_Zuo_Resume_Dialpad_HeadOfGrowth.docx \
  --content '<resume_json>' \
  --output ~/Downloads/resumeandcoverletter/Barron_Zuo_<Company>_<RoleTitle>_Resume.docx

python3 ~/.claude/skills/greenhouse-apply/scripts/generate-resume.py \
  --type cover_letter \
  --template ~/Downloads/resumeandcoverletter/Barron_Zuo_Cover_Letter_Dialpad_HeadOfGrowth.docx \
  --content '<cover_letter_json>' \
  --output ~/Downloads/resumeandcoverletter/Barron_Zuo_<Company>_<RoleTitle>_Cover_Letter.docx
```

---

## Shared: Ledger Recording

After any successful submission, append to the appropriate ledger:

**Greenhouse ledger** (`/Volumes/workssd/ObsidianVault/01-Projects/Greenhouse-Application-Ledger.md`):
```
{company}|{job_title}|{job_id_or_platform-uuid}|{YYYY-MM-DD}|submitted|{resume_file}|{cover_letter_file}
```

**Ashby ledger** (`/Volumes/workssd/ObsidianVault/01-Projects/Ashby-Application-Ledger.md`):
Same format, use UUID as job_id field.

For non-Greenhouse/Ashby platforms, also append to Greenhouse ledger with prefix:
`google-form-{formId}` / `workday-{reqId}` / `smartrecruiters-{jobId}` / `paylocity-{jobId}`

---

## PLATFORM HANDLERS

---

### 🌿 GREENHOUSE

Standard flow. Steps 8–13 as defined in original `/greenhouse-apply` skill.

**Key patterns:**
- Apply form is at same URL or via "Apply for this Job" button
- React Select dropdowns: use `browser_click` on XPath ancestor of input `//input[@id="{id}"]/ancestor::div[contains(@class,"select__control")]`, then click option
- Greenhouse EEOC fields use `react-select-{id}-option-{n}` IDs — click by ID via `browser_click`
- File upload: click "Attach" button (not hidden input), then `browser_file_upload`
- Remove existing resume: `//div[@id="upload-label-resume"]/following-sibling::*//button[@aria-label="Remove file"]`

**Greenhouse custom fields (Gusto-pattern):**
- Legally authorized / sponsorship / metro area: React Select comboboxes
- EEOC: separate react-select instances for gender/race/veteran/disability/transgender
- "How did you hear": checkbox group, find by `label[for]` then click via XPath
- First-gen professional: react-select id="1012"

---

### 🔷 ASHBY

**URL normalization:** Strip `?utm_source=`, `?src=`. Append `/application` if not present.
**Job UUID for dedup:** path segment after company slug.

**Form fields:**
| Field | ID | Notes |
|-------|-----|-------|
| Full Legal Name | `#_systemfield_name` | Use "Xiao Zuo" (legal name) |
| Email | `#_systemfield_email` | Standard |
| Resume | `#_systemfield_resume` | **DO NOT click input** — click `button[class*="_ctaButton_"]` "Upload file" button |
| Phone | UUID-named `input[type="tel"]` | Fill via `browser_type` |
| Preferred First | UUID-named textbox | Fill via `browser_type` with snapshot ref |
| Preferred Last | UUID-named textbox | Fill via `browser_type` with snapshot ref |
| LinkedIn | UUID-named | Fill via evaluate InputEvent |
| City/State | UUID-named | Fill via `browser_type` with snapshot ref |

**CRITICAL: React state pattern for Ashby**
1. Fill email/phone/linkedin via `browser_evaluate` with `InputEvent` — these persist
2. After first submit attempt, take `browser_snapshot` to get current refs
3. Fill ALL remaining empty required fields via `browser_type` with snapshot refs (e.g. `e311`)
4. Radio buttons: use `evaluate` with `label.click()` or `input.click()` on the label element

**File upload:**
```javascript
// WRONG — input is under an overlay:
document.getElementById('_systemfield_resume').click(); // ❌

// CORRECT — click the visible button:
const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Upload file');
btn.click(); // ✅ then browser_file_upload
```

**Submit:** Use snapshot ref `browser_click` on "Submit Application" button. If still on same page after 4s, re-snapshot and retry.

**Dedup ledger:** `/Volumes/workssd/ObsidianVault/01-Projects/Ashby-Application-Ledger.md`

---

### 📋 GOOGLE FORMS (`forms.gle`, `docs.google.com/forms`)

**Form structure:** All questions render as `input[type="text"]` or `textarea` in order matching the visible form.

**Fill pattern:**
```javascript
const inputs = Array.from(document.querySelectorAll('input[type="text"], textarea'));
// inputs[0] = Q1, inputs[1] = Q2, etc.
const setVal = (el, v) => {
  el.focus(); el.value = v;
  el.dispatchEvent(new Event('input', {bubbles: true}));
  el.dispatchEvent(new Event('change', {bubbles: true}));
  el.blur();
};
```

**Standard answers to pre-fill:**
- Full name: "Barron Zuo"
- Email: "xz429@cornell.edu"
- LinkedIn/Twitter: "https://www.linkedin.com/in/barron-z-15226126a/"
- Location: "San Francisco, CA"
- Salary expectations: "$160,000 - $200,000 base, flexible on total comp"
- Availability: "Available to start within 2 weeks"
- Open-ended questions: generate tailored answers from JD context

**Submit:**
```javascript
const submit = Array.from(document.querySelectorAll('[role="button"]')).find(b => b.textContent.trim() === 'Submit');
submit.click(); // navigation to formResponse confirms success
```

**Success confirmation:** URL contains `formResponse` + body contains "Your response has been recorded."

**No ledger dedup available** — use Google Form ID from URL as job_id with prefix `google-form-`.

---

### 🔵 SMARTRECRUITERS

**URL pattern:** `jobs.smartrecruiters.com/{company}/{jobId}-{title}`

**Flow:**
1. Navigate to job page, extract JD + salary
2. Find Apply button: `Array.from(document.querySelectorAll('a,button')).find(el => /apply now/i.test(el.textContent))`
3. Click Apply → may redirect to SmartRecruiters apply form or external ATS
4. If redirects to external ATS (Greenhouse, Ashby, etc.) → re-detect platform and use appropriate handler
5. If stays on SmartRecruiters: standard form fill (similar to Paylocity, uses React)

**Key SmartRecruiters fields:**
- Name, email, phone: standard inputs
- Resume: file input, trigger via "Upload" button
- Questions: rendered as text inputs or radio groups

**Dedup:** No SmartRecruiters-specific ledger — use Greenhouse ledger with prefix `smartrecruiters-{jobId}`.

---

### ☁️ WORKDAY

**URL pattern:** `{company}.wd{N}.myworkdayjobs.com/{board}/job/{location}/{title}_{reqId}`

**Auth requirement:** Workday requires account login before form access (step 1 of N-step process).

**Auth detection:**
```javascript
// On the apply page, detect if auth is required
const needsLogin = document.title.includes('Sign In') ||
  document.querySelector('[data-automation-id*="signIn"], [data-automation-id*="createAccount"]');
```

**If auth required:**
- Try "Sign in with LinkedIn" → clicks OAuth → if LinkedIn session active, auto-proceeds
- If LinkedIn requires credentials → STOP, flag as "needs-auth": log `"Workday {company} - {title}: needs LinkedIn login. Complete manually or run /greenhouse-url-apply with active LinkedIn session."`
- Do NOT attempt to enter passwords

**If auth succeeds / form accessible:**

Step structure (typically 5–7 steps):
1. **My Information** — name, email, phone, address, how did you hear
2. **My Experience** — resume upload (use "Autofill with Resume" button), work history, education
3. **Application Questions** — company-specific questions (answer from JD context)
4. **Voluntary Disclosures** — EEO/demographic (use standard answer bank)
5. **Self Identify** — disability/veteran
6. **Review** — confirm and submit

**Workday form patterns:**
- All text fields: standard `input[type="text"]`, fill via `browser_type`
- Dropdowns: React Select or Workday custom — use `browser_click` on control, then option
- Resume upload: click "Autofill with Resume" → `browser_file_upload` → let it parse
- Each step: click "Save and Continue" or "Next" button
- Final step: click "Submit"

---

### 💼 PAYLOCITY

**URL pattern:** `recruiting.paylocity.com/recruiting/jobs/Apply/{jobId}/{company}/{title}`

**Salary gate — apply stricter filter for non-tech employers:**
- Paylocity is common for manufacturing, retail, regional companies
- If location is non-major-metro (e.g., Meadville PA, rural cities) → likely salary < $160k even if not listed
- If company appears to be manufacturing/industrial/retail → apply extra scrutiny, ask for salary confirmation before proceeding
- Only proceed automatically if salary is explicitly listed ≥ $160k OR company is clearly tech

**If proceeding:**

1. Upload resume via `Select Resume to Upload` button → `browser_file_upload` → autofill triggers
2. **React Widgets dropdown pattern (CRITICAL):**
   - ALL `rw-dropdownlist` dropdowns REQUIRE `browser_click` for BOTH steps (open + select)
   - Step 1: `browser_click` on combobox ref from snapshot
   - Step 2: Get visible option IDs via evaluate: `Array.from(document.querySelectorAll('.rw-list-option')).filter(el=>el.getBoundingClientRect().width>0).map(o=>o.id)`
   - Step 3: `browser_click` on `xpath=//li[@id="{optionId}"]`
   - Option ID pattern: `{fieldId}__listbox__option__{0=blank, 1=first, 2=second}`

3. **pcty-input-select (Country/State) pattern:**
   - Display value may show but hidden input is empty — must use real click interaction
   - Click the dropdown indicator `img[cursor=pointer]` next to the displayed value
   - Type in the search input, then click the option

4. **Required fields in typical Paylocity form:**
   - Applied before, SMS consent, worked before: rw-dropdownlist
   - Address country/state: pcty-input-select
   - Work history: start date, end date or "Currently Working Here" checkbox, reason for leaving, may we contact
   - Education: did you graduate, country, state

5. **Date format:** MM/DD/YYYY for candidate dates, MM/YYYY for work history start/end

6. Estimated **~40+ individual browser_click operations** for a complete form — only proceed for confirmed high-value roles.

---

### 🔧 LEVER

**URL pattern:** `jobs.lever.co/{company}/{uuid}` or `hire.lever.co/`

**Flow:**
1. Navigate to job detail, extract JD
2. Click "Apply" button
3. Standard Lever form: name, email, phone, resume upload, LinkedIn, optional questions
4. Resume upload: `input[type="file"]` is hidden, trigger via "Attach" or "Upload" button
5. Submit: `button[type="submit"]` or "Submit Application"

**Lever form fields are standard** — similar to Ashby without the React complexity. `browser_evaluate` with `InputEvent` typically works.

---

## Validation Error Recovery Pattern (All Platforms)

When form fails validation after submit attempt:

1. **Collect errors** via evaluate:
```javascript
const errors = Array.from(document.querySelectorAll(
  '[class*="error"], [role="alert"], [aria-invalid="true"], .field-validation-error'
)).map(e => e.textContent.trim()).filter(t => t.length > 2);
```

2. **If errors found:**
   - Take `browser_snapshot` for current refs
   - For each error field: use `browser_click` + `browser_type` (not evaluate) to fill/fix
   - For dropdown errors: click combobox ref → get visible option IDs → click option by ID

3. **If stuck after 2 retries:** Switch to Opus for diagnosis. Report issue.

---

## End of Loop

After all URLs processed:

| URL | Platform | Company | Role | Status | Resume | Cover Letter |
|-----|---------|---------|------|--------|--------|-------------|
| ... | greenhouse/ashby/google-form/... | ... | ... | submitted / skipped-salary / skipped-dedup / needs-auth / error | ... | ... |

Report: total submitted, skipped (with reasons), needs-auth, errors.
Update `answer-bank.md` with any new Q&A pairs discovered.

---

## Context Refresh Rule

After every **2 full applications** (resume generated + submitted), STOP:
> "Context refresh needed. Run `/greenhouse-url-apply` with the remaining URLs to continue."

---

## Token Rules

1. **Greenhouse/Ashby/Lever**: `browser_snapshot` only when validation fails to get refs
2. **All others**: `browser_evaluate` for reads, `browser_click` for React dropdowns
3. Read JS scripts on-demand — do NOT load all upfront
4. After each job: forget JD text + resume content, retain ledger state + URL queue + session counters

---

## Error Recovery Table

| Error | Action |
|-------|--------|
| URL 404 / job closed | Log "Job no longer available", skip |
| JD extraction empty | `browser_snapshot` once; if still empty switch to Opus |
| Apply button not found | Try alternate selectors; log and skip if not resolvable |
| React dropdown not persisting | Switch to `browser_click` → ID-based option click pattern |
| File upload fails | Retry with visible upload button (not hidden input) |
| Submit validation error | `browser_snapshot` → fix via refs → retry once |
| Auth wall (Workday/LinkedIn) | Flag "needs-auth", log, skip |
| Site timeout (>30s) | Skip, log "site unresponsive" |
| python-docx missing | `pip3 install python-docx`, retry |
| CAPTCHA / rate limit | STOP immediately, report progress |
| 3+ consecutive failures | Auto-switch to Opus for diagnosis |
| Salary below $160k | Skip with reason |
| Non-tech employer + no salary | Flag for manual salary check before proceeding |
