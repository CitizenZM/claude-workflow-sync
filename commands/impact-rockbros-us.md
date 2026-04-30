---
description: "Impact Rockbros US — Native Node.js CDP runner. Zero LLM tokens during loop, ~40s/publisher. Usage: /impact-rockbros-us [count=1000]"
model: haiku
---

# Impact Rockbros US — Optimized Outreach (v2)

**Architecture**: Native Node.js Playwright CDP runner. Zero LLM in loop. ~95% token savings.

## STEP 1 — Init browser (idempotent)

```bash
bash ~/.claude/scripts/outreach/init-workflow.sh impact-rockbros-us playwright-impact-rockbros-us 9306
```

## STEP 2 — Verify login (Sonnet via MCP if needed)

If browser shows login page, ask user to log in once. Otherwise proceed.

```bash
# Quick check via MCP tool (only if needed)
mcp__playwright-impact-rockbros-us__browser_navigate https://app.impact.com
```

## STEP 3 — Run outreach (Native Node — NO LLM cost)

```bash
COUNT=${ARGUMENTS:-1000}
nohup node ~/.claude/skills/_shared/impact-proposal-runner.js $COUNT \
  ~/.claude/skills/impact-rockbros-us-outreach/config.json \
  > /tmp/rockbros-prod.log 2>&1 &
echo "PID: $!"
echo "Tail log: tail -f /tmp/rockbros-prod.log"
echo "Sent count: grep -c '✓ SENT' /tmp/rockbros-prod.log"
```

## STEP 4 — Generate report (Haiku, after run completes)

```bash
node -e "
const fs=require('fs');
const ledger='/Users/xiaozuo/Documents/Obsidian Vault/01-Projects/Impact-Rockbros-US-Outreach-Ledger.md';
const lines=fs.readFileSync(ledger,'utf8').split('\n').filter(l=>l.includes('impact-50132'));
const today=new Date().toISOString().slice(0,10);
const todayLines=lines.filter(l=>l.includes(today));
const emails=todayLines.filter(l=>!l.includes('email_missing')).length;
const contacts=todayLines.filter(l=>!l.includes('name_missing')).length;
const websites=todayLines.filter(l=>{const w=l.split('|')[7]; return w&&w.length>5;}).length;
console.log('Sent today:',todayLines.length);
console.log('Emails captured:',emails+'/'+todayLines.length+' ('+Math.round(emails/todayLines.length*100)+'%)');
console.log('Contacts:',contacts+'/'+todayLines.length);
console.log('Websites:',websites+'/'+todayLines.length);
console.log('Top 10:',todayLines.slice(0,10).map(l=>l.split('|')[0]).join(', '));
"
```

## CONFIGURATION

Config file: `~/.claude/skills/impact-rockbros-us-outreach/config.json`

| Key | Value |
|-----|-------|
| program_id | 50132 |
| advertiser | rockbros-us |
| cdp_port | 9306 |
| MSG | "Hi, this is Bob Zabel..." (10-20% commission) |
| business_models | CONTENT_REVIEWS, DEAL_COUPON, EMAIL_NEWSLETTER, LOYALTY_REWARDS, NETWORK |

## OUTPUT

- Ledger: `/Users/xiaozuo/Documents/Obsidian Vault/01-Projects/Impact-Rockbros-US-Outreach-Ledger.md`
- Intel DB: `/Users/xiaozuo/Documents/Obsidian Vault/01-Projects/Impact-Rockbros-US-Publisher-Intel.md`
- Session log: `/tmp/rockbros-prod.log`

## RESTART

Crashes? Just rerun — ledger acts as dedup, already-sent skipped.
