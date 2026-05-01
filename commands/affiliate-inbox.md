---
name: affiliate-inbox
description: Affiliate inbox triage for affiliate@celldigital.co. Scans unreplied threads, flags sensitive ones, drafts strategic replies (brand-aware, language-aware), reports to barronzuo@gmail.com. Usage: /affiliate-inbox [window=24h|72h|7d|21d]
version: 3.1
---

# Affiliate Inbox v3.0

**Account:** affiliate@celldigital.co · **CC always:** affiliate@xark.io · **Report to:** barronzuo@gmail.com · **Sign:** CellDigital Affiliate Team

---

## ACTIVE PROGRAMS — these are the ONLY 5 programs we currently manage

| Brand | Network | Region | Advertiser ID | Commission | Cookie | AOV | Subject keywords |
|---|---|---|---|---|---|---|---|
| ROCKBROS EU | AWIN | EU | 122456 | **20%** CPS | ~30d | ~$60 | Rockbros, ROCKBROS, Yiwu Rock + EU/DE/UK/IT/ES/FR |
| ROCKBROS US | AWIN | US | 58007 | **20%** CPS | 30d | ~$60 | Rockbros, ROCKBROS, Yiwu Rock + US |
| OUFER BODY JEWELRY | AWIN | US/Global | 91941 | **15%** CPS | 45d | $100 | OUFER, body jewelry, oufer |
| TCL US | Impact | US | 48321 | **8–10%** CPA/CPS | 30d | $300–$800 | TCL, TTE, TCL US |
| Ottocast | Impact | US | 49590 | **20%** CPS (Amazon Attrib.) | 14–30d | $100–$200 | Ottocast, Cartizan, car tech |

**Negotiation anchors:**
- ROCKBROS EU/US: anchor 20% — already top of market, no further uplift
- OUFER: anchor 15% — uplift to 18% only at $5K+ GMV/mo (FLAG above 18%)
- TCL US: 8% standard; 10% only for tier-1 publishers (Consumer Reports, large platforms, retailers); FLAG above 10%
- Ottocast: anchor 20% — Amazon Attribution model, no uplift

**Deprecated — do NOT promote or onboard new partners:**
- COSORI, LEVOIT, INSTA360, SEGWAY — paused / no longer managed. If asked, redirect to the 5 active programs above.

**Always FLAG (operational, no draft):**
- SMART4U / LIVALL — Shopify owner / access / operational issues route to Barron + tech team
- TCL domain senders (`@tcl.com`, `@tte.com`, etc.) — see Trigger Guard

---

## PROGRAMS TABLE BLOCK — embed in every reply until publisher confirms all 5

**Rule:** Include this block in every draft (ONBOARD, INFO, NEGOTIATE, SEED, FOLLOWUP) **unless** the thread shows the publisher has already confirmed joining all 5. Even when they ask about one specific brand, include the full table to drive cross-program signups. Skip only for: MEETING (purely conversational), COMPLAINT (issue-focused), or when the publisher has explicitly confirmed all 5.

**Use Gmail MCP `create_draft` with both `body` (plaintext) and `htmlBody` (HTML).** Mail.app `send` path: render plaintext only.

### HTML version (use in `htmlBody`)

