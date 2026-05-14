# Daily Token + Workload Budget — `free-openrouter` Skill

**Verified against OpenRouter docs + your live account state (2026-05-13).**

---

## 1. Hard limits (from OpenRouter docs, not estimates)

| Limit | Value | Scope | Source |
|---|---|---|---|
| Per-model RPM | **20 requests/minute** | Per `:free` model | docs/limits |
| Daily account cap (≥$10 lifetime credit) | **1,000 requests/day** | All `:free` models combined | docs/limits |
| Daily account cap (<$10 lifetime credit) | 50 requests/day | All `:free` combined | docs/limits |
| Negative balance | Returns `402` even on free models | Per account | docs/limits |
| Cloudflare DDoS | Blocks egregious bursts | Per IP | docs/limits |

**Your state today** (`curl /credits` confirmed):
- `total_credits = $20`
- `total_usage = $10.62`
- `balance = $9.38` ✅ above zero
- `is_free_tier = false` → **1,000/day cap is active**

---

## 2. Daily request budget — three scenarios

The 1,000/day cap is the binding constraint. Per-model RPM matters only for *bursts*.

### Scenario A — Conservative steady state (recommended)

| Use | Allocation |
|---|---|
| Daily total requests | **1,000** (the cap) |
| Pacing | ~42 req/hour, evenly spread |
| Burst capacity | Up to 20 RPM per model × 23 unique models = **theoretical 460 RPM** combined, but daily cap hits first |
| Headroom | 0 — this maxes the account |

### Scenario B — Production-realistic (90% of cap)

| Use | Allocation |
|---|---|
| Daily target | **900 requests** |
| Reserve for retries | 100 requests for fallback storms |
| Pacing | ~37 req/hour |
| Recommendation | This is the sweet spot for unattended workflows |

### Scenario C — Burst mode (data backfill, one-time enrichment)

| Use | Allocation |
|---|---|
| Burst rate | **300 RPM** (15 models × 20 RPM, leaving headroom) |
| Burst duration | ~3.3 minutes before hitting 1,000/day cap |
| Best for | One-time CSV/JSON enrichment jobs, not continuous workloads |

---

## 3. Token budget per request

OpenRouter `:free` models have no token cost on your bill, but **context length is the real ceiling**.

| Job route | Primary model | Max context | Realistic prompt + output |
|---|---|---:|---:|
| `default` | z-ai/glm-4.5-air:free | 131K | ~120K prompt + 8K output |
| `long` | google/gemma-4-31b-it:free | **262K** | ~250K prompt + 8K output |
| `code` | baidu/cobuddy:free | 131K | ~120K prompt + 8K output |
| `reasoning` | arcee/trinity-large-thinking:free | **262K** | thinking eats 4-16K, plan for 240K usable |
| `vision` | nvidia/nemotron-nano-12b-v2-vl:free | 128K | ~120K + image tokens |
| `fast` | liquid/lfm-2.5-1.2b-instruct:free | 32K | ~28K prompt + 4K output |

### Daily token throughput estimate

Assuming **average 4K input + 1K output = 5K tokens/req**:

| Daily req | Daily tokens (in+out) | Daily output-only |
|---:|---:|---:|
| 900 | **4.5M tokens** | 900K tokens |
| 1,000 | 5.0M tokens | 1.0M tokens |

If you maxed every request at long-context (50K prompts + 4K output = 54K tokens/req):

| Daily req | Daily tokens |
|---:|---:|
| 900 | **48.6M tokens** |
| 1,000 | 54M tokens |

For comparison: Claude Sonnet 4.6 at $3/M input + $15/M output → 4.5M tokens ≈ **$14–25/day saved** for the same work shifted to free-openrouter.

---

## 4. Workload examples (concrete)

| Workflow | Reqs/run | Tokens/run | Runs/day on this skill | Notes |
|---|---:|---:|---:|---|
| **Affiliate enrichment** (publisher classification, 1-shot) | 1 | ~2K | 1,000 publishers/day | Use `fast` route, parallelize at 10 concurrent |
| **Email triage** (subject + first 500 chars → tier) | 1 | ~1K | 1,000 emails/day | Use `fast` |
| **Outreach personalization** (publisher site → 3-sentence hook) | 1-2 | ~3K | 500-800/day | Use `default` |
| **Long-doc summarization** (10-page PDF) | 1 | ~40K | 900/day | Use `long` route, Gemma 4 31B |
| **Code review on 1 PR file** | 1-3 | ~10K | 300-900/day | Use `code` route |
| **Image OCR + classify** | 1 | image + 2K | 900/day | Use `ocr` then `default` |
| **GMV report draft** (10 sections × 3 paragraphs) | 30 | ~30K | 30 reports/day | Use `default`, parallelize per section |

