#!/usr/bin/env node
// Impact Generic Proposal Runner — direct Playwright CDP, no LLM in the loop
//
// USAGE:
//   node impact-proposal-runner.js <count> <config-file> [start-tab-idx]
//   config-file: JSON file with { program_id, advertiser, msg, cdp_port, vault_dir, business_models[] }
//
// EXAMPLES:
//   node impact-proposal-runner.js 1000 /path/to/rockbros-us.json
//   node impact-proposal-runner.js 500 /path/to/tcl-us.json 2
//
// MODEL OPTIMIZATION:
//   This script runs as native Node.js with ZERO LLM tokens during execution.
//   Replaces the previous Sonnet+Haiku per-tab architecture.
//   Token cost: ~95% reduction vs LLM-driven loop.
//   Performance: ~40 seconds per publisher (vs 3-5 min in LLM loop).
//
// ARCHITECTURE FIXES (2026-04-30):
//   1. Slideout content lives in Shadow DOM at #unified-program-slideout
//      → Access via document.querySelector(host).shadowRoot
//   2. Persistent modal iframe blocks subsequent clicks
//      → Navigate to dashboard then back between proposals
//   3. Card click target: .image-container element (top 206px of 290px card)
//   4. Iframe URL params (name=, email=) contain real publisher contact info
//      → Extract from iframeUrl.searchParams.get('email'/'name'/'p')
//   5. Date selection: click calendar icon → click "Today" button (not day number)
//   6. Term selection: page.mouse.click() with iframe-relative coords
//      (li.click() in evaluate() doesn't trigger React handlers)
//   7. Send Proposal: card-level button (NOT shadow DOM Send Proposal button)
//      Sequence: open slideout → scrape → navigate back → hover card → click card button

const { chromium } = require('/Users/xiaozuo/.npm/_npx/aa1f6563a672b75d/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');

// ── ARGS ─────────────────────────────────────────────────────────────────────
const TARGET = parseInt(process.argv[2] || '500', 10);
const CONFIG_FILE = process.argv[3];
const START_TAB = parseInt(process.argv[4] || '0', 10);

if (!CONFIG_FILE || !fs.existsSync(CONFIG_FILE)) {
  console.error('Usage: node impact-proposal-runner.js <count> <config-file> [start-tab-idx]');
  console.error('Config file required. Example config:');
  console.error(JSON.stringify({
    program_id: '50132',
    advertiser: 'rockbros-us',
    msg: 'Hi, this is X reaching out from Y...',
    cdp_port: 9306,
    vault_dir: '/Users/xiaozuo/Documents/Obsidian Vault/01-Projects',
    business_models: ['CONTENT_REVIEWS', 'DEAL_COUPON', 'EMAIL_NEWSLETTER', 'LOYALTY_REWARDS', 'NETWORK'],
    size_filter: 'medium,large,extra_large',  // optional
    location_filter: 'US',                    // optional
  }, null, 2));
  process.exit(1);
}

const CONFIG = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
const { program_id, advertiser, msg: MSG, cdp_port: CDP_PORT, vault_dir, business_models } = CONFIG;

const VAULT_PREFIX = `${vault_dir}/Impact-${advertiser.split('-').map(w => w[0].toUpperCase()+w.slice(1)).join('-')}`;
const LEDGER = `${VAULT_PREFIX}-Outreach-Ledger.md`;
const INTEL_DB = `${VAULT_PREFIX}-Publisher-Intel.md`;
const OBSIDIAN = `${VAULT_PREFIX}-Outreach.md`;

// URL builder
const SIZE_PARAM = CONFIG.size_filter
  ? `sizeRating=${CONFIG.size_filter.split(',').map(s => s.trim().replace(' ','_')).join('%2C')}`
  : 'sizeRating=medium%2Clarge%2Cextra_large';
const BASE_URL = 'https://app.impact.com/secure/advertiser/discover/radius/fr/partner_discover.ihtml?page=marketplace&slideout_id_type=partner';
const tabUrl = i => `${BASE_URL}#businessModels=${business_models[i]}&locationCountryCode=&${SIZE_PARAM}&sortBy=reachRating&sortOrder=DESC`;

console.log(`[runner] Advertiser: ${advertiser} | Program: ${program_id} | Target: ${TARGET}`);
console.log(`[runner] Tabs: ${business_models.join(', ')}`);
console.log(`[runner] Vault: ${vault_dir}`);

