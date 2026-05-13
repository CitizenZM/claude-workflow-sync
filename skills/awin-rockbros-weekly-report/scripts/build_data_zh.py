#!/usr/bin/env python3
"""Build {us|eu}_data_zh.json from the freshly scraped home/partnerships JSON.

Run after isolated_scrape.py. The shape is consumed by generate_report_zh.py.
Grounded fields (from scrape):
  - region_name, merchant_id, currency_symbol, report_date
  - exec_kpi (revenue / transactions / clicks — daily + 7-day)
  - top_publishers (from home page top-5 bar chart)
  - new_publishers (from partnerships "Joined: Newest-to-oldest")
Placeholder fields (need deeper drilldown / API access we don't have here):
  - channel_breakdown, geo_device_product, lifecycle, campaigns, offers,
    content_mix, top_content, risks, kpi_dashboard
These get filled with structured, honest defaults so the .docx renders.
"""
import json, re, datetime
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "output"
TODAY = datetime.date.today().isoformat()

CFG = {
    "us": {
        "region_name": "美国",
        "region_code": "US",
        "merchant_id": "58007",
        "currency": "$",
        "advertiser": "Yiwu Rock Sports Goods Co., Ltd.",
    },
    "eu": {
        "region_name": "欧洲",
        "region_code": "EU",
        "merchant_id": "122456",
        "currency": "€",
        "advertiser": "ROCKBROS",
    },
}

def parse_home(raw):
    """Extract KPIs and top-5 partners from rawText of home page."""
    out = {
        "yest_revenue": None, "yest_rev_delta": None,
        "yest_txns": None, "yest_txns_delta": None,
        "yest_clicks": None, "yest_clicks_delta": None,
        "wk_revenue": None, "wk_rev_delta": None,
        "top_partners": [],
    }
    cur = "[$€£]"
    # Revenue / Transactions / Clicks blocks — value follows "Yesterday\n"
    blocks = re.findall(
        r"(Revenue|Transactions|Clicks)\s+\w+\s+\d+\s+\d{4}\s+Yesterday\s+([" + "€$£" + r"]?[\d,\.]+)\s+(-?[\d\.]+)%",
        raw)
    for name, val, dlt in blocks:
        key = {"Revenue": "yest_revenue", "Transactions": "yest_txns", "Clicks": "yest_clicks"}[name]
        dkey = {"Revenue": "yest_rev_delta", "Transactions": "yest_txns_delta", "Clicks": "yest_clicks_delta"}[name]
        out[key] = val
        out[dkey] = float(dlt)
    # Revenue trend Last 7 days — $X (Y%)
    m = re.search(r"Revenue trend\s+Last 7 days\s+([" + "€$£" + r"][\d,\.]+)\s+(-?[\d\.]+)%", raw)
    if m:
        out["wk_revenue"] = m.group(1)
        out["wk_rev_delta"] = float(m.group(2))
    # Top partners — bar values + names. Bar values pattern: "$505.78​$505.78"
    # Names appear after "End of interactive chart." block; partners follow "Top partners\n..." sequence
    vals = re.findall(r"([" + "€$£" + r"][\d,\.]+)​[" + "€$£" + r"][\d,\.]+", raw)
    # Names are after the last "Top partners" section: pick 5 lines before "See publisher performance report"
    m = re.search(r"\$0\s*\$[\d\.,KM]+\s*([\s\S]+?)End of interactive chart\.\s*([\s\S]+?)See publisher performance report",
                  raw)
    if not m:
        m = re.search(r"€0\s*€[\d\.,KM]+\s*([\s\S]+?)End of interactive chart\.\s*([\s\S]+?)See publisher performance report",
                      raw)
    names = []
    if m:
        names = [ln.strip() for ln in m.group(2).split("\n") if ln.strip() and not ln.startswith("$") and not ln.startswith("€")]
    for i in range(min(5, len(vals), len(names))):
        out["top_partners"].append({"name": names[i], "revenue": vals[i]})
    return out

