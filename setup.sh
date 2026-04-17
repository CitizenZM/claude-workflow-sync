#!/bin/bash
# Claude Workflow Sync — run on any machine to install all skills and commands
# Usage: bash setup.sh

set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "=== Claude Workflow Sync Setup ==="
echo "Source: $REPO_DIR"

# 1. Skills
echo "[1/4] Installing skills..."
for skill_dir in "$REPO_DIR/skills/"/*/; do
  skill_name=$(basename "$skill_dir")
  mkdir -p ~/.claude/skills/"$skill_name"
  cp -r "$skill_dir"* ~/.claude/skills/"$skill_name"/
  echo "  -> $skill_name"
done

# 2. Commands
echo "[2/4] Installing commands..."
mkdir -p ~/.claude/commands
cp "$REPO_DIR/commands/"*.md ~/.claude/commands/
echo "  -> $(ls "$REPO_DIR/commands/"*.md | wc -l | tr -d ' ') commands installed"

# 3. Rules
echo "[3/4] Installing rules..."
mkdir -p ~/.claude/rules/common
if [ -f "$REPO_DIR/rules/common/essentials.md" ]; then
  cp "$REPO_DIR/rules/common/essentials.md" ~/.claude/rules/common/
  echo "  -> essentials.md"
fi

# 4. CLAUDE.md (skip if exists)
echo "[4/4] CLAUDE.md..."
if [ ! -f ~/.claude/CLAUDE.md ]; then
  cp "$REPO_DIR/CLAUDE.md" ~/.claude/
  echo "  -> Installed"
else
  echo "  -> Already exists, skipping (check manually)"
fi

# 5. Ledgers — install to home directory
echo ""
echo "[+] Installing ledgers..."
for ledger in "$REPO_DIR/ledgers/"*.md; do
  fname=$(basename "$ledger")
  cp "$ledger" ~/
  echo "  -> ~/$fname"
done

echo ""
echo "=== Dependency Check ==="
command -v python3 >/dev/null && echo "✓ python3" || echo "✗ python3 — install it"
command -v node >/dev/null && echo "✓ node" || echo "✗ node — install from nodejs.org"
command -v claude >/dev/null && echo "✓ claude CLI" || echo "✗ claude CLI — install from https://claude.ai/code"

echo ""
echo "=== Done ==="
echo ""
echo "=== TCL US Affiliate Outreach Workflow ==="
echo "  1. Open Claude Code:  claude"
echo "  2. Switch to Sonnet:  /model sonnet   (required for setup)"
echo "  3. Run setup:         /impact-tcl-us-setup"
echo "  4. Switch to Haiku:   /model haiku     (required for outreach loop)"
echo "  5. Run outreach:      /impact-tcl-us-outreach"
echo "  Ledger: ~/impact-tcl-us-ledger.md"
echo ""
echo "=== Awin RockBros Outreach ==="
echo "  US: /awin-rockbros-us-setup → /awin-rockbros-us-outreach"
echo "  EU: /awin-rockbros-eu-setup → /awin-rockbros-eu-outreach"
echo ""
echo "=== Awin Oufer US Outreach ==="
echo "  /awin-oufer-us-setup → /awin-oufer-us-outreach"
