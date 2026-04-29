// Apply role + location filters on wellfound.com/jobs
// Returns: { filtersApplied: string[], jobCount: number, error?: string }
(async () => {
  const results = { filtersApplied: [], jobCount: 0, selectors: {} };

  // Try to find role/search input
  const roleSelectors = [
    'input[placeholder*="Role" i]',
    'input[placeholder*="Job title" i]',
    'input[placeholder*="Search" i]',
    'input[name="role"]',
    '[data-test="role-input"] input',
    '.role-filter input'
  ];

  let roleInput = null;
  for (const sel of roleSelectors) {
    roleInput = document.querySelector(sel);
    if (roleInput) { results.selectors.roleInput = sel; break; }
  }

  // Try to find location input
  const locSelectors = [
    'input[placeholder*="Location" i]',
    'input[placeholder*="City" i]',
    'input[name="location"]',
    '[data-test="location-input"] input',
    '.location-filter input'
  ];

  let locInput = null;
  for (const sel of locSelectors) {
    locInput = document.querySelector(sel);
    if (locInput) { results.selectors.locationInput = sel; break; }
  }

  // Count visible job cards
  const cardSelectors = [
    '[data-test="StartupResult"]',
    '[data-test="JobResult"]',
    '.styles_component__',
    '[class*="job-card"]',
    '[class*="JobCard"]',
    'article[class*="job"]'
  ];

  for (const sel of cardSelectors) {
    const cards = document.querySelectorAll(sel);
    if (cards.length > 0) {
      results.jobCount = cards.length;
      results.selectors.jobCard = sel;
      break;
    }
  }

  results.roleInputFound = !!roleInput;
  results.locationInputFound = !!locInput;
  results.pageTitle = document.title;
  results.url = window.location.href;

  return results;
})();
