#!/usr/bin/env python3
"""HTML + PDF renderer for v2 data.

Reads {region}_data_v2.json → outputs:
  ~/Downloads/Awin-Rockbros-{REGION}-周报-{DATE}.html
  ~/Downloads/Awin-Rockbros-{REGION}-周报-{DATE}.pdf  (Chromium headless)

Layout optimizations vs v2 docx:
  - Print-tuned A4 CSS with proper margins + page-break-inside avoid
  - Dense table rows (tighter line-height) so wide tables fit landscape
  - Color dot column highlighted (background per status)
  - Section dividers + numbered headings
  - Sticky table headers
  - Embedded screenshots base64
"""
import argparse, asyncio, base64, html as html_lib, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHART_DIR = ROOT / "output" / "charts"

CSS = r"""
@page {
  size: A4 portrait;
  margin: 14mm 14mm 14mm 14mm;
}
@page landscape {
  size: A4 landscape;
  margin: 12mm 14mm 12mm 14mm;
}
* { box-sizing: border-box; }
html, body {
  font-family: -apple-system, "PingFang SC", "Heiti TC", "Microsoft YaHei", sans-serif;
  color: #1a1a1a;
  font-size: 10.5pt;
  line-height: 1.45;
  margin: 0; padding: 0;
}
.cover {
  text-align: center;
  padding: 8mm 0 6mm 0;
  border-bottom: 2px solid #1F3A93;
  margin-bottom: 6mm;
}
.cover h1 {
  font-size: 22pt;
  color: #1F3A93;
  margin: 0 0 2mm 0;
  font-weight: 700;
}
.cover .meta {
  color: #666;
  font-size: 10pt;
}
h1.section {
  color: #1F3A93;
  font-size: 16pt;
  border-left: 5px solid #1F3A93;
  padding-left: 8px;
  margin: 6mm 0 2mm 0;
  break-after: avoid;
}
h1.section.break-before { page-break-before: always; margin-top: 0; }
h2.subsection {
  color: #2E5BCC;
  font-size: 13pt;
  margin: 4mm 0 2mm 0;
  break-after: avoid;
}
.takeaways {
  background: #F3F6FB;
  border-left: 4px solid #2E5BCC;
  padding: 8px 12px;
  margin: 3mm 0;
}
.takeaways .title { font-weight: 700; color: #1F3A93; margin-bottom: 4px; }
.takeaways ul { margin: 0; padding-left: 18px; }

.callout {
  background: #FFF7E1;
  border: 1px solid #EFB54C;
  border-left: 4px solid #EFB54C;
  border-radius: 4px;
  padding: 10px 14px;
  margin: 3mm 0 4mm 0;
  break-inside: avoid;
}
.callout .title {
  color: #8A5A00;
  font-weight: 700;
  font-size: 11pt;
  margin-bottom: 4px;
}
.callout ul { margin: 0; padding-left: 18px; color: #5A3A00; }
.callout li { margin: 2px 0; }

table.data {
  width: 100%;
  border-collapse: collapse;
  margin: 2mm 0 4mm 0;
  break-inside: avoid;
  font-size: 9.5pt;
}
table.data thead th {
  background: #1F3A93;
  color: #fff;
  padding: 6px 8px;
  font-weight: 600;
  text-align: left;
  font-size: 9.5pt;
}
table.data tbody td {
  padding: 5px 8px;
  border-bottom: 1px solid #E0E5EE;
  vertical-align: middle;
}
table.data tbody tr:nth-child(even) td { background: #F7F9FC; }
table.data .status {
  text-align: center;
  font-size: 12pt;
  width: 38px;
}
table.data .num { text-align: right; font-variant-numeric: tabular-nums; }
.dot-green { background: #E6F7E6 !important; }
.dot-yellow { background: #FFF8E1 !important; }
.dot-red { background: #FCE6E6 !important; }

.gmv-bigtiles {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin: 3mm 0 4mm 0;
}
.tile {
  border: 1px solid #E0E5EE;
  border-radius: 6px;
  padding: 10px 12px;
  background: #fff;
}
.tile .label { color: #666; font-size: 9pt; }
.tile .value { font-size: 15pt; font-weight: 700; color: #1F3A93; margin: 2px 0; }
.tile .delta { font-size: 9.5pt; }
.delta-up { color: #2D8A2D; }
.delta-down { color: #C42424; }
.delta-flat { color: #888; }

.chart { text-align: center; margin: 3mm 0 4mm 0; break-inside: avoid; }
.chart img { max-width: 100%; height: auto; }
/* Screenshots can be tall; allow break to prevent orphan headings */
.screenshot { text-align: center; margin: 3mm 0 4mm 0; }
.screenshot img { max-width: 100%; max-height: 240mm; height: auto; border: 1px solid #DDD; object-fit: contain; }
.screenshot .caption { font-size: 9pt; color: #777; margin-top: 3px; }
/* Pair heading + screenshot so they don't orphan */
.screenshot-block { page-break-before: auto; page-break-inside: auto; }
.screenshot-block h2 { break-after: avoid; }

.actions-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin: 2mm 0 4mm 0;
}
.actions-col {
  background: #F7F9FC;
  border-left: 4px solid #2E5BCC;
  padding: 10px 12px;
  break-inside: avoid;
}
.actions-col .title { color: #1F3A93; font-weight: 700; margin-bottom: 4px; }
.actions-col ul { margin: 0; padding-left: 18px; }
.actions-col li { margin: 2px 0; font-size: 10pt; }

.landscape { page: landscape; }
.page-break { page-break-after: always; }

footer.report-footer {
  text-align: center;
  font-size: 8.5pt;
  color: #999;
  border-top: 1px solid #E0E5EE;
  margin-top: 8mm;
  padding-top: 4mm;
}
"""

