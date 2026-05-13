"""Adapt blog drafts into Reddit-compliant educational comments / posts.

Compliant playbook (per Channel-Plays.md):
- 90% participation : 10% link drops
- Educational answers, no product pitch
- Per-sub tone & rules baked in

Outputs:
- comment_templates.md: 5 educational comments per blog topic, ready to paste when relevant threads come up
- self_post_drafts.md: occasional self-posts (with merchant flair where allowed)
"""
import datetime as dt
import json
import time
import urllib.request
from pathlib import Path

CREDS_PATH = Path.home() / ".claude/credentials.json"

SUBREDDITS = [
    {
        "name": "r/sextoys",
        "members": "1.2M",
        "tone": "earnest, recommendation-friendly, brand mentions allowed",
        "rules": "merchant flair required for verified sellers; one self-link per week max",
    },
    {
        "name": "r/BDSMcommunity",
        "members": "250K",
        "tone": "experience-based, no promotion, education welcome",
        "rules": "strict no-promotion rule; answer questions earnestly; no product links in comments",
    },
    {
        "name": "r/sex",
        "members": "3M",
        "tone": "general, mainstream, educational",
        "rules": "no direct promo; linking to your educational blog is fine if relevant; no product pages",
    },
    {
        "name": "r/sexover30",
        "members": "650K",
        "tone": "older audience, thoughtful, longform answers welcomed",
        "rules": "promo gets removed; educational comments with light bio mention OK",
    },
]


def _gemini_key() -> str:
    return json.loads(CREDS_PATH.read_text())["api_keys"]["gemini"]


def gemini(prompt: str, max_tokens: int = 1500) -> str:
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


def adapt_for_sub(blog_topic: dict, sub: dict, brand: str) -> str:
    return gemini(f"""Write 3 different Reddit comment templates that {brand}'s founder could paste when an organic thread on {sub['name']} discusses the topic below. Each comment must:

- Be 80–180 words
- Sound like a thoughtful person, not a brand. NEVER use marketing voice.
- Lead with a personal-sounding observation or experience-based take
- Include 1 educational nugget (something most users wouldn't know)
- Optionally end with a soft hook (e.g., "I wrote a longer breakdown if useful — happy to share")
- NEVER drop a product link or promotional language
- Match the sub's tone exactly: {sub['tone']}
- Follow the sub's rules: {sub['rules']}

Topic the comments respond to: {blog_topic['title']}
Target keyword from the blog: {blog_topic['kw']}

Output 3 numbered comments separated by '---'. No preamble, no commentary.""")


def adapt_self_post(topic: dict, sub: dict, brand: str) -> str:
    return gemini(f"""Write a self-post draft for {sub['name']} from {brand}'s founder/expert. Educational, NOT promotional. The post:

- Title: 60–90 chars, sounds like an Ask Reddit / share-experience post
- Body: 200–400 words, written in first person, sounds human
- Frames a topic from your industry expertise without pitching
- Ends with a genuine question to invite engagement
- Author flair (where supported): "Founder, {brand}" or "Sex-positive merchant"
- Sub rules: {sub['rules']}

Topic to cover: {topic['title']}
Tone: {sub['tone']}

Output format:
TITLE: <title>
BODY:
<body>

That's it. No preamble.""")


def run(blogs_dir: Path, out_dir: Path, brand: str = "Dark Fantasy") -> dict:
    """Read blog topic metadata from drafts dir; produce Reddit content."""
    topics = []
    for f in sorted(blogs_dir.glob("*.md")):
        if f.name == "_index.md":
            continue
        text = f.read_text()
        # Parse frontmatter
        import re as _re
        m = _re.match(r"---\s*\n(.*?)\n---", text, _re.DOTALL)
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
        })

    out_dir.mkdir(parents=True, exist_ok=True)

    # Comment templates: 1 per blog × top-2 subs
    comment_md = [f"# Reddit Comment Templates — {dt.date.today().isoformat()}", ""]
    comment_md.append("> Paste-ready comments for {brand}. Use ONLY when an organic thread comes up that fits.")
    comment_md.append("> Maintain 90% participation : 10% link drops ratio.")
    comment_md.append("")

    for topic in topics[:6]:  # 6 blogs × 2 subs = 12 comment sets
        comment_md.append(f"## Topic: {topic['title']}")
        comment_md.append(f"**Keyword:** `{topic['kw']}`")
        comment_md.append("")
        for sub in SUBREDDITS[:2]:
            print(f"      [reddit] {sub['name']} — {topic['title'][:50]}")
            try:
                comments = adapt_for_sub(topic, sub, brand)
                comment_md.append(f"### {sub['name']} ({sub['members']})")
                comment_md.append(f"*{sub['rules']}*")
                comment_md.append("")
                comment_md.append(comments)
                comment_md.append("")
            except Exception as e:
                comment_md.append(f"### {sub['name']} — error: {str(e)[:100]}")
                comment_md.append("")
            time.sleep(1)
        comment_md.append("---")
        comment_md.append("")

    (out_dir / "Reddit-Comment-Templates.md").write_text("\n".join(comment_md))

    # Self-post drafts: 3 high-quality
    posts_md = [f"# Reddit Self-Post Drafts — {dt.date.today().isoformat()}", ""]
    posts_md.append("> Educational self-posts. Use sparingly — max 1 per sub per month.")
    posts_md.append("")
    for topic in topics[:3]:
        for sub in SUBREDDITS[:2]:
            print(f"      [reddit-post] {sub['name']} — {topic['title'][:50]}")
            try:
                post = adapt_self_post(topic, sub, brand)
                posts_md.append(f"## {sub['name']} — {topic['title']}")
                posts_md.append("")
                posts_md.append(post)
                posts_md.append("")
                posts_md.append("---")
                posts_md.append("")
            except Exception as e:
                posts_md.append(f"## {sub['name']} — error: {str(e)[:100]}")
            time.sleep(1)

    (out_dir / "Reddit-Self-Posts.md").write_text("\n".join(posts_md))
    return {"comments_file": str(out_dir / "Reddit-Comment-Templates.md"),
            "posts_file": str(out_dir / "Reddit-Self-Posts.md"),
            "topics_processed": len(topics[:6])}


if __name__ == "__main__":
    import sys
    blogs = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / "Documents/Obsidian/01-Projects/Dark-Fantasy-SEO-GEO-Weekly/Drafts" / dt.date.today().isoformat()
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path.home() / "Documents/Obsidian/01-Projects/Dark-Fantasy-SEO-GEO-Weekly/Reddit"
    print(json.dumps(run(blogs, out), indent=2))
