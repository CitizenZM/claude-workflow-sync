---
name: awin-rockbros-weekly-report
description: Awin Rockbros US+EU 联盟营销周报 — 自动登录 Awin 双账户，抓取 KPI / Publisher / 新增合作 / 截图，生成中文 Word 报告（含执行摘要、GMV 深度、Publisher 分析、新增 Publisher、活动、内容、风险、行动计划、KPI 仪表盘 + matplotlib 图表 + 截图嵌入 + 每节诊断与建议）。US 与 EU 各产出一份独立 .docx → ~/Downloads/。
tags: [affiliate, awin, rockbros, report, weekly, playwright, docx, chinese, infographics]
---

# Awin Rockbros US + EU 联盟营销周报（中文版）

## 架构概览

两阶段：
- **Phase 1 (Sonnet)** — Playwright 登录 → 抓取 home / publishers / partnerships → 全屏截图 → 落 JSON
- **Phase 2 (Opus, 报告组装)** — Python 生成器读 region JSON，渲染 matplotlib 图表，组装 .docx

JS 脚本 (`scripts/`):
- `login.js` — 单次登录流程（cookie + email + Continue + password + Sign-in）
- `extract-home.js` — 抓取 KPI tile + 文本
- `extract-publishers.js` — 抓取 publisher 列表表格
- `generate_report_zh.py` — 中文 .docx 生成器（含图表 + 诊断 + 双区域）

## 配置 (Configuration)

| Key | Value |
|-----|-------|
| US_MERCHANT_ID | `58007` |
| EU_MERCHANT_ID | `122456` |
| EMAIL | `affiliate@celldigital.co` |
| PASSWORD | `Celldigital2024*` |
| US_HOME | `https://app.awin.com/en/awin/advertiser/58007/home` |
| EU_HOME | `https://app.awin.com/en/awin/advertiser/122456/home` |
| US_PUBLISHERS | `https://app.awin.com/en/awin/advertiser/58007/reports/publisher-performance` |
| EU_PUBLISHERS | `https://app.awin.com/en/awin/advertiser/122456/reports/publisher-performance` |
| US_PARTNERSHIPS | `https://app.awin.com/en/awin/advertiser/58007/partnerships/all` |
| EU_PARTNERSHIPS | `https://app.awin.com/en/awin/advertiser/122456/partnerships/all` |
| OUTPUT_DIR | `/Users/xiaozuo/Downloads` |
| ARTIFACT_DIR | `/Users/xiaozuo/.claude/skills/awin-rockbros-weekly-report/output` |
| CHART_DIR | `output/charts/` (matplotlib PNG 中转) |

## Token 与抓取规则

1. 登录后 NEVER `browser_snapshot`。
2. 用 `browser_evaluate` 注入抓取函数，return JSON string。
3. 若页面是 iframe / canvas（Looker 风格）→ 切换为 `browser_resize(1600, 2400)` + `browser_take_screenshot(fullPage=true)` 取整图。
4. 新增 Publisher：访问 `/partnerships/all`，按 `Joined: Newest-to-oldest` 排序，抓取首 3 页（≈ 30 条）。
5. 所有原始 JSON 落到 `output/{us|eu}_*.json`，截图落 `output/{us|eu}_*.png`。

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
  --data output/rockbros_simple_data.json \
  --out-dir ~/Downloads \
  --date $(date +%F) \
  --obsidian-dir "/Volumes/workssd/ObsidianVault/01-Projects/Rockbros-Weekly-Report"
