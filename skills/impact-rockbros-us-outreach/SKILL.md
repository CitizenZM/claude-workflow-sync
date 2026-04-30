---
name: impact-rockbros-us-affiliate-outreach
description: Impact Rockbros USA Affiliate Outreach. Native Node.js CDP runner (zero LLM tokens during loop). Full publisher intelligence scrape via Shadow DOM access — emails, contacts, websites, web metrics, address. ~40s per publisher, 95%+ token savings vs LLM-driven loop.
tags: [affiliate, impact, rockbros, us, outreach, automation, playwright, node, optimized]
---

# Impact Rockbros USA Affiliate Outreach (v2 — Optimized)

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
# 1. One-time per session: ensure Chrome+CDP up
bash ~/.claude/scripts/outreach/init-workflow.sh impact-rockbros-us playwright-impact-rockbros-us 9306

# 2. Login if needed (Sonnet handles via MCP, only first time)
# 3. Run the outreach (native Node — no LLM cost)
node ~/.claude/skills/_shared/impact-proposal-runner.js 1000 \
  ~/.claude/skills/impact-rockbros-us-outreach/config.json
```

## Configuration

File: `~/.claude/skills/impact-rockbros-us-outreach/config.json`

| Key | Value |
|-----|-------|
| program_id | `50132` |
| advertiser | `rockbros-us` |
| cdp_port | `9306` |
| MSG | "Hi, this is Bob Zabel..." (10–20% commission, sample offer) |
| business_models | CONTENT_REVIEWS, DEAL_COUPON, EMAIL_NEWSLETTER, LOYALTY_REWARDS, NETWORK |
| size_filter | medium,large,extra_large |
| vault_dir | `/Users/xiaozuo/Documents/Obsidian Vault/01-Projects` |

## Browser Profile + MCP

| Resource | Value |
|----------|-------|
| Browser profile | `~/.claude/browser-profiles/impact-rockbros-us` |
| Chrome CDP port | `9306` |
| MCP server | `playwright-impact-rockbros-us` (only used for login phase) |

## Output Files

- **Ledger** (CSV-like dedup): `Impact-Rockbros-US-Outreach-Ledger.md`
  Format: `name|email|date|program|partner_id|status|size|website|contact_name`
- **Intel DB** (rich profiles): `Impact-Rockbros-US-Publisher-Intel.md`
  Format: Markdown sections with all 15 captured fields per publisher
- **Session log**: `Impact-Rockbros-US-Outreach.md`

## Critical Implementation Details

### Slideout Lives in Shadow DOM (NEW DISCOVERY 2026-04-30)

Publisher slideout content is NOT in main DOM. It renders inside Shadow DOM:

```js
const host = document.querySelector('#unified-program-slideout');
const sr = host.shadowRoot;  // <-- access shadow root
const text = sr.body.innerText;  // contains: name, email, partner_id, web metrics, etc.
```

**v1 mistake**: Used `document.querySelector` and `page.getByText()` from main page — those don't pierce shadow boundaries. v2 uses `host.shadowRoot.querySelectorAll(...)`.

### 5 Critical Bug Fixes vs v1

1. **Date never set**: Click calendar icon button → click "Today" footer button (NOT a day number)
2. **Term selection**: `page.mouse.click()` with iframe-relative coords (NOT `li.click()` in evaluate — React doesn't trigger)
3. **Persistent modal blocking clicks**: After each proposal, navigate dashboard→back to clear stuck modal
4. **Card click target**: Use `.image-container` element (top 206px), not avatar img (often width=0)
5. **Send Proposal button**: Card-level button (not shadow DOM Send Proposal — that's informational only)

### Iframe URL is Golden Source for Contact Data

The proposal iframe URL contains real publisher contact info as query params:

```
/secure/advertiser/contracts/send-proposal-new-partner-flow.ihtml?
  d=lightbox&
  p=1959558&            ← partner_id
  psi=1edb1cb5-...&     ← session id
  name=Tyler%20Coates&  ← contact_name (URL-decoded)
  email=tcoates@kayak.com  ← contact_email
```

Always extract these — they're more reliable than scraping shadow DOM text.

### Per-Publisher Sequence (~40 seconds)

1. Hover card avatar (`.image-container`) → click to open slideout
2. Wait 3.5s, verify URL contains `slideout_id=`
3. Scrape Shadow DOM (`host.shadowRoot.body.innerText`):
   - partner_id, status, size, business_model
   - emails (regex), contact_name (capitalized 2-word pattern, blacklist countries/companies)
   - website (regex with boundary stop), social_properties
   - web metrics: Semrush, monthly visitors, Moz DA/spam
   - corporate_address, language, currency, description
4. Click Details tab if web metrics not yet captured (via shadow DOM querySelector)
5. Navigate back to discover URL
6. Hover card → click main-DOM `Send Proposal` button (NOT shadow button)
7. Wait 4s for iframe; extract iframe URL params (email, name, partner_id)
8. Term selection: `page.mouse.click()` with iframe rect offset
9. Date: click calendar icon → click "Today" button
10. Fill message textarea (native value setter + dispatch input/change events)
11. Click submit (with `scrollIntoView`)
12. Click "I understand" confirmation
13. Wait 2.5s, verify iframe gone → SENT
14. Cleanup stuck modal (dashboard navigate-and-back)
15. Append to Ledger + Intel DB → next publisher

## Filters

- Status: Active + New
- Partner Size: Medium, Large, Extra Large
- Promotional Areas: United States
- Sort: `sortBy=reachRating&sortOrder=DESC`

## Tabs (5 business models)

Iterates through each tab, scrolling for more cards within each:
1. CONTENT_REVIEWS (~10K publishers)
2. DEAL_COUPON
3. EMAIL_NEWSLETTER
4. LOYALTY_REWARDS
5. NETWORK

## Performance Benchmarks (verified 2026-04-30)

- 3-publisher test: 114s total = 38s/pub, 100% success rate
- 18-publisher run: ~10 min, 18/18 sent (100%), 16/18 emails (89%), 15/18 contact names (83%)
- All web metrics, websites, addresses, partner_ids captured

## Token Cost Comparison

| Approach | Tokens per Publisher | Tokens for 1000 |
|----------|---------------------|-----------------|
| v1 LLM loop (Sonnet+Haiku) | 60-80K | ~70M |
| **v2 Node CDP runner** | **0** (only ~5K total for setup) | **~5K** |
| **Savings** | **>99%** | **>99.9%** |

## Restart on Failure

If the runner crashes mid-run, just restart it. The ledger acts as dedup — already-sent publishers are skipped automatically:

```bash
node ~/.claude/skills/_shared/impact-proposal-runner.js 1000 \
  ~/.claude/skills/impact-rockbros-us-outreach/config.json
```

## See Also

- Generic runner: `~/.claude/skills/_shared/impact-proposal-runner.js`
- Other Impact programs (same architecture): `impact-tcl-us-outreach`, `impact-ottocast-outreach`
- v1 backup: `SKILL.md.v1-backup-2026-04-30` (LLM-driven, deprecated)
