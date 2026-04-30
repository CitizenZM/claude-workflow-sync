// Impact Rockbros US bulk proposal script v6 — complete publisher intelligence
//
// ARCHITECTURE (confirmed via live DOM exploration 2026-04-30):
//   - Slideout is a11y-tree-only. page.locator() / page.getByText() / page.getByRole() only.
//   - document.querySelectorAll returns nothing for slideout content.
//   - page.mouse.click() required for: tab switching, overflow expansion, iframe term selection.
//   - Properties tab: click to activate before scraping. Default tab on open.
//   - Details tab: click to activate. Shows website, social properties, verified status.
//   - "+N more" overflow buttons: must be clicked to expand all categories/tags.
//
// Full data captured per publisher (22 fields + overflow expansions):
//   Header: name, partner_id, status, partner_size, business_model, description
//   Properties: all_contacts[], language, promotional_areas[], corporate_address,
//               content_categories[], legacy_categories[] (+ full after expand),
//               tags[] (+ full after expand), media_kit_urls[], currency
//   Details: website, learn_more_url, social_properties[], verified
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

  const safeVisible = async (loc, timeout = 600) => {
    try { return await loc.first().isVisible({ timeout }); }
    catch { return false; }
  };

  const safeClick = async (loc, timeout = 1500) => {
    try { await loc.first().click({ timeout }); return true; }
    catch { return false; }
  };

  // Click by absolute screen coords (required for a11y-tree-only elements)
  const clickAt = async (x, y) => {
    await page.mouse.click(Math.round(x), Math.round(y));
    await sleep(600);
  };

  // Get screen coords of a slideout tab using page.locator().boundingBox()
  // This reads from Playwright's a11y tree — the ONLY way to get coords for React virtual DOM tabs.
  // getBoundingClientRect() in evaluate() returns 0 for these elements.
  const getTabCoords = async (tabText) => {
    try {
      // Find the tab locator — it's a [cursor=pointer] generic in the tab strip
      // Filter to only ones in the right-panel area (x > 820) with matching text
      const candidates = [
        page.getByText(tabText, { exact: true }),
        page.locator(`[cursor="pointer"]:has-text("${tabText}")`),
      ];
      for (const loc of candidates) {
        try {
          const count = await loc.count();
          for (let i = 0; i < count; i++) {
            const box = await loc.nth(i).boundingBox({ timeout: 600 });
            if (box && box.x > 820 && box.y > 80 && box.y < 250 && box.width > 20) {
              return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
            }
          }
        } catch {}
      }
    } catch {}
    return null;
  };

  // Expand a "+N more" overflow button by clicking it
  const expandOverflow = async (sectionText) => {
    const overflowBtns = page.getByText(/^\+\d+ more$/).filter({ hasText: /\+/ });
    const count = await overflowBtns.count();
    for (let i = 0; i < count; i++) {
      try {
        const btn = overflowBtns.nth(i);
        if (await btn.isVisible({ timeout: 400 })) {
          await btn.click({ timeout: 800 });
          await sleep(500);
        }
      } catch {}
    }
  };

  // Collect all visible text items from a section in the a11y tree
  const sectionItems = async (afterText, stopTexts = [], maxItems = 50) => {
    const items = [];
    try {
      // Use page.locator to get all text after a known heading
      const allLoc = page.locator(`text=/./`);
      const count = await allLoc.count();
      let collecting = false;
      for (let i = 0; i < Math.min(count, 200); i++) {
        try {
          const t = (await allLoc.nth(i).textContent({ timeout: 300 }))?.trim();
          if (!t) continue;
          if (t === afterText) { collecting = true; continue; }
          if (!collecting) continue;
          if (stopTexts.includes(t)) break;
          if (items.length >= maxItems) break;
          if (t.length > 0 && t.length < 200 && !t.startsWith('+')) items.push(t);
        } catch {}
      }
    } catch {}
    return items;
  };

  // ── COMPLETE SLIDEOUT SCRAPER ──────────────────────────────────────────────
  const scrapeSlideout = async (name) => {
    const pub = {
      name,
      // Header fields
      partner_id: null, status: null, partner_size: null, business_model: null,
      description: null,
      // Contact (may be multiple)
      all_contacts: [],          // [{name, role, email, initials}]
      contact_name: null,        // primary contact
      contact_role: null,
      contact_email: null,
      // Properties tab
      language: null,
      promotional_areas: [],
      corporate_address: null,
      content_categories: [],
      legacy_categories: [],
      legacy_categories_full: [],  // after clicking "+N more"
      tags: [],
      tags_full: [],               // after clicking "+N more"
      media_kit_urls: [],
      media_kit_count: 0,
      currency: null,
      // Details tab
      website: null,
      learn_more_url: null,
      social_properties: [],
      verified: null,
      // Web metrics (Details tab — only when publisher property is verified)
      semrush_global_rank: null,
      monthly_visitors: null,
      moz_spam_score: null,
      moz_domain_authority: null,
      scraped_at: new Date().toISOString().slice(0, 10),
    };

    // ── 1. HEADER: always visible ──────────────────────────────────────────
    // Partner ID (7–10 digit number near publisher name)
    pub.partner_id = await safeText(page.getByText(/^\d{7,10}$/).first());

    // Description (long text block ~60-600 chars in slideout)
    const descPatterns = [
      'text=/Performance-Based/',
      'text=/We bridge/',
      'text=/We are a/',
      "text=/We're a/",
      'text=/Our mission/',
      'text=/We help/',
      'text=/We provide/',
      'text=/We specialize/',
      'text=/About us/',
    ];
    for (const p of descPatterns) {
      const t = await safeText(page.locator(p).first(), 1000);
      if (t && t.length > 40) { pub.description = t; break; }
    }
    // Fallback: longest text block in slideout x range
    if (!pub.description) {
      try {
        const candidates = page.locator('[ref^="e"]').filter({ hasText: /\w{10,}/ });
        const cnt = await candidates.count();
        let longest = '';
        for (let i = 0; i < Math.min(cnt, 50); i++) {
          try {
            const t = (await candidates.nth(i).textContent({ timeout: 300 }))?.trim() || '';
            if (t.length > longest.length && t.length < 600 && t.length > 60) longest = t;
          } catch {}
        }
        if (longest) pub.description = longest;
      } catch {}
    }

    // Status
    for (const s of ['Active', 'New', 'Pending', 'Inactive']) {
      if (await safeVisible(page.getByText(s, { exact: true }))) { pub.status = s; break; }
    }

    // Partner size
    for (const s of ['Extra Large', 'Large', 'Medium', 'Small']) {
      if (await safeVisible(page.getByText(s, { exact: true }))) { pub.partner_size = s; break; }
    }

    // Business model
    for (const m of ['Network', 'Content', 'Coupon', 'Deal', 'Email', 'Loyalty', 'Sub-affiliate', 'Influencer']) {
      if (await safeVisible(page.getByText(new RegExp(`·?\\s*${m}`, 'i')).first())) {
        pub.business_model = m; break;
      }
    }

    // ── 2. SWITCH TO PROPERTIES TAB via page.mouse.click ──────────────────
    const propCoords = await getTabCoords('Properties');
    if (propCoords) {
      await clickAt(propCoords.x, propCoords.y);
      await sleep(1200);
    } else {
      // Try locator click as fallback
      await safeClick(page.getByText('Properties', { exact: true }).first());
      await sleep(1000);
    }

    // ── 3. CONTACTS SECTION (Properties tab only) ─────────────────────────
    // Structure: Contacts heading → [Avatar initials] → contact name → role → Email label → email value
    // ALL contact data is only visible on Properties tab — must be called after tab switch above.
    try {
      const emailRe = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;

      // Strategy 1: Scan all visible text matching email pattern
      const emailLocs = page.locator('text=/[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}/');
      const emailCount = await emailLocs.count();
      const emails = [];
      for (let i = 0; i < Math.min(emailCount, 10); i++) {
        try {
          const t = (await emailLocs.nth(i).textContent({ timeout: 400 }))?.trim();
          if (t && emailRe.test(t) && t.length < 80 && !emails.includes(t)) emails.push(t);
        } catch {}
      }
      pub.contact_email = emails[0] || null;

      // Strategy 2: Find contacts by looking near the "Contacts" section heading
      // The a11y tree shows: Contacts > {Avatar with initials} > {name} > {role} > Email > {email}
      const contactsHeading = page.getByText('Contacts', { exact: true }).first();
      if (await safeVisible(contactsHeading, 800)) {
        // Find "Marketplace Contact" role labels — each one has a contact above it
        const roleLocs = page.getByText('Marketplace Contact', { exact: true });
        const roleCount = await roleLocs.count();

        for (let i = 0; i < Math.min(roleCount, 5); i++) {
          // Get the bounding box of this role label to find nearby name (above) and email (below)
          const roleBox = await roleLocs.nth(i).boundingBox({ timeout: 600 }).catch(() => null);
          if (!roleBox) continue;

          // Name is typically the text element just above the role label (y is smaller)
          // Look for "Firstname Lastname" pattern near the role
          let contactName = null;
          const namePattern = page.getByText(/^[A-Z][a-z]+ [A-Z][a-z]+/);
          const nameCount = await namePattern.count();
          for (let j = 0; j < Math.min(nameCount, 20); j++) {
            try {
              const box = await namePattern.nth(j).boundingBox({ timeout: 300 });
              if (box && Math.abs(box.x - roleBox.x) < 100 &&
                  box.y < roleBox.y && roleBox.y - box.y < 80) {
                contactName = (await namePattern.nth(j).textContent({ timeout: 300 }))?.trim();
                break;
              }
            } catch {}
          }

          // Email for this contact — near the role label
          const contactEmail = emails[i] || null;

          if (contactName || contactEmail) {
            pub.all_contacts.push({
              name: contactName,
              role: 'Marketplace Contact',
              email: contactEmail,
              initials: contactName ? contactName.split(' ').map(p => p[0]).join('') : null,
            });
          }
        }
      }

      // Fallback: try any "Firstname Lastname" text near the slideout top
      if (pub.all_contacts.length === 0 && pub.contact_email) {
        const namePattern = page.getByText(/^[A-Z][a-z]+ [A-Z][a-z]+/);
        const nameCount = await namePattern.count();
        for (let j = 0; j < Math.min(nameCount, 10); j++) {
          try {
            const box = await namePattern.nth(j).boundingBox({ timeout: 300 });
            if (box && box.x > 820) {
              const t = (await namePattern.nth(j).textContent({ timeout: 300 }))?.trim();
              if (t && t.length < 50 && !t.includes('LLC') && !t.includes('Inc')) {
                pub.all_contacts.push({ name: t, role: 'Marketplace Contact', email: pub.contact_email, initials: t.split(' ').map(p => p[0]).join('') });
                break;
              }
            }
          } catch {}
        }
      }

      pub.contact_name = pub.all_contacts[0]?.name || null;
      pub.contact_role = pub.all_contacts[0]?.role || null;
      if (!pub.contact_email && pub.all_contacts[0]?.email) {
        pub.contact_email = pub.all_contacts[0].email;
      }
    } catch {}

    // ── 4. PERSONAL INFORMATION (Language) ────────────────────────────────
    try {
      // Language is in a table row: "Language" | "English"
      const langRow = page.getByRole('row', { name: /Language/i }).first();
      if (await safeVisible(langRow, 800)) {
        const cells = langRow.getByRole('cell');
        pub.language = await safeText(cells.nth(1), 600) || await safeText(cells.last(), 600);
      }
      if (!pub.language) {
        // Fallback: look for text after "Language" label
        const langLabel = page.getByText('Language', { exact: true }).first();
        if (await safeVisible(langLabel, 600)) {
          pub.language = await safeText(page.getByText('English', { exact: true }).first(), 600)
            || await safeText(page.getByText('French', { exact: true }).first(), 400)
            || await safeText(page.getByText('German', { exact: true }).first(), 400)
            || await safeText(page.getByText('Spanish', { exact: true }).first(), 400);
        }
      }
    } catch {}

    // ── 5. PROMOTIONAL AREAS ──────────────────────────────────────────────
    try {
      const promoHeading = page.getByText('Promotional areas', { exact: true }).first();
      if (await safeVisible(promoHeading, 600)) {
        const noPromo = await safeVisible(page.getByText('No promotional areas', { exact: true }), 400);
        if (!noPromo) {
          // Get items: they appear as text nodes after "Promotional areas"
          // Common values: "United States", "Canada", "United Kingdom" etc.
          for (const geo of ['United States', 'Canada', 'United Kingdom', 'Australia', 'Germany', 'France']) {
            if (await safeVisible(page.getByText(geo, { exact: true }), 300)) {
              pub.promotional_areas.push(geo);
            }
          }
        }
      }
    } catch {}

    // ── 6. CORPORATE ADDRESS ──────────────────────────────────────────────
    try {
      const addrLabel = page.getByText('Corporate address', { exact: true }).first();
      if (await safeVisible(addrLabel, 600)) {
        // Address text contains city, state, country
        const addrLoc = page.locator('text=/United States|United Kingdom|Canada|Australia/').first();
        pub.corporate_address = await safeText(addrLoc, 800);
        if (!pub.corporate_address) {
          // Try comma-separated address pattern
          const commaLoc = page.locator('text=/, [A-Z]+ United/').first();
          pub.corporate_address = await safeText(commaLoc, 600);
        }
      }
    } catch {}

    // ── 7. CONTENT CATEGORIES ─────────────────────────────────────────────
    try {
      const ccHeading = page.getByText('Content Categories', { exact: true }).first();
      if (await safeVisible(ccHeading, 600)) {
        const noCC = await safeVisible(page.getByText('No Categories', { exact: true }), 400);
        if (!noCC) {
          // Expand any "+N more" overflow
          await expandOverflow('Content Categories');
          // Collect visible category chips
          const ccItems = page.locator('[class*="chip"], [class*="tag"], [class*="category"]')
            .filter({ hasText: /\w+/ });
          pub.content_categories = await allTexts(ccItems);
          if (!pub.content_categories.length) {
            pub.content_categories = await sectionItems('Content Categories',
              ['Legacy Categories', 'Tags', 'Media Kits', 'Currency', 'Partner ID'], 30);
          }
        }
      }
    } catch {}

    // ── 8. LEGACY CATEGORIES (with overflow expansion) ────────────────────
    try {
      const lcHeading = page.getByText('Legacy Categories', { exact: true }).first();
      if (await safeVisible(lcHeading, 600)) {
        // First collect visible ones (before expanding overflow)
        const knownCats = [
          'Apparel, Shoes & Accessories', "Women's Apparel", "Men's Apparel", 'Shoes',
          'Jewelry & Watches', 'Bags & Accessories', 'Luxury', 'Health & Beauty',
          'Sports & Fitness', 'Consumer Electronics', 'Home & Garden', 'Books & Media',
          'Food & Drink', 'Travel', 'Financial Services', 'Insurance', 'Auto',
          'Baby & Kids', 'Office Supplies', 'Pet Supplies', 'Flowers & Gifts',
          'Arts & Crafts', 'Music', 'Movies & TV', 'Software', 'Gaming',
        ];
        for (const cat of knownCats) {
          if (await safeVisible(page.getByText(cat, { exact: true }), 300)) {
            pub.legacy_categories.push(cat);
          }
        }

        // Click "+N more" to expand all categories
        const moreBtn = page.getByText(/^\+\d+ more$/).first();
        if (await safeVisible(moreBtn, 400)) {
          await safeClick(moreBtn);
          await sleep(800);
          // Re-collect after expansion
          pub.legacy_categories_full = [];
          for (const cat of knownCats) {
            if (await safeVisible(page.getByText(cat, { exact: true }), 200)) {
              pub.legacy_categories_full.push(cat);
            }
          }
          // Also try generic collection
          if (!pub.legacy_categories_full.length) {
            pub.legacy_categories_full = await sectionItems('Legacy Categories',
              ['Tags', 'Media Kits', 'Currency', 'Partner ID'], 50);
          }
        } else {
          pub.legacy_categories_full = [...pub.legacy_categories];
        }
      }
    } catch {}

    // ── 9. TAGS (with overflow expansion) ────────────────────────────────
    try {
      const tagsHeading = page.getByText('Tags', { exact: true }).first();
      if (await safeVisible(tagsHeading, 600)) {
        const knownTags = [
          'banking', 'finance', 'fintech', 'gaming', 'insurance', 'newsletter',
          'subscription', 'loyalty', 'coupon', 'content', 'review', 'deals',
          'cashback', 'social media', 'influencer', 'blog', 'sports', 'fitness',
          'outdoor', 'cycling', 'travel', 'fashion', 'beauty', 'tech', 'gadgets',
          'home', 'garden', 'food', 'health', 'wellness', 'parenting', 'education',
        ];
        for (const tag of knownTags) {
          if (await safeVisible(page.getByText(tag, { exact: true }), 200)) {
            pub.tags.push(tag);
          }
        }

        // Expand "+N more" for tags too
        const moreTagBtn = page.getByText(/^\+\d+ more$/).nth(0);
        if (await safeVisible(moreTagBtn, 400)) {
          await safeClick(moreTagBtn);
          await sleep(600);
          pub.tags_full = [];
          for (const tag of knownTags) {
            if (await safeVisible(page.getByText(tag, { exact: true }), 200)) {
              pub.tags_full.push(tag);
            }
          }
          if (!pub.tags_full.length) {
            pub.tags_full = await sectionItems('Tags',
              ['Media Kits', 'Currency', 'Partner ID'], 30);
          }
        } else {
          pub.tags_full = [...pub.tags];
        }
      }
    } catch {}

    // ── 10. MEDIA KITS ────────────────────────────────────────────────────
    try {
      const mkHeading = page.getByText('Media Kits', { exact: true }).first();
      if (await safeVisible(mkHeading, 600)) {
        const pdfLinks = page.getByRole('link').filter({ hasText: /\.pdf/i });
        const pdfCount = await pdfLinks.count();
        pub.media_kit_count = pdfCount;
        for (let i = 0; i < Math.min(pdfCount, 10); i++) {
          try {
            const linkText = await safeText(pdfLinks.nth(i), 600);
            const href = await safeAttr(pdfLinks.nth(i), 'href', 600);
            if (href || linkText) {
              pub.media_kit_urls.push({ name: linkText || `Media Kit ${i+1}`, url: href || '' });
            }
          } catch {}
        }
      }
    } catch {}

    // ── 11. CURRENCY ──────────────────────────────────────────────────────
    try {
      const currHeading = page.getByText('Currency', { exact: true }).first();
      if (await safeVisible(currHeading, 600)) {
        for (const c of ['USD', 'EUR', 'GBP', 'AUD', 'CAD']) {
          if (await safeVisible(page.getByText(c, { exact: true }), 300)) {
            pub.currency = c; break;
          }
        }
      }
    } catch {}

    // ── 12. SWITCH TO DETAILS TAB ─────────────────────────────────────────
    const detCoords = await getTabCoords('Details');
    if (detCoords) {
      await clickAt(detCoords.x, detCoords.y);
      await sleep(1500);
    } else {
      await safeClick(page.getByText('Details', { exact: true }).first());
      await sleep(1200);
    }

    // ── 13. WEBSITE & SOCIAL PROPERTIES (Details tab) ─────────────────────
    try {
      // External links in Details tab
      const extLinks = page.getByRole('link').filter({ hasText: /^https?:\/\//i });
      const linkCount = await extLinks.count();
      const propUrls = [];
      for (let i = 0; i < Math.min(linkCount, 10); i++) {
        try {
          const href = await safeAttr(extLinks.nth(i), 'href', 600);
          const txt = await safeText(extLinks.nth(i), 600);
          const url = href || txt;
          if (url && !url.includes('impact.com') && !url.includes('impactradius')) {
            if (!pub.website) pub.website = url;
            if (txt?.startsWith('http') && !url.includes('impact.com')) {
              propUrls.push({ url, text: txt });
            }
          }
        } catch {}
      }
      pub.social_properties = propUrls;

      // Learn more label
      if (await safeVisible(page.getByText('Learn more', { exact: true }), 500)) {
        pub.learn_more_url = pub.website;
      }

      // Verified status
      const notVerifiedVisible = await safeVisible(page.getByText('Not verified', { exact: true }), 400);
      const verifiedVisible = await safeVisible(page.getByText('Verified', { exact: true }), 400);
      if (notVerifiedVisible) pub.verified = false;
      else if (verifiedVisible) pub.verified = true;

      // Web metrics + all verified properties
      // Details tab shows per-property cards: URL, Semrush rank, Monthly visitors, Moz spam, Moz DA, Verified
      // There can be multiple property cards (e.g. People Inc has 14+)
      try {
        // Collect all property cards — each has a link + optional metrics
        const allLinks = page.getByRole('link');
        const linkCount = await allLinks.count();
        const propCards = [];
        for (let i = 0; i < Math.min(linkCount, 20); i++) {
          try {
            const href = await safeAttr(allLinks.nth(i), 'href', 400);
            if (!href || href.includes('impact.com')) continue;
            const linkText = await safeText(allLinks.nth(i), 400);
            const box = await allLinks.nth(i).boundingBox({ timeout: 400 }).catch(() => null);
            if (box) propCards.push({ url: href, text: linkText, box });
          } catch {}
        }

        // For each property card, try to read its metrics (from sibling elements)
        // Use first property's metrics as the primary semrush/moz values
        const semrushLocs = page.getByText('Semrush global rank', { exact: true });
        const semCount = await semrushLocs.count();

        if (semCount > 0) {
          // Get the value after first "Semrush global rank" label
          const semBox = await semrushLocs.first().boundingBox({ timeout: 400 }).catch(() => null);
          if (semBox) {
            // Value is typically the next sibling text at same x, slightly below
            const valLoc = page.locator(`text=/^\\d+(\\.\\d+)?[KMB]?K?$/`);
            const valCount = await valLoc.count();
            for (let i = 0; i < Math.min(valCount, 10); i++) {
              try {
                const vBox = await valLoc.nth(i).boundingBox({ timeout: 300 });
                if (vBox && Math.abs(vBox.x - semBox.x) < 200 && vBox.y > semBox.y && vBox.y - semBox.y < 60) {
                  pub.semrush_global_rank = (await valLoc.nth(i).textContent({ timeout: 300 }))?.trim();
                  break;
                }
              } catch {}
            }
          }
        }

        // Monthly visitors
        const mvLocs = page.getByText('Monthly visitors', { exact: true });
        if (await safeVisible(mvLocs.first(), 400)) {
          const mvBox = await mvLocs.first().boundingBox({ timeout: 400 }).catch(() => null);
          if (mvBox) {
            const valLoc = page.locator(`text=/^\\d+(\\.\\d+)?[MKB]$/`);
            const valCount = await valLoc.count();
            for (let i = 0; i < Math.min(valCount, 10); i++) {
              try {
                const vBox = await valLoc.nth(i).boundingBox({ timeout: 300 });
                if (vBox && Math.abs(vBox.x - mvBox.x) < 200 && vBox.y > mvBox.y && vBox.y - mvBox.y < 60) {
                  pub.monthly_visitors = (await valLoc.nth(i).textContent({ timeout: 300 }))?.trim();
                  break;
                }
              } catch {}
            }
          }
        }

        // Moz spam score (0-17 range)
        const spamLocs = page.getByText('Moz spam score', { exact: true });
        if (await safeVisible(spamLocs.first(), 400)) {
          const spamBox = await spamLocs.first().boundingBox({ timeout: 400 }).catch(() => null);
          if (spamBox) {
            const valLoc = page.locator('text=/^\\d{1,2}$/');
            const valCount = await valLoc.count();
            for (let i = 0; i < Math.min(valCount, 20); i++) {
              try {
                const vBox = await valLoc.nth(i).boundingBox({ timeout: 300 });
                if (vBox && Math.abs(vBox.x - spamBox.x) < 200 && vBox.y > spamBox.y && vBox.y - spamBox.y < 60) {
                  pub.moz_spam_score = (await valLoc.nth(i).textContent({ timeout: 300 }))?.trim();
                  break;
                }
              } catch {}
            }
          }
        }

        // Moz domain authority (0-100)
        const daLocs = page.getByText('Moz domain authority', { exact: true });
        if (await safeVisible(daLocs.first(), 400)) {
          const daBox = await daLocs.first().boundingBox({ timeout: 400 }).catch(() => null);
          if (daBox) {
            const valLoc = page.locator('text=/^\\d{2,3}$/');
            const valCount = await valLoc.count();
            for (let i = 0; i < Math.min(valCount, 20); i++) {
              try {
                const vBox = await valLoc.nth(i).boundingBox({ timeout: 300 });
                if (vBox && Math.abs(vBox.x - daBox.x) < 200 && vBox.y > daBox.y && vBox.y - daBox.y < 60) {
                  pub.moz_domain_authority = (await valLoc.nth(i).textContent({ timeout: 300 }))?.trim();
                  break;
                }
              } catch {}
            }
          }
        }

        // Store all property URLs in social_properties
        if (propCards.length > 0) {
          pub.social_properties = propCards.map(p => ({ url: p.url, text: p.text }));
          pub.website = propCards[0]?.url || null;
        }
      } catch {}

      // Collect all social property cards text
      const socialMsg = await safeText(
        page.locator('text=/Content and Metrics are not available|authenticated with us/').first(), 600
      );
      if (socialMsg && pub.social_properties.length === 0) {
        // No auth'd properties but we have the URL
        pub.social_properties = pub.website ? [{ url: pub.website, text: pub.website, status: 'not_authenticated' }] : [];
      }
    } catch {}

    // ── 14. SWITCH BACK TO PROPERTIES ─────────────────────────────────────
    if (propCoords) {
      await clickAt(propCoords.x, propCoords.y);
    } else {
      await safeClick(page.getByText('Properties', { exact: true }).first());
    }
    await sleep(400);

    return pub;
  };

  // ── MAIN PROPOSAL LOOP ─────────────────────────────────────────────────────
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

    // Open slideout by clicking avatar image
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

    // Full profile scrape
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

    // ── SEND PROPOSAL ──────────────────────────────────────────────────────
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

    // Term selection: Performance or highest %
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

    // Date selection
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

    // "I understand" nav-catch = success signal
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