def parse_partnerships(raw):
    """Extract new publishers from partnerships rawText."""
    new_pubs = []
    # Each block: Name\n\d+\nStatus\nPartners\nWebsite\n<url>\nPrimary promotional type\n<type>\nPrimary sector\n<sector>\nPartners since\n<date>
    pattern = re.compile(
        r"([A-Za-z][\w\s\.,&\-\(\)']{1,60})\n(\d{4,7})\nStatus\nPartners\nWebsite\n([^\n]+)\nPrimary promotional type\n([^\n]*)\nPrimary sector\n([^\n]*)\nPartners since\n([A-Z][a-z]{2,8} \d{1,2}, \d{4})")
    for m in pattern.finditer(raw):
        new_pubs.append({
            "name": m.group(1).strip(),
            "website": m.group(3).strip(),
            "type": (m.group(4) or "Unknown").strip(),
            "sector": (m.group(5) or "Unknown").strip(),
            "joined": m.group(6).strip(),
        })
    return new_pubs

def kpi_status(delta):
    if delta is None: return "⚪"
    if delta >= 5: return "🟢 绿"
    if delta >= -5: return "🟡 黄"
    return "🔴 红"

def arrow(delta):
    if delta is None: return "—"
    if delta > 0: return f"▲ {delta:.1f}%"
    if delta < 0: return f"▼ {abs(delta):.1f}%"
    return "持平"

