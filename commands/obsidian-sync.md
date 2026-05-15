---
description: "Sync Obsidian vault to GitHub — commits all changes with date-stamped message. Uses Haiku. Auto-runs at end of any workflow session. Usage: /obsidian-sync"
model: haiku
---

# Obsidian Vault Sync to GitHub

Syncs ~/Documents/Obsidian to github.com/CitizenZM/claude-obsidian-vault. Fast, cheap — uses Haiku by default.

## Steps

1. **Change to Obsidian directory**:
```bash
cd ~/Documents/Obsidian
```

2. **Check status** (summarize what changed):
```bash
git status --short
```

3. **Stage all changes**:
```bash
git add -A
```

4. **Commit with date-stamped message** describing what changed:
```bash
git commit -m "$(cat <<'EOF'
sync: Obsidian vault update $(date +%Y-%m-%d)

Workflow: xz429 Job Apply Tracking + ATS Applications
Changes: Updated application ledgers (Ashby/Greenhouse/Wellfound/WATAS), job tracker reports, workflow documentation

Auto-synced by /obsidian-sync (Haiku)
EOF
)"
```

5. **Push to GitHub**:
```bash
git push origin HEAD
```

6. **Report result**:
Print: `✅ Obsidian synced to GitHub — {N} files changed`

## Rules
- Never interactive — always push automatically
- If push fails (auth), report error and stop
- If nothing to commit, print `⏭ Obsidian already up to date` and exit
- Use Haiku model — this is a mechanical task, no LLM reasoning needed
