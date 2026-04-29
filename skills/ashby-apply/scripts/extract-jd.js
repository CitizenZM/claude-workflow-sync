// Extract JD from Ashby job detail page — run via browser_evaluate
// Also attempts Ashby public API first (faster)
// Returns: { title, company, salary, location, jdText, jobUuid, applyUrl }
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  await sleep(1500);

  // Extract UUID from URL
  const urlMatch = window.location.pathname.match(/\/([0-9a-f-]{36})/i);
  const jobUuid = urlMatch ? urlMatch[1] : '';

  // Company from URL slug
  const companySlug = window.location.pathname.split('/')[1] || '';
  const companyDisplay = companySlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  // Title
  const title = document.querySelector('h1')?.textContent?.trim() || document.title.split('@')[0].trim();

  // Salary — Ashby shows it prominently
  const salaryEl = document.querySelector('[class*="compensation"], [class*="Compensation"], [class*="salary"], [class*="Salary"]');
  const salary = salaryEl?.textContent?.trim() || '';

  // Location
  const locationEl = document.querySelector('[class*="location"], [class*="Location"]');
  const location = locationEl?.textContent?.trim() || '';

  // JD text — Ashby renders in main content
  const jdSelectors = ['[class*="jobPosting"]', '[class*="job-description"]', 'main', 'article', '[class*="content"]'];
  let jdText = '';
  for (const sel of jdSelectors) {
    const el = document.querySelector(sel);
    if (el && el.innerText.length > 300) { jdText = el.innerText; break; }
  }
  if (!jdText) jdText = document.body.innerText.substring(0, 6000);

  // Apply URL
  const applyUrl = jobUuid
    ? `https://jobs.ashbyhq.com/${companySlug}/${jobUuid}/application`
    : window.location.href.replace(/\/?$/, '/application');

  return JSON.stringify({
    title,
    company: companyDisplay,
    companySlug,
    salary,
    location,
    jdText: jdText.substring(0, 7000),
    jobUuid,
    applyUrl,
    pageUrl: window.location.href
  });
})();
