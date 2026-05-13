---
name: tcl-daily-price-check
description: TCL Daily Price Check — runs full local pipeline (catalog, Amazon/Best Buy scraping via system Chrome, PDF report, email to stakeholders). Use when the user says "TCL price check", "run price monitor", or "check TCL prices".
tags: [tcl, price-monitor, scraping, affiliate]
---

# TCL Daily Price Check

Run the full TCL price monitoring pipeline locally. This uses system Chrome for Best Buy (bypasses bot detection) and headless Chromium for Amazon — only works from local machine, not CI.

## Steps

1. Run the pipeline:

```bash
cd $HOME/Projects/tcl-price-monitor && node src/run-all.js
```

2. After the pipeline completes, report the results to the user:
   - Number of SKUs checked
   - Any price alerts (competitors cheaper >5%)
   - PDF report location: ~/Downloads/TCL-Price-Report-YYYY-MM-DD.pdf
   - Email status (sent or skipped due to missing GMAIL_APP_PASSWORD)

3. If the pipeline fails, check logs at `logs/run-YYYY-MM-DD.log` and diagnose.

## Notes

- Requires system Chrome installed (Best Buy scraping)
- Browser window will open briefly for Best Buy pages
- Email requires GMAIL_APP_PASSWORD in .env
- Recipients: lillian.li@celldigital.co, fanfan@celldigital.co, shane@celldigital.co
- Also runs automatically at 7 AM via macOS launchd
