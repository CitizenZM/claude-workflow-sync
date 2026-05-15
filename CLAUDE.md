@~/Developer/browser-harness/SKILL.md

# Barron's Global Claude Code Configuration

## Identity
- Operator: Barron Zuo, Solo Entrepreneur & Affiliate Marketing Director
- Company: Cell Digital Technology Inc. / Next2Market / Xark.io
- Primary stack: Next.js 14+, TypeScript, Supabase, Tailwind CSS, Vercel

## Default Behavior
- **Autonomous execution mode**: Make all decisions independently. Surface results, not options.
- **No confirmation loops**: Execute the task. If it fails, debug and retry automatically up to 3 attempts.
- **Always validate before claiming done**: Run tests, check builds, verify outputs.
- **If 3+ fixes fail on the same issue**: STOP. Flag it as an architectural problem, not a bug.

## Tech Stack Defaults
- **Framework**: Next.js 14+ with App Router, TypeScript strict mode
- **Database**: Supabase (project: adstream-ai, ID: izeixnkpquztaczehhum)
- **Styling**: Tailwind CSS + shadcn/ui
- **Deployment**: Vercel (use vercel-deploy skill for claimable deploys)
- **Package manager**: pnpm preferred, npm fallback
- **Git**: Always commit with meaningful messages. Push via GitHub MCP.

## Quality Gates (Enforced by Skills)
1. **Before any fix**: Use systematic-debugging skill → find root cause FIRST
2. **Before any feature**: Use test-driven-development skill → write test FIRST
3. **Before any commit**: Use verification-before-completion skill → validate FIRST
4. **On dependency errors**: Use root-cause-tracing → identify monorepo/workspace boundaries
5. **On 3+ consecutive failures**: STOP and reassess architecture

## Output Preferences
- Structured, scannable: headings, tables, bold key terms
- McKinsey-style consulting language with depth
- Suggest a "next step" at the end of every task
- For docs/reports: .docx format, dense prose, no fluff
- For presentations: PPT-structured format
- Bilingual (English + Chinese) in business/strategy contexts

## Project Paths
- Active projects: ~/Projects/
- Affiliate tools: ~/Projects/affiliate-os/
- Client work: ~/Projects/cell-digital/
- Experiments: ~/Projects/sandbox/

## Credential Notes
- Supabase publishable key: stored in .env.local per project
- GitHub: uses PAT via MCP server (no manual git auth needed)
- Vercel: uses claimable deploy skill (no token needed)
- Never hardcode secrets. Use .env.local + Supabase vault.

## Affiliate Marketing Context
- Brands managed: Levoit, Cosori, TCL, Aosulife, OhBeauty, Insta360
- Platforms: Impact, Amazon Associates, CJ, Awin
- Publisher tiers: T1 (>1M MAU), T2 (100K-1M), T3 (<100K)
- Key metrics: GMV, ROAS, AOV, CVR, CPA, EPC
- Audit framework: GEM (maturity scoring, structure diagnosis, publisher battle plan)


# === MASTER ORCHESTRATION PROTOCOL v4.6.1 ===

**MANDATORY LOAD ORDER — read at the start of EVERY Claude Code session, before responding to anything:**

1. Read `~/Documents/Claude/config/skills/mop-master/SKILL.md` in full
2. Apply §0 Prime Directive + §0.5 Iron Laws to all behavior
3. For ANY non-trivial task (build/create/develop/research/plan/workflow/report), emit `[MOP T v4.5]` triage block BEFORE other output
4. Use `/mop` slash command to explicitly activate or re-confirm protocol mid-session

**This is not optional.** MOP is enforced at three layers:
- `UserPromptSubmit` hook (`mop-triage-hook.sh`) — injects the rule into every prompt
- This CLAUDE.md block — read at session start
- `/mop` command — manual reactivation if needed

**MOP enables for every project/task automatically:**
- Three-tier delegation (Opus PM → Haiku workers → Sonnet fallback)
- 13-pattern failure recovery (no pauses, no user-ask mid-task)
- Per-response telemetry → weekly self-improvement via `mop_learn.py`
- Auto-sync to GitHub (3-change threshold + daily cron at 02:00)
- Token discipline via the 6 enforced rules in SKILL.md §15

**Supervisor / QA**: PM runs all supervision INSIDE the Opus session. There is no separate process. PM enforces Iron Laws (verification-before-completion, root-cause-before-fix) at module boundaries via two-stage review (SKILL.md §17.7 Pattern B).

**Suppress with**: `--mop-off` (Class S trivial Q&A only).

# === END MOP PATCH ===
