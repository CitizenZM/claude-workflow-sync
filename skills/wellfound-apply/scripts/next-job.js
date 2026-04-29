// Scroll to find next unsaved/unapplied job card on Wellfound jobs page
// Returns: { found: boolean, title: string, company: string, url: string, position: number }
(() => {
  // Scroll down to load more jobs
  window.scrollBy(0, 400);

  const cardSelectors = [
    '[data-test="StartupResult"]',
    '[data-test="JobResult"]',
    '[class*="styles_component"]',
    '[class*="JobResult"]',
    'article'
  ];

  let cards = [];
  for (const sel of cardSelectors) {
    cards = Array.from(document.querySelectorAll(sel));
    if (cards.length > 2) break;
  }

  // Find next card that doesn't show as applied
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const text = card.textContent?.toLowerCase() || '';
    // Skip cards already marked as applied
    if (text.includes('applied') && !text.includes('apply')) continue;

    const titleEl = card.querySelector('h2, h3, [class*="title"], [class*="role"]');
    const companyEl = card.querySelector('[class*="startup"], [class*="company"], h4');
    const linkEl = card.querySelector('a[href*="/jobs/"]');

    return {
      found: true,
      title: titleEl?.textContent?.trim() || '',
      company: companyEl?.textContent?.trim() || '',
      url: linkEl?.href || '',
      position: i,
      totalCards: cards.length
    };
  }

  return { found: false, totalCards: cards.length, message: 'No more unapplied jobs visible — scroll or paginate' };
})();
