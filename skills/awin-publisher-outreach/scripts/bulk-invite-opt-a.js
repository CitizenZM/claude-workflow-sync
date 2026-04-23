// Awin bulk invite — Option A (window.__DEDUP, no inline array)
// Sonnet sets window.__DEDUP before spawning each per-page Haiku subagent.
// Caller replaces %%MSG%%, %%COMM%%, %%TARGET%%, %%MIN_PARTNERSHIPS%% before browser_evaluate.
async () => {
  const MSG = "%%MSG%%";
  const COMM = "%%COMM%%";
  const TARGET = %%TARGET%%;
  const MIN_PARTNERSHIPS = %%MIN_PARTNERSHIPS%%;

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const alreadySet = new Set((window.__DEDUP || []).map(n => n.toLowerCase()));
  const invited = [], skipped = [], seen = new Set();
  let staleCount = 0;

  for (let i = 0; i < TARGET + 20; i++) {
    if (invited.length >= TARGET) break;
    if (staleCount > 8) break;
    try {
      const ok = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'OK');
      if (ok) { ok.click(); await sleep(500); }

      const btns = document.querySelectorAll('[title="Invite Publisher"],[data-original-title="Invite Publisher"]');
      if (btns.length === 0) break;

      const row = btns[0].closest('tr');
      const name = row?.querySelector('td')?.textContent?.trim() || 'Unknown';
      const type = row?.querySelectorAll('td')[1]?.textContent?.trim() || '';
      const pText = row?.querySelectorAll('td')[2]?.textContent?.trim() || '0';
      const partnerships = parseInt(pText.replace(/,/g,'')) || 0;

      if (alreadySet.has(name.toLowerCase()) || seen.has(name.toLowerCase())) {
        row.remove(); staleCount++; await sleep(300); continue;
      }
      if (partnerships < MIN_PARTNERSHIPS) {
        skipped.push({name,partnerships,reason:'below_min'});
        row.remove(); staleCount++; await sleep(300); continue;
      }

      staleCount = 0;
      seen.add(name.toLowerCase());
      alreadySet.add(name.toLowerCase());
      if (window.__DEDUP) window.__DEDUP.push(name);

      btns[0].click(); await sleep(2000);

      const ta = document.querySelector('.modal textarea,textarea');
      if (!ta) { const cc=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Cancel'); if(cc)cc.click(); await sleep(1000); continue; }
      ta.value = MSG; ta.dispatchEvent(new Event('input',{bubbles:true})); ta.dispatchEvent(new Event('change',{bubbles:true}));

      const sl = document.querySelector('.modal select');
      if (sl) { for(let o=0;o<sl.options.length;o++){if(sl.options[o].text.includes(COMM)){sl.selectedIndex=o;sl.dispatchEvent(new Event('change',{bubbles:true}));break;}} }
      await sleep(300);

      const sb = Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Send Invite');
      if (sb) { sb.click(); invited.push({name,type,partnerships:pText}); await sleep(4000); const ok2=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='OK'); if(ok2){ok2.click();await sleep(1000);} }
      else { const cc=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Cancel'); if(cc)cc.click(); await sleep(1000); }
    } catch(e) { await sleep(1000); }
  }

  return JSON.stringify({total:invited.length,skippedLowQuality:skipped.length,publishers:invited,skippedList:skipped.slice(0,3)});
}
