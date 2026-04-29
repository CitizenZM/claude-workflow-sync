# Awin Rockbros Weekly Report — Claude Code Skill

End-to-end automation for the **ROCKBROS** affiliate marketing weekly report on Awin US (advertiser 58007) + EU (advertiser 122456). Operated by Cell Digital Technology Inc.

**One activation, four formats, two destinations:**
- 📄 Renders DOCX + HTML + PDF + Obsidian Markdown from a single JSON data source
- 🔒 Scrubs publisher emails from all external-facing outputs (privacy hard rule)
- 📦 Pushes HTML/PDF/screenshots to a private GitHub repo (content store)
- 🌐 Deploys to Vercel with automatic vanity-alias removal (only SSO-protected hash URL survives)

---

## Quick start (other Mac)

```bash
# Single command — clones skill into ~/.claude/skills/, installs deps, prompts for .env
curl -fsSL https://raw.githubusercontent.com/CitizenZM/awin-rockbros-weekly-report-skill/main/bootstrap.sh | bash
```

After bootstrap completes, edit `~/.claude/skills/awin-rockbros-weekly-report/.env` with real Awin credentials and re-launch Claude Code. The skill auto-loads on next session.

---

## Activation in Claude Code

| Trigger | Action |
|---|---|
| `@awin-rockbros-weekly-report` | Mention to load skill into context |
| `生成 Rockbros 简化周报并发布到 GitHub + Vercel` | Plain Chinese — Claude will pick the skill |
| `bash scripts/publish.sh` | Direct shell — bypasses Claude entirely |

---

## Skill architecture

```
awin-rockbros-weekly-report/
├── SKILL.md                          # Claude-facing skill spec (auto-loaded)
├── README.md                         # this file (for GitHub viewers)
├── bootstrap.sh                      # one-shot setup for new Mac
├── .env.example                      # credential template
├── .gitignore                        # excludes .env / output / *.png / *.pdf / *.docx
├── scripts/
│   ├── publish.sh                    # ⭐ END-TO-END pipeline (render → git → vercel)
│   ├── generate_simple_report.py     # 5-section renderer (DOCX/HTML/PDF/MD)
│   ├── generate_report_zh.py         # 9-section consulting renderer (legacy)
│   ├── login.js                      # Playwright Awin login (Phase 1 scrape)
│   ├── extract-home.js               # Awin home KPI scraper
│   └── extract-publishers.js         # Publisher performance scraper
└── data/
    └── rockbros_simple_data.example.json   # sanitized sample
```

---

## Two-phase workflow

### Phase 1 — Scrape (Sonnet model)

Login + scrape Awin dashboards. Produces `output/rockbros_simple_data.json`.

```bash
# Through Claude Code — invoke skill, Claude drives Playwright MCP
@awin-rockbros-weekly-report
"抓取本周 Awin US + EU 数据，更新 rockbros_simple_data.json"
```

### Phase 2 — Publish (any model)

```bash
cd ~/.claude/skills/awin-rockbros-weekly-report
bash scripts/publish.sh                           # uses today's date
bash scripts/publish.sh --date 2026-04-16         # specific date
bash scripts/publish.sh --skip-vercel             # GitHub only
bash scripts/publish.sh --skip-github             # local only
```

---

## Hard rules enforced by the skill

1. **Publisher email privacy** — `scrub_emails()` runs before any renderer. The original JSON (under `output/`) keeps emails for ops; all rendered DOCX/HTML/PDF/MD have email columns dropped or masked as `xx****@domain`.
2. **Word/PDF layout** — Wide tables use landscape A4 + explicit `Cm()` column widths to prevent overflow. Sections with ≤ 5 narrow columns stay portrait.
3. **Vercel hardening** — Hobby tier auto-creates 3 PUBLIC vanity aliases on every deploy. The publish script deletes them via the Vercel API immediately after deployment, leaving only the SSO-protected deployment hash URL.

---

## Output destinations

| Where | Format | Audience | URL pattern |
|---|---|---|---|
| `~/Downloads/` | DOCX, HTML, PDF | Local review | filesystem |
| Obsidian vault | Markdown + attachments | Solo knowledge base | local filesystem |
| GitHub private repo (`affiliate-weekly-reports`) | HTML + PDF + screenshots | Team archive | `github.com/CitizenZM/affiliate-weekly-reports` |
| Vercel deployment | Rendered HTML | Brand-side / external | `affiliate-weekly-reports-<hash>-barrons-projects-<id>.vercel.app` (SSO-walled) |

---

## License & confidentiality

This skill is **internal tooling** for Cell Digital Technology Inc. The skill code itself can live in a public repo (no secrets — credentials come from local `.env`). The data it produces (under `output/` and the `affiliate-weekly-reports` repo) is **commercially sensitive** and must remain private.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `❌ .env missing` | Copy `.env.example` to `.env`, fill in Awin credentials |
| `gh: command not found` | `brew install gh && gh auth login` |
| `vercel: command not found` | `npm install -g vercel && vercel login` |
| PDF render fails | `python3 -m playwright install chromium` |
| Vercel returns 200 to vanity URL after publish | Re-run `bash scripts/publish.sh` — alias deletion may have race-conditioned; the script is idempotent |
| Publisher email leaks into report | `scrub_emails()` runs in `generate_simple_report.py`. Verify your data goes through that renderer (not legacy `generate_report.py`) |
