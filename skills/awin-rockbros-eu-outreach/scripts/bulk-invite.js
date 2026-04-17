// Awin bulk invite script v3.3 — run via browser_evaluate
// Variables must be defined INLINE at the top of this function before execution.
// The caller (skill) must replace the placeholder values below with actual data.
// Do NOT rely on global variables — page.evaluate() runs in isolated browser scope.
async () => {
  // === INJECT THESE VARIABLES (replace placeholders before running) ===
  const MSG = "%%MSG%%";
  const COMM = "%%COMM%%";
  const ALREADY = %%ALREADY%%;
  const TARGET = %%TARGET%%;
  const MIN_PARTNERSHIPS = %%MIN_PARTNERSHIPS%%;
  // === END INJECTION ===

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const alreadySet = new Set(ALREADY.map(n => n.toLowerCase()));
  const minP = MIN_PARTNERSHIPS;
  const invited = [];
  const skipped = [];
  const seen = new Set();
  let staleCount = 0;

  for (let i = 0; i < TARGET + 40; i++) {
    if (invited.length >= TARGET) break;
    if (staleCount > 8) break;
    try {
      const ok = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'OK');
      if (ok) { ok.click(); await sleep(500); }

      const btns = document.querySelectorAll('[title="Invite Publisher"], [data-original-title="Invite Publisher"]');
      if (btns.length === 0) break;

      const row = btns[0].closest('tr');
      const name = row?.querySelector('td')?.textContent?.trim() || 'Unknown';
      const type = row?.querySelectorAll('td')[1]?.textContent?.trim() || '';
      const pText = row?.querySelectorAll('td')[2]?.textContent?.trim() || '0';
      const partnerships = parseInt(pText.replace(/,/g, '')) || 0;
      const publisherId = row?.querySelector('a[href*="/partner/"]')?.href?.match(/partner\/(\d+)/)?.[1] || '';

      // DEDUP: remove already-invited rows
      if (alreadySet.has(name.toLowerCase()) || seen.has(name.toLowerCase())) {
        row.remove();
        staleCount++;
        await sleep(300);
        continue;
      }

      // QUALITY GATE: skip publishers below minimum partnerships
      if (partnerships < minP) {
        skipped.push({ name, partnerships, reason: 'below_min' });
        row.remove();
        staleCount++;
        await sleep(300);
        continue;
      }

      staleCount = 0;
      seen.add(name.toLowerCase());
      alreadySet.add(name.toLowerCase());

      btns[0].click();
      await sleep(2000);

      const ta = document.querySelector('.modal textarea, textarea');
      if (!ta) {
        const cc = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancel');
        if (cc) cc.click();
        await sleep(1000);
        continue;
      }
      ta.value = MSG;
      ta.dispatchEvent(new Event('input', {bubbles: true}));
      ta.dispatchEvent(new Event('change', {bubbles: true}));

      const sl = document.querySelector('.modal select');
      if (sl) {
        for (let o = 0; o < sl.options.length; o++) {
          if (sl.options[o].text.includes(COMM)) {
            sl.selectedIndex = o;
            sl.dispatchEvent(new Event('change', {bubbles: true}));
            break;
          }
        }
      }
      await sleep(300);

      const sb = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Send Invite');
      if (sb) {
        sb.click();
        invited.push({ name, type, partnerships: pText, publisherId });
        await sleep(4000);
        const ok2 = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'OK');
        if (ok2) { ok2.click(); await sleep(1000); }
      } else {
        const cc = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancel');
        if (cc) cc.click();
        await sleep(1000);
      }
    } catch(e) {
      await sleep(1000);
    }
  }

  return JSON.stringify({ total: invited.length, skippedLowQuality: skipped.length, publishers: invited, skippedList: skipped.slice(0, 5) });
}
