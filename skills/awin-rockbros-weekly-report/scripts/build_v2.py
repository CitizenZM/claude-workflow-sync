#!/usr/bin/env python3
"""Build region-ready data dict from {region}_v2.json (output of scrape_v2.py).

Schema for downstream generator:
{
  region_name, region_code, merchant_id, currency_symbol, report_date,
  home_screenshot,
  exec_kpi:        [[metric, value, delta_arrow, target, status_dot], ...]
  exec_takeaways:  [str, str, str]
  exec_diagnosis:  str
  exec_suggestions:[str, ...]
  gmv_trend_week:  [[day_label, this_week_amount, last_week_amount, delta_pct, note], ...]
  gmv_summary:     [[period, this_value, prev_value, delta_pct, status_dot], ...]
                   # rows: This Week vs Last Week, This Month vs Last Month
  gmv_diagnosis:   str
  gmv_suggestions: [str, ...]
  channel_mix:     [[publisher_name, pct_str, amount, status_dot], ...]
                   # from "Publisher Performance by Total Quantity" pie
  top_publishers:  [[name, id, clicks, conv_rate, quantity, amount, commission], ...]
  pub_diagnosis:   str
  pub_suggestions: [str, ...]
  new_publishers:  [[name, website, type, sector, joined], ...]
  new_pub_count:   int
  recruit_diagnosis: str
  recruit_suggestions: [str, ...]
  actions_growth:  [str, ...]
  actions_recruit: [str, ...]
  actions_optimize:[str, ...]
  kpi_dashboard:   [[metric, current, target, gap, action], ...]
}

Sections explicitly DROPPED per user feedback: 2.4 (Geo/Device/Product),
3.2 (Concentration), 3.3 (Lifecycle), 5 (Campaigns/Offers when no data),
6 (Content/Influencer when no data), 7 (Risks & Issues).
"""
import json, re, datetime
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
OUT = SKILL / "output"
TODAY = datetime.date.today().isoformat()

CFG = {
    "us": {"region_name": "美国", "region_code": "US", "merchant_id": "58007",
           "currency": "$", "advertiser": "Yiwu Rock Sports Goods Co., Ltd."},
    "eu": {"region_name": "欧洲", "region_code": "EU", "merchant_id": "122456",
           "currency": "€", "advertiser": "ROCKBROS"},
}

def num(s):
    if s is None: return None
    s = str(s).replace(",", "").replace("$", "").replace("€", "").strip()
    if s == "" or s == "—" or s == "n/a": return None
    try: return float(s)
    except ValueError: return None

def fmt_num(v, decimals=2, currency=""):
    if v is None: return "—"
    if decimals == 0: return f"{currency}{int(round(v)):,}"
    return f"{currency}{v:,.{decimals}f}"

def fmt_pct(v, decimals=1):
    if v is None: return "—"
    return f"{v:+.{decimals}f}%"

def delta_arrow(v):
    if v is None: return "—"
    if v > 0: return f"▲ {abs(v):.1f}%"
    if v < 0: return f"▼ {abs(v):.1f}%"
    return "持平"

def status_dot(delta_pct, target_pct=0):
    """🟢 if delta >= target+5; 🟡 if within ±5; 🔴 if below target-5."""
    if delta_pct is None: return "🟡"
    if delta_pct >= target_pct + 5: return "🟢"
    if delta_pct >= target_pct - 5: return "🟡"
    return "🔴"

def parse_home_kpis(raw):
    out = {}
    blocks = re.findall(
        r"(Revenue|Transactions|Clicks)\s+\w+\s+\d+\s+\d{4}\s+Yesterday\s+([$€£]?[\d,\.]+)\s+(-?[\d\.]+)%", raw)
    for name, val, dlt in blocks:
        key = name.lower()
        out[f"y_{key}"] = val
        out[f"y_{key}_d"] = float(dlt)
    m = re.search(r"Revenue trend\s+Last 7 days\s+([$€£][\d,\.]+)\s+(-?[\d\.]+)%", raw)
    if m:
        out["wk_revenue"] = m.group(1)
        out["wk_revenue_d"] = float(m.group(2))
    return out

def parse_new_publishers(raw):
    new_pubs = []
    pattern = re.compile(
        r"([A-Za-z][\w\s\.,&\-\(\)']{1,60})\n(\d{4,7})\nStatus\nPartners\nWebsite\n([^\n]+)\n"
        r"Primary promotional type\n([^\n]*)\nPrimary sector\n([^\n]*)\nPartners since\n([A-Z][a-z]{2,8} \d{1,2}, \d{4})")
    JUNK = {"Newest-to-oldest", "Status", "Promotional types", "Sectors", "Regions",
            "Sort by", "All partnerships", "Pending partners", "Your partnerships"}
    for m in pattern.finditer(raw):
        name = m.group(1).strip()
        if name in JUNK or len(name) < 2:
            continue
        # also reject names that contain newline-suspicious markers from regex slippage
        if "\n" in m.group(1) or "ector" in name or "Home & garden" in name:
            continue
        new_pubs.append({
            "name": name,
            "website": m.group(3).strip(),
            "type": (m.group(4) or "未分类").strip() or "未分类",
            "sector": (m.group(5) or "未分类").strip() or "未分类",
            "joined": m.group(6).strip(),
        })
    return new_pubs

