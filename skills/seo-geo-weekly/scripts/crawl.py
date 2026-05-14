"""Technical SEO crawler — sitemap walk + on-page checks."""
import http.cookiejar
import json
import re
import sys
import time
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser

UA = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

_jar = http.cookiejar.CookieJar()
_opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(_jar))


def fetch(url: str, timeout: int = 15, retries: int = 3) -> tuple[int, str, dict]:
    for attempt in range(retries):
        req = urllib.request.Request(url, headers=UA)
        try:
            with _opener.open(req, timeout=timeout) as r:
                return r.status, r.read().decode("utf-8", errors="replace"), dict(r.headers)
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries - 1:
                time.sleep(2 ** attempt)
                continue
            return e.code, "", {}
        except Exception:
            if attempt < retries - 1:
                time.sleep(1)
                continue
            return 0, "", {}
    return 0, "", {}


def parse_sitemap(url: str) -> list[str]:
    status, body, _ = fetch(url)
    if status != 200:
        return []
    urls = []
    try:
        root = ET.fromstring(body)
        ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        if root.tag.endswith("sitemapindex"):
            for sm in root.findall("sm:sitemap", ns):
                loc = sm.find("sm:loc", ns)
                if loc is not None and loc.text:
                    urls.extend(parse_sitemap(loc.text))
        else:
            for u in root.findall("sm:url", ns):
                loc = u.find("sm:loc", ns)
                if loc is not None and loc.text:
                    urls.append(loc.text)
    except ET.ParseError:
        pass
    return urls


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""
        self.meta_desc = ""
        self.meta_robots = ""
        self.canonical = ""
        self.h1s = []
        self.images_no_alt = 0
        self.images_total = 0
        self.json_ld = []
        self.in_title = False
        self.in_h1 = False
        self.in_script_jsonld = False
        self.script_buf = ""

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "title":
            self.in_title = True
        elif tag == "meta":
            n = (a.get("name") or "").lower()
            if n == "description":
                self.meta_desc = a.get("content", "")
            elif n == "robots":
                self.meta_robots = a.get("content", "")
        elif tag == "link" and (a.get("rel") or "").lower() == "canonical":
            self.canonical = a.get("href", "")
        elif tag == "h1":
            self.in_h1 = True
            self.h1s.append("")
        elif tag == "img":
            self.images_total += 1
            if not a.get("alt"):
                self.images_no_alt += 1
        elif tag == "script" and (a.get("type") or "").lower() == "application/ld+json":
            self.in_script_jsonld = True
            self.script_buf = ""

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        elif tag == "h1":
            self.in_h1 = False
        elif tag == "script" and self.in_script_jsonld:
            self.in_script_jsonld = False
            try:
                self.json_ld.append(json.loads(self.script_buf))
            except json.JSONDecodeError:
                pass

    def handle_data(self, data):
        if self.in_title:
            self.title += data
        elif self.in_h1 and self.h1s:
            self.h1s[-1] += data
        elif self.in_script_jsonld:
            self.script_buf += data


_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.DOTALL | re.IGNORECASE)
_META_RE = re.compile(r"<meta\s+([^>]+)>", re.IGNORECASE)
_H1_RE = re.compile(r"<h1\b[^>]*>(.*?)</h1>", re.DOTALL | re.IGNORECASE)
_LINK_RE = re.compile(r"<link\s+([^>]+)>", re.IGNORECASE)
_IMG_RE = re.compile(r"<img\s+([^>]+)>", re.IGNORECASE)
_JSONLD_RE = re.compile(
    r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
    re.DOTALL | re.IGNORECASE,
)
_TAG_RE = re.compile(r"<[^>]+>")


def _attr(s: str, name: str) -> str:
    m = re.search(rf'\b{name}\s*=\s*"([^"]*)"', s, re.IGNORECASE)
    if m:
        return m.group(1)
    m = re.search(rf"\b{name}\s*=\s*'([^']*)'", s, re.IGNORECASE)
    return m.group(1) if m else ""


def _strip_tags(s: str) -> str:
    return _TAG_RE.sub("", s).strip()


