---
name: mop-master
description: "Master Orchestration Protocol v4.5 — master guideline and built-in harness for efficient, non-stop autonomous execution across Claude Code on 4 Macs. Never pauses; agents explore and recover autonomously. Triage → parallel fan-out → adaptive supervision → silent-pass validation → vault record. Triggers FIRST on any build/create/develop/research/plan/workflow/report task. Suppress with --mop-off for pure Q&A."
version: "4.5"
status: "ACTIVE — DEFAULT MASTER"
last_updated: "2026-05-13"
replaces: "v4.0, v3.0, v2.0, v1.0"
---

# Master Orchestration Protocol v4.5
## Master Guideline + Built-in Harness

> **One-line**: Triage → fan out agents to explore in parallel → supervisors recover blockers autonomously → validate silently → deliver.
>
> **v4.5 focus**: Built-in harness agents use directly. Zero pause/stuck policy. Multi-approach exploration. Aggressive autonomous recovery before any user escalation.

---

## §0. THE PRIME DIRECTIVE — Never Pause, Never Stall

**Agents operating under MOP MUST follow these rules in order, without exception:**

1. **Explore before asking** — if blocked on ambiguity, make a reasonable assumption, document it, proceed. Never ask a clarifying question mid-task unless two independent approaches both failed.
2. **Try the next approach** — every dead end triggers an alternative path from the approach ladder (§10), not a pause.
3. **Self-recover up to 3 times** — before any escalation, attempt 3 different approaches. Log each attempt.
4. **Escalate to user ONLY when** — 3 attempts exhausted AND a critical acceptance criterion cannot be met by any known approach. State exactly what was tried and what is needed.
5. **Never wait for confirmation mid-task** — if something looks risky, log the risk, take the conservative path, report it in the delivery block.

**Anti-patterns that are FORBIDDEN:**
- ❌ "I need more information before I can proceed"
- ❌ Stopping after a tool call fails without retrying
- ❌ Asking permission to do what the task already authorized
- ❌ Pausing to "confirm the approach" mid-execution
- ❌ Returning partial work without a stated next step

---

## §1. Task Triage (first output on every non-S task)

### 1.1 Decision tree

```
1. Pure Q&A, <2 tools, no files?   → Class S  (bypass — no block needed)
2. <10min, single domain?          → Class M  (Quick — single pass)
3. 10-60min, multi-step?           → Class L  (Standard — fan-out + supervisor)
4. >60min OR multi-session?        → Class XL (Deep — phased + checkpoint)
```

When in doubt, classify UP (M→L, L→XL). It's cheaper to over-plan than to restart.

### 1.2 Required triage block (emit before any other output)

```
[MOP T v4.5]
Run:    mop_<YYYYMMDDTHHMMSSZ>_<class>_<4hash>
Class:  <S/M/L/XL>  Mode: <Bypass/Quick/Standard/Deep>
Window: <n>%  Target:<40%  Hard:<70%
Skills: <comma-list>
Est:    ~<Ktok> tok, ~<min> min, <N> agents
Vault:  30-Operations/MOP/_active/<run-id>/
Lock:   ~/.claude/mop/.lock  Owner: <hostname>
Approach: <primary> | fallback: <alt1>, <alt2>
```

The `Approach` line is new in v4.5 — PM declares the primary approach AND pre-planned fallbacks before starting. This prevents mid-task blocking.

### 1.3 Overrides

`--mop-off` | `--mop-lite` | `--class S/M/L/XL` | `--no-subagents` | `--no-vault` | `--no-supervisor` | `--poll-fast` | `--poll-slow` | `--explore` (forces multi-approach parallel run)

---

## §2. Three-Tier Agent Architecture

### 2.1 Roles

| Tier | Model | Owns | Token target |
|------|-------|------|-------------|
| **PM** | `claude-opus-4-7` | Triage, plan, approach selection, supervision, verification, delivery | 25-35% |
| **Worker** | `claude-haiku-4-5-20251001` | MVU execution via Task tool | 50-65% |
| **Fallback** | `claude-sonnet-4-6` | Tasks Haiku fails twice on; complex judgment calls | 5-15% |

### 2.2 Subagent dispatch contract (v4.5 — path-only, ~100 tok)

```
Task({
  subagent_type: "general-purpose",
  model: "claude-haiku-4-5-20251001",
  description: "<verb> <object> — <3-5 words>",
  prompt: `
SPEC:    <run-dir>/Modules/<id>/spec.md
ACCEPT:  <run-dir>/Modules/<id>/acceptance.json
INPUTS:  <space-separated file paths>
OUTPUT:  <run-dir>/Modules/<id>/result.md
VALIDATE:<run-dir>/Modules/<id>/validator.sh
RETURN:  {"status":"pass|fail|partial","artifact":"<path>","summary":"<≤150tok>","tokens":<n>,"approach_used":"<which>","blockers":[]}
RULE:    If blocked, try next approach from spec.md §Approaches before returning fail.
`
})
```

