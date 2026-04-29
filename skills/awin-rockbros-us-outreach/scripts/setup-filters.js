// Awin filter setup script v3.2 — run via browser_evaluate
// Accepts: FILTER_IDS array e.g. ['25','15','22']
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
  // Apply filters
  const ids = FILTER_IDS;
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
  const rows = document.querySelectorAll('table tbody tr');
  const firstPartnership = document.querySelector('table tbody tr td:nth-child(3)')?.textContent?.trim();
  return JSON.stringify({ filters: applied, perPage: pl?.value, rows: rows.length, sortVerified, firstPartnership });
}
