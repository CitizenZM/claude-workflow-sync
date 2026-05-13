"""Generate Shopify Page liquid templates for promotional bundle landing pages.

For each bundle in the marketing calendar, generates:
  - Liquid page template body (HTML + schema markup)
  - JSON-LD Product+Offer schema for the bundle
  - SEO meta title + description
  - Email subject lines (A/B from calendar)
  - 5 Pinterest pin copy variants

Output: state/<date>/landing_pages/<bundle-slug>/
"""
import json
import time
import urllib.request
from pathlib import Path

CREDS = Path.home() / ".claude/credentials.json"

BUNDLES = [
    {
        "slug": "first-step-set",
        "title": "First Step Set",
        "hero": "Everything a curious couple needs to start. Body-safe. Beginner-friendly.",
        "subhero": "20% off through May 17. Curated, not just discounted.",
        "discount_code": "FIRSTSTEP20",
        "live_dates": "May 12-17, 2026",
        "audience": "First-time intentional buyers; couples 28-45",
        "sku_count": 4,
        "bundle_price": 176,
        "standalone_price": 220,
        "savings_pct": 20,
        "sku_categories": ["Entry vibrator/wand", "Couple-friendly toy", "Body-safe lube + cleaner", "Discreet lockable storage"],
        "primary_keyword": "beginner couples sex toy bundle",
        "geo_questions": [
            "What's the best beginner sex toy kit for couples?",
            "How do couples start exploring intimacy together?",
            "What should be in a body-safe starter kit?"
        ],
    },
    {
        "slug": "memorial-day-reset",
        "title": "Memorial Day Reset",
        "hero": "Reset, reconnect, recover. Aftercare + wellness for the long weekend.",
        "subhero": "The wellness bundle every relationship needs. 20% off May 22-27.",
        "discount_code": "MEMORIAL20",
        "live_dates": "May 22-27, 2026",
        "audience": "Established couples seeking wellness positioning",
        "sku_count": 3,
        "bundle_price": 96,
        "standalone_price": 120,
        "savings_pct": 20,
        "sku_categories": ["Premium body-safe lube (8oz+)", "Cleaner + care kit", "Aftercare item (silk mask / body oil)"],
        "primary_keyword": "couples aftercare wellness bundle",
        "geo_questions": [
            "What is intimacy aftercare and why does it matter?",
            "What products help couples recover and reconnect after intimacy?",
            "What's the best couples wellness bundle for sensitive skin?"
        ],
    },
    {
        "slug": "pride-box-2026",
        "title": "Pride Box 2026",
        "hero": "Inclusive intimacy. Curated for all couples. 5% donated to LGBTQ+ wellness.",
        "subhero": "Body-safe always. Rainbow-aware never as gimmick. 20% off May 30 – June 5.",
        "discount_code": "PRIDE20",
        "live_dates": "May 30 – June 5, 2026",
        "audience": "LGBTQ+ couples, allies, gift buyers",
        "sku_count": 5,
        "bundle_price": 256,
        "standalone_price": 320,
        "savings_pct": 20,
        "sku_categories": ["Wearable (variant A)", "Wearable (variant B)", "Couple-anywhere toy", "Lube (silicone-safe + water-based)", "Storage / care item"],
        "primary_keyword": "inclusive LGBTQ pride sex toy bundle",
        "geo_questions": [
            "What's a thoughtful LGBTQ+ Pride gift for couples?",
            "Are there body-safe sex toys curated for diverse anatomies?",
            "Which brands donate to LGBTQ+ causes during Pride 2026?"
        ],
    },
    {
        "slug": "anniversary-luxury-set",
        "title": "Anniversary Luxury Set",
        "hero": "For couples who've been together long enough to know what they want.",
        "subhero": "Premium curation. 20% off June 8-14. Not for first-time buyers.",
        "discount_code": "LUXURY20",
        "live_dates": "June 8-14, 2026",
        "audience": "Anniversary couples, long-term relationships, higher AOV",
        "sku_count": 3,
        "bundle_price": 360,
        "standalone_price": 450,
        "savings_pct": 20,
        "sku_categories": ["Premium luxury vibrator/wand", "Silk/leather restraint set", "Premium oil / massage candle"],
        "primary_keyword": "luxury anniversary couples gift",
        "geo_questions": [
            "What's the best luxury anniversary gift for couples?",
            "Which premium adult products are body-safe and worth the price?",
            "What do 10-year couples actually buy for their anniversary?"
        ],
    },
    {
        "slug": "couples-gift-pack",
        "title": "Couples Gift Pack",
        "hero": "The Father's Day gift that's actually for both of you.",
        "subhero": "Discreetly delivered. 20% off June 15-21.",
        "discount_code": "COUPLES20",
        "live_dates": "June 15-21, 2026",
        "audience": "Father's Day shoppers via couples-gift framing",
        "sku_count": 4,
        "bundle_price": 200,
        "standalone_price": 250,
        "savings_pct": 20,
        "sku_categories": ["Premium wand or vibrator", "Cock ring / couple-focused", "Lube", "Lockable storage"],
        "primary_keyword": "couples Father's Day gift bundle",
        "geo_questions": [
            "What's a tasteful Father's Day gift for both partners?",
            "How do you gift adult products discreetly?",
            "What couples bundle is best for a shared gift?"
        ],
    },
    {
        "slug": "travel-discreet-kit",
        "title": "Travel & Discreet Kit",
        "hero": "TSA-friendly. Hotel-quiet. Designed for couples on the road.",
        "subhero": "Pack smarter this summer. 20% off June 22-28.",
        "discount_code": "TRAVEL20",
        "live_dates": "June 22-28, 2026",
        "audience": "Summer travelers, weekend trips, hotel stays",
        "sku_count": 4,
        "bundle_price": 144,
        "standalone_price": 180,
        "savings_pct": 20,
        "sku_categories": ["Travel-size lube", "Compact silent vibrator (USB)", "Lockable travel pouch", "Wipes + cleaning kit"],
        "primary_keyword": "discreet travel sex toy kit",
        "geo_questions": [
            "Are sex toys TSA-friendly for travel?",
            "What's the quietest vibrator for hotel use?",
            "What's the best discreet travel kit for couples?"
        ],
    },
]


