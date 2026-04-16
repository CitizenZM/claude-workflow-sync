// Submit Greenhouse application and verify — run via browser_evaluate
// Returns: { submitted, error, pageTitle, url, confirmationText }
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Find submit button
  const submitBtn = document.querySelector(
    'button[type="submit"], input[type="submit"], ' +
    'button[class*="submit" i], [data-testid*="submit"]'
  );

  // Also try text-based matching
  let submitByText = null;
  if (!submitBtn) {
    const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
    submitByText = buttons.find(b =>
      b.textContent?.toLowerCase()?.includes('submit') ||
      b.textContent?.toLowerCase()?.includes('apply') ||
      b.value?.toLowerCase()?.includes('submit')
    );
  }

  const btn = submitBtn || submitByText;

  if (!btn) {
    return JSON.stringify({
      submitted: false,
      error: 'Submit button not found',
      pageTitle: document.title,
      url: window.location.href,
      confirmationText: null
    });
  }

  // Check for validation errors before submitting
  const existingErrors = document.querySelectorAll(
    '.error, .field-error, [class*="error"], [class*="Error"], ' +
    '[role="alert"], .invalid-feedback, .validation-error'
  );
  const errorTexts = Array.from(existingErrors).map(e => e.textContent.trim()).filter(t => t.length > 0);

  if (errorTexts.length > 0) {
    return JSON.stringify({
      submitted: false,
      error: 'Validation errors present before submit: ' + errorTexts.join('; ').substring(0, 500),
      pageTitle: document.title,
      url: window.location.href,
      confirmationText: null
    });
  }

  // Click submit
  btn.click();
  await sleep(5000);

  // Check for success
  const successIndicators = document.querySelectorAll(
    '.success, .confirmation, [data-testid="success"], ' +
    '.alert-success, [class*="success" i], [class*="confirm" i], [class*="thank" i]'
  );

  // Check for "Thank you" text
  const bodyText = document.body.innerText.toLowerCase();
  const hasThankYou = bodyText.includes('thank you') || bodyText.includes('thanks for applying') ||
                      bodyText.includes('application received') || bodyText.includes('successfully submitted');

  // Check for post-submit errors
  const postErrors = document.querySelectorAll(
    '.error, .field-error, [class*="error"], [role="alert"], .invalid-feedback'
  );
  const postErrorTexts = Array.from(postErrors).map(e => e.textContent.trim()).filter(t => t.length > 0);

  const success = successIndicators.length > 0 || hasThankYou;

  return JSON.stringify({
    submitted: success,
    error: postErrorTexts.length > 0 ? postErrorTexts.join('; ').substring(0, 500) : null,
    pageTitle: document.title,
    url: window.location.href,
    confirmationText: success ? (successIndicators[0]?.textContent?.trim() || 'Thank you') : null
  });
})();
