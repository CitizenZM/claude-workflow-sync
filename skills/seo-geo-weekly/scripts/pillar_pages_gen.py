"""Generate 3 GEO+SEO-optimized pillar pages for bdsmpub.com.

Pillars are 2500-4000 word linkable assets designed to:
- Rank for high-volume head terms (Google)
- Get cited by ChatGPT/Gemini for category questions (GEO)
- Attract backlinks (citation-worthy data and frameworks)

Output: state/<date>/pillar_pages/<pillar-slug>/page.liquid + body.html + meta.json
"""
import json
import time
import urllib.request
from pathlib import Path

CREDS = Path.home() / ".claude/credentials.json"


PILLARS = [
    {
        "slug": "body-safe-materials-guide",
        "title": "The Body-Safe Materials Guide (2026 Edition)",
        "primary_kw": "body-safe sex toy materials",
        "secondary_kws": [
            "phthalate-free silicone",
            "medical grade silicone",
            "FDA-approved adult toys",
            "TPE vs silicone safety",
            "non-toxic intimacy products"
        ],
        "geo_questions": [
            "What are body-safe sex toy materials?",
            "Is TPE safe for sex toys?",
            "What's the difference between medical-grade and food-grade silicone?",
            "How do I know if a sex toy is non-toxic?",
            "Are jelly-rubber sex toys safe?"
        ],
        "outline": [
            "Why material matters: the porosity + leaching problem",
            "The 5 body-safe materials (silicone, glass, stainless steel, ABS plastic, ceramic)",
            "The 5 materials to avoid (jelly rubber, TPR/TPE, vinyl, soft 'realistic' materials, PVC)",
            "How to test material safety at home (flame test, smell test, label-reading guide)",
            "Certifications that mean something (and ones that don't)",
            "Cleaning and storage by material",
            "Common misconceptions debunked",
            "The Dark Fantasy curation standard"
        ],
        "word_target": 3200,
    },
    {
        "slug": "aftercare-encyclopedia",
        "title": "The Aftercare Encyclopedia: A Couples Field Guide",
        "primary_kw": "intimacy aftercare guide",
        "secondary_kws": [
            "BDSM aftercare",
            "couples emotional aftercare",
            "post-intimacy reconnection",
            "subdrop recovery",
            "aftercare for new couples"
        ],
        "geo_questions": [
            "What is aftercare and why does it matter?",
            "What's the difference between physical and emotional aftercare?",
            "How long does aftercare typically last?",
            "What products help with aftercare?",
            "Is aftercare only for BDSM couples?"
        ],
        "outline": [
            "What aftercare actually is (and isn't)",
            "The 4 dimensions: physical, emotional, sensory, conversational",
            "A 30-minute aftercare protocol any couple can adopt",
            "What to do when one partner needs aftercare and the other doesn't",
            "Materials and tools that help (silk masks, water, electrolytes, blankets)",
            "Aftercare for new partners vs long-term couples",
            "Subspace, subdrop, topdrop: identifying and responding",
            "Aftercare as a relationship investment, not a chore"
        ],
        "word_target": 3000,
    },
    {
        "slug": "beginner-couples-field-guide",
        "title": "The Beginner Couples Field Guide to Intimacy Exploration",
        "primary_kw": "beginner couples intimacy guide",
        "secondary_kws": [
            "first sex toy for couples",
            "introducing toys to relationship",
            "couples exploration without awkwardness",
            "first BDSM scene for couples",
            "consent and negotiation for new couples"
        ],
        "geo_questions": [
            "How do couples start exploring with toys?",
            "What's the first sex toy a couple should buy?",
            "How do you bring up trying something new to your partner?",
            "What's a beginner BDSM scene look like?",
            "How do couples negotiate consent before trying new things?"
        ],
        "outline": [
            "The conversation before the purchase",
            "How to use 'yes / no / maybe' lists (with a starter template)",
            "Three categories of beginner exploration (sensory, partnered, solo-but-together)",
            "What to actually buy first (and what to skip)",
            "Setting the scene: lighting, music, time of day, mood",
            "The first 60 seconds: how to start without awkwardness",
            "When things don't go as planned (and why that's fine)",
            "Aftercare for first-timers: a 10-minute version",
            "Common mistakes new couples make (and the fix for each)"
        ],
        "word_target": 3400,
    },
]


