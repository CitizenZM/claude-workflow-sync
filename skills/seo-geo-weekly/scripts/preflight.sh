#!/usr/bin/env bash
# Cron preflight: ensure Shopify CLI session is fresh.
# Tries a probe query; if it fails, attempts a re-auth via the saved scopes.
# Logs to ~/.claude/logs/seo-geo-weekly.log via cron's stdout/err redirect.

set -uo pipefail

STORE="1a049t-cy.myshopify.com"
SCOPES="read_products,read_product_listings,read_inventory,read_content,read_themes,read_online_store_pages,read_online_store_navigation,read_locales,read_translations,read_files,read_metaobjects,read_metaobject_definitions,read_publications,read_orders,read_locations"

# Probe
PROBE_OUT=$(shopify store execute --store "$STORE" --query '{ shop { name } }' --json 2>&1)
if echo "$PROBE_OUT" | grep -q '"shop"'; then
    echo "[preflight] Shopify session OK"
    exit 0
fi

echo "[preflight] Session expired or missing — attempting refresh"
echo "$PROBE_OUT" | head -3

# Try non-interactive re-auth. Will fail in pure cron (no browser), but works
# when run from a logged-in user session via launchctl or `at`.
if shopify store auth --store "$STORE" --scopes "$SCOPES" --json >/dev/null 2>&1; then
    echo "[preflight] Re-auth succeeded"
    exit 0
fi

echo "[preflight] Auto-renew failed; appending alert to Obsidian Worklog"
WL="$HOME/Documents/Obsidian/01-Projects/Dark-Fantasy-SEO-GEO-Weekly/Worklog.md"
if [ -f "$WL" ]; then
    {
        echo ""
        echo "## $(date -u +%Y-%m-%dT%H:%M:%SZ) — ⚠ Shopify CLI session expired"
        echo ""
        echo "- Cron run blocked. Run interactively to refresh:"
        echo "  \`shopify store auth --store $STORE --scopes $SCOPES\`"
        echo ""
        echo "---"
        echo ""
    } >> "$WL"
fi
exit 2
