"""Internal-link graph analyzer.

Maps the storefront's existing internal-link graph from the audit pass,
finds: orphan pages (no incoming links), thin link clusters, and missing
links between related products / collections.
"""
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlparse

LINK_RE = re.compile(r'href=["\']([^"\']+)["\']', re.IGNORECASE)


def extract_internal_links(html: str, base_host: str) -> set[str]:
    out = set()
    for m in LINK_RE.finditer(html):
        href = m.group(1)
        if href.startswith("#") or href.startswith("mailto:") or href.startswith("tel:"):
            continue
        parsed = urlparse(href)
        host = parsed.netloc.replace("www.", "")
        if host and host != base_host:
            continue
        path = parsed.path.rstrip("/")
        if path:
            out.add(path)
    return out


def analyze(state_dir: Path, storefront_url: str) -> dict:
    """Walk audit.json, fetch each page's HTML, map links."""
    import urllib.request
    UA = {"User-Agent": "Mozilla/5.0 SEOGEO/1.0"}

    audit = json.loads((state_dir / "audit.json").read_text())
    base_host = urlparse(storefront_url).netloc.replace("www.", "")

    # We don't have raw HTML cached, so re-fetch a sample (top 50 pages)
    pages = audit.get("pages", [])[:50]
    graph = {}  # page → set of internal links
    for p in pages:
        url = p.get("url")
        if not url:
            continue
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=15) as r:
                body = r.read().decode("utf-8", errors="replace")
            graph[urlparse(url).path.rstrip("/")] = extract_internal_links(body, base_host)
        except Exception:
            graph[urlparse(url).path.rstrip("/")] = set()

    # Compute incoming counts
    incoming = Counter()
    for src, dests in graph.items():
        for d in dests:
            incoming[d] += 1

    # Find orphans: paths in graph (we crawled them) with 0 incoming
    orphans = [p for p in graph if incoming.get(p, 0) == 0 and p != ""]

    # Find link-poor pages: pages with <3 outgoing internal links
    link_poor = [(p, len(dests)) for p, dests in graph.items() if len(dests) < 3]

    # Suggest links: for each product page, find related products by tag overlap
    catalog = json.loads((state_dir / "catalog.json").read_text())
    by_tag = defaultdict(list)
    for prod in catalog["products"]:
        for tag in (prod.get("tags") or []):
            by_tag[tag].append(prod)

    suggestions = []
    for prod in catalog["products"][:30]:
        url_path = f"/products/{prod.get('handle', '')}"
        related = set()
        for tag in (prod.get("tags") or []):
            for other in by_tag.get(tag, []):
                if other["id"] != prod["id"]:
                    related.add(f"/products/{other.get('handle', '')}")
        # Suggest links not yet in this product's outgoing
        existing = graph.get(url_path, set())
        missing = related - existing
        if missing:
            suggestions.append({
                "from": url_path,
                "missing_related_links": sorted(missing)[:5],
                "existing_outgoing_count": len(existing),
            })

    out = {
        "pages_analyzed": len(graph),
        "orphans": orphans,
        "orphan_count": len(orphans),
        "link_poor_pages": sorted(link_poor, key=lambda x: x[1])[:20],
        "incoming_link_distribution": dict(Counter(incoming.values()).most_common()),
        "top_internally_linked": [(p, n) for p, n in incoming.most_common(15)],
        "missing_related_link_suggestions": suggestions[:20],
    }
    (state_dir / "internal_links.json").write_text(json.dumps(out, indent=2))
    return out


if __name__ == "__main__":
    import sys
    state = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "state" / "2026-05-08"
    storefront = sys.argv[2] if len(sys.argv) > 2 else "https://bdsmpub.com"
    r = analyze(state, storefront)
    print(json.dumps({k: v for k, v in r.items() if k != "missing_related_link_suggestions"}, indent=2))
    print(f"\nMissing related-link suggestions: {len(r['missing_related_link_suggestions'])} products")
