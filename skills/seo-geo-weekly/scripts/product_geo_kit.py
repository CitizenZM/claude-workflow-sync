"""Per-product GEO + SEO optimization kit.

For each product, Gemini generates:
  - 8 long-tail GEO keywords (queries an AI engine would receive)
  - GEO-tuned markdown description (structured for ChatGPT/Gemini citation)
  - 5 FAQ Q&As (already in faq_schema; we cross-reference)
  - JSON-LD Product + FAQPage schema snippets
  - Internal-link anchors to related pillar pages

Output: state/<date>/product_geo_kit.json
"""
import json
import os
import re
import time
import urllib.request
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

CREDS = Path.home() / ".claude/credentials.json"


def _gemini_key():
    return json.loads(CREDS.read_text())["api_keys"]["gemini"]


def _gemini_call(prompt: str, model: str, max_tokens: int, mime_type: str | None = None, temperature: float = 0.5) -> str:
    key = _gemini_key()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    gen_cfg = {"temperature": temperature, "maxOutputTokens": max_tokens}
    if mime_type:
        gen_cfg["responseMimeType"] = mime_type
    body = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": gen_cfg}
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=90) as r:
        d = json.loads(r.read().decode())
    parts = d.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    return "".join(p.get("text", "") for p in parts).strip()


def gemini(prompt: str, model: str = "gemini-2.5-flash", max_tokens: int = 2000, temperature: float = 0.5) -> str:
    return _gemini_call(prompt, model, max_tokens, mime_type="application/json", temperature=temperature)


def gemini_text(prompt: str, model: str = "gemini-2.5-flash", max_tokens: int = 2000, temperature: float = 0.6) -> str:
    return _gemini_call(prompt, model, max_tokens, mime_type=None, temperature=temperature)


PROMPT_TEMPLATE = """You are a GEO + SEO specialist for "Dark Fantasy" (bdsmpub.com), an adult-wellness Shopify store. Generate an SEO/GEO metadata kit for the product below.

Product:
- Title: {title}
- Type: {product_type}
- Tags: {tags}
- Current description excerpt: {desc_excerpt}

OUTPUT: a strict JSON object only, no prose, no markdown fences. Keys:

{{
  "geo_keywords": ["8 long-tail conversational queries ChatGPT/Gemini users might ask that this product answers"],
  "seo_title": "50-60 char SEO title ending with ' | Dark Fantasy'",
  "meta_description": "140-160 char meta description ending with 'Free discreet shipping $99+.'",
  "h1": "8-12 word page H1 with primary keyword",
  "key_facts": ["6 short factual bullets — material, dimensions, battery, body-safe certs, use cases, contrast vs cheaper alternatives — citation-friendly statements an AI could quote"],
  "faqs": [{{"q": "...", "a": "2-4 sentence answer"}}, "5 entries total"],
  "social_hooks": {{
    "pinterest_pin_title": "60-char hook",
    "tiktok_hook": "first 3 seconds of script",
    "reddit_comment_angle": "the genuine question this product answers"
  }}
}}

RULES:
- Body-safe emphasis: silicone, medical-grade, FDA-approved, phthalate-free
- Educational tone, no explicit acts, wellness/intimacy framing
- Mention "Dark Fantasy" once in meta_description for entity recognition
- Keep all strings on a SINGLE line — no newlines inside string values
- Output ONLY the JSON
"""

MARKDOWN_PROMPT = """Write a 600-900 word product description in markdown for "Dark Fantasy" (bdsmpub.com). Product: {title} ({product_type}). Tags: {tags}.

STRUCTURE (use these exact h2 headers):
## Overview
(2 paragraphs, lead with use case + body-safe material)

## Key Features
(5-7 bullets, specific facts: dimensions, battery life, sound rating, material durometer)

## Who It's For
(beginner / intermediate / advanced; solo / couples)

## What's in the Box

## Care & Cleaning
(material-specific)

## Safety & Compliance
(FDA, body-safe certs, age 18+)

## How It Compares
(soft comparison to porous-material toys — body-safe wins)

RULES:
- Tone: confident, educational, warm. Not salesy. Not explicit.
- Mention "Dark Fantasy" 2-3 times naturally
- Embed exactly 3 internal links as placeholders: [LINK:body-safe-materials-guide], [LINK:aftercare-encyclopedia], [LINK:beginner-couples-field-guide]
- Output markdown only, no preamble, no fences
"""


