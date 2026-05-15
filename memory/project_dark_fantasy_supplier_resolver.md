---
name: Dark Fantasy supplier resolver — hybrid DSers + CJ + AE candidate ranking
description: shopify-order-os has an auto-resolver (pnpm resolve) that ranks supplier_candidates via title-similarity + orders + rating + landed cost. Stores best AE URL per product. Currently 4/29 dropship products resolved.
type: project
originSessionId: e1be07ac-94a3-4dde-ad73-f323ac784885
---

**Status as of 2026-05-10:**
- `order_os.supplier_candidates` table holds raw search results per product (DSers/AE/CJ)
- `pnpm resolve` ranks candidates and writes best to `supplier_mappings.supplier_url` / `unit_cost_usd`, flips to mapping_status=RESOLVED
- 4 dropship products auto-resolved (cuffs, ankles, blindfold, crop). 25 dropship products still PENDING — need DSers search + commit.

**Workflow to resolve a product:**
1. Open DSers find-products: `https://www.dsers.com/application/find_products_list?changeSearchData=<query>&appId=159831080`
2. Read product cards via JS — DOM exposes `a[href*="aliexpress.com/item"]` + price/orders/shipping/rating in card text
3. Insert into `supplier_candidates` (one row per candidate)
4. Run `pnpm resolve [--product <id>]` to rank + write supplier_mappings

**Scoring (`src/resolver/score.ts`):**
- title-similarity × 60 (dominant — irrelevant cheap items must not win)
- log10(orders+1) × 5, capped at 15
- (rating - 4) × 10 if ≥4★
- -30 if explicitly out of stock
- 5 - landed × 0.3 (gentle cost preference)

**Key URLs (resolved 2026-05-10):**
| Shopify product | AE item | Cost |
|---|---|---|
| 8991066980529 Midnight Leather Wrist Cuffs | aliexpress.com/item/1005008559467295 | $21.17 |
| 8991067570353 Obsidian Ankle Cuffs        | aliexpress.com/item/1005009664413309 | $5.14  |
| 8991068258481 Velvet Noir Blindfold       | aliexpress.com/item/1005008877882106 | $7.65  |
| 8991069634737 Raven Riding Crop           | aliexpress.com/item/1005006189736056 | $7.60  |

**Run the full hybrid flow:**
```bash
cd ~/Projects/shopify-order-os
# 1. Discover candidates (manual or scripted via Playwright)
# 2. Rank + commit
pnpm resolve
# 3. Pipeline
pnpm test-orders && pnpm ingest && pnpm dispatch && pnpm track
```

**Known blockers for full auto:**
- CJ Open API requires API key generation in CJ dashboard (Akamai blocks auto-signup) — operator must enable
- AE direct scrape is the fallback path; requires browser-harness with throttle to evade Akamai
- DSers session is bound to `1a049t-cy` not `tcl-test-6774` — search works (store-agnostic) but ordering doesn't auto-bind

**Architectural note:** Shopify's `fulfillment_status=unfulfilled` filter excludes orders with null fulfillment_status (newly-created order_create orders default to null). Use `fulfillment_status=unshipped` instead — this catches both null and 'unfulfilled' states.
