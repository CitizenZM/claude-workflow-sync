---
name: Levanta Oufer US Affiliate Outreach 05132026
description: Levanta.io affiliate outreach for Oufer Body Jewelry US. Daily 25-invite loop chained after Ottocast workflow. Switches team to OUFER via top-right avatar dropdown, then walks /seller/partners/discover. Priority: Deal Sites → Social Influencers → Publishers → Loyalty Platforms → Media Buyers → Affiliate Networks. Same per-card invite mechanism as Ottocast (Send invitation → Add message → fill rich-text editor → Send invite). Records to Obsidian Tracker + Ledger. Pure Python, zero LLM tokens during loop.
tags: [affiliate, levanta, oufer, body-jewelry, us, outreach, automation, daily, chained]
---

# Levanta Oufer US Affiliate Outreach 05132026

Sub-workflow chained after Ottocast. Runs automatically at the end of the Ottocast daily cron (09:30 local).

## Configuration

| Key | Value |
|-----|-------|
| BRAND | Oufer Body Jewelry |
| REGION | US |
| TEAM | **OUFER** (selected via top-right red C avatar → Switch Team → OUFER) |
| LOGIN_EMAIL | `affiliate@celldigital.co` |
| ACCOUNT | Cell Affiliate Team / affiliate@celldigital.co |
| DISCOVER_URL | `https://app.levanta.io/seller/partners/discover` |
| SESSION_LIMIT | 25 invites |
| PROGRESS_JSON | `~/Projects/levanta-oufer/state/progress.json` |
| TRACKER | `~/Documents/Obsidian/30-Operations/Levanta-Oufer-US-Affiliate-Outreach-05132026/Tracker.md` |
| LEDGER | `~/Documents/Obsidian/30-Operations/Levanta-Oufer-US-Affiliate-Outreach-05132026/Ledger.md` |
| RUNLOG | `~/Documents/Obsidian/30-Operations/Levanta-Oufer-US-Affiliate-Outreach-05132026/RUNLOG.md` |

## Invitation Message (exact)

```
Hi, this is Bob Zabel, reaching out from Oufer Body Jewelry, the NO.1 Piercing Body Jewelry you MUST see. We are offering 20% ultra high CPAi commission with limited time deal offer, Reply here or to affiliate@celldigital.co to chat in details.
```

## Category Priority

1. **Deal Sites**          (`DEALS`)
2. **Social Influencers**  (`SOCIAL_MEDIA`)
3. **Publishers**          (`PUBLISHER`)
4. **Loyalty Platforms**   (`LOYALTY_PROGRAM`)
5. **Media Buyers**        (`MEDIA_BUYER`)
6. **Affiliate Networks**  (`AFFILIATE_NETWORK`)

## Team Switch Mechanic

Before the invite loop starts, the script:

1. Navigates to `https://app.levanta.io/seller`.
2. Detects the active team via the small badge near the avatar (looks for `OUFER` or `OTTOCAST`).
3. If not already on `OUFER`:
   - Clicks the **red C avatar** at top-right (rounded-full button).
   - Clicks **Switch Team** in the dropdown.
   - Clicks **OUFER** in the team list.
   - Waits 5s for workspace reload.
4. Verifies the team badge now reads `OUFER`.

If team switch fails it logs a WARN and proceeds anyway (the inviter still works on whichever team is active — but data goes to Oufer trackers).

## Daily Chain

`~/Projects/levanta-ottocast/scripts/daily-runner.sh` runs both phases sequentially:

```
Phase 1: Ottocast (50 invites) — switches to OTTOCAST team
Phase 2: Oufer (25 invites)    — switches to OUFER team
```

Both phases use the same workflow tab; team switch happens in-between.

## Token Cost

| Component | Model | Tokens / day |
|-----------|-------|--------------|
| Daily cron | none (Python) | **0** |
| Team-switch logic | none (Python + CDP) | 0 |
| Invite loop | none (Python + CDP) | 0 |

**Total: $0/day.**

## Invocation

Auto: via launchd at 09:30 local.

Manual:
```bash
/Users/xiaozuo/.local/share/uv/tools/browser-harness/bin/python \
  /Users/xiaozuo/Projects/levanta-oufer/scripts/run-outreach.py 25
```

Manual chain (both brands):
```bash
bash ~/Projects/levanta-ottocast/scripts/daily-runner.sh
```

## Resume Behavior

Same as Ottocast: `progress.json` tracks `current_category_index` + per-category `exhausted` flag. Each daily run picks up where the previous left off; if all 6 categories are exhausted, the next run resets to index 0.
