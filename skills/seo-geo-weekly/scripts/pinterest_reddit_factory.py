"""Pinterest 30-day queue + boards + Reddit comment library + 28-day warmup.

All file generation, no platform writes.
"""
import json
import random
import re
import time
import urllib.request
import datetime as dt
from pathlib import Path

CREDS = Path.home() / ".claude/credentials.json"
STATE = Path("/Users/xiaozuo/.claude/skills/seo-geo-weekly/state/2026-05-13")


def _key():
    return json.loads(CREDS.read_text())["api_keys"]["gemini"]


def gemini(prompt: str, max_tokens: int = 6000, json_mode: bool = False, model: str = "gemini-2.5-pro") -> str:
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
    # Strategy 1: direct
    try:
        return json.loads(raw)
    except Exception:
        pass
    # Strategy 2: escape unescaped newlines inside strings
    fixed = re.sub(r'(?<!\\)\n(?=[^"\}\],]*")', r'\\n', raw)
    try:
        return json.loads(fixed)
    except Exception:
        pass
    # Strategy 3: brace extraction
    m = re.search(r"[\[\{][\s\S]*[\]\}]", raw)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            pass
    # Strategy 4: truncate to last valid JSON close
    # Try cutting at each successive closing brace
    last_close = raw.rfind("}")
    while last_close > 0:
        try:
            return json.loads(raw[: last_close + 1])
        except Exception:
            last_close = raw.rfind("}", 0, last_close)
    raise ValueError(f"unparseable: {raw[:300]}")


# ============================================================
# 1. Pinterest 6-board structure
# ============================================================

def build_boards():
    print("[boards] generating 6-board structure...")
    prompt = """Design 6 Pinterest boards for @curated.intimacy — a wellness-positioned sister-brand account for Dark Fantasy (bdsmpub.com). Boards must NOT mention BDSM, sex toys, or kink (Pinterest TOS bans these as promotional categories). Instead position as couples wellness, education, soft life.

Output STRICT JSON only:
{
  "handle": "@curated.intimacy",
  "boards": [
    {
      "name": "board name (3-5 words)",
      "slug": "kebab-case",
      "description": "180-200 char board description with 2-3 safe hashtags from: #SoftLife #CouplesRituals #IntimacyCoach #Aftercare #NervousSystem #WellnessTok #RelationshipRituals #CouplesWellness",
      "cover_pin_concept": "30-word description of the cover pin image",
      "target_keywords": ["3-5 SEO keywords this board ranks for"],
      "pin_topics": ["8-12 example pin topics this board will house"],
      "primary_audience": "1-sentence audience description"
    },
    ... 6 boards
  ],
  "setup_notes": "1-paragraph implementation note for Pinterest board creation order + initial pin distribution"
}

Board theme suggestions (refine titles to fit Pinterest aesthetic):
1. Couples Bedroom Aesthetics (lifestyle/mood)
2. Body-Safe Materials 101 (education)
3. Aftercare & Wellness Rituals (positioning anchor)
4. Anniversary & Gift Inspiration (intent-rich)
5. Soft Life Intimacy (Gen Z framing)
6. Couples Communication Frameworks (therapist-adjacent)"""
    raw = gemini(prompt, json_mode=True, max_tokens=8000, model="gemini-2.5-flash")
    try:
        out = robust_json(raw)
    except Exception as e:
        out = {"error": str(e)[:300], "raw": raw[:3000]}
    (STATE / "pinterest_boards.json").write_text(json.dumps(out, indent=2))
    print(f"[boards] wrote {STATE / 'pinterest_boards.json'}")
    return out


# ============================================================
# 2. Pinterest 30-day posting queue
# ============================================================

