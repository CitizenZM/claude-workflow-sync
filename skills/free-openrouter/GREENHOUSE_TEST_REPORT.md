# Greenhouse-Apply ↔ Free-OpenRouter Integration Test

**Date:** 2026-05-14
**Adapter:** `~/.claude/skills/free-openrouter/adapters/greenhouse_adapter.py`
**Test prompt:** Real greenhouse-apply resume + cover-letter templates with Lattice Director of Growth JD

## Results

| Test | Model | Latency | Output | Status |
|---|---|---:|---|:-:|
| Resume gen (5.4K-token prompt, 8192 max_tokens) | arcee-ai/trinity-large-thinking:free | **17.5s** | 4,984 chars JSON, all 8 keys, 7/5/2 bullets, 5/5 JD keywords | ✅ |
| Cover letter gen (no resume context, 4096 max_tokens) | minimax/minimax-m2.5:free (fallback after Trinity 429) | 162s | 6 paragraphs, opener references "Lattice's people management platform" | ✅ but slow |
| Resume @ max_tokens=4096 | Trinity | 8s | JSON truncated, parse failed | ❌ |
| Resume @ max_tokens=6144 | Trinity | 15.5s | JSON truncated mid-experience | ❌ |
| Resume @ max_tokens=8192 | Trinity | 17.5s | **complete** | ✅ |

## Calibrated production settings

```python
# In greenhouse_adapter.py
generate_resume(jd, company, role,
    job_route='long',          # Trinity Large Thinking primary
    max_tokens=8192,           # full schema needs this
    per_model_timeout=90,      # gives Trinity its 15-20s window
    temperature=0.4)

generate_cover_letter(jd, company, role, key_metrics=...,
    job_route='long',
    max_tokens=4096,
    per_model_timeout=90,
    temperature=0.5)
```

## Cost analysis

| Volume | Sonnet 4.6 cost | Free-OR cost | Savings |
|---:|---:|---:|---:|
| Per job (resume + CL) | $0.074 | $0.00 | $0.074 |
| 5 jobs/day × 30 days | $11.16 | $0 | **$11.16/mo** |
| 20 jobs/day × 30 days | $44.64 | $0 | **$44.64/mo** |
| 50 jobs/day × 30 days | $111.60 | $0 | **$111.60/mo** |

## Throughput ceiling

- **1,000 free reqs/day cap** ÷ 2 reqs/job (resume + CL) = **500 jobs/day max**
- Realistic sustainable rate: **~225 jobs/hour** at 16s avg per call
- Burst rate: ~20 jobs/min if parallelizing 10 workers (stays under 20 RPM per model)

## Circuit breaker validated

Test run confirmed:
1. First Trinity call succeeded for resume (17.5s)
2. Immediately after, Trinity returned 429 on cover-letter call
3. Skill auto-cooldown'd Trinity for 60s
4. Rotation correctly fell to next available model in `long` route
5. Eventually reached MiniMax (slow but reliable), got valid CL output
6. No paid escalation occurred

State file after run:
```json
{"usage": {"arcee-ai/trinity-large-thinking:free": 1, "minimax/minimax-m2.5:free": 1},
 "daily_count": 2}
```

## Recommended integration into greenhouse-apply

Inside the per-job loop in `/greenhouse-apply`:

```python
# Replace native Sonnet call with free-OR adapter
import sys
sys.path.insert(0, '/Users/xiaozuo/.claude/skills/free-openrouter/adapters')
from greenhouse_adapter import generate_resume, generate_cover_letter, GreenhouseAdapterError

try:
    resume = generate_resume(jd_text, company, role_title)
    cover_letter = generate_cover_letter(jd_text, company, role_title,
                                          key_metrics=resume.get('phase1_analysis'))
except GreenhouseAdapterError as e:
    # All free models failed — escalate to native Sonnet for this one job
    log_warning(f'Free-OR failed, falling back to Sonnet: {e}')
    resume, cover_letter = native_sonnet_generate(jd_text, company, role_title)
```

## Caveats / quality notes

- Trinity's reasoning is solid but resume bullets are slightly less "Sonnet-polished" — sentences are correct, metrics are correct, but phrasing is utilitarian. Acceptable for batch volume.
- For "wow factor" applications (FAANG, top-tier startups), keep native Sonnet.
- Cover letter quality on MiniMax is good but slow (162s). If MiniMax becomes the only available model, throughput collapses.
- Recommend: schedule bulk runs early morning UTC when free-tier pools have most capacity.
