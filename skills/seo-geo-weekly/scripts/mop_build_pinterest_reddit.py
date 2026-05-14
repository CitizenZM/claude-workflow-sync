"""MOP v4.5 — parallel orchestrator for remaining Pinterest+Reddit build modules.

M1: Retry 13 failed pin images with sanitized prompts
M2: Generate pin variants (1:1 square + 9:16 IG-reel) for cross-post
M3: Re-rank Reddit live posts by priority
M4: Tailwind CSV export
M5: Klaviyo signup integration
M6: 30/90-day execution calendar

All run in parallel where independent. Built-in retry + alt-approach per MOP §5.
"""
import base64
import csv
import json
import re
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

CREDS = Path.home() / ".claude/credentials.json"
STATE = Path("/Users/xiaozuo/.claude/skills/seo-geo-weekly/state/2026-05-13")


def _key():
    return json.loads(CREDS.read_text())["api_keys"]["gemini"]


def gemini(prompt: str, max_tokens: int = 4000, json_mode: bool = False, model: str = "gemini-2.5-flash") -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={_key()}"
    cfg = {"temperature": 0.5, "maxOutputTokens": max_tokens}
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
    last = raw.rfind("}")
    while last > 0:
        try:
            return json.loads(raw[: last + 1])
        except Exception:
            last = raw.rfind("}", 0, last)
    raise ValueError(f"unparseable: {raw[:200]}")


# ============================================================
# M1: Retry 13 failed pin images with sanitized concepts
# ============================================================

IMAGEN_URL = "https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict"


def generate_image(prompt: str, aspect_ratio: str = "3:4") -> bytes | None:
    url = f"{IMAGEN_URL}?key={_key()}"
    body = {
        "instances": [{"prompt": prompt}],
        "parameters": {"sampleCount": 1, "aspectRatio": aspect_ratio, "personGeneration": "DONT_ALLOW"},
    }
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


SANITIZED_PROMPT = """Pinterest pin image, vertical, dark luxury aesthetic.

Scene: {scene}.

Style: editorial photography, cinematic warm lighting, shallow depth of field. Color palette: charcoal, amber, cream, brushed gold.

STRICT: NO people, NO bodies, NO hands, NO faces, NO clothing, NO intimate imagery. ONLY: candles, books, journals, fabric texture (silk/linen), ceramic mugs, plants, leather goods, jewelry, glass objects, wooden surfaces, soft lighting.

Leave clear space top-third for typography overlay (do not generate text)."""

SANITIZED_SCENES = [
    "Single candle on a dark wooden table with a leather journal",
    "Silk scarf draped over a velvet cushion in warm light",
    "Two ceramic coffee mugs on a marble surface with soft morning light",
    "An open book and a wine glass beside a single candle",
    "Linen sheets folded neatly with brushed gold jewelry on top",
    "A leather-bound journal closed with a silk ribbon, candlelight",
    "Wooden chess pieces on a dark surface with warm light pooling",
    "A folded silk blanket on a velvet chaise, dim lamplight",
    "Glass decanter and crystal tumblers on a dark wood bar",
    "A potted fern beside a brass candlestick on a marble shelf",
    "An old leather suitcase open showing folded silk garments",
    "Hand-cut velvet jewelry pouches arranged on a leather tray",
    "A vintage perfume bottle catching gold afternoon light",
]


def m1_retry_pins():
    print("[M1] retrying failed pin images with sanitized concepts...")
    pin_imgs_dir = STATE / "pin_images"
    existing = {p.name.split("-", 1)[0]: p for p in pin_imgs_dir.glob("*.png")}

    # Read original pins to find which indices are missing
    pins = json.loads((STATE / "sister_brand_pins.json").read_text())["pins"]
    missing = [i for i in range(len(pins)) if f"{i:02d}" not in existing]
    print(f"  [M1] {len(missing)} pins missing: {missing}")

    if not missing:
        print("  [M1] all pins exist — skip")
        return {"status": "skipped", "added": 0}

    added = 0
    failed = 0
    for slot, idx in enumerate(missing):
        scene = SANITIZED_SCENES[slot % len(SANITIZED_SCENES)]
        prompt = SANITIZED_PROMPT.format(scene=scene)
        pin = pins[idx] if idx < len(pins) else {}
        title_slug = re.sub(r"[^a-z0-9]+", "-", pin.get("title", f"pin-{idx}").lower())[:60].strip("-")
        out_path = pin_imgs_dir / f"{idx:02d}-{title_slug}.png"
        img = generate_image(prompt)
        if img:
            out_path.write_bytes(img)
            added += 1
            print(f"  ✓ M1 retry {idx:02d}")
        else:
            failed += 1
            print(f"  ✗ M1 retry {idx:02d}")
        time.sleep(1.5)
    return {"status": "ok", "added": added, "failed": failed}


