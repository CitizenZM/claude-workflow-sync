---
name: xz429-job-apply-tracking
description: Job application tracking for xz429@cornell.edu. Reads 30-day email activity (replies, interviews, rejections), syncs all 4 ledgers (Ashby/Greenhouse/Wellfound/WATAS), and produces a weekly action report with follow-up priorities.
tags: [job-search, tracking, gmail, ashby, greenhouse, wellfound, workatastartup, report]
---

# XZ429 Job Apply Tracking

## Architecture (MOP v4.5 optimized)

**Three-phase fan-out, Sonnet-only:**
- Phase 1: Parallel Gmail + Ledger reads (no blocking dependencies)
- Phase 2: Cross-reference and status inference (email signals → ledger updates)
- Phase 3: Synthesize and output report

**Model**: Sonnet (all phases — data aggregation + synthesis, no heavy generation needed)
**No sub-agents needed** — single-pass fan-out via parallel evaluate calls

## PREREQUISITE — Gmail MCP Account

This skill **requires** the Gmail MCP to be connected to `xz429@cornell.edu`.

**Current state**: Gmail MCP is connected to `affiliate@celldigital.co` (wrong account).

**One-time fix** (do this in Claude.ai, not in Claude Code):
1. Open **claude.ai → Settings → Integrations**
2. Find **Gmail** → disconnect current account
3. Connect `xz429@cornell.edu`
4. Run `/xz429jobapplytracking` — it will auto-verify and proceed

Until fixed, the skill runs ledger-only mode (no email cross-referencing). All pipeline tracking and follow-up prioritization still works based on application age.

## Configuration

| Key | Value |
|-----|-------|
| EMAIL | xz429@cornell.edu |
| LOOKBACK_DAYS | 30 |
| GMAIL_QUERY | `to:xz429@cornell.edu OR from:xz429@cornell.edu (interview OR application OR opportunity OR role OR position OR offer OR next steps OR recruiter OR hiring) newer_than:30d` |
| ASHBY_LEDGER | `~/Documents/Obsidian/01-Projects/Ashby-Application-Ledger.md` |
| GREENHOUSE_LEDGER | `~/Documents/Obsidian/01-Projects/Greenhouse-Application-Ledger.md` |
| WELLFOUND_LEDGER | `~/Documents/Obsidian/Wellfound-Application-Ledger.md` |
| WATAS_LEDGER | `~/Documents/Obsidian/01-Projects/Workatastartup/_Ledger.md` |
| REPORT_OUTPUT | `~/Documents/Obsidian/01-Projects/JobTracker/Report-{YYYY-MM-DD}.md` |
| STATUS_INDEX | `~/Documents/Obsidian/01-Projects/JobTracker/StatusIndex.md` |

## Status Taxonomy

```
submitted        → Applied, no response yet
email_reply      → Company replied (non-rejection)
screening        → Phone/video screening scheduled or completed
interview        → Technical or panel interview scheduled/completed
offer            → Offer received
rejected         → Explicit rejection received
ghosted          → 14+ days since submission, no response
follow_up_due    → 7 days since submission, no response → needs follow-up email
manual_review    → Needs manual action (video, portfolio, etc.)
fill_failed      → Automation failed, needs manual completion
skipped_salary   → Below $160K threshold
skipped          → Location/other mismatch
```

## Email Signal → Status Mapping

| Email Signal | Inferred Status Update |
|-------------|----------------------|
| Contains "interview", "schedule", "calendly", "zoom" | → `screening` or `interview` |
| Contains "next steps", "move forward", "advance" | → `screening` |
| Contains "unfortunately", "not moving forward", "other candidates" | → `rejected` |
| Contains "offer", "compensation", "start date" | → `offer` |
| Contains "application received", "thank you for applying" | → keep `submitted` |
| Company replied with question, any other non-template reply | → `email_reply` |

## Follow-up Priority Rules

**🔴 ACTION THIS WEEK:**
- Status = `screening` or `interview` → confirm/prepare
- Status = `follow_up_due` (7-13 days old, no email activity)
- Status = `manual_review` or `fill_failed` → complete manually

**🟡 MONITOR:**
- Status = `email_reply` → awaiting their next move
- Status = `submitted` and 4-6 days old

**⚪ DORMANT:**
- Status = `ghosted` (14+ days, no reply)
- Status = `rejected`
- Status = `skipped*`
