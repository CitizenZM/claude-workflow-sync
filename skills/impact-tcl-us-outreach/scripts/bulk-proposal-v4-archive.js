// Impact.com bulk proposal script v4 — Playwright page object methods only
// Run via browser_run_code with page object
// Variables injected at call time via placeholders

async (page) => {
  // === INJECT THESE VARIABLES (replace placeholders before running) ===
  const MSG = "%%MSG%%";
  const TEMPLATE_TERM = "%%TEMPLATE_TERM%%";
  const CONTRACT_DATE = "%%CONTRACT_DATE%%";
  const ALREADY = %%ALREADY%%;
  const TARGET = %%TARGET%%;
  // === END INJECTION ===

  const sleep = ms => page.evaluate(ms => new Promise(r => setTimeout(r, ms)), ms);
  const alreadySet = new Set(ALREADY.map(n => n.toLowerCase()));
  const invited = [];
  const skipped = [];
  const errors = [];
  const seen = new Set();
  let staleCount = 0;

  // Helper: close any open modal/popup
  const closeModal = async () => {
    try {
      // Try X/close buttons
      const closeBtns = await page.locator('[aria-label="Close"], [data-dismiss="modal"], .modal-close, button.close, [class*="close-button"], [class*="CloseButton"]').all();
      for (const btn of closeBtns) {
        try {
          await btn.click({ timeout: 500 });
          await sleep(500);
        } catch (e) {}
      }
      // Try Escape key
      await page.keyboard.press('Escape');
      await sleep(500);
      // Click OK/Done/Got it if confirmation
      const confirmBtns = await page.locator('button').all();
      for (const btn of confirmBtns) {
        const text = await btn.textContent();
        if (['OK', 'Done', 'Got it', 'Close'].includes(text?.trim())) {
          try {
            await btn.click({ timeout: 500 });
            await sleep(300);
          } catch (e) {}
        }
      }
    } catch (e) {}
  };

  // Helper: wait for element with timeout
  const waitFor = async (selector, timeout = 5000) => {
    try {
      await page.locator(selector).first().waitFor({ timeout });
      return true;
    } catch (e) {
      return false;
    }
  };

  // Helper: find first "Send Proposal" button on the page
  const getFirstProposalButton = async () => {
    try {
      const buttons = await page.locator('button, a[role="button"]').all();
      for (const btn of buttons) {
        const text = await btn.textContent();
        if (text?.toLowerCase().includes('send proposal')) {
          return btn;
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  // Helper: get publisher card parent (walk up DOM)
  const getPublisherCard = async (button) => {
    try {
      return await button.evaluate(el => {
        return el.closest('[class*="card"], [class*="Card"], [class*="partner"], [class*="Partner"], [class*="result"], [class*="Result"]') || el.parentElement?.parentElement?.parentElement;
      });
    } catch (e) {
      return null;
    }
  };

  // Helper: extract publisher name from card
  const getPublisherName = async (card) => {
    try {
      if (!card) return 'Unknown';
      const name = await card.evaluate(el => {
        const nameEl = el.querySelector('a[href*="partner"], [class*="name"], [class*="Name"], h3, h4, .partner-name');
        if (nameEl) return nameEl.textContent.trim();
        const firstText = el.querySelector('td, [class*="cell"], span')?.textContent?.trim();
        if (firstText && firstText.length < 100) return firstText;
        return 'Unknown';
      });
      return name;
    } catch (e) {
      return 'Unknown';
    }
  };

  // Helper: extract email from card
  const getPublisherEmail = async (card) => {
    try {
      if (!card) return '';
      return await card.evaluate(el => {
        const emailEl = el.querySelector('a[href^="mailto:"], [class*="email"], [class*="Email"]');
        if (emailEl) return emailEl.textContent.trim() || emailEl.href?.replace('mailto:', '') || '';
        return '';
      });
    } catch (e) {
      return '';
    }
  };

  // Helper: extract publisher ID from card
  const getPublisherId = async (card) => {
    try {
      if (!card) return '';
      return await card.evaluate(el => {
        const idLink = el.querySelector('a[href*="partner"]');
        if (idLink) return idLink.href?.match(/partner[\\/=](\\d+)/)?.[1] || '';
        return '';
      });
    } catch (e) {
      return '';
    }
  };

  // Main loop
  for (let i = 0; i < TARGET + 30; i++) {
    if (invited.length >= TARGET) break;
    if (staleCount > 10) break;

    try {
      // Dismiss any leftover modals
      await closeModal();
      await sleep(500);

      // Find first proposal button
      const btn = await getFirstProposalButton();
      if (!btn) break;

      // Get the publisher card
      const cardHandle = await btn.evaluate(el => el.closest('[class*="card"], [class*="Card"], [class*="partner"], [class*="Partner"], [class*="result"], [class*="Result"]') || el.parentElement?.parentElement?.parentElement);
      
      if (!cardHandle) {
        errors.push({ name: 'Unknown', reason: 'card_not_found' });
        continue;
      }

      // Extract publisher info
      const name = await getPublisherName(cardHandle);
      const email = await getPublisherEmail(cardHandle);
      const publisherId = await getPublisherId(cardHandle);

      // DEDUP: skip if already contacted
      if (alreadySet.has(name.toLowerCase()) || seen.has(name.toLowerCase())) {
        try {
          await cardHandle.evaluate(el => { el.style.display = 'none'; });
        } catch (e) {}
        staleCount++;
        await sleep(300);
        continue;
      }

      staleCount = 0;
      seen.add(name.toLowerCase());

      // === CRITICAL: Hover the card to reveal the hidden button ===
      // The button has display: none until the card is hovered
      try {
        await page.evaluate(el => { el.scrollIntoView(); }, cardHandle);
        // Dispatch mouseenter on multiple elements to trigger hover state
        await btn.evaluate(el => {
          el.parentElement?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        });
        await sleep(1000);
        // Also try moving mouse to trigger CSS :hover
        await page.mouse.move(500, 500);
        await sleep(300);
      } catch (e) {}

      // Click the button - REFETCH fresh reference after hover to avoid stale handle
      try {
        // Get fresh button reference after hover
        const freshBtn = await getFirstProposalButton();
        if (!freshBtn) {
          errors.push({ name, reason: 'button_stale_after_hover' });
          continue;
        }
        // Ensure button is in view and clickable
        await freshBtn.evaluate(el => { el.scrollIntoView({ block: 'center' }); });
        await sleep(300);
        // Click with force to ensure it registers
        await freshBtn.click({ force: true, timeout: 5000 });
      } catch (e) {
        errors.push({ name, reason: 'button_click_failed: ' + e.message.substring(0, 40) });
        continue;
      }

      await sleep(3000);

      // Wait for modal
      const modalExists = await waitFor('[class*="modal"], [class*="Modal"], [role="dialog"], [class*="slideout"], [class*="Slideout"]', 5000);
      if (!modalExists) {
        errors.push({ name, reason: 'modal_not_found' });
        await closeModal();
        continue;
      }

      const modal = page.locator('[class*="modal"], [class*="Modal"], [role="dialog"], [class*="slideout"], [class*="Slideout"]').first();

      // Select template term from dropdown
      let termSelected = false;
      try {
        const selects = await modal.locator('select').all();
        for (const sel of selects) {
          const options = await sel.locator('option').all();
          for (const opt of options) {
            const text = await opt.textContent();
            if (text?.includes(TEMPLATE_TERM) || text?.includes('5%')) {
              await opt.evaluate(el => { el.selected = true; });
              await sel.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
              termSelected = true;
              break;
            }
          }
          if (termSelected) break;
        }
      } catch (e) {}

      // Also try React-style dropdowns
      if (!termSelected) {
        try {
          const dropdowns = await modal.locator('[class*="dropdown"], [class*="Dropdown"], [class*="select"], [class*="Select"]').all();
          for (const dd of dropdowns) {
            await dd.click();
            await sleep(1000);
            const options = await page.locator('[class*="option"], [class*="Option"], [role="option"], li').all();
            for (const opt of options) {
              const text = await opt.textContent();
              if (text?.includes(TEMPLATE_TERM) || text?.includes('5%')) {
                await opt.click();
                termSelected = true;
                await sleep(500);
                break;
              }
            }
            if (termSelected) break;
          }
        } catch (e) {}
      }

      // Set contract date
      try {
        const dateInputs = await modal.locator('input[type="date"], input[type="text"][placeholder*="date"], input[placeholder*="Date"], input[name*="date"], input[name*="Date"]').all();
        for (const di of dateInputs) {
          await di.fill(CONTRACT_DATE);
          await di.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
        }
      } catch (e) {}

      // Enter message in textarea
      try {
        const textareas = await modal.locator('textarea').all();
        for (const ta of textareas) {
          await ta.fill(MSG);
          await ta.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
        }
      } catch (e) {}

      await sleep(500);

      // Click submit button
      try {
        const buttons = await modal.locator('button').all();
        for (const submitBtn of buttons) {
          const text = await submitBtn.textContent();
          const t = text?.trim().toLowerCase();
          if ((t?.includes('send') || t?.includes('submit') || t?.includes('confirm')) && await submitBtn.isVisible()) {
            await submitBtn.click();
            invited.push({ name, email, publisherId });
            alreadySet.add(name.toLowerCase());
            await sleep(4000);
            await closeModal();
            await sleep(1000);
            break;
          }
        }
      } catch (e) {
        errors.push({ name, reason: 'submit_failed' });
        await closeModal();
      }

      // Hide processed card
      try {
        await cardHandle.evaluate(el => { el.style.display = 'none'; });
      } catch (e) {}

    } catch (e) {
      errors.push({ name: 'loop_error', reason: e.message?.substring(0, 80) });
      await closeModal();
      await sleep(1000);
    }
  }

  return JSON.stringify({
    total: invited.length,
    skipped: skipped.length,
    errorCount: errors.length,
    publishers: invited,
    errors: errors.slice(0, 5)
  });
}