def esc(s): return html_lib.escape(str(s)) if s is not None else "—"

def dot_class(emoji):
    if "🟢" in emoji: return "dot-green"
    if "🔴" in emoji: return "dot-red"
    return "dot-yellow"

def delta_class(s):
    s = str(s)
    if "▲" in s: return "delta-up"
    if "▼" in s: return "delta-down"
    return "delta-flat"

def render_table(headers, rows, status_col_idx=None, num_cols=None):
    if not rows: return ""
    num_cols = num_cols or set()
    out = ['<table class="data"><thead><tr>']
    for i, h in enumerate(headers):
        cls = "status" if i == status_col_idx else ("num" if i in num_cols else "")
        out.append(f'<th class="{cls}">{esc(h)}</th>')
    out.append('</tr></thead><tbody>')
    for row in rows:
        out.append('<tr>')
        for i, val in enumerate(row[:len(headers)]):
            v = str(val) if val is not None else "—"
            classes = []
            if i == status_col_idx:
                classes.append("status")
                classes.append(dot_class(v))
            elif i in num_cols:
                classes.append("num")
            if "▲" in v or "▼" in v:
                classes.append(delta_class(v))
            cls = " ".join(classes)
            out.append(f'<td class="{cls}">{esc(v)}</td>')
        out.append('</tr>')
    out.append('</tbody></table>')
    return "".join(out)

def render_callout(title, lines, kind="orange"):
    if not lines: return ""
    items = "".join(f'<li>{esc(l)}</li>' for l in lines)
    return f'<div class="callout"><div class="title">🔍 {esc(title)}</div><ul>{items}</ul></div>'

def render_takeaways(lines):
    if not lines: return ""
    items = "".join(f'<li>{esc(l)}</li>' for l in lines)
    return f'<div class="takeaways"><div class="title">三大判断</div><ul>{items}</ul></div>'

def embed_image(path, alt=""):
    p = Path(path)
    if not p.exists(): return ""
    b64 = base64.b64encode(p.read_bytes()).decode()
    ext = p.suffix.lstrip(".").lower() or "png"
    return f'<img src="data:image/{ext};base64,{b64}" alt="{esc(alt)}">'