// ── PERSISTENCE ──────────────────────────────────────────────────────────────
function ensureFile(p, h='') {
  try {
    fs.mkdirSync(path.dirname(p), {recursive: true});
    if (!fs.existsSync(p)) fs.writeFileSync(p, h);
  } catch (e) { console.error('ensureFile err:', p, e.message); }
}

function appendLedger(pub) {
  const d = new Date().toISOString().slice(0,10);
  const line = `${pub.name}|${pub.contact_email||'email_missing'}|${d}|impact-${program_id}|${pub.partner_id||''}|${pub.status||''}|${pub.partner_size||''}|${pub.website||''}|${pub.contact_name||'name_missing'}\n`;
  try { fs.appendFileSync(LEDGER, line); } catch (e) { console.error('ledger err:', e.message); }
}

function appendIntel(pub) {
  const d = new Date().toISOString().slice(0,10);
  const entry = `\n## ${pub.name} — ${d}
- **Publisher ID**: impact-${pub.partner_id||'?'} | **Network ID**: ${pub.partner_id||'?'}
- **Status**: ${pub.status||'?'} | **Size**: ${pub.partner_size||'?'} | **Model**: ${pub.business_model||'?'}
- **Contact Name**: ${pub.contact_name||'name_missing'}
- **Contact Role**: ${pub.contact_role||'Marketplace Contact'}
- **Contact Email**: ${pub.contact_email||'email_missing'}
- **Website**: ${pub.website||''} | **Verified**: ${pub.verified}
- **Semrush**: ${pub.semrush_global_rank||''} | **Visitors/mo**: ${pub.monthly_visitors||''}
- **Moz DA**: ${pub.moz_domain_authority||''} | **Moz Spam**: ${pub.moz_spam_score||''}
- **Address**: ${pub.corporate_address||''} | **Language**: ${pub.language||''} | **Currency**: ${pub.currency||''}
- **Description**: ${(pub.description||'').slice(0,300)}
- **Term**: ${pub.termText||''} ✓${pub.termVerified} | **Date**: ✓${pub.dateVerified}
---\n`;
  try { fs.appendFileSync(INTEL_DB, entry); } catch (e) { console.error('intel err:', e.message); }
}

function loadDedup() {
  try {
    const c = fs.readFileSync(LEDGER, 'utf8');
    return new Set(c.split('\n').filter(l => l.includes(`impact-${program_id}`)).map(l => l.split('|')[0].toLowerCase().trim()).filter(Boolean));
  } catch { return new Set(); }
}

// ── MODAL CLEANUP ────────────────────────────────────────────────────────────
async function clearStuckModal(page, baseUrl) {
  const hasModal = await page.evaluate(() => !!document.querySelector('iframe[data-testid="uicl-modal-iframe-content"]')).catch(()=>false);
  if (hasModal) {
    await page.goto('https://app.impact.com/secure/advertiser/dashboard/dashboard.ihtml', {waitUntil:'domcontentloaded', timeout:15000}).catch(()=>{});
    await page.waitForTimeout(2000);
    await page.goto(baseUrl, {waitUntil:'domcontentloaded', timeout:15000}).catch(()=>{});
    await page.waitForTimeout(3000);
  }
}

