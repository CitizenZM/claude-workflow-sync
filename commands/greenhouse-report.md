---
description: "Generate Greenhouse application report from ledger (Haiku). Usage: /greenhouse-report"
model: haiku
---

## MODEL GATE — MANDATORY FIRST CHECK
This command REQUIRES model: **haiku**. Before doing ANY work, check your current model. If you are running on Opus or Sonnet, STOP IMMEDIATELY and tell the user: "⛔ Wrong model. This command requires Haiku. Run `/model haiku` then re-run `/greenhouse-report`." Do NOT proceed on the wrong model — it wastes 10-20x credits for identical work.

# Greenhouse Report

Generate a comprehensive report from the Greenhouse Application Ledger.

## Steps

1. Read `/Volumes/workssd/ObsidianVault/01-Projects/Greenhouse-Application-Ledger.md`
2. Parse all entries: `company|job_title|job_id|date|status|resume_file|cover_letter_file`

3. Generate report with:
   - **Summary**: Total applications, date range, success rate
   - **By Date**: Applications grouped by date
   - **By Company**: Companies applied to
   - **By Role**: Role types/titles
   - **Files Generated**: List of resume and cover letter .docx files

4. Write report to `/Volumes/workssd/ObsidianVault/01-Projects/Greenhouse-Application-Report-{YYYY-MM-DD}.md`

## Report Format

```markdown
# Greenhouse Application Report — {date}

## Summary
- **Total Applications**: {N}
- **Date Range**: {first_date} to {last_date}
- **Companies**: {unique_companies}
- **Roles**: {unique_roles}

## Applications by Date

### {date}
| # | Company | Role | Status | Resume | Cover Letter |
|---|---------|------|--------|--------|-------------|
| 1 | ... | ... | ... | ... | ... |

## Top Companies
{list of companies with count}

## Role Distribution
{list of role types with count}

## Files Generated
- Resumes: {count} in ~/Downloads/resumeandcoverletter/
- Cover Letters: {count} in ~/Downloads/resumeandcoverletter/
```
