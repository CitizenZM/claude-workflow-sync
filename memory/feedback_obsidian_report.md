---
name: Always update Obsidian report
description: After every greenhouse application batch or progress update, save report data to Obsidian vault
type: feedback
originSessionId: 8422aa4a-6f5b-4f5b-9f83-5eab3a0201a7
---
Always update the Obsidian report file at `/Users/barrom/Library/Mobile Documents/iCloud~md~obsidian/Documents/ObsidianVault/01-Projects/Greenhouse-Application-Report.md` with current progress and data after each greenhouse application batch.

**Why:** User wants a single source of truth in Obsidian for tracking application campaign progress, accessible across devices via iCloud sync.

**How to apply:** After every `/greenhouse-apply` batch completes (or on any progress milestone), update the Obsidian report with current stats (submitted count, skipped, failed, remaining queue, role distribution, company distribution, notable applications). Also update the ledger file in the same directory. Do this by default — never skip.
