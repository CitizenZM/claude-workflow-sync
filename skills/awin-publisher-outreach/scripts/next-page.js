// Awin next page script v2 — run via browser_evaluate
// Finds "Next" button by text content (Awin uses plain divs, not .paginationNext class)
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // Try CSS class first, then fall back to text content search
  let nb = document.querySelector('.paginationNext, [class*="paginationNext"]');
  if (!nb) {
    const candidates = document.querySelectorAll('a, span, div, button');
    for (const el of candidates) {
      if (el.textContent.trim() === 'Next' && el.offsetParent !== null) {
        nb = el;
        break;
      }
    }
  }
  if (nb) {
    nb.click(); await sleep(3000);
    const rows = document.querySelectorAll('table tbody tr');
    return JSON.stringify({ ok: true, first: rows[0]?.querySelector('td')?.textContent?.trim(), count: rows.length });
  }
  return JSON.stringify({ ok: false });
}
