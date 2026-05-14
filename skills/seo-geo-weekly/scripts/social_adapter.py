"""Adapt blog drafts into platform-native posts: X threads, TikTok scripts, IG carousels, Pinterest pins.

Per platform constraints from Channel-Plays.md:
- X: thread (8 tweets), tone permissive
- TikTok: 30–60s script with hook + 2 facts + CTA
- IG: carousel slides (8) with caption
- Pinterest: 5 pin variations with title + description per blog post

NEVER explicit. Adult-wellness brands have unique platform constraints.
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


def gemini(prompt: str, max_tokens: int = 2000) -> str:
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
    with urllib.request.urlopen(req, timeout=60) as r:
        d = json.loads(r.read().decode())
    parts = d.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    return "".join(p.get("text", "") for p in parts).strip()


PLATFORMS = {
    "x_thread": {
        "constraint": "Adult-wellness OK on X. 8 tweets, each ≤270 chars. Number them 1/8 etc. Hook tweet must stop the scroll.",
        "tone": "founder build-in-public, hot-take welcome, educational",
        "format": "Tweet 1 (the hook):\\n[content]\\n\\nTweet 2:\\n[content]\\n\\n...etc",
    },
    "tiktok_script": {
        "constraint": "30–60s reel script. NO explicit imagery; educational angle only. TikTok adult policy is strict.",
        "tone": "myth-debunk or 'most people don't know' angle",
        "format": "HOOK (0–3s):\\n[hook]\\nMID (3–45s):\\n[script]\\nCTA (45–60s):\\n[soft CTA, link in bio]",
    },
    "ig_carousel": {
        "constraint": "8 slides. IG aggressive on adult content; aesthetic-first, words on slides minimal.",
        "tone": "lifestyle-aesthetic, body-positive, inclusive",
        "format": "Slide 1 (cover):\\nText overlay: [text]\\nVisual brief: [description]\\n\\n...etc 8 slides\\n\\nCAPTION:\\n[200 word caption with hashtags at bottom]",
    },
    "pinterest_pins": {
        "constraint": "5 pin variations. Pinterest accepts adult-adjacent if not explicit. Aesthetic mood-board angle.",
        "tone": "evergreen, gift-guide friendly, search-intent",
        "format": "Pin 1:\\nTitle (60 chars): [title]\\nDescription (300 chars with keywords): [desc]\\n\\n...etc 5 pins",
    },
}


def adapt(blog_topic: dict, platform_key: str, brand: str = "Dark Fantasy") -> str:
    p = PLATFORMS[platform_key]
    return gemini(f"""Adapt this blog post for {platform_key.replace('_', ' ')}.

Blog title: {blog_topic['title']}
Target keyword: {blog_topic['kw']}
Intent: {blog_topic['intent']}
Brand: {brand}

Platform constraints: {p['constraint']}
Tone: {p['tone']}
Required output format:
{p['format']}

Rules:
1. Educational not promotional. The brand is body-safe premium intimate wellness; sex-positive consumer audience.
2. Never explicit, graphic, or NSFW imagery descriptions. Adult-platform policies prohibit.
3. Match the platform's native voice — what would a real {platform_key.replace('_', ' ')} creator post?
4. Sign off (where relevant) as "the {brand} team", NEVER personal names.
5. Output the content only — no preamble, no commentary.""")


def run(blogs_dir: Path, out_dir: Path, brand: str = "Dark Fantasy") -> dict:
    topics = []
    for f in sorted(blogs_dir.glob("*.md")):
        if f.name == "_index.md":
            continue
        text = f.read_text()
        m = re.match(r"---\s*\n(.*?)\n---", text, re.DOTALL)
        if not m:
            continue
        fm = {}
        for line in m.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                fm[k.strip()] = v.strip().strip('"')
        topics.append({
            "title": fm.get("title", ""),
            "kw": fm.get("target_keyword", ""),
            "intent": fm.get("intent", ""),
            "slug": fm.get("slug", ""),
        })

    out_dir.mkdir(parents=True, exist_ok=True)
    results = {}

    for plat in PLATFORMS:
        plat_dir = out_dir / plat
        plat_dir.mkdir(exist_ok=True)
        for topic in topics:
            print(f"      [{plat}] {topic['title'][:50]}")
            try:
                content = adapt(topic, plat, brand)
                (plat_dir / f"{topic['slug']}.md").write_text(
                    f"# {topic['title']}\n\n"
                    f"**Platform:** {plat.replace('_', ' ')}\n"
                    f"**Target keyword:** {topic['kw']}\n\n"
                    f"---\n\n{content}\n"
                )
            except Exception as e:
                (plat_dir / f"{topic['slug']}.md").write_text(f"# {topic['title']}\n\nError: {str(e)[:200]}")
            time.sleep(0.7)
        results[plat] = len(topics)

    return results


if __name__ == "__main__":
    import sys
    blogs = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / "Documents/Obsidian/01-Projects/Dark-Fantasy-SEO-GEO-Weekly/Drafts" / dt.date.today().isoformat()
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path.home() / "Documents/Obsidian/01-Projects/Dark-Fantasy-SEO-GEO-Weekly/Social"
    print(json.dumps(run(blogs, out), indent=2))
