"""SERP rank tracker via DuckDuckGo HTML (Google blocks scraping aggressively).

For each keyword, finds where the brand domain appears in the top 30 organic
results. Also captures top 5 competitor URLs per query. WoW position deltas
computed from prior week's snapshot in `state/`.

DuckDuckGo's HTML interface is deliberately scrapable (their public position).
"""
import json
import re
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

UA = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml",
}

# DDG HTML returns serps in <a class="result__a"> elements
RESULT_RE = re.compile(
    r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
    re.DOTALL | re.IGNORECASE,
)


def search(query: str, max_results: int = 30) -> list[dict]:
    url = "https://html.duckduckgo.com/html/?q=" + urllib.parse.quote(query)
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            body = r.read().decode("utf-8", errors="replace")
    except Exception as e:
        return [{"error": str(e)[:100]}]

    results = []
    for i, m in enumerate(RESULT_RE.finditer(body), 1):
        if i > max_results:
            break
        href = m.group(1)
        # DDG wraps with /l/?uddg=...
        if "uddg=" in href:
            try:
                qs = urllib.parse.parse_qs(urllib.parse.urlparse(href).query)
                href = qs.get("uddg", [href])[0]
            except Exception:
                pass
        title = re.sub(r"<[^>]+>", "", m.group(2)).strip()
        domain = urllib.parse.urlparse(href).netloc.lower().replace("www.", "")
        results.append({"position": i, "url": href, "domain": domain, "title": title})
    return results


def rank_for(query: str, target_domain: str, competitors: list[str]) -> dict:
    target_domain = target_domain.lower().replace("www.", "")
    competitors_norm = [c.lower().replace("www.", "") for c in competitors]
    results = search(query)
    if results and "error" in results[0]:
        return {"query": query, "error": results[0]["error"]}

    target_pos = next(
        (r["position"] for r in results if r["domain"].endswith(target_domain)),
        None,
    )
    competitor_positions = {
        c: next((r["position"] for r in results if r["domain"].endswith(c)), None)
        for c in competitors_norm
    }
    return {
        "query": query,
        "target_domain": target_domain,
        "target_position": target_pos,
        "competitor_positions": competitor_positions,
        "top10_domains": [r["domain"] for r in results[:10]],
        "checked_n": len(results),
    }


def track(keywords: list[str], target_domain: str, competitors: list[str], state_dir: Path) -> dict:
    """Run rank checks (sequential to avoid DDG rate-limits)."""
    out = {"checked_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"), "rankings": []}
    for kw in keywords:
        print(f"      [serp] {kw}")
        out["rankings"].append(rank_for(kw, target_domain, competitors))
        time.sleep(2)  # polite delay

    # WoW deltas vs last week's snapshot
    prior = _find_prior(state_dir)
    if prior:
        prior_data = json.loads(prior.read_text())
        prior_map = {r["query"]: r.get("target_position") for r in prior_data.get("rankings", [])}
        for r in out["rankings"]:
            r["prior_position"] = prior_map.get(r["query"])
            cur = r.get("target_position")
            pri = r["prior_position"]
            r["delta"] = (
                None if cur is None or pri is None else pri - cur  # positive = improved
            )

    return out


def _find_prior(state_dir: Path):
    """Find most recent serp.json before the current state_dir."""
    parent = state_dir.parent
    if not parent.exists():
        return None
    others = sorted(
        [p for p in parent.iterdir() if p.is_dir() and p.name < state_dir.name],
        reverse=True,
    )
    for d in others:
        f = d / "serp.json"
        if f.exists():
            return f
    return None


def summary(serp_data: dict) -> dict:
    rankings = serp_data.get("rankings", [])
    ranked = [r for r in rankings if r.get("target_position")]
    return {
        "total_keywords": len(rankings),
        "keywords_ranked_top30": len(ranked),
        "keywords_top10": sum(1 for r in ranked if r["target_position"] <= 10),
        "keywords_top3": sum(1 for r in ranked if r["target_position"] <= 3),
        "avg_position": (
            round(sum(r["target_position"] for r in ranked) / len(ranked), 1)
            if ranked else None
        ),
        "improved_wow": sum(1 for r in rankings if (r.get("delta") or 0) > 0),
        "declined_wow": sum(1 for r in rankings if (r.get("delta") or 0) < 0),
    }


if __name__ == "__main__":
    import sys
    from pathlib import Path
    kw = sys.argv[1] if len(sys.argv) > 1 else "luxury BDSM kit"
    print(json.dumps(rank_for(kw, "bdsmpub.com", ["lovehoney.com", "stockroom.com"]), indent=2))
