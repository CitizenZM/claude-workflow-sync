---
name: awin-oufer-us-weekly-report
description: Awin Oufer Jewelry US 联盟营销周报 — 自动登录 Awin（advertiser 91941），抓取 KPI / Publisher / 新增合作 / 截图，生成中文 Word / HTML / PDF / Obsidian Markdown 周报（含新 Publisher 列表、周/月 GMV、Top Publisher、邮件追溯、品牌行动项 + 截图嵌入 + 诊断与建议），并同步推送到 GitHub 私仓 + Vercel（SSO 保护）。
tags: [affiliate, awin, oufer, jewelry, report, weekly, playwright, docx, html, pdf, chinese]
---

# Awin Oufer Jewelry US 联盟营销周报（中文版）

## 架构概览

两阶段：
- **Phase 1 (Sonnet)** — Playwright 登录 → 抓取 home / publishers / partnerships → 全屏截图 → 落 JSON
- **Phase 2 (任意模型)** — `scripts/publish.sh` 调 Python 生成器输出 4 格式 → push 到 GitHub → deploy 到 Vercel → 删 vanity alias

JS 脚本 (`scripts/`):
- `login.js` — 单次登录流程（cookie + email + Continue + password + Sign-in）
- `extract-home.js` — 抓取 KPI tile + 文本
- `extract-publishers.js` — 抓取 publisher 列表表格
- `generate_simple_report.py` — 5 节简化中文报告（DOCX + HTML + PDF + Obsidian MD）
- `publish.sh` — 端到端 pipeline（render → git → vercel → alias cleanup）

## 配置 (Configuration)

| Key | Value |
|-----|-------|
| US_MERCHANT_ID | `91941` |
| BRAND | `Oufer Jewelry` |
| EMAIL | 见 `.env`（`AWIN_EMAIL`，复制 `.env.example` 填入） |
| PASSWORD | 见 `.env`（`AWIN_PASSWORD`，复制 `.env.example` 填入） |
| US_HOME | `https://app.awin.com/en/awin/advertiser/91941/home` |
| US_PUBLISHERS | `https://app.awin.com/en/awin/advertiser/91941/reports/publisher-performance` |
| US_PARTNERSHIPS | `https://app.awin.com/en/awin/advertiser/91941/partnerships/all` |
| OUTPUT_DIR | `$HOME/Downloads`（可在 `.env` 覆盖） |
| ARTIFACT_DIR | `$SKILL_ROOT/output` |
| REPORTS_GH_REPO | `oufer-affiliate-weekly-reports`（与 Rockbros 报告分仓隔离） |
| VERCEL_PROJECT_NAME | `oufer-affiliate-weekly-reports` |

## Token 与抓取规则

1. 登录后 NEVER `browser_snapshot`。
2. 用 `browser_evaluate` 注入抓取函数，return JSON string。
3. 若页面是 iframe / canvas（Looker 风格）→ 切换为 `browser_resize(1600, 2400)` + `browser_take_screenshot(fullPage=true)` 取整图。
4. 新增 Publisher：访问 `/partnerships/all`，按 `Joined: Newest-to-oldest` 排序，抓取首 3 页（≈ 30 条）。
5. 所有原始 JSON 落到 `output/us_*.json`，截图落 `output/us_*.png`。

## 🔒 隐私与排版硬规则（外发报告必须遵守）

1. **NEVER 暴露 Publisher 邮箱** — 所有外发的 .docx / .pdf / .html 报告中，邮件清单必须 DROP email 列；
   如结构必须保留则脱敏为 `xx****@domain`。`scripts/generate_simple_report.py::scrub_emails()` 已实现。
   原始 JSON 内部仍保留邮箱以供 ops 使用，渲染前先 `scrub_emails(data)`。
2. **表格排版** — 凡 > 5 列或含长文本列（subject/action/影响）必须：
   - 使用 `add_table(... widths_cm=[...])` 显式设置每列 cm 宽度
   - 章节切换为 landscape：`new_section(doc, orientation="landscape")` + 调用 `add_diagnosis(... width_cm=LANDSCAPE_WIDTH_CM)`
   - 表格 `autofit=False` + `tblLayout=fixed`，避免 python-docx 自动塌缩
