#!/usr/bin/env bash
# bootstrap.sh — one-line install on a fresh Mac
#
# Usage:
#   bash <(curl -fsSL https://raw.githubusercontent.com/CitizenZM/claude-workflow-sync/main/bootstrap.sh)
#
# What it does:
#   1. Clones claude-workflow-sync → ~/Developer/claude-workflow-sync
#   2. Runs install.sh (applies ~/.claude brain + hooks)
#   3. Clones barrons-obsidian-vault → $OBSIDIAN_VAULT (default: ~/ObsidianVault)
#      Override: OBSIDIAN_VAULT=/custom/path bash bootstrap.sh

set -euo pipefail

SYNC_REPO_URL="https://github.com/CitizenZM/claude-workflow-sync.git"
VAULT_REPO_URL="https://github.com/CitizenZM/barrons-obsidian-vault.git"
SYNC_LOCAL="${CLAUDE_WORKFLOW_SYNC:-$HOME/Developer/claude-workflow-sync}"
# Vault defaults to ~/ObsidianVault on fresh Mac (no external SSD assumed)
VAULT_LOCAL="${OBSIDIAN_VAULT:-$HOME/ObsidianVault}"

echo "======================================"
echo "  Claude Workflow Sync — Bootstrap"
echo "======================================"
echo "  claude-workflow-sync → $SYNC_LOCAL"
echo "  obsidian-vault       → $VAULT_LOCAL"
echo ""

# 1. Clone or update claude-workflow-sync
if [ -d "$SYNC_LOCAL/.git" ]; then
  echo "[1/3] claude-workflow-sync already cloned — pulling latest..."
  git -C "$SYNC_LOCAL" pull --rebase origin main
else
  echo "[1/3] Cloning claude-workflow-sync..."
  mkdir -p "$(dirname "$SYNC_LOCAL")"
  git clone "$SYNC_REPO_URL" "$SYNC_LOCAL"
fi

# 2. Run install.sh (applies brain to ~/.claude + installs hooks)
echo ""
echo "[2/3] Running install.sh..."
bash "$SYNC_LOCAL/install.sh"

# 3. Clone or update Obsidian vault
echo ""
echo "[3/3] Setting up Obsidian vault at $VAULT_LOCAL..."
if [ -d "$VAULT_LOCAL/.git" ]; then
  echo "  -> Already cloned — pulling latest..."
  git -C "$VAULT_LOCAL" pull --rebase origin main
else
  git clone "$VAULT_REPO_URL" "$VAULT_LOCAL"
  echo "  -> Cloned to $VAULT_LOCAL"
fi

# If vault is on external SSD path, also update sync.sh VAULT_DIR reference
if [ "$VAULT_LOCAL" != "/Volumes/workssd/ObsidianVault" ]; then
  echo ""
  echo "  NOTE: Vault path differs from SSD default."
  echo "  Add to your shell profile:"
  echo "    export OBSIDIAN_VAULT=\"$VAULT_LOCAL\""
fi

echo ""
echo "======================================"
echo "  Bootstrap Complete!"
echo "======================================"
echo ""
echo "  Skills:   $(ls "$HOME/.claude/skills" 2>/dev/null | wc -l | tr -d ' ') installed"
echo "  Commands: $(ls "$HOME/.claude/commands" 2>/dev/null | wc -l | tr -d ' ') installed"
echo "  Vault:    $VAULT_LOCAL"
echo ""
echo "  Auto-sync behavior:"
echo "  • Session START → pulls latest brain from GitHub"
echo "  • Session STOP  → pushes changes back to GitHub"
echo ""
echo "  Open Claude Code:  claude"
