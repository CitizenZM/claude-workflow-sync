# MOP Self-Improving Learning Loop — Internals

> Implementation details for the 3-layer feedback system. SKILL.md §16 holds the concept and trigger rules; this file holds the formats, schemas, cron config, and flow diagram.

## Layer 1 — Per-response telemetry record format

`mop_stop_hook.py` appends to `~/.claude/mop/session-telemetry.jsonl`:

```json
{"ts": "2026-05-13T12:00:00", "tools": 4, "tool_names": ["Read","Edit","Bash"], "files_written": 1, "session_kb": 342}
```

No model tokens. Pure bash measurement. Accumulates automatically.

## Layer 2 — Run-Retrospective.md format (PM writes at delivery)

**MANDATORY at every `[MOP DELIVERY]`**. Write to vault archive dir. Format (≤300 tok):

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

Raw training data for Layer 3.

## Layer 3 — mop_learn.py usage

```bash
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

## Cron schedule (Mac Studio only)

```bash
# Every Sunday at 02:00 — runs mop_learn.py
0 2 * * 0 python3 /Users/xiaozuo/.claude/mop/mop_learn.py >> /Users/xiaozuo/.claude/mop/learn-cron.log 2>&1
```

## Closed-loop spec template improvement

When `mop_learn.py` finds a retrospective pattern like:
> "M2: spec was ambiguous on output schema — add concrete example next time"

It writes an improved default to `_templates/mvu/<type>.md` — so next time a module of that type is planned, the spec template already includes a concrete output schema example.

Over 10-20 runs:
- Fewer retries per module
- Higher first-pass validator pass rate
- Lower token cost per delivered output

## Flow diagram

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
