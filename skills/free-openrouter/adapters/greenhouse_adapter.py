"""
greenhouse-apply ↔ free-openrouter adapter.

Drop-in replacement for Claude/Sonnet calls inside greenhouse-apply.
Loads the resume + cover-letter prompts from the skill's templates dir,
substitutes JD+company+role+experience-bank, drives them through free
OpenRouter models, parses + validates JSON, and returns a structured dict.

Usage:
    from greenhouse_adapter import generate_resume, generate_cover_letter

    resume = generate_resume(jd_text='...', company='Lattice',
                             role_title='Director of Growth')
    cl = generate_cover_letter(jd_text='...', company='Lattice',
                               role_title='Director of Growth',
                               key_metrics=resume.get('phase1_analysis'))

Both functions:
- Use job='long' route (Gemma 4 31B @ 262K ctx) — needed for full prompt+bank
- Auto-fall through model fallback chain on 429/5xx
- Return parsed JSON dict; raise GreenhouseAdapterError on bad output
"""
from __future__ import annotations
import json
import re
import sys
from pathlib import Path
from typing import Optional

# Inline the free-openrouter package
SKILL_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SKILL_DIR))
from or_free import chat_for, RateLimitedError, OpenRouterError, PaidModelError  # noqa: E402

GREENHOUSE_SKILL_DIR = Path.home() / '.claude' / 'skills' / 'greenhouse-apply'
TEMPLATES_DIR = GREENHOUSE_SKILL_DIR / 'templates'
EXP_BANK_PATH = GREENHOUSE_SKILL_DIR / 'data' / 'barron-experience-bank.md'

JSON_SYSTEM = (
    "You output ONLY valid JSON matching the schema in the user prompt. "
    "No prose, no commentary, no markdown code fences. "
    "Start with { and end with }. Nothing else."
)


class GreenhouseAdapterError(Exception):
    """Raised when the LLM returns unusable output after all fallbacks."""


def _extract_json(reply: str) -> dict:
    """Tolerant JSON extraction: strip code fences, find first {...}."""
    s = reply.strip()
    if s.startswith('```'):
        # ```json ... ``` or ``` ... ```
        s = s.split('```', 2)[1]
        if s.startswith('json'):
            s = s[4:]
        s = s.rsplit('```', 1)[0].strip()
    # Find the outermost JSON object
    start = s.find('{')
    if start == -1:
        raise GreenhouseAdapterError(f'No JSON object found in reply: {reply[:200]!r}')
    # Walk to matching brace
    depth = 0
    end = -1
    for i, c in enumerate(s[start:], start):
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if end == -1:
        raise GreenhouseAdapterError(f'Unterminated JSON in reply: {reply[:300]!r}')
    try:
        return json.loads(s[start:end])
    except json.JSONDecodeError as e:
        raise GreenhouseAdapterError(f'JSON parse failed: {e}\nRaw: {s[start:end][:500]}')


def _load_prompt(template_name: str) -> str:
    p = TEMPLATES_DIR / template_name
    if not p.exists():
        raise GreenhouseAdapterError(f'Missing template: {p}')
    return p.read_text()


def _load_experience_bank() -> str:
    if not EXP_BANK_PATH.exists():
        raise GreenhouseAdapterError(f'Missing experience bank: {EXP_BANK_PATH}')
    return EXP_BANK_PATH.read_text()


def generate_resume(jd_text: str, company: str, role_title: str,
                    job_route: str = 'long', max_tokens: int = 8192,
                    temperature: float = 0.4, per_model_timeout: int = 90) -> dict:
    """
    Generate a tailored resume JSON for the given job.

    Returns dict with keys: name, contact, executive_summary, competencies,
    experience, education, jd_keyword_coverage, phase1_analysis.

    Raises GreenhouseAdapterError if no free model produced valid JSON.
    """
    tmpl = _load_prompt('resume-prompt.md')
    bank = _load_experience_bank()
    user = (
        tmpl
            .replace('{jd_text}', jd_text)
            .replace('{company}', company)
            .replace('{role_title}', role_title)
        + "\n\n---\n# Experience Bank (inlined — use this verbatim as source of truth):\n\n"
        + bank
    )
    try:
        reply = chat_for(
            job_route, user, system=JSON_SYSTEM,
            max_tokens=max_tokens, temperature=temperature,
            per_model_timeout=per_model_timeout,
        )
    except (RateLimitedError, OpenRouterError) as e:
        raise GreenhouseAdapterError(f'All free models failed for resume: {e}')
    return _extract_json(reply)


def generate_cover_letter(jd_text: str, company: str, role_title: str,
                          key_metrics: Optional[dict] = None,
                          job_route: str = 'long', max_tokens: int = 4096,
                          temperature: float = 0.5, per_model_timeout: int = 90) -> dict:
    """
    Generate a tailored cover letter JSON.

    key_metrics: optional dict from resume generation (phase1_analysis) used
    to align the CL with the resume's narrative.

    Returns dict with keys: header, date, recipient, salutation, paragraphs,
    sign_off, phase1_analysis.
    """
    tmpl = _load_prompt('cover-letter-prompt.md')
    bank = _load_experience_bank()
    km_str = json.dumps(key_metrics or {}, indent=2)
    user = (
        tmpl
            .replace('{jd_text}', jd_text)
            .replace('{company}', company)
            .replace('{role_title}', role_title)
            .replace('{key_metrics}', km_str)
        + "\n\n---\n# Experience Bank (inlined — use this verbatim as source of truth):\n\n"
        + bank
    )
    try:
        reply = chat_for(
            job_route, user, system=JSON_SYSTEM,
            max_tokens=max_tokens, temperature=temperature,
            per_model_timeout=per_model_timeout,
        )
    except (RateLimitedError, OpenRouterError) as e:
        raise GreenhouseAdapterError(f'All free models failed for cover letter: {e}')
    return _extract_json(reply)


if __name__ == '__main__':
    # Smoke test
    JD = "Director of Growth at Lattice. $400M ARR Series D. PLG, lifecycle, Braze, Segment, BigQuery. $8M budget. 6-person team."
    print('Generating resume...')
    r = generate_resume(JD, 'Lattice', 'Director of Growth')
    print(f"  keys: {list(r.keys())}")
    print(f"  exec_summary: {r.get('executive_summary','')[:200]}...")
    print('\nGenerating cover letter...')
    c = generate_cover_letter(JD, 'Lattice', 'Director of Growth',
                              key_metrics=r.get('phase1_analysis'))
    print(f"  keys: {list(c.keys())}")
    print(f"  paragraphs: {len(c.get('paragraphs', []))}")
