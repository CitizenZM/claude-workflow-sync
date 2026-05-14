"""Generate high-DA backlink outreach targets + ready-to-send pitches.

Uses Gemini to draft personalized pitches based on:
- Brand snapshot (catalog / positioning)
- Targeted publication (lifestyle, wellness, kink-aware therapy, sex education)
- The week's top blog posts as pitch hooks
"""
import json
import time
import urllib.request
from pathlib import Path

CREDS_PATH = Path.home() / ".claude/credentials.json"


# Curated high-DA targets in the adult-wellness / lifestyle / sexual health space.
# These accept guest content, expert quotes (HARO), or resource links.
HIGH_DA_TARGETS = [
    {
        "publication": "Bustle",
        "angle": "expert quote on body-safe materials",
        "channel": "HARO + direct pitch via beauty/wellness editor",
        "domain_authority": 90,
        "url": "https://www.bustle.com/sex-relationships",
    },
    {
        "publication": "Refinery29",
        "angle": "first-person guide / expert column on couples intimacy",
        "channel": "Pitch sex+relationships editor; HARO",
        "domain_authority": 90,
        "url": "https://www.refinery29.com/en-us/sex",
    },
    {
        "publication": "Volonté by Lovehoney",
        "angle": "guest article on advanced bondage knot tutorial (educational, non-promotional)",
        "channel": "Editorial submission",
        "domain_authority": 70,
        "url": "https://www.lovehoney.com/blog/",
    },
    {
        "publication": "Sex With Emily (podcast + blog)",
        "angle": "founder interview on body-safe manufacturing",
        "channel": "Podcast booking via pitch form",
        "domain_authority": 65,
        "url": "https://sexwithemily.com",
    },
    {
        "publication": "Multiamory",
        "angle": "expert episode on ethical kink + couples",
        "channel": "Direct podcast pitch",
        "domain_authority": 55,
        "url": "https://www.multiamory.com",
    },
    {
        "publication": "The Kinsey Institute",
        "angle": "research collaboration / resource list",
        "channel": "Academic outreach (long-tail, big payoff)",
        "domain_authority": 90,
        "url": "https://kinseyinstitute.org",
    },
    {
        "publication": "AASECT (sex therapy directory)",
        "angle": "resource for kink-aware therapist client referrals",
        "channel": "Resource page submission",
        "domain_authority": 75,
        "url": "https://www.aasect.org",
    },
    {
        "publication": "Allure Beauty",
        "angle": "wellness body-care section; intimate care products",
        "channel": "HARO + beauty editor",
        "domain_authority": 90,
        "url": "https://www.allure.com",
    },
]


def _gemini_key() -> str:
    return json.loads(CREDS_PATH.read_text())["api_keys"]["gemini"]


def gemini(prompt: str, model: str = "gemini-2.5-flash", max_tokens: int = 1024) -> str:
    key = _gemini_key()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.6, "maxOutputTokens": max_tokens},
    }
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"}, method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        d = json.loads(r.read().decode())
    parts = d.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    return "".join(p.get("text", "") for p in parts).strip()


def generate_pitch(brand: str, storefront: str, target: dict) -> str:
    prompt = f"""Write a concise outreach email pitch (180–240 words) from the founder of {brand} ({storefront}) to a writer/editor at {target['publication']}.

Angle: {target['angle']}
Channel: {target['channel']}

Tone: warm but professional. The brand sells body-safe premium intimate wellness and BDSM gear (luxury bondage, couples kits, body-safe materials). Open with a specific reason for reaching out (their recent coverage area or a specific column). Offer real value (expert quote, original data, or full draft of a guest piece). End with one clear ask. Sign off as "CellDigital Affiliate Team" — DO NOT use any personal name. DO NOT use the From email "barronzuo@gmail.com"; the sender is "affiliate@celldigital.co".

Output the email body only. No subject line, no preamble."""
    return gemini(prompt, max_tokens=600)


def generate_guest_post_outline(brand: str, topic: str) -> str:
    prompt = f"""Write a 600–900 word guest post outline for {brand} on the topic: "{topic}"

The brand sells body-safe premium intimate wellness and BDSM gear. The post must be educational, non-promotional in body (one tasteful brand link in author bio is acceptable). Format:

# Title
## Section 1: Hook
## Section 2: Core teaching
## Section 3: Common mistakes
## Section 4: Practical checklist or actionable next steps
## Section 5: Resources (where to learn more — link to community / educators, NOT to product pages)

For each section, write 2–3 sentence summaries of what should go in. Don't write the full post; just the outline with section summaries."""
    return gemini(prompt, max_tokens=900)


def run(state_dir: Path, brand: str = "Dark Fantasy", storefront: str = "https://bdsmpub.com", n_pitches: int = 5, n_outlines: int = 3) -> dict:
    targets = HIGH_DA_TARGETS[:n_pitches]
    out = {"brand": brand, "pitches": [], "guest_post_outlines": []}

    for t in targets:
        print(f"      [outreach] pitch → {t['publication']}")
        try:
            email = generate_pitch(brand, storefront, t)
            out["pitches"].append({**t, "draft_email": email})
        except Exception as e:
            out["pitches"].append({**t, "error": str(e)[:200]})
        time.sleep(0.5)

    topics = [
        "Body-safe materials in BDSM gear: a buyer's guide",
        "Aftercare for couples new to kink: what every first-time scene should include",
        "How to choose your first wand vibrator: comfort, power, and body-safe materials compared",
    ][:n_outlines]
    for tp in topics:
        print(f"      [outreach] guest post outline: {tp}")
        try:
            outline = generate_guest_post_outline(brand, tp)
            out["guest_post_outlines"].append({"topic": tp, "outline": outline})
        except Exception as e:
            out["guest_post_outlines"].append({"topic": tp, "error": str(e)[:200]})
        time.sleep(0.5)

    (state_dir / "outreach.json").write_text(json.dumps(out, indent=2))
    return out


if __name__ == "__main__":
    import sys
    print(json.dumps(run(Path(sys.argv[1])), indent=2)[:3000])
