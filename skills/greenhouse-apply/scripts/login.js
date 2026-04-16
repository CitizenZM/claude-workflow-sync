// Greenhouse login script — run via browser_evaluate after navigating to my.greenhouse.io
// Returns: { success: bool, url: string, error: string|null }
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Check if already logged in
  const isLoggedIn = !!document.querySelector('[data-testid="user-menu"], .user-avatar, nav a[href*="account"], a[href*="dashboard"]');
  if (isLoggedIn) {
    return JSON.stringify({ success: true, url: window.location.href, error: null, message: 'Already logged in' });
  }

  // Find and fill email field
  const emailInput = document.querySelector('input[type="email"], input[name="email"], input[name="user[email]"], input[id*="email"]');
  if (!emailInput) {
    return JSON.stringify({ success: false, url: window.location.href, error: 'Email input not found' });
  }

  return JSON.stringify({
    success: false,
    needsCredentials: true,
    url: window.location.href,
    emailSelector: emailInput.getAttribute('name') || emailInput.getAttribute('id') || 'input[type="email"]',
    error: null,
    message: 'Login form found — use browser_type to enter credentials'
  });
})();
