"""BDSM + relationship fun-topic content factory.

Generates 30 content briefs (multi-platform) + 50 Imagen images + 60 Reddit
comment drafts in parallel.

Output: state/2026-05-14/
"""
import base64
import json
import re
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

CREDS = Path.home() / ".claude/credentials.json"
STATE = Path("/Users/xiaozuo/.claude/skills/seo-geo-weekly/state/2026-05-14")
STATE.mkdir(parents=True, exist_ok=True)


def _key():
    return json.loads(CREDS.read_text())["api_keys"]["gemini"]


def gemini(prompt: str, max_tokens: int = 8000, json_mode: bool = False, model: str = "gemini-2.5-flash") -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={_key()}"
    cfg = {"temperature": 0.6, "maxOutputTokens": max_tokens}
    if json_mode:
        cfg["responseMimeType"] = "application/json"
    body = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": cfg}
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=180) as r:
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
        last = raw.rfind("}")
        while last > 0:
            try:
                return json.loads(raw[: last + 1])
            except Exception:
                last = raw.rfind("}", 0, last)
        raise ValueError("unparseable")


# ============================================================
# 30 BDSM + relationship fun-topic content briefs
# ============================================================

TOPICS = [
    "Shibari knot of the week: single column tie",
    "Spreader bar 101: what they're for and how to start",
    "Couples flogger guide: choosing your first impact tool",
    "Afterglow rituals: what to do in the 30 minutes after a scene",
    "Beginner BDSM scene setup (under $100)",
    "The yes/no/maybe list — kink edition",
    "Negotiation 101 for new D/s dynamics",
    "Wax play safety: the candle every beginner should buy",
    "Restraint materials compared: rope vs cuffs vs silk",
    "How to introduce a new kink to a long-term partner",
    "Sensory deprivation 101: blindfold + headphone basics",
    "Sub frenzy and how to recognize it before a scene",
    "Top drop: it's real, here's how partners handle it",
    "Aftercare for solo play (yes, it matters)",
    "What 'green/yellow/red' actually means (and why couples use it)",
    "First-time impact play: where to hit, where to avoid",
    "Predicament bondage explained for beginners",
    "Power exchange beyond the bedroom: tiny rituals that build trust",
    "Bondage rope materials: jute vs hemp vs cotton compared",
    "The lazy person's afterglow ritual",
    "Service kink for couples who hate chores",
    "How to tell if you're a switch (and what to do about it)",
    "Rope marks: what's normal, what's a flag",
    "Why we use stoplight check-ins outside of scenes too",
    "Petplay basics: not what you think",
    "Edging for couples: the 4-minute version",
    "The 5 phrases every D-type should know",
    "Aftercare playlist: 30 minutes of soft transition",
    "Travel-friendly kink gear: TSA-tested loadout",
    "Date night → scene transition: how to shift the energy without awkwardness",
]


def build_brief(topic: str) -> dict:
    prompt = f"""Generate a multi-platform content brief for Dark Fantasy (bdsmpub.com), a body-safe luxury BDSM + couples wellness brand. Topic: "{topic}".

Output STRICT JSON only:
{{
  "topic": "{topic}",
  "platforms_safe": {{
    "instagram": true | false (whether this can post on IG without ban),
    "tiktok": true | false (whether this can post without AIGC/adult flag),
    "pinterest_main": false (Pinterest TOS bans BDSM — always false),
    "pinterest_sister": true | false (whether sanitized version is possible for @curated.intimacy),
    "reddit": true,
    "blog": true
  }},
  "instagram_carousel": {{
    "slide_count": 8,
    "hook_slide": "10-word bold headline",
    "education_slides": ["5-7 entries, each 15-30 words"],
    "framework_slide": "save-worthy summary",
    "cta_slide": "soft Dark Fantasy mention",
    "caption": "120-180 char + 6 hashtags from #BDSMeducation #CouplesKink #BodySafe #KinkPositive #RelationshipRituals #IntimacyEducation"
  }},
  "tiktok_script": {{
    "hook_3s": "first 3 seconds spoken/text overlay",
    "voiceover": "18-30s natural voiceover script",
    "b_roll_shots": ["6-8 shot descriptions, faceless"],
    "cta": "3-5s call-to-action",
    "caption": "with safe hashtags",
    "aigc_label_required": true
  }},
  "reddit_comment_angle": {{
    "best_sub": "r/BDSMcommunity | r/sex | r/sextoys | r/sexover30",
    "trigger_question_archetype": "the kind of OP question this would answer",
    "draft_comment": "80-150 word helpful comment, NO links, NO brand mentions, NO product pushes",
    "value_angle": "what value this comment adds"
  }},
  "blog_post": {{
    "h1": "8-12 word SEO title",
    "meta_description": "140-160 char",
    "estimated_word_count": 1200,
    "outline": ["6-8 h2 sections"]
  }},
  "imagen_safe_prompt": "A short Imagen prompt that's safe for content-filter — NO bodies, NO explicit, ONLY objects/textures/lighting. 50-80 words.",
  "imagen_evocative_prompt": "A more evocative version for image gen — still no explicit imagery but more atmospheric (silk, rope, leather, candlelight, hands partial)",
  "discoverability_tags": ["6-10 keyword tags for content database search"]
}}"""
    raw = gemini(prompt, json_mode=True, max_tokens=4000)
    try:
        d = robust_json(raw)
        return d
    except Exception as e:
        return {"topic": topic, "error": str(e)[:200]}


