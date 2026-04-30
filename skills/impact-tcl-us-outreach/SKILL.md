---
name: impact-tcl-us-affiliate-outreach
description: Impact TCL US Affiliate Outreach. Native Node.js CDP runner (zero LLM tokens during loop). Full publisher intelligence scrape via Shadow DOM access — emails, contacts, websites, web metrics, address. ~40s per publisher, 95%+ token savings vs LLM-driven loop.
tags: [affiliate, impact, tcl, us, outreach, automation, playwright, node, optimized]
---

# Impact TCL US Affiliate Outreach (v2 — Optimized)

## Architecture (v2 — 2026-04-30)

| Phase | Engine | Token Cost | Purpose |
|-------|--------|------------|---------|
| Setup | Sonnet | Medium | Login, browser init, config validation |
| Outreach | **Native Node.js** | **Zero** | Direct Playwright CDP — no LLM in loop |
| Report | Haiku | Low | Read ledger, format summary |

**Why this is 95%+ cheaper than v1:**
- v1 Sonnet+Haiku per-tab loop: 60-80K tokens per publisher × 1000 = ~70M tokens
- v2 Node.js direct CDP: 0 tokens during loop, ~5K total for setup+report
- Performance: ~40s per publisher (vs 3-5 min in LLM loop)

## Quick Start

```bash
# 1. Edit config first to add TCL's program_id
vim ~/.claude/skills/impact-tcl-us-outreach/config.json

# 2. Ensure Chrome+CDP up
bash ~/.claude/scripts/outreach/init-workflow.sh impact-tcl-us playwright-impact-tcl-us 9305

# 3. Login if needed (Sonnet handles via MCP, only first time)
# 4. Run the outreach (native Node — no LLM cost)
node ~/.claude/skills/_shared/impact-proposal-runner.js 1000 \
  ~/.claude/skills/impact-tcl-us-outreach/config.json
```

## Configuration

File: `~/.claude/skills/impact-tcl-us-outreach/config.json`

| Key | Value |
|-----|-------|
| program_id | `TCL_PROGRAM_ID_PLACEHOLDER` (UPDATE!) |
| advertiser | `tcl-us` |
| cdp_port | `9305` |
| MSG | TCL-specific outreach message |
| business_models | CONTENT_REVIEWS, DEAL_COUPON, EMAIL_NEWSLETTER, LOYALTY_REWARDS, NETWORK |

## Browser Profile + MCP

| Resource | Value |
|----------|-------|
| Browser profile | `~/.claude/browser-profiles/impact-tcl-us` |
| Chrome CDP port | `9305` |
| MCP server | `playwright-impact-tcl-us` (only used for login phase) |

## Output Files

- **Ledger**: `Impact-Tcl-Us-Outreach-Ledger.md`
- **Intel DB**: `Impact-Tcl-Us-Publisher-Intel.md`
- **Session log**: `Impact-Tcl-Us-Outreach.md`

## Critical Implementation Details

See main skill: `impact-rockbros-us-outreach/SKILL.md` for detailed architecture (Shadow DOM access, modal cleanup, iframe URL extraction, term/date sequence).

All Impact programs share the same generic runner at:
`~/.claude/skills/_shared/impact-proposal-runner.js`

## Performance Benchmarks

Verified on Rockbros (same architecture):
- ~40s per publisher
- 100% success rate on test runs
- 89% email capture, 83% contact name capture

## Restart on Failure

The ledger acts as dedup — already-sent publishers are skipped:

```bash
node ~/.claude/skills/_shared/impact-proposal-runner.js 1000 \
  ~/.claude/skills/impact-tcl-us-outreach/config.json
```

## See Also

- Generic runner: `~/.claude/skills/_shared/impact-proposal-runner.js`
- Reference skill: `impact-rockbros-us-outreach` (same architecture, full docs)
- v1 backup: `SKILL.md.v1-backup-2026-04-30`
