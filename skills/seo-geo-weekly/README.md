# seo-geo-weekly

Weekly Shopify SEO + GEO + backlink intelligence workflow.

## Setup

1. Add Shopify Admin API token to env:
   ```bash
   export SHOPIFY_ADMIN_TOKEN_DARK_FANTASY="shpat_..."
   ```
2. Edit `config.yaml`:
   - Add 10–50 seed keywords
   - Add 3–5 competitor domains
3. Optional API keys:
   - `PAGESPEED_API_KEY` — Core Web Vitals
   - `SERPAPI_KEY` — keyword ranking + competitor SERP
   - `AHREFS_API_KEY` — backlink data (free fallback if missing)
4. Confirm SMTP creds at `~/.claude/credentials.json` under `smtp.celldigital`.

## Run

```bash
# Manual trigger
python3 ~/.claude/skills/seo-geo-weekly/scripts/run.py

# Dry-run (no email)
python3 ~/.claude/skills/seo-geo-weekly/scripts/run.py --dry-run

# Apply auto-fix mutations to Shopify
python3 ~/.claude/skills/seo-geo-weekly/scripts/run.py --apply

# Single phase
python3 ~/.claude/skills/seo-geo-weekly/scripts/run.py --phase audit
```

## Schedule (weekly Monday 9am)

```bash
( crontab -l 2>/dev/null; echo "0 9 * * 1 cd $HOME/.claude/skills/seo-geo-weekly && /usr/bin/python3 scripts/run.py >> $HOME/.claude/logs/seo-geo-weekly.log 2>&1" ) | crontab -
```

## Output

`~/Downloads/Shopify-<store>-SEO-GEO-Weekly-MMDDYYYY.docx`
emailed to `barronzuo@gmail.com` from `affiliate@celldigital.co`.

## State

`state/<isodate>/` keeps weekly snapshots so the next run can compute WoW diffs.
