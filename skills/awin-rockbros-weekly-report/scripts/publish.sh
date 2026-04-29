#!/usr/bin/env bash
# publish.sh — END-TO-END pipeline for Rockbros simplified weekly report
#
# Steps:
#   1. Render DOCX + HTML + PDF + Obsidian Markdown from rockbros_simple_data.json
#   2. Stage HTML/PDF/screenshots into local git checkout of REPORTS_GH_REPO
#   3. Commit + push to GitHub (private repo)
#   4. Vercel deploy (production) → DELETE auto-created vanity aliases
#   5. Print final SSO-protected hash URL
#
# Usage (from skill root):
#   bash scripts/publish.sh                 # uses today's date
#   bash scripts/publish.sh --date 2026-04-16
#   bash scripts/publish.sh --skip-vercel
#   bash scripts/publish.sh --skip-github

set -euo pipefail

SKILL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SKILL_ROOT"

# ---- load .env ----
if [ ! -f .env ]; then
  echo "❌ .env missing. Copy .env.example → .env and fill in." >&2
  exit 1
fi
set -a
. ./.env
set +a

# ---- args ----
REPORT_DATE="$(date +%F)"
SKIP_VERCEL=0
SKIP_GITHUB=0
DATA_FILE="output/rockbros_simple_data.json"
EMAIL_INTEL_FILE="output/rockbros_email_intel.json"
SCRUB=0
while [ $# -gt 0 ]; do
  case "$1" in
    --date) REPORT_DATE="$2"; shift 2 ;;
    --data) DATA_FILE="$2"; shift 2 ;;
    --email-intel) EMAIL_INTEL_FILE="$2"; shift 2 ;;
    --scrub) SCRUB=1; shift ;;
    --skip-vercel) SKIP_VERCEL=1; shift ;;
    --skip-github) SKIP_GITHUB=1; shift ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [ ! -f "$DATA_FILE" ]; then
  echo "❌ data file not found: $DATA_FILE" >&2
  echo "   Run the scrape phase first (see SKILL.md → 抓数据)." >&2
  exit 1
fi

BASE="Rockbros-简化周报-${REPORT_DATE}"
echo "════════════════════ ROCKBROS WEEKLY PUBLISH ════════════════════"
echo "  date     : $REPORT_DATE"
echo "  data     : $DATA_FILE"
echo "  out dir  : ${OUTPUT_DIR}"
echo "  obsidian : ${OBSIDIAN_DIR:-skip}"
echo "  github   : $([ $SKIP_GITHUB -eq 1 ] && echo skip || echo "${REPORTS_GH_OWNER}/${REPORTS_GH_REPO}")"
echo "  vercel   : $([ $SKIP_VERCEL -eq 1 ] && echo skip || echo "${VERCEL_PROJECT_NAME}")"
echo ""

# ────────────────── STEP 1: render 4 formats ──────────────────
echo "▸ [1/4] Rendering DOCX + HTML + PDF + Markdown..."
OBSIDIAN_ARG=()
[ -n "${OBSIDIAN_DIR:-}" ] && OBSIDIAN_ARG=(--obsidian-dir "$OBSIDIAN_DIR")
INTEL_ARG=()
[ -f "$EMAIL_INTEL_FILE" ] && INTEL_ARG=(--email-intel "$EMAIL_INTEL_FILE")
SCRUB_ARG=()
[ "$SCRUB" -eq 1 ] && SCRUB_ARG=(--scrub)
python3 scripts/generate_simple_report.py \
  --data "$DATA_FILE" \
  --out-dir "$OUTPUT_DIR" \
  --date "$REPORT_DATE" \
  "${INTEL_ARG[@]}" \
  "${SCRUB_ARG[@]}" \
  "${OBSIDIAN_ARG[@]}"

