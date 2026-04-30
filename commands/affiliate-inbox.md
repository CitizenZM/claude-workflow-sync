---
name: affiliate-inbox
description: Affiliate inbox reply drafter — checks affiliate@celldigital.co for unreplied threads, drafts or sends strategic replies via Mail.app (fully threaded), and emails a summary report to barronzuo@gmail.com. Usage: /affiliate-inbox [72h for catch-up]
version: 2.1-applescript
---

# Affiliate Inbox Reply Drafter v2.1 — AppleScript Edition

**Account:** affiliate@celldigital.co | **CC always:** affiliate@xark.io | **Report to:** barronzuo@gmail.com
**Default scan window:** 24h (pass `72h` as argument for weekend catch-up)

---

## RATE FLOORS — hard limits, never negotiate below without human approval

| Scenario | Floor | Flag if exceeded |
|---|---|---|
| Standard commission | 5% | Flag if partner requests >10% |
| Performance uplift tier | 8% | Flag if >12% |
| Exclusivity | Never agree upfront | Always FLAG |
| Product seeding | Tie to content plan | Flag if >3 units requested |

---

## TOOL ROUTING

- **Gmail MCP** (`search_threads`, `get_thread`, `list_drafts`, `create_draft`) → discovery, reading, report draft
- **Bash/osascript** → all reply creation: `reply without opening window` + CC + `send` or `save`
- **SEND types** (ONBOARD, INFO): Mail.app `send` — instant, fully threaded in sent mail
- **DRAFT types** (NEGOTIATE, SEED, MEETING, FOLLOWUP): Mail.app `save` — lands in Gmail Drafts, threaded when Barron sends
- **FLAG / SPAM**: no email, report only

---

## STEP 0 — Pre-flight (ABORT if any check fails)

Run this osascript. If it fails or returns wrong accounts, create a failure report draft to barronzuo@gmail.com and STOP.

```bash
osascript -e 'tell application "Mail"
  set accts to name of every account
  if accts contains "affiliate@celldigital.co" and accts contains "affiliate@xark.io" then
    return "PREFLIGHT_OK"
  else
    return "PREFLIGHT_FAIL: accounts=" & (accts as string)
  end if
end tell'
```

Also call `list_drafts` once now and cache all draft thread IDs + subjects. Do NOT call list_drafts again per-thread.

---

## STEP 1 — Discover unreplied threads

Call `search_threads` with:
```
query: in:inbox newer_than:24h
```
*(Use `newer_than:72h` if catch-up mode was requested.)*

For each result, call `get_thread` (messageFormat: FULL_CONTENT) and apply this filter:

| Condition | Action |
|---|---|
| Most recent message sent FROM affiliate@celldigital.co | Skip — already replied |
| Thread has a draft in the cached list (subject match or thread ID match) created within 3 days | Skip — draft pending |
| Thread has a draft older than 3 days | Queue as FOLLOWUP type |
| Most recent message sent TO affiliate@celldigital.co, no draft | ✅ Queue for reply |

---

## STEP 2 — Classify each queued thread

Extract from each thread:
- Sender name, email, company/role (if visible)
- Platform: Awin / Impact.com / Rakuten / CJ / ShareASale / Levanta / Direct
- Publisher type: content creator / coupon / loyalty / sub-affiliate / media / unknown
- What they want (1 sentence)
- Negotiation stage: first contact / counter-offer / agreement / onboarding / complaint / follow-up
- Numbers: commission %, EPC, order value, follower count, GMV
- Urgency signals: deadlines, "urgent", "limited time"
- Risk flags: vague sender, payment request, sensitive data ask

**Assign one type:**

| Type | Criteria | Action |
|---|---|---|
| `NEGOTIATE` | Commission rate, counter-offer, exclusivity | DRAFT via Mail.app |
| `SEED` | Product sample / gifting request | DRAFT via Mail.app |
| `ONBOARD` | Application status, how-to, platform setup | SEND via Mail.app |
| `COMPLAINT` | Tracking issue, payment dispute | DRAFT via Mail.app |
| `MEETING` | Explicit call/meeting request | DRAFT via Mail.app |
| `FOLLOWUP` | Old draft (3+ days) or following up on silence | DRAFT via Mail.app |
| `INFO` | General question, no negotiation | SEND via Mail.app |
| `SPAM` | Unsolicited, vague, asks for payment | No email — report only |
| `FLAG` | Contract, exclusivity, >10% commission, legal/human judgment | No email — report only |

