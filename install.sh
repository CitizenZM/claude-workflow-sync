#!/usr/bin/env bash
# claude-workflow-sync/install.sh
# One-time setup per machine. Run after cloning the repo.
# Usage: bash install.sh [--dry-run]

set -euo pipefail

DRY="${1:-}"
SYNC_REPO="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
MEMORY_SLUG="$(echo "$HOME" | sed 's|/|-|g')"
MEMORY_LOCAL="$CLAUDE_DIR/projects/$MEMORY_SLUG/memory"

run() {
  if [ "$DRY" = "--dry-run" ]; then echo "[DRY] $*"; else eval "$*"; fi
}

echo "=== Claude Workflow Sync — Machine Setup ==="
echo "Repo:    $SYNC_REPO"
echo "Machine: $(hostname -s)"
echo "Home:    $HOME"
echo ""

# 1. Apply latest from repo to ~/.claude
echo "[1/5] Applying brain from repo..."
run "bash \"$SYNC_REPO/sync.sh\" pull"

# 2. Add Stop hook to settings.json (push brain on every session end)
echo "[2/5] Adding Stop hook to settings.json..."
SETTINGS="$CLAUDE_DIR/settings.json"
HOOK_CMD="bash $SYNC_REPO/sync.sh push"

if [ -f "$SETTINGS" ]; then
  # Add hook only if not already present
  if ! grep -q "claude-workflow-sync" "$SETTINGS" 2>/dev/null; then
    python3 - <<PYEOF
import json, sys

with open("$SETTINGS") as f:
    cfg = json.load(f)

hook_entry = {
    "matcher": "",
    "hooks": [{"type": "command", "command": "$HOOK_CMD"}]
}

cfg.setdefault("hooks", {}).setdefault("Stop", [])
# Avoid duplicates
existing = [h for h in cfg["hooks"]["Stop"] if "claude-workflow-sync" in str(h)]
if not existing:
    cfg["hooks"]["Stop"].append(hook_entry)

with open("$SETTINGS", "w") as f:
    json.dump(cfg, f, indent=4)
print("  -> Stop hook added to settings.json")
PYEOF
  else
    echo "  -> Stop hook already present"
  fi
else
  # Create minimal settings.json with hook
  python3 - <<PYEOF
import json
cfg = {
    "hooks": {
        "Stop": [{"matcher": "", "hooks": [{"type": "command", "command": "$HOOK_CMD"}]}]
    }
}
import os; os.makedirs("$CLAUDE_DIR", exist_ok=True)
with open("$SETTINGS", "w") as f:
    json.dump(cfg, f, indent=4)
print("  -> settings.json created with Stop hook")
PYEOF
fi

# 3. Fish shell wrapper (auto-pull on `claude` invocation)
echo "[3/5] Installing Fish shell wrapper..."
FISH_FUNCS="$HOME/.config/fish/functions"
FISH_WRAPPER="$FISH_FUNCS/claude.fish"

if command -v fish >/dev/null 2>&1; then
  run "mkdir -p \"$FISH_FUNCS\""
  cat > /tmp/claude_wrapper.fish <<'FISH'
function claude
    bash __SYNC_REPO__/sync.sh pull 2>/dev/null
    command claude $argv
end
FISH
  sed "s|__SYNC_REPO__|$SYNC_REPO|g" /tmp/claude_wrapper.fish > /tmp/claude_wrapper_final.fish
  run "cp /tmp/claude_wrapper_final.fish \"$FISH_WRAPPER\""
  echo "  -> Fish wrapper installed at $FISH_WRAPPER"
else
  echo "  -> Fish not found, skipping fish wrapper"
fi

# 4. Zsh/Bash alias (fallback)
echo "[4/5] Installing shell alias (zsh/bash fallback)..."
ALIAS_LINE="alias claude='bash $SYNC_REPO/sync.sh pull 2>/dev/null && command claude'"
for rc in "$HOME/.zshrc" "$HOME/.bashrc"; do
  if [ -f "$rc" ] && ! grep -q "claude-workflow-sync" "$rc" 2>/dev/null; then
    run "echo '' >> \"$rc\""
    run "echo '# claude-workflow-sync auto-pull' >> \"$rc\""
    run "echo '$ALIAS_LINE' >> \"$rc\""
    echo "  -> Added alias to $rc"
  fi
done

# 5. Reinstall marketplace skills from skills-lock.json
echo "[5/5] Checking marketplace skills..."
if [ -f "$HOME/skills-lock.json" ]; then
  python3 - <<PYEOF
import json, subprocess, os, sys

lock = json.load(open(os.path.expanduser("~/skills-lock.json")))
skills_dir = os.path.expanduser("~/.claude/skills")
reinstalled = []

for skill_name, info in lock.get("skills", {}).items():
    skill_path = os.path.join(skills_dir, skill_name)
    if not os.path.exists(skill_path):
        source = info.get("source", "")
        if source:
            print(f"  -> Installing {skill_name} from {source}...")
            try:
                subprocess.run(["claude", "skill", "install", source, "--yes"],
                               capture_output=True, timeout=60)
                reinstalled.append(skill_name)
            except Exception as e:
                print(f"     [warn] {e}")

if not reinstalled:
    print("  -> All marketplace skills already installed")
else:
    print(f"  -> Installed: {', '.join(reinstalled)}")
PYEOF
else
  echo "  -> skills-lock.json not found, skipping marketplace reinstall"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Sync behavior:"
echo "  • Session START  → Fish/alias runs 'sync.sh pull' (pulls from GitHub)"
echo "  • Session STOP   → Stop hook runs 'sync.sh push' (pushes to GitHub)"
echo "  • Manual sync:   bash $SYNC_REPO/sync.sh [pull|push|status]"
echo ""
echo "All 3 machines will auto-converge after each Claude Code session."
