/**
 * Rockbros US Outreach Runner v2
 * - Correct vault path (archived vault)
 * - Full data collection via slideout API after each send
 * - Complete ledger fields: name|email|date|programId|partnerId|status|size|website|contact|country|address|tags
 * - Per-publisher step log for supervisor monitoring
 * - partnerStatuses=2 ONLY
 */
import { chromium } from 'rebrowser-playwright';
import { ingestBatch } from '/Users/xiaozuo/claude-workflow-sync/skills/impact-rockbros-us-outreach/scripts/ingest-supabase.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CDP_PORT = 9306;
const VAULT    = `/Users/xiaozuo/Documents/Obsidian/01-Projects`;
const LEDGER   = path.join(VAULT, 'Impact-Rockbros-US-Outreach-Ledger.md');
const INTEL_DB = path.join(VAULT, 'Impact-Rockbros-US-Publisher-Intel.md');
const STEP_LOG = '/tmp/rockbros-step.log';
const RUN_LOG  = '/tmp/rockbros-runner.log';
const LOCK     = '/tmp/rockbros-runner.pid';
const TARGET   = parseInt(process.env.OUTREACH_COUNT || '5000');
const MSG      = 'Hi, this is Bob Zabel, reaching out from Rockbros, the NO.1 sports accessory you must see. We are offering 10-20% ultra-high commission with a limited-time deal offer. Reply here or email affiliate@celldigital.co to chat in detail and get a sample.';
const TODAY    = new Date().toISOString().slice(0, 10);
const PROGRAM_ID = 50132;

const TABS = [
  // partnerStatuses=2 (New publishers) — full coverage across all business models and sort orders
  { name:'Content-DESC',      hash:'#businessModels=CONTENT_REVIEWS&partnerStatuses=2&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC' },
  { name:'Content-ASC',       hash:'#businessModels=CONTENT_REVIEWS&partnerStatuses=2&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=ASC' },
  { name:'Content-Name-ASC',  hash:'#businessModels=CONTENT_REVIEWS&partnerStatuses=2&relationshipInclusions=prospecting&sortBy=name&sortOrder=ASC' },
  { name:'Content-Name-DESC', hash:'#businessModels=CONTENT_REVIEWS&partnerStatuses=2&relationshipInclusions=prospecting&sortBy=name&sortOrder=DESC' },
  { name:'Network-DESC',      hash:'#businessModels=NETWORK&partnerStatuses=2&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC' },
  { name:'Network-ASC',       hash:'#businessModels=NETWORK&partnerStatuses=2&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=ASC' },
  { name:'Deals-DESC',        hash:'#businessModels=DEAL_COUPON&partnerStatuses=2&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC' },
  { name:'Deals-ASC',         hash:'#businessModels=DEAL_COUPON&partnerStatuses=2&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=ASC' },
  { name:'Loyalty-DESC',      hash:'#businessModels=LOYALTY_REWARDS&partnerStatuses=2&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC' },
  { name:'Loyalty-ASC',       hash:'#businessModels=LOYALTY_REWARDS&partnerStatuses=2&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=ASC' },
  { name:'Email-DESC',        hash:'#businessModels=EMAIL_NEWSLETTER&partnerStatuses=2&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=DESC' },
  { name:'Email-ASC',         hash:'#businessModels=EMAIL_NEWSLETTER&partnerStatuses=2&relationshipInclusions=prospecting&sortBy=reachRating&sortOrder=ASC' },
];
const BASE_URL = 'https://app.impact.com/secure/advertiser/discover/radius/fr/partner_discover.ihtml?page=marketplace&slideout_id_type=partner';

function log(msg) {
  const line = `[${new Date().toISOString().slice(11,19)}] ${msg}`;
  console.log(line);
  fs.appendFileSync(RUN_LOG, line + '\n');
}

function step(name, s, r) {
  const line = `[${new Date().toISOString().slice(11,19)}] ${name.slice(0,30).padEnd(30)} | ${s.padEnd(12)} | ${r}`;
  fs.appendFileSync(STEP_LOG, line + '\n');
}

function ledgerCount() {
  try { return fs.readFileSync(LEDGER,'utf8').split('\n').filter(l=>l.includes('impact-50132')).length; }
  catch { return 0; }
}

function buildDedup() {
  try {
    const lines = fs.readFileSync(LEDGER,'utf8').split('\n').filter(l=>l.includes('impact-50132'));
    const ids = new Set();
    const names = new Set();
    for (const l of lines) {
      // partner_id is at fixed position: name|email|date|impact-XXXXX|partner_id
      // But name may contain |, so find 'impact-50132' then take next field
      const m = l.match(/impact-50132\|(\d+)/);
      if (m) ids.add(m[1]);
      // Also add email as fallback key
      const parts = l.split('|');
      if (parts[1]) names.add(parts[1].trim().toLowerCase());
    }
    return { ids, names };
  } catch { return { ids: new Set(), names: new Set() }; }
}

// ── DATA COLLECTION via Impact slideout API ───────────────────────────────────
async function fetchPublisherData(page, partnerId) {
  try {
    const data = await page.evaluate(async (pid) => {
      try {
        const r = await fetch(`/partner-ui/api/slideout?supplyPlatformProgramId=${pid}&supplyPlatformName=impact`, { credentials: 'include' });
        if (!r.ok) return null;
        return await r.json();
      } catch { return null; }
    }, partnerId);

    if (!data) return {};

    const prog = data.program || {};
    const contacts = (prog.contacts || []);
    const primary = contacts[0] || {};
    const addr = (prog.addresses || [])[0] || {};
    const categories = (prog.categories || []).map(c => c.name || c).filter(Boolean);
    const contentTags = (prog.attributes || []).filter(a => a.type === 'content_tag').map(a => a.value).filter(Boolean);
    const editorialTags = (prog.attributes || []).filter(a => a.type === 'editorial_tag' && !/^\d+$/.test(a.value)).map(a => a.value).filter(Boolean);
    const mediaProps = (prog.mediaProperties || []).map(m => m.url || m.website || m).filter(Boolean);
    const website = mediaProps[0] || (prog.links || []).find(l => l.type === 'website')?.url || '';

    return {
      contact_email: primary.email || '',
      contact_name: primary.name || '',
      contact_role: primary.role || '',
      size_rating: prog.sizeRating || '',
      marketplace_state: prog.marketplaceState || '',
      total_audience: prog.totalAudienceSize || '',
      website,
      media_properties: mediaProps,
      country: addr.country?.country2Code || '',
      corporate_address: addr.address || '',
      city: addr.city || '',
      state: addr.state || '',
      categories,
      content_tags: contentTags,
      editorial_tags: editorialTags,
      description: prog.description || prog.shortDescription || '',
      all_contacts: contacts.map(c => `${c.name||''} (${c.role||''}) ${c.email||''}`).filter(s=>s.trim()),
      languages: (prog.languages || []).map(l => l.name || l).filter(Boolean),
      promo_methods: (prog.promotionalMethods || []).map(m => m.name || m).filter(Boolean),
      program_type: prog.programType || '',
      psi: data.relationship?.psi || prog.psi || '',
      slideout_token: data.slideoutToken || '',
    };
  } catch { return {}; }
}

// ── LEDGER WRITE (all fields) ─────────────────────────────────────────────────
function writeLedger(pub) {
  const tags = [...(pub.content_tags||[]), ...(pub.editorial_tags||[])].slice(0,5).join(';');
  const esc = s => (s||'').replace(/\|/g, '／'); // replace | with fullwidth slash to avoid field split
  const row = [
    esc(pub.name),
    esc(pub.contact_email || ''),
    TODAY,
    `impact-${PROGRAM_ID}`,
    pub.partner_id,
    'sent',
    esc(pub.size_rating || ''),
    esc(pub.website || ''),
    esc(pub.contact_name || ''),
    pub.country || '',
    esc(pub.corporate_address || ''),
    esc(tags)
  ].join('|');
  fs.appendFileSync(LEDGER, row + '\n');
}

