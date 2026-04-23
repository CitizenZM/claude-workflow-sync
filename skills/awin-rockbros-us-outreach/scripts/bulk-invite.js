// Awin bulk invite script v4.1 — run via browser_evaluate
// DEDUP: reads window.__awinDedup (Set) primed by prime-dedup.js — do NOT inject NAMES here.
// Returns full JSON directly: {total, navDestroyed, skippedLowQuality, skippedOther, publishers, skippedList}
async () => {
  // === INJECT THESE VARIABLES (replace placeholders before running) ===
  const MSG = "%%MSG%%";
  const COMM = "%%COMM%%";
  const TARGET = %%TARGET%%;
  const MIN_PARTNERSHIPS = %%MIN_PARTNERSHIPS%%;
  // === END INJECTION ===

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const dedup = window.__awinDedup || new Set();
  const invited = [], skipped = [];
  let navDestroyed = false;
  window.addEventListener('beforeunload', () => { navDestroyed = true; });

  const findNextRow = () => {
    const rows = Array.from(document.querySelectorAll('tbody tr'));
    return rows.find(tr => {
      const btn = tr.querySelector('[title="Invite Publisher"], [data-original-title="Invite Publisher"]');
      if (!btn) return false;
      const name = tr.querySelector('td')?.textContent?.trim() || '';
      return name && !dedup.has(name.toLowerCase());
    }) || null;
  };

  let noRowCount = 0;
  while (invited.length < TARGET) {
    if (navDestroyed) break;

    const ok = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'OK');
    if (ok) { ok.click(); await sleep(500); continue; }

    const row = findNextRow();
    if (!row) {
      noRowCount++;
      if (noRowCount >= 5) break;
      await sleep(1500);
      continue;
    }
    noRowCount = 0;

    const name = row.querySelector('td')?.textContent?.trim() || 'Unknown';
    const type = row.querySelectorAll('td')[1]?.textContent?.trim() || '';
    const pText = row.querySelectorAll('td')[2]?.textContent?.trim() || '0';
    const partnerships = parseInt(pText.replace(/,/g, '')) || 0;
    const publisherId = row.querySelector('a[href*="/partner/"]')?.href?.match(/\/partner\/(\d+)/)?.[1] || '';

    if (partnerships < MIN_PARTNERSHIPS) {
      dedup.add(name.toLowerCase());
      skipped.push({ name, partnerships, reason: 'below_min' });
      await sleep(100);
      continue;
    }

    dedup.add(name.toLowerCase());

    row.querySelector('[title="Invite Publisher"], [data-original-title="Invite Publisher"]').click();
    await sleep(2000);
    if (navDestroyed) break;

    const ta = document.querySelector('.modal textarea, textarea');
    if (!ta) {
      const cc = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancel');
      if (cc) cc.click();
      await sleep(500);
      continue;
    }
    ta.value = MSG;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new Event('change', { bubbles: true }));

    const sl = document.querySelector('.modal select');
    if (sl) {
      for (let o = 0; o < sl.options.length; o++) {
        if (sl.options[o].text.includes(COMM)) {
          sl.selectedIndex = o;
          sl.dispatchEvent(new Event('change', { bubbles: true }));
          break;
        }
      }
    }
    await sleep(300);

    const sb = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Send Invite');
    if (!sb) {
      const cc = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancel');
      if (cc) cc.click();
      await sleep(500);
      continue;
    }

    sb.click();
    await sleep(4000);
    if (navDestroyed) break;

    const ok2 = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'OK');
    if (ok2) { ok2.click(); await sleep(1000); }

    const modalOpen = document.querySelector('.modal.in, .modal.show, .modal[style*="display: block"], [role="dialog"][open], [role="dialog"][aria-hidden="false"]');
    const submitConfirmed = !modalOpen;

    if (submitConfirmed) {
      invited.push({ name, type, partnerships: pText, publisherId, submitConfirmed: true });
    } else {
      skipped.push({ name, partnerships, reason: 'submit-unverified:modal-still-open' });
    }
  }

  return JSON.stringify({
    total: invited.length,
    navDestroyed,
    skippedLowQuality: skipped.filter(s => s.reason === 'below_min').length,
    skippedOther: skipped.filter(s => s.reason !== 'below_min').length,
    publishers: invited,
    skippedList: skipped.slice(0, 10)
  });
}
