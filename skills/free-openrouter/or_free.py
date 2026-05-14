"""
free-openrouter helper — zero-cost LLM router.

HARD RULE: Never calls a paid model. If all free routes fail, raises PaidModelError
or RateLimitedError. Does not silently fall back to anything that costs money.

Usage:
    from or_free import chat, chat_for, call

    reply = chat_for('code', 'Write a Python function...')
    reply = chat('meta-llama/llama-3.3-70b-instruct:free', 'Hello')
    resp = call(model='qwen/qwen3-coder:free',
                messages=[{'role':'user','content':'...'}],
                max_tokens=2000)
"""
import json
import os
import random
import time
import urllib.request
import urllib.error
from pathlib import Path

CREDENTIALS = Path.home() / '.claude' / 'credentials.json'
STATE_FILE = Path.home() / '.claude' / 'skills' / 'free-openrouter' / 'state.json'
ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
AUTH_CHECK = 'https://openrouter.ai/api/v1/auth/key'
CREDITS_URL = 'https://openrouter.ai/api/v1/credits'
MODELS_URL = 'https://openrouter.ai/api/v1/models'

# Per-key OpenRouter free-tier limits (verified 2026-05-13 from official docs):
#   20 req/minute per free model
#   1,000 req/day total across all :free models (if ≥$10 lifetime credit purchased)
#      50 req/day if <$10 purchased
# Negative balance → 402 even on free models, so we guard before sending.

FREE_MODEL_RPM = 20                 # per model, per OpenRouter docs
DAILY_CAP_WITH_CREDIT = 1000        # ≥$10 lifetime
DAILY_CAP_WITHOUT_CREDIT = 50
COOLDOWN_429_SECONDS = 60           # skip a model for 60s after 429
COOLDOWN_5XX_SECONDS = 30
MIN_BALANCE_USD = 0.01              # below this → don't send (avoid 402)

# Job → ordered list of free model fallbacks. First one is primary.
# All entries MUST be free (suffix :free or openrouter/free meta-router).
# Order: verified-working primaries first (tested 2026-05-13), then known-good
# fallbacks. Models that returned 429 on the test day are kept as later
# fallbacks because they're often available — provider rate limits flap.
JOBS = {
    'default': [
        'z-ai/glm-4.5-air:free',                          # tested OK, 1.3s
        'google/gemma-4-31b-it:free',                     # tested OK, 0.9s
        'openrouter/free',                                # auto-router
        'meta-llama/llama-3.3-70b-instruct:free',         # fallback (429-prone)
        'qwen/qwen3-next-80b-a3b-instruct:free',          # fallback (429-prone)
    ],
    'long': [
        'arcee-ai/trinity-large-thinking:free',           # ★ 8s on full greenhouse prompt, 262K ctx
        'google/gemma-4-31b-it:free',                     # 0.9s ping but 429-prone, 262K ctx
        'qwen/qwen3-next-80b-a3b-instruct:free',          # 262K ctx, 429-prone
        # demoted — measured slow/hung on long greenhouse prompts:
        'inclusionai/ring-2.6-1t:free',                   # hung >60s on 5K-token prompt
        'minimax/minimax-m2.5:free',                      # 208s baseline, only as last resort
    ],
    'code': [
        'baidu/cobuddy:free',                             # tested OK, 4.5s
        'poolside/laguna-m.1:free',                       # tested OK, 1.2s
        'poolside/laguna-xs.2:free',                      # tested OK, 0.4s
        'openai/gpt-oss-120b:free',                       # tested OK, 21s
        'qwen/qwen3-coder:free',                          # fallback (429-prone)
    ],
    'reasoning': [
        'arcee-ai/trinity-large-thinking:free',           # tested OK, thinking
        'nvidia/nemotron-3-super-120b-a12b:free',         # tested OK, 0.7s
        'openai/gpt-oss-120b:free',                       # tested OK, 21s
        'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',  # tested OK, 21s
        'liquid/lfm-2.5-1.2b-thinking:free',              # tested OK, fast
    ],
    'vision': [
        'nvidia/nemotron-nano-12b-v2-vl:free',            # tested OK, 0.5s
        'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',  # tested OK
    ],
    'ocr': [
        'baidu/qianfan-ocr-fast:free',                    # tested OK, 1.2s
        'nvidia/nemotron-nano-12b-v2-vl:free',            # tested OK, 0.5s
    ],
    'fast': [
        'liquid/lfm-2.5-1.2b-instruct:free',              # tested OK, 0.6s
        'nvidia/nemotron-nano-9b-v2:free',                # tested OK, 1.0s
        'nvidia/nemotron-3-nano-30b-a3b:free',            # tested OK, 0.5s
        'meta-llama/llama-3.2-3b-instruct:free',          # fallback (429-prone)
    ],
    'uncensored': [
        'cognitivecomputations/dolphin-mistral-24b-venice-edition:free',  # 429-prone, only option
    ],
    'auto': [
        'openrouter/free',                                # OpenRouter picks best free
        'z-ai/glm-4.5-air:free',
    ],
}