def build_30day_queue():
    print("[queue] building 30-day Pinterest schedule...")
    # Load existing 50 pins + 6 boards
    pins = json.loads((STATE / "sister_brand_pins.json").read_text())["pins"]
    boards_data = json.loads((STATE / "pinterest_boards.json").read_text())
    boards = boards_data["boards"]

    # Distribute: 50 pins over 30 days, weighted slightly heavier in week 1 (frontload to gain reach)
    # Week 1: 14 pins, Week 2: 12, Week 3: 12, Week 4: 12 = 50
    weeks = [14, 12, 12, 12]
    schedule = []
    pin_idx = 0
    start = dt.date.today()

    # Best post windows (from research)
    windows = {
        "sunday": ["20:00", "20:30", "21:00", "21:30", "22:00"],
        "weekday_lunch": ["12:00", "12:30", "13:00"],
        "weekday_evening": ["20:00", "20:30", "21:00", "21:30", "22:00"],
    }

    for week, daily_pins in enumerate(weeks):
        # Distribute pins across 7 days, weighted
        per_day_base = daily_pins // 7
        extra = daily_pins % 7
        for day_offset in range(7):
            day_date = start + dt.timedelta(days=week * 7 + day_offset)
            day_name = day_date.strftime("%A").lower()
            n = per_day_base + (1 if day_offset < extra else 0)
            for slot in range(n):
                if pin_idx >= len(pins):
                    break
                pin = pins[pin_idx]
                # Pick best window for this day
                if day_name == "sunday":
                    times = windows["sunday"]
                else:
                    times = windows["weekday_evening"] if slot == 0 else windows["weekday_lunch"]
                # Assign board by topic match (deterministic fallback: round-robin)
                board = boards[pin_idx % len(boards)]
                schedule.append({
                    "date": day_date.isoformat(),
                    "day_of_week": day_name,
                    "post_time_et": random.choice(times),
                    "pin_index": pin_idx,
                    "pin_title": pin.get("title", ""),
                    "pin_format": pin.get("pin_format", "Collage Pin"),
                    "board_assigned": board["slug"],
                    "image_path": f"state/2026-05-13/pin_images/{pin_idx:02d}-*.png",
                    "week": week + 1,
                })
                pin_idx += 1

    out = {
        "handle": "@curated.intimacy",
        "schedule_start": start.isoformat(),
        "total_pins": len(schedule),
        "weekly_breakdown": weeks,
        "schedule": schedule,
        "notes": "Frontload week 1 to maximize early-account reach. Sunday evenings are peak. Avoid posting >3 in 1 hour."
    }
    (STATE / "pinterest_30day_queue.json").write_text(json.dumps(out, indent=2))
    print(f"[queue] wrote {STATE / 'pinterest_30day_queue.json'} ({len(schedule)} scheduled posts)")


# ============================================================
# 3. Reddit comment library — 50 templates
# ============================================================

REDDIT_PROMPT = """Generate 50 Reddit comment templates for @darkfantasy.studio (Dark Fantasy / bdsmpub.com) to use during Reddit karma warmup phase (weeks 1-4).

CRITICAL RULES:
- NO links to bdsmpub.com or any commercial site
- NO mention of "Dark Fantasy" by name
- NO product names
- NO discount codes
- Educational, helpful, value-adding tone only
- Each comment must read as if written by a thoughtful peer in the community, not a brand
- Comments should genuinely help the OP, not subtly promote
- 80-180 words each
- Comments must feel personal: use "we" / "I" sparingly, occasional anecdote OK
- NEVER copy verbatim across platforms — use these as inspiration, not templates

Output STRICT JSON only:
{
  "comments": [
    {
      "id": 1,
      "target_sub": "r/sextoys | r/sex | r/sexover30 | r/AskWomenOver30 | r/BDSMcommunity | r/relationship_advice | r/DeadBedrooms",
      "trigger_question_archetype": "1-sentence description of the kind of OP question this answers",
      "comment_text": "the full comment, 80-180 words",
      "value_angle": "what value this adds — research / lived experience / counter-point / framework",
      "tone": "warm-direct | analytical | reassuring | enthusiastic",
      "risk_flags": "any rule-violation risk to watch for (e.g., 'r/AskWomenOver30 bans men commenting')"
    },
    ... 50 total
  ],
  "archetypes_covered": [
    "list of 8-12 distinct OP question archetypes the 50 comments cover"
  ]
}

Distribute across subs roughly:
- r/sextoys: 12 (focus: body-safe materials, beginner questions, comparison questions)
- r/sex: 10 (focus: communication, aftercare, mismatched desire)
- r/sexover30: 8 (focus: long-term relationship intimacy, life-phase changes)
- r/AskWomenOver30: 5 (focus: women-only space — avoid presuming male voice)
- r/BDSMcommunity: 8 (focus: aftercare, safety, beginner questions, NEVER product mentions)
- r/relationship_advice: 5 (focus: communication, conflict, intimacy in larger relational context)
- r/DeadBedrooms: 2 (focus: gentle, non-judgmental, framework-based)

Vary tone, length, and angle. Comments should NOT all feel like they come from the same person."""


def build_reddit_library():
    print("[reddit-lib] generating 50 comment templates...")
    raw = gemini(REDDIT_PROMPT, json_mode=True, max_tokens=12000)
    try:
        out = robust_json(raw)
    except Exception as e:
        out = {"error": str(e)[:300], "raw_head": raw[:2000]}
    (STATE / "reddit_comment_library.json").write_text(json.dumps(out, indent=2))
    # Also markdown render for easy human reading
    if "comments" in out:
        md = ["# Reddit Comment Library (50 drafts)", "",
              "**Use as inspiration, NOT verbatim.** Adapt to each OP's specific situation. NO links, NO brand mentions during weeks 1-4 warmup.",
              ""]
        for c in out["comments"]:
            md.append(f"## #{c['id']} — {c['target_sub']}")
            md.append(f"**Archetype:** {c['trigger_question_archetype']}")
            md.append(f"**Tone:** {c['tone']} · **Value angle:** {c['value_angle']}")
            if c.get("risk_flags"):
                md.append(f"**⚠️ Risk:** {c['risk_flags']}")
            md.append("")
            md.append(c["comment_text"])
            md.append("")
            md.append("---")
            md.append("")
        (STATE / "reddit_comment_library.md").write_text("\n".join(md))
    print(f"[reddit-lib] wrote {STATE / 'reddit_comment_library.json'} + .md")


