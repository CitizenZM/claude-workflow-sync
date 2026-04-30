---
description: "Impact TCL US — Native Node.js CDP runner. Zero LLM tokens during loop. Usage: /impact-tcl-us [count=500]"
model: haiku
---

# Impact TCL US — Optimized Outreach (v2)

**Architecture**: Native Node.js Playwright CDP runner. Zero LLM in loop. ~95% token savings.

## STEP 1 — Init browser

```bash
bash ~/.claude/scripts/outreach/init-workflow.sh impact-tcl-us playwright-impact-tcl-us 9305
```

## STEP 2 — Verify config has program_id

```bash
grep '"program_id"' ~/.claude/skills/impact-tcl-us-outreach/config.json
# Update if shows PLACEHOLDER
```

## STEP 3 — Run outreach (Native Node)

```bash
COUNT=${ARGUMENTS:-500}
nohup node ~/.claude/skills/_shared/impact-proposal-runner.js $COUNT \
  ~/.claude/skills/impact-tcl-us-outreach/config.json \
  > /tmp/tcl-prod.log 2>&1 &
echo "PID: $!"
```

## CONFIGURATION

Config file: `~/.claude/skills/impact-tcl-us-outreach/config.json`

## OUTPUT

- Ledger: `/Users/xiaozuo/Documents/Obsidian Vault/01-Projects/Impact-Tcl-Us-Outreach-Ledger.md`
- Intel DB: `/Users/xiaozuo/Documents/Obsidian Vault/01-Projects/Impact-Tcl-Us-Publisher-Intel.md`
- Session log: `/tmp/tcl-prod.log`

## RESTART

Crashes? Just rerun — ledger acts as dedup.
