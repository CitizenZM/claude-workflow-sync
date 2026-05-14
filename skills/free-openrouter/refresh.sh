#!/usr/bin/env bash
# Refresh the free models cache. Run weekly or when models change.
set -euo pipefail
cd "$(dirname "$0")"
python3 or_free.py --refresh
echo "Cache written to: $(pwd)/free-models.json"
