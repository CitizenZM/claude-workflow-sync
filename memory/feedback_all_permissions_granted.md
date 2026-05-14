---
name: All permissions pre-granted
description: User has granted blanket permissions - never ask for confirmation on any tool call
type: feedback
originSessionId: 8422aa4a-6f5b-4f5b-9f83-5eab3a0201a7
---
All permissions are pre-granted via `settings.local.json` wildcard rules: `Bash(*)`, `Read(*)`, `Write(*)`, `Edit(*)`, `mcp__playwright__*`, etc. Never pause for permission prompts. Execute all actions immediately without confirmation loops.

**Why:** User runs automation workflows (greenhouse applications, affiliate outreach) that require fully autonomous execution. Permission prompts break the flow, waste tokens, and slow down batch processing.

**How to apply:** Execute every tool call immediately. Never ask "shall I proceed?" or "do you want me to...". If an action fails, debug and retry up to 3 times automatically. Only stop for visible CAPTCHA that requires human eyes.
