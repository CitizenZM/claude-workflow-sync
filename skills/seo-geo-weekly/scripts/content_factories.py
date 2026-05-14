"""Multi-stream content factories for sister-brand + TikTok + IG queues.

Generates in one process to share the Gemini call helper. All output is markdown/JSON
files in state/<date>/ — no platform mutations.
"""
import json
import re
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

CREDS = Path.home() / ".claude/credentials.json"
STATE = Path("/Users/xiaozuo/.claude/skills/seo-geo-weekly/state/2026-05-13")
STATE.mkdir(parents=True, exist_ok=True)


def _key():
    return json.loads(CREDS.read_text())["api_keys"]["gemini"]


def gemini(prompt: str, model: str = "gemini-2.5-flash", max_tokens: int = 4000, json_mode: bool = False) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={_key()}"
    cfg = {"temperature": 0.6, "maxOutputTokens": max_tokens}
    if json_mode:
        cfg["responseMimeType"] = "application/json"
    body = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": cfg}
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=120) as r:
        d = json.loads(r.read().decode())
    parts = d.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    return "".join(p.get("text", "") for p in parts).strip()


def robust_json(raw: str):
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1].lstrip("json").strip()
        if raw.endswith("```"):
            raw = raw[:-3].strip()
    try:
        return json.loads(raw)
    except Exception:
        pass
    m = re.search(r"[\[\{][\s\S]*[\]\}]", raw)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            pass
    raise ValueError(f"unparseable JSON: {raw[:200]}")


# ============================================================
# 1. Sister-brand Pinterest pins (50)
# ============================================================

PIN_TOPICS = [
    # Communication/relationship rituals
    "4-question check-in for couples", "weekly relationship reset ritual", "yes/no/maybe framework explained",
    "what therapists say about intimacy resets", "anniversary ritual for 10-year couples", "soft life check-in template",
    # Aftercare
    "30-minute aftercare protocol", "aftercare isn't just for BDSM",
    "subdrop recovery guide", "emotional aftercare basics", "aftercare for new couples",
    "the 3 dimensions of aftercare", "physical vs emotional aftercare",
    # Body-safe materials
    "body-safe materials visual guide", "5 materials to avoid", "silicone vs TPE comparison",
    "what 'medical-grade' actually means", "how to test material safety at home", "phthalate-free certification guide",
    "FDA standards for adult products", "non-porous surfaces explained",
    # Soft Life Intimacy
    "soft life intimacy 7-day reset", "nervous system regulation for couples",
    "wellness-first relationships", "intimacy as wellness practice",
    "evening wind-down rituals", "morning connection rituals",
    # Communication frameworks
    "couples therapist scripts", "navigating mismatched desire",
    "consent conversations made easy", "the 'maybe' column conversation",
    "discussing fantasies without awkwardness", "deal-breakers vs preferences",
    # Storage / discretion
    "discreet storage solutions", "what TSA actually checks (and doesn't)",
    "travel kit essentials", "hotel-friendly product picks",
    # Anniversary / gifting
    "what 10-year couples buy themselves", "anniversary gift wisdom",
    "gifting framework for partners", "his and hers vs ours",
    # Care / longevity
    "how to clean silicone", "storage by material",
    "lifespan of body-safe products", "warranty signals to trust",
    # Pride / inclusivity
    "inclusive intimacy education", "language matters in intimacy",
    "diverse anatomies in product design", "the inclusivity audit for brands",
    # Bonus
    "the romance of restraint (philosophy, not products)", "vulnerability as a practice"
]


