#!/usr/bin/env python3
"""Awin scraper v2 — uses URL-based dateRange (works on both US and EU).

Per region pulls:
  - New UI home: yesterday + 7-day KPIs + top-5 partners
  - Legacy Performance Over Time @ dateRange={last7Days, thisWeek, lastWeek,
                                              thisMonth, lastMonth}
    → grand totals + daily series
  - Legacy Publisher Performance @ dateRange=last7Days
    → top publishers + channel category breakdown
  - Partnerships (new UI): joined-newest-first list

Output: output/{region}_v2.json + per-page screenshots.
"""
import json, re, time, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from awin_helpers import load_creds, login, dismiss_cookies, safe_eval

SKILL = Path(__file__).resolve().parent.parent
OUT = SKILL / "output"
PROFILE = Path.home() / ".cache" / "awin-isolated-profile"

REGIONS = {
    "us": {"mid": "58007", "currency": "$", "name": "美国"},
    "eu": {"mid": "122456", "currency": "€", "name": "欧洲"},
}

# Periods to pull. Tokens are case-sensitive: `Last7Days` works, `last7Days` does NOT.
PERIODS = ["thisWeek", "lastWeek", "thisMonth", "lastMonth"]
# rows-per-page URL segment for publisher reports — captures full list (vs default 25)
PER_PAGE = 400

def parse_perf(body):
    """Parse Performance Over Time legacy report body text.

    Grand Totals block looks like:
       Grand Totals
        	AOV	Quantity	Amount	Commission	Imp.	Clicks
       Pending	81.15	209	16,960.74	2,544.37	86	60,306
       Approved	0.00	0	0.00	0.00
       Bonus	0.00	0	0.00	0.00
       Total Value	81.15	209	16,960.74	2,544.37
       Declined	213.39	13	2,774.03	416.12
    """
    out = {"raw_len": len(body), "has_data": "No data can be found" not in body}
    if not out["has_data"]:
        return out
    # Extract Pending row (most reliable proxy for the whole-period GMV)
    m = re.search(
        r"Pending\s+([\d,\.\-]+)\s+([\d,\.\-]+)\s+([\d,\.\-]+)\s+([\d,\.\-]+)\s+([\d,\.\-]+)\s+([\d,\.\-]+)",
        body)
    if m:
        out["pending"] = {
            "AOV": m.group(1), "Quantity": m.group(2), "Amount": m.group(3),
            "Commission": m.group(4), "Imp": m.group(5), "Clicks": m.group(6),
        }
    # Extract Total Value (may be partial — only first 4 cols)
    m = re.search(r"Total Value\s+([\d,\.\-]+)\s+([\d,\.\-]+)\s+([\d,\.\-]+)\s+([\d,\.\-]+)", body)
    if m:
        out["total_value"] = {
            "AOV": m.group(1), "Quantity": m.group(2),
            "Amount": m.group(3), "Commission": m.group(4),
        }
    # Extract daily rows
    daily = []
    for m in re.finditer(
        r"(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})\s+(\d+)\s+([\d,\.]+)\s+([\d,\.]+)\s+(\d+)\s+([\d,\.]+)\s+([\d,\.]+)",
        body):
        daily.append({
            "day": m.group(1), "date": m.group(2),
            "imp": m.group(3), "clicks": m.group(4),
            "aov": m.group(5), "quantity": m.group(6),
            "amount": m.group(7), "commission": m.group(8),
        })
    out["daily"] = daily
    out["raw"] = body[:8000]
    return out

