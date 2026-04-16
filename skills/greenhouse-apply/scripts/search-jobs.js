// Greenhouse job search script — run via browser_evaluate
// Searches by keyword and identifies salary filter controls
// Returns: { totalJobs, currentPage, url, hasFilter, filterInfo }
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Try to find search input
  const searchInput = document.querySelector(
    'input[type="search"], input[placeholder*="Search"], input[placeholder*="search"], ' +
    'input[name="query"], input[name="search"], input[name="q"], input[aria-label*="search" i]'
  );

  // Try to find filter/sort controls
  const filterControls = document.querySelectorAll(
    'select, [data-filter], button[aria-expanded], [role="combobox"], ' +
    '.filter, .filters, [class*="filter"], [class*="Filter"]'
  );

  // Try to find salary-related elements
  const salaryElements = document.querySelectorAll(
    '[class*="salary" i], [class*="compensation" i], [data-field*="salary" i], ' +
    'label:has-text("salary"), label:has-text("Salary"), option[value*="salary" i]'
  );

  // Count visible job cards/listings
  const jobCards = document.querySelectorAll(
    '.job-listing, .job-row, [data-testid="job-card"], .job-post, ' +
    'tr.job, .job_listing, li.job, [class*="JobCard"], [class*="job-card"], ' +
    'a[href*="/job/"], a[href*="/jobs/"]'
  );

  // Collect all links that look job-related
  const jobLinks = Array.from(document.querySelectorAll('a')).filter(a =>
    a.href && (a.href.includes('/job') || a.href.includes('/application') || a.href.includes('/posting'))
  );

  return JSON.stringify({
    totalJobs: jobCards.length,
    jobLinksFound: jobLinks.length,
    currentPage: 1,
    url: window.location.href,
    pageTitle: document.title,
    hasSearchInput: !!searchInput,
    searchInputSelector: searchInput ? (searchInput.name || searchInput.id || searchInput.placeholder) : null,
    filterCount: filterControls.length,
    salaryFilterFound: salaryElements.length > 0,
    bodyText: document.body.innerText.substring(0, 3000)
  });
})();
