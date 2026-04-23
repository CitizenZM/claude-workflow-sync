# Outreach Workflow Isolation Standard

Every affiliate outreach workflow MUST use a dedicated Playwright MCP server + Chrome profile so parallel workflows never collide. This file is the source of truth — individual SKILL.md / command .md files inherit from it.

## Canonical registry

Machine-readable: `~/.claude/skills/_shared/workflow-registry.json`
Script-validated: `init-workflow.sh` refuses to run if caller arguments disagree with the registry.

| Workflow | MCP Server | Profile Dir | Port | Tool Namespace |
|----------|-----------|-------------|------|----------------|
| awin-rockbros-us | `playwright-awin-rockbros-us` | `~/.claude/browser-profiles/awin-rockbros-us` | 9301 | `mcp__playwright-awin-rockbros-us__*` |
| awin-rockbros-eu | `playwright-awin-rockbros-eu` | `~/.claude/browser-profiles/awin-rockbros-eu` | 9302 | `mcp__playwright-awin-rockbros-eu__*` |
| awin-oufer-us    | `playwright-awin-oufer-us`    | `~/.claude/browser-profiles/awin-oufer-us`    | 9303 | `mcp__playwright-awin-oufer-us__*` |
| impact-ottocast  | `playwright-impact-ottocast`  | `~/.claude/browser-profiles/impact-ottocast`  | 9304 | `mcp__playwright-impact-ottocast__*` |
| impact-tcl-us    | `playwright-impact-tcl-us`    | `~/.claude/browser-profiles/impact-tcl-us`    | 9305 | `mcp__playwright-impact-tcl-us__*` |

## Activation

All 5 MCP servers are already registered in `~/.claude.json` under `mcpServers`. They auto-load at Claude Code startup — **no restart required between workflow runs**. A restart is only required the first time a new MCP server is added (or if `~/.claude.json` is edited manually).

Each server runs with `--cdp-endpoint http://localhost:930X`, so it connects to a Chrome instance launched by `init-workflow.sh` with the matching profile + debug port.

## Init sequence (first step of every setup command)

```bash
~/.claude/scripts/outreach/init-workflow.sh <slug> <mcp-name> <port>
```

Examples:
- `init-workflow.sh awin-rockbros-us playwright-awin-rockbros-us 9301`
- `init-workflow.sh impact-ottocast playwright-impact-ottocast 9304`

The script:
1. Validates caller arguments against `workflow-registry.json` (exit 3 if slug unknown, exit 4 if mcp/port disagree with registry).
2. Verifies the workflow-specific MCP is registered in `~/.claude.json` (exit 2 with JSON block if missing).
3. Ensures the profile directory exists.
4. Kills stale Chrome processes holding that profile or CDP port.
5. Launches Chrome with `--user-data-dir=<profile>` and `--remote-debugging-port=<port>`.
6. Verifies CDP responds on the port.

## Tool-namespace rule (non-negotiable)

Inside a workflow, ALL browser calls MUST use `mcp__<server>__*`. Never fall back to `mcp__playwright__*` (the generic server). If the workflow-specific MCP server is missing, STOP and instruct the user to register it — do NOT degrade to the shared server, because a second workflow could hijack it mid-run.

## Supervisor contract (inherited by every outreach workflow)

Every outreach setup command MUST spawn an Opus supervisor once per session, before the first browser action:
- Agent tool: `subagent_type: general-purpose`, `model: opus`, `run_in_background: true`
- Prompt: contents of `~/.claude/skills/_shared/outreach-supervisor-prompt.md` with bindings filled in (workflow, target_total, ledger_path, checkpoint_path, mcp_namespace)
- The outreach command re-uses this supervisor — it does NOT spawn additional Opus agents for per-batch audits, auto-recovery, or diagnosis. All Opus work flows through the single supervisor via messages.
- Checkpoint cadence: every 10 confirmed invites/proposals, the worker writes `/tmp/outreach-<slug>-checkpoint.json` and messages the supervisor for a verdict.
- Debug log: `/tmp/outreach-<slug>-debug.log` — the supervisor appends one JSON line per event.

**This contract is centrally enforced.** Individual workflows inherit it — they must NOT downgrade the model, disable the debug log, skip the supervisor, or spawn parallel Opus agents.

## Model policy (summary)

| Phase | Model | Reason |
|-------|-------|--------|
| Setup (login, filters, navigate) | Sonnet | Handles SSO + DOM edge cases |
| Outreach loop (batch invites/proposals) | Haiku | Mechanical loop — 10× cheaper than Sonnet |
| Supervisor (background) | Opus | One per session, continuous oversight |
| Auto-recovery | None new — delegate to running supervisor | Avoids duplicate Opus spawns |
| Context handoff | Haiku → Haiku | spawn fresh Haiku at 120K ctx; pass state file path |

Every setup command has `model: sonnet` in its frontmatter. Every outreach command has `model: haiku`. The supervisor is always Opus via the Agent tool. Deviations MUST be justified in the command file's frontmatter comment.
