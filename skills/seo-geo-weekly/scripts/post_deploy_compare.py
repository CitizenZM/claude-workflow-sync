"""Post-deploy comparison: read pre-deploy state vs post-deploy state, write deltas."""
import json
import datetime as dt
from pathlib import Path

PRE = Path("/Users/xiaozuo/.claude/skills/seo-geo-weekly/state/2026-05-08")
WORKLOG = Path("/Users/xiaozuo/Documents/Obsidian/01-Projects/Dark-Fantasy-SEO-GEO-Weekly/Worklog.md")


def load(p, default):
    return json.loads(p.read_text()) if p.exists() else default


def main(post_dir: Path):
    pre_audit = load(PRE / "audit.json", {})
    post_audit = load(post_dir / "audit.json", {})
    pre_lh = load(PRE / "lighthouse.json", [])
    post_lh = load(post_dir / "lighthouse.json", [])
    pre_geo = load(PRE / "geo_deep.json", {})
    post_geo = load(post_dir / "geo_deep.json", {})

    def issue_count(a, k):
        return len((a.get("issues") or {}).get(k, []))

    rows = []
    for k in ["title_too_long", "multiple_h1", "missing_meta_desc", "missing_title", "broken", "alt_text_missing", "no_jsonld"]:
        pre = issue_count(pre_audit, k)
        post = issue_count(post_audit, k)
        delta = post - pre
        sign = "✓" if delta < 0 else ("⚠" if delta > 0 else "—")
        rows.append((sign, k, pre, post, delta))

    pre_perf = (pre_lh[0] if pre_lh else {}).get("scores", {}).get("performance")
    post_perf = (post_lh[0] if post_lh else {}).get("scores", {}).get("performance")
    pre_lcp = (pre_lh[0] if pre_lh else {}).get("vitals", {}).get("lcp")
    post_lcp = (post_lh[0] if post_lh else {}).get("vitals", {}).get("lcp")

    pre_geo_avg = (pre_geo.get("aggregate") or {}).get("avg_citation_rate")
    post_geo_avg = (post_geo.get("aggregate") or {}).get("avg_citation_rate")

    md = ["# Post-Deploy Comparison", "", f"Generated: {dt.datetime.now(dt.UTC).isoformat()}", "", "## On-page issue deltas", "", "| | Issue | Pre | Post | Δ |", "|--|---|---:|---:|---:|"]
    for sign, k, pre, post, delta in rows:
        md.append(f"| {sign} | {k} | {pre} | {post} | {delta:+d} |")
    md += ["", "## Lighthouse (mobile homepage)", "",
           f"- Performance: {pre_perf} → {post_perf}",
           f"- LCP: {pre_lcp} → {post_lcp}",
           "", "## GEO citation rate (avg)",
           f"- Pre: {pre_geo_avg}%  Post: {post_geo_avg}%",
           ""]
    out = post_dir / "post_deploy_compare.md"
    out.write_text("\n".join(md))
    print(f"wrote {out}")
    return out


if __name__ == "__main__":
    import sys
    post_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else PRE  # default re-uses same dir for in-place re-audit
    main(post_dir)
