"""Generate internal-link inserts for existing 12 blog drafts.

For each draft, identify relevant product mentions or topical cues, then propose
3-5 internal-link insertions to: top 10 products, 3 pillar pages, 6 collection landing pages.

Output: state/<date>/internal_link_inserts.json — keyed by blog draft filename, each
entry has a list of {anchor_text, target_url, insertion_paragraph_hint}.
"""
import json
import re
import time
import urllib.request
from pathlib import Path

CREDS = Path.home() / ".claude/credentials.json"
DRAFTS_DIR = Path("/Users/xiaozuo/Documents/Obsidian/01-Projects/Dark-Fantasy-SEO-GEO-Weekly/Drafts/2026-05-08")
STATE = Path("/Users/xiaozuo/.claude/skills/seo-geo-weekly/state/2026-05-11")

# Top link targets (pillar + landing pages)
LINK_TARGETS = [
    {"url": "/pages/body-safe-materials-guide", "title": "The Body-Safe Materials Guide (2026 Edition)", "topic": "materials, silicone, body-safe, phthalate, durometer"},
    {"url": "/pages/aftercare-encyclopedia", "title": "The Aftercare Encyclopedia: A Couples Field Guide", "topic": "aftercare, recovery, subdrop, reconnection, post-intimacy"},
    {"url": "/pages/beginner-couples-field-guide", "title": "The Beginner Couples Field Guide", "topic": "beginner, first time, exploration, communication, yes-no-maybe"},
    {"url": "/pages/first-step-set", "title": "First Step Set Bundle", "topic": "beginner couples kit, starter bundle"},
    {"url": "/pages/memorial-day-reset", "title": "Memorial Day Reset Bundle", "topic": "aftercare bundle, wellness reset"},
    {"url": "/pages/pride-box-2026", "title": "Pride Box 2026 Bundle", "topic": "Pride, LGBTQ+, inclusive"},
    {"url": "/pages/anniversary-luxury-set", "title": "Anniversary Luxury Set Bundle", "topic": "anniversary, luxury, premium"},
    {"url": "/pages/couples-gift-pack", "title": "Couples Gift Pack Bundle", "topic": "couples gift, Father's Day"},
    {"url": "/pages/travel-discreet-kit", "title": "Travel & Discreet Kit Bundle", "topic": "travel, discreet, summer, TSA"},
    {"url": "/collections/silicone-vibrators", "title": "Silicone Vibrators Collection", "topic": "silicone, body-safe vibrators"},
    {"url": "/collections/couples-toys", "title": "Couples Toys Collection", "topic": "couples toys"},
    {"url": "/collections/lubricants", "title": "Lubricants Collection", "topic": "lubricant, water-based"},
]


def _gemini_key():
    return json.loads(CREDS.read_text())["api_keys"]["gemini"]


def gemini(prompt: str, max_tokens: int = 4000) -> str:
    key = _gemini_key()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}"
    body = {"contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.4, "maxOutputTokens": max_tokens, "responseMimeType": "application/json"}}
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=60) as r:
        d = json.loads(r.read().decode())
    parts = d.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    return "".join(p.get("text", "") for p in parts).strip()


def propose_links_for_draft(draft_path: Path) -> dict:
    content = draft_path.read_text()
    # Strip yaml frontmatter
    if content.startswith("---"):
        _, fm, body = content.split("---", 2)
    else:
        body = content
    excerpt = body[:5000]

    targets_str = "\n".join(f"- {t['url']} → {t['title']} (relevant when discussing: {t['topic']})" for t in LINK_TARGETS)

    prompt = f"""You are an internal-link strategist for "Dark Fantasy" (bdsmpub.com).

Below is a blog draft. Identify 4-6 places where natural internal links should be inserted to deepen reader engagement and pass SEO authority through the site.

Available link targets:
{targets_str}

Blog draft excerpt:
{excerpt}

OUTPUT a strict JSON object only:
{{
  "draft_filename": "{draft_path.name}",
  "links": [
    {{
      "anchor_text": "<2-5 words from the actual draft text — quote exactly so it can be string-matched>",
      "target_url": "<one of the URLs above>",
      "rationale": "<one sentence why this link adds reader value>",
      "paragraph_hint": "<10-15 word excerpt of the surrounding paragraph for context>"
    }}
  ]
}}

Pick 4-6 links. Each anchor text MUST appear verbatim in the draft text. Diversify targets — don't link to the same target twice."""
    raw = gemini(prompt).strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1].lstrip("json").strip()
    try:
        return json.loads(raw)
    except Exception as e:
        return {"draft_filename": draft_path.name, "error": str(e)[:200], "raw": raw[:500]}


def run():
    STATE.mkdir(parents=True, exist_ok=True)
    drafts = sorted([p for p in DRAFTS_DIR.glob("*.md") if not p.name.startswith("_")])
    print(f"[internal-links] processing {len(drafts)} drafts")
    results = []
    for d in drafts:
        try:
            r = propose_links_for_draft(d)
            results.append(r)
            link_count = len(r.get("links", []))
            print(f"  {d.name}: {link_count} links proposed")
        except Exception as e:
            results.append({"draft_filename": d.name, "error": str(e)[:200]})
        time.sleep(0.5)
    out = STATE / "internal_link_inserts.json"
    out.write_text(json.dumps({"generated_at": time.time(), "drafts_count": len(results), "results": results}, indent=2))
    print(f"[internal-links] wrote {out}")


if __name__ == "__main__":
    run()
