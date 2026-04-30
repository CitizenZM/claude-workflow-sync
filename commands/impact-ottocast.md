---
description: "Impact Ottocast — Native Node.js CDP runner. Zero LLM tokens during loop. Usage: /impact-ottocast [count=500]"
model: haiku
---

# Impact Ottocast US — Optimized Outreach (v2)

**Architecture**: Native Node.js Playwright CDP runner. Zero LLM in loop. ~95% token savings.

## STEP 1 — Init browser

```bash
bash ~/.claude/scripts/outreach/init-workflow.sh impact-ottocast playwright-impact-ottocast 9304
```

## STEP 2 — Verify config has program_id

```bash
grep '"program_id"' ~/.claude/skills/impact-ottocast-outreach/config.json
# Update if shows PLACEHOLDER
```

## STEP 3 — Run outreach (Native Node)

```bash
COUNT=${ARGUMENTS:-500}
nohup node ~/.claude/skills/_shared/impact-proposal-runner.js $COUNT \
  ~/.claude/skills/impact-ottocast-outreach/config.json \
  > /tmp/ottocast-prod.log 2>&1 &
echo "PID: $!"
```

## CONFIGURATION

Config file: `~/.claude/skills/impact-ottocast-outreach/config.json`

## OUTPUT

- Ledger: `/Users/xiaozuo/Documents/Obsidian Vault/01-Projects/Impact-Ottocast-Us-Outreach-Ledger.md`
- Intel DB: `/Users/xiaozuo/Documents/Obsidian Vault/01-Projects/Impact-Ottocast-Us-Publisher-Intel.md`
- Session log: `/tmp/ottocast-prod.log`

## RESTART

Crashes? Just rerun — ledger acts as dedup.
