"""Send the weekly report via SMTP with the .docx as attachment.

Reads SMTP creds from ~/.claude/credentials.json under `smtp.celldigital`:
  {
    "smtp": {
      "celldigital": {
        "host": "smtp.gmail.com",
        "port": 587,
        "user": "affiliate@celldigital.co",
        "password": "<google-app-password>"
      }
    }
  }

Generate Google App Password at: https://myaccount.google.com/apppasswords
(requires 2FA enabled on affiliate@celldigital.co)
"""
import json
import mimetypes
import os
import smtplib
import ssl
from email.message import EmailMessage
from pathlib import Path


CREDS_PATH = Path.home() / ".claude/credentials.json"


def load_smtp(key: str = "celldigital") -> dict | None:
    if not CREDS_PATH.exists():
        return None
    d = json.loads(CREDS_PATH.read_text())
    return (d.get("smtp") or {}).get(key)


def send(
    to_addrs: list[str],
    subject: str,
    html_body: str,
    text_body: str = "",
    attachments: list[Path] | None = None,
    smtp_key: str = "celldigital",
) -> dict:
    creds = load_smtp(smtp_key)
    if not creds:
        return {"sent": False, "error": f"no SMTP creds at smtp.{smtp_key}"}

    msg = EmailMessage()
    msg["From"] = creds["user"]
    msg["To"] = ", ".join(to_addrs)
    msg["Subject"] = subject
    msg.set_content(text_body or "View this email in HTML.")
    msg.add_alternative(html_body, subtype="html")

    for path in attachments or []:
        path = Path(path)
        if not path.exists():
            continue
        ctype, _ = mimetypes.guess_type(str(path))
        if ctype is None:
            ctype = "application/octet-stream"
        maintype, subtype = ctype.split("/", 1)
        msg.add_attachment(
            path.read_bytes(),
            maintype=maintype,
            subtype=subtype,
            filename=path.name,
        )

    try:
        ctx = ssl.create_default_context()
        with smtplib.SMTP(creds["host"], int(creds["port"])) as s:
            s.starttls(context=ctx)
            s.login(creds["user"], creds["password"])
            s.send_message(msg)
        return {"sent": True, "to": to_addrs, "subject": subject}
    except Exception as e:
        return {"sent": False, "error": str(e)[:300]}


def build_html_summary(state_dir: Path, store_name: str, docx_filename: str) -> tuple[str, str]:
    """Render an inline HTML summary from state files."""
    catalog = json.loads((state_dir / "catalog.json").read_text())
    audit = json.loads((state_dir / "audit.json").read_text())
    geo = (
        json.loads((state_dir / "geo.json").read_text())
        if (state_dir / "geo.json").exists() else None
    )
    lh = (
        json.loads((state_dir / "lighthouse.json").read_text())
        if (state_dir / "lighthouse.json").exists() else None
    )

    issues = audit["issues"]
    home_lh = (lh or [{}])[0] if lh else {}
    perf = home_lh.get("scores", {}).get("performance")
    seo = home_lh.get("scores", {}).get("seo")

    rows = [
        ("Products", len(catalog["products"])),
        ("Pages crawled", audit["pages_crawled"]),
        ("Lighthouse Performance (mobile homepage)", f"{perf}/100" if perf is not None else "n/a"),
        ("Lighthouse SEO", f"{seo}/100" if seo is not None else "n/a"),
        ("Titles >60 chars", len(issues["title_too_long"])),
        ("Multiple H1", len(issues["multiple_h1"])),
        ("Missing meta", len(issues["missing_meta_desc"])),
        ("Broken pages", len(issues["broken"])),
    ]
    if geo:
        for engine, sm in geo["summary"].items():
            if sm.get("n"):
                rows.append((
                    f"GEO — {engine} brand citation",
                    f"{sm.get('brand_cited_pct', 0)}% / {sm['n']} prompts · {sm.get('competitor_cited_total', 0)} competitor mentions",
                ))

    actions = []
    if perf is not None and perf < 80:
        actions.append(f"⚠ Homepage Lighthouse Performance {perf}/100 — optimize LCP/FCP")
    if len(issues["title_too_long"]) > 0:
        actions.append(f"Trim {len(issues['title_too_long'])} page titles to ≤60 chars (SERP truncation)")
    if len(issues["multiple_h1"]) > 0:
        actions.append(f"Fix {len(issues['multiple_h1'])} pages with multiple <h1>")
    if geo and any(s.get("brand_cited_pct", 0) == 0 for s in geo["summary"].values() if s.get("n")):
        actions.append("Brand has 0% AI engine citation rate — publish llms-full.txt + comparison content")
    if len(issues["missing_meta_desc"]) > 0:
        actions.append(f"Write meta descriptions for {len(issues['missing_meta_desc'])} pages")

    table_html = "".join(f"<tr><td style='padding:4px 12px 4px 0;color:#666'>{k}</td><td style='padding:4px 0;font-weight:600'>{v}</td></tr>" for k, v in rows)
    actions_html = "".join(f"<li style='margin:6px 0'>{a}</li>" for a in actions) or "<li>No high-priority actions this week.</li>"

    html = f"""<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#222;max-width:680px">
<h2 style="margin:0 0 4px">Shopify {store_name} — SEO + GEO Weekly</h2>
<p style="margin:0 0 16px;color:#666">Store: {catalog['shop']['shop']['name']} · {catalog['shop']['shop']['primaryDomain']['url']}</p>

<h3 style="margin:24px 0 8px">Snapshot</h3>
<table style="border-collapse:collapse;font-size:14px">{table_html}</table>

<h3 style="margin:24px 0 8px">Action items</h3>
<ol style="font-size:14px;padding-left:20px;margin:0">{actions_html}</ol>

<p style="margin:24px 0 4px;font-size:13px;color:#888">Full report attached: <strong>{docx_filename}</strong></p>
<p style="margin:0;font-size:12px;color:#aaa">Generated by seo-geo-weekly · CellDigital Affiliate Team</p>
</body></html>"""

    text = f"""Shopify {store_name} — SEO + GEO Weekly

Snapshot:
""" + "\n".join(f"  {k}: {v}" for k, v in rows) + "\n\nActions:\n" + "\n".join(f"  - {a}" for a in actions) + f"\n\nFull report: {docx_filename}\n"

    return html, text


if __name__ == "__main__":
    import sys
    state = Path(sys.argv[1])
    docx = Path(sys.argv[2])
    to = sys.argv[3].split(",")
    html, text = build_html_summary(state, "Dark Fantasy", docx.name)
    result = send(to, f"[SEO+GEO Weekly] {docx.stem}", html, text, [docx])
    print(json.dumps(result, indent=2))
