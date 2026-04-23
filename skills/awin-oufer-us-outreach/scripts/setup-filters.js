// Awin smart filter setup v2 — auto-selects relevant publisher types for Oufer Body Jewelry
// Tier system: tries high-relevance filters first, falls back to broader sets by partnership quality.
// Caller injects no variables — fully self-contained. Run via browser_evaluate.
// Returns JSON: { tier, filters:[{id,label}], perPage, rows, sortVerified, firstPartnership, above50, totalRows }
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // === FILTER TIERS (ordered by relevance for body jewelry / fashion / lifestyle brand) ===
  // T1: High-intent content publishers — editorial, influencers, communities, newsletters
  // T2: Broader reach — adds social traffic + shopping directories
  // T3: Volume mode — adds coupon/cashback (lower quality but higher count)
  // T4: No filter — full "Not Invited" directory, maximum pool
  const TIERS = [
    { name: 'T1-Premium',  ids: ['21','20','23','29'],             minAbove50: 5  },
    { name: 'T2-Broad',    ids: ['21','20','23','29','14','19'],   minAbove50: 3  },
    { name: 'T3-Volume',   ids: ['21','20','23','29','14','19','26','24'], minAbove50: 1 },
    { name: 'T4-NoFilter', ids: [],                                minAbove50: 0  }
  ];
  // Filter ID reference (Awin US as of 2026-04):
  // 21 = Content Creators & Influencers  ← body art, beauty, fashion influencers
  // 20 = Editorial Content               ← lifestyle/fashion editorial blogs
  // 23 = Communities & User-Generated Content ← body modification communities
  // 29 = Newsletters                     ← fashion/lifestyle newsletter publishers
  // 14 = Social Traffic                  ← social media traffic publishers
  // 19 = Shopping Directory              ← jewelry/accessories shopping sites
  // 26 = Coupon Code                     ← deal/promo sites (volume)
  // 24 = Cashback                        ← cashback platforms (volume)

  // Accept cookies
  const ck = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Accept all'));
  if (ck) { ck.click(); await sleep(1000); }

  // Set 40/page
  const pl = document.querySelector('#pageLength');
  if (pl) { pl.value = '40'; pl.dispatchEvent(new Event('change', {bubbles: true})); await sleep(4000); }

  // Helper: clear all active filters via "Reset filters" button or "Clear active filters"
  const clearFilters = async () => {
    const resetBtn = Array.from(document.querySelectorAll('a, span, div, button, generic'))
      .find(el => el.children.length === 0 &&
        /reset filters|clear active filters/i.test(el.textContent.trim()) &&
        el.offsetParent !== null);
    if (resetBtn) { resetBtn.click(); await sleep(3000); return true; }
    // Fallback: manually deselect each selected filter
    const selected = document.querySelectorAll('li.selected label');
    selected.forEach(lb => lb.click());
    if (selected.length > 0) { await sleep(2000); return true; }
    return false;
  };

  // Helper: apply a set of filter IDs, return [{id, label}] applied
  const applyFilters = async (ids) => {
    const applied = [];
    for (const id of ids) {
      const li = document.querySelector('#types_' + id);
      if (!li) continue;
      const lb = li.querySelector('label');
      if (!lb) continue;
      const label = lb.textContent.trim();
      if (!li.classList.contains('selected')) {
        lb.click();
        applied.push({ id, label });
        await sleep(400);
      } else {
        applied.push({ id, label, alreadyOn: true });
      }
    }
    await sleep(2500);
    return applied;
  };

  // Helper: sort Accepted Partnerships descending, verify first row is high
  const sortDescending = async () => {
    const th = Array.from(document.querySelectorAll('th'))
      .find(t => t.textContent.includes('Accepted Partnerships'));
    if (!th) return false;
    for (let attempt = 0; attempt < 3; attempt++) {
      th.click(); await sleep(3000);
      const v = document.querySelector('table tbody tr td:nth-child(3)')?.textContent?.trim();
      const num = parseInt((v || '0').replace(/,/g, ''));
      if (num > 0) return true;
    }
    return false;
  };

  // Helper: measure quality — count publishers with 50+ partnerships on current page
  const measureQuality = () => {
    const rows = document.querySelectorAll('table tbody tr');
    let above50 = 0, totalRows = 0;
    rows.forEach(row => {
      const p = parseInt((row.querySelectorAll('td')[2]?.textContent?.trim() || '0').replace(/,/g, '')) || 0;
      totalRows++;
      if (p >= 50) above50++;
    });
    const firstPartnership = document.querySelector('table tbody tr td:nth-child(3)')?.textContent?.trim() || '0';
    return { above50, totalRows, firstPartnership };
  };

  // === MAIN TIER LOOP ===
  let selectedTier = null, appliedFilters = [], quality = {};

  for (const tier of TIERS) {
    // Clear existing filters before each attempt
    await clearFilters();

    // Apply this tier's filter IDs (skip if T4 = no filter)
    if (tier.ids.length > 0) {
      appliedFilters = await applyFilters(tier.ids);
    } else {
      appliedFilters = [];
    }

    // Sort descending by partnerships
    const sortOk = await sortDescending();
    quality = measureQuality();

    if (quality.above50 >= tier.minAbove50) {
      selectedTier = tier.name;
      break;
    }
    // Quality not met — try next tier
  }

  return JSON.stringify({
    tier: selectedTier,
    filters: appliedFilters,
    perPage: pl?.value,
    rows: quality.totalRows,
    sortVerified: parseInt((quality.firstPartnership || '0').replace(/,/g, '')) > 0,
    firstPartnership: quality.firstPartnership,
    above50: quality.above50,
    totalRows: quality.totalRows
  });
}
