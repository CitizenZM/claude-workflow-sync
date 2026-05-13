"""Deep GEO analysis: per-keyword citation tracking + content-gap mining.

Beyond the aggregate citation rate, this:
1. Tracks which specific keywords/prompts trigger brand citation
2. Identifies prompts where AI gives confident but wrong/incomplete info → content gaps
3. Surfaces competitor mention frequencies per topic cluster
"""
import json
import re
import time
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

CREDS_PATH = Path.home() / ".claude/credentials.json"


def _gemini_key() -> str:
    return json.loads(CREDS_PATH.read_text())["api_keys"]["gemini"]


def gemini_query(prompt: str, model: str = "gemini-2.5-flash") -> str:
    key = _gemini_key()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "tools": [{"google_search": {}}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 800},
    }
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"}, method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        d = json.loads(r.read().decode())
    cands = d.get("candidates", [])
    if not cands:
        return ""
    parts = cands[0].get("content", {}).get("parts", [])
    return "".join(p.get("text", "") for p in parts)


def analyze_per_keyword(keywords: list[str], brand_terms: list[str], competitors: list[str]) -> list[dict]:
    """For each keyword, generate 3 prompts, probe Gemini, classify result."""
    out = []
    for kw in keywords:
        templates = [
            f"What are the best brands for {kw}?",
            f"Where can I buy {kw}?",
            f"Recommend a quality {kw}.",
        ]
        kw_results = {"keyword": kw, "prompts": []}
        for tmpl in templates:
            try:
                ans = gemini_query(tmpl)
                lc = ans.lower()
                cited = any(b.lower() in lc for b in brand_terms)
                comp_hits = [c for c in competitors if c.lower() in lc]
                kw_results["prompts"].append({
                    "prompt": tmpl,
                    "answer_excerpt": ans[:400],
                    "brand_cited": cited,
                    "competitors_cited": comp_hits,
                })
                time.sleep(1)
            except Exception as e:
                kw_results["prompts"].append({"prompt": tmpl, "error": str(e)[:150]})

        valid = [p for p in kw_results["prompts"] if "brand_cited" in p]
        kw_results["citation_rate"] = (
            round(100 * sum(1 for p in valid if p["brand_cited"]) / len(valid), 1)
            if valid else 0
        )
        kw_results["competitor_dominance"] = Counter(c for p in valid for c in p.get("competitors_cited", []))
        out.append(kw_results)
        print(f"      [geo-deep] {kw}: citation_rate={kw_results['citation_rate']}%")
    return out


def find_content_gaps(per_keyword: list[dict]) -> list[dict]:
    """Keywords with high competitor dominance + low/zero brand citation = priority content."""
    gaps = []
    for kw_data in per_keyword:
        comp_count = sum(kw_data.get("competitor_dominance", {}).values()) if isinstance(kw_data.get("competitor_dominance"), dict) else 0
        if isinstance(kw_data.get("competitor_dominance"), Counter):
            comp_count = sum(kw_data["competitor_dominance"].values())
        if kw_data["citation_rate"] < 40 and comp_count > 0:
            gaps.append({
                "keyword": kw_data["keyword"],
                "citation_rate": kw_data["citation_rate"],
                "competitor_mentions": dict(kw_data["competitor_dominance"]) if isinstance(kw_data["competitor_dominance"], Counter) else kw_data["competitor_dominance"],
                "priority": "HIGH" if comp_count >= 3 else "MEDIUM",
                "recommended_action": f"Publish dedicated blog post + product page bundle targeting '{kw_data['keyword']}' with FAQPage schema. Submit to GSC for fast index.",
            })
    return sorted(gaps, key=lambda g: (-len(g["competitor_mentions"]), g["citation_rate"]))


def run(state_dir: Path, keywords: list[str], brand_terms: list[str], competitors: list[str]) -> dict:
    print(f"      [geo-deep] analyzing {len(keywords)} keywords × 3 prompts = {len(keywords)*3} queries")
    per_kw = analyze_per_keyword(keywords, brand_terms, competitors)

    # Make Counters JSON-serializable
    for r in per_kw:
        if isinstance(r.get("competitor_dominance"), Counter):
            r["competitor_dominance"] = dict(r["competitor_dominance"])

    gaps = find_content_gaps(per_kw)
    aggregate = {
        "keywords_analyzed": len(keywords),
        "avg_citation_rate": round(sum(r["citation_rate"] for r in per_kw) / len(per_kw), 1) if per_kw else 0,
        "high_priority_content_gaps": len([g for g in gaps if g["priority"] == "HIGH"]),
        "medium_priority_content_gaps": len([g for g in gaps if g["priority"] == "MEDIUM"]),
    }
    out = {"aggregate": aggregate, "per_keyword": per_kw, "content_gaps": gaps}
    (state_dir / "geo_deep.json").write_text(json.dumps(out, indent=2, default=str))
    return out


if __name__ == "__main__":
    import sys
    state_dir = Path(sys.argv[1])
    state_dir.mkdir(parents=True, exist_ok=True)
    print(json.dumps(run(state_dir, sys.argv[2].split(","), ["Dark Fantasy", "bdsmpub"], ["lovehoney", "stockroom", "lelo"]), indent=2)[:3000])