// ── PER-10 REPORT ─────────────────────────────────────────────────────────────
let sessionSentTotal = 0;
const per10Buffer = [];

function pstTime() {
  return new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour12: true,
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function reportEvery10(pub) {
  per10Buffer.push(pub);
  if (per10Buffer.length >= 10) {
    const total = ledgerCount();
    const withData = per10Buffer.filter(p => p.country).length;
    const pst = pstTime();
    const lines = [
      `\n${'═'.repeat(70)}`,
      `📊 BATCH REPORT | ${pst} PST | Total sent: ${total}/5000`,
      `   Data capture this batch: ${withData}/10 = ${withData*10}% ${withData>=8?'✅':'⚠️'}`,
      `${'─'.repeat(70)}`,
      ...per10Buffer.map((p, i) => [
        `${String(i+1).padStart(2)}. ${p.name} [ID:${p.partner_id}]`,
        `    📧 ${p.contact_email||'—'} | 👤 ${p.contact_name||'—'} (${p.contact_role||'—'})`,
        `    🌍 ${p.country||'—'} | 📏 ${p.size_rating||'—'} | 🔗 ${p.website||'—'}`,
        `    🏷  ${[...(p.content_tags||[]),...(p.editorial_tags||[])].slice(0,4).join(', ')||'—'}`,
        `    📍 ${p.corporate_address||'—'} | ${p.city||''} ${p.state||''} ${p.country||''}`,
        `    👥 ${(p.all_contacts||[]).slice(0,2).join(' | ')||'—'}`,
      ].join('\n')),
      `${'═'.repeat(70)}\n`,
    ].join('\n');
    log(lines);
    per10Buffer.length = 0;
  }
}

// ── INTEL DB WRITE ─────────────────────────────────────────────────────────────
function writeIntel(pub) {
  const tags = [...(pub.content_tags||[]), ...(pub.editorial_tags||[])].join(', ') || '—';
  const cats = (pub.categories||[]).join(', ') || '—';
  const contacts = (pub.all_contacts||[]).join(' | ') || '—';
  const promos = (pub.promo_methods||[]).join(', ') || '—';

  const entry = `
## ${pub.name} — ${TODAY}
- **Partner ID**: ${pub.partner_id} | **PSI**: ${pub.psi||''} | **Size**: ${pub.size_rating||'—'} | **State**: ${pub.marketplace_state||'—'}
- **Program Type**: ${pub.program_type||'—'}
- **Contact**: ${pub.contact_name||'—'} (${pub.contact_role||'—'}) · ${pub.contact_email||'—'}
- **All Contacts**: ${contacts}
- **Address**: ${pub.corporate_address||'—'} | ${pub.city||''}, ${pub.state||''} ${pub.country||'—'}
- **Website**: ${pub.website||'—'}
- **Description**: ${(pub.description||'').slice(0,200)}
- **Total Audience**: ${pub.total_audience||'—'}
- **Categories**: ${cats}
- **Tags**: ${tags}
- **Languages**: ${(pub.languages||[]).join(', ')||'—'}
- **Promo Methods**: ${promos}
- **Outreach**: ✅ Sent ${TODAY}
---
`;
  fs.appendFileSync(INTEL_DB, entry);
}

// ── CLOSE ANY OPEN MODAL ──────────────────────────────────────────────────────
async function closeModal(page) {
  try {
    await page.evaluate(() => {
      // Remove all modal/overlay blocking elements including camelCase class names
      const selectors = [
        '[data-testid="uicl-modal-screen"]',
        '[class*="modal-screen"]',
        '[class*="modalScreen"]',
        '.prospecting-send-proposal-modal',
        '[class*="prospecting-send-proposal"]',
        '[class*="iui-modal"]',
        'iframe[src*="send-proposal-new-partner-flow"]',
      ];
      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          const c = el.querySelector && el.querySelector('button[class*="close"],button[aria-label*="close" i]');
          if (c) c.click(); else el.remove();
        });
      });
      // Remove any fixed high-z-index overlay as catch-all
      Array.from(document.querySelectorAll('div')).filter(e => {
        const s = window.getComputedStyle(e);
        return e.offsetWidth > 400 && s.position === 'fixed' && parseInt(s.zIndex) > 1000;
      }).forEach(e => e.remove());
    });
    await page.keyboard.press('Escape').catch(()=>{});
    await page.waitForTimeout(300);
  } catch {}
}

