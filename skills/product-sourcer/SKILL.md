---
name: product-sourcer
description: Source top-selling AliExpress dropshipping products and create Shopify draft listings end-to-end (PDP copy, images, AE buyer reviews via Judge.me CSV). Use when user asks to find/propose new SKUs or expand the catalog.
---

# Product Sourcer

Source top-selling AliExpress products and decorate them into Shopify-ready draft listings.

## When to use

- "Find me 10/20/50 new products to sell"
- "Source [niche] dropshipping products"
- "What's trending on AliExpress in [category]"
- "Expand the catalog with new SKUs"

## Hard rules

1. **AliExpress only** (via DSers Find Products). Alibaba is MOQ wholesale — wrong fit for dropship. CJ is supported if `~/.claude/credentials.json` has `cj_dropshipping_api_key`, otherwise skip CJ.
2. **No fake reviews.** Pull real AE buyer reviews and import as Judge.me CSV with explicit `"via AliExpress"` source attribution. FTC compliance: 16 CFR § 465.
3. **Drafts only.** New Shopify products are created with `status="draft"`. Operator approves activation per product.
4. **Pricing.** Default markup = 3.5x landed cost, rounded to nearest $.99. Operator can override per product in the datasheet.
5. **Use Haiku for content generation** (PDP body, ad copy). Use Opus only for orchestration + Playwright/Shopify writes.

## Inputs

- **Niche** (e.g. "BDSM accessories", "kitchen gadgets") — required
- **Count** (e.g. 20) — default 10
- **Min orders threshold** — default 50 (suppliers below this aren't proven)
- **Min rating** — default 4.3★
- **Max landed cost** — default $30 (allows $99 retail at 3.5x with room for shipping)
- **Existing Shopify catalog** — auto-detected via Admin API; new candidates dedupe against it

## Workflow

### Phase 1 — Discovery (Opus + Playwright + DSers)

For each search keyword in the niche:
1. Open `https://www.dsers.com/application/find_products_list?changeSearchData=<query>&appId=<your-app-id>`
2. Extract top-N visible cards: `{itemId, title, priceMin, orders, shipping, rating, thumbnailUrl}`
3. Filter by min-orders, min-rating, max-landed-cost
4. Dedupe by `itemId` across queries
5. Insert into `order_os.supplier_candidates` with `source='dsers'`

### Phase 2 — Score & rank (pure SQL or Haiku)

```sql
score = sim(target_niche, supplier_title) * 60       -- relevance dominates
      + log10(orders+1) * 5                            -- traction (capped at 15)
      + max(0, rating - 4) * 10                        -- quality
      - case when in_stock=false then 30 else 0 end    -- stock penalty
      + max(-10, 5 - landed * 0.3)                     -- gentle cost preference
```

Pick top-N by score. Dedupe near-identical titles (similarity > 0.8).

### Phase 3 — PDP generation (Haiku subagent, parallel batches of 3)

Per product, Haiku generates `{new_title, new_body_html, suggested_handle, tags, retail_price, meta_description}`:

- **Title**: clean noun phrase, max 60 chars, no AE seller spam
- **Body**: `<div class="pdp-rich-content">` matching site brand voice (read 3 existing site PDPs to learn voice first). Sections: hook H2 → philosophy → key features (extracted from supplier title) → "What's in the Box" → care/usage notes
- **Handle**: lowercase-kebab from title
- **Tags**: from category map (e.g. `bondage, beginner, leather`)
- **Retail price**: `round(landed * 3.5, $.99)`, floor at $19
- **Meta description**: 155-char SEO summary

### Phase 4 — Reviews harvest (Opus, optional)

Open the AE PDP via Playwright (Akamai may block — accept partial coverage). Extract top 5-10 buyer reviews. Format as Judge.me CSV:

```csv
product_id,product_handle,rating,title,body,reviewer_name,reviewer_email,published_at,source,verified
```

Source column = "AliExpress" so app shows "Verified review from AliExpress" badge. Operator must install Judge.me app on Shopify and import CSV manually.

### Phase 5 — Shopify product creation

For each ranked candidate:
1. `mutation productCreate` (GraphQL) with `status: DRAFT`, title, descriptionHtml, handle, productType, tags, variants[0].price + sku, vendor
2. `POST /admin/api/.../products/{id}/images.json` with the 1-2 AE thumbnail URLs (Shopify pulls)
3. Insert into local `order_os.supplier_mappings` so it's pipeline-ready
4. Save image to `~/Downloads/<store>-supplier-images/<handle>/`

### Phase 6 — Datasheet

Per store, write:
- `~/Documents/Obsidian/<store>/Sourcing/<date>/_index.md` — summary
- `<date>/_master.csv` — flat list with: shopify_id, handle, title, retail, landed, margin, supplier_url, orders, rating, score
- Per-product MD with all the AE source data + reviews link

## Required env / secrets

Per store, expect:
- Shopify Admin API: `SHOPIFY_CLIENT_ID` + `SHOPIFY_CLIENT_SECRET` (via dev dashboard client_credentials grant)
- Required app scopes: `read_products, write_products, read_locations, read_inventory, write_inventory`
- Supabase: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- DSers: must be installed on the store; agent uses Playwright session

## Gotchas

- **DSers re-ranks search results between sessions.** Re-running the same query may surface different products. Always save the SKU at discovery time, don't rely on re-finding it later.
- **AE direct fetch is Akamai-gated.** Use DSers proxy or accept partial PDP data (titles/thumbnails only).
- **Shopify duplicate handles** — if handle clashes, append `-2`, `-3`, etc.
- **Image upload via Shopify's pull-by-URL** sometimes 422s if AE CDN returns redirects. Retry with the cached local file via `attachment` base64 in the same `images.json` POST.
- **Inventory location** — newly-created products default to all locations. For DSers/CJ flow, the routing must include their fulfillment-service location, not just the home address.

## Output structure (artifacts you should leave behind)

```
~/Documents/Obsidian/<store>/Sourcing/<yyyymmdd>/
  _index.md             # run summary + counts
  _master.csv           # flat top-N
  <handle-1>.md         # per-product
  <handle-2>.md
  ...

~/Downloads/<store>-supplier-images/<handle>/
  _meta.json
  <image1>.jpg
  <image2>.jpg

Supabase order_os.supplier_candidates    # new rows
Supabase order_os.supplier_mappings      # new rows, mapping_status='RESOLVED'
Shopify products: status='draft'         # awaiting operator activation
```

## Cost / pacing guidance

- ~5-8 Playwright nav calls per niche keyword (1 per query)
- ~3 Haiku subagent dispatches (batch of 3-5 products each)
- ~5 Shopify Admin API calls per new product (productCreate, 1-2 images, optionally metafields)
- Estimate: **~150-200 tool calls for 20 products** in a single niche. Plan to checkpoint at counts of 5 if user wants to course-correct.

## Reference implementations

- `~/Projects/shopify-order-os/src/resolver/` — scoring + datasheet builder
- `~/Projects/shopify-order-os/scripts/publish_pdp_drafts.ts` — productCreate + image upload pattern
- `~/Projects/shopify-order-os/scripts/save_images_local.py` — local image archive