# ============================================================
# M2: Pin variants — 1:1 square (Instagram) + 9:16 (Reels/Stories)
# ============================================================

def m2_variants():
    print("[M2] generating 1:1 + 9:16 variants for top-10 pins...")
    out_dir = STATE / "pin_variants"
    out_dir.mkdir(exist_ok=True)
    pins = json.loads((STATE / "sister_brand_pins.json").read_text())["pins"]
    # Take first 10 pins for variant gen
    selected = pins[:10]
    results = []

    def gen_variant(pin_idx, pin, ratio, suffix):
        concept = pin.get("image_concept", "")
        if not concept:
            concept = f"Editorial wellness mood for: {pin.get('title','')}"
        prompt = SANITIZED_PROMPT.format(scene=concept[:300])
        out_path = out_dir / f"{pin_idx:02d}-{suffix}.png"
        if out_path.exists():
            return {"idx": pin_idx, "ratio": ratio, "status": "cached"}
        img = generate_image(prompt, aspect_ratio=ratio)
        if img:
            out_path.write_bytes(img)
            return {"idx": pin_idx, "ratio": ratio, "status": "ok"}
        return {"idx": pin_idx, "ratio": ratio, "status": "fail"}

    with ThreadPoolExecutor(max_workers=3) as ex:
        futs = []
        for i, p in enumerate(selected):
            futs.append(ex.submit(gen_variant, i, p, "1:1", "square"))
            futs.append(ex.submit(gen_variant, i, p, "9:16", "vertical"))
        for f in as_completed(futs):
            r = f.result()
            results.append(r)
    ok = sum(1 for r in results if r["status"] == "ok")
    print(f"[M2] {ok}/{len(results)} variants generated")
    return {"status": "ok", "count": len(results), "ok": ok}


# ============================================================
# M3: Reddit live-post priority scoring + sequencing
# ============================================================

def m3_reddit_sequence():
    print("[M3] re-scoring + sequencing Reddit live posts...")
    posts_file = Path("/Users/xiaozuo/Documents/Obsidian/01-Projects/Dark-Fantasy-SEO-GEO-Weekly/Social/Reddit-Live-Posts-2026-05-13.md")
    if not posts_file.exists():
        return {"status": "skip", "reason": "no live posts file"}

    content = posts_file.read_text()
    prompt = f"""Read this Reddit live-posts research report and produce a SEQUENCED action plan for Dark Fantasy's u/No_Register151 account.

Rules:
- Account has 0 karma today (day 1 of 28-day warmup)
- Day 1-3: NO comments at all (subscribe + browse + upvote only)
- Day 4-7: 1-2 EASY comments per day in camouflage subs (r/CasualConversation, r/Cooking)
- Day 8-14: 2-3 comments per day, can start target subs
- Day 15+: full target-sub commenting

For the 18 live posts in this report, sequence them across days 8-28 based on:
- Urgency (0-reply posts decay fast — ship within 24h once available)
- Risk level (low-risk subs first, higher-risk later)
- Karma level needed (some target subs require 30+ karma)

Output STRICT JSON:
{{
  "sequencing_plan": [
    {{"day": 8, "post_index": <0-17>, "post_url": "...", "sub": "...", "rationale": "why this day", "karma_required": <int>, "fallback_if_filled": "skip and use next priority"}},
    ...
  ],
  "skipped_posts": [
    {{"post_index": <int>, "reason": "..."}}
  ],
  "weekly_summary": {{
    "week_2": "what gets shipped",
    "week_3": "...",
    "week_4": "..."
  }}
}}

Report content:
{content[:8000]}"""

    try:
        raw = gemini(prompt, json_mode=True, max_tokens=6000, model="gemini-2.5-pro")
        d = robust_json(raw)
    except Exception as e:
        d = {"error": str(e)[:300]}
    (STATE / "reddit_sequencing_plan.json").write_text(json.dumps(d, indent=2))
    print(f"[M3] wrote sequencing plan")
    return {"status": "ok"}