DOCX="${OUTPUT_DIR}/${BASE}.docx"
HTML="${OUTPUT_DIR}/${BASE}.html"
PDF="${OUTPUT_DIR}/${BASE}.pdf"
echo "  ✓ DOCX : $DOCX"
echo "  ✓ HTML : $HTML"
echo "  ✓ PDF  : $PDF"
echo ""

# ────────────────── STEP 2+3: GitHub sync ──────────────────
if [ $SKIP_GITHUB -eq 0 ]; then
  echo "▸ [2/4] Syncing to GitHub: ${REPORTS_GH_OWNER}/${REPORTS_GH_REPO}"
  REPO_DIR="${HOME}/.cache/awin-weekly-reports"
  mkdir -p "$(dirname "$REPO_DIR")"

  if [ ! -d "$REPO_DIR/.git" ]; then
    echo "  · cloning repo to $REPO_DIR (first run)..."
    rm -rf "$REPO_DIR"
    gh repo clone "${REPORTS_GH_OWNER}/${REPORTS_GH_REPO}" "$REPO_DIR" -- -q
  else
    echo "  · pulling latest..."
    git -C "$REPO_DIR" pull --quiet --rebase
  fi

  TARGET="$REPO_DIR/reports/${REPORT_DATE}"
  mkdir -p "$TARGET/attachments"
  cp "$HTML" "$TARGET/index.html"
  cp "$HTML" "$REPO_DIR/index.html"        # also update root pointer to latest
  cp "$PDF"  "$TARGET/${BASE}.pdf"

  # Copy raw screenshots
  for img in us_home eu_home us_publishers_full eu_publishers_full; do
    src="${SKILL_ROOT}/output/${img}.png"
    [ -f "$src" ] && cp "$src" "$TARGET/attachments/"
  done

  # Copy Gmail-scraped attachments (IOs, SoWs, contracts, brand assets)
  if [ -d "${SKILL_ROOT}/output/attachments" ]; then
    find "${SKILL_ROOT}/output/attachments" -maxdepth 1 -type f -print0 | \
      xargs -0 -I{} cp "{}" "$TARGET/attachments/" 2>/dev/null || true
    att_count=$(find "$TARGET/attachments" -maxdepth 1 -type f | wc -l | tr -d ' ')
    echo "  · copied $att_count attachment(s) into reports/${REPORT_DATE}/attachments/"
  fi

  git -C "$REPO_DIR" add -A
  if git -C "$REPO_DIR" diff --cached --quiet; then
    echo "  · no changes vs remote — skipping commit."
  else
    git -C "$REPO_DIR" \
      -c user.email="${GIT_AUTHOR_EMAIL:-barronzuo@gmail.com}" \
      -c user.name="${GIT_AUTHOR_NAME:-Barron Zuo}" \
      commit -q -m "report: Rockbros simplified weekly ${REPORT_DATE}

- HTML / PDF / 4 screenshots
- Publisher emails scrubbed
- Auto-published by awin-rockbros-weekly-report skill"
    git -C "$REPO_DIR" push --quiet
    echo "  ✓ pushed to GitHub"
  fi
  GH_URL="https://github.com/${REPORTS_GH_OWNER}/${REPORTS_GH_REPO}/blob/main/reports/${REPORT_DATE}/index.html"
  echo "  · GitHub viewer: $GH_URL"
  echo ""
else
  echo "▸ [2/4] GitHub sync — SKIPPED"
  echo ""
fi

