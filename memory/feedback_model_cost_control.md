---
name: Model Cost Control
description: Always use cheapest model (Haiku) for bulk automation workflows like Awin outreach; remind user to switch if on Opus/Sonnet for mechanical tasks
type: feedback
originSessionId: b769636c-2e7c-43a0-b256-e727de98626a
---
Bulk automation workflows (Awin outreach, Impact outreach, Greenhouse apply loops) MUST run on the cheapest model (Haiku). These are mechanical DOM-scripting tasks with no reasoning required.

**Why:** User flagged unnecessary Opus usage during bulk invite loop — wasting credits on work that Haiku handles identically.

**How to apply:** 
- At the start of any outreach/automation skill, check current model and remind user to switch to Haiku if on Opus/Sonnet
- If the skill spec says "(Haiku)", explicitly tell the user to switch before starting the loop
- Only use Sonnet for setup phases that require login debugging; only use Opus for planning/strategy