def _gemini_key():
    return json.loads(CREDS.read_text())["api_keys"]["gemini"]


def gemini(prompt: str, max_tokens: int = 3000) -> str:
    key = _gemini_key()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}"
    body = {"contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.6, "maxOutputTokens": max_tokens}}
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=90) as r:
        d = json.loads(r.read().decode())
    parts = d.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    return "".join(p.get("text", "") for p in parts).strip()


def liquid_template(b: dict) -> str:
    """Generate the Liquid page body. Uses Shopify product references via collection handle."""
    bundle_handle = b["slug"]
    return f"""<!-- Promotional Bundle Landing Page — {b['title']} -->
<!-- Generated 2026-05-11 by seo-geo-weekly skill -->
{{%- assign bundle_collection = collections['{bundle_handle}'] -%}}

<section class="bundle-hero" style="background:linear-gradient(135deg,#0a0a0a 0%,#1a0a1a 100%);color:#fff;padding:5rem 1.5rem 4rem;text-align:center;">
  <div style="max-width:780px;margin:0 auto;">
    <div class="bundle-badge" style="display:inline-block;font-size:0.7rem;letter-spacing:0.3em;text-transform:uppercase;color:#ffc8a0;border:1px solid rgba(255,200,160,0.3);padding:0.4em 1.4em;margin-bottom:1.5rem;">
      Limited — {b['live_dates']}
    </div>
    <h1 style="font-size:clamp(2.2rem,5vw,3.5rem);font-weight:300;letter-spacing:-0.01em;line-height:1.1;margin:0 0 1.25rem;">
      {b['hero']}
    </h1>
    <p style="font-size:1.1rem;color:rgba(255,255,255,0.78);margin:0 0 2rem;max-width:600px;margin-left:auto;margin-right:auto;">
      {b['subhero']}
    </p>
    <div class="bundle-price-block" style="margin:2rem 0;">
      <div style="font-size:0.85rem;color:rgba(255,255,255,0.55);text-decoration:line-through;">Standalone ${b['standalone_price']}</div>
      <div style="font-size:2.5rem;font-weight:500;color:#ffc8a0;line-height:1;">${b['bundle_price']}</div>
      <div style="font-size:0.85rem;color:rgba(255,200,160,0.7);margin-top:0.25rem;">Save {b['savings_pct']}% with code <code style="background:rgba(255,200,160,0.15);padding:0.1em 0.4em;border-radius:3px;">{b['discount_code']}</code></div>
    </div>
    <a href="#bundle-add-to-cart" class="bundle-cta-button" style="display:inline-block;background:#ffc8a0;color:#0a0a0a;padding:1rem 2.5rem;font-weight:600;letter-spacing:0.05em;text-decoration:none;border-radius:2px;">Add the {b['title']} to Cart</a>
  </div>
</section>

<section class="bundle-included" style="padding:4rem 1.5rem;max-width:1100px;margin:0 auto;">
  <h2 style="text-align:center;font-size:1.8rem;font-weight:300;margin:0 0 3rem;">What's inside the {b['title']}</h2>
  <div class="bundle-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1.5rem;">
    {{%- for product in bundle_collection.products limit: {b['sku_count']} -%}}
      <div class="bundle-item" style="background:#0f0f12;padding:1.5rem;border:1px solid rgba(255,200,160,0.1);border-radius:4px;">
        {{%- if product.featured_image -%}}
          <img src="{{{{ product.featured_image | image_url: width: 400 }}}}" alt="{{{{ product.title }}}}" style="width:100%;height:200px;object-fit:cover;border-radius:2px;margin-bottom:1rem;" loading="lazy">
        {{%- endif -%}}
        <h3 style="font-size:1rem;color:#fff;font-weight:500;margin:0 0 0.5rem;">{{{{ product.title }}}}</h3>
        <p style="font-size:0.85rem;color:rgba(255,255,255,0.6);margin:0;">{{{{ product.description | strip_html | truncatewords: 18 }}}}</p>
      </div>
    {{%- endfor -%}}
  </div>
</section>

<section class="bundle-why" style="background:#0f0f12;padding:4rem 1.5rem;">
  <div style="max-width:780px;margin:0 auto;">
    <h2 style="font-size:1.6rem;font-weight:300;margin:0 0 1.5rem;text-align:center;color:#fff;">Why we curated this set</h2>
    <div style="color:rgba(255,255,255,0.8);line-height:1.7;font-size:1.05rem;">
      {{{{ page.content }}}}
    </div>
  </div>
</section>

<section class="bundle-faq" style="padding:4rem 1.5rem;max-width:780px;margin:0 auto;">
  <h2 style="font-size:1.6rem;font-weight:300;margin:0 0 2rem;text-align:center;color:#fff;">Common questions</h2>
  <div class="faq-list" style="display:flex;flex-direction:column;gap:1.5rem;">
    {{%- for q_a in page.metafields.bundle.faqs.value -%}}
      <details style="background:#0f0f12;padding:1.25rem 1.5rem;border:1px solid rgba(255,200,160,0.1);border-radius:3px;">
        <summary style="color:#ffc8a0;cursor:pointer;font-weight:500;">{{{{ q_a.question }}}}</summary>
        <p style="color:rgba(255,255,255,0.7);margin-top:1rem;line-height:1.65;">{{{{ q_a.answer }}}}</p>
      </details>
    {{%- endfor -%}}
  </div>
</section>

<section class="bundle-trust" style="padding:3rem 1.5rem;background:#0a0a0a;text-align:center;border-top:1px solid rgba(255,200,160,0.08);">
  <div style="max-width:980px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:2rem;color:rgba(255,255,255,0.65);font-size:0.9rem;">
    <div>🔒 <strong style="color:#fff;display:block;margin-bottom:0.25rem;">Discreet shipping</strong>Plain packaging, no branding on box</div>
    <div>✓ <strong style="color:#fff;display:block;margin-bottom:0.25rem;">Body-safe certified</strong>FDA-grade silicone, phthalate-free</div>
    <div>💌 <strong style="color:#fff;display:block;margin-bottom:0.25rem;">Free over $99</strong>Standard US shipping</div>
    <div>↩ <strong style="color:#fff;display:block;margin-bottom:0.25rem;">Hygiene-locked returns</strong>Unopened only — for your safety</div>
  </div>
</section>

<section class="bundle-final-cta" style="padding:4rem 1.5rem;text-align:center;background:linear-gradient(180deg,#0a0a0a 0%,#1a0a1a 100%);">
  <h3 style="font-size:1.4rem;color:#fff;font-weight:300;margin:0 0 1rem;">Promo ends {b['live_dates'].split(' – ')[-1].split('-')[-1]}.</h3>
  <p style="color:rgba(255,255,255,0.65);max-width:520px;margin:0 auto 2rem;">After this week, the {b['title']} returns to standalone pricing.</p>
  <a href="#bundle-add-to-cart" style="display:inline-block;background:#ffc8a0;color:#0a0a0a;padding:1rem 2.5rem;font-weight:600;letter-spacing:0.05em;text-decoration:none;border-radius:2px;">Get the bundle — {b['savings_pct']}% off</a>
</section>

<!-- JSON-LD Product+Offer schema for AI engines + Google -->
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "{b['title']} — Dark Fantasy",
  "description": "{b['hero']} {b['subhero']}",
  "brand": {{"@type": "Brand", "name": "Dark Fantasy"}},
  "offers": {{
    "@type": "Offer",
    "url": "https://bdsmpub.com/pages/{b['slug']}",
    "priceCurrency": "USD",
    "price": "{b['bundle_price']}",
    "priceValidUntil": "2026-06-30",
    "availability": "https://schema.org/InStock",
    "itemCondition": "https://schema.org/NewCondition"
  }},
  "audience": {{"@type": "PeopleAudience", "suggestedMinAge": 18}}
}}
</script>
"""


