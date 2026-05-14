---
name: TCL Price Monitor Project
description: Daily price monitoring tool for us.tcl.com products vs Amazon and Best Buy — built 2026-04-18
type: project
originSessionId: 24c1920b-5212-41bf-b150-9aa8b0ee2710
---
TCL Price Monitor at ~/Projects/tcl-price-monitor/ — daily price tracking for all purchasable TCL SKUs across us.tcl.com, Amazon, and Best Buy.

**Why:** Barron manages TCL affiliate marketing on Impact. Price parity intelligence helps optimize affiliate strategy — knowing when Amazon/Best Buy undercuts TCL DTC pricing affects commission optimization and publisher guidance.

**How to apply:**
- us.tcl.com is Shopify — use `/products.json` API (no scraping needed)
- Amazon works via headless Playwright (no API key needed)
- Best Buy aggressively blocks all automated access (headless, fetch, curl) — needs their free Developer API key from developer.bestbuy.com, or manual browser
- QM7L/QM8L series are TCL DTC exclusive (not on Best Buy)
- 45 purchasable SKUs as of 2026-04-18 (TVs, soundbars, tablets, monitors)
- Key finding: Amazon frequently underprices TCL DTC by 5-30% on QM7K/QM8K series; QM7L shows massive gaps (likely wrong ASIN match — needs verification)