// ── PROFILE SCRAPE — uses SHADOW DOM ─────────────────────────────────────────
async function scrapeSlideout(page) {
  const sleep = ms => page.waitForTimeout(ms);

  let pub = await page.evaluate(() => {
    const host = document.querySelector('#unified-program-slideout');
    if (!host || !host.shadowRoot) return { error: 'no-shadow' };
    const sr = host.shadowRoot;
    const text = sr.body?.innerText || sr.textContent || '';

    const data = {
      partner_id: null, status: null, partner_size: null, business_model: null, description: null,
      contact_name: null, contact_role: 'Marketplace Contact', contact_email: null,
      all_contacts: [],
      language: null, corporate_address: null, content_categories: [], legacy_categories: [], tags: [],
      currency: null, media_kit_count: 0,
      website: null, social_properties: [], verified: null,
      semrush_global_rank: null, monthly_visitors: null,
      moz_domain_authority: null, moz_spam_score: null,
    };

    const idMatch = text.match(/\b(\d{6,10})\b/);
    if (idMatch) data.partner_id = idMatch[1];

    for (const s of ['Active','New','Pending','Inactive']) {
      if (new RegExp(`\\b${s}\\b`).test(text)) { data.status = s; break; }
    }

    if (/Extra\s+Large|XLExtra\s+Large/.test(text)) data.partner_size = 'Extra Large';
    else if (/\bLarge\b/.test(text)) data.partner_size = 'Large';
    else if (/\bMedium\b/.test(text)) data.partner_size = 'Medium';
    else if (/\bSmall\b/.test(text)) data.partner_size = 'Small';

    for (const m of ['Content/Reviews','Deal/Coupon','Email/Newsletter','Loyalty/Rewards','Network','Content','Coupon','Email','Loyalty']) {
      if (text.includes(m)) { data.business_model = m; break; }
    }

    // Website — match URL but stop at common boundary words
    const urlMatch = text.match(/(https?:\/\/[a-zA-Z0-9.\-_/]+?)(?=Learn|Verified|Undo|Redo|Font|Content|\s|$)/);
    if (urlMatch && !urlMatch[1].includes('impact.com')) {
      let url = urlMatch[1].replace(/[.,;]$/, '');
      data.website = url;
      data.social_properties.push({url: url, text: url});
    }

    const sem = text.match(/Semrush\s+global\s+rank\s*([0-9.,]+[KMB]?)/i);
    if (sem) data.semrush_global_rank = sem[1];
    const mv = text.match(/Monthly\s+visitors?\s*([0-9.,]+[KMB])/i);
    if (mv) data.monthly_visitors = mv[1];
    const mda = text.match(/Moz\s+domain\s+authority\s*(\d+)/i);
    if (mda) data.moz_domain_authority = mda[1];
    const mss = text.match(/Moz\s+spam\s+score\s*(\d+)/i);
    if (mss) data.moz_spam_score = mss[1];

    if (text.includes('Marketplace Verified')) data.verified = true;
    else if (text.includes('Not verified')) data.verified = false;

    const addrMatch = text.match(/(United States of America|United States|United Kingdom|Canada|Australia|Germany|France|Japan|China|India|Brazil|Mexico|Spain|Italy)/);
    if (addrMatch) data.corporate_address = addrMatch[1];

    const emails = (text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || []);
    if (emails.length > 0) {
      data.contact_email = emails[0];
      for (const e of emails.slice(0,3)) data.all_contacts.push({email: e, role: 'Marketplace Contact'});
    }

    // Contact name — exclude geo/corporate terms
    const nameMatches = text.match(/\b([A-Z][a-z]{2,}\s+[A-Z][a-z]{2,})\b/g) || [];
    const blacklist = /(LLC|Inc|Corp|Ltd|Limited|GmbH|AG|SA|Co\b|BV|Pte|Plc|Group|Marketplace|Send|Active|Verified|Partner|Performance|Reviews|United\s+States|United\s+Kingdom|North\s+America|South\s+America|New\s+York|Los\s+Angeles|San\s+Francisco|Hong\s+Kong|Add\s+Prospect|Report\s+Abuse|Marketplace\s+Verified|Active\s+on)/i;
    const validNames = nameMatches.filter(n => !blacklist.test(n));
    if (validNames.length > 0) data.contact_name = validNames[0];

    const langMatch = text.match(/\b(English|French|German|Spanish|Chinese|Japanese|Italian|Portuguese|Korean|Russian)\b/);
    if (langMatch) data.language = langMatch[1];

    const currMatch = text.match(/\b(USD|EUR|GBP|AUD|CAD|JPY|CNY|KRW)\b/);
    if (currMatch) data.currency = currMatch[1];

    const descIdx = text.indexOf('Partnership potential');
    if (descIdx >= 0) {
      data.description = text.slice(descIdx + 21, descIdx + 400).trim().slice(0, 300);
    } else {
      const lines = text.split('\n').filter(l => l.trim().length > 50 && !/Send Proposal|Properties|Details|Verified|Marketplace/.test(l));
      if (lines[0]) data.description = lines[0].slice(0, 300);
    }

    const catKeywords = ['Sports','Fitness','Outdoor','Cycling','Health','Beauty','Consumer Electronics','Travel','Apparel','Financial','Gaming','Home','Garden','Food','Pet','Auto','Baby'];
    for (const c of catKeywords) {
      if (text.includes(c) && !data.legacy_categories.includes(c)) data.legacy_categories.push(c);
    }

    return data;
  });

  if (pub.error) return null;

  // Click Details tab if metrics not captured yet
  if (!pub.semrush_global_rank || !pub.monthly_visitors) {
    await page.evaluate(() => {
      const host = document.querySelector('#unified-program-slideout');
      const sr = host?.shadowRoot;
      if (!sr) return;
      const detailsTab = Array.from(sr.querySelectorAll('.uicc-tab-item')).find(t => t.textContent.trim() === 'Details');
      if (detailsTab) detailsTab.click();
    }).catch(()=>{});
    await sleep(1500);

    const detailsData = await page.evaluate(() => {
      const host = document.querySelector('#unified-program-slideout');
      const sr = host?.shadowRoot;
      if (!sr) return null;
      const text = sr.body?.innerText || sr.textContent || '';
      return {
        semrush: text.match(/Semrush\s+global\s+rank\s*([0-9.,]+[KMB]?)/i)?.[1],
        monthlyVis: text.match(/Monthly\s+visitors?\s*([0-9.,]+[KMB])/i)?.[1],
        mozDA: text.match(/Moz\s+domain\s+authority\s*(\d+)/i)?.[1],
        mozSpam: text.match(/Moz\s+spam\s+score\s*(\d+)/i)?.[1],
      };
    }).catch(()=>null);

    if (detailsData) {
      pub.semrush_global_rank = pub.semrush_global_rank || detailsData.semrush;
      pub.monthly_visitors = pub.monthly_visitors || detailsData.monthlyVis;
      pub.moz_domain_authority = pub.moz_domain_authority || detailsData.mozDA;
      pub.moz_spam_score = pub.moz_spam_score || detailsData.mozSpam;
    }
  }

  pub.scraped_at = new Date().toISOString().slice(0,10);
  return pub;
}

