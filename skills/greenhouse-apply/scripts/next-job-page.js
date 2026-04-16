// Navigate to next page of job listings — run via browser_evaluate
// Returns: { navigated, newUrl, jobCount }
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Find next page button/link
  const nextBtn = document.querySelector(
    '[aria-label="Next"], [aria-label="Next page"], ' +
    '.pagination-next, a[rel="next"], ' +
    '[class*="next" i]:not([class*="prev"]), ' +
    'button:has-text("Next"), a:has-text("Next")'
  );

  // Also try numbered pagination
  let nextByNumber = null;
  if (!nextBtn) {
    const paginationLinks = Array.from(document.querySelectorAll('.pagination a, [class*="pagination"] a, nav[aria-label="pagination"] a'));
    const currentPage = paginationLinks.find(a => a.classList.contains('active') || a.getAttribute('aria-current') === 'page');
    if (currentPage) {
      const currentNum = parseInt(currentPage.textContent);
      nextByNumber = paginationLinks.find(a => parseInt(a.textContent) === currentNum + 1);
    }
  }

  const btn = nextBtn || nextByNumber;

  if (!btn) {
    return JSON.stringify({
      navigated: false,
      newUrl: window.location.href,
      jobCount: 0,
      message: 'No next page button found — likely on last page'
    });
  }

  btn.click();
  await sleep(3000);

  // Count jobs on new page
  const jobCards = document.querySelectorAll(
    '.job-listing, .job-row, [data-testid="job-card"], .job-post, ' +
    'tr.job, .job_listing, li.job, [class*="JobCard"], [class*="job-card"]'
  );

  return JSON.stringify({
    navigated: true,
    newUrl: window.location.href,
    jobCount: jobCards.length,
    message: 'Successfully navigated to next page'
  });
})();
