// Impact.com bulk proposal script v5 — Optimized via page.evaluate()
// Wraps DOM code in page.evaluate() to execute in browser context
// Variables injected at call time via placeholders

async (page) => {
  // Execute entire script in browser DOM context via page.evaluate()
  const result = await page.evaluate(async () => {
    // === INJECT THESE VARIABLES (replace placeholders before running) ===
    const MSG = "%%MSG%%";
    const TEMPLATE_TERM = "%%TEMPLATE_TERM%%";
    const CONTRACT_DATE = "%%CONTRACT_DATE%%";
    const ALREADY = %%ALREADY%%;
    const TARGET = %%TARGET%%;
    // === END INJECTION ===

    // Native setTimeout works in browser context
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const alreadySet = new Set(ALREADY.map(n => n.toLowerCase()));
    const invited = [];
    const skipped = [];
    const errors = [];
    const seen = new Set();
    let staleCount = 0;

    // Helper: close any open modal/popup using native DOM
    const closeModal = async () => {
      try {
        // Try X/close buttons
        const closeBtns = document.querySelectorAll('[aria-label="Close"], [data-dismiss="modal"], .modal-close, button.close, [class*="close-button"], [class*="CloseButton"]');
        for (const btn of closeBtns) {
          try {
            btn.click();
            await sleep(500);
          } catch (e) {}
        }
        // Try OK/Done/Got it buttons
        const confirmBtns = document.querySelectorAll('button');
        for (const btn of confirmBtns) {
          const text = btn.textContent?.trim();
          if (['OK', 'Done', 'Got it', 'Close'].includes(text)) {
            try {
              btn.click();
              await sleep(300);
            } catch (e) {}
          }
        }
      } catch (e) {}
    };

    // Helper: wait for element with timeout (polling with native DOM)
    const waitFor = async (selector, timeout = 5000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const el = document.querySelector(selector);
        if (el) return true;
        await sleep(100);
      }
      return false;
    };

    // Helper: find first "Send Proposal" button on the page (native DOM)
    const getFirstProposalButton = () => {
      const buttons = document.querySelectorAll('button, a[role="button"]');
      for (const btn of buttons) {
        const text = btn.textContent;
        if (text?.toLowerCase().includes('send proposal')) {
          return btn;
        }
      }
      return null;
    };

    // Helper: check if element is truly visible (native DOM only)
    const isButtonVisible = (el) => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      const display = style.display;
      const visibility = style.visibility;
      const opacity = style.opacity;
      console.log(`[visibility check] display=${display}, visibility=${visibility}, opacity=${opacity}`);
      return display !== 'none' && visibility !== 'hidden' && parseFloat(opacity) > 0;
    };

    // Helper: get publisher card parent (walk up DOM with native elements)
    const getPublisherCard = (button) => {
      if (!button) return null;
      let current = button;
      for (let i = 0; i < 10; i++) {
        if (!current) break;
        const className = current.className || '';
        if (className.includes('card') || className.includes('Card') || className.includes('partner') || className.includes('Partner') || className.includes('result') || className.includes('Result')) {
          return current;
        }
        current = current.parentElement;
      }
      return null;
    };

    // Helper: extract publisher name from card (native DOM)
    const getPublisherName = (card) => {
      if (!card) return 'Unknown';
      const nameEl = card.querySelector('a[href*="partner"], [class*="name"], [class*="Name"], h3, h4, .partner-name');
      if (nameEl) return nameEl.textContent.trim();
      const firstText = card.querySelector('td, [class*="cell"], span')?.textContent?.trim();
      if (firstText && firstText.length < 100) return firstText;
      return 'Unknown';
    };

    // Helper: extract email from card (native DOM)
    const getPublisherEmail = (card) => {
      if (!card) return '';
      const emailEl = card.querySelector('a[href^="mailto:"], [class*="email"], [class*="Email"]');
      if (emailEl) {
        if (emailEl.href) return emailEl.href.replace('mailto:', '');
        return emailEl.textContent.trim();
      }
      return '';
    };

    // Helper: extract publisher ID from card (native DOM)
    const getPublisherId = (card) => {
      if (!card) return '';
      const idLink = card.querySelector('a[href*="partner"]');
      if (idLink && idLink.href) {
        const match = idLink.href.match(/partner[\\/=](\\d+)/);
        return match ? match[1] : '';
      }
      return '';
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
        const btn = getFirstProposalButton();
        if (!btn) break;

        // Get the publisher card
        const card = getPublisherCard(btn);
        if (!card) {
          errors.push({ name: 'Unknown', reason: 'card_not_found' });
          continue;
        }

        // Extract publisher info
        const name = getPublisherName(card);
        const email = getPublisherEmail(card);
        const publisherId = getPublisherId(card);

        // DEDUP: skip if already contacted
        if (alreadySet.has(name.toLowerCase()) || seen.has(name.toLowerCase())) {
          card.style.display = 'none';
          staleCount++;
          await sleep(300);
          continue;
        }

        staleCount = 0;
        seen.add(name.toLowerCase());

        console.log(`[${i}] Processing: ${name}`);

        // === CRITICAL: Hover the card to reveal the hidden button ===
        let buttonVisible = false;
        let hoverAttempts = 0;
        const maxHoverAttempts = 3;

        while (!buttonVisible && hoverAttempts < maxHoverAttempts) {
          hoverAttempts++;
          console.log(`[hover attempt ${hoverAttempts}/${maxHoverAttempts}] ${name}`);

          try {
            // Scroll card into view
            card.scrollIntoView({ block: 'center' });
            await sleep(300);

            // Dispatch mouseenter on card to trigger hover state
            card.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }));
            btn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }));

            // Wait for React to render button in visible state
            await sleep(2000);

            // Dispatch mousemove on card
            const rect = card.getBoundingClientRect();
            document.elementFromPoint(rect.left + 50, rect.top + 50)?.dispatchEvent(
              new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: rect.left + 50, clientY: rect.top + 50 })
            );
            await sleep(500);

            // Check visibility after hover
            const freshBtn = getFirstProposalButton();
            if (freshBtn) {
              buttonVisible = isButtonVisible(freshBtn);
              if (buttonVisible) {
                console.log(`[visibility confirmed] Button is visible after ${hoverAttempts} attempt(s)`);
              }
            }
          } catch (e) {
            console.log(`[hover error attempt ${hoverAttempts}] ${e.message?.substring(0, 80)}`);
          }

          if (!buttonVisible && hoverAttempts < maxHoverAttempts) {
            console.log(`[hover retry] Waiting 1000ms before retry...`);
            await sleep(1000);
          }
        }

        if (!buttonVisible) {
          errors.push({ name, reason: 'button_not_visible_after_hover' });
          console.log(`[SKIP] Could not make button visible after ${maxHoverAttempts} attempts: ${name}`);
          continue;
        }

        // Click the button - get fresh reference after hover
        try {
          const freshBtn = getFirstProposalButton();
          if (!freshBtn) {
            errors.push({ name, reason: 'button_stale_after_hover' });
            continue;
          }

          // Final visibility check before click
          const visibleBeforeClick = isButtonVisible(freshBtn);
          if (!visibleBeforeClick) {
            errors.push({ name, reason: 'button_invisible_before_click' });
            console.log(`[SKIP] Button became invisible right before click: ${name}`);
            continue;
          }

          // Ensure button is in view
          freshBtn.scrollIntoView({ block: 'center' });
          await sleep(500);

          // Click
          console.log(`[CLICK] Attempting click on button for: ${name}`);
          freshBtn.click();
          console.log(`[CLICK SUCCESS] Button clicked for: ${name}`);
        } catch (e) {
          errors.push({ name, reason: 'button_click_failed: ' + e.message?.substring(0, 40) });
          console.log(`[CLICK FAILED] ${e.message?.substring(0, 100)}`);
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

        const modal = document.querySelector('[class*="modal"], [class*="Modal"], [role="dialog"], [class*="slideout"], [class*="Slideout"]');

        // Select template term from dropdown
        let termSelected = false;
        try {
          const selects = modal.querySelectorAll('select');
          for (const sel of selects) {
            const options = sel.querySelectorAll('option');
            for (const opt of options) {
              const text = opt.textContent;
              if (text?.includes(TEMPLATE_TERM) || text?.includes('5%')) {
                opt.selected = true;
                sel.dispatchEvent(new Event('change', { bubbles: true }));
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
            const dropdowns = modal.querySelectorAll('[class*="dropdown"], [class*="Dropdown"], [class*="select"], [class*="Select"]');
            for (const dd of dropdowns) {
              dd.click();
              await sleep(1000);
              const options = document.querySelectorAll('[class*="option"], [class*="Option"], [role="option"], li');
              for (const opt of options) {
                const text = opt.textContent;
                if (text?.includes(TEMPLATE_TERM) || text?.includes('5%')) {
                  opt.click();
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
          const dateInputs = modal.querySelectorAll('input[type="date"], input[type="text"][placeholder*="date"], input[placeholder*="Date"], input[name*="date"], input[name*="Date"]');
          for (const di of dateInputs) {
            di.value = CONTRACT_DATE;
            di.dispatchEvent(new Event('change', { bubbles: true }));
          }
        } catch (e) {}

        // Enter message in textarea
        try {
          const textareas = modal.querySelectorAll('textarea');
          for (const ta of textareas) {
            ta.value = MSG;
            ta.dispatchEvent(new Event('change', { bubbles: true }));
          }
        } catch (e) {}

        await sleep(500);

        // Click submit button
        try {
          const buttons = modal.querySelectorAll('button');
          for (const submitBtn of buttons) {
            const text = submitBtn.textContent?.trim().toLowerCase();
            if ((text?.includes('send') || text?.includes('submit') || text?.includes('confirm')) && isButtonVisible(submitBtn)) {
              submitBtn.click();
              invited.push({ name, email, publisherId });
              alreadySet.add(name.toLowerCase());
              console.log(`[SUCCESS] Proposal sent to: ${name}`);
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
          card.style.display = 'none';
        } catch (e) {}

      } catch (e) {
        errors.push({ name: 'loop_error', reason: e.message?.substring(0, 80) });
        await closeModal();
        await sleep(1000);
      }
    }

    console.log(`[COMPLETE] Total invited: ${invited.length}, Errors: ${errors.length}`);
    return {
      total: invited.length,
      skipped: skipped.length,
      errorCount: errors.length,
      publishers: invited,
      errors: errors.slice(0, 5)
    };
  });

  return result;
}