def audit_page(url: str) -> dict:
    status, body, headers = fetch(url)
    out = {"url": url, "status": status, "size": len(body)}
    if status != 200 or not body:
        return out

    # Title
    tm = _TITLE_RE.search(body)
    title = _strip_tags(tm.group(1)) if tm else ""

    # Meta tags
    meta_desc = ""
    meta_robots = ""
    for m in _META_RE.finditer(body):
        attrs = m.group(1)
        name = (_attr(attrs, "name") or _attr(attrs, "property")).lower()
        content = _attr(attrs, "content")
        if name == "description" and not meta_desc:
            meta_desc = content
        elif name == "robots" and not meta_robots:
            meta_robots = content

    # Canonical
    canonical = ""
    for m in _LINK_RE.finditer(body):
        attrs = m.group(1)
        if _attr(attrs, "rel").lower() == "canonical":
            canonical = _attr(attrs, "href")
            break

    # H1s
    h1s = [_strip_tags(h) for h in _H1_RE.findall(body)]
    h1s = [h for h in h1s if h]

    # Images
    imgs = list(_IMG_RE.finditer(body))
    images_total = len(imgs)
    images_no_alt = sum(1 for m in imgs if not _attr(m.group(1), "alt"))

    # JSON-LD
    json_ld_types = []
    for m in _JSONLD_RE.finditer(body):
        try:
            obj = json.loads(m.group(1).strip())
            if isinstance(obj, list):
                for item in obj:
                    if isinstance(item, dict):
                        t = item.get("@type")
                        if t:
                            json_ld_types.append(t if isinstance(t, str) else str(t))
            elif isinstance(obj, dict):
                t = obj.get("@type")
                if t:
                    json_ld_types.append(t if isinstance(t, str) else str(t))
                # @graph nodes
                for g in obj.get("@graph", []) or []:
                    if isinstance(g, dict) and g.get("@type"):
                        json_ld_types.append(g["@type"] if isinstance(g["@type"], str) else str(g["@type"]))
        except Exception:
            continue

    out.update({
        "title": title[:200],
        "title_len": len(title),
        "meta_description": meta_desc[:300],
        "meta_description_len": len(meta_desc),
        "meta_robots": meta_robots,
        "canonical": canonical,
        "h1_count": len(h1s),
        "h1_first": (h1s[0] if h1s else "")[:200],
        "images_total": images_total,
        "images_no_alt": images_no_alt,
        "json_ld_types": json_ld_types,
    })
    return out


def crawl(storefront_url: str, max_pages: int = 100) -> dict:
    sitemap_url = storefront_url.rstrip("/") + "/sitemap.xml"
    urls = parse_sitemap(sitemap_url)[:max_pages]
    results = []
    with ThreadPoolExecutor(max_workers=3) as ex:
        futures = {ex.submit(audit_page, u): u for u in urls}
        for f in as_completed(futures):
            results.append(f.result())

    # robots.txt
    robots_status, robots_body, _ = fetch(storefront_url.rstrip("/") + "/robots.txt")
    llms_status, llms_body, _ = fetch(storefront_url.rstrip("/") + "/llms.txt")

    # Aggregate
    issues = {
        "missing_title": [r["url"] for r in results if not r.get("title")],
        "title_too_short": [r["url"] for r in results if 0 < r.get("title_len", 0) < 30],
        "title_too_long": [r["url"] for r in results if r.get("title_len", 0) > 60],
        "missing_meta_desc": [r["url"] for r in results if not r.get("meta_description")],
        "missing_h1": [r["url"] for r in results if r.get("h1_count", 0) == 0],
        "multiple_h1": [r["url"] for r in results if r.get("h1_count", 0) > 1],
        "broken": [r["url"] for r in results if r.get("status", 0) >= 400 or r.get("status") == 0],
        "alt_text_missing": [
            r["url"] for r in results if r.get("images_no_alt", 0) > 0
        ],
        "no_jsonld": [r["url"] for r in results if not r.get("json_ld_types")],
    }
    return {
        "sitemap_url": sitemap_url,
        "pages_crawled": len(results),
        "robots_present": robots_status == 200,
        "robots_body_len": len(robots_body),
        "llms_txt_present": llms_status == 200,
        "issues": issues,
        "pages": results,
    }


if __name__ == "__main__":
    storefront = sys.argv[1]
    print(json.dumps(crawl(storefront), indent=2))