# Flat allowlist for the safety guard
ALLOWED = {m for lst in JOBS.values() for m in lst}


class PaidModelError(Exception):
    """Raised when a non-free model is requested."""


class RateLimitedError(Exception):
    """Raised when all free models in the route are exhausted (429/quota)."""


class OpenRouterError(Exception):
    """Generic API failure across all fallbacks."""


def _is_free(model_id: str) -> bool:
    """A model is considered free if its ID ends in ':free' OR it's the meta router."""
    return model_id.endswith(':free') or model_id == 'openrouter/free'


def _api_key() -> str:
    key = os.environ.get('OPENROUTER_API_KEY')
    if key:
        return key
    if not CREDENTIALS.exists():
        raise OpenRouterError(f'No credentials at {CREDENTIALS}')
    data = json.loads(CREDENTIALS.read_text())
    key = data.get('ai_platforms', {}).get('openrouter', {}).get('api_key')
    if not key:
        raise OpenRouterError('No api_key in credentials.json → ai_platforms.openrouter')
    return key


def _post(payload: dict, timeout: int = 60) -> dict:
    key = _api_key()
    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(payload).encode(),
        headers={
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/celldigital',
            'X-Title': 'free-openrouter-skill',
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def call(model: str, messages: list, max_tokens: int = 1024, temperature: float = 0.7,
         timeout: int = 60, **kwargs) -> dict:
    """Raw call with safety guard. Returns the full response dict."""
    if not _is_free(model):
        raise PaidModelError(f'Refusing paid model: {model}. Only :free or openrouter/free allowed.')
    payload = {
        'model': model,
        'messages': messages,
        'max_tokens': max_tokens,
        'temperature': temperature,
        **kwargs,
    }
    return _post(payload, timeout=timeout)


def chat(model: str, prompt: str, system: str = None, **kwargs) -> str:
    """Single-turn chat. Returns the response text."""
    messages = []
    if system:
        messages.append({'role': 'system', 'content': system})
    messages.append({'role': 'user', 'content': prompt})
    resp = call(model=model, messages=messages, **kwargs)
    return (resp.get('choices') or [{}])[0].get('message', {}).get('content', '') or ''


# -----------------------------------------------------------------------------
# Persistent state: cooldowns + per-model usage counters.
# Lives in state.json next to this file. Survives across processes.
# -----------------------------------------------------------------------------

def _load_state() -> dict:
    if not STATE_FILE.exists():
        return {'cooldowns': {}, 'usage': {}, 'day': '', 'daily_count': 0}
    try:
        return json.loads(STATE_FILE.read_text())
    except Exception:
        return {'cooldowns': {}, 'usage': {}, 'day': '', 'daily_count': 0}


def _save_state(state: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2))


def _today() -> str:
    return time.strftime('%Y-%m-%d', time.gmtime())


def _bump_usage(model: str, state: dict) -> None:
    if state.get('day') != _today():
        state['day'] = _today()
        state['daily_count'] = 0
        state['usage'] = {}
    state['daily_count'] = state.get('daily_count', 0) + 1
    state['usage'][model] = state['usage'].get(model, 0) + 1


def _cooldown_model(model: str, state: dict, seconds: int) -> None:
    state.setdefault('cooldowns', {})[model] = time.time() + seconds


def _is_cooling(model: str, state: dict) -> bool:
    return time.time() < state.get('cooldowns', {}).get(model, 0)


def _available_models(job: str, state: dict) -> list:
    """Models not currently in cooldown. Returns [] if all are cooling."""
    return [m for m in JOBS[job] if not _is_cooling(m, state)]


