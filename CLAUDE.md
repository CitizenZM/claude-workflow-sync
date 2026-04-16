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
