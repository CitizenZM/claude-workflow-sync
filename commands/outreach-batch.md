---
description: "Sequential multi-workflow outreach with ONE shared Opus supervisor. Token-saving vs per-workflow supervisor (~75% Opus reduction). Usage: /outreach-batch [count] [workflows_csv]"
model: haiku
---

## MODEL GATE
Requires **haiku** (frontmatter auto-routes). If running on Opus/Sonnet, STOP and tell user: `⛔ Wrong model — run /model haiku then re-run /outreach-batch`.

## Why this exists (token math)
- Baseline: each of N workflows spawns its own Opus supervisor → N × Opus-hours.
- This command spawns **ONE** shared supervisor used by all workflows sequentially → 1 × Opus-hour.
- Net: ~75% Opus-token reduction at N=4. Sonnet setup + Haiku bulk loop costs unchanged.

## HARNESS AUTONOMY (MANDATORY — read once, apply always)

You (the worker) are the full driver. These rules BIND for the entire batch, no exceptions:

1. **No permission prompts**: if a tool call requires confirmation, proceed. User has pre-approved everything listed in this command.
2. **No clarifying questions**: if an argument is missing, apply the default. If a state is ambiguous, pick the safer branch (dedup-heavier, dedup-unknown = skip) and log.
3. **No confirmation loops**: do NOT print "ready to proceed?" between workflows. Transition from one workflow to the next silently and immediately.
4. **No idle**: between batches, sleep ≤ 500ms. Between workflows, ≤ 2s. If a browser call hangs > 60s, treat as failed and invoke Auto-recovery.
5. **Keep going on partial failure**: a single workflow halting does NOT halt the batch. Mark that slug `halted` in the shared-supervisor JSON, move on to the next slug. Only halt the whole batch if the shared supervisor itself dies unrecoverably.
6. **Retry budget**: per workflow, 3 retries on transient failures (browser crash, selector miss, network). After 3, halt that workflow only.
7. **Never ask the user**: the only write-to-user output during the batch is the 2-line batch status every 10 proposals. Final summary is emitted at the end.
8. **Supervisor authority**: when the supervisor replies `halt` for a workflow, the worker halts THAT workflow only. When the supervisor replies `continue`, the worker does not re-ask; it continues.

If any of the above is violated, the supervisor will issue `halt` with `reason: "harness-breach"` — treat as a P0 bug.

## Parameters
- `count` (default `200`) — per-workflow target (proposals for Impact, invites for Awin).
- `workflows_csv` (default `impact-tcl-us,impact-ottocast,awin-rockbros-us,awin-rockbros-eu`) — comma-separated slugs in execution order. Omit `awin-oufer-us` by default.

## Shared-supervisor file protocol
Master writes `/tmp/outreach-shared-supervisor.json`:
```json
{
  "agent_id": "<id from Agent spawn>",
  "spawned_at": "<ISO-8601>",
  "workflows": ["impact-tcl-us", "impact-ottocast", "awin-rockbros-us", "awin-rockbros-eu"],
  "count_per_workflow": 200,
  "current_workflow": "<slug — updated at start of each workflow>",
  "completed": []
}
```
Each workflow's Step 0b (spawn supervisor) is SKIPPED when this file exists with a live `agent_id`. Checkpoint messages are prefixed with `[<slug>]` so the shared supervisor routes verdicts correctly.

## Step 0: Spawn shared Opus supervisor (ONCE)

0a. Check `/tmp/outreach-shared-supervisor.json`. If it exists, try a ping `SendMessage` with body `PING — are you alive?`. If supervisor responds, reuse and skip 0b–0d.

0b. Read `~/.claude/skills/_shared/outreach-supervisor-prompt.md`.

0c. Spawn Agent with:
- `subagent_type`: `general-purpose`
- `model`: `opus`
- `run_in_background`: `true`
- `description`: `Shared outreach supervisor (batch)`
- `prompt`: supervisor prompt + this addendum appended verbatim:

```
## MULTI-WORKFLOW ADDENDUM (BATCH MODE)
You are the SHARED supervisor for MULTIPLE workflows in one batch, run sequentially. Every checkpoint message from the worker is prefixed `[<slug>]` — use that slug to look up canonical bindings from `~/.claude/skills/_shared/workflow-registry.json` (ledger_path, checkpoint_path, debug_log_path, mcp_namespace).

On any checkpoint:
1. Parse `[<slug>]` prefix.
2. Read `workflows.<slug>` from the registry JSON. Use THOSE paths — do not confuse with another workflow's paths.
3. Read the checkpoint file for that slug. Validate per the standard protocol.
4. Append the verdict event to `workflows.<slug>.debug_log_path`.
5. Reply with compact JSON verdict: `{"verdict":"continue|pause|halt","reason":"...","fix":"...","slug":"<slug>"}`.

Do NOT self-terminate between workflows. Stay alive until the worker sends `BATCH COMPLETE — summarize`. At that point, produce a final JSON summary with per-workflow totals (proposals/invites, errors, term_verified rate, date_verified rate) and exit.
```

