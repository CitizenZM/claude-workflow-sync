# Outreach Workflow Isolation Standard

Every affiliate / application outreach workflow MUST use a dedicated Playwright MCP server + browser profile so parallel workflows do not collide.

## Supervisor contract (applies to ALL outreach workflows — no per-workflow opt-out)

Every outreach **setup** command MUST spawn an Opus supervisor before the first browser action:
- Agent: `subagent_type: general-purpose`, `model: opus`, `run_in_background: true`
- Prompt: `~/.claude/skills/_shared/outreach-supervisor-prompt.md`
- Debug: ON by default — supervisor appends JSON events to `/tmp/outreach-<workflow>-debug.log` on every checkpoint, verdict, crash, halt, resume, and patch event (schema in the supervisor prompt)
- Checkpoint cadence: every 10 confirmed invites/proposals, worker writes `/tmp/outreach-<workflow>-checkpoint.json` and messages the supervisor for a verdict
- Standalone outreach commands (no matching setup run in this session): re-spawn the supervisor using the same contract before Step 0

This contract is enforced centrally by the shared supervisor prompt. Individual commands inherit it — they must NOT downgrade the model, disable debug, skip the supervisor, or spawn redundant per-batch Opus agents (the background supervisor already handles batch reviews via the checkpoint file).

**Single-source rule.** If a command file restates the supervisor mechanism, it must only restate the *interface* (checkpoint path, cadence, verdict semantics) and defer all logic to this shared file. Do not duplicate Opus spawn blocks.

## Model assignment (cheapest viable per stage — enforced in command frontmatter)

| Stage | Model | Why |
|-------|-------|-----|
| Login / filter setup / JD parsing | `sonnet` | Handles SSO edge cases, page layout variance, reasoning |
| Bulk invite / bulk propose / pagination loop | `haiku` | Mechanical, deterministic — 10-20× cheaper at identical output |
| Supervisor (background) | `opus` | Only spawned once per run; reviews batches; catches DOM rot |
| Weekly / session reports | `haiku` | Aggregation + Markdown formatting only |

Every command MUST declare its model in YAML frontmatter. A MODEL GATE at the top of the command must abort if the current session model is heavier than declared.

## Registry (canonical — do NOT drift)

| Workflow | MCP Server | Profile Dir | Port |
|----------|-----------|-------------|------|
| default (manual)  | `playwright`                  | `~/.claude/browser-profiles/default`         | 9300 |
| awin-rockbros-us  | `playwright-awin-rockbros-us` | `~/.claude/browser-profiles/awin-rockbros-us`| 9301 |
| awin-rockbros-eu  | `playwright-awin-rockbros-eu` | `~/.claude/browser-profiles/awin-rockbros-eu`| 9302 |
| awin-oufer-us     | `playwright-awin-oufer-us`    | `~/.claude/browser-profiles/awin-oufer-us`   | 9303 |
| impact-ottocast   | `playwright-impact-ottocast`  | `~/.claude/browser-profiles/impact-ottocast` | 9304 |
| impact-tcl-us     | `playwright-impact-tcl-us`    | `~/.claude/browser-profiles/impact-tcl-us`   | 9305 |
| wellfound         | `playwright-wellfound`        | `~/.claude/browser-profiles/wellfound`       | 9306 |
| greenhouse        | `playwright-greenhouse`       | `~/.claude/browser-profiles/greenhouse`      | 9307 |

The JSON source of truth is `~/.claude/scripts/outreach/workflow-registry.json`. The MCP registrations live in `~/.claude.json` under `mcpServers` and MUST match the registry by name, port, and user-data-dir. `init-workflow.sh` verifies both files match on every setup run.

## Activation model (no-restart guarantee)

Once an MCP server is registered in `~/.claude.json`, **Claude Code auto-starts it on the first tool call** for that server. You do NOT need to restart Claude Code each time a workflow starts. The only time a restart is required is when a *brand new* MCP server is being added to `~/.claude.json` for the first time — and that is a one-time operation per workflow.

All 8 workflows in the registry above are already registered and active.

## Init sequence (first step of every setup command)

```bash
~/.claude/scripts/outreach/init-workflow.sh <slug> <mcp-name> <port>
```

The script:
1. Verifies the caller args match the canonical registry.
2. Verifies `~/.claude.json` has the MCP registered with matching port + profile.
3. Creates the profile dir if missing (idempotent).
4. Kills any stale Chrome process bound to that profile.
5. Kills any stale `@playwright/mcp` process holding that port (safe: only kills playwright-mcp, never unrelated services).
6. Prints `[init] ready — tools: mcp__<mcp-name>__*`.

Exit codes: 2 (MCP not registered), 3 (workflow not in registry), 4/5/6 (drift). On any non-zero exit, surface the error and STOP — do not fall back to the generic `playwright` server.

## Mid-session MCP recovery (no restart)

If the workflow-specific MCP dies mid-session (rare — typically only happens if Chromium crashes and takes the MCP with it):
1. Run `init-workflow.sh` again to clear stale port/profile locks.
2. Call any tool in the `mcp__<server>__*` namespace — Claude Code re-spawns the MCP on demand.
3. Supervisor logs the `resume` event automatically.

No Claude Code restart required.

## Tool-namespace rule

Inside a workflow, ALL browser calls MUST use `mcp__<server>__*`. Never fall back to `mcp__playwright__*` (the generic server). If the workflow-specific MCP server is missing, stop and fix registration — do NOT degrade to the shared server, because a second workflow could hijack the generic profile.

## Zero-duplication checklist (for command authors)

A command file is clean if:
- [x] Declares `model:` in frontmatter matching the stage table above.
- [x] MODEL GATE checks current model at top of body.
- [x] "MCP SERVER — MANDATORY" block names the correct `mcp__<server>__*` namespace exactly once.
- [x] References the Supervisor contract by pointing to this file — does NOT restate the prompt body or spawn rules.
- [x] Checkpoint write + supervisor message is the ONLY batch-review mechanism (no parallel per-batch Opus agent spawns).
- [x] Uses `init-workflow.sh` as Step 0 of any *setup* command.
- [x] Does NOT tell the user to restart Claude Code for already-registered MCPs.
