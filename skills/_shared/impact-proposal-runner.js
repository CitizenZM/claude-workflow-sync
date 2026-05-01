#!/usr/bin/env node
// Impact Generic Proposal Runner v3 — 2026-04-30
// Usage: node impact-proposal-runner.js <count> <config-file> [start-tab-idx]
//
// ALL FIXES vs v1/v2:
//  1. Shadow DOM — slideout at #unified-program-slideout, access via .shadowRoot
//  2. Term: skip "Select" placeholder, pick first real option
//  3. Submit: focus btn → keyboard.press('Enter') (button below viewport at y≈705, h=696)
//  4. Strict 2-stage confirm: "I understand" MUST appear, modal MUST leave DOM
//  5. No fallback-to-true on any exception
//  6. Every-50 checkpoint: cross-checks runner count vs Impact proposals page
//  7. Scroll limit 5 per tab (fast tab rotation when exhausted)
//  8. Config-file driven (program_id, msg, tabs, vault_dir)

const { chromium } = require('/Users/xiaozuo/.npm/_npx/aa1f6563a672b75d/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');

// ── ARGS ─────────────────────────────────────────────────────────────────────
const TARGET = parseInt(process.argv[2] || '500', 10);
const CONFIG_FILE = process.argv[3];
const START_TAB = parseInt(process.argv[4] || '0', 10);

if (!CONFIG_FILE || !fs.existsSync(CONFIG_FILE)) {
  console.error('Usage: node impact-proposal-runner.js <count> <config-file> [start-tab-idx]');
  process.exit(1);
}

const CONFIG = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
const { program_id, advertiser, msg: MSG, cdp_port: CDP_PORT, vault_dir, business_models } = CONFIG;

const VAULT_PREFIX = `${vault_dir}/Impact-${advertiser.split('-').map(w => w[0].toUpperCase()+w.slice(1)).join('-')}`;
const LEDGER  = `${VAULT_PREFIX}-Outreach-Ledger.md`;
const INTEL_DB = `${VAULT_PREFIX}-Publisher-Intel.md`;
const OBSIDIAN = `${VAULT_PREFIX}-Outreach.md`;

const SIZE_PARAM = CONFIG.size_filter
  ? `sizeRating=${CONFIG.size_filter.split(',').map(s => s.trim().replace(/ /g,'_')).join('%2C')}`
  : 'sizeRating=medium%2Clarge%2Cextra_large';
const BASE_URL = 'https://app.impact.com/secure/advertiser/discover/radius/fr/partner_discover.ihtml?page=marketplace&slideout_id_type=partner';
const tabUrl = i => `${BASE_URL}#businessModels=${business_models[i]}&locationCountryCode=&${SIZE_PARAM}&sortBy=reachRating&sortOrder=DESC`;

console.log(`[runner] Advertiser: ${advertiser} | Program: ${program_id} | Target: ${TARGET}`);
console.log(`[runner] Tabs: ${business_models.join(', ')}`);