def filter_this_week(new_pubs, today_iso):
    """Keep only publishers joined within last 7 days."""
    today = datetime.date.fromisoformat(today_iso)
    week_ago = today - datetime.timedelta(days=7)
    out = []
    months = {"Jan":1,"Feb":2,"Mar":3,"Apr":4,"May":5,"Jun":6,
              "Jul":7,"Aug":8,"Sep":9,"Oct":10,"Nov":11,"Dec":12}
    for p in new_pubs:
        try:
            mm, dd, yyyy = p["joined"].replace(",","").split()
            d = datetime.date(int(yyyy), months[mm[:3]], int(dd))
            if week_ago <= d <= today:
                out.append({**p, "_date": d})
        except Exception: pass
    return sorted(out, key=lambda x: x["_date"], reverse=True)

def build_region(region):
    cfg = CFG[region]
    cur = cfg["currency"]
    v2 = json.load(open(OUT / f"{region}_v2.json"))
    home = parse_home_kpis(v2.get("home_rawText",""))

    perf = v2.get("perf", {})
    pub = v2.get("publisher_perf", {})
    new_pubs_all = parse_new_publishers(v2.get("partnerships_rawText",""))
    new_pubs_week = filter_this_week(new_pubs_all, TODAY)

    # Period totals
    def pamount(period):
        p = perf.get(period, {})
        return num((p.get("pending") or {}).get("Amount"))
    def pqty(period):
        p = perf.get(period, {})
        return num((p.get("pending") or {}).get("Quantity"))
    def pclicks(period):
        p = perf.get(period, {})
        return num((p.get("pending") or {}).get("Clicks"))

    tw_a = pamount("thisWeek"); lw_a = pamount("lastWeek")
    tm_a = pamount("thisMonth"); lm_a = pamount("lastMonth")
    tw_q = pqty("thisWeek");    lw_q = pqty("lastWeek")
    tm_q = pqty("thisMonth");   lm_q = pqty("lastMonth")
    tw_c = pclicks("thisWeek"); lw_c = pclicks("lastWeek")

    wow_amount = ((tw_a-lw_a)/lw_a*100) if (tw_a is not None and lw_a) else None
    mom_amount = ((tm_a-lm_a)/lm_a*100) if (tm_a is not None and lm_a) else None
    wow_qty = ((tw_q-lw_q)/lw_q*100) if (tw_q is not None and lw_q) else None
    wow_clicks = ((tw_c-lw_c)/lw_c*100) if (tw_c is not None and lw_c) else None

    # exec KPI table — every row has a status DOT (not 绿/红 text)
    exec_kpi = []
    if tw_a is not None:
        exec_kpi.append(["本周 GMV", fmt_num(tw_a, 2, cur), delta_arrow(wow_amount),
                         fmt_num(lw_a, 2, cur) + " (上周)", status_dot(wow_amount)])
    if tm_a is not None:
        exec_kpi.append(["本月 GMV (MTD)", fmt_num(tm_a, 2, cur), delta_arrow(mom_amount),
                         fmt_num(lm_a, 2, cur) + " (上月全月)", status_dot(mom_amount)])
    if tw_q is not None:
        exec_kpi.append(["本周订单数", str(int(tw_q)), delta_arrow(wow_qty),
                         f"{int(lw_q)} (上周)", status_dot(wow_qty)])
    if tw_c is not None:
        exec_kpi.append(["本周点击", fmt_num(tw_c, 0), delta_arrow(wow_clicks),
                         fmt_num(lw_c, 0) + " (上周)", status_dot(wow_clicks)])
    exec_kpi.append(["本周新增 Publisher", str(len(new_pubs_week)),
                     f"共 {len(new_pubs_all)} 家本周可见", "≥10 家/周",
                     "🟢" if len(new_pubs_week) >= 10 else "🟡" if len(new_pubs_week) >= 5 else "🔴"])

    # exec takeaways
    takeaways = []
    if tw_a is not None and wow_amount is not None:
        takeaways.append(f"本周 GMV {fmt_num(tw_a, 2, cur)}，环比上周 {delta_arrow(wow_amount)}")
    if tm_a is not None and mom_amount is not None:
        mtd_pct = (tm_a/lm_a*100) if lm_a else None
        if mtd_pct is not None:
            takeaways.append(f"本月 MTD {fmt_num(tm_a, 2, cur)}，达上月全月 {mtd_pct:.1f}%（{delta_arrow(mom_amount)}）")
    takeaways.append(f"本周新增 publisher {len(new_pubs_week)} 家，整体合作伙伴 ~{len(new_pubs_all)} 家可见")

    # diagnosis
    if wow_amount is not None and wow_amount >= 5:
        exec_diag = f"本周环比 {delta_arrow(wow_amount)}，势头良好，重点是放大优势 publisher。"
        exec_sug = [
            f"Top 3 publisher 一对一沟通增佣测试（+1~2% 佣金，7 天窗口）",
            "招募同类型 publisher 扩容（行业相似度 + 流量结构匹配）",
            "Cashback / Content 渠道分别加码",
        ]
    elif wow_amount is not None and wow_amount >= -5:
        exec_diag = f"本周环比 {delta_arrow(wow_amount)}，处于平台期，需要识别下滑信号。"
        exec_sug = [
            "排查上周表现下降的 publisher（参见 §3 表）",
            "针对沉默 publisher 发送激活邮件 + 限时 +2% 佣金",
            "BD 招募加压，本周目标 ≥10 家新合作",
        ]
    else:
        exec_diag = f"本周环比 {delta_arrow(wow_amount)}，需要紧急介入。"
        exec_sug = [
            "立即对 Top 3 publisher 一对一沟通，了解流量下滑原因",
            "上线 7 天临时增佣 +3% + Cashback 专属链接",
            "排查素材 / 落地页转化率是否出现技术问题",
        ]

    # gmv_summary table — 2 rows
    gmv_summary = []
    if tw_a is not None:
        gmv_summary.append(["本周 vs 上周", fmt_num(tw_a, 2, cur), fmt_num(lw_a, 2, cur),
                            delta_arrow(wow_amount), status_dot(wow_amount)])
    if tm_a is not None:
        gmv_summary.append(["本月 MTD vs 上月全月", fmt_num(tm_a, 2, cur), fmt_num(lm_a, 2, cur),
                            delta_arrow(mom_amount), status_dot(mom_amount)])

    # daily trend — combine thisWeek + lastWeek daily series
    daily_tw = (perf.get("thisWeek") or {}).get("daily", []) or []
    daily_lw = (perf.get("lastWeek") or {}).get("daily", []) or []
    # match by weekday name (Mon=Mon)
    lw_by_day = {d["day"]: d["amount"] for d in daily_lw}
    gmv_trend_week = []
    for d in daily_tw:
        this_amt = num(d["amount"])
        prev_amt = num(lw_by_day.get(d["day"]))
        dlt = ((this_amt-prev_amt)/prev_amt*100) if (this_amt is not None and prev_amt) else None
        gmv_trend_week.append([
            d["day"] + " " + d["date"],
            fmt_num(this_amt, 2, cur) if this_amt is not None else "—",
            fmt_num(prev_amt, 2, cur) if prev_amt is not None else "—",
            delta_arrow(dlt),
            ""
        ])

    # channel/publisher mix from pie (real GMV % from portal)
    pie = pub.get("pie", []) or []
    channel_mix = []
    for p in pie:
        # find this publisher's Amount in publisher_rows
        row = next((r for r in pub.get("publisher_rows",[]) if r["name"].rstrip(".") == p["name"].rstrip(".") or r["name"].startswith(p["name"].rstrip("."))), None)
        amt_str = fmt_num(num(row["amount"]), 2, cur) if row else "—"
        # pie pct delta: target = even split among 6 → 16.67%
        target = 16.67
        delta_target = p["pct"] - target
        # for "Others", we want LOWER concentration → 倒置 status
        if p["name"].lower() == "others":
            # Others should ideally be <50% (high tail = healthy)
            dot = "🟢" if p["pct"] >= 50 else ("🟡" if p["pct"] >= 30 else "🔴")
        else:
            dot = "🟡"
        channel_mix.append([p["name"], f"{p['pct']:.2f}%", amt_str, dot])

    # top publishers — sort by Amount desc, take top 10
    rows = pub.get("publisher_rows", [])
    rows_sorted = sorted(rows, key=lambda r: num(r["amount"]) or 0, reverse=True)
    top_publishers = []
    for r in rows_sorted[:10]:
        amt = num(r["amount"])
        if amt is None or amt == 0: continue
        top_publishers.append([
            r["name"], r["id"], r["clicks"], r["conv_rate"],
            r["quantity"], fmt_num(amt, 2, cur), fmt_num(num(r["commission"]), 2, cur),
        ])

    pub_diag = f"本周 Top 1 publisher: {rows_sorted[0]['name']}（{fmt_num(num(rows_sorted[0]['amount']),2,cur)}）" if rows_sorted else "本周无活跃 publisher。"
    pub_sug = [
        "Top 3 一对一深度运营（定制素材 + 专属佣金 + 月度规划）",
        "Top 4-10 标准激活流（双周邮件 + Cashback 专属链接）",
        "Others 占比 >50% 说明长尾健康；占比 <30% 需扩容长尾",
    ]

    # new publishers this week
    new_pub_rows = [[p["name"], p["website"], p["type"], p["sector"], p["joined"]]
                    for p in new_pubs_week[:25]]
    recruit_diag = f"本周新增 publisher {len(new_pubs_week)} 家。"
    if len(new_pubs_week) > 0:
        sectors = {}
        for p in new_pubs_week:
            sectors[p["sector"]] = sectors.get(p["sector"], 0) + 1
        top_sector = sorted(sectors.items(), key=lambda x: -x[1])[0]
        recruit_diag += f" 集中行业：{top_sector[0]}（{top_sector[1]} 家）。"
    recruit_sug = [
        "首单激活：3 天内发送欢迎邮件 + 创意素材包",
        "本周 BD 招募 KPI ≥ 10 家",
        "新 publisher 7 天激活率追踪",
    ]

    actions_growth = [
        "Top 3 publisher 一对一深度沟通（Owner: 联盟经理 / Done by: 周四）",
        "上线 +2% 增佣 7 天测试（Owner: 运营 / Done by: 本周五）",
        f"对比 {delta_arrow(wow_amount)} 的下滑/上升原因复盘（Owner: 数据 / Done by: 周三）",
    ]
    actions_recruit = [
        "BD outreach ≥ 30 家本周（Owner: BD）",
        "新 publisher 7 天激活流程上线（Owner: 运营）",
    ]
    actions_optimize = [
        "排查转化率波动（Owner: 数据 / Done by: 周二）",
        "落地页 A/B 测试上线（Owner: 产品 / Done by: 下周三）",
    ]

    kpi_dashboard = []
    if tw_a is not None:
        kpi_dashboard.append(["本周 GMV", fmt_num(tw_a, 2, cur),
                              fmt_num((lw_a or 0)*1.1, 2, cur) if lw_a else "—",
                              delta_arrow(wow_amount), "Top 3 + 招募加压"])
    if tm_a is not None:
        # target = match last month
        kpi_dashboard.append(["本月 GMV", fmt_num(tm_a, 2, cur),
                              fmt_num(lm_a, 2, cur), delta_arrow(mom_amount),
                              "MoM 达标 → 持续优化"])
    kpi_dashboard.append(["新增 Publisher", str(len(new_pubs_week)), "≥10", f"{len(new_pubs_week)-10:+d}", "BD 招募"])

    data = {
        "region_name": cfg["region_name"],
        "region_code": cfg["region_code"],
        "merchant_id": cfg["merchant_id"],
        "currency_symbol": cur,
        "report_date": TODAY,
        "home_screenshot": str(OUT / f"{region}_home.png"),
        "publishers_screenshot": str(OUT / f"{region}_publisher_perf.png"),
        "perf_thisweek_screenshot": str(OUT / f"{region}_perf_thisWeek.png"),
        "perf_thismonth_screenshot": str(OUT / f"{region}_perf_thisMonth.png"),
        "exec_kpi": exec_kpi,
        "exec_takeaways": takeaways,
        "exec_diagnosis": exec_diag,
        "exec_suggestions": exec_sug,
        "gmv_summary": gmv_summary,
        "gmv_trend_week": gmv_trend_week,
        "gmv_diagnosis": f"本周日均 GMV {fmt_num((tw_a or 0)/max(len(daily_tw),1),2,cur)}；环比上周 {delta_arrow(wow_amount)}。",
        "gmv_suggestions": [
            "对比上周同日，看是周中疲软还是趋势性下滑",
            "Top 3 publisher 是否存在结构性流失",
            "Cashback 网络回报延迟带来的入账影响",
        ],
        "channel_mix": channel_mix,
        "top_publishers": top_publishers,
        "pub_diagnosis": pub_diag,
        "pub_suggestions": pub_sug,
        "new_publishers": new_pub_rows,
        "new_publishers_count": len(new_pubs_week),
        "recruit_diagnosis": recruit_diag,
        "recruit_suggestions": recruit_sug,
        "actions_growth": actions_growth,
        "actions_recruit": actions_recruit,
        "actions_optimize": actions_optimize,
        "kpi_dashboard": kpi_dashboard,
    }
    (OUT / f"{region}_data_v2.json").write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print(f"[{region}] wrote {region}_data_v2.json")
    return data

if __name__ == "__main__":
    for r in ["us", "eu"]:
        build_region(r)
