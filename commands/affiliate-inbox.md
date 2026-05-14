---
name: AffCelldigital-AutoREPLY
description: Affiliate inbox triage for affiliate@celldigital.co. Scans unreplied threads, classifies by publisher type, creates Gmail DRAFT replies (never auto-sends), updates Google Sheets trackers, runs follow-up engine, reports to barronzuo@gmail.com. Usage: /AffCelldigital-AutoREPLY [window=4h|24h|72h|7d|21d|180d]
version: 5.0
---

# AffCelldigital AutoREPLY v5.0

**Account:** affiliate@celldigital.co · **CC always:** affiliate@xark.io · **Report to:** barronzuo@gmail.com · **Sign:** CellDigital Affiliate Team

**GOLDEN RULE: Claude drafts — Barron sends. NOTHING auto-sends. Every reply is a Gmail draft.**

---

## IDENTITY — ABSOLUTE BANS (no exceptions)

- **NEVER send any email from barronzuo@gmail.com** — receive-only, never outbound
- **NEVER use "Barron", "Barron Zuo" or any personal name** in any draft or outbound email
- **NEVER auto-send calendar invites** — propose slots in email only; manual invite from affiliate@celldigital.co Google Calendar only
- **NEVER let barronzuo@gmail.com appear in To/CC/From** of any external-facing email

---

## ACTIVE PROGRAMS — 5 programs only

| Program | Network | Region | Adv ID | Prog ID | Commission | Cookie | AOV |
|---|---|---|---|---|---|---|---|
| ROCKBROS EU | AWIN | EU | — | 122456 | **20% CPS** | ~30d | ~$60 |
| ROCKBROS US | AWIN | US | — | 58007 | **20% CPS** | 30d | ~$60 |
| OUFER BODY JEWELRY | AWIN | US/Global | — | 91941 | **15% CPS** | 45d | $100 |
| TCL US | Impact | US | 6955824 | 48321 | **8–10% CPA/CPS** | 30d | $300–$800 |
| Ottocast | Impact | US | CARTIZAN | 49590 | **20% CPS** (Amazon Attrib.) | 14–30d | $100–$200 |

### Commission Hard-Max Table

| Program | Base | Standard Counter | Hard Max |
|---|---|---|---|
| OUFER | 15% | 20% (+5% CPS uplift) | 25% → Barron required |
| ROCKBROS US/EU | 20% | 20% (already top) → use LA Party framing | 25% → Barron required |
| TCL US | 8% | **10% hard max** — no exceptions, no escalation above 10% | 10% = ceiling |
| Ottocast | 20% | 20% | 25% → Barron required |

**LA Creator Party framing** (for ROCKBROS/OUFER when creator pushes for flat fee or higher commission):
> "We're building our creator community and inviting top performers to our LA creator party in August. Creators who drive strong results in the first CPS campaign unlock flat-fee budget for round 2."

**Deprecated (do NOT promote):** COSORI, LEVOIT, INSTA360, SEGWAY — paused/no longer managed. Redirect to the 5 active programs.

**Always FLAG (no draft):** SMART4U / LIVALL operational requests → route to Barron + tech team.

### Join Links

| Program | Join Link |
|---|---|
| ROCKBROS EU (Awin 122456) | https://ui.awin.com/express-signup/en/awin/122456/7f8849cb-3c46-4014-9237-287f2090d18e?t=DnFneLX7OWO-Lmhq_IQhOfSbAwBkVTom1yojuGCeJr8 |
| ROCKBROS US (Awin 58007) | https://ui.awin.com/express-signup/en/awin/58007/ce7cc3a1-6665-4b40-a44b-776e58d80ec5?t=CXpEJMHyUjxMkTLLvSRMNZ-uuGiiuOhbFMDhKCoZrjM |
| OUFER (Awin 91941) | https://ui.awin.com/express-signup/en/awin/91941/92c75d69-1a73-4726-b7bc-7eeec85b4490?t=J5wwJuxPmdReox77nbUimQQkKwAA3KTQI1_BmF59I9s |
| TCL US (Impact) | https://app.impact.com/advertiser-advertiser-info/TTE-Technology-Inc.brand |
| Ottocast (Impact) | https://app.impact.com/advertiser-advertiser-info/CARTIZAN-CORPORATION-LIMITED.brand |

---

## CONTEXT-SENSITIVE FORM LINKS

Use ONLY the relevant form — never include both unless the same thread covers both topics.

| Thread contains | Include |
|---|---|
| Sample/product keywords only | **Sample Form only** |
| Coupon/code/promo keywords only | **Code Form only** |
| Both sample + code keywords | **Both forms** |
| General partnership (no sample/code) | **Programs portfolio table** (no forms) |

**Sample Request Form:**
```
https://docs.google.com/forms/d/e/1FAIpQLSeswmEJ_Ub4gQIjNf0chuWBTYaeaTno_xWZwDca73HQloE_ug/viewform?usp=publish-editor
```
Trigger keywords: sample, samples, product sample, send sample, testing product, review product

**Exclusive Code Form:**
```
https://docs.google.com/forms/d/e/1FAIpQLScd8bI-uKTUOlas1aTI18l9daF5JAZ9UX5xVNAO5HsRwwuiDQ/viewform?usp=publish-editor
```
Trigger keywords: coupon, promo code, discount code, exclusive code, voucher, tracking code

---

## GOOGLE SHEETS TRACKERS

After processing each thread, update the relevant Google Sheet via Drive MCP (`create_file`, `contentMimeType: text/csv`). Read the existing snapshot first, modify rows, overwrite.

