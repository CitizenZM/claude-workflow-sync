// Submit application and verify success on Wellfound
// Returns: { submitted: boolean, successText: string, error?: string }
(() => {
  const result = { submitted: false, successText: '', url: window.location.href };

  // Check for success state first (idempotent check)
  const successSelectors = [
    '[data-test="application-submitted"]',
    '[class*="success"]',
    '[class*="Success"]',
    '[class*="submitted"]',
    '[class*="Submitted"]',
    '[class*="confirmation"]'
  ];

  for (const sel of successSelectors) {
    const el = document.querySelector(sel);
    if (el && el.textContent.length > 5) {
      result.submitted = true;
      result.successText = el.textContent.trim().substring(0, 200);
      return result;
    }
  }

  // Check for success text in page
  const pageText = document.body.innerText || '';
  if (/application submitted|successfully applied|we received your|thank you for applying/i.test(pageText)) {
    result.submitted = true;
    result.successText = pageText.match(/(application submitted[^.]*\.|successfully applied[^.]*\.|we received your[^.]*\.|thank you for applying[^.]*\.)/i)?.[0] || 'Success confirmed';
    return result;
  }

  // Find and click submit button
  const submitSelectors = [
    'button[type="submit"]:not([disabled])',
    'button:not([disabled]):has-text',
    '[data-test="submit-application"]',
    'button[class*="submit" i]:not([disabled])',
    'button[class*="apply" i]:not([disabled])',
    'input[type="submit"]:not([disabled])'
  ];

  let submitBtn = null;
  for (const sel of submitSelectors) {
    const els = document.querySelectorAll(sel);
    for (const el of els) {
      const text = el.textContent?.toLowerCase() || el.value?.toLowerCase() || '';
      if (text.includes('submit') || text.includes('apply') || text.includes('send')) {
        submitBtn = el;
        break;
      }
    }
    if (submitBtn) break;
  }

  if (!submitBtn) {
    // Last resort: any visible submit-ish button
    const allBtns = document.querySelectorAll('button:not([disabled])');
    for (const btn of allBtns) {
      const text = btn.textContent?.toLowerCase() || '';
      if (text.includes('submit') || text.includes('apply now') || text.includes('send application')) {
        submitBtn = btn;
        break;
      }
    }
  }

  if (submitBtn) {
    result.submitBtnText = submitBtn.textContent?.trim();
    submitBtn.click();
    result.submitted = true;
    result.successText = `Clicked: "${result.submitBtnText}"`;
  } else {
    result.error = 'Submit button not found';
    // Report all button texts for debugging
    result.allButtons = Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(t => t).slice(0, 10);
  }

  return result;
})();