// ── PERSISTENCE ───────────────────────────────────────────────────────────────
function ensureFile(p, h='') {
  try { fs.mkdirSync(path.dirname(p),{recursive:true}); if(!fs.existsSync(p)) fs.writeFileSync(p,h); } catch(e){}
}
function appendLedger(pub) {
  const d=new Date().toISOString().slice(0,10);
  try { fs.appendFileSync(LEDGER, `${pub.name}|${pub.contact_email||'email_missing'}|${d}|impact-${program_id}|${pub.partner_id||''}|${pub.status||''}|${pub.partner_size||''}|${pub.website||''}|${pub.contact_name||'name_missing'}\n`); } catch(e){}
}
function appendIntel(pub) {
  const d=new Date().toISOString().slice(0,10);
  const e=`\n## ${pub.name} — ${d}\n- **ID**: impact-${pub.partner_id||'?'} | **Status**: ${pub.status||'?'} | **Size**: ${pub.partner_size||'?'} | **Model**: ${pub.business_model||'?'}\n- **Contact**: ${pub.contact_name||'name_missing'} | ${pub.contact_email||'email_missing'}\n- **Website**: ${pub.website||''} | **Verified**: ${pub.verified}\n- **Semrush**: ${pub.semrush_global_rank||''} | **Visitors**: ${pub.monthly_visitors||''} | **MozDA**: ${pub.moz_domain_authority||''}\n- **Address**: ${pub.corporate_address||''}\n- **Term**: ${pub.termText||''} ✓${pub.termVerified} | **Date**: ✓${pub.dateVerified}\n---`;
  try { fs.appendFileSync(INTEL_DB, e+'\n'); } catch(e){}
}
function loadDedup() {
  try {
    return new Set(fs.readFileSync(LEDGER,'utf8').split('\n').filter(l=>l.includes(`impact-${program_id}`)).map(l=>l.split('|')[0].toLowerCase().trim()).filter(Boolean));
  } catch { return new Set(); }
}

// ── MODAL CLEANUP ─────────────────────────────────────────────────────────────
async function clearStuckModal(page, baseUrl) {
  const has = await page.evaluate(()=>!!document.querySelector('iframe[data-testid="uicl-modal-iframe-content"]')).catch(()=>false);
  if (has) {
    await page.goto('https://app.impact.com/secure/advertiser/dashboard/dashboard.ihtml',{waitUntil:'domcontentloaded',timeout:15000}).catch(()=>{});
    await page.waitForTimeout(2000);
    await page.goto(baseUrl,{waitUntil:'domcontentloaded',timeout:15000}).catch(()=>{});
    await page.waitForTimeout(3000);
  }
}

// ── SCRAPE (Shadow DOM) ───────────────────────────────────────────────────────
async function scrapeSlideout(page) {
  const pub = await page.evaluate(()=>{
    const host=document.querySelector('#unified-program-slideout');
    if(!host||!host.shadowRoot) return {error:'no-shadow'};
    const sr=host.shadowRoot;
    const text=sr.body?.innerText||sr.textContent||'';
    const d={
      partner_id:null,status:null,partner_size:null,business_model:null,description:null,
      contact_name:null,contact_role:'Marketplace Contact',contact_email:null,all_contacts:[],
      language:null,corporate_address:null,legacy_categories:[],currency:null,
      website:null,social_properties:[],verified:null,
      semrush_global_rank:null,monthly_visitors:null,moz_domain_authority:null,moz_spam_score:null,
    };
    const idM=text.match(/\b(\d{6,10})\b/); if(idM) d.partner_id=idM[1];
    for(const s of['Active','New','Pending','Inactive']){if(new RegExp(`\\b${s}\\b`).test(text)){d.status=s;break;}}
    if(/Extra\s+Large|XLExtra/.test(text)) d.partner_size='Extra Large';
    else if(/\bLarge\b/.test(text)) d.partner_size='Large';
    else if(/\bMedium\b/.test(text)) d.partner_size='Medium';
    else if(/\bSmall\b/.test(text)) d.partner_size='Small';
    for(const m of['Content/Reviews','Deal/Coupon','Email/Newsletter','Loyalty/Rewards','Network','Content','Coupon','Email','Loyalty']){if(text.includes(m)){d.business_model=m;break;}}
    const urlM=text.match(/(https?:\/\/[a-zA-Z0-9.\-_/]+?)(?=Learn|Verified|Undo|Redo|Font|Content|\s|$)/);
    if(urlM&&!urlM[1].includes('impact.com')){d.website=urlM[1].replace(/[.,;]$/,'');}
    const semM=text.match(/Semrush\s+global\s+rank\s*([0-9.,]+[KMB]?)/i); if(semM) d.semrush_global_rank=semM[1];
    const mvM=text.match(/Monthly\s+visitors?\s*([0-9.,]+[KMB])/i); if(mvM) d.monthly_visitors=mvM[1];
    const daM=text.match(/Moz\s+domain\s+authority\s*(\d+)/i); if(daM) d.moz_domain_authority=daM[1];
    const ssM=text.match(/Moz\s+spam\s+score\s*(\d+)/i); if(ssM) d.moz_spam_score=ssM[1];
    if(text.includes('Marketplace Verified')) d.verified=true;
    else if(text.includes('Not verified')) d.verified=false;
    const aM=text.match(/(United States of America|United States|United Kingdom|Canada|Australia|Germany|France|Japan)/); if(aM) d.corporate_address=aM[1];
    const emails=(text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g)||[]);
    if(emails.length>0){d.contact_email=emails[0]; emails.slice(0,3).forEach(e=>d.all_contacts.push({email:e,role:'Marketplace Contact'}));}
    const nameMs=text.match(/\b([A-Z][a-z]{2,}\s+[A-Z][a-z]{2,})\b/g)||[];
    const bl=/(LLC|Inc|Corp|Ltd|Limited|GmbH|Marketplace|United\s+States|United\s+Kingdom|Add\s+Prospect|Report\s+Abuse|Marketplace\s+Verified|Active\s+on)/i;
    const validNames=nameMs.filter(n=>!bl.test(n));
    if(validNames.length>0) d.contact_name=validNames[0];
    const langM=text.match(/\b(English|French|German|Spanish|Chinese|Japanese)\b/); if(langM) d.language=langM[1];
    const currM=text.match(/\b(USD|EUR|GBP|AUD|CAD|JPY)\b/); if(currM) d.currency=currM[1];
    const descIdx=text.indexOf('Partnership potential');
    if(descIdx>=0) d.description=text.slice(descIdx+21,descIdx+400).trim().slice(0,300);
    d.scraped_at=new Date().toISOString().slice(0,10);
    return d;
  }).catch(()=>({error:'eval-err'}));
  return pub.error ? null : pub;
}