```html
<p>Below are our 5 active programs — happy to get you set up across whichever fit your audience:</p>
<table style="border-collapse:collapse;width:100%;font-family:Arial,Helvetica,sans-serif;font-size:13px;border:1px solid #d0d7de;">
  <thead>
    <tr style="background:#f6f8fa;">
      <th style="border:1px solid #d0d7de;padding:8px;text-align:left;">Program</th>
      <th style="border:1px solid #d0d7de;padding:8px;text-align:left;">Network</th>
      <th style="border:1px solid #d0d7de;padding:8px;text-align:left;">Region</th>
      <th style="border:1px solid #d0d7de;padding:8px;text-align:left;">Commission</th>
      <th style="border:1px solid #d0d7de;padding:8px;text-align:left;">Cookie</th>
      <th style="border:1px solid #d0d7de;padding:8px;text-align:left;">AOV</th>
      <th style="border:1px solid #d0d7de;padding:8px;text-align:left;">Why join</th>
      <th style="border:1px solid #d0d7de;padding:8px;text-align:left;">Sign up</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="border:1px solid #d0d7de;padding:8px;"><strong>ROCKBROS EU</strong></td>
      <td style="border:1px solid #d0d7de;padding:8px;">AWIN</td>
      <td style="border:1px solid #d0d7de;padding:8px;">EU</td>
      <td style="border:1px solid #d0d7de;padding:8px;"><strong>20% CPS</strong></td>
      <td style="border:1px solid #d0d7de;padding:8px;">~30 days</td>
      <td style="border:1px solid #d0d7de;padding:8px;">~$60</td>
      <td style="border:1px solid #d0d7de;padding:8px;">Cycling niche, EU logistics, wide SKU coverage</td>
      <td style="border:1px solid #d0d7de;padding:8px;"><a href="https://ui.awin.com/express-signup/en/awin/122456/7f8849cb-3c46-4014-9237-287f2090d18e?t=DnFneLX7OWO-Lmhq_IQhOfSbAwBkVTom1yojuGCeJr8">Join</a></td>
    </tr>
    <tr style="background:#fafbfc;">
      <td style="border:1px solid #d0d7de;padding:8px;"><strong>ROCKBROS US</strong></td>
      <td style="border:1px solid #d0d7de;padding:8px;">AWIN</td>
      <td style="border:1px solid #d0d7de;padding:8px;">US</td>
      <td style="border:1px solid #d0d7de;padding:8px;"><strong>20% CPS</strong></td>
      <td style="border:1px solid #d0d7de;padding:8px;">30 days</td>
      <td style="border:1px solid #d0d7de;padding:8px;">~$60</td>
      <td style="border:1px solid #d0d7de;padding:8px;">High repeat purchase, strong DTC funnel, outdoor category</td>
      <td style="border:1px solid #d0d7de;padding:8px;"><a href="https://ui.awin.com/express-signup/en/awin/58007/ce7cc3a1-6665-4b40-a44b-776e58d80ec5?t=CXpEJMHyUjxMkTLLvSRMNZ-uuGiiuOhbFMDhKCoZrjM">Join</a></td>
    </tr>
    <tr>
      <td style="border:1px solid #d0d7de;padding:8px;"><strong>OUFER BODY JEWELRY</strong></td>
      <td style="border:1px solid #d0d7de;padding:8px;">AWIN</td>
      <td style="border:1px solid #d0d7de;padding:8px;">US / Global</td>
      <td style="border:1px solid #d0d7de;padding:8px;"><strong>15% CPS</strong></td>
      <td style="border:1px solid #d0d7de;padding:8px;"><strong>45 days</strong></td>
      <td style="border:1px solid #d0d7de;padding:8px;"><strong>$100</strong></td>
      <td style="border:1px solid #d0d7de;padding:8px;">Higher-AOV jewelry, strong margin, repeat + gifting</td>
      <td style="border:1px solid #d0d7de;padding:8px;"><a href="https://ui.awin.com/express-signup/en/awin/91941/92c75d69-1a73-4726-b7cc-7eeec85b4490?t=J5wwJuxPmdReox77nbUimQQkKwAA3KTQI1_BmF59I9s">Join</a></td>
    </tr>
    <tr style="background:#fafbfc;">
      <td style="border:1px solid #d0d7de;padding:8px;"><strong>TCL US</strong></td>
      <td style="border:1px solid #d0d7de;padding:8px;">Impact</td>
      <td style="border:1px solid #d0d7de;padding:8px;">US</td>
      <td style="border:1px solid #d0d7de;padding:8px;"><strong>8–10% CPA/CPS</strong></td>
      <td style="border:1px solid #d0d7de;padding:8px;">30 days</td>
      <td style="border:1px solid #d0d7de;padding:8px;">$300–$800</td>
      <td style="border:1px solid #d0d7de;padding:8px;">Global top-tier TV brand, high AOV electronics, strong demand</td>
      <td style="border:1px solid #d0d7de;padding:8px;"><a href="https://app.impact.com/advertiser-advertiser-info/TTE-Technology-Inc.brand">Join</a></td>
    </tr>
    <tr>
      <td style="border:1px solid #d0d7de;padding:8px;"><strong>Ottocast</strong></td>
      <td style="border:1px solid #d0d7de;padding:8px;">Impact</td>
      <td style="border:1px solid #d0d7de;padding:8px;">US</td>
      <td style="border:1px solid #d0d7de;padding:8px;"><strong>20% CPS</strong> (Amazon Attribution)</td>
      <td style="border:1px solid #d0d7de;padding:8px;">14–30 days</td>
      <td style="border:1px solid #d0d7de;padding:8px;">$100–$200</td>
      <td style="border:1px solid #d0d7de;padding:8px;">Car tech accessories, Amazon conversion, high-intent traffic</td>
      <td style="border:1px solid #d0d7de;padding:8px;"><a href="https://app.impact.com/advertiser-advertiser-info/CARTIZAN-CORPORATION-LIMITED.brand">Join</a></td>
    </tr>
  </tbody>
</table>
<p style="font-size:12px;color:#586069;margin-top:6px;"><em>Click any "Join" link for auto-approval. Reply to confirm which you've joined and we'll prioritize asset delivery.</em></p>
```