def build_html(data):
    cur = data["currency_symbol"]
    region = data["region_name"]
    code = data["region_code"]
    date = data["report_date"]
    mid = data["merchant_id"]

    # KPI tiles strip — derive from gmv_summary
    tiles_html = ""
    if data.get("gmv_summary"):
        tiles = []
        for row in data["gmv_summary"][:4]:
            tiles.append(f"""
              <div class="tile">
                <div class="label">{esc(row[0])}</div>
                <div class="value">{esc(row[1])}</div>
                <div class="delta {delta_class(row[3])}">{esc(row[3])} vs {esc(row[2])}</div>
              </div>""")
        # additionally: orders + clicks from exec_kpi
        for row in data.get("exec_kpi", []):
            if row[0] in ("本周订单数", "本周点击"):
                tiles.append(f"""
                  <div class="tile">
                    <div class="label">{esc(row[0])}</div>
                    <div class="value">{esc(row[1])}</div>
                    <div class="delta {delta_class(row[2])}">{esc(row[2])} vs {esc(row[3])}</div>
                  </div>""")
        tiles_html = f'<div class="gmv-bigtiles">{"".join(tiles[:4])}</div>'

    parts = []
    parts.append(f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>Awin Rockbros {region} 联盟营销周报 {date}</title>
<style>{CSS}</style>
</head><body>
<div class="cover">
  <h1>Awin Rockbros {esc(region)} 联盟营销周报</h1>
  <div class="meta">Merchant ID: {esc(mid)}  ·  报告日期: {esc(date)}  ·  数据来源: Awin Performance Over Time + Affiliate Performance 后台</div>
</div>
""")

    # ---- §1 执行摘要 ----
    parts.append('<h1 class="section">1. 执行摘要</h1>')
    parts.append(tiles_html)
    if data.get("exec_kpi"):
        parts.append(render_table(
            ["指标", "当前", "对比", "基准 / 上周期", "状态"],
            data["exec_kpi"], status_col_idx=4))
    parts.append(render_takeaways(data.get("exec_takeaways", [])))
    parts.append(render_callout("诊断与建议",
        [data.get("exec_diagnosis","")] + data.get("exec_suggestions", [])))

    # ---- §2 GMV 表现深度 ----
    parts.append('<h1 class="section">2. GMV 表现深度</h1>')
    if data.get("gmv_summary"):
        parts.append('<h2 class="subsection">2.1 周期对比</h2>')
        parts.append(render_table(
            ["周期", "当前", "对比周期", "环比", "状态"],
            data["gmv_summary"], status_col_idx=4, num_cols={1,2}))
        # bar chart
        p = CHART_DIR / f"{code}_gmv_compare.png"
        if p.exists():
            parts.append(f'<div class="chart">{embed_image(p, "GMV 周月对比")}</div>')

    if data.get("gmv_trend_week"):
        parts.append('<h2 class="subsection">2.2 日度 GMV 走势（本周 vs 上周）</h2>')
        p = CHART_DIR / f"{code}_daily_trend.png"
        if p.exists():
            parts.append(f'<div class="chart">{embed_image(p, "日度 GMV 走势")}</div>')
        parts.append(render_table(
            ["日期", "本周 GMV", "上周 GMV", "环比", "备注"],
            data["gmv_trend_week"], num_cols={1,2}))

    if data.get("perf_thisweek_screenshot") and Path(data["perf_thisweek_screenshot"]).exists():
        parts.append('<div class="screenshot-block">')
        parts.append('<h2 class="subsection">2.3 Awin 后台 — 本周 Performance Over Time 截图</h2>')
        parts.append(f'<div class="screenshot">{embed_image(data["perf_thisweek_screenshot"])}<div class="caption">Awin 后台 Performance Over Time — 本周数据</div></div>')
        parts.append('</div>')

    parts.append(render_callout("GMV 诊断与建议",
        [data.get("gmv_diagnosis","")] + data.get("gmv_suggestions", [])))

    # ---- §3 Publisher 表现 ----
    parts.append('<h1 class="section">3. Publisher 表现</h1>')
    if data.get("channel_mix"):
        parts.append('<h2 class="subsection">3.1 Publisher GMV 占比（Awin 后台数据）</h2>')
        p = CHART_DIR / f"{code}_donut.png"
        if p.exists():
            parts.append(f'<div class="chart">{embed_image(p, "Publisher GMV 占比")}</div>')
        parts.append(render_table(
            ["Publisher", "数量占比", "周 GMV", "状态"],
            data["channel_mix"], status_col_idx=3, num_cols={1,2}))

    # 3.2 Top publishers — landscape table (wide)
    if data.get("top_publishers"):
        parts.append('<div class="landscape">')
        parts.append('<h2 class="subsection">3.2 Top Publishers (按 GMV 排序)</h2>')
        parts.append(render_table(
            ["Publisher", "ID", "Clicks", "CVR", "订单", "周 GMV", "佣金"],
            data["top_publishers"], num_cols={2,4,5,6}))
        parts.append('</div>')

    parts.append(render_callout("Publisher 诊断与建议",
        [data.get("pub_diagnosis","")] + data.get("pub_suggestions", [])))

    # ---- §4 本周新增 Publisher ----
    if data.get("new_publishers"):
        parts.append(f'<h1 class="section">4. 本周新增 Publisher（{data.get("new_publishers_count",0)} 家）</h1>')
        parts.append(render_table(
            ["Publisher", "Website", "类型", "行业", "加入日期"],
            data["new_publishers"]))
        parts.append(render_callout("招募诊断与建议",
            [data.get("recruit_diagnosis","")] + data.get("recruit_suggestions", [])))

    # ---- §5 下周行动计划 ----
    parts.append('<h1 class="section">5. 下周行动计划</h1>')
    actions = []
    if data.get("actions_growth"):
        actions.append(f"""<div class="actions-col"><div class="title">5.1 增长</div><ul>{"".join(f"<li>{esc(a)}</li>" for a in data["actions_growth"])}</ul></div>""")
    if data.get("actions_recruit"):
        actions.append(f"""<div class="actions-col"><div class="title">5.2 招募</div><ul>{"".join(f"<li>{esc(a)}</li>" for a in data["actions_recruit"])}</ul></div>""")
    if data.get("actions_optimize"):
        actions.append(f"""<div class="actions-col"><div class="title">5.3 优化</div><ul>{"".join(f"<li>{esc(a)}</li>" for a in data["actions_optimize"])}</ul></div>""")
    if actions:
        parts.append(f'<div class="actions-grid">{"".join(actions)}</div>')

    # ---- §6 KPI 仪表盘 ----
    if data.get("kpi_dashboard"):
        parts.append('<h1 class="section">6. KPI 仪表盘</h1>')
        parts.append(render_table(
            ["指标", "当前", "目标", "差距", "动作"],
            data["kpi_dashboard"]))

    parts.append(f"""<footer class="report-footer">
        数据来源: Awin 后台 (performance-over-time + affiliate-performance + partnerships) ·
        自动化采集 by CellDigital Affiliate Team · 生成时间 {esc(date)}
    </footer></body></html>""")

    return "\n".join(parts)

async def html_to_pdf(html_path, pdf_path):
    from playwright.async_api import async_playwright
    file_url = f"file://{Path(html_path).resolve()}"
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto(file_url, wait_until="networkidle")
        await page.pdf(
            path=str(pdf_path),
            format="A4",
            margin={"top": "12mm", "bottom": "12mm", "left": "12mm", "right": "12mm"},
            print_background=True,
            prefer_css_page_size=True,
        )
        await browser.close()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--out-html", required=True)
    ap.add_argument("--out-pdf", required=True)
    args = ap.parse_args()
    data = json.load(open(args.data))
    html = build_html(data)
    Path(args.out_html).write_text(html, encoding="utf-8")
    print(f"HTML → {args.out_html}")
    asyncio.run(html_to_pdf(args.out_html, args.out_pdf))
    print(f"PDF  → {args.out_pdf}")

if __name__ == "__main__":
    main()
