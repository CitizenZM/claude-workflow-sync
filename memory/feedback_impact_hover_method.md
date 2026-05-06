---
name: Impact Rockbros — card hover method for Send Proposal button
description: page.mouse.move() doesn't trigger CSS :hover on Impact cards; must use page.locator().hover()
type: feedback
originSessionId: 7e0395c1-85b0-441f-8a0a-ac779f9945f7
---
`page.mouse.move()` via Playwright CDP does NOT trigger CSS `:hover` on Impact.com marketplace cards. The "Send Proposal" button is CSS hover-reveal — it only appears when the card is in `:hover` state. Using `page.mouse.move()` resulted in `getBoundingClientRect()` returning `{w:0, h:0}` even after 800ms wait.

**Fix**: Use `page.locator('.iui-card').nth(idx).hover({ timeout: 5000 })` which correctly triggers the hover state and reveals the button with valid BCR.

**Why:** Playwright's `locator.hover()` uses a different CDP mechanism (pointer events) that properly updates the browser's hover state, unlike raw `Input.dispatchMouseEvent` from `page.mouse.move()`.

**Also**: `partnerStatuses=1` (Active) publishers open a "Send Message" modal, NOT a proposal form. Only `partnerStatuses=2` (New) publishers open the proposal form with partner ID in the URL. Never use `partnerStatuses=1` for outreach automation.