# ────────────────── STEP 4: Vercel deploy + lock down ──────────────────
if [ $SKIP_VERCEL -eq 0 ] && [ -n "${VERCEL_PROJECT_NAME:-}" ]; then
  echo "▸ [3/4] Deploying to Vercel..."
  if [ ! -d "${REPO_DIR:-}/.git" ]; then
    echo "  ⚠️  no local repo — skipping Vercel deploy"
  else
    cd "$REPO_DIR"
    # Ensure vercel.json
    if [ ! -f vercel.json ]; then
      cat > vercel.json <<'EOF'
{ "cleanUrls": true, "trailingSlash": false }
EOF
      git add vercel.json && \
        git -c user.email="${GIT_AUTHOR_EMAIL:-barronzuo@gmail.com}" \
            -c user.name="${GIT_AUTHOR_NAME:-Barron Zuo}" \
            commit -q -m "chore: vercel.json config" && \
        git push --quiet || true
    fi

    DEPLOY_OUT=$(vercel deploy --prod --yes --name "$VERCEL_PROJECT_NAME" 2>&1 || true)
    HASH_URL=$(echo "$DEPLOY_OUT" | grep -oE 'https://[^ ]*-barrons-projects-[a-z0-9]+\.vercel\.app' | head -1)
    echo "  ✓ Deployment URL: $HASH_URL"
    cd "$SKILL_ROOT"

    echo "▸ [4/4] Removing auto-created vanity aliases (Hobby tier hardening)..."
    if command -v jq >/dev/null 2>&1; then JQ=jq; else JQ=""; fi
    TOKEN=$(python3 -c "import json,os; print(json.load(open(os.path.expanduser('~/Library/Application Support/com.vercel.cli/auth.json')))['token'])" 2>/dev/null)
    PROJ_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
      "https://api.vercel.com/v9/projects/${VERCEL_PROJECT_NAME}?teamId=${VERCEL_TEAM_ID}" | \
      python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

    # List + delete vanity aliases (anything that doesn't have the deployment hash pattern)
    ALIASES=$(curl -s -H "Authorization: Bearer $TOKEN" \
      "https://api.vercel.com/v4/aliases?projectId=${PROJ_ID}&teamId=${VERCEL_TEAM_ID}")
    echo "$ALIASES" | python3 -c "
import sys, json, re, subprocess, os
data = json.load(sys.stdin)
hash_url = '''${HASH_URL}'''.replace('https://', '')
keep_pattern = re.compile(r'-[a-z0-9]{8,12}-barrons-projects-')  # deployment hash format
deleted = 0
for a in data.get('aliases', []):
    alias = a.get('alias', '')
    uid = a.get('uid', '')
    if alias == hash_url:
        print(f'  · keep   {alias}')
        continue
    if keep_pattern.search(alias):
        print(f'  · keep   {alias}')
        continue
    print(f'  · DELETE {alias}')
    import urllib.request
    req = urllib.request.Request(
        f'https://api.vercel.com/v2/aliases/{uid}?teamId=${VERCEL_TEAM_ID}',
        method='DELETE',
        headers={'Authorization': 'Bearer ${TOKEN}'},
    )
    try:
        urllib.request.urlopen(req).read()
        deleted += 1
    except Exception as e:
        print(f'      ⚠ failed: {e}')
print(f'  ✓ removed {deleted} vanity alias(es)')
"
    echo ""
    echo "════════════════════ ✅ DONE ════════════════════"
    echo ""
    echo "  📄 LOCAL OUTPUTS"
    echo "    DOCX : $DOCX"
    echo "    HTML : $HTML"
    echo "    PDF  : $PDF"
    [ -n "${OBSIDIAN_DIR:-}" ] && echo "    OBSIDIAN : ${OBSIDIAN_DIR}/${BASE}.md"
    echo ""
    echo "  🌐 SHAREABLE LINK (Vercel SSO-protected — recipient must be team member)"
    echo "    $HASH_URL"
    echo ""
    echo "  📦 GITHUB BACKUP"
    echo "    https://github.com/${REPORTS_GH_OWNER}/${REPORTS_GH_REPO}/tree/main/reports/${REPORT_DATE}"
  fi
else
  echo "▸ [3-4/4] Vercel — SKIPPED"
  echo ""
  echo "════════════════════ ✅ DONE ════════════════════"
  echo "  📄 outputs in $OUTPUT_DIR"
fi
