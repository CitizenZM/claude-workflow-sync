---
description: "Generate Wellfound application report from ledger (Haiku). Usage: /wellfound-report"
model: haiku
---

## MODEL GATE
This command runs on **Haiku**. If on Opus/Sonnet, that's fine — this is read-only reporting.

# Wellfound Application Report

Read the ledger file:
`/Users/xiaozuo/Library/Mobile Documents/iCloud~md~obsidian/Documents/Openclaw/Wellfound-Application-Ledger.md`

## Generate Report

### Summary Table
| Metric | Value |
|--------|-------|
| Total applied | {count} |
| Submitted | {submitted count} |
| Skipped (salary) | {skipped count} |
| Manual review | {manual count} |
| Failed | {failed count} |

### By Location
| Location | Count |
|----------|-------|
| San Francisco | N |
| Los Angeles | N |
| New York | N |

### Applications List (newest first)
| Date | Company | Role | Status | Comp |
|------|---------|------|--------|------|

### Action Items
- Manual review queue: list jobs marked `manual_review`
- Follow-up candidates: jobs submitted > 5 days ago with no response

Output this report as formatted text. No external files needed.
