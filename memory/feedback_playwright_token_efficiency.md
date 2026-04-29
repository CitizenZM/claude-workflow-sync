---
name: Playwright Automation Token Efficiency
description: Never use browser_snapshot for repetitive automation workflows — use browser_evaluate instead. Pre-map DOM selectors in skills.
type: feedback
---

For Playwright MCP browser automation workflows (Awin, LinkedIn, etc.):

1. **NEVER use `browser_snapshot`** except once for login page — each snapshot dumps 60-70KB of tokens
2. **Use `browser_evaluate` for ALL page inspection** — return only the data you need as JSON
3. **Batch entire page operations into single `evaluate` calls** — one call per page, not one per element
4. **Pre-map DOM selectors in skill files** — avoid trial-and-error DOM discovery at runtime
5. **Track deduplication in-script** — pages auto-refresh after actions, causing duplicate processing

**Why:** A single Awin outreach session burned ~560K tokens on snapshots and trial-error. The same work with evaluate-only costs ~50K tokens — 10x savings.

**How to apply:** Always check if an `awin-publisher-outreach` or similar automation skill exists before running browser workflows. Build skills with pre-mapped selectors for any new platform.