### Plaintext fallback (use in `body`, also for AppleScript path)

```
Below are our 5 active programs — happy to get you set up across whichever fit your audience:

• ROCKBROS EU  — AWIN · EU · 20% CPS · ~30d cookie · ~$60 AOV · Cycling niche, EU logistics
  Join: https://ui.awin.com/express-signup/en/awin/122456/7f8849cb-3c46-4014-9237-287f2090d18e?t=DnFneLX7OWO-Lmhq_IQhOfSbAwBkVTom1yojuGCeJr8

• ROCKBROS US  — AWIN · US · 20% CPS · 30d cookie · ~$60 AOV · High repeat, DTC, outdoor
  Join: https://ui.awin.com/express-signup/en/awin/58007/ce7cc3a1-6665-4b40-a44b-776e58d80ec5?t=CXpEJMHyUjxMkTLLvSRMNZ-uuGiiuOhbFMDhKCoZrjM

• OUFER BODY JEWELRY — AWIN · US/Global · 15% CPS · 45d cookie · $100 AOV · Higher-AOV jewelry, repeat + gifting
  Join: https://ui.awin.com/express-signup/en/awin/91941/92c75d69-1a73-4726-b7cc-7eeec85b4490?t=J5wwJuxPmdReox77nbUimQQkKwAA3KTQI1_BmF59I9s

• TCL US        — Impact · US · 8–10% CPA/CPS · 30d cookie · $300–$800 AOV · Global top TV brand
  Join: https://app.impact.com/advertiser-advertiser-info/TTE-Technology-Inc.brand

• Ottocast      — Impact · US · 20% CPS (Amazon Attribution) · 14–30d cookie · $100–$200 AOV · Car tech, Amazon conversion
  Join: https://app.impact.com/advertiser-advertiser-info/CARTIZAN-CORPORATION-LIMITED.brand

Click any "Join" link for auto-approval. Reply to confirm which you've joined and we'll prioritize asset delivery.
```

### Confirmation tracking
If publisher's prior messages contain phrases like `"joined"`, `"accepted"`, `"I'm in"`, `"approved"`, `"active on [program]"`, `"tracking confirmed"` for specific programs, you may bold those rows or note "✓ joined" — but **default behavior is to include all 5 rows every time until the thread explicitly confirms all 5 are joined**.

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

Customize **bracketed slots** per thread. Reply structure for ONBOARD/INFO/NEGOTIATE/SEED/FOLLOWUP:

```
[Greeting]
[Specific reply — 2–4 sentences addressing their actual question]
[Programs Table block — see PROGRAMS TABLE BLOCK section above]
[CTA — single forward-moving question]
[Signature]
```

For MEETING/COMPLAINT: skip the Programs Table (conversation is purpose-specific).

### Signature (always)
```
Best,
CellDigital Affiliate Team
affiliate@celldigital.co
```

### ONBOARD — partner accepted invite / asking setup
**Specific reply slot (before table):**
```
Hi [Name],

[Acknowledge their action — "great to have you onboard" / "thanks for accepting"]. [1 sentence on what they need next for the brand they joined — feed, banner, or step].

[Insert Programs Table here — drives them to join the other 4 programs]

[CTA — "Reply to confirm which programs you've joined and we'll prioritize getting assets over within 24h. What category interests you most?"]

[Signature]
```

### INFO — general program question
**Specific reply slot:**
```
Hi [Name],

[Direct answer to their question — 1–2 sentences]. For the brand you mentioned: [pull commission/cookie/AOV row from Active Programs table inline].

[Insert Programs Table here]

[CTA — "Which programs above would be the best fit for your audience?"]

[Signature]
```

