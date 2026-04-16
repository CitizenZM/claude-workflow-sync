// Extract all job cards from current search results page — run via browser_evaluate
// Returns: JSON array of job objects
(async () => {
  const jobs = [];

  // Strategy 1: Look for structured job card elements
  const cards = document.querySelectorAll(
    '.job-listing, .job-row, [data-testid="job-card"], .job-post, ' +
    'tr.job, .job_listing, li.job, [class*="JobCard"], [class*="job-card"]'
  );

  if (cards.length > 0) {
    cards.forEach((card, idx) => {
      const titleEl = card.querySelector('a, .job-title, h3, h4, h2, [class*="title"]');
      const companyEl = card.querySelector('.company-name, .employer, [class*="company"], [class*="Company"]');
      const salaryEl = card.querySelector('.salary, .compensation, [class*="salary"], [class*="compensation"]');
      const locationEl = card.querySelector('.location, [class*="location"], [class*="Location"]');
      const linkEl = card.querySelector('a[href*="/job"], a[href*="/application"], a[href*="/posting"], a');

      jobs.push({
        index: idx,
        title: titleEl?.textContent?.trim() || '',
        company: companyEl?.textContent?.trim() || '',
        salary: salaryEl?.textContent?.trim() || '',
        location: locationEl?.textContent?.trim() || '',
        jobUrl: linkEl?.href || '',
        jobId: linkEl?.href?.match(/\/(\d+)/)?.[1] || '',
        cardText: card.textContent?.trim()?.substring(0, 200) || ''
      });
    });
  }

  // Strategy 2: If no structured cards found, look for any job-related links
  if (jobs.length === 0) {
    const allLinks = Array.from(document.querySelectorAll('a')).filter(a =>
      a.href && (a.href.includes('/job') || a.href.includes('/application') || a.href.includes('/posting'))
    );

    allLinks.forEach((link, idx) => {
      const parentText = link.closest('li, tr, div, article')?.textContent?.trim()?.substring(0, 300) || '';
      jobs.push({
        index: idx,
        title: link.textContent?.trim() || '',
        company: '',
        salary: '',
        location: '',
        jobUrl: link.href,
        jobId: link.href.match(/\/(\d+)/)?.[1] || '',
        cardText: parentText
      });
    });
  }

  // Check for pagination
  const nextBtn = document.querySelector(
    '[aria-label="Next"], .pagination-next, a:has-text("Next"), ' +
    'button:has-text("Next"), [class*="next"], a[rel="next"]'
  );
  const pageInfo = document.querySelector(
    '.pagination, [class*="pagination"], [class*="Pagination"], [aria-label="pagination"]'
  );

  return JSON.stringify({
    jobs: jobs,
    totalOnPage: jobs.length,
    hasNextPage: !!nextBtn,
    paginationText: pageInfo?.textContent?.trim()?.substring(0, 100) || ''
  });
})();
