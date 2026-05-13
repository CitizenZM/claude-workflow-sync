"""Generate auto-fix proposals for SEO issues.

Reads audit + catalog, uses Gemini to rewrite long titles, generate missing
meta descriptions. Outputs `proposed_fixes.json` with Admin API mutation
payloads. Apply via `--apply` flag in run.py.
"""
import json
import os
import re
import time
import urllib.request
from pathlib import Path

CREDS_PATH = Path.home() / ".claude/credentials.json"


def _gemini_key() -> str:
    return json.loads(CREDS_PATH.read_text())["api_keys"]["gemini"]


def gemini(prompt: str, model: str = "gemini-2.5-flash", max_tokens: int = 600) -> str:
    key = _gemini_key()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": max_tokens},
    }
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"}, method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        d = json.loads(r.read().decode())
    parts = d.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    return "".join(p.get("text", "") for p in parts).strip()


def rewrite_title(current: str, product_title: str, brand: str = "Dark Fantasy") -> str:
    """Compress to ≤60 chars, keep brand suffix when possible."""
    # Decode HTML entities in inputs
    import html
    current = html.unescape(current)
    product_title = html.unescape(product_title)
    prompt = f"""Rewrite this Shopify product SEO title to be 50–60 characters total. Include the product name, end with " | {brand}" if the total fits. No HTML entities. Plain text only, no quotes, no formatting, no preamble.

Current title: {current}
Product name: {product_title}
Brand: {brand}

Output ONLY the new title text — nothing else, no quotes."""
    out = gemini(prompt, max_tokens=200).strip().strip('"').strip("'")
    out = re.sub(r"\s+", " ", out)
    if len(out) > 60:
        out = out[:57].rstrip(" |") + "…"
    return out


def write_meta_description(product_title: str, current_desc: str = "", product_type: str = "", tags: "list[str] | None" = None) -> str:
    """Compose 140–160 char meta description."""
    import html
    product_title = html.unescape(product_title)
    tag_hint = f" Tags: {', '.join(tags[:5])}." if tags else ""
    prompt = f"""Write a Shopify product meta description, 140–160 characters total. Include the product benefit + a body-safe materials mention + a soft CTA. End with "Free discreet shipping $99+." Plain text, no quotes, no HTML, no preamble.

Product: {product_title}
Type: {product_type}{tag_hint}

Output ONLY the description text. It must be at least 140 chars and at most 160 chars."""
    out = gemini(prompt, max_tokens=300).strip().strip('"').strip("'")
    out = re.sub(r"\s+", " ", out)
    if len(out) > 160:
        out = out[:157].rstrip() + "..."
    return out


def propose_fixes(state_dir: Path, brand: str = "Dark Fantasy", limit_titles: int = 20, limit_metas: int = 10) -> dict:
    audit = json.loads((state_dir / "audit.json").read_text())
    catalog = json.loads((state_dir / "catalog.json").read_text())

    products_by_url = {}
    for p in catalog["products"]:
        url = p.get("onlineStoreUrl")
        if url:
            products_by_url[url.rstrip("/")] = p

    pages_by_url = {p["url"].rstrip("/"): p for p in audit["pages"]}

    fixes = {
        "rewritten_titles": [],
        "added_meta_descriptions": [],
        "alt_text_proposals": [],
        "theme_actions": [],
    }

    # 1. Rewrite long titles for products
    long_titles = audit["issues"]["title_too_long"][:limit_titles]
    print(f"      [autofix] rewriting {len(long_titles)} long titles via Gemini")
    for url in long_titles:
        url_clean = url.rstrip("/")
        page = pages_by_url.get(url_clean) or pages_by_url.get(url)
        product = products_by_url.get(url_clean)
        if not page:
            continue
        cur_title = page.get("title", "")
        product_title = product["title"] if product else cur_title.split("|")[0].strip()
        try:
            new_title = rewrite_title(cur_title, product_title, brand)
            fixes["rewritten_titles"].append({
                "url": url,
                "product_id": product["id"] if product else None,
                "current_title": cur_title,
                "current_len": len(cur_title),
                "new_title": new_title,
                "new_len": len(new_title),
                "admin_mutation": (
                    {
                        "mutation": "productUpdate",
                        "input": {
                            "id": product["id"],
                            "seo": {"title": new_title},
                        },
                    }
                    if product else None
                ),
            })
            time.sleep(0.5)
        except Exception as e:
            fixes["rewritten_titles"].append({"url": url, "error": str(e)[:200]})

    # 2. Generate meta descriptions for missing
    missing = audit["issues"]["missing_meta_desc"][:limit_metas]
    print(f"      [autofix] generating {len(missing)} meta descriptions via Gemini")
    for url in missing:
        product = products_by_url.get(url.rstrip("/"))
        if not product:
            continue
        try:
            desc = write_meta_description(
                product["title"],
                product_type=product.get("productType") or "",
                tags=product.get("tags") or [],
            )
            fixes["added_meta_descriptions"].append({
                "url": url,
                "product_id": product["id"],
                "new_description": desc,
                "len": len(desc),
                "admin_mutation": {
                    "mutation": "productUpdate",
                    "input": {
                        "id": product["id"],
                        "seo": {"description": desc},
                    },
                },
            })
            time.sleep(0.5)
        except Exception as e:
            fixes["added_meta_descriptions"].append({"url": url, "error": str(e)[:200]})

    # 3. Alt text proposals (deterministic, no LLM needed)
    for p in catalog["products"]:
        for img in (p.get("images") or {}).get("nodes", []):
            if not img.get("altText"):
                fixes["alt_text_proposals"].append({
                    "product_id": p["id"],
                    "image_url": img.get("url"),
                    "proposed_alt": p["title"],
                })

    # 4. Theme-level actions (logged, not auto-applied)
    if len([p for p in audit["pages"] if p.get("h1_count", 0) > 1]) > 0:
        fixes["theme_actions"].append({
            "issue": "Multiple <h1> tags",
            "root_cause": "Theme uses <h1 class='header__heading'> for the store name in the global header. Every page now has 2+ H1s.",
            "fix": "Edit theme.liquid (or sections/header.liquid): change the store-name <h1> to <span> or <p class='header__heading'> with the same styling. Reserve <h1> for page-specific content.",
        })

    out = state_dir / "proposed_fixes.json"
    out.write_text(json.dumps(fixes, indent=2))
    return fixes