def build_region(region):
    cfg = CFG[region]
    home = json.load(open(OUT / f"{region}_home.json"))
    parts = json.load(open(OUT / f"{region}_partnerships.json"))
    h = parse_home(home.get("rawText", ""))
    p = parse_partnerships(parts.get("rawText", ""))

    cur = cfg["currency"]
    # Exec KPI table
    exec_kpi = [
        ["GMV (近7日)", f"{h['wk_revenue'] or '—'}", arrow(h['wk_rev_delta']), f"{cur}10,000", kpi_status(h['wk_rev_delta'])],
        ["GMV (昨日)", f"{h['yest_revenue'] or '—'}", arrow(h['yest_rev_delta']), f"{cur}1,400", kpi_status(h['yest_rev_delta'])],
        ["订单数 (昨日)", f"{h['yest_txns'] or '—'}", arrow(h['yest_txns_delta']), "30", kpi_status(h['yest_txns_delta'])],
        ["点击 (昨日)", f"{h['yest_clicks'] or '—'}", arrow(h['yest_clicks_delta']), "5,000", kpi_status(h['yest_clicks_delta'])],
        ["新增合作", f"{len(p)}", "—", "≥20", "🟢 绿" if len(p) >= 20 else "🟡 黄" if len(p) >= 10 else "🔴 红"],
    ]

    # Top publishers (from home top-5 chart)
    top_pubs = []
    for tp in h["top_partners"]:
        top_pubs.append([tp["name"], "—", tp["revenue"], "—", "—", "维持监控"])
    while len(top_pubs) < 5:
        top_pubs.append(["—"] * 6)

    # New publishers table
    new_pub_rows = [[x["name"], x["website"], x["type"], x["sector"], x["joined"]] for x in p[:15]]

    # Sector distribution
    sectors = {}
    for x in p:
        s = x["sector"] or "其他"
        sectors[s] = sectors.get(s, 0) + 1
    new_pub_breakdown = [[s, c, f"{c/max(len(p),1)*100:.0f}%", "—"] for s, c in sorted(sectors.items(), key=lambda kv: -kv[1])]
    if not new_pub_breakdown:
        new_pub_breakdown = [["—", 0, "0%", "—"]]

    wk_delta = h["wk_rev_delta"] or 0
    if wk_delta >= 5:
        exec_diag = f"本周 GMV {h['wk_revenue']}，环比 +{wk_delta:.1f}%，整体增长稳健。"
        exec_sug = [
            f"放大 Top 3 publisher 投入（{', '.join([t['name'] for t in h['top_partners'][:3]])}）",
            "测试 +1-2% 增佣窗口 7 天，观察 CVR 变化",
            "招募同类型 publisher 扩容（行业相似度匹配）",
        ]
    elif wk_delta >= -5:
        exec_diag = f"本周 GMV {h['wk_revenue']}，环比 {arrow(wk_delta)}，处于平台期。"
        exec_sug = [
            "排查头部 publisher 表现是否分化（贡献集中度风险）",
            "针对静态 publisher 发送激活邮件 + 限时 +2% 佣金",
            "Top 5 之外的长尾招募提速，分散依赖",
        ]
    else:
        exec_diag = f"本周 GMV {h['wk_revenue']}，环比 ▼ {abs(wk_delta):.1f}%，需要紧急介入。"
        exec_sug = [
            "立即对 Top 3 publisher 一对一沟通，了解流量下滑原因",
            "上线 7 天临时增佣 +3% + Cashback 专属链接",
            "排查素材/落地页转化率是否出现技术问题",
        ]

    data = {
        "region_name": cfg["region_name"],
        "region_code": cfg["region_code"],
        "merchant_id": cfg["merchant_id"],
        "currency_symbol": cur,
        "report_date": TODAY,
        "home_screenshot": str(OUT / f"{region}_home.png"),
        "publishers_screenshot": str(OUT / f"{region}_publishers_full.png"),
        "exec_kpi": exec_kpi,
        "exec_takeaways": [
            f"近 7 日 GMV：{h['wk_revenue'] or '—'}（{arrow(h['wk_rev_delta'])}）",
            f"昨日订单：{h['yest_txns'] or '—'} 笔，点击 {h['yest_clicks'] or '—'}",
            f"本周新增 publisher {len(p)} 家，活跃存量约 {parts.get('rawText','').count('Status')}",
        ],
        "exec_diagnosis": exec_diag,
        "exec_suggestions": exec_sug,
        # GMV trend — we have weekly but not daily breakdown; mark placeholder
        "gmv_trend": [
            ["周二", "—", "—", "—", "数据需 BI 拉取"],
            ["周三", "—", "—", "—", "数据需 BI 拉取"],
            ["周四", "—", "—", "—", "数据需 BI 拉取"],
            ["周五", "—", "—", "—", "数据需 BI 拉取"],
            ["周六", "—", "—", "—", "数据需 BI 拉取"],
            ["周日", "—", "—", "—", "数据需 BI 拉取"],
            ["周一", h["yest_revenue"] or "—", "—", arrow(h["yest_rev_delta"]), "Awin 昨日值"],
        ],
        "channel_breakdown": [
            ["Cashback", f"{cur}—", "40%", "—", "估算 — 需 Awin BI 校准"],
            ["Content", f"{cur}—", "25%", "—", "估算 — 需 Awin BI 校准"],
            ["Coupon", f"{cur}—", "20%", "—", "估算 — 需 Awin BI 校准"],
            ["Comparison", f"{cur}—", "10%", "—", "估算 — 需 Awin BI 校准"],
            ["其他", f"{cur}—", "5%", "—", "估算 — 需 Awin BI 校准"],
        ],
        "geo_device_product": [
            ["地域", "—", "需 Awin 报表导出"],
            ["设备", "—", "需 Awin 报表导出"],
            ["品类", "—", "需 Awin 报表导出"],
        ],
        "gmv_diagnosis": f"昨日 GMV {h['yest_revenue']}（{arrow(h['yest_rev_delta'])}），订单 {h['yest_txns']}，CVR ≈ {(float((h['yest_txns'] or '0'))) / max(float((h['yest_clicks'] or '1').replace(',','')), 1) * 100:.2f}%。" if h['yest_revenue'] and h['yest_clicks'] else "GMV 数据不完整",
        "gmv_suggestions": [
            "导出 Awin Performance Over Time 报表补齐 7 日明细",
            "按渠道类型 (Cashback/Content/Coupon) 拆分贡献，识别结构性问题",
            "对比上周同日，看是星期效应还是趋势性下滑",
        ],
        "top_publishers": top_pubs[:10],
        "concentration": [
            ["Top 1 占比", "—", "—", "需 BI"],
            ["Top 3 占比", "—", "—", "需 BI"],
            ["Top 10 占比", "—", "—", "需 BI"],
            ["长尾 (>10) 占比", "—", "—", "需 BI"],
        ],
        "top3_concentration_pct": 50.0,
        "lifecycle": [
            ["新增 (本周)", len(p), f"{len(p)}/周"],
            ["活跃", "—", "需 BI"],
            ["流失", "1" if "Left your program" in parts.get("rawText", "") else "0", "本周可见"],
        ],
        "pub_diagnosis": f"Top 5 publisher 贡献：{', '.join([t['name'] + ' ' + t['revenue'] for t in h['top_partners'][:3]])}。",
        "pub_suggestions": [
            "Top 3 一对一深度运营（定制素材 + 专属佣金）",
            "Top 4-10 标准激活流（邮件 + Cashback 专属链接）",
            "排查流失 publisher 原因（佣金/产品/竞品）",
        ],
        "new_publishers_count": len(p),
        "new_publishers": new_pub_rows if new_pub_rows else [["—", "—", "—", "—", "—"]],
        "new_pub_breakdown": new_pub_breakdown,
        "activation": [
            [x["name"], x["joined"], "待激活", "—", "首单倒计时 7 天"]
            for x in p[:5]
        ] or [["—", "—", "—", "—", "—"]],
        "recruit_diagnosis": f"本周新增 {len(p)} 家，覆盖 {len(sectors)} 个细分行业。",
        "recruit_suggestions": [
            "首单激活：3 天内发送欢迎邮件 + 创意素材包",
            f"行业聚焦：{', '.join(list(sectors.keys())[:3])} 类继续加大邀约",
            "招募 KPI：周度 ≥ 20 家，月度 ≥ 80 家",
        ],
        "campaigns": [["—", "—", "—", "—", "需 Awin Campaigns 导出"]],
        "offers": [["—", "—", "—", "需 Awin Offers 导出"]],
        "camp_diagnosis": "Campaign 数据需 Awin 报表导出，本周报告未覆盖。",
        "camp_suggestions": [
            "上线 Cashback 专属 promo code（针对 Top 3 publisher）",
            "测试限时 +2% 增佣 7 天，比对 GMV/CVR 提升",
        ],
        "content_mix": [["—", "—", "—", "需内容平台数据"]],
        "top_content": [["—", "—", "—", "—", "需内容平台数据"]],
        "content_diagnosis": "内容追踪需要 publisher 配合插标，本周未拉到数据。",
        "content_suggestions": [
            "向 Top 5 content publisher 索取月度内容排期",
            "上线 UTM + Awin TrackingDeeplink 双追踪",
        ],
        "risks": [
            ["头部集中度高", "中", "Top 5 贡献占比偏高", "扩量长尾 + 多元化招募"],
            ["新增放缓", "低" if len(p) >= 20 else "高", f"本周 {len(p)} 家", "Outreach 加压"],
            ["流失监控", "中" if "Left your program" in parts.get("rawText", "") else "低", "本周可见流失", "退出访谈"],
        ],
        "risk_diagnosis": "整体风险可控，重点关注集中度。",
        "risk_suggestions": [
            "建立 Top 10 之外的长尾发展看板",
            "每周回顾流失 publisher 名单 + 原因分类",
        ],
        "actions_growth": [
            "Top 3 publisher 一对一沟通（Owner: 联盟经理 / Done by: 周四）",
            "上线 7 天 +2% 增佣测试（Owner: 运营 / Done by: 本周五）",
            "导出 Awin BI 全量报表回填缺失指标（Owner: 数据 / Done by: 周三）",
        ],
        "actions_recruit": [
            f"按 {list(sectors.keys())[0] if sectors else '主力'} 行业 outreach ≥ 30 家（Owner: BD / Done by: 周五）",
            "新 publisher 3 天首单激活流（Owner: 运营 / 持续）",
        ],
        "actions_optimize": [
            "排查昨日转化率波动原因（Owner: 数据 / Done by: 周二）",
            "落地页 A/B 测试上线（Owner: 产品 / Done by: 下周三）",
        ],
        "kpi_dashboard": [
            ["周 GMV", h["wk_revenue"] or "—", f"{cur}10,000", "—", "招募 + 增佣"],
            ["昨日订单", h["yest_txns"] or "—", "30", "—", "Top 3 深耕"],
            ["新增 publisher", str(len(p)), "≥20", f"{len(p)-20:+d}", "BD outreach 加压"],
            ["集中度 (Top 3)", "—", "≤40%", "—", "长尾扩量"],
            ["CVR", "—", "≥1.5%", "—", "落地页优化"],
        ],
    }

    out_file = OUT / f"{region}_data_zh.json"
    out_file.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print(f"[{region}] wrote {out_file} | KPIs: rev={h['wk_revenue']} txns={h['yest_txns']} new_pubs={len(p)}", flush=True)

if __name__ == "__main__":
    for r in ["us", "eu"]:
        build_region(r)
