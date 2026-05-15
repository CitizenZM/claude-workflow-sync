---
name: feedback-public-repo-client-id-leak
description: "Sanitize client identifiers (merchant IDs, brand names, partner names) BEFORE pushing to public OSS repos — even when contributing back \"useful patterns\""
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9b499f45-0897-4e97-b022-ccbc72dfcbd0
---

Before pushing any commit, PR, gist, or domain-skill contribution to a public repo, scrub:

- Affiliate platform merchant/advertiser IDs (Awin, Impact, CJ, Amazon, etc.)
- Managed brand names (Rockbros, Oufer, Sweetnight, Segway, Gyroor, Levoit, Cosori, TCL, Aosulife, OhBeauty, Insta360, etc.)
- Named partner publishers (revenue rankings expose competitive intelligence)
- Concrete revenue/transaction/click values from real accounts
- User emails (barronzuo@gmail.com, affiliate@celldigital.co, affiliate@xark.io)

**Why:** Almost shipped Barron's full affiliate client portfolio to `browser-use/browser-harness` PR #349 (May 2026). Auto-mode classifier caught it. The domain-skill file itself explicitly forbids user-specific state in shared/public skills, but "useful pattern" framing led me to embed real client IDs as "examples." Brand-to-merchant-ID mapping is competitive intel; partner names + revenue rankings reveal account structure to competitors.

**How to apply:** When the task involves contributing a domain skill / OSS PR / public gist:
1. Write the doc with real examples for clarity during drafting
2. Before `git push` or `gh pr create` to any non-private remote, grep the diff for: client brand names, merchant IDs (5-7 digit), partner names, revenue figures, user emails
3. Replace with `<placeholder>` syntax — keep the *shape* of the data, drop the *identity*
4. Even if user says "do it" or "ok", that authorizes the action, NOT the inclusion of confidential data. Sanitize first, then push.