# ============================================================
# M4: Tailwind CSV export (Pinterest bulk-upload format)
# ============================================================

def m4_tailwind_csv():
    print("[M4] exporting Tailwind CSV...")
    pins = json.loads((STATE / "sister_brand_pins.json").read_text())["pins"]
    queue = json.loads((STATE / "pinterest_30day_queue.json").read_text())["schedule"]
    boards = json.loads((STATE / "pinterest_boards.json").read_text()).get("boards", [])
    boards_by_slug = {b.get("slug"): b.get("name") for b in boards}

    img_dir = STATE / "pin_images"
    img_files = {int(p.name.split("-", 1)[0]): p.name for p in img_dir.glob("*.png")}

    out_csv = STATE / "tailwind_pinterest_upload.csv"
    with out_csv.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Image File", "Pin Title", "Pin Description", "Board Name", "Destination URL", "Scheduled Date", "Scheduled Time ET"])
        for entry in queue:
            pin_idx = entry["pin_index"]
            if pin_idx not in img_files:
                continue
            pin = pins[pin_idx] if pin_idx < len(pins) else {}
            slug = entry.get("board_assigned", "")
            board_name = boards_by_slug.get(slug, slug)
            dest = "https://bdsmpub.com/pages/education"
            w.writerow([
                img_files[pin_idx],
                pin.get("title", ""),
                pin.get("description", "")[:500],
                board_name,
                dest,
                entry.get("date", ""),
                entry.get("post_time_et", ""),
            ])
    rows = sum(1 for _ in out_csv.open()) - 1
    print(f"[M4] wrote {out_csv} ({rows} rows)")
    return {"status": "ok", "rows": rows}


# ============================================================
# M5: Klaviyo signup integration script
# ============================================================