def _rotation_order(job: str, state: dict) -> list:
    """
    Round-robin within a job: least-recently-used model first.
    Always tries non-cooling models first; falls back to least-cooling if all are
    in cooldown.
    """
    candidates = _available_models(job, state) or list(JOBS[job])
    # Sort by usage count ascending (less-used first) — spreads daily budget
    # evenly across all working models, maximizing the 20-RPM-per-model ceiling.
    usage = state.get('usage', {})
    return sorted(candidates, key=lambda m: usage.get(m, 0))


def _balance_ok() -> tuple[bool, float]:
    """Check we have positive credit balance — required even for :free models."""
    try:
        key = _api_key()
        req = urllib.request.Request(CREDITS_URL, headers={'Authorization': f'Bearer {key}'})
        with urllib.request.urlopen(req, timeout=5) as r:
            data = json.loads(r.read())['data']
        remaining = float(data['total_credits']) - float(data['total_usage'])
        return remaining > MIN_BALANCE_USD, remaining
    except Exception:
        return True, 0.0  # don't block on a transient API failure


# -----------------------------------------------------------------------------
# Routing
# -----------------------------------------------------------------------------

def chat_for(job: str, prompt: str, system: str = None, image_url: str = None,
             max_retries_per_model: int = 1, check_balance: bool = False,
             per_model_timeout: int = 45, **kwargs) -> str:
    """
    Route to the best free model for a job using LRU rotation + circuit breaker.

    - Spreads load across all working models in the job (least-used first), so
      we don't burn through a single model's 20-RPM budget while others sit idle.
    - On 429: puts model in 60s cooldown, tries next.
    - On 5xx: 30s cooldown.
    - On 402 (negative balance): bails immediately — no point retrying.
    - Tracks per-model + daily usage in state.json.

    Raises RateLimitedError when every model in the job is cooling.
    """
    if job not in JOBS:
        raise ValueError(f'Unknown job "{job}". Valid: {sorted(JOBS)}')

    if check_balance:
        ok, remaining = _balance_ok()
        if not ok:
            raise OpenRouterError(
                f'Balance ${remaining:.4f} below threshold. Free models return 402 '
                f'when balance is negative. Top up at https://openrouter.ai/credits.')

    user_content = prompt
    if image_url:
        user_content = [
            {'type': 'text', 'text': prompt},
            {'type': 'image_url', 'image_url': {'url': image_url}},
        ]
    messages = []
    if system:
        messages.append({'role': 'system', 'content': system})
    messages.append({'role': 'user', 'content': user_content})

    state = _load_state()
    last_err = None
    tried = []
    # Force-pass timeout per call so slow models (MiniMax = 208s) don't block
    # the whole rotation. 45s default is enough for 4K-token replies on the
    # fast models, fails fast on the slow ones.
    kwargs.setdefault('timeout', per_model_timeout)
    for model in _rotation_order(job, state):
        tried.append(model)
        for attempt in range(max_retries_per_model):
            try:
                resp = call(model=model, messages=messages, **kwargs)
                _bump_usage(model, state)
                _save_state(state)
                return (resp.get('choices') or [{}])[0].get('message', {}).get('content', '') or ''
            except urllib.error.HTTPError as e:
                code = e.code
                last_err = f'{model}: HTTP {code}'
                if code == 402:
                    _save_state(state)
                    raise OpenRouterError(
                        '402 — likely negative balance. Free models require '
                        'positive credit balance. Top up at https://openrouter.ai/credits.')
                if code == 429:
                    _cooldown_model(model, state, COOLDOWN_429_SECONDS)
                    break
                if 500 <= code < 600:
                    _cooldown_model(model, state, COOLDOWN_5XX_SECONDS)
                    time.sleep(0.5 * (attempt + 1))
                    break
                break  # 4xx other than 429/402 — model broken, skip
            except urllib.error.URLError as e:
                last_err = f'{model}: {e}'
                _cooldown_model(model, state, COOLDOWN_5XX_SECONDS)
                break
            except (TimeoutError, OSError) as e:
                # socket timeout from slow-to-respond models — cool them harder
                last_err = f'{model}: timeout/{type(e).__name__} after {per_model_timeout}s'
                _cooldown_model(model, state, COOLDOWN_5XX_SECONDS * 2)
                break
    _save_state(state)
    raise RateLimitedError(
        f'All free fallbacks for job "{job}" failed or cooling. '
        f'Tried {len(tried)} models. Last: {last_err}')


