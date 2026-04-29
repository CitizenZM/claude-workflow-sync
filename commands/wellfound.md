---
description: "Wellfound full workflow umbrella (Sonnet). Runs setup → apply loop → report. Usage: /wellfound"
model: sonnet
---

## MODEL GATE
Requires **sonnet**. If on Opus, STOP: "Run `/model sonnet` then `/wellfound`."

## BROWSER ISOLATION
All browser tools: use `mcp__playwright-wellfound__*` (dedicated port 9306 Chrome profile).

# Wellfound Job Application April192026 — Full Workflow

This umbrella command runs the complete Wellfound application workflow.

## Execution Order

1. **Read skill config**: `~/.claude/skills/wellfound-apply/SKILL.md`

2. **Setup** (if not already done this session):
   - Follow all steps from `~/.claude/commands/wellfound-setup.md`
   - Complete when: job queue is built and jobs are saved

3. **Apply loop** (repeat until queue exhausted):
   - Follow all steps from `~/.claude/commands/wellfound-apply.md`
   - Max 2 jobs per invocation
   - After each 2-job batch: output status, continue automatically (no pause needed unless CAPTCHA)
   - Wait 15 seconds between batches (rate-limit protection)

4. **Report** (after all jobs applied):
   - Follow `~/.claude/commands/wellfound-report.md`
   - Output final summary

## Opus Review Protocol
After every 10 applications, pause and spawn an Opus agent to review:
- Were the forms filled correctly?
- Did submissions succeed?
- Are there patterns in failures?
- Quality check on resume/CL tailoring

The Opus agent should read the last 10 ledger entries and the last 5 learned-answers.

## Error Escalation
- 3+ consecutive failures → STOP, auto-switch to Opus for diagnosis
- CAPTCHA → STOP, surface screenshot, wait for user
- Session expired → re-run setup phase, then resume