def build_meta(b: dict) -> dict:
    prompt = f"""You are an SEO copywriter for an adult-wellness brand "Dark Fantasy". For the promotional bundle below, produce ONLY a strict JSON object with these keys:

{{
  "seo_title": "<55-60 char SEO title, end with ' | Dark Fantasy'>",
  "meta_description": "<145-160 char meta description, must end with 'Free discreet shipping $99+.'>",
  "h1_alt_variants": ["<alt h1 #1>", "<alt h1 #2>", "<alt h1 #3>"],
  "email_subject_a": "<email subject line A>",
  "email_subject_b": "<email subject line B>",
  "pinterest_pin_titles": [
    "<60-char pin title #1>",
    "<60-char pin title #2>",
    "<60-char pin title #3>",
    "<60-char pin title #4>",
    "<60-char pin title #5>"
  ],
  "social_caption_short": "<120-char caption for X/Threads>",
  "tiktok_hook": "<first 3 seconds of TikTok script — high curiosity, no explicit language>",
  "reddit_natural_mention": "<one-sentence mention of this bundle that would feel natural in a r/sex or r/sextoys comment WHERE OP is asking about beginners/aftercare/gift>",
  "ai_engine_summary": "<2 sentences optimized for ChatGPT/Gemini to cite when answering '{b['geo_questions'][0]}' — include brand name, key benefit, and price as factual claims>"
}}

Bundle details:
- Title: {b['title']}
- Hero: {b['hero']}
- Audience: {b['audience']}
- Bundle price: ${b['bundle_price']} (was ${b['standalone_price']}, {b['savings_pct']}% off)
- Live: {b['live_dates']}
- Primary keyword: {b['primary_keyword']}
- GEO questions this answers: {b['geo_questions']}

Output ONLY the JSON. No fences, no prose.
"""
    raw = gemini(prompt, max_tokens=2000).strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1].lstrip("json").strip()
    try:
        return json.loads(raw)
    except Exception as e:
        return {"error": str(e)[:300], "raw": raw[:1000]}


