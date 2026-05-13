"""Pull keywords + competitors from Obsidian markdown into config.yaml."""
import re
from pathlib import Path
import yaml

OBSIDIAN_FILE = Path.home() / "Documents/Obsidian/01-Projects/Dark-Fantasy-SEO-GEO-Weekly/Keywords-and-Competitors.md"
CONFIG_FILE = Path(__file__).resolve().parent.parent / "config.yaml"


def parse_block(text: str, header: str) -> list[str]:
    """Extract code-block lines under a header like '## Seed keywords'."""
    pattern = rf"##\s+{re.escape(header)}.*?```(.*?)```"
    m = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
    if not m:
        return []
    return [line.strip() for line in m.group(1).strip().splitlines() if line.strip()]


def main():
    if not OBSIDIAN_FILE.exists():
        print(f"Obsidian file missing: {OBSIDIAN_FILE}")
        return
    text = OBSIDIAN_FILE.read_text()
    keywords = parse_block(text, "Seed keywords")
    competitors = parse_block(text, "Competitors")

    cfg = yaml.safe_load(CONFIG_FILE.read_text())
    cfg["keywords"] = keywords
    cfg["competitors"] = competitors
    CONFIG_FILE.write_text(yaml.dump(cfg, sort_keys=False, default_flow_style=False))

    print(f"Synced: {len(keywords)} keywords, {len(competitors)} competitors")


if __name__ == "__main__":
    main()
