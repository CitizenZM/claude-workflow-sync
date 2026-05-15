---
name: Use dropship plugins (DSers/CJ) for AE/Alibaba placement, not custom browser automation
description: For Shopify dropshipping order fulfillment, prefer DSers + CJ Dropshipping plugins over building custom browser-harness AE placers. Order OS layer sits above plugins as control plane.
type: feedback
originSessionId: e1be07ac-94a3-4dde-ad73-f323ac784885
---
When building Shopify dropshipping order fulfillment for Barron, do NOT build custom AliExpress browser automation. Use plugins:

- **DSers (free Shopify app)** — uses AE's official Open Platform API for one-click bulk placement, tracking sync, variant mapping. Handles AE dropship side completely.
- **CJ Dropshipping** — for Alibaba-equivalent / 3PL warehouse items.
- **Lovense Direct** — branded products, manual.

The custom layer's job is the *control plane* above plugins:
- Single Supabase queue across all channels
- Branded customer email (Resend) instead of Shopify defaults
- Bundle splitting that DSers/CJ can't do
- Cross-channel margin/KPI reporting
- Audit log + state machine

**Why:** AE has Akamai bot detection — even legitimate signup flows via headless browser get blocked and redirected. Confirmed 2026-05-09 when AE bounced browser-harness signup to homepage. DSers exists precisely because AE wants partners using their Open Platform API, not scraped accounts.

**How to apply:** When user asks to "automate Shopify dropshipping" or "fulfill AE orders," propose hybrid architecture (plugin + custom orchestrator) before suggesting browser automation. Browser-harness is right for Awin/Impact partner outreach, NOT for AE order placement.
