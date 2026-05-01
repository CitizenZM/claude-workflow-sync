---
name: Impact outreach uses native Node.js CDP runner (not LLM loop)
description: All Impact affiliate outreach skills (Rockbros, TCL, Ottocast) run as direct Playwright CDP scripts via Node.js — zero LLM tokens during the proposal loop. ~95% token savings vs prior Sonnet+Haiku per-tab architecture.
type: feedback
originSessionId: 63dbfaf0-ac53-4f18-9256-793bd1072fed
---
For Impact.com affiliate outreach (Rockbros US, TCL US, Ottocast US, etc.), default to the native Node.js runner — never the LLM-driven Sonnet/Haiku per-tab loop.

**Why:** Original architecture cost 60-80K tokens per publisher × 1000 = ~70M tokens per run. Native Node.js CDP runner uses 0 tokens during the loop and ~5K total for setup+report. ~95%+ savings.

**How to apply:**
- Generic runner: `~/.claude/skills/_shared/impact-proposal-runner.js`
- Per-program config: `~/.claude/skills/impact-<program>-outreach/config.json` (program_id, advertiser, msg, cdp_port, vault_dir, business_models)
- Slash commands: `/impact-rockbros-us [count]`, `/impact-tcl-us [count]`, `/impact-ottocast [count]` — all invoke the Node runner via `nohup node <runner> <count> <config>`
- Setup phase only needs Sonnet (login + browser init); report phase only needs Haiku
- Performance: ~40s per publisher, 100% success rate on test runs, 89% email capture, 83% contact name capture

**Critical implementation details (do NOT regress):**
1. Slideout content lives in **Shadow DOM** at `#unified-program-slideout` — access via `host.shadowRoot`
2. Date selection: click calendar icon button → click "Today" footer button (NOT a day number)
3. Term selection: `page.mouse.click()` with iframe-relative coords (NOT `li.click()` in evaluate — React doesn't trigger)
4. Persistent modal `iframe[data-testid="uicl-modal-iframe-content"]` blocks subsequent clicks — navigate dashboard→back to clear between proposals
5. Card click target: `.image-container` element (top 206px), NOT avatar img (often width=0)
6. Send Proposal: card-level button (NOT shadow DOM Send Proposal button — that's informational only)
7. Iframe URL params (`name=`, `email=`, `p=`) contain real publisher contact info — extract from `URL(iframeUrl).searchParams`

**Vault path:** `/Users/xiaozuo/Documents/Obsidian Vault/01-Projects/` (workssd not mounted; old skills referenced `/Volumes/workssd/...` which is wrong)

**Verified:** 2026-04-30 by 18-publisher Rockbros run — 100% success, all data captured (emails, contacts, websites, web metrics, addresses, partner_ids).
