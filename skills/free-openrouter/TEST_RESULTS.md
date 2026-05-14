# OpenRouter Free Model — Verified Test Results

**Date:** 2026-05-13
**Key:** sk-or-v1-...dab2b (stored in `~/.claude/credentials.json`)
**Test:** Single ping "Reply with exactly: pong" max_tokens=20
**Pass rate:** 19/29 (66%)

## Working (use these as primaries)

| Model | Latency | Notes |
|---|---:|---|
| `z-ai/glm-4.5-air:free` | 1.3s | ✅ default pick — fast and reliable |
| `google/gemma-4-31b-it:free` | 0.9s | ✅ fastest reliable, 262K ctx |
| `nvidia/nemotron-nano-12b-v2-vl:free` | 0.5s | ✅ vision primary |
| `baidu/qianfan-ocr-fast:free` | 1.2s | ✅ OCR primary |
| `nvidia/nemotron-3-super-120b-a12b:free` | 0.7s | ✅ reasoning primary |
| `nvidia/nemotron-3-nano-30b-a3b:free` | 0.5s | ✅ |
| `nvidia/nemotron-nano-9b-v2:free` | 1.0s | ✅ |
| `arcee-ai/trinity-large-thinking:free` | 1.7s | ✅ thinking, 262K ctx |
| `inclusionai/ring-2.6-1t:free` | 1.3s | ✅ 1T params, 262K ctx |
| `liquid/lfm-2.5-1.2b-instruct:free` | 0.6s | ✅ fast primary |
| `liquid/lfm-2.5-1.2b-thinking:free` | 0.7s | ✅ |
| `poolside/laguna-xs.2:free` | 0.4s | ✅ FASTEST overall |
| `poolside/laguna-m.1:free` | 1.2s | ✅ |
| `baidu/cobuddy:free` | 4.5s | ✅ code primary |
| `openrouter/free` | 0.9s | ✅ meta-router |
| `openai/gpt-oss-120b:free` | 21s | ✅ slow but works |
| `openai/gpt-oss-20b:free` | 16s | ✅ slow |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | 21s | ✅ slow |
| `minimax/minimax-m2.5:free` | 208s | ⚠️ extremely slow — don't use for latency-sensitive |

## 429 / rate-limited at test time (kept as later fallbacks)

These returned `429 — Provider returned error` on the test day. They DO work in general; their upstream pool was just exhausted during our test. Fine as fallbacks.

| Model | Reason |
|---|---|
| `meta-llama/llama-3.3-70b-instruct:free` | 429 — popular, often rate-limited |
| `meta-llama/llama-3.2-3b-instruct:free` | 429 |
| `qwen/qwen3-next-80b-a3b-instruct:free` | 429 |
| `qwen/qwen3-coder:free` | 429 |
| `google/gemma-4-26b-a4b-it:free` | 429 |
| `nousresearch/hermes-3-llama-3.1-405b:free` | 429 |
| `cognitivecomputations/dolphin-mistral-24b-venice-edition:free` | 429 |

## Hard failures (probably broken / preview models)

| Model | Status | Notes |
|---|---|---|
| `openrouter/owl-alpha` | 429 | Preview model, gated |
| `google/lyria-3-pro-preview` | 502 | Music model — not chat |
| `google/lyria-3-clip-preview` | 502 | Music model — not chat |

## Re-run

```bash
python3 ~/.claude/skills/free-openrouter/or_free.py --self-test
```
