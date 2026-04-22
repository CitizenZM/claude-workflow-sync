---
name: Model selection for outreach workflows
description: User prefers Haiku for bulk/loop steps to save tokens; Sonnet for setup/login
type: feedback
originSessionId: 9150d0bf-bae7-4f1f-b621-04481e6cad25
---
Switch to Haiku model for bulk invite loops and repetitive outreach steps to save tokens. Use Sonnet only for setup, login, and reasoning-heavy tasks.

**Why:** User explicitly asked to switch to Haiku when appropriate to conserve token usage.

**How to apply:** In outreach workflows, setup skills (login, filter config) run on Sonnet; bulk invite loop skills run on Haiku. Remind user to run `/model haiku` before running the `-outreach` loop skills.
