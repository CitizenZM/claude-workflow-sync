---
name: mop-master
description: "Master Orchestration Protocol v4.0 — meta-protocol governing every non-trivial task across Claude Code, Claude.ai Projects, and OpenClaw. Adds (1) four-device parity via lock-file soft primary + Git for config + iCloud for vault, (2) further context optimization via template-based subagent specs targeting <40% window, (3) adaptive Opus supervisor with state-based polling 15s-5min and 9-pattern bug/stuck/pause detection, (4) silent-success validators and tighter resume specs. Triggers FIRST on any project request, build/create/develop/research task, multi-step workflow, Claude Code session start, or whenever orchestration is implied. Performs task triage (S/M/L/XL), enforces three-tier agent architecture (Opus PM + Haiku workers via Task tool + Sonnet fallback), defines machine-verifiable acceptance criteria, manages 5-tier context compaction, persists state in Obsidian (Notion mirror, Git for config), and recovers from failure deterministically. Suppress with --mop-off for trivial Q&A."
version: "4.0"
status: "ACTIVE — DEFAULT MASTER"
last_updated: "2026-05-08"
replaces: "v3.0, v2.0, v1.0"
---

# Master Orchestration Protocol v4.0

> **One-line**: Triage → delegate to Haiku via templates → adaptively supervise → verify by machine → record in Obsidian, sync via Git+iCloud across 4 Macs.

> **What's new in v4.0** (vs v3.0):
> - **§7 Multi-device**: Soft-primary-by-activity, Git for `~/.claude/`, lock files
> - **§8 Smarter delegation**: Template-based MVU specs (-80% prompt size)
> - **§9 Adaptive supervisor**: 15s-5min state-based polling, 9-pattern bug/stuck/pause detection
> - **§5 Compaction**: target tightened to <40% active execution
> - All v3.0 invariants preserved

---

## §1. Task Triage (every request)

### 1.1 Decision tree

```
1. Trivial Q&A / chat?         → Class S (bypass)
2. <2 tools, no files?         → Class S (bypass)
3. <10min, single domain?      → Class M (Quick)
4. 10-60min, multi-step?       → Class L (Standard)
5. >60min OR multi-session?    → Class XL (Deep)
```

### 1.2 Required output (every non-S task)

```
[MOP T v4]
Run:    mop_<utc>_<class>_<hash>
Class:  <S/M/L/XL>  Mode: <Bypass/Quick/Standard/Deep>
Window: <%>  Target: <40%  Hard: <70%
Skills: <list>
Est:    <tokens>, <minutes>, <subagent count>
Vault:  30-Operations/MOP/_active/<run-id>/
Lock:   <path/to/lock>  Owner: <this-machine>
```

(Compressed format from v3 [MOP TRIAGE v3.0] — saves ~80 tokens/task.)

### 1.3 Force overrides

`--mop-off` | `--mop-lite` | `--class S/M/L/XL` | `--no-subagents` | `--no-vault`
Plus v4 additions: `--no-supervisor` | `--poll-fast` | `--poll-slow`

---

## §2. Three-Tier Agent Architecture

### 2.1 Roles

| Tier | Model | Owns | Token target |
|------|-------|------|-------------|
| **PM** | `claude-opus-4-7` | Triage, planning, supervision, verification | 25-35% |
| **Worker** | `claude-haiku-4-5-20251001` | MVU execution via Task | 50-65% |
| **Fallback** | `claude-sonnet-4-6` | Tasks Haiku can't complete | 5-15% |

### 2.2 Subagent contract (v4 — template-based)