// ── PROPOSAL FORM ─────────────────────────────────────────────────────────────
async function sendProposal(page) {
  const sleep=ms=>page.waitForTimeout(ms);

  const iframeUrl=await page.evaluate(()=>{
    const f=document.querySelector('iframe[data-testid="uicl-modal-iframe-content"]')||document.querySelector('iframe[src*="send-proposal"]');
    return f?.src||null;
  }).catch(()=>null);
  if(!iframeUrl) return{ok:false,reason:'no-iframe',termText:'',termVerified:false,dateVerified:false,urlData:{}};

  const urlData={};
  try{const u=new URL(iframeUrl);urlData.email=u.searchParams.get('email');urlData.name=u.searchParams.get('name');urlData.partnerId=u.searchParams.get('p');}catch{}

  const propFrame=page.frames().find(f=>f.url()===iframeUrl||f.url().includes('send-proposal')||f.url().includes('contracts/send'));
  if(!propFrame) return{ok:false,reason:'no-frame',termText:'',termVerified:false,dateVerified:false,urlData};

  await propFrame.waitForLoadState('domcontentloaded',{timeout:5000}).catch(()=>{});

  const iRect=await page.evaluate(()=>{
    const f=document.querySelector('iframe[data-testid="uicl-modal-iframe-content"]')||document.querySelector('iframe[src*="send-proposal"]');
    if(!f)return null; const r=f.getBoundingClientRect(); return{x:r.x,y:r.y};
  }).catch(()=>null);
  if(!iRect) return{ok:false,reason:'no-iframe-rect',termText:'',termVerified:false,dateVerified:false,urlData};

  // Term — skip "Select" placeholder
  let termOk=false,termText='';
  for(let att=0;att<3&&!termOk;att++){
    await propFrame.evaluate(()=>{const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Select');if(b)b.click();}).catch(()=>{});
    await sleep(1200);
    const li=await propFrame.evaluate(()=>{
      const isVis=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
      const opts=Array.from(document.querySelectorAll('li[role="option"]')).filter(isVis).filter(l=>l.textContent.trim()!=='Select');
      const best=opts.find(l=>/performance/i.test(l.textContent))||opts.find(l=>/\d+%/.test(l.textContent))||opts[0];
      if(!best)return null; const r=best.getBoundingClientRect(); return{x:r.x+r.width/2,y:r.y+r.height/2,text:best.textContent.trim()};
    }).catch(()=>null);
    if(!li){await sleep(400);continue;}
    await page.mouse.click(Math.round(iRect.x+li.x),Math.round(iRect.y+li.y));
    await sleep(1000);
    const confirmed=await propFrame.evaluate(()=>{
      const btns=Array.from(document.querySelectorAll('button')).filter(b=>b.getBoundingClientRect().width>0);
      return !btns.some(b=>b.textContent.trim()==='Select');
    }).catch(()=>false);
    if(confirmed){termOk=true;termText=li.text;}
    await sleep(300);
  }

  // Date — calendar icon → Today
  let dateOk=false;
  const cal=await propFrame.evaluate(()=>{
    const isVis=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
    const b=Array.from(document.querySelectorAll('button')).filter(isVis).find(b=>b.textContent.trim().length<3&&b.querySelector('img,svg'));
    if(!b)return null; const r=b.getBoundingClientRect(); return{x:r.x+r.width/2,y:r.y+r.height/2};
  }).catch(()=>null);
  if(cal){
    await page.mouse.click(Math.round(iRect.x+cal.x),Math.round(iRect.y+cal.y));
    await sleep(900);
    dateOk=await propFrame.evaluate(()=>{
      const isVis=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
      const t=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Today'&&isVis(b));
      if(t){t.click();return true;}
      const d=Array.from(document.querySelectorAll('button,[role="gridcell"]')).filter(el=>isVis(el)&&/^\d{1,2}$/.test(el.textContent.trim())&&!el.disabled);
      if(d[0]){d[0].click();return true;} return false;
    }).catch(()=>false);
    await sleep(500);
  }

  // Message
  await propFrame.evaluate(msg=>{
    const ta=document.querySelector('textarea'); if(!ta)return;
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(ta,msg);
    ta.dispatchEvent(new Event('input',{bubbles:true}));
    ta.dispatchEvent(new Event('change',{bubbles:true}));
  },MSG).catch(()=>{});
  await sleep(400);

  // Submit — focus + Enter (button at y≈705, viewport h=696, so always below fold)
  const subExists=await propFrame.evaluate(()=>{
    const isVis=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
    const btn=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Send Proposal'&&isVis(b));
    if(btn){btn.focus();return true;} return false;
  }).catch(()=>false);
  if(!subExists) return{ok:false,reason:'no-submit',termText,termVerified:termOk,dateVerified:dateOk,urlData};

  // Check if in viewport; use mouse if possible, else keyboard
  const subCoords=await propFrame.evaluate(()=>{
    const btn=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Send Proposal'&&b.getBoundingClientRect().width>0);
    if(!btn)return null; const r=btn.getBoundingClientRect(); return{x:r.x+r.width/2,y:r.y+r.height/2};
  }).catch(()=>null);
  const vp=await page.evaluate(()=>({w:window.innerWidth,h:window.innerHeight}));
  const absX=iRect.x+(subCoords?.x||0), absY=iRect.y+(subCoords?.y||0);
  if(subCoords&&absX<vp.w&&absY<vp.h) await page.mouse.click(Math.round(absX),Math.round(absY));
  else await page.keyboard.press('Enter');
  await sleep(2500);

  // ── STRICT 2-STAGE VERIFICATION ───────────────────────────────────────────
  // Stage 1: "I understand" MUST appear (proves Impact accepted submission)
  let iuVisible=false;
  for(let i=0;i<8;i++){
    await sleep(500);
    iuVisible=await propFrame.evaluate(()=>{
      const isVis=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
      return !!Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='I understand'&&isVis(b));
    }).catch(()=>false);
    if(iuVisible)break;
  }
  if(!iuVisible){
    const err=await propFrame.evaluate(()=>document.body?.innerText?.slice(0,100)||'frame-gone').catch(()=>'frame-gone');
    return{ok:false,reason:`no-i-understand: ${err.slice(0,60)}`,termText,termVerified:termOk,dateVerified:dateOk,urlData};
  }

  // Stage 2: Click "I understand" — modal MUST be removed from DOM
  await propFrame.evaluate(()=>{
    const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='I understand');
    if(b)b.click();
  }).catch(()=>{});
  await sleep(2500);

  const modalGone=await page.evaluate(()=>!document.querySelector('iframe[data-testid="uicl-modal-iframe-content"]')).catch(()=>false);
  let sent=modalGone;
  if(!sent){
    // Modal still in DOM — check if invisible
    const invisible=await page.evaluate(()=>{
      const f=document.querySelector('iframe[data-testid="uicl-modal-iframe-content"]');
      if(!f)return true; const r=f.getBoundingClientRect(); return r.width<10||r.height<10;
    }).catch(()=>false);
    sent=invisible;
  }

  return{ok:sent,reason:sent?'sent':'modal-still-visible',termText,termVerified:termOk,dateVerified:dateOk,urlData};
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[runner] Connecting CDP :${CDP_PORT}...`);
  const browser=await chromium.connectOverCDP(`http://localhost:${CDP_PORT}`);
  const ctx=browser.contexts()[0];
  let page=ctx.pages().find(p=>p.url().includes('impact.com'))||ctx.pages().find(p=>!p.url().includes('chrome-extension'))||ctx.pages()[0];

  ensureFile(LEDGER,`# Impact ${advertiser} Outreach Ledger\n# name|email|date|program|partner_id|status|size|website|contact_name\n`);
  ensureFile(INTEL_DB,`# Impact ${advertiser} Publisher Intel\n\n`);
  ensureFile(OBSIDIAN,`# Impact ${advertiser} Outreach\n\n`);

  const alreadySet=loadDedup();
  console.log(`[runner] Dedup: ${alreadySet.size} | Target: ${TARGET}`);

  await clearStuckModal(page,tabUrl(START_TAB));

  const sleep=ms=>page.waitForTimeout(ms);
  const results=[],errors=[];
  let sessionSent=0;
  const startTime=Date.now();

  for(let tabIdx=START_TAB;tabIdx<business_models.length&&sessionSent<TARGET;tabIdx++){
    const DISCOVER_URL=tabUrl(tabIdx);
    console.log(`\n[tab ${tabIdx+1}/${business_models.length}] ${business_models[tabIdx]}`);
    await page.goto(DISCOVER_URL,{waitUntil:'domcontentloaded',timeout:15000});
    await sleep(3000);

    const seen=new Set();
    let scrollAttempts=0;

    while(sessionSent<TARGET&&scrollAttempts<5){ // limit 5 scrolls per tab
      const cards=await page.evaluate(()=>
        Array.from(document.querySelectorAll('.discovery-card')).map(c=>{
          const ic=c.querySelector('.image-container');
          const r=ic?.getBoundingClientRect();
          return{name:c.querySelector('[class*="name"]')?.textContent?.trim()||'',x:r?Math.round(r.x+r.width/2):null,y:r?Math.round(r.y+r.height/2):null};
        })
      );
      const newCards=cards.filter(c=>c.name&&c.x!==null&&!alreadySet.has(c.name.toLowerCase())&&!seen.has(c.name.toLowerCase()));

      if(newCards.length===0){
        scrollAttempts++;
        console.log(`  [scroll] attempt ${scrollAttempts}/5, tab: ${business_models[tabIdx]}, seen: ${seen.size}`);
        await page.evaluate(()=>window.scrollBy(0,1500));
        await sleep(2000);
        continue;
      }
      scrollAttempts=0;

      for(const card of newCards){
        if(sessionSent>=TARGET)break;
        const{name}=card;
        if(alreadySet.has(name.toLowerCase())||seen.has(name.toLowerCase()))continue;
        seen.add(name.toLowerCase());

        const elapsed=Math.floor((Date.now()-startTime)/1000);
        const rate=sessionSent>0?(sessionSent/elapsed*60).toFixed(1):'0';
        console.log(`\n[${sessionSent+1}/${TARGET}] (${elapsed}s, ${rate}/min) ${name}`);

        await clearStuckModal(page,DISCOVER_URL);

        const freshCoords=await page.evaluate(n=>{
          for(const c of document.querySelectorAll('.discovery-card')){
            if(c.querySelector('[class*="name"]')?.textContent?.trim()!==n)continue;
            const ic=c.querySelector('.image-container');
            const r=ic?.getBoundingClientRect();
            return r?{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}:null;
          }
          return null;
        },name);
        if(!freshCoords){errors.push({name,reason:'card-disappeared'});continue;}

        await page.mouse.click(freshCoords.x,freshCoords.y);
        await sleep(3500);

        if(!page.url().includes('slideout_id=')){
          errors.push({name,reason:'no-slideout'});
          await page.goto(DISCOVER_URL,{waitUntil:'domcontentloaded',timeout:15000});
          await sleep(2500);
          continue;
        }

        let pubData={name};
        try{const s=await scrapeSlideout(page);if(s)pubData={...s,name};}catch(e){console.error('  scrape err:',e.message);}

        await page.goto(DISCOVER_URL,{waitUntil:'domcontentloaded',timeout:15000});
        await sleep(2500);

        const cardCoords2=await page.evaluate(n=>{
          for(const c of document.querySelectorAll('.discovery-card')){
            if(c.querySelector('[class*="name"]')?.textContent?.trim()!==n)continue;
            const r=c.getBoundingClientRect();
            return r.width>0?{x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}:null;
          }
          return null;
        },name);
        if(!cardCoords2){errors.push({name,reason:'card-gone-after-scrape'});continue;}

        await page.mouse.move(cardCoords2.x,cardCoords2.y);
        await sleep(1000);

        const initiated=await page.evaluate(n=>{
          for(const c of document.querySelectorAll('.discovery-card')){
            if(c.querySelector('[class*="name"]')?.textContent?.trim()!==n)continue;
            const btn=Array.from(c.querySelectorAll('button')).find(b=>b.textContent.trim()==='Send Proposal');
            if(!btn)return false; btn.scrollIntoView();btn.click();return true;
          }
          return false;
        },name).catch(()=>false);
        if(!initiated){errors.push({name,reason:'no-send-proposal-btn'});continue;}

        await sleep(4000);
        const propResult=await sendProposal(page);

        if(propResult.urlData){
          if(propResult.urlData.email&&!pubData.contact_email) pubData.contact_email=propResult.urlData.email;
          if(propResult.urlData.name&&!pubData.contact_name) pubData.contact_name=propResult.urlData.name;
          if(propResult.urlData.partnerId&&!pubData.partner_id) pubData.partner_id=propResult.urlData.partnerId;
        }

        if(propResult.ok){
          const fullPub={...pubData,termVerified:propResult.termVerified,termText:propResult.termText,dateVerified:propResult.dateVerified,proposal_sent:true};
          results.push(fullPub);
          alreadySet.add(name.toLowerCase());
          sessionSent++;
          appendLedger(fullPub);
          appendIntel(fullPub);

          const e=pubData.contact_email?`✓${pubData.contact_email.slice(0,20)}`:'✗email';
          const n=pubData.contact_name?`✓${pubData.contact_name.slice(0,15)}`:'✗name';
          const w=pubData.website?'✓web':'✗web';
          const m=pubData.semrush_global_rank?`S:${pubData.semrush_global_rank}`:'';
          console.log(`  ✓ SENT [${sessionSent}] ${e} ${n} ${w} ${m} t:${propResult.termVerified} d:${propResult.dateVerified}`);

          // ── EVERY-50 CROSS-CHECK ───────────────────────────────────────────
          if(sessionSent%50===0){
            try{
              await page.goto('https://app.impact.com/secure/advertiser/engage/contracts/activity/adv-manage-pending-custom-ios-flow.ihtml',{waitUntil:'domcontentloaded',timeout:20000});
              await page.waitForTimeout(3000);
              const impactCount=await page.evaluate(()=>{const m=document.body.innerText.match(/\|(\d+) rows/);return m?parseInt(m[1]):null;});
              const ledgerCount=fs.readFileSync(LEDGER,'utf8').split('\n').filter(l=>l.includes(`impact-${program_id}`)).length;
              const drift=impactCount!==null?impactCount-ledgerCount:null;
              console.log(`\n╔══ CHECKPOINT [${sessionSent}/${TARGET}] ══════════════════`);
              console.log(`║  Runner logged : ${sessionSent} sent this session`);
              console.log(`║  Ledger total  : ${ledgerCount} rows`);
              console.log(`║  Impact actual : ${impactCount!==null?impactCount:'fetch-failed'} proposals sent`);
              console.log(`║  Drift         : ${drift!==null?(drift>=0?'+'+drift:drift)+' (should be ≥0)':'unknown'}`);
              console.log(`╚═══════════════════════════════════════\n`);
              await page.goto(DISCOVER_URL,{waitUntil:'domcontentloaded',timeout:15000});
              await sleep(3000);
            }catch(e){
              console.log(`  [checkpoint-err] ${e.message.slice(0,60)}`);
              await page.goto(DISCOVER_URL,{waitUntil:'domcontentloaded',timeout:15000}).catch(()=>{});
              await sleep(2000);
            }
          }
        } else {
          errors.push({name,reason:propResult.reason});
          console.log(`  ✗ FAILED: ${propResult.reason}`);
        }

        await clearStuckModal(page,DISCOVER_URL);
      }
    }
  }

  const emails=results.filter(p=>p.contact_email).length;
  const contacts=results.filter(p=>p.contact_name).length;
  const sites=results.filter(p=>p.website).length;
  const elapsed=Math.floor((Date.now()-startTime)/1000);
  const summary=`\n## Session ${new Date().toISOString().slice(0,10)} (${elapsed}s)\n- Proposals: ${sessionSent} | Errors: ${errors.length}\n- Emails: ${emails}/${sessionSent} (${sessionSent?Math.round(emails/sessionSent*100):0}%)\n- Contacts: ${contacts}/${sessionSent} | Websites: ${sites}/${sessionSent}\n`;
  try{fs.appendFileSync(OBSIDIAN,summary);}catch{}

  console.log(`\n=== Impact ${advertiser} — Complete (${elapsed}s) ===`);
  console.log(`Sent: ${sessionSent}`);
  console.log(`Emails: ${emails}/${sessionSent} (${sessionSent?Math.round(emails/sessionSent*100):0}%)`);
  console.log(`Contacts: ${contacts}/${sessionSent} (${sessionSent?Math.round(contacts/sessionSent*100):0}%)`);
  console.log(`Websites: ${sites}/${sessionSent}`);
  console.log(`Errors: ${errors.length}`);
  if(errors.length>0){const r={};errors.forEach(e=>r[e.reason]=(r[e.reason]||0)+1);console.log('Error breakdown:',JSON.stringify(r));}
  console.log(`====================================\n`);
  await browser.close();
}

main().catch(e=>{console.error('[FATAL]',e.message);process.exit(1);});