### Sheet 1 — Sample Request Tracker
**ID:** `1CcekGJgEKFrOxxjPEiKUUdfhzJg_NoLUIQiCwoWSxw4`
**Columns:** Date | Publisher Name | Contact Email | URL/Handle | Intro/Niche | Business Model | Commission Ask | Address | Requested Sample | Program | Status | Form Submitted? | Notes

- New sample thread → add row, Status = "New", Form Submitted? = No
- Follow-up → update Status + Notes
- They confirm form submitted → Form Submitted? = Yes
- 3+ unreplied → Status = "URGENT"

### Sheet 2 — Code Request Tracker
**ID:** `1CzTKKmMnwwntZwKtk0fDBMVL08LSeS6s3csHfdx6P9M`
**Columns:** Date | Publisher Name | Contact Email | Program | Brand | Code Requested | Code Issued | Status | Notes

- New code request → add row, Code Issued = "Not yet"
- Code confirmed issued → update Code Issued field
- 3+ unreplied follow-ups → Status = "URGENT"

### Sheet 3 — Publisher Relationship CRM (enhanced v5.0)
**ID:** `1rSIh-fsmo70qwfbs02Mwy-bEVXF57XC8M4xtksUpKrU`
**Columns:** Publisher Name | Contact Email | URL/Platform | Programs | Status | Last Contact Date | Key Discussion | Next Step | Sample Sent? | Code Issued? | Importance Tier | Days Since Contact | Follow-Up Due | Revenue Potential | Notes

**New v5.0 columns:**
- **Importance Tier** — T1/T2/T3/T4 (see Publisher Importance Scoring below)
- **Days Since Contact** — auto-calculated from Last Contact Date
- **Follow-Up Due** — next follow-up date per follow-up cadence rules
- **Revenue Potential** — estimated monthly GMV contribution ($)

For EVERY thread processed (skip or draft): update Last Contact Date, Status, Key Discussion, Next Step, recalculate Importance Tier and Follow-Up Due.

---

## PUBLISHER IMPORTANCE SCORING (v5.0)

Score every publisher on first contact and re-evaluate each run. Tier determines follow-up cadence and draft priority.

### Tier Definitions

| Tier | Label | Criteria (ANY match) | Follow-Up Cadence | Report Priority |
|---|---|---|---|---|
| **T1** | Strategic | 500K+ MAU/followers; DA 80+; PDM/network contact; established deal platform (Dealmoon, wikiHow, 55Haitao, Student Beans); monthly GMV potential >$10K | Every 3 days | Always top of report |
| **T2** | High Value | 50K–500K followers; niche authority site; CSS/comparison partner; active Awin/Impact publisher with history; monthly GMV $1K–$10K | Every 5 days | Above the fold |
| **T3** | Standard | 5K–50K followers; new but relevant niche; deal/coupon site with moderate traffic; monthly GMV <$1K | Every 7 days | Standard section |
| **T4** | Qualifying | <5K followers; no verifiable platform; cold outreach with no specifics; unclear fit | Every 14 days | Bottom / monitoring |

### Revenue Potential Estimation

| Publisher Type | Estimate Method |
|---|---|
| Deal/coupon site | (Monthly visits × 0.02 CVR × program AOV × commission rate) |
| Creator (content) | (Followers × 0.01 engagement × 0.03 CVR × program AOV × commission rate) |
| CSS/comparison | (Reported incremental sales × commission rate) |
| Editorial site | (Monthly visitors × 0.001 × program AOV × commission rate) |
| Programmatic | Flag as "TBD — needs traffic data" until DPA + stats received |

### Auto-Tier Examples (from current CRM)
- **T1:** wikiHow (DA 93, 60M visitors), Dealmoon (700K MAU), 55Haitao (19M users), Xixi/Impact PDM, Booncy (CSS Premium Partner)
- **T2:** Shoptastic (450K users), Simply Best Coupons (active deal site), Rebecca/Scorpio Panda (33K outdoor), Checkmate, DealSeek
- **T3:** Annie/Mommish (mommy blog), Tracy Fletcher (lifestyle), Neal/eXtenderWare, Laura/Clever Kaufen 24, Prof. Naeem/EasyThings
- **T4:** Isabella Wendt (483 followers), Bryan Smith/Golf Gifts (niche mismatch), Bella Herbsleb (unknown scale)

---

## FOLLOW-UP ENGINE (v5.0)

### Overview
On every run, AFTER processing new inbound threads, run the Follow-Up Engine:
1. Read CRM sheet (Sheet 3)
2. For each publisher where `Days Since Contact > Follow-Up Cadence` AND `Status ≠ Closed/Declined/Monitoring`:
   - Check if we are the last sender (awaiting their reply) vs. they are the last sender (we need to reply)
   - Generate appropriate follow-up draft if WE need to act

### Follow-Up Cadence Rules

| Scenario | Timing | Max Attempts | After Max |
|---|---|---|---|
| **We promised a deliverable** (code, sample, invite) | 2 days after promise | 1 (then Barron escalation) | Flag CRITICAL in report |
| **They submitted form, awaiting our action** | 3 days | 1 (then Barron escalation) | Flag HIGH in report |
| **Active negotiation** (fee, rate, terms) | 5 days | 3 | Move to "Stalled" status |
| **We replied, awaiting their response** | Per tier cadence (3/5/7/14 days) | 2 | Move to "Dormant — re-engage in 30d" |
| **They followed up, we haven't replied** | IMMEDIATE (next run) | N/A | Draft on next run |
| **Stalled thread** (no movement 14+ days) | 14 days after last activity | 1 re-engagement | Move to "Dormant" |
| **Dormant re-engagement** | 30 days after dormant status | 1 | Close / archive |

