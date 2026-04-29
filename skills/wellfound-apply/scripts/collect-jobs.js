// Collect all visible job cards from wellfound.com/jobs results page
// Returns: { jobs: Array<{title, company, location, url, jobId, comp, saved}>, total: number }
(() => {
  const jobs = [];

  // Try multiple card selector patterns for Wellfound's React components
  const cardSelectors = [
    '[data-test="StartupResult"]',
    '[data-test="JobResult"]',
    '[class*="styles_component"]',
    '[class*="JobResult"]',
    '[class*="job-listing"]',
    'div[class*="Component"] > div[class*="header"]',
    'article'
  ];

  let cards = [];
  let usedSelector = '';
  for (const sel of cardSelectors) {
    cards = Array.from(document.querySelectorAll(sel));
    if (cards.length > 2) { usedSelector = sel; break; }
  }

  for (const card of cards) {
    try {
      // Extract title
      const titleEl = card.querySelector('h2, h3, [class*="title"], [class*="role"], a[href*="/jobs/"]');
      const title = titleEl?.textContent?.trim() || '';

      // Extract company
      const companyEl = card.querySelector('[class*="startup"], [class*="company"], h4, [data-test="company-name"]');
      const company = companyEl?.textContent?.trim() || '';

      // Extract URL
      const linkEl = card.querySelector('a[href*="/jobs/"], a[href*="/company/"]');
      const url = linkEl ? (linkEl.href || '') : '';

      // Extract job ID from URL
      const jobId = url.match(/\/jobs\/([^/?#]+)/)?.[1] || url.match(/\/([^/?#]+)$/)?.[1] || '';

      // Extract location
      const locEl = card.querySelector('[class*="location"], [data-test="location"], [class*="Location"]');
      const location = locEl?.textContent?.trim() || '';

      // Extract comp if visible
      const compEl = card.querySelector('[class*="salary"], [class*="comp"], [class*="Salary"]');
      const comp = compEl?.textContent?.trim() || '';

      // Check if already saved/bookmarked
      const saveBtn = card.querySelector('[aria-label*="save" i], [aria-label*="bookmark" i], [class*="save"], [class*="bookmark"]');
      const saved = saveBtn ? (saveBtn.getAttribute('aria-pressed') === 'true' || saveBtn.classList.toString().includes('active') || saveBtn.classList.toString().includes('saved')) : false;

      if (title || url) {
        jobs.push({ title, company, location, url, jobId, comp, saved });
      }
    } catch (e) {
      // skip malformed card
    }
  }

  return { jobs, total: jobs.length, selectorUsed: usedSelector, pageUrl: window.location.href };
})();
