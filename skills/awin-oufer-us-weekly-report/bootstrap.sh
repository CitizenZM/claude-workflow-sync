#!/usr/bin/env bash
# bootstrap.sh — One-shot setup for awin-oufer-us-weekly-report on a fresh Mac.
#
# Run this on a NEW Mac to get the entire workflow working. Steps:
#   1. Verify prereqs (Python 3.9+, gh, vercel, node)
#   2. Clone skill into ~/.claude/skills/awin-oufer-us-weekly-report
#   3. Install Python + Node deps (python-docx, playwright, chromium browser)
#   4. Prompt for .env values
#   5. Verify gh + vercel auth
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/CitizenZM/awin-oufer-us-weekly-report-skill/main/bootstrap.sh | bash
#   # or after clone:
#   bash bootstrap.sh

set -euo pipefail

REPO_URL="https://github.com/CitizenZM/awin-oufer-us-weekly-report-skill.git"
SKILL_DIR="$HOME/.claude/skills/awin-oufer-us-weekly-report"

echo "════════════════════════════════════════════════════════════════"
echo "  awin-oufer-us-weekly-report — bootstrap"
echo "════════════════════════════════════════════════════════════════"

# ---- 1. prereqs (auto-install on macOS via Homebrew) ----
echo ""
echo "▸ [1/5] Verifying + installing prereqs..."

# 1a. Homebrew (foundation for everything else on macOS)
if ! command -v brew >/dev/null 2>&1; then
  echo "  · installing Homebrew (one-time, ~3 min)..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Add brew to PATH for this session (Apple Silicon vs Intel)
  if [ -x /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [ -x /usr/local/bin/brew ]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
fi
echo "  ✓ brew    ($(brew --version | head -1))"

# 1b. ensure_brew <pkg> <cmd-to-test>
ensure_brew() {
  local pkg="$1" cmd="$2"
  if command -v "$cmd" >/dev/null 2>&1; then
    echo "  ✓ $cmd"
  else
    echo "  · installing $pkg ..."
    brew install "$pkg" >/dev/null
    echo "  ✓ $cmd  (just installed)"
  fi
}

ensure_brew git    git
ensure_brew python python3
ensure_brew node   node          # node ships with npm
ensure_brew gh     gh

# 1c. vercel via npm (not in brew)
if ! command -v vercel >/dev/null 2>&1; then
  echo "  · installing vercel CLI globally via npm ..."
  npm install -g vercel >/dev/null 2>&1 || sudo npm install -g vercel
fi
echo "  ✓ vercel  ($(vercel --version 2>/dev/null | head -1))"

# 1d. ensure CLI auth (interactive — the user must complete these once)
if ! gh auth status >/dev/null 2>&1; then
  echo ""
  echo "  ▸ GitHub CLI not authenticated — launching gh auth login ..."
  gh auth login
fi
if ! vercel whoami >/dev/null 2>&1; then
  echo ""
  echo "  ▸ Vercel CLI not authenticated — launching vercel login ..."
  vercel login
fi

# ---- 2. clone ----
echo ""
echo "▸ [2/5] Installing skill to $SKILL_DIR ..."
mkdir -p "$HOME/.claude/skills"
if [ -d "$SKILL_DIR/.git" ]; then
  echo "  · skill already cloned — pulling latest"
  git -C "$SKILL_DIR" pull --rebase --quiet
else
  if [ -d "$SKILL_DIR" ]; then
    echo "  · backing up existing $SKILL_DIR → ${SKILL_DIR}.bak.$(date +%s)"
    mv "$SKILL_DIR" "${SKILL_DIR}.bak.$(date +%s)"
  fi
  git clone --quiet "$REPO_URL" "$SKILL_DIR"
fi

# ---- 3. deps ----
echo ""
echo "▸ [3/5] Installing Python + Node deps ..."
python3 -m pip install --quiet --upgrade pip
python3 -m pip install --quiet python-docx matplotlib playwright
python3 -m playwright install chromium

# ---- 4. .env ----
echo ""
echo "▸ [4/5] Configuring .env ..."
cd "$SKILL_DIR"
if [ -f .env ]; then
  echo "  · .env already exists — keeping it"
else
  cp .env.example .env
  echo "  · created .env from template — EDIT IT NOW with real values:"
  echo "      $SKILL_DIR/.env"
  echo "    Required: AWIN_EMAIL, AWIN_PASSWORD, REPORTS_GH_OWNER, REPORTS_GH_REPO"
  read -p "  Press Enter when .env is ready (or Ctrl-C to abort)..."
fi

# ---- 5. auth checks ----
echo ""
echo "▸ [5/5] Final auth verification ..."
gh auth status 2>&1 | head -3
echo "  vercel: $(vercel whoami 2>&1 | head -1)"

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  ✅ Setup complete."
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "  Inside Claude Code, activate the skill via:"
echo "    @awin-oufer-us-weekly-report  (mention)"
echo "    or just say:  '生成 Oufer 周报并发布'"
echo ""
echo "  Or run the publish pipeline directly:"
echo "    cd $SKILL_DIR"
echo "    bash scripts/publish.sh"
echo ""
