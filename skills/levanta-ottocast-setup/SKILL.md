---
name: levanta-ottocast-setup
description: Levanta Ottocast US — setup phase (Haiku 4.5). Login affiliate@celldigital.co OR Google auth, select Ottocast account, navigate to /seller/partners/discover, map category filters, inject window.__lev_v2 helper. Run before /levanta-ottocast-outreach. Usage: /levanta-ottocast-setup
tags: [affiliate, levanta, ottocast, setup]
---

# /levanta-ottocast-setup

Run this FIRST in any Levanta Ottocast session. **Use Haiku 4.5** (model=`claude-haiku-4-5-20251001`) — setup is mechanical, no judgment needed. ~5K tokens.

## Steps

### 1. Browser-harness session
```bash
browser-harness -c 'new_tab("https://app.levanta.io/login"); wait_for_load(); print(page_info())'
```
Screenshot. Detect login state.

### 2. Login
- If `/seller/` in URL → already logged in, skip to 3.
- Else: fill email `affiliate@celldigital.co`, password `Celldigital2024*`, submit.
- On failure / 2FA / CAPTCHA → fall back to "Sign in with Google" using same address.
- On second failure → STOP, surface screenshot + recommend manual one-time auth, do not retry blindly.

### 3. Workspace / account
If multi-workspace prompt: click **Ottocast**. Verify URL contains the Ottocast workspace slug.

### 4. Navigate
```bash
browser-harness -c '
import time
cdp("Page.navigate", {"url": "https://app.levanta.io/seller/partners/discover"})
wait_for_load()
time.sleep(3)
print(page_info())
'
```
Screenshot.

### 5. Map categories
Inspect filter UI. Map each priority category to a UI control. Write to `~/Projects/levanta-ottocast/state/category_map.json`:

```json
{
  "Deal Sites": {"label": "<actual UI label>", "click_method": "filter_chip|dropdown|tab", "selector": "<css or aria>"},
  "Publishers": {...},
  "Loyalty Platforms": {...},
  "Media Buyers": {...},
  "Affiliate Networks": {...},
  "Social Influencers": {...}
}
```

For ambiguous matches: pick the closest semantic UI option, record the mapping decision in a `notes` field, proceed (do not pause).

### 6. Inject helper
Run the `window.__lev_invite` injection from `~/.claude/skills/levanta-ottocast/SKILL.md` § Helper. Verify return is `'lev helper v1 injected'`.

### 7. Sanity check
Apply the **Deal Sites** filter. Confirm at least one publisher card appears. Capture one screenshot. Done.

### 8. Output
Print: workspace confirmed, category_map.json written, helper injected, N cards visible on Deal Sites filter. Ready for `/levanta-ottocast-outreach`.

## Failure modes
- Login redirected to CAPTCHA twice: stop, write `state/setup-blocked.flag` with the screenshot path, surface to user.
- Discover URL 404 or redirect: try `/seller/partners/marketplace`, `/seller/discover` as fallback URLs; record working URL in progress.json.
- No card selector matches: log all classnames containing "card|partner|publisher|discover" from the first 20 page elements into `state/dom-sample.json` for the outreach helper to consume.
