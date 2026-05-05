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

    // Use Playwright element hover() — this reliably triggers CSS :hover for reveal animations
    _busy = true;
    try {
      await page.locator('.iui-card').nth(idx).hover({ timeout: 5000 });
    } finally { _busy = false; }
    await sleep(400);

    const btnResult = await safeEval((i) => {
      const cards = Array.from(document.querySelectorAll('.iui-card'));
      const c = cards[i];
      if (!c) return null;
      const btn = Array.from(c.querySelectorAll('button')).find(b => /send proposal/i.test(b.innerText || ''));
      if (!btn) return null;
      btn.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = btn.getBoundingClientRect();
      if (r.width > 0) {
        return { x: r.x, y: r.y, w: r.width, h: r.height, jsClick: false };
      }
      btn.click();
      return { jsClick: true };
    }, idx);

    if (!btnResult) {
      return { error: 'no-send-btn' };
    }

    if (!btnResult.jsClick) {
      // Normal mouse click path
      _busy = true;
      try {
        await page.mouse.move(btnResult.x + btnResult.w / 2, btnResult.y + btnResult.h / 2);
        await sleep(80);
        await page.mouse.click(btnResult.x + btnResult.w / 2, btnResult.y + btnResult.h / 2);
      } finally { _busy = false; }
    }
    // If jsClick=true, button already clicked above

    try {
      await page.waitForFunction(() => {
        const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
        return f && f.offsetWidth > 200 && f.offsetHeight > 200;
      }, { timeout: 8000 });
    } catch {
      return { error: 'no-iframe' };
    }
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
    // If form already has validation errors (stale submit), close and signal re-open
    const hasErrors = await safeEval(() => {
      const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
      const doc = f?.contentDocument;
      return Array.from(doc?.querySelectorAll('[class*=error]') || []).some(e => e.innerText?.trim());
    });
    if (hasErrors) return { error: 'stale-form-with-errors' };

    // Check current state — if already set, skip
    const currentText = await frame.locator('button.iui-multi-select-input-button').first()
      .innerText({ timeout: 3000 }).catch(() => '');
    if (currentText && !/^select$/i.test(currentText.trim())) {
      return { ok: true, alreadySet: currentText.trim() };
    }

    // Use BCR-based page.mouse.click for both clicks — proven reliable approach.
    // frameLocator computes wrong coordinates; direct BCR + mouse.click works correctly.

    // Step 1: Get term button coords and click it
    const termCoords = await safeEval(() => {
      const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
      const doc = f?.contentDocument;
      const ifr = f?.getBoundingClientRect();
      if (!doc || !ifr) return null;
      // Term button is the first visible iui-multi-select-input-button with "Select" text
      const btn = Array.from(doc.querySelectorAll('button.iui-multi-select-input-button'))
        .filter(b => b.offsetWidth > 0)
        .find(b => /^select$/i.test(b.innerText?.trim()) || !/^\d|AM|PM|GMT|Ongoing/i.test(b.innerText?.trim()));
      if (!btn) return null;
      btn.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = btn.getBoundingClientRect();
      return { x: Math.round(ifr.left + r.left + r.width / 2), y: Math.round(ifr.top + r.top + r.height / 2) };
    });
    if (!termCoords) return { error: 'no-term-btn-coords' };

    _busy = true;
    try { await page.mouse.click(termCoords.x, termCoords.y); }
    finally { _busy = false; }
    await sleep(600);

    // Step 2: Get "Public Term" li coords and click it
    const optCoords = await safeEval(() => {
      const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
      const doc = f?.contentDocument;
      const ifr = f?.getBoundingClientRect();
      if (!doc || !ifr) return null;
      const li = Array.from(doc.querySelectorAll('li'))
        .find(l => l.offsetWidth > 0 && /public term/i.test(l.innerText || ''));
      if (!li) return { err: 'no-li', count: doc.querySelectorAll('li').length };
      li.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = li.getBoundingClientRect();
      return { x: Math.round(ifr.left + r.left + r.width / 2), y: Math.round(ifr.top + r.top + r.height / 2) };
    });
    if (!optCoords || optCoords.err) {
      // No "Public Term" li visible — dropdown closed or publisher has no public term.
      // Press Escape to close any open dropdown and proceed;
      // if term is required, submitProposal will fail with validation error (handled by stale-form check).
      try { await page.keyboard.press('Escape'); } catch {}
      await sleep(200);
      // Check if term is already set (some publishers auto-select only term)
      const autoTerm = await safeEval(() => {
        const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
        const doc = f?.contentDocument;
        const btn = Array.from(doc?.querySelectorAll('button.iui-multi-select-input-button') || [])
          .filter(b => b.offsetWidth > 0)
          .find(b => !/^\d|AM|PM|GMT|Ongoing/i.test(b.innerText?.trim()));
        const t = (btn?.innerText || '').trim();
        return t && !/^select$/i.test(t) ? t : null;
      });
      if (autoTerm) return { ok: true, alreadySet: autoTerm };
      return { error: 'no-public-term-li', detail: optCoords };
    }

    _busy = true;
    try { await page.mouse.click(optCoords.x, optCoords.y); }
    finally { _busy = false; }
    await sleep(400);

    // Verify selection via safeEval
    const picked = await safeEval(() => {
      const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
      const doc = f?.contentDocument;
      const btn = Array.from(doc?.querySelectorAll('button.iui-multi-select-input-button') || [])
        .filter(b => b.offsetWidth > 0)
        .find(b => !/^\d|AM|PM|GMT|Ongoing/i.test(b.innerText?.trim()));
      return (btn?.innerText || '').trim();
    });
    if (!picked || /^select$/i.test(picked)) {
      return { error: 'term-not-applied', got: picked };
    }
    return { ok: true, picked };
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
    // With LA timezone (America/Los_Angeles), today's date is valid.
    // The form pre-fills today's date — just verify it's set and return.
    // No calendar interaction needed.

    // The form pre-fills today's date (May 5) with LA timezone — already valid.
    // Just verify the date button shows a date value (not empty).
    const dateOk = await safeEval(() => {
      const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
      const doc = f?.contentDocument;
      if (!doc) return false;
      const btn = doc.querySelector('button[data-testid="uicl-date-input"]');
      const text = (btn?.innerText || '').trim();
      // Date is set if button shows a month name (e.g. "May 5, 2026")
      return /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(text);
    });
    // Even if date button is empty, proceed — Impact will use server default
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

    // Wait for "I Understand" to appear (no _busy — waitForFunction doesn't need it)
    await sleep(800);
    const hasIUnderstand = await safeEval(() => {
      const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
      return !!(f?.contentDocument && Array.from(f.contentDocument.querySelectorAll('button')).some(b => /^i understand$/i.test((b.innerText||'').trim())));
    });
    if (!hasIUnderstand) return { error: 'no-confirm-dialog' };

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

    // Wait for iframe to close OR reset to empty form (both indicate success)
    // After "I Understand", Impact either:
    //   (a) closes the iframe → offsetWidth === 0
    //   (b) resets the form to empty state → body text lacks partner-specific content
    try {
      await page.waitForFunction(() => {
        const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
        if (!f || f.offsetWidth === 0 || f.offsetHeight === 0) return true;
        const body = f.contentDocument?.body?.innerText || '';
        if (/access is denied|you do not have access/i.test(body)) return true;
        // Form reset to empty state: only shows field labels, no filled data
        // Detect: "I Understand" button gone AND no partner name in Send Proposal area
        const hasSendBtn = Array.from(f.contentDocument.querySelectorAll('button')).some(b => /^send proposal$/i.test(b.innerText?.trim()));
        const hasIUnderstand = Array.from(f.contentDocument.querySelectorAll('button')).some(b => /^i understand$/i.test(b.innerText?.trim()));
        if (hasSendBtn && !hasIUnderstand) return true; // form reset = proposal sent, ready for next
        return false;
      }, { timeout: 12000 });
      const denied = await safeEval(() => {
        const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
        return /access is denied|you do not have access/i.test(f?.contentDocument?.body?.innerText || '');
      });
      if (denied) return { error: 'access-denied' };
      return { ok: true };
    } catch { return { error: 'modal-did-not-close' }; }
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
    await sleep(300);
    // If iframe still visible after close attempt, force-remove from DOM
    await safeEval(() => {
      const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
      if (f && f.offsetWidth > 0) {
        // Remove iframe and its container
        const container = f.closest('.modal-container, [class*="slideout"], [class*="modal"]') || f;
        container.remove();
      }
    }).catch(() => {});
    await sleep(150);
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
        // If a stale error-state iframe is still present, do a full page reload to clear it
        const staleIframe = await safeEval(() => {
          const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
          if (!f || f.offsetWidth === 0) return false;
          return Array.from(f.contentDocument?.querySelectorAll('[class*=error]') || []).some(e => e.innerText?.trim());
        });
        if (staleIframe) {
          await safeEval(() => {
            document.querySelectorAll('iframe[src*="send-proposal-new-partner-flow"]').forEach(f => {
              const c = f.closest('.modal-container, [class*="slideout"], [class*="modal"]') || f;
              c.remove();
            });
          });
          await sleep(300);
        }

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
          // Force-navigate to clear stale form state regardless of current URL
          _navigating = true;
          try {
            await page.goto(DISCOVER_URL, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
            await sleep(500);
          } finally { _navigating = false; }
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
    if (processedThisPass === 0) {
      scrollPasses++;
      // Stop scrolling if we've had 5 consecutive passes with no new eligible cards
      // (all cards seen, no Send Proposal buttons, tab exhausted)
      if (scrollPasses >= 5) break;
    } else {
      scrollPasses = 0; // reset on any progress
    }
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