**Sustainable parallelism:** 10-15 concurrent requests is safe (stays under 300 RPM combined burst, lets each model breathe between hits to avoid the 20-RPM trip).

---

## 5. How the skill optimizes against these limits

| Constraint | Mechanism in `or_free.py` | Effect |
|---|---|---|
| **20 RPM per model** | `_rotation_order()` — sorts by usage count, least-used first | Spreads requests across all 23 unique models so no single one trips its RPM limit |
| **1,000/day cap** | `--stats` shows daily count; `state.json` persists across processes | You can see remaining headroom before launching a bulk job |
| **429 rate limit** | Circuit breaker: 60s cooldown on the model that 429'd | Skips it for 1 min; other 22 models still serve |
| **5xx provider failure** | 30s cooldown | Provider pool recovers; we re-route |
| **402 negative balance** | `check_balance=True` arg + `--usage` flag | Pre-flight check prevents hitting the wall mid-job |
| **Single-model breakdown** | `_available_models()` filters out cooling models | If 3 models are dead, the other 20 take over silently |
| **Daily-cap exhaustion** | None yet — see "Future hardening" | When you hit 1,000/day, the skill will start returning RateLimitedError |

---

## 6. Tuning knobs

In `or_free.py` top-level constants:

```python
FREE_MODEL_RPM = 20                 # docs: don't change
DAILY_CAP_WITH_CREDIT = 1000        # docs: don't change unless you drop below $10
COOLDOWN_429_SECONDS = 60           # tune lower (15s) for impatient workflows
COOLDOWN_5XX_SECONDS = 30           # tune lower (10s) if you trust providers
MIN_BALANCE_USD = 0.01              # raise to $0.50 for early warning
```

For burst workflows, also tune `chat_for(..., max_retries_per_model=2)` — currently 1.

---

## 7. Operational playbook

**Before launching any bulk job:**
```bash
python3 ~/.claude/skills/free-openrouter/or_free.py --usage
python3 ~/.claude/skills/free-openrouter/or_free.py --stats
```

Check `balance_ok: true` and `remaining_today` ≥ your job size + 10% buffer.

**Mid-run health check (run in another shell):**
```bash
python3 ~/.claude/skills/free-openrouter/or_free.py --stats
# Shows: daily_count, usage_by_model (rotation distribution), cooling_now
```

**End-of-day reset (not required, day rolls automatically on UTC):**
```bash
python3 ~/.claude/skills/free-openrouter/or_free.py --reset
```

**If you hit 402:**
```bash
# Top up at https://openrouter.ai/credits — even $5 keeps balance positive
# The 1,000/day cap stays as long as lifetime purchases are ≥$10
```

---

## 8. What this skill will NOT do

- **Cap-busting:** at 1,000/day you're done; pay-per-token kicks in if you want more, which violates this skill's "free only" contract
- **Auto-purchase credits:** never bills your card; you must top up manually if balance goes negative
- **Switch to paid models on 429:** raises `RateLimitedError` instead of escalating cost (verified via safety guard test)
- **Parallel orchestration:** the helper is sync; for parallelism, drive it from `concurrent.futures.ThreadPoolExecutor(max_workers=10)`

---

## 9. Future hardening (not built yet)

If you start regularly hitting limits:

1. **Daily cap pre-flight:** refuse to send when `daily_count ≥ 1000` instead of letting it 429
2. **RPM token bucket per model:** track timestamps of last 20 calls per model, sleep if 20 within last 60s
3. **Multi-key rotation:** add 2-3 OpenRouter keys under different emails → 3× daily cap (each needs its own $10 deposit, so $30 unlocks 3,000/day)
4. **Persistent metrics → CSV:** log every request to `~/.claude/skills/free-openrouter/usage.csv` for weekly analysis

Ask for any of these and I'll add them.