# ============================================================
# 4. Reddit 28-day warmup schedule
# ============================================================

WARMUP_PROMPT = """Design a 28-day Reddit karma-warmup schedule for u/No_Register151 (Dark Fantasy's autogen account). Goal: 500+ karma in target subs by day 28, ZERO link drops, ZERO brand mentions.

Output STRICT JSON only:
{
  "account": "u/No_Register151",
  "goal": "500+ karma in target subs by day 28",
  "schedule": [
    {
      "day": 1,
      "date": "2026-05-13",
      "phase": "Browse + Subscribe",
      "actions": [
        "Subscribe to: r/sextoys, r/sex, r/sexover30, r/AskWomenOver30, r/BDSMcommunity, r/relationship_advice",
        "Subscribe camouflage: r/CasualConversation, r/Cooking, r/books, r/travel, r/AskReddit",
        "Browse top-week posts in each (5 min each)",
        "Upvote 8-12 posts you genuinely like",
        "NO comments"
      ],
      "target_engagement": "0 comments, 8-12 upvotes",
      "stop_loss": "If captcha appears, stop for 24h",
      "expected_karma_gain": 0
    },
    ... 28 days total
  ],
  "phase_summary": {
    "phase_1_observe": "Days 1-3: subscribe, browse, upvote only",
    "phase_2_comment_low_stakes": "Days 4-10: 1-2 comments/day on EASY posts (questions you genuinely know the answer to)",
    "phase_3_steady_value": "Days 11-21: 2-3 comments/day across more subs, more substantive",
    "phase_4_authority": "Days 22-28: 3-5 comments/day, occasional self-post if rules allow",
    "phase_5_unlocks": "Day 29+: brand mentions allowed in 1 of 10 comments. Day 60+: first soft links if karma > 500."
  },
  "weekly_review_checklist": [
    "any captcha hits?",
    "any post auto-removed?",
    "any sub-specific warning?",
    "karma trajectory on track?",
    "engagement quality (avg upvotes per comment)?"
  ],
  "comment_archetypes_by_day": "1-paragraph guidance — match the day's activity to the right comment archetype from reddit_comment_library.json"
}

CRITICAL:
- Days 1-3: NO comments at all
- Days 4-7: max 1-2 comments/day, in easy subs (r/AskReddit camouflage, r/Cooking camouflage), prove you're a real person
- Days 8-14: introduce comments in target subs (r/sex, r/sextoys), still 2-3/day max
- Days 15-21: ramp to 3-4/day, target subs only
- Days 22-28: 4-5/day, occasional self-post in r/CasualConversation
- NEVER: link drops, brand mentions, product names, paid affiliate disclosures (we don't have ALU flair yet)"""


def build_warmup():
    print("[warmup] generating 28-day Reddit warmup schedule...")
    raw = gemini(WARMUP_PROMPT, json_mode=True, max_tokens=12000)
    try:
        out = robust_json(raw)
    except Exception as e:
        out = {"error": str(e)[:300], "raw_head": raw[:2000]}
    (STATE / "reddit_28day_warmup.json").write_text(json.dumps(out, indent=2))
    # Markdown render
    if "schedule" in out:
        md = ["# Reddit 28-day Karma Warmup", "",
              f"**Account:** {out.get('account', 'u/No_Register151')}",
              f"**Goal:** {out.get('goal', '500+ karma')}",
              "", "## Phase summary", ""]
        ps = out.get("phase_summary", {})
        for k, v in ps.items():
            md.append(f"- **{k}**: {v}")
        md += ["", "## Daily schedule", ""]
        for day in out["schedule"]:
            md.append(f"### Day {day['day']} — {day.get('phase', '')}")
            md.append(f"Date: {day.get('date', '')}")
            md.append("Actions:")
            for a in day.get("actions", []):
                md.append(f"- {a}")
            md.append(f"**Target engagement:** {day.get('target_engagement', '')}")
            md.append(f"**Stop-loss:** {day.get('stop_loss', '')}")
            md.append(f"**Expected karma:** +{day.get('expected_karma_gain', 0)}")
            md.append("")
        (STATE / "reddit_28day_warmup.md").write_text("\n".join(md))
    print(f"[warmup] wrote {STATE / 'reddit_28day_warmup.json'} + .md")


# ============================================================
# Run
# ============================================================

if __name__ == "__main__":
    import sys
    available = {
        "boards": build_boards,
        "queue": build_30day_queue,
        "reddit_lib": build_reddit_library,
        "warmup": build_warmup,
    }
    if len(sys.argv) > 1:
        for name in sys.argv[1:]:
            if name in available:
                available[name]()
    else:
        # Run in order — boards must be first because queue depends on it
        build_boards()
        build_30day_queue()
        build_reddit_library()
        build_warmup()
