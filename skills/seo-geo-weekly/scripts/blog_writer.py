"""Generate publication-ready blog drafts via Gemini 2.5 Pro.

Saves drafts as Markdown files in `drafts/<isodate>/` AND as Obsidian
notes in `Dark-Fantasy-SEO-GEO-Weekly/Drafts/`. Each draft includes
front-matter with target keywords, meta description, schema hints, and
an "Apply checklist" for manual Shopify Article publication.
"""
import datetime as dt
import json
import re
import time
import urllib.request
from pathlib import Path

CREDS_PATH = Path.home() / ".claude/credentials.json"


def _gemini_key() -> str:
    return json.loads(CREDS_PATH.read_text())["api_keys"]["gemini"]


def gemini(prompt: str, model: str = "gemini-2.5-pro", max_tokens: int = 4000) -> str:
    """Use Pro for higher-quality long-form content."""
    key = _gemini_key()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": max_tokens},
    }
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"}, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            d = json.loads(r.read().decode())
    except Exception as e:
        # Fall back to Flash if Pro errors / quota
        return gemini_flash(prompt, max_tokens=max_tokens)
    cands = d.get("candidates", [])
    if not cands:
        return ""
    parts = cands[0].get("content", {}).get("parts", [])
    return "".join(p.get("text", "") for p in parts).strip()


def gemini_flash(prompt: str, max_tokens: int = 4000) -> str:
    key = _gemini_key()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}"
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": max_tokens},
    }
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"}, method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        d = json.loads(r.read().decode())
    cands = d.get("candidates", [])
    if not cands:
        return ""
    parts = cands[0].get("content", {}).get("parts", [])
    return "".join(p.get("text", "") for p in parts).strip()


# Topic queue: 12 posts spanning buying guides, comparisons, care, FAQ depth.
# Each: title, target_kw, intent, schema_hint, internal_link_targets
TOPICS = [
    {
        "title": "How to Choose Your First Wand Vibrator: Comfort, Power, and Body-Safe Materials Compared",
        "kw": "best wand vibrator beginner",
        "intent": "buying-guide",
        "schema": ["Article", "FAQPage"],
        "internal_links": ["/collections/for-her", "/products/lush-4-wearable-vibrator"],
        "words": 1500,
    },
    {
        "title": "BDSM Beginner Kit Checklist for Couples: A 2026 Body-Safe Buying Guide",
        "kw": "beginner BDSM kit for couples",
        "intent": "buying-guide",
        "schema": ["Article", "FAQPage", "HowTo"],
        "internal_links": ["/collections/for-couples", "/products/bdsm-bondage-kit-11-piece-complete-beginner-set"],
        "words": 1700,
    },
    {
        "title": "Body-Safe Materials Explained: Silicone, Real Leather, and Medical-Grade Steel for Intimate Gear",
        "kw": "body-safe bondage gear",
        "intent": "educational",
        "schema": ["Article", "FAQPage"],
        "internal_links": ["/collections/best-sellers", "/pages/about"],
        "words": 1400,
    },
    {
        "title": "Lush 4 vs We-Vibe Jive: Which Wearable Vibrator Wins for Couples in 2026?",
        "kw": "Lush 4 vs We-Vibe Jive",
        "intent": "comparison",
        "schema": ["Article", "Review"],
        "internal_links": ["/products/lush-4-wearable-vibrator", "/collections/long-distance"],
        "words": 1300,
    },
    {
        "title": "How to Clean and Store Silicone Toys: A Lifespan Checklist Every Owner Needs",
        "kw": "how to clean silicone toys",
        "intent": "care-guide",
        "schema": ["HowTo", "FAQPage"],
        "internal_links": ["/collections/best-sellers", "/pages/product-care"],
        "words": 1100,
    },
    {
        "title": "Aftercare 101 for BDSM Scenes: What Every Couple Should Know",
        "kw": "BDSM aftercare for couples",
        "intent": "educational",
        "schema": ["Article", "HowTo"],
        "internal_links": ["/collections/for-couples", "/pages/beginners-guide"],
        "words": 1500,
    },
    {
        "title": "Shibari Rope 101: Choosing Jute, Hemp, or Cotton for Your First Tie",
        "kw": "shibari rope kit beginner",
        "intent": "buying-guide",
        "schema": ["Article", "HowTo"],
        "internal_links": ["/products/japanese-jute-shibari-rope-8m"],
        "words": 1600,
    },
    {
        "title": "Spreader Bars Compared: Adjustable vs Fixed, Padded vs Steel — Which is Right?",
        "kw": "spreader bar cuffs",
        "intent": "comparison",
        "schema": ["Article", "FAQPage"],
        "internal_links": ["/products/adjustable-metal-spreader-bar-cuffs"],
        "words": 1200,
    },
    {
        "title": "Long-Distance Intimacy: How App-Controlled Toys Reconnect Couples",
        "kw": "remote control couples vibrator long distance",
        "intent": "category",
        "schema": ["Article"],
        "internal_links": ["/collections/long-distance", "/products/remote-control-vibrating-couples-ring-rechargeable"],
        "words": 1400,
    },
    {
        "title": "Kegel Ball Training: A 6-Week Progressive Plan for First-Timers",
        "kw": "kegel ball training set beginner",
        "intent": "how-to",
        "schema": ["HowTo", "FAQPage"],
        "internal_links": ["/products/kegel-exercise-system-6-piece-progressive-training-kit"],
        "words": 1500,
    },
    {
        "title": "Discreet Shipping Explained: How Premium Adult Brands Protect Your Privacy",
        "kw": "discreet adult shipping",
        "intent": "trust",
        "schema": ["Article", "FAQPage"],
        "internal_links": ["/pages/shipping", "/pages/privacy"],
        "words": 900,
    },
    {
        "title": "First-Year Anniversary Gift Guide: 11 Luxury Picks Couples Actually Want",
        "kw": "luxury intimate gift set couples",
        "intent": "gift-guide",
        "schema": ["Article", "ItemList"],
        "internal_links": ["/collections/gift-sets", "/products/the-50-shades-experience-luxury-gift-collection"],
        "words": 1400,
    },
]


