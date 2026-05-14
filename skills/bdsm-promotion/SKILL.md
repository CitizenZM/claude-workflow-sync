---
name: bdsm-promotion
description: Dark Fantasy promotional campaign orchestrator. Selects 20 items per promotion, calculates margin-safe discounts, applies prices via Shopify Admin API, adds promo badges to PDP + collection pages, schedules price restoration after deadline. Use when user says "run promotion", "set up sale", "create discount", or names a holiday/event.
---

# BDSM Promotion Skill

Orchestrates end-to-end promotional campaigns for Dark Fantasy:
1. Select 20 highest-margin products
2. Calculate safe discount (20-30%) preserving ≥40% margin
3. Apply price changes via Shopify API
4. Add promo banners to PDPs + collection pages
5. Schedule price restoration

## Trigger phrases
- "run promotion [holiday]"
- "set up [X]% off sale"
- "Memorial Day / Black Friday / Valentine's Day promotion"
- "flash sale"

## Promotion calendar (pre-planned)

| Event | Dates | Discount | Theme |
|---|---|---|---|
| Memorial Day | May 23-26 | 30% | MEMORIAL30 |
| Pride Month | Jun 1-30 | 20% | PRIDE20 |
| 4th of July | Jul 3-6 | 25% | FREEDOM25 |
| Labor Day | Aug 30-Sep 2 | 20% | LABOR20 |
| Halloween | Oct 25-31 | 30% | SPOOKY30 |
| Black Friday | Nov 28 - Dec 1 | 30% | BLACKFRIDAY30 |
| Cyber Monday | Dec 1-2 | 25% | CYBER25 |
| Valentine's Day | Feb 10-14 | 20% | LOVE20 |

## Workflow

### Phase 1 — Product selection (automated)

```python
# From scripts/promo_select.py
# Fetch active products + supplier costs
# Score each: margin_at_discount >= 40%
# Pick 20 highest-margin, diverse types
# Return: [{product_id, variant_id, retail_price, promo_price, discount_pct}]
```

### Phase 2 — Apply prices

For each selected product:
```
PUT /admin/api/2025-01/variants/{variant_id}.json
{"variant": {"id": {id}, "compare_at_price": {retail_price}, "price": {promo_price}}}
```
`compare_at_price` = original (shows "was $X, now $Y")
`price` = discounted price

Also create a Shopify Automatic Discount (price rule) for the promo code.

Tag each promo product: `active-promo, {promo-code-lower}`

### Phase 3 — PDP badges

Add promo banner via Script Tag on each tagged product's page:
```javascript
// Injected on pages with product tagged 'active-promo'
if(document.querySelector('[data-product-tags]')?.textContent?.includes('active-promo')){
  const badge=document.createElement('div');
  badge.innerHTML=`<div style="background:#c9a96e;color:#0a0a0a;padding:6px 14px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;display:inline-block;margin-bottom:12px;">SALE — {DISCOUNT_PCT}% OFF · ENDS {END_DATE}</div>`;
  document.querySelector('.product__title, h1')?.insertAdjacentElement('beforebegin', badge);
}
```

Update section: `sections/promo-pdp-banner.liquid` with countdown timer.

### Phase 4 — Collection page banners

Update `sections/collection-promo-header.liquid`:
- Hero banner above product grid: "MEMORIAL DAY SALE — 30% OFF SELECTED ITEMS"
- Filter badge on eligible products: gold border + "SALE" pill
- Show original vs promo price in grid cards

### Phase 5 — Price restoration (scheduled)

launchd plist: `io.celldigital.shopify-order-os.promo-restore`

Script: `scripts/restore_promo_prices.py`
- Reads `scripts/active_promo.json` (written during Phase 2)
- For each product: set `price` back to original, clear `compare_at_price`
- Remove `active-promo` tag
- Archive `active_promo.json` to `scripts/promo_archive/{promo_code}_{date}.json`
- Delete launchd plist (self-unschedule)

### Phase 6 — Analytics report

After restoration: generate `promo_report.md` in Obsidian:
- Products on sale: N
- Avg discount: X%
- Estimated revenue period: dates
- Next scheduled promotion: name + date

## Required files (per promotion run)

```
scripts/active_promo.json      # active promotion state
scripts/promo_select.py        # product selection script
scripts/apply_promo_prices.py  # Phase 2 executor
scripts/restore_promo_prices.py # Phase 5 executor
~/Library/LaunchAgents/io.celldigital.shopify-order-os.promo-restore.plist
```

## Shopify credentials (from .env)

Read from `/Users/xiaozuo/Projects/shopify-order-os/.env`:
- SHOPIFY_STORE_DOMAIN
- SHOPIFY_CLIENT_ID
- SHOPIFY_CLIENT_SECRET

## Usage examples

```
# Start Memorial Day promotion
/bdsm-promotion memorial-day

# Start custom promotion
/bdsm-promotion --name "Summer Flash Sale" --discount 25 --start 2026-06-15 --end 2026-06-17 --products all

# Check active promotion status
/bdsm-promotion status

# Manually restore prices now
/bdsm-promotion restore
```

## Margin floor rules

- NEVER discount below 35% margin (cost guardrail)
- Products with landed cost > 50% of retail: max 10% discount
- Bundles: treat as single unit, use sum of component costs
- `direct` mode products (Lovense): no discount — fixed MSRP

## Obsidian vault output

After each promotion: `~/Documents/Obsidian/30-Operations/Dark Fantasy/Promotions/{promo_code}_{date}.md`
