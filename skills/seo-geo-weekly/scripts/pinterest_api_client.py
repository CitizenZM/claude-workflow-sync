"""Pinterest API v5 client — ready to wire in once Pinterest API access is granted.

Auth: OAuth2 access token (set PINTEREST_ACCESS_TOKEN env var).
Docs: https://developers.pinterest.com/docs/api/v5/

This client is built for the path where Dark Fantasy applies for Pinterest API access
(developer.pinterest.com → trusted app approval). Until approved, all calls return
401/403 and we fall back to Tailwind CSV / manual upload.
"""
import base64
import json
import mimetypes
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

API_BASE = "https://api.pinterest.com/v5"


def _token():
    tok = os.environ.get("PINTEREST_ACCESS_TOKEN", "")
    if not tok:
        # Fallback: try credentials.json
        try:
            creds = json.loads((Path.home() / ".claude/credentials.json").read_text())
            tok = creds.get("pinterest", {}).get("access_token", "")
        except Exception:
            pass
    if not tok:
        raise RuntimeError("PINTEREST_ACCESS_TOKEN not set — apply at developer.pinterest.com first")
    return tok


def _request(method: str, path: str, body: dict = None, params: dict = None):
    url = API_BASE + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    headers = {
        "Authorization": f"Bearer {_token()}",
        "Accept": "application/json",
    }
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode()) if e.fp else {"error": str(e)}


def me() -> dict:
    """GET /user_account — verify token + scope."""
    _, d = _request("GET", "/user_account")
    return d


def list_boards(page_size: int = 25) -> list:
    """GET /boards — list current account's boards."""
    _, d = _request("GET", "/boards", params={"page_size": page_size})
    return d.get("items", [])


def create_board(name: str, description: str = "", privacy: str = "PUBLIC") -> dict:
    """POST /boards — create a board."""
    _, d = _request("POST", "/boards", body={
        "name": name,
        "description": description[:500],
        "privacy": privacy,
    })
    return d


def upload_media(image_path: str) -> str:
    """Pinterest API doesn't have a direct multipart upload — pins reference an image URL OR base64.
    For local images, we either:
      A) Host image at a public URL (Shopify CDN works) and pass as source_url
      B) Base64-encode the file and use image_base64 source type

    Returns: a 'media_source' dict ready for create_pin.
    """
    p = Path(image_path)
    if not p.exists():
        raise FileNotFoundError(image_path)
    mime, _ = mimetypes.guess_type(str(p))
    mime = mime or "image/png"
    data = base64.b64encode(p.read_bytes()).decode()
    return {
        "source_type": "image_base64",
        "content_type": mime,
        "data": data,
    }


def create_pin(
    board_id: str,
    title: str,
    description: str,
    image_path: str,
    link: str,
    alt_text: str = "",
) -> dict:
    """POST /pins — create a pin from local image."""
    media = upload_media(image_path)
    body = {
        "board_id": board_id,
        "title": title[:100],
        "description": description[:500],
        "link": link,
        "alt_text": alt_text[:500] or title[:100],
        "media_source": media,
    }
    status, d = _request("POST", "/pins", body=body)
    return {"status": status, "response": d}


def bulk_create_pins(csv_path: str, board_map: dict) -> list:
    """Read consolidated_pinterest_tailwind.csv format and create pins.
    board_map: {"board name": "<pinterest board_id>"}
    """
    import csv as _csv
    results = []
    with open(csv_path) as f:
        for row in _csv.DictReader(f):
            board_id = board_map.get(row.get("board", ""))
            if not board_id:
                results.append({"row": row.get("title"), "status": "skip_no_board"})
                continue
            img_path = row.get("image_file_full_path") or row.get("image_file")
            if not Path(img_path).is_absolute():
                # Try resolve via state dir
                for state_dir in [
                    Path("/Users/xiaozuo/.claude/skills/seo-geo-weekly/state/2026-05-13/pin_images"),
                    Path("/Users/xiaozuo/.claude/skills/seo-geo-weekly/state/2026-05-14/content_images"),
                ]:
                    candidate = state_dir / img_path
                    if candidate.exists():
                        img_path = str(candidate)
                        break
            r = create_pin(
                board_id=board_id,
                title=row.get("title", ""),
                description=row.get("description", ""),
                image_path=img_path,
                link=row.get("destination_url", ""),
                alt_text=row.get("title", ""),
            )
            results.append({"row": row.get("title"), "result": r})
    return results


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "whoami"
    if cmd == "whoami":
        print(json.dumps(me(), indent=2))
    elif cmd == "boards":
        for b in list_boards():
            print(f"{b.get('id'):>20}  {b.get('name')}")
    elif cmd == "create-board":
        # python pinterest_api_client.py create-board "Board Name" "Description"
        name = sys.argv[2]
        desc = sys.argv[3] if len(sys.argv) > 3 else ""
        print(json.dumps(create_board(name, desc), indent=2))
    elif cmd == "bulk":
        # python pinterest_api_client.py bulk <csv_path> '<board_map_json>'
        csv_path = sys.argv[2]
        board_map = json.loads(sys.argv[3])
        for r in bulk_create_pins(csv_path, board_map):
            print(json.dumps(r))
    else:
        print(f"unknown command: {cmd}")
        print("commands: whoami | boards | create-board <name> <desc> | bulk <csv> <board_map_json>")