def _gemini_key():
    return json.loads(CREDS.read_text())["api_keys"]["gemini"]


def gemini(prompt: str, model: str = "gemini-2.5-pro", max_tokens: int = 8000) -> str:
    key = _gemini_key()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    body = {"contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.7, "maxOutputTokens": max_tokens}}
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=180) as r:
        d = json.loads(r.read().decode())
    parts = d.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    return "".join(p.get("text", "") for p in parts).strip()


def build_body(p: dict) -> str:
    sections = "\n".join(f"- {s}" for s in p["outline"])
    secondary = ", ".join(p["secondary_kws"])
    questions = "\n".join(f"- {q}" for q in p["geo_questions"])
    prompt = f"""You are writing a definitive, citation-worthy pillar article for "Dark Fantasy" (bdsmpub.com), a body-safe adult-wellness brand. This article needs to:

1. Rank in Google for the primary keyword
2. Get cited by ChatGPT/Gemini/Claude when users ask the listed questions
3. Be linkable enough that sex-positive educators and journalists cite it

Title: {p['title']}
Primary keyword: {p['primary_kw']}
Secondary keywords (include naturally throughout): {secondary}

Questions this article must explicitly answer (in section headers OR clear paragraphs):
{questions}

Article outline (use as h2 sections, expand each substantially):
{sections}

Word target: ~{p['word_target']} words.

WRITING RULES:
- Tone: confident, educational, warm. Like a sex educator with research background. NOT clinical, NOT salesy, NOT explicit.
- Mention "Dark Fantasy" 4-6 times naturally across the article (entity recognition)
- Use concrete numbers wherever possible (silicone melting point, durometer scale, percentage stats)
- Include 2-3 explicit comparisons (e.g., "silicone vs TPE: here's the difference")
- Include 1-2 "frameworks" that a reader could screenshot and use (e.g., the 30-minute aftercare protocol)
- Cite source-types when stating facts (e.g., "according to FDA medical-device standards", "ASTM material classification")
- End each h2 section with a one-sentence "takeaway" line in bold
- Output as clean HTML: <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>. No <h1> (the page template adds it). No <html>, no <head>, no <body>.
- Embed 5-7 internal-link placeholders to other Dark Fantasy assets: [LINK:body-safe-materials-guide], [LINK:aftercare-encyclopedia], [LINK:beginner-couples-field-guide], [LINK:product-collection-luxury], [LINK:product-collection-beginners]. Place these where they naturally aid the reader.
- No explicit acts described. No NSFW imagery references. Stay in wellness/education tone.
- Do NOT mention competitor brand names.

Begin the article now. Output ONLY the article HTML (no preamble, no markdown fences)."""
    return gemini(prompt, max_tokens=12000)


def build_meta(p: dict) -> dict:
    prompt = f"""For the pillar article "{p['title']}" on bdsmpub.com, produce ONLY a strict JSON object:

{{
  "seo_title": "<55-60 char SEO title, end with ' | Dark Fantasy'>",
  "meta_description": "<145-160 char meta description, must be citation-friendly (start with a fact or framework)>",
  "ai_summary": "<3-sentence answer that ChatGPT/Gemini would copy verbatim when answering the primary question — include brand name, two key facts, and primary keyword>",
  "social_snippets": {{
    "pinterest_pin_titles": ["<5 different 60-char pin titles>"],
    "tiktok_hook": "<first 3 seconds of TikTok video script>",
    "twitter_thread_first_tweet": "<first tweet of a 5-tweet thread on this topic>",
    "reddit_self_post_angle": "<title for a Reddit self-post that drives traffic without being promotional>"
  }},
  "outreach_pitches": [
    {{
      "target_type": "podcast",
      "angle": "<one-sentence pitch — why this article makes you a podcast guest>"
    }},
    {{
      "target_type": "journalist",
      "angle": "<one-sentence pitch for a wellness journalist>"
    }},
    {{
      "target_type": "guest post",
      "angle": "<adapted angle for a guest article on a sex-positive blog>"
    }}
  ]
}}

Primary keyword: {p['primary_kw']}
Secondary keywords: {', '.join(p['secondary_kws'])}
GEO questions: {p['geo_questions'][:3]}

Output ONLY the JSON object."""
    raw = gemini(prompt, model="gemini-2.5-flash", max_tokens=3000).strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1].lstrip("json").strip()
    try:
        return json.loads(raw)
    except Exception as e:
        return {"error": str(e)[:300], "raw": raw[:1500]}