3. **页面方向** — Section 4（邮件追溯）与 Section 5（品牌行动）默认 landscape；前 3 节 portrait。

## 简化版 5 节报告（multi-format）

`scripts/generate_simple_report.py` — 单数据源同步产出 .docx + .html + .pdf + Obsidian .md：

```bash
python3 scripts/generate_simple_report.py \
  --data output/oufer_simple_data.json \
  --out-dir ~/Downloads \
  --date $(date +%F) \
  --obsidian-dir "/Users/xiaozuo/Documents/Obsidian Vault/01-Projects/Oufer-Weekly-Report"
```

依赖：`python3 -m pip install python-docx playwright && python3 -m playwright install chromium`（PDF 由 Chromium headless 渲染 HTML 得到）。

## 报告章节（5 节简化版）

1. **新增 Publisher 列表** — 过去自然周新加入合作的 publisher（名称 / 类型 / 加入日期 / 状态）
2. **周 / 月 GMV 对比** — 本周 GMV / 本月 GMV + 后台截图
3. **Top Publisher 表现** — Top 10 + 集中度
4. **邮件追溯（30 天）** — 从 affiliate@celldigital.co 出去的邮件（邮箱脱敏）+ 待跟进 todo + 已发素材
5. **品牌侧行动项** — Owner / Action / Due / Status

每节末尾自动注入「🔍 诊断与建议」黄色 callout 块。

## 输出文件名

- `Oufer-简化周报-{YYYY-MM-DD}.docx`
- `Oufer-简化周报-{YYYY-MM-DD}.html`
- `Oufer-简化周报-{YYYY-MM-DD}.pdf`
- `Oufer-简化周报-{YYYY-MM-DD}.md`（Obsidian）

均写入 `$OUTPUT_DIR`（默认 `~/Downloads`）。

## 运行命令

```bash
# ── Phase 1: 抓数据（Sonnet 阶段，通过 Claude Code + Playwright MCP）──
# @awin-oufer-us-weekly-report
# "抓取本周 Oufer US Awin 数据，更新 oufer_simple_data.json"

# ── Phase 2: 渲染 + 推送（任意模型）──
cd ~/.claude/skills/awin-oufer-us-weekly-report
bash scripts/publish.sh                           # 用今天日期
bash scripts/publish.sh --date 2026-04-16         # 指定日期
bash scripts/publish.sh --skip-vercel             # 只推 GitHub
bash scripts/publish.sh --skip-github             # 只本地渲染
```

## 数据 JSON 结构（US only）

顶层字段（与 `data/oufer_simple_data.example.json` 一致）：
- `report_date`, `report_period`, `brand` (= "Oufer Jewelry"), `operator`
- `screenshots` (dict: `us_home`, `us_publishers`)
- `section1_new_publishers` (list: region/name/type/joined_date/status)
- `section1_summary` (dict: us_count / highlight)
- `section2_sales` (dict: us_weekly_gmv / us_monthly_gmv / wow_change / mom_change)
- `section2_diagnosis` (str)
- `section3_top_publishers` (list: rank/name/gmv/orders/cvr)
- `section3_diagnosis` (str)
- `section4_emails` (list: date/publisher/email/subject/status/next_action) — **email 列会被 scrub**
- `section4_todo` (list[str]), `section4_assets` (list)
- `section5_brand_actions` (list: owner/action/due/status)
- `section5_summary` (str)

## 与 Rockbros 周报的区别

| 维度 | Rockbros | Oufer |
|---|---|---|
| 区域 | US + EU（双 advertiser） | 仅 US（单 advertiser 91941） |
| 报告仓 | `affiliate-weekly-reports` | `oufer-affiliate-weekly-reports`（独立） |
| Vercel 项目 | `affiliate-weekly-reports` | `oufer-affiliate-weekly-reports`（独立） |
| 数据文件 | `rockbros_simple_data.json` | `oufer_simple_data.json` |
| 报告文件名 | `Rockbros-简化周报-{date}.*` | `Oufer-简化周报-{date}.*` |
| Obsidian 目录 | `Rockbros-Weekly-Report/` | `Oufer-Weekly-Report/` |

所有底层脚本与 Rockbros 共享同一套 `generate_simple_report.py` + `publish.sh` 模板，仅通过 `.env` 区分运行时配置。