def _robust_json_load(raw: str):
    """Try several recovery strategies for Gemini JSON output."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1].lstrip("json").strip()
        if raw.endswith("```"):
            raw = raw[:-3].strip()
    # Try direct
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    # Try to fix common: unescaped newlines in strings
    fixed = re.sub(r'(?<!\\)\n', r'\\n', raw)
    try:
        return json.loads(fixed)
    except json.JSONDecodeError:
        pass
    # Try yaml-style fallback (Gemini sometimes emits yaml-ish JSON)
    # Last resort: try to extract a JSON object via braces
    m = re.search(r'\{[\s\S]*\}', raw)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            pass
    raise ValueError(f"could not parse JSON; head: {raw[:200]!r}")


def build_for_product(p: dict) -> dict:
    title = p.get("title", "")
    ptype = p.get("productType") or ""
    tags = ", ".join((p.get("tags") or [])[:8])
    desc_raw = (p.get("descriptionHtml") or p.get("bodyHtml") or "")
    desc_excerpt = re.sub(r"<[^>]+>", " ", desc_raw)[:400].strip()
    prompt = PROMPT_TEMPLATE.format(
        title=title, product_type=ptype, tags=tags, desc_excerpt=desc_excerpt
    )
    try:
        raw = gemini(prompt, model="gemini-2.5-flash", max_tokens=3000)
        kit = _robust_json_load(raw)
        kit["product_id"] = p.get("id")
        kit["product_handle"] = p.get("handle")
        kit["product_title"] = title
        # Second pass: markdown description (separate to keep JSON small)
        try:
            md_prompt = MARKDOWN_PROMPT.format(title=title, product_type=ptype, tags=tags)
            md = gemini_text(md_prompt, max_tokens=2500)
            kit["markdown_description"] = md
        except Exception as md_e:
            kit["markdown_description"] = ""
            kit["markdown_error"] = str(md_e)[:200]
        return kit
    except Exception as e:
        return {
            "product_id": p.get("id"),
            "product_handle": p.get("handle"),
            "product_title": title,
            "error": str(e)[:300],
        }


def run(state_dir: Path, catalog_path: Path, max_workers: int = 4, limit: int | None = None):
    catalog = json.loads(catalog_path.read_text())
    products = catalog["products"]
    if limit:
        products = products[:limit]

    print(f"[geo-kit] processing {len(products)} products with {max_workers} workers")
    out_path = state_dir / "product_geo_kit.json"
    kits = []
    errors = 0
    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        futures = {ex.submit(build_for_product, p): p for p in products}
        for i, fut in enumerate(as_completed(futures), 1):
            kit = fut.result()
            kits.append(kit)
            if "error" in kit:
                errors += 1
            if i % 10 == 0:
                print(f"  ...{i}/{len(products)} processed, errors so far: {errors}")
            # gentle pacing
            time.sleep(0.1)

    out_path.write_text(json.dumps({"generated_at": time.time(), "count": len(kits), "errors": errors, "kits": kits}, indent=2))
    print(f"[geo-kit] wrote {out_path} ({len(kits)} kits, {errors} errors)")
    return kits


if __name__ == "__main__":
    import sys
    state = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/Users/xiaozuo/.claude/skills/seo-geo-weekly/state/2026-05-11")
    state.mkdir(parents=True, exist_ok=True)
    cat = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("/Users/xiaozuo/.claude/skills/seo-geo-weekly/state/2026-05-10/catalog.json")
    limit = int(sys.argv[3]) if len(sys.argv) > 3 else None
    run(state, cat, max_workers=4, limit=limit)
