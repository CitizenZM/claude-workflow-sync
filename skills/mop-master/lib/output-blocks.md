# MOP Standard Output Blocks

> Reference templates for every MOP-emitted block. SKILL.md §12 points here.

## Triage
```
[MOP T v4.5]
Run:    mop_20260513T120000Z_L_b7e2
Class:  L  Mode: Standard
Window: 8%  Target:<40%  Hard:<70%
Skills: mop-master, seo-geo-weekly
Est:    ~32K tok, ~25 min, 4 Haiku agents
Vault:  30-Operations/MOP/_active/mop_20260513T120000Z_L_b7e2/
Lock:   ~/.claude/mop/.lock  Owner: xiaos-mac-studio
Approach: direct_api | fallback: browser_scrape, cached_data
```

## Plan
```
[MOP PLAN]
M1 [research:web_research, 3 parallel fetches]  [2C, ~5K]
M2 [build:file_create, fan-out×3]               [4C, ~12K]
M3 [validate:validator_run]                      [2C, ~4K]
M4 [report:markdown_doc]                         [3C, ~6K]
Approaches pre-planned: primary + 2 fallbacks each
Est: 27K tok (54% of 50K L budget)
```

## Explore
```
[EXPLORE] M2 — high uncertainty, spawning 3 parallel approaches
  E1 direct_api → spec: Modules/M2/spec-e1.md
  E2 browser_scrape → spec: Modules/M2/spec-e2.md
  E3 local_data → spec: Modules/M2/spec-e3.md
```

## Recovery (no user ask)
```
[RECOVER] M2.1 approach=primary FAIL (B2: validator exit 1)
  → Switching to alt_1: browser_scrape
  → Re-dispatching M2.1 (attempt 2/3)
```

## Module accepted
```
[MOP M2 ✓] 8.2K tok | 4/4 critical, 2/3 nc | win 24% | 6m44s | approach: alt_1
```

## Compaction
```
[COMPACT] M2 closed | rel ~9K | win 31%→19%
```

## Delivery
```
[MOP DELIVERY]
Run:    mop_20260513T120000Z_L_b7e2 ✓
Tests:  4/4 modules PASS  (1 used alt approach)
Tokens: 29.4K/50K (41% headroom)
Split:  PM 28%  Haiku 68%  Sonnet 4%
Win peak: 37% (target <40% ✓)
Files:  <list>
Assumptions made: <any>
Vault:  _archive/2026-05/mop_20260513T120000Z_L_b7e2/
Next:   <suggestion>
```
