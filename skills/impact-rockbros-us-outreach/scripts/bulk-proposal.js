// Impact Rockbros US bulk proposal script v3 — deep publisher intelligence
// Architecture discovery: slideout data is in a named frame accessible via page.frames()
// Scrapes: name, description, partner_id, status, size, business_model,
//   contact (name/role/email), language, address, content_categories,
//   legacy_categories, tags, media_kit_urls, currency — both Properties + Details tabs
// Placeholders: %%MSG%% %%CONTRACT_DATE%% %%ALREADY%% %%TARGET%% %%DISCOVER_URL%%

async (page) => {
  const DISCOVER_URL = "%%DISCOVER_URL%%";
  const MSG = "%%MSG%%";
  const CONTRACT_DATE = "%%CONTRACT_DATE%%";
  const ALREADY = %%ALREADY%%;
  const TARGET = %%TARGET%%;

  const sleep = ms => page.waitForTimeout(ms);
  const alreadySet = new Set(ALREADY.map(n => n.toLowerCase()));
  const results = [], errors = [], seen = new Set();

  const getPropFrame = () => page.frames().find(f =>
    f.url().includes('send-proposal') || f.url().includes('proposal')
  );

  // Find the slideout frame — Impact renders publisher details in a named frame
  const getSlideoutFrame = () => {
    const frames = page.frames();
    // Try: frame whose URL contains 'partner' or 'slideout' or 'profile'
    return frames.find(f =>
      f.url().includes('partner') && !f.url().includes('partner_discover') ||
      f.url().includes('slideout') ||
      f.url().includes('profile') ||
      f.url().includes('publisher')
    ) || null;
  };

  const ensureDiscover = async () => {
    const url = page.url();
    if (!url.includes('partner_discover') || url.includes('slideout_id=')) {
      await page.goto(DISCOVER_URL);
      await sleep(3000);
    }
  };

  // ── DEEP SCRAPER ────────────────────────────────────────────────────────────
  const scrapePublisher = async (name) => {
    const pub = {
      name, partner_id: null, status: null, partner_size: null, business_model: null,
      description: null,
      contact_name: null, contact_role: null, contact_email: null,
      language: null, promotional_areas: [], corporate_address: null,
      content_categories: [], legacy_categories: [], tags: [],
      media_kit_urls: [], currency: null, website: null,
      details_raw: [], scraped_at: new Date().toISOString().slice(0, 10),
    };

    // 1. Click avatar to open slideout
    const avatarCoords = await page.evaluate((n) => {
      for (const card of document.querySelectorAll('.discovery-card, [class*="discovery-card"]')) {
        if (card.querySelector('[class*="name"]')?.textContent.trim() !== n) continue;
        const img = card.querySelector('img') || card;
        const r = img.getBoundingClientRect();
        if (r.width > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      }
      return null;
    }, name);
    if (!avatarCoords) return pub;

    await page.mouse.click(avatarCoords.x, avatarCoords.y);
    await sleep(3500);
    if (!page.url().includes('slideout_id=')) return pub;

    // 2. Try to read from slideout frame first
    let slideoutFrame = getSlideoutFrame();

    // 3. If no slideout frame, scrape from main page using Playwright's frame context
    // The slideout renders its content in a separate frame context accessible via page.frames()
    // Log all frames for debugging
    const frameUrls = page.frames().map(f => ({ url: f.url().slice(0, 100), name: f.name() }));

    // 4. Extract data using page.evaluate with deep search —
    // The key insight: content IS in the DOM but in a nested structure we haven't pierced yet
    // Try querying with ::shadow-piercing or checking all nested documents
    const slideoutData = await page.evaluate(() => {
      const emailRe = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;

      // Walk all frames in the window context
      const searchInDoc = (doc, depth = 0) => {
        if (depth > 3 || !doc) return null;
        const text = doc.body?.innerText || '';
        if (!text.includes('Contacts') && !text.includes('Partner ID')) return null;

        // We found the right document — extract
        const getEl = selector => doc.querySelector(selector);
        const getAllEls = selector => Array.from(doc.querySelectorAll(selector));

        // Get all text nodes near section labels
        const allLeaf = getAllEls('*').filter(el =>
          el.children.length === 0 && el.textContent.trim().length > 0
        );
        const txt = el => el.textContent.trim();

        // Structured extraction by known section labels
        const sectionContent = (label, maxItems = 20) => {
          const labelEl = allLeaf.find(el => txt(el) === label);
          if (!labelEl) return [];
          const labelIdx = allLeaf.indexOf(labelEl);
          const stopLabels = ['Contacts','Personal information','Promotional areas',
            'Corporate address','Content Categories','Legacy Categories','Tags',
            'Media Kits','Currency','Partner ID','Properties','Details'];
          const items = [];
          for (let i = labelIdx + 1; i < allLeaf.length && items.length < maxItems; i++) {
            const t = txt(allLeaf[i]);
            if (stopLabels.includes(t)) break;
            if (t && t.length < 200) items.push(t);
          }
          return items;
        };

        return {
          found: true,
          partner_id: allLeaf.find(el => /^\d{7,10}$/.test(txt(el)))?.textContent.trim(),
          status: allLeaf.find(el => ['Active','New','Pending'].includes(txt(el)))?.textContent.trim(),
          partner_size: allLeaf.find(el => ['Small','Medium','Large','Extra Large'].includes(txt(el)))?.textContent.trim(),
          description: allLeaf.filter(el => txt(el).length > 60 && txt(el).length < 600)[0]?.textContent.trim(),
          contact_email: allLeaf.find(el => emailRe.test(txt(el)) && txt(el).length < 80)?.textContent.trim(),
          contact_name: sectionContent('Contacts').find(t => !emailRe.test(t) && t !== 'Email' && /^[A-Z]/.test(t) && t.includes(' ') && t.length < 50),
          contact_role: sectionContent('Contacts').find(t => t.includes('Contact') || t.includes('Manager')),
          language: (() => {
            const rows = getAllEls('tr, row');
            for (const r of rows) {
              const cells = getAllEls.bind(r)('td, cell') || Array.from(r.querySelectorAll('td, cell'));
              if (cells.length >= 2 && cells[0].textContent.trim() === 'Language') return cells[1].textContent.trim();
            }
            return null;
          })(),
          corporate_address: allLeaf.find(el => {
            const t = txt(el);
            return (t.includes('United States') || t.includes('Canada')) && t.includes(',') && t.length < 100;
          })?.textContent.trim(),
          promotional_areas: sectionContent('Promotional areas').filter(t => t !== 'No promotional areas'),
          content_categories: sectionContent('Content Categories').filter(t => t !== 'No Categories' && !t.startsWith('+')),
          legacy_categories: sectionContent('Legacy Categories').filter(t => !t.startsWith('+') && t.length < 80),
          tags: sectionContent('Tags').filter(t => !t.startsWith('+') && t.length < 40),
          media_kits: Array.from(doc.querySelectorAll('a[href*="cdn.impact"], a[href*="mediakit"]'))
            .map(a => ({ name: a.textContent.trim(), url: a.href })),
          currency: sectionContent('Currency')[0] || null,
          website: Array.from(doc.querySelectorAll('a[href^="http"]'))
            .find(a => !a.href.includes('impact.com') && a.href.length > 10)?.href || null,
        };
      };

      // Try main document first (slideout might be React-rendered there)
      let result = searchInDoc(document);
      if (result) return result;

      // Try all accessible frames
      for (const frame of Array.from(window.frames)) {
        try {
          const r = searchInDoc(frame.document);
          if (r) return r;
        } catch (_) {}
      }

      return { found: false };
    });

    if (slideoutData?.found) {
      pub.partner_id = slideoutData.partner_id || null;
      pub.status = slideoutData.status || null;
      pub.partner_size = slideoutData.partner_size || null;
      pub.description = slideoutData.description || null;
      pub.contact_email = slideoutData.contact_email || null;
      pub.contact_name = slideoutData.contact_name || null;
      pub.contact_role = slideoutData.contact_role || null;
      pub.language = slideoutData.language || null;
      pub.corporate_address = slideoutData.corporate_address || null;
      pub.promotional_areas = slideoutData.promotional_areas || [];
      pub.content_categories = slideoutData.content_categories || [];
      pub.legacy_categories = slideoutData.legacy_categories || [];
      pub.tags = slideoutData.tags || [];
      pub.media_kit_urls = slideoutData.media_kits || [];
      pub.currency = slideoutData.currency || null;
      pub.website = slideoutData.website || null;
    }

    // 5. Try slideout frame directly via Playwright frames() — this accesses cross-origin frames
    if (slideoutFrame) {
      try {
        const frameData = await slideoutFrame.evaluate(() => {
          const emailRe = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;
          const all = Array.from(document.querySelectorAll('*'))
            .filter(el => el.children.length === 0 && el.textContent.trim().length > 0)
            .sort((a,b) => a.getBoundingClientRect().y - b.getBoundingClientRect().y);
          const txt = el => el.textContent.trim();
          return {
            frameText: document.body.innerText.slice(0, 500),
            email: all.find(el => emailRe.test(txt(el)))?.textContent.trim() || null,
            allText: [...new Set(all.map(el => txt(el)).filter(t => t.length < 200))].slice(0, 40),
          };
        });
        pub.details_raw = frameData.allText || [];
        if (!pub.contact_email && frameData.email) pub.contact_email = frameData.email;
      } catch (_) {}
    }

    // 6. If we still have no data, collect from accessibility snapshot data we know is there
    // Fallback: use the frame URL's slideout_id to construct direct API call
    if (!pub.partner_id) {
      const urlMatch = page.url().match(/slideout_id=([^&]+)/);
      pub.slideout_id_encoded = urlMatch?.[1] || null;
    }

    // 7. Click Details tab via page.mouse and try frame extraction again
    const detTabCoords = await page.evaluate(() => {
      // Details tab is in the main page DOM — it's a navigation element
      const all = Array.from(document.querySelectorAll('*'));
      const det = all.find(el =>
        el.children.length === 0 && el.textContent.trim() === 'Details' &&
        el.getBoundingClientRect().x > 820 && el.getBoundingClientRect().y > 80 &&
        el.getBoundingClientRect().y < 220 && el.getBoundingClientRect().width > 0
      );
      if (!det) return null;
      const r = det.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    });

    if (detTabCoords) {
      await page.mouse.click(detTabCoords.x, detTabCoords.y);
      await sleep(2000);
      // Re-check frames after tab click
      slideoutFrame = getSlideoutFrame();
      if (slideoutFrame) {
        try {
          const detData = await slideoutFrame.evaluate(() => {
            const emailRe = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;
            const all = Array.from(document.querySelectorAll('*'))
              .filter(el => el.children.length === 0 && el.textContent.trim())
              .sort((a,b) => a.getBoundingClientRect().y - b.getBoundingClientRect().y);
            return {
              raw: [...new Set(all.map(el => el.textContent.trim()).filter(t => t.length < 200))].slice(0, 30),
              emails: all.filter(el => emailRe.test(el.textContent.trim())).map(el => el.textContent.trim()),
              links: Array.from(document.querySelectorAll('a[href^="http"]'))
                .filter(a => !a.href.includes('impact.com')).map(a => a.href),
            };
          });
          if (detData.raw.length) pub.details_raw = detData.raw;
          if (!pub.contact_email && detData.emails[0]) pub.contact_email = detData.emails[0];
          if (!pub.website && detData.links[0]) pub.website = detData.links[0];
        } catch (_) {}
      }
    }

    // 8. Close slideout
    await page.keyboard.press('Escape');
    await sleep(800);
    if (page.url().includes('slideout_id=')) {
      await page.goto(DISCOVER_URL);
      await sleep(3000);
    }

    return pub;
  };

  // ── PROPOSAL LOOP ──────────────────────────────────────────────────────────
  await sleep(2000);
  let cards = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.discovery-card, [class*="discovery-card"]')).map((c, i) => ({
      i,
      name: c.querySelector('[class*="name"]')?.textContent.trim() || `card_${i}`,
      hasBtn: Array.from(c.querySelectorAll('button')).some(b => b.textContent.trim() === 'Send Proposal'),
    }))
  );

  for (const card of cards) {
    if (results.length >= TARGET) break;
    const { name, hasBtn } = card;
    if (!hasBtn || alreadySet.has(name.toLowerCase()) || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());

    await ensureDiscover();
    const pubData = await scrapePublisher(name);
    await sleep(500);
    await ensureDiscover();

    cards = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.discovery-card, [class*="discovery-card"]')).map((c, i) => ({
        i, name: c.querySelector('[class*="name"]')?.textContent.trim() || `card_${i}`,
        hasBtn: Array.from(c.querySelectorAll('button')).some(b => b.textContent.trim() === 'Send Proposal'),
      }))
    );
    const fresh = cards.find(c => c.name === name);
    if (!fresh?.hasBtn) { errors.push({ name, reason: 'card-gone' }); continue; }

    await page.evaluate((n) => {
      for (const c of document.querySelectorAll('.discovery-card, [class*="discovery-card"]')) {
        if (c.querySelector('[class*="name"]')?.textContent.trim() !== n) continue;
        const btn = Array.from(c.querySelectorAll('button')).find(b => b.textContent.trim() === 'Send Proposal');
        if (btn) { btn.style.display = 'inline-block'; btn.click(); }
        break;
      }
    }, name);
    await sleep(3500);

    const propFrame = getPropFrame();
    if (!propFrame) { errors.push({ name, reason: 'no-iframe' }); continue; }
    await propFrame.waitForLoadState('domcontentloaded').catch(() => {});

    const iRect = await page.evaluate(() => {
      const iframe = document.querySelector('iframe[src*="send-proposal"], iframe[src*="proposal"]');
      if (!iframe) return null;
      const r = iframe.getBoundingClientRect();
      return { x: r.x, y: r.y };
    });
    if (!iRect) { errors.push({ name, reason: 'no-iframe-rect' }); continue; }

    // Term selection
    let termOk = false, termText = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      await propFrame.evaluate(() => {
        const t = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Select');
        if (t) t.click();
      });
      await sleep(1200);
      const liCoords = await propFrame.evaluate(() => {
        const isVis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
        const opts = Array.from(document.querySelectorAll('li[role="option"]')).filter(isVis);
        const best = opts.find(l => l.textContent.toLowerCase().includes('performance'))
          || opts.find(l => /\d+%/.test(l.textContent))
          || (opts.length > 1 ? opts[1] : null);
        if (!best) return null;
        const r = best.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: best.textContent.trim() };
      }).catch(() => null);
      if (!liCoords) { await sleep(400); continue; }
      await page.mouse.click(Math.round(iRect.x + liCoords.x), Math.round(iRect.y + liCoords.y));
      await sleep(800);
      const confirmed = await propFrame.evaluate(() =>
        Array.from(document.querySelectorAll('button'))
          .filter(b => b.getBoundingClientRect().width > 0)
          .some(b => b.textContent.toLowerCase().includes('performance') || /\d+%/.test(b.textContent))
      ).catch(() => false);
      if (confirmed) { termOk = true; termText = liCoords.text; break; }
      await sleep(400);
    }
    if (!termOk) { errors.push({ name, reason: 'no-term' }); continue; }

    // Date
    let dateOk = false;
    const targetDay = String(parseInt(CONTRACT_DATE.split('-')[2], 10));
    const dateCoords = await propFrame.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button[class*="input-wrap"]'))[0];
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
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
        const day = Array.from(cal.querySelectorAll('button,td,[role="gridcell"]'))
          .find(el => el.textContent.trim() === td && isVis(el) && !el.disabled);
        if (!day) return false;
        day.click(); return true;
      }, targetDay).catch(() => false);
      await sleep(500);
    }

    // Message
    await propFrame.evaluate((msg) => {
      const ta = document.querySelector('textarea');
      if (ta) {
        const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        s.call(ta, msg);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, MSG).catch(() => {});
    await sleep(400);

    // Submit
    const subCoords = await propFrame.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Send Proposal');
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }).catch(() => null);
    if (!subCoords) { errors.push({ name, reason: 'no-submit' }); continue; }
    await page.mouse.click(Math.round(iRect.x + subCoords.x), Math.round(iRect.y + subCoords.y));
    await sleep(1500);

    // "I understand"
    let sent = false;
    try {
      await propFrame.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'I understand');
        if (btn) btn.click();
      });
      await sleep(2500);
      const gone = await page.evaluate(() =>
        !document.querySelector('iframe[src*="send-proposal"], iframe[src*="proposal"]')
      );
      sent = gone;
    } catch (_) {
      sent = true;
      await sleep(1500);
      await page.goto(DISCOVER_URL).catch(() => {});
      await sleep(3000);
    }

    if (sent) {
      results.push({ ...pubData, termVerified: termOk, termText, dateVerified: dateOk, proposal_sent: true });
      alreadySet.add(name.toLowerCase());
    } else {
      errors.push({ name, reason: 'submit-not-confirmed' });
    }
    await sleep(500);
  }

  return { total: results.length, errorCount: errors.length, publishers: results, errors: errors.slice(0, 10) };
}
