---
name: affiliate-inbox
description: Affiliate inbox triage for affiliate@celldigital.co. Scans unreplied threads, flags sensitive ones, drafts strategic replies (brand-aware, language-aware), reports to barronzuo@gmail.com. Usage: /affiliate-inbox [window=24h|72h|7d|21d]
version: 3.0
---

# Affiliate Inbox v3.0

**Account:** affiliate@celldigital.co · **CC always:** affiliate@xark.io · **Report to:** barronzuo@gmail.com · **Sign:** CellDigital Affiliate Team

---

## BRAND ROUTER

Detect brand from subject keywords (case-insensitive). Apply brand-specific commission floor and assets.

| Brand | Subject keywords | Floor | Uplift @ $X GMV | Network | Asset note |
|---|---|---|---|---|---|
| TCL | TCL, TTE, TCL US | 5% | 8% @ $5K/mo | Impact | Product feed available via Impact |
| OUFER | OUFER, body jewelry, oufer | 8% | 10% @ $2K/mo | Awin | Banner pack + coupon feed via Awin |
| ROCKBROS | ROCKBROS, Rockbros, Yiwu Rock | 6% | 9% @ $3K/mo | Awin | Product feed (CSV) on Awin |
| COSORI | Cosori | 5% | 8% @ $5K/mo | Impact | Brand assets in Impact |
| INSTA360 | Insta360, Insta 360 | 4% | 6% @ $10K/mo | Impact | Co-op video assets on request |
| LEVOIT | Levoit | 5% | 7% @ $5K/mo | Impact + Levanta | Routed to brand team for sample requests |
| SEGWAY | Segway, Segway-Ninebot | 4% | 6% @ $10K/mo | Impact + AvantLink | Premium-tier assets |
| SMART4U | Smart4u, LIVALL | — | — | — | **FLAG always** — operational/access issues |
| (unknown) | none match | 5% | 8% @ $5K/mo | (ask) | Generic onboarding |

---

## TRIGGER GUARD — FLAG only, no draft

Evaluate in this order. Match → FLAG, skip drafting, log reason in report.

1. **TCL domain sender** — `@tcl.com @tte.com @tclusa.com @tclelectronics.com @tpv.com @tclresearch.com @tclcom.com @tta.com`. Also `@alibaba-inc.com` if subject/body mentions TCL.
2. **Financial** — invoice, payment not received, past due, billing, overdue, balance due, remittance, refund, charge reversal, special pricing, distributor pricing, wholesale, payment failed, fee waiver, pricing request
3. **Legal** — legal, compliance, GDPR, data compliance, privacy policy, attorney, counsel, "please advise", cease and desist, trademark, IP infringement, dispute, liability, lawsuit, "on behalf of"
4. **Contract** — contract, contract terms, agreement, terms and conditions, signed agreement, NDA, non-disclosure, SOW, statement of work, master service, addendum, amendment, renewal, "please sign", DocuSign
5. **Fee confirmation** — flat fee, placement fee, sponsored fee, guaranteed fee, upfront payment, media buy, "confirm the fee", "invoice attached", "payment confirmation", "fee structure", "pay $", "wire transfer"
6. **Commission conflicts** — two rates conflict in same thread; sender quotes higher rate than contract; "email states / proposal shows / promised / agreed to" + %; commission > 8% requested; "exception / just for you / special rate / custom rate" + %

---

## EXECUTION FLOW

### Step 0 — Pre-flight (single osascript)
```bash
osascript -e 'tell application "Mail"
  set a to name of every account
  if a contains "affiliate@celldigital.co" and a contains "affiliate@xark.io" then return "OK"
  return "FAIL: " & (a as string)
end tell'
```
If not `OK` → draft failure email to barronzuo@gmail.com via Gmail MCP, ABORT.

### Step 1 — Build draft cache (single Gmail MCP call)
Call `list_drafts` with pageSize 50. If output is large, save to file and parse with python. Extract `(recipient_email, subject)` pairs only. Discard bodies.

### Step 2 — Scan inbox
Call `search_threads` with `pageSize: 50`:
```
in:inbox newer_than:{window} -category:promotions -category:updates -category:social -category:forums
```
Window default `24h`; arg `72h` for weekend, `7d` weekly, `21d` deep scan. Paginate via `nextPageToken` if results == 50.

### Step 3 — Filter (no get_thread yet — use snippets)
For each thread, work with the message metadata returned by search_threads (sender, subject, date, snippet, toRecipients). Decide:

