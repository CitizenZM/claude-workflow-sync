// Impact.com next page script v1 — run via browser_evaluate
// Impact uses React SPA pagination — may be buttons, links, or infinite scroll
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Try standard pagination selectors
  let nb = document.querySelector('[class*="next"], [aria-label="Next"], [class*="Next"]');
  if (!nb || nb.disabled || nb.getAttribute('aria-disabled') === 'true') {
    // Try text-based search
    const candidates = document.querySelectorAll('button, a, span[role="button"]');
    for (const el of candidates) {
      const t = el.textContent.trim();
      if ((t === 'Next' || t === '>' || t === 'Load More' || t === 'Show More') && el.offsetParent !== null && !el.disabled) {
        nb = el;
        break;
      }
    }
  }

  if (!nb || nb.disabled) {
    // Try page number — find current page, click next
    const current = document.querySelector('[class*="active"][class*="page"], [aria-current="page"]');
    if (current) {
      const next = current.nextElementSibling?.querySelector('a, button') || current.nextElementSibling;
      if (next && next.offsetParent !== null) nb = next;
    }
  }

  if (nb && !nb.disabled) {
    nb.click();
    await sleep(4000);
    // Count new results
    const proposalBtns = Array.from(document.querySelectorAll('button, a[role="button"]')).filter(b =>
      b.textContent.trim().toLowerCase().includes('send proposal') && b.offsetParent !== null
    );
    return JSON.stringify({ ok: true, count: proposalBtns.length });
  }

  return JSON.stringify({ ok: false, reason: 'no_next_button' });
}