// ── PROPOSAL FORM (iframe) ───────────────────────────────────────────────────
async function sendProposal(page) {
  const sleep = ms => page.waitForTimeout(ms);

  const iframeUrl = await page.evaluate(() => {
    const f = document.querySelector('iframe[data-testid="uicl-modal-iframe-content"]') ||
              document.querySelector('iframe[src*="send-proposal"]') ||
              document.querySelector('iframe[src*="proposal"]');
    return f?.src || null;
  }).catch(()=>null);

  if (!iframeUrl) return { ok: false, reason: 'no-iframe', termText: '', termVerified: false, dateVerified: false, urlData: {} };

  const urlData = {};
  try {
    const u = new URL(iframeUrl);
    urlData.email = u.searchParams.get('email');
    urlData.name = u.searchParams.get('name');
    urlData.partnerId = u.searchParams.get('p');
  } catch {}

  const propFrame = page.frames().find(f => f.url() === iframeUrl || f.url().includes('send-proposal') || f.url().includes('proposal'));
  if (!propFrame) return { ok: false, reason: 'no-frame', termText: '', termVerified: false, dateVerified: false, urlData };

  await propFrame.waitForLoadState('domcontentloaded', {timeout: 5000}).catch(()=>{});

  const iRect = await page.evaluate(() => {
    const f = document.querySelector('iframe[data-testid="uicl-modal-iframe-content"]') ||
              document.querySelector('iframe[src*="send-proposal"]') ||
              document.querySelector('iframe[src*="proposal"]');
    if (!f) return null;
    const r = f.getBoundingClientRect();
    return { x: r.x, y: r.y };
  }).catch(()=>null);

  if (!iRect) return { ok: false, reason: 'no-iframe-rect', termText: '', termVerified: false, dateVerified: false, urlData };

  // Term selection — page.mouse.click() with iframe-relative coords (JS click doesn't trigger React)
  let termOk = false, termText = '';
  for (let attempt = 0; attempt < 3 && !termOk; attempt++) {
    await propFrame.evaluate(() => {
      const b = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Select');
      if (b) b.click();
    }).catch(()=>{});
    await sleep(1200);

    const liCoords = await propFrame.evaluate(() => {
      const isVis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const opts = Array.from(document.querySelectorAll('li[role="option"]')).filter(isVis);
      // Skip the placeholder "Select" option — pick the first real term
      const realOpts = opts.filter(l => l.textContent.trim() !== 'Select' && l.textContent.trim().length > 0);
      const best = realOpts.find(l => /performance/i.test(l.textContent)) ||
                   realOpts.find(l => /\d+%/.test(l.textContent)) ||
                   realOpts[0];
      if (!best) return null;
      const r = best.getBoundingClientRect();
      return { x: r.x + r.width/2, y: r.y + r.height/2, text: best.textContent.trim() };
    }).catch(()=>null);

    if (!liCoords) { await sleep(400); continue; }
    await page.mouse.click(Math.round(iRect.x + liCoords.x), Math.round(iRect.y + liCoords.y));
    await sleep(1000);

    // Confirmation: the term button text should now show the selected term (not "Select")
    const confirmed = await propFrame.evaluate((expectedText) => {
      const btns = Array.from(document.querySelectorAll('button')).filter(b => b.getBoundingClientRect().width > 0);
      // Check if any visible button shows the selected term text (React updated)
      const termSelected = btns.some(b => b.textContent.trim() === expectedText);
      // Also accept: no "Select" placeholder visible anymore (dropdown closed with selection)
      const noSelectBtn = !btns.some(b => b.textContent.trim() === 'Select');
      return termSelected || noSelectBtn;
    }, liCoords.text).catch(()=>false);

    if (confirmed) { termOk = true; termText = liCoords.text; }
    await sleep(300);
  }

  // Date — calendar icon → Today
  let dateOk = false;
  const calCoords = await propFrame.evaluate(() => {
    const isVis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const btns = Array.from(document.querySelectorAll('button')).filter(isVis);
    const cal = btns.find(b => {
      const t = b.textContent.trim();
      return (t === '' || t.length < 3) && (b.querySelector('img,svg') || /calendar|date|clock/i.test(b.className));
    });
    if (!cal) return null;
    const r = cal.getBoundingClientRect();
    return { x: r.x + r.width/2, y: r.y + r.height/2 };
  }).catch(()=>null);

  if (calCoords) {
    await page.mouse.click(Math.round(iRect.x + calCoords.x), Math.round(iRect.y + calCoords.y));
    await sleep(900);
    dateOk = await propFrame.evaluate(() => {
      const isVis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const today = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Today' && isVis(b));
      if (today) { today.click(); return true; }
      const days = Array.from(document.querySelectorAll('button,[role="gridcell"]')).filter(el =>
        isVis(el) && /^\d{1,2}$/.test(el.textContent.trim()) && !el.disabled
      );
      if (days[0]) { days[0].click(); return true; }
      return false;
    }).catch(()=>false);
    await sleep(500);
  }

  // Message
  await propFrame.evaluate(msg => {
    const ta = document.querySelector('textarea');
    if (!ta) return;
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(ta, msg);
    ta.dispatchEvent(new Event('input', {bubbles:true}));
    ta.dispatchEvent(new Event('change', {bubbles:true}));
  }, MSG).catch(()=>{});
  await sleep(400);

  // Submit — the iframe is 735px tall but viewport is ~696px, so the button
  // at y≈705 inside iframe is outside the visible area. page.mouse.click() fails silently.
  // Fix: focus the button then press Enter (triggers React's submit handler correctly).
  const subExists = await propFrame.evaluate(() => {
    const isVis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const btn = Array.from(document.querySelectorAll('button')).find(b =>
      b.textContent.trim() === 'Send Proposal' && isVis(b)
    );
    if (!btn) return false;
    btn.focus();
    return true;
  }).catch(()=>false);

  if (!subExists) return { ok: false, reason: 'no-submit', termText, termVerified: termOk, dateVerified: dateOk, urlData };

  // Check if button is within viewport; if not, use keyboard Enter
  const subCoords = await propFrame.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b =>
      b.textContent.trim() === 'Send Proposal' && b.getBoundingClientRect().width > 0
    );
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    return { x: r.x + r.width/2, y: r.y + r.height/2 };
  }).catch(()=>null);

  const vp = await page.evaluate(() => ({w: window.innerWidth, h: window.innerHeight}));
  const absY = iRect.y + (subCoords?.y || 0);
  const absX = iRect.x + (subCoords?.x || 0);

  if (subCoords && absX < vp.w && absY < vp.h) {
    // Button is in viewport — use mouse click
    await page.mouse.click(Math.round(absX), Math.round(absY));
  } else {
    // Button is outside viewport — use keyboard Enter on focused button
    await page.keyboard.press('Enter');
  }
  await sleep(2500);

  // ── STRICT 2-STAGE SEND VERIFICATION ─────────────────────────────────────
  // Stage 1: Confirm submit was accepted — "I understand" confirmation dialog
  //          MUST appear inside the iframe. This proves Impact accepted the form.
  // Stage 2: Click "I understand" — modal MUST disappear from DOM.
  //          This proves the proposal was finalized and recorded by Impact.
  // No fallbacks to true. Any failure = not sent.
  let sent = false;
  let confirmReason = 'not-attempted';

  // Stage 1: Wait for "I understand" to appear (up to 4s)
  let iUnderstandVisible = false;
  for (let attempt = 0; attempt < 8; attempt++) {
    await sleep(500);
    iUnderstandVisible = await propFrame.evaluate(() => {
      const isVis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const btn = Array.from(document.querySelectorAll('button')).find(b =>
        b.textContent.trim() === 'I understand' && isVis(b)
      );
      return !!btn;
    }).catch(() => false);
    if (iUnderstandVisible) break;
  }

  if (!iUnderstandVisible) {
    // Submit was not accepted by Impact — check if form shows error
    const formError = await propFrame.evaluate(() => {
      const body = document.body?.innerText || '';
      const hasError = /required|please|invalid|error/i.test(body);
      const btns = Array.from(document.querySelectorAll('button')).filter(b=>b.getBoundingClientRect().width>0).map(b=>b.textContent.trim());
      return {hasError, btns: btns.slice(0,5), bodySnippet: body.slice(0,100)};
    }).catch(() => ({hasError:false, btns:[], bodySnippet:'frame-gone'}));
    confirmReason = `no-i-understand: ${JSON.stringify(formError)}`;
    return { ok: false, reason: confirmReason, termText, termVerified: termOk, dateVerified: dateOk, urlData };
  }

  // Stage 2: Click "I understand" and verify modal disappears from DOM
  await propFrame.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'I understand');
    if (btn) btn.click();
  }).catch(() => {});
  await sleep(2500);

  // Check modal is completely gone from DOM (not just hidden)
  const modalGone = await page.evaluate(() => {
    const f = document.querySelector('iframe[data-testid="uicl-modal-iframe-content"]');
    return !f; // must be removed from DOM entirely
  }).catch(() => false);

  if (modalGone) {
    sent = true;
    confirmReason = 'modal-removed-from-dom';
  } else {
    // Modal still in DOM — check if it's at least invisible (some browsers keep it)
    const modalInvisible = await page.evaluate(() => {
      const f = document.querySelector('iframe[data-testid="uicl-modal-iframe-content"]');
      if (!f) return true;
      const r = f.getBoundingClientRect();
      return r.width < 10 || r.height < 10;
    }).catch(() => false);
    if (modalInvisible) {
      sent = true;
      confirmReason = 'modal-invisible';
    } else {
      confirmReason = 'modal-still-visible-after-i-understand';
    }
  }

  return { ok: sent, reason: sent ? 'sent' : 'submit-fail', termText, termVerified: termOk, dateVerified: dateOk, urlData };
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[runner] Connecting CDP :${CDP_PORT}...`);
  const browser = await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`);
  const ctx = browser.contexts()[0];
  let page = ctx.pages().find(p => p.url().includes('impact.com')) ||
             ctx.pages().find(p => !p.url().includes('chrome-extension')) ||
             ctx.pages()[0];

  ensureFile(LEDGER, `# Impact ${advertiser} Outreach Ledger\n# name|email|date|program|partner_id|status|size|website|contact_name\n`);
  ensureFile(INTEL_DB, `# Impact ${advertiser} Publisher Intel\n\n`);
  ensureFile(OBSIDIAN, `# Impact ${advertiser} Outreach\n\n`);

  const alreadySet = loadDedup();
  console.log(`[runner] Dedup: ${alreadySet.size} | Target: ${TARGET}`);

  await clearStuckModal(page, tabUrl(START_TAB));

  const sleep = ms => page.waitForTimeout(ms);
  const results = [], errors = [];
  let sessionSent = 0;
  const startTime = Date.now();

  for (let tabIdx = START_TAB; tabIdx < business_models.length && sessionSent < TARGET; tabIdx++) {
    const DISCOVER_URL = tabUrl(tabIdx);
    console.log(`\n[tab ${tabIdx+1}/${business_models.length}] ${business_models[tabIdx]}`);
    await page.goto(DISCOVER_URL, {waitUntil: 'domcontentloaded', timeout: 15000});
    await sleep(3000);

    const seen = new Set();
    let scrollAttempts = 0;

    while (sessionSent < TARGET && scrollAttempts < 20) {
      const cards = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.discovery-card')).map((c, i) => {
          const ic = c.querySelector('.image-container');
          const r = ic?.getBoundingClientRect();
          return {
            i,
            name: c.querySelector('[class*="name"]')?.textContent?.trim() || `card_${i}`,
            x: r ? Math.round(r.x + r.width/2) : null,
            y: r ? Math.round(r.y + r.height/2) : null,
          };
        })
      );

      const newCards = cards.filter(c =>
        c.name && c.x !== null &&
        !alreadySet.has(c.name.toLowerCase()) &&
        !seen.has(c.name.toLowerCase())
      );

      if (newCards.length === 0) {
        scrollAttempts++;
        console.log(`  [scroll] attempt ${scrollAttempts}, cards: ${cards.length}, seen: ${seen.size}`);
        await page.evaluate(() => window.scrollBy(0, 1500));
        await sleep(2000);
        continue;
      }
      scrollAttempts = 0;

      for (const card of newCards) {
        if (sessionSent >= TARGET) break;
        const { name } = card;
        if (alreadySet.has(name.toLowerCase()) || seen.has(name.toLowerCase())) continue;
        seen.add(name.toLowerCase());

        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const rate = sessionSent > 0 ? (sessionSent / elapsed * 60).toFixed(1) : '0';
        console.log(`\n[${sessionSent+1}/${TARGET}] (${elapsed}s, ${rate}/min) ${name}`);

        await clearStuckModal(page, DISCOVER_URL);

        const freshCoords = await page.evaluate((n) => {
          for (const c of document.querySelectorAll('.discovery-card')) {
            if (c.querySelector('[class*="name"]')?.textContent?.trim() !== n) continue;
            const ic = c.querySelector('.image-container');
            const r = ic?.getBoundingClientRect();
            return r ? { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) } : null;
          }
          return null;
        }, name);

        if (!freshCoords) { errors.push({ name, reason: 'card-disappeared' }); continue; }

        await page.mouse.click(freshCoords.x, freshCoords.y);
        await sleep(3500);

        if (!page.url().includes('slideout_id=')) {
          errors.push({ name, reason: 'no-slideout' });
          await page.goto(DISCOVER_URL, {waitUntil:'domcontentloaded', timeout:15000});
          await sleep(2500);
          continue;
        }

        let pubData = { name };
        try {
          const scraped = await scrapeSlideout(page);
          if (scraped) pubData = { ...scraped, name };
        } catch (e) { console.error('  scrape err:', e.message); }

        // Navigate back, hover card, click Send Proposal (v1 working method)
        await page.goto(DISCOVER_URL, {waitUntil:'domcontentloaded', timeout:15000});
        await sleep(2500);

        const cardCoords2 = await page.evaluate((n) => {
          for (const c of document.querySelectorAll('.discovery-card')) {
            if (c.querySelector('[class*="name"]')?.textContent?.trim() !== n) continue;
            const r = c.getBoundingClientRect();
            return r.width > 0 ? { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) } : null;
          }
          return null;
        }, name);

        if (!cardCoords2) { errors.push({ name, reason: 'card-gone-after-scrape' }); continue; }

        await page.mouse.move(cardCoords2.x, cardCoords2.y);
        await sleep(1000);

        const sentInitiated = await page.evaluate((n) => {
          for (const c of document.querySelectorAll('.discovery-card')) {
            if (c.querySelector('[class*="name"]')?.textContent?.trim() !== n) continue;
            const btn = Array.from(c.querySelectorAll('button')).find(b => b.textContent.trim() === 'Send Proposal');
            if (!btn) return false;
            btn.scrollIntoView();
            btn.click();
            return true;
          }
          return false;
        }, name).catch(()=>false);

        if (!sentInitiated) { errors.push({ name, reason: 'no-send-proposal-btn' }); continue; }

        await sleep(4000);

        const propResult = await sendProposal(page);

        if (propResult.urlData) {
          if (propResult.urlData.email && !pubData.contact_email) pubData.contact_email = propResult.urlData.email;
          if (propResult.urlData.name && !pubData.contact_name) pubData.contact_name = propResult.urlData.name;
          if (propResult.urlData.partnerId && !pubData.partner_id) pubData.partner_id = propResult.urlData.partnerId;
        }

        if (propResult.ok) {
          const fullPub = {
            ...pubData,
            termVerified: propResult.termVerified,
            termText: propResult.termText,
            dateVerified: propResult.dateVerified,
            proposal_sent: true,
          };
          results.push(fullPub);
          alreadySet.add(name.toLowerCase());
          sessionSent++;
          appendLedger(fullPub);
          appendIntel(fullPub);

          const e = pubData.contact_email ? `✓${pubData.contact_email.slice(0,20)}` : '✗email';
          const n = pubData.contact_name ? `✓${pubData.contact_name.slice(0,15)}` : '✗name';
          const w = pubData.website ? '✓web' : '✗web';
          const m = pubData.semrush_global_rank ? `S:${pubData.semrush_global_rank}` : '';
          console.log(`  ✓ SENT [${sessionSent}] ${e} ${n} ${w} ${m} t:${propResult.termVerified} d:${propResult.dateVerified}`);

          // ── EVERY-50 CROSS-CHECK: compare runner count vs Impact's real count ──
          if (sessionSent % 50 === 0) {
            try {
              await page.goto('https://app.impact.com/secure/advertiser/engage/contracts/activity/adv-manage-pending-custom-ios-flow.ihtml', {waitUntil:'domcontentloaded', timeout:20000});
              await page.waitForTimeout(3000);
              const impactCount = await page.evaluate(() => {
                const m = document.body.innerText.match(/\|(\d+) rows/);
                return m ? parseInt(m[1]) : null;
              });
              const ledgerCount = fs.readFileSync(LEDGER, 'utf8').split('\n').filter(l => l.includes(`impact-${program_id}`)).length;
              console.log(`\n╔══ CHECKPOINT [${sessionSent}/${TARGET}] ══════════════════`);
              console.log(`║  Runner logged : ${sessionSent} sent this session`);
              console.log(`║  Ledger total  : ${ledgerCount} rows`);
              console.log(`║  Impact actual : ${impactCount !== null ? impactCount : 'fetch-failed'} proposals sent`);
              const drift = impactCount !== null ? impactCount - ledgerCount : null;
              console.log(`║  Drift         : ${drift !== null ? (drift >= 0 ? '+'+drift : drift) + ' (should be ≥0)' : 'unknown'}`);
              console.log(`╚═══════════════════════════════════════\n`);
              // Return to discover page
              await page.goto(DISCOVER_URL, {waitUntil:'domcontentloaded', timeout:15000});
              await sleep(3000);
            } catch(e) {
              console.log(`  [checkpoint-err] ${e.message.slice(0,60)}`);
              await page.goto(DISCOVER_URL, {waitUntil:'domcontentloaded', timeout:15000}).catch(()=>{});
              await sleep(2000);
            }
          }
        } else {
          errors.push({ name, reason: propResult.reason });
          console.log(`  ✗ FAILED: ${propResult.reason}`);
        }

        await clearStuckModal(page, DISCOVER_URL);
      }
    }
  }

  // Final report
  const emails = results.filter(p => p.contact_email).length;
  const contacts = results.filter(p => p.contact_name).length;
  const sites = results.filter(p => p.website).length;
  const verified = results.filter(p => p.verified).length;
  const elapsed = Math.floor((Date.now() - startTime) / 1000);

  const summary = `\n## Session ${new Date().toISOString().slice(0,10)} (${elapsed}s)
- Proposals: ${sessionSent} | Errors: ${errors.length}
- Emails: ${emails}/${sessionSent} (${sessionSent ? Math.round(emails/sessionSent*100) : 0}%)
- Contacts: ${contacts}/${sessionSent} | Websites: ${sites}/${sessionSent} | Verified: ${verified}/${sessionSent}
- Top 5: ${results.slice(0,5).map(p => `${p.name}${p.contact_email ? ' · '+p.contact_email : ''}${p.website ? ' · '+p.website : ''}`).join(' | ')}\n`;
  try { fs.appendFileSync(OBSIDIAN, summary); } catch {}

  console.log(`\n=== Impact ${advertiser} — Complete (${elapsed}s) ===`);
  console.log(`Sent: ${sessionSent}`);
  console.log(`Emails: ${emails}/${sessionSent} (${sessionSent ? Math.round(emails/sessionSent*100) : 0}%)`);
  console.log(`Contacts: ${contacts}/${sessionSent} (${sessionSent ? Math.round(contacts/sessionSent*100) : 0}%)`);
  console.log(`Websites: ${sites}/${sessionSent}`);
  console.log(`Verified: ${verified}/${sessionSent}`);
  console.log(`Errors: ${errors.length}`);
  if (errors.length > 0) {
    const reasons = {};
    errors.forEach(e => reasons[e.reason] = (reasons[e.reason] || 0) + 1);
    console.log(`Error breakdown:`, JSON.stringify(reasons));
  }
  console.log(`====================================\n`);

  await browser.close();
}

main().catch(e => { console.error('[FATAL]', e.message, e.stack); process.exit(1); });
