// Extract full job description from a Wellfound job detail page
// Returns: { title, company, location, comp, description, requirements, applyUrl, jobId }
(() => {
  const result = {};

  // Title
  const titleEl = document.querySelector('h1, [data-test="job-title"], [class*="jobTitle"], [class*="role-title"]');
  result.title = titleEl?.textContent?.trim() || document.title;

  // Company
  const companyEl = document.querySelector('[data-test="startup-name"], [class*="company-name"], [class*="startupName"], h2');
  result.company = companyEl?.textContent?.trim() || '';

  // Location
  const locEl = document.querySelector('[data-test="location"], [class*="location"], [class*="Location"]');
  result.location = locEl?.textContent?.trim() || '';

  // Compensation
  const compSelectors = ['[data-test="compensation"]', '[class*="salary"]', '[class*="Salary"]', '[class*="comp"]'];
  for (const sel of compSelectors) {
    const el = document.querySelector(sel);
    if (el) { result.comp = el.textContent.trim(); break; }
  }

  // Full description text — grab all paragraphs in the JD area
  const descSelectors = [
    '[data-test="job-description"]',
    '[class*="jobDescription"]',
    '[class*="JobDescription"]',
    '[class*="description"]',
    'section[class*="content"]',
    'div[class*="prose"]'
  ];

  let descEl = null;
  for (const sel of descSelectors) {
    descEl = document.querySelector(sel);
    if (descEl && descEl.textContent.length > 100) break;
  }

  if (descEl) {
    result.description = descEl.innerText || descEl.textContent;
    // Also get structured lists
    const bullets = Array.from(descEl.querySelectorAll('li')).map(li => li.textContent.trim());
    result.requirements = bullets.filter(b => b.length > 10);
  } else {
    // Fallback: grab main content area
    const main = document.querySelector('main, [role="main"], article');
    result.description = main ? (main.innerText || main.textContent).substring(0, 5000) : '';
    result.requirements = [];
  }

  // Apply button URL
  const applyBtn = document.querySelector('a:has-text, [data-test="apply-button"], a[href*="apply"], button[class*="Apply"]');
  result.applyUrl = applyBtn?.href || window.location.href + '/apply';

  // Job ID from URL
  result.jobId = window.location.href.match(/\/jobs\/([^/?#]+)/)?.[1] || '';
  result.pageUrl = window.location.href;

  return result;
})();