Also fill the following standard bindings with the first workflow's values (supervisor will re-bind per checkpoint based on slug prefix):
- workflow: `<first slug>`
- target_total: `<count>`
- ledger_path / checkpoint_path / mcp_namespace: from registry for that slug
- debug_log_path: `/tmp/outreach-<first slug>-debug.log`

0d. Write `/tmp/outreach-shared-supervisor.json` with the returned `agent_id`, spawn timestamp, the full workflow list, `count_per_workflow`, `current_workflow: null`, `completed: []`.

## Step 1..N: Execute each workflow sequentially

For each `slug` in the workflow list (in order):

### 1a. Update supervisor file
Edit `/tmp/outreach-shared-supervisor.json` → set `current_workflow: "<slug>"`.

### 1b. Run setup (reuse existing setup command, SKIP its supervisor spawn)
Read `~/.claude/commands/<slug>-setup.md`.
Execute every step EXCEPT `Step 0b. Spawn Opus supervisor (background)` — substitute: "Shared supervisor already spawned — agent_id is in `/tmp/outreach-shared-supervisor.json`. Do NOT spawn another Opus. Skip."

Run Step 0a (workflow isolation init), Step 1 (login), Step 2+ (navigate, filters, verification) inline with the MCP namespace from the registry.

### 1c. Run outreach loop (reuse existing outreach command, reuse shared supervisor)
Read `~/.claude/commands/<slug>-outreach.md`.
Execute all steps. When the command says "message the running supervisor" or "agent id from /…-setup":
- Use `agent_id` from `/tmp/outreach-shared-supervisor.json`
- Prefix every checkpoint ping with `[<slug>]` so the shared supervisor routes correctly
- Read verdicts from the supervisor's reply as usual
- Pass `count` arg = master's `count` parameter (default 200)

### 1d. Mark workflow complete
After the outreach command returns (session cap reached or next-page exhausted):
1. Append `<slug>` to `completed` array in `/tmp/outreach-shared-supervisor.json`.
2. Send progress ping to supervisor: `[<slug>] COMPLETE — proceeding to next workflow`.
3. Continue to next slug (no new browser needed — next workflow uses its own MCP namespace + profile).

## Step N+1: Shutdown

### Final summary request
Send supervisor: `BATCH COMPLETE — summarize: <len(workflows)> workflows × <count> target each. Emit per-workflow totals JSON.`

Read supervisor's final JSON.

### Consolidated report
Write `/Users/xiaozuo/Documents/Obsidian Vault/01-Projects/Outreach-Batch-Report-{TODAY}.md` (compute `new Date().toISOString().slice(0,10)` at runtime). Contents:
- Batch start/end timestamps + wall-clock per workflow
- Shared-supervisor agent_id + total checkpoint events processed (from combined debug logs)
- Per-workflow table: target | sent | unique | emails captured | errors | term_verified_rate | date_verified_rate
- Links to each workflow's individual session report + ledger
- Bugs observed this batch (one row per distinct fingerprint)
- Token-savings estimate (supervisors avoided × ~160K opus tokens each)

### Cleanup
Leave `/tmp/outreach-shared-supervisor.json` in place (audit trail) but mark `completed` list full and add `batch_ended_at`. The supervisor self-terminates after emitting its final summary.

## Auto-recovery
If the shared supervisor disappears mid-batch (unresponsive after 2 retries):
1. Log the failure + last checkpoint of the current workflow to `/tmp/outreach-shared-supervisor-crash-{TS}.json`.
2. Spawn a NEW shared supervisor (same prompt) ONCE, update `/tmp/outreach-shared-supervisor.json` with new `agent_id`.
3. Resume from the last saved `next_start` in the current workflow's checkpoint.
4. If the new supervisor also fails, halt the batch, write halt reason, stop.

## Per-workflow success-rate baselines (fail-closed thresholds)

The worker reports these fields to the supervisor on every checkpoint. The supervisor validates against these thresholds. Any workflow below threshold → supervisor emits a concrete fix (see supervisor prompt capability matrix + playbooks).