| Signal in snippet/metadata | Action |
|---|---|
| Sender contains `affiliate@celldigital.co`, `affiliate@xark.io`, or last-message-from-us | **SKIP — replied** |
| Subject + recipient match an entry in draft cache (within 3d) | **SKIP — drafted** |
| Subject + recipient match draft cache (older than 3d) | Queue as **FOLLOWUP** |
| Sender domain in: `aliexpress.com`, `noreply@*`, `mailer-daemon@*`, `notifications@*`, `account-updates@*`, calendar invites from `barronzuo@gmail.com`, internal `lillian.li@celldigital.co` etc. | **SKIP — noise** |
| Trigger Guard match (any of 1–6 above) | **FLAG** — log, no draft |
| Otherwise | **QUEUE** for classification |

### Step 4 — Classify queued threads (snippet-first)
For most threads the snippet (≤200 chars) is enough. Only call `get_thread` (FULL_CONTENT) when:
- Snippet is truncated mid-sentence and intent is unclear
- Multiple messages in thread and you need history
- Sender is tier-1 (Consumer Reports, major networks, >$1M/mo platforms) — confirm specifics

Assign one type per thread:

| Type | Signal | Routing |
|---|---|---|
| ONBOARD | accepted invite, asking how-to, platform setup, status check | SEND via Mail.app |
| INFO | general program question, no negotiation element | SEND via Mail.app |
| NEGOTIATE | rate ask, counter-offer, exclusivity ask, large platform pitch | DRAFT via Mail.app |
| SEED | sample/gifting request | DRAFT via Mail.app |
| MEETING | explicit call/meeting/reschedule request | DRAFT via Mail.app |
| FOLLOWUP | old draft 3+ days, or partner re-pinging us | DRAFT via Mail.app |
| COMPLAINT | tracking/payment/dispute issue | DRAFT via Mail.app |
| FLAG | trigger guard matched, ambiguous, or any rule conflict | No email — report only |
| SPAM | unsolicited, payment ask, vague sender | No email — report only |

### Step 5 — Draft body (use snippet bank below + brand router context)
Pull first name from "Hi [Name]" pattern in thread, or from sender's display name, or fall back to no greeting (just "Hi,").

Detect language from snippet:
- German (DE) cues: "Hallo", "Vielen Dank", "Einladung", "Partnerprogramm" → reply in German
- Italian (IT) cues: "Ciao", "Grazie", "ti ha invitato" → reply in Italian
- Spanish (ES): "Hola", "Gracias" + Spanish grammar → reply in Spanish
- French (FR): "Bonjour", "Merci" + French grammar → reply in French
- Chinese (汉字 / 中文): always **FLAG** — likely internal/client escalation
- Default: English

Apply the snippet bank for the assigned type. Length: ≤150 words for ONBOARD/INFO; ≤200 words for NEGOTIATE/SEED/COMPLAINT.

### Step 6 — Execute via Mail.app
**SEND** (ONBOARD, INFO):
```bash
osascript -e 'tell application "Mail"
  set m to first item of (messages of mailbox "INBOX" of account "affiliate@celldigital.co" whose sender contains "SENDER")
  set r to reply m without opening window
  tell r
    set content to "BODY"
    make new to recipient at end of cc recipients with properties {address:"affiliate@xark.io"}
    send
  end tell
end tell'
```
Fallback if NOT_FOUND: Gmail MCP `create_draft`, log `draft_fallback` in report.

