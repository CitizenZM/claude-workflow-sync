# Gmail Intelligence Playbook — Rockbros Weekly Report

**Runs on: Haiku 4.5** (token-efficient, structured extraction only — no prose reasoning).
**Mailbox: `affiliate@celldigital.co` only** (the brand-side signed-in Gmail MCP account).
**Scope: past 30 days, Rockbros-mentioning threads only.**

This playbook tells Claude Code how to drive the Gmail MCP to populate
`output/rockbros_email_intel.json`, which the generator then merges into the weekly report.

---

## 1. Brand filter (MUST apply to reduce tokens)

Before calling `search_threads`, narrow with brand-scoped keywords from `.env`:

```
BRAND_KEYWORDS=Rockbros,ROCKBROS,"RockBros",cycling,outdoor
BRAND_DOMAINS=rockbros.com,rockbros-eu.com
AWIN_ADVERTISER_ID_US=58007
AWIN_ADVERTISER_ID_EU=122456
```

Construct the Gmail query:
```
(Rockbros OR "RockBros" OR from:@rockbros.com OR 58007 OR 122456) newer_than:30d
```

**Do NOT** use a bare `newer_than:30d` — that returns the entire mailbox and burns tokens.

---

## 2. Three-pass extraction (same as Oufer)

### Pass 1: thread list
```
mcp__claude_ai_Gmail__search_threads
  q: "(Rockbros OR \"RockBros\" OR from:@rockbros.com OR 58007 OR 122456) newer_than:30d"
  maxResults: 50
```

### Pass 2: selective thread bodies
Only fetch full bodies for threads whose subject/snippet suggests one of the 4 intel types:

| Intel type | Subject/snippet signals |
|---|---|
| `sample_ship` | "sample", "send product", "shipping address", "ship to", "对样", "寄样" |
| `paid_placement` | "IO", "insertion order", "paid placement", "SoW", "commission increase", "fixed fee", "sponsor" |
| `asset_request` | "feed", "banner", "creative", "logo", "brand kit", "素材", "高清图" |
| `onboarding` | "welcome", "activation", "joined", "approved publisher" |

Target: fetch ≤ 20 full threads.

### Pass 3: download attachments
Download each attachment to `output/attachments/` as:
```
{YYYY-MM-DD}_{publisher_slug}_{original_filename}
e.g., 2026-04-13_geizhals_Q2-IO-2026.pdf
```

---

## 3. Per-thread extraction schema

Same 15-field schema as Oufer — see `awin-oufer-us-weekly-report/scripts/gmail_intel.md`.
Region heuristic: if contact domain or address is European → EU; else US.
Populate `publisher_region` (US | EU | DACH | UK | ...) so the generator can group
shipping and contract rows by region if needed.

---

## 4. Aggregate output

Write to `output/rockbros_email_intel.json`:

```json
{
  "scrape_date": "2026-04-17",
  "mailbox": "affiliate@celldigital.co",
  "brand": "Rockbros",
  "query": "(Rockbros OR ...) newer_than:30d",
  "thread_count_total": 52,
  "thread_count_relevant": 14,
  "threads": [ /* array of per-thread records */ ]
}
```

---

## 5. Token budget & stop conditions

Same as Oufer playbook. If `thread_count_total > 200`, refine keywords first.

---

## 6. Invocation

```
@awin-rockbros-weekly-report
抓取 Rockbros 过去 30 天 affiliate@celldigital.co 邮件情报，生成 output/rockbros_email_intel.json
```

Then:
```bash
bash scripts/publish.sh
```