def factory_briefs():
    print("[briefs] generating 30 BDSM+relationship content briefs...")
    out_dir = STATE / "content_briefs"
    out_dir.mkdir(exist_ok=True)
    results = []
    with ThreadPoolExecutor(max_workers=5) as ex:
        futs = {ex.submit(build_brief, t): t for t in TOPICS}
        for f in as_completed(futs):
            r = f.result()
            results.append(r)
            if "error" not in r:
                slug = re.sub(r"[^a-z0-9]+", "-", r["topic"].lower()).strip("-")[:60]
                (out_dir / f"{slug}.json").write_text(json.dumps(r, indent=2))
    (out_dir / "_index.json").write_text(json.dumps({"count": len(results), "topics": [r.get("topic","") for r in results]}, indent=2))
    print(f"[briefs] wrote {len(results)} briefs")
    return results


# ============================================================
# 50 Imagen images (BDSM/relationship visual library)
# ============================================================

IMAGEN_URL = "https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict"

IMAGE_PROMPTS = [
    # Materials / objects (safe and evocative)
    "A coil of natural jute rope on a dark walnut surface, single candle burning warm, dramatic side lighting, editorial photography, cinematic depth",
    "Black leather cuffs with brass hardware arranged on velvet, dark moody lighting, luxury close-up photography",
    "Three lengths of natural hemp rope vs polished cotton rope vs jute, comparison flatlay on charcoal slate",
    "A silk blindfold draped over a leather-bound journal, candlelight, brushed gold accents, editorial mood",
    "Black silk ribbon tied in an artistic knot, single low-angle warm light, minimal composition",
    "Polished steel cuffs hanging from a wooden peg in shallow focus, dim warm light, luxury catalog style",
    "A flogger made of soft suede, arranged in a circular fan shape on a marble surface, ambient lighting",
    "A handcrafted wooden paddle resting on linen, soft natural light, artisan editorial",
    "Velvet rope coiled into a spiral on dark concrete, side lighting creates dramatic shadows",
    "Leather collar with O-ring on a leather-wrapped display stand, dark library backdrop",
    # Aftercare / wellness mood
    "A folded silk blanket beside a glass of water and dark chocolate squares, warm candlelight, soft focus",
    "Two ceramic mugs on a marble counter beside a folded silk throw, morning light, intimate domestic",
    "A bath drawn with rose petals and dim candles, no people, evocative wellness",
    "An open journal with two fountain pens beside a glass tumbler, soft amber lamplight",
    "A pile of crisp white linen towels beside a brass candelabra, spa mood, cinematic",
    "Eye mask, lavender sprigs, and a glass of water arranged on dark wood, soft early light",
    # Beginner / educational mood
    "A vintage leather suitcase open on a velvet chaise, contents partially visible (silk, journal, ribbon), warm lamp light",
    "An array of body-safe materials (silicone, glass, stainless steel) arranged on dark marble, scientific catalog style",
    "A handwritten yes/no/maybe checklist on linen paper beside a candle and a fountain pen, intimate desk shot",
    "A library shelf with leather-bound books on intimacy, philosophy, psychology — dim warm lamp",
    # Shibari / rope work (objects only)
    "Natural jute rope coiled in a Japanese-style spiral on tatami, single hanging lantern, minimal",
    "Macro photograph of rope fibers, dramatic side lighting, texture study",
    "A finished shibari knot pattern photographed against velvet backdrop, no body, art object focus",
    "Three different rope diameters arranged in concentric circles, top-down composition, charcoal background",
    # Luxury / atmospheric
    "A velvet chaise lounge in a dark library, single floor lamp, leather and brass accents",
    "Brushed gold chains arranged in a fan on black silk, jewelry catalog mood",
    "A glass decanter half-filled with amber liquid beside crystal tumblers, warm bar lighting",
    "Hand-stitched velvet jewelry pouches in deep burgundy and forest green, leather tray, luxury editorial",
    "A wax-sealed envelope on dark wood beside a fountain pen and inkwell, vintage romantic",
    "Heavy gold chain coiled into a circle on black marble, single overhead light, dramatic shadows",
    # Travel / discreet
    "A small leather travel case open showing folded silk garments and a notebook, hotel-room mood",
    "Travel-sized glass bottles on a marble bathroom counter with warm mirror light",
    "A folded silk scarf and leather passport holder on a wooden tray, morning travel mood",
    # Power exchange / philosophical (no people)
    "A queen chess piece on a velvet board, dramatic single light, contemplative composition",
    "Two intertwined silk ribbons forming an infinity loop on dark marble",
    "A vintage hourglass with dark sand mid-pour, single warm light, time as ritual",
    "An ornate brass key resting on a leather book, single candle, mysterious mood",
    # Sensory / play
    "A single dripping candle making slow wax pour onto a textured surface, dramatic warm light",
    "A peacock feather on dark velvet, single overhead spotlight, sensory study",
    "An ice cube on a polished slate slab, melting slowly, single cool blue light",
    # Communication / ritual
    "A small handwritten note tucked into a leather notebook, candlelight, intimate handwriting",
    "Two glasses of red wine on a low coffee table, fire glow from off-frame, evening conversation",
    "A folded piece of paper with handwritten checklist on linen, candlelight",
    # Brand mood
    "Dark Fantasy logo concept: gothic serif typography in brushed gold on charcoal velvet, single warm spotlight",
    "Black ribbon wrapped around a luxury cardboard packaging box, wax seal in deep red",
    "An apothecary shelf with glass bottles labeled in vintage handwriting, dim warm light",
    # Couples-implied without bodies
    "Two coffee mugs and a single folded silk pillowcase on a tray, morning light, intimate domestic",
    "A leather chair with a folded silk robe draped over the back, single floor lamp",
    "Two empty wine glasses on a low table, candlelight, conversation atmosphere",
    "A pair of leather slippers beside a sheepskin rug, fireplace glow, cozy intimate",
    "Two folded leather journals stacked, ribbon bookmarks, single candle, scholarly intimate mood",
]