def auth_check() -> dict:
    """Verify the API key. Returns the auth/key payload."""
    key = _api_key()
    req = urllib.request.Request(AUTH_CHECK, headers={'Authorization': f'Bearer {key}'})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def list_free_models(refresh: bool = False) -> list:
    """Query OpenRouter and return only zero-cost models. Source of truth."""
    cache = Path(__file__).parent / 'free-models.json'
    if cache.exists() and not refresh:
        return json.loads(cache.read_text())
    with urllib.request.urlopen(MODELS_URL, timeout=30) as r:
        data = json.loads(r.read())
    free = []
    for m in data.get('data', []):
        p = m.get('pricing') or {}
        try:
            if float(p.get('prompt', '1')) == 0 and float(p.get('completion', '1')) == 0:
                free.append(m)
        except (TypeError, ValueError):
            pass
    cache.write_text(json.dumps(free, indent=2))
    return free


def self_test() -> int:
    """Ping the primary model in every job category. Returns exit code."""
    print('Auth check...')
    try:
        info = auth_check()
        print(f'  Key OK: {info["data"]["label"]} (free_tier={info["data"]["is_free_tier"]})')
    except Exception as e:
        print(f'  AUTH FAILED: {e}')
        return 1

    print('\nRoute pings:')
    fails = []
    for job, models in JOBS.items():
        primary = models[0]
        try:
            # Use 256 tokens so thinking-tagged models (GLM, Trinity, etc.) have
            # budget to emit visible content after their <think> block.
            reply = chat(primary, 'Reply with just the word: pong',
                         max_tokens=256, temperature=0)
            ok = 'pong' in reply.lower()
            mark = 'OK' if ok else 'WEIRD'
            print(f'  [{mark:>5}] {job:<11} → {primary:<55} | {reply.strip()[:40]!r}')
            if not ok:
                fails.append((job, primary, 'empty reply'))
        except Exception as e:
            print(f'  [ FAIL] {job:<11} → {primary:<55} | {type(e).__name__}: {str(e)[:60]}')
            fails.append((job, primary, str(e)[:80]))
        time.sleep(0.4)

    if fails:
        print(f'\n{len(fails)} route(s) failed:')
        for j, m, err in fails:
            print(f'  - {j}: {m} → {err}')
        return 1
    print('\nALL ROUTES OK')
    return 0


def stats() -> dict:
    """Local skill stats: daily count, per-model usage, active cooldowns."""
    state = _load_state()
    now = time.time()
    cooling = {m: int(t - now) for m, t in state.get('cooldowns', {}).items() if t > now}
    return {
        'day': state.get('day', _today()),
        'daily_count': state.get('daily_count', 0),
        'daily_cap': DAILY_CAP_WITH_CREDIT,  # assume credited (verify with --usage)
        'remaining_today': max(0, DAILY_CAP_WITH_CREDIT - state.get('daily_count', 0)),
        'usage_by_model': state.get('usage', {}),
        'cooling_now': cooling,
        'total_models': sum(len(v) for v in JOBS.values()),
        'unique_models': len({m for lst in JOBS.values() for m in lst}),
    }


if __name__ == '__main__':
    import sys
    if '--self-test' in sys.argv:
        sys.exit(self_test())
    elif '--usage' in sys.argv:
        info = auth_check()['data']
        ok, balance = _balance_ok()
        print(json.dumps({
            'api_usage_total': info['usage'],
            'api_usage_daily': info['usage_daily'],
            'api_usage_weekly': info['usage_weekly'],
            'is_free_tier': info['is_free_tier'],
            'limit_remaining': info['limit_remaining'],
            'balance_usd': round(balance, 4),
            'balance_ok': ok,
        }, indent=2))
    elif '--stats' in sys.argv:
        print(json.dumps(stats(), indent=2))
    elif '--reset' in sys.argv:
        if STATE_FILE.exists(): STATE_FILE.unlink()
        print('State reset.')
    elif '--refresh' in sys.argv:
        free = list_free_models(refresh=True)
        print(f'Refreshed: {len(free)} free models')
    elif '--list' in sys.argv:
        for m in list_free_models():
            print(f"{m['id']:<60} ctx={m.get('context_length',0):>10,}  {m.get('name','')[:40]}")
    else:
        print(__doc__)
        print('\nFlags: --self-test, --usage, --stats, --reset, --refresh, --list')
