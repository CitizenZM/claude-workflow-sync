#!/usr/bin/env node
/**
 * Impact.com Robust Login Module
 *
 * Handles the full login flow:
 *   1. Cloudflare challenge detection & auto-wait
 *   2. Navigate to app.impact.com/login.user
 *   3. Fill j_username + j_password via locator().fill() (proven reliable)
 *   4. Google Account Chooser → select affiliate@celldigital.co
 *   5. OAuth consent "signing back in" → click Continue
 *   6. Rockbros/program account selector (if present)
 *
 * Credentials: affiliate@celldigital.co / Celldigital2024*
 * Google account: affiliate@celldigital.co (Cell Affiliate Team)
 */

const IMPACT_EMAIL = 'affiliate@celldigital.co';
const IMPACT_PASSWORD = 'Celldigital2024*';

/**
 * Perform full Impact.com login on `page`.
 * @param {import('playwright-core').Page} page
 * @param {object} opts
 * @param {string} [opts.programName] - e.g. 'Rockbros', 'TCL', 'Ottocast' (for account selector)
 * @param {function} [opts.log] - logging function, defaults to console.log
 * @returns {Promise<boolean>} true if logged in successfully
 */
async function performImpactLogin(page, opts = {}) {
  const log = opts.log || console.log;
  const programName = opts.programName || null;

  // ── STEP 1: CF challenge detection ──────────────────────────────────────
  const title0 = await page.title().catch(() => '');
  const url0 = page.url();
  log(`[login] State: "${title0.substring(0,40)}" | ${url0.substring(0,60)}`);

  if (title0.includes('moment') || title0.includes('请稍候') || title0.includes('Checking')) {
    log('[login] Cloudflare challenge — waiting up to 30s for auto-pass...');
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(5000);
      const t = await page.title().catch(() => '');
      if (!t.includes('moment') && !t.includes('请稍候') && !t.includes('Checking')) {
        log('[login] CF passed ✅'); break;
      }
      log(`[login]   CF still active (${(i+1)*5}s)...`);
    }
  }

  // ── STEP 2: Already logged in? ──────────────────────────────────────────
  if (url0.includes('secure/advertiser') && !url0.includes('login')) {
    log('[login] Already logged in ✅');
    return true;
  }

  // ── STEP 3: Navigate to login page if not already there ─────────────────
  const urlNow = page.url();
  if (!urlNow.includes('login.user') && !urlNow.includes('secure/advertiser')) {
    log('[login] Navigating to app.impact.com/login.user...');
    await page.goto('https://app.impact.com/login.user', {
      waitUntil: 'domcontentloaded', timeout: 20000
    }).catch(() => {});
    await page.waitForTimeout(3000);
  }

  // ── STEP 4: Handle CF on login page ─────────────────────────────────────
  const loginTitle = await page.title().catch(() => '');
  if (loginTitle.includes('moment') || loginTitle.includes('请稍候')) {
    log('[login] CF on login page — waiting 30s...');
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(5000);
      const t = await page.title().catch(() => '');
      if (!t.includes('moment') && !t.includes('请稍候')) break;
    }
  }

  // ── STEP 5: Fill Impact direct login form ────────────────────────────────
  const hasForm = await page.evaluate(() =>
    !!document.querySelector('#j_username, input[name="j_username"]')
  ).catch(() => false);

  if (hasForm) {
    log('[login] Filling j_username + j_password via locator...');
    try {
      await page.locator('#j_username').fill(IMPACT_EMAIL, { timeout: 5000 });
      await page.locator('#j_password').fill(IMPACT_PASSWORD, { timeout: 5000 });
      await page.click('button.submit_btn, button[type="submit"], button:has-text("Sign In")', {
        timeout: 5000
      });
      log('[login] Login form submitted');
    } catch (e) {
      log('[login] Locator fill failed, trying keyboard:', e.message.substring(0, 50));
      // Fallback: keyboard type
      await page.click('#j_username', { timeout: 3000 }).catch(() => {});
      await page.keyboard.type(IMPACT_EMAIL, { delay: 30 });
      await page.click('#j_password', { timeout: 3000 }).catch(() => {});
      await page.keyboard.type(IMPACT_PASSWORD, { delay: 30 });
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(5000);
  }

  // ── STEP 6: Handle Google Account Chooser ───────────────────────────────
  let googleUrl = page.url();
  log('[login] Post-submit URL:', googleUrl.substring(0, 80));

  if (googleUrl.includes('accounts.google.com')) {
    log('[login] Google OAuth flow detected...');
    await page.waitForTimeout(3000);
    googleUrl = page.url();

    // 6a: Account Chooser — select affiliate@celldigital.co
    if (googleUrl.includes('accountchooser') || googleUrl.includes('AccountChooser') ||
        googleUrl.includes('accounts.google.com')) {
      log('[login] Account chooser — selecting Cell Affiliate Team / affiliate@celldigital.co...');

      let chosen = false;
      // Primary: li elements (Google Account Chooser list items)
      const allLis = await page.locator('li').all();
      for (const li of allLis) {
        const text = await li.textContent().catch(() => '');
        if (text.includes(IMPACT_EMAIL) || text.includes('celldigital')) {
          await li.click();
          chosen = 'li';
          break;
        }
      }
      // Fallback: section elements
      if (!chosen) {
        const secs = await page.locator('section').all();
        for (const s of secs) {
          const text = await s.textContent().catch(() => '');
          if (text.includes(IMPACT_EMAIL)) { await s.click(); chosen = 'section'; break; }
        }
      }
      log('[login] Account choice:', chosen || 'not-found');
      if (chosen) {
        await page.waitForTimeout(5000);
        googleUrl = page.url();
        log('[login] URL after account choice:', googleUrl.substring(0, 80));
      }
    }

    // 6b: OAuth consent "signing back in" — click Continue
    googleUrl = page.url();
    if (googleUrl.includes('accounts.google.com')) {
      const allBtns = await page.locator('button').all();
      for (const btn of allBtns) {
        const text = await btn.textContent().catch(() => '');
        if (/^continue$/i.test(text.trim())) {
          log('[login] Clicking Continue on OAuth consent...');
          await btn.click();
          await page.waitForTimeout(6000);
          googleUrl = page.url();
          log('[login] URL after Continue:', googleUrl.substring(0, 80));
          break;
        }
      }
    }

    // 6c: Google email identifier page (if account chooser wasn't shown)
    googleUrl = page.url();
    if (googleUrl.includes('accounts.google.com') && !googleUrl.includes('accountchooser')) {
      const hasEmailInput = await page.evaluate(() =>
        !!document.querySelector('input[type="email"]')
      ).catch(() => false);
      if (hasEmailInput) {
        log('[login] Google email input page...');
        await page.locator('input[type="email"]').fill(IMPACT_EMAIL, { timeout: 5000 });
        await page.click('#identifierNext', { timeout: 5000 }).catch(() => page.keyboard.press('Enter'));
        await page.waitForTimeout(4000);
        googleUrl = page.url();
      }
    }

    // 6d: Google password page
    googleUrl = page.url();
    if (googleUrl.includes('accounts.google.com')) {
      const hasPassInput = await page.evaluate(() =>
        !!document.querySelector('input[type="password"]')
      ).catch(() => false);
      if (hasPassInput) {
        log('[login] Google password page...');
        await page.locator('input[type="password"]').fill(IMPACT_PASSWORD, { timeout: 5000 });
        await page.click('#passwordNext', { timeout: 5000 }).catch(() => page.keyboard.press('Enter'));
        await page.waitForTimeout(6000);
        log('[login] URL after Google password:', page.url().substring(0, 80));
      }
    }
  }

  // ── STEP 7: Account selector (Rockbros/program) ──────────────────────────
  await page.waitForTimeout(2000);
  const acctUrl = page.url();
  if (programName && (acctUrl.includes('secure') || acctUrl.includes('select') ||
      acctUrl.includes('choose') || acctUrl.includes('account'))) {
    await chooseProgramAccount(page, programName, log);
  }

  // ── STEP 8: Verify login success ─────────────────────────────────────────
  return await checkLoginSuccess(page, log);
}

