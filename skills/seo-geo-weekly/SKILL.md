---
name: seo-geo-weekly
description: Weekly Shopify SEO + GEO + backlink workflow. Crawls store, audits technical/on-page SEO, probes generative engines (ChatGPT/Perplexity/Claude/Gemini) for citations, tracks keyword rankings vs competitors, surfaces high-DA backlink targets, generates auto-fixes via Admin API, ships a .docx report. Use when user says "SEO weekly", "GEO report", or `/seo-geo-weekly`. Naming: Shopify [Store] SEO+GEO Weekly Report [MMDDYYYY].
---

# seo-geo-weekly

Weekly SEO + GEO intelligence for a single Shopify store.

## Inputs (from `config.yaml`)

```yaml
store:
  name: dark-fantasy
  myshopify_domain: 1a049t-cy.myshopify.com
  storefront_url: https://bdsmpub.com
  admin_api_token_env: SHOPIFY_ADMIN_TOKEN_DARK_FANTASY  # shpat_...
  api_version: "2025-01"

keywords: []          # user-supplied seed list
competitors: []       # 3-5 domains

apis:
  pagespeed_key_env: PAGESPEED_API_KEY        # optional
  serpapi_key_env: SERPAPI_KEY                # optional, for SERP tracking
  ahrefs_key_env: AHREFS_API_KEY              # optional, for backlinks

geo_engines:
  - chatgpt
  - perplexity
  - claude
  - gemini

report:
  format: docx
  out_dir: ~/Downloads
  email_to: barronzuo@gmail.com
  email_from: affiliate@celldigital.co
  smtp_creds: ~/.claude/credentials.json#smtp.celldigital
```

## Pipeline (7 phases)

### Phase 1 — Ingest (Sonnet, ~2 min)
- Fetch via Admin GraphQL: products, collections, pages, blogs, redirects, robots.txt, sitemap.xml
- Persist snapshot to `state/<isodate>/catalog.json` for WoW diff

### Phase 2 — Technical + on-page audit (Haiku parallel)
- Run `scripts/crawl.py` — sitemap walk, status codes, canonicals, hreflang, JSON-LD, title/meta/H1, alt text, internal-link graph
- PageSpeed Insights (mobile + desktop) for top 10 URLs
- Output: `state/<isodate>/audit.json` + diff vs prior week

### Phase 3 — GEO audit (Sonnet)
- For each `geo_engines` × 20 prompts (brand + category + intent), capture: was the store cited, position, competitor mentions
- Check `/llms.txt`, `/llms-full.txt`, structured data (Product/FAQ/HowTo/Organization/Review)
- Output: GEO citation share-of-voice WoW

### Phase 4 — Keyword + SERP tracking (Haiku)
- SerpApi pulls for tracked keywords (top 20 results each)
- Competitor sitemap diffs vs Wayback snapshot 7d ago = "new pages this week"

### Phase 5 — Backlink + high-DA opportunities (Sonnet)
- Pull existing backlinks (Ahrefs API → fallback OpenLinkProfiler + Common Crawl)
- Generate 5 high-DA placement targets with pitch angles
- 3 ready-to-pitch guest-post outlines

### Phase 6 — Auto-fix proposals (Sonnet, gated)
- Generate Admin GraphQL mutations for: missing meta, alt text, JSON-LD injection, redirects for 404s, sitemap fixes
- Save to `state/<isodate>/proposed_fixes.json` (dry-run by default)
- Apply only when `--apply` flag passed

### Phase 7 — Report (Sonnet)
- Render `templates/report.docx.j2` → `~/Downloads/Shopify-DarkFantasy-SEO-GEO-Weekly-MMDDYYYY.docx`
- Landscape orientation for wide tables
- Email via SMTP to `barronzuo@gmail.com`

## Cron registration

```bash
# Every Monday 09:00 local
0 9 * * 1  cd ~/.claude/skills/seo-geo-weekly && python3 scripts/run.py >> ~/.claude/logs/seo-geo-weekly.log 2>&1
```

## Files

- `scripts/run.py` — orchestrator
- `scripts/crawl.py` — technical SEO crawler
- `scripts/geo_probe.py` — generative engine citation tracker
- `scripts/serp.py` — keyword + competitor tracking
- `scripts/backlinks.py` — backlink + content opportunity finder
- `scripts/admin_api.py` — Shopify Admin GraphQL client
- `scripts/report.py` — .docx generation + SMTP send
- `templates/report.docx.j2` — Jinja2 docx template
- `config.yaml` — store + keywords + competitors
- `state/` — weekly snapshots for WoW diffs

## Rules
- All external emails sent from `affiliate@celldigital.co`. Never `barronzuo@gmail.com` as From.
- Auto-fix mutations require `--apply`; default is dry-run.
- Publisher/customer emails masked in the .docx report.
- Skill naming: `Shopify [Store] SEO+GEO Weekly Report [MMDDYYYY]`.
