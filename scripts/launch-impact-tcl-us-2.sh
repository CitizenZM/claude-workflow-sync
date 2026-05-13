#!/usr/bin/env bash
# launch-impact-tcl-us-2.sh — Launch isolated Chrome for Impact TCL US (second browser, port 9307)
# Mirrors impact-tcl-us (9305) but uses a separate profile so sessions never share cookies.

PROFILE_DIR="$HOME/.claude/browser-profiles/impact-tcl-us-2"
PORT=9307

mkdir -p "$PROFILE_DIR"

'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
    --user-data-dir="$PROFILE_DIR" \
    --remote-debugging-port=$PORT \
    '--remote-allow-origins=*' \
    --no-first-run \
    --no-default-browser-check \
    --disable-popup-blocking \
    --disable-blink-features=AutomationControlled \
    --disable-features=ChromeWhatsNewUI,ChromeCartInNtp \
    --flag-switches-begin \
    --flag-switches-end \
    --start-maximized &

echo "Chrome launched on port $PORT with profile: $PROFILE_DIR"
echo "PID: $!"
