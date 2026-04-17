// Extract KPI tiles + visible numeric data from Awin advertiser home
// Returns JSON: { url, title, tiles: [{label, value}], tables: [...], rawText }
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  await sleep(1500);
  // Try to capture KPI cards — Awin uses widget cards with labels + bold numbers
  const tiles = [];
  document.querySelectorAll('h1,h2,h3,h4,h5,strong,b,.kpi,.metric,[class*="value"],[class*="amount"],[class*="number"]').forEach(el => {
    const t = (el.textContent || '').trim();
    if (!t || t.length > 80) return;
    if (!/[\d£$€]/.test(t)) return;
    const sib = el.previousElementSibling || el.parentElement?.previousElementSibling;
    const label = (sib?.textContent || el.parentElement?.textContent || '').trim().slice(0, 80);
    tiles.push({ label, value: t });
  });
  // Capture all visible tables
  const tables = [];
  document.querySelectorAll('table').forEach(tbl => {
    const headers = Array.from(tbl.querySelectorAll('thead th, tr:first-child th')).map(h => (h.textContent || '').trim());
    const rows = Array.from(tbl.querySelectorAll('tbody tr')).slice(0, 30).map(r =>
      Array.from(r.querySelectorAll('td,th')).map(c => (c.textContent || '').trim())
    );
    if (rows.length) tables.push({ headers, rows });
  });
  // Sample of raw text body for fallback context
  const rawText = (document.body.innerText || '').slice(0, 4000);
  return JSON.stringify({
    url: location.href,
    title: document.title,
    tilesCount: tiles.length,
    tiles: tiles.slice(0, 50),
    tables,
    rawText,
  });
}