def generate_image(prompt: str, ratio: str = "3:4") -> bytes:
    url = f"{IMAGEN_URL}?key={_key()}"
    body = {"instances": [{"prompt": prompt}],
            "parameters": {"sampleCount": 1, "aspectRatio": ratio, "personGeneration": "DONT_ALLOW"}}
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            d = json.loads(r.read().decode())
        preds = d.get("predictions", [])
        if not preds:
            return None
        b64 = preds[0].get("bytesBase64Encoded")
        return base64.b64decode(b64) if b64 else None
    except Exception:
        return None


def factory_images():
    print(f"[images] generating {len(IMAGE_PROMPTS)} brand visuals via Imagen 4...")
    out_dir = STATE / "content_images"
    out_dir.mkdir(exist_ok=True)
    results = []

    def gen_one(idx: int, prompt: str):
        slug = re.sub(r"[^a-z0-9]+", "-", prompt[:50].lower()).strip("-")
        out = out_dir / f"{idx:02d}-{slug}.png"
        if out.exists() and out.stat().st_size > 50000:
            return {"idx": idx, "status": "cached"}
        img = generate_image(prompt)
        if img:
            out.write_bytes(img)
            return {"idx": idx, "status": "ok", "size": len(img)}
        return {"idx": idx, "status": "fail", "prompt": prompt[:80]}

    with ThreadPoolExecutor(max_workers=3) as ex:
        futs = {ex.submit(gen_one, i, p): i for i, p in enumerate(IMAGE_PROMPTS)}
        for f in as_completed(futs):
            r = f.result()
            results.append(r)
            sym = {"ok": "✓", "cached": "~", "fail": "✗"}.get(r["status"], "?")
            print(f"  {sym} {r['idx']:02d}")

    ok = sum(1 for r in results if r["status"] in ("ok", "cached"))
    (out_dir / "_index.json").write_text(json.dumps({"count": len(results), "ok": ok, "results": results}, indent=2))
    print(f"[images] {ok}/{len(results)} generated")


# ============================================================
# 60 Reddit-ready comment drafts (BDSM + relationship)
# ============================================================

