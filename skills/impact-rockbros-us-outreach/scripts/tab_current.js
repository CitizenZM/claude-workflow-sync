// Impact Rockbros US — bulk proposal master script (v9 multi-page-aware 2026-05-03)
// Tokens replaced by tab-builder Python:
//   Hi, this is Bob Zabel, reaching out from Rockbros, the NO.1 sports accessory you must see. We are offering 10–20% ultra-high commission with a limited-time deal offer. Reply here or email affiliate@celldigital.co to chat in detail and get a sample., 2026-05-05, ["business insider.", "idealo internet gmbh", "mywellihousedecor", "cnbc select", "consumertrack inc", "gecko labs pte. ltd.", "schibsted media as", "adorocinema integra\u00e7\u00e3o nativa", "mecenat se", "lighthouse lead holdings, llc", "tikato", "lifehacker au (upfeat media)", "elfster, inc.", "i know the pilot", "performance group", "the gist sports", "cx3 ads", "quiller media, inc.", "u.s. news & world report money", "nav technologies", "dog food advisor", "oberstbv", "travel supermarket", "parker management llc", "growth leads finance limited", "the ginger penny", "cuponation spain", "la times studios", "caerus media", "tecmundocupons", "sassy saves llc", "veve", "le figaro", "people inc. - cpc", "allkeyshop", "softonic international s.a.", "imbull.", "checkout charlie gmbh", "gasbuddy", "invitation digital ltd", "honor society\u00ae", "massive", "the kitchen magpie inc.", "easyfundraising ltd", "zip, formerly quadpay", "perkspot", "atolls de (shoop)", "ecommerce enablers pte. ltd", "rebates", "revolut us", "topcashback australia pty limited", "next jump", "la banque postale", "revolut technologies singapore pte. ltd.", "travelarrow", "luckydiem", "furthr network", "chase media solutions", "\u682a\u5f0f\u4f1a\u793estract", "viatrumf", "super.com", "admitad 2403955", "mobadbid", "interspace co.,ltd.", "admitad media pvt ltd", "admitad gmbh.", "revenue universe,llc", "linkfire", "clearpier performance inc.", "avantlink usa", "howl technologies, inc.", "www.borrowell.com", "discovery, inc", "the daily aus", "thenewyorksun", "birdie", "6am city - the buy", "plain magazine", "the hockey writers", "half baked", "makeanddocrew", "nautilus magazine", "unidaysus", "benjaminone", "lux rewards (a lyfe technology brand)", "collinsonhk", "sovrn commerce 2", "direct agents", "perform[cb]", "maxbounty.com ulc", "arabyads", "pwngames network inc..", "l'express studio", "xlmedia", "involve asia technologies sdn bhd", "tradedoubler.", "tonefuse, llc", "admitad 269814", "daisycon", "mavely", "gotzha", "roth media gmbh", "sovereign co.", "u.s. news health", "buzzfeed", "new mall media", "indiadotcom digital private  limited", "internet property holdings llc", "midi libre", "emeals", "01netcom - keleops", "blue development.", "citycouponmom", "couponbirds", "digital link marketing sl", "relix", "lopez0101", "across", "media24", "stemactivities", "gumbo social", "contorion gmbh", "girlboss holdings inc.", "reward gateway pty ltd", "livesport", "poulpeo", "myappfree", "m\u00e9liuz.", "fidel api (enigmatic smile)", "netspend", "shopmyshelf", "financeads international gmbh", "splash financial", "tivly insurance marketplace", "kim affiliates", "fandom - gamespot", "samsung da", "nme networks media limited", "tradedoubler_germany", "babybump", "trixgetchang", "zx digital ltd", "webravo srl1", "vuela alto llc", "brickseek", "jalapeno", "retailmenot, uk ltd. loylaty", "atolls mx", "atolls my", "redflagdeals", "savoo.co.uk", "the connexion", "tikr", "spiritual growth events", "nadine richardson - she births", "explore washington", "holistic pet health coach, llc", "mastercard ( excl gst )", "shopstyle inc.", "atolls es (igraal)", "galois ,inc.", "paisawapas.com", "milesandmore_osm", "shopback nz", "jmpt", "medibank live better rewards", "myunidays limited", "shih-kong trading company", "zbd offers", "shopstyle uk", "racv", "fuel rewards.", "engine by moneylion", "maxbounty ulc 2", "mapendo", "up only", "lookfantastic", "linkprice", "a8.net", "clickwork7", "nelo", "bankrate", "santrelmedia", "people, inc. (dc+)", "slashdot media, llc", "amex-cardbenefit [1510]", "731 llc", "godaddy", "thing or two agency", "ad intelligence pvt. ltd.", "forbes digital marketing inc.", "nerdwallet compare inc", "the motley fool", "nerdwallet, inc", "people inc. - content", "nerdwallet, inc.", "forbes media", "consumertrack", "healthline media inc.", "bandsintown"], 3, https://app.impact.com/secure/advertiser/discover/radius/fr/partner_discover.ihtml?page=marketplace&slideout_id_type=partner#businessModels=CONTENT_REVIEWS&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC
//
// v9 fix: browser_run_code_unsafe always runs on the focused tab (chrome extension).
// All operations use `impactPage` found via context().pages() — not the root `page`.

