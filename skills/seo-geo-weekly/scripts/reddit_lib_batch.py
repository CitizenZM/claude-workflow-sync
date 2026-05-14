"""Reddit comment library — batched 10-at-a-time to dodge token-truncation."""
import json
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

CREDS = Path.home() / ".claude/credentials.json"
STATE = Path("/Users/xiaozuo/.claude/skills/seo-geo-weekly/state/2026-05-13")

BATCHES = [
    {"sub": "r/sextoys", "count": 12, "focus": "body-safe materials, beginner questions, comparison questions, cleaning, durometer", "tone": "warm analytical"},
    {"sub": "r/sex", "count": 10, "focus": "communication, aftercare, mismatched desire, sensory exploration", "tone": "warm-direct"},
    {"sub": "r/sexover30", "count": 8, "focus": "long-term relationship intimacy, life-phase changes, resets, parenting impact", "tone": "reassuring peer"},
    {"sub": "r/BDSMcommunity", "count": 8, "focus": "aftercare, negotiation, beginner questions, safety, NEVER products", "tone": "respectful expert"},
    {"sub": "r/relationship_advice", "count": 5, "focus": "intimacy in broader relational context, communication, conflict", "tone": "thoughtful peer"},
    {"sub": "r/DeadBedrooms", "count": 5, "focus": "gentle, non-judgmental, framework-based, hope without toxicity", "tone": "compassionate"},
    {"sub": "r/AskWomenOver30", "count": 2, "focus": "ONLY if framed as women-only voice — risky, skip if uncertain", "tone": "peer"},
]


def _key():
    return json.loads(CREDS.read_text())["api_keys"]["gemini"]


def gemini(prompt: str, max_tokens: int = 8000) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={_key()}"
    body = {"contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.6, "maxOutputTokens": max_tokens, "responseMimeType": "application/json"}}
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
    # Truncate to last valid close brace
    last = raw.rfind("}")
    while last > 0:
        try:
            return json.loads(raw[: last + 1])
        except Exception:
            last = raw.rfind("}", 0, last)
    raise ValueError(f"unparseable: {raw[:200]}")


def build_batch(batch: dict, start_id: int) -> dict:
    prompt = f"""Generate {batch['count']} Reddit comment templates for Dark Fantasy karma warmup (NO links, NO brand mentions, NO product names).

Sub: {batch['sub']}
Focus: {batch['focus']}
Tone: {batch['tone']}

CRITICAL:
- 80-180 words each
- Educational, helpful, value-adding tone
- Read as thoughtful peer, not brand
- Vary anecdote/framework/research-based
- NEVER copy-paste in production — use as inspiration

Output STRICT JSON only:
{{
  "comments": [
    {{
      "id": {start_id},
      "target_sub": "{batch['sub']}",
      "trigger_question_archetype": "1-sentence description",
      "comment_text": "the full comment, 80-180 words on a single string (escape \\\\n for line breaks)",
      "value_angle": "what value this adds",
      "tone": "warm-direct | analytical | reassuring | enthusiastic | compassionate",
      "risk_flags": "any rule-violation risk to watch for"
    }},
    ... {batch['count']} total
  ]
}}

Output ONLY the JSON. Keep comment_text on a single line. Escape any newlines as \\n."""
    raw = gemini(prompt, max_tokens=8000)
    try:
        d = robust_json(raw)
        return d
    except Exception as e:
        return {"error": str(e)[:200], "batch_sub": batch["sub"]}


def main():
    print("[reddit-lib] generating comment library in 7 sub-batches...")
    all_comments = []
    errors = []
    next_id = 1
    with ThreadPoolExecutor(max_workers=4) as ex:
        futs = {}
        cur_id = 1
        for b in BATCHES:
            futs[ex.submit(build_batch, b, cur_id)] = b
            cur_id += b["count"]
        for f in as_completed(futs):
            b = futs[f]
            r = f.result()
            if "error" in r:
                errors.append({"sub": b["sub"], "error": r["error"]})
                print(f"  ✗ {b['sub']}: {r['error'][:100]}")
            else:
                comments = r.get("comments", [])
                all_comments.extend(comments)
                print(f"  ✓ {b['sub']}: {len(comments)} comments")
    out = {"count": len(all_comments), "errors": errors, "comments": all_comments}
    (STATE / "reddit_comment_library.json").write_text(json.dumps(out, indent=2))
    # Markdown render
    md = ["# Reddit Comment Library", "", f"Total: {len(all_comments)} drafts. NO links, NO brand mentions, NO product names. Use as inspiration only.", ""]
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
    (STATE / "reddit_comment_library.md").write_text("\n".join(md))
    print(f"[reddit-lib] wrote {len(all_comments)} comments, {len(errors)} batch errors")


if __name__ == "__main__":
    main()
