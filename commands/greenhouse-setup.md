---
description: "Greenhouse login + job search + queue builder (Sonnet). Run once per session before /greenhouse-apply. Usage: /greenhouse-setup"
model: sonnet
---

# Greenhouse Setup

You are setting up a Greenhouse.io job application session. Follow these steps exactly.

## Step 1: Read Skill Config
Read `~/.claude/skills/greenhouse-apply/SKILL.md` for all configuration values, selectors, and rules.

## Step 2: Navigate and Login
1. Use `browser_navigate` to go to `https://my.greenhouse.io`
2. Use ONE `browser_snapshot` to identify the login form layout and actual selectors
3. Use `browser_type` to enter the user's email when prompted
4. Use `browser_click` on the submit/continue button
5. Handle password entry if needed (user may need to enter password manually)
6. Use `browser_evaluate` to confirm login: `document.title` and `window.location.href`

**Important:** Update the DOM Selectors section in SKILL.md with actual selectors discovered during login.

## Step 3: Navigate to Jobs Page
1. After login, navigate to the job search/listings page
2. Use `browser_evaluate` with the script from `~/.claude/skills/greenhouse-apply/scripts/search-jobs.js` to identify the page layout
3. If there's a search input, use `browser_type` to enter "marketing" as the first search term
4. Wait for results, then try "growth" as additional search

## Step 4: Apply Salary Filter
1. Look for salary/compensation filter controls
2. Set minimum salary to $160,000
3. If no salary filter UI exists, note this — we'll filter by salary text in job cards instead

## Step 5: Extract Job Queue
1. Read and run `~/.claude/skills/greenhouse-apply/scripts/extract-job-list.js` via `browser_evaluate`
2. Collect all job cards with: title, company, salary, location, jobUrl, jobId
3. If there are multiple pages, use `~/.claude/skills/greenhouse-apply/scripts/next-job-page.js` to paginate
4. Continue until all jobs collected or 50-job cap reached

## Step 6: Salary Filtering (Post-Collection)
For each job in the queue:
- If salary text is visible, check if it's >= $160,000
- Parse salary strings like "$160,000 - $200,000", "$180K", etc.
- Remove jobs below the $160,000 threshold
- If salary is not listed, KEEP the job (we'll check on detail page)

## Step 7: Dedup Against Ledger
1. Read `/Volumes/workssd/ObsidianVault/01-Projects/Greenhouse-Application-Ledger.md`
2. Parse existing entries into a Set of `company|job_title` keys
3. Filter out jobs that have already been applied to

## Step 8: Report and Save
1. Report the final job queue: count, job titles, companies
2. Write the queue summary to the Obsidian report file
3. Output: "Setup complete. {N} new jobs found after dedup. Run `/greenhouse-apply` to begin applications."

## Token Rules
- ONE `browser_snapshot` allowed during login for selector discovery
- All other DOM work via `browser_evaluate`
- Read scripts on-demand from scripts/ directory