### NEGOTIATE — rate ask / large platform / counter-offer
**Specific reply slot:**
```
Hi [Name],

[Acknowledge interest WITHOUT conceding rate]. Our published rates are already top of market — see below.

[Insert Programs Table here — anchors the rate visually]

To size the right structure for your audience, can you share: [traffic volume / EPC / typical brand campaign metrics / redemption volume]? [If TCL: "TCL has tier-1 publisher uplift to 10% — happy to discuss once we see audience numbers."]

[CTA — request the data that will unlock the deal]

[Signature]
```
**Hard rules:**
- Never offer above 20% on any program
- TCL above 10% → FLAG
- OUFER above 18% → FLAG
- Never use "exception" / "just for you" / "special rate"

### SEED — sample/gifting request
**Specific reply slot:**
```
Hi [Name],

Thanks for reaching out about samples — [niche fit, 1 sentence]. Before we send product, can you share [media kit / 3 recent posts / channel link + average views / monthly impressions]?

[Insert Programs Table here — get them signed up while we evaluate samples]

[CTA — "Send those over and once you're approved on the relevant programs above we can ship a sample package within a week."]

[Signature]
```

### MEETING — call request or reschedule (NO TABLE)
```
Hi [Name],

[Confirm enthusiasm — "happy to connect" / "no worries on the reschedule"].

I have availability [DAY1 DATE at TIME PT / DAY2 DATE at TIME PT / DAY3 DATE at TIME PT] for a 30-minute call to align on [specific topic from thread]. Which works best? I'll send the invite right after you confirm.

[Signature]
```
*(Slots: pick the next 3 Tue/Thu/Fri mornings 9–10am PT from today's date.)*

### FOLLOWUP — re-engage stale conversation
**Specific reply slot:**
```
Hi [Name],

Apologies for the delay — [brief acknowledgment, no excuses].

[Recap where the conversation left off — 1 sentence]. [New value hook — seasonal campaign, Q[N] launch, new program added, expanded territory].

[Insert Programs Table here — also useful as a refresher of available programs]

[CTA — concrete next step to re-open]

[Signature]
```

### COMPLAINT — tracking / payment / dispute (NO TABLE)
```
Hi [Name],

Thanks for flagging — [acknowledge specific issue, no defensiveness]. I'll check with our [network team / Impact / Awin] within 24h to investigate. To speed this up, can you send your [publisher ID / transaction ID / order date]?

[CTA — "I'll come back with an update by [day]."]

[Signature]
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

## LANGUAGE PACKS — note on Programs Table

For DE/IT/ES/FR replies, **keep the Programs Table content in English** (program names are proper nouns, signup links are universal). Translate only the **surrounding intro line and CTA**:
- DE: `Hier sind unsere 5 aktiven Programme — gerne richten wir Sie überall ein, wo es zu Ihrem Publikum passt:`
- IT: `Di seguito i nostri 5 programmi attivi — siamo felici di attivarli con voi dove più adatti al vostro pubblico:`
- ES: `A continuación nuestros 5 programas activos — estaremos encantados de configurarlos donde mejor se adapten a tu audiencia:`
- FR: `Voici nos 5 programmes actifs — heureux de vous configurer là où cela correspond à votre audience :`

---

## CONSTRAINTS

```
✅ CC affiliate@xark.io on every reply
✅ Sign as CellDigital Affiliate Team
✅ Embed Programs Table in: ONBOARD, INFO, NEGOTIATE, SEED, FOLLOWUP (skip for MEETING / COMPLAINT)
✅ Use Gmail MCP create_draft with both `body` (text) AND `htmlBody` (HTML table) for drafts
✅ DRAFT (Gmail MCP create_draft): NEGOTIATE, SEED, MEETING, FOLLOWUP, COMPLAINT
✅ SEND (Mail.app reply+send): ONBOARD, INFO — plaintext only (HTML not preserved through AppleScript)
✅ Report draft to barronzuo@gmail.com — never auto-send the report

🚫 Never send: contracts, exclusivity, pricing commitments, sample SLA promises
🚫 Never promise: inventory, exclusivity, custom payment terms, "exception", "just for you"
🚫 Never reply if: Trigger Guard matched, Chinese-language sender, or already replied/drafted < 3d
🚫 Never offer rates above: 20% (any program), 18% (OUFER), 10% (TCL US) — FLAG instead
🚫 Never promote deprecated brands: COSORI, LEVOIT, INSTA360, SEGWAY — redirect to active 5

TCL domain senders → always FLAG (Trigger Guard #1).
SMART4U / LIVALL operational asks → always FLAG.
```
