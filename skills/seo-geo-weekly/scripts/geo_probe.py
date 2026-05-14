"""GEO probe — query generative engines and track citations.

Engines:
- gemini  : direct Gemini API
- openai  : ChatGPT via API
- claude  : skip (in-conversation use)
- perplexity : skip (no free API)

Cost-conscious: gemini-2.5-flash + gpt-4o-mini.
"""
import json
import os
import re
import time
import urllib.request

GEMINI_KEY_PATH = os.path.expanduser("~/.claude/credentials.json")


def _load_keys() -> dict:
    with open(GEMINI_KEY_PATH) as f:
        return json.load(f).get("api_keys", {})


def gemini_query(prompt: str, key: str, model: str = "gemini-2.5-flash") -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "tools": [{"google_search": {}}],  # let Gemini cite sources
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 1024},
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


def openai_query(prompt: str, key: str, model: str = "gpt-4o-mini") -> str:
    url = "https://api.openai.com/v1/chat/completions"
    body = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3,
        "max_tokens": 1024,
    }
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        d = json.loads(r.read().decode())
    return d["choices"][0]["message"]["content"]


def cited(text: str, brand_terms: list[str], competitor_domains: list[str]) -> dict:
    text_lc = text.lower()
    brand_hits = [t for t in brand_terms if t.lower() in text_lc]
    comp_hits = [c for c in competitor_domains if c.lower() in text_lc]
    # crude position: where in text the brand appears
    pos = -1
    if brand_hits:
        first = min((text_lc.find(b.lower()) for b in brand_hits if text_lc.find(b.lower()) >= 0), default=-1)
        # rank = which mention number is the brand among bullet items
        bullets = re.findall(r"(?:^|\n)\s*[-*\d]+[.)]\s+(.+)", text)
        for i, b in enumerate(bullets, 1):
            if any(t.lower() in b.lower() for t in brand_terms):
                pos = i
                break
    return {
        "brand_cited": bool(brand_hits),
        "brand_terms_matched": brand_hits,
        "brand_position_in_list": pos,
        "competitors_cited": comp_hits,
    }


def probe(prompts: list[str], brand_terms: list[str], competitors: list[str]) -> dict:
    keys = _load_keys()
    results = {"gemini": [], "openai": []}

    for p in prompts:
        if keys.get("gemini"):
            try:
                ans = gemini_query(p, keys["gemini"])
                results["gemini"].append({"prompt": p, "answer": ans, "citations": cited(ans, brand_terms, competitors)})
                time.sleep(1)
            except Exception as e:
                results["gemini"].append({"prompt": p, "error": str(e)[:200]})
        if keys.get("openai"):
            try:
                ans = openai_query(p, keys["openai"])
                results["openai"].append({"prompt": p, "answer": ans, "citations": cited(ans, brand_terms, competitors)})
                time.sleep(1)
            except Exception as e:
                results["openai"].append({"prompt": p, "error": str(e)[:200]})

    summary = {}
    for engine, runs in results.items():
        valid = [r for r in runs if "citations" in r]
        if not valid:
            summary[engine] = {"n": 0}
            continue
        summary[engine] = {
            "n": len(valid),
            "brand_cited_pct": round(100 * sum(1 for r in valid if r["citations"]["brand_cited"]) / len(valid), 1),
            "competitor_cited_total": sum(len(r["citations"]["competitors_cited"]) for r in valid),
            "avg_brand_position": (lambda ps: round(sum(ps)/len(ps), 1) if ps else None)(
                [r["citations"]["brand_position_in_list"] for r in valid if r["citations"]["brand_position_in_list"] > 0]
            ),
        }

    return {"summary": summary, "details": results}


if __name__ == "__main__":
    import sys
    prompts = [
        "What are the best brands for premium adult intimate wellness products in 2026?",
        "Where can I buy luxury bondage gear and BDSM kits online?",
        "What's a good beginner BDSM kit for couples?",
    ]
    brands = ["Dark Fantasy", "bdsmpub.com", "bdsmpub"]
    competitors = ["lovehoney", "ellaparadis", "extremerestraints"]
    print(json.dumps(probe(prompts, brands, competitors), indent=2))
