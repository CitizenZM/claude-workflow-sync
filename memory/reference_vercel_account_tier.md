---
name: reference_vercel_account_tier
description: Vercel team "Barron's projects" is on Hobby tier — SSO protection only on deployment-specific URLs, NOT on prod aliases or custom domains
type: reference
originSessionId: d954a0ef-f270-4c2a-ad71-f859ba918cfd
---
Vercel team: **Barron's projects** (slug: `barrons-projects-b6dc5d36`, id: `team_9wAmkfds8vGz33ZRCeqgeaE8`).
CLI logged in as `citizenzm`.

**Tier:** Hobby (free).

**Critical default behavior on Hobby tier:**
- Every `vercel deploy --prod` auto-creates THREE alias URLs that are PUBLIC by default:
  1. `<project>.vercel.app` (vanity production alias)
  2. `<project>-<user>-<team-hash>.vercel.app`
  3. `<project>-<team-hash>.vercel.app`
- Only the deployment-specific hash URL `<project>-<deployment-hash>-<team-hash>.vercel.app` respects SSO protection
- SSO protection on Hobby: max level is `deploymentType: all_except_custom_domains` — trying to set `all` silently nulls it
- Password protection: REQUIRES Pro tier ($20/mo) — API returns `"Advanced Deployment Protection is not enabled on your team"`

**How to apply when deploying sensitive content to Vercel on Hobby:**
1. After `vercel deploy --prod`, IMMEDIATELY:
   - List aliases via `GET /v4/aliases?projectId=<id>&teamId=<id>`
   - DELETE all 3 vanity aliases via `DELETE /v2/aliases/<uid>?teamId=<id>`
   - Keep ONLY the deployment-specific hash URL
2. Verify with curl: vanity URLs should return 404, hash URL should return 401
3. Share only the hash URL — recipients must log in with a Vercel account that's a member of the team
4. For password-walled public URLs: must upgrade to Pro

**Auth tokens are stored at:** `~/Library/Application Support/com.vercel.cli/auth.json`
