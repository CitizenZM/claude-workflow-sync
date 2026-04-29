// Impact TCL US bulk proposal script v9 — detail-page email scrape
// Key mechanics:
//   - page.mouse.click() for term li (evaluate clicks don't trigger React events in iframe)
//   - nav-catch pattern: "I understand" causes page navigation = success signal
//   - name-based card lookup (survives page navigation + reload)
//   - slideout scrape: click card image → Details tab → shadow-DOM regex scan for email
// Placeholders replaced before browser_run_code execution:
//   %%MSG%% %%CONTRACT_DATE%% %%ALREADY%% %%TARGET%% %%DISCOVER_URL%%

async (page) => {
  const DISCOVER_URL = "%%DISCOVER_URL%%";
  const MSG = "%%MSG%%";
  const CONTRACT_DATE = "%%CONTRACT_DATE%%";
  const ALREADY = %%ALREADY%%;
  const TARGET = %%TARGET%%;

  const sleep = ms => page.waitForTimeout(ms);
  const alreadySet = new Set(ALREADY.map(n => n.toLowerCase()));
  const invited = [], errors = [], seen = new Set();

  const getPropFrame = () => page.frames().find(f => f.url().includes('send-proposal') || f.url().includes('proposal'));

  const ensureOnDiscoverPage = async () => {
    if (!page.url().includes('partner_discover') || page.url().includes('slideout_id=')) {
      await page.goto(DISCOVER_URL);
      await sleep(3000);
    }
  };

  // Deep shadow-DOM walker — finds "Email" label and returns the next text node's value
  const scrapeEmailFromSlideout = async (name) => {
    // 1. Find and click the card's image/avatar to open slideout
    const cardCoords = await page.evaluate((n) => {
      for (const c of document.querySelectorAll('.discovery-card')) {
        const cardName = c.querySelector('[class*="name"]')?.textContent.trim();
        if (cardName !== n) continue;
        const img = c.querySelector('img');
        const target = img || c;
        const r = target.getBoundingClientRect();
        return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      }
      return null;
    }, name);
    if (!cardCoords) return 'email_missing';

    await page.mouse.click(cardCoords.x, cardCoords.y);
    await sleep(3500);

    if (!page.url().includes('slideout_id=')) {
      return 'email_missing';
    }

    // 2. Click "Details" tab (in shadow DOM)
    const detailsRect = await page.evaluate(() => {
      const collect = (root, depth = 0) => {
        if (depth > 10) return null;
        const nodes = root.querySelectorAll ? root.querySelectorAll('*') : [];
        for (const el of nodes) {
          if (el.shadowRoot) {
            const f = collect(el.shadowRoot, depth + 1);
            if (f) return f;
          }
          if (el.children.length === 0 && el.textContent?.trim() === 'Details') {
            let target = el;
            for (let i = 0; i < 5; i++) {
              if (target.getBoundingClientRect().width > 30) break;
              target = target.parentElement;
            }
            const r = target.getBoundingClientRect();
            if (r.x > 800 && r.y < 300 && r.width > 0) {
              return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
            }
          }
        }
        return null;
      };
      return collect(document);
    });

    if (detailsRect) {
      await page.mouse.click(detailsRect.x, detailsRect.y);
      await sleep(2200);
    }

    // 3. Extract email from shadow DOM — find "Email" label, get the next sibling text
    const email = await page.evaluate(() => {
      const emailRe = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
      const collectAll = (root, depth = 0, out = []) => {
        if (depth > 10) return out;
        const nodes = root.querySelectorAll ? root.querySelectorAll('*') : [];
        for (const el of nodes) {
          if (el.shadowRoot) collectAll(el.shadowRoot, depth + 1, out);
          if (el.children.length === 0) {
            const t = el.textContent?.trim() || '';
            if (t && t.length < 150) {
              const r = el.getBoundingClientRect();
              if (r.x > 800 && r.y > 100 && r.width > 0) {
                out.push({ text: t, x: r.x, y: r.y });
              }
            }
          }
        }
        return out;
      };
      const nodes = collectAll(document).sort((a, b) => a.y - b.y || a.x - b.x);

      // Strategy 1: regex match any email in slideout area (right of x=800)
      for (const n of nodes) {
        const m = n.text.match(emailRe);
        if (m) return m[0];
      }

      // Strategy 2: find "Email" label, get next node beneath it
      const labelIdx = nodes.findIndex(n => n.text === 'Email');
      if (labelIdx >= 0) {
        for (let i = labelIdx + 1; i < nodes.length && i < labelIdx + 5; i++) {
          const m = nodes[i].text.match(emailRe);
          if (m) return m[0];
        }
      }
      return null;
    });

    // 4. Close slideout — press Escape
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(800);
    if (page.url().includes('slideout_id=')) {
      await page.goto(DISCOVER_URL).catch(() => {});
      await sleep(3000);
    }

    return email || 'email_missing';
  };

  await sleep(3000);
  let cards = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.discovery-card')).map((card, i) => ({
      i, name: card.querySelector('[class*="name"]')?.textContent.trim() || `card_${i}`,
      hasBtn: Array.from(card.querySelectorAll('button')).some(b => b.textContent.trim() === 'Send Proposal')
    }))
  );

  for (const card of cards) {
    if (invited.length >= TARGET) break;
    const { name, hasBtn } = card;
    if (!hasBtn || alreadySet.has(name.toLowerCase()) || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());

    await ensureOnDiscoverPage();

    // ── Scrape email from detail slideout BEFORE sending proposal ──
    const email = await scrapeEmailFromSlideout(name);
    await sleep(800);
    await ensureOnDiscoverPage();

    // Re-query cards (page reloaded)
    cards = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.discovery-card')).map((c, idx) => ({
        i: idx, name: c.querySelector('[class*="name"]')?.textContent.trim() || `card_${idx}`,
        hasBtn: Array.from(c.querySelectorAll('button')).some(b => b.textContent.trim() === 'Send Proposal')
      }))
    );
    const freshCard = cards.find(c => c.name === name);
    if (!freshCard || !freshCard.hasBtn) continue;

    // Open proposal by name (robust to reordering)
    await page.evaluate((n) => {
      for (const c of document.querySelectorAll('.discovery-card')) {
        if (c.querySelector('[class*="name"]')?.textContent.trim() !== n) continue;
        const btn = Array.from(c.querySelectorAll('button')).find(b => b.textContent.trim() === 'Send Proposal');
        if (btn) { btn.style.display = 'inline-block'; btn.click(); }
        break;
      }
    }, name);
    await sleep(3500);

    const propFrame = getPropFrame();
    if (!propFrame) { errors.push({ name, email, reason: 'no-iframe' }); continue; }
    await propFrame.waitForLoadState('domcontentloaded').catch(() => {});

    const iRect = await page.evaluate(() => {
      const iframe = document.querySelector('iframe[src*="send-proposal"], iframe[src*="proposal"]');
      if (!iframe) return null;
      const r = iframe.getBoundingClientRect();
      return { x: r.x, y: r.y };
    });
    if (!iRect) { errors.push({ name, email, reason: 'no-iframe-rect' }); continue; }

    // ── Term selection: page.mouse.click() at absolute coords ──
    let termOk = false, termText = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      await propFrame.evaluate(() => {
        const trigger = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Select');
        if (trigger) trigger.click();
      });
      await sleep(1200);
      const liCoords = await propFrame.evaluate(() => {
        const isVis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
        const li = Array.from(document.querySelectorAll('li[role="option"]'))
          .find(l => l.textContent.includes('8%') && !l.textContent.toLowerCase().includes('coupon') && isVis(l))
          || Array.from(document.querySelectorAll('li[role="option"]'))
            .find(l => l.textContent.toLowerCase().includes('standard') && !l.textContent.toLowerCase().includes('coupon') && !l.textContent.includes('5%') && isVis(l));
        if (!li) return null;
        const r = li.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: li.textContent.trim() };
      }).catch(() => null);
      if (!liCoords) { await sleep(400); continue; }
      await page.mouse.click(Math.round(iRect.x + liCoords.x), Math.round(iRect.y + liCoords.y));
      await sleep(800);
      const confirmed = await propFrame.evaluate(() =>
        Array.from(document.querySelectorAll('button')).filter(b => b.getBoundingClientRect().width > 0)
          .some(b => b.textContent.includes('8%') || (b.textContent.includes('TCL US') && !b.textContent.includes('5%')))
      ).catch(() => false);
      if (confirmed) { termOk = true; termText = liCoords.text; break; }
      await sleep(400);
    }
    if (!termOk) { errors.push({ name, email, reason: 'no-term-confirmed' }); continue; }

    // ── Date selection ──
    let dateOk = false;
    const targetDay = String(parseInt(CONTRACT_DATE.split('-')[2], 10));
    const dateCoords = await propFrame.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button[class*="input-wrap"]'));
      if (!btns.length) return null;
      const r = btns[0].getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }).catch(() => null);
    if (dateCoords) {
      await page.mouse.click(Math.round(iRect.x + dateCoords.x), Math.round(iRect.y + dateCoords.y));
      await sleep(800);
      dateOk = await propFrame.evaluate((td) => {
        const isVis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
        const cal = Array.from(document.querySelectorAll('*')).find(el => {
          const cls = typeof el.className === 'string' ? el.className : '';
          return /calendar|datepicker|picker|month-view/i.test(cls) && isVis(el);
        });
        if (!cal) return false;
        const day = Array.from(cal.querySelectorAll('button, td, [role="gridcell"]'))
          .find(el => el.textContent.trim() === td && isVis(el) && !el.disabled);
        if (!day) return false;
        day.click(); return true;
      }, targetDay).catch(() => false);
      await sleep(500);
    }

    // ── Message ──
    await propFrame.evaluate((msg) => {
      const ta = document.querySelector('textarea');
      if (ta) {
        const ns = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        ns.call(ta, msg);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, MSG).catch(() => {});
    await sleep(400);

    // ── Submit ──
    const subCoords = await propFrame.evaluate(() => {
      const sub = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Send Proposal');
      if (!sub) return null;
      const r = sub.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }).catch(() => null);
    if (!subCoords) { errors.push({ name, email, reason: 'no-submit-btn' }); continue; }
    await page.mouse.click(Math.round(iRect.x + subCoords.x), Math.round(iRect.y + subCoords.y));
    await sleep(1500);

    // ── "I understand" — clicking causes page navigation = success ──
    let proposalSent = false;
    try {
      await propFrame.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'I understand');
        if (btn) btn.click();
      });
      await sleep(2500);
      const gone = await page.evaluate(() => !document.querySelector('iframe[src*="send-proposal"], iframe[src*="proposal"]'));
      proposalSent = gone;
      if (!gone) errors.push({ name, email, reason: 'submit-not-confirmed' });
    } catch (_navError) {
      proposalSent = true;
      await sleep(1500);
      await page.goto(DISCOVER_URL).catch(() => {});
      await sleep(3000);
    }

    if (proposalSent) {
      invited.push({ name, email, termVerified: termOk, termText, dateVerified: dateOk });
      alreadySet.add(name.toLowerCase());
    }
    await sleep(500);
  }

  return { total: invited.length, errorCount: errors.length, publishers: invited, errors: errors.slice(0, 10) };
}
