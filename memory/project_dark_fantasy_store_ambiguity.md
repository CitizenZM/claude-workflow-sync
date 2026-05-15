---
name: Dark Fantasy Shopify store has dual-store binding ambiguity (tcl-test-6774 vs 1a049t-cy)
description: Shopify partner account 201369753 owns two stores; plugins appear in tcl-test-6774's apps list but actually bind to 1a049t-cy. Verify store binding before assuming a plugin manages tcl-test-6774.
type: project
originSessionId: e1be07ac-94a3-4dde-ad73-f323ac784885
---
The Dark Fantasy Shopify partner account `201369753` (operator: affiliate@xark.io) has two stores:
- **tcl-test-6774** (Dark Fantasy / bdsmpub.com) — the real store with 50 products, brand identity, customer-facing
- **1a049t-cy** — a development/sandbox store on the same partner account

**Confirmed 2026-05-09:** DSers, CJ Dropshipping, Klaviyo, Bundles, ShipStation all *appear* in tcl-test-6774's installed apps list, but when opened, they bind back to seller_id=1a049t-cy. The "Install app" flow for new dev apps (e.g. Order OS at app id 359962640385) defaults the install popup to 1a049t-cy as well.

**Why:** Shopify's app installation flow on dev partner accounts caches the most recent store choice and often presents it as default in the OAuth popup; the apps surface across all the partner's stores even when the actual session/binding lives on a different store.

**How to apply:** When working on Shopify Order OS, dropshipping, or any DSers/CJ workflow for Dark Fantasy:
1. Don't assume "installed in tcl-test-6774" means orders flow from there. Open the plugin and verify the bound seller_id in URL params.
2. The install popup's store dropdown must be manually corrected to tcl-test-6774 the first time (Claude Code can't pre-select).
3. Storefront JSON (`bdsmpub.com/products/<handle>.json`) is `tcl-test-6774`'s real domain — confirms which store contains the 50 Dark Fantasy products.
4. Existing bundle compositions for Couples' First Night, Signature Set, Midnight Starter Set are seeded in Supabase `order_os.bundle_components` (18 rows total) extracted from storefront JSON.

**Related artifacts:**
- ~/Projects/shopify-order-os/artifacts/signups/CREDENTIALS.md — full state matrix
- Supabase project adstream-ai schema `order_os` — orders, supplier_mappings (50), bundle_components (18)
- Order OS dev app: dev.shopify.com/dashboard/201369753/apps/359962640385 (released as order-os-2)
