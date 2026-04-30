---
name: impact-ottocast-us-affiliate-outreach
description: Impact Ottocast US Affiliate Outreach. Native Node.js CDP runner (zero LLM tokens during loop). Full publisher intelligence scrape via Shadow DOM access — emails, contacts, websites, web metrics, address. ~40s per publisher, 95%+ token savings vs LLM-driven loop.
tags: [affiliate, impact, ottocast, us, outreach, automation, playwright, node, optimized]
---

# Impact Ottocast US Affiliate Outreach (v2 — Optimized)

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
# 1. Edit config first to add Ottocast's program_id
vim ~/.claude/skills/impact-ottocast-outreach/config.json

# 2. Ensure Chrome+CDP up
bash ~/.claude/scripts/outreach/init-workflow.sh impact-ottocast playwright-impact-ottocast 9304

# 3. Login if needed (Sonnet handles via MCP, only first time)
# 4. Run the outreach (native Node — no LLM cost)
node ~/.claude/skills/_shared/impact-proposal-runner.js 1000 \
  ~/.claude/skills/impact-ottocast-outreach/config.json
```

## Configuration

File: `~/.claude/skills/impact-ottocast-outreach/config.json`

| Key | Value |
|-----|-------|
| program_id | `OTTOCAST_PROGRAM_ID_PLACEHOLDER` (UPDATE!) |
| advertiser | `ottocast-us` |
| cdp_port | `9304` |
| MSG | Ottocast-specific (auto tech) outreach message |
| business_models | CONTENT_REVIEWS, DEAL_COUPON, EMAIL_NEWSLETTER, LOYALTY_REWARDS, NETWORK |

## Browser Profile + MCP

| Resource | Value |
|----------|-------|
| Browser profile | `~/.claude/browser-profiles/impact-ottocast` |
| Chrome CDP port | `9304` |
| MCP server | `playwright-impact-ottocast` (only used for login phase) |

## Output Files

- **Ledger**: `Impact-Ottocast-Us-Outreach-Ledger.md`
- **Intel DB**: `Impact-Ottocast-Us-Publisher-Intel.md`
- **Session log**: `Impact-Ottocast-Us-Outreach.md`

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
  ~/.claude/skills/impact-ottocast-outreach/config.json
```

## See Also

- Generic runner: `~/.claude/skills/_shared/impact-proposal-runner.js`
- Reference skill: `impact-rockbros-us-outreach` (same architecture, full docs)
- v1 backup: `SKILL.md.v1-backup-2026-04-30`
