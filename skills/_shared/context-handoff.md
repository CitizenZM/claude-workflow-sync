# Context Handoff Reference (Haiku outreach workers)

Shared protocol for any Haiku outreach worker that needs to hand off to a fresh Haiku agent when its context window fills. Individual workflow SKILL.md files reference this file.

## Why

Haiku has a ~200K token context. Each `browser_evaluate` batch returns a full page YAML snapshot (~74KB = ~18K tokens). After 7–8 batches the worker silently fails or halts. A proactive handoff at 60% utilization (120K tokens) keeps the loop running cleanly across fresh Haiku instances while reusing the same Opus supervisor.

## Context budget formula

Track `ctx_tokens` as an integer starting at 0 at the beginning of the worker's loop.

| Operation | Cost |
|-----------|------|
| `browser_evaluate` (batch invite/action) | +20000 |
| `browser_snapshot` | +5000 |
| Other tool calls (Read, Bash grep/tail, SendMessage) | negligible — do not track |

**Handoff trigger**: `ctx_tokens >= 120000` (60% of 200K). At that threshold, finish the current batch, write state, spawn a fresh Haiku, and STOP.

## Handoff state schema

File: `/tmp/outreach-<workflow>-state.json`

```json
{
  "session_total": 120,
  "next_start": 121,
  "batch_n": 6,
  "workflow": "awin-oufer-us",
  "supervisor_id_path": "/tmp/outreach-awin-oufer-us-supervisor-id.txt"
}
```

| Field | Meaning |
|-------|---------|
| `session_total` | Total confirmed invites/proposals sent in this session across all Haiku generations |
| `next_start` | 1-based index of the next invite to attempt (resume point) |
| `batch_n` | Sequence number of the next batch (for debug log correlation) |
| `workflow` | Workflow slug, matches the registry in `workflow-registry.json` |
| `supervisor_id_path` | Path to the file holding the persistent Opus supervisor agent ID |

## State file path pattern

`/tmp/outreach-<workflow>-state.json`

Examples:
- `/tmp/outreach-awin-oufer-us-state.json`
- `/tmp/outreach-awin-rockbros-us-state.json`
- `/tmp/outreach-impact-ottocast-state.json`

## Fresh Haiku bootstrap prompt template

When spawning the fresh Haiku via the Agent tool (`subagent_type: general-purpose`, `model: haiku`), use this prompt (fill in angle-bracket values):

```
Resume <workflow> outreach. Read state from /tmp/outreach-<workflow>-state.json.
Supervisor ID: <supervisor_id from /tmp/outreach-<workflow>-supervisor-id.txt>.
Read SKILL.md at /Users/xiaozuo/.claude/skills/<workflow>-outreach/SKILL.md for full instructions.
Prime dedup from last 300 lines of ledger only (see Dedup Trim Rule in SKILL.md).
Continue from next_start. Track ctx_tokens from 0. Hand off again at 120000.
Reuse the existing Opus supervisor via SendMessage — do NOT spawn a new one.
```

## Handoff checklist (for the outgoing Haiku)

1. Finish current batch, update `session_total` and `next_start`.
2. `echo '{"session_total": N, "next_start": N, "batch_n": N, "workflow": "<slug>", "supervisor_id_path": "/tmp/outreach-<slug>-supervisor-id.txt"}' > /tmp/outreach-<slug>-state.json`
3. Optionally refresh `/tmp/<slug>-dedup-current.json` with the current in-memory dedup Set (last 300 names).
4. Send a final checkpoint to the Opus supervisor via `SendMessage` noting "handoff triggered at ctx_tokens=<n>".
5. Spawn fresh Haiku with the bootstrap prompt above.
6. STOP. Do not run further batches in the current context.

## Incoming Haiku checklist

1. Read `/tmp/outreach-<slug>-state.json`.
2. Read supervisor ID from `supervisor_id_path`.
3. Load SKILL.md.
4. Prime dedup: `tail -300 <ledger> | grep '|<merchant_id>$' | cut -d'|' -f1` → feed to `prime-dedup.js`.
5. Set `ctx_tokens = 0`.
6. Resume at `next_start`, incrementing `batch_n` each batch.
