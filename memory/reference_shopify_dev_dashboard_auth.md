---
name: Shopify dev-dashboard apps use client_credentials grant, not static admin tokens
description: Post-Jan 2026 dev-dashboard apps don't expose a static Admin API token. Use client_id+client_secret → 24h shpat_ via /admin/oauth/access_token. atkn_ is for CI/CD only, NOT Admin API.
type: reference
originSessionId: e1be07ac-94a3-4dde-ad73-f323ac784885
---
Starting 2026-01-01, Shopify removed legacy custom-app creation. New custom-app flow lives in `dev.shopify.com/dashboard`. The auth model changed:

**Three different tokens, easy to confuse:**

| Prefix | What it is | Where used |
|--------|-----------|-----------|
| `shpat_` | 24h Admin API access token | `X-Shopify-Access-Token` on `*.myshopify.com/admin/api/...` |
| `shpss_` | Client secret (long-lived) | Exchange via OAuth grant for `shpat_` |
| `atkn_` | Personal access token for the Dev Dashboard itself | `shopify app deploy` and Dev Dashboard CLI; NOT Admin API |

**Calling Admin API (the only thing that matters for ops scripts):**

```bash
# Step 1 — exchange (do this once per 24h, cache result)
curl -X POST "https://<shop>.myshopify.com/admin/oauth/access_token" \
  -d "grant_type=client_credentials" \
  -d "client_id=<from dev dashboard Settings>" \
  -d "client_secret=shpss_<from dev dashboard Settings>"
# → {"access_token":"shpat_...","scope":"...","expires_in":86399}

# Step 2 — call API
curl -H "X-Shopify-Access-Token: shpat_..." \
  "https://<shop>.myshopify.com/admin/api/2025-01/shop.json"
```

**Trap:** the Dev Dashboard surfaces a button "Create app automation token" that mints an `atkn_…` value. Sending that as `X-Shopify-Access-Token` returns 401 `Service is not valid for authentication` (Bearer) or `Invalid API key or access token` (X-Shopify-Access-Token). It is genuinely a different token type.

**Implementation pattern for a long-running script:** cache the `shpat_` in process and refresh ~5 min before `expires_in` (always 86399). See `~/Projects/shopify-order-os/src/lib/shopify.ts` `getAccessToken()` for a working reference.

**Scope gotcha:** the "Configuration" page has read/write toggles per resource. Releasing a new app version freezes whatever scopes were checked at that moment — verify the released version's actual scopes by inspecting the `scope` field in the client_credentials response. If writes are missing, you must edit configuration → release a new version → re-install on the store.

**Related:** `~/Projects/shopify-order-os/artifacts/signups/CREDENTIALS.md` documents the full token-exchange model with worked example.