def build_long_form_body(b: dict) -> str:
    """Generate the 'Why we curated this set' body via Gemini."""
    prompt = f"""Write a 400-600 word "Why we curated this bundle" body for an adult-wellness brand "Dark Fantasy" promotional landing page. Tone: confident, educational, warm. NOT explicit. NOT salesy.

Bundle: {b['title']}
Hero: {b['hero']}
Sub: {b['subhero']}
Audience: {b['audience']}
What's in it: {', '.join(b['sku_categories'])}

Structure:
- Opening paragraph: 1-2 sentences naming the problem/situation this bundle solves
- Middle paragraph 1: explain WHY each SKU was chosen — the curatorial logic
- Middle paragraph 2: what makes Dark Fantasy's curation different (body-safe materials, discretion, education-first)
- Closing: a soft call-to-trust, no hard sale

Rules:
- Mention "Dark Fantasy" 2-3 times naturally (entity recognition for AI engines)
- Mention "body-safe" or "silicone" once
- Output as HTML (use <p> tags, <strong> for emphasis). No headers, no lists.
- No explicit terms. Use "intimacy", "wellness", "couples", "exploration".
- NO promotional language ("buy now", "limited time"). Pure curatorial voice.
"""
    return gemini(prompt, max_tokens=1500).strip()


