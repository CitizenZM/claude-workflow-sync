#!/bin/bash
# Claude Greenhouse Workflow Setup — run on any machine
# Usage: bash setup.sh

set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "=== Claude Greenhouse Workflow Setup ==="
echo "Source: $REPO_DIR"

# 1. Skills
echo "[1/5] Installing skills..."
mkdir -p ~/.claude/skills/greenhouse-apply/{scripts,templates,data}
cp -r "$REPO_DIR/skills/greenhouse-apply/"* ~/.claude/skills/greenhouse-apply/

# 2. Commands
echo "[2/5] Installing commands..."
mkdir -p ~/.claude/commands
cp "$REPO_DIR/commands/greenhouse-"*.md ~/.claude/commands/

# 3. Rules
echo "[3/5] Installing rules..."
mkdir -p ~/.claude/rules/common
cp "$REPO_DIR/rules/common/essentials.md" ~/.claude/rules/common/

# 4. CLAUDE.md (skip if exists to avoid overwriting custom config)
echo "[4/5] Installing CLAUDE.md..."
if [ ! -f ~/.claude/CLAUDE.md ]; then
  cp "$REPO_DIR/CLAUDE.md" ~/.claude/
  echo "  -> Installed CLAUDE.md"
else
  echo "  -> ~/.claude/CLAUDE.md already exists, skipping (check manually)"
fi

# 5. Resume templates + ledger
echo "[5/5] Installing resume templates and ledger..."
mkdir -p ~/Downloads/resumeandcoverletter
cp "$REPO_DIR/resume-templates/"*.docx ~/Downloads/resumeandcoverletter/

# Ledger — try Obsidian path first, fallback to home
OBSIDIAN="/Volumes/workssd/ObsidianVault/01-Projects"
if [ -d "$OBSIDIAN" ]; then
  cp "$REPO_DIR/ledgers/Greenhouse-Application-Ledger.md" "$OBSIDIAN/"
  echo "  -> Ledger installed to $OBSIDIAN/"
else
  mkdir -p ~/greenhouse-data
  cp "$REPO_DIR/ledgers/Greenhouse-Application-Ledger.md" ~/greenhouse-data/
  echo "  -> Obsidian vault not found. Ledger installed to ~/greenhouse-data/"
  echo "  !! UPDATE the LEDGER_FILE path in skills/greenhouse-apply/SKILL.md"
fi

# 6. Check dependencies
echo ""
echo "=== Dependency Check ==="
command -v python3 >/dev/null && echo "✓ python3" || echo "✗ python3 — install it"
python3 -c "import docx" 2>/dev/null && echo "✓ python-docx" || echo "✗ python-docx — run: pip3 install python-docx"
command -v claude >/dev/null && echo "✓ claude CLI" || echo "✗ claude CLI — install from https://claude.ai/code"

echo ""
echo "=== Done ==="
echo "Next steps:"
echo "  1. Open Claude Code: claude"
echo "  2. Run: /greenhouse-setup    (login + build job queue)"
echo "  3. Run: /greenhouse-apply    (apply to jobs)"