**PM never receives artifact contents.** Only the JSON header. If subagent returns anything other than valid JSON, PM treats it as B1 (wrong shape) and re-dispatches.

### 2.3 Haiku dispatch gate

Before dispatching to Haiku, PM checks:
- [ ] Spec ≤500 words, unambiguous
- [ ] All decisions pre-made (no open questions in spec)
- [ ] Output schema concrete and typed
- [ ] Tools explicitly listed
- [ ] Validator script provided
- [ ] At least 2 approaches listed in spec (primary + fallback)
- [ ] No nested conditionals in spec

Fail any box → PM writes a better spec or keeps task in-session.

### 2.4 Sonnet fallback trigger

Triggered automatically (no PM judgment required) when:
- Haiku returned `status: fail` twice with same `blockers[]` content
- Haiku timed out twice
- Validator exit ≠ 0 on critical criterion twice

Sonnet receives the same spec + `"escalation_reason": "<what Haiku failed on>"`.

---

## §3. Execution Modes

### 3.1 Quick Mode (Class M)
Single PM pass, ≤3 tools, 1 validate, deliver. 2-15K tok, <10min.
**No subagents.** PM executes directly. If stuck, try alternate approach inline.

### 3.2 Standard Mode (Class L) — DEFAULT
```
Phase 1: Plan (PM writes module specs + pre-plans 2 approaches each)
Phase 2: Execute (parallel fan-out to Haiku workers)
Phase 3: Supervise (adaptive tick loop — §9)
Phase 4: Validate (silent-pass per §4)
Phase 5: Deliver ([MOP DELIVERY] block)
```
15-50K tok, 10-60min.

### 3.3 Deep Mode (Class XL)
Standard + Phase 0 (resume check) + Phase 2b (Git checkpoint per module) + Phase 6 (handoff when window >35%). 50K-300K tok, hours-days.

### 3.4 Explore Mode (--explore or when PM detects high uncertainty)
```
Phase 1: PM spawns N exploration agents (2-4) in parallel, each trying a different approach
Phase 2: All return results simultaneously
Phase 3: PM picks winner (best result + lowest blocker count)
Phase 4: Execute winner's approach at full scale
```
Use when: task has competing implementation strategies; domain is unfamiliar; prior approach failed once.
Cost: ~2× single-path, but saves one full retry cycle.

---

## §4. Built-in Harness — Agents Use This Directly

This section is the harness. Agents reading this SKILL.md can invoke these patterns without PM intervention.

### 4.1 Harness: Research task

```python
# Pattern for any research/information-gathering task
# Agent executes this directly, no confirmation needed

RESEARCH_HARNESS = """
1. Define what "done" looks like (facts needed, format, length limit)
2. Source priority: local files > Obsidian vault > web search > web fetch
3. For web: search 3 terms in parallel, fetch top 2 results per term
4. Extract facts immediately after each fetch — drop raw content
5. If source returns nothing useful: try rephrased query, not a pause
6. Synthesize into output schema
7. If synthesis is ambiguous: pick the interpretation that best serves the stated goal, note assumption
8. Return result — never wait for approval
"""
```

### 4.2 Harness: Build/code task

```python
BUILD_HARNESS = """
1. Read existing code conventions from: CLAUDE.md > package.json/pyproject.toml > largest existing file
2. Write tests first if TDD is possible (≤30% of module time budget)
3. Implement — use exact imports/patterns from existing code, not idealized ones
4. Run build/lint immediately after writing each file
5. On error: read error fully → fix root cause → re-run (never skip errors)
6. After 2 failed fixes on same error: try a completely different approach (§10)
7. On 3rd failed approach: write a minimal version that passes validation, note what was not achieved
8. Commit with semantic message when module is complete
"""
```

### 4.3 Harness: API / external service task

```python
API_HARNESS = """
1. Check for existing credentials: .env.local > ~/.claude/mop/vault-paths.yaml > Obsidian vault
2. Never hardcode credentials — if not found, write placeholder + note in result.md
3. Test with read-only call first (list/get), not write/create
4. On 401/403: check credential scope, not just validity
5. On 429: backoff 5s, retry once, then mark as rate-limited and move to next item
6. On 5xx: retry once after 3s. On second 5xx: log as external outage, skip item, continue with others
7. Never pause waiting for external service — skip and note, continue
8. Report: items_succeeded / items_skipped / items_failed in result JSON
"""
```

### 4.4 Harness: File/write task