def apply_fixes(state_dir: Path, shopify_domain: str, api_version: str = "2026-04") -> dict:
    """Apply proposed fixes via Shopify Admin API. ONLY runs when --apply flag is set."""
    import subprocess
    fixes = json.loads((state_dir / "proposed_fixes.json").read_text())
    applied = {"titles": 0, "metas": 0, "alts": 0, "errors": []}

    PRODUCT_UPDATE = """
    mutation productUpdate($id: ID!, $seo: SEOInput) {
      productUpdate(input: {id: $id, seo: $seo}) {
        product { id seo { title description } }
        userErrors { field message }
      }
    }
    """

    for fix in fixes["rewritten_titles"]:
        if not fix.get("admin_mutation") or "error" in fix:
            continue
        result = subprocess.run(
            [
                "shopify", "store", "execute",
                "--store", shopify_domain,
                "--query", PRODUCT_UPDATE,
                "--variables", json.dumps({
                    "id": fix["admin_mutation"]["input"]["id"],
                    "seo": fix["admin_mutation"]["input"]["seo"],
                }),
                "--allow-mutations",
                "--version", api_version,
                "--json",
            ],
            capture_output=True, text=True, timeout=60,
        )
        if result.returncode == 0 and '"productUpdate"' in result.stdout:
            applied["titles"] += 1
        else:
            applied["errors"].append({"url": fix["url"], "stderr": result.stderr[:300]})
        time.sleep(0.5)

    for fix in fixes["added_meta_descriptions"]:
        if not fix.get("admin_mutation"):
            continue
        result = subprocess.run(
            [
                "shopify", "store", "execute",
                "--store", shopify_domain,
                "--query", PRODUCT_UPDATE,
                "--variables", json.dumps({
                    "id": fix["admin_mutation"]["input"]["id"],
                    "seo": fix["admin_mutation"]["input"]["seo"],
                }),
                "--allow-mutations",
                "--version", api_version,
                "--json",
            ],
            capture_output=True, text=True, timeout=60,
        )
        if result.returncode == 0 and '"productUpdate"' in result.stdout:
            applied["metas"] += 1
        else:
            applied["errors"].append({"url": fix["url"], "stderr": result.stderr[:300]})
        time.sleep(0.5)

    # Alt-text fills via productUpdate.media (per-product batched)
    PRODUCT_MEDIA_UPDATE = """
    mutation productUpdateMedia($productId: ID!, $media: [UpdateMediaInput!]!) {
      productUpdateMedia(productId: $productId, media: $media) {
        media { id alt }
        mediaUserErrors { field message }
      }
    }
    """
    # Group alts by product
    alts_by_product = {}
    for a in fixes.get("alt_text_proposals", []):
        pid = a.get("product_id")
        if not pid:
            continue
        alts_by_product.setdefault(pid, []).append(a)

    # First, fetch each product's image GIDs (image_url alone isn't enough)
    for pid, alts in alts_by_product.items():
        # Get image gids for this product
        q = "query($id: ID!) { product(id: $id) { images(first: 50) { nodes { id url altText } } } }"
        r = subprocess.run(
            ["shopify","store","execute","--store",shopify_domain,
             "--query",q,"--variables",json.dumps({"id":pid}),
             "--version",api_version,"--json"],
            capture_output=True, text=True, timeout=60,
        )
        if r.returncode != 0:
            applied["errors"].append({"product_id": pid, "stage": "fetch_images", "stderr": r.stderr[:200]})
            continue
        out = r.stdout
        s = out.find("\n{")
        if s<0: s=out.find("{")
        try:
            d = json.loads(out[s:].strip())
            imgs = d.get("product",{}).get("images",{}).get("nodes",[])
        except Exception:
            applied["errors"].append({"product_id": pid, "stage": "parse_images"})
            continue

        # Build media update list: every image without alt gets product title alt
        proposed_alt = alts[0].get("proposed_alt") if alts else ""
        media_updates = [
            {"id": img["id"], "alt": proposed_alt, "previewImageSource": img["url"]}
            for img in imgs if not img.get("altText")
        ]
        if not media_updates:
            continue

        r2 = subprocess.run(
            ["shopify","store","execute","--store",shopify_domain,
             "--query",PRODUCT_MEDIA_UPDATE,
             "--variables",json.dumps({"productId":pid,"media":media_updates}),
             "--allow-mutations","--version",api_version,"--json"],
            capture_output=True, text=True, timeout=120,
        )
        if r2.returncode == 0 and '"productUpdateMedia"' in r2.stdout:
            applied["alts"] += len(media_updates)
        else:
            applied["errors"].append({"product_id": pid, "stage": "alt_update", "stderr": r2.stderr[:200]})
        time.sleep(0.5)

    return applied


if __name__ == "__main__":
    import sys
    state_dir = Path(sys.argv[1])
    print(json.dumps(propose_fixes(state_dir), indent=2)[:2000])