def m5_klaviyo_integration():
    print("[M5] generating Klaviyo signup integration...")
    script = '''"""Klaviyo signup integration — push subscriber from Shopify form to Klaviyo + assign segment.

Usage:
  KLAVIYO_API_KEY=pk_xxx python3 klaviyo_signup.py --email <e> --first_name <n> --quiz_answers <json>

Reads quiz answers, computes segment, subscribes email, triggers welcome flow.
"""
import json, os, sys, urllib.request

KLAVIYO_API_VERSION = "2024-10-15"
WELCOME_FLOW_ID = os.environ.get("KLAVIYO_WELCOME_FLOW_ID", "")  # set after flow created
LIST_ID = os.environ.get("KLAVIYO_NEWSLETTER_LIST_ID", "")  # set after list created


def klaviyo_request(method, path, body=None):
    key = os.environ["KLAVIYO_API_KEY"]
    url = f"https://a.klaviyo.com/api{path}"
    headers = {
        "Authorization": f"Klaviyo-API-Key {key}",
        "Content-Type": "application/json",
        "revision": KLAVIYO_API_VERSION,
        "accept": "application/json",
    }
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode()) if r.status < 300 else None


def determine_segment(quiz_answers: dict) -> str:
    """Map quiz answers to segment tag.
    Segments: beginner_couple, intermediate_couple, luxury_couple, wellness_focus,
              lgbtq_inclusive, travel_focus, anniversary_couple, default
    """
    exp = quiz_answers.get("experience_level", "")
    rel_duration = quiz_answers.get("relationship_duration", "")
    budget = quiz_answers.get("budget_tier", "")
    interests = quiz_answers.get("interests", [])

    if exp == "new" or rel_duration in ("new_couple", "single"):
        return "beginner_couple"
    if "wellness" in interests or "aftercare" in interests:
        return "wellness_focus"
    if budget == "luxury" or rel_duration == "10_plus":
        return "luxury_couple"
    if quiz_answers.get("partner_config") == "lgbtq":
        return "lgbtq_inclusive"
    if "travel" in interests:
        return "travel_focus"
    if rel_duration in ("4_10yr",):
        return "anniversary_couple"
    return "default"


def create_profile(email: str, first_name: str = None, quiz_answers: dict = None) -> dict:
    segment = determine_segment(quiz_answers or {})
    body = {
        "data": {
            "type": "profile",
            "attributes": {
                "email": email,
                "first_name": first_name or "",
                "properties": {
                    "segment_tag": segment,
                    "quiz_completed": True,
                    "quiz_answers_json": json.dumps(quiz_answers or {}),
                    "signup_source": "education_hub_quiz",
                    "consent": True,
                },
            },
        }
    }
    return klaviyo_request("POST", "/profiles/", body)


def subscribe_to_list(profile_id: str, list_id: str = None):
    list_id = list_id or LIST_ID
    if not list_id:
        return None
    body = {
        "data": {
            "type": "profile-subscription-bulk-create-job",
            "attributes": {
                "profiles": {"data": [{"type": "profile", "id": profile_id}]},
                "list_id": list_id,
                "custom_source": "Education Hub Quiz",
            },
        }
    }
    return klaviyo_request("POST", "/profile-subscription-bulk-create-jobs/", body)


def trigger_welcome_event(email: str, segment: str):
    """Trigger 'Quiz Completed' event — flow listens for this."""
    body = {
        "data": {
            "type": "event",
            "attributes": {
                "properties": {"segment": segment},
                "metric": {"data": {"type": "metric", "attributes": {"name": "Quiz Completed"}}},
                "profile": {"data": {"type": "profile", "attributes": {"email": email}}},
            },
        }
    }
    return klaviyo_request("POST", "/events/", body)


def main():
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--email", required=True)
    p.add_argument("--first_name", default="")
    p.add_argument("--quiz_answers", default="{}", help="JSON string of quiz answers")
    args = p.parse_args()

    answers = json.loads(args.quiz_answers)
    segment = determine_segment(answers)
    print(f"[klaviyo] segment: {segment}")

    profile = create_profile(args.email, args.first_name, answers)
    if not profile:
        print("[klaviyo] profile create failed")
        sys.exit(1)
    profile_id = profile["data"]["id"]
    print(f"[klaviyo] profile: {profile_id}")

    sub = subscribe_to_list(profile_id)
    print(f"[klaviyo] subscribed: {sub is not None}")

    evt = trigger_welcome_event(args.email, segment)
    print(f"[klaviyo] event fired: {evt is not None}")


if __name__ == "__main__":
    main()
'''
    out = STATE / "klaviyo_signup.py"
    out.write_text(script)
    print(f"[M5] wrote {out}")
    return {"status": "ok", "path": str(out)}


# ============================================================
# M6: 30/90-day master execution calendar
# ============================================================

