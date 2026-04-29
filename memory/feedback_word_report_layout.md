---
name: feedback_word_report_layout
description: Word/PDF reports must have polished layout — proper column widths, no overflow, landscape for wide tables, controlled page breaks
type: feedback
originSessionId: d954a0ef-f270-4c2a-ad71-f859ba918cfd
---
When producing .docx reports for circulation, layout matters as much as content.

**Why:** Reports go to brand stakeholders / executives. A table that wraps awkwardly or overflows the page reads as unprofessional regardless of how good the analysis is.

**How to apply:**
- Tables with > 5 columns OR long text columns (subject lines, action descriptions) → use **landscape orientation** for that section, OR explicit `Cm()` column widths summing to printable width
- Set explicit column widths via `cell.width = Cm(...)` for every cell in every row (python-docx inherits poorly otherwise)
- Wide-text columns (subject, description, impact) → wider widths (4-6cm); short codes (priority, region) → narrow (1.5-2cm)
- Use page-break-before for each top-level section to keep tables intact
- Set table style + autofit=False when applying explicit widths
- For email-trace tables: ALWAYS drop email column (privacy rule) — this also frees horizontal space
- Test by opening the .docx and checking no table overflows the right margin
