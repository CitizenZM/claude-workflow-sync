# MOP Auto-Sync — Internals

> Implementation details for GitHub autosync. SKILL.md §17 holds the rule + threshold; this file holds the mechanics, conflict handling, and ops.

## Repos synced

| Repo | Path | Contents |
|------|------|----------|
| `claude-config` | `~/Documents/Claude/config/` | SKILL.md, hook scripts, machine-settings, bootstrap, settings-template |
| `claude-obsidian-vault` | `~/Documents/Obsidian/` | MOP run records, project notes, outreach ledgers, retrospectives |

## Algorithm (per repo, every Stop hook)

`~/.claude/mop/mop_autosync.py` runs detached via `mop_stop_chain.sh`:

1. Check `git status --porcelain` — if no changes, skip (zero cost)
2. Count changed files. If `< MIN_CHANGES (3)` and not `--force`/`--daily` → skip
3. Otherwise: `git add -A` → auto-commit with summarized message → `git pull --rebase --autostash` → `git push`
4. Throttle: 60s minimum between pushes per repo (prevents spam on rapid edits)
5. Detached background process — does not block Claude's response

**Commit message format**: `auto-sync: <N> files in <top-dirs> [<hostname>]`

## Trigger matrix

| Trigger | Threshold | Behavior |
|---------|-----------|----------|
| Stop hook (every response) | ≥3 changes | Commit + push if threshold met; otherwise accumulate |
| Daily cron 02:00 (Mac Studio) | None (`--daily` flag) | Flush any pending changes regardless of count |
| Manual default | ≥3 changes | Same as Stop hook |
| Manual `--force` | None | Commit + push any single change |

**Rationale for threshold**: Stop hook fires after every Claude response, but most responses change 0-2 files (e.g. just reading code, just answering a question). Committing every single small change creates noisy git history. The threshold ensures commits reflect meaningful work units while the daily cron guarantees nothing is lost.

**Override** for immediate sync (e.g. before switching machines mid-task):
```bash
python3 ~/.claude/mop/mop_autosync.py --force
```

**Workflow rule for all workflows running under MOP**: Workflows that produce frequent small writes (e.g. outreach loops writing 1 row per invite) should rely on the threshold — daily cron syncs accumulated work. Workflows that produce critical artifacts (e.g. weekly reports, run retrospectives) should call `mop_autosync.py --force` at end-of-workflow to push immediately.

## Conflict resolution

`git pull --rebase --autostash` runs before every push. If two devices commit concurrently:
- First device: pushes cleanly
- Second device: pulls + rebases auto-stashed changes → pushes
- iCloud sync is the secondary path; git is authoritative

## What does NOT sync

Excluded via `.gitignore` in each repo:
- `*.env`, `*credentials*`, `*-secret.*`, `*.pem`, `*.key`
- `__pycache__/`, `node_modules/`, `.cache/`
- `.DS_Store`, `*.swp`, `*.bak`
- Obsidian workspace state (`.obsidian/workspace.json`) — UI state, not content

## Cross-device flow

```
Device A finishes work → Stop hook → autosync push → GitHub
                                                       ↓
Device B opens session → autosync pull (via daily cron or manual) ← GitHub
Device B starts work → has Device A's changes
```

Daily cron + per-response push = effective continuous sync. Adding `git pull` to a session-start hook would close the loop further (planned).

## Verifying autosync is working

```bash
tail ~/.claude/mop/autosync.log          # Recent sync activity
git -C ~/Documents/Claude/config log -3  # Recent config commits
git -C ~/Documents/Obsidian log -3       # Recent vault commits
crontab -l | grep mop                    # Daily cron present
```
