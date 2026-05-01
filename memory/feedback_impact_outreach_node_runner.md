---
name: Impact outreach uses native Node.js CDP runner (not LLM loop)
description: All Impact affiliate outreach skills (Rockbros, TCL, Ottocast) run as direct Playwright CDP scripts via Node.js — zero LLM tokens during the proposal loop. ~95% token savings vs prior Sonnet+Haiku per-tab architecture.
type: feedback
originSessionId: 63dbfaf0-ac53-4f18-9256-793bd1072fed
---
For Impact.com affiliate outreach, default to the native Node.js runner — never the LLM-driven loop.

**Runner**: `~/.claude/skills/_shared/impact-proposal-runner.js` (v3)
**Config**: `~/.claude/skills/impact-rockbros-us-outreach/config.json`
**Command**: `nohup node ~/.claude/skills/_shared/impact-proposal-runner.js <count> <config> > /tmp/rockbros-5000.log 2>&1 &`
**Monitor**: cron at `2,17,32,47 * * * *` — 15-min reports

**Critical fixes (v3, 2026-04-30):**
1. Submit button below viewport (y≈705, h=696) → `btn.focus()` + `keyboard.press('Enter')`
2. Term: skip "Select" placeholder, pick first real `li[role=option]`
3. Strict 2-stage confirm: "I understand" MUST appear, modal MUST leave DOM — no fallback-to-true
4. Shadow DOM: slideout at `#unified-program-slideout` → access via `.shadowRoot`
5. Scroll limit: 5 per tab (fast rotation when tab exhausted)
6. Every-50 checkpoint: runner navigates to Impact proposals page, logs Impact count vs ledger count
7. Config-driven: program_id, msg, tabs, vault_dir, size_filter, extra_params, sort

**Vault**: `/Users/xiaozuo/Documents/Obsidian Vault/01-Projects/` (NOT /Volumes/workssd)
**Dedup**: ledger rows with `impact-50132` — restart safe

**Token saving**: user granted all permissions, no confirmation needed, Haiku for reports only.