// ── FRESH-TAB DATA COLLECTION ─────────────────────────────────────────────────
async function collectDataFreshTab(browser, tabHash, publisherName, parseSlideoutData) {
  let newPage = null;
  try {
    const ctx = browser.contexts()[0];
    newPage = await ctx.newPage();
    // Minimize visual impact: hide the tab by going to blank first
    await newPage.evaluate(() => { document.title = ''; }).catch(() => {});
    const captured = { data: null };

    const cdp2 = await ctx.newCDPSession(newPage);
    await cdp2.send('Network.enable');
    cdp2.on('Network.responseReceived', async evt => {
      if (captured.data) return; // already got it
      if ((evt.response.url.includes('/api/slideout') || evt.response.url.includes('/api/relationship/')) && !evt.response.url.includes('mediaproperties') && !evt.response.url.includes('activityLog') && !evt.response.url.includes('discover/listings') && evt.response.status === 200) {
        try {
          const body = await cdp2.send('Network.getResponseBody', { requestId: evt.requestId });
          let rawBody = body.body;
          if (rawBody.trimStart().startsWith('callback') || rawBody.match(/^\w+\(/)) {
            rawBody = rawBody.replace(/^\w+\(/, '').replace(/\);?\s*$/, '');
          }
          const d = JSON.parse(rawBody);
          if (d.program) captured.data = parseSlideoutData(d);
        } catch {}
      }
    });

    await newPage.goto(BASE_URL + tabHash, { waitUntil: 'domcontentloaded', timeout: 12000 });
    await newPage.waitForTimeout(1500);

    // Find and click the card
    const clicked = await newPage.evaluate(async (targetName) => {
      const cards = Array.from(document.querySelectorAll('.iui-card'));
      const card = cards.find(c => {
        const lines = (c.innerText || '').split('\n').map(l => l.trim()).filter(l => l.length > 2 && !/^new$/i.test(l));
        return lines[0]?.toLowerCase() === targetName.toLowerCase();
      });
      if (!card) return false;
      const img = card.querySelector('.image-container');
      const r = img ? img.getBoundingClientRect() : card.getBoundingClientRect();
      card.scrollIntoView({ block: 'center', behavior: 'instant' });
      return { x: r.x + r.width * 0.5, y: r.y + r.height * 0.8 };
    }, publisherName).catch(() => null);

    if (clicked && clicked.x) {
      await newPage.mouse.click(clicked.x, clicked.y);
      await newPage.waitForTimeout(2800);
    }

    return captured.data || null;
  } catch { return null; }
  finally { if (newPage) await newPage.close().catch(() => {}); }
}

// ── SEND MESSAGE (partnerStatuses=1 publishers) ───────────────────────────────
async function sendMessage(page, cardIdx, name) {
  // Hover to reveal Send Message button
  try { await page.locator('.iui-card').nth(cardIdx).hover({ timeout: 4000 }); }
  catch(e) { return { error: 'hover-failed' }; }
  await page.waitForTimeout(500);

  // Find Send Message button
  const btn = await page.evaluate((idx) => {
    const c = document.querySelectorAll('.iui-card')[idx];
    if (!c) return null;
    const b = Array.from(c.querySelectorAll('button')).find(b => /send message|message/i.test(b.innerText || ''));
    if (!b) return null;
    b.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = b.getBoundingClientRect();
    if (r.width === 0) return null;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, cardIdx);

  if (!btn) { return { error: 'no-message-btn' }; }

  await page.mouse.click(btn.x, btn.y);
  await page.waitForTimeout(3000);

  // Fill message in the modal textarea
  const filled = await page.evaluate((msg) => {
    const textarea = document.querySelector('textarea, [contenteditable="true"], .send-message-modal textarea');
    if (!textarea) return false;
    const ns = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set ||
               Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (ns) {
      ns.call(textarea, msg);
      textarea.dispatchEvent(new Event('input', {bubbles: true}));
      textarea.dispatchEvent(new Event('change', {bubbles: true}));
    } else {
      textarea.value = msg;
      textarea.dispatchEvent(new Event('input', {bubbles: true}));
    }
    return true;
  }, MSG);

  if (!filled) {
    await page.keyboard.type(MSG, {delay: 5});
  }

  await page.waitForTimeout(1000);

  // Click Send button
  const sent = await page.evaluate(() => {
    const sendBtn = Array.from(document.querySelectorAll('button')).find(b =>
      /^send$/i.test(b.textContent.trim()) || /submit|send message/i.test(b.textContent.trim())
    );
    if (sendBtn && !sendBtn.disabled) { sendBtn.click(); return true; }
    return false;
  });

  if (!sent) {
    await closeModal(page);
    return { error: 'send-btn-not-found' };
  }

  await page.waitForTimeout(2000);
  await closeModal(page);
  log(`  ✅ MSG-SENT "${name}"`);
  return { ok: true };
}

// ── SEND ONE PROPOSAL ─────────────────────────────────────────────────────────
async function sendOne(page, cardIdx, name) {
  await closeModal(page);

  // Hover to reveal button
  try { await page.locator('.iui-card').nth(cardIdx).hover({ timeout: 4000 }); }
  catch(e) { step(name, 'hover', 'err:'+e.message.slice(0,40)); return { error: 'hover-failed' }; }
  await page.waitForTimeout(500);

  // Get button BCR while hover active
  const btn = await page.evaluate((idx) => {
    const c = document.querySelectorAll('.iui-card')[idx];
    if (!c) return null;
    const b = Array.from(c.querySelectorAll('button')).find(b => /send proposal/i.test(b.innerText || ''));
    if (!b) return null;
    b.scrollIntoView({ block: 'center', behavior: 'instant' });
    const r = b.getBoundingClientRect();
    if (r.width === 0) return null;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, cardIdx);

  if (!btn) { step(name, 'btn', 'no-send-btn'); return { error: 'no-send-btn' }; }
  step(name, 'hover', 'ok');

  // Click Send Proposal
  await page.mouse.click(btn.x, btn.y);
  step(name, 'click', `(${Math.round(btn.x)},${Math.round(btn.y)})`);

  // Wait for proposal iframe
  try {
    await page.waitForFunction(() => {
      const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
      return f && f.offsetWidth > 200 && f.offsetHeight > 200;
    }, { timeout: 10000 });
  } catch {
    step(name, 'iframe', 'err:timeout — checking if Send Message modal');
    // Check if it's a "Send Message" modal (wrong publisher type)
    const isMsg = await page.evaluate(() => !!document.querySelector('.prospecting-send-proposal-modal'));
    await closeModal(page);
    return { error: isMsg ? 'send-message-modal' : 'no-iframe' };
  }
  // Wait for iframe content to fully render (term section loads async)
  await page.waitForTimeout(2500);
  // Verify the term button or form elements are present
  await page.waitForFunction(() => {
    const doc = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]')?.contentDocument;
    if (!doc) return false;
    return doc.querySelectorAll('button').length >= 3; // at least date + time + maybe term
  }, { timeout: 5000 }).catch(() => {});
  step(name, 'iframe', 'ok');

  // Extract partner_id and encrypted ID from iframe URL
  const meta = await page.evaluate(() => {
    const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
    try {
      const u = new URL(f.src);
      return {
        p: u.searchParams.get('p'),
        psi: u.searchParams.get('psi'),
        name: u.searchParams.get('name'),
        email: u.searchParams.get('email'),
        encId: u.searchParams.get('supplyPlatformProgramIdEncrypted') || ''
      };
    } catch { return null; }
  });
  if (!meta?.p) { step(name, 'meta', 'err:no-partner-id'); await page.keyboard.press('Escape'); return { error: 'no-partner-id' }; }
  step(name, 'meta', `p=${meta.p} email=${meta.email||'—'}`);

  // Set Start Date = tomorrow by directly injecting into the hidden input's JSON value
  const dateResult = await (async () => {
    const tomorrow = new Date(Date.now() + 86400000);
    const dateStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`;

    const injected = await page.evaluate((dStr) => {
      const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
      const doc = f?.contentDocument; const win = f?.contentWindow;
      if (!doc || !win) return { err: 'no-iframe' };
      const inp = doc.querySelector('input[name="startDateTime"]');
      if (!inp) return { err: 'no-startDateTime-input' };
      const raw = inp.value;
      const sep = '`~`';
      const sepIdx = raw.indexOf(sep);
      if (sepIdx < 0) return { err: 'no-separator' };
      const prefix = raw.slice(0, sepIdx + sep.length);
      let parsed;
      try { parsed = JSON.parse(raw.slice(sepIdx + sep.length)); } catch { return { err: 'json-parse' }; }
      parsed.startDate.date = dStr;
      const nativeSetter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(inp, prefix + JSON.stringify(parsed));
      inp.dispatchEvent(new win.Event('input', { bubbles: true }));
      inp.dispatchEvent(new win.Event('change', { bubbles: true }));
      return { ok: true, date: dStr };
    }, dateStr).catch(e => ({ err: e.message }));

    if (!injected?.ok) return `err:${injected?.err || 'unknown'}`;
    return `ok:${dateStr}`;
  })();

  step(name, 'date', dateResult.startsWith('ok') ? dateResult : `warn:${dateResult}`);

  // Select term — find "Select" dropdown button (not date/time fields), click, pick Public Term
  const termResult = await (async () => {
    // Step 1: find the term multi-select button (text="Select", not a date/time/ongoing field)
    const termCoords = await page.evaluate(() => {
      const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
      const doc = f?.contentDocument; const ifr = f?.getBoundingClientRect();
      if (!doc || !ifr) return null;
      const btn = Array.from(doc.querySelectorAll('button.iui-multi-select-input-button'))
        .filter(b => b.offsetWidth > 0)
        // exclude date/time/timezone buttons: digits, AM/PM, GMT, Beijing, UTC, ongoing
        .find(b => !/^\d|AM|PM|GMT|Ongoing|Beijing|UTC|London|Pacific|Mountain|Central|Eastern|\(GMT/i.test(b.innerText?.trim()));
      if (!btn) return null;
      btn.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = btn.getBoundingClientRect();
      return { x: Math.round(ifr.left + r.left + r.width/2), y: Math.round(ifr.top + r.top + r.height/2), txt: btn.innerText?.trim() };
    }).catch(() => null);

    if (!termCoords) {
      // Log what buttons ARE in the iframe for debugging
      const debugBtns = await page.evaluate(() => {
        const doc = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]')?.contentDocument;
        if (!doc) return 'no-doc';
        return Array.from(doc.querySelectorAll('button.iui-multi-select-input-button'))
          .map(b => `[w=${b.offsetWidth}] "${b.innerText?.trim().slice(0,20)}"`)
          .join(' | ') || 'none';
      }).catch(() => 'eval-err');
      step(name, 'term-debug', debugBtns.slice(0,100));
      // Check if term already selected (a chip/badge shows a term name)
      const hasChip = await page.evaluate(() => {
        const doc = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]')?.contentDocument;
        if (!doc) return false;
        return Array.from(doc.querySelectorAll('[class*="chip"],[class*="badge"],[class*="tag"]')).some(e => e.innerText?.trim().length > 0);
      }).catch(() => false);
      return hasChip ? 'ok:pre-selected' : 'no-term-btn';
    }

    // Step 2: click the dropdown to open it
    await page.mouse.click(termCoords.x, termCoords.y);
    await page.waitForTimeout(1200); // extra time for dropdown options to render

    // Step 3: find term option — check BOTH iframe contentDocument AND main page DOM (portal overlay)
    for (let i = 0; i < 3; i++) {
      const optCoords = await page.evaluate(() => {
        const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
        const ifr = f?.getBoundingClientRect();
        const ifrLeft = ifr?.left || 0; const ifrTop = ifr?.top || 0;

        // Search function: try a document context, return coords relative to viewport
        const findOpt = (doc, baseX, baseY) => {
          if (!doc) return null;
          const allOpts = Array.from(doc.querySelectorAll('li, [role="option"], [class*="option"], [class*="item"]'))
            .filter(l => l.offsetWidth > 0 && l.innerText?.trim().length > 2
              && !/^select$/i.test(l.innerText?.trim())  // exclude the button itself
              && !/^\d|AM|PM|GMT/i.test(l.innerText?.trim())); // exclude date/time fields
          const li = allOpts.find(l => /public.?term/i.test(l.innerText || ''))
            || allOpts.find(l => /performance/i.test(l.innerText || ''))
            || allOpts.find(l => /rockbros/i.test(l.innerText || ''))
            || allOpts[0];
          if (!li) return null;
          li.scrollIntoView({ block: 'nearest' });
          const r = li.getBoundingClientRect();
          return { x: Math.round(baseX + r.left + r.width/2), y: Math.round(baseY + r.top + r.height/2), text: li.innerText?.trim().slice(0,40) };
        };

        // Try iframe contentDocument first
        const inIframe = findOpt(f?.contentDocument, ifrLeft, ifrTop);
        if (inIframe) return inIframe;

        // Try main page DOM (portal/overlay rendered outside iframe)
        return findOpt(document, 0, 0);
      }).catch(() => null);

      if (optCoords) {
        await page.mouse.click(optCoords.x, optCoords.y);
        await page.waitForTimeout(500);
        return `ok:${optCoords.text}`;
      }
      await page.waitForTimeout(500);
    }
    return 'no-term-option';
  })();

  step(name, 'term', termResult.startsWith('ok') ? termResult : `warn:${termResult}`);

  // Fill message
  await page.evaluate((msg) => {
    const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
    const doc = f?.contentDocument; const win = f?.contentWindow;
    if (!doc || !win) return;
    const ta = doc.querySelector('textarea[name="comment"]');
    if (!ta) return;
    const s = Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, 'value').set;
    s.call(ta, msg);
    ta.dispatchEvent(new win.Event('input', { bubbles: true }));
    ta.dispatchEvent(new win.Event('change', { bubbles: true }));
  }, MSG);
  step(name, 'message', `ok:len=${MSG.length}`);

  // Submit — try enabled button first, then wait 1s and retry in case term selection was slow
  let subOk = false;
  for (let subAttempt = 0; subAttempt < 2; subAttempt++) {
    subOk = await page.evaluate(() => {
      const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
      const doc = f?.contentDocument;
      if (!doc) return false;
      // Prefer enabled button
      let btn = Array.from(doc.querySelectorAll('button')).find(b => /^send proposal$/i.test(b.innerText?.trim()) && !b.disabled);
      if (btn) { btn.scrollIntoView({ block: 'center' }); btn.click(); return true; }
      // If disabled, check if it's because term not selected vs other reason
      btn = Array.from(doc.querySelectorAll('button')).find(b => /^send proposal$/i.test(b.innerText?.trim()));
      if (btn?.disabled) return 'disabled';
      return false;
    }).catch(() => false);
    if (subOk === true) break;
    if (subOk === 'disabled' && subAttempt === 0) {
      // Wait a moment — term dropdown selection might be slow
      await page.waitForTimeout(800);
      continue;
    }
    break;
  }
  if (!subOk || subOk === 'disabled') {
    step(name, 'submit', `err:no-btn (term=${termResult})`);
    await page.keyboard.press('Escape');
    return { error: 'no-submit-btn' };
  }
  await page.waitForTimeout(2500);

  // I Understand
  const iuOk = await page.evaluate(() => {
    const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
    const btn = Array.from(f?.contentDocument?.querySelectorAll('button') || [])
      .find(b => /^i understand$/i.test(b.innerText?.trim()));
    if (!btn) return false;
    btn.scrollIntoView({ block: 'center' }); btn.click(); return true;
  });
  if (!iuOk) {
    const errs = await page.evaluate(() =>
      Array.from(document.querySelector('iframe[src*="send-proposal"]')?.contentDocument?.querySelectorAll('[class*=error]') || [])
        .map(e => e.innerText?.trim()).filter(Boolean)
    );
    step(name, 'i_understand', 'err:' + (errs[0]?.slice(0, 50) || 'no-btn'));
    await page.keyboard.press('Escape');
    return { error: 'no-i-understand', errors: errs };
  }
  await page.waitForTimeout(3000);
  step(name, 'i_understand', 'ok');

  // Verify success
  const result = await page.evaluate(() => {
    const f = document.querySelector('iframe[src*="send-proposal-new-partner-flow"]');
    if (!f || f.offsetWidth === 0) return 'iframe-closed';
    const doc = f.contentDocument;
    const hasIU = Array.from(doc?.querySelectorAll('button') || []).some(b => /^i understand$/i.test(b.innerText?.trim()));
    const hasSend = Array.from(doc?.querySelectorAll('button') || []).some(b => /^send proposal$/i.test(b.innerText?.trim()));
    if (hasSend && !hasIU) return 'form-reset';
    const errs = Array.from(doc?.querySelectorAll('[class*=error]') || []).map(e => e.innerText?.trim()).filter(Boolean);
    return errs.length ? 'errors:' + errs[0]?.slice(0, 50) : 'pending';
  });

  if (result === 'form-reset' || result === 'iframe-closed') {
    step(name, 'verify', `✅ ok:${result}`);
    return { ok: true, partner_id: meta.p, psi: meta.psi, contact_name: meta.name || '', contact_email: meta.email || '', encId: meta.encId || '' };
  }
  step(name, 'verify', `err:${result}`);
  await page.keyboard.press('Escape').catch(() => {});
  return { error: 'verify-failed', detail: result };
}

// ── PROCESS ONE TAB ───────────────────────────────────────────────────────────
async function processTab(page, browser, tabName, tabHash, dedup) {
  await closeModal(page);
  await page.unroute('**/api/slideout*').catch(() => {});

  // ── DATA COLLECTION HELPERS ───────────────────────────────────────────────
  const slideoutCache = new Map();
  const parseSlideoutData = (d) => {
    const prog = d.program || {};
    const contacts = prog.contacts || [];
    const addr = (prog.addresses || [])[0] || {};
    const contentTags = (prog.attributes || []).filter(a => a.type === 'content_tag').map(a => a.value);
    const editTags = (prog.attributes || []).filter(a => a.type === 'editorial_tag' && !/^\d+$/.test(a.value)).map(a => a.value);
    const website = (prog.mediaProperties || [])[0]?.url || (prog.links || []).find(l => l.type === 'website')?.url || '';
    return {
      sizeRating: prog.sizeRating || '', marketplaceState: prog.marketplaceState || '',
      totalAudienceSize: prog.totalAudienceSize || '', programType: prog.programType || '',
      psi: d.relationship?.psi || prog.psi || '',
      contact_name: contacts[0]?.name || '', contact_email: contacts[0]?.email || '',
      contact_role: contacts[0]?.role || '',
      all_contacts: contacts.map(c => `${c.name||''} (${c.role||''}) ${c.email||''}`).filter(s => s.trim()),
      country: addr.country?.country2Code || '', city: addr.city || '',
      state: addr.state || '', corporate_address: addr.address || '',
      website, description: (prog.description || prog.shortDescription || '').slice(0, 200),
      categories: (prog.categories || []).map(c => c.name || c),
      content_tags: contentTags, editorial_tags: editTags,
      languages: (prog.languages || []).map(l => l.name || l),
      promo_methods: (prog.promotionalMethods || []).map(m => m.name || m),
    };
  };

  // ── CDP NETWORK: capture slideout API responses ───────────────────────────
  let cdpClient = null;
  try {
    cdpClient = await page.context().newCDPSession(page);
    await cdpClient.send('Network.enable');
    cdpClient.on('Network.responseReceived', async evt => {
      const url = evt.response.url;
      if ((url.includes('/api/slideout') || url.includes('/api/relationship/')) && !url.includes('mediaproperties') && !url.includes('activityLog') && !url.includes('discover/listings') && evt.response.status === 200) {
        try {
          const body = await cdpClient.send('Network.getResponseBody', { requestId: evt.requestId });
          let rawBody = body.body;
          if (rawBody.trimStart().startsWith('callback') || rawBody.match(/^\w+\(/)) {
            rawBody = rawBody.replace(/^\w+\(/, '').replace(/\);?\s*$/, '');
          }
          const d = JSON.parse(rawBody);
          if (d.program) slideoutCache.set('__last__', parseSlideoutData(d));
        } catch {}
      }
    });
  } catch {}


  log(`TAB [${tabName}] loading...`);
  try {
    await page.goto(BASE_URL + tabHash, { waitUntil: 'domcontentloaded', timeout: 20000 });
  } catch(e) {

    log(`TAB [${tabName}] nav-err: ${e.message.slice(0, 60)}`);
    return { sent: 0, errors: 0 };
  }
  await page.waitForTimeout(2500);

  // Load more cards via scroll
  let prev = 0;
  for (let w = 0; w < 20; w++) {
    const n = await page.evaluate(async () => {
      const el = Array.from(document.querySelectorAll('*'))
        .filter(e => e.scrollHeight > e.clientHeight + 100 && e.offsetHeight > 200)
        .sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
      if (el) { el.scrollTop += 800; await new Promise(r => setTimeout(r, 600)); }
      return document.querySelectorAll('.iui-card').length;
    }).catch(() => 0);
    if (n > prev) prev = n; else if (w > 5) break;
    if (n >= 300) break;
  }
  // Scroll back to top
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('*'))
      .filter(e => e.scrollHeight > e.clientHeight + 100 && e.offsetHeight > 200)
      .sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
    if (el) el.scrollTop = 0;
  });
  await page.waitForTimeout(400);

  const total = await page.evaluate(() => document.querySelectorAll('.iui-card').length).catch(() => 0);
  log(`TAB [${tabName}] ${total} cards`);

  let sent = 0, errors = 0, emptyRun = 0;
  const seen = new Set();

  for (let idx = 0; idx < total; idx++) {
    if (ledgerCount() >= TARGET) return { sent, errors, done: true };

    // Get card name (skip generic "New" label)
    const name = await page.evaluate((i) => {
      const c = document.querySelectorAll('.iui-card')[i];
      const lines = (c?.innerText || '').split('\n').map(l => l.trim()).filter(l => l.length > 2 && !/^new$/i.test(l) && !/^\d+$/.test(l));
      return lines[0] || '';
    }, idx).catch(() => '');

    if (!name) continue;
    const nl = name.toLowerCase();
    if (dedup.names.has(nl) || seen.has(nl)) continue;
    seen.add(nl);

    // STEP A: Intercept fetch to capture slideout API data, then click card body
    slideoutCache.delete('__last__');
    let apiData = {};

    // Click card IMAGE area via BCR to trigger slideout API (navigate to publisher detail)
    const urlBefore = page.url();
    const clickCoords = await page.evaluate(async (i) => {
      const cards = document.querySelectorAll('.iui-card');
      const c = cards[i];
      if (!c) return null;
      // Scroll card so it appears in LOWER 70% of viewport (y ≥ 600 for reliable nav)
      const scrollEl = Array.from(document.querySelectorAll('*'))
        .filter(e => e.scrollHeight > e.clientHeight + 100 && e.offsetHeight > 200)
        .sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
      if (scrollEl) {
        const cr = c.getBoundingClientRect();
        const sr = scrollEl.getBoundingClientRect();
        // Scroll so card top is at 65% of viewport height
        const targetY = sr.top + sr.height * 0.65;
        scrollEl.scrollTop += (cr.top - targetY);
        await new Promise(r => setTimeout(r, 400));
      }
      const img = c.querySelector('.image-container');
      const r = img ? img.getBoundingClientRect() : c.getBoundingClientRect();
      if (r.height < 20 || r.y < 0 || r.y + r.height > window.innerHeight) return null;
      return { x: r.x + r.width * 0.5, y: r.y + r.height * 0.8 };
    }, idx).catch(() => null);

    if (clickCoords) {
      log(`  [body-click] "${name}" @ (${Math.round(clickCoords.x)},${Math.round(clickCoords.y)})`);
      await page.mouse.click(clickCoords.x, clickCoords.y);
      // Wait for first click panel to open fully
      await page.waitForTimeout(2000);
      // Check if URL changed; if not, close panel with Escape and click again
      const midUrl = page.url();
      if (!midUrl.includes('slideout_id=') && midUrl === urlBefore) {
        // Close the AJAX panel via button click (proper close) or Escape
        const closedPanel = await page.evaluate(() => {
          // Look for close button in the slideout panel
          const closeBtn = document.querySelector('[class*="slideout"] button[class*="close"], [class*="panel"] button[aria-label*="close" i], [class*="drawer"] .close-btn');
          if (closeBtn) { closeBtn.click(); return 'close-btn'; }
          // Try clicking outside the panel
          return 'none';
        }).catch(() => 'err');
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(500);
        // Force-remove any overlay blocking the card
        await page.evaluate(() => {
          Array.from(document.querySelectorAll('[class*="slideout"],[class*="panel"],[class*="drawer"],[class*="overlay"]'))
            .filter(e => {
              const z = parseInt(window.getComputedStyle(e).zIndex);
              return z > 100 && !e.querySelector('iframe[src*="send-proposal"]');
            })
            .forEach(e => { e.remove(); });
        }).catch(() => {});
        await page.waitForTimeout(1500); // give SPA time to update state after panel close
        log(`  [body-click2] "${name}" second click to force navigation`);
        // Use same coords (don't re-scroll, stay at same position)
        await page.mouse.click(clickCoords.x, clickCoords.y);
      }
    } else {
      // Fallback: dispatch synthetic click on image-container
      await page.evaluate(i => {
        const c = document.querySelectorAll('.iui-card')[i];
        const img = c?.querySelector('.image-container') || c;
        if (img) img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      }, idx).catch(() => {});
      log(`  [body-click] "${name}" via synthetic click`);
    }

    // Wait up to 3.5s for CDP to capture the slideout API response
    await page.waitForTimeout(3500);
    apiData = slideoutCache.get('__last__') || {};
    log(`  [cdp] "${name}" apiData: country=${apiData.country||'—'} size=${apiData.sizeRating||'—'}`);

    // Check if navigation occurred (slideout_id in URL means full panel opened)
    const urlAfter = page.url();
    if (urlAfter !== urlBefore || urlAfter.includes('slideout_id=')) {
      // Always try direct fetch if slideout_id is in URL (to verify auth works on this page)
      {
        let slideoutId;
        try { slideoutId = new URL(urlAfter).searchParams.get('slideout_id'); } catch {}
        // log(`  [direct-api-check] slideoutId=${slideoutId||'null'} url=${urlAfter.slice(0,120)}`);
        if (slideoutId) {
          const directD = await page.evaluate(async (sid) => {
            try {
              const r = await fetch(`/partner-ui/api/slideout?supplyPlatformProgramIdEncrypted=${encodeURIComponent(sid)}&supplyPlatformName=impact`, { credentials: 'include', headers: { Accept: 'application/json' } });
              return { status: r.status, ok: r.ok, body: r.ok ? await r.json() : null };
            } catch(e) { return { err: e.message }; }
          }, slideoutId).catch(() => null);
          // log(`  [direct-fetch-result] status=${directD?.status||'err'} ok=${directD?.ok}`);
          if (directD?.body?.program) {
            const prog = directD.body.program || {};
            const contacts = prog.contacts || [];
            const addr = (prog.addresses || [])[0] || {};
            const contentTags = (prog.attributes || []).filter(a => a.type === 'content_tag').map(a => a.value);
            const editTags = (prog.attributes || []).filter(a => a.type === 'editorial_tag' && !/^\d+$/.test(a.value)).map(a => a.value);
            const website = (prog.mediaProperties || [])[0]?.url || (prog.links || []).find(l => l.type === 'website')?.url || '';
            apiData = {
              sizeRating: prog.sizeRating || '', marketplaceState: prog.marketplaceState || '',
              totalAudienceSize: prog.totalAudienceSize || '', programType: prog.programType || '',
              psi: directD.body.relationship?.psi || prog.psi || '',
              contact_name: contacts[0]?.name || '', contact_email: contacts[0]?.email || '',
              contact_role: contacts[0]?.role || '',
              all_contacts: contacts.map(c => `${c.name||''} (${c.role||''}) ${c.email||''}`).filter(s => s.trim()),
              country: addr.country?.country2Code || '', city: addr.city || '',
              state: addr.state || '', corporate_address: addr.address || '',
              website, description: (prog.description || prog.shortDescription || '').slice(0, 200),
              categories: (prog.categories || []).map(c => c.name || c),
              content_tags: contentTags, editorial_tags: editTags,
              languages: (prog.languages || []).map(l => l.name || l),
              promo_methods: (prog.promotionalMethods || []).map(m => m.name || m),
            };
            log(`  [direct-api] "${name}" country=${apiData.country||'—'} size=${apiData.sizeRating||'—'}`);
          }
        }
      }

      log(`  [nav] URL changed after card click — navigating back`);
      try {
        await page.goto(BASE_URL + tabHash, { waitUntil: 'domcontentloaded', timeout: 15000 });
        // Wait for SPA to settle after navigation
        await page.waitForTimeout(3000);
      } catch {}
    } else {
      // No navigation — close any panel that opened
      await page.evaluate(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        Array.from(document.querySelectorAll('[class*="slideout"],[class*="panel"]'))
          .filter(e => parseInt(window.getComputedStyle(e).zIndex) > 100 && !e.querySelector('iframe[src*="send-proposal"]'))
          .forEach(e => e.remove());
      }).catch(() => {});
      await page.waitForTimeout(300);
    }

    // STEP B: Send proposal — find card by name, retry once if context-destroyed
    let r;
    for (let attempt = 0; attempt < 2; attempt++) {
      // If page navigated away (context destroyed from card-body-click), go back first
      const curUrl = page.url();
      if (curUrl.includes('slideout_id=') || !curUrl.includes('partner_discover')) {
        log(`  [nav-recovery] page URL wrong before sendOne, navigating back`);
        try {
          await page.goto(BASE_URL + tabHash, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await page.waitForTimeout(3000);
        } catch {}
      }
      const freshIdx = await page.evaluate(n => {
        const cards = Array.from(document.querySelectorAll('.iui-card'));
        return cards.findIndex(c => {
          const lines = (c.innerText || '').split('\n').map(l => l.trim()).filter(l => l.length > 2 && !/^new$/i.test(l));
          return lines[0]?.toLowerCase() === n.toLowerCase();
        });
      }, name).catch(() => -1);
      const useIdx = freshIdx >= 0 ? freshIdx : idx;
      try {
        // P1 tabs use Send Message flow; P2 tabs use Send Proposal flow
        const isP1Tab = tabName.startsWith('P1-');
        if (isP1Tab) {
          r = await sendMessage(page, useIdx, name);
        } else {
          r = await sendOne(page, useIdx, name);
        }
        break; // success
      } catch(e) {
        if (attempt === 0 && e.message.includes('context was destroyed')) {
          log(`  [sendOne-retry] "${name}" context-destroyed, waiting and retrying`);
          await page.waitForTimeout(2000);
          continue;
        }
        log(`  SKIP "${name}": ${e.message.slice(0, 80)}`);
        r = null; break;
      }
    }
    if (!r) continue;

    if (r.ok) {
      sent++; emptyRun = 0; dedup.names.add(nl);
      if (r.partner_id) dedup.ids.add(String(r.partner_id));

      // Get API data — prefer CDP capture (from card-body-click)
      apiData = slideoutCache.get('__last__') || {};
      if (!apiData.country && r.encId) {
        // Try direct fetch using the encrypted program ID from the proposal iframe URL
        const directData = await page.evaluate(async (encId) => {
          try {
            const resp = await fetch(`/partner-ui/api/slideout?supplyPlatformProgramIdEncrypted=${encId}&supplyPlatformName=impact`, {
              credentials: 'include', headers: { 'Accept': 'application/json' }
            });
            if (!resp.ok) return null;
            return await resp.json();
          } catch { return null; }
        }, r.encId).catch(() => null);
        if (directData?.program) {
          const prog = directData.program || {};
          const contacts = prog.contacts || [];
          const addr = (prog.addresses || [])[0] || {};
          const contentTags = (prog.attributes || []).filter(a => a.type === 'content_tag').map(a => a.value);
          const editTags = (prog.attributes || []).filter(a => a.type === 'editorial_tag' && !/^\d+$/.test(a.value)).map(a => a.value);
          const website = (prog.mediaProperties || [])[0]?.url || (prog.links || []).find(l => l.type === 'website')?.url || '';
          apiData = {
            sizeRating: prog.sizeRating || '', marketplaceState: prog.marketplaceState || '',
            totalAudienceSize: prog.totalAudienceSize || '', programType: prog.programType || '',
            psi: directData.relationship?.psi || prog.psi || '',
            contact_name: contacts[0]?.name || '', contact_email: contacts[0]?.email || '',
            contact_role: contacts[0]?.role || '',
            all_contacts: contacts.map(c => `${c.name||''} (${c.role||''}) ${c.email||''}`).filter(s => s.trim()),
            country: addr.country?.country2Code || '', city: addr.city || '',
            state: addr.state || '', corporate_address: addr.address || '',
            website, description: (prog.description || prog.shortDescription || '').slice(0, 200),
            categories: (prog.categories || []).map(c => c.name || c),
            content_tags: contentTags, editorial_tags: editTags,
            languages: (prog.languages || []).map(l => l.name || l),
            promo_methods: (prog.promotionalMethods || []).map(m => m.name || m),
          };
          log(`  [direct-api] "${name}" country=${apiData.country||'—'} size=${apiData.sizeRating||'—'}`);
        }
      }
      // Fresh-tab fallback: if still no country data, use a new tab for CDP capture
      if (!apiData.country) {
        log(`  [fresh-tab] "${name}" no CDP data, trying fresh tab...`);
        const freshData = await collectDataFreshTab(browser, tabHash, name, parseSlideoutData).catch(() => null);
        if (freshData?.country) {
          apiData = freshData;
          log(`  [fresh-tab] "${name}" country=${apiData.country} size=${apiData.sizeRating}`);
        }
      }

      // Merge API data with URL data from iframe
      const fullPub = {
        name,
        partner_id: r.partner_id,
        psi: apiData.psi || r.psi || '',
        contact_name: apiData.contact_name || r.contact_name || '',
        contact_email: apiData.contact_email || r.contact_email || '',
        contact_role: apiData.contact_role || '',
        size_rating: apiData.sizeRating || '',
        marketplace_state: apiData.marketplaceState || '',
        total_audience: apiData.totalAudienceSize || '',
        website: apiData.website || '',
        country: apiData.country || '',
        corporate_address: apiData.corporate_address || '',
        city: apiData.city || '',
        state: apiData.state || '',
        categories: apiData.categories || [],
        content_tags: apiData.content_tags || [],
        editorial_tags: apiData.editorial_tags || [],
        description: apiData.description || '',
        all_contacts: apiData.all_contacts || [],
        languages: apiData.languages || [],
        promo_methods: apiData.promo_methods || [],
        program_type: apiData.programType || '',
      };

      writeLedger(fullPub);
      writeIntel(fullPub);
      log(`  ✅ SENT "${name}" | p=${r.partner_id} | email=${fullPub.contact_email||'—'} | country=${fullPub.country||'—'} | size=${fullPub.size_rating||'—'}`);
      reportEvery10(fullPub);

      ingestBatch([{ ...fullPub, proposal_sent: true, scraped_at: new Date().toISOString(), outreach_msg: MSG }], 'CONTENT_REVIEWS', PROGRAM_ID)
        .catch(e => log(`  SUPABASE_WARN: ${e.message?.slice(0,60)}`));

    } else if (r.error === 'no-send-btn') {
      emptyRun++;
    } else {
      errors++; emptyRun = 0;
    }

    if (emptyRun >= 30) { log(`TAB [${tabName}] exhausted`); break; }
  }


  log(`TAB [${tabName}] DONE: sent=${sent} errors=${errors} apiCache=${slideoutCache.size}`);
  return { sent, errors };
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  try {
    const existingPid = parseInt(fs.readFileSync(LOCK, 'utf8').trim());
    if (existingPid && existingPid !== process.pid) {
      try { process.kill(existingPid, 0); log(`LOCK: runner ${existingPid} running`); process.exit(0); } catch {}
    }
  } catch {}
  fs.writeFileSync(LOCK, String(process.pid));
  process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch {} });

  fs.appendFileSync(STEP_LOG, `\n=== RUN ${new Date().toISOString()} TARGET=${TARGET} ===\n`);
  fs.appendFileSync(RUN_LOG, `\n=== RUN ${new Date().toISOString()} ===\n`);
  log(`Runner start: target=${TARGET} vault=${VAULT}`);

  let browser, page;
  for (let a = 0; a < 5; a++) {
    try {
      browser = await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`);
      const ctx = browser.contexts()[0];
      page = ctx.pages().find(p => p.url().includes('app.impact.com'));
      if (!page) page = await ctx.newPage();
      log(`Connected: ${await page.title()}`);
      break;
    } catch(e) {
      log(`Connect ${a+1} failed: ${e.message.slice(0, 60)}`);
      if (a < 4) await new Promise(r => setTimeout(r, 3000));
    }
  }
  if (!browser) { log('FATAL: no Chrome'); process.exit(1); }

  // ── COMPREHENSIVE IMPACT LOGIN ────────────────────────────────────────────
  // Handles: Cloudflare, impact.com homepage, app.impact.com login, Google OAuth, Rockbros account selector
  const { execSync: execSyncLogin } = await import('child_process');

  // Shared CF wait helper — polls up to maxSecs, throws if never clears
  async function waitForCFClear(maxSecs = 120) {
    const isCF = async () => {
      const t = await page.title().catch(() => '');
      return t.includes('moment') || t.includes('请稍候') || t.includes('Checking');
    };
    if (!(await isCF())) return; // already clear
    log(`CF challenge detected — waiting up to ${maxSecs}s (manual click if needed)...`);
    const steps = Math.ceil(maxSecs / 5);
    for (let i = 0; i < steps; i++) {
      await page.waitForTimeout(5000);
      if (!(await isCF())) { log(`CF cleared after ${(i+1)*5}s ✅`); return; }
      log(`  CF still active (${(i+1)*5}s)...`);
    }
    throw new Error(`CF_TIMEOUT: Cloudflare not cleared after ${maxSecs}s — needs manual checkbox click`);
  }

  async function performImpactLogin() {
    const curUrl = page.url();
    const curTitle = await page.title().catch(() => '');
    log(`Login check: ${curTitle.substring(0,50)} | ${curUrl.substring(0,60)}`);

    // Already logged in to marketplace
    if (curUrl.includes('secure/advertiser') && !curUrl.includes('login')) {
      log('Already logged in ✅');
      return true;
    }

    // STEP 1: Clear any CF challenge on current page (up to 120s)
    await waitForCFClear(120);

    // STEP 2: Navigate directly to app.impact.com login (most reliable path)
    log('Navigating to app.impact.com/login.user...');
    await page.goto('https://app.impact.com/login.user', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(()=>{});
    await page.waitForTimeout(3000);

    // STEP 2b: Clear any CF on login page
    await waitForCFClear(120);

    // STEP 3: Check what appeared — could be login form, Google, or already logged in
    const urlAfterNav = page.url();
    log('URL after nav:', urlAfterNav.substring(0,80));

    // If redirected straight to marketplace (cookie still valid)
    if (urlAfterNav.includes('secure/advertiser')) {
      log('Already logged in via cookie ✅');
      return true;
    }

    // STEP 4: Check if we need to fill the login form
    const loginTitleNow = await page.title().catch(() => '');
    const loginUrlNow = page.url();
    log('Current page:', loginTitleNow.substring(0,40), '|', loginUrlNow.substring(0,60));

    // Only fill login form if we're on the login page (not already on Google or secure pages)
    const urlCheck = page.url();
    if (urlCheck.includes('login.user') || urlCheck.includes('app.impact.com/login')) {
      await fillImpactDirectLogin();
    }

    // STEP 5: Handle Google OAuth if it appears
    await page.waitForTimeout(6000);
    const postLoginUrl = page.url();
    const postLoginTitle = await page.title().catch(()=>'');
    log('Post-submit URL:', postLoginUrl.substring(0,80));

    if (postLoginUrl.includes('accounts.google.com') || postLoginTitle.includes('Google')) {
      log('Google OAuth detected — handling Google auth flow...');
      try {
        // Wait for Google page to fully load
        await page.waitForTimeout(3000);
        let googleUrl = page.url();
        log('Google flow URL:', googleUrl.substring(0,100));

        // STEP A: Account Chooser — find and click affiliate@celldigital.co
        if (googleUrl.includes('accountchooser') || googleUrl.includes('AccountChooser') || googleUrl.includes('accounts.google.com')) {
          log('Google account chooser — selecting Cell Affiliate Team / affiliate@celldigital.co...');
          await page.waitForTimeout(3000);

          // Use locator approach — proven working
          let chosen = false;
          const allLis = await page.locator('li').all();
          for (const li of allLis) {
            const text = await li.textContent().catch(()=>'');
            if (text.includes('affiliate@celldigital.co')) {
              await li.click(); chosen = 'li'; break;
            }
          }
          if (!chosen) {
            // Try section elements
            const secs = await page.locator('section').all();
            for (const s of secs) {
              const text = await s.textContent().catch(()=>'');
              if (text.includes('affiliate@celldigital.co')) {
                await s.click(); chosen = 'section'; break;
              }
            }
          }
          log('Account choice result:', chosen);
          if (chosen) {
            await page.waitForTimeout(5000);
            googleUrl = page.url();
            log('URL after account choice:', googleUrl.substring(0,80));
          }
        }

        // STEP A2: OAuth consent / "signing back in" — click Continue (proven working via locator)
        googleUrl = page.url();
        if (googleUrl.includes('accounts.google.com')) {
          const allBtns = await page.locator('button').all();
          for (const btn of allBtns) {
            const text = await btn.textContent().catch(()=>'');
            if (/^continue$/i.test(text.trim())) {
              log('Clicking Continue on OAuth consent page...');
              await btn.click();
              await page.waitForTimeout(6000);
              googleUrl = page.url();
              log('URL after Continue:', googleUrl.substring(0,80));
              break;
            }
          }
        }

        // STEP B: Email identifier page
        if (googleUrl.includes('accounts.google.com') && !googleUrl.includes('accountchooser') && !googleUrl.includes('oauth')) {
          const hasEmailInput = await page.evaluate(() => !!document.querySelector('input[type="email"]'));
          if (hasEmailInput) {
            log('Google email input page...');
            execSyncLogin(`printf '%s' 'affiliate@celldigital.co' | pbcopy`);
            await page.click('input[type="email"]');
            await page.keyboard.press('Meta+A');
            await page.keyboard.press('Meta+V');
            await page.waitForTimeout(500);
            await page.click('#identifierNext', {timeout: 5000}).catch(async () => await page.keyboard.press('Enter'));
            await page.waitForTimeout(4000);
            googleUrl = page.url();
            log('Google email submitted, URL:', googleUrl.substring(0,80));
          }
        }

        // Fill Google password
        if (page.url().includes('google') || (await page.title()).includes('Google')) {
          await page.waitForSelector('input[type="password"]', {timeout: 8000});
          execSyncLogin(`printf '%s' 'Celldigital2024*' | pbcopy`);
          await page.click('input[type="password"]');
          await page.keyboard.press('Meta+A');
          await page.keyboard.press('Meta+V');
          await page.waitForTimeout(500);
          await page.click('#passwordNext, button:has-text("Next")', {timeout: 5000}).catch(async ()=> await page.keyboard.press('Enter'));
          await page.waitForTimeout(6000);
          log('Google password submitted, URL:', page.url().substring(0,80));
        }
      } catch(e) { log('Google auth err:', e.message.substring(0,60)); }
    }

    // STEP 6: Handle account selector (choose Rockbros)
    await page.waitForTimeout(3000);
    const acctUrl = page.url();
    if (acctUrl.includes('secure') || acctUrl.includes('select') || acctUrl.includes('choose')) {
      await chooseRockbrosAccount();
    }

    return await checkLoginSuccess();
  }

  async function fillImpactDirectLogin() {
    log('Filling Impact direct login form...');
    await page.waitForTimeout(2000);
    const hasForm = await page.evaluate(() => !!document.querySelector('#j_username, input[name="j_username"]'));
    if (!hasForm) { log('No login form found'); return; }

    // Use locator().fill() — most reliable method (proven working)
    try {
      await page.locator('#j_username').fill('affiliate@celldigital.co', {timeout: 5000});
      await page.locator('#j_password').fill('Celldigital2024*', {timeout: 5000});
      await page.click('button.submit_btn, button[type="submit"], button:has-text("Sign In")', {timeout: 5000});
      log('Login form submitted via locator');
    } catch(e) {
      // Fallback: clipboard paste
      log('Locator fill failed, trying clipboard:', e.message.substring(0,40));
      execSyncLogin(`printf '%s' 'affiliate@celldigital.co' | pbcopy`);
      await page.click('#j_username', {timeout: 3000}).catch(()=>{});
      await page.keyboard.press('Meta+A'); await page.keyboard.press('Meta+V');
      await page.waitForTimeout(300);
      execSyncLogin(`printf '%s' 'Celldigital2024*' | pbcopy`);
      await page.click('#j_password', {timeout: 3000}).catch(()=>{});
      await page.keyboard.press('Meta+A'); await page.keyboard.press('Meta+V');
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
    }
  }

  async function chooseRockbrosAccount() {
    log('Checking for account selector...');
    const hasSelector = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('[class*="account"], [class*="program"], [class*="brand"], li, .account-item'));
      const rockbros = items.find(i => /rockbros/i.test(i.textContent));
      if (rockbros) { rockbros.click(); return true; }
      // Try any click on Rockbros text
      const all = Array.from(document.querySelectorAll('*'));
      const rb = all.find(e => /rockbros/i.test(e.textContent?.trim()) && e.textContent.trim().length < 50 && e.offsetWidth > 0);
      if (rb) { rb.click(); return 'text-match'; }
      return false;
    });
    if (hasSelector) {
      log('Rockbros account selected:', hasSelector);
      await page.waitForTimeout(4000);
    }
  }

  async function checkLoginSuccess() {
    try {
      await page.waitForTimeout(3000);
      const url = page.url();
      const title = await page.title().catch(()=>'');
      const success = url.includes('secure/advertiser') || url.includes('Marketplace') || url.includes('Dashboard');
      log(`Login ${success ? '✅ SUCCESS' : '❌ FAILED'}: ${title.substring(0,40)} | ${url.substring(0,60)}`);
      return success;
    } catch(e) { log('checkLoginSuccess err:', e.message?.slice(0,50)); return false; }
  }

  // Run login if needed
  try {
    const curUrlCheck = page.url();
    const curTitleCheck = await page.title().catch(()=>'');
    const needsLogin = !curUrlCheck.includes('secure/advertiser') ||
      curTitleCheck.includes('moment') || curTitleCheck.includes('Login') ||
      curTitleCheck.includes('请稍候');
    if (needsLogin) {
      await performImpactLogin().catch(e => log(`Login attempt err: ${e.message?.slice(0,60)}`));
      await page.waitForTimeout(2000);
      log(`After login: ${await page.title().catch(()=>'?')}`);
    }
  } catch(e) { log(`Login check err: ${e.message?.slice(0,60)}`); }

  const dedup = buildDedup();
  log(`Dedup: ${dedup.ids.size} already sent | ledger=${ledgerCount()}`);

  let round = 0;
  while (ledgerCount() < TARGET) {
    round++;
    const need = TARGET - ledgerCount();
    log(`\n=== ROUND ${round} | ledger=${ledgerCount()} | need=${need} ===`);
    let roundSent = 0;
    for (const tab of TABS) {
      if (ledgerCount() >= TARGET) break;
      const r = await processTab(page, browser, tab.name, tab.hash, dedup);
      roundSent += (r.sent || 0);
      if (r.done) break;
    }
    log(`ROUND ${round} sent=${roundSent} total=${ledgerCount()}`);
    if (roundSent === 0) { log('WARNING: 0 sent this round. Pool exhausted.'); break; }
  }

  log(`Done. Ledger: ${ledgerCount()}`);
  await browser.close().catch(() => {});
}

main().catch(e => { log('FATAL: ' + e.message); process.exit(1); });