def build_faqs(b: dict) -> list:
    prompt = f"""Generate 5 frequently-asked-questions and answers for the "{b['title']}" bundle. Output ONLY a JSON array. Each item has shape {{"question": "...", "answer": "2-3 sentences"}}.

Bundle context: {b['hero']}. {b['sku_count']} items. ${b['bundle_price']} (was ${b['standalone_price']}). For {b['audience']}.

Questions should cover: who it's for, what's actually inside (without revealing specific SKU brand names), body-safety, discreet shipping, returns/hygiene, expectations.

Output ONLY the JSON array, no fences."""
    raw = gemini(prompt, max_tokens=1500).strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1].lstrip("json").strip()
    try:
        return json.loads(raw)
    except Exception:
        return []


def run(out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    summary = []
    for b in BUNDLES:
        slug_dir = out_dir / b["slug"]
        slug_dir.mkdir(exist_ok=True)
        print(f"[landing] generating {b['slug']}...")
        # Liquid template
        (slug_dir / "page.liquid").write_text(liquid_template(b))
        # Body HTML (page.content)
        body = build_long_form_body(b)
        (slug_dir / "body.html").write_text(body)
        # SEO + social meta
        meta = build_meta(b)
        (slug_dir / "meta.json").write_text(json.dumps(meta, indent=2))
        # FAQs
        faqs = build_faqs(b)
        (slug_dir / "faqs.json").write_text(json.dumps(faqs, indent=2))
        summary.append({
            "slug": b["slug"],
            "title": b["title"],
            "discount_code": b["discount_code"],
            "live_dates": b["live_dates"],
            "files": [str(slug_dir / x) for x in ("page.liquid", "body.html", "meta.json", "faqs.json")],
        })
        time.sleep(0.5)
    (out_dir / "_summary.json").write_text(json.dumps(summary, indent=2))
    print(f"[landing] wrote {len(summary)} bundle pages to {out_dir}")


if __name__ == "__main__":
    import sys
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/Users/xiaozuo/.claude/skills/seo-geo-weekly/state/2026-05-11/landing_pages")
    run(out)