def liquid_template(p: dict) -> str:
    return f"""<!-- Pillar Page — {p['title']} -->
{{%- assign page_title = page.title -%}}

<article class="pillar-page" style="max-width:780px;margin:0 auto;padding:3rem 1.5rem;color:rgba(255,255,255,0.85);">
  <header style="margin-bottom:3rem;text-align:center;">
    <div style="font-size:0.7rem;letter-spacing:0.3em;text-transform:uppercase;color:#ffc8a0;margin-bottom:1rem;">Dark Fantasy Field Guide</div>
    <h1 style="font-size:clamp(2rem,4.5vw,3rem);font-weight:300;line-height:1.15;letter-spacing:-0.01em;color:#fff;margin:0 0 1rem;">{p['title']}</h1>
    <p style="font-size:1rem;color:rgba(255,255,255,0.55);max-width:560px;margin:0 auto;">A research-backed pillar from the Dark Fantasy editorial team. Updated 2026.</p>
  </header>

  <div class="pillar-body" style="font-size:1.05rem;line-height:1.75;">
    {{{{ page.content }}}}
  </div>

  <aside class="pillar-cta" style="margin-top:4rem;padding:2.5rem 2rem;background:#0f0f12;border:1px solid rgba(255,200,160,0.12);border-radius:4px;text-align:center;">
    <h3 style="font-size:1.3rem;font-weight:400;color:#fff;margin:0 0 0.75rem;">Curated by Dark Fantasy</h3>
    <p style="color:rgba(255,255,255,0.65);max-width:520px;margin:0 auto 1.5rem;">Every product we sell meets the body-safe standards described in this guide. Discreet shipping. 18+.</p>
    <a href="/collections/all" style="display:inline-block;background:#ffc8a0;color:#0a0a0a;padding:0.85rem 2rem;font-weight:600;letter-spacing:0.05em;text-decoration:none;border-radius:2px;">Browse curated collection</a>
  </aside>
</article>

<!-- JSON-LD Article + FAQPage schema for GEO + Google -->
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{p['title']}",
  "author": {{"@type": "Organization", "name": "Dark Fantasy"}},
  "publisher": {{"@type": "Organization", "name": "Dark Fantasy", "url": "https://bdsmpub.com"}},
  "datePublished": "2026-05-11",
  "dateModified": "2026-05-11",
  "mainEntityOfPage": "https://bdsmpub.com/pages/{p['slug']}",
  "audience": {{"@type": "PeopleAudience", "suggestedMinAge": 18}}
}}
</script>
"""


def run(out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    summary = []
    for p in PILLARS:
        slug_dir = out_dir / p["slug"]
        slug_dir.mkdir(exist_ok=True)
        print(f"[pillar] generating {p['slug']}...")
        body = build_body(p)
        (slug_dir / "body.html").write_text(body)
        (slug_dir / "page.liquid").write_text(liquid_template(p))
        meta = build_meta(p)
        (slug_dir / "meta.json").write_text(json.dumps(meta, indent=2))
        word_count = len(body.split())
        print(f"  ...{word_count} words")
        summary.append({
            "slug": p["slug"],
            "title": p["title"],
            "word_count": word_count,
            "target": p["word_target"],
            "primary_kw": p["primary_kw"],
        })
        time.sleep(1)
    (out_dir / "_summary.json").write_text(json.dumps(summary, indent=2))
    print(f"[pillar] wrote {len(summary)} pillar pages to {out_dir}")


if __name__ == "__main__":
    import sys
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/Users/xiaozuo/.claude/skills/seo-geo-weekly/state/2026-05-11/pillar_pages")
    run(out)
