---
name: levanta-ottocast-outreach
description: Levanta Ottocast US — bulk invite loop (PURE PYTHON, zero LLM tokens). 50 invites/run. Reads progress.json for resume cursor, processes categories in priority order, appends to Obsidian Tracker+Ledger, persists state. Run /levanta-ottocast-setup first. Usage: /levanta-ottocast-outreach [count]
tags: [affiliate, levanta, ottocast, outreach, bulk, no-llm]
---

# /levanta-ottocast-outreach

**Zero-LLM bulk loop.** Runs as pure Python via `browser_harness.helpers` import — no Claude model calls during the loop. Cost per run: **$0**.

The slash-command form should simply `bash` the script:

```bash
/Users/xiaozuo/.local/share/uv/tools/browser-harness/bin/python \
  /Users/xiaozuo/Projects/levanta-ottocast/scripts/run-outreach.py 50
```

Assumes `/levanta-ottocast-setup` already ran today (cookies valid, helper injected). The script auto-creates a Levanta tab if none exists.

## Inputs
- `count` (default 50) — invites to send this run.
- `~/Projects/levanta-ottocast/state/progress.json` — resume state.
- `~/Projects/levanta-ottocast/state/category_map.json` — category → filter selector map.

## Loop

```
session_remaining = count
while session_remaining > 0:
  cat = progress.category_priority[progress.current_category_index]
  if progress.category_state[cat].exhausted:
    advance to next category; continue
  apply_category_filter(cat)   # use category_map.json
  result = browser-harness evaluate § per-page-evaluate (SESSION_REMAINING=session_remaining)
  if result == 'ERR_HELPER_MISSING_REINJECT_REQUIRED':
    re-inject window.__lev_invite, continue (same page)
  parse JSON
  append rows → Tracker.md (no email), Ledger.md (with email), each in ONE Edit
  session_remaining -= result.sent
  progress.total_invites_sent += result.sent
  progress.category_state[cat].sent += result.sent
  progress.category_state[cat].cursor += result.total_cards
  if result.sent == 0 and result.skipped >= result.total_cards * 0.9:
    # this page is exhausted — try pagination
    if no more pages: progress.category_state[cat].exhausted = true; advance category
  persist progress.json
```

## Per-row write format

### Tracker.md (public, no email)
```
| 2026-05-13 | Deal Sites | <name> | <intro 200ch> | invited |
```

### Ledger.md (private, with email)
```
| 2026-05-13 | Deal Sites | <name> | <email> | <intro 200ch> | invited |
```

## Stop conditions
- `count` invites sent → write summary to RUNLOG.md, exit.
- All 6 categories exhausted → write summary + flag in progress.json (`all_exhausted: true`).
- 3 consecutive page evaluates return `sent=0, errors>0` → stop, log architectural failure, do not retry blindly.

## Summary block (append to RUNLOG.md)

```markdown
### Session 2026-05-13 09:30 (run #N)
- Total sent: X / 50
- Per category: Deal Sites=a, Publishers=b, Loyalty=c, Media Buyers=d, Networks=e, Influencers=f
- Errors: E (samples: ...)
- Resume: category=<next>, cursor=<n>
```

## Token rules
- ONE evaluate per page; never `browser_snapshot` in this skill.
- ONE Edit per page on each Obsidian file.
- ONE Write per page on `progress.json`.
- Discard raw evaluate JSON after parsing.