| Workflow | term_verified | date_verified | submit_confirmed | email_capture | min_partnerships | program/merchant gate |
|---|---|---|---|---|---|---|
| impact-tcl-us | ≥ 98% exact-match on `TCL US Standard Publisher Terms (5%)` | ≥ 90% | ≥ 95% iframe-removed | ≥ 30% real email | N/A | program 48321 exact |
| impact-ottocast | N/A (helper enforces) | N/A (helper enforces) | `OK|` prefix ≥ 95% | ≥ 30% real email | N/A | program 49590 exact (HARD HALT on mismatch) |
| awin-rockbros-us | N/A | N/A | ≥ 95% modal-closed + row-removed | 0% expected (script gap — tracked) | ≥ 50 | merchant 58007 exact |
| awin-rockbros-eu | N/A | N/A | ≥ 95% modal-closed + row-removed | 0% expected (script gap — tracked) | ≥ 50 | merchant 122456 exact |

If a workflow crosses below threshold mid-batch:
1. Worker includes the actual rate in the checkpoint JSON (`term_verified_rate`, `submit_confirmed_rate`, `email_capture_rate`)
2. Supervisor emits a verdict with a concrete `fix` (referencing a playbook in the supervisor prompt)
3. Worker applies the fix to the next batch (script patch, selector swap, re-inject helper, etc.) and retries ONCE
4. If still below threshold after retry → halt THIS workflow only, mark `halted` in the shared JSON, move to next workflow

## Shared-supervisor capability summary

The shared Opus supervisor lives at `~/.claude/skills/_shared/outreach-supervisor-prompt.md`. Read that file for the full contract. Key capabilities relevant here:

1. **Capability matrix (12 checks)** — walks every checkpoint through alive / batch-size / dedup / program-gate / term-verification / date-verification / commission / submit / email-extraction / error-repeat / pacing / ledger-append
2. **Per-workflow quality specs** — canonical term strings, canonical commission value, expected email-capture baseline per workflow
3. **Known-bug playbooks (6)** — preloaded fixes for:
   - TCL term substring leak (Bug #6)
   - TCL "I understand" false-positive success
   - Awin publisher-ID regex bug
   - Awin submit-verification gap
   - Ottocast program mismatch (always HALT)
   - Email extraction collapse
4. **Idle-run prevention** — if no checkpoint arrives in 5 min, probes the worker; halts after 8 min silence
5. **Active-fix mandate** — every non-continue verdict MUST contain a concrete one-line patch or `patch:<file>:<line>` marker. Never emits `fix:"investigate"` or `fix:"retry"` alone.

## Checkpoint message schema (sent by worker to supervisor every 10)

```json
{
  "slug": "impact-tcl-us",
  "batch_n": 3,
  "sent": 10,
  "errors": 0,
  "skipped": 0,
  "active_program_id": "48321",
  "rows": [{"name":"...","email":"...","termVerified":true,"termText":"TCL US Standard Publisher Terms (5%)","dateVerified":true,"submitConfirmed":true}],
  "rates": {
    "term_verified_rate": 1.0,
    "date_verified_rate": 0.9,
    "submit_confirmed_rate": 1.0,
    "email_capture_rate": 0.4
  },
  "error_samples": [],
  "next_start": 30,
  "session_total": 30,
  "target_total": 200,
  "ts": "2026-04-21T10:00:00Z"
}
```

Supervisor reply (≤ 200 chars unless patch):
```json
{"verdict":"continue","reason":"healthy","fix":null,"slug":"impact-tcl-us"}
```

## Rules
1. NEVER spawn a per-workflow supervisor — always reuse the shared one from `/tmp/outreach-shared-supervisor.json`
2. Workflows execute STRICTLY SEQUENTIALLY — never parallelize (parent context can't drive multiple browsers in one call chain)
3. FULLY AUTONOMOUS — see HARNESS AUTONOMY section above. No permission prompts, no user questions, no confirmation loops.
4. Token discipline: parent runs on Haiku, shared supervisor on Opus, setup delegated to existing Sonnet-routed commands (reuse their frontmatter)
5. Oufer is excluded by default — include only if user explicitly lists it in `workflows_csv`
6. Session markers: each workflow's ledger gets its own `<!-- session: ... batch=true run=<timestamp> -->` line so same-day batch reruns remain attributable
7. If any single workflow fails 3× without supervisor being able to patch, write its halt reason to the checkpoint, mark it `halted` in `completed` array, and MOVE ON to the next workflow — do not halt the whole batch
8. Every checkpoint MUST include the `rates` object (see schema above) so the supervisor can evaluate success-rate thresholds without re-parsing raw rows
9. The worker NEVER spawns a second Opus — all diagnostic work flows through the one shared supervisor. Recovery requests go via SendMessage, not Agent.
