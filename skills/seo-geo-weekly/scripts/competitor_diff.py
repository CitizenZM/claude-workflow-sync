"""Competitor new-page diff: snapshot competitor sitemaps WoW, surface new content."""
import json
import re
import time
import urllib.request
from pathlib import Path

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"}


def _fetch(url: str, timeout: int = 30) -> tuple[int, str]:
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", errors="replace")
    except Exception:
        return 0, ""


def _all_urls(domain: str, max_children: int = 8, max_urls: int = 5000) -> list[str]:
    """Crawl sitemap.xml and child sitemaps, return URL list."""
    status, body = _fetch(f"https://{domain}/sitemap.xml")
    if status != 200:
        return []
    urls = []
    if "<sitemapindex" in body:
        children = re.findall(r"<loc>([^<]+)</loc>", body)[:max_children]
        for c in children:
            s2, b2 = _fetch(c, 25)
            if s2 == 200:
                urls.extend(re.findall(r"<loc>([^<]+)</loc>", b2))
            time.sleep(0.5)
            if len(urls) > max_urls:
                break
    else:
        urls = re.findall(r"<loc>([^<]+)</loc>", body)
    return urls[:max_urls]


def snapshot(domain: str, state_dir: Path) -> dict:
    """Fetch URLs for one competitor and save."""
    urls = _all_urls(domain)
    snap_dir = state_dir / "competitor_sitemaps"
    snap_dir.mkdir(parents=True, exist_ok=True)
    fname = domain.replace(".", "_") + ".json"
    (snap_dir / fname).write_text(json.dumps({"domain": domain, "count": len(urls), "urls": urls}, indent=2))
    return {"domain": domain, "count": len(urls)}


def diff(domain: str, state_dir: Path) -> dict:
    """Diff this week's snapshot against the most recent prior."""
    fname = domain.replace(".", "_") + ".json"
    today = state_dir / "competitor_sitemaps" / fname
    if not today.exists():
        return {"domain": domain, "error": "no current snapshot"}

    today_data = json.loads(today.read_text())
    today_urls = set(today_data.get("urls", []))

    # find most recent prior
    parent = state_dir.parent
    prior_data = None
    for d in sorted([p for p in parent.iterdir() if p.is_dir() and p.name < state_dir.name], reverse=True):
        prior_file = d / "competitor_sitemaps" / fname
        if prior_file.exists():
            prior_data = json.loads(prior_file.read_text())
            break

    if not prior_data:
        return {
            "domain": domain,
            "current_count": len(today_urls),
            "new_urls": [],
            "removed_urls": [],
            "note": "no prior snapshot — first run",
        }

    prior_urls = set(prior_data.get("urls", []))
    new = sorted(today_urls - prior_urls)
    removed = sorted(prior_urls - today_urls)

    return {
        "domain": domain,
        "current_count": len(today_urls),
        "prior_count": len(prior_urls),
        "delta": len(today_urls) - len(prior_urls),
        "new_urls": new[:50],
        "new_urls_count": len(new),
        "removed_urls": removed[:50],
        "removed_urls_count": len(removed),
    }


def run(competitors: list[str], state_dir: Path) -> dict:
    out = {"snapshots": [], "diffs": []}
    for d in competitors:
        print(f"      [comp-diff] {d}")
        try:
            out["snapshots"].append(snapshot(d, state_dir))
        except Exception as e:
            out["snapshots"].append({"domain": d, "error": str(e)[:200]})
        time.sleep(2)

    for d in competitors:
        try:
            out["diffs"].append(diff(d, state_dir))
        except Exception as e:
            out["diffs"].append({"domain": d, "error": str(e)[:200]})

    (state_dir / "competitor_diff.json").write_text(json.dumps(out, indent=2))
    return out


if __name__ == "__main__":
    import sys
    state_dir = Path(sys.argv[1])
    state_dir.mkdir(parents=True, exist_ok=True)
    print(json.dumps(run(sys.argv[2].split(","), state_dir), indent=2))