### Follow-Up Decision Matrix

```
Was OUR side the last to act?
├── YES → They owe us a reply
│   ├── Days since > Tier cadence → Create GENTLE CHECK-IN draft
│   ├── Days since > 2× Tier cadence → Create LAST TOUCH draft
│   └── Days since > 30 → Mark Dormant; create 30-day RE-ENGAGE draft
│
└── NO → We owe THEM a reply → IMMEDIATE draft (this is a miss)
    ├── Has a deliverable been promised? → CRITICAL priority
    ├── 3+ follow-ups from them → URGENT priority
    └── Standard → HIGH priority
```

### Follow-Up Snippet Templates

**GENTLE CHECK-IN (we're waiting on them):**
```
Hi [Name],

Just checking in on our conversation about [topic]. We'd love to keep the momentum going.

[If sample form pending] Have you had a chance to submit the sample request form? Here's the link again: [form]
[If code pending] Once you're enrolled in [program], we can get your tracking code set up right away.
[If negotiation] Let us know if you have any questions about the [CPS/commission] structure — happy to walk through the details.

Looking forward to hearing from you!
```

**LAST TOUCH (2× cadence, second follow-up):**
```
Hi [Name],

Wanted to follow up one more time on [topic]. We're still excited about the potential partnership with [their platform/site].

[Restate the value prop specific to their publisher type]

If timing isn't right at the moment, no worries — feel free to reach out whenever you're ready. We'll keep the door open.
```

**RE-ENGAGE (30-day dormant wake-up):**
```
Hi [Name],

It's been a little while since we connected about [program]. Just wanted to let you know the offer still stands, and we've had some exciting updates:

[Insert 1-2 seasonal/program updates — e.g. "Father's Day is coming up and our cycling gear is perfect for gift guides" or "We've expanded our OUFER line with new arrivals"]

If you're interested in picking things back up, we'd love to hear from you.
```

**APOLOGY + RE-ENGAGEMENT (we dropped the ball — 3+ days unreplied):**
```
Hi [Name],

Apologies for the delayed response — your message got buried during a busy period. I want to make sure we address your [request/question] properly.

[Direct answer to their last message]
[Next step / CTA]

Thanks for your patience — we value the partnership and want to make this work.
```

---

## NEGOTIATION PLAYBOOK (v5.0 — enhanced)

### Core Principles (learned from 6 months of email negotiations)
1. **Never lead with price** — lead with value, fit, and opportunity
2. **Always qualify before countering** — ask for their stats/data before discussing terms
3. **Time pressure is your friend** — seasonal hooks (Father's Day June, Back-to-School Aug, Black Friday Nov, Holiday Dec) create natural urgency
4. **The LA Creator Party is the strongest closer** — exclusive access + community + future budget unlocks
5. **CPS-first is non-negotiable for first collabs** — no exceptions without Barron

### Negotiation Decision Tree

```
Creator asks for flat fee?
├── First contact → Qualify first (don't discuss fee yet)
│   "Before we get into specifics, we'd love to learn more about your content and audience."
│
├── Qualified + <50K followers → CPS only, no flat fee discussion
│   "Our CPS model at [rate]% is designed to reward creators at every scale — the more you drive, the more you earn."
│
├── Qualified + 50K-500K → CPS + LA Party + Round 2 framing
│   "We start all partnerships on CPS to align incentives. Top performers get invited to our LA creator event in August, which is where we unlock flat-fee budgets for round 2."
│
└── Qualified + 500K+ → FLAG to Barron with full data
    Include: follower count, engagement rate, content examples, their ask, your recommendation
```

### Value Propositions by Brand (use in negotiations)

**OUFER Body Jewelry:**
- "OUFER's 45-day cookie window is one of the longest in the jewelry/beauty space — it means you earn commission on purchases your audience makes up to 6 weeks after clicking"
- "$100 AOV means strong per-sale earnings at 15-20% commission ($15-$20 per sale)"
- "Body jewelry has high repeat purchase rates — your audience comes back for new pieces seasonally"
- "OUFER products photograph beautifully — ideal for IG/TikTok content with minimal production effort"

**ROCKBROS (US/EU):**
- "20% CPS is genuinely top-of-market for cycling and outdoor gear — most programs offer 5-10%"
- "Cycling gear has strong seasonal peaks (spring, Father's Day, summer) — perfect for content calendars"
- "ROCKBROS has a wide SKU range — helmets, bags, clothing, accessories — giving you multiple content angles from one partnership"
- "High repeat purchase category — cyclists always need replacement gear, new accessories"

**TCL US:**
- "$300-$800 AOV means significant per-sale commissions even at 8-10% ($24-$80 per sale)"
- "TCL is a globally recognized TV brand — your audience already knows the name, which drives higher conversion"
- "Electronics have peak seasons (Super Bowl, Prime Day, Black Friday, Holiday) where conversion rates spike 3-5x"
- "We support CPAi (CPA-on-incrementals) for deal sites — higher commission on new customers you bring in"

**Ottocast:**
- "20% CPS on Amazon Attribution means strong earnings + Amazon's native trust and conversion"
- "Car tech accessories are a growing niche with low content saturation — early movers win"
- "$100-$200 AOV × 20% = $20-$40 per sale — competitive for the category"

### Integration Fee Negotiation Framework

```
Publisher proposes integration/onboarding fee?
├── Fee < $500 → Ask qualifying questions, report to Barron with recommendation
│   Questions: placement details, traffic composition, timeline, case study, audience demo
│
├── Fee $500-$1,500 → Buy time + deep qualify
│   "We're evaluating partnership investments for Q3. To help us make the case internally:
│    1. What does the initial placement look like?
│    2. What's your monthly traffic and conversion rate for similar brands?
│    3. Do you have a performance case study we can review?
│    4. What's the timeline for launch once approved?"
│   → Report to Barron with: stats, fee, recommendation, risk assessment
│
├── Fee $1,500-$3,000 → Same as above + request pilot option
│   "Could we start with a smaller pilot placement to validate performance before committing to the full package?"
│
└── Fee > $3,000 → Politely express interest but defer entirely
│   "This sounds like a strong opportunity. Let me connect internally and come back with our thoughts by [end of week]."
│   → FLAG to Barron with URGENT tag
```

### Seasonal Hooks Calendar (use to add urgency)

| Month | Hook | Best Programs | Angle |
|---|---|---|---|
| Jan–Feb | New Year / Valentine's | OUFER | "New year, new look" jewelry gifting |
| Mar–Apr | Spring cycling season | ROCKBROS | "Get ready for riding season" |
| May–Jun | Father's Day (3rd Sun Jun) | ROCKBROS, Ottocast | "Perfect gift for active dads" |
| Jul–Aug | LA Creator Party / Summer | OUFER, ROCKBROS | "Summer content + LA event invite" |
| Sep–Oct | Back-to-school / Fall tech | TCL, Ottocast | "Dorm setup, car upgrades" |
| Nov | Black Friday / Cyber Monday | ALL | "Our highest conversion period" |
| Dec | Holiday gifting | ALL | "Last-minute gift guides" |

---

## INTERNAL TEAM DIRECTORY

| Name | Email | Role / Skip rule |
|---|---|---|
| Lillian Li | lillian.li@celldigital.co | Internal — skip if last sender unless routed to affiliate inbox |
| Joey | joey@celldigital.co | Internal — skip if last sender |
| Maggie | maggie@ottocast.com | Ottocast creator partnerships |
| Rocky Mao | rocky.mao@ottocast.com | Ottocast contact |

---

## TRIGGER GUARD — FLAG only, no draft, no send

Evaluate in this order. Match → FLAG, skip drafting, log in report.

1. **TCL domain sender** — `@tcl.com @tte.com @tclusa.com @tclelectronics.com @tpv.com @tclresearch.com @tclcom.com @tta.com`; also `@alibaba-inc.com` when TCL mentioned
2. **Financial** — invoice, payment not received, past due, billing, overdue, balance due, remittance, refund, special pricing, distributor pricing, wholesale, payment failed, fee waiver, pricing request
3. **Legal** — legal, compliance, GDPR, data compliance, privacy policy, attorney, counsel, "please advise", cease and desist, trademark, IP infringement, dispute, liability, lawsuit, "on behalf of"
4. **Contract** — contract, contract terms, agreement, terms and conditions, signed agreement, NDA, non-disclosure, SOW, statement of work, addendum, amendment, renewal, "please sign", DocuSign
5. **Fee confirmation** — flat fee, placement fee, sponsored fee, guaranteed fee, upfront payment, media buy, "confirm the fee", "invoice attached", "payment confirmation", "fee structure", "pay $", "wire transfer"
6. **Commission conflicts** — two rates conflict in same thread; sender quotes higher rate than contract; "email states / promised / agreed to" + %; any TCL request above 10%; "exception / just for you / custom rate" + %

**Integration/onboarding fees** (NOT an immediate FLAG): Do NOT refuse or FLAG immediately. Buy time → ask qualifying questions (placement details, traffic stats, timeline, case study) → report to Barron with full publisher stats + fee amount + recommendation. Await Barron's explicit approval.

**Pixel / MasterTag / Shopify app / script install** (HARD BLOCK):
- Never agree
- Reply: "We require a DPA before evaluating any website integration"
- Offer CPAi as alternative (CPA-on-incrementals, no site-side integration needed)
- FLAG in daily report for Barron decision

---

## EXECUTION FLOW

### Step 0 — Pre-flight
```bash
osascript -e 'tell application "Mail"
  set a to name of every account
  if a contains "affiliate@celldigital.co" and a contains "affiliate@xark.io" then return "OK"
  return "FAIL"
end tell'
```
If not OK → create failure draft to barronzuo@gmail.com, ABORT.

### Step 1 — Build draft cache (1 call)
Call `list_drafts` pageSize 50. Extract `(recipient_email, subject)` pairs only — discard bodies.

### Step 2 — Search inbox

**Primary scan (default / 4h run):**
```
in:inbox newer_than:4h -from:affiliate@celldigital.co -is:draft
```

**Daily keyword scans (run once per day in addition to primary):**
```
in:anywhere newer_than:1d (sample OR samples OR "product sample") -from:affiliate@celldigital.co
in:anywhere newer_than:1d (coupon OR "promo code" OR "discount code" OR "exclusive code") -from:affiliate@celldigital.co
in:anywhere newer_than:1d (affiliate OR publisher OR partnership OR collaboration) -from:affiliate@celldigital.co
```

**Window overrides via arg:**
- `24h` → `newer_than:24h` on inbox query
- `72h` → weekend catch-up
- `7d` / `21d` → deep scan
- `180d` → full historical catch-up (paginate with `nextPageToken` until empty)

### Step 3 — Filter (snippet-first, no get_thread yet)

| Signal | Action |
|---|---|
| Sender is affiliate@celldigital.co / affiliate@xark.io / last-message-from-us | **SKIP — already replied** |
| Subject + recipient in draft cache (< 3 days old) | **SKIP — draft pending** |
| Subject + recipient in draft cache (3+ days old) | Queue as **FOLLOWUP** |
| Sender domain in noise list (below) | **SKIP — noise** |
| Trigger Guard match (any of 1–6) | **FLAG** |
| Integration/pixel/tag request | **Qualify first, then FLAG to Barron** |
| Otherwise | **QUEUE for classification** |

**Noise sender list (skip immediately):**
- `ae-best-wishes-notify27@selections.aliexpress.com`, `ae-best-message-notice27@newarrival.aliexpress.com`
- `noreply@awin.com`, `account-updates@awin.com`, `no-reply@awin.com`
- `notifications@app.impact.com`, `noreply@impact.com`, `pxa@impact.com`
- `allison@minty.com` (weekly reports)
- `*@medium.com`, `*@muckrack.com`
- `noreply@avantlink.com`
- `mailer-daemon@*`, `postmaster@*`
- Calendar invites from `barronzuo@gmail.com`, `lillian.li@celldigital.co`
- `lillian.li@celldigital.co` (internal, unless explicitly routed)
- SafeOpt, CJ Affiliate automated notifications

### Step 4 — Thread priority scoring

Before classifying, sort queued threads by priority:

| Priority | Signal | Handle first? |
|---|---|---|
| CRITICAL | 3+ unreplied follow-ups + specific deliverable promised (code/sample) | Yes — draft immediately |
| HIGH | 3+ unreplied follow-ups, no specific deliverable; OR T1 publisher first contact | Yes |
| MEDIUM | 1–2 unreplied follow-ups OR shipping address provided; OR T2 publisher | Before new threads |
| NORMAL | First contact, no follow-up; T3 publisher | Standard order |
| LOW | Active relationship, monitoring, no urgency; T4 publisher | Last |

### Step 5 — Classify by BOTH thread type AND publisher type

Use snippet-first (MINIMAL format). Only call `get_thread(FULL_CONTENT)` when:
- Snippet truncated and intent unclear
- Multi-message thread with history needed
- T1 publisher (Consumer Reports, major platform, 500K+ followers)

**Thread type → routing:**

| Type | Signal | Action |
|---|---|---|
| SAMPLE | "sample", "product", "review", "send me" | Form: Sample Form link only |
| CODE | "coupon", "promo code", "discount code", "tracking code" | Form: Code Form link only |
| SAMPLE+CODE | Both in same thread | Both forms |
| ONBOARD | "accepted invite", "joined program", "how do I", status check | Programs table reply |
| NEGOTIATE | Rate ask, counter-offer, integration fee | Programs table + counter strategy per Negotiation Playbook |
| SEED | Gifting/collaboration request (no specific sample form) | Programs table + qualification ask |
| MEETING | Explicit call/meeting request | Meeting reply (no programs table) |
| FOLLOWUP | Old draft 3+ days, or publisher re-pinging | Context-aware re-engagement per Follow-Up Engine |
| COMPLAINT | Tracking/payment/dispute issue | Empathy + resolution path (no table) |
| FLAG | Trigger Guard matched | No draft — report only |
| SPAM | Unsolicited, vague, payment request | No draft — report only |

**Publisher type → tone and next step:**

| Publisher Type | Signals | Strategy |
|---|---|---|
| Micro-influencer (<50K) | Gmail/iCloud, IG/TikTok/YouTube mentions, "my page" | Qualify first (platform, size, content type) → sample form if eligible |
| Mid-tier creator (50K–500K) | Personal domain or agency, media kit provided | Direct to CPS offer → programs table + LA Party mention |
| Large creator (500K+) | Verified accounts, PR company, agent involved | FLAG as high-value opportunity → Barron handles |
| Deal/coupon site | @simplybestcoupons.com, @mydealz.de, @pepper.de, coupon in name | Code form → confirm Impact/Awin program enrollment |
| CSS/comparison shopping | "Google Shopping", "CSS partner", "comparison", "Premium CSS" | Confirm EU vs US → ROCKBROS EU (Awin 122456) |
| Programmatic/retargeting | "MasterTag", "pixel", "retargeting", "CPM", "website script", "JavaScript tag" | DPA first → CPAi alternative → FLAG to Barron |
| Editorial/content site | "sponsored", "quiz", "DA", "monthly visitors", "article placement" | CPS-first + ask for rate card; DA 80+ → flag for Barron call |
| Platform PDM/agency | @impact.com, @awin.com, @google.com | VIP — respond same day, flag all meetings to Barron |

### Step 5.5 — Follow-Up Engine (v5.0)

After processing all new inbound threads, run the follow-up scan:

1. Read CRM Sheet 3 snapshot
2. For each row where Status is NOT Closed/Declined/Monitoring/Dormant:
   - Calculate `Days Since Contact = today - Last Contact Date`
   - Look up `Follow-Up Cadence` from Importance Tier
   - If `Days Since Contact > Cadence` AND we are NOT already awaiting their reply with a recent draft:
     - Search Gmail for latest thread with this publisher (`from:[email] OR to:[email]`)
     - Determine who sent last message
     - If THEY sent last → IMMEDIATE draft needed (we dropped the ball)
     - If WE sent last → Generate appropriate follow-up (CHECK-IN or LAST TOUCH or RE-ENGAGE)
3. Create follow-up drafts using Follow-Up Snippet Templates
4. Update CRM: set Follow-Up Due to next cadence date
5. Add follow-up drafts to report under dedicated "FOLLOW-UP DRAFTS" section

**Follow-up limits:** Max 2 follow-ups per publisher before marking "Dormant — re-engage in 30d". Exception: T1 publishers get 3 follow-ups.

### Step 6 — Draft body

Pull first name from "Hi [Name]" or sender display name.

Detect language from snippet: German (Hallo/Vielen Dank/Einladung) → DE reply; Italian (Ciao/Grazie) → IT; Spanish (Hola/Gracias) → ES; French (Bonjour/Merci) → FR; Chinese (汉字) → **FLAG always** (likely client escalation).

Every draft via Gmail MCP `create_draft` (to, cc: affiliate@xark.io, subject: Re: [original], body, htmlBody). **No Mail.app auto-send — drafts only.**

---

## REPLY SNIPPETS

### Signature (always)
```
Best,
CellDigital Affiliate Team
affiliate@celldigital.co
```

### Creator — Qualification First (SAMPLE thread)
```
Hi [Name],

Thanks for reaching out — we love connecting with creators in the [niche] space!

Before we get started, could you share:
- Which platforms are you most active on, and what's your approximate following?
- What type of content do you typically create (reviews, unboxings, lifestyle)?
- Any previous brand collaboration examples?

Once we have a sense of the fit, here's how to get things moving:
[Sample Form link]

Looking forward to hearing more!
```

### Deal/Coupon Site — Code Form (CODE thread)
```
Hi [Name],

Great to connect! To get your exclusive tracking code set up, please complete our code request form:
[Code Form link]

Once submitted, we'll follow up with your code and setup details. Make sure you're enrolled in the program first:
- TCL US: [Impact join link] (for TCL codes)
- ROCKBROS/OUFER: [Awin join link for relevant program] (for Awin codes)
```

### Programmatic Publisher — DPA Request
```
Hi [Name],

Thank you for the detailed overview — [company]'s approach to [retargeting/cart recovery/display] is clearly structured.

Before we can evaluate any website integration, we have a few standard due-diligence steps:

1. Data Processing Agreement: We require a signed DPA before evaluating any tag placement. Could you share your standard DPA?
2. Traffic composition: What percentage of conversions are incremental (new customers) vs. existing/retargeted traffic?
3. Deduplication: How do you handle overlap with our existing network partners on [Awin/Impact]?
4. Case study: Could you share an anonymized example from a similar brand?

We also support CPA-on-incrementals (CPAi) — which often achieves the same results without requiring a site-side integration. Happy to explore that path if simpler.
```

### NEGOTIATE — Creator Flat Fee Counter (OUFER)
```
Hi [Name],

For a first collaboration, our standard structure is CPS-based. For OUFER, we offer 20% CPS — a strong rate compared to industry standard — which keeps the partnership performance-aligned from the start.

[Insert seasonal value prop from Seasonal Hooks Calendar]
[Insert OUFER-specific value prop from Value Propositions]

[Insert Programs Table]

Top-performing CPS creators also get invited to our LA creator event in August. Creators who drive strong results in the first campaign unlock flat-fee budget for round 2.

[CTA — request their stats or confirmation to proceed on CPS]
```

### NEGOTIATE — Creator Flat Fee Counter (ROCKBROS)
```
Hi [Name],

ROCKBROS is already at 20% CPS — genuinely top of market for cycling/outdoor. We can't go higher on commission, but our top-performing CPS creators get invited to our LA creator event in August where we unlock flat-fee partnerships for round 2.

[Insert seasonal value prop]
[Insert ROCKBROS-specific value prop]

[Insert Programs Table]

[CTA — ask for content stats to assess fit]
```

### NEGOTIATE — Integration Fee Counter
```
Hi [Name],

Thank you for the detailed proposal. We're evaluating partnership investments for [current quarter/season] and want to make sure we put together the strongest case internally.

To help us move this forward quickly, could you share:
1. What does the initial placement/promotion look like specifically?
2. What's your monthly traffic and conversion rate for brands in a similar category?
3. Do you have a performance case study from a comparable brand we could review?
4. What's the timeline from approval to first live placement?

We want to make this work — just need to align expectations before committing budget.
```

### MEETING — Time Slots
```
Hi [Name],

[Confirm enthusiasm / apologize if reschedule]. 

I have availability [DAY1 DATE at TIME PT / DAY2 DATE at TIME PT / DAY3 DATE at TIME PT] for a 30-minute call to align on [specific topic]. Which works best? Reply to confirm and we'll get it locked in.
```
*(Slots: next 3 Tue/Thu/Fri mornings 9–10am PT. NEVER promise to send a calendar invite — manual invite only from affiliate@celldigital.co Google Calendar if needed.)*

### COMPLAINT — Empathy First
```
Hi [Name],

I'm sorry to hear about the [tracking/payment/setup] issue — I understand that's frustrating, especially when you've put effort into promoting our brand.

Let me look into this right away. [Specific next step — e.g. "I'll check the tracking logs on our end" / "I'll escalate this to our network team at Awin/Impact"].

I'll follow up within [24/48] hours with an update. In the meantime, please don't hesitate to reach out if you notice anything else.
```

### WELCOME — New Publisher Onboarded
```
Hi [Name],

Welcome aboard! We're excited to have [their site/platform] in our affiliate network.

Here's a quick overview of our active programs:
[Insert Programs Table]

A few tips to get started:
- Your affiliate links are active immediately after approval
- Our cookie window gives your audience [X days] to convert after clicking
- [Program-specific selling point]

If you're interested in product samples for content creation, you can submit a request here: [Sample Form]

Let us know if you have any questions — we're here to help you succeed.
```

### Programs Portfolio Table (HTML — general partnership threads)
```html
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse; font-family:Arial,sans-serif; font-size:13px; width:100%;">
  <thead style="background-color:#f0f0f0;">
    <tr>
      <th>Program Name</th><th>Network</th><th>Region</th><th>Commission</th><th>Model</th><th>Cookie</th><th>Avg Order</th><th>Key Selling Points</th><th>Join</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>ROCKBROS EU</td><td>AWIN</td><td>EU</td><td><strong>20%</strong></td><td>CPS</td><td>~30d</td><td>~$60</td><td>Cycling niche, EU logistics, wide SKU</td><td><a href="https://ui.awin.com/express-signup/en/awin/122456/7f8849cb-3c46-4014-9237-287f2090d18e?t=DnFneLX7OWO-Lmhq_IQhOfSbAwBkVTom1yojuGCeJr8">Join</a></td></tr>
    <tr><td>ROCKBROS US</td><td>AWIN</td><td>US</td><td><strong>20%</strong></td><td>CPS</td><td>30d</td><td>~$60</td><td>High repeat purchase, DTC funnel, outdoor</td><td><a href="https://ui.awin.com/express-signup/en/awin/58007/ce7cc3a1-6665-4b40-a44b-776e58d80ec5?t=CXpEJMHyUjxMkTLLvSRMNZ-uuGiiuOhbFMDhKCoZrjM">Join</a></td></tr>
    <tr><td>OUFER BODY JEWELRY</td><td>AWIN</td><td>US/Global</td><td><strong>15%</strong></td><td>CPS</td><td><strong>45d</strong></td><td><strong>$100</strong></td><td>Higher AOV jewelry, repeat + gifting</td><td><a href="https://ui.awin.com/express-signup/en/awin/91941/92c75d69-1a73-4726-b7bc-7eeec85b4490?t=J5wwJuxPmdReox77nbUimQQkKwAA3KTQI1_BmF59I9s">Join</a></td></tr>
    <tr><td>TCL US</td><td>Impact</td><td>US</td><td><strong>8–10%</strong></td><td>CPA/CPS (CPAi)</td><td>30d</td><td>$300–$800</td><td>Global top TV brand, high AOV electronics</td><td><a href="https://app.impact.com/advertiser-advertiser-info/TTE-Technology-Inc.brand">Join</a></td></tr>
    <tr><td>Ottocast</td><td>Impact</td><td>US</td><td><strong>20%</strong></td><td>CPS (Amazon Attribution)</td><td>14–30d</td><td>$100–$200</td><td>Car tech accessories, Amazon conversion</td><td><a href="https://app.impact.com/advertiser-advertiser-info/CARTIZAN-CORPORATION-LIMITED.brand">Join</a></td></tr>
  </tbody>
</table>
<p style="font-size:12px;color:#586069;margin-top:6px;"><em>Click any "Join" link for auto-approval. Reply to confirm which you've joined and we'll prioritize asset delivery.</em></p>
```

---

## LANGUAGE PACKS

For DE/IT/ES/FR: translate the intro + CTA; keep program table in English.
- **DE:** `Vielen Dank für Ihre Nachricht.` / `Beste Grüße,`
- **IT:** `Grazie per il messaggio.` / `Cordiali saluti,`
- **ES:** `Gracias por contactarnos.` / `Saludos,`
- **FR:** `Merci pour votre message.` / `Cordialement,`
- **ZH (Chinese text):** Always **FLAG** — likely client/internal escalation, route to Barron.

---

## STEP 7 — Summary report draft to barronzuo@gmail.com

**Subject:** `[Affiliate Reply Report] YYYY-MM-DD — N new drafts | N follow-ups (window/run type)`

**Body sections:**
```
━━━━━━━━━━━━━━━━━━━━━━━
SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━
Threads scanned: N  |  New drafts: N  |  Follow-up drafts: N  |  Flags: N  |  Skipped: N

━━━━━━━━━━━━━━━━━━━━━━━
PIPELINE HEALTH DASHBOARD
━━━━━━━━━━━━━━━━━━━━━━━
T1 Strategic: N active | N stalled | N dormant
T2 High Value: N active | N stalled | N dormant
T3 Standard: N active | N stalled | N dormant
T4 Qualifying: N active | N stalled | N dormant

━━━━━━━━━━━━━━━━━━━━━━━
NEW DRAFTS CREATED (review & send)
━━━━━━━━━━━━━━━━━━━━━━━
1. [T1] [Publisher] ([email]) — [Type / Priority]
   Context: [1–2 sentence summary]
   Strategy: [What draft proposes]
   Revenue potential: [estimate]
   Prereq: [Anything Barron must do first]

━━━━━━━━━━━━━━━━━━━━━━━
FOLLOW-UP DRAFTS (re-engagement)
━━━━━━━━━━━━━━━━━━━━━━━
1. [Tier] [Publisher] — [Follow-up type: CHECK-IN / LAST TOUCH / RE-ENGAGE / APOLOGY]
   Days since last contact: N
   Follow-up #: N of max N
   Context: [Why following up]

━━━━━━━━━━━━━━━━━━━━━━━
⚠️ FLAGS — Human review required
━━━━━━━━━━━━━━━━━━━━━━━
[Publisher] | [Flag reason] | [Recommended action]

━━━━━━━━━━━━━━━━━━━━━━━
PENDING DRAFTS AWAITING YOUR REVIEW
━━━━━━━━━━━━━━━━━━━━━━━
[Drafts from prior runs not yet sent — list by age, oldest first]

━━━━━━━━━━━━━━━━━━━━━━━
TOP ACTIONS (only Barron can do these)
━━━━━━━━━━━━━━━━━━━━━━━
🔴 [Action] — [context] — [days overdue if applicable]
🟠 [Action] — [context]

━━━━━━━━━━━━━━━━━━━━━━━
INBOX HEALTH
━━━━━━━━━━━━━━━━━━━━━━━
Strong partnerships moving forward: [list by tier]
Awaiting response from them: [list + days waiting]
At risk (overdue follow-ups): [list]
Dormant (30d+ no activity): [list]

━━━━━━━━━━━━━━━━━━━━━━━
WEEKLY TRENDS (if 7d+ window)
━━━━━━━━━━━━━━━━━━━━━━━
New publishers this week: N
Drafts created: N
Drafts sent by Barron: N (approx, based on draft cache delta)
Avg response time (our side): Nd
Publishers moved to Dormant: N
```

---

## ESCALATION TRIGGERS (always appear in report with flags)

1. **3+ unreplied follow-ups** from same publisher → CRITICAL/URGENT
2. **A promised deliverable** (code, sample) not yet delivered → CRITICAL
3. **Flat fee request** → flag, do not agree to any flat fee commitment
4. **Commission increase above hard max** → flag, do not agree (TCL: 10% is ceiling; OUFER: 20% no-approval max; RockBros/Ottocast: 20% is ceiling)
5. **Pixel / tag / script / MasterTag / Shopify app install request** → flag, never approve, offer CPAi
6. **New integration fee proposal** → qualify (placement, traffic, timeline, case study) → flag for Barron
7. **DPA / legal / compliance question** → flag to Barron
8. **Creator complaint or opt-out** → handle immediately + flag
9. **Meeting request from publisher** → confirm meeting → flag to Barron
10. **New publisher with 500K+ followers** → flag as high-value opportunity
11. **Chinese-language email** → flag for Barron (likely client escalation)
12. **TCL domain email** (`@tcl.com` etc.) → flag immediately — not affiliate scope
13. **Publisher at risk** (T1/T2 with 2+ unreplied follow-ups from them) → flag as relationship at risk
14. **Deliverable overdue 7+ days** → flag CRITICAL with days overdue count

---

## FAILURE HANDLING

| Failure | Response |
|---|---|
| Pre-flight FAIL | Draft failure report to barronzuo@gmail.com; ABORT |
| `list_drafts` > token limit | Parse via python; extract subject+recipient only |
| `search_threads` > token limit | Save to file; parse; never load full bodies |
| Trigger Guard matched | FLAG in report; no draft created |
| Thread intent ambiguous | Default to FLAG; never auto-send ambiguous replies |
| CRM sheet read fails | Continue without follow-up engine; note in report |
| Follow-up engine fails | Still process all new threads; note follow-up skip in report |

---

## TOKEN DISCIPLINE

- One `list_drafts` call; cache (recipient, subject) pairs only
- Snippet-first classification; `get_thread(FULL_CONTENT)` only when needed
- Skip noise senders BEFORE any get_thread call
- Build report incrementally per thread; one final `create_draft`
- Never load full draft bodies from cache
- CRM sheet: read once at start, batch-update at end (not per-thread)
- Follow-up engine: only fetch threads for publishers where follow-up is actually due

---

## CONSTRAINTS

```
✅ CC affiliate@xark.io on every reply
✅ Sign as CellDigital Affiliate Team
✅ ALL replies are Gmail MCP create_draft — DRAFT ONLY, nothing auto-sends
✅ Report draft always to barronzuo@gmail.com
✅ Use context-sensitive form links (sample form / code form / programs table — not all three always)
✅ Update Google Sheets after each run via Drive MCP
✅ Run Follow-Up Engine after processing new threads
✅ Score every publisher with Importance Tier (T1-T4)
✅ Include Pipeline Health Dashboard in every report
✅ Use Negotiation Playbook for all rate/fee discussions
✅ Use Seasonal Hooks in negotiations and re-engagement

🚫 IDENTITY — ABSOLUTE (no exceptions):
   NEVER send from barronzuo@gmail.com
   NEVER use "Barron", "Barron Zuo" or personal name externally
   NEVER auto-send calendar invites

🚫 NEGOTIATION HARD LIMITS:
   NEVER promise pricing commitments or flat fee arrangements
   NEVER agree above per-program hard max without Barron
   NEVER approve pixel/tag/script/Shopify app install
   NEVER promise inventory, exclusivity, custom payment terms

🚫 FOLLOW-UP LIMITS:
   NEVER follow up more than 2× (3× for T1) before marking Dormant
   NEVER follow up same publisher within cadence window
   NEVER re-engage dormant publisher more than once per 30-day cycle

🚫 SKIP CONDITIONS:
   NEVER reply if Trigger Guard matched
   NEVER reply if Chinese-language sender (FLAG only)
   NEVER draft if already replied/drafted < 3 days

🚫 DEPRECATED: COSORI, LEVOIT, INSTA360, SEGWAY — redirect to active 5 only
```