```

依赖：`python3 -m pip install playwright && python3 -m playwright install chromium`（PDF 由 Chromium headless 渲染 HTML 得到）。

## 报告章节顺序（中文）

1. **执行摘要** — KPI 快照表 + 三大判断 + 诊断/建议
2. **GMV 与绩效深度** — 七日对比线图 + 后台截图 + 渠道甜甜圈 + 地域/设备/品类
3. **Publisher 表现** — Top 10 横向条图 + 集中度仪表盘 + 漏斗图
4. **本周新增 Publisher** — 列表 + 类型分布 + 激活跟踪（TTFS）
5. **活动 / 推广绩效** — Campaign 表 + Offer 表
6. **内容与达人表现** — 内容 GMV 拆解 + Top 内容
7. **风险与异常** — 风险表 + 综合诊断
8. **下周行动计划** — 增长 / 招募 / 优化 三类（带 Owner + Done by）
9. **KPI 仪表盘** — 当前 / 目标 / 差距 / 动作

每节末尾自动注入「🔍 诊断与建议」黄色 callout 块。

## matplotlib 图表清单

| 图表 | 用途 |
|-----|-----|
| `{region}_gmv_trend.png` | 七日 GMV 趋势（本周 vs 上周双线 + 标签）|
| `{region}_channel_donut.png` | 渠道结构甜甜圈 |
| `{region}_top_pub.png` | Top 10 Publisher 横向条图 |
| `{region}_funnel.png` | Publisher 生命周期漏斗 |
| `{region}_gauge.png` | Top 3 集中度半圆仪表盘 |

中文字体：自动选择 `PingFang SC` → `Heiti TC` → `Arial Unicode MS` → `Songti SC`。

## 输出文件名

- `Awin-Rockbros-US-周报-{YYYY-MM-DD}.docx`
- `Awin-Rockbros-EU-周报-{YYYY-MM-DD}.docx`

均写入 `/Users/xiaozuo/Downloads/`。

## 运行命令

```bash
# 抓数据（Sonnet 阶段）
# 1) 登录
# 2) navigate → home → 全屏截图 + extract-home.js
# 3) navigate → reports/publisher-performance → resize 1600x2400 → 全屏截图
# 4) navigate → partnerships/all (sort: Joined desc) → 截图 + 文本抓取

# 生成报告（Opus 阶段）
cd ~/.claude/skills/awin-rockbros-weekly-report
python3 scripts/generate_report_zh.py --data output/us_data_zh.json --out ~/Downloads/Awin-Rockbros-US-周报-$(date +%F).docx
python3 scripts/generate_report_zh.py --data output/eu_data_zh.json --out ~/Downloads/Awin-Rockbros-EU-周报-$(date +%F).docx
```

## 数据 JSON 结构（per region）

必填字段：
- `region_name`, `region_code`, `merchant_id`, `currency_symbol`, `report_date`
- `home_screenshot`, `publishers_screenshot`
- `exec_kpi` (5 列: 指标 / 本周 / 环比 / 目标 / 状态)
- `exec_takeaways` (list[str], 3-5 条)
- `exec_diagnosis` (str), `exec_suggestions` (list[str])
- `gmv_trend` (5 列: 日期 / 本周 GMV / 上周 GMV / 环比 / 备注)
- `channel_breakdown` (5 列), `geo_device_product` (3 列)
- `gmv_diagnosis`, `gmv_suggestions`
- `top_publishers` (6 列), `concentration` (4 列), `top3_concentration_pct` (float), `lifecycle` (3 列)
- `pub_diagnosis`, `pub_suggestions`
- `new_publishers_count`, `new_publishers` (5 列), `new_pub_breakdown` (4 列), `activation` (5 列)
- `recruit_diagnosis`, `recruit_suggestions`
- `campaigns` (5 列), `offers` (4 列), `camp_diagnosis`, `camp_suggestions`
- `content_mix` (4 列), `top_content` (5 列), `content_diagnosis`, `content_suggestions`
- `risks` (4 列), `risk_diagnosis`, `risk_suggestions`
- `actions_growth`, `actions_recruit`, `actions_optimize` (list[str])
- `kpi_dashboard` (5 列)

## 历史输出版本

- `Affiliate-Weekly-Report-{date}.docx` (英文初版，已弃用)
- `Awin-Rockbros-{US|EU}-周报-{date}.docx` (当前版本，中文 + 区域分离 + matplotlib 图表)
