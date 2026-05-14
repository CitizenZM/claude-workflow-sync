"""Generate llms.txt + llms-full.txt from the Shopify catalog.

Spec: https://llmstxt.org/

llms.txt — concise index, AI-readable, links to detail pages
llms-full.txt — full text content concatenated for LLM ingestion
"""
import json
from pathlib import Path


def build_llms_txt(catalog: dict, storefront_url: str) -> str:
    shop = catalog["shop"]["shop"]
    products = catalog["products"]
    collections = catalog["collections"]

    lines = [
        f"# {shop['name']}",
        "",
        f"> {shop['name']} — premium adult intimate wellness, BDSM gear, and luxury bondage equipment. "
        f"Free discreet shipping on orders $99+. {len(products)} products, {len(collections)} collections.",
        "",
        f"Currency: {shop.get('currencyCode', 'USD')}. Storefront: {storefront_url}",
        "",
        "## About",
        "",
        f"{shop['name']} curates body-safe, premium intimate wellness products including bondage gear, "
        "adult toys, sensation play kits, and couples' accessories. All items prioritize body-safe "
        "materials (silicone, real leather, medical-grade stainless steel).",
        "",
        "## Collections",
        "",
    ]
    for c in collections:
        if not c.get("handle"):
            continue
        title = c["title"]
        seo_d = (c.get("seo") or {}).get("description") or ""
        url = f"{storefront_url}/collections/{c['handle']}"
        if seo_d:
            lines.append(f"- [{title}]({url}): {seo_d}")
        else:
            lines.append(f"- [{title}]({url})")

    lines += ["", "## Products", ""]
    # Group by productType
    by_type: dict[str, list] = {}
    for p in products:
        if p.get("status") and p["status"] != "ACTIVE":
            continue
        t = p.get("productType") or "Other"
        by_type.setdefault(t, []).append(p)

    for ptype, plist in sorted(by_type.items()):
        lines.append(f"### {ptype}")
        lines.append("")
        for p in plist:
            url = p.get("onlineStoreUrl") or f"{storefront_url}/products/{p['handle']}"
            seo_d = (p.get("seo") or {}).get("description") or ""
            if seo_d:
                lines.append(f"- [{p['title']}]({url}): {seo_d[:160]}")
            else:
                lines.append(f"- [{p['title']}]({url})")
        lines.append("")

    lines += [
        "## Shipping & Policies",
        "",
        f"- Free discreet shipping on orders $99+ (US)",
        f"- Plain packaging on every order",
        f"- See [shipping]({storefront_url}/pages/shipping) and [returns]({storefront_url}/pages/returns)",
        "",
        "## Optional",
        "",
        f"- [About]({storefront_url}/pages/about)",
        f"- [FAQ]({storefront_url}/pages/faq)",
        f"- [Contact]({storefront_url}/pages/contact)",
    ]
    return "\n".join(lines) + "\n"


def build_llms_full_txt(catalog: dict, storefront_url: str) -> str:
    """Full content version with product details inline."""
    shop = catalog["shop"]["shop"]
    products = catalog["products"]

    out = [
        f"# {shop['name']} — Full Catalog",
        "",
        f"Storefront: {storefront_url}",
        f"{len(products)} active products as of crawl.",
        "",
    ]
    for p in products:
        if p.get("status") and p["status"] != "ACTIVE":
            continue
        url = p.get("onlineStoreUrl") or f"{storefront_url}/products/{p['handle']}"
        seo = p.get("seo") or {}
        out += [
            f"## {p['title']}",
            "",
            f"URL: {url}",
            f"Type: {p.get('productType') or '—'}",
            f"Vendor: {p.get('vendor') or '—'}",
        ]
        if p.get("tags"):
            out.append(f"Tags: {', '.join(p['tags'])}")
        if seo.get("title") and seo["title"] != p["title"]:
            out.append(f"SEO Title: {seo['title']}")
        if seo.get("description"):
            out += ["", seo["description"]]
        # Variants summary
        vs = (p.get("variants") or {}).get("nodes") or []
        if vs:
            prices = sorted({v.get("price") for v in vs if v.get("price")})
            if prices:
                out.append(f"Price: {', '.join(prices)}")
        out += ["", "---", ""]
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    import sys
    state_dir = Path(sys.argv[1])
    storefront = sys.argv[2]
    catalog = json.loads((state_dir / "catalog.json").read_text())
    print(build_llms_txt(catalog, storefront))