def build_pin(topic: str) -> dict:
    prompt = f"""Generate a Pinterest pin spec for an education-first wellness account (@curated.intimacy). Topic: "{topic}".

CRITICAL RULES:
- NO mention of: BDSM, sex toy, sex toys, kink, fetish, bondage, pleasure (as Pinterest-banned term), adult, NSFW
- USE: intimacy, wellness, couples, partners, materials, aftercare, ritual, education, soft life, nervous system, connection
- Topic is educational/lifestyle, never product-promotional
- Pin must save well to "wellness", "couples", "relationship" boards

Output STRICT JSON only:
{{
  "title": "60-char Pinterest pin title (curiosity-led, list or framework or contrarian fact)",
  "description": "300-500 char description with 3-5 hashtags from this safe set: #SoftLife #SoftLifeIntimacy #CouplesRituals #IntimacyCoach #Aftercare #NervousSystem #WellnessTok #RelationshipRituals #CouplesWellness",
  "image_concept": "60-100 word description of the pin image — collage / quote card / infographic / lifestyle photo. Specify aesthetic (dark mood, warm-tone, minimal, etc) and key visual elements. NO bodies, NO product images, NO explicit imagery. Lifestyle objects, textures, hands, silhouettes, fabric, candlelight OK.",
  "alt_text": "Pinterest alt text (90 chars max, descriptive for accessibility)",
  "destination_url_slug": "what /education/ slug on bdsmpub.com this should link to (3-5 word slug)",
  "pin_format": "Collage Pin | Idea Pin | Quote Card | Infographic | Video Pin",
  "best_post_window": "Sun 8-11pm ET | Weekday lunch | Weekday 8-10pm ET"
}}"""
    raw = gemini(prompt, json_mode=True, max_tokens=2000)
    try:
        d = robust_json(raw)
        d["topic_seed"] = topic
        return d
    except Exception as e:
        return {"topic_seed": topic, "error": str(e)[:200]}


def factory_pinterest():
    print("[pinterest] generating 50 sister-brand pins...")
    results = []
    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = {ex.submit(build_pin, t): t for t in PIN_TOPICS[:50]}
        for i, f in enumerate(as_completed(futs), 1):
            results.append(f.result())
            if i % 10 == 0:
                print(f"  {i}/50")
    out = STATE / "sister_brand_pins.json"
    out.write_text(json.dumps({"count": len(results), "handle": "@curated.intimacy", "pins": results}, indent=2))
    print(f"[pinterest] wrote {out}")


# ============================================================
# 2. TikTok 30-script queue (Soft Life Intimacy framing)
# ============================================================

TIKTOK_TOPICS = [
    "The 4-question check-in every couple should do weekly",
    "What 'body-safe' actually means (most brands lie about this)",
    "The 30-minute aftercare protocol (most couples skip step 2)",
    "5 materials in your nightstand that aren't safe (and what to use instead)",
    "Why couples therapists are obsessed with the yes/no/maybe list",
    "The soft life intimacy reset (7 days, no expense)",
    "How long should aftercare really last? (research answer)",
    "Three signs your relationship needs an intimacy reset",
    "The conversation that fixed our communication (script inside)",
    "Why we stopped buying 'jelly' products (and switched to silicone)",
    "What 10-year couples buy that newlyweds don't",
    "The discretion checklist for travel couples",
    "Anniversary intimacy framework (not a gift list)",
    "Nervous system regulation for couples (10 min daily practice)",
    "How to bring up something new without awkwardness",
    "The 'maybe' column conversation everyone avoids",
    "Why aftercare isn't just for BDSM couples",
    "What's actually in 'soft realistic' products (it's not good)",
    "The 3 dimensions of aftercare nobody talks about",
    "Why we keep silicone separated from other materials",
    "Hotel-friendly intimacy products (TSA-tested)",
    "The 60-second cleaning ritual that doubles product life",
    "What 'FDA-approved' means for adult products",
    "How to read a body-safe certification label",
    "The first 60 seconds of intimacy that decide the next hour",
    "Subdrop is real (and how partners can help)",
    "The morning connection ritual (under 5 minutes)",
    "Why our Pride Box has 5 SKUs (and the curation logic)",
    "Three couples-therapy frameworks adapted for everyday couples",
    "The Dark Fantasy curation standard (what we say no to)"
]


def build_tiktok(topic: str) -> dict:
    prompt = f"""Generate a faceless TikTok script for the @darkfantasy.studio account (US English, education framing, AIGC-labeled).

Topic: "{topic}"

CRITICAL RULES:
- 18-34 second total length (~50-90 words of voiceover)
- Hook in first 3 seconds (curiosity, contrarian, or stat-led)
- TTS-friendly script (no double meanings, no homophones)
- Soft Life Intimacy framing
- CTA at 70-80% mark
- Faceless: text-on-screen + B-roll only (hands, materials, fabric, glassware, candlelight)
- AIGC label REQUIRED in caption
- Caption: 1-2 sentence + 5 brand-safe hashtags from: #SoftLifeIntimacy #RelationshipTok #WellnessTok #CouplesTok #BodySafe #IntimacyEducation
- NO words: sex toy, dildo, vibrator (use "wellness products"), explicit acts, BDSM (use "exploration")

Output STRICT JSON only:
{{
  "hook_3s": "first 3 seconds spoken — text-on-screen overlay",
  "script_voiceover": "full 18-34s voiceover script — natural sentences, no markdown",
  "b_roll_shots": ["shot 1 description (3s)", "shot 2 (3s)", ..., 6-9 total shots],
  "on_screen_text": ["text overlay #1 (2-3 words)", "#2", ..., 5-8 total],
  "cta": "the ~3-5s call-to-action — should land at ~70-80% mark",
  "caption": "post caption with hashtags",
  "aigc_label": "AI-generated voice via TTS",
  "duration_estimate_s": 22,
  "hashtags": ["#SoftLifeIntimacy", "..."]
}}"""
    raw = gemini(prompt, json_mode=True, max_tokens=2500)
    try:
        d = robust_json(raw)
        d["topic_seed"] = topic
        return d
    except Exception as e:
        return {"topic_seed": topic, "error": str(e)[:200]}


