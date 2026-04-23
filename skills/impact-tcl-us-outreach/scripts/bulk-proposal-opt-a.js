// Impact TCL US bulk proposal — Option A (window.__DEDUP + window.__tcl_fill pre-injected by Sonnet)
// Caller replaces %%TARGET%% before browser_evaluate.
// window.__tcl_fill and window.__DEDUP must be set by Sonnet before spawning Haiku.
async () => {
  const TARGET = %%TARGET%%;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const alreadySet = new Set((window.__DEDUP || []).map(n => n.toLowerCase()));
  const invited = [], skipped = [], errors = [];
  const seen = new Set();

  const cards = document.querySelectorAll('.discovery-card');
  let processed = 0;

  for (let i = 0; i < cards.length; i++) {
    if (invited.length >= TARGET) break;
    const card = cards[i];
    const name = card.querySelector('[class*="name"]')?.textContent?.trim() || String(i);

    if (alreadySet.has(name.toLowerCase()) || seen.has(name.toLowerCase())) {
      skipped.push(name + ':dup'); continue;
    }
    const btns = Array.from(card.querySelectorAll('button')).map(b => b.textContent.trim());
    if (!btns.includes('Send Proposal')) { skipped.push(name + ':no_btn'); continue; }

    seen.add(name.toLowerCase());
    alreadySet.add(name.toLowerCase());
    if (window.__DEDUP) window.__DEDUP.push(name);

    try {
      const r = await window.__tcl_fill(i);
      if (r && r.startsWith('OK|')) {
        const parts = r.split('|');
        invited.push({name: parts[1] || name, email: parts[2] || ''});
      } else {
        skipped.push(name + ':' + (r || 'err'));
      }
    } catch(e) {
      const cb = document.querySelector('button[aria-label="close"],button[aria-label="Close"]');
      if (cb) cb.click();
      errors.push(name + ':' + e.message.slice(0,40));
    }
    await sleep(500);
    processed++;
  }

  return JSON.stringify({total:invited.length, skipped:skipped.length, errors:errors.length, publishers:invited, errorList:errors.slice(0,3)});
}