def build_prompt(topic: dict, brand: str = "Dark Fantasy", storefront: str = "https://bdsmpub.com") -> str:
    schema_str = ", ".join(topic["schema"])
    links_str = "\n".join(f"  - {storefront}{l}" for l in topic["internal_links"])
    return f"""You are writing a publication-ready Shopify blog post for {brand} ({storefront}).

Title: {topic["title"]}
Target keyword: {topic["kw"]}
Intent: {topic["intent"]}
Word count: {topic["words"]} (±10%)
Schema markup to embed (in HTML): {schema_str}

REQUIREMENTS — strict:
1. Use HTML, not Markdown (this gets pasted into Shopify's blog editor).
2. Open with a 2–3 sentence hook that names the target keyword naturally.
3. Use H2 for major sections, H3 for sub-sections. Don't use H1 (Shopify renders the post title as H1).
4. Include 6–10 sections covering: hook → core teaching → comparison/criteria → safety considerations → common mistakes → step-by-step (if how-to) → FAQ (3–5 Q&As) → conclusion with soft CTA.
5. Embed JSON-LD schema in a <script type="application/ld+json"> tag at the very end. Use the schema types: {schema_str}. Fill in real, accurate values where possible (use the brand and post title).
6. Internal links — naturally weave in 2–3 of these links inside body copy (in <a href="..."> tags):
{links_str}
7. Tone: educational, sex-positive, inclusive, body-safe-first. NEVER explicit or graphic. Adult-wellness consumer audience.
8. Every claim about safety or materials must be defensible — prefer citing principle ("phthalates can leach over time") rather than naming brands.
9. Soft CTA at end: link to a relevant collection, no hard sell.
10. Include the target keyword in: <title>-equivalent (the H2 of the first section), one H2 elsewhere, the meta description suggestion, and at least 3 times in body.
11. Do NOT use any first names (no "Barron"). Sign-off (if any) as "The {brand} team".
12. Output format — return EXACTLY this structure (don't add preamble):

---
META_TITLE: <50–60 char SEO title>
META_DESCRIPTION: <140–160 char meta>
TARGET_KEYWORD: {topic["kw"]}
SUGGESTED_TAGS: <3-5 comma-separated tags>
SUGGESTED_INTERNAL_LINKS: <comma-separated paths from the list above>
WORD_COUNT_ESTIMATE: <number>
---

<body html starts here>

Begin now."""


