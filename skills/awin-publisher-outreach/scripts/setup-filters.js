// Awin smart filter setup v2 — auto-selects relevant publisher types for Rockbros (sports accessories)
// Tier system: tries high-relevance filters first, falls back by partnership quality.
// Self-contained — no placeholder replacement needed. Run via browser_evaluate.
// Returns: { tier, filters:[{id,label}], perPage, rows, sortVerified, firstPartnership, above50 }
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Filter tiers for Rockbros — sports accessories, outdoor, fitness brand
  // T1: High-intent content — influencers, editorial, communities, newsletters
  // T2: Broader — adds social traffic + coupon (sports gear shoppers respond to deals)
  // T3: Volume — adds cashback + shopping directory
  // T4: No filter — full directory, maximum pool
  const TIERS = [
    { name: 'T1-Premium',  ids: ['21','20','23','29'],             minAbove50: 5 },
    { name: 'T2-Broad',    ids: ['21','20','23','29','14','26'],   minAbove50: 3 },
    { name: 'T3-Volume',   ids: ['21','20','23','29','14','26','19','24'], minAbove50: 1 },
    { name: 'T4-NoFilter', ids: [],                                minAbove50: 0 }
  ];
  // Filter ID reference (Awin platform-wide as of 2026-04):
  // 21 = Content Creators & Influencers  ← sports/fitness influencers
  // 20 = Editorial Content               ← outdoor/sports editorial
  // 23 = Communities & User-Generated Content ← cycling, outdoor communities
  // 29 = Newsletters                     ← sports/lifestyle newsletters
  // 14 = Social Traffic                  ← social media sports content
  // 26 = Coupon Code                     ← deal sites (sports gear)
  // 19 = Shopping Directory              ← sports equipment directories
  // 24 = Cashback                        ← cashback platforms

  const ck = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Accept all'));
  if (ck) { ck.click(); await sleep(1000); }

  const pl = document.querySelector('#pageLength');
  if (pl) { pl.value = '40'; pl.dispatchEvent(new Event('change', {bubbles: true})); await sleep(4000); }

  const clearFilters = async () => {
    const btn = Array.from(document.querySelectorAll('a,span,div,button'))
      .find(el => el.children.length===0 && /reset filters|clear active filters/i.test(el.textContent.trim()) && el.offsetParent!==null);
    if (btn) { btn.click(); await sleep(3000); return; }
    document.querySelectorAll('li.selected label').forEach(lb => lb.click());
    await sleep(2000);
  };

  const applyFilters = async (ids) => {
    const applied = [];
    for (const id of ids) {
      const li = document.querySelector('#types_'+id); if (!li) continue;
      const lb = li.querySelector('label'); if (!lb) continue;
      if (!li.classList.contains('selected')) { lb.click(); applied.push({id,label:lb.textContent.trim()}); await sleep(400); }
      else applied.push({id,label:lb.textContent.trim(),alreadyOn:true});
    }
    await sleep(2500); return applied;
  };

  const sortDesc = async () => {
    const th = Array.from(document.querySelectorAll('th')).find(t => t.textContent.includes('Accepted Partnerships'));
    if (!th) return false;
    for (let a=0;a<3;a++) { th.click(); await sleep(3000); const v=document.querySelector('table tbody tr td:nth-child(3)')?.textContent?.trim(); if(parseInt((v||'0').replace(/,/g,''))>0) return true; }
    return false;
  };

  const measure = () => {
    const rows=document.querySelectorAll('table tbody tr'); let above50=0,total=0;
    rows.forEach(r=>{const p=parseInt((r.querySelectorAll('td')[2]?.textContent?.trim()||'0').replace(/,/g,''))||0;total++;if(p>=50)above50++;});
    return {above50,total,first:document.querySelector('table tbody tr td:nth-child(3)')?.textContent?.trim()||'0'};
  };

  let selectedTier=null, appliedFilters=[], q={};
  for (const tier of TIERS) {
    await clearFilters();
    if (tier.ids.length) appliedFilters = await applyFilters(tier.ids); else appliedFilters=[];
    await sortDesc(); q = measure();
    if (q.above50 >= tier.minAbove50) { selectedTier=tier.name; break; }
  }

  return JSON.stringify({tier:selectedTier, filters:appliedFilters, perPage:pl?.value, rows:q.total,
    sortVerified:parseInt((q.first||'0').replace(/,/g,''))>0, firstPartnership:q.first, above50:q.above50});
}
