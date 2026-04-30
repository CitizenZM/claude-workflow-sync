// Impact Rockbros US bulk proposal script v4 — full slideout intelligence
// Architecture: slideout renders in React virtual DOM, only accessible via
//   Playwright page.locator() (a11y tree) or page.getByText() — NOT evaluate()
//
// Scrapes both Properties + Details tabs:
//   Properties: partner_id, status, size, description, contact (name/role/email),
//               language, address, content_categories, legacy_categories, tags,
//               media_kits, currency, promotional_areas
//   Details:    website, learn_more_url, social_properties[], verified status
//
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

  const ensureDiscover = async () => {
    const url = page.url();
    if (!url.includes('partner_discover') || url.includes('slideout_id=')) {
      await page.goto(DISCOVER_URL);
      await sleep(3000);
    }
  };

  // ── LOCATOR-BASED SLIDEOUT SCRAPER ─────────────────────────────────────────
  // Uses page.locator() which targets the a11y tree — the only way to reach
  // Impact's React virtual DOM slideout content
  const scrapeSlideout = async (pubName) => {
    const pub = {
      name: pubName,
      partner_id: null, status: null, partner_size: null, business_model: null,
      description: null,
      contact_name: null, contact_role: null, contact_email: null,
      language: null, promotional_areas: [], corporate_address: null,
      content_categories: [], legacy_categories: [], tags: [],
      media_kit_urls: [], currency: null,
      // Details tab
      website: null, learn_more_url: null, social_properties: [],
      verified: null,
      scraped_at: new Date().toISOString().slice(0, 10),
    };

    // Helper: safe text from locator
    const safeText = async (loc) => {
      try { return (await loc.first().textContent({ timeout: 1500 }))?.trim() || null; }
      catch { return null; }
    };

    // Helper: get all texts matching a locator
    const allTexts = async (loc) => {
      try {
        const count = await loc.count();
        const texts = [];
        for (let i = 0; i < count; i++) {
          const t = await loc.nth(i).textContent({ timeout: 1000 });
          if (t?.trim()) texts.push(t.trim());
        }
        return texts;
      } catch { return []; }
    };

    // ── HEADER (always visible) ──
    // Partner ID — appears as a standalone number near the name
    try {
      const idLoc = page.getByText(/^\d{7,10}$/).first();
      pub.partner_id = await safeText(idLoc);
    } catch {}

    // Description — long text block in slideout
    try {
      // The description is the large text body, uniquely long among slideout content
      const descLoc = page.locator('[ref="e836"], [class*="description"], [class*="about"]').first();
      pub.description = await safeText(descLoc);
    } catch {}

    // Status / size / business model chips
    const statusLabels = ['Active', 'New', 'Pending'];
    const sizeLabels = ['Small', 'Medium', 'Large', 'Extra Large'];
    for (const s of statusLabels) {
      try {
        const el = page.getByText(s, { exact: true }).first();
        if (await el.isVisible({ timeout: 800 })) { pub.status = s; break; }
      } catch {}
    }
    for (const s of sizeLabels) {
      try {
        const el = page.getByText(s, { exact: true }).first();
        if (await el.isVisible({ timeout: 800 })) { pub.partner_size = s; break; }
      } catch {}
    }

    // ── PROPERTIES TAB ──
    // Ensure Properties tab is active (click it)
    try {
      const propTab = page.getByText('Properties', { exact: true }).first();
      if (await propTab.isVisible({ timeout: 1000 })) await propTab.click();
      await sleep(800);
    } catch {}

    // Contact name — appears after "Contacts" heading, before "Marketplace Contact"
    try {
      const contactHeading = page.getByText('Contacts', { exact: true }).first();
      if (await contactHeading.isVisible({ timeout: 1000 })) {
        // Name is first proper name after "Contacts"
        const nameEl = page.locator('[ref="e883"]').first();
        pub.contact_name = await safeText(nameEl);
      }
    } catch {}

    // Contact role
    try {
      pub.contact_role = await safeText(page.getByText('Marketplace Contact', { exact: true }).first());
    } catch {}

    // Contact email — matches email pattern near contact section
    try {
      const emailLoc = page.locator('[ref="e892"]').first();
      const emailText = await safeText(emailLoc);
      if (emailText && /[@]/.test(emailText)) pub.contact_email = emailText;
    } catch {}
    // Fallback: scan for any email-looking text in slideout
    if (!pub.contact_email) {
      try {
        const emailRe = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;
        const allVisible = await page.locator('text=/[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}/').allTextContents();
        pub.contact_email = allVisible.find(t => emailRe.test(t)) || null;
      } catch {}
    }

    // Language (from Personal information table)
    try {
      pub.language = await safeText(page.locator('[ref="e908"]').first());
    } catch {}

    // Corporate address
    try {
      pub.corporate_address = await safeText(page.locator('[ref="e919"]').first());
    } catch {}

    // Promotional areas
    try {
      const promoSection = page.locator('[ref="e909"]');
      if (await promoSection.isVisible({ timeout: 800 })) {
        const promoText = await safeText(promoSection);
        if (promoText && promoText !== 'No promotional areas') {
          pub.promotional_areas = promoText.split(/[\n,]+/).map(t => t.trim()).filter(Boolean);
        }
      }
    } catch {}

    // Content categories
    try {
      const ccSection = page.locator('[ref="e920"]');
      const ccText = await safeText(ccSection);
      if (ccText && ccText !== 'No Categories') {
        pub.content_categories = ccText.replace('Content Categories', '').trim()
          .split(/[\n,]+/).map(t => t.trim()).filter(t => t && t.length > 1);
      }
    } catch {}

    // Legacy categories — get all chip items under the section
    try {
      const lcSection = page.locator('[ref="e943"]');
      if (await lcSection.isVisible({ timeout: 800 })) {
        pub.legacy_categories = await allTexts(lcSection.locator('span, [class*="chip"], [class*="tag"], div'));
        pub.legacy_categories = pub.legacy_categories.filter(t => !t.startsWith('+') && t.length > 1 && t.length < 80);
      }
    } catch {}
    // Fallback: known categories from snapshot
    if (!pub.legacy_categories.length) {
      try {
        const knownCats = ['Apparel, Shoes & Accessories','Women\'s Apparel','Men\'s Apparel','Shoes',
          'Jewelry & Watches','Bags & Accessories','Luxury'];
        for (const cat of knownCats) {
          try {
            if (await page.getByText(cat, { exact: true }).first().isVisible({ timeout: 400 })) {
              pub.legacy_categories.push(cat);
            }
          } catch {}
        }
      } catch {}
    }

    // Tags
    try {
      const tagsSection = page.locator('[ref="e971"]');
      if (await tagsSection.isVisible({ timeout: 800 })) {
        pub.tags = await allTexts(tagsSection.locator('span, [class*="chip"], [class*="tag"]'));
        pub.tags = pub.tags.filter(t => !t.startsWith('+') && t.length > 0 && t.length < 40);
      }
    } catch {}

    // Media kits
    try {
      const mkLinks = page.locator('[ref="e1000"] a, [ref="e995"] a').filter({ hasText: /.pdf/i });
      const count = await mkLinks.count();
      for (let i = 0; i < count; i++) {
        try {
          const a = mkLinks.nth(i);
          const name = await safeText(a);
          const href = await a.getAttribute('href');
          if (href) pub.media_kit_urls.push({ name, url: href });
        } catch {}
      }
    } catch {}

    // Currency
    try {
      pub.currency = await safeText(page.locator('[ref="e1018"]').first());
    } catch {}

    // ── DETAILS TAB ──
    try {
      const detTab = page.getByText('Details', { exact: true }).first();
      if (await detTab.isVisible({ timeout: 1000 })) {
        await detTab.click();
        await sleep(1500);

        // Website link — visible link in Details panel
        try {
          const wsLink = page.locator('[ref="e1043"]').first();
          pub.website = await wsLink.getAttribute('href') || await safeText(wsLink);
        } catch {}
        // Fallback: find any http link in the panel
        if (!pub.website) {
          try {
            const links = page.locator('[ref="e1038"] a[href^="http"], [ref="e859"] a[href^="http"]');
            const count = await links.count();
            for (let i = 0; i < count; i++) {
              const href = await links.nth(i).getAttribute('href');
              if (href && !href.includes('impact.com')) { pub.website = href; break; }
            }
          } catch {}
        }

        // Learn more URL (same or different from website)
        try {
          const lmText = await safeText(page.getByText('Learn more', { exact: true }).first());
          if (lmText) {
            // Learn more is near the website link
            const lmLink = page.locator('[ref="e1039"] a').first();
            pub.learn_more_url = await lmLink.getAttribute('href') || pub.website;
          }
        } catch {}

        // Social properties — collect all property cards in Details
        try {
          const detailsSection = page.locator('[ref="e1038"]');
          const propCards = detailsSection.locator('[ref^="e1039"], [ref^="e1046"]');
          const cardCount = await propCards.count();
          for (let i = 0; i < cardCount; i++) {
            try {
              const card = propCards.nth(i);
              const cardText = await safeText(card);
              const cardLink = await card.locator('a').first().getAttribute('href').catch(() => null);
              if (cardText || cardLink) {
                pub.social_properties.push({ text: cardText?.slice(0, 100), link: cardLink });
              }
            } catch {}
          }
        } catch {}

        // Verified status
        try {
          const notVerified = page.getByText('Not verified', { exact: true }).first();
          const isVerified = page.getByText('Verified', { exact: true }).first();
          if (await notVerified.isVisible({ timeout: 500 })) pub.verified = false;
          else if (await isVerified.isVisible({ timeout: 500 })) pub.verified = true;
        } catch {}

        // Switch back to Properties
        try {
          await page.getByText('Properties', { exact: true }).first().click();
          await sleep(600);
        } catch {}
      }
    } catch {}

    return pub;
  };

  // ── MAIN LOOP ──────────────────────────────────────────────────────────────
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

    // Open slideout by clicking avatar
    const avatarCoords = await page.evaluate((n) => {
      for (const c of document.querySelectorAll('.discovery-card, [class*="discovery-card"]')) {
        if (c.querySelector('[class*="name"]')?.textContent.trim() !== n) continue;
        const img = c.querySelector('img') || c;
        const r = img.getBoundingClientRect();
        if (r.width > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
      }
      return null;
    }, name);
    if (!avatarCoords) { errors.push({ name, reason: 'no-avatar' }); continue; }

    await page.mouse.click(avatarCoords.x, avatarCoords.y);
    await sleep(3500);
    if (!page.url().includes('slideout_id=')) { errors.push({ name, reason: 'slideout-no-open' }); continue; }

    // Deep scrape via locators
    const pubData = await scrapeSlideout(name);

    // Close slideout
    await page.keyboard.press('Escape');
    await sleep(800);
    if (page.url().includes('slideout_id=')) {
      await page.goto(DISCOVER_URL);
      await sleep(3000);
    }

    // Re-query cards
    cards = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.discovery-card, [class*="discovery-card"]')).map((c, i) => ({
        i, name: c.querySelector('[class*="name"]')?.textContent.trim() || `card_${i}`,
        hasBtn: Array.from(c.querySelectorAll('button')).some(b => b.textContent.trim() === 'Send Proposal'),
      }))
    );
    const fresh = cards.find(c => c.name === name);
    if (!fresh?.hasBtn) { errors.push({ name, reason: 'card-gone' }); continue; }

    // Open proposal form
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

    // "I understand" nav-catch
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