def parse_draft(raw: str) -> dict:
    m = re.match(r"---\s*\n(.*?)\n---\s*\n(.*)", raw, re.DOTALL)
    if not m:
        return {"frontmatter": {}, "body": raw}
    fm_text = m.group(1)
    body = m.group(2).strip()
    fm = {}
    for line in fm_text.strip().splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            fm[k.strip()] = v.strip()
    return {"frontmatter": fm, "body": body}


def write_draft(topic: dict, draft: dict, drafts_dir: Path, obs_dir: Path) -> dict:
    slug = re.sub(r"[^a-z0-9]+", "-", topic["title"].lower()).strip("-")[:80]
    fm = draft["frontmatter"]
    body = draft["body"]

    md_content = f"""---
title: "{topic['title']}"
slug: {slug}
target_keyword: {topic['kw']}
intent: {topic['intent']}
status: draft-ready
word_count_estimate: {fm.get('WORD_COUNT_ESTIMATE', 'unknown')}
meta_title: "{fm.get('META_TITLE', '')}"
meta_description: "{fm.get('META_DESCRIPTION', '')}"
suggested_tags: {fm.get('SUGGESTED_TAGS', '')}
suggested_internal_links: {fm.get('SUGGESTED_INTERNAL_LINKS', '')}
schema_hints: {topic['schema']}
generated: {dt.date.today().isoformat()}
---

# {topic['title']}

> **Apply checklist:**
> 1. Copy body HTML below into Shopify Admin → Online Store → Blog Posts → New
> 2. Set blog post title: `{topic['title']}`
> 3. Set SEO title: `{fm.get('META_TITLE', '')}`
> 4. Set meta description: `{fm.get('META_DESCRIPTION', '')}`
> 5. Add tags: `{fm.get('SUGGESTED_TAGS', '')}`
> 6. Set excerpt to first 2–3 sentences
> 7. Verify internal links resolve (see suggested list)
> 8. Schema is embedded in body — confirms when post is live
> 9. Submit URL to Google Search Console for fast index

---

## Body (HTML — paste into Shopify blog editor)

{body}
"""

    drafts_dir.mkdir(parents=True, exist_ok=True)
    obs_dir.mkdir(parents=True, exist_ok=True)
    (drafts_dir / f"{slug}.md").write_text(md_content)
    (obs_dir / f"{slug}.md").write_text(md_content)
    return {"slug": slug, "path": str(drafts_dir / f"{slug}.md"), "obsidian": str(obs_dir / f"{slug}.md")}


def run(out_dir: Path, brand: str, storefront: str, n: int = 12) -> list[dict]:
    drafts_dir = out_dir / "drafts" / dt.date.today().isoformat()
    obs_dir = Path.home() / "Documents/Obsidian/01-Projects/Dark-Fantasy-SEO-GEO-Weekly/Drafts" / dt.date.today().isoformat()

    results = []
    for i, topic in enumerate(TOPICS[:n], 1):
        print(f"      [blog {i}/{n}] {topic['title'][:60]}...")
        try:
            raw = gemini(build_prompt(topic, brand, storefront))
            draft = parse_draft(raw)
            saved = write_draft(topic, draft, drafts_dir, obs_dir)
            results.append({**saved, "title": topic["title"], "kw": topic["kw"], "ok": True})
            time.sleep(2)
        except Exception as e:
            results.append({"title": topic["title"], "ok": False, "error": str(e)[:200]})
            time.sleep(2)

    # Index file
    index_lines = [
        f"# Blog drafts — {dt.date.today().isoformat()}",
        "",
        f"{sum(1 for r in results if r.get('ok'))} drafts ready for review and publication.",
        "",
    ]
    for r in results:
        if r.get("ok"):
            index_lines.append(f"- [[{r['slug']}]] — {r['title']} (kw: `{r['kw']}`)")
        else:
            index_lines.append(f"- ❌ {r['title']} — error: {r.get('error', '?')[:100]}")
    (obs_dir / "_index.md").write_text("\n".join(index_lines) + "\n")
    return results


if __name__ == "__main__":
    import sys
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 12
    out = Path(__file__).resolve().parent.parent
    res = run(out, "Dark Fantasy", "https://bdsmpub.com", n=n)
    print(json.dumps([{k: v for k, v in r.items() if k != "body"} for r in res], indent=2))