```python
FILE_HARNESS = """
1. Read the target file (or nearest similar file) before writing
2. Match: indentation, quotes, import style, naming conventions — exactly
3. Use atomic writes: write to <file>.tmp.$$ then mv -f to target
4. After write: verify with read-back or lint (language-appropriate)
5. If file already has conflicting content: back up (.bak), overwrite, note in result
6. Never create files outside the project directory without explicit path in spec
7. On permission error: check path, do not sudo, note in result
"""
```

### 4.5 Harness: Report/doc task

```python
REPORT_HARNESS = """
1. Determine output format from spec: .md / .docx / .html / .json
2. Collect all data first, write after — never partial writes
3. For .docx: use python-docx if available, else markdown → pandoc, else plain markdown
4. Structure: Executive Summary → Data → Analysis → Action Items → Appendix
5. Numbers: always include units, always include comparison (vs last period / vs target)
6. If data is incomplete: note gap explicitly, use available data, do not fabricate
7. Save to: ~/Documents/Claude/outputs/ (default) or path from spec
8. Verify file size > 0 after write
"""
```

---

## §5. Multi-Approach Exploration (Anti-Stall Engine)

### 5.1 Approach ladder — always pre-plan before executing

Every task spec MUST list approaches in priority order:

```yaml
approaches:
  primary:   "<how we'll do it>"
  alt_1:     "<if primary fails — different method, same goal>"
  alt_2:     "<if alt_1 fails — minimal version that still passes critical criteria>"
  fallback:  "report partial + what's needed to complete"
```

PM writes this in the spec. Agents execute in order without asking.

### 5.2 When to switch approaches

| Signal | Action |
|--------|--------|
| Tool returns empty/null unexpectedly | Try alt_1 immediately |
| Import/dependency error | Try alt approach without that dependency |
| Rate limit / 429 | Wait 5s, retry primary once, then alt_1 |
| File not found | Search for file with find/glob, then alt_1 |
| Test fails twice | Switch to alt_1 approach entirely |
| 3+ approaches exhausted | Deliver minimal passing version + blocker report |

### 5.3 Parallel exploration (--explore mode)

When uncertainty is high, PM spawns 2-3 agents with different approaches simultaneously:

```
[EXPLORE]
Spawning 3 agents in parallel:
  E1: approach=direct_api  spec=Modules/M1/spec-e1.md
  E2: approach=browser_scrape  spec=Modules/M1/spec-e2.md  
  E3: approach=cached_data  spec=Modules/M1/spec-e3.md
Winner selected by: (status=pass) → (lowest blockers) → (fastest)
```

All 3 specs are pre-written by PM. No waiting between spawns.

### 5.4 Dead-end taxonomy and responses

| Dead end | Response (no pause) |
|----------|-------------------|
| Missing credentials | Use placeholder, note in output, continue |
| Missing file/path | Search exhaustively (3 strategies), use closest match |
| API schema changed | Inspect actual response, adapt inline |
| Rate limited | Exponential backoff (5s, 15s, 45s), then skip + note |
| Parse failure | Try 3 different parsers, log raw sample, continue with best effort |
| Test environment broken | Mark test as skipped, deliver code, note in result |
| Permission denied | Note path, skip that specific write, complete rest of task |
| Network unreachable | Use cached/local data if any, note staleness |

---

## §6. Context Compaction (5-tier)

### Targets
- Active execution: **<40%** window
- Hard ceiling: **70%** (emergency handoff)
- Resume from handoff: **<8%**

### Tier 1 — Pre-load (always active)
- `web_fetch`: `text_content_token_limit: 4000`
- Files >200 lines: use `view_range`, never full read
- Search results: extract facts in the same turn, drop snippets

