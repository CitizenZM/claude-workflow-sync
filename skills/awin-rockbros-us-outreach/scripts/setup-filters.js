// Awin filter setup script v3.3 — run via browser_evaluate
// US merchant 58007: IDs 25=Loyalty, 15=Mobile Traffic, 22=Media Content
// ALWAYS sorts by Accepted Partnerships descending with verification
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // Accept cookies
  const ck = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Accept all'));
  if (ck) { ck.click(); await sleep(1000); }
  // Set 40/page
  const pl = document.querySelector('#pageLength');
  if (pl) { pl.value = '40'; pl.dispatchEvent(new Event('change', {bubbles: true})); await sleep(4000); }
  // Expand Content + Email parents
  const ch = document.querySelector('#types_3 .hitarea');
  if (ch) { ch.click(); await sleep(500); }
  const eh = document.querySelector('#types_5 .hitarea');
  if (eh) { eh.click(); await sleep(500); }
  // Apply filters — IDs hard-coded (25=Loyalty, 15=Mobile Traffic, 22=Media Content)
  const ids = ['25', '15', '22'];
  const applied = [];
  ids.forEach(id => {
    const li = document.querySelector('#types_' + id);
    if (li && !li.classList.contains('selected')) {
      const lb = li.querySelector('label');
      if (lb) { lb.click(); applied.push(lb.textContent.trim()); }
    }
  });
  await sleep(3000);
  // MANDATORY: Sort by Accepted Partnerships descending
  // Click header, wait, verify first row has high number; if not, click again
  const th = Array.from(document.querySelectorAll('th')).find(t => t.textContent.includes('Accepted Partnerships'));
  let sortVerified = false;
  if (th) {
    for (let attempt = 0; attempt < 3; attempt++) {
      th.click();
      await sleep(3000);
      const v = document.querySelector('table tbody tr td:nth-child(3)')?.textContent?.trim();
      const num = parseInt((v || '0').replace(/,/g, ''));
      if (num >= 50) { sortVerified = true; break; }
    }
  }
  // Nuke sessionStorage so Awin can't restore filter/sort state on next navigate
  try {
    sessionStorage.clear();
    const origSetItem = sessionStorage.setItem.bind(sessionStorage);
    Object.defineProperty(sessionStorage, 'setItem', {
      value: (k, v) => { if (!/filter|sort|sector|region|type/i.test(k)) origSetItem(k, v); },
      writable: true, configurable: true
    });
  } catch(e) {}
  const rows = document.querySelectorAll('table tbody tr');
  const firstPartnership = document.querySelector('table tbody tr td:nth-child(3)')?.textContent?.trim();
  return JSON.stringify({ filters: applied, perPage: pl?.value, rows: rows.length, sortVerified, firstPartnership });
}