/**
 * Select a specific program/brand account after Google login.
 */
async function chooseProgramAccount(page, programName, log = console.log) {
  log(`[login] Checking for account selector (${programName})...`);
  const chosen = await page.evaluate((name) => {
    const all = Array.from(document.querySelectorAll('*'));
    const match = all.find(e =>
      new RegExp(name, 'i').test(e.textContent?.trim()) &&
      e.textContent.trim().length < 60 && e.offsetWidth > 0
    );
    if (match) { match.click(); return true; }
    return false;
  }, programName);
  if (chosen) {
    log(`[login] ${programName} account selected ✅`);
    await page.waitForTimeout(4000);
  }
}

/**
 * Verify current page is an Impact advertiser dashboard.
 */
async function checkLoginSuccess(page, log = console.log) {
  try {
    await page.waitForTimeout(2000);
    const url = page.url();
    const title = await page.title().catch(() => '');
    const success = url.includes('secure/advertiser') ||
                    title.includes('Marketplace') ||
                    title.includes('Dashboard') ||
                    title.includes('Impact -');
    log(`[login] ${success ? '✅ LOGIN SUCCESS' : '❌ LOGIN FAILED'}: "${title.substring(0, 40)}" | ${url.substring(0, 60)}`);
    return success;
  } catch (e) {
    log('[login] checkLoginSuccess err:', e.message?.slice(0, 50));
    return false;
  }
}

module.exports = { performImpactLogin, chooseProgramAccount, checkLoginSuccess };