Default subagent dispatch is now ~100 tokens of preamble + reference to spec file. Full spec, criteria, and inputs live as files in run dir. Subagent reads them itself (its window, not PM's).

```
Task({
  subagent_type: "general-purpose",
  description: "<3-5 word MVU label>",
  prompt: `
SPEC:    <run-dir>/Modules/<id>/spec.md
ACCEPT:  <run-dir>/Modules/<id>/acceptance.json
INPUTS:  <list of paths>
OUTPUT:  <run-dir>/Modules/<id>/result.md
RUN:     <run-dir>/Modules/<id>/validator.sh
RETURN:  {status, artifact_path, summary≤150tok, tokens_used}
`
})
```

PM treats anything not matching this JSON as failure. PM never receives artifact contents — only the JSON header.

### 2.3 Templates (in vault `_templates/`)

Subagent prompts can also reference task-type templates:
```
TEMPLATE: liquid_section
PARAMS:   {section_name: "hero", design_tokens: "tokens.json", ref: "ref.png"}
SPEC:     <run-dir>/Modules/<id>/spec.md   (auto-generated from template)
```

Templates live at `30-Operations/MOP/_templates/mvu/<type>.md`. New templates added as patterns repeat. v4 ships with: `liquid_section`, `email_draft`, `data_extract`, `sql_query`, `markdown_doc`.

### 2.4 Haiku Compatibility Checklist (gate)

- [ ] Spec is <500 words and unambiguous
- [ ] All decisions pre-made by PM
- [ ] Output schema concrete
- [ ] Tools listed
- [ ] Validator provided
- [ ] No nested conditionals
- [ ] Example included if non-trivial

If any box fails → keep in PM, refine spec, or escalate to Sonnet.

### 2.5 Sonnet fallback

Triggered when:
- Haiku failed twice on same MVU with same error pattern
- Haiku timeout twice
- Validator failed twice with logic-error class

Sonnet receives same contract + `escalation_reason: <why>`.

---

## §3. Three Execution Modes

(Unchanged from v3.0 except where noted.)

### 3.1 Quick (Class M)
Single Opus pass, 1-3 tools, 1 verify, deliver. 2-15K tokens, <10min.

### 3.2 Standard (Class L) — DEFAULT
Plan → Execute (with **adaptive supervisor**) → Verify → Deliver. 15-50K tokens, 10-60min.

### 3.3 Deep (Class XL)
Standard + Phase 0 (init from resumable run) + Phase 5 (5+ test dimensions) + Phase 6 (Git checkpoint per module) + Phase 7 (handoff if session ending). 50K-300K, hours-days.

---

## §4. Acceptance Criteria — Machine Verifiable + Templates (v4)

### 4.1 Templates first

Common criteria live at `_templates/acceptance/`:
- `file_exists.tpl`
- `file_nonempty.tpl`
- `liquid_lint.tpl`
- `json_schema_valid.tpl`
- `regex_match.tpl`
- `visual_diff.tpl`

Module's `acceptance.json` references templates by ID + parameters:
```json
{
  "module_id": "M1",
  "criteria": [
    {"id": "C1", "template": "file_exists", "params": {"path": "sections/hero.liquid"}, "critical": true},
    {"id": "C2", "template": "liquid_lint", "params": {"file": "sections/hero.liquid"}, "critical": true},
    {"id": "C3", "template": "regex_match", "params": {"file": "sections/hero.liquid", "pattern": "srcset"}, "critical": false}
  ]
}
```

A small resolver script expands template+params into runnable validators.

### 4.2 Silent-success rule (v4)

Validators output ONLY on FAIL. PASS = exit 0, no stdout. PM logs the verdict line itself; doesn't echo validator output.

### 4.3 Verification (PM runs)

```bash
fail=0
for c in $(jq -c '.criteria[]' acceptance.json); do
  cmd=$(resolve_template "$c")    # template + params → bash command
  $cmd 2>>validator.err || { id=$(echo "$c" | jq -r '.id'); crit=$(echo "$c" | jq -r '.critical'); echo "$id FAIL"; [ "$crit" = "true" ] && fail=1; }
done
[ $fail -eq 0 ] && echo "MODULE ACCEPTED" || echo "MODULE REJECTED"
```

---

## §5. Context Compaction (5-tier — v4 tightened)

### Goal
- Active execution: **<40%** window (was <50% in v3)
- Hard ceiling: 70%
- Resume from handoff: **<8%** (was <15%)

### Tier 1: Pre-load filtering
- `web_fetch`: `text_content_token_limit: 4000`
- `view`: `view_range` for files >200 lines
- `web_search`: extract facts immediately, drop snippets
- All MCP/Drive reads default to summary mode

### Tier 2: Just-in-time loading
- PM passes paths only, never content
- Subagents read inputs themselves (their window)
- Templates pre-cached, referenced by ID

### Tier 3: Post-use eviction
- Explicit `[EVICT]` after consuming each tool result
- Drop large outputs after extracting facts

### Tier 4: Module boundary compaction (v4 tightened)
- Write `Module-N-Summary.md` (≤200 tokens, was 500)
- Bullets only: decisions / files / tokens / blockers / next
- `[COMPACT]` emitted with new window %

### Tier 5: Session handoff
- Triggered at **35% window** (preemptive, was 50%)
- Hard force at 50%
- Emergency at 70%
- Resume-Spec.md ≤1.5K tokens (was 2K)

### Compaction triggers (priority)
1. Single tool result >8K → Tier 1 retroactive
2. Module complete → Tier 4
3. Window >35% → preemptive Tier 4
4. Window >50% → force Tier 5
5. Window >70% → emergency handoff

---

## §6. Obsidian Vault — Default Record Store

(See v3 §6 for vault structure. v4 additions below.)

### 6.1 Multi-device vault access

All 4 Macs read same iCloud Obsidian vault. Writes:
- **Mac Studio** (most active): default writer
- **MacBooks**: write only when working alone (no other Mac actively in same run)
- **Lock file** at `<run-dir>/.lock` claims active writer (per §7)

Concurrent reads are fine; concurrent writes prevented by locks.

### 6.2 Vault subpaths in v4

```
30-Operations/MOP/
├── _active/<run-id>/
├── _archive/YYYY-MM/<run-id>/
├── _templates/                    [NEW in v4]
│   ├── mvu/<type>.md              [subagent task templates]
│   └── acceptance/<type>.tpl      [criterion templates]
├── _index/
│   ├── Active-Runs.md
│   ├── Token-Ledger-Master.md
│   └── Device-Registry.md         [NEW in v4]
└── _config/
    ├── mop-config.yaml
    └── vault-paths.yaml
```

---

## §7. Multi-Device Coordination (v4)

### 7.1 Sync layers

| Layer | Content | Method |
|-------|---------|--------|
| **L1** | `~/.claude/CLAUDE.md`, `skills/`, `agents/`, `commands/`, `rules/`, sanitized `settings.json` | **Git** repo `claude-config` |
| **L2** | Obsidian vault (all of `30-Operations/MOP/` + user's project notes) | **iCloud Drive** (already there) |
| **L3** | `~/.claude/projects/<encoded-cwd>/*.jsonl`, `history.jsonl` | **claude-session-sync** (lock-aware) |
| **L4** | Caches, in-flight tmp, `.lock` files | **Not synced** |

### 7.2 Soft primary by activity

No machine is hardcoded primary. Instead:

- A **run lock** at `<run-dir>/.lock` contains `{machine, pid, started_at, last_heartbeat}`
- A device wanting to operate on a run checks the lock:
  - Lock missing → claim (write lock with own machine info)
  - Lock present + heartbeat <5min → another machine owns; this one becomes read-only observer
  - Lock present + heartbeat >5min → assume stale; reclaim
- PM heartbeats lock every 60s during active work
- Lock released cleanly at run completion or handoff

### 7.3 Path normalization across 4 Macs

All Macs use `/Users/icey/`. To ensure full path parity:

- Projects always at `/Users/icey/Projects/<name>/`
- Vault always at `/Users/icey/Obsidian/<vault-name>/` (symlink to iCloud)
- `~/.claude/` always at `/Users/icey/.claude/` (Git-managed)

If username differs on any device, **fix the username** (cheap) rather than try path-rewriting (hard).

### 7.4 Device registry

`_index/Device-Registry.md` tracks known devices:

```markdown
| Device ID | Hostname | Role | Last seen |
|-----------|----------|------|-----------|
| MS-M4 | mac-studio.local | desktop | 2026-05-08T18:00Z |
| MBP14-M1 | mbp14.local | mobile | 2026-05-08T17:30Z |
| MBA14-M1 | mba14.local | mobile | 2026-05-07T22:00Z |
| MBA16-M3 | mba16.local | mobile | 2026-05-08T16:00Z |
```

Updated on every MOP session start.

### 7.5 Conflict resolution

If iCloud creates a conflict file (`note 2.md`):
1. Watchdog detects within 5min
2. Quarantines to `_active/_conflicts/<timestamp>/`
3. Notifies user (osascript local notification)
4. User reviews and merges manually

---

## §8. Smarter Delegation (v4)

### 8.1 MVU template library

Common patterns. Each lives in `_templates/mvu/<type>.md` and ships with v4:

| Template | Use case | Avg spec size |
|----------|----------|---------------|
| `file_create` | Create one file with given content/format | 100 tok |
| `file_edit` | Edit existing file with diff/replace | 150 tok |
| `bash_run` | Run command, capture output | 80 tok |
| `data_extract` | Extract structured data from source | 200 tok |
| `email_draft` | Draft email from template + variables | 150 tok |
| `liquid_section` | Build a Shopify Liquid section | 250 tok |
| `sql_query` | Write SQL with given schema + intent | 200 tok |
| `markdown_doc` | Generate doc from outline | 200 tok |
| `validator_run` | Execute test/validator, report result | 80 tok |
| `web_research` | Fetch + summarize from URL list | 200 tok |

### 8.2 Delegation patterns (when to use which)

**Pattern A — Fan-out by file** (parallel, independent)
N subagents, each builds 1 file. Use when files don't share state.
Cost: N × (100 tok dispatch + Haiku exec). Parallelizable in non-conflicting cases.

**Pattern B — Pipeline by stage** (sequential, dependent)
Subagent S1 produces artifact → S2 consumes it → S3 validates.
Cost: linear; lowest peak window because each stage releases prior context.

**Pattern C — Map-reduce** (batch ops)
PM writes a manifest (e.g. 50 emails to draft). One subagent generates the per-item spec. Then PM dispatches Haiku N times, each handling 1 item.
Best for: outreach, bulk transforms, repeat operations.

**Pattern D — Validator-as-subagent** (heavy validation)
For visual diff / a11y / perf: validator runs as Haiku subagent, returns structured pass/fail.
Saves PM context (validation logs would bloat it).

### 8.3 Subagent prompt skeleton (v4 minimum)

```
SPEC: <path>
ACCEPT: <path>
INPUTS: <paths>
OUTPUT: <path>
RUN: <validator>
RETURN: {status, artifact_path, summary≤150tok, tokens_used}
```

That's the entire prompt. The subagent reads SPEC for everything else. ~100 tokens.

### 8.4 What PM does NOT delegate

- Triage (cheap, decides everything else)
- Plan generation (architectural)
- Acceptance criteria definition (decides what success means)
- Final assembly + delivery report
- Recovery decisions when validators fail
- Sonnet escalation decision

---

## §9. Adaptive Opus Supervisor (v4)

### 9.1 Polling state machine

| State | Poll | Notes |
|-------|------|-------|
| `dispatched` | 60s | Just sent, expect first response |
| `working_normal` | 5min | All green |
| `working_stable` | 10min | Multi-tick green; relax further |
| `validator_failed_once` | 30s | Heightened watch |
| `transient_error` | 15s | Network/auth/rate-limit |
| `stalled` | event-only | After liveness ping fails |
| `paused` | event-only | User paused |
| `idle` | event-only | All MVUs done; just wait for next dispatch |

### 9.2 Tick procedure

Each tick (cheap, no model call unless anomaly):

1. **Liveness check** (bash): Did subagent emit anything in last `poll_interval × 1.5`? If not → suspect stall.
2. **Progress check** (bash): New files in `<run-dir>/Modules/<id>/` since last tick? If yes → working.
3. **Token check** (bash): Append to `Token-Ledger.csv`; if cumulative > 80% budget → conservation mode.
4. **Error check** (bash): Any `*.err` file with content? → trigger recovery.
5. **Loop check** (bash): grep `Session-Log.md` for repeated tool calls (last 10 lines, 3+ same). → loop.
6. **Window check** (subagent reports back): If subagent says window >40% → tell it to compact.
7. **External check** (cached 5min): API health pings (Notion, Anthropic, OpenClaw gateway).

If all 7 green → log "tick OK" to `Session-Log.md` (single line) and continue. **No model tokens spent on a normal tick.**

### 9.3 Bug/stuck/pause taxonomy (v4 master)

| # | Pattern | Detector | Default response |
|---|---------|----------|-----------------|
| B1 | Wrong output shape | JSON parse fails | Re-dispatch with stricter schema (1) → Sonnet |
| B2 | Validator FAIL critical | exit !=0 + criterion.critical=true | Re-dispatch with diff hint → Sonnet → user |
| B3 | Partial write | Artifact exists but truncated/empty | Discard, re-dispatch fresh |
| B4 | Schema drift | Output validates v1 schema not v2 | Update spec, re-dispatch |
| S1 | Silent stall | No progress >poll×3 | Liveness ping → kill+redispatch if no reply |
| S2 | Tool loop | Same call args 3+ times | Inject "STOP, change approach" → kill if continues |
| S3 | Resource deadlock | Lock owned by dead PID | Reclaim lock |
| S4 | Waiting on user | Subagent: "asking user X" | Surface to user, pause |
| S5 | Network hang | Tool call >30s no return | Cancel, retry once |
| P1 | Explicit pause | User says "pause" | Save state, status=paused |
| P2 | Window pressure | Window >50% | Tier 5 compaction (force handoff) |
| P3 | Budget pressure | Tokens >80% | Conservation mode |
| P4 | External outage | API health fails | Wait + retry; alert if persistent |

### 9.4 Supervisor trace (user visibility)

Toggle with `--verbose-supervisor`. Default is summarized:

```
[SUP] M2.1 dispatched (12:00:01)
[SUP] M2.1 OK (3 ticks, 6.5K tok, 31% win)
[SUP] M2.1 ACCEPTED in 3m30s
```

Verbose:
```
[SUP] 12:00:01 dispatched M2.1 (subagent SA-mp9k, budget 8K, validator: liquid_lint)
[SUP] 12:00:32 tick #1 dispatched→working_normal: alive=Y, files=1, tok=2.1K, win=14%, errors=0, loops=0, ext=ok
[SUP] 12:01:32 tick #2 working_normal: alive=Y, files=2, tok=4.7K, win=22%, errors=0, loops=0, ext=ok
[SUP] 12:03:30 M2.1 returned: status=pass, artifact=Modules/M2.1/result.md, tok=6.5K
[SUP] 12:03:31 validator PASS (silent)
[SUP] M2.1 ACCEPTED in 3m30s
```

### 9.5 Supervisor cost model

In normal flow:
- Routine tick: ~0 model tokens (bash only)
- Anomaly tick: ~500 tokens for diagnosis
- Recovery decision: ~1-2K tokens

Estimated overhead for a 1-hour Class L run: ~3-5K tokens (vs naive polling: ~60K). **>90% savings**.

### 9.6 Supervisor + watchdog division

| Concern | In-session supervisor | External watchdog (cron) |
|---------|----------------------|--------------------------|
| Subagent liveness | ✅ | ❌ |
| Tool loop detection | ✅ | ❌ |
| Window pressure | ✅ | ❌ |
| Budget overrun | ✅ | ❌ |
| PM session itself dies | ❌ | ✅ |
| Vault write conflicts | ❌ | ✅ |
| Stale locks | partial | ✅ |
| Multi-device coordination | partial | ✅ |
| Notion mirror health | partial | ✅ |

---

## §10. Failure Handling

(Unchanged from v3 §7 except validator output rule — silent-on-success per v4 §4.2.)

Recovery cap: 3 auto-attempts per run. After cap, ask user.

---

## §11. Token Budget & Circuit Breaker

(Unchanged from v3 §8 except updated thresholds for v4 tightened compaction.)

| Class | Plan | Hard cap | Window cap |
|-------|------|----------|-----------|
| M | 15K | 25K | 40% |
| L | 50K | 80K | 40% |
| XL | 200K/session | 350K/session | 40% |

Circuit breaker:
- Window 35% → preemptive Tier-4
- Window 50% → force Tier-5
- Window 70% → emergency handoff
- Tokens 80% budget → conservation mode
- Tokens 100% → soft stop, ask user
- Tokens 120% (cap) → hard stop

---

## §12. Environment Bindings (v4)

### 12.1 Claude Code (local Mac)

- ✅ Full MOP active
- ✅ Direct vault writes (with lock)
- ✅ Task tool subagents
- ✅ Bash validators
- ✅ Adaptive supervisor
- ✅ Multi-device-aware (lock-based primary)
- Setup: install skill at `~/.claude/skills/mop-master/`, Git pull config, configure `vault-paths.yaml`

### 12.2 Claude Code (cloud sandbox)

- ✅ MOP active with adaptations
- ❌ No iCloud / vault access
- ✅ Task tool, bash
- ✅ Supervisor (in-session only)
- Output via `present_files` or Git push (sync_strategy in vault-paths.yaml)

### 12.3 Claude.ai Projects

- ✅ MOP single-agent variant
- ❌ No Task, no bash, no supervisor (in tool sense)
- ✅ Notion as primary state in this env
- ✅ Self-supervision via role-switch tags

### 12.4 OpenClaw / Cowork (Mac Studio)

- ✅ Full MOP via local Claude Code
- ✅ External watchdog cron (handles cross-session, cross-device concerns)
- ✅ Obsidian Git plugin syncs vault
- Watchdog: stuck runs, conflict files, stale locks, device registry

---

## §13. Integration with Existing Skills

(Unchanged from v3 §10. mop-master meta; workflow-optimization-engine + design-persist always co-loaded; domain skills selected after triage.)

---

## §14. Standard Output Blocks

### Triage (compressed v4)
```
[MOP T v4]
Run:    mop_20260508T180000Z_L_a3f9
Class:  L  Mode: Standard
Window: 12% / 40% target / 70% hard
Skills: mop-master, workflow-optimization-engine, swarm-pm
Est:    ~28K tokens, ~22 min, 3 Haiku tasks
Vault:  30-Operations/MOP/_active/mop_20260508T180000Z_L_a3f9/
Lock:   .lock owned by MS-M4
```

### Plan
```
[MOP PLAN]
Modules:
  M1 [tpl:data_extract]    [3C, ~6K]
  M2 [tpl:liquid_section]  [4C, ~10K]
  M3 [tpl:validator_run]   [3C, ~6K]
Est total: 22K (44% of 50K class L budget)
```

### Module accepted
```
[MOP M1 ✓] 5.8K tok | 3/3 critical, 1/1 nc | win 27% | 4m12s
```

### Compaction
```
[COMPACT] M1 closed | rel ~7K | win 27%→16%
```

### Supervisor (compact)
```
[SUP] M2.1 dispatched
[SUP] M2.1 OK (3 ticks, 6.5K, 31% win)
[SUP] M2.1 ✓ in 3m30s
```

### Handoff
```
[MOP HANDOFF]
Reason: window 36%, preemptive
Resume: "MOP resume mop_20260508T180000Z_L_a3f9"
Cost:   <1.5K tokens (loads Resume-Spec.md only)
```

### Delivery
```
[MOP DELIVERY]
Run:    mop_20260508T180000Z_L_a3f9 ✓
Tests:  3 dim PASS  Tokens: 22.4K/50K (55% headroom)
Split:  PM 30%  Haiku 65%  Sonnet 5%
Win peak: 38% (target <40% met)
Files:  <list>
Reports: Final-QA-Report.md  Token-Report.csv
Vault:  _archive/2026-05/<run-id>/
Next:   <suggestion>
```

---

## §15. Mandatory Startup Checklist (v4)

Class L+ session start:

```
[ ] Confirm Opus 4.7 active
[ ] Load mop-master + workflow-optimization-engine
[ ] Read userMemories
[ ] Read ~/.claude/mop/vault-paths.yaml
[ ] Check git status of ~/.claude/ config (pull if behind)
[ ] Check vault/_active/ for resumable runs OR concurrent writers
[ ] Update Device-Registry.md heartbeat
[ ] Verify --dangerously-skip-permissions in Code env
[ ] Output [MOP T v4] block
```

---

## §16. Versioning

- **v4.0** (2026-05-08) — Multi-device, adaptive supervisor, template-based delegation, tighter compaction
- v3.0 — Compaction, Obsidian-first, stability
- v2.0 — Triage, env-aware
- v1.0 — Concept

---

**END OF MOP v4.0**

> When in doubt: triage → templated dispatch → adaptive watch → silent-pass validate → vault record → Git for config, iCloud for vault, locks for safety.