def factory_tiktok():
    print("[tiktok] generating 30 scripts...")
    out_dir = STATE / "tiktok_scripts"
    out_dir.mkdir(exist_ok=True)
    results = []
    with ThreadPoolExecutor(max_workers=5) as ex:
        futs = {ex.submit(build_tiktok, t): t for t in TIKTOK_TOPICS}
        for i, f in enumerate(as_completed(futs), 1):
            r = f.result()
            results.append(r)
            if "error" not in r:
                # Save individual file
                slug = re.sub(r"[^a-z0-9]+", "-", r["topic_seed"].lower()).strip("-")[:60]
                (out_dir / f"{slug}.json").write_text(json.dumps(r, indent=2))
            if i % 10 == 0:
                print(f"  {i}/30")
    (out_dir / "_index.json").write_text(json.dumps({"count": len(results), "scripts": results}, indent=2))
    print(f"[tiktok] wrote {len(results)} scripts to {out_dir}")


# ============================================================
# 3. IG 20-carousel queue
# ============================================================

IG_TOPICS = [
    "Body-safe materials: the complete visual guide",
    "Aftercare in 5 slides",
    "The yes/no/maybe framework (downloadable)",
    "5 materials to avoid (and why)",
    "30-min couples reset ritual",
    "Anniversary intimacy frameworks",
    "Soft Life Intimacy: 7-day practice",
    "How to clean silicone right",
    "The discretion checklist for travel",
    "Nervous system regulation for couples",
    "What couples therapists recommend",
    "Aftercare for new couples (10-min version)",
    "Communication frameworks for mismatched desire",
    "Body-safe certification 101",
    "The 3 dimensions of intimacy aftercare",
    "Curation criteria: what we say no to",
    "Beginner couples mistakes (and fixes)",
    "Pride 2026 inclusive intimacy",
    "Long-distance intimacy frameworks",
    "Hotel-friendly intimacy kit explained"
]


def build_carousel(topic: str) -> dict:
    prompt = f"""Generate an Instagram carousel (10 slides) for @darkfantasy.studio (couples wellness, education-first).

Topic: "{topic}"

CRITICAL RULES:
- 10 slides total
- Slide 1: HOOK (huge text, curiosity-led)
- Slides 2-8: education (one idea per slide, 15-30 words each)
- Slide 9: framework / checklist / save-worthy summary
- Slide 10: brand soft-CTA ("Curated by Dark Fantasy • bdsmpub.com" — first link in caption)
- Save-bait: lists, frameworks, contrarian facts, numerical hooks
- Tone: warm, confident, education-first
- NO explicit imagery descriptions
- Caption: 150-200 chars + 8 hashtags from safe set: #SoftLifeIntimacy #CouplesEducation #BodySafe #RelationshipTips #IntimacyCoach #WellnessJourney #CouplesTherapy #IntimacyWellness #SelfCareCouples #DarkFantasy

Output STRICT JSON only:
{{
  "title": "carousel internal title",
  "hook_slide": {{
    "headline": "huge bold text (5-9 words)",
    "subline": "1-line subhead (8-15 words)",
    "image_concept": "dark mood / warm minimal / textured / etc — 30 words"
  }},
  "education_slides": [
    {{"headline": "...", "body": "15-30 words", "image_concept": "..."}},
    ... 7 slides total
  ],
  "framework_slide": {{
    "title": "save-worthy summary or checklist title",
    "items": ["bullet 1", "bullet 2", ...],
    "image_concept": "..."
  }},
  "cta_slide": {{
    "headline": "soft brand line",
    "subline": "...",
    "image_concept": "minimal logo + warm background"
  }},
  "caption": "post caption with hashtags",
  "save_bait_score": 8
}}"""
    raw = gemini(prompt, json_mode=True, max_tokens=4000)
    try:
        d = robust_json(raw)
        d["topic_seed"] = topic
        return d
    except Exception as e:
        return {"topic_seed": topic, "error": str(e)[:200]}


