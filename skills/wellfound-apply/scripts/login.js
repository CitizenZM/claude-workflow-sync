// Wellfound login — run via browser_evaluate after navigating to wellfound.com/login
// Returns: { success: true, url: string } or { success: false, error: string }
(async () => {
  const email = 'xz429@cornell.edu';
  const password = 'Barronzuo1414514!';

  // Try to find email field
  const emailSelectors = ['input[type="email"]', 'input[name="email"]', 'input[placeholder*="email" i]'];
  let emailEl = null;
  for (const sel of emailSelectors) {
    emailEl = document.querySelector(sel);
    if (emailEl) break;
  }

  if (!emailEl) return { success: false, error: 'email field not found', url: window.location.href };

  // Fill email
  emailEl.focus();
  emailEl.value = email;
  emailEl.dispatchEvent(new Event('input', { bubbles: true }));
  emailEl.dispatchEvent(new Event('change', { bubbles: true }));

  // Fill password
  const pwSelectors = ['input[type="password"]', 'input[name="password"]'];
  let pwEl = null;
  for (const sel of pwSelectors) {
    pwEl = document.querySelector(sel);
    if (pwEl) break;
  }

  if (pwEl) {
    pwEl.focus();
    pwEl.value = password;
    pwEl.dispatchEvent(new Event('input', { bubbles: true }));
    pwEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  return {
    emailFound: !!emailEl,
    passwordFound: !!pwEl,
    url: window.location.href,
    title: document.title
  };
})();
