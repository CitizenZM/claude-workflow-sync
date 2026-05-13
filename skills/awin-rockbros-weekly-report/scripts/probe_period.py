#!/usr/bin/env python3
"""Probe how the Period selector is implemented on Performance Over Time."""
import time, json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent))
from awin_helpers import load_creds, login, dismiss_cookies, safe_eval

PROFILE = Path.home() / ".cache" / "awin-isolated-profile"
OUT = Path(__file__).resolve().parent.parent / "output" / "explore"

def main():
    creds = load_creds()
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE),
            headless=True,
            viewport={"width": 1600, "height": 1000},
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
        )
        page = ctx.new_page()
        login(page, creds["email"], creds["password"])
        page.goto("https://ui.awin.com/detailed-reports/us/awin/advertiser/58007/performance-over-time/default",
                  wait_until="domcontentloaded", timeout=60000)
        time.sleep(12)
        dismiss_cookies(page)
        time.sleep(5)

        # Investigate Period widget structure
        info = safe_eval(page, """() => {
            const findLabel = (text) => {
                const labels = [...document.querySelectorAll('label,div,span')];
                return labels.find(l => (l.textContent||'').trim() === text);
            };
            const periodLabel = findLabel('Period');
            if (!periodLabel) return { error: 'no period label' };
            // Walk up + find the next sibling that looks like a control
            let parent = periodLabel.parentElement;
            const out = { selects: 0, inputs: [], buttons: [], dropdowns: [] };
            const scope = parent ? parent.parentElement : document;
            scope.querySelectorAll('select').forEach(s => {
                out.selects++;
                out.dropdowns.push({ tag:'select', name:s.name, value:s.value, options:[...s.options].map(o=>o.textContent.trim()).slice(0,12) });
            });
            scope.querySelectorAll('input').forEach(i => out.inputs.push({type:i.type, value:i.value, role:i.getAttribute('role'), aria:i.getAttribute('aria-label')}));
            // Look for ARIA combobox
            scope.querySelectorAll('[role=combobox]').forEach(c => {
                out.dropdowns.push({tag:'combobox', text:(c.textContent||'').trim().slice(0,80), aria:c.getAttribute('aria-label')});
            });
            // any element containing "This Month" text
            const months = [...document.querySelectorAll('*')].filter(e =>
                e.children.length === 0 && /^This Month$/.test((e.textContent||'').trim()));
            out.thisMonthElements = months.slice(0, 5).map(e => ({
                tag: e.tagName, cls: e.className, id: e.id,
                parentTag: e.parentElement?.tagName, parentRole: e.parentElement?.getAttribute('role')
            }));
            return out;
        }""", {})
        (OUT / "period_widget.json").write_text(json.dumps(info, indent=2))
        print(json.dumps(info, indent=2))

        ctx.close()

if __name__ == "__main__":
    main()
