// Extract publisher list / top performers from Awin publishers page
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  await sleep(1500);
  // Accept cookies
  const ck = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Accept all'));
  if (ck) { ck.click(); await sleep(800); }
  // Bump page length if available
  const pl = document.querySelector('#pageLength');
  if (pl) { pl.value = '40'; pl.dispatchEvent(new Event('change', {bubbles: true})); await sleep(2500); }
  // Try sort by partnerships desc
  const th = Array.from(document.querySelectorAll('th')).find(t => /partnership|sales|gmv|revenue/i.test(t.textContent));
  if (th) { th.click(); await sleep(2000); th.click(); await sleep(2000); }
  const tables = [];
  document.querySelectorAll('table').forEach(tbl => {
    const headers = Array.from(tbl.querySelectorAll('thead th, tr:first-child th')).map(h => (h.textContent || '').trim());
    const rows = Array.from(tbl.querySelectorAll('tbody tr')).slice(0, 40).map(r =>
      Array.from(r.querySelectorAll('td,th')).map(c => (c.textContent || '').trim().replace(/\s+/g, ' '))
    );
    if (rows.length) tables.push({ headers, rows });
  });
  return JSON.stringify({
    url: location.href,
    title: document.title,
    tables,
    rawText: (document.body.innerText || '').slice(0, 4000),
  });
}
