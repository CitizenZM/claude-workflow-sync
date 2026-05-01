async (page) => {
  const DISCOVER_URL = "https://app.impact.com/secure/advertiser/discover/radius/fr/partner_discover.ihtml?page=marketplace&slideout_id_type=partner#businessModels=CONTENT_REVIEWS&locationCountryCode=US&sortBy=reachRating&sortOrder=DESC";
  const MSG = "Hi, this is Bob Zabel, reaching out from Rockbros, the NO.1 sports accessory you must see. We are offering 10-20% ultra-high commission with a limited-time deal offer. Reply here or email affiliate@celldigital.co to chat in detail and get a sample.";
  const CONTRACT_DATE = "2026-05-02";
  const ALREADY = ["nnwaigwe@businessinsider.com", "eric.mueller@idealo.de", "mywellihousedecor@outlook.com", "affiliates@creditcards.com", "betak@consumertrack.com", "admin@coingecko.com", "thomas.gulbrandsen@vg.no", "paola.piola@webedia-group.com", "jezper.soderlund@mecenat.se", "financeiro@cuponomia.com.br", "info@tikato.it", "adminlifehackerau@upfeat.com", "peter@elfster.com", "garth@iwantthatflight.com.au", "mreifeiss@ignitemediagroup.co", "alexisa@thegistsports.com", "cx3notifications@cx3ads.com", "jvalvano@gmail.com", "kheneghan@usnews.com", "jjensen@nav.com", "patrick.mccarthy@wagwalking.com", "team+impactradius@oberst.com", "a.r@icetravelgroup.com", "accounting@parkertalentmanagement.com", "affiliate-glf@growthleads.com", "lauren@thegingerpenny.com", "spain@cuponation.com", "couponcodes@latimes.com", "tyler@caerusmedia.com", "afiliacao@estadao.com", "sisterwithsass@gmail.com", "seher.n@affinity.com", "epoupard@lefigaro.fr", "affiliateteam@meredith.com", "contact@allkeyshop.com", "affiliate@softonic.com", "affiliate.nl@joingsg.com", "affiliate@checkout-charlie.com", "akoundinya@gasbuddy.com", "vc-ukaffiliates@groupon.com", "michael.moradian@honorsociety.org", "operations@mass1ve.net", "mike@thekitchenmagpie.com", "paula@easyfundraising.org.uk", "affiliate.partnerships@zip.co", "dbannister@perkspot.com", "affiliate.de@atolls.com", "sam.moss+hk@shopback.com", "rebates-asp-news@mail.rakuten.com", "lifestyle@revolut.com", "web@topcashback.com.au", "TeamMerchant@nextjump.com", "impact_radius_lbp@plebicom.com", "lifestyle@revolut.com", "jaideep.patil@travelarrow.io", "dominic@luckydiem.com", "laura@furthr.com", "cms.finance@chase.com", "kiichi@stract.co.jp", "rachael.wardley+1@topbenefitschemes.co.uk", "jeremyc@super.com", "m.shchetinina@admitad.com", "integrationteam@mobadbid.com", "cj_account@interspace.inc", "cs.india@admitad.com", "ev@admitad.com", "peterk@revenueuniverse.com", "aa@linkfire.com", "impact@clearpier.com", "schaplin@avantlink.com", "solutions@howl.link", "simon.wyse@borrowell.com", "jennifer_cicatelli@discovery.com", "tara@thedailyaus.com.au", "office@nysun.com", "candace@sendbirdie.com", "billing@6AMcity.com", "oliver@plainmagazine.com", "dean@thehockeywriters.com", "hello@gethalfbaked.com", "jess@makeanddocrew.com", "dustin.marucci@fragmnt.com", "thomas.mason@myunidays.com", "olivia.yu@benjaminone.com", "tom.munday@luxrewards.co.uk", "yolanda.chong@collinsongroup.com", "affiliate@viglink.com", "jennifer@directagents.com", "accounting@performcb.com", "mattm@maxbounty.com", "tracel@arabyads.com", "amit@pwngames.com", "digital@lexpress.fr", "russell.joy@sportradar.com", "partners@involve.asia", "claudia.batschi-rota@tradedoubler.com", "dharlan@bandsintown.com", "impact@admitad.com", "s.iancovici@daisycon.com", "mavely.affiliates@later.com", "sergio@gotzha.com", "lorocreative@gmail.com", "michael.herrera@comparecredit.com", "dbogert@usnews.com", "affiliatepartners@buzzfeed.com", "jgomez@newmallmedia.com", "shubham.yadav@india.com", "joseph@eforms.com", "shopping+4@ouest-france.fr", "akenny@emeals.com", "jeanguillaume@keleops.com", "jdblewitt@bluedevelopment.org", "citycouponmom@gmail.com", "cathy@couponbirds.com", "manuelzabala@chollometro.com", "patrick@relix.com", "accnf112233@gmail.com", "bianca.tincovici@across.it", "basil.fortuin@media24.com", "momgineer.blog@gmail.com", "hello@gumbosocial.com", "lena.moser@contorion.de", "info@girlboss.com", "merchants@rewardgateway.com.au", "affiliate1@livesport.eu", "plp-societe@poulpeo.pro", "jonathan@myappfree.com", "redes-login@meliuz.com.br", "andrew+1@fidel.uk", "rfreeman@netspend.com", "affiliates@shopmy.us", "m.costa@financeads.com", "pleimkuehler@splashfinancial.com", "sarah.deverges@tivly.com", "illia.meshcheriakov@kim-affiliates.com", "hpatterson@fandom.com", "david1.kwon@samsung.com", "joe.supple@nmenetworks.com", "paullubossita-1204@yopmail.com", "tony@babybump.love", "trixgetchang@gmail.com", "netvouchercodes@zxdigital.co.uk", "useruk@bravovoucher.co.uk", "matias@promociones-aereas.com.ar", "john@BrickSeek.com", "willy@promodescuentos.com", "content@vouchercodes.co.uk", "mexico@cuponation.com", "affiliate.my@atolls.com", "amariano@verticalscope.com", "alan@savings.com", "tom.smith@connexionfrance.com", "david.hanson@tikr.com", "chriscadejv@gmail.com", "nadine@shebirths.com", "scott@explorewashingtonstate.com", "tohphc@gmail.com", "ARLoyaltySolutions@mastercard.com", "ebates-affiliate@ebates.com", "affiliatespain@igraal.com", "asai@galoisjapan.com", "shankar@paisawapas.com", "affiliate@milesandmore.com", "sam.moss+nzd@shopback.com", "gintare@jumptask.io", "jason.manderson@medibank.com.au", "accounts.receivable.au@myunidays.com", "info@sharktank.com.tw", "advertising@zebedee.io", "accountadmin-ss-uk@shopstyle.com", "benefits_and_rewards@racv.com.au", "lharmon@excentus.com", "kobrien@consumertrack.com", "mattm@maxbounty.com", "agencies@mapendo.me", "partners@uponly.media", "matthew.winstanley03@thehutgroup.com", "mkteam@linkprice.com", "a8-global@fancs.com", "hello@submissiontechnology.co.uk", "alan@nelo.co"];
  const TARGET = 50;

  const sleep = ms => page.waitForTimeout(ms);
  const alreadySet = new Set(ALREADY.map(n => n.toLowerCase()));
  const results = [];
  const errors = [];
  const seen = new Set();

  const ensureDiscover = async () => {
    const u = page.url();
    if (!u.includes('partner_discover') || u.includes('slideout_id=')) {
      await page.goto(DISCOVER_URL);
      await sleep(2500);
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
    await sleep(350);

    await page.mouse.move(10, 10);
    await sleep(100);
    await page.mouse.move(cardRect.x + cardRect.w / 2, cardRect.y + cardRect.h / 2, { steps: 8 });
    await sleep(600);

    const btnRect = await page.evaluate((i) => {
      const cards = Array.from(document.querySelectorAll('.iui-card'));
      const c = cards[i];
      if (!c) return null;
      const btn = Array.from(c.querySelectorAll('button')).find(b => /send proposal/i.test(b.innerText || ''));
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }, idx);
    if (!btnRect || btnRect.w === 0) return { error: 'no-send-btn' };

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
  await sleep(1200);

  let scrollPasses = 0;
  const MAX_SCROLL_PASSES = 16; // higher TARGET needs more scroll headroom

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
    await sleep(1800);
  }

  return {
    total: results.length,
    target: TARGET,
    sent: results,
    errors,
    seen_count: seen.size
  };
};
