# Gmail Intelligence Playbook — Oufer Weekly Report

**Runs on: Haiku 4.5** (token-efficient, structured extraction only — no prose reasoning).
**Mailbox: `affiliate@celldigital.co` only** (the brand-side signed-in Gmail MCP account).
**Scope: past 30 days, Oufer-mentioning threads only.**

This playbook tells Claude Code how to drive the Gmail MCP to populate
`output/oufer_email_intel.json`, which the generator then merges into the weekly report.

---

## 1. Brand filter (MUST apply to reduce tokens)

Before calling `search_threads`, narrow with brand-scoped keywords from `.env`:

```
BRAND_KEYWORDS=Oufer,OUFER,"Oufer Jewelry",jewelry,jewellery
BRAND_DOMAINS=oufer.com,oufer-jewelry.com
AWIN_ADVERTISER_ID=91941
```

Construct the Gmail query:
```
(Oufer OR "Oufer Jewelry" OR from:@oufer.com OR 91941) newer_than:30d
```

**Do NOT** use a bare `newer_than:30d` — that returns the entire mailbox and burns tokens.

---

## 2. Three-pass extraction (batch to minimize round-trips)

### Pass 1: thread list
```
mcp__claude_ai_Gmail__search_threads
  q: "(Oufer OR \"Oufer Jewelry\" OR from:@oufer.com OR 91941) newer_than:30d"
  maxResults: 50
```

Expected output: thread IDs + subject + snippet + participants. **Parse once**; do not re-fetch the list.

### Pass 2: selective thread bodies
Only fetch full thread bodies for threads whose subject/snippet suggests one of the 4 intel types:

| Intel type | Subject/snippet signals |
|---|---|
| `sample_ship` | "sample", "send product", "shipping address", "ship to", "对样", "寄样" |
| `paid_placement` | "IO", "insertion order", "paid placement", "SoW", "commission increase", "fixed fee", "sponsor" |
| `asset_request` | "feed", "banner", "creative", "logo", "brand kit", "素材", "高清图" |
| `onboarding` | "welcome", "activation", "joined", "approved publisher" |

Skip threads that don't match any pattern. Target: fetch ≤ 20 full threads.

```
mcp__claude_ai_Gmail__get_thread
  threadId: <id>
  format: full   # required for attachment list
```

### Pass 3: download attachments
For each attachment in a matched thread, download it to `output/attachments/`:

```
filename pattern: {YYYY-MM-DD}_{publisher_slug}_{original_filename}
e.g., 2026-04-13_retailmenot_Q2-IO-2026.pdf
```

If the MCP does not expose attachment bytes directly, skip the download but still log
the attachment name + doc_type in `email_intel.json` — it remains a pointer.

---

## 3. Per-thread extraction rules (structured output)

For each relevant thread, emit one record to the JSON array. Use Haiku's structured-output
capability — **do not write free-form prose, do not hallucinate missing fields**:

```json
{
  "thread_id": "18e3...",
  "permalink": "https://mail.google.com/mail/u/0/#inbox/18e3...",
  "publisher": "BuzzFeed Shopping",
  "contact_name": "Jane Doe",
  "contact_email": "jane@buzzfeed.com",
  "intel_type": "sample_ship",
  "subject": "Sample Request for Editorial",
  "last_activity": "2026-04-12",
  "status": "待寄样",
  "shipping_address": "450 Broadway Ave, New York, NY 10013",
  "requested_skus": "OUF-NK-001, OUF-ER-012",
  "requested_quantity": 5,
  "deadline": "2026-04-20",
  "contract_doc": null,
  "contract_doc_type": null,
  "contract_value_usd": null,
  "attachments": [],
  "notes_zh": ""
}
```

Field rules:
- `contact_name` — parse from email signature block. If not found, use "—" (do NOT guess).
- `contact_email` — raw, unmasked. This report is internal ops.
- `shipping_address` — parse from body. Only populate if `intel_type = sample_ship`.
- `contract_doc` — filename of attached IO/SoW/contract PDF. Populate only if `intel_type = paid_placement`.
- `contract_value_usd` — extract USD figure from body if mentioned (e.g., "$3,500/month" → `"$3,500/mo"`); else null.
- `notes_zh` — Chinese one-liner, ≤ 30 chars, for the operator. Example: "BuzzFeed 4/20 前寄出 5 款样品即可刊出."
- `deadline` — if body mentions a date, convert to YYYY-MM-DD; else null.

---

## 4. Aggregate output

Write the final JSON to `output/oufer_email_intel.json`:

```json
{
  "scrape_date": "2026-04-17",
  "mailbox": "affiliate@celldigital.co",
  "brand": "Oufer Jewelry",
  "query": "(Oufer OR ...) newer_than:30d",
  "thread_count_total": 37,
  "thread_count_relevant": 9,
  "threads": [ /* array of per-thread records above */ ]
}
```

The Python generator reads this file and derives:

| Generator section | Source |
|---|---|
| `section4_emails` (summary table, landscape) | all `threads` |
| `section4_shipping` (address book, landscape) | `threads` where `intel_type = sample_ship` |
| `section4_contracts` (IO / paid placement index with hyperlinks) | `threads` where `intel_type = paid_placement` |
| `section4_assets` (素材 checklist) | `threads` where `intel_type = asset_request` |

---

## 5. Token budget (Haiku-first discipline)

| Step | Budget | Why |
|---|---|---|
| `search_threads` call | 1 | Single query, do not paginate unless count > 50 |
| Subject/snippet scan | in-context | Classify using signals table, no LLM call per thread |
| `get_thread` calls | ≤ 20 | Only relevant threads; skip newsletter/marketing blasts |
| Attachment downloads | ≤ 15 | Skip images unless sample_ship or brand asset |
| Output write | 1 | Single JSON file, no intermediate files |

**Stop conditions:**
- If `thread_count_total` > 200, stop and ask user to refine `BRAND_KEYWORDS` — likely matching too broadly.
- If any `get_thread` returns no JSON, skip it (do not retry more than once).

---

## 6. Invocation from Claude Code

```
@awin-oufer-us-weekly-report
抓取 Oufer 过去 30 天 affiliate@celldigital.co 邮件情报，生成 output/oufer_email_intel.json
```

Claude Code will:
1. Read this playbook
2. Call Gmail MCP with brand-scoped query
3. Extract per-thread structured records
4. Download attachments to `output/attachments/`
5. Write `output/oufer_email_intel.json`

Then:
```bash
bash scripts/publish.sh
```
will merge email_intel.json into the DOCX/HTML/PDF/Markdown report and push attachments to the private GitHub repo.