def factory_ig():
    print("[ig] generating 20 carousels...")
    out_dir = STATE / "ig_carousels"
    out_dir.mkdir(exist_ok=True)
    results = []
    with ThreadPoolExecutor(max_workers=4) as ex:
        futs = {ex.submit(build_carousel, t): t for t in IG_TOPICS}
        for i, f in enumerate(as_completed(futs), 1):
            r = f.result()
            results.append(r)
            if "error" not in r:
                slug = re.sub(r"[^a-z0-9]+", "-", r["topic_seed"].lower()).strip("-")[:60]
                (out_dir / f"{slug}.json").write_text(json.dumps(r, indent=2))
            if i % 5 == 0:
                print(f"  {i}/20")
    (out_dir / "_index.json").write_text(json.dumps({"count": len(results)}, indent=2))
    print(f"[ig] wrote {len(results)} carousels to {out_dir}")


# ============================================================
# 4. Klaviyo flows
# ============================================================

KLAVIYO_PROMPT = """Generate Klaviyo email flow content for "Dark Fantasy" (bdsmpub.com) — body-safe luxury couples brand.

We need 3 flow bundles in one JSON output:

1. **welcome_flow** — 5 emails post quiz signup. Each email: subject_a (test variant), subject_b, preheader, body_html (250-450 words, conversational, with [LINK:pillar-slug] placeholders).
   - Email 1 (T+0): welcome + 10% off code + body-safe materials guide pillar
   - Email 2 (T+24h): aftercare encyclopedia pillar reveal
   - Email 3 (T+72h): segment-aware product recommendations (placeholder logic)
   - Email 4 (T+7d): beginner couples field guide pillar
   - Email 5 (T+14d): brand story / why we curate

2. **abandoned_cart_flow** — 3 emails. Same shape.
   - Email 1 (T+1h): "Still thinking it over?"
   - Email 2 (T+24h): 15% urgency code (24h only)
   - Email 3 (T+72h): "Last call" + social proof

3. **promo_bundle_flow** — 3 emails (template, used per bundle launch).
   - Email 1: launch announcement
   - Email 2 (T+3d): mid-promo urgency
   - Email 3 (T+1 day before end): last-call

RULES:
- Adult-niche compliant: no explicit terms in subject/preheader (inbox visibility)
- Education-led tone, not salesy
- Brand mention "Dark Fantasy" 1-2 times naturally per email
- 18+ acknowledgment in footer (one line)
- Use [LINK:slug] for pillar pages: body-safe-materials-guide, aftercare-encyclopedia, beginner-couples-field-guide
- Use {{first_name|default:'friend'}} placeholder
- All HTML inline (no <style>, no <head>)

Output STRICT JSON only:
{
  "welcome_flow": [...5 entries...],
  "abandoned_cart_flow": [...3 entries...],
  "promo_bundle_flow": [...3 entries...],
  "klaviyo_setup_notes": "1-paragraph implementation note for the team"
}"""


def factory_klaviyo():
    print("[klaviyo] generating flow content...")
    out_dir = STATE / "klaviyo_flows"
    out_dir.mkdir(exist_ok=True)
    raw = gemini(KLAVIYO_PROMPT, model="gemini-2.5-pro", json_mode=True, max_tokens=10000)
    try:
        d = robust_json(raw)
    except Exception as e:
        d = {"error": str(e)[:300], "raw_head": raw[:1500]}
    (out_dir / "flows.json").write_text(json.dumps(d, indent=2))
    print(f"[klaviyo] wrote {out_dir / 'flows.json'}")


# ============================================================
# 5. Quiz config (separate factory)
# ============================================================

QUIZ_PROMPT = """Design an 8-question email-capture quiz for "Dark Fantasy" (bdsmpub.com). Quiz output assigns user to one of 8 Klaviyo segments and triggers a tailored welcome flow.

Output STRICT JSON only:
{
  "quiz_title": "string",
  "quiz_subtitle": "1-line subtitle",
  "questions": [
    {
      "id": 1,
      "text": "the question shown",
      "type": "single_select | multi_select",
      "options": [{"label": "...", "value": "...", "segment_tag": "..."}, ...],
      "rationale": "why this question matters for segmentation"
    },
    ... 8 questions total
  ],
  "segments": [
    {"name": "...", "tags_required": [...], "description": "who this segment is", "welcome_flow": "default | luxury | beginner | wellness"}
    ... 8 segments
  ],
  "email_capture_step": {
    "headline": "final step headline",
    "subhead": "...",
    "incentive": "10% off + free pillar guide",
    "consent_text": "GDPR/CCPA compliant opt-in copy"
  },
  "shopify_implementation_notes": "1-paragraph spec for embedding the quiz"
}"""


