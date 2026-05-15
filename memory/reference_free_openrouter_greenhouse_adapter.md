---
name: free-openrouter greenhouse adapter
description: Drop-in free-tier LLM adapter for greenhouse-apply skill — saves $0.06/job vs Sonnet, 500 jobs/day ceiling, ~8s latency on Trinity Large Thinking
type: reference
originSessionId: 5a3d612c-ca45-4349-afbe-90cf6c023b9b
---
Adapter at `~/.claude/skills/free-openrouter/adapters/greenhouse_adapter.py` replaces the Sonnet-driven resume + cover-letter generation in `greenhouse-apply` with free OpenRouter models.

**Verified 2026-05-14:**
- Trinity Large Thinking (262K ctx) produced valid JSON matching the schema in ~8s
- GLM-4.5-Air took 163s due to thinking mode; not viable for batches → use `job_route='long'`, not `'default'`
- Output had JD keywords embedded ("PLG", "Braze", "BigQuery", "player-coach") and real metrics from the experience bank ($180M ARR, 25% Day-7 retention, etc.)

**Usage from greenhouse-apply orchestrator:**
```python
import sys
sys.path.insert(0, '/Users/xiaozuo/.claude/skills/free-openrouter/adapters')
from greenhouse_adapter import generate_resume, generate_cover_letter, GreenhouseAdapterError
```

**Economics:**
- Sonnet 4.6 cost per job (resume + CL): ~$0.06 (5.4K in + 1.4K out, 2 calls)
- free-OR cost: $0.00
- Savings: $1.80/mo @ 5/day, $36/mo @ 20/day
- Daily ceiling: 500 jobs/day (1,000 free req cap ÷ 2/job)

**When to use it:** bulk runs >5 jobs. Quality is close enough; Sonnet still wins on edge cases so keep it as fallback in the orchestrator (`try greenhouse_adapter except GreenhouseAdapterError → native Sonnet`).

**Python 3.9 quirk:** adapter uses `from __future__ import annotations` + `Optional[dict]` (not `dict | None`) because system Python is 3.9.