**DRAFT** (NEGOTIATE, SEED, MEETING, FOLLOWUP, COMPLAINT):
Use Gmail MCP `create_draft` directly (it's faster than AppleScript and the user reviews drafts in Gmail web anyway). Pass `to`, `cc:["affiliate@xark.io"]`, `subject:"Re: ORIGINAL"`, `body`.

### Step 7 — Report draft (Gmail MCP create_draft)
**To:** barronzuo@gmail.com
**Subject:** `[Affiliate Reply Report] YYYY-MM-DD — N sent / N drafts / N flagged ({window})`
**Body sections (markdown):** Sent, Drafts Saved, Flagged for Human Review (with reason + recommended action), Skipped, Errors, Next Recommended Action (1 sentence).

---

## SNIPPET BANK — reply scaffolding

Use these as the structural backbone. Customize the **bracketed slots** per thread. Every reply ends with the signature block.

### Signature (always)
```
Best,
CellDigital Affiliate Team
affiliate@celldigital.co
```

### ONBOARD — partner accepted invite / asking setup
```
Hi [Name],

[Acknowledge their action — "great to have you onboard" / "thanks for accepting"].

[1 sentence on what they need next — link, asset, or step]. We can turn around any [feed / banner / coupon code] within 24–48 hours.

[CTA — what specific thing should they confirm or send?]
```

### INFO — general program question
```
Hi [Name],

[Direct answer, 1–2 sentences]. Standard [BRAND] terms: [Floor]% commission on confirmed sales, 30-day cookie, monthly payout via [Network]. [Mention uplift if relevant: "Performance tier kicks in at $X GMV/mo to Y%."]

[CTA — single forward-moving question]
```

### NEGOTIATE — rate ask / large platform / counter-offer
```
Hi [Name],

[Acknowledge interest WITHOUT conceding rate]. [Brand]'s sweet spot is [category fit].

To size the right structure, can you share: [traffic / EPC / typical brand campaign metrics / redemption volume]? Standard rate is [Floor]%, with a performance uplift to [Tier]% once you hit $[X] GMV/mo.

[CTA — request the data point that will unlock the deal]
```

### SEED — sample/gifting request
```
Hi [Name],

Thanks for reaching out about samples — [niche fit, 1 sentence].

Before we send product, can you share [media kit / 3 recent posts / channel link + average views]? We want to match the right [BRAND] pieces to your audience.

[CTA — "Send those over and we'll get a package out within a week."]
```

### MEETING — call request or reschedule
```
Hi [Name],

[Confirm enthusiasm — "happy to connect" / "no worries on the reschedule"].

I have availability **Tuesday May 6 at 9am PT / Thursday May 8 at 10am PT / Friday May 9 at 9am PT** for a 30-minute call to align on [specific topic from thread]. Which works best? I'll send the invite right after you confirm.
```
*(Update slot dates dynamically — pick next 3 Tue/Thu/Fri mornings PT from today's date.)*

### FOLLOWUP — re-engage stale conversation
```
Hi [Name],

Apologies for the delay on our end — [brief acknowledgment, no excuses].

[Recap where the conversation left off — 1 sentence]. [New value hook — seasonal campaign, Q[N] launch, new product, expanded coverage].

[CTA — concrete next step to re-open]
```

### COMPLAINT — tracking / payment / dispute
```
Hi [Name],

Thanks for flagging — [acknowledge specific issue, no defensiveness].

I'll check with our [network team / Impact / Awin] within 24h to investigate. To speed this up, can you send your [publisher ID / transaction ID / order date]?

[CTA — "I'll come back with an update by [day]."]
```

---

## LANGUAGE PACKS (quick scaffolds)

**DE (German):**
- Greeting: `Hallo [Name],`
- Signature line above team: `Beste Grüße,`
- Common phrases: "Vielen Dank für Ihre Nachricht", "Wir freuen uns auf die Zusammenarbeit"

**IT (Italian):**
- Greeting: `Ciao [Name],`
- Signature: `Cordiali saluti,`
- Common: "Grazie per il messaggio", "Restiamo in contatto"

**ES (Spanish):**
- Greeting: `Hola [Name],`
- Signature: `Saludos,`
- Common: "Gracias por contactarnos", "Quedamos a la espera"

**FR (French):**
- Greeting: `Bonjour [Name],`
- Signature: `Cordialement,`
- Common: "Merci pour votre message", "Au plaisir d'échanger"

**ZH (Chinese):** Do NOT auto-reply. Always FLAG with reason "Chinese-language email — likely internal client escalation, route to Barron".

---

## FAILURE HANDLING

| Failure | Response |
|---|---|
| Pre-flight FAIL | Gmail MCP create_draft to barronzuo@gmail.com with the failure message; ABORT |
| `list_drafts` output > token limit | Save to file, extract subject+recipient via python; do not load full bodies |
| `search_threads` output > token limit | Save to file, parse via python |
| `get_thread` fails on a thread | Skip thread, log error, continue |
| AppleScript NOT_FOUND for SEND | Fall back to Gmail MCP create_draft, mark as `draft_fallback` |
| AppleScript syntax error | Skip thread, log; do not retry with same script |
| Draft creation fails | Log error, continue to next thread |
| Ambiguous classification | Default to FLAG, never auto-send |

---

## TOKEN DISCIPLINE

- **One** `list_drafts` call total. Cache subject+recipient pairs only.
- **One** `search_threads` call per page; never re-query same window.
- `get_thread` only for ambiguous classification — snippets first.
- Never read full draft bodies; only metadata.
- Build report incrementally as a string; create one final draft.
- Skip noise senders BEFORE any get_thread call.

---

## CONSTRAINTS

```
✅ CC affiliate@xark.io on every reply
✅ Sign as CellDigital Affiliate Team
✅ DRAFT (Gmail MCP create_draft): NEGOTIATE, SEED, MEETING, FOLLOWUP, COMPLAINT
✅ SEND (Mail.app reply+send): ONBOARD, INFO
✅ Report draft to barronzuo@gmail.com — never auto-send the report

🚫 Never send: contracts, commission >10%, exclusivity, pricing commitments, sample SLA promises
🚫 Never promise: inventory, exclusivity, custom payment terms, "exception", "just for you"
🚫 Never reply if: Trigger Guard matched, Chinese-language sender, or already replied/drafted < 3d
🚫 Never include: rates above brand floor without explicit ⚠️ FLAG

Brand router overrides defaults — TCL emails always FLAG when from TCL domain.
```
