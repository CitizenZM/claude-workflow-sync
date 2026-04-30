// Impact Rockbros US bulk proposal script v5 — a11y-tree scraper
//
// KEY ARCHITECTURE FINDING (confirmed via live DOM exploration):
//   The slideout panel renders exclusively in Playwright's a11y tree.
//   document.querySelectorAll / shadow DOM / iframes all return nothing.
//   ONLY page.locator() / page.getByText() / page.getByRole() can reach it.
//   This requires browser_run_code (gives `page`), never browser_evaluate.
//
// Scrapes Properties tab: partner_id, status, size, business_model, description,
//   contact (name/role/email), language, address, promo_areas, content_cats,
//   legacy_cats, tags, media_kits, currency
// Scrapes Details tab: website, learn_more_url, social_properties[], verified
// Then sends proposal with page.mouse.click() for iframe term selection.
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
    if (!page.url().includes('partner_discover') || page.url().includes('slideout_id=')) {
      await page.goto(DISCOVER_URL);
      await sleep(3000);
    }
  };

  // ── SAFE HELPERS ────────────────────────────────────────────────────────────
  const safeText = async (loc, timeout = 1500) => {
    try { return (await loc.first().textContent({ timeout }))?.trim() || null; }
    catch { return null; }
  };

  const safeAttr = async (loc, attr, timeout = 1500) => {
    try { return await loc.first().getAttribute(attr, { timeout }); }
    catch { return null; }
  };

  const safeVisible = async (loc, timeout = 800) => {
    try { return await loc.first().isVisible({ timeout }); }
    catch { return false; }
  };

  const safeClick = async (loc, timeout = 1500) => {
    try { await loc.first().click({ timeout }); return true; }
    catch { return false; }
  };

  const allTexts = async (loc, timeout = 1000) => {
    try {
      const count = await loc.count();
      const out = [];
      for (let i = 0; i < Math.min(count, 30); i++) {
        const t = (await loc.nth(i).textContent({ timeout }))?.trim();
        if (t) out.push(t);
      }
      return out;
    } catch { return []; }
  };

  // ── SLIDEOUT SCRAPER using page.locator() (a11y tree) ─────────────────────
  const scrapeSlideout = async (name) => {
    const pub = {
      name,
      partner_id: null, status: null, partner_size: null, business_model: null,
      description: null,
      contact_name: null, contact_role: null, contact_email: null,
      language: null, promotional_areas: [], corporate_address: null,
      content_categories: [], legacy_categories: [], tags: [],
      media_kit_urls: [], currency: null,
      website: null, learn_more_url: null,
      social_properties: [], verified: null,
      scraped_at: new Date().toISOString().slice(0, 10),
    };

    // ── HEADER (always visible regardless of active tab) ──
    // Partner ID — standalone 7-digit number in header
    pub.partner_id = await safeText(page.getByText(/^\d{7,10}$/).first());

    // Description — the large "about" text block
    pub.description = await safeText(page.locator('text=/Performance-Based|We bridge|We are|We\'re/').first(), 2000);

    // Status chip
    for (const s of ['Active', 'New', 'Pending']) {
      if (await safeVisible(page.getByText(s, { exact: true }))) { pub.status = s; break; }
    }

    // Partner size chip
    for (const s of ['Extra Large', 'Large', 'Medium', 'Small']) {
      if (await safeVisible(page.getByText(s, { exact: true }))) { pub.partner_size = s; break; }
    }

    // Business model (·Network, ·Content, etc. — appears in header chip row)
    for (const m of ['Network', 'Content', 'Coupon', 'Email', 'Loyalty', 'Sub-affiliate']) {
      const loc = page.getByText(new RegExp(`·?${m}`, 'i')).first();
      if (await safeVisible(loc)) { pub.business_model = m; break; }
    }

    // ── PROPERTIES TAB ──
    // Click Properties tab to ensure it's active
    const propTab = page.getByText('Properties', { exact: true }).first();
    if (await safeVisible(propTab)) {
      await safeClick(propTab);
      await sleep(800);
    }

    // Contact: name is first "Firstname Lastname" style text after Contacts heading
    // We use a relative locator: sibling after Contacts heading
    try {
      const contactsSection = page.getByText('Contacts', { exact: true }).first();
      if (await safeVisible(contactsSection, 1000)) {
        // Contact name — look for text that matches "Firstname Lastname" pattern near Contacts
        const nameText = await safeText(
          page.locator('text=/^[A-Z][a-z]+ [A-Z][a-z]+/').first(), 1500
        );
        if (nameText && nameText.length < 50) pub.contact_name = nameText;

        // Contact role
        pub.contact_role = await safeText(
          page.getByText('Marketplace Contact', { exact: true }).first()
        );
      }
    } catch {}

    // Contact email — match email pattern anywhere in slideout
    const emailLoc = page.locator('text=/[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}/').first();
    pub.contact_email = await safeText(emailLoc);

    // Language — appears in "Personal information" table as value after "Language" label
    try {
      const langSection = page.getByText('Personal information', { exact: true }).first();
      if (await safeVisible(langSection, 1000)) {
        // Language value follows the "Language" label
        pub.language = await safeText(page.getByText('English', { exact: true }).first());
        if (!pub.language) pub.language = await safeText(page.getByRole('cell').nth(1));
      }
    } catch {}

    // Corporate address — contains "United States" or state abbreviation + city pattern
    const addrLoc = page.locator('text=/United States|, [A-Z]{2} United/').first();
    pub.corporate_address = await safeText(addrLoc);

    // Promotional areas — section after "Promotional areas" heading
    const promoSection = page.getByText('Promotional areas', { exact: true }).first();
    if (await safeVisible(promoSection, 800)) {
      const promoText = await safeText(
        page.locator('text=/(?!.*Promotional areas).*United States|No promotional areas/').first(), 1200
      );
      if (promoText && promoText !== 'No promotional areas') {
        pub.promotional_areas = [promoText];
      }
    }

    // Content categories
    try {
      const ccHeading = page.getByText('Content Categories', { exact: true }).first();
      if (await safeVisible(ccHeading, 800)) {
        const ccText = await safeText(page.locator('text=/No Categories/').first(), 800);
        if (!ccText) {
          // Get all category chips that appear after Content Categories heading
          pub.content_categories = await allTexts(
            page.locator('[class*="category-chip"], [class*="content-cat"]')
          );
        }
      }
    } catch {}

    // Legacy categories — get visible chip texts in that section
    try {
      const lcSection = page.getByText('Legacy Categories', { exact: true }).first();
      if (await safeVisible(lcSection, 800)) {
        // Known categories from a11y tree — try each
        const knownCats = [
          'Apparel, Shoes & Accessories', 'Women\'s Apparel', 'Men\'s Apparel', 'Shoes',
          'Jewelry & Watches', 'Bags & Accessories', 'Luxury', 'Health & Beauty',
          'Sports & Fitness', 'Consumer Electronics', 'Home & Garden',
        ];
        for (const cat of knownCats) {
          if (await safeVisible(page.getByText(cat, { exact: true }), 400)) {
            pub.legacy_categories.push(cat);
          }
        }
      }
    } catch {}

    // Tags — collect all short text chips in Tags section
    try {
      const tagsHeading = page.getByText('Tags', { exact: true }).first();
      if (await safeVisible(tagsHeading, 800)) {
        const knownTags = ['banking','finance','fintech','gaming','insurance',
          'newsletter','subscription','loyalty','coupon','content','review',
          'deals','cashback','social media','influencer','blog'];
        for (const tag of knownTags) {
          if (await safeVisible(page.getByText(tag, { exact: true }), 300)) {
            pub.tags.push(tag);
          }
        }
      }
    } catch {}

    // Media kits — links containing .pdf
    try {
      const mkSection = page.getByText('Media Kits', { exact: true }).first();
      if (await safeVisible(mkSection, 800)) {
        const pdfLinks = page.getByRole('link').filter({ hasText: /\.pdf/i });
        const count = await pdfLinks.count();
        for (let i = 0; i < Math.min(count, 5); i++) {
          const linkText = await safeText(pdfLinks.nth(i));
          const href = await safeAttr(pdfLinks.nth(i), 'href');
          if (href || linkText) pub.media_kit_urls.push({ name: linkText, url: href });
        }
      }
    } catch {}

    // Currency
    try {
      const currHeading = page.getByText('Currency', { exact: true }).first();
      if (await safeVisible(currHeading, 800)) {
        pub.currency = await safeText(page.getByText('USD', { exact: true }).first(), 800)
          || await safeText(page.getByText('EUR', { exact: true }).first(), 400);
      }
    } catch {}

    // ── DETAILS TAB ──
    const detTab = page.getByText('Details', { exact: true }).first();
    if (await safeVisible(detTab)) {
      await safeClick(detTab);
      await sleep(1500);

      // Website — first external link in Details tab
      const extLinks = page.getByRole('link').filter({ hasText: /^https?:\/\//i });
      const extCount = await extLinks.count();
      for (let i = 0; i < Math.min(extCount, 5); i++) {
        const href = await safeAttr(extLinks.nth(i), 'href');
        const txt = await safeText(extLinks.nth(i));
        if (href && !href.includes('impact.com')) {
          pub.website = href;
          break;
        }
        if (txt && txt.startsWith('http') && !txt.includes('impact.com')) {
          pub.website = txt;
          break;
        }
      }

      // Learn more — text near website link
      if (await safeVisible(page.getByText('Learn more', { exact: true }), 800)) {
        pub.learn_more_url = pub.website; // learn more links to the same property URL
      }

      // Social properties — collect all property cards (each has a link + status)
      try {
        // Each property card has a link and optional "Not verified" / "Verified" text
        const allLinks = page.getByRole('link');
        const linkCount = await allLinks.count();
        const propUrls = [];
        for (let i = 0; i < Math.min(linkCount, 10); i++) {
          const href = await safeAttr(allLinks.nth(i), 'href');
          const txt = await safeText(allLinks.nth(i));
          if (href && !href.includes('impact.com') && !href.includes('impactradius')) {
            propUrls.push({ url: href, text: txt });
          }
        }
        pub.social_properties = propUrls;
      } catch {}

      // Verified status
      if (await safeVisible(page.getByText('Not verified', { exact: true }), 500)) {
        pub.verified = false;
      } else if (await safeVisible(page.getByText('Verified', { exact: true }), 500)) {
        pub.verified = true;
      }

      // Switch back to Properties
      await safeClick(page.getByText('Properties', { exact: true }).first());
      await sleep(500);
    }

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

    // Open slideout via page.mouse.click on avatar
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
    if (!page.url().includes('slideout_id=')) { errors.push({ name, reason: 'no-slideout' }); continue; }

    // Scrape full profile via a11y-tree locators
    const pubData = await scrapeSlideout(name);

    // Close slideout
    await page.keyboard.press('Escape');
    await sleep(800);
    if (page.url().includes('slideout_id=')) {
      await page.goto(DISCOVER_URL);
      await sleep(3000);
    }

    // Re-query cards after navigation
    cards = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.discovery-card, [class*="discovery-card"]')).map((c, i) => ({
        i, name: c.querySelector('[class*="name"]')?.textContent.trim() || `card_${i}`,
        hasBtn: Array.from(c.querySelectorAll('button')).some(b => b.textContent.trim() === 'Send Proposal'),
      }))
    );
    const fresh = cards.find(c => c.name === name);
    if (!fresh?.hasBtn) { errors.push({ name, reason: 'card-gone' }); continue; }

    // ── SEND PROPOSAL ──
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

    // Term: Performance or highest %
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
      sent = await page.evaluate(() =>
        !document.querySelector('iframe[src*="send-proposal"], iframe[src*="proposal"]')
      );
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
