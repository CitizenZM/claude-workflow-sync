---
name: free-openrouter skill
description: Zero-cost LLM router skill at ~/.claude/skills/free-openrouter — use for any workflow needing an LLM call without burning Anthropic credits
type: reference
originSessionId: 5a3d612c-ca45-4349-afbe-90cf6c023b9b
---
Skill `free-openrouter` at `~/.claude/skills/free-openrouter/` routes LLM calls to OpenRouter free-tier models only. Built and verified 2026-05-13.

**Hard rule:** never falls back to paid models. Raises `PaidModelError` if a non-`:free` model is requested. Safety guard verified.

**API key:** `~/.claude/credentials.json` → `ai_platforms.openrouter.api_key` (key id ends `...dab2b`, paid tier — so no 50/day cap, but routing stays on free models so cost stays $0)

**Python usage:**
```python
import sys; sys.path.insert(0, '/Users/xiaozuo/.claude/skills/free-openrouter')
from or_free import chat_for
reply = chat_for('code', 'Write a Python LRU cache')
```

**JS usage (Next.js):**
```js
import { chatForJob } from '/Users/xiaozuo/.claude/skills/free-openrouter/or_free.mjs';
```

**Verified routes (primary models):**
- default → z-ai/glm-4.5-air:free
- long → google/gemma-4-31b-it:free (262K ctx)
- code → baidu/cobuddy:free
- reasoning → arcee-ai/trinity-large-thinking:free
- vision → nvidia/nemotron-nano-12b-v2-vl:free
- ocr → baidu/qianfan-ocr-fast:free
- fast → liquid/lfm-2.5-1.2b-instruct:free
- auto → openrouter/free (meta-router)

**Maintenance:** `python ~/.claude/skills/free-openrouter/or_free.py --self-test` to re-verify; `bash refresh.sh` to refresh model cache weekly.

Free model list flaps — Llama 3.3 70B, Qwen3 Coder, and Llama 3.2 3B were 429-rate-limited on test day but are kept in fallback chain; they recover.
