// Impact Rockbros US — bulk proposal + full data collection (v11 2026-05-04)
// Tokens replaced by runner:
//   %%MSG%%, %%CONTRACT_DATE%%, %%ALREADY%%, %%TARGET%%, %%DISCOVER_URL%%
//
// v11 fixes:
//   Bug 1: Execution-context-destroyed crash. ensureDiscover() never calls
//          page.goto() while a page.evaluate() could be in flight. A _busy
//          flag guards every evaluate; when busy, ensureDiscover only
//          presses Escape and waits — it never navigates.
//   Bug 2: Random clicking. Removed the "click card center when Send Proposal
//          isn't visible" fallback. If the button isn't visible after hover,
//          the card is skipped (error: 'no-send-btn'). No more accidental
//          slideout opens.
//   Bug 3: Fetch-inside-evaluate fragility. Slideout + mediaproperties API
//          calls are wrapped in safeEval with retry, only run AFTER the
//          modal is closed (well, after the proposal completes), and have
//          explicit error handling so a failed fetch never aborts the loop.

async (_rootPage) => {
  const _pages = _rootPage.context().pages();
  const page = _pages.find(p => p.url().includes('app.impact.com')) || _rootPage;
  await page.bringToFront();
  await page.waitForTimeout(200);

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

  // ── BUSY FLAG ─────────────────────────────────────────────────────────
  // _busy is true whenever we're actively inside any page.evaluate / page.mouse
  // / page.waitForFunction call where destroying the execution context would
  // crash us. ensureDiscover() refuses to navigate while _busy is true.
  let _busy = false;
  let _navigating = false;

  const withBusy = async (fn) => {
    _busy = true;
    try { return await fn(); }
    finally { _busy = false; }
  };

  // ── HELPERS ────────────────────────────────────────────────────────────

  const ensureDiscover = async () => {
    // NEVER navigate while a page.evaluate / mouse op is in flight — it would
    // destroy the execution context and crash the entire tab run.
    if (_busy) {
      try { await page.keyboard.press('Escape'); } catch {}
      await sleep(400);
      return;
    }
    if (_navigating) { await sleep(600); return; }
    try {
      const u = page.url();
      if (!u.includes('partner_discover') || u.includes('slideout_id=')) {
        _navigating = true;
        try {
          await page.goto(DISCOVER_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
          await sleep(400);
        } finally { _navigating = false; }
      }
    } catch (e) {
      _navigating = false;
      // Don't retry on context-destroyed — that means another op is racing us
      if (String(e).includes('context') || String(e).includes('closed')) return;
      await sleep(600);
    }
  };

  // Wrap evaluate calls: set _busy, retry once on context-destroyed
  const safeEval = async (fn, arg) => {
    _busy = true;
    try {
      return arg !== undefined ? await page.evaluate(fn, arg) : await page.evaluate(fn);
    } catch (e) {
      const msg = String(e);
      if (msg.includes('context was destroyed') || msg.includes('Execution context')) {
        _busy = false;
        await sleep(800);
        await ensureDiscover();
        _busy = true;
        try {
          return arg !== undefined ? await page.evaluate(fn, arg) : await page.evaluate(fn);
        } catch { return null; }
      }
      throw e;
    } finally {
      _busy = false;
    }
  };

  // Authenticated JSON fetch via the page's own session cookies.
  // Wrapped in safeEval so a context destruction returns null instead of crashing.
  const apiFetch = async (url) => {
    return await safeEval(async (u) => {
      try {
        const r = await fetch(u, { credentials: 'include' });
        if (!r.ok) return null;
        return await r.json();
      } catch { return null; }
    }, url);
  };

  // ── SLIDEOUT API DATA COLLECTION ────────────────────────────────────────
  const fetchSlideoutData = async (radiusPublisherId) => {
    try {
      const callbackUrl = encodeURIComponent(DISCOVER_URL);
      const slideoutUrl = `/partner-ui/api/slideout?supplyPlatformProgramId=${radiusPublisherId}&supplyPlatformName=impact&callbackUrl=${callbackUrl}`;
      const data = await apiFetch(slideoutUrl);
      if (!data) return null;

      const prog = data.program || {};
      const contacts = (prog.contacts || []).map(c => ({
        name: c.name || null,
        email: c.email || null,
        role: c.role || c.type || null,
        phone: c.phone || null,
      }));
      const primaryContact = contacts[0] || {};
      const addr = (prog.addresses || [])[0] || {};
      const country = addr.country?.country2Code || null;
      const corpAddress = addr.address || null;
      const city = addr.city || null;
      const state = addr.state || null;
      const categories = (prog.categories || []).map(c => c.name || c).filter(Boolean);
      const contentTags = (prog.attributes || [])
        .filter(a => a.type === 'content_tag').map(a => a.value).filter(Boolean);
      const editorialTags = (prog.attributes || [])
        .filter(a => a.type === 'editorial_tag' && !/^\d+$/.test(a.value)).map(a => a.value).filter(Boolean);
      const mediaProperties = (prog.mediaProperties || []).map(m => m.url || m.website || m).filter(Boolean);
      const website = mediaProperties[0] || (prog.links || []).find(l => l.type === 'website')?.url || null;
      const languages = (prog.languages || []).map(l => l.name || l).filter(Boolean);
      const promoMethods = (prog.promotionalMethods || []).map(m => m.name || m).filter(Boolean);
      const allContacts = contacts.map(c => `${c.name||''}${c.role?' ('+c.role+')':''} ${c.email||''}`).filter(s=>s.trim());
      const links = (prog.links || []);

      return {
        psi:                   data.relationship?.psi || prog.psi || null,
        slideout_token:        data.slideoutToken || null,
        radius_publisher_id:   radiusPublisherId,
        description:           prog.description || prog.shortDescription || null,
        ideal_partner_desc:    prog.idealPartnerDescription || null,
        size_rating:           prog.sizeRating || null,
        marketplace_state:     prog.marketplaceState || null,
        total_audience_size:   prog.totalAudienceSize || null,
        proposal_accept_rate:  prog.proposalAcceptRate7Day || null,
        proposal_response_rate:prog.proposalResponseRate7Day || null,
        program_type:          prog.programType || null,
        program_subtypes:      prog.programSubtypes || [],
        contact_name:          primaryContact.name || null,
        contact_email:         primaryContact.email || null,
        contact_role:          primaryContact.role || null,
        all_contacts:          allContacts,
        contacts_raw:          contacts,
        corporate_address:     corpAddress,
        city:                  city,
        state:                 state,
        country:               country,
        categories:            categories,
        content_tags:          contentTags,
        editorial_tags:        editorialTags,
        website:               website,
        media_properties:      mediaProperties,
        links:                 links,
        languages:             languages,
        promotional_methods:   promoMethods,
      };
    } catch (e) {
      return null;
    }
  };

  // ── MEDIA PROPERTIES (TRAFFIC DATA) ────────────────────────────────────
  const fetchMediaProperties = async (slideoutToken, radiusPublisherId) => {
    if (!slideoutToken) return {};
    try {
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
          break;
        }
      }
      return traffic;
    } catch { return {}; }
  };

  // ── CARD READING ────────────────────────────────────────────────────────
  const readGridCards = async () => {
    return await safeEval(() => {
      const cards = Array.from(document.querySelectorAll('.iui-card'));
      return cards.map((c, i) => {
        const nameEl =
          c.querySelector('[class*="partner-name"], [class*="company-name"], h3, h4') ||
          c.querySelector('.discovery-card > div > div');
        let name = '';
        if (nameEl) name = (nameEl.innerText || '').trim().split('\n')[0].trim();
        if (!name) name = (c.innerText || '').trim().split('\n')[0].trim();
        return { name, idx: i };
      }).filter(x => x.name);
    }) || [];
  };

  // ── PROPOSAL FLOW ────────────────────────────────────────────────────────
  // Bug 2 fix: NO MORE card-center click fallback. If Send Proposal button
  // isn't visible after hover, we skip the card cleanly.
  const openProposalForIdx = async (idx) => {
    const cardRect = await safeEval((i) => {
      const cards = Array.from(document.querySelectorAll('.iui-card'));
      const c = cards[i];
      if (!c) return null;
      c.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = c.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }, idx);
    if (!cardRect) return { error: 'card-vanished' };
    await sleep(80);

    _busy = true;
    try {
      await page.mouse.move(10, 10);
      await sleep(50);
      await page.mouse.move(cardRect.x + cardRect.w / 2, cardRect.y + cardRect.h / 2, { steps: 10 });
    } finally { _busy = false; }
    await sleep(300);

    const btnRect = await safeEval((i) => {
      const cards = Array.from(document.querySelectorAll('.iui-card'));
      const c = cards[i];
      if (!c) return null;
      const btn = Array.from(c.querySelectorAll('button')).find(b => /send proposal/i.test(b.innerText || ''));
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }, idx);

    // Bug 2 fix: NO fallback. If button isn't visible, skip cleanly.
    if (!btnRect || btnRect.w === 0) {
      return { error: 'no-send-btn' };
    }

    _busy = true;
    try {
      await page.mouse.move(btnRect.x + btnRect.w / 2, btnRect.y + btnRect.h / 2);
      await sleep(80);
      await page.mouse.click(btnRect.x + btnRect.w / 2, btnRect.y + btnRect.h / 2);
    } finally { _busy = false; }

    _busy = true;
    try {
      await page.waitForFunction(() => {
        const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
        return f && f.offsetWidth > 200 && f.offsetHeight > 200;
      }, { timeout: 8000 });
    } catch {
      _busy = false;
      return { error: 'no-iframe' };
    } finally { _busy = false; }
    await sleep(400);
    return { ok: true };
  };

  const extractMeta = async () => {
    return await safeEval(() => {
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
    // Scroll term button into view, then get viewport coordinates
    const coords = await safeEval(() => {
      const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
      if (!f) return null;
      const doc = f.contentDocument;
      if (!doc) return null;
      const btn = doc.querySelector('button.iui-multi-select-input-button');
      if (!btn) return null;
      // Scroll into view FIRST so getBCR gives positive viewport coordinates
      btn.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = btn.getBoundingClientRect();
      const ifr = f.getBoundingClientRect();
      return { x: ifr.left + r.left + r.width / 2, y: ifr.top + r.top + r.height / 2, text: (btn.innerText||'').trim() };
    });
    if (!coords) return { error: 'no-term-btn' };
    if (coords.text && !/^select$/i.test(coords.text)) return { ok: true, alreadySet: coords.text };
    if (coords.y < 0 || coords.y > 2000) return { error: 'term-btn-out-of-view: y=' + coords.y };

    _busy = true;
    try { await page.mouse.click(coords.x, coords.y); }
    finally { _busy = false; }
    await sleep(600);

    // Get "Public Term" option coords (scroll it into view too)
    const optCoords = await safeEval(() => {
      const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
      const doc = f?.contentDocument;
      const ifr = f?.getBoundingClientRect();
      if (!doc || !ifr) return null;
      const lis = Array.from(doc.querySelectorAll('li')).filter(l => (l.innerText||'').trim().length > 0);
      let pick = lis.find(l => /^public term$/i.test((l.innerText||'').trim()));
      if (!pick) pick = lis.find(l => /public term/i.test(l.innerText));
      if (!pick) pick = lis.find(l => !/^select$/i.test((l.innerText||'').trim()) && !/^[0-9]/.test((l.innerText||'').trim()));
      if (!pick) return null;
      pick.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = pick.getBoundingClientRect();
      return { x: ifr.left + r.left + r.width / 2, y: ifr.top + r.top + r.height / 2, text: pick.innerText.trim() };
    });
    if (!optCoords) return { error: 'no-public-terms' };
    if (optCoords.y < 0 || optCoords.y > 2000) return { error: 'option-out-of-view: y=' + optCoords.y };

    _busy = true;
    try { await page.mouse.click(optCoords.x, optCoords.y); }
    finally { _busy = false; }
    await sleep(500);

    // Verify
    const verify = await safeEval(() => {
      const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
      const btn = f?.contentDocument?.querySelector('button.iui-multi-select-input-button');
      return (btn?.innerText||'').trim();
    });
    if (!verify || /^select$/i.test(verify)) return { error: 'term-not-applied', got: verify };
    return { ok: true, picked: verify };
  };

  const fillMessage = async (text) => {
    return await safeEval((msg) => {
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
    // Check if already correctly set
    const already = await safeEval(() => {
      const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
      const val = f?.contentDocument?.querySelector('input[name="startDateTime"]')?.value || '';
      return val.includes('"date":"20');
    });
    if (already) return { ok: true, alreadySet: true };

    // Get calendar button coordinates using scrollIntoView + getBCR
    const calCoords = await safeEval(() => {
      const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
      const doc = f?.contentDocument;
      const ifr = f?.getBoundingClientRect();
      if (!doc || !ifr) return null;
      const btn = doc.querySelector('button[data-testid="uicl-date-input"]');
      if (!btn) return null;
      btn.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = btn.getBoundingClientRect();
      return { x: Math.round(ifr.left + r.left + r.width / 2), y: Math.round(ifr.top + r.top + r.height / 2) };
    });
    if (!calCoords) return { error: 'no-date-btn' };

    // Click calendar button via proper mouse events (triggers React state)
    _busy = true;
    try { await page.mouse.click(calCoords.x, calCoords.y); }
    finally { _busy = false; }
    await sleep(800);

    // Get "Today" button coordinates
    const todayCoords = await safeEval(() => {
      const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
      const doc = f?.contentDocument;
      const ifr = f?.getBoundingClientRect();
      if (!doc || !ifr) return null;
      const btn = Array.from(doc.querySelectorAll('button, a, [role="button"]'))
        .find(b => /^today$/i.test((b.innerText||'').trim()));
      if (!btn) return null;
      btn.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = btn.getBoundingClientRect();
      return { x: Math.round(ifr.left + r.left + r.width / 2), y: Math.round(ifr.top + r.top + r.height / 2) };
    });
    if (!todayCoords) return { error: 'no-today-btn' };

    // Click "Today" via proper mouse events (updates React state correctly)
    _busy = true;
    try { await page.mouse.click(todayCoords.x, todayCoords.y); }
    finally { _busy = false; }
    await sleep(500);

    // Verify: date must be set in React state (no "date":null)
    const verify = await safeEval(() => {
      const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
      const val = f?.contentDocument?.querySelector('input[name="startDateTime"]')?.value || '';
      const errors = Array.from(f?.contentDocument?.querySelectorAll('[class*=error]')||[])
        .map(e => e.innerText.trim()).filter(t => t.includes('date'));
      return { hasDate: val.includes('"date":"20'), errors };
    });
    if (!verify?.hasDate) return { error: 'date-not-set-in-react', errors: verify?.errors };
    return { ok: true };
  };

  const submitProposal = async () => {
    // Click "Send Proposal" via JS click (avoids viewport coordinate issues)
    const submitOk = await safeEval(() => {
      const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
      const doc = f?.contentDocument;
      if (!doc) return false;
      const btn = Array.from(doc.querySelectorAll('button')).find(b => /^send proposal$/i.test((b.innerText||'').trim()) && !b.disabled);
      if (!btn) return false;
      btn.scrollIntoView({ block: 'center', behavior: 'instant' });
      btn.click();
      return true;
    });
    if (!submitOk) return { error: 'no-submit-btn' };
    await sleep(400);

    // Wait for "I Understand" to appear
    _busy = true;
    try {
      await page.waitForFunction(() => {
        const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
        return f?.contentDocument && Array.from(f.contentDocument.querySelectorAll('button')).some(b => /^i understand$/i.test((b.innerText||'').trim()));
      }, { timeout: 5000 });
    } catch { _busy = false; return { error: 'no-confirm-dialog' }; }
    finally { _busy = false; }

    // Click "I Understand" via JS click
    const confirmOk = await safeEval(() => {
      const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
      const doc = f?.contentDocument;
      if (!doc) return false;
      const btn = Array.from(doc.querySelectorAll('button')).find(b => /^i understand$/i.test((b.innerText||'').trim()));
      if (!btn) return false;
      btn.scrollIntoView({ block: 'center', behavior: 'instant' });
      btn.click();
      return true;
    });
    if (!confirmOk) return { error: 'no-i-understand-btn' };

    _busy = true;
    try {
      await page.waitForFunction(() => {
        const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
        if (!f || f.offsetWidth === 0 || f.offsetHeight === 0) return true;
        // Also done if iframe shows "Access is Denied" or error
        const body = f.contentDocument?.body?.innerText || '';
        if (/access is denied|you do not have access|error/i.test(body)) return true;
        return false;
      }, { timeout: 10000 });
      _busy = false;
      // Check if it was an access denied error
      const denied = await page.evaluate(() => {
        const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
        return /access is denied|you do not have access/i.test(f?.contentDocument?.body?.innerText || '');
      }).catch(() => false);
      if (denied) return { error: 'access-denied' };
      return { ok: true };
    } catch { _busy = false; return { error: 'modal-did-not-close' }; }
  };

  const closeModal = async () => {
    try {
      await safeEval(() => {
        const closeBtn = document.querySelector(
          '.modal-container button[aria-label*="close" i], .modal-container [class*="close" i]'
        );
        if (closeBtn) closeBtn.click();
      });
    } catch {}
    try { await page.keyboard.press('Escape'); } catch {}
    await sleep(250);
  };

  // ── MAIN LOOP ─────────────────────────────────────────────────────────
  await ensureDiscover();
  await sleep(250);

  await safeEval(() => window.scrollTo(0, 0));
  await sleep(400);

  let scrollPasses = 0;
  const MAX_SCROLL_PASSES = 500;

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
          if (open.error === 'no-iframe') {
            await closeModal();
            await ensureDiscover();
          }
          // 'no-send-btn' / 'card-vanished' — no cleanup needed, just continue
          continue;
        }

        // Extract iframe meta (partner_id, psi, contact_name, contact_email)
        const meta = await extractMeta();
        if (!meta || !meta.partner_id) {
          errors.push({ name, step: 'meta', reason: 'no-partner-id' });
          await closeModal();
          await ensureDiscover();
          continue;
        }

        // ── PROPOSAL FORM ─────────────────────────────────────────────
        const term = await selectTerm();
        if (term.error) {
          errors.push({ name, step: 'term', reason: term.error, meta });
          await closeModal();
          await ensureDiscover();
          continue;
        }

        const dateRes = await setStartDate();
        if (dateRes.error) {
          errors.push({ name, step: 'date', reason: dateRes.error, meta });
          await closeModal();
          await ensureDiscover();
          continue;
        }

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

        // ── DATA COLLECTION (after modal closed; safe + isolated) ─────
        // Bug 3 fix: these run AFTER submitProposal cleared the modal.
        // safeEval-wrapped apiFetch returns null on failure; we never throw.
        let slideoutData = null;
        let trafficData = {};
        try {
          slideoutData = await fetchSlideoutData(meta.partner_id);
          if (slideoutData?.slideout_token) {
            trafficData = await fetchMediaProperties(slideoutData.slideout_token, meta.partner_id);
          }
        } catch (e) {
          // never let data collection break the proposal record
        }

        const primaryTraffic = Object.values(trafficData)[0] || {};
        const primarySite = Object.keys(trafficData)[0] || slideoutData?.website || null;

        const pubData = {
          // Outreach fields
          name,
          partner_id:           meta.partner_id,
          psi:                  meta.psi || slideoutData?.psi || null,
          contact_name:         meta.contact_name || slideoutData?.contact_name || null,
          contact_email:        meta.contact_email || slideoutData?.contact_email || null,
          term:                 term.picked || term.alreadySet || 'Public Terms',
          term_text:            term.picked || term.alreadySet || 'Public Terms',
          term_verified:        true,
          date_verified:        true,
          contract_date:        CONTRACT_DATE,
          outreach_msg:         MSG,
          proposal_sent:        true,
          sent_at:              new Date().toISOString(),
          // Identity
          description:          slideoutData?.description || null,
          size_rating:          slideoutData?.size_rating || null,
          partner_size:         slideoutData?.size_rating || null,
          business_model:       null,
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
          // Traffic
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

        results.push(pubData);
        processedThisPass++;
        await sleep(250);
      } catch (e) {
        errors.push({ name, step: 'exception', reason: String(e).slice(0, 200) });
        await closeModal();
        await ensureDiscover();
      }
    }

    if (results.length >= TARGET) break;
    if (processedThisPass === 0) scrollPasses++;
    // Use real mouse wheel events — windows.scrollBy doesn't trigger Impact's infinite scroll
    await page.mouse.wheel(0, 1000);
    await sleep(800);
    await page.mouse.wheel(0, 1000);
    await sleep(800);
  }

  return {
    total: results.length,
    target: TARGET,
    sent: results,
    errors,
    seen_count: seen.size,
  };
}