REDDIT_BATCHES = [
    {"sub": "r/BDSMcommunity", "count": 15, "focus": "aftercare protocols, negotiation, beginner BDSM questions, materials/rope safety, subdrop, topdrop"},
    {"sub": "r/sextoys", "count": 12, "focus": "body-safe materials questions, beginner couples kit questions, comparison questions, motor/durometer questions"},
    {"sub": "r/sex", "count": 10, "focus": "communication scripts, mismatched desire, aftercare framework, introducing new things to partner"},
    {"sub": "r/sexover30", "count": 8, "focus": "long-term intimacy, life-phase changes, anniversary intimacy, reset rituals after parenting/work stress"},
    {"sub": "r/relationship_advice", "count": 5, "focus": "intimacy in larger relationship context, communication scripts, conflict de-escalation"},
    {"sub": "r/DeadBedrooms", "count": 5, "focus": "gentle non-judgmental reframes, soft-reset rituals, ED reinitiation, hope without toxicity"},
    {"sub": "r/AskRedditAfterDark", "count": 5, "focus": "education-led answers, framework-based, NEVER product mentions"},
]


def build_reddit_batch(batch: dict, start_id: int) -> dict:
    prompt = f"""Generate {batch['count']} Reddit comment templates for Dark Fantasy's u/No_Register151 account.

Sub: {batch['sub']}
Focus: {batch['focus']}

CRITICAL:
- NO links to bdsmpub.com or any commercial site
- NO mention of "Dark Fantasy" by name
- NO product names by brand
- 80-180 words each
- Educational, helpful, value-adding
- Read as thoughtful peer in community, not a brand
- Each comment a unique angle (research, lived experience, framework, contrarian, reassuring)

Output STRICT JSON only:
{{
  "comments": [
    {{
      "id": {start_id},
      "target_sub": "{batch['sub']}",
      "trigger_question_archetype": "1-sentence description of the OP question this answers",
      "comment_text": "the full comment (single line, escape \\\\n)",
      "value_angle": "what value this adds",
      "tone": "warm-direct | analytical | reassuring | compassionate",
      "risk_flags": "any rule-violation risk"
    }}
  ]
}}
"""
    raw = gemini(prompt, json_mode=True, max_tokens=10000)
    try:
        d = robust_json(raw)
        return d
    except Exception as e:
        return {"error": str(e)[:200], "sub": batch["sub"]}


def factory_reddit_comments():
    print("[reddit] generating 60 comment drafts...")
    all_comments = []
    next_id = 1
    with ThreadPoolExecutor(max_workers=4) as ex:
        futs = {}
        cur = 1
        for b in REDDIT_BATCHES:
            futs[ex.submit(build_reddit_batch, b, cur)] = b
            cur += b["count"]
        for f in as_completed(futs):
            b = futs[f]
            r = f.result()
            if "error" in r:
                print(f"  ✗ {b['sub']}: {r['error'][:80]}")
            else:
                cs = r.get("comments", [])
                all_comments.extend(cs)
                print(f"  ✓ {b['sub']}: {len(cs)} comments")
    out = {"count": len(all_comments), "comments": all_comments}
    (STATE / "reddit_bdsm_comment_library.json").write_text(json.dumps(out, indent=2))
    # Markdown
    md = ["# Reddit Comment Library — BDSM + Relationship Topics", "",
          f"Total: {len(all_comments)} drafts. Generated 2026-05-14.", "",
          "**Use as inspiration only. NO links. NO brand mentions. NO product names.**", ""]
    by_sub = {}
    for c in all_comments:
        by_sub.setdefault(c.get("target_sub", "unknown"), []).append(c)
    for sub, lst in by_sub.items():
        md.append(f"## {sub} ({len(lst)} drafts)")
        md.append("")
        for c in lst:
            md.append(f"### #{c.get('id')} — {c.get('trigger_question_archetype', '')}")
            md.append(f"_Tone: {c.get('tone','')} · Value: {c.get('value_angle','')}_")
            if c.get("risk_flags"):
                md.append(f"⚠️ **Risk:** {c['risk_flags']}")
            md.append("")
            md.append(c.get("comment_text", "").replace("\\n", "\n"))
            md.append("")
            md.append("---")
            md.append("")
    (STATE / "reddit_bdsm_comment_library.md").write_text("\n".join(md))
    print(f"[reddit] wrote {len(all_comments)} comments")


# ============================================================
# Run all
# ============================================================

if __name__ == "__main__":
    import sys
    available = {
        "briefs": factory_briefs,
        "images": factory_images,
        "reddit": factory_reddit_comments,
    }
    targets = sys.argv[1:] if len(sys.argv) > 1 else list(available.keys())
    for name in targets:
        if name in available:
            try:
                available[name]()
            except Exception as e:
                print(f"[{name}] FAILED: {e}")