def parse_publisher_perf(body):
    """Parse legacy affiliate-performance report.

    Body contains:
      Publisher Performance, by Total Quantity
      BlueAFF 20%
      YIELDKIT GmbH - ... 13.33%
      Others 33.33%
      ...
      <Period buttons>...
      <Per-publisher table rows, tab-separated:>
       Name  ID  Imp.  Clicks  ConvRate  Assisted  TotalInf  AOV  Qty  NoProds  Amount  Commission
      Grand Totals
       Imp. Clicks ConvRate Assisted TotalInf AOV Qty NoProds Amount Commission
       40 8,690 0.17% 2 17 95.80 15 24 1,437.07 215.59 Pending
    """
    out = {"raw_len": len(body), "has_data": "No data can be found" not in body and "Invalid url" not in body}
    if not out["has_data"]:
        return out

    # Channel/publisher pie chart text (top of page)
    # Lines look like: "BlueAFF 20%" "YIELDKIT GmbH - ... 13.33%" "Others 33.33%"
    pie = []
    pie_block_m = re.search(r"Publisher Performance, by Total Quantity\s*\n(.*?)\nPeriod\s*\n", body, re.S)
    if pie_block_m:
        for line in pie_block_m.group(1).split("\n"):
            line = line.strip()
            if not line: continue
            m = re.match(r"^(.+?)\s+([\d\.]+)%$", line)
            if m:
                pie.append({"name": m.group(1).strip(), "pct": float(m.group(2))})
    out["pie"] = pie

    # Active publishers (not on this report — comes from new UI elsewhere)
    # Grand Totals Pending row — last 5 numeric cols are Amount/Commission, prior are AOV/Qty/NoProds
    # The legacy pattern is:
    #   <imp> <clicks> <convRate>% <assisted> <totalInf> <aov> <qty> <noProds> <amount> <commission>  Pending
    m = re.search(
        r"\n([\d,\.]+)\s+([\d,\.]+)\s+([\d\.]+)%\s+(\d+)\s+(\d+)\s+([\d,\.]+)\s+(\d+)\s+([\d,n/a]+)\s+([\d,\.]+)\s+([\d,\.]+)\s*Pending",
        body)
    if m:
        out["pending"] = {
            "Imp": m.group(1), "Clicks": m.group(2), "ConvRate": m.group(3) + "%",
            "Assisted": m.group(4), "TotalInfluence": m.group(5),
            "AOV": m.group(6), "Quantity": m.group(7), "NoProducts": m.group(8),
            "Amount": m.group(9), "Commission": m.group(10),
        }

    # Per-publisher rows
    rows = []
    row_pattern = re.compile(
        r"\t([^\t]+)\t(\d{4,8})\t([\d,]+)\t([\d,]+)\t([\d\.]+)%\t(\d+)\t(\d+)\t([\d,\.]+)\t(\d+)\t([\d,n/a]+)\t([\d,\.]+)\t([\d,\.]+)")
    for m in row_pattern.finditer(body):
        rows.append({
            "name": m.group(1).strip(),
            "id": m.group(2),
            "imp": m.group(3),
            "clicks": m.group(4),
            "conv_rate": m.group(5) + "%",
            "assisted": m.group(6),
            "total_influence": m.group(7),
            "aov": m.group(8),
            "quantity": m.group(9),
            "no_products": m.group(10),
            "amount": m.group(11),
            "commission": m.group(12),
        })
    out["publisher_rows"] = rows
    out["raw"] = body[:12000]
    return out

def fetch_perf(page, mid, daterange):
    url = f"https://ui.awin.com/merchant/{mid}/report/performance-over-time/index/network/awin/dateRange/{daterange}"
    page.goto(url, wait_until="domcontentloaded", timeout=60000)
    time.sleep(8)
    dismiss_cookies(page)
    time.sleep(3)
    body = safe_eval(page, "() => document.body.innerText || ''", "")
    return parse_perf(body), body

def fetch_publisher_perf(page, mid, daterange):
    """Legacy URL: report/affiliate-performance — body contains channel mix pie
    text + per-publisher rows + grand totals.
    Append /perPage/400 to bypass default 25-row pagination."""
    url = f"https://ui.awin.com/merchant/{mid}/report/affiliate-performance/index/network/awin/dateRange/{daterange}/perPage/{PER_PAGE}"
    page.goto(url, wait_until="domcontentloaded", timeout=60000)
    time.sleep(12)
    dismiss_cookies(page)
    time.sleep(4)
    body = safe_eval(page, "() => document.body.innerText || ''", "")
    return parse_publisher_perf(body), body

