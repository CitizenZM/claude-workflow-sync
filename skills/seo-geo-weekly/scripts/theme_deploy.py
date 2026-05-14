"""Deploy theme files (patched header.liquid, llms.txt, llms-full.txt) via Shopify Theme Asset API.

llms.txt + llms-full.txt approach:
- Shopify online store can't expose arbitrary URLs at root
- Solution: upload as theme assets, then add a Liquid template that serves them
- BUT: simpler — most SEO tools accept /pages/llms.txt fallback. We:
  - Save llms.txt content as a Page (via PageCreate mutation) at handle "llms-txt"
  - Add 301 redirect /llms.txt → /pages/llms-txt
  - Same for llms-full.txt
- The /pages/llms-txt URL is then findable by AI crawlers via sitemap
"""
import json
import subprocess
from pathlib import Path


def shopify_execute(shop: str, query: str, variables: dict | None = None, allow_mutations: bool = False) -> dict:
    cmd = [
        "shopify", "store", "execute",
        "--store", shop,
        "--query", query,
        "--version", "2026-04",
        "--json",
    ]
    if variables:
        cmd += ["--variables", json.dumps(variables)]
    if allow_mutations:
        cmd.append("--allow-mutations")
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if proc.returncode != 0:
        raise RuntimeError(f"shopify CLI: {proc.stderr[:400]}")
    out = proc.stdout
    start = out.find("\n{")
    if start < 0:
        start = out.find("{")
    return json.loads(out[start:].strip())


THEME_FILES_UPSERT = """
mutation themeFilesUpsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
  themeFilesUpsert(themeId: $themeId, files: $files) {
    upsertedThemeFiles { filename size }
    userErrors { field code message }
  }
}
"""


def push_theme_file(shop: str, theme_id: str, filename: str, content: str) -> dict:
    return shopify_execute(
        shop,
        THEME_FILES_UPSERT,
        {
            "themeId": theme_id,
            "files": [{"filename": filename, "body": {"type": "TEXT", "value": content}}],
        },
        allow_mutations=True,
    )


def get_main_theme(shop: str) -> dict:
    d = shopify_execute(shop, "{ themes(first: 5, roles: [MAIN]) { nodes { id name role } } }")
    nodes = d.get("themes", {}).get("nodes", [])
    return nodes[0] if nodes else None


PAGE_CREATE = """
mutation pageCreate($page: PageCreateInput!) {
  pageCreate(page: $page) {
    page { id handle title isPublished }
    userErrors { field code message }
  }
}
"""


def create_page(shop: str, title: str, handle: str, body_html: str) -> dict:
    return shopify_execute(
        shop, PAGE_CREATE,
        {"page": {"title": title, "handle": handle, "body": body_html, "isPublished": True}},
        allow_mutations=True,
    )


REDIRECT_CREATE = """
mutation urlRedirectCreate($urlRedirect: UrlRedirectInput!) {
  urlRedirectCreate(urlRedirect: $urlRedirect) {
    urlRedirect { id path target }
    userErrors { field code message }
  }
}
"""


def create_redirect(shop: str, path: str, target: str) -> dict:
    return shopify_execute(
        shop, REDIRECT_CREATE,
        {"urlRedirect": {"path": path, "target": target}},
        allow_mutations=True,
    )


def deploy_all(shop: str, state_dir: Path) -> dict:
    """Apply: theme header patch + llms.txt page + redirects."""
    theme = get_main_theme(shop)
    if not theme:
        return {"error": "no main theme"}

    results = {}

    # 1. Header.liquid patch
    patched = (state_dir / "theme_header.liquid.patched").read_text()
    r = push_theme_file(shop, theme["id"], "sections/header.liquid", patched)
    results["theme_header_patch"] = r.get("themeFilesUpsert", {})

    # 2. llms.txt as a Page
    llms_content = (state_dir / "llms.txt").read_text()
    # Wrap in <pre> for raw display; AI crawlers prefer raw text
    body_html = f'<pre style="white-space:pre-wrap;font-family:monospace">{llms_content}</pre>'
    try:
        results["llms_page"] = create_page(shop, "llms.txt", "llms-txt", body_html)
    except Exception as e:
        results["llms_page"] = {"error": str(e)[:200]}

    llms_full = (state_dir / "llms-full.txt").read_text()
    body_html2 = f'<pre style="white-space:pre-wrap;font-family:monospace">{llms_full}</pre>'
    try:
        results["llms_full_page"] = create_page(shop, "llms-full.txt", "llms-full-txt", body_html2)
    except Exception as e:
        results["llms_full_page"] = {"error": str(e)[:200]}

    # 3. Redirects from /llms.txt → /pages/llms-txt
    for src, dst in [("/llms.txt", "/pages/llms-txt"), ("/llms-full.txt", "/pages/llms-full-txt")]:
        try:
            results[f"redirect_{src.replace('/', '')}"] = create_redirect(shop, src, dst)
        except Exception as e:
            results[f"redirect_{src.replace('/', '')}"] = {"error": str(e)[:200]}

    return results


if __name__ == "__main__":
    import sys
    state = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "state" / "2026-05-08"
    print(json.dumps(deploy_all("1a049t-cy.myshopify.com", state), indent=2))