---

## STEP 3 — Write the reply body

**Tone:** Warm but businesslike. Confident. Forward-moving. Every email ends with a specific CTA.
**Length:** Max 150 words for ONBOARD/INFO. Max 200 words for NEGOTIATE/SEED/COMPLAINT.

**Format:**
```
Hi [First Name],

[Context acknowledgment — 1 sentence max]

[Core reply — strategy-appropriate, 2-4 sentences]

[CTA — specific question or proposed next step]

Best,
CellDigital Affiliate Team
affiliate@celldigital.co
```

**Strategy by type:**

**NEGOTIATE:** Acknowledge ask without conceding. Anchor to 5%. Frame uplift: "once you hit $X GMV, we move you to Y%." Ask for their traffic/EPC stats to size the deal. Never say "exception" or "just for you." Flag with ⚠️ if they push above 10%.

**SEED:** Don't commit yes/no. Ask for content plan: platform, posting schedule, estimated reach. CTA: "Send us your media kit or last 3 posts and we'll get you set up." Flag if >3 units.

**ONBOARD:** Answer in 2-3 sentences. Provide the one link or one step they need. CTA: "Let me know once you're in and we'll confirm your tracking."

**COMPLAINT:** Lead with empathy. Acknowledge the specific issue. State resolution path: "I'll check with our network team within 24h." CTA: ask for publisher ID / transaction ID.

**MEETING:** Confirm enthusiasm. Propose 3 slots (prefer Tuesday/Thursday/Friday mornings PT). Format: "Tuesday May 6 at 9am PT / Thursday May 8 at 10am PT / Friday May 9 at 9am PT." State 30-min agenda. CTA: "Which works best? I'll send a calendar invite right after you confirm."

**FOLLOWUP:** Warm re-engagement tone. Recap where the conversation was (1 sentence). Add new value hook (seasonal campaign, product launch). CTA: concrete next step.

**INFO:** Answer directly. CTA: simple question to advance the relationship.

**Hard rules — never include:**
- Inventory commitments or pricing guarantees
- Custom payment terms
- "I'll make an exception" or "just for you"
- Commission above 10% without ⚠️ FLAG

---

## STEP 4 — Execute via Mail.app AppleScript

Two proven patterns — use the correct one based on type.

### Pattern A: SEND (ONBOARD, INFO) — reply + send, fully threaded in Sent Mail

Find the original message in Mail.app by sender email, create a headless reply, and send immediately.

```bash
osascript << 'EOF'
tell application "Mail"
  set theAccount to account "affiliate@celldigital.co"
  set senderEmail to "SENDER_EMAIL_HERE"
  set subjectHint to "SUBJECT_SNIPPET_HERE"
  set candidateMessages to (messages of mailbox "INBOX" of theAccount whose sender contains senderEmail)
  if (count of candidateMessages) is 0 then
    set candidateMessages to (messages of mailbox "INBOX" of theAccount whose subject contains subjectHint)
  end if
  if (count of candidateMessages) is 0 then return "NOT_FOUND: " & senderEmail
  set theMsg to message 1 of candidateMessages
  set theReply to reply theMsg without opening window
  tell theReply
    set content to "REPLY_BODY_HERE"
    make new to recipient at end of cc recipients with properties {address:"affiliate@xark.io"}
    send
  end tell
  return "SENT: " & senderEmail
end tell
EOF
```

### Pattern B: DRAFT (NEGOTIATE, SEED, MEETING, COMPLAINT, FOLLOWUP) — new outgoing message + save

Creates a standalone draft in the Drafts folder with `Re:` prefix. Threading by subject is sufficient for Gmail conversation grouping when Barron sends it manually.