async (_rootPage) => {
  // ── PAGE SWITCH ─────────────────────────────────────────────────────────
  const _pages = _rootPage.context().pages();
  const page = _pages.find(p => p.url().includes('app.impact.com')) || _rootPage;
  await page.bringToFront();
  await page.waitForTimeout(500);

  const DISCOVER_URL = "https://app.impact.com/secure/advertiser/discover/radius/fr/partner_discover.ihtml?page=marketplace&slideout_id_type=partner#businessModels=CONTENT_REVIEWS&partnerStatuses=1&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC";
  const MSG = "Hi, this is Bob Zabel, reaching out from Rockbros, the NO.1 sports accessory you must see. We are offering 10–20% ultra-high commission with a limited-time deal offer. Reply here or email affiliate@celldigital.co to chat in detail and get a sample.";
  const CONTRACT_DATE = "2026-05-05";
  const ALREADY = ["business insider.", "idealo internet gmbh", "mywellihousedecor", "cnbc select", "consumertrack inc", "gecko labs pte. ltd.", "schibsted media as", "adorocinema integra\u00e7\u00e3o nativa", "mecenat se", "lighthouse lead holdings, llc", "tikato", "lifehacker au (upfeat media)", "elfster, inc.", "i know the pilot", "performance group", "the gist sports", "cx3 ads", "quiller media, inc.", "u.s. news & world report money", "nav technologies", "dog food advisor", "oberstbv", "travel supermarket", "parker management llc", "growth leads finance limited", "the ginger penny", "cuponation spain", "la times studios", "caerus media", "tecmundocupons", "sassy saves llc", "veve", "le figaro", "people inc. - cpc", "allkeyshop", "softonic international s.a.", "imbull.", "checkout charlie gmbh", "gasbuddy", "invitation digital ltd", "honor society\u00ae", "massive", "the kitchen magpie inc.", "easyfundraising ltd", "zip, formerly quadpay", "perkspot", "atolls de (shoop)", "ecommerce enablers pte. ltd", "rebates", "revolut us", "topcashback australia pty limited", "next jump", "la banque postale", "revolut technologies singapore pte. ltd.", "travelarrow", "luckydiem", "furthr network", "chase media solutions", "\u682a\u5f0f\u4f1a\u793estract", "viatrumf", "super.com", "admitad 2403955", "mobadbid", "interspace co.,ltd.", "admitad media pvt ltd", "admitad gmbh.", "revenue universe,llc", "linkfire", "clearpier performance inc.", "avantlink usa", "howl technologies, inc.", "www.borrowell.com", "discovery, inc", "the daily aus", "thenewyorksun", "birdie", "6am city - the buy", "plain magazine", "the hockey writers", "half baked", "makeanddocrew", "nautilus magazine", "unidaysus", "benjaminone", "lux rewards (a lyfe technology brand)", "collinsonhk", "sovrn commerce 2", "direct agents", "perform[cb]", "maxbounty.com ulc", "arabyads", "pwngames network inc..", "l'express studio", "xlmedia", "involve asia technologies sdn bhd", "tradedoubler.", "tonefuse, llc", "admitad 269814", "daisycon", "mavely", "gotzha", "roth media gmbh", "sovereign co.", "u.s. news health", "buzzfeed", "new mall media", "indiadotcom digital private  limited", "internet property holdings llc", "midi libre", "emeals", "01netcom - keleops", "blue development.", "citycouponmom", "couponbirds", "digital link marketing sl", "relix", "lopez0101", "across", "media24", "stemactivities", "gumbo social", "contorion gmbh", "girlboss holdings inc.", "reward gateway pty ltd", "livesport", "poulpeo", "myappfree", "m\u00e9liuz.", "fidel api (enigmatic smile)", "netspend", "shopmyshelf", "financeads international gmbh", "splash financial", "tivly insurance marketplace", "kim affiliates", "fandom - gamespot", "samsung da", "nme networks media limited", "tradedoubler_germany", "babybump", "trixgetchang", "zx digital ltd", "webravo srl1", "vuela alto llc", "brickseek", "jalapeno", "retailmenot, uk ltd. loylaty", "atolls mx", "atolls my", "redflagdeals", "savoo.co.uk", "the connexion", "tikr", "spiritual growth events", "nadine richardson - she births", "explore washington", "holistic pet health coach, llc", "mastercard ( excl gst )", "shopstyle inc.", "atolls es (igraal)", "galois ,inc.", "paisawapas.com", "milesandmore_osm", "shopback nz", "jmpt", "medibank live better rewards", "myunidays limited", "shih-kong trading company", "zbd offers", "shopstyle uk", "racv", "fuel rewards.", "engine by moneylion", "maxbounty ulc 2", "mapendo", "up only", "lookfantastic", "linkprice", "a8.net", "clickwork7", "nelo", "bankrate", "santrelmedia", "people, inc. (dc+)", "slashdot media, llc", "amex-cardbenefit [1510]", "731 llc", "godaddy", "thing or two agency", "ad intelligence pvt. ltd.", "forbes digital marketing inc.", "nerdwallet compare inc", "the motley fool", "nerdwallet, inc", "people inc. - content", "nerdwallet, inc.", "forbes media", "consumertrack", "healthline media inc.", "bandsintown"];
  const TARGET = 3;

  const sleep = ms => page.waitForTimeout(ms);
  const alreadySet = new Set(ALREADY.map(n => n.toLowerCase()));
  const results = [];
  const errors = [];
  const seen = new Set();

  const ensureDiscover = async () => {
    const u = page.url();
    if (!u.includes('partner_discover') || u.includes('slideout_id=')) {
      await page.goto(DISCOVER_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await sleep(3000);
    }
  };

  const readGridCards = async () => {
    return await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.iui-card'));
      return cards.map((c, i) => {
        const nameEl =
          c.querySelector('[class*="partner-name"], [class*="company-name"], h3, h4') ||
          c.querySelector('.discovery-card > div > div');
        let name = '';
        if (nameEl) name = (nameEl.innerText || '').trim().split('\n')[0].trim();
        if (!name) {
          const txt = (c.innerText || '').trim();
          name = txt.split('\n')[0].trim();
        }
        return { name, idx: i };
      }).filter(x => x.name);
    });
  };

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

    // Move mouse to card center to trigger hover reveal
    await page.mouse.move(10, 10);
    await sleep(100);
    await page.mouse.move(cardRect.x + cardRect.w / 2, cardRect.y + cardRect.h / 2, { steps: 10 });
    await sleep(800);

    // Check for button via CSS hover state
    const btnRect = await page.evaluate((i) => {
      const cards = Array.from(document.querySelectorAll('.iui-card'));
      const c = cards[i];
      if (!c) return null;
      // Look for Send Proposal button anywhere in the card
      const btn = Array.from(c.querySelectorAll('button')).find(b => /send proposal/i.test(b.innerText || ''));
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }, idx);

    if (!btnRect || btnRect.w === 0) {
      // Try clicking the card itself to open slideout, then find Send Proposal there
      await page.mouse.click(cardRect.x + cardRect.w / 2, cardRect.y + cardRect.h / 2);
      await sleep(1500);

      // Check if slideout opened with Send Proposal button
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

      // No button even in slideout — navigate back and skip
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
          partner_id: u.searchParams.get('p') || null,
          psi: u.searchParams.get('psi') || null,
          contact_name: u.searchParams.get('name') || null,
          contact_email: u.searchParams.get('email') || null,
          iframe_src: f.src
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
      return {
        x: ifr.x + r.x + r.width / 2,
        y: ifr.y + r.y + r.height / 2,
        currentText: (btn.innerText || '').trim()
      };
    });
    if (!coords) return { error: 'no-term-btn' };

    if (coords.currentText && !/^select$/i.test(coords.currentText)) {
      return { ok: true, alreadySet: coords.currentText };
    }

    await page.mouse.click(coords.x, coords.y);
    await sleep(1000);

    try {
      await page.waitForFunction(() => {
        const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
        const doc = f && f.contentDocument;
        if (!doc) return false;
        return doc.querySelectorAll('li[role="option"]').length > 0;
      }, { timeout: 5000 });
    } catch {
      return { error: 'no-term-options' };
    }

    const optCoords = await page.evaluate(() => {
      const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
      const doc = f.contentDocument;
      const opts = Array.from(doc.querySelectorAll('li[role="option"]'));
      let pick = opts.find(o => /public terms/i.test(o.innerText));
      if (!pick) pick = opts.find(o => !/^select$/i.test((o.innerText || '').trim()));
      if (!pick) return null;
      const r = pick.getBoundingClientRect();
      const ifr = f.getBoundingClientRect();
      return {
        x: ifr.x + r.x + r.width / 2,
        y: ifr.y + r.y + r.height / 2,
        text: pick.innerText.trim()
      };
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
    } catch {
      return { error: 'no-confirm-dialog' };
    }

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
    } catch {
      return { error: 'modal-did-not-close' };
    }
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

  // ── MAIN LOOP ──────────────────────────────────────────────────────────
  await ensureDiscover();
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(1500);

  let scrollPasses = 0;
  const MAX_SCROLL_PASSES = 20;

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

        const meta = await extractMeta();
        if (!meta || !meta.partner_id) {
          errors.push({ name, step: 'meta', reason: 'no-partner-id' });
          await closeModal();
          await ensureDiscover();
          continue;
        }

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

        results.push({
          name,
          partner_id: meta.partner_id,
          psi: meta.psi,
          contact_name: meta.contact_name,
          contact_email: meta.contact_email,
          term: term.picked || term.alreadySet || 'Public Terms',
          contract_date: CONTRACT_DATE,
          sent_at: new Date().toISOString()
        });
        processedThisPass++;
        await sleep(800);
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
    seen_count: seen.size
  };
}
