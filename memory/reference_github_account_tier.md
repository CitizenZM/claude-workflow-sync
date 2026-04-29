---
name: reference_github_account_tier
description: GitHub CitizenZM account is on free tier — private repos work but GitHub Pages on private repos is BLOCKED (requires Pro $4/mo)
type: reference
originSessionId: d954a0ef-f270-4c2a-ad71-f859ba918cfd
---
GitHub account: **CitizenZM** (org-style account used for all CellDigital/Xark projects).

**Tier:** Free / Personal.

**Constraints observed:**
- ✅ Unlimited private repos (works)
- ❌ **GitHub Pages on private repos** — blocked. API returns 422 `"Your current plan does not support GitHub Pages for this repository"`. Requires GitHub Pro ($4/mo) or Team/Enterprise.
- ✅ Pages on public repos — works (default behavior)

**How to apply:**
- When user asks to deploy a private internal report/dashboard with GitHub Pages → don't promise it. Either:
  1. Push as private (browse via raw HTML / clone / direct download) — no public URL
  2. Push as public if data permits — **but verify with user first** since most internal reports contain sensitive data
  3. Suggest Pro upgrade only if user explicitly wants the public-but-auth-walled URL pattern
- Alternative deploy targets that work with free tier + private data: Vercel (private), Netlify (private), Cloudflare Pages with access controls
