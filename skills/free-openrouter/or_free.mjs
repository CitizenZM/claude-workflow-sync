// free-openrouter JS port. ESM. Mirrors or_free.py routing exactly.
// Usage:
//   import { chatForJob, chat } from '/Users/xiaozuo/.claude/skills/free-openrouter/or_free.mjs';
//   const reply = await chatForJob('code', 'Write a Python LRU cache');
//
// HARD RULE: only :free models. Throws if a paid model is passed.

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CREDENTIALS = join(homedir(), '.claude', 'credentials.json');
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export const JOBS = {
  default: [
    'z-ai/glm-4.5-air:free',
    'google/gemma-4-31b-it:free',
    'openrouter/free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'qwen/qwen3-next-80b-a3b-instruct:free',
  ],
  long: [
    'google/gemma-4-31b-it:free',
    'arcee-ai/trinity-large-thinking:free',
    'minimax/minimax-m2.5:free',
    'inclusionai/ring-2.6-1t:free',
    'qwen/qwen3-next-80b-a3b-instruct:free',
  ],
  code: [
    'baidu/cobuddy:free',
    'poolside/laguna-m.1:free',
    'poolside/laguna-xs.2:free',
    'openai/gpt-oss-120b:free',
    'qwen/qwen3-coder:free',
  ],
  reasoning: [
    'arcee-ai/trinity-large-thinking:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'openai/gpt-oss-120b:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    'liquid/lfm-2.5-1.2b-thinking:free',
  ],
  vision: [
    'nvidia/nemotron-nano-12b-v2-vl:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  ],
  ocr: [
    'baidu/qianfan-ocr-fast:free',
    'nvidia/nemotron-nano-12b-v2-vl:free',
  ],
  fast: [
    'liquid/lfm-2.5-1.2b-instruct:free',
    'nvidia/nemotron-nano-9b-v2:free',
    'nvidia/nemotron-3-nano-30b-a3b:free',
    'meta-llama/llama-3.2-3b-instruct:free',
  ],
  uncensored: ['cognitivecomputations/dolphin-mistral-24b-venice-edition:free'],
  auto: ['openrouter/free', 'z-ai/glm-4.5-air:free'],
};

const isFree = (m) => m.endsWith(':free') || m === 'openrouter/free';

async function apiKey() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  const raw = await readFile(CREDENTIALS, 'utf8');
  const c = JSON.parse(raw);
  const k = c?.ai_platforms?.openrouter?.api_key;
  if (!k) throw new Error('No openrouter api_key in credentials.json');
  return k;
}

export async function call({ model, messages, max_tokens = 1024, temperature = 0.7, ...rest }) {
  if (!isFree(model)) throw new Error(`Refusing paid model: ${model}`);
  const key = await apiKey();
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/celldigital',
      'X-Title': 'free-openrouter-skill',
    },
    body: JSON.stringify({ model, messages, max_tokens, temperature, ...rest }),
  });
  if (!res.ok) {
    const err = new Error(`OpenRouter HTTP ${res.status}: ${await res.text()}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function chat(model, prompt, opts = {}) {
  const messages = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: prompt });
  const r = await call({ model, messages, ...opts });
  return r?.choices?.[0]?.message?.content ?? '';
}

export async function chatForJob(job, prompt, opts = {}) {
  if (!JOBS[job]) throw new Error(`Unknown job ${job}. Valid: ${Object.keys(JOBS).join(', ')}`);
  let lastErr;
  for (const model of JOBS[job]) {
    try {
      return await chat(model, prompt, opts);
    } catch (e) {
      lastErr = e;
      if (e.status && (e.status === 402 || e.status === 429 || e.status >= 500)) continue;
      // 400/401/404 — likely model dropped, try next
      continue;
    }
  }
  throw new Error(`All free fallbacks for "${job}" failed. Last: ${lastErr?.message}`);
}