def factory_quiz():
    print("[quiz] generating capture-quiz spec...")
    out_dir = STATE / "klaviyo_flows"
    out_dir.mkdir(exist_ok=True)
    raw = gemini(QUIZ_PROMPT, model="gemini-2.5-pro", json_mode=True, max_tokens=6000)
    try:
        d = robust_json(raw)
    except Exception as e:
        d = {"error": str(e)[:300], "raw_head": raw[:1500]}
    (out_dir / "quiz.json").write_text(json.dumps(d, indent=2))
    print(f"[quiz] wrote {out_dir / 'quiz.json'}")


# ============================================================
# 6. Affiliate program + outreach
# ============================================================

AFFILIATE_PROMPT = """Generate Shopify Collabs / Refersion affiliate program assets for "Dark Fantasy" (bdsmpub.com), targeting ALU-flaired Reddit sex educators.

Output STRICT JSON only:
{
  "commission_tiers": [
    {"tier_name": "Trial", "commission_pct": 15, "minimum_30d_revenue": 0, "perks": ["..."]},
    {"tier_name": "Standard", "commission_pct": 20, "minimum_30d_revenue": 500, "perks": [...]},
    {"tier_name": "Elite", "commission_pct": 25, "minimum_30d_revenue": 2500, "perks": [...]}
  ],
  "utm_convention": "string template for tracking links",
  "landing_page": {
    "url_slug": "/pages/affiliate-program",
    "hero_headline": "...",
    "hero_subhead": "...",
    "why_join": ["3 bullets"],
    "what_we_offer": ["5 bullets"],
    "who_we_want": "1 paragraph",
    "application_form_fields": ["name", "primary_platform", "audience_size", "..."],
    "cta_button": "...",
    "faq": [{"q": "...", "a": "..."}, ... 6 entries]
  },
  "outreach_templates": [
    {
      "archetype": "Reddit ALU sex-positive educator",
      "channel": "Reddit DM",
      "subject": "...",
      "body": "200-word DM that doesn't sound corporate",
      "follow_up_3_days": "100-word follow-up"
    },
    {"archetype": "TikTok faceless educator 25-50K", "channel": "TikTok DM / email", ...},
    {"archetype": "Instagram couples-wellness 10-50K", "channel": "IG DM", ...},
    {"archetype": "Sex-positive podcast host", "channel": "email", ...},
    {"archetype": "Substack newsletter writer (sex education niche)", "channel": "email", ...}
  ],
  "gifted_kit_default": {
    "skus_recommended": ["category 1", "category 2", "category 3"],
    "total_value_usd": 150,
    "packaging_note": "discreet luxury packaging — branded inside only"
  },
  "onboarding_email_after_signup": {
    "subject": "...",
    "body_html": "..."
  }
}"""


def factory_affiliate():
    print("[affiliate] generating program config + outreach templates...")
    out_dir = STATE / "affiliate_program"
    out_dir.mkdir(exist_ok=True)
    raw = gemini(AFFILIATE_PROMPT, model="gemini-2.5-pro", json_mode=True, max_tokens=8000)
    try:
        d = robust_json(raw)
    except Exception as e:
        d = {"error": str(e)[:300], "raw_head": raw[:1500]}
    (out_dir / "program.json").write_text(json.dumps(d, indent=2))
    print(f"[affiliate] wrote {out_dir / 'program.json'}")


# ============================================================
# Run everything
# ============================================================

if __name__ == "__main__":
    import sys
    factories = {
        "pinterest": factory_pinterest,
        "tiktok": factory_tiktok,
        "ig": factory_ig,
        "klaviyo": factory_klaviyo,
        "quiz": factory_quiz,
        "affiliate": factory_affiliate,
    }
    targets = sys.argv[1:] if len(sys.argv) > 1 else list(factories.keys())
    for name in targets:
        if name in factories:
            try:
                factories[name]()
            except Exception as e:
                print(f"[{name}] FAILED: {e}")
        else:
            print(f"unknown factory: {name}")