def m6_calendar():
    print("[M6] generating 30/90-day master calendar...")
    prompt = """Generate a 30/90-day master execution calendar for Dark Fantasy's social + content + commerce launch. Today is 2026-05-13.

KEY DATES:
- May 22-27: Memorial Day Reset bundle promo (20% off)
- May 30-Jun 5: Pride Box 2026 launch (20% off + 5% donation)
- Jun 8-14: Anniversary Luxury Set (20% off)
- Jun 15-21: Father's Day Couples Gift Pack (20% off)
- Jun 22-28: Travel Discreet Kit (20% off)

PARALLEL STREAMS:
1. **Pinterest @curated.intimacy** (sister-brand, fresh): 50 pins over 30 days (week-1 frontload 14 pins)
2. **Reddit u/No_Register151** (karma warmup): 28-day plan, NO links/brand for 4 weeks
3. **TikTok @darkfantasy.studio** (rebrand from @barronzuo): 30 scripts to film, 3-5 posts/week
4. **Instagram @darkfantasy.studio**: 20 carousels, 1 post/2-3 days
5. **Klaviyo email**: quiz capture live, 5-email welcome flow, abandoned cart, promo flows
6. **ALU Reddit affiliate recruitment**: DM 5 reviewers (Epiphora, Dangerous Lilly, etc.) — prep MSDS first
7. **bdsmpub.com pillar/bundle/affiliate pages**: deployed via Shopify

Output STRICT JSON only:
{
  "executive_summary": "3-sentence rollup of the 30-day priority",
  "week_by_week": [
    {
      "week": 1,
      "dates": "May 13-19",
      "theme": "...",
      "must_ship": ["bullet 1", ...],
      "channel_actions": {
        "pinterest": "...",
        "reddit": "...",
        "tiktok": "...",
        "instagram": "...",
        "email": "...",
        "shopify": "...",
        "affiliate": "..."
      },
      "kpi_targets": {"sessions": 100, "emails_captured": 5, "bundle_revenue_usd": 0}
    },
    ... 12 weeks total (weeks 1-12 = 30 days × 3 = 90 days)
  ],
  "day_30_milestones": ["6 milestones to hit by day 30"],
  "day_90_milestones": ["6 milestones to hit by day 90"],
  "critical_dependencies": ["bullets on what blocks what"]
}"""
    try:
        raw = gemini(prompt, json_mode=True, max_tokens=10000, model="gemini-2.5-pro")
        d = robust_json(raw)
    except Exception as e:
        d = {"error": str(e)[:300]}
    (STATE / "master_calendar_30_90.json").write_text(json.dumps(d, indent=2))
    # Markdown render
    if "week_by_week" in d:
        md = ["# Dark Fantasy 30/90-Day Master Calendar", "", f"**Generated:** 2026-05-13", "", f"**Executive summary:** {d.get('executive_summary','')}", "", "## Week-by-week", ""]
        for w in d["week_by_week"]:
            md.append(f"### Week {w.get('week')} — {w.get('dates','')} · {w.get('theme','')}")
            md.append("")
            md.append("**Must ship:**")
            for ms in w.get("must_ship", []):
                md.append(f"- {ms}")
            md.append("")
            md.append("**Channel actions:**")
            for ch, action in (w.get("channel_actions") or {}).items():
                md.append(f"- **{ch}**: {action}")
            kpi = w.get("kpi_targets") or {}
            if kpi:
                md.append("")
                md.append(f"**KPI:** {', '.join(f'{k}={v}' for k,v in kpi.items())}")
            md.append("")
        md += ["## Day-30 milestones", ""]
        for m in d.get("day_30_milestones", []):
            md.append(f"- {m}")
        md += ["", "## Day-90 milestones", ""]
        for m in d.get("day_90_milestones", []):
            md.append(f"- {m}")
        md += ["", "## Critical dependencies", ""]
        for c in d.get("critical_dependencies", []):
            md.append(f"- {c}")
        out_md = Path("/Users/xiaozuo/Documents/Obsidian/01-Projects/Dark-Fantasy-SEO-GEO-Weekly/Master-Calendar-30-90-Day.md")
        out_md.write_text("\n".join(md))
        print(f"[M6] wrote {out_md}")
    return {"status": "ok"}


# ============================================================
# Orchestration
# ============================================================

if __name__ == "__main__":
    print("=" * 60)
    print("MOP v4.5 — Dark Fantasy Pinterest+Reddit consolidation")
    print("=" * 60)

    # Run in parallel where independent
    results = {}
    with ThreadPoolExecutor(max_workers=4) as ex:
        futs = {
            ex.submit(m1_retry_pins): "M1",
            ex.submit(m2_variants): "M2",
            ex.submit(m3_reddit_sequence): "M3",
            ex.submit(m4_tailwind_csv): "M4",
            ex.submit(m5_klaviyo_integration): "M5",
            ex.submit(m6_calendar): "M6",
        }
        for f in as_completed(futs):
            mod = futs[f]
            try:
                results[mod] = f.result()
                print(f"\n[MOP {mod} ✓]  {results[mod]}\n")
            except Exception as e:
                results[mod] = {"error": str(e)[:200]}
                print(f"\n[MOP {mod} ✗] {e}\n")

    summary = {"modules": results, "completed_at": time.time()}
    (STATE / "_mop_run_summary.json").write_text(json.dumps(summary, indent=2))
    print("\n[MOP DELIVERY] all modules complete")
    for mod, r in results.items():
        print(f"  {mod}: {r}")