```bash
osascript << 'EOF'
tell application "Mail"
  set theAccount to account "affiliate@celldigital.co"
  set newDraft to make new outgoing message with properties {subject:"Re: ORIGINAL_SUBJECT_HERE", content:"REPLY_BODY_HERE", visible:false}
  tell newDraft
    make new to recipient at end of to recipients with properties {address:"SENDER_EMAIL_HERE"}
    make new to recipient at end of cc recipients with properties {address:"affiliate@xark.io"}
    save
  end tell
  return "DRAFT_SAVED: SENDER_EMAIL_HERE"
end tell
EOF
```

**Note on threading for drafts:** The draft has the correct `Re:` subject. When Barron opens it in Gmail Drafts and clicks Send, Gmail will thread it into the existing conversation by subject matching. No `In-Reply-To` header — adequate for affiliate email where conversational threading is not critical.

**If osascript returns NOT_FOUND (Pattern A only):** fall back to Gmail MCP `create_draft` (standalone) and note fallback in the report.

---

## STEP 5 — Log each action

After each thread, record:

```json
{
  "thread_id": "gmail_thread_id",
  "sender": "name@domain.com",
  "subject": "Re: Original Subject",
  "type": "NEGOTIATE|SEED|ONBOARD|...",
  "action": "sent|draft_saved|draft_fallback|skipped|flagged",
  "timestamp": "ISO8601",
  "flag_reason": null
}
```

If osascript fails: log error, continue to next thread. Never abort full session on a single failure.

---

## STEP 6 — Summary report draft to barronzuo@gmail.com

After all threads processed, call Gmail MCP `create_draft`:
- **to:** barronzuo@gmail.com
- **subject:** `[Affiliate Reply Report] YYYY-MM-DD — N sent | N drafts | N flagged`
- **body:**

```
Affiliate Inbox Report — {date} {time PT}
Account: affiliate@celldigital.co
Scan window: last 24h
Threads scanned: N

---

✅ SENT DIRECTLY (N) — via Mail.app, fully threaded
| Sender | Subject | Type | Strategy |
|---|---|---|---|

---

📋 DRAFTS SAVED (N) — in Drafts, threaded when you send
| Sender | Subject | Type | Strategy |
|---|---|---|---|

---

⚠️ FLAGGED FOR HUMAN REVIEW (N)
| Sender | Subject | Flag Reason | Recommended Action |
|---|---|---|---|

---

🚫 SKIPPED (N)
| Sender | Subject | Reason |
|---|---|---|

---

❌ ERRORS (N)
| Thread | Error | Fallback Used |
|---|---|---|

---
Next recommended action: [1-sentence suggested follow-up]
```

---

## FAILURE HANDLING

| Failure | Response |
|---|---|
| Pre-flight fails (wrong account) | Draft failure report to barronzuo@gmail.com, ABORT |
| osascript NOT_FOUND for a thread | Fall back to Gmail MCP create_draft, note in report |
| osascript error on send/save | Log error, continue to next thread |
| All osascript calls fail | Draft failure report to barronzuo@gmail.com |
| Thread unreadable | Skip, log as error |
| Ambiguous classification | Create DRAFT, add ⚠️ FLAG note in report |

---

## TOKEN OPTIMIZATION

- `list_drafts` → call ONCE, cache all results
- `get_thread` → batch-read all threads before drafting any replies
- Classify all threads in one pass before writing any reply bodies
- Build report incrementally per thread
- Temp files: write to `/tmp/affiliate_reply_{threadId}.txt`, delete after use

---

## CONSTRAINTS SUMMARY

```
✅ Always CC: affiliate@xark.io
✅ Always sign: CellDigital Affiliate Team
✅ DRAFT (Mail.app save): NEGOTIATE, SEED, MEETING, COMPLAINT, FOLLOWUP, FLAG
✅ SEND (Mail.app send): ONBOARD, INFO
✅ Report draft always to: barronzuo@gmail.com

🚫 Never send: contracts, commission >10%, exclusivity, pricing commitments
🚫 Never promise: inventory, exclusivity, custom payment terms
🚫 Never go above: 10% commission without ⚠️ FLAG
🚫 Never reply to: SPAM
🚫 Never draft if: already replied/drafted within 3 days
```