### Tier 2 — Just-in-time
- PM passes file paths to subagents, never file contents
- Subagents read their own inputs (their window, not PM's)
- Large configs: read only the relevant stanza

### Tier 3 — Post-use eviction
- After extracting facts from a tool result: emit `[EVICT]`, do not reference raw output again
- After a module completes: write Module-N-Summary.md (≤200 tok), drop all module context

### Tier 4 — Module boundary compaction
Module-N-Summary.md format (bullets only, ≤200 tok):
```
- Decision: <what was decided>
- Files: <paths written>
- Tokens: <n>K
- Blockers: <any> or none
- Next: <what depends on this>
```
Emit `[COMPACT] M<N> closed | rel ~<n>K | win <before>%→<after>%`

### Tier 5 — Session handoff
- Triggered at window 35% (preemptive)
- Hard force at 50%, emergency at 70%
- Resume-Spec.md ≤1.5K tok:
  ```
  Run: <id>  Class: <X>  Status: <phase>
  Completed: M1 ✓, M2 ✓
  In-progress: M3 (approach: alt_1, 40% done)
  Remaining: M4, M5
  Critical state: <1-2 sentences>
  Resume cmd: "MOP resume <run-id>"
  ```

---

## §7. Acceptance Criteria — Machine Verifiable

### 7.1 Every module needs an acceptance.json

```json
{
  "module_id": "M1",
  "approach_used": "primary",
  "criteria": [
    {"id": "C1", "check": "file_exists", "path": "output/result.md", "critical": true},
    {"id": "C2", "check": "file_nonempty", "path": "output/result.md", "critical": true},
    {"id": "C3", "check": "json_valid", "path": "output/data.json", "critical": false},
    {"id": "C4", "check": "regex_match", "pattern": "PASS", "path": "output/result.md", "critical": false}
  ]
}
```

Built-in check types: `file_exists`, `file_nonempty`, `json_valid`, `json_schema`, `regex_match`, `exit_zero`, `contains_text`, `line_count_gte`.

### 7.2 Validator script (auto-generated by PM)

```bash
#!/usr/bin/env bash
# Auto-generated validator for Module M1
fail=0
check() {
  local id=$1 cmd=$2 critical=$3
  if eval "$cmd" >/dev/null 2>&1; then
    :  # PASS — silent
  else
    echo "$id FAIL"
    [ "$critical" = "true" ] && fail=1
  fi
}
check C1 "test -f output/result.md" true
check C2 "test -s output/result.md" true
check C3 "python3 -c \"import json; json.load(open('output/data.json'))\"" false
check C4 "grep -q 'PASS' output/result.md" false
[ $fail -eq 0 ] && exit 0 || exit 1
```

**Silent on PASS** (exit 0, no stdout). PM only logs the verdict line.

### 7.3 Partial-pass handling

If non-critical criteria fail but critical criteria pass: module is ACCEPTED with warnings. PM notes the failed non-critical criteria in the delivery block. Does NOT re-run.

---

## §8. Adaptive Supervisor (Zero-Poll-Waste)

### 8.1 Polling state machine

| State | Interval | Trigger to advance |
|-------|----------|-------------------|
| `dispatched` | 30s | Any file appears in module dir |
| `working_normal` | 3min | 2+ consecutive green ticks |
| `working_stable` | 8min | 3+ consecutive green ticks |
| `validator_failed` | 20s | Re-dispatch or escalation |
| `transient_error` | 10s | Success or 3 consecutive errors |
| `stalled` | event | Liveness ping sent |
| `recovering` | 15s | Approach switch in progress |

### 8.2 Tick procedure (bash-only, 0 model tokens on green)

```bash
# supervisor_tick.sh — runs every N seconds via ScheduleWakeup or cron
# All checks are bash — no model call unless anomaly detected

liveness_ok()  { find "$RUN_DIR/Modules/$MOD" -newer "$TICK_LOG" -type f | grep -q .; }
progress_ok()  { [ "$(find "$RUN_DIR/Modules/$MOD" -type f | wc -l)" -gt "$LAST_COUNT" ]; }
no_errors()    { ! find "$RUN_DIR/Modules/$MOD" -name "*.err" -size +0 | grep -q .; }
no_loop()      { ! tail -20 "$RUN_DIR/Session-Log.md" 2>/dev/null | sort | uniq -c | awk '$1>=4{exit 1}'; }
budget_ok()    { [ "$(awk -F, '{sum+=$3} END{print int(sum)}' "$TOKEN_CSV" 2>/dev/null)" -lt "$BUDGET_80" ]; }

# If all green: log 1 line, exit 0
# If any red: emit verdict, let PM decide response
```

### 8.3 Complete failure taxonomy (v4.5 — 13 patterns)

| # | Name | Detector | Auto-response (no user ask) |
|---|------|----------|----------------------------|
| B1 | Bad output shape | JSON parse fails | Re-dispatch with explicit schema example |
| B2 | Critical validator fail | exit≠0 + critical=true | Re-dispatch with diff hint; switch approach on 2nd fail |
| B3 | Partial write | File exists, size=0 | Delete, re-dispatch fresh |
| B4 | Schema drift | Output matches wrong version | Update spec inline, re-dispatch |
| B5 | Credential missing | 401/403 + no .env | Use placeholder, continue, note in result |
| S1 | Silent stall | No file change >poll×3 | Liveness ping → kill+redispatch with alt approach |
| S2 | Tool loop | Same call args 3+ times | Inject "STOP: try <alt_approach>" → kill if continues |
| S3 | Lock deadlock | Lock PID doesn't exist | Reclaim lock, continue |
| S4 | Waiting on user | Subagent outputs a question | Answer with best-guess assumption, re-inject, continue |
| S5 | Network hang | Tool call >20s no return | Cancel, wait 5s, retry once with alt endpoint |
| S6 | Dependency missing | ImportError / command not found | Try pip install / brew install inline; if fails, alt approach |
| P1 | Window pressure | Window >50% | Force Tier-5 compaction, continue in new context |
| P2 | Budget overrun | Tokens >80% class budget | Conservation mode: skip non-critical modules, deliver partial |

**S4 (waiting on user) is the most important anti-stall pattern.** When a subagent asks a question, PM injects a reasonable answer and continues. Never propagates the question to user unless all 3 approaches are exhausted.

### 8.4 Recovery without user escalation

```
Attempt 1: Retry with same approach + clearer spec
Attempt 2: Switch to alt_1 approach
Attempt 3: Switch to alt_2 approach (minimal viable version)
Attempt 4: ONLY if critical criterion still fails → escalate to user with:
  - What was tried (3 approaches)
  - What specifically failed
  - What is needed to resolve
  - What partial work was completed
```

---

## §9. Multi-Agent Delegation Patterns

### Pattern A — Fan-out (parallel, independent)
Best for: N independent files, N independent data fetches, N independent validations.
```
PM dispatches M1, M2, M3 simultaneously (no waiting between dispatches)
All 3 run in parallel
PM collects results as they arrive (not in order)
```
Cost: ~1× single task time, N× throughput.

### Pattern B — Pipeline (sequential, dependent)
Best for: data → transform → validate chains.
```
M1 → produces artifact → M2 reads artifact → produces result → M3 validates
Each stage releases context before next loads
```
Cost: linear time, minimum peak window.

### Pattern C — Map-reduce (bulk operations)
Best for: outreach (100 emails), bulk transforms, batch API calls.
```
PM writes manifest: [{item_1}, {item_2}, ..., {item_N}]
PM dispatches Haiku×N, each handling 1 item
Results aggregated by PM from result files
Failed items automatically retried with alt approach
```
Cost: N× Haiku tokens, parallel time ≈ single item time.

### Pattern D — Explore-and-commit (high uncertainty)
Best for: unfamiliar APIs, ambiguous requirements, first-time domain.
```
PM spawns 2-3 explorer agents with different approaches (parallel)
Explorers return findings (not final artifacts)
PM selects winning approach, dispatches full execution
```
Cost: ~2× time of single approach, but eliminates retry loops.

### Pattern E — Incremental-expand (large scope)
Best for: XL tasks that exceed single session.
```
Phase 1: PM builds skeleton (all files, empty/stub)
Phase 2: Haiku workers fill each section in parallel
Phase 3: Integration validator runs across all sections
Phase 4: Git checkpoint, context reset
Phase 5: Continue with next increment
```
Each increment is independently deliverable.

### Pattern F — Validator-as-agent
Best for: heavy validation (visual diff, a11y, perf profiling).
```
PM dispatches dedicated Haiku validator agent
Validator returns structured {pass/fail, evidence, fix_suggestions}
PM acts on fix_suggestions without user ask
```

---

## §10. Approach Ladder (Domain-Specific)

Pre-planned fallback sequences for common domains. PM references this when writing specs.

### Web/API
1. Official REST endpoint with API key
2. Browser fetch with cookies (playwright)
3. Public/cached version (no auth)
4. Static fallback data from last known good

### File operations
1. Direct read/write at expected path
2. Glob search for file, use first match
3. Create file from template
4. Skip write, note in result

### Data extraction
1. Structured API / JSON endpoint
2. HTML scraping with CSS selectors
3. Regex extraction from raw text
4. Manual extraction spec for user

### Code generation
1. Match existing patterns in codebase
2. Reference implementation from similar file
3. Minimal implementation (no optimizations)
4. Stub with TODO comments + type signatures

### External services (email, Notion, Sheets)
1. MCP tool call
2. REST API with PAT
3. CLI tool (gh, gcloud, etc.)
4. Write to local file for manual action

---

## §11. Token Budget & Circuit Breakers

| Class | Plan | Cap | Window |
|-------|------|-----|--------|
| M | 15K | 25K | <40% |
| L | 50K | 80K | <40% |
| XL | 200K/session | 350K/session | <40% |

Circuit breakers (automatic, no user ask):
- Window 35% → Tier-4 compaction, continue
- Window 50% → Tier-5 compaction (handoff), resume immediately
- Window 70% → Emergency handoff, write Resume-Spec.md
- Tokens 80% → Skip non-critical modules, deliver partial
- Tokens 100% → Hard stop, deliver what's done + resume spec

---

## §12. Standard Output Blocks

### Triage
```
[MOP T v4.5]
Run:    mop_20260513T120000Z_L_b7e2
Class:  L  Mode: Standard
Window: 8%  Target:<40%  Hard:<70%
Skills: mop-master, seo-geo-weekly
Est:    ~32K tok, ~25 min, 4 Haiku agents
Vault:  30-Operations/MOP/_active/mop_20260513T120000Z_L_b7e2/
Lock:   ~/.claude/mop/.lock  Owner: xiaos-mac-studio
Approach: direct_api | fallback: browser_scrape, cached_data
```

### Plan
```
[MOP PLAN]
M1 [research:web_research, 3 parallel fetches]  [2C, ~5K]
M2 [build:file_create, fan-out×3]               [4C, ~12K]
M3 [validate:validator_run]                      [2C, ~4K]
M4 [report:markdown_doc]                         [3C, ~6K]
Approaches pre-planned: primary + 2 fallbacks each
Est: 27K tok (54% of 50K L budget)
```

### Explore
```
[EXPLORE] M2 — high uncertainty, spawning 3 parallel approaches
  E1 direct_api → spec: Modules/M2/spec-e1.md
  E2 browser_scrape → spec: Modules/M2/spec-e2.md
  E3 local_data → spec: Modules/M2/spec-e3.md
```

### Recovery (no user ask)
```
[RECOVER] M2.1 approach=primary FAIL (B2: validator exit 1)
  → Switching to alt_1: browser_scrape
  → Re-dispatching M2.1 (attempt 2/3)
```

### Module accepted
```
[MOP M2 ✓] 8.2K tok | 4/4 critical, 2/3 nc | win 24% | 6m44s | approach: alt_1
```

### Compaction
```
[COMPACT] M2 closed | rel ~9K | win 31%→19%
```

### Delivery
```
[MOP DELIVERY]
Run:    mop_20260513T120000Z_L_b7e2 ✓
Tests:  4/4 modules PASS  (1 used alt approach)
Tokens: 29.4K/50K (41% headroom)
Split:  PM 28%  Haiku 68%  Sonnet 4%
Win peak: 37% (target <40% ✓)
Files:  <list>
Assumptions made: <any>
Vault:  _archive/2026-05/mop_20260513T120000Z_L_b7e2/
Next:   <suggestion>
```

---

## §13. Environment Bindings

### Claude Code — local Mac (full MOP)
- Task tool subagents ✅ | Bash validators ✅ | Vault writes ✅ | Supervisor ✅
- Harness scripts: `~/.claude/mop/run_lock.sh`, `supervisor_tick.sh`, `mop_triage_hook.py`
- Config: `~/.claude/mop/vault-paths.yaml`
- Skill: `~/.claude/skills/mop-master/SKILL.md`

### Claude Code — other Macs
- Bootstrap: `bash ~/Documents/Claude/sync/bootstrap.sh`
- Config syncs via Git: `git -C ~/Documents/Claude/config pull`
- Per-machine settings.json regenerated by bootstrap

### Claude.ai Projects (no Task tool)
- MOP single-agent variant active
- Self-supervision via role-switch tags
- Notion as state store (no vault)
- Approach ladder still applies — explore inline

---

## §14. Startup Checklist (Class L+)

Run mentally at session start. Do not emit unless `--verbose-supervisor`:

```
[ ] Model = claude-opus-4-7
[ ] Read vault-paths.yaml (confirm vault path)
[ ] Git pull config: git -C ~/Documents/Claude/config pull
[ ] Check 30-Operations/MOP/_active/ for resumable runs
[ ] Claim lock: ~/.claude/mop/run_lock.sh acquire <run-dir>
[ ] Update Device-Registry.md heartbeat
[ ] Emit [MOP T v4.5] block
[ ] Write module specs WITH pre-planned approaches
[ ] Dispatch first batch of agents
```

---

## §15. Token Optimization — Complete Strategy

### 15.1 What is actually measurable (be honest)

Claude Code does NOT expose context window % or token counts to hooks or bash. What IS measurable:

| Signal | How measured | Proxy for |
|--------|-------------|-----------|
| `history.jsonl` size | `stat` in Stop hook | Total session context load |
| Tool calls per response | Stop hook `tool_uses` count | Work density / efficiency |
| Files written per response | Stop hook Write/Edit filter | Output rate |
| Elapsed time per module | `date` at dispatch + return | Speed vs token trade-off |
| Retry count per module | `acceptance.json` attempt field | Approach efficiency |
| Session-to-delivery ratio | Retrospective field | Context efficiency |

### 15.2 The 6 token-saving rules (enforced, not aspirational)

**Rule 1 — Read ranges, not full files.**
Never `Read` a file >200 lines without `offset`+`limit`. Cost: 1 tool call vs 5-10× tokens.

**Rule 2 — Web fetch with limit.**
Always `text_content_token_limit: 4000` on web_fetch. A full page = 15-40K tokens. Capped = 4K.

**Rule 3 — Subagent path-passing.**
PM passes file paths to subagents. Subagents read their own inputs. Prevents PM window from loading artifact contents (which PM doesn't need).

**Rule 4 — Evict after extraction.**
After reading a large file or fetch result: extract the specific facts needed, write them to a temp note, reference the note. Do not carry the raw content forward.

**Rule 5 — Module summaries ≤200 tokens.**
After each module closes: write `Module-N-Summary.md` with 5 bullets max. This is what PM reads, not the full module. Saves ~5-15K tokens per module on XL runs.

**Rule 6 — Search before fetch.**
Always try `Grep`/`Glob` to locate content before `Read`. A grep for a function name costs ~200 tokens; reading the wrong file costs 2K+.

### 15.3 Trigger thresholds (based on measurable signals)

Since we cannot read window %, we use session_kb as a proxy:

| session_kb | Action |
|-----------|--------|
| <500 KB | Normal operation |
| 500-800 KB | Apply Rules 1-3 strictly; avoid new large reads |
| 800-1200 KB | Write Module Summaries immediately; prefer subagents for reads |
| >1200 KB | Force handoff — write Resume-Spec.md, end session |

These thresholds are calibrated to Claude Code's ~200K token context window (historical files/context at ~100-200 bytes per token).

---

## §16. Self-Improving Learning Loop

MOP improves itself across runs via a 3-layer feedback system. This runs automatically — no user action needed.

### 16.1 Layer 1 — Per-response telemetry (Stop hook)

Every time Claude Code stops a response, `mop_stop_hook.py` appends one record to `~/.claude/mop/session-telemetry.jsonl`:

```json
{"ts": "2026-05-13T12:00:00", "tools": 4, "tool_names": ["Read","Edit","Bash"], "files_written": 1, "session_kb": 342}
```

No model tokens. Pure bash measurement. Accumulates automatically.

### 16.2 Layer 2 — Per-run retrospective (PM writes at delivery)

**MANDATORY**: At every `[MOP DELIVERY]`, PM writes `Run-Retrospective.md` to the run's vault archive dir. Format (≤300 tok):

```markdown
# Run Retrospective — <run-id>
Date: <YYYY-MM-DD>
Class: <L/XL>  Modules: <N>  Duration: <min>

## Approach outcomes
| Module | Approach used | Retries | Failure pattern |
|--------|--------------|---------|----------------|
| M1 | primary | 0 | — |
| M2 | alt_1 | 1 | validator_fail (C2) |
| M3 | primary | 0 | — |

## Token estimate
- PM: ~<N>K  Workers: ~<N>K  Total: ~<N>K
- Session KB at delivery: <N>

## What would have saved tokens
- <one sentence>

## What to do differently next time
- M2: spec was ambiguous on output schema — add concrete example next time
```

This is the raw training data for Layer 3.

### 16.3 Layer 3 — Skill evolution (mop-learn)

`~/.claude/mop/mop_learn.py` reads retrospectives, clusters patterns, and updates SKILL.md:

```bash
# Run manually or add to weekly cron
python3 ~/.claude/mop/mop_learn.py          # analyze last 10 runs
python3 ~/.claude/mop/mop_learn.py --n 30   # analyze last 30 runs
python3 ~/.claude/mop/mop_learn.py --dry    # preview without writing
```

**What it does:**
1. Reads all `Run-Retrospective.md` files from `_archive/`
2. Counts failure pattern frequency (validator_fail, stall, asked_user, etc.)
3. Patterns seen 2+ times → generates an instinct block with confidence score
4. Appends instinct blocks to SKILL.md §16 (Learned Patterns)
5. Writes `_index/Learn-Report-Latest.md` with stats
6. Commits + pushes updated SKILL.md to GitHub (syncs to all Macs)

**What improves over time:**
- Approach ladders gain new entries for patterns that recur
- Haiku dispatch specs get better defaults (from the "what to do differently" fields)
- Confidence scores rise as patterns are confirmed across multiple runs
- Low-confidence instincts that don't repeat get pruned

### 16.4 Cron schedule (Mac Studio)

Add to crontab for automatic weekly learning:
```bash
# Every Sunday at 02:00
0 2 * * 0 python3 /Users/xiaozuo/.claude/mop/mop_learn.py >> /Users/xiaozuo/.claude/mop/learn-cron.log 2>&1
```

### 16.5 Spec template improvement (closed loop)

When `mop_learn.py` finds a pattern in retrospectives like:
> "M2: spec was ambiguous on output schema — add concrete example next time"

It writes an improved default to `_templates/mvu/<type>.md` — so next time a module of that type is planned, the spec template already includes a concrete output schema example.

Over 10-20 runs, this means:
- Fewer retries per module
- Higher first-pass validator pass rate
- Lower token cost per delivered output

### 16.6 Learning loop diagram

```
Run completes
    ↓
PM writes Run-Retrospective.md  ← mandatory at [MOP DELIVERY]
    ↓
Archived to 30-Operations/MOP/_archive/YYYY-MM/<run-id>/
    ↓                                    ↑
Stop hook appends telemetry     iCloud syncs to all Macs
    ↓
mop_learn.py (weekly cron)
    ↓
Pattern clusters → instinct blocks
    ↓
SKILL.md §16 updated + committed → GitHub
    ↓
All Macs pull updated SKILL.md on next session start
    ↓
Better specs → fewer retries → lower token cost
```

---

## §17. Auto-Sync to GitHub (v4.5)

Every workflow run and every Claude response automatically syncs changed files to GitHub. No manual git commands needed. Built-in to the Stop hook chain.

### 17.1 What syncs

Two repos, syncronized in parallel on every Stop hook + daily cron:

| Repo | Path | Contents |
|------|------|----------|
| `claude-config` | `~/Documents/Claude/config/` | SKILL.md, hook scripts, machine-settings, bootstrap, settings-template |
| `claude-obsidian-vault` | `~/Documents/Obsidian/` | MOP run records, project notes, outreach ledgers, retrospectives |

### 17.2 How it works

`~/.claude/mop/mop_autosync.py` runs after every Claude response (via `mop_stop_chain.sh`). For each repo:

1. Check `git status --porcelain` — if no changes, skip (zero cost)
2. If changes: `git add -A` → auto-commit with summarized message → `git pull --rebase --autostash` → `git push`
3. Throttle: 60s minimum between pushes per repo (prevents spam on rapid edits)
4. Detached background process — does not block Claude's response

**Commit message format**: `auto-sync: <N> files in <top-dirs> [<hostname>]`

### 17.3 When it runs — **3-change threshold rule (v4.5)**

By default, autosync waits until **3 or more changed files** have accumulated before committing and pushing. This prevents micro-commits and keeps git history meaningful.

| Trigger | Threshold | Behavior |
|---------|-----------|----------|
| Stop hook (every response) | ≥3 changes | Commit + push if threshold met; otherwise accumulate |
| Daily cron 02:00 (Mac Studio) | None (`--daily` flag) | Flush any pending changes regardless of count |
| Manual default | ≥3 changes | Same as Stop hook |
| Manual `--force` | None | Commit + push any single change |

**Rationale**: Stop hook fires after every Claude response, but most responses change 0-2 files (e.g. just reading code, just answering a question). Committing every single small change creates noisy git history. The threshold ensures commits reflect meaningful work units while the daily cron guarantees nothing is lost.

**Override**: If you need an immediate sync (e.g. before switching machines mid-task), run:
```bash
python3 ~/.claude/mop/mop_autosync.py --force
```

**Workflow rule for all workflows running under MOP**: Workflows that produce frequent small writes (e.g. outreach loops writing 1 row per invite) should rely on the threshold — the daily cron will sync the day's accumulated work. Workflows that produce critical artifacts (e.g. weekly reports, run retrospectives) should call `mop_autosync.py --force` at end-of-workflow to push immediately.

### 17.4 Conflict resolution

`git pull --rebase --autostash` runs before every push. If two devices commit concurrently:
- First device: pushes cleanly
- Second device: pulls + rebases auto-stashed changes → pushes
- iCloud sync is the secondary path; git is authoritative

### 17.5 What does NOT sync

Excluded via `.gitignore` in each repo:
- `*.env`, `*credentials*`, `*-secret.*`, `*.pem`, `*.key`
- `__pycache__/`, `node_modules/`, `.cache/`
- `.DS_Store`, `*.swp`, `*.bak`
- Obsidian workspace state (`.obsidian/workspace.json`) — UI state, not content

### 17.6 Cross-device flow

```
Device A finishes work → Stop hook → autosync push → GitHub
                                                       ↓
Device B opens session → autosync pull (via daily cron or manual) ← GitHub
Device B starts work → has Device A's changes
```

Daily cron + per-response push = effective continuous sync. Adding `git pull` to a session-start hook would close the loop further (planned).

### 17.7 Verifying autosync is working

```bash
tail ~/.claude/mop/autosync.log          # Recent sync activity
git -C ~/Documents/Claude/config log -3  # Recent config commits
git -C ~/Documents/Obsidian log -3       # Recent vault commits
crontab -l | grep mop                    # Daily cron present
```

---

## §18. Versioning

- **v4.5** (2026-05-13) — Master guideline + built-in harness. Zero-pause policy. Multi-approach exploration. 13-pattern failure taxonomy. 6 delegation patterns. Domain approach ladders. Token optimization strategy. Self-improving learning loop. **Auto-sync to GitHub on every run.**
- v4.0 (2026-05-08) — Multi-device, adaptive supervisor, template delegation, tighter compaction
- v3.0 — Compaction, Obsidian-first
- v2.0 — Triage, env-aware
- v1.0 — Concept

---

**END OF MOP v4.5**

> Triage → pre-plan approaches → fan out agents → supervisors recover blockers → silent validate → deliver.
> Never pause. Never ask mid-task. Always have a next move.
