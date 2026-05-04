// Impact Rockbros US — bulk proposal + full data collection (v10 2026-05-04)
// Tokens replaced by runner:
//   %%MSG%%, %%CONTRACT_DATE%%, %%ALREADY%%, %%TARGET%%, %%DISCOVER_URL%%
//
// v10: Full publisher intel scraped via /partner-ui/api/slideout + /mediaproperties APIs.
// Returns enriched publisher objects with all detail-page fields.

async (_rootPage) => {
  const _pages = _rootPage.context().pages();
  const page = _pages.find(p => p.url().includes('app.impact.com')) || _rootPage;
  await page.bringToFront();
  await page.waitForTimeout(500);

  const DISCOVER_URL  = "%%DISCOVER_URL%%";
  const MSG           = "%%MSG%%";
  const CONTRACT_DATE = "%%CONTRACT_DATE%%";
  const ALREADY       = %%ALREADY%%;
  const TARGET        = %%TARGET%%;

  const sleep      = ms => page.waitForTimeout(ms);
  const alreadySet = new Set(ALREADY.map(n => n.toLowerCase()));
  const results    = [];
  const errors     = [];
  const seen       = new Set();

  // ── HELPERS ────────────────────────────────────────────────────────────

  const ensureDiscover = async () => {
    const u = page.url();
    if (!u.includes('partner_discover') || u.includes('slideout_id=')) {
      await page.goto(DISCOVER_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await sleep(3000);
    }
  };

  // Fetch authenticated JSON from Impact API using the browser's session cookies
  const apiFetch = async (url) => {
    return await page.evaluate(async (u) => {
      try {
        const r = await fetch(u, { credentials: 'include' });
        if (!r.ok) return null;
        return await r.json();
      } catch { return null; }
    }, url);
  };

  // ── GRID DATA COLLECTION ────────────────────────────────────────────────
  // Intercept the listings API response to get full grid records (all 25+)
  const captureGridData = async () => {
    return await page.evaluate(() => {
      // Walk Ractive/ExtJS component store to find the loaded records
      // Impact uses ExtJS grid — records are in Ext.ComponentManager stores
      try {
        const stores = Ext?.ComponentManager?.all?.map || {};
        for (const [key, cmp] of Object.entries(stores)) {
          const store = cmp?.store || cmp?.getStore?.();
          if (store?.getData && store.getCount?.() > 0) {
            const recs = [];
            store.each(r => recs.push(r.getData ? r.getData() : r.data));
            if (recs[0]?.radius_publisher_id !== undefined) return recs;
          }
        }
      } catch {}
      return null;
    });
  };

  // ── SLIDEOUT API DATA COLLECTION ────────────────────────────────────────
  const fetchSlideoutData = async (radiusPublisherId) => {
    const callbackUrl = encodeURIComponent(DISCOVER_URL);
    const slideoutUrl = `/partner-ui/api/slideout?supplyPlatformProgramId=${radiusPublisherId}&supplyPlatformName=impact&callbackUrl=${callbackUrl}`;
    const data = await apiFetch(slideoutUrl);
    if (!data) return null;

    const prog = data.program || {};

    // Extract contacts
    const contacts = (prog.contacts || []).map(c => ({
      name: c.name || null,
      email: c.email || null,
      role: c.role || c.type || null,
      phone: c.phone || null,
    }));
    const primaryContact = contacts[0] || {};

    // Extract address
    const addr = (prog.addresses || [])[0] || {};
    const country = addr.country?.country2Code || null;
    const corpAddress = addr.address || null;
    const city = addr.city || null;
    const state = addr.state || null;

    // Extract categories
    const categories = (prog.categories || []).map(c => c.name || c).filter(Boolean);

    // Extract tags from attributes
    const contentTags = (prog.attributes || [])
      .filter(a => a.type === 'content_tag').map(a => a.value).filter(Boolean);
    const editorialTags = (prog.attributes || [])
      .filter(a => a.type === 'editorial_tag' && !/^\d+$/.test(a.value)).map(a => a.value).filter(Boolean);

    // Extract media properties (websites)
    const mediaProperties = (prog.mediaProperties || []).map(m => m.url || m.website || m).filter(Boolean);
    const website = mediaProperties[0] || (prog.links || []).find(l => l.type === 'website')?.url || null;

    // Extract languages
    const languages = (prog.languages || []).map(l => l.name || l).filter(Boolean);

    // Extract promotional methods
    const promoMethods = (prog.promotionalMethods || []).map(m => m.name || m).filter(Boolean);

    // Extract all contacts
    const allContacts = contacts.map(c => `${c.name||''}${c.role?' ('+c.role+')':''} ${c.email||''}`).filter(s=>s.trim());

    // Social followers from mediaProperties detail
    const links = (prog.links || []);

    return {
      psi:                   data.relationship?.psi || prog.psi || null,
      slideout_token:        data.slideoutToken || null,
      radius_publisher_id:   radiusPublisherId,
      // Identity
      description:           prog.description || prog.shortDescription || null,
      ideal_partner_desc:    prog.idealPartnerDescription || null,
      size_rating:           prog.sizeRating || null,
      marketplace_state:     prog.marketplaceState || null,
      total_audience_size:   prog.totalAudienceSize || null,
      proposal_accept_rate:  prog.proposalAcceptRate7Day || null,
      proposal_response_rate:prog.proposalResponseRate7Day || null,
      program_type:          prog.programType || null,
      program_subtypes:      prog.programSubtypes || [],
      // Contact
      contact_name:          primaryContact.name || null,
      contact_email:         primaryContact.email || null,
      contact_role:          primaryContact.role || null,
      all_contacts:          allContacts,
      contacts_raw:          contacts,
      // Location
      corporate_address:     corpAddress,
      city:                  city,
      state:                 state,
      country:               country,
      // Categories & tags
      categories:            categories,
      content_tags:          contentTags,
      editorial_tags:        editorialTags,
      // Properties
      website:               website,
      media_properties:      mediaProperties,
      links:                 links,
      languages:             languages,
      promotional_methods:   promoMethods,
    };
  };

  // ── MEDIA PROPERTIES (TRAFFIC DATA) ────────────────────────────────────
  const fetchMediaProperties = async (slideoutToken, radiusPublisherId) => {
    if (!slideoutToken) return {};
    const url = `/partner-ui/api/slideout/mediaproperties?slideoutToken=${slideoutToken}&supplyPlatformProgramId=${radiusPublisherId}`;
    const data = await apiFetch(url);
    if (!data) return {};

    const traffic = {};
    for (const [siteUrl, siteData] of Object.entries(data)) {
      const web = siteData?.intelligenceApiWeb?.Traffic?.Summary || {};
      if (web.Visits) {
        traffic[siteUrl] = {
          visits:          web.Visits || null,
          rank:            web.Rank || null,
          users:           web.Users || null,
          bounce_rate:     web.BounceRate || null,
          pages_per_visit: web.PagesPerVisit || null,
          mobile_share:    web.MobileShare || null,
          search_traffic:  web.Search || null,
          direct_traffic:  web.DirectTraffic || null,
          social_traffic:  web.Social || null,
          referral_traffic:web.ReferralTraffic || null,
          date_updated:    web.DateLastUpdated || null,
        };
        break; // take first site as primary
      }
    }
    return traffic;
  };

  // ── CARD READING ────────────────────────────────────────────────────────
  const readGridCards = async () => {
    return await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.iui-card'));
      return cards.map((c, i) => {
        const nameEl =
          c.querySelector('[class*="partner-name"], [class*="company-name"], h3, h4') ||
          c.querySelector('.discovery-card > div > div');
        let name = '';
        if (nameEl) name = (nameEl.innerText || '').trim().split('\n')[0].trim();
        if (!name) name = (c.innerText || '').trim().split('\n')[0].trim();

        // Extract partner_id from send-proposal action data if available
        const actions = c.querySelectorAll('[data-event-id="sendProposal"]');
        return { name, idx: i };
      }).filter(x => x.name);
    });
  };

  // ── PROPOSAL FLOW ────────────────────────────────────────────────────────
  const openProposalForIdx = async (idx) => {
    const cardRect = await page.evaluate((i) => {
      const cards = Array.from(document.querySelectorAll('.iui-card'));
      const c = cards[i];
      if (!c) return null;
      c.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = c.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }, idx);
    if (!cardRect) return { error: 'card-vanished' };
    await sleep(400);

    await page.mouse.move(10, 10);
    await sleep(100);
    await page.mouse.move(cardRect.x + cardRect.w / 2, cardRect.y + cardRect.h / 2, { steps: 10 });
    await sleep(800);

    const btnRect = await page.evaluate((i) => {
      const cards = Array.from(document.querySelectorAll('.iui-card'));
      const c = cards[i];
      if (!c) return null;
      const btn = Array.from(c.querySelectorAll('button')).find(b => /send proposal/i.test(b.innerText || ''));
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }, idx);

    if (!btnRect || btnRect.w === 0) {
      await page.mouse.click(cardRect.x + cardRect.w / 2, cardRect.y + cardRect.h / 2);
      await sleep(1500);
      const slideoutBtn = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => /send proposal/i.test(b.innerText || ''));
        if (!btn) return null;
        const r = btn.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      });
      if (slideoutBtn && slideoutBtn.w > 0) {
        await page.mouse.click(slideoutBtn.x + slideoutBtn.w / 2, slideoutBtn.y + slideoutBtn.h / 2);
        try {
          await page.waitForFunction(() => {
            const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
            return f && f.offsetWidth > 200 && f.offsetHeight > 200;
          }, { timeout: 8000 });
        } catch {
          await page.keyboard.press('Escape').catch(() => {});
          await ensureDiscover();
          return { error: 'no-iframe-after-slideout' };
        }
        await sleep(1000);
        return { ok: true };
      }
      await page.keyboard.press('Escape').catch(() => {});
      await sleep(500);
      await ensureDiscover();
      return { error: 'no-send-btn' };
    }

    await page.mouse.move(btnRect.x + btnRect.w / 2, btnRect.y + btnRect.h / 2);
    await sleep(150);
    await page.mouse.click(btnRect.x + btnRect.w / 2, btnRect.y + btnRect.h / 2);
    try {
      await page.waitForFunction(() => {
        const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
        return f && f.offsetWidth > 200 && f.offsetHeight > 200;
      }, { timeout: 8000 });
    } catch {
      return { error: 'no-iframe' };
    }
    await sleep(1000);
    return { ok: true };
  };

  const extractMeta = async () => {
    return await page.evaluate(() => {
      const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
      if (!f) return null;
      try {
        const u = new URL(f.src);
        return {
          partner_id:    u.searchParams.get('p') || null,
          psi:           u.searchParams.get('psi') || null,
          contact_name:  u.searchParams.get('name') || null,
          contact_email: u.searchParams.get('email') || null,
          iframe_src:    f.src,
        };
      } catch { return null; }
    });
  };

  const selectTerm = async () => {
    const coords = await page.evaluate(() => {
      const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
      if (!f) return null;
      const doc = f.contentDocument;
      if (!doc) return null;
      const btn = doc.querySelector('button.iui-multi-select-input-button');
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      const ifr = f.getBoundingClientRect();
      return { x: ifr.x + r.x + r.width / 2, y: ifr.y + r.y + r.height / 2, currentText: (btn.innerText || '').trim() };
    });
    if (!coords) return { error: 'no-term-btn' };
    if (coords.currentText && !/^select$/i.test(coords.currentText)) return { ok: true, alreadySet: coords.currentText };

    await page.mouse.click(coords.x, coords.y);
    await sleep(1000);
    try {
      await page.waitForFunction(() => {
        const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
        const doc = f && f.contentDocument;
        return doc && doc.querySelectorAll('li[role="option"]').length > 0;
      }, { timeout: 5000 });
    } catch { return { error: 'no-term-options' }; }

    const optCoords = await page.evaluate(() => {
      const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
      const doc = f.contentDocument;
      const opts = Array.from(doc.querySelectorAll('li[role="option"]'));
      let pick = opts.find(o => /public terms/i.test(o.innerText));
      if (!pick) pick = opts.find(o => !/^select$/i.test((o.innerText || '').trim()));
      if (!pick) return null;
      const r = pick.getBoundingClientRect();
      const ifr = f.getBoundingClientRect();
      return { x: ifr.x + r.x + r.width / 2, y: ifr.y + r.y + r.height / 2, text: pick.innerText.trim() };
    });
    if (!optCoords) return { error: 'no-public-terms' };
    await page.mouse.click(optCoords.x, optCoords.y);
    await sleep(1000);
    return { ok: true, picked: optCoords.text };
  };

  const fillMessage = async (text) => {
    return await page.evaluate((msg) => {
      const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
      if (!f) return { error: 'no-iframe' };
      const doc = f.contentDocument;
      const win = f.contentWindow;
      if (!doc || !win) return { error: 'no-doc' };
      const ta = doc.querySelector('textarea[name="comment"]');
      if (!ta) return { error: 'no-textarea' };
      const setter = Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(ta, msg);
      ta.dispatchEvent(new win.Event('input', { bubbles: true }));
      ta.dispatchEvent(new win.Event('change', { bubbles: true }));
      ta.dispatchEvent(new win.Event('blur', { bubbles: true }));
      return { ok: true, len: ta.value.length };
    }, text);
  };

  const setStartDate = async () => {
    const coords = await page.evaluate(() => {
      const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
      if (!f) return null;
      const doc = f.contentDocument;
      const btn = doc.querySelector('button[data-testid="uicl-date-input"]');
      if (!btn) return null;
      btn.scrollIntoView({ block: 'center' });
      const r = btn.getBoundingClientRect();
      const ifr = f.getBoundingClientRect();
      return { x: ifr.x + r.x + r.width / 2, y: ifr.y + r.y + r.height / 2 };
    });
    if (!coords) return { error: 'no-date-btn' };
    await page.mouse.click(coords.x, coords.y);
    await sleep(800);
    const todayCoords = await page.evaluate(() => {
      const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
      const doc = f.contentDocument;
      const btn = Array.from(doc.querySelectorAll('button, a, [role="button"]'))
        .find(b => /^today$/i.test((b.innerText || '').trim()));
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      const ifr = f.getBoundingClientRect();
      return { x: ifr.x + r.x + r.width / 2, y: ifr.y + r.y + r.height / 2 };
    });
    if (!todayCoords) return { error: 'no-today-btn' };
    await page.mouse.click(todayCoords.x, todayCoords.y);
    await sleep(700);
    const ok = await page.evaluate(() => {
      const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
      const doc = f.contentDocument;
      const inp = doc.querySelector('input[name="startDateTime"]');
      return inp && /"date":"\d{4}-\d{2}-\d{2}"/.test(inp.value);
    });
    return ok ? { ok: true } : { error: 'date-not-set' };
  };

  const submitProposal = async () => {
    const coords = await page.evaluate(() => {
      const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
      if (!f) return null;
      const doc = f.contentDocument;
      const btn = Array.from(doc.querySelectorAll('button'))
        .find(b => /^send proposal$/i.test((b.innerText || '').trim()) && !b.disabled);
      if (!btn) return null;
      btn.scrollIntoView({ block: 'center' });
      const r = btn.getBoundingClientRect();
      const ifr = f.getBoundingClientRect();
      return { x: ifr.x + r.x + r.width / 2, y: ifr.y + r.y + r.height / 2 };
    });
    if (!coords) return { error: 'no-submit-btn' };
    await page.mouse.click(coords.x, coords.y);
    await sleep(1000);
    try {
      await page.waitForFunction(() => {
        const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
        if (!f || !f.contentDocument) return false;
        return Array.from(f.contentDocument.querySelectorAll('button'))
          .some(b => /^i understand$/i.test((b.innerText || '').trim()));
      }, { timeout: 5000 });
    } catch { return { error: 'no-confirm-dialog' }; }

    const confirmCoords = await page.evaluate(() => {
      const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
      const doc = f.contentDocument;
      const btn = Array.from(doc.querySelectorAll('button'))
        .find(b => /^i understand$/i.test((b.innerText || '').trim()));
      if (!btn) return null;
      btn.scrollIntoView({ block: 'center' });
      const r = btn.getBoundingClientRect();
      const ifr = f.getBoundingClientRect();
      return { x: ifr.x + r.x + r.width / 2, y: ifr.y + r.y + r.height / 2 };
    });
    if (!confirmCoords) return { error: 'no-i-understand-btn' };
    await page.mouse.click(confirmCoords.x, confirmCoords.y);
    try {
      await page.waitForFunction(() => {
        const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
        return !f || f.offsetWidth === 0 || f.offsetHeight === 0;
      }, { timeout: 10000 });
      return { ok: true };
    } catch { return { error: 'modal-did-not-close' }; }
  };

  const closeModal = async () => {
    try {
      await page.evaluate(() => {
        const closeBtn = document.querySelector(
          '.modal-container button[aria-label*="close" i], .modal-container [class*="close" i]'
        );
        if (closeBtn) closeBtn.click();
      });
    } catch {}
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(600);
  };

  // ── MAIN LOOP ─────────────────────────────────────────────────────────
  await ensureDiscover();
  await sleep(1500);

  // Pre-scroll: load as many cards as possible before starting proposals
  // This surfaces publishers from the full 87K pool, not just the first 25
  let preScrollCount = 0;
  const PRE_SCROLL_TARGET = 300; // load ~300 cards upfront
  while (preScrollCount < 60) { // 60 scrolls × ~5 new cards = ~300 cards
    const before = await page.evaluate(() => document.querySelectorAll('.iui-card').length);
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
    await sleep(800);
    const after = await page.evaluate(() => document.querySelectorAll('.iui-card').length);
    preScrollCount++;
    if (after >= PRE_SCROLL_TARGET) break;
    if (after === before && preScrollCount > 10) break; // no new cards loading
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(1000);

  let scrollPasses = 0;
  const MAX_SCROLL_PASSES = 200;

  while (results.length < TARGET && scrollPasses < MAX_SCROLL_PASSES) {
    const cards = await readGridCards();
    let processedThisPass = 0;

    for (const { name, idx } of cards) {
      if (results.length >= TARGET) break;
      if (!name) continue;
      const nLower = name.toLowerCase();
      if (alreadySet.has(nLower) || seen.has(nLower)) continue;
      seen.add(nLower);

      try {
        const open = await openProposalForIdx(idx);
        if (open.error) {
          errors.push({ name, step: 'open', reason: open.error });
          if (open.error === 'no-iframe' || open.error === 'no-iframe-after-slideout') {
            await closeModal();
            await ensureDiscover();
          }
          continue;
        }

        // Extract basic meta from iframe URL (partner_id, psi, contact_name, contact_email)
        const meta = await extractMeta();
        if (!meta || !meta.partner_id) {
          errors.push({ name, step: 'meta', reason: 'no-partner-id' });
          await closeModal();
          await ensureDiscover();
          continue;
        }

        // ── FULL DATA COLLECTION via APIs (parallel) ──────────────────
        const slideoutData = await fetchSlideoutData(meta.partner_id);
        const trafficData = slideoutData?.slideout_token
          ? await fetchMediaProperties(slideoutData.slideout_token, meta.partner_id)
          : {};

        // Primary traffic site data
        const primaryTraffic = Object.values(trafficData)[0] || {};
        const primarySite = Object.keys(trafficData)[0] || slideoutData?.website || null;

        // ── COMPLETE PUBLISHER OBJECT ──────────────────────────────────
        const pubData = {
          // Outreach fields (from iframe)
          name,
          partner_id:           meta.partner_id,
          psi:                  meta.psi || slideoutData?.psi || null,
          contact_name:         meta.contact_name || slideoutData?.contact_name || null,
          contact_email:        meta.contact_email || slideoutData?.contact_email || null,
          term:                 null, // filled after selectTerm
          contract_date:        CONTRACT_DATE,
          outreach_msg:         MSG,
          proposal_sent:        true,
          sent_at:              new Date().toISOString(),
          // Identity
          description:          slideoutData?.description || null,
          size_rating:          slideoutData?.size_rating || null,
          partner_size:         slideoutData?.size_rating || null,
          business_model:       null, // from grid — set below
          marketplace_state:    slideoutData?.marketplace_state || null,
          total_audience_size:  slideoutData?.total_audience_size || null,
          proposal_accept_rate: slideoutData?.proposal_accept_rate || null,
          proposal_response_rate: slideoutData?.proposal_response_rate || null,
          program_type:         slideoutData?.program_type || null,
          program_subtypes:     slideoutData?.program_subtypes || [],
          // Contact
          contact_role:         slideoutData?.contact_role || null,
          all_contacts:         slideoutData?.all_contacts || [],
          contacts_raw:         slideoutData?.contacts_raw || [],
          // Location
          website:              primarySite || slideoutData?.website || null,
          media_properties:     slideoutData?.media_properties || [],
          corporate_address:    slideoutData?.corporate_address || null,
          city:                 slideoutData?.city || null,
          state:                slideoutData?.state || null,
          country:              slideoutData?.country || null,
          // Categories & tags
          categories:           slideoutData?.categories || [],
          content_tags:         slideoutData?.content_tags || [],
          editorial_tags:       slideoutData?.editorial_tags || [],
          // Properties
          languages:            slideoutData?.languages || [],
          promotional_methods:  slideoutData?.promotional_methods || [],
          links:                slideoutData?.links || [],
          // Traffic (Semrush)
          traffic_visits:       primaryTraffic.visits || null,
          traffic_rank:         primaryTraffic.rank || null,
          traffic_users:        primaryTraffic.users || null,
          traffic_bounce_rate:  primaryTraffic.bounce_rate || null,
          traffic_pages_per_visit: primaryTraffic.pages_per_visit || null,
          traffic_mobile_share: primaryTraffic.mobile_share || null,
          traffic_search:       primaryTraffic.search_traffic || null,
          traffic_direct:       primaryTraffic.direct_traffic || null,
          traffic_social:       primaryTraffic.social_traffic || null,
          traffic_date_updated: primaryTraffic.date_updated || null,
          traffic_by_site:      trafficData,
          // IDs
          radius_publisher_id:  meta.partner_id,
          slideout_token:       slideoutData?.slideout_token || null,
          scraped_at:           new Date().toISOString(),
        };

        // Continue with proposal flow
        const term = await selectTerm();
        if (term.error) {
          errors.push({ name, step: 'term', reason: term.error, meta });
          await closeModal();
          await ensureDiscover();
          continue;
        }
        pubData.term = term.picked || term.alreadySet || 'Public Terms';
        pubData.term_text = pubData.term;
        pubData.term_verified = true;

        const dateRes = await setStartDate();
        if (dateRes.error) {
          errors.push({ name, step: 'date', reason: dateRes.error, meta });
          await closeModal();
          await ensureDiscover();
          continue;
        }
        pubData.date_verified = true;

        const msg = await fillMessage(MSG);
        if (msg.error) {
          errors.push({ name, step: 'message', reason: msg.error, meta });
          await closeModal();
          await ensureDiscover();
          continue;
        }

        const sub = await submitProposal();
        if (sub.error) {
          errors.push({ name, step: 'submit', reason: sub.error, meta });
          await closeModal();
          await ensureDiscover();
          continue;
        }

        results.push(pubData);
        processedThisPass++;
        await sleep(600);
      } catch (e) {
        errors.push({ name, step: 'exception', reason: String(e).slice(0, 200) });
        await closeModal();
        await ensureDiscover();
      }
    }

    if (results.length >= TARGET) break;
    if (processedThisPass === 0) scrollPasses++;
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.9));
    await sleep(2000);
  }

  return {
    total: results.length,
    target: TARGET,
    sent: results,
    errors,
    seen_count: seen.size,
  };
}
