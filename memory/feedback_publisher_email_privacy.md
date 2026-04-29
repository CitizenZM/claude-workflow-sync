---
name: feedback_publisher_email_privacy
description: Mask publisher emails in PUBLIC-facing reports; KEEP raw contact info (name/email/address) in internal brand-ops reports so the brand can actually ship samples and execute contracts
type: feedback
originSessionId: d954a0ef-f270-4c2a-ad71-f859ba918cfd
---
The rule is audience-dependent, not format-dependent.

**Why:** Two distinct report use-cases in affiliate ops:
1. **Public/industry-facing reports** (blog posts, case studies, community decks) — leaking partner emails creates PII risk, gives competitors an outreach list, violates implicit trust.
2. **Internal brand-ops reports** (weekly reports delivered to Oufer / Rockbros / TCL brand teams so they can ship samples, countersign IOs, pay invoices) — the brand-side team LEGITIMATELY needs raw contact name / email / shipping address to do their job. Masking here makes the report useless.

Confirmed by user 2026-04-17 on Oufer weekly report: "pdf 里面不需要 mask creator 的送货地址和 email 名字等".

**How to apply:**
- **Brand-ops weekly reports** (recipients = brand-side ops team; stored in private GH + SSO-walled Vercel): keep contact name / email / shipping address RAW. No `scrub_emails()` on these sections.
- **Public reports / shared externally without NDA / industry decks**: still DROP or mask email column. Default to mask when audience is unclear.
- **Attachments** (IOs, shipping addresses, sample lists): always stay in the PRIVATE GH repo; never in a public repo or unauthenticated URL.
- The skill's privacy boundary is the SSO-wall (private GH + Vercel SSO) — NOT the file format.
