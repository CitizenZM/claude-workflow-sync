#!/usr/bin/env bash
# claude-workflow-sync/sync.sh
# Bidirectional sync between ~/.claude and GitHub remote.
# Usage: bash sync.sh [pull|push|status]
#   pull  → git pull then apply repo → ~/.claude (runs on session start)
#   push  → copy ~/.claude → repo then git push (runs on session stop)
#   status → show diff between local and repo

set -euo pipefail

SYNC_REPO="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
# Memory path mirrors HOME: /Users/xiaozuo → -Users-xiaozuo
MEMORY_SLUG="$(echo "$HOME" | sed 's|/|-|g')"
MEMORY_LOCAL="$CLAUDE_DIR/projects/$MEMORY_SLUG/memory"
MEMORY_REPO="$SYNC_REPO/memory"
LOG="$SYNC_REPO/.sync.log"

log() { echo "[$(date +%H:%M:%S)] [claude-sync] $*" | tee -a "$LOG"; }

# Custom skills = everything in skills/ NOT in marketplace-skills.txt
MARKETPLACE_SKILLS_FILE="$SYNC_REPO/marketplace-skills.txt"

sync_pull() {
  log "pull ← remote ($(hostname -s))"
  cd "$SYNC_REPO"

  # 1. Stash any uncommitted local repo changes, pull, restore
  git stash --quiet 2>/dev/null || true
  git pull --rebase origin main 2>/dev/null && log "git pull OK" || log "git pull failed (offline?)"
  git stash pop --quiet 2>/dev/null || true

  # 2. CLAUDE.md
  [ -f "$SYNC_REPO/CLAUDE.md" ] && cp "$SYNC_REPO/CLAUDE.md" "$CLAUDE_DIR/CLAUDE.md" && log "CLAUDE.md applied"

  # 3. skills/ — only custom (non-marketplace)
  mkdir -p "$CLAUDE_DIR/skills"
  if [ -d "$SYNC_REPO/skills" ]; then
    for skill_dir in "$SYNC_REPO/skills/"/*/; do
      skill_name=$(basename "$skill_dir")
      rsync -a --delete "$skill_dir" "$CLAUDE_DIR/skills/$skill_name/" 2>/dev/null
    done
    log "skills applied ($(ls "$SYNC_REPO/skills" | wc -l | tr -d ' ') dirs)"
  fi

  # 4. commands/
  if [ -d "$SYNC_REPO/commands" ]; then
    mkdir -p "$CLAUDE_DIR/commands"
    rsync -a "$SYNC_REPO/commands/" "$CLAUDE_DIR/commands/" 2>/dev/null
    log "commands applied ($(ls "$SYNC_REPO/commands" | wc -l | tr -d ' ') files)"
  fi

  # 5. memory/
  if [ -d "$MEMORY_REPO" ]; then
    mkdir -p "$MEMORY_LOCAL"
    rsync -a "$MEMORY_REPO/" "$MEMORY_LOCAL/" 2>/dev/null
    log "memory applied"
  fi

  # 6. rules/ (if present)
  if [ -d "$SYNC_REPO/rules" ]; then
    mkdir -p "$CLAUDE_DIR/rules"
    rsync -a "$SYNC_REPO/rules/" "$CLAUDE_DIR/rules/" 2>/dev/null
    log "rules applied"
  fi

  # 7. skills-lock.json → home dir
  [ -f "$SYNC_REPO/skills-lock.json" ] && cp "$SYNC_REPO/skills-lock.json" "$HOME/skills-lock.json" && log "skills-lock.json applied"

  log "pull complete"
}

sync_push() {
  log "push → remote ($(hostname -s))"
  cd "$SYNC_REPO"

  # 1. CLAUDE.md
  [ -f "$CLAUDE_DIR/CLAUDE.md" ] && cp "$CLAUDE_DIR/CLAUDE.md" "$SYNC_REPO/CLAUDE.md"

  # 2. skills/ — custom only (exclude marketplace skills)
  mkdir -p "$SYNC_REPO/skills"
  if [ -d "$CLAUDE_DIR/skills" ]; then
    for skill_dir in "$CLAUDE_DIR/skills/"/*/; do
      skill_name=$(basename "$skill_dir")
      # Skip marketplace skills
      if [ -f "$MARKETPLACE_SKILLS_FILE" ] && grep -qx "$skill_name" "$MARKETPLACE_SKILLS_FILE" 2>/dev/null; then
        continue
      fi
      rsync -a --delete "$skill_dir" "$SYNC_REPO/skills/$skill_name/" 2>/dev/null
    done
  fi

  # 3. commands/
  if [ -d "$CLAUDE_DIR/commands" ]; then
    mkdir -p "$SYNC_REPO/commands"
    rsync -a "$CLAUDE_DIR/commands/" "$SYNC_REPO/commands/" 2>/dev/null
  fi

  # 4. memory/
  if [ -d "$MEMORY_LOCAL" ]; then
    mkdir -p "$MEMORY_REPO"
    rsync -a "$MEMORY_LOCAL/" "$MEMORY_REPO/" 2>/dev/null
  fi

  # 5. skills-lock.json
  [ -f "$HOME/skills-lock.json" ] && cp "$HOME/skills-lock.json" "$SYNC_REPO/skills-lock.json"

  # 6. Commit and push
  git add -A
  if git diff --cached --quiet; then
    log "nothing changed — no push needed"
    return 0
  fi

  COMMIT_MSG="auto-sync: $(hostname -s) $(date '+%Y-%m-%d %H:%M')"
  git commit -m "$COMMIT_MSG"
  git push origin main 2>/dev/null && log "pushed to GitHub" || log "push failed (offline? retry next session)"
}

sync_status() {
  cd "$SYNC_REPO"
  echo "=== claude-workflow-sync status ==="
  echo "Repo:   $SYNC_REPO"
  echo "Branch: $(git branch --show-current)"
  echo "Remote: $(git log --oneline -1 origin/main 2>/dev/null || echo 'unknown')"
  echo "Local:  $(git log --oneline -1 HEAD 2>/dev/null || echo 'unknown')"
  echo ""
  git status --short
}

case "${1:-pull}" in
  pull)   sync_pull ;;
  push)   sync_push ;;
  status) sync_status ;;
  *)      echo "Usage: sync.sh [pull|push|status]"; exit 1 ;;
esac