def scrape_region(page, region, cfg):
    mid = cfg["mid"]
    print(f"\n[{region}] === START mid={mid} ===", flush=True)
    data = {
        "region": region,
        "merchant_id": mid,
        "currency": cfg["currency"],
        "name": cfg["name"],
        "report_date": time.strftime("%Y-%m-%d"),
    }

    # --- HOME ---
    page.goto(f"https://app.awin.com/en/awin/advertiser/{mid}/home",
              wait_until="domcontentloaded", timeout=60000)
    time.sleep(8)
    dismiss_cookies(page)
    time.sleep(3)
    home_text = safe_eval(page, "() => document.body.innerText || ''", "")
    page.set_viewport_size({"width": 1600, "height": 2400})
    time.sleep(1)
    page.screenshot(path=str(OUT / f"{region}_home.png"), full_page=True)
    page.set_viewport_size({"width": 1600, "height": 1000})
    data["home_rawText"] = home_text
    print(f"[{region}] home len={len(home_text)}", flush=True)

    # --- PERFORMANCE OVER TIME (5 periods) ---
    data["perf"] = {}
    for dr in PERIODS:
        parsed, body = fetch_perf(page, mid, dr)
        data["perf"][dr] = parsed
        page.set_viewport_size({"width": 1600, "height": 2400})
        page.screenshot(path=str(OUT / f"{region}_perf_{dr}.png"), full_page=True)
        page.set_viewport_size({"width": 1600, "height": 1000})
        p = parsed.get("pending") or parsed.get("total_value") or {}
        print(f"[{region}] perf {dr}: hasData={parsed['has_data']} amount={p.get('Amount')} qty={p.get('Quantity')} clicks={p.get('Clicks','—')}", flush=True)

    # --- PUBLISHER PERFORMANCE (all 4 periods — for WoW + MoM deltas) ---
    data["publisher_perf_by_period"] = {}
    for dr in PERIODS:
        parsed, body = fetch_publisher_perf(page, mid, dr)
        data["publisher_perf_by_period"][dr] = parsed
        page.set_viewport_size({"width": 1600, "height": 2400})
        page.screenshot(path=str(OUT / f"{region}_pub_{dr}.png"), full_page=True)
        page.set_viewport_size({"width": 1600, "height": 1000})
        print(f"[{region}] pub {dr}: rows={len(parsed.get('publisher_rows',[]))} pie={len(parsed.get('pie',[]))}", flush=True)
    # Keep legacy key pointing to thisWeek
    data["publisher_perf"] = data["publisher_perf_by_period"]["thisWeek"]
    # main screenshot
    import shutil
    src = OUT / f"{region}_pub_thisWeek.png"
    if src.exists():
        shutil.copy(src, OUT / f"{region}_publisher_perf.png")

    # --- PARTNERSHIPS ---
    page.goto(f"https://app.awin.com/en/awin/advertiser/{mid}/partnerships/all",
              wait_until="domcontentloaded", timeout=60000)
    time.sleep(10)
    dismiss_cookies(page)
    time.sleep(3)
    part_text = safe_eval(page, "() => document.body.innerText || ''", "")
    data["partnerships_rawText"] = part_text
    page.set_viewport_size({"width": 1600, "height": 2400})
    page.screenshot(path=str(OUT / f"{region}_partnerships.png"), full_page=True)
    page.set_viewport_size({"width": 1600, "height": 1000})
    print(f"[{region}] partnerships len={len(part_text)}", flush=True)

    (OUT / f"{region}_v2.json").write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print(f"[{region}] === DONE → {region}_v2.json ===", flush=True)

def main():
    creds = load_creds()
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE),
            headless=True,
            viewport={"width": 1600, "height": 1000},
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
        )
        page = ctx.new_page()
        if not login(page, creds["email"], creds["password"]):
            ctx.close()
            sys.exit(2)
        for region, cfg in REGIONS.items():
            try:
                scrape_region(page, region, cfg)
            except Exception as e:
                import traceback
                print(f"[{region}] ERROR: {e}", flush=True)
                traceback.print_exc()
        ctx.close()

if __name__ == "__main__":
    main()
