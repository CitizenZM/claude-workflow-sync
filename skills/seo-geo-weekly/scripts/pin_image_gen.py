"""Generate 50 Pinterest pin images via Imagen 4 (Gemini API).

Reads sister_brand_pins.json, calls Imagen 4 per pin's image_concept,
saves PNGs to state/<date>/pin_images/<slug>.png.
"""
import base64
import json
import re
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

CREDS = Path.home() / ".claude/credentials.json"
STATE = Path("/Users/xiaozuo/.claude/skills/seo-geo-weekly/state/2026-05-13")
PINS_FILE = STATE / "sister_brand_pins.json"
OUT_DIR = STATE / "pin_images"
OUT_DIR.mkdir(exist_ok=True)


def _key():
    return json.loads(CREDS.read_text())["api_keys"]["gemini"]


# Imagen 4 endpoint via Gemini API (v1beta predict)
IMAGEN_URL = "https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict"


def generate_image(prompt: str) -> bytes | None:
    """Call Imagen 4, return PNG bytes or None on failure."""
    url = f"{IMAGEN_URL}?key={_key()}"
    body = {
        "instances": [{"prompt": prompt}],
        "parameters": {
            "sampleCount": 1,
            "aspectRatio": "3:4",  # Pinterest-optimal (closest supported)
            "personGeneration": "DONT_ALLOW",  # no people, brand-safe
        },
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
        if not b64:
            return None
        return base64.b64decode(b64)
    except Exception as e:
        return None


def slugify(s: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s[:60]


PROMPT_TEMPLATE = """Pinterest pin image, 2:3 vertical aspect ratio.

Style: dark moody luxury aesthetic, warm-tone, candlelight, minimal composition.
Brand: "Dark Fantasy" — body-safe luxury for couples wellness.
Strict rules: NO people, NO bodies, NO faces, NO explicit imagery, NO sex toys.
Allowed: lifestyle objects, textures, hands (partial), silk fabric, leather texture, candles, journal, coffee, books, plants, jewelry, ceramics, glassware.

Image concept: {concept}

Visual treatment: cinematic lighting, shallow depth of field, premium editorial photography, evocative not literal. Color palette: deep charcoal, warm amber, cream, brushed gold accents.

Optional text overlay area: leave clear space top-third or bottom-third for typography overlay (don't generate the text itself, just leave space).
"""


def gen_one(pin: dict, idx: int, max_retries: int = 2) -> dict:
    concept = pin.get("image_concept", "")
    title = pin.get("title", f"pin-{idx}")
    # Fallback concept from title if missing
    if not concept:
        concept = f"Editorial wellness mood for: {title}. Dark luxury aesthetic, candlelight, hands holding a journal, silk fabric texture, ceramic mug."
    prompt = PROMPT_TEMPLATE.format(concept=concept[:600])
    slug = slugify(title) or f"pin-{idx:02d}"
    out_path = OUT_DIR / f"{idx:02d}-{slug}.png"
    if out_path.exists() and out_path.stat().st_size > 50000:
        return {"idx": idx, "title": title, "status": "cached", "path": str(out_path)}
    for attempt in range(max_retries):
        img = generate_image(prompt)
        if img:
            out_path.write_bytes(img)
            return {"idx": idx, "title": title, "status": "ok", "path": str(out_path), "size": len(img), "attempts": attempt + 1}
        time.sleep(1.5 + attempt * 2)
    return {"idx": idx, "title": title, "status": "failed", "attempts": max_retries}


def main(limit: int | None = None):
    data = json.loads(PINS_FILE.read_text())
    pins = data.get("pins", [])
    if limit:
        pins = pins[:limit]
    print(f"[pin-img] generating {len(pins)} images via Imagen 4")
    results = []
    # Imagen has tighter rate limits — use lower concurrency
    with ThreadPoolExecutor(max_workers=3) as ex:
        futs = {ex.submit(gen_one, p, i): (i, p) for i, p in enumerate(pins)}
        for f in as_completed(futs):
            r = f.result()
            results.append(r)
            status_emoji = {"ok": "✓", "cached": "~", "failed": "✗", "no_concept": "?"}.get(r["status"], "?")
            print(f"  {status_emoji} {r['idx']:02d} {r['title'][:50]}")
    (OUT_DIR / "_index.json").write_text(json.dumps({"count": len(results), "results": results}, indent=2))
    ok = sum(1 for r in results if r["status"] == "ok")
    failed = sum(1 for r in results if r["status"] == "failed")
    print(f"[pin-img] done. ok={ok}, failed={failed}, total={len(results)}")


if __name__ == "__main__":
    import sys
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else None
    main(limit)
