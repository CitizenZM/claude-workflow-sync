"""Append a structured run summary to the Obsidian Worklog.md."""
import datetime as dt
import json
from pathlib import Path

WORKLOG = Path.home() / "Documents/Obsidian/01-Projects/Dark-Fantasy-SEO-GEO-Weekly/Worklog.md"


def append_run(state_dir: Path, store_name: str, docx_path: Path, email_result: dict | None = None) -> None:
    if not WORKLOG.parent.exists():
        WORKLOG.parent.mkdir(parents=True, exist_ok=True)
    if not WORKLOG.exists():
        WORKLOG.write_text("---\ntype: worklog\n---\n\n# Worklog\n\nLatest entry at top.\n\n---\n\n")

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
    seo_score = home_lh.get("scores", {}).get("seo")
    lcp = home_lh.get("vitals", {}).get("lcp")

    today = dt.date.today()
    week = today.isocalendar()[1]

    entry = [
        f"## {today.isoformat()} — Week {week} run",
        "",
        f"- Store: {catalog['shop']['shop']['name']} · {catalog['shop']['shop']['primaryDomain']['url']}",
        f"- Catalog: {len(catalog['products'])} products · {len(catalog['collections'])} collections · {len(catalog['pages'])} pages",
        f"- Crawl: {audit['pages_crawled']} URLs · {len(issues['title_too_long'])} long titles · {len(issues['multiple_h1'])} multi-h1 · {len(issues['broken'])} broken",
        f"- Lighthouse home (mobile): Perf {perf}/100 · SEO {seo_score}/100 · LCP {lcp}",
    ]
    if geo:
        for engine, sm in geo["summary"].items():
            if sm.get("n"):
                entry.append(f"- GEO {engine}: brand cited {sm.get('brand_cited_pct', 0)}% / {sm['n']} prompts · {sm.get('competitor_cited_total', 0)} competitor mentions")
    entry.append(f"- Report: `{docx_path.name}`")
    if email_result:
        if email_result.get("sent"):
            entry.append(f"- Emailed: ✓ → {', '.join(email_result.get('to') or [])}")
        else:
            entry.append(f"- Email skipped: {email_result.get('error')}")
    entry.append("")
    entry.append("---")
    entry.append("")

    block = "\n".join(entry) + "\n"

    # Insert after the "Latest entry at top." preamble (above first existing run)
    body = WORKLOG.read_text()
    marker = "Latest entry at top."
    idx = body.find(marker)
    if idx < 0:
        WORKLOG.write_text(body + "\n" + block)
        return
    end_of_marker_block = body.find("---", idx)
    insert_at = body.find("\n", end_of_marker_block) + 1 if end_of_marker_block > 0 else len(body)
    WORKLOG.write_text(body[:insert_at] + "\n" + block + body[insert_at:])


if __name__ == "__main__":
    import sys
    append_run(Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3]))
